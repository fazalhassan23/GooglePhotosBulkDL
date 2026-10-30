import { opendir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import exifr from "exifr";
import { z } from "zod";
import type { Media } from "./contracts";
import { digest } from "./organization";
const sidecar = z.object({
  photoTakenTime: z.object({ timestamp: z.string().regex(/^\d+$/) }).optional(),
});
const photos = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".heic",
  ".heif",
  ".webp",
  ".gif",
  ".tif",
  ".tiff",
  ".avif",
  ".dng",
  ".raw",
]);
const videos = new Set([
  ".mp4",
  ".mov",
  ".m4v",
  ".avi",
  ".mkv",
  ".webm",
  ".3gp",
]);
export async function discoverTakeout(
  root: string,
  signal: AbortSignal,
): Promise<Media[]> {
  const items: Media[] = [];
  async function walk(directory: string) {
    for await (const entry of await opendir(directory)) {
      signal.throwIfAborted();
      if (entry.isSymbolicLink()) continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(file);
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = path.extname(file).toLowerCase();
      if (!photos.has(ext) && !videos.has(ext)) continue;
      let capture: string | undefined;
      // Only exact sidecar matches are accepted; ambiguous truncated titles are never guessed.
      for (const suffix of [".supplemental-metadata.json", ".json"]) {
        try {
          const info = await stat(file + suffix);
          if (info.size > 1024 * 1024) continue;
          const metadata = sidecar.parse(
            JSON.parse(await readFile(file + suffix, "utf8")),
          );
          if (metadata.photoTakenTime) {
            capture = new Date(
              Number(metadata.photoTakenTime.timestamp) * 1000,
            ).toISOString();
            break;
          }
        } catch {
          /* Try embedded metadata when sidecar is missing or invalid. */
        }
      }
      if (!capture && photos.has(ext)) {
        try {
          const metadata = await exifr.parse(file, {
            pick: ["DateTimeOriginal", "OffsetTimeOriginal"],
            reviveValues: false,
          });
          const wall = metadata?.DateTimeOriginal;
          const offset = metadata?.OffsetTimeOriginal;
          if (
            typeof wall === "string" &&
            /^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/.test(wall) &&
            typeof offset === "string" &&
            /^[+-]\d{2}:\d{2}$/.test(offset)
          ) {
            capture = new Date(
              wall.slice(0, 10).replaceAll(":", "-") +
                "T" +
                wall.slice(11) +
                offset,
            ).toISOString();
          }
        } catch {
          /* Missing capture time is reported in preview, never replaced by download time. */
        }
      }
      items.push({
        id: digest(path.resolve(file)),
        filename: entry.name,
        capture,
        type: videos.has(ext) ? "VIDEO" : "PHOTO",
        local: file,
      });
    }
  }
  await walk(root);
  return items;
}
