import type { Rule, MCPTool, RuleContext, ClientId } from '../core/rule.js';
import type { Diagnostic } from '../core/diagnostic.js';

const CLIENTS: ClientId[] = [
  'claude', 'cursor', 'gemini', 'vscode', 'windsurf', 'cline', 'openai', 'continue',
];

// OpenAI and Azure: ^[A-Za-z0-9_-]{1,64}$
// Gemini also requires the first character to be a letter or underscore.
const SAFE_NAME = /^[A-Za-z0-9_-]{1,64}$/;
const LEADING_DIGIT = /^[0-9]/;

export const toolNameClientSafe: Rule = {
  id: 'tool-name/client-safe',
  severity: 'error',
  description: 'Tool names must be 1–64 characters of letters, digits, underscores, or hyphens, and should not start with a digit.',
  clients: CLIENTS,
  docs: {
    why: 'OpenAI and Azure reject a tool name outside ^[A-Za-z0-9_-]{1,64}$. A space, slash, or dot makes the tool disappear. Gemini also refuses a name that starts with a digit.',
    badExample: { name: 'search files' },
    goodExample: { name: 'search_files' },
    fixNote: 'Rename the tool. Use letters, digits, underscores, or hyphens, start with a letter or underscore, and stay within 64 characters.',
  },

  check(tool: MCPTool, _context: RuleContext): Diagnostic[] {
    const name = tool.name ?? '';
    if (!SAFE_NAME.test(name)) {
      return [{
        ruleId: 'tool-name/client-safe',
        severity: 'error',
        message: `Tool name "${name}" is not safe across clients. Use 1–64 characters: letters, digits, underscore, or hyphen.`,
        toolName: name || '(unnamed)',
        path: 'name',
        clients: ['claude', 'openai', 'gemini'],
      }];
    }

    if (LEADING_DIGIT.test(name)) {
      return [{
        ruleId: 'tool-name/client-safe',
        severity: 'warning',
        message: `Tool name "${name}" starts with a digit. Gemini requires a letter or an underscore first.`,
        toolName: name,
        path: 'name',
        clients: ['gemini'],
      }];
    }

    return [];
  },
};
