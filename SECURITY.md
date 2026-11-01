# Security Policy

## Supported versions

Only the latest published minor receives security updates.

| Version | Supported |
|---------|-----------|
| 0.8.x   | yes |
| older   | no |

## Local use

mcp-lint does not send telemetry. File and directory lints stay on the machine. A live server is contacted only when the command line asks for `--server`, `--installed`, `--from`, or `--remote`. Discovery calls `tools/list`. It does not call the server's tools. Token totals in an audit report are a local character estimate, not a measurement from a tokenizer service. A preflight score is a heuristic. It is not proof that an action is safe.

## Reporting a vulnerability

If you discover a security issue in mcp-lint — particularly in the `preflight` policy engine, audit log, or anywhere a crafted input could bypass a rule — please **do not open a public issue**.

Email: **robert19001@gmail.com** with:

- a description of the issue
- a minimal reproduction (action object + policy YAML that demonstrates the bypass)
- impact assessment (what an attacker/agent could do)

I will respond within 72 hours and coordinate a fix + disclosure timeline with you.

## Scope

In scope:
- **Preflight decision bypass** — crafted action/policy producing `allow` when it should `deny`
- **Policy parser crashes** — malformed YAML causing unhandled exceptions
- **Path traversal** in policy/action file paths
- **Risk scoring manipulation** — inputs causing scorer to drastically under-rate destructive actions

Out of scope:
- DoS via pathological regex in user-supplied schemas (use your own rate limits)
- Missing rules for quirks not yet documented — these are feature requests, not vulnerabilities
