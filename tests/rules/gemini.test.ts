import { describe, it, expect } from 'vitest';
import { geminiNoOptionalWithoutDefault, geminiNoNestedObjects } from '../../src/rules/client-specific/gemini.js';
import type { MCPTool, RuleContext } from '../../src/core/rule.js';

const ctx: RuleContext = { config: {} };
const makeTool = (inputSchema: MCPTool['inputSchema']): MCPTool => ({
  name: 'test-tool', description: 'Test', inputSchema,
});

describe('gemini/no-optional-without-default', () => {
  it('returns no diagnostics when all optional params have defaults', () => {
    const tool = makeTool({
      type: 'object',
      properties: {
        q: { type: 'string' },
        limit: { type: 'number', default: 10 },
      },
      required: ['q'],
    });
    expect(geminiNoOptionalWithoutDefault.check(tool, ctx)).toHaveLength(0);
  });

  it('returns no diagnostics when all params are required', () => {
    const tool = makeTool({
      type: 'object',
      properties: { q: { type: 'string' } },
      required: ['q'],
    });
    expect(geminiNoOptionalWithoutDefault.check(tool, ctx)).toHaveLength(0);
  });

  it('warns for optional param without default', () => {
    const tool = makeTool({
      type: 'object',
      properties: {
        q: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['q'],
    });
    const diagnostics = geminiNoOptionalWithoutDefault.check(tool, ctx);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].ruleId).toBe('gemini/no-optional-without-default');
    expect(diagnostics[0].clients).toEqual(['gemini']);
    expect(diagnostics[0].path).toBe('inputSchema.properties.limit');
  });

  it('returns no diagnostics for tool with no properties', () => {
    const tool = makeTool({ type: 'object' });
    expect(geminiNoOptionalWithoutDefault.check(tool, ctx)).toHaveLength(0);
  });
});

describe('gemini/no-nested-objects', () => {
  it('returns no diagnostics for flat schema', () => {
    const tool = makeTool({
      type: 'object',
      properties: { q: { type: 'string' } },
    });
    expect(geminiNoNestedObjects.check(tool, ctx)).toHaveLength(0);
  });

  it('returns no diagnostics for 2-level nesting', () => {
    const tool = makeTool({
      type: 'object',
      properties: {
        filter: {
          type: 'object',
          properties: { active: { type: 'boolean' } },
        },
      },
    });
    expect(geminiNoNestedObjects.check(tool, ctx)).toHaveLength(0);
  });

  it('warns for 3-level object nesting', () => {
    const tool = makeTool({
      type: 'object',
      properties: {
        a: {
          type: 'object',
          properties: {
            b: {
              type: 'object',
              properties: {
                c: { type: 'object', properties: { d: { type: 'string' } } },
              },
            },
          },
        },
      },
    });
    const diagnostics = geminiNoNestedObjects.check(tool, ctx);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].ruleId).toBe('gemini/no-nested-objects');
    expect(diagnostics[0].clients).toEqual(['gemini']);
  });
});
