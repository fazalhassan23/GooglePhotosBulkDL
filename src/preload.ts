import { contextBridge, ipcRenderer } from "electron";
import type { Bridge, Progress } from "./contracts";
const bridge: Bridge = {
  chooseDestination: () => ipcRenderer.invoke("destination"),
  chooseTakeout: () => ipcRenderer.invoke("takeout"),
  signIn: () => ipcRenderer.invoke("signin"),
  signOut: () => ipcRenderer.invoke("signout"),
  pick: () => ipcRenderer.invoke("pick"),
  prepare: (options) => ipcRenderer.invoke("prepare", options),
  start: () => ipcRenderer.invoke("start"),
  cancel: () => ipcRenderer.invoke("cancel"),
  onProgress: (fn) => {
    const listener = (_event: unknown, p: Progress) => fn(p);
    ipcRenderer.on("progress", listener);
    return () => ipcRenderer.removeListener("progress", listener);
  },
};
contextBridge.exposeInMainWorld("photos", bridge);
