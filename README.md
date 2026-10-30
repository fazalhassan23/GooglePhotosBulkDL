# Google Photos Bulk DL

An experimental Electron desktop application for Windows, macOS and Ubuntu. It downloads media explicitly selected through Google Photos Picker or copies photos from an extracted Google Takeout export into `YYYY/YYYY-MM` folders. It cannot automatically search an existing Google Photos library by date.

Google restricted the Library API to app-created media in March 2025. See the [feasibility decision](docs/feasibility.md) before configuring Google authentication. Picker downloads omit location metadata; video downloads are transcoded. Takeout import does not authenticate your account or download archives.

## Development

Use Node.js 24 or later and npm. Run `npm ci`, `npm test`, `npm run build`, then `npm start`. The Electron main process owns credentials, dialogs, discovery and transfers; React receives a narrow preload bridge. No web server is required.

See [setup and configuration](docs/setup.md), [user guide](docs/user-guide.md), [architecture and manifest](docs/architecture.md), [testing](docs/testing.md), [packaging](docs/packaging.md), [known limitations](docs/known-limitations.md), [contributing](CONTRIBUTING.md) and [security](SECURITY.md).

No release, signed installer, production qualification or automatic updater is provided. The authoritative release version is `package.json`; version 0.x is experimental and compatibility is not guaranteed. Manifest version 1 is separate from the release version.
