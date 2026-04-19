// Source: Cline MCP tool-use observed behavior (2025)
import type { Rule, MCPTool, RuleContext } from '../../core/rule.js';
import type { Diagnostic } from '../../core/diagnostic.js';

const MAX_LENGTH = 200;

export const clineDescriptionMaxLength: Rule = {
  id: 'cline/description-max-length',
  severity: 'warning',
  description: `Cline truncates descriptions longer than ${MAX_LENGTH} characters.`,
  clients: ['cline'],
  docs: {
    why: 'Cline\'s UI and prompt construction truncates tool and parameter descriptions at 200 characters. Longer descriptions are silently cut off, hiding important information.',
    badExample: { description: 'A very long description that exceeds two hundred characters and will be truncated by Cline without any warning, potentially causing confusion for users who rely on the full text.' },
    goodExample: { description: 'A concise description under 200 characters.' },
    fixNote: 'Trim description to 200 characters.',
  },

  check(tool: MCPTool, _context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    if (tool.description && tool.description.length > MAX_LENGTH) {
      diagnostics.push({
        ruleId: 'cline/description-max-length',
        severity: 'warning',
        message: `Tool "${tool.name}" description is ${tool.description.length} characters. Cline truncates at ${MAX_LENGTH}.`,
        toolName: tool.name,
        path: 'description',
        clients: ['cline'],
        fix: {
          description: `Trim description to ${MAX_LENGTH} characters`,
          apply: (s) => ({ ...s, description: (s.description as string).slice(0, MAX_LENGTH) }),
        },
      });
    }

    const props = tool.inputSchema.properties ?? {};
    for (const [propName, propSchema] of Object.entries(props)) {
      if (typeof propSchema.description === 'string' && propSchema.description.length > MAX_LENGTH) {
        diagnostics.push({
          ruleId: 'cline/description-max-length',
          severity: 'warning',
          message: `Parameter "${propName}" description is ${propSchema.description.length} characters. Cline truncates at ${MAX_LENGTH}.`,
          toolName: tool.name,
          path: `inputSchema.properties.${propName}`,
          clients: ['cline'],
          fix: {
            description: `Trim description to ${MAX_LENGTH} characters`,
            apply: (s) => ({ ...s, description: (s.description as string).slice(0, MAX_LENGTH) }),
          },
        });
      }
    }

    return diagnostics;
  },
};
