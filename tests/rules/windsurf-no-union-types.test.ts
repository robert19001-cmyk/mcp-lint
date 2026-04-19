import { describe, it, expect } from 'vitest';
import { windsurfNoUnionTypes } from '../../src/rules/client-specific/windsurf.js';
import type { MCPTool, RuleContext } from '../../src/core/rule.js';

const ctx: RuleContext = { config: {} };

function makeTool(inputSchema: MCPTool['inputSchema']): MCPTool {
  return { name: 'test-tool', description: 'Test tool', inputSchema };
}

describe('windsurf/no-union-types', () => {
  it('returns no diagnostics when anyOf has 2 or fewer variants', () => {
    const tool = makeTool({
      type: 'object',
      properties: {
        value: { anyOf: [{ type: 'string' }, { type: 'null' }] },
      },
    });
    expect(windsurfNoUnionTypes.check(tool, ctx)).toHaveLength(0);
  });

  it('detects anyOf with more than 2 variants', () => {
    const tool = makeTool({
      type: 'object',
      properties: {
        value: { anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }] },
      },
    });
    const diagnostics = windsurfNoUnionTypes.check(tool, ctx);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].ruleId).toBe('windsurf/no-union-types');
    expect(diagnostics[0].severity).toBe('warning');
    expect(diagnostics[0].clients).toEqual(['windsurf']);
  });

  it('returns no diagnostics when no anyOf present', () => {
    const tool = makeTool({ type: 'object', properties: { q: { type: 'string' } } });
    expect(windsurfNoUnionTypes.check(tool, ctx)).toHaveLength(0);
  });
});
