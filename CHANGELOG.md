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
