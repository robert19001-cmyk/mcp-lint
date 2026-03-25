// Source: Gemini function calling documentation (2024)
import type { Rule, MCPTool, RuleContext, JSONSchema } from '../../core/rule.js';
import type { Diagnostic } from '../../core/diagnostic.js';

export const geminiNoOptionalWithoutDefault: Rule = {
  id: 'gemini/no-optional-without-default',
  severity: 'warning',
  description: 'Gemini handles optional parameters better when they have explicit default values.',
  clients: ['gemini'],

  check(tool: MCPTool, _context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const { properties, required } = tool.inputSchema;
    if (!properties) return diagnostics;

    const requiredSet = new Set(Array.isArray(required) ? required : []);

    for (const [propName, propSchema] of Object.entries(properties)) {
      if (!requiredSet.has(propName) && propSchema.default === undefined) {
        diagnostics.push({
          ruleId: 'gemini/no-optional-without-default',
          severity: 'warning',
          message: `Optional parameter "${propName}" in tool "${tool.name}" has no \`default\` value. Gemini handles optional params better with explicit defaults.`,
          toolName: tool.name,
          path: `inputSchema.properties.${propName}`,
          clients: ['gemini'],
        });
      }
    }

    return diagnostics;
  },
};

function getObjectDepth(schema: JSONSchema, depth = 0): number {
  if (!schema || typeof schema !== 'object') return depth;
  if (!schema.properties) return depth;

  let max = depth;
  for (const child of Object.values(schema.properties)) {
    if (child.type === 'object' || child.properties) {
      max = Math.max(max, getObjectDepth(child, depth + 1));
    }
  }
  return max;
}

export const geminiNoNestedObjects: Rule = {
  id: 'gemini/no-nested-objects',
  severity: 'warning',
  description: 'Gemini has limited support for object properties nested more than 2 levels deep.',
  clients: ['gemini'],

  check(tool: MCPTool, _context: RuleContext): Diagnostic[] {
    const depth = getObjectDepth(tool.inputSchema);
    if (depth > 2) {
      return [{
        ruleId: 'gemini/no-nested-objects',
        severity: 'warning',
        message: `Tool "${tool.name}" has object properties nested ${depth} level(s) deep. Gemini's function calling has limited support beyond 2 levels.`,
        toolName: tool.name,
        path: 'inputSchema',
        clients: ['gemini'],
      }];
    }
    return [];
  },
};
