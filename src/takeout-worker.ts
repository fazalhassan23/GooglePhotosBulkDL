import { parentPort, workerData } from "node:worker_threads";
import { discoverTakeout } from "./takeout";
discoverTakeout(workerData.root, new AbortController().signal)
  .then((items) => parentPort!.postMessage({ items }))
  .catch((error) =>
    parentPort!.postMessage({
      error:
        error instanceof Error ? error.message : "Takeout discovery failed",
    }),
  );
