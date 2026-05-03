// Source: Cursor MCP tool-use observed behavior (2024)
import type { Rule, MCPTool, RuleContext } from '../../core/rule.js';
import type { Diagnostic } from '../../core/diagnostic.js';
import { walkSchema } from '../../utils/schema-walker.js';

function inferType(value: unknown): string | undefined {
  if (value === null) return undefined;
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return undefined;
}

export const cursorNoDefaultWithoutType: Rule = {
  id: 'cursor/no-default-without-type',
  severity: 'error',
  description: 'Cursor requires an explicit `type` when a `default` value is present.',
  clients: ['cursor'],

  check(tool: MCPTool, _context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    walkSchema(tool.inputSchema, (schema, path) => {
      if (schema.default !== undefined && schema.type === undefined) {
        const diagnosticPath = path ? `inputSchema.${path}` : 'inputSchema';
        const inferred = inferType(schema.default);
        diagnostics.push({
          ruleId: 'cursor/no-default-without-type',
          severity: 'error',
          message: `Property at "${diagnosticPath}" has a \`default\` value but no \`type\`. Cursor requires an explicit type when defaults are present.`,
          toolName: tool.name,
          path: diagnosticPath,
          clients: ['cursor'],
          ...(inferred
            ? {
                fix: {
                  description: `Add \`"type": "${inferred}"\` inferred from the default value`,
                  apply: (s) => ({ ...s, type: inferred }),
                },
              }
            : {}),
        });
      }
    });

    return diagnostics;
  },
};

export const cursorNoMissingTitle: Rule = {
  id: 'cursor/no-missing-title',
  severity: 'warning',
  description: 'Cursor displays tool and parameter titles in the tool picker; missing titles can expose raw snake_case names.',
  clients: ['cursor'],
  docs: {
    why: 'Cursor uses titles to present tools and arguments more clearly. Without titles, users may see internal identifiers such as snake_case tool names or parameter names.',
    badExample: {
      name: 'search_docs',
      description: 'Search documentation',
      inputSchema: {
        type: 'object',
        properties: {
          query_text: { type: 'string', description: 'Search query' },
        },
      },
    },
    goodExample: {
      name: 'search_docs',
      title: 'Search Docs',
      description: 'Search documentation',
      inputSchema: {
        type: 'object',
        properties: {
          query_text: { title: 'Query Text', type: 'string', description: 'Search query' },
        },
      },
    },
  },

  check(tool: MCPTool, _context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    if (!tool.title || tool.title.trim() === '') {
      diagnostics.push({
        ruleId: 'cursor/no-missing-title',
        severity: 'warning',
        message: `Tool "${tool.name}" is missing a \`title\`. Cursor can display raw tool names without it.`,
        toolName: tool.name,
        path: 'title',
        clients: ['cursor'],
      });
    }

    if (tool.inputSchema.properties) {
      for (const [propName, propSchema] of Object.entries(tool.inputSchema.properties)) {
        if (!propSchema.title || propSchema.title.trim() === '') {
          diagnostics.push({
            ruleId: 'cursor/no-missing-title',
            severity: 'warning',
            message: `Parameter "${propName}" in tool "${tool.name}" is missing a \`title\`. Cursor can display raw parameter names without it.`,
            toolName: tool.name,
            path: `inputSchema.properties.${propName}.title`,
            clients: ['cursor'],
          });
        }
      }
    }

    return diagnostics;
  },
};
