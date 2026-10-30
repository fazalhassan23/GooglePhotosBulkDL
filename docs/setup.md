# Setup and authentication

Use Node.js 24+ and npm. Run `npm ci`, `npm test`, `npm run build`, `npm start`.

The application uses Electron's standard userData directory. In development the package name is `google-photos-bulk-dl`: typically `%APPDATA%/google-photos-bulk-dl`, `~/Library/Application Support/google-photos-bulk-dl` or `$XDG_CONFIG_HOME/google-photos-bulk-dl` (default `~/.config`). Packaged directory naming may use the product name. Use the actual app directory on your platform.

For Picker, create your own Google Cloud project, enable Google Photos Picker API, configure OAuth consent and test users, and create a **Desktop app** OAuth client. Download its JSON and place it at `<userData>/oauth-client.json`. Never commit this file. No client configuration is bundled.

OAuth uses the system browser, a random loopback port on 127.0.0.1, PKCE S256, random state, and a three-minute timeout. Permissions are `openid`, `email` (to identify the selected account), and `photospicker.mediaitems.readonly`. Access tokens stay in memory; the refresh token and account identifier are encrypted in `credentials.bin` using Electron safeStorage. Linux basic_text and unavailable encryption are rejected. Unlock/install GNOME Keyring or KWallet as appropriate; Takeout import remains available without credentials.

Sign out removes local credentials but does not revoke Google's consent grant. Revoke it in your Google Account's third-party access settings if desired. Sign-out is disabled while a job is running: cancel and wait first. OAuth itself completes or times out; cancelling transfer polling does not dismiss the browser.

Google may require consent verification for distribution. Testing-mode refresh tokens may expire. No successful real-account OAuth or Google verification is claimed.
