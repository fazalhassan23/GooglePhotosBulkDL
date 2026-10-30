import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { Auth } from "./auth";
import { Picker } from "./picker";
import { Engine } from "./engine";
import { discoverInWorker } from "./discovery";
import { matches, validateOptions } from "./organization";
import { optionsSchema, type Media, type Summary } from "./contracts";
if (!app.requestSingleInstanceLock()) app.quit();
let abort: AbortController | undefined;
app.on("before-quit", () => abort?.abort());
app.whenReady().then(async () => {
  const data = app.getPath("userData");
  await mkdir(data, { recursive: true });
  const auth = new Auth(data),
    picker = new Picker(auth),
    engine = new Engine(data);
  let destination = "",
    source = "",
    items: Media[] = [],
    prepared: Summary | undefined,
    scope = "";
  const entry = pathToFileURL(path.join(__dirname, "index.html")).href;
  const window = new BrowserWindow({
    width: 1000,
    height: 820,
    minWidth: 720,
    minHeight: 650,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (url !== entry) event.preventDefault();
  });
  window.webContents.session.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false),
  );
  const idle = () => {
    if (abort) throw Error("An operation is running. Cancel or wait first.");
  };
  const handle = (name: string, fn: (arg: unknown) => unknown) =>
    ipcMain.handle(name, async (event, arg) => {
      if (
        event.sender !== window.webContents ||
        event.senderFrame?.url !== entry
      )
        throw Error("Untrusted IPC sender");
      try {
        return await fn(arg);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Operation failed";
        throw Error(
          message.includes("ENOENT")
            ? "Required file or folder was not found. Check OAuth configuration, source, and destination."
            : message.includes("EACCES")
              ? "Permission denied. Choose a writable folder or unlock the credential store."
              : message,
        );
      }
    });
  const choose = async () => {
    const result = await dialog.showOpenDialog(window, {
      properties: ["openDirectory"],
    });
    return result.canceled ? "" : result.filePaths[0];
  };
  handle("destination", async () => {
    idle();
    const selected = await choose();
    if (selected) {
      destination = selected;
      prepared = undefined;
    }
    return destination;
  });
  handle("takeout", async () => {
    idle();
    const selected = await choose();
    if (!selected) return source;
    source = selected;
    scope = "takeout";
    items = [];
    prepared = undefined;
    return source;
  });
  handle("signin", async () => {
    idle();
    prepared = undefined;
    items = [];
    source = "";
    return auth.signIn();
  });
  handle("signout", async () => {
    idle();
    await auth.signOut();
    picker.session = "";
    items = [];
    prepared = undefined;
    source = "";
  });
  handle("pick", async () => {
    idle();
    prepared = undefined;
    items = [];
    source = "";
    scope = "";
    abort = new AbortController();
    try {
      if (!auth.subject) await auth.restore();
      items = await picker.pick(abort.signal);
      source = "Google Photos Picker";
      scope = "google:" + auth.subject;
      return items.length;
    } finally {
      abort = undefined;
    }
  });
  handle("prepare", async (raw) => {
    idle();
    prepared = undefined;
    const options = optionsSchema.parse(raw);
    validateOptions(options);
    if (!destination || !source)
      throw Error("Choose a source and destination first.");
    if (scope === "takeout") {
      const relative = path.relative(source, destination);
      if (
        relative === "" ||
        (!relative.startsWith(".." + path.sep) &&
          relative !== ".." &&
          !path.isAbsolute(relative))
      )
        throw Error("Destination must be outside the Takeout source folder.");
    }
    abort = new AbortController();
    try {
      if (scope === "takeout")
        items = await discoverInWorker(source, abort.signal);
      else items = await picker.list(abort.signal);
      prepared = {
        account:
          scope === "takeout"
            ? "Local Takeout files (account not verified)"
            : auth.email,
        source,
        destination,
        options,
        matched: items.filter((m) => matches(m, options)).length,
        missingDates: items.filter((m) => !m.capture).length,
      };
      return prepared;
    } finally {
      abort = undefined;
    }
  });
  handle("start", async () => {
    idle();
    if (!prepared) throw Error("Preview and confirm the job first.");
    const job = prepared;
    prepared = undefined;
    abort = new AbortController();
    try {
      await engine.run(
        items.filter((m) => matches(m, job.options)),
        job.destination,
        job.options,
        scope,
        () => auth.token(),
        abort.signal,
        (p) => window.webContents.send("progress", p),
      );
    } finally {
      abort = undefined;
    }
  });
  handle("cancel", () => {
    abort?.abort();
    prepared = undefined;
  });
  await window.loadURL(entry);
});
app.on("window-all-closed", () => app.quit());
