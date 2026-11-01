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
| `recover` | `src/cli/commands/recover.ts` | Scores recorded failures or probes stdio `tools/list`. |

`report` writes `MCPAuditReport` as terminal, JSON, Markdown, SARIF 2.1.0, or HTML. `check --format json` still prints diagnostics. There is no `inspect`, `benchmark`, `tokens`, or `rules` command yet.

## Pipeline

`LintEngine` in `src/core/engine.ts` runs `allRules` from `src/rules/index.ts`. A rule returns `Diagnostic` values (`ruleId`, `severity`, `message`, `toolName`, `path`, `clients`, optional `fix`). Severity is `error`, `warning`, or `info`.

Client ids today are `claude`, `cursor`, `gemini`, `vscode`, `windsurf`, `cline`, `openai`, and `continue`. `MCPTool` stores `name`, `title`, `description`, `inputSchema`, optional `outputSchema`, and `annotations`. Schema rules run on `outputSchema` by rewriting `inputSchema` paths. A missing output schema is not a finding. `tool-name/duplicate` is emitted for the whole list. `tool-name/server-collision` is emitted only while linting installed servers.

`computeQualityReport` in `src/core/quality-score.ts` is quality algorithm `quality-v1`. Empty input returns 100. Callers that need an honest audit must not treat that 100 as a measured pass. `buildAuditReport` withholds the score when there are no tools.

Loaders in `src/loaders/` map `tools/list` into `MCPTool`. They do not call tools. Installed-server discovery is `src/installed/`. It reads top-level `mcpServers` in `~/.claude.json` and does not walk the `projects` map.

`src/recover/` and `src/preflight/` are separate engines with their own types. The audit report can point at their results later. It does not reimplement them.

`src/snapshot/serialize.ts` stabilizes tools JSON for `diff`. A full `MCPAuditReport` snapshot is later work.

Plugins load from `src/config/plugin-loader.ts`. Presets live in `src/config/presets.ts`.

## Audit report

`src/audit/` builds schema version 1 of `MCPAuditReport`. It is an SDK export, `mcp-lint/audit`, and does not change `check --format json`. Token totals use `chars / 4` and are marked `approximate: true`. Recovery, preflight, and live inspection stay `not_run` until a caller supplies them.

`parseAuditReport` rejects unknown top-level fields and any `schemaVersion` other than 1.

## MCP server

`src/mcp-server.ts` registers `mcp_lint_list_rules`, `mcp_lint_explain_rule`, `mcp_lint_check_tools`, `mcp_lint_fix_tools`, `mcp_lint_preflight_action`, and `mcp_lint_score_recovery`. Those names stay. New tools are added beside them.

## Site and CI

The proof page is Vite, rooted at `site/`, built with `npm run site:build`. Vercel uses `vercel.json` and publishes `site/dist`. GitHub Pages is a mirror with `SITE_BASE=/mcp-lint/`. The canonical URL is the Vercel site.

`action.yml` installs `mcp-lint@latest` and runs `check`. It does not upload SARIF yet.

## Boundaries

- No network during a file lint.
- Live and installed modes require an explicit flag.
- No telemetry.
- Heuristic preflight and token estimates are labeled as heuristics.
- `dist/` is generated. Edit `src/`.
