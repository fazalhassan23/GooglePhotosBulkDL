import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Bridge, Options, Progress, Summary } from "./contracts";
declare global {
  interface Window {
    photos: Bridge;
  }
}
function App() {
  const [options, setOptions] = useState<Options>({
    start: "2024-01-01",
    end: new Date().toLocaleDateString("en-CA"),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    videos: false,
  });
  const [account, setAccount] = useState("Not signed in"),
    [source, setSource] = useState("No source selected"),
    [destination, setDestination] = useState("No folder selected"),
    [summary, setSummary] = useState<Summary>(),
    [progress, setProgress] = useState<Progress>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => window.photos.onProgress(setProgress), []);
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setBusy(false);
    }
  }
  function change(next: Partial<Options>) {
    setOptions((o) => ({ ...o, ...next }));
    setSummary(undefined);
  }
  return (
    <main>
      <header>
        <p className="eyebrow">YOUR PHOTOS · YOUR FOLDERS</p>
        <h1>A place for every memory.</h1>
        <p>
          Download photos you select in Google Photos, or organize an extracted
          Takeout export by capture date.
        </p>
      </header>
      <section aria-labelledby="source">
        <h2 id="source">1. Choose your source</h2>
        <div className="columns">
          <article>
            <h3>Google Photos Picker</h3>
            <p>
              Sign in, then select photos in Google’s browser picker. Only your
              selection is available; this app cannot search your entire
              library.
            </p>
            <p>{account}</p>
            <div className="buttons">
              <button
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    setSummary(undefined);
                    setAccount(await window.photos.signIn());
                    setSource("Select photos next");
                  })
                }
              >
                Sign in with Google
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    await window.photos.signOut();
                    setAccount("Not signed in");
                    setSource("No source selected");
                    setSummary(undefined);
                  })
                }
              >
                Sign out
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    setSummary(undefined);
                    const count = await window.photos.pick();
                    setSource(`Google Photos · ${count} selected`);
                  })
                }
              >
                Select photos
              </button>
            </div>
            <small>Location metadata is excluded. Videos are transcoded.</small>
          </article>
          <article>
            <h3>Google Takeout</h3>
            <p>
              Export your photos at takeout.google.com, download and extract
              every archive, then select the extracted folder. Local imports
              need no Google sign-in.
            </p>
            <button
              disabled={busy}
              onClick={() =>
                act(async () => {
                  setSummary(undefined);
                  setSource(await window.photos.chooseTakeout());
                })
              }
            >
              Choose extracted Takeout folder
            </button>
            <small>
              Exact JSON sidecars provide capture times. Undated files are
              excluded and reported.
            </small>
          </article>
        </div>
        <p className="path">Source: {source}</p>
      </section>
      <section>
        <h2>2. Set dates and destination</h2>
        <div className="fields">
          <label>
            Start date, inclusive
            <input
              type="date"
              value={options.start}
              disabled={busy}
              onChange={(e) => change({ start: e.target.value })}
            />
          </label>
          <label>
            End date, inclusive
            <input
              type="date"
              value={options.end}
              disabled={busy}
              onChange={(e) => change({ end: e.target.value })}
            />
          </label>
          <label>
            IANA timezone
            <input
              value={options.timezone}
              disabled={busy}
              onChange={(e) => change({ timezone: e.target.value })}
            />
          </label>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={options.videos}
            disabled={busy}
            onChange={(e) => change({ videos: e.target.checked })}
          />{" "}
          Include videos (optional)
        </label>
        <p>
          Dates and year/month folders use this timezone. Missing dates never
          use file modification or download time.
        </p>
        <button
          disabled={busy}
          onClick={() =>
            act(async () => {
              setSummary(undefined);
              setDestination(await window.photos.chooseDestination());
            })
          }
        >
          Choose destination folder
        </button>
        <p className="path">{destination}</p>
      </section>
      <section>
        <h2>3. Review and transfer</h2>
        <button
          disabled={busy}
          onClick={() =>
            act(async () => setSummary(await window.photos.prepare(options)))
          }
        >
          Preview / resume / retry failed
        </button>
        {summary ? (
          <div className="review">
            <p>
              <strong>{summary.matched} matching files</strong> ·{" "}
              {summary.missingDates} without capture dates
            </p>
            <p>Account: {summary.account}</p>
            <p>
              {summary.options.start} through {summary.options.end} ·{" "}
              {summary.options.timezone}
            </p>
            <p className="path">
              From {summary.source}
              <br />
              To {summary.destination}
            </p>
            <p>
              Files go into YYYY/YYYY-MM. Existing verified files are skipped.
              Source files remain in place.
            </p>
            <button
              disabled={busy}
              onClick={() =>
                act(async () => {
                  setSummary(undefined);
                  await window.photos.start();
                })
              }
            >
              Confirm and start
            </button>
          </div>
        ) : null}
        {busy ? (
          <p role="status">
            Working… You can cancel discovery, selection polling, or transfers.
          </p>
        ) : null}
        <button
          disabled={!busy}
          onClick={() =>
            window.photos.cancel().catch((e) => setError(String(e)))
          }
        >
          Cancel
        </button>
        {progress ? (
          <div role="status" aria-live="polite">
            <h3>{progress.phase}</h3>
            <progress
              max={Math.max(1, progress.total)}
              value={progress.downloaded + progress.skipped + progress.failed}
            />
            <p>
              {progress.downloaded} completed · {progress.skipped} skipped ·{" "}
              {progress.failed} failed / {progress.total}
            </p>
            {progress.errors.length ? (
              <details>
                <summary>Transfer errors</summary>
                <ul>
                  {progress.errors.map((message, i) => (
                    <li key={i}>{message}</li>
                  ))}
                </ul>
              </details>
            ) : null}
            <p>
              Preview again to resume or retry. Incomplete files restart safely.
              Expired Picker selections require a new selection.
            </p>
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="error">
            {error}
          </p>
        ) : null}
      </section>
      <footer>
        Local manifest · No automatic updates · Keep a backup of your originals
      </footer>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
