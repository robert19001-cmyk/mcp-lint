import type { Rule, MCPTool, RuleContext } from '../core/rule.js';
import type { Diagnostic } from '../core/diagnostic.js';
import { walkSchema } from '../utils/schema-walker.js';

const UNSUPPORTED_FORMATS = new Set([
  'uri-reference', 'iri', 'iri-reference',
  'idn-email', 'idn-hostname',
  'json-pointer', 'relative-json-pointer',
  'regex',
]);

export const noUnsupportedFormats: Rule = {
  id: 'no-unsupported-formats',
  severity: 'warning',
  description: 'Some `format` values are not widely supported and may be rejected by strict clients.',
  clients: ['claude', 'cursor', 'gemini', 'vscode'],

  check(tool: MCPTool, _context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    walkSchema(tool.inputSchema, (schema, path) => {
      if (typeof schema.format === 'string' && UNSUPPORTED_FORMATS.has(schema.format)) {
        const diagnosticPath = path ? `inputSchema.${path}` : 'inputSchema';
        diagnostics.push({
          ruleId: 'no-unsupported-formats',
          severity: 'warning',
          message: `Format "${schema.format}" at "${diagnosticPath}" is not widely supported across MCP clients. Use a plain string without format validation.`,
          toolName: tool.name,
          path: diagnosticPath,
          clients: ['claude', 'cursor', 'gemini', 'vscode'],
          fix: {
            class: 'review',
            description: `Remove the \`format: "${schema.format}"\` field`,
            apply: (s) => {
              const copy = { ...s };
              delete copy['format'];
              return copy;
            },
          },
        });
      }
    });

    return diagnostics;
  },
};
