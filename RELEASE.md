# Release

The maintainer publishes. An agent does not tag, npm publish, or registry publish unless asked in that turn.

## Current public release

Repository version is `1.0.4`. Git tag `v1.0.4` is the release commit. Git tag `v1.0.3` stays commit `4601e11`. Git tag `v1.0.2` stays commit `95bc1b2`. Git tag `v1.0.1` stays commit `8369a23`. Git tag `v1.0.0` stays commit `27e4251`. Git tag `v0.9.0` stays commit `25d3453`. Git tag `v0.8.0` stays commit `7133dfc`. npm `1.0.3` is the previous registry release. npm `1.0.1` and npm `1.0.2` were not published. Homepage and registry `websiteUrl` are https://mcp-lint-alpha.vercel.app/.

Unreleased work stays under `## [Unreleased]` in `CHANGELOG.md`. Do not bump `package.json` until the release commit.

## Gate before a version bump

- `npx tsc --noEmit`
- `npx vitest run`
- `npm pack --dry-run` and a smoke run of `node dist/index.js --version`
- README, CHANGELOG, and `server.json` `version` fields match
- `server.json` description stays at or under 100 characters
- No new client claim without a rule test
- Site copy matches the version if the release changes the proof page

## Publish order

1. Commit and annotated tag on `main`.
2. GitHub release.
3. Vercel production deploy of the site when the page changed.
4. `npm publish --access public` as npm user `robert19001`. Web login and a browser approval are required. A dead token comes back as `PUT` 404. If `npm view mcp-lint@<version>` already shows the version, do not publish again.
5. MCP registry publish with `mcp-publisher` only after `npm view` shows that version.
6. Leave the VS Code extension and Docker image unpublished unless the maintainer asks.

## Compatibility

Patch and minor versions keep commands, flags, SDK export paths, MCP tool names, and the existing `check --format json` shape. The audit report schema is versioned on its own. Breaking that schema requires a new `schemaVersion` and a changelog note.
