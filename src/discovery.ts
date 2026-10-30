import { Worker } from "node:worker_threads";
import path from "node:path";
import type { Media } from "./contracts";
export function discoverInWorker(
  root: string,
  signal: AbortSignal,
): Promise<Media[]> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, "takeout-worker.cjs"), {
      workerData: { root },
    });
    let settled = false;
    const finish = (error?: Error, items?: Media[]) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", cancel);
      void worker.terminate();
      if (error) reject(error);
      else resolve(items!);
    };
    const cancel = () => finish(new Error("Takeout discovery cancelled."));
    signal.addEventListener("abort", cancel, { once: true });
    worker.once("message", (message: { error?: string; items?: Media[] }) => {
      if (message.error) finish(Error(message.error));
      else if (message.items) finish(undefined, message.items);
      else finish(Error("Invalid discovery result"));
    });
    worker.once("error", (error) => finish(error));
    worker.once("exit", (code) => {
      if (!settled)
        finish(Error(`Discovery worker exited unexpectedly (${code})`));
    });
  });
}
