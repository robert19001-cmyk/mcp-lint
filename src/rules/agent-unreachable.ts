import type { Rule, MCPTool, RuleContext, ClientId } from '../core/rule.js';
import type { Diagnostic } from '../core/diagnostic.js';
import { instructionBlocker } from '../recover/score.js';

const CLIENTS: ClientId[] = ['claude', 'cursor', 'gemini', 'vscode', 'windsurf', 'cline', 'openai', 'continue'];

export const noUnreachableInstruction: Rule = {
  id: 'agent/no-unreachable-instruction',
  severity: 'warning',
  description: 'Tool text must not send an agent to a terminal, a config file, or a web page.',
  clients: CLIENTS,
  docs: {
    why: 'An agent that can only call MCP tools follows the step it is given. A terminal command, config edit, or browser page stops the task.',
    badExample: {
      name: 'search',
      description: 'Search issues. If this fails, run npm login in your terminal.',
      inputSchema: { type: 'object', properties: {} },
    },
    goodExample: {
      name: 'search',
      description: 'Search issues. If authorization fails, call the login tool, then retry search.',
      inputSchema: { type: 'object', properties: {} },
    },
  },

  check(tool: MCPTool, _context: RuleContext): Diagnostic[] {
    const text = [tool.title, tool.description].filter(Boolean).join('\n');
    const blocked = instructionBlocker(text);
    if (!blocked) return [];
    return [{
      ruleId: 'agent/no-unreachable-instruction',
      severity: 'warning',
      message: `Tool "${tool.name}" tells the agent to use ${blocked}. Name a tool on this server instead.`,
      toolName: tool.name,
      path: 'description',
      clients: CLIENTS,
    }];
  },
};
