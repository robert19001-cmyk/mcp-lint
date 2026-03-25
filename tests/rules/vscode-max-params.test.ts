import { describe, it, expect } from 'vitest';
import { vscodeMaxParams } from '../../src/rules/client-specific/vscode.js';
import type { MCPTool, RuleContext } from '../../src/core/rule.js';

const ctx: RuleContext = { config: {} };

function makeToolWithNParams(n: number): MCPTool {
  const properties: Record<string, { type: string; description: string }> = {};
  for (let i = 0; i < n; i++) {
    properties[`param${i}`] = { type: 'string', description: `Param ${i}` };
  }
  return { name: 'big-tool', description: 'Tool with many params', inputSchema: { type: 'object', properties } };
}

describe('vscode/max-params', () => {
  it('returns no diagnostics for 15 params (at limit)', () => {
    expect(vscodeMaxParams.check(makeToolWithNParams(15), ctx)).toHaveLength(0);
  });

  it('returns no diagnostics for few params', () => {
    expect(vscodeMaxParams.check(makeToolWithNParams(3), ctx)).toHaveLength(0);
  });

  it('warns for 16 params (over limit)', () => {
    const diagnostics = vscodeMaxParams.check(makeToolWithNParams(16), ctx);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].ruleId).toBe('vscode/max-params');
    expect(diagnostics[0].severity).toBe('warning');
    expect(diagnostics[0].clients).toEqual(['vscode']);
    expect(diagnostics[0].message).toContain('16');
  });

  it('returns no diagnostics for tool with no properties', () => {
    const tool: MCPTool = { name: 't', description: 'T', inputSchema: { type: 'object' } };
    expect(vscodeMaxParams.check(tool, ctx)).toHaveLength(0);
  });
});
