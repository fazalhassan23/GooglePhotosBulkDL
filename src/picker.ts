import { shell } from "electron";
import { z } from "zod";
import { setTimeout as delay } from "node:timers/promises";
import { Auth } from "./auth";
import { request } from "./network";
import type { Media } from "./contracts";
const sessionSchema = z.object({
  id: z.string(),
  pickerUri: z.string().url().optional(),
  mediaItemsSet: z.boolean().optional(),
  expireTime: z.string().optional(),
  pollingConfig: z
    .object({ pollInterval: z.string(), timeoutIn: z.string() })
    .optional(),
});
const itemSchema = z.object({
  id: z.string(),
  createTime: z.string().optional(),
  type: z.enum(["PHOTO", "VIDEO"]),
  mediaFile: z.object({
    filename: z.string(),
    baseUrl: z.string().url(),
    mimeType: z.string(),
  }),
});
const pageSchema = z.object({
  mediaItems: z.array(itemSchema).default([]),
  nextPageToken: z.string().optional(),
});
export function allowedMediaUrl(value: string) {
  const u = new URL(value);
  if (
    u.protocol !== "https:" ||
    !u.hostname.endsWith(".googleusercontent.com") ||
    u.username ||
    u.password ||
    u.port
  )
    throw Error("Untrusted media URL");
  return value;
}
export class Picker {
  session = "";
  constructor(private auth: Auth) {}
  private async api(route: string, method = "GET", signal?: AbortSignal) {
    const token = await this.auth.token();
    return (
      await request(
        "https://photospicker.googleapis.com/v1/" + route,
        { method, headers: { Authorization: `Bearer ${token}` } },
        signal,
      )
    ).json();
  }
  async pick(signal: AbortSignal) {
    const session = sessionSchema.parse(
      await this.api("sessions", "POST", signal),
    );
    this.session = session.id;
    if (!session.pickerUri)
      throw Error("Picker did not return a selection URL");
    const url = new URL(session.pickerUri);
    if (url.protocol !== "https:" || url.hostname !== "photos.google.com")
      throw Error("Untrusted Picker URL");
    await shell.openExternal(url.href);
    const deadline = Date.now() + 600000;
    let current = session;
    while (!current.mediaItemsSet) {
      if (Date.now() > deadline)
        throw Error("Selection timed out. Start a new selection.");
      const interval = Number.parseFloat(
        current.pollingConfig?.pollInterval || "5s",
      );
      await delay(
        Math.max(1000, Number.isFinite(interval) ? interval * 1000 : 5000),
        undefined,
        { signal },
      );
      current = sessionSchema.parse(
        await this.api(
          "sessions/" + encodeURIComponent(this.session),
          "GET",
          signal,
        ),
      );
    }
    return this.list(signal);
  }
  async list(signal?: AbortSignal): Promise<Media[]> {
    if (!this.session)
      throw Error("Selection expired. Select your photos again.");
    const media: Media[] = [];
    let page = "";
    do {
      const query = new URLSearchParams({
        sessionId: this.session,
        pageSize: "100",
        ...(page ? { pageToken: page } : {}),
      });
      const result = pageSchema.parse(
        await this.api("mediaItems?" + query, "GET", signal),
      );
      for (const m of result.mediaItems)
        media.push({
          id: m.id,
          filename: m.mediaFile.filename,
          capture: m.createTime,
          type: m.type,
          url: allowedMediaUrl(m.mediaFile.baseUrl),
        });
      page = result.nextPageToken || "";
    } while (page);
    return media;
  }
  async clear() {
    if (this.session)
      try {
        await this.api(
          "sessions/" + encodeURIComponent(this.session),
          "DELETE",
        );
      } finally {
        this.session = "";
      }
  }
}
