# mcp-lint v0.2.0 — Design Spec

**Date:** 2026-04-19  
**Target version:** 0.2.0  
**Goal:** Traction + utility — new clients, `compat` command, `explain` command, shareable configs.

---

## 1. Scope

### In v0.2.0
- 4 new clients: Windsurf, Cline, OpenAI Agents SDK, Continue.dev
- `mcp-lint compat` command — compatibility matrix across all clients
- `mcp-lint explain <rule-id>` command — rule documentation with examples
- Builtin shareable config presets: `recommended`, `strict`
- `extends` key in `.mcplintrc.json`
- Version bump: `0.1.0` → `0.2.0`
- CHANGELOG.md update

### Out of scope (v0.3.0)
- Watch mode
- Plugin API for user-defined rules
- VS Code extension
- `mcp-lint-config-*` as separate npm packages

---

## 2. New CLI Commands

### `mcp-lint compat [input]`

Builds and displays a compatibility matrix: which tools work with which clients.

```bash
mcp-lint compat tools.json
mcp-lint compat tools.json --format markdown    # for PRs / GitHub Step Summary
mcp-lint compat tools.json --format json
mcp-lint compat --server stdio -- node server.js
```

**Terminal output:**
```
                    claude  cursor  gemini  vscode  windsurf  cline  openai  continue
search-tool           ✓       ✗       ✓       ✓        ✓        ✓      ✓        ✓
file-reader           ✓       ✓       ✗       ✓        ✓        ✓      ✓        ✗
database-query        ✓       ✓       ✓       ✓        ✓        ✓      ✗        ✓

2 tools have compatibility issues. Run `mcp-lint check` for details.
```

A tool is `compatible` with a client when it has zero `error`-severity diagnostics for that client. Warnings do not affect the matrix.

**JSON output:**
```json
{
  "tools": ["search-tool", "file-reader"],
  "clients": ["claude", "cursor", "gemini", "vscode", "windsurf", "cline", "openai", "continue"],
  "matrix": {
    "search-tool": {
      "claude": { "compatible": true, "errorCount": 0 },
      "cursor": { "compatible": false, "errorCount": 1 }
    }
  }
}
```

**Markdown output:** GitHub-flavored table with ✅/❌ cells.

**Exit codes:** same as `check` (0 = all compatible, 1 = at least one incompatibility).

### `mcp-lint explain <rule-id>`

Prints full documentation for a rule.

```bash
mcp-lint explain no-required-false
mcp-lint explain cursor/no-default-without-type
mcp-lint explain openai/no-additional-properties
```

**Output includes:**
- Rule ID, default severity, affected clients, fixable status
- Why this rule exists
- Bad schema example
- Good schema example
- Fix note (if auto-fixable)

Rules without `docs` field print: "No additional documentation available for this rule."

---

## 3. New Clients and Rules

### `ClientId` (updated)

```typescript
type ClientId =
  | 'claude' | 'cursor' | 'gemini' | 'vscode'       // existing
  | 'windsurf' | 'cline' | 'openai' | 'continue';   // new
```

### Windsurf rules (`src/rules/client-specific/windsurf.ts`)

| Rule | Severity | Fixable | Description |
|------|----------|---------|-------------|
| `windsurf/no-union-types` | warning | ✅ | `anyOf` with more than 2 variants not supported — simplify or flatten |

### Cline rules (`src/rules/client-specific/cline.ts`)

| Rule | Severity | Fixable | Description |
|------|----------|---------|-------------|
| `cline/description-max-length` | warning | ✅ | Descriptions over 200 characters are truncated by Cline — trim to 200 |

### OpenAI Agents SDK rules (`src/rules/client-specific/openai.ts`)

| Rule | Severity | Fixable | Description |
|------|----------|---------|-------------|
| `openai/no-additional-properties` | error | ✅ | Root `inputSchema` must have `"additionalProperties": false` for strict mode |
| `openai/strict-types` | error | ❌ | Only `string`, `number`, `boolean`, `object`, `array`, `null` allowed — no `integer`, no format-only types |

### Continue.dev rules (`src/rules/client-specific/continue.ts`)

| Rule | Severity | Fixable | Description |
|------|----------|---------|-------------|
| `continue/no-default-values` | warning | ❌ | Continue.dev ignores `default` fields — may mislead users into thinking defaults are applied |

---

## 4. TypeScript Types

### Extended `Rule` interface

```typescript
interface Rule {
  id: string;
  severity: Severity;
  description: string;
  url?: string;
  clients: ClientId[];
  docs?: {
    why: string;
    badExample: object;
    goodExample: object;
    fixNote?: string;
  };
  check: (tool: MCPTool, context: RuleContext) => Diagnostic[];
}
```

### `CompatMatrix` type (`src/core/compat-matrix.ts`)

```typescript
interface CompatCell {
  compatible: boolean;
  errorCount: number;
  issues: Diagnostic[];
}

interface CompatMatrix {
  tools: string[];
  clients: ClientId[];
  cells: Record<string, Record<ClientId, CompatCell>>;
}

function buildCompatMatrix(tools: MCPTool[], diagnostics: Diagnostic[]): CompatMatrix;
```

---

## 5. Shareable Config Presets

### `extends` key in `.mcplintrc.json`

```json
{ "extends": "strict" }
{ "extends": "recommended" }
```

Resolution order (first wins):
1. CLI flags
2. `.mcplintrc.json` user overrides
3. Preset from `extends`
4. Built-in defaults

### Builtin presets (`src/config/presets.ts`)

**`recommended`** — current default behavior (no changes to existing severity).

**`strict`** — all rules set to `error`, `maxDepth: 3`.

No external npm packages for presets in v0.2.0. External `mcp-lint-config-*` packages are v0.3.0.

---

## 6. File Structure Changes

```
src/
├── cli/commands/
│   ├── compat.ts        NEW
│   └── explain.ts       NEW
├── core/
│   └── compat-matrix.ts NEW
├── config/
│   └── presets.ts       NEW — builtin presets + extends resolution
└── rules/client-specific/
    ├── windsurf.ts      NEW
    ├── cline.ts         NEW
    ├── openai.ts        NEW
    └── continue.ts      NEW
```

---

## 7. Testing

### New client rules
Each new `client-specific/*.ts` gets a `tests/rules/client-specific/*.test.ts` with:
- 1 valid schema → 0 diagnostics
- 1 invalid schema → exact expected diagnostic
- 1 edge case

### `compat` command
- `tests/core/compat-matrix.test.ts` — unit tests for `buildCompatMatrix()`
- `tests/cli/compat.test.ts` — formatter snapshot tests (terminal, JSON, markdown)

### `explain` command
- `tests/cli/explain.test.ts` — rule with docs prints all sections; rule without docs prints fallback message

### Shareable configs
- `tests/config/presets.test.ts` — `strict` and `recommended` expand correctly; user overrides win over preset

---

## 8. Release Checklist

- [ ] All new rules implemented and tested
- [ ] `compat` command working with all 3 output formats
- [ ] `explain` command working for all rules
- [ ] `extends` in config working with `strict` and `recommended`
- [ ] `ClientId` updated everywhere (types, README, docs)
- [ ] `package.json` version bumped to `0.2.0`
- [ ] `CHANGELOG.md` updated with `## [0.2.0]` section
- [ ] `npm run test` passes
- [ ] `npm publish`
