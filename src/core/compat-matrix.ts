import type { ClientId, MCPTool } from './rule.js';
import type { Diagnostic } from './diagnostic.js';

export interface CompatCell {
  compatible: boolean;
  errorCount: number;
  issues: Diagnostic[];
}

export interface CompatMatrix {
  tools: string[];
  clients: ClientId[];
  cells: Record<string, Record<ClientId, CompatCell>>;
}

const ALL_CLIENTS: ClientId[] = [
  'claude', 'cursor', 'gemini', 'vscode',
  'windsurf', 'cline', 'openai', 'continue',
];

export function buildCompatMatrix(tools: MCPTool[], diagnostics: Diagnostic[]): CompatMatrix {
  const cells: Record<string, Record<ClientId, CompatCell>> = {};

  for (const tool of tools) {
    cells[tool.name] = {} as Record<ClientId, CompatCell>;
    for (const client of ALL_CLIENTS) {
      cells[tool.name][client] = { compatible: true, errorCount: 0, issues: [] };
    }
  }

  for (const diag of diagnostics) {
    for (const client of diag.clients) {
      const cell = cells[diag.toolName]?.[client];
      if (!cell) continue;
      cell.issues.push(diag);
      if (diag.severity === 'error') {
        cell.errorCount++;
        cell.compatible = false;
      }
    }
  }

  return {
    tools: tools.map((t) => t.name),
    clients: ALL_CLIENTS,
    cells,
  };
}
