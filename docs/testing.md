# Testing

Run `npm test` for Node/TypeScript fixtures and `npm run build` for strict TypeScript and production bundles. Run `npm run docs:generate`, `npm run docs:test`, and `npm run docs:check -- --base origin/staging --pr-body .tools/pr-body.md` for documentation checks. CI executes these on Windows, macOS and Ubuntu; CI configuration alone is not evidence of successful execution.

Fixtures cover inclusive boundaries, IANA timezone year/month transitions, invalid/missing dates, portable/reserved/Unicode names, exact Takeout sidecars, filename collisions, completed-file verification on repeats, cancellation/restart, interrupted HTTP streams, short response rejection, expired authentication, rate limiting and transient network retry. Tests use generated temporary directories and mocked HTTP responses; they do not authenticate a real account.

`npm run smoke` runs a hidden Electron renderer, checks the narrow bridge and disabled renderer Node access, checks layout overflow, captures `artifacts/ui-smoke.png`, and round-trips a fixture string through OS secure storage when available. It does not verify Google OAuth or the entire user workflow.

The discovery-worker regression builds the actual worker/launcher bundles into a temporary directory and verifies media discovery, error propagation and cancellation. This checks the packaged worker boundary without starting Electron.

Before readiness, manually verify real desktop OAuth PKCE, rejected/expired consent, native dialogs, OS secure storage and locked-keyring refusal; Picker pagination/download/expiry; Takeout exports from real Google accounts; midstream cancellation, process termination and disk-full/unplug recovery; sleep/wake; case-sensitive/insensitive destinations; accessibility, high DPI and installers on all three OSes. Package and signing qualification is separate.

Record only completed commands and observations in the delivery report. Main-target bug fixes must compare against origin/main, not blindly use staging as their documentation diff base.
