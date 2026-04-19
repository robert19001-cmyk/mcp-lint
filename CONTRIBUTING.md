# Contributing to mcp-lint

Thanks for your interest! mcp-lint is a small, focused project — the easiest way to help is to **report a broken MCP schema** or **request a new lint rule**.

## Quick ways to help

1. **Found a client quirk?** [Open a rule request](https://github.com/robert19001-cmyk/mcp-lint/issues/new?template=rule_request.md) with a minimal example of a schema that breaks in Claude/Cursor/Gemini/etc.
2. **Hit a false positive or a crash?** [Open a bug report](https://github.com/robert19001-cmyk/mcp-lint/issues/new?template=bug_report.md) with the exact input and output.
3. **Want a new preflight risk pattern?** [Open a policy rule request](https://github.com/robert19001-cmyk/mcp-lint/issues/new?template=policy_rule_request.md).

## Local development

Requires Node.js ≥20.

```bash
git clone https://github.com/robert19001-cmyk/mcp-lint.git
cd mcp-lint
npm install
npm test          # 277 tests
npm run build     # compile to dist/
node dist/index.js check demo/tools.json
```

## Adding a lint rule

1. Create `src/rules/<client>/<rule-id>.ts` following the existing rule pattern.
2. Export it from `src/rules/index.ts`.
3. Add a test in `tests/rules/<client>/<rule-id>.test.ts` with at least one bad and one good fixture.
4. Document it in `README.md` under the Rules section.
5. Add an entry to `CHANGELOG.md` under the upcoming release.

Each rule must include:
- `id` (e.g. `cursor/no-enum-with-default`)
- `description`
- `severity` (`error` / `warning` / `info`)
- `clients` (which clients this affects)
- `docs.why`, `docs.badExample`, `docs.goodExample` (used by `mcp-lint explain`)
- optional `fix` function for auto-fixing

## Adding a preflight risk pattern

Preflight rules are **deterministic** — no LLM. Add patterns to:
- `src/preflight/scorer.ts` for risk heuristics
- `src/preflight/policy.ts` for policy matchers

Every addition needs a test in `tests/preflight/`.

## Code style

- TypeScript strict mode
- Small, pure functions
- No commented-out code, no TODOs
- Descriptive names in English
- Run `npm test` before committing

## Commit messages

Conventional commits:
- `feat:` new feature or rule
- `fix:` bug fix
- `docs:` documentation only
- `chore:` tooling, deps, release
- `test:` tests only
- `refactor:` code cleanup

## Releasing (maintainers only)

1. Bump version in `package.json`
2. Update `CHANGELOG.md`
3. `git tag vX.Y.Z && git push origin vX.Y.Z`
4. `gh release create vX.Y.Z --notes-file ...`
5. `npm publish`
