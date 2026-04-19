import { describe, it, expect } from 'vitest';
import { openaiNoAdditionalProperties, openaiStrictTypes } from '../../src/rules/client-specific/openai.js';
import type { MCPTool, RuleContext } from '../../src/core/rule.js';

const ctx: RuleContext = { config: {} };

function makeTool(inputSchema: MCPTool['inputSchema']): MCPTool {
  return { name: 'test-tool', description: 'Test tool', inputSchema };
}

describe('openai/no-additional-properties', () => {
  it('returns no diagnostics when additionalProperties is false', () => {
    const tool = makeTool({
      type: 'object',
      properties: { q: { type: 'string' } },
      additionalProperties: false,
    });
    expect(openaiNoAdditionalProperties.check(tool, ctx)).toHaveLength(0);
  });

  it('detects missing additionalProperties: false', () => {
    const tool = makeTool({ type: 'object', properties: { q: { type: 'string' } } });
    const diagnostics = openaiNoAdditionalProperties.check(tool, ctx);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].ruleId).toBe('openai/no-additional-properties');
    expect(diagnostics[0].severity).toBe('error');
    expect(diagnostics[0].clients).toEqual(['openai']);
    expect(diagnostics[0].fix).toBeDefined();
  });

  it('auto-fix adds additionalProperties: false', () => {
    const tool = makeTool({ type: 'object' });
    const diag = openaiNoAdditionalProperties.check(tool, ctx)[0];
    const fixed = diag.fix!.apply({ type: 'object' });
    expect(fixed.additionalProperties).toBe(false);
  });
});

describe('openai/strict-types', () => {
  it('returns no diagnostics for allowed types', () => {
    const tool = makeTool({
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string' },
        count: { type: 'number' },
        active: { type: 'boolean' },
      },
    });
    expect(openaiStrictTypes.check(tool, ctx)).toHaveLength(0);
  });

  it('detects integer type (not allowed in OpenAI strict)', () => {
    const tool = makeTool({
      type: 'object',
      properties: { count: { type: 'integer' } },
    });
    const diagnostics = openaiStrictTypes.check(tool, ctx);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].ruleId).toBe('openai/strict-types');
    expect(diagnostics[0].severity).toBe('error');
  });

  it('returns no diagnostics when no properties', () => {
    const tool = makeTool({ type: 'object' });
    expect(openaiStrictTypes.check(tool, ctx)).toHaveLength(0);
  });
});
