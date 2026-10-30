import { safeStorage, shell } from "electron";
import { createServer } from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { request } from "./network";
const tokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number(),
});
const savedSchema = z.object({
  refresh: z.string(),
  email: z.string(),
  subject: z.string(),
});
export class Auth {
  private access = "";
  private expires = 0;
  private refresh = "";
  email = "";
  subject = "";
  constructor(private directory: string) {}
  private get file() {
    return path.join(this.directory, "credentials.bin");
  }
  private secure() {
    if (
      !safeStorage.isEncryptionAvailable() ||
      (process.platform === "linux" &&
        safeStorage.getSelectedStorageBackend() === "basic_text")
    )
      throw Error(
        "OS credential encryption unavailable. Unlock your system keyring; plaintext storage is disabled.",
      );
  }
  async restore() {
    this.secure();
    try {
      const s = savedSchema.parse(
        JSON.parse(safeStorage.decryptString(await readFile(this.file))),
      );
      this.refresh = s.refresh;
      this.email = s.email;
      this.subject = s.subject;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT")
        throw Error(
          "Stored credentials unavailable. Sign out and sign in again.",
        );
    }
  }
  private async config() {
    const raw = JSON.parse(
      await readFile(path.join(this.directory, "oauth-client.json"), "utf8"),
    );
    return z
      .object({
        installed: z.object({
          client_id: z.string(),
          client_secret: z.string().optional(),
        }),
      })
      .parse(raw).installed;
  }
  async token() {
    if (this.access && Date.now() < this.expires) return this.access;
    if (!this.refresh) throw Error("Sign in with Google first.");
    const c = await this.config();
    await this.exchange(
      new URLSearchParams({
        client_id: c.client_id,
        ...(c.client_secret ? { client_secret: c.client_secret } : {}),
        grant_type: "refresh_token",
        refresh_token: this.refresh,
      }),
    );
    return this.access;
  }
  private async exchange(body: URLSearchParams) {
    const t = tokenSchema.parse(
      await (
        await request("https://oauth2.googleapis.com/token", {
          method: "POST",
          body,
        })
      ).json(),
    );
    this.access = t.access_token;
    this.expires = Date.now() + Math.max(0, t.expires_in - 60) * 1000;
    if (t.refresh_token) this.refresh = t.refresh_token;
  }
  async signIn() {
    this.secure();
    const c = await this.config();
    await this.signOut();
    const state = randomBytes(32).toString("base64url"),
      verifier = randomBytes(32).toString("base64url");
    let resolveCode!: (code: string) => void,
      rejectCode!: (error: Error) => void;
    const codePromise = new Promise<string>((resolve, reject) => {
      resolveCode = resolve;
      rejectCode = reject;
    });
    const server = createServer((req, res) => {
      const u = new URL(req.url || "/", "http://127.0.0.1");
      if (u.pathname !== "/callback" || u.searchParams.get("state") !== state) {
        res.writeHead(400).end("Invalid callback");
        return;
      }
      res.setHeader("Content-Type", "text/plain");
      res.end("Return to Google Photos Bulk DL.");
      if (u.searchParams.has("error"))
        rejectCode(Error("Google sign-in was declined."));
      else {
        const code = u.searchParams.get("code");
        if (code) resolveCode(code);
        else rejectCode(Error("Missing authorization code"));
      }
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const port = (server.address() as { port: number }).port,
      redirect = `http://127.0.0.1:${port}/callback`;
    const timer = setTimeout(
      () => rejectCode(Error("Sign-in timed out. Try again.")),
      180000,
    );
    try {
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.search = new URLSearchParams({
        client_id: c.client_id,
        redirect_uri: redirect,
        response_type: "code",
        scope:
          "openid email https://www.googleapis.com/auth/photospicker.mediaitems.readonly",
        access_type: "offline",
        prompt: "consent select_account",
        state,
        code_challenge: createHash("sha256")
          .update(verifier)
          .digest("base64url"),
        code_challenge_method: "S256",
      }).toString();
      await shell.openExternal(url.href);
      const code = await codePromise;
      this.refresh = "";
      await this.exchange(
        new URLSearchParams({
          client_id: c.client_id,
          ...(c.client_secret ? { client_secret: c.client_secret } : {}),
          grant_type: "authorization_code",
          code,
          code_verifier: verifier,
          redirect_uri: redirect,
        }),
      );
      const user = z
        .object({
          email: z.string(),
          sub: z.string(),
          email_verified: z.boolean(),
        })
        .parse(
          await (
            await request("https://openidconnect.googleapis.com/v1/userinfo", {
              headers: { Authorization: `Bearer ${this.access}` },
            })
          ).json(),
        );
      if (!user.email_verified || !this.refresh)
        throw Error("Verified account and offline consent are required.");
      this.email = user.email;
      this.subject = user.sub;
      await writeFile(
        this.file,
        safeStorage.encryptString(
          JSON.stringify({
            refresh: this.refresh,
            email: this.email,
            subject: this.subject,
          }),
        ),
        { mode: 0o600 },
      );
      return this.email;
    } finally {
      clearTimeout(timer);
      server.close();
    }
  }
  async signOut() {
    this.access = "";
    this.refresh = "";
    this.email = "";
    this.subject = "";
    this.expires = 0;
    await rm(this.file, { force: true });
  }
}
