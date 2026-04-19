import * as vscode from 'vscode';
import { allRules } from 'mcp-lint/dist/rules/index.js';

export class McpLintHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Hover | undefined {
    const diagnostics = vscode.languages
      .getDiagnostics(document.uri)
      .filter((d) => d.source === 'mcp-lint' && d.range.contains(position));

    if (diagnostics.length === 0) return undefined;

    const markdown = new vscode.MarkdownString();
    markdown.isTrusted = true;
    markdown.supportHtml = false;

    for (const diag of diagnostics) {
      const ruleId = typeof diag.code === 'object' ? String(diag.code.value) : String(diag.code ?? '');
      const rule = allRules.find((r) => r.id === ruleId);
      if (!rule) continue;

      markdown.appendMarkdown(`**${rule.id}** — ${severityEmoji(diag.severity)} ${rule.severity}\n\n`);
      markdown.appendMarkdown(`${rule.description}\n\n`);
      markdown.appendMarkdown(`**Clients:** ${rule.clients.join(', ')}\n\n`);

      if (rule.docs?.why) {
        markdown.appendMarkdown(`**Why:** ${rule.docs.why}\n\n`);
      }
      if (rule.docs?.goodExample) {
        markdown.appendMarkdown(`**Good example:**\n\n\`\`\`json\n${JSON.stringify(rule.docs.goodExample, null, 2)}\n\`\`\`\n\n`);
      }
      if (rule.docs?.fixNote) {
        markdown.appendMarkdown(`**Fix:** ${rule.docs.fixNote}\n\n`);
      }
      markdown.appendMarkdown('---\n');
    }

    return new vscode.Hover(markdown);
  }
}

function severityEmoji(sev: vscode.DiagnosticSeverity): string {
  switch (sev) {
    case vscode.DiagnosticSeverity.Error: return '🔴';
    case vscode.DiagnosticSeverity.Warning: return '🟡';
    case vscode.DiagnosticSeverity.Information: return '🔵';
    default: return '⚪';
  }
}
