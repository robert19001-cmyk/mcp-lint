# Roadmap

This is the path from published 0.8.0 to a 1.0 MCP developer toolkit. The repository version is 0.9.0. npm `latest` is still 0.8.0 until 0.9.0 is published. Nothing here is scheduled as a date.

Work lands in small releases. Each one keeps the current CLI, SDK, and MCP server behavior, adds tests, and updates `CHANGELOG.md`. Publishing a version still needs an explicit decision from the maintainer. See `RELEASE.md`.

## Already shipped

Schema lint, eight client rule groups, fix with `--dry-run`, compat, explain, init, preflight, recover, snapshot, diff, `--installed` / `--from`, directory discovery, GitHub Action, proof page, and the MCP server.

## Next, in order

1. **Audit report model.** One versioned `MCPAuditReport` for later terminal, JSON, Markdown, SARIF, and HTML formatters. Sections that did not run stay `not_run`. The v1 quality function is not replaced.
2. **Token budget.** Local `chars / 4` estimate, labeled as an estimate, with configurable warn and over thresholds. Rank tools, flag repeated descriptions, and compare two budgets. No tokenizer dependency until one is justified.
3. **Report formatters.** Done as `mcp-lint report`: terminal, JSON, Markdown, SARIF 2.1.0, and offline HTML. HTML escapes text and ships no script. `check --format json` stays the diagnostic array. Uploading SARIF from the GitHub Action is still later.
4. **Quality score 2.0.** Done in `computeQualityReport` as `quality-v2`: named weights, coverage, and confidence. Missing description or schema fields add no points. There is still one scorer.
5. **Compatibility evidence.** The eight clients stay. Each compat cell is `measured` when a diagnostic fired and `not_observed` otherwise. A check mark is not proof of client support. Zed and OpenCode stay off the matrix until a captured failing schema exists.
6. **Fix classes.** Fixes are `safe`, `review`, or `manual`. Only `safe` fixes are written. `--dry-run` lists every class. Titles and hints are not invented.
7. **Inspector gaps that are already visible.** `outputSchema`, cross-server names, Claude Code `projects.<path>.mcpServers`, and one directory level of tool-file discovery are in. Still open: confirm Windsurf and Cline config paths before scanning them.
8. **Live inspection.** `resources/list` and `prompts/list` only through the existing SDK, behind an explicit flag, with timeout and size limits. Never call a tool to discover it.
9. **Recovery and preflight.** Unknown `tool_type` now fails closed with `deny`. Still open: classify transient and permanent recovery failures, and keep probes free of side effects unless a sandbox and a flag both say otherwise. The score stays a heuristic.
10. **Regression guard.** Snapshot the audit report, diff breaking changes, and let CI fail on a baseline. Updating the baseline is an explicit flag.
11. **GitHub Action.** Findings become `::error`, `::warning`, and `::notice` annotations. `sarif: true` uploads SARIF when the installed CLI has `report`, and warns when it does not. The action still installs `mcp-lint@latest`.
12. **Site.** Extend `site/`. Do not add a second site. Playground stays in the browser and does not post schemas to an API.
13. **1.0 gate.** Full test, typecheck, build, packed-install smoke, formatter tests, and doc review. No release until the maintainer asks.

## Explicitly out of this repository for now

Hosted accounts, team dashboards, telemetry, a paid limit on check or recover, an LLM reviewer, the VS Code Marketplace extension, and a published Docker image.
