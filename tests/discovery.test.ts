import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { build } from "esbuild";
import type { Media } from "../src/contracts";
test("bundled discovery worker discovers capture dates, propagates errors and cancels", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "gphotos-worker-"));
  try {
    const output = path.join(root, "bundle"),
      source = path.join(root, "source");
    await mkdir(source);
    await build({
      entryPoints: ["src/discovery.ts", "src/takeout-worker.ts"],
      outdir: output,
      outExtension: { ".js": ".cjs" },
      bundle: true,
      platform: "node",
      format: "cjs",
    });
    const { discoverInWorker } = createRequire(import.meta.url)(
      path.join(output, "discovery.cjs"),
    ) as {
      discoverInWorker: (root: string, signal: AbortSignal) => Promise<Media[]>;
    };
    await writeFile(path.join(source, "photo.jpg"), "fixture");
    await writeFile(
      path.join(source, "photo.jpg.json"),
      JSON.stringify({ photoTakenTime: { timestamp: "1704067200" } }),
    );
    const items = await discoverInWorker(source, new AbortController().signal);
    assert.equal(items.length, 1);
    assert.equal(items[0].capture, "2024-01-01T00:00:00.000Z");
    await assert.rejects(
      discoverInWorker(
        path.join(root, "missing"),
        new AbortController().signal,
      ),
      /ENOENT/,
    );
    const controller = new AbortController();
    const pending = discoverInWorker(source, controller.signal);
    controller.abort();
    await assert.rejects(pending, /cancelled/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
