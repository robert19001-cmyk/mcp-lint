import { describe, it, expect } from 'vitest';
import { claudeNoTypeArray } from '../../src/rules/client-specific/claude.js';
import type { MCPTool, RuleContext } from '../../src/core/rule.js';

const ctx: RuleContext = { config: {} };
const makeTool = (inputSchema: MCPTool['inputSchema']): MCPTool => ({
  name: 'test-tool', description: 'Test', inputSchema,
});

describe('claude/no-type-array', () => {
  it('returns no diagnostics for single type string', () => {
    const tool = makeTool({
      type: 'object',
      properties: { q: { type: 'string' } },
    });
    expect(claudeNoTypeArray.check(tool, ctx)).toHaveLength(0);
  });

  it('warns for array type syntax', () => {
    const tool = makeTool({
      type: 'object',
      properties: {
        val: { type: ['string', 'null'] },
      },
    });
    const diagnostics = claudeNoTypeArray.check(tool, ctx);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].ruleId).toBe('claude/no-type-array');
    expect(diagnostics[0].severity).toBe('warning');
    expect(diagnostics[0].clients).toEqual(['claude']);
  });

  it('fix converts to primary non-null type', () => {
    const tool = makeTool({ type: ['string', 'null'] });
    const [diag] = claudeNoTypeArray.check(tool, ctx);
    const fixed = diag.fix!.apply({ type: ['string', 'null'] });
    expect(fixed.type).toBe('string');
  });

  it('fix uses first type when no null in array', () => {
    const tool = makeTool({ type: ['string', 'number'] });
    const [diag] = claudeNoTypeArray.check(tool, ctx);
    const fixed = diag.fix!.apply({ type: ['string', 'number'] });
    expect(fixed.type).toBe('string');
  });

  it('detects nested array type', () => {
    const tool = makeTool({
      type: 'object',
      properties: {
        a: { type: 'object', properties: { b: { type: ['integer', 'null'] } } },
      },
    });
    expect(claudeNoTypeArray.check(tool, ctx)).toHaveLength(1);
  });
});
