// Source: VS Code Copilot MCP extension observed behavior (2024)
import type { Rule, MCPTool, RuleContext } from '../../core/rule.js';
import type { Diagnostic } from '../../core/diagnostic.js';

const MAX_PARAMS = 15;

export const vscodeMaxParams: Rule = {
  id: 'vscode/max-params',
  severity: 'warning',
  description: `VS Code Copilot performance degrades with more than ${MAX_PARAMS} parameters.`,
  clients: ['vscode'],

  check(tool: MCPTool, _context: RuleContext): Diagnostic[] {
    const count = Object.keys(tool.inputSchema.properties ?? {}).length;
    if (count > MAX_PARAMS) {
      return [{
        ruleId: 'vscode/max-params',
        severity: 'warning',
        message: `Tool "${tool.name}" has ${count} parameters. VS Code Copilot performance degrades with more than ${MAX_PARAMS}. Consider splitting into multiple tools.`,
        toolName: tool.name,
        path: 'inputSchema.properties',
        clients: ['vscode'],
      }];
    }
    return [];
  },
};
