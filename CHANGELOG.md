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
