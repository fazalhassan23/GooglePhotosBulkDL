import { createReadStream, createWriteStream } from "node:fs";
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  link,
  unlink,
  lstat,
  open,
} from "node:fs/promises";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { z } from "zod";
import { digest, relativeTarget } from "./organization";
import { request } from "./network";
import type { Media, Options, Progress } from "./contracts";
const recordSchema = z.object({
  target: z.string(),
  hash: z.string(),
  size: z.number(),
});
const manifestSchema = z.object({
  version: z.literal(1),
  records: z.record(z.string(), recordSchema),
});
type Manifest = z.infer<typeof manifestSchema>;
export async function fileHash(file: string, signal?: AbortSignal) {
  const hash = createHash("sha256");
  let size = 0;
  for await (const chunk of createReadStream(file, { signal })) {
    hash.update(chunk);
    size += chunk.length;
  }
  return { hash: hash.digest("hex"), size };
}
async function ensureDirectory(root: string, relative: string) {
  let current = root;
  const rootStat = await lstat(root);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory())
    throw Error("Destination must be a real directory.");
  for (const part of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try {
      await mkdir(current);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
    const s = await lstat(current);
    if (!s.isDirectory() || s.isSymbolicLink())
      throw Error("Destination contains a link or non-directory.");
  }
}
export class Engine {
  constructor(private dataDirectory: string) {}
  async run(
    media: Media[],
    destination: string,
    options: Options,
    scope: string,
    token: () => Promise<string>,
    signal: AbortSignal,
    report: (p: Progress) => void,
  ) {
    const manifestFile = path.join(this.dataDirectory, "manifest.json");
    let manifest: Manifest = { version: 1, records: {} };
    try {
      manifest = manifestSchema.parse(
        JSON.parse(await readFile(manifestFile, "utf8")),
      );
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT")
        throw Error(
          "Manifest is unreadable. Restore a backup before continuing.",
        );
    }
    const lockFile = path.join(this.dataDirectory, "job.lock");
    let lock;
    try {
      lock = await open(lockFile, "wx");
    } catch {
      throw Error(
        "Job lock exists. Close other instances; after a crash remove job.lock from application data.",
      );
    }
    let queue = Promise.resolve();
    const save = () => {
      queue = queue.then(async () => {
        const temp = manifestFile + ".tmp";
        await writeFile(temp, JSON.stringify(manifest, null, 2), {
          mode: 0o600,
        });
        await rename(temp, manifestFile);
      });
      return queue;
    };
    const progress: Progress = {
      phase: "Transferring",
      total: media.length,
      downloaded: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };
    let cursor = 0;
    const emit = () => report({ ...progress, errors: [...progress.errors] });
    try {
      await ensureDirectory(destination, "");
      emit();
      const worker = async () => {
        while (cursor < media.length && !signal.aborted) {
          const m = media[cursor++];
          let temporary = "";
          try {
            signal.throwIfAborted();
            const key = digest(
              scope +
                "\0" +
                m.id +
                "\0" +
                path.resolve(destination) +
                "\0" +
                options.timezone,
            );
            const previous = manifest.records[key];
            if (previous) {
              const resolved = path.resolve(destination, previous.target);
              if (!resolved.startsWith(path.resolve(destination) + path.sep))
                throw Error("Unsafe manifest path");
              try {
                const s = await lstat(resolved);
                if (s.isFile() && !s.isSymbolicLink()) {
                  const actual = await fileHash(resolved, signal);
                  if (actual.hash === previous.hash) {
                    progress.skipped++;
                    emit();
                    continue;
                  }
                }
              } catch (e) {
                if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
              }
            }
            const relative = relativeTarget(m, options),
              folder = path.dirname(relative);
            await ensureDirectory(destination, folder);
            temporary = path.join(
              destination,
              folder,
              `.gphotos-${randomUUID()}.part`,
            );
            let input: Readable;
            let expected: number | undefined;
            if (m.local) {
              const s = await lstat(m.local);
              if (!s.isFile() || s.isSymbolicLink())
                throw Error("Source is no longer a regular file");
              expected = s.size;
              input = createReadStream(m.local, { signal });
            } else {
              const response = await request(
                m.url + (m.type === "VIDEO" ? "=dv" : "=d"),
                { headers: { Authorization: `Bearer ${await token()}` } },
                signal,
              );
              if (!response.body) throw Error("Empty response");
              const length = response.headers.get("content-length");
              if (length && !response.headers.get("content-encoding"))
                expected = Number(length);
              input = Readable.fromWeb(response.body as never);
            }
            const hash = createHash("sha256");
            let size = 0;
            const meter = new Transform({
              transform(chunk, _encoding, callback) {
                hash.update(chunk);
                size += chunk.length;
                callback(null, chunk);
              },
            });
            await pipeline(
              input,
              meter,
              createWriteStream(temporary, { flags: "wx", mode: 0o600 }),
              { signal },
            );
            if (expected !== undefined && size !== expected)
              throw Error("Incomplete transfer");
            if (size === 0) throw Error("Empty media file");
            const resultHash = hash.digest("hex");
            const handle = await open(temporary, "r+");
            try {
              await handle.sync();
            } finally {
              await handle.close();
            }
            const parsed = path.parse(relative);
            let finalRelative = relative;
            // Hard linking is an atomic no-overwrite finalize on supported local filesystems.
            // It also lets recovery recognize a complete file left before manifest persistence.
            for (let collision = 0; ; collision++) {
              const target = path.join(destination, finalRelative);
              try {
                await link(temporary, target);
                break;
              } catch (e) {
                if ((e as NodeJS.ErrnoException).code !== "EEXIST")
                  throw Error(
                    "Cannot safely finalize on this destination. Choose a writable local filesystem supporting hard links (such as NTFS, APFS or ext4).",
                  );
                const s = await lstat(target);
                if (
                  s.isFile() &&
                  !s.isSymbolicLink() &&
                  (await fileHash(target, signal)).hash === resultHash
                )
                  break;
                finalRelative = path.join(
                  parsed.dir,
                  `${parsed.name}~${digest(scope + m.id).slice(0, 12)}${collision ? "-" + collision : ""}${parsed.ext}`,
                );
              }
            }
            manifest.records[key] = {
              target: finalRelative,
              hash: resultHash,
              size,
            };
            await save();
            await unlink(temporary);
            temporary = "";
            progress.downloaded++;
          } catch (e) {
            if (!signal.aborted) {
              progress.failed++;
              if (progress.errors.length < 100)
                progress.errors.push(
                  `${m.filename}: ${e instanceof Error ? e.message : "Transfer failed"}`,
                );
            }
          } finally {
            if (temporary) await unlink(temporary).catch(() => {});
            emit();
          }
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      await queue;
      progress.phase = signal.aborted
        ? "Cancelled — run the preview again to resume"
        : "Finished";
      emit();
      return progress;
    } finally {
      await lock.close();
      await unlink(lockFile);
    }
  }
}
