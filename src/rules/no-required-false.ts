import type { Rule, MCPTool, RuleContext } from '../core/rule.js';
import type { Diagnostic } from '../core/diagnostic.js';
import { walkSchema } from '../utils/schema-walker.js';

export const noRequiredFalse: Rule = {
  id: 'no-required-false',
  severity: 'error',
  description: '`required: false` on a property is not valid JSON Schema. Properties are optional by default.',
  fixClass: 'safe',
  clients: ['claude', 'cursor', 'gemini', 'vscode'],
  docs: {
    why: 'JSON Schema uses the parent `required` array. `required: false` on a property is not a keyword, and strict clients reject the schema.',
    badExample: { properties: { query: { type: 'string', required: false } } },
    goodExample: { properties: { query: { type: 'string' } } },
    fixNote: 'Remove `required: false`. List the name in the parent `required` array only when the property is mandatory.',
  },

  check(tool: MCPTool, _context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    walkSchema(tool.inputSchema, (schema, path) => {
      if ((schema as Record<string, unknown>).required === false) {
        const diagnosticPath = path ? `inputSchema.${path}` : 'inputSchema';
        diagnostics.push({
          ruleId: 'no-required-false',
          severity: 'error',
          message: `Schema node at "${diagnosticPath}" has \`required: false\` which is not valid JSON Schema. Remove it — properties are optional by default unless listed in the parent's \`required\` array.`,
          toolName: tool.name,
          path: diagnosticPath,
          clients: ['claude', 'cursor', 'gemini', 'vscode'],
          fix: {
            class: 'safe',
            description: 'Remove `required: false` from the property',
            apply: (s) => {
              const copy = { ...s };
              delete copy['required'];
              return copy;
            },
          },
        });
      }
    });

    return diagnostics;
  },
};
