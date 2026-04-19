# mcp-lint

[![npm version](https://img.shields.io/npm/v/mcp-lint?color=crimson)](https://www.npmjs.com/package/mcp-lint)
[![npm downloads](https://img.shields.io/npm/dm/mcp-lint)](https://www.npmjs.com/package/mcp-lint)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js ≥20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

**Lint MCP server tool schemas for cross-client compatibility.**

MCP servers expose tool schemas consumed by **Claude**, **Cursor**, **Gemini**, **VS Code Copilot**, **Windsurf**, **Cline**, **OpenAI Agents SDK**, and **Continue.dev**. Each client has different JSON Schema support and quirks — a schema that works in Claude may silently break in Cursor or OpenAI. `mcp-lint` catches these issues before your users do.

```
$ npx mcp-lint check tools.json

search-tool
  ✖ Schema node at "inputSchema.properties.query" has `required: false` which is not valid JSON Schema.
    inputSchema.properties.query  [no-required-false]
  ⚠ Parameter "limit" in tool "search-tool" is missing a description.
    inputSchema.properties.limit  [description-exists]

1 error, 1 warning
```

---

## Installation

```bash
# One-time use (no install)
npx mcp-lint check tools.json

# Global
npm install -g mcp-lint

# Per-project dev dependency
npm install --save-dev mcp-lint
```

---

## Quick Start

```bash
# Check a JSON or YAML file
mcp-lint check tools.json

# See compatibility across all clients at a glance
mcp-lint compat tools.json

# Learn what a rule does
mcp-lint explain openai/no-additional-properties

# Auto-fix what can be fixed
mcp-lint fix tools.json --in-place

# Generate a config file
mcp-lint init
```

---

## `mcp-lint compat` — Compatibility Matrix

See exactly which tools work with which clients:

```
$ mcp-lint compat tools.json

                    claude    cursor    gemini    vscode    windsurf  cline     openai    continue
search-tool         ✓         ✗         ✓         ✓         ✓         ✓         ✓         ✓
file-reader         ✓         ✓         ✗         ✓         ✓         ✓         ✓         ✗
database-query      ✓         ✓         ✓         ✓         ✓         ✓         ✗         ✓

2 tools have compatibility issues. Run `mcp-lint check` for details.
```

```bash
mcp-lint compat tools.json --format markdown   # for PRs and GitHub Step Summary
mcp-lint compat tools.json --format json       # machine-readable
mcp-lint compat --server stdio -- node server.js
```

---

## `mcp-lint explain` — Rule Documentation

```
$ mcp-lint explain openai/no-additional-properties

Rule: openai/no-additional-properties
Severity:  error
Clients:   openai
Fixable:   yes

Description
OpenAI Agents SDK strict mode requires `additionalProperties: false` on the root inputSchema.

Why
OpenAI's strict function calling mode rejects schemas that don't explicitly set
`additionalProperties: false` at the root level.

Bad example
{
  "type": "object",
  "properties": { "q": { "type": "string" } }
}

Good example
{
  "type": "object",
  "properties": { "q": { "type": "string" } },
  "additionalProperties": false
}

Auto-fix
Add `"additionalProperties": false` to the root inputSchema.
```

---

## CLI Reference

### `mcp-lint check [input]`

```bash
mcp-lint check tools.json

# Output formats
mcp-lint check tools.json --format terminal   # default, colored output
mcp-lint check tools.json --format json       # machine-readable (CI/CD)
mcp-lint check tools.json --format markdown   # for PRs and GitHub summaries

# Filters
mcp-lint check tools.json --clients claude,cursor,openai   # only these clients' rules
mcp-lint check tools.json --severity error                 # errors only
mcp-lint check tools.json --quiet                          # same as --severity error
mcp-lint check tools.json --ignore "debug-tool,internal-tool"

# Config
mcp-lint check tools.json --config path/to/.mcplintrc.json
mcp-lint check tools.json --no-color

# Live servers
mcp-lint check --server stdio -- node my-server.js
mcp-lint check --server stdio -- python my_server.py arg1 arg2
mcp-lint check --server sse --url http://localhost:3000/sse
```

**Exit codes:**

| Code | Meaning |
|------|---------|
| `0` | No errors (warnings don't count) |
| `1` | One or more errors found |
| `2` | Invalid input or configuration error |

---

### `mcp-lint fix [input]`

Auto-fixes issues that are safe to fix automatically (no semantic changes).

```bash
mcp-lint fix tools.json                            # fixed output to stdout
mcp-lint fix tools.json --output fixed-tools.json  # write to file
mcp-lint fix tools.json --in-place                 # overwrite original
mcp-lint fix tools.json --dry-run                  # show what would be fixed
mcp-lint fix tools.json --rules no-required-false,no-empty-enum  # specific rules only
```

---

### `mcp-lint init`

Creates a default `.mcplintrc.json` in the current directory.

```bash
mcp-lint init          # fails if file already exists
mcp-lint init --force  # overwrite existing
```

---

## Rules

### Universal (all clients)

| Rule | Severity | Fixable | Description |
|------|----------|---------|-------------|
| `no-required-false` | 🔴 error | ✅ | `required: false` on properties is not valid JSON Schema |
| `no-content-encoding` | 🔴 error | ✅ | `contentEncoding` is not supported by MCP clients |
| `no-empty-enum` | 🔴 error | ✅ | Empty `enum: []` makes a parameter impossible to satisfy |
| `no-recursive-refs` | 🔴 error | ❌ | Circular `$ref` causes crashes in most clients |
| `valid-json-schema-subset` | 🔴 error | ❌ | Unsupported keywords: `oneOf`, `anyOf`, `allOf`, `if/then/else`, `not`, `patternProperties`… |
| `description-exists` | 🟡 warning | ❌ | Tools and parameters should have descriptions |
| `max-depth` | 🟡 warning | ❌ | Schema nesting deeper than 5 levels hurts LLM comprehension |
| `no-unsupported-formats` | 🟡 warning | ✅ | Obscure `format` values (`iri`, `json-pointer`, `regex`…) not widely supported |

### Claude-specific

| Rule | Severity | Fixable | Description |
|------|----------|---------|-------------|
| `claude/no-type-array` | 🟡 warning | ✅ | `"type": ["string", "null"]` array syntax may not work correctly in Claude |

### Cursor-specific

| Rule | Severity | Fixable | Description |
|------|----------|---------|-------------|
| `cursor/no-default-without-type` | 🔴 error | ✅ | Cursor requires explicit `type` when a `default` value is present |

### Gemini-specific

| Rule | Severity | Fixable | Description |
|------|----------|---------|-------------|
| `gemini/no-optional-without-default` | 🟡 warning | ❌ | Gemini handles optional params better when `default` is explicit |
| `gemini/no-nested-objects` | 🟡 warning | ❌ | Gemini has limited support for object properties nested more than 2 levels |

### VS Code Copilot-specific

| Rule | Severity | Fixable | Description |
|------|----------|---------|-------------|
| `vscode/max-params` | 🟡 warning | ❌ | VS Code Copilot performance degrades with more than 15 parameters |

### Windsurf-specific

| Rule | Severity | Fixable | Description |
|------|----------|---------|-------------|
| `windsurf/no-union-types` | 🟡 warning | ❌ | `anyOf` with more than 2 variants not supported |

### Cline-specific

| Rule | Severity | Fixable | Description |
|------|----------|---------|-------------|
| `cline/description-max-length` | 🟡 warning | ✅ | Descriptions over 200 characters are truncated by Cline |

### OpenAI Agents SDK-specific

| Rule | Severity | Fixable | Description |
|------|----------|---------|-------------|
| `openai/no-additional-properties` | 🔴 error | ✅ | Strict mode requires `additionalProperties: false` on root inputSchema |
| `openai/strict-types` | 🔴 error | ❌ | Only `string`, `number`, `boolean`, `object`, `array`, `null` allowed |

### Continue.dev-specific

| Rule | Severity | Fixable | Description |
|------|----------|---------|-------------|
| `continue/no-default-values` | 🟡 warning | ❌ | Continue.dev ignores `default` fields — document defaults in descriptions instead |

---

## Configuration

`mcp-lint` auto-discovers `.mcplintrc.json` starting from the current directory up to your home folder. Override with `--config`.

```json
{
  "rules": {
    "no-required-false": "error",
    "description-exists": "warning",
    "max-depth": "off",
    "claude/no-type-array": "error"
  },
  "clients": ["claude", "cursor", "gemini", "vscode", "windsurf", "cline", "openai", "continue"],
  "ignore": ["internal-debug-tool"],
  "maxDepth": 5
}
```

### Presets

Use `"extends"` to start from a built-in preset:

```json
{ "extends": "recommended" }
```

```json
{
  "extends": "strict",
  "rules": {
    "description-exists": "warning"
  }
}
```

| Preset | Description |
|--------|-------------|
| `recommended` | All 8 clients enabled, default severities |
| `strict` | All rules set to `error`, `maxDepth: 3` |

Rule severities: `"error"` | `"warning"` | `"info"` | `"off"`

---

## CI/CD — GitHub Actions

```yaml
name: MCP Schema Lint
on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }

      # Fail the build on errors
      - run: npx mcp-lint check ./src/tools.json

      # Post compatibility matrix to PR summary
      - run: npx mcp-lint compat ./src/tools.json --format markdown >> $GITHUB_STEP_SUMMARY
        if: always()

      # Save JSON results as artifact
      - run: npx mcp-lint check ./src/tools.json --format json > lint-results.json || true
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: mcp-lint-results
          path: lint-results.json
```

---

## Programmatic API

```typescript
import { LintEngine } from 'mcp-lint';
import { allRules } from 'mcp-lint/rules';
import { loadFile } from 'mcp-lint/loaders';
import { applyFixes } from 'mcp-lint/fixer';

// Check
const tools = await loadFile('tools.json');
const engine = new LintEngine(allRules, {
  clients: ['claude', 'cursor', 'openai'],
  ignore: ['debug-tool'],
});
const diagnostics = engine.lint(tools);

// Fix
const fixed = applyFixes(tools, diagnostics);
```

---

## License

MIT © Robert
