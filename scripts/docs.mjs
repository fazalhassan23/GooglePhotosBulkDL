import { readFile, writeFile, readdir, mkdir, access } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import assert from "node:assert/strict";
const command = process.argv[2];
const version = JSON.parse(await readFile("package.json", "utf8")).version;
const reference = `# Generated release reference\n\nRelease version: ${version}\n\nSource: package.json. Manifest format: 1. No published release is implied.\n`;
function impact(body) {
  for (const field of [
    "Documents updated",
    "Changelog fragment or exemption",
    "Diagram impact",
    "Schema or migration impact",
    "Explanation for exemptions",
  ]) {
    const line = body.split("\n").find((l) => l.startsWith("- " + field + ":"));
    if (!line || line.slice(line.indexOf(":") + 1).trim().length < 8)
      throw Error("Missing substantive documentation declaration: " + field);
  }
}
if (command === "generate") {
  await mkdir("docs/generated", { recursive: true });
  await writeFile("docs/generated/version.md", reference);
} else if (command === "test") {
  assert.throws(() => impact(""));
  assert.throws(() => impact("- Documents updated: no"));
  impact(
    [
      "Documents updated",
      "Changelog fragment or exemption",
      "Diagram impact",
      "Schema or migration impact",
      "Explanation for exemptions",
    ]
      .map((f) => `- ${f}: meaningful explanation`)
      .join("\n"),
  );
  assert.match(version, /^\d+\.\d+\.\d+(?:-[\w.]+)?$/);
  console.log("Documentation enforcement self-tests passed.");
} else if (command === "check") {
  assert.equal(
    (await readFile("docs/generated/version.md", "utf8")).replaceAll(
      "\r\n",
      "\n",
    ),
    reference,
    "Run npm run docs:generate",
  );
  execFileSync(
    process.execPath,
    ["node_modules/markdownlint-cli2/markdownlint-cli2-bin.mjs"],
    { stdio: "inherit" },
  );
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM("");
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  const mermaid = (await import("mermaid")).default;
  mermaid.initialize({ startOnLoad: false });
  const files = [];
  async function walk(dir) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      if (
        ["node_modules", ".git", "dist", "artifacts", ".tools"].includes(e.name)
      )
        continue;
      const file = path.join(dir, e.name);
      if (e.isDirectory()) await walk(file);
      else if (file.endsWith(".md")) files.push(file);
    }
  }
  await walk(".");
  for (const file of files) {
    const text = await readFile(file, "utf8");
    for (const match of text.matchAll(/```mermaid\r?\n([\s\S]*?)```/g))
      await mermaid.parse(match[1]);
    for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const link = match[1];
      if (/^(https?:|mailto:)/.test(link)) continue;
      const [relative, anchor] = link.split("#");
      const target = relative
        ? path.resolve(path.dirname(file), decodeURIComponent(relative))
        : path.resolve(file);
      await access(target);
      if (anchor) {
        const targetText = await readFile(target, "utf8");
        const anchors = [...targetText.matchAll(/^#+ (.+)$/gm)].map((m) =>
          m[1]
            .toLowerCase()
            .replace(/[^\p{L}\p{N} _-]/gu, "")
            .replace(/ /g, "-"),
        );
        assert.ok(
          anchors.includes(anchor),
          `Missing anchor ${link} in ${file}`,
        );
      }
    }
  }
  const args = process.argv.slice(3),
    arg = (name) => args[args.indexOf(name) + 1];
  if (!args.includes("--base") || !args.includes("--pr-body"))
    throw Error("Full check requires --base and --pr-body");
  const body = await readFile(arg("--pr-body"), "utf8");
  impact(body);
  const changed = execFileSync("git", ["diff", "--name-only", arg("--base")], {
    encoding: "utf8",
  })
    .trim()
    .split(/\r?\n/);
  const untracked = execFileSync(
    "git",
    ["ls-files", "--others", "--exclude-standard"],
    { encoding: "utf8" },
  )
    .trim()
    .split(/\r?\n/);
  changed.push(...untracked);
  const rules = JSON.parse(
    await readFile("scripts/docs/impact-rules.json", "utf8"),
  );
  for (const [prefix, docs] of Object.entries(rules)) {
    if (
      changed.some((f) => f.startsWith(prefix)) &&
      !docs.some((doc) => changed.includes(doc)) &&
      !body.includes("Exempt areas: " + prefix + " — ")
    )
      throw Error(
        "Review and update documentation for " +
          prefix +
          " or declare Exempt areas with a substantive reason.",
      );
  }
  if (
    changed.some((f) => f.startsWith("src/")) &&
    !changed.some((f) => f.startsWith(".changes/") && f.endsWith(".md")) &&
    !/Changelog fragment or exemption: .{20}/.test(body)
  )
    throw Error("Missing changelog fragment or exemption");
  console.log(
    "Links, anchors, Mermaid, generated version, changelog and documentation impact passed.",
  );
} else throw Error("Use generate, test or check");
