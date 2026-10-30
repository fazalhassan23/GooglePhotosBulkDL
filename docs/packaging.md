# Packaging and releases

Run `npm run package -- --win`, `npm run package -- --mac`, or `npm run package -- --linux` on the corresponding platform. Configuration includes Windows NSIS, macOS DMG, Ubuntu-compatible AppImage and deb targets. Build outputs are under ignored `artifacts/`. No updater or publication configuration exists. Packaging does not authorize publishing.

Windows: use a supported Windows build host. NSIS tooling can require network downloads; signing needs your own trusted certificate/provider and explicit release configuration. Unsigned builds may trigger SmartScreen.

macOS: build on macOS with Xcode command line tools. Trusted distribution requires Developer ID signing, hardened runtime and Apple notarization credentials/configuration. These are not configured or verified. Architecture-specific builds and universal qualification remain future work.

Ubuntu: install target packaging prerequisites (including deb tooling when required); AppImage runtime/FUSE support varies by Ubuntu installation. A functional Secret Service or KWallet is required for persistent OAuth credentials. Do not disable the Electron sandbox to work around system setup.

`package.json` is the sole release version source. 0.x releases can change behavior/contracts with documented migration notes. Prepare releases on a dedicated branch into staging, assemble `.changes` into CHANGELOG, update version and lockfile, validate, then obtain explicit authorization for feature integration into main, immutable tags, publication and deployment. Bug-fix integration follows the standing verified-fix rules. No installers are claimed signed or platform tested.
