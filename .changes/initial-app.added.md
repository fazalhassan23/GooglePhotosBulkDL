# Initial application

## Added

- Experimental Electron app for authenticated Google Photos Picker downloads and extracted Takeout imports, with inclusive timezone-aware date filtering, year/month organization, persistent verification manifest, safe filename collision handling, cancellation and retry.
- Cross-platform packaging configuration; live account, signing and platform qualification remain outstanding. Picker restrictions and metadata loss are documented.
- OS credential encryption uses asynchronous APIs and refuses plaintext backends; the Windows smoke check verifies an encrypted fixture round trip.
- Takeout metadata discovery runs in a cancellable background worker to keep the main event loop responsive.
