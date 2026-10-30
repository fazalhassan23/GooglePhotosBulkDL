# Supported workflows

Verified against official documentation on 2026-10-30:

- [Google Photos API changes](https://developers.google.com/photos/support/updates): as of March 31, 2025, Library API listing/search is limited to media created by the application. This app cannot automatically enumerate existing account photos by date.
- [Picker flow](https://developers.google.com/photos/picker/guides/get-started-picker): browser OAuth, create a session, user selects media, poll, list selected items. Date filtering is local and applies only to that selection.
- [Picker media](https://developers.google.com/photos/picker/guides/media-items): download images using `=d`, with EXIF except location metadata. Videos use `=dv`, a high-quality transcode. This is not a promise of byte-identical originals. URLs expire after approximately 60 minutes.
- [Picked media contract](https://developers.google.com/photos/picker/reference/rest/v1/mediaItems): persistent item identifiers and RFC3339 `createTime`, representing creation rather than upload time.
- [Takeout](https://support.google.com/accounts/answer/3024190): users request, download and extract exports themselves. The app then copies local files without transcoding or rewriting embedded metadata. It does not control archive creation or validate which account produced it.

Both workflows were explicitly selected by the user. Extracted-folder import is the first implementation; ZIP/TGZ extraction and cloud archive downloads are not implemented. No browser scraping, password collection, deprecated scopes or invented API endpoints are used.

## Implementation sequence

1. Establish isolated repository and staging workflow.
2. Implement secure main/preload/renderer boundary and browser OAuth.
3. Implement Picker discovery and extracted Takeout discovery.
4. Share capture-date rules, bounded transfers, manifest and recovery.
5. Verify core behavior with fixtures; add CI and packaging configuration.
6. Complete authenticated live and platform qualification before declaring production readiness.
