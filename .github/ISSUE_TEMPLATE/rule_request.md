---
name: New rule request
about: Suggest a new lint rule for an MCP client quirk
title: "[Rule] "
labels: rule-request
---

**Client affected**
<!-- claude / cursor / gemini / vscode / windsurf / cline / openai / continue -->

**What breaks in that client**
<!-- describe the quirk — what schema shape fails, silently ignores something, or misbehaves -->

**Example bad schema**
```json
{
  "inputSchema": { ... }
}
```

**Example fixed schema**
```json
{
  "inputSchema": { ... }
}
```

**Source / evidence**
<!-- link to client docs, GitHub issue, blog post, etc. that confirms the behavior -->

**Suggested rule id**
<!-- e.g. cursor/no-enum-with-default -->

**Auto-fixable?**
<!-- can the tool transform bad → good automatically? -->
