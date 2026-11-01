import { describe, expect, it } from 'vitest';
import { AuditInputError, buildAuditReport, parseAuditReport } from '../../src/audit/report.js';
import type { Diagnostic } from '../../src/core/diagnostic.js';

const generatedAt = '2026-11-01T00:00:00.000Z';

function diagnostic(overrides: Partial<Diagnostic> = {}): Diagnostic {
  return {
    ruleId: 'description-exists',
    severity: 'warning',
    message: 'Missing description',
    toolName: 'search',
    path: 'description',
    clients: ['cursor', 'claude'],
    ...overrides,
  };
}

describe('buildAuditReport', () => {
  it('builds a versioned report and withholds work that did not run', () => {
    const report = buildAuditReport({
      source: 'tools.json',
      generatedAt,
      version: '0.8.0',
      tools: [{ name: 'search', description: 'Find documents in the index.', inputSchema: { type: 'object' } }],
      diagnostics: [],
    });
    expect(report.schemaVersion).toBe(1);
    expect(report.scope).toEqual({
      source: 'tools.json',
      mode: 'offline-tools',
      liveServer: false,
      toolsInvoked: false,
    });
    expect(report.findings).toEqual({ status: 'ran', data: [] });
    expect(report.severity).toEqual({ status: 'ran', data: { error: 0, warning: 0, info: 0 } });
    expect(report.quality.status).toBe('ran');
    expect(report.recovery.status).toBe('not_run');
    expect(report.preflight.status).toBe('not_run');
    expect(report.compatibility.status).toBe('not_run');
    expect(report.tokenBudget.status).toBe('ran');
    expect(report.coverage.confidence).toBe('medium');
    expect(report.recommendations).toEqual([
      'No schema errors in this run. Recovery, preflight, and live inspection were not measured.',
    ]);
    expect(parseAuditReport(report)).toEqual(report);
  });

  it('does not treat an empty tool list as a perfect score', () => {
    const report = buildAuditReport({
      source: 'empty',
      generatedAt,
      tools: [],
      diagnostics: [],
    });
    expect(report.quality).toEqual({
      status: 'not_run',
      reason: 'No tools were supplied, so the quality score was withheld.',
    });
    expect(report.coverage.confidence).toBe('low');
    expect(report.recommendations).toContain('No tools were supplied, so the quality score was withheld.');
    expect(JSON.stringify(report)).not.toContain('"overall":100');
  });

  it('does not treat a missing lint as zero findings', () => {
    const report = buildAuditReport({
      source: 'inventory',
      generatedAt,
      tools: [{ name: 'search', inputSchema: { type: 'object' } }],
    });
    expect(report.findings.status).toBe('not_run');
    expect(report.severity.status).toBe('not_run');
    expect(report.quality.status).toBe('not_run');
    expect(report.recommendations[0]).toMatch(/not a pass/);
    expect(report.tools[0]).toEqual({
      name: 'search',
      hasDescription: false,
      hasInputSchema: true,
      hasOutputSchema: false,
    });
  });

  it('sorts findings and records output schemas and duplicate names', () => {
    const report = buildAuditReport({
      source: 'fixture',
      generatedAt,
      tools: [
        { name: 'search', description: 'Find documents.', inputSchema: { type: 'object' }, outputSchema: { type: 'object' } },
        { name: 'search', description: 'Find documents again.', inputSchema: { type: 'object' } },
      ],
      diagnostics: [
        diagnostic({ ruleId: 'b', toolName: 'search', path: 'b', severity: 'error' }),
        diagnostic({ ruleId: 'a', toolName: 'search', path: 'a', severity: 'info' }),
      ],
    });
    expect(report.duplicateToolNames).toEqual(['search']);
    expect(report.tools.map((tool) => tool.hasOutputSchema)).toEqual([true, false]);
    expect(report.findings.status).toBe('ran');
    if (report.findings.status === 'ran') {
      expect(report.findings.data.map((finding) => finding.path)).toEqual(['a', 'b']);
      expect(report.findings.data[0].clients).toEqual(['claude', 'cursor']);
    }
    expect(report.severity).toEqual({ status: 'ran', data: { error: 1, warning: 0, info: 1 } });
    expect(report.recommendations.some((line) => line.includes('duplicate'))).toBe(true);
  });

  it('rejects partial and invalid tool records', () => {
    expect(() => buildAuditReport({ source: 'x', generatedAt, tools: {} })).toThrow(AuditInputError);
    expect(() => buildAuditReport({ source: 'x', generatedAt, tools: [{ description: 'no name' }] })).toThrow(/name/);
    expect(() => buildAuditReport({ source: 'x', generatedAt, tools: [{ name: 'ok', inputSchema: [] }] })).toThrow(/inputSchema/);
    expect(() => buildAuditReport({ source: ' ', generatedAt, tools: [] })).toThrow(/source/);
  });

  it('rejects a report whose schema version or shape drifted', () => {
    const report = buildAuditReport({
      source: 'tools.json',
      generatedAt,
      tools: [{ name: 'search', inputSchema: { type: 'object' } }],
      diagnostics: [],
    });
    expect(() => parseAuditReport({ ...report, schemaVersion: 2 })).toThrow();
    expect(() => parseAuditReport({ ...report, extra: true })).toThrow();
  });
});
