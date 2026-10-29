import { describe, expect, it } from 'vitest';
import { LintEngine } from '../../src/core/engine.js';
import { allRules } from '../../src/rules/index.js';
import type { MCPTool } from '../../src/core/rule.js';

const engine = new LintEngine(allRules, {});

function ids(tool: MCPTool): string[] {
  return engine.lint([tool]).map((item) => item.ruleId);
}

const base = {
  inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Path' } } },
};

describe('agent and annotation rules', () => {
  it('flags a description that sends the agent to a terminal', () => {
    const found = ids({
      ...base,
      name: 'search',
      description: 'Search issues. If this fails, run npm login in your terminal.',
    });
    expect(found).toContain('agent/no-unreachable-instruction');
  });

  it('allows a description that names a tool and a bare API url', () => {
    const found = ids({
      ...base,
      name: 'search',
      description: 'Search issues at https://api.example.com. If authorization fails, call login.',
    });
    expect(found).not.toContain('agent/no-unreachable-instruction');
  });

  it('warns when a destructive tool has no hint', () => {
    const found = engine.lint([{
      ...base,
      name: 'delete_file',
      description: 'Delete one file.',
    }]).filter((item) => item.ruleId === 'annotations/destructive-unmarked');
    expect(found).toHaveLength(1);
    expect(found[0]?.severity).toBe('warning');
  });

  it('errors when a destructive tool denies the hint', () => {
    const found = engine.lint([{
      ...base,
      name: 'sendEmail',
      description: 'Send a message.',
      annotations: { destructiveHint: false },
    }]).find((item) => item.ruleId === 'annotations/destructive-unmarked');
    expect(found?.severity).toBe('error');
  });

  it('accepts an explicit destructive hint', () => {
    const found = ids({
      ...base,
      name: 'delete_file',
      description: 'Delete one file.',
      annotations: { destructiveHint: true, readOnlyHint: false },
    });
    expect(found).not.toContain('annotations/destructive-unmarked');
    expect(found).not.toContain('annotations/readonly-conflict');
  });

  it('errors when a read-only hint is on a destructive name', () => {
    const found = ids({
      ...base,
      name: 'delete_file',
      description: 'Delete one file.',
      annotations: { readOnlyHint: true },
    });
    expect(found).toContain('annotations/readonly-conflict');
    expect(found).not.toContain('annotations/destructive-unmarked');
  });
});
