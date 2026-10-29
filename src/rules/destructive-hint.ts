import type { Rule, MCPTool, RuleContext, ClientId } from '../core/rule.js';
import type { Diagnostic } from '../core/diagnostic.js';

const CLIENTS: ClientId[] = ['claude', 'cursor', 'gemini', 'vscode', 'windsurf', 'cline', 'openai', 'continue'];

const DESTRUCTIVE = /\b(delete|drop|destroy|wipe|truncate|unlink|send|pay|charge|deploy|overwrite)\b/i;

export const destructiveUnmarked: Rule = {
  id: 'annotations/destructive-unmarked',
  severity: 'warning',
  description: 'A tool whose name deletes, sends, pays, or deploys must set annotations.destructiveHint.',
  clients: CLIENTS,
  docs: {
    why: 'Clients use destructiveHint to decide whether a call needs a person. A delete tool with no hint looks the same as a read.',
    badExample: {
      name: 'delete_file',
      description: 'Delete a file.',
      inputSchema: { type: 'object', properties: {} },
    },
    goodExample: {
      name: 'delete_file',
      description: 'Delete a file.',
      annotations: { destructiveHint: true, readOnlyHint: false },
      inputSchema: { type: 'object', properties: {} },
    },
    fixNote: 'Set annotations.destructiveHint to true, or to false only when the name is not actually destructive.',
  },

  check(tool: MCPTool, _context: RuleContext): Diagnostic[] {
    if (!isDestructive(tool) || tool.annotations?.readOnlyHint === true) return [];
    if (tool.annotations?.destructiveHint === true) return [];
    if (tool.annotations?.destructiveHint === false) {
      return [diagnostic(
        tool,
        'error',
        `Tool "${tool.name}" looks destructive but annotations.destructiveHint is false.`,
      )];
    }
    return [diagnostic(
      tool,
      'warning',
      `Tool "${tool.name}" looks destructive and has no annotations.destructiveHint.`,
    )];
  },
};

export const readonlyConflict: Rule = {
  id: 'annotations/readonly-conflict',
  severity: 'error',
  description: 'A tool marked readOnlyHint must not be named like a delete, send, payment, or deploy.',
  clients: CLIENTS,
  docs: {
    why: 'readOnlyHint tells the client the call cannot change anything. A conflicting name hides a write.',
    badExample: {
      name: 'delete_file',
      annotations: { readOnlyHint: true },
      inputSchema: { type: 'object', properties: {} },
    },
    goodExample: {
      name: 'delete_file',
      annotations: { readOnlyHint: false, destructiveHint: true },
      inputSchema: { type: 'object', properties: {} },
    },
  },

  check(tool: MCPTool, _context: RuleContext): Diagnostic[] {
    if (tool.annotations?.readOnlyHint !== true || !isDestructive(tool)) return [];
    return [{
      ruleId: 'annotations/readonly-conflict',
      severity: 'error',
      message: `Tool "${tool.name}" is marked read-only but its name is destructive.`,
      toolName: tool.name,
      path: 'annotations.readOnlyHint',
      clients: CLIENTS,
    }];
  },
};

function isDestructive(tool: MCPTool): boolean {
  const words = [tool.name, tool.title ?? '']
    .join(' ')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2');
  return DESTRUCTIVE.test(words);
}

function diagnostic(tool: MCPTool, severity: 'error' | 'warning', message: string): Diagnostic {
  return {
    ruleId: 'annotations/destructive-unmarked',
    severity,
    message,
    toolName: tool.name,
    path: 'annotations.destructiveHint',
    clients: CLIENTS,
  };
}
