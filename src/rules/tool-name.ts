import type { Rule, MCPTool, RuleContext, ClientId } from '../core/rule.js';
import type { Diagnostic } from '../core/diagnostic.js';

const CLIENTS: ClientId[] = [
  'claude', 'cursor', 'gemini', 'vscode', 'windsurf', 'cline', 'openai', 'continue',
];

// OpenAI and Azure: ^[A-Za-z0-9_-]{1,64}$
// Gemini also requires the first character to be a letter or underscore.
const SAFE_NAME = /^[A-Za-z0-9_-]{1,64}$/;
const LEADING_DIGIT = /^[0-9]/;

export function duplicateNameDiagnostics(tools: MCPTool[]): Diagnostic[] {
  const counts = new Map<string, number>();
  for (const tool of tools) counts.set(tool.name, (counts.get(tool.name) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, count]) => ({
      ruleId: 'tool-name/duplicate',
      severity: 'error' as const,
      message: `Tool name "${name}" appears ${count} times in this list. Clients call a tool by name, so keep it unique.`,
      toolName: name,
      path: 'name',
      clients: CLIENTS,
    }));
}

export function serverCollisionDiagnostics(
  groups: Array<{ serverName: string; toolNames: string[] }>,
): Diagnostic[] {
  const owners = new Map<string, string[]>();
  for (const group of groups) {
    for (const name of new Set(group.toolNames)) {
      const list = owners.get(name) ?? [];
      list.push(group.serverName);
      owners.set(name, list);
    }
  }
  return [...owners.entries()]
    .filter(([, servers]) => servers.length > 1)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, servers]) => ({
      ruleId: 'tool-name/server-collision',
      severity: 'error' as const,
      message: `Tool "${name}" is exposed by ${servers.join(', ')}. A client cannot tell which server owns the call.`,
      toolName: name,
      path: 'name',
      clients: CLIENTS,
    }));
}

export const toolNameDuplicate: Rule = {
  id: 'tool-name/duplicate',
  severity: 'error',
  description: 'The same tool name must not appear twice in one tools list.',
  clients: CLIENTS,
  docs: {
    why: 'Clients call a tool by name. Two entries with the same name make the second one unreachable or overwrite the first.',
    badExample: { tools: [{ name: 'search' }, { name: 'search' }] },
    goodExample: { tools: [{ name: 'search_issues' }, { name: 'search_files' }] },
    fixNote: 'Rename one of the tools. mcp-lint emits this from the whole list, because a single tool cannot see its siblings.',
  },
  check(): Diagnostic[] {
    return [];
  },
};

export const toolNameServerCollision: Rule = {
  id: 'tool-name/server-collision',
  severity: 'error',
  description: 'The same tool name must not be exposed by two installed servers.',
  clients: CLIENTS,
  docs: {
    why: 'A client that connects several MCP servers still calls a tool by name. The same name on two servers does not say which server owns the call.',
    badExample: { servers: [{ name: 'github', tools: ['search'] }, { name: 'gitlab', tools: ['search'] }] },
    goodExample: { servers: [{ name: 'github', tools: ['search_github'] }, { name: 'gitlab', tools: ['search_gitlab'] }] },
    fixNote: 'Rename the tool on one server. This runs for mcp-lint check --installed and --from, after each server has been listed.',
  },
  check(): Diagnostic[] {
    return [];
  },
};

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
