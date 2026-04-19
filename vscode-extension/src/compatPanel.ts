import * as vscode from 'vscode';
import { LintEngine } from 'mcp-lint';
import { allRules } from 'mcp-lint/dist/rules/index.js';
import { buildCompatMatrix } from 'mcp-lint/dist/core/compat-matrix.js';
import type { MCPTool, ClientId } from 'mcp-lint/dist/core/rule.js';
import { parseToolsDocument } from './pathMapper.js';

export function showCompatPanel(document: vscode.TextDocument): void {
  const { tools } = parseToolsDocument(document.getText());
  if (tools.length === 0) {
    vscode.window.showWarningMessage('No MCP tools detected in this file.');
    return;
  }

  const config = vscode.workspace.getConfiguration('mcpLint');
  const clients = (config.get<string[]>('clients') ?? []) as ClientId[];

  const engine = new LintEngine(allRules, { clients });
  const diagnostics = engine.lint(tools as unknown as MCPTool[]);
  const matrix = buildCompatMatrix(tools as unknown as MCPTool[], diagnostics);

  const panel = vscode.window.createWebviewPanel(
    'mcpLintCompat',
    'MCP Compatibility Matrix',
    vscode.ViewColumn.Beside,
    { enableScripts: false },
  );

  panel.webview.html = renderMatrixHtml(matrix);
}

function renderMatrixHtml(matrix: { tools: string[]; clients: string[]; cells: Record<string, Record<string, { compatible: boolean; errorCount: number }>> }): string {
  const rows = matrix.tools.map((tool) => {
    const cols = matrix.clients.map((c) => {
      const cell = matrix.cells[tool][c];
      return `<td class="${cell.compatible ? 'ok' : 'fail'}" title="${cell.errorCount} errors">${cell.compatible ? '✓' : '✗'}</td>`;
    });
    return `<tr><td class="tool">${escapeHtml(tool)}</td>${cols.join('')}</tr>`;
  });

  const headers = matrix.clients.map((c) => `<th>${escapeHtml(c)}</th>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-foreground); }
  table { border-collapse: collapse; width: 100%; }
  th, td { padding: 8px 12px; text-align: center; border: 1px solid var(--vscode-panel-border); }
  th { background: var(--vscode-editor-background); font-weight: 600; }
  td.tool { text-align: left; font-family: var(--vscode-editor-font-family); }
  td.ok { color: #4caf50; font-size: 18px; }
  td.fail { color: #f44336; font-size: 18px; }
  h1 { font-size: 16px; font-weight: 600; }
</style>
</head>
<body>
<h1>MCP Compatibility Matrix</h1>
<table>
  <thead><tr><th>Tool</th>${headers}</tr></thead>
  <tbody>${rows.join('')}</tbody>
</table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return c;
    }
  });
}
