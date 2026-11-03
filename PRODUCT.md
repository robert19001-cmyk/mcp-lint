# mcp-lint product

mcp-lint is a local MIT toolkit for MCP server authors. Repository version 1.0.2 lints tool schemas, writes an audit report, scores whether an agent can recover from a recorded failure, lists resources and prompts, and evaluates a proposed action against a policy. It does not call tools in order to discover them. npm `latest` is 1.0.2.

The public site is https://mcp-lint-alpha.vercel.app/. The site source is `site/`. npm package `mcp-lint`. MCP registry name `io.github.robert19001-cmyk/mcp-lint`.

## What 1.0.0 does

- `check` lints a tools file, a directory that contains one, or a live `tools/list` from stdio, SSE, or streamable HTTP.
- Bare `npx mcp-lint` looks in the current directory, and one level down, for `tools.json`, `tools.yaml`, `tools.yml`, `mcp-tools.json`, `mcp-tools.yaml`, and `mcp-tools.yml`. It skips `node_modules` and dot directories.
- Rules cover JSON Schema misuse plus eight clients: Claude, Cursor, Gemini, VS Code, Windsurf, Cline, OpenAI, and Continue.
- `check --installed` and `--from` read local Cursor, Claude, and VS Code MCP configs, including `projects.<path>.mcpServers` in `~/.claude.json`. Remote URLs are skipped unless `--remote` is set.
- Schema rules walk `outputSchema` the same way as `inputSchema`. A missing output schema is not an error. Repeated names in one list, and the same name on two installed servers, are errors.
- `fix` writes only fixes marked `safe`. `--dry-run` also lists `review` and `manual` fixes. Titles are not invented.
- `report` writes one tools file as terminal, JSON, Markdown, SARIF 2.1.0, or offline HTML. `check --format json` is still the diagnostic array. The compatibility section comes from that lint. A cell is `measured` or `not_observed`. An empty tool list leaves it not run. Recovery and preflight stay not run.
- `--score` uses `quality-v2`. Missing description or schema fields add no points. An empty tool list is unmeasured. Audit reports withhold that empty score.
- `snapshot` writes a stable tools JSON file. `diff` exits 1 when the new file adds an error.
- `recover` scores recorded failures. `rate_limit` and `timeout` are transient. Every other kind is permanent. A stdio probe lists tools and does not call them unless both `--sandbox` and `--invoke` are set.
- `catalog` lists resources and prompts from a live server. It does not scan installed configs and it does not call a tool.
- `report --baseline` fails CI when the stable audit snapshot changes. `--update-baseline` rewrites that file.
- `preflight` returns allow, allow_with_rewrite, require_approval, or deny. The score is a heuristic, not a guarantee.
- `compat` marks each cell `measured` or `not_observed`. A check mark is not proof that a client accepts the schema. `explain` prints one rule.
- Preflight denies an unknown `tool_type`. The score stays a heuristic.
- `init` writes `.mcplintrc.json`.
- The `mcp-lint-server` binary exposes list rules, explain, check, fix, preflight, and score recovery.
- SDK exports: `.`, `./preflight`, `./recover`, `./rules`, `./loaders`, `./fixer`, `./mcp-server`, `./audit`.

## What it is not

Zed and OpenCode are not claimed. Windsurf and Cline have schema rules, and their config files are not scanned. The GitHub Action example is `robert19001-cmyk/mcp-lint@v1.0.2`. That tag installs `mcp-lint@1` unless `version` is set. Tag `v1.0.1` does the same. Tag `v1.0.0` still installs npm `latest`.

## Community product

The CLI, recovery scorer, and preflight stay free, local, and without an account. There is no telemetry. A later hosted product would be a separate layer for team history and shared policy. It is not part of this repository's runtime.

## Compatibility promise

Commands, flags, SDK exports, and MCP tool names from 0.9.0 stay, with one break: `recover --server stdio` no longer calls tools unless `--sandbox` and `--invoke` are both set. New report fields and the catalog command are additive. A missing measurement is reported as not run. It is not reported as a pass.
