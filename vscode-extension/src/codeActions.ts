import * as vscode from 'vscode';
import { applyFixes } from 'mcp-lint/dist/core/fixer.js';
import type { MCPTool } from 'mcp-lint/dist/core/rule.js';
import type { Diagnostic as MCPDiagnostic } from 'mcp-lint/dist/core/diagnostic.js';
import { parseToolsDocument } from './pathMapper.js';
import { lintDocument, diagKey } from './linter.js';

export class McpLintCodeActionProvider implements vscode.CodeActionProvider {
  static readonly providedKinds = [vscode.CodeActionKind.QuickFix];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    const mcpDiagnostics = context.diagnostics.filter((d) => d.source === 'mcp-lint');
    if (mcpDiagnostics.length === 0) return [];

    const { rawDiagnostics } = lintDocument(document);
    const actions: vscode.CodeAction[] = [];

    for (const vsDiag of mcpDiagnostics) {
      const key = diagKey(
        { ruleId: typeof vsDiag.code === 'object' ? String(vsDiag.code.value) : String(vsDiag.code ?? '') } as MCPDiagnostic,
        vsDiag.range,
      );
      // Try to find raw diagnostic by ruleId + range
      const raw = findRawDiagnostic(rawDiagnostics, vsDiag);
      if (!raw?.fix) continue;

      const action = new vscode.CodeAction(
        `Fix: ${raw.fix.description}`,
        vscode.CodeActionKind.QuickFix,
      );
      action.diagnostics = [vsDiag];
      action.isPreferred = true;
      action.edit = buildFixEdit(document, raw);
      if (action.edit) actions.push(action);
    }

    if (actions.length > 0) {
      const fixAllAction = new vscode.CodeAction(
        'Fix all MCP Lint auto-fixable issues',
        vscode.CodeActionKind.QuickFix,
      );
      fixAllAction.command = {
        command: 'mcpLint.fixAll',
        title: 'Fix all',
      };
      actions.push(fixAllAction);
    }

    return actions;
  }
}

function findRawDiagnostic(
  rawDiagnostics: Map<string, MCPDiagnostic>,
  vsDiag: vscode.Diagnostic,
): MCPDiagnostic | undefined {
  const ruleId = typeof vsDiag.code === 'object' ? String(vsDiag.code.value) : String(vsDiag.code ?? '');
  for (const raw of rawDiagnostics.values()) {
    if (raw.ruleId !== ruleId) continue;
    return raw;
  }
  return undefined;
}

function buildFixEdit(
  document: vscode.TextDocument,
  diag: MCPDiagnostic,
): vscode.WorkspaceEdit | undefined {
  const text = document.getText();
  const { rootNode, tools } = parseToolsDocument(text);
  if (!rootNode || tools.length === 0) return undefined;

  const fixed = applyFixes(tools as unknown as MCPTool[], [diag]);
  const wasArray = rootNode.type === 'array';
  const wasWrapped = rootNode.type === 'object' && tools.length > 0 && !isSingleTool(text);

  let newText: string;
  if (wasArray) {
    newText = JSON.stringify(fixed, null, 2);
  } else if (wasWrapped) {
    newText = JSON.stringify({ tools: fixed }, null, 2);
  } else {
    newText = JSON.stringify(fixed[0], null, 2);
  }

  const edit = new vscode.WorkspaceEdit();
  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(text.length),
  );
  edit.replace(document.uri, fullRange, newText);
  return edit;
}

function isSingleTool(text: string): boolean {
  try {
    const parsed = JSON.parse(text);
    return !Array.isArray(parsed) && !Array.isArray(parsed.tools) && 'inputSchema' in parsed;
  } catch {
    return false;
  }
}

export function applyFixAll(document: vscode.TextDocument): vscode.WorkspaceEdit | undefined {
  const text = document.getText();
  const { rootNode, tools } = parseToolsDocument(text);
  if (!rootNode || tools.length === 0) return undefined;

  const { rawDiagnostics } = lintDocument(document);
  const fixable = Array.from(rawDiagnostics.values()).filter((d) => d.fix != null);
  if (fixable.length === 0) return undefined;

  const fixed = applyFixes(tools as unknown as MCPTool[], fixable);

  let newText: string;
  if (rootNode.type === 'array') {
    newText = JSON.stringify(fixed, null, 2);
  } else if (isSingleTool(text)) {
    newText = JSON.stringify(fixed[0], null, 2);
  } else {
    newText = JSON.stringify({ tools: fixed }, null, 2);
  }

  const edit = new vscode.WorkspaceEdit();
  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(text.length),
  );
  edit.replace(document.uri, fullRange, newText);
  return edit;
}
