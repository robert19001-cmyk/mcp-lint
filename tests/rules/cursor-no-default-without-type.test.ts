import { describe, it, expect } from 'vitest';
import { cursorNoDefaultWithoutType } from '../../src/rules/client-specific/cursor.js';
import type { MCPTool, RuleContext } from '../../src/core/rule.js';

const ctx: RuleContext = { config: {} };
const makeTool = (inputSchema: MCPTool['inputSchema']): MCPTool => ({
  name: 'test-tool', description: 'Test', inputSchema,
});

describe('cursor/no-default-without-type', () => {
  it('returns no diagnostics when type is present with default', () => {
    const tool = makeTool({
      type: 'object',
      properties: { limit: { type: 'number', default: 10 } },
    });
    expect(cursorNoDefaultWithoutType.check(tool, ctx)).toHaveLength(0);
  });

  it('returns no diagnostics when no default present', () => {
    const tool = makeTool({
      type: 'object',
      properties: { q: { type: 'string' } },
    });
    expect(cursorNoDefaultWithoutType.check(tool, ctx)).toHaveLength(0);
  });

  it('detects default without type', () => {
    const tool = makeTool({
      type: 'object',
      properties: { limit: { default: 10 } },
    });
    const diagnostics = cursorNoDefaultWithoutType.check(tool, ctx);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].ruleId).toBe('cursor/no-default-without-type');
    expect(diagnostics[0].severity).toBe('error');
    expect(diagnostics[0].clients).toEqual(['cursor']);
  });

  it('fix infers type from string default', () => {
    const tool = makeTool({ default: 'hello' });
    const [diag] = cursorNoDefaultWithoutType.check(tool, ctx);
    expect(diag.fix!.apply({ default: 'hello' }).type).toBe('string');
  });

  it('fix infers type from number default', () => {
    const tool = makeTool({ default: 42 });
    const [diag] = cursorNoDefaultWithoutType.check(tool, ctx);
    expect(diag.fix!.apply({ default: 42 }).type).toBe('integer');
  });

  it('fix infers type from boolean default', () => {
    const tool = makeTool({ default: false });
    const [diag] = cursorNoDefaultWithoutType.check(tool, ctx);
    expect(diag.fix!.apply({ default: false }).type).toBe('boolean');
  });

  it('provides no fix when default is null', () => {
    const tool = makeTool({ default: null });
    const [diag] = cursorNoDefaultWithoutType.check(tool, ctx);
    expect(diag.fix).toBeUndefined();
  });
});
