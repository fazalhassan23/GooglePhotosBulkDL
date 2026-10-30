import { build } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";
await mkdir("dist", { recursive: true });
await build({
  entryPoints: ["src/main.ts"],
  outfile: "dist/main.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron"],
});
await build({
  entryPoints: ["src/preload.ts"],
  outfile: "dist/preload.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron"],
});
await build({
  entryPoints: ["src/ui.tsx"],
  outfile: "dist/ui.js",
  bundle: true,
  platform: "browser",
  format: "iife",
});
await Promise.all(
  ["index.html", "style.css"].map((f) => copyFile("src/" + f, "dist/" + f)),
);
