# Roadmap

This is the path from published 0.8.0 to a 1.0 MCP developer toolkit. It is not a claim that these commands already exist. Nothing here is scheduled as a date.

Work lands in small releases. Each one keeps the current CLI, SDK, and MCP server behavior, adds tests, and updates `CHANGELOG.md`. Publishing a version still needs an explicit decision from the maintainer. See `RELEASE.md`.

## Already shipped

Schema lint, eight client rule groups, fix with `--dry-run`, compat, explain, init, preflight, recover, snapshot, diff, `--installed` / `--from`, directory discovery, GitHub Action, proof page, and the MCP server.

## Next, in order

1. **Audit report model.** One versioned `MCPAuditReport` for later terminal, JSON, Markdown, SARIF, and HTML formatters. Sections that did not run stay `not_run`. The v1 quality function is not replaced.
2. **Token budget.** Local `chars / 4` estimate, labeled as an estimate, with configurable warn and over thresholds. Rank tools, flag repeated descriptions, and compare two budgets. No tokenizer dependency until one is justified.
3. **Report formatters.** Done as `mcp-lint report`: terminal, JSON, Markdown, SARIF 2.1.0, and offline HTML. HTML escapes text and ships no script. `check --format json` stays the diagnostic array. Uploading SARIF from the GitHub Action is still later.
4. **Quality score 2.0.** Extend `computeQualityReport` with named weights, coverage, and confidence. Do not add a second scorer. Missing data does not add points.
5. **Compatibility evidence.** Keep the eight clients. New client rules need a captured failing schema and a source. Zed and OpenCode stay off the matrix until that evidence exists. Profiles select existing client ids. They do not invent support.
6. **Fix classes.** Mark fixes `safe`, `review`, or `manual`. Keep `--dry-run`. Do not invent `readOnlyHint` or `destructiveHint` from a name, and do not invent descriptions.
7. **Inspector gaps that are already visible.** `outputSchema` uses the same schema walker, and the same tool name on two installed servers is `tool-name/server-collision`. Still open: read the Claude Code `projects` map in `~/.claude.json`, discover one extra directory level for monorepos, and confirm Windsurf and Cline config paths before scanning them.
8. **Live inspection.** `resources/list` and `prompts/list` only through the existing SDK, behind an explicit flag, with timeout and size limits. Never call a tool to discover it.
9. **Recovery and preflight.** Classify transient and permanent failures. Keep probes free of side effects unless a sandbox and a flag both say otherwise. Unknown critical preflight input fails closed. Say in the output that the score is a heuristic.
10. **Regression guard.** Snapshot the audit report, diff breaking changes, and let CI fail on a baseline. Updating the baseline is an explicit flag.
11. **GitHub Action.** Annotate pull requests from the existing findings. Upload SARIF only after the SARIF formatter exists. Keep `npm install -g mcp-lint@latest` so CI tracks the published release.
12. **Site.** Extend `site/`. Do not add a second site. Playground stays in the browser and does not post schemas to an API.
13. **1.0 gate.** Full test, typecheck, build, packed-install smoke, formatter tests, and doc review. No release until the maintainer asks.

## Explicitly out of this repository for now

Hosted accounts, team dashboards, telemetry, a paid limit on check or recover, an LLM reviewer, the VS Code Marketplace extension, and a published Docker image.
