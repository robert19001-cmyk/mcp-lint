# mcp-lint product

mcp-lint is a local MIT toolkit for MCP server authors. Published version 0.8.0 lints tool schemas, scores whether an agent can recover from a recorded failure, and evaluates a proposed action against a policy. It does not call tools in order to discover them.

The public site is https://mcp-lint-alpha.vercel.app/. The site source is `site/`. npm package `mcp-lint`. MCP registry name `io.github.robert19001-cmyk/mcp-lint`.

## What 0.8.0 already does

- `check` lints a tools file, a directory that contains one, or a live `tools/list` from stdio, SSE, or streamable HTTP.
- Bare `npx mcp-lint` looks in the current directory for `tools.json`, `tools.yaml`, `tools.yml`, `mcp-tools.json`, `mcp-tools.yaml`, and `mcp-tools.yml`.
- Rules cover JSON Schema misuse plus eight clients: Claude, Cursor, Gemini, VS Code, Windsurf, Cline, OpenAI, and Continue.
- `check --installed` and `--from` read local Cursor, Claude, and VS Code MCP configs. Remote URLs are skipped unless `--remote` is set.
- `fix` applies safe schema fixes. `--dry-run` previews them.
- `snapshot` writes a stable tools JSON file. `diff` exits 1 when the new file adds an error.
- `recover` scores recorded failures. A stdio probe lists tools and does not invoke them.
- `preflight` returns allow, allow_with_rewrite, require_approval, or deny. The score is a heuristic, not a guarantee.
- `compat` and `explain` document the built-in matrix and rules.
- `init` writes `.mcplintrc.json`.
- The `mcp-lint-server` binary exposes list rules, explain, check, fix, preflight, and score recovery.
- SDK exports: `.`, `./preflight`, `./recover`, `./rules`, `./loaders`, `./fixer`, `./mcp-server`.

## What it is not yet

Version 0.8.0 is not the 1.0 developer toolkit described in `ROADMAP.md`. There is no shared audit-report formatter for SARIF or HTML yet. `outputSchema` is not linted. Zed and OpenCode are not claimed. The quality score is still the v1 average (`100 - 15 per error - 5 per warning`). An empty tool list currently scores 100 in that v1 function. New audit reports withhold that score instead of copying it.

## Community product

The CLI, recovery scorer, and preflight stay free, local, and without an account. There is no telemetry. A later hosted product would be a separate layer for team history and shared policy. It is not part of this repository's runtime.

## Compatibility promise

Existing commands, flags, SDK exports, and MCP tool names stay. New report formats are additive. A missing measurement is reported as not run. It is not reported as a pass.
