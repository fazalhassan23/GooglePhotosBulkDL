# User guide

Choose one source:

1. **Google Photos Picker:** configure OAuth, sign in, select photos in Google's browser UI, and finish the selection. You must select the desired library content yourself.
2. **Takeout:** export Google Photos with Google Takeout, download all archive parts, extract them outside the destination, and choose the extracted root. Keep media JSON sidecars next to the associated files.

Set inclusive start/end dates, an IANA timezone (for example `Asia/Dhaka` or `UTC`), and an optional video toggle. Choose a writable destination using the native dialog. Preview shows account/source, dates, destination, matching count and undated count. Confirm before transfers. A destination inside the Takeout source is rejected.

## Capture dates and organization

Picker uses `createTime`. Takeout prefers an exact `<filename>.supplemental-metadata.json` or `<filename>.json` sidecar's `photoTakenTime.timestamp` Unix seconds. If unavailable, photos can use EXIF DateTimeOriginal only with an explicit OffsetTimeOriginal. Unzoned EXIF, invalid timestamps and absent capture dates are excluded; modification, upload and download dates are never substituted. Ambiguous/truncated sidecar names are not guessed. Google-edited capture dates can differ from original embedded EXIF.

Capture instants are converted to the selected IANA timezone, and their calendar dates are compared inclusively. The same converted date determines `<destination>/2024/2024-01/<filename>`. This handles daylight saving without assuming every day is 24 hours. The original camera timezone cannot always be recovered from Google's UTC timestamp.

Unicode filenames are retained where portable. Forbidden characters and reserved device names are sanitized; long names are shortened. Different contents with equal names get a stable suffix, never overwrite. Equal contents at the intended target can be reused. Source files and Takeout sidecars are never deleted or rewritten; sidecars are not copied to output.

## Cancel, resume and retry

Cancel stops discovery/polling or active transfers. Incomplete owned temporary files are deleted when cancellation is handled. Preview again and confirm to resume/retry. Completed files are verified against SHA-256 manifest records before skipping. Partial HTTP range resumption is not implemented: incomplete files restart. The last job's UI settings are not persisted; reselect source, destination and dates after restart. Picker session recovery may require selecting the same media again; persistent item IDs avoid repeating verified downloads.

Sleep may stall transfers until wake/network timeout. Destination disconnects, full disks and permissions produce per-file failures; reconnect or fix access, then preview/retry. The application does not prevent sleep or remount drives. Do not move or modify source/destination trees during a job.
