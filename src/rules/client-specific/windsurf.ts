// Source: Windsurf MCP tool-use observed behavior (2025)
import type { Rule, MCPTool, RuleContext } from '../../core/rule.js';
import type { Diagnostic } from '../../core/diagnostic.js';
import { walkSchema } from '../../utils/schema-walker.js';

export const windsurfNoUnionTypes: Rule = {
  id: 'windsurf/no-union-types',
  severity: 'warning',
  description: 'Windsurf does not support `anyOf` with more than 2 variants.',
  clients: ['windsurf'],
  docs: {
    why: 'Windsurf\'s MCP client has limited support for complex union types. `anyOf` with more than 2 variants may be silently ignored or cause unexpected behavior.',
    badExample: {
      properties: {
        value: { anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }] },
      },
    },
    goodExample: {
      properties: {
        value: { anyOf: [{ type: 'string' }, { type: 'null' }] },
      },
    },
    fixNote: 'Reduce anyOf to at most 2 variants, or replace with a single type.',
  },

  check(tool: MCPTool, _context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    walkSchema(tool.inputSchema, (schema, path) => {
      if (Array.isArray(schema.anyOf) && schema.anyOf.length > 2) {
        const diagnosticPath = path ? `inputSchema.${path}` : 'inputSchema';
        diagnostics.push({
          ruleId: 'windsurf/no-union-types',
          severity: 'warning',
          message: `Schema at "${diagnosticPath}" uses \`anyOf\` with ${schema.anyOf.length} variants. Windsurf supports at most 2.`,
          toolName: tool.name,
          path: diagnosticPath,
          clients: ['windsurf'],
        });
      }
    });

    return diagnostics;
  },
};
