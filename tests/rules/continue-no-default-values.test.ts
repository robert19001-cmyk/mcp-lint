import { describe, it, expect } from 'vitest';
import { continueNoDefaultValues } from '../../src/rules/client-specific/continue.js';
import type { MCPTool, RuleContext } from '../../src/core/rule.js';

const ctx: RuleContext = { config: {} };

function makeTool(inputSchema: MCPTool['inputSchema']): MCPTool {
  return { name: 'test-tool', description: 'Test tool', inputSchema };
}

describe('continue/no-default-values', () => {
  it('returns no diagnostics when no default values', () => {
    const tool = makeTool({
      type: 'object',
      properties: { q: { type: 'string' } },
    });
    expect(continueNoDefaultValues.check(tool, ctx)).toHaveLength(0);
  });

  it('detects default value on a property', () => {
    const tool = makeTool({
      type: 'object',
      properties: { limit: { type: 'number', default: 10 } },
    });
    const diagnostics = continueNoDefaultValues.check(tool, ctx);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].ruleId).toBe('continue/no-default-values');
    expect(diagnostics[0].severity).toBe('warning');
    expect(diagnostics[0].clients).toEqual(['continue']);
  });

  it('detects multiple properties with defaults', () => {
    const tool = makeTool({
      type: 'object',
      properties: {
        limit: { type: 'number', default: 10 },
        offset: { type: 'number', default: 0 },
      },
    });
    expect(continueNoDefaultValues.check(tool, ctx)).toHaveLength(2);
  });
});
