import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  dayAt,
  matches,
  relativeTarget,
  safeName,
  validateOptions,
} from "../src/organization";
import { Engine } from "../src/engine";
import { discoverTakeout } from "../src/takeout";
import { request } from "../src/network";
import type { Media, Options } from "../src/contracts";
const options: Options = {
  start: "2024-01-01",
  end: "2024-01-31",
  timezone: "UTC",
  videos: false,
};
const photo: Media = {
  id: "1",
  filename: "photo.jpg",
  capture: "2024-01-31T23:59:59Z",
  type: "PHOTO",
};
test("interrupted HTTP streams clean temporary files and retry safely", () =>
  fixture(async (root) => {
    const data = path.join(root, "data"),
      dest = path.join(root, "dest");
    await mkdir(data);
    await mkdir(dest);
    const original = globalThis.fetch;
    const abort = new AbortController();
    let cancelled = false;
    try {
      globalThis.fetch = async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new TextEncoder().encode("partial"));
              setTimeout(() => abort.abort(), 20);
            },
            cancel() {
              cancelled = true;
            },
          }),
        );
      const engine = new Engine(data);
      const item = {
        ...photo,
        url: "https://test.googleusercontent.com/photo",
      };
      const interrupted = await engine.run(
        [item],
        dest,
        options,
        "google:test",
        async () => "test-token",
        abort.signal,
        () => {},
      );
      assert.match(interrupted.phase, /Cancelled/);
      assert.equal(cancelled, true);
      assert.deepEqual(await readdir(path.join(dest, "2024", "2024-01")), []);
      globalThis.fetch = async () =>
        new Response("complete", { headers: { "content-length": "8" } });
      const resumed = await engine.run(
        [item],
        dest,
        options,
        "google:test",
        async () => "test-token",
        new AbortController().signal,
        () => {},
      );
      assert.equal(resumed.downloaded, 1);
      assert.equal(
        await readFile(path.join(dest, "2024", "2024-01", "photo.jpg"), "utf8"),
        "complete",
      );
    } finally {
      globalThis.fetch = original;
    }
  }));
test("short responses never finalize and can be retried", () =>
  fixture(async (root) => {
    const data = path.join(root, "data"),
      dest = path.join(root, "dest");
    await mkdir(data);
    await mkdir(dest);
    const original = globalThis.fetch;
    try {
      globalThis.fetch = async () =>
        new Response("short", { headers: { "content-length": "999" } });
      const result = await new Engine(data).run(
        [{ ...photo, url: "https://test.googleusercontent.com/photo" }],
        dest,
        options,
        "google:test",
        async () => "",
        new AbortController().signal,
        () => {},
      );
      assert.equal(result.failed, 1);
      assert.match(result.errors[0], /Incomplete transfer/);
      assert.deepEqual(await readdir(path.join(dest, "2024", "2024-01")), []);
    } finally {
      globalThis.fetch = original;
    }
  }));
test("inclusive boundaries, timezone month/year transitions and missing dates", () => {
  assert.equal(
    matches({ ...photo, capture: "2024-01-01T00:00:00Z" }, options),
    true,
  );
  assert.equal(matches(photo, options), true);
  assert.equal(
    matches({ ...photo, capture: "2024-02-01T00:00:00Z" }, options),
    false,
  );
  assert.equal(matches({ ...photo, capture: undefined }, options), false);
  assert.equal(
    dayAt("2024-01-01T00:00:00Z", "America/Los_Angeles"),
    "2023-12-31",
  );
  assert.equal(dayAt("2024-01-31T23:59:59Z", "Asia/Dhaka"), "2024-02-01");
  assert.equal(
    relativeTarget(photo, options),
    path.join("2024", "2024-01", "photo.jpg"),
  );
  assert.equal(matches({ ...photo, type: "VIDEO" }, options), false);
  assert.throws(() => validateOptions({ ...options, start: "2024-02-30" }));
  assert.throws(() =>
    validateOptions({ ...options, timezone: "Invalid/Zone" }),
  );
});
test("portable names preserve Unicode and reject reserved characters", () => {
  assert.equal(safeName("CON.jpg"), "_CON.jpg");
  assert.equal(safeName("../a:b?.jpg"), ".._a_b_.jpg");
  assert.equal(safeName("猫.jpg"), "猫.jpg");
  assert.ok(safeName("x".repeat(300)).length <= 100);
});
async function fixture(fn: (root: string) => Promise<void>) {
  const root = await mkdtemp(path.join(os.tmpdir(), "gphotos-test-"));
  try {
    await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
test("Takeout exact sidecar capture dates, invalid metadata and nested discovery", () =>
  fixture(async (root) => {
    await writeFile(path.join(root, "photo.jpg"), "fixture");
    await writeFile(
      path.join(root, "photo.jpg.supplemental-metadata.json"),
      JSON.stringify({ photoTakenTime: { timestamp: "1704067200" } }),
    );
    await writeFile(path.join(root, "undated.jpg"), "fixture");
    const items = await discoverTakeout(root, new AbortController().signal);
    assert.equal(items.length, 2);
    assert.equal(
      items.find((m) => m.filename === "photo.jpg")?.capture,
      "2024-01-01T00:00:00.000Z",
    );
    assert.equal(
      items.find((m) => m.filename === "undated.jpg")?.capture,
      undefined,
    );
  }));
test("different photos with same filename never overwrite; repeat runs verify and skip", () =>
  fixture(async (root) => {
    const data = path.join(root, "data"),
      dest = path.join(root, "dest");
    await mkdir(data);
    await mkdir(dest);
    const a = path.join(root, "a"),
      b = path.join(root, "b");
    await writeFile(a, "first");
    await writeFile(b, "second");
    const items = [
      { ...photo, local: a },
      { ...photo, id: "2", local: b },
    ];
    const engine = new Engine(data);
    const result = await engine.run(
      items,
      dest,
      options,
      "takeout",
      async () => "",
      new AbortController().signal,
      () => {},
    );
    assert.equal(result.downloaded, 2, JSON.stringify(result));
    assert.equal(result.failed, 0);
    const names = await readdir(path.join(dest, "2024", "2024-01"));
    assert.equal(names.length, 2);
    const contents = await Promise.all(
      names.map((n) => readFile(path.join(dest, "2024", "2024-01", n), "utf8")),
    );
    assert.deepEqual(contents.sort(), ["first", "second"]);
    const repeated = await engine.run(
      items,
      dest,
      options,
      "takeout",
      async () => "",
      new AbortController().signal,
      () => {},
    );
    assert.equal(repeated.skipped, 2);
    await writeFile(
      path.join(dest, "2024", "2024-01", "photo.jpg"),
      "user modification",
    );
    const repaired = await engine.run(
      items,
      dest,
      options,
      "takeout",
      async () => "",
      new AbortController().signal,
      () => {},
    );
    assert.equal(repaired.failed, 0);
    assert.equal(
      await readFile(path.join(dest, "2024", "2024-01", "photo.jpg"), "utf8"),
      "user modification",
    );
  }));
test("cancelled jobs resume without partial files", () =>
  fixture(async (root) => {
    const data = path.join(root, "data"),
      dest = path.join(root, "dest");
    await mkdir(data);
    await mkdir(dest);
    const local = path.join(root, "source");
    await writeFile(local, "complete");
    const controller = new AbortController();
    controller.abort();
    const engine = new Engine(data);
    const result = await engine.run(
      [{ ...photo, local }],
      dest,
      options,
      "takeout",
      async () => "",
      controller.signal,
      () => {},
    );
    assert.equal(result.downloaded, 0);
    const resumed = await engine.run(
      [{ ...photo, local }],
      dest,
      options,
      "takeout",
      async () => "",
      new AbortController().signal,
      () => {},
    );
    assert.equal(resumed.downloaded, 1, JSON.stringify(resumed));
  }));
test("authentication errors are actionable; rate limits and transient network failures retry", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => new Response("", { status: 401 });
    await assert.rejects(
      request("https://example.test"),
      /Authentication expired/,
    );
    globalThis.fetch = async () => {
      calls++;
      return new Response("ok", {
        status: calls === 1 ? 429 : 200,
        headers: { "retry-after": "0" },
      });
    };
    assert.equal((await request("https://example.test")).status, 200);
    assert.equal(calls, 2);
    calls = 0;
    globalThis.fetch = async () => {
      calls++;
      if (calls === 1) throw Error("offline");
      return new Response("ok");
    };
    assert.equal((await request("https://example.test")).status, 200);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = original;
  }
});
