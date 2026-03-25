// Source: Claude tool-use documentation + observed behavior (2024)
import type { Rule, MCPTool, RuleContext } from '../../core/rule.js';
import type { Diagnostic } from '../../core/diagnostic.js';
import { walkSchema } from '../../utils/schema-walker.js';

export const claudeNoTypeArray: Rule = {
  id: 'claude/no-type-array',
  severity: 'warning',
  description: 'Claude may not handle array syntax for `type` (e.g. `["string", "null"]`) correctly.',
  clients: ['claude'],

  check(tool: MCPTool, _context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    walkSchema(tool.inputSchema, (schema, path) => {
      if (Array.isArray(schema.type)) {
        const diagnosticPath = path ? `inputSchema.${path}` : 'inputSchema';
        const primaryType = (schema.type as string[]).find((t) => t !== 'null') ?? schema.type[0];
        diagnostics.push({
          ruleId: 'claude/no-type-array',
          severity: 'warning',
          message: `Array type syntax \`"type": ${JSON.stringify(schema.type)}\` at "${diagnosticPath}" may not be handled correctly by Claude. Use a single type string.`,
          toolName: tool.name,
          path: diagnosticPath,
          clients: ['claude'],
          fix: {
            description: `Convert to single type "${primaryType}"`,
            apply: (s) => ({ ...s, type: primaryType }),
          },
        });
      }
    });

    return diagnostics;
  },
};
