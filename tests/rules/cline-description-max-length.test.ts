import { describe, it, expect } from 'vitest';
import { clineDescriptionMaxLength } from '../../src/rules/client-specific/cline.js';
import type { MCPTool, RuleContext } from '../../src/core/rule.js';

const ctx: RuleContext = { config: {} };

function makeTool(description: string, paramDesc?: string): MCPTool {
  return {
    name: 'test-tool',
    description,
    inputSchema: {
      type: 'object',
      properties: paramDesc ? { q: { type: 'string', description: paramDesc } } : {},
    },
  };
}

describe('cline/description-max-length', () => {
  it('returns no diagnostics for tool description under 200 chars', () => {
    const tool = makeTool('Short description.');
    expect(clineDescriptionMaxLength.check(tool, ctx)).toHaveLength(0);
  });

  it('detects tool description over 200 chars', () => {
    const tool = makeTool('A'.repeat(201));
    const diagnostics = clineDescriptionMaxLength.check(tool, ctx);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].ruleId).toBe('cline/description-max-length');
    expect(diagnostics[0].severity).toBe('warning');
    expect(diagnostics[0].clients).toEqual(['cline']);
    expect(diagnostics[0].fix).toBeDefined();
  });

  it('detects parameter description over 200 chars', () => {
    const tool = makeTool('Fine.', 'B'.repeat(201));
    const diagnostics = clineDescriptionMaxLength.check(tool, ctx);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].path).toContain('properties.q');
  });

  it('auto-fix trims description to 200 chars', () => {
    const tool = makeTool('A'.repeat(250));
    const diag = clineDescriptionMaxLength.check(tool, ctx)[0];
    const fixed = diag.fix!.apply({ description: 'A'.repeat(250) });
    expect((fixed.description as string).length).toBe(200);
  });
});
