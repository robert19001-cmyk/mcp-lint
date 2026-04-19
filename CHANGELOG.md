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
