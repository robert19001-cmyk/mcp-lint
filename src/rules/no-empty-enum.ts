import type { Rule, MCPTool, RuleContext } from '../core/rule.js';
import type { Diagnostic } from '../core/diagnostic.js';
import { walkSchema } from '../utils/schema-walker.js';

export const noEmptyEnum: Rule = {
  id: 'no-empty-enum',
  severity: 'error',
  description: 'An empty `enum` array makes the parameter impossible to satisfy.',
  fixClass: 'review',
  clients: ['claude', 'cursor', 'gemini', 'vscode'],

  check(tool: MCPTool, _context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    walkSchema(tool.inputSchema, (schema, path) => {
      if (Array.isArray(schema.enum) && schema.enum.length === 0) {
        const diagnosticPath = path ? `inputSchema.${path}` : 'inputSchema';
        diagnostics.push({
          ruleId: 'no-empty-enum',
          severity: 'error',
          message: `Empty \`enum: []\` at "${diagnosticPath}" makes the parameter impossible to satisfy. This is likely a bug.`,
          toolName: tool.name,
          path: diagnosticPath,
          clients: ['claude', 'cursor', 'gemini', 'vscode'],
          fix: {
            class: 'review',
            description: 'Remove the `enum` field',
            apply: (s) => {
              const copy = { ...s };
              delete copy['enum'];
              return copy;
            },
          },
        });
      }
    });

    return diagnostics;
  },
};
