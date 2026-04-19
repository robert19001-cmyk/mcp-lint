// Source: Continue.dev MCP tool-use observed behavior (2025)
import type { Rule, MCPTool, RuleContext } from '../../core/rule.js';
import type { Diagnostic } from '../../core/diagnostic.js';

export const continueNoDefaultValues: Rule = {
  id: 'continue/no-default-values',
  severity: 'warning',
  description: 'Continue.dev ignores `default` fields — users may assume defaults are applied when they are not.',
  clients: ['continue'],
  docs: {
    why: 'Continue.dev\'s MCP client does not apply `default` values from schemas. If a user omits an optional parameter, they won\'t get the default — they\'ll get an error or undefined behavior.',
    badExample: { properties: { limit: { type: 'number', default: 10 } } },
    goodExample: { properties: { limit: { type: 'number', description: 'Number of results (optional, defaults to 10 if omitted)' } } },
    fixNote: 'Document the default value in the description instead of relying on the `default` field.',
  },

  check(tool: MCPTool, _context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const props = tool.inputSchema.properties ?? {};

    for (const [propName, propSchema] of Object.entries(props)) {
      if (propSchema.default !== undefined) {
        diagnostics.push({
          ruleId: 'continue/no-default-values',
          severity: 'warning',
          message: `Parameter "${propName}" in tool "${tool.name}" has a \`default\` value that Continue.dev will ignore. Document the default in the description instead.`,
          toolName: tool.name,
          path: `inputSchema.properties.${propName}`,
          clients: ['continue'],
        });
      }
    }

    return diagnostics;
  },
};
