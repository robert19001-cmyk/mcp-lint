# MCP Lint for VS Code

Real-time linting for **MCP (Model Context Protocol)** server tool schemas. Catch cross-client compatibility issues as you type — before Claude, Cursor, Gemini, or OpenAI reject your tools.

## Features

- **Live diagnostics** — red squiggles on compatibility issues while you edit
- **Auto-detection** — works automatically on `tools.json`, `mcp-tools.json`, or any JSON file with a `tools` array
- **Code actions** — one-click auto-fixes for common issues
- **Hover docs** — explanations with good/bad examples for every rule
- **Compatibility matrix** — side-by-side view of tool support across all 8 clients
- **17 built-in rules** covering Claude, Cursor, Gemini, VS Code Copilot, Windsurf, Cline, OpenAI Agents SDK, and Continue.dev

## Supported Clients

Claude · Cursor · Gemini · VS Code Copilot · Windsurf · Cline · OpenAI Agents SDK · Continue.dev

## Commands

- **MCP Lint: Fix all auto-fixable issues in current file**
- **MCP Lint: Show compatibility matrix for current file**
- **MCP Lint: Toggle linting for current file**

## Settings

- `mcpLint.enabled` — enable/disable globally
- `mcpLint.clients` — which clients to check (default: all 8)
- `mcpLint.autoDetect` — auto-detect MCP files by content shape
- `mcpLint.filePatterns` — glob patterns for files to always lint

## Powered by

[mcp-lint](https://www.npmjs.com/package/mcp-lint) — the same engine available as a CLI and a GitHub Action.

## License

MIT
