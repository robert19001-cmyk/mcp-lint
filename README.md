# mcp-lint

[![npm version](https://img.shields.io/npm/v/mcp-lint?color=crimson)](https://www.npmjs.com/package/mcp-lint)
[![npm downloads](https://img.shields.io/npm/dm/mcp-lint)](https://www.npmjs.com/package/mcp-lint)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js ≥18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

**Lint MCP server tool schemas for cross-client compatibility.**

MCP servers expose tool schemas consumed by **Claude**, **Cursor**, **Gemini**, and **VS Code Copilot**. Each client has different JSON Schema support and quirks — a schema that works in Claude may silently break in Cursor. `mcp-lint` catches these issues before your users do.

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
# Generate a config file
mcp-lint init

# Check a JSON or YAML file
mcp-lint check tools.json
mcp-lint check tools.yaml

# Check a live MCP server (stdio)
mcp-lint check --server stdio -- node my-server.js

# Check a live MCP server (SSE)
mcp-lint check --server sse --url http://localhost:3000/sse

# Auto-fix what can be fixed
mcp-lint fix tools.json --in-place
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
mcp-lint check tools.json --clients claude,cursor    # only these clients' rules
mcp-lint check tools.json --severity error           # errors only
mcp-lint check tools.json --quiet                    # same as --severity error
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

---

## Configuration

`mcp-lint` auto-discovers `.mcplintrc.json` starting from the current directory up to your home folder. Override with `--config`.

```json
{
  "$schema": "https://raw.githubusercontent.com/robert19001-cmyk/mcp-lint/main/config-schema.json",
  "rules": {
    "no-required-false": "error",
    "description-exists": "warning",
    "max-depth": "off",
    "claude/no-type-array": "error"
  },
  "clients": ["claude", "cursor", "gemini", "vscode"],
  "ignore": ["internal-debug-tool"],
  "maxDepth": 5
}
```

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

      # Post a summary to the PR
      - run: npx mcp-lint check ./src/tools.json --format markdown >> $GITHUB_STEP_SUMMARY
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
  clients: ['claude', 'cursor'],
  ignore: ['debug-tool'],
});
const diagnostics = engine.lint(tools);

// Fix
const fixed = applyFixes(tools, diagnostics);
```

---

## Adding a Custom Rule

Create `src/rules/my-rule.ts`:

```typescript
import type { Rule } from 'mcp-lint/core/rule';

export const myRule: Rule = {
  id: 'my-rule',
  severity: 'warning',
  description: 'What this rule checks',
  clients: ['claude', 'cursor', 'gemini', 'vscode'],

  check(tool, context) {
    const diagnostics = [];

    if (someCondition(tool.inputSchema)) {
      diagnostics.push({
        ruleId: 'my-rule',
        severity: 'warning',
        message: 'Human-readable explanation',
        toolName: tool.name,
        path: 'inputSchema.properties.something',
        clients: this.clients,
      });
    }

    return diagnostics;
  },
};
```

Register it in `src/rules/index.ts` and add tests in `tests/rules/my-rule.test.ts`.

---

## License

MIT © Robert
