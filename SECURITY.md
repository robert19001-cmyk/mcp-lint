# Security Policy

## Supported versions

Only the latest minor version receives security updates.

| Version | Supported |
|---------|-----------|
| 0.4.x   | ✅ |
| < 0.4   | ❌ |

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
