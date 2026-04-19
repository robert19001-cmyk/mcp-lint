// Source: Windsurf MCP tool-use observed behavior (2025)
import type { Rule, MCPTool, RuleContext } from '../../core/rule.js';
import type { Diagnostic } from '../../core/diagnostic.js';
import { walkSchema } from '../../utils/schema-walker.js';

export const windsurfNoUnionTypes: Rule = {
  id: 'windsurf/no-union-types',
  severity: 'warning',
  description: 'Windsurf does not support `anyOf` with more than 2 variants.',
  clients: ['windsurf'],

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
