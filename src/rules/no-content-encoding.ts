import type { Rule, MCPTool, RuleContext } from '../core/rule.js';
import type { Diagnostic } from '../core/diagnostic.js';
import { walkSchema } from '../utils/schema-walker.js';

export const noContentEncoding: Rule = {
  id: 'no-content-encoding',
  severity: 'error',
  description: '`contentEncoding` is not part of the JSON Schema subset used by MCP clients.',
  fixClass: 'safe',
  clients: ['claude', 'cursor', 'gemini', 'vscode'],
  docs: {
    why: 'MCP clients do not accept `contentEncoding`. A strict validator fails the whole tool schema.',
    badExample: { properties: { body: { type: 'string', contentEncoding: 'base64' } } },
    goodExample: { properties: { body: { type: 'string', description: 'Base64-encoded body.' } } },
    fixNote: 'Remove `contentEncoding` and say the encoding in the description.',
  },

  check(tool: MCPTool, _context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    walkSchema(tool.inputSchema, (schema, path) => {
      if ('contentEncoding' in schema) {
        const diagnosticPath = path ? `inputSchema.${path}` : 'inputSchema';
        diagnostics.push({
          ruleId: 'no-content-encoding',
          severity: 'error',
          message: `"contentEncoding" at "${diagnosticPath}" is not supported by MCP clients and causes parse failures in strict validators.`,
          toolName: tool.name,
          path: diagnosticPath,
          clients: ['claude', 'cursor', 'gemini', 'vscode'],
          fix: {
            class: 'safe',
            description: 'Remove `contentEncoding` field',
            apply: (s) => {
              const copy = { ...s };
              delete copy['contentEncoding'];
              return copy;
            },
          },
        });
      }
    });

    return diagnostics;
  },
};
