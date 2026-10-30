# Contributing

Use Node.js 24+, `npm ci`, and the validation commands in [testing](docs/testing.md). Follow [AGENTS.md](AGENTS.md). Keep changes scoped, readable and accompanied by authoritative docs and a `.changes` fragment or justified exemption.

Regular work starts from latest origin/staging on dedicated branches; PRs target staging. Never push directly to integration branches except the initial missing-staging bootstrap. Verified main bugs require issue triage/reproduction, branch from main, regression checks, main PR and staging synchronization through another PR. Never bypass required reviews, protections or failing checks. Feature main integration, tags and distribution require explicit authorization.

Review diffs, exclude secrets/outputs, stage specific files, use the configured developer identity and make meaningful Conventional Commits. PRs use the template, document actual checks and limitations, and remain draft when incomplete. Do not claim live account/platform qualification based on mock tests or CI configuration.

Documentation impact mappings are in `scripts/docs/impact-rules.json`. Every implementation increment updates affected guides/diagram/schema and changelog, regenerates the version reference, and runs the full documentation gate using the actual PR base and full body. CI checks enforceable requirements; reviewers still assess semantic accuracy. Security reporting follows SECURITY.md.
