# mcp-lint

[![npm version](https://img.shields.io/npm/v/mcp-lint?color=crimson)](https://www.npmjs.com/package/mcp-lint)
[![npm downloads](https://img.shields.io/npm/dm/mcp-lint)](https://www.npmjs.com/package/mcp-lint)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js ≥20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![MCP server ready](https://img.shields.io/badge/MCP-server_ready-6f42c1)](#mcp-server)
[![robert19001-cmyk/mcp-lint MCP server](https://glama.ai/mcp/servers/robert19001-cmyk/mcp-lint/badges/score.svg)](https://glama.ai/mcp/servers/robert19001-cmyk/mcp-lint)

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

# Run as an MCP server
mcp-lint-server
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
mcp-lint compat tools.json --format markdown         # for PRs and GitHub Step Summary
mcp-lint compat tools.json --format json             # machine-readable
mcp-lint compat tools.json --client openai           # single client column
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

# Quality score (0–100 per tool with A-F grades)
mcp-lint check tools.json --score

# Watch mode (re-lints on file change)
mcp-lint check tools.json --watch

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

### `mcp-lint diff <before> <after>`

Compare lint results between two versions of your schema — useful in CI to catch regressions.

```bash
mcp-lint diff tools-v1.json tools-v2.json
mcp-lint diff tools-v1.json tools-v2.json --format markdown >> $GITHUB_STEP_SUMMARY
mcp-lint diff tools-v1.json tools-v2.json --format json
```

**Exit codes:** `0` = no new errors introduced, `1` = new errors found, `2` = error

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
| `cursor/no-missing-title` | 🟡 warning | ❌ | Cursor displays tool and parameter titles in the tool picker |

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

### Using the official Action

```yaml
name: MCP Schema Lint
on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: robert19001-cmyk/mcp-lint@v0.5.2
        with:
          input: tools.json
          severity: warning
          score: 'true'
          fail_on: error
```

**Action inputs:**

| Input | Default | Description |
|-------|---------|-------------|
| `input` | _(required)_ | Path to MCP tools JSON file |
| `format` | `terminal` | `terminal\|json\|markdown` |
| `severity` | `info` | Minimum severity to report |
| `clients` | all | Comma-separated client filter |
| `fail_on` | `error` | Fail CI when issues at this severity found |
| `score` | `false` | Show quality score |

### Manual workflow

```yaml
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

      # Diff against previous version
      - run: npx mcp-lint diff tools-before.json tools-after.json --format markdown >> $GITHUB_STEP_SUMMARY
        if: always()
```

---

## Plugin API

Share and reuse rule sets via npm packages.

### Using a plugin

```bash
npm install mcp-lint-config-nextjs
```

```json
{
  "plugins": ["mcp-lint-config-nextjs"],
  "extends": "recommended"
}
```

### Writing a plugin

A plugin is an npm package that exports a `rules` array of `Rule` objects:

```typescript
// mcp-lint-config-myserver/index.ts
import type { Rule } from 'mcp-lint';

const myRule: Rule = {
  id: 'myserver/no-large-params',
  severity: 'warning',
  description: 'My server limits param count to 10',
  clients: ['claude', 'cursor'],
  check(tool) {
    const count = Object.keys(tool.inputSchema.properties ?? {}).length;
    if (count > 10) return [{
      toolName: tool.name,
      ruleId: 'myserver/no-large-params',
      severity: 'warning',
      message: `Too many params (${count})`,
      path: 'inputSchema.properties',
    }];
    return [];
  },
};

export const rules = [myRule];
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

## `mcp-lint preflight` — Runtime Decision Firewall

**Lint catches bad schemas. Preflight catches bad actions.**

At runtime, your agent is about to call a tool — delete a file, send a request, charge a card. Preflight sits between the agent and the action and answers:

- Is it allowed?
- How risky is it? (0.0–1.0 deterministic score)
- Is it reversible?
- Does it need human approval?
- Is there a safer alternative?

```bash
$ mcp-lint preflight action.json --policy preflight.yml

Preflight Decision
────────────────────────────────────────
Decision:      DENY
Risk score:    1.00
Reversibility: irreversible
Policies:      block-destructive-prod
Reasons:       base_shell, destructive_pattern, sensitive_target, irreversible_operation
```

### Action format

```json
{
  "tool_type": "shell",
  "tool_name": "bash",
  "action": "rm -rf /prod/data",
  "target": "/prod/data",
  "context": { "environment": "prod" }
}
```

### Policy file (YAML)

```yaml
version: 1
defaults:
  approval_threshold: 0.70
  block_threshold: 0.92

rules:
  - id: block-prod-delete
    when:
      tool_type: shell
      action_matches: ["rm -rf"]
      target_matches: ["/prod", "/etc"]
    effect: deny

  - id: rewrite-tmp-delete
    when:
      tool_type: shell
      action_matches: ["rm -rf ./tmp"]
    effect: allow_with_rewrite
    rewrite:
      tool_type: file_delete
      action: move_to_trash
      target: ./tmp

  - id: approval-payments
    when:
      tool_type: payment
    effect: require_approval
```

Sample policies in `examples/policies/`: `default.yml`, `strict.yml`, `permissive-dev.yml`.

### SDK — embed in your MCP server or agent runtime

```typescript
import { preflight, loadPolicy } from 'mcp-lint/preflight';

const policy = await loadPolicy('./preflight.yml');

const decision = preflight(
  {
    tool_type: 'shell',
    tool_name: 'bash',
    action: 'rm -rf /tmp',
    target: '/tmp',
  },
  policy,
);

if (decision.decision === 'deny') {
  throw new Error(`Blocked: ${decision.reasons.join(', ')}`);
}
if (decision.decision === 'require_approval') {
  await askUser(decision);
}
if (decision.decision === 'allow_with_rewrite') {
  return executeSafer(decision.safe_alternative);
}
```

### Exit codes

| Code | Meaning |
|------|---------|
| `0`  | allow / allow_with_rewrite |
| `1`  | require_approval |
| `2`  | deny / error |

Use them directly in shell wrappers or CI gates.

---

## MCP Server

`mcp-lint` also ships as a stdio MCP server for Claude Desktop, Claude Code, Cursor, VS Code, and registry scanners such as Glama.

```bash
npx -y mcp-lint@latest mcp-lint-server
```

Client config:

```json
{
  "mcpServers": {
    "mcp-lint": {
      "command": "npm",
      "args": ["exec", "--yes", "--package", "mcp-lint@latest", "--", "mcp-lint-server"]
    }
  }
}
```

Available MCP tools:

| Tool | Purpose |
|------|---------|
| `mcp_lint_list_rules` | List built-in rules, clients, severities, and fixability |
| `mcp_lint_explain_rule` | Explain one rule with examples and auto-fix notes |
| `mcp_lint_check_tools` | Lint MCP tool schemas passed as JSON |
| `mcp_lint_fix_tools` | Return safely auto-fixed tool schemas without writing files |
| `mcp_lint_preflight_action` | Score a proposed agent action and return allow/deny/approval/rewrite |

All server tools are read-only from the host perspective: they return diagnostics, fixed JSON, or policy decisions and never execute the action being evaluated.

### Docker

```bash
docker build -t mcp-lint-server .
docker run --rm -i mcp-lint-server
```

The repository includes `glama.json` and a production Dockerfile so MCP directories can build, start, and introspect the server.

---

## License

MIT © Robert
