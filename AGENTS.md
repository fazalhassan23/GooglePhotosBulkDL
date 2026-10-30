# Project workflow

Apply the user's Universal Project Rules throughout this repository.

- Start regular development branches from current origin/staging; use dedicated branches and PRs targeting staging. Never push directly to staging or main except the initial missing-staging bootstrap.
- Verified bugs affecting main follow issue → reproduction → scoped fix branch from main → tests/docs → PR → required checks/reviews → authorized merge → staging synchronization PR → issue resolution. Main feature integrations, tags, publication and deployment require explicit authorization.
- Preserve unrelated work, inspect remote/branch/status before mutations, use the configured developer identity, and make meaningful conventional commits. Never force-push shared history or fabricate reviews.
- Update authoritative documentation, diagrams, contracts and a .changes fragment or meaningful exemption with each increment. Run npm run docs:generate, npm run docs:test, npm run docs:check -- --base origin/staging --pr-body .tools/pr-body.md, npm test and npm run build before completed implementation commits.
- PR descriptions use .github/PULL_REQUEST_TEMPLATE.md. Required CI/reviews and protections must be respected. Draft incomplete or externally blocked work. Report actual checks, branch, commits, PR, merge state and blockers.
- Keep secrets, OAuth configuration, node_modules, dist, artifacts and local user data untracked. Do not publish sensitive paths or account information.
- Read docs/known-limitations.md before readiness claims. Cross-platform packaging configuration is not platform qualification.
