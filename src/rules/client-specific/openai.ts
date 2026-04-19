// Source: OpenAI Agents SDK function calling documentation (2025)
import type { Rule, MCPTool, RuleContext } from '../../core/rule.js';
import type { Diagnostic } from '../../core/diagnostic.js';
import { walkSchema } from '../../utils/schema-walker.js';

const ALLOWED_TYPES = new Set(['string', 'number', 'boolean', 'object', 'array', 'null']);

export const openaiNoAdditionalProperties: Rule = {
  id: 'openai/no-additional-properties',
  severity: 'error',
  description: 'OpenAI Agents SDK strict mode requires `additionalProperties: false` on the root inputSchema.',
  clients: ['openai'],
  docs: {
    why: 'OpenAI\'s strict function calling mode rejects schemas that don\'t explicitly set `additionalProperties: false` at the root level.',
    badExample: { type: 'object', properties: { q: { type: 'string' } } },
    goodExample: { type: 'object', properties: { q: { type: 'string' } }, additionalProperties: false },
    fixNote: 'Add `"additionalProperties": false` to the root inputSchema.',
  },

  check(tool: MCPTool, _context: RuleContext): Diagnostic[] {
    if (tool.inputSchema.additionalProperties === false) return [];

    return [{
      ruleId: 'openai/no-additional-properties',
      severity: 'error',
      message: `Tool "${tool.name}" is missing \`additionalProperties: false\` on inputSchema. Required for OpenAI Agents SDK strict mode.`,
      toolName: tool.name,
      path: 'inputSchema',
      clients: ['openai'],
      fix: {
        description: 'Add `additionalProperties: false` to inputSchema',
        apply: (s) => ({ ...s, additionalProperties: false }),
      },
    }];
  },
};

export const openaiStrictTypes: Rule = {
  id: 'openai/strict-types',
  severity: 'error',
  description: 'OpenAI Agents SDK only allows string, number, boolean, object, array, null types.',
  clients: ['openai'],
  docs: {
    why: 'OpenAI\'s function calling schema validation rejects non-standard types like `integer`. Use `number` instead.',
    badExample: { properties: { count: { type: 'integer' } } },
    goodExample: { properties: { count: { type: 'number' } } },
  },

  check(tool: MCPTool, _context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    walkSchema(tool.inputSchema, (schema, path) => {
      if (typeof schema.type === 'string' && !ALLOWED_TYPES.has(schema.type)) {
        const diagnosticPath = path ? `inputSchema.${path}` : 'inputSchema';
        diagnostics.push({
          ruleId: 'openai/strict-types',
          severity: 'error',
          message: `Schema at "${diagnosticPath}" uses type "${schema.type}" which is not allowed by OpenAI Agents SDK. Use one of: ${[...ALLOWED_TYPES].join(', ')}.`,
          toolName: tool.name,
          path: diagnosticPath,
          clients: ['openai'],
        });
      }
    });

    return diagnostics;
  },
};
