const { app, BrowserWindow, safeStorage } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const assert = require("node:assert/strict");
app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    width: 1040,
    height: 1000,
    webPreferences: {
      preload: path.resolve("dist/preload.cjs"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  try {
    const secure =
      safeStorage.isEncryptionAvailable() &&
      (process.platform !== "linux" ||
        safeStorage.getSelectedStorageBackend() !== "basic_text");
    if (secure)
      assert.equal(
        safeStorage.decryptString(safeStorage.encryptString("fixture-only")),
        "fixture-only",
      );
    await window.loadFile(path.resolve("dist/index.html"));
    const result = await window.webContents.executeJavaScript(
      `({title:document.querySelector('h1')?.textContent,sections:document.querySelectorAll('section').length,bridge:typeof window.photos?.prepare,node:typeof window.require,overflow:document.documentElement.scrollWidth>window.innerWidth})`,
    );
    assert.equal(result.title, "A place for every memory.");
    assert.equal(result.sections, 3);
    assert.equal(result.bridge, "function");
    assert.equal(result.node, "undefined");
    assert.equal(result.overflow, false);
    await fs.mkdir("artifacts", { recursive: true });
    await fs.writeFile(
      "artifacts/ui-smoke.png",
      (await window.webContents.capturePage()).toPNG(),
    );
    console.log(
      "Hidden Electron renderer smoke passed:",
      JSON.stringify({
        ...result,
        secureStorageRoundTrip: secure ? "passed" : "unavailable",
      }),
    );
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
setTimeout(() => {
  console.error("Renderer smoke timed out");
  app.exit(1);
}, 30000).unref();
