import * as vscode from 'vscode';
import { LintEngine } from 'mcp-lint';
import { allRules } from 'mcp-lint/dist/rules/index.js';
import type { MCPTool, ClientId } from 'mcp-lint/dist/core/rule.js';
import type { Diagnostic as MCPDiagnostic } from 'mcp-lint/dist/core/diagnostic.js';
import {
  parseToolsDocument,
  findToolNode,
  resolvePath,
  nodeToRange,
} from './pathMapper.js';

export interface LintResult {
  diagnostics: vscode.Diagnostic[];
  rawDiagnostics: Map<string, MCPDiagnostic>;
  toolCount: number;
}

export function lintDocument(document: vscode.TextDocument): LintResult {
  const text = document.getText();
  const { toolsNode, tools } = parseToolsDocument(text);

  if (!toolsNode || tools.length === 0) {
    return { diagnostics: [], rawDiagnostics: new Map(), toolCount: 0 };
  }

  const config = vscode.workspace.getConfiguration('mcpLint');
  const clients = config.get<string[]>('clients') ?? [];

  const engine = new LintEngine(allRules, { clients: clients as ClientId[] });
  const mcpDiagnostics = engine.lint(tools as unknown as MCPTool[]);

  const diagnostics: vscode.Diagnostic[] = [];
  const rawDiagnostics = new Map<string, MCPDiagnostic>();

  for (const diag of mcpDiagnostics) {
    const toolNode = findToolNode(toolsNode, diag.toolName);
    if (!toolNode) continue;

    const targetNode = resolvePath(toolNode, diag.path) ?? toolNode;
    const range = nodeToRange(document, targetNode);

    const vsDiag = new vscode.Diagnostic(
      range,
      `${diag.message} [${diag.ruleId}]`,
      mapSeverity(diag.severity),
    );
    vsDiag.source = 'mcp-lint';
    vsDiag.code = {
      value: diag.ruleId,
      target: vscode.Uri.parse(`command:mcpLint.explainRule?${encodeURIComponent(JSON.stringify([diag.ruleId]))}`),
    };

    const key = diagKey(diag, range);
    rawDiagnostics.set(key, diag);
    diagnostics.push(vsDiag);
  }

  return { diagnostics, rawDiagnostics, toolCount: tools.length };
}

function mapSeverity(sev: string): vscode.DiagnosticSeverity {
  switch (sev) {
    case 'error': return vscode.DiagnosticSeverity.Error;
    case 'warning': return vscode.DiagnosticSeverity.Warning;
    case 'info': return vscode.DiagnosticSeverity.Information;
    default: return vscode.DiagnosticSeverity.Hint;
  }
}

export function diagKey(diag: MCPDiagnostic, range: vscode.Range): string {
  return `${diag.ruleId}::${diag.toolName}::${diag.path}::${range.start.line}:${range.start.character}`;
}
