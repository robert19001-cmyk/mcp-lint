import { describe, expect, it } from 'vitest';
import { computeQualityReport } from '../../src/core/quality-score.js';
import type { MCPTool } from '../../src/core/rule.js';

const ready: MCPTool = {
  name: 'search',
  description: 'Find documents.',
  inputSchema: { type: 'object' },
  outputSchema: { type: 'object' },
};

describe('computeQualityReport', () => {
  it('withholds earned points when description or schemas are missing', () => {
    const bare: MCPTool = { name: 'search', inputSchema: { type: 'object' } };
    const report = computeQualityReport([bare], []);
    expect(report.algorithm).toBe('quality-v2');
    expect(report.tools[0]?.score).toBe(65);
    expect(report.coverage).toEqual({
      toolCount: 1,
      withDescription: 0,
      withInputSchema: 1,
      withOutputSchema: 0,
    });
    expect(report.confidence).toBe('low');
    expect(report.measured).toBe(true);
  });

  it('scores a complete clean tool at 100 and keeps an empty list unmeasured', () => {
    const full = computeQualityReport([ready], []);
    expect(full.overall).toBe(100);
    expect(full.confidence).toBe('medium');
    const empty = computeQualityReport([], []);
    expect(empty.overall).toBe(100);
    expect(empty.measured).toBe(false);
    expect(empty.confidence).toBe('low');
  });

  it('subtracts named error and warning weights', () => {
    const report = computeQualityReport([ready], [
      { ruleId: 'x', severity: 'error', message: 'bad', toolName: 'search', path: 'name', clients: ['claude'] },
      { ruleId: 'y', severity: 'warning', message: 'warn', toolName: 'search', path: 'description', clients: ['claude'] },
    ]);
    expect(report.tools[0]?.score).toBe(80);
  });
});
