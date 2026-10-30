# Security

Never provide your Google password to this application. Configure your own Desktop OAuth client; credentials and local account/media data must stay out of Git and public reports. Use stable, user-owned source and destination trees and keep backups. This app does not request administrator privileges or weaken filesystem permissions.

OAuth refresh tokens are OS-encrypted, never plaintext fallback. Encryption protects stored credentials under platform-specific OS semantics; it does not defend against malware running as your user. Sign out deletes the local credential blob; revoke consent in Google Account settings to revoke server access. Manifest data is not encrypted and includes sensitive relative paths and hashes.

Encryption availability is checked asynchronously before browser authentication or restoring credentials; unsupported Linux plaintext backends are refused. No user credentials are used in the secure-storage smoke fixture.

Do not publish secrets or exploit details in public issues. No private reporting channel has been verified for this new repository; establish an appropriate private channel with the repository owner before sharing sensitive evidence. Dependency scanning and CI do not prove absence of vulnerabilities.
