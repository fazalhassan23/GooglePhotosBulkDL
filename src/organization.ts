import path from "node:path";
import { createHash } from "node:crypto";
import type { Media, Options } from "./contracts";
export function dayAt(instant: string, timezone: string): string {
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime())) throw Error("Invalid capture date");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function validateOptions(o: Options) {
  for (const value of [o.start, o.end])
    if (new Date(value + "T00:00:00Z").toISOString().slice(0, 10) !== value)
      throw Error("Invalid calendar date");
  if (o.start > o.end) throw Error("Start must precede end");
  dayAt(new Date().toISOString(), o.timezone);
}
export function matches(m: Media, o: Options) {
  if (!m.capture || (!o.videos && m.type === "VIDEO")) return false;
  try {
    const d = dayAt(m.capture, o.timezone);
    return d >= o.start && d <= o.end;
  } catch {
    return false;
  }
}
export function safeName(name: string) {
  let n = name
    .normalize("NFC")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/[. ]+$/g, "");
  if (!n || /^\.+$/.test(n)) n = "photo";
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(n)) n = "_" + n;
  return Array.from(n).slice(0, 100).join("");
}
export function relativeTarget(m: Media, o: Options) {
  const d = dayAt(m.capture!, o.timezone);
  return path.join(d.slice(0, 4), d.slice(0, 7), safeName(m.filename));
}
export const digest = (s: string) =>
  createHash("sha256").update(s).digest("hex");
