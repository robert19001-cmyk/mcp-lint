# Architecture

mcp-lint is a Node.js 20+ TypeScript package. Source lives in `src/`. `tsc` writes `dist/`. Tests use Vitest and import source files directly. The npm package publishes `dist/` and `examples/` only.

## Commands

| Command | Module | Role |
| --- | --- | --- |
| `check` | `src/cli/commands/check.ts` | Default command. Files, directories, stdio, SSE, HTTP, `--installed`, `--from`. |
| `fix` | `src/cli/commands/fix.ts` | Applies `Diagnostic.fix` functions. `--dry-run` prints only. |
| `init` | `src/cli/commands/init.ts` | Writes `.mcplintrc.json` for the eight clients. |
| `compat` | `src/cli/commands/compat.ts` | Prints `src/core/compat-matrix.ts`. |
| `explain` | `src/cli/commands/explain.ts` | Prints rule docs. |
| `diff` | `src/cli/commands/diff.ts` | Compares two lint results. Exit 1 on new errors. |
| `snapshot` | `src/cli/commands/snapshot.ts` | Writes stable tools JSON from a live server. |
| `preflight` | `src/cli/commands/preflight.ts` | Policy decision for one action. |
| `recover` | `src/cli/commands/recover.ts` | Scores recorded failures. A stdio probe lists tools unless `--sandbox` and `--invoke` are both set. |
| `catalog` | `src/cli/commands/catalog.ts` | Lists resources and prompts. Does not call a tool. |
| `report` | `src/cli/commands/report.ts` | Writes `MCPAuditReport`. `--baseline` diffs a stable snapshot. |

`check --format json` still prints diagnostics. There is no `inspect`, `benchmark`, `tokens`, or `rules` command.

## Pipeline

`LintEngine` in `src/core/engine.ts` runs `allRules` from `src/rules/index.ts`. A rule returns `Diagnostic` values (`ruleId`, `severity`, `message`, `toolName`, `path`, `clients`, optional `fix`). Severity is `error`, `warning`, or `info`.

Client ids today are `claude`, `cursor`, `gemini`, `vscode`, `windsurf`, `cline`, `openai`, and `continue`. `MCPTool` stores `name`, `title`, `description`, `inputSchema`, optional `outputSchema`, and `annotations`. Schema rules run on `outputSchema` by rewriting `inputSchema` paths. A missing output schema is not a finding. `tool-name/duplicate` is emitted for the whole list. `tool-name/server-collision` is emitted only while linting installed servers.

`computeQualityReport` in `src/core/quality-score.ts` is `quality-v2`. Points come from a description, an input schema, an output schema, and a clean lint. Missing fields add nothing. An empty tool list returns overall 100 with `measured: false`. `buildAuditReport` still withholds that score. `applyFixes` writes only fixes marked `safe`. Directory discovery looks at the directory and its immediate children, skipping `node_modules` and dot directories. Compat cells carry `measured` or `not_observed`.

Loaders in `src/loaders/` map `tools/list` into `MCPTool`. They do not call tools. Installed-server discovery is `src/installed/`. It reads top-level `mcpServers` and each `projects.<path>.mcpServers` object in `~/.claude.json`.

`src/recover/` and `src/preflight/` are separate engines with their own types. The audit report does not reimplement them. `src/catalog/` lists resources and prompts and does not call tools.

`src/snapshot/serialize.ts` stabilizes tools JSON for `diff`. `src/audit/baseline.ts` stabilizes an audit report for `report --baseline`. The snapshot pins `generatedAt` and keeps `tool.version`.

Plugins load from `src/config/plugin-loader.ts`. Presets live in `src/config/presets.ts`.

## Audit report

`src/audit/` builds schema version 1 of `MCPAuditReport`. It is an SDK export, `mcp-lint/audit`, and does not change `check --format json`. Token totals use `chars / 4` and are marked `approximate: true`. Compatibility is filled from the diagnostics for that tools file. A cell is `measured` or `not_observed`. An empty tool list, or a report built without diagnostics, leaves it `not_run`. Recovery and preflight stay `not_run`. `report` does not take a failure sample or an action, so those sections cannot be marked ran.

`parseAuditReport` rejects unknown top-level fields and any `schemaVersion` other than 1.

## MCP server

`src/mcp-server.ts` registers `mcp_lint_list_rules`, `mcp_lint_explain_rule`, `mcp_lint_check_tools`, `mcp_lint_fix_tools`, `mcp_lint_preflight_action`, and `mcp_lint_score_recovery`. Those names stay. New tools are added beside them.

## Site and CI

The proof page is Vite, rooted at `site/`, built with `npm run site:build`. Vercel uses `vercel.json` and publishes `site/dist`. GitHub Pages is a mirror with `SITE_BASE=/mcp-lint/`. The canonical URL is the Vercel site.

`action.yml` installs `mcp-lint@1` unless the `version` input says otherwise, then runs `check`. `sarif: true` uploads SARIF when the installed CLI has `report`. Tag `v1.0.2` and tag `v1.0.1` have this input. Tag `v1.0.0` still installs `mcp-lint@latest`.

## Boundaries

- No network during a file lint.
- Live and installed modes require an explicit flag.
- No telemetry.
- Heuristic preflight and token estimates are labeled as heuristics.
- `dist/` is generated. Edit `src/`.
