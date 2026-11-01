import { describe, it, expect } from 'vitest';
import { LintEngine } from '../../src/core/engine.js';
import type { Rule, MCPTool } from '../../src/core/rule.js';

const mockRule: Rule = {
  id: 'mock-rule',
  severity: 'error',
  description: 'Mock rule for testing',
  clients: ['claude'],
  check: (tool) => [{
    ruleId: 'mock-rule',
    severity: 'error',
    message: 'Mock error',
    toolName: tool.name,
    path: 'inputSchema',
    clients: ['claude'],
  }],
};

const mockTool: MCPTool = {
  name: 'test-tool',
  description: 'Test',
  inputSchema: { type: 'object' },
};

describe('LintEngine', () => {
  it('runs rules and returns diagnostics', () => {
    const engine = new LintEngine([mockRule], {});
    expect(engine.lint([mockTool])).toHaveLength(1);
  });

  it('returns empty array when no tools', () => {
    const engine = new LintEngine([mockRule], {});
    expect(engine.lint([])).toHaveLength(0);
  });

  it('returns empty array when no rules', () => {
    const engine = new LintEngine([], {});
    expect(engine.lint([mockTool])).toHaveLength(0);
  });

  it('skips ignored tools', () => {
    const engine = new LintEngine([mockRule], { ignore: ['test-tool'] });
    expect(engine.lint([mockTool])).toHaveLength(0);
  });

  it('does not skip tools not in ignore list', () => {
    const engine = new LintEngine([mockRule], { ignore: ['other-tool'] });
    expect(engine.lint([mockTool])).toHaveLength(1);
  });

  it('skips rule when severity is off', () => {
    const engine = new LintEngine([mockRule], { rules: { 'mock-rule': 'off' } });
    expect(engine.lint([mockTool])).toHaveLength(0);
  });

  it('overrides severity from config', () => {
    const engine = new LintEngine([mockRule], { rules: { 'mock-rule': 'warning' } });
    const result = engine.lint([mockTool]);
    expect(result[0].severity).toBe('warning');
  });

  it('runs multiple rules against multiple tools', () => {
    const rule2: Rule = { ...mockRule, id: 'mock-rule-2' };
    const tool2: MCPTool = { ...mockTool, name: 'tool-2' };
    const engine = new LintEngine([mockRule, rule2], {});
    expect(engine.lint([mockTool, tool2])).toHaveLength(4);
  });

  it('skips rules whose clients do not match config.clients', () => {
    // mockRule.clients = ['claude'], config.clients = ['cursor'] -> skip
    const engine = new LintEngine([mockRule], { clients: ['cursor'] });
    expect(engine.lint([mockTool])).toHaveLength(0);
  });

  it('runs rules when their client is in config.clients', () => {
    const engine = new LintEngine([mockRule], { clients: ['claude'] });
    expect(engine.lint([mockTool])).toHaveLength(1);
  });

  it('runs all rules when config.clients is empty', () => {
    const engine = new LintEngine([mockRule], { clients: [] });
    expect(engine.lint([mockTool])).toHaveLength(1);
  });

  it('copies schema diagnostics onto outputSchema and keeps the fix', () => {
    const schemaRule: Rule = {
      ...mockRule,
      check: () => [{
        ruleId: 'mock-rule',
        severity: 'error',
        message: 'Schema node at "inputSchema.properties.query" has required: false',
        toolName: 'test-tool',
        path: 'inputSchema.properties.query',
        clients: ['claude'],
        fix: { description: 'Remove required: false', apply: (schema) => schema },
      }],
    };
    const engine = new LintEngine([schemaRule], {});
    const result = engine.lint([{ ...mockTool, outputSchema: { type: 'object' } }]);
    expect(result.map((item) => item.path)).toEqual([
      'inputSchema.properties.query',
      'outputSchema.properties.query',
    ]);
    expect(result[1]?.message).toBe('Schema node at "outputSchema.properties.query" has required: false');
    expect(result[1]?.fix?.description).toBe('Remove required: false');
  });

  it('does not copy a non-schema diagnostic onto outputSchema', () => {
    const descriptionRule: Rule = {
      ...mockRule,
      id: 'description-exists',
      check: (tool) => [{
        ruleId: 'description-exists',
        severity: 'warning',
        message: 'Tool is missing a description',
        toolName: tool.name,
        path: 'description',
        clients: ['claude'],
      }],
    };
    const engine = new LintEngine([descriptionRule], {});
    expect(engine.lint([{ ...mockTool, outputSchema: { type: 'object' } }])).toHaveLength(1);
  });

  it('reports a tool name that appears twice', () => {
    const engine = new LintEngine([], {});
    const result = engine.lint([mockTool, { ...mockTool }]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      ruleId: 'tool-name/duplicate',
      severity: 'error',
      toolName: 'test-tool',
      path: 'name',
    });
    expect(result[0]?.message).toContain('2 times');
  });

  it('lets config turn duplicate tool names off or down to a warning', () => {
    const off = new LintEngine([], { rules: { 'tool-name/duplicate': 'off' } });
    expect(off.lint([mockTool, { ...mockTool }])).toHaveLength(0);
    const warning = new LintEngine([], { rules: { 'tool-name/duplicate': 'warning' } });
    expect(warning.lint([mockTool, { ...mockTool }])[0]?.severity).toBe('warning');
  });
});
