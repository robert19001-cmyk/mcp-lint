# Roadmap

This file records the path from published 0.9.0 to 1.0.0. The repository version is 1.0.0. npm `latest` is 1.0.0 after this release is published. Nothing here is scheduled as a date.

## Shipped in 1.0.0

1. **Audit report model.** One versioned `MCPAuditReport`. Sections that did not run stay `not_run`.
2. **Token budget.** Local `chars / 4` estimate, labeled as an estimate, with configurable warn and over thresholds.
3. **Report formatters.** `mcp-lint report` writes terminal, JSON, Markdown, SARIF 2.1.0, and offline HTML. `check --format json` stays the diagnostic array.
4. **Quality score 2.0.** `quality-v2` in `computeQualityReport`. There is still one scorer.
5. **Compatibility evidence.** The eight clients stay. Each compat cell is `measured` or `not_observed`. Zed and OpenCode stay off the matrix.
6. **Fix classes.** Fixes are `safe`, `review`, or `manual`. Only `safe` fixes are written.
7. **Inspector gaps.** `outputSchema`, cross-server names, Claude Code `projects.<path>.mcpServers`, and one directory level of tool-file discovery are in. Windsurf and Cline config paths are not scanned. No captured failing schema is in this repository, so those paths stay out.
8. **Live inspection.** `mcp-lint catalog` calls `resources/list` and `prompts/list` through the SDK. It has a timeout and size limits. It never calls a tool.
9. **Recovery and preflight.** Unknown `tool_type` fails closed with `deny`. Each recovery sample is `transient` or `permanent`. A live probe lists tools and does not call them unless both `--sandbox` and `--invoke` are set. The score stays a heuristic.
10. **Regression guard.** `report --baseline` diffs a stable audit snapshot. CI fails when `tests/fixtures/audit/minimal-tool.baseline.json` differs. `--update-baseline` is the only writer.
11. **GitHub Action.** Findings become `::error`, `::warning`, and `::notice` annotations. `sarif: true` uploads SARIF when the installed CLI has `report`. The action still installs `mcp-lint@latest`.
12. **Site.** One page in `site/`. It runs recover, check, and preflight in the browser and does not post schemas to an API.
13. **1.0 gate.** Full test, typecheck, build, packed-install smoke, formatter tests, and this doc review.

## Still out

Windsurf and Cline installed-config scans, until a captured failing schema shows the path. Zed and OpenCode rules, on the same condition.

Hosted accounts, team dashboards, telemetry, a paid limit on check or recover, an LLM reviewer, the VS Code Marketplace extension, and a published Docker image stay out of this repository.
