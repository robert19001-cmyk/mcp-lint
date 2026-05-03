## [0.5.3] — 2026-05-03

### Added
- Added official MCP Registry metadata through `mcpName` and `server.json`.
- Added npm repository, bugs, and homepage metadata.
- Added the MCP Registry OCI ownership label to the Docker image.

### Changed
- GitHub Action documentation now references `v0.5.3`.

## [0.5.2] — 2026-05-03

### Added
- Added `cursor/no-missing-title` to flag MCP tools and top-level parameters that are missing human-readable titles for Cursor's tool picker.
- Added the Glama MCP server badge to the README.

### Changed
- GitHub Action documentation now references `v0.5.2`.

## [0.5.1] — 2026-05-03

### Fixed
- Fixed npm `.bin` execution for `mcp-lint-server` when launched through the package manager symlink.
- Updated MCP client config docs to use `npm exec --package mcp-lint@latest -- mcp-lint-server`.

## [0.5.0] — 2026-05-03

### Added
- Public SDK subpath exports for `mcp-lint/loaders` and `mcp-lint/fixer`, matching the documented programmatic API examples.
- Stdio MCP server entry point via `mcp-lint-server` with tools for schema linting, fixes, rule explanations, and runtime preflight decisions.
- Dockerfile, `.dockerignore`, and `glama.json` for MCP registry scanning and Glama listing preparation.

### Changed
- GitHub Action documentation now references `v0.5.1`.
- Refreshed the lockfile to clear current npm audit advisories.

## [0.4.0] — 2026-04-19

### Added
- **`mcp-lint preflight <action.json>`** — runtime decision firewall for agent tool calls; evaluates a proposed action and returns allow/deny/require_approval/allow_with_rewrite
- **Deterministic risk scoring** — rule-based 0.0–1.0 score from tool type, destructive patterns, sensitive targets, mass operations, prod environment, cost
- **Reversibility classifier** — reversible / partially_reversible / irreversible
- **Policy engine** — YAML rules with matchers (tool_type, tool_name, action_matches, target_matches, domain allowlist, min_risk, max_cost_usd), effects (allow, deny, require_approval, allow_with_rewrite), optional rewrite target
- **Safe rewrite engine** — policies can transform risky actions into safer alternatives (e.g. `rm -rf` → `move_to_trash`)
- **SDK subpath export** — `import { preflight } from 'mcp-lint/preflight'` for embedding in MCP servers, agent runtimes, or custom tool wrappers
- **Sample policies** in `examples/policies/`: default, strict, permissive-dev
- **Sample actions** in `examples/actions/`
- Exit codes: 0 allow/rewrite, 1 require_approval, 2 deny/error

### Changed
- Package now exposes three entry points: `mcp-lint`, `mcp-lint/preflight`, `mcp-lint/rules`

---

## [0.3.0] — 2026-04-19

### Added
- **`mcp-lint diff <before> <after>`** — compare lint results between two schema versions, exits 1 if new errors introduced
- **`--watch` flag** on `check` command — re-lints on file change with 100ms debounce
- **`--score` flag** on `check` command — shows quality score (0–100) per tool with A-F grades
- **`compat --client <id>`** — filter compatibility matrix to a single client column
- **Demo fixture** (`demo/tools.json`) — realistic example schema for testing and GIF recording

---

## [0.2.0] — 2026-04-19

### Added
- **4 new clients:** Windsurf, Cline, OpenAI Agents SDK, Continue.dev
- **`mcp-lint compat`** — compatibility matrix command (terminal, JSON, Markdown output)
- **`mcp-lint explain <rule-id>`** — rule documentation with examples
- **Config presets:** `"extends": "strict"` and `"extends": "recommended"` in `.mcplintrc.json`
- New rules:
  - `windsurf/no-union-types` — anyOf with >2 variants not supported
  - `cline/description-max-length` — descriptions truncated at 200 chars
  - `openai/no-additional-properties` — strict mode requires additionalProperties: false
  - `openai/strict-types` — only string/number/boolean/object/array/null allowed
  - `continue/no-default-values` — Continue.dev ignores default field values
