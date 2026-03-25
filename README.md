# mcp-lint

> Lint MCP server tool schemas for cross-client compatibility.

[![npm](https://img.shields.io/npm/v/mcp-lint)](https://www.npmjs.com/package/mcp-lint)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Problem

MCP servers expose tool schemas consumed by **Claude**, **Cursor**, **Gemini**, and **VS Code Copilot**. Each client has different JSON Schema support and quirks. A schema that works in Claude may silently break in Cursor. `mcp-lint` catches these issues before your users do.

## Quick Start

```bash
npx mcp-lint check tools.json
```

## Installation

```bash
# Global
npm install -g mcp-lint

# Per-project dev dependency
npm install --save-dev mcp-lint

# No install needed
npx mcp-lint check tools.json
```

## Usage

### `mcp-lint check`

```bash
# Check a static JSON or YAML file
mcp-lint check tools.json
mcp-lint check tools.yaml

# Check a live MCP server (stdio)
mcp-lint check --server stdio -- node my-server.js
mcp-lint check --server stdio -- python my_server.py

# Check a live MCP server (SSE)
mcp-lint check --server sse --url http://localhost:3000/sse

# Output formats
mcp-lint check tools.json --format json      # machine-readable
mcp-lint check tools.json --format markdown  # for PRs / GitHub Actions

# Filters
mcp-lint check tools.json --clients claude,cursor
mcp-lint check tools.json --severity error        # errors only
mcp-lint check tools.json --quiet                 # same as --severity error
mcp-lint check tools.json --ignore "debug-tool"
```

**Exit codes:** `0` = no errors · `1` = errors found · `2` = invalid input

### `mcp-lint fix`

```bash
mcp-lint fix tools.json                          # output to stdout
mcp-lint fix tools.json --output fixed.json      # write to file
mcp-lint fix tools.json --in-place               # overwrite original
mcp-lint fix tools.json --dry-run                # show what would change
mcp-lint fix tools.json --rules no-required-false,no-empty-enum
```

### `mcp-lint init`

```bash
mcp-lint init          # creates .mcplintrc.json in current directory
mcp-lint init --force  # overwrite existing
```

## Rules Reference

| Rule | Severity | Clients | Fixable | Description |
|------|----------|---------|---------|-------------|
| `no-required-false` | error | all | ✅ | `required: false` on properties is not valid JSON Schema |
| `no-content-encoding` | error | all | ✅ | `contentEncoding` is not supported by MCP clients |
| `description-exists` | warning | all | ❌ | Tools and parameters should have descriptions |
| `no-empty-enum` | error | all | ✅ | Empty `enum: []` makes a parameter impossible to satisfy |
| `max-depth` | warning | all | ❌ | Schema nesting deeper than 5 levels (configurable) |
| `no-recursive-refs` | error | all | ❌ | Circular `$ref` causes crashes in most clients |
| `valid-json-schema-subset` | error | all | ❌ | Unsupported keywords: `oneOf`, `anyOf`, `if/then/else`, etc. |
| `no-unsupported-formats` | warning | all | ✅ | Obscure `format` values not widely supported |
| `claude/no-type-array` | warning | claude | ✅ | Array `type` syntax may not work in Claude |
| `cursor/no-default-without-type` | error | cursor | ✅ | Cursor requires explicit `type` when `default` is present |
| `gemini/no-optional-without-default` | warning | gemini | ❌ | Gemini handles optional params better with explicit defaults |
| `gemini/no-nested-objects` | warning | gemini | ❌ | Gemini has limited support for deeply nested objects |
| `vscode/max-params` | warning | vscode | ❌ | VS Code Copilot degrades with more than 15 parameters |

## Configuration (`.mcplintrc.json`)

```json
{
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

Config is auto-discovered from the current directory up to your home folder. Override with `--config path/to/.mcplintrc.json`.

## CI/CD (GitHub Actions)

```yaml
- name: Lint MCP schemas
  run: |
    npx mcp-lint check ./src/tools.json --format json > lint-results.json
    npx mcp-lint check ./src/tools.json --format markdown >> $GITHUB_STEP_SUMMARY
```

## Programmatic API

```typescript
import { LintEngine } from 'mcp-lint';
import { allRules } from 'mcp-lint/rules';

const engine = new LintEngine(allRules, { clients: ['claude', 'cursor'] });
const diagnostics = engine.lint(tools);
```

## Adding a Rule

Create `src/rules/my-rule.ts`:

```typescript
import type { Rule } from '../core/rule.js';

export const myRule: Rule = {
  id: 'my-rule',
  severity: 'warning',
  description: 'What this rule checks',
  clients: ['claude', 'cursor', 'gemini', 'vscode'],
  check(tool, context) {
    const diagnostics = [];
    // inspect tool.inputSchema, push to diagnostics
    return diagnostics;
  },
};
```

Register it in `src/rules/index.ts`. Add tests in `tests/rules/my-rule.test.ts`.
