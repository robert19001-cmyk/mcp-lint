import { describe, expect, it } from 'vitest';
import type { MCPTool, RuleContext } from '../../src/core/rule.js';
import { toolNameClientSafe } from '../../src/rules/tool-name.js';

const ctx: RuleContext = { config: {} };
const tool = (name: string): MCPTool => ({
  name,
  description: 'A tool',
  inputSchema: { type: 'object' },
});

describe('tool-name/client-safe', () => {
  it('accepts a letter, digits, underscores, and hyphens', () => {
    expect(toolNameClientSafe.check(tool('search_files'), ctx)).toHaveLength(0);
    expect(toolNameClientSafe.check(tool('read-file-2'), ctx)).toHaveLength(0);
  });

  it('rejects a space, a slash, a dot, and a name longer than 64 characters', () => {
    for (const name of ['search files', 'repo/read', 'multi.tool', 'a'.repeat(65)]) {
      const diagnostics = toolNameClientSafe.check(tool(name), ctx);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe('error');
      expect(diagnostics[0]?.path).toBe('name');
    }
  });

  it('warns when a safe name starts with a digit', () => {
    const diagnostics = toolNameClientSafe.check(tool('9tools'), ctx);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.severity).toBe('warning');
    expect(diagnostics[0]?.clients).toEqual(['gemini']);
  });
});
