import { describe, expect, it } from 'vitest';
import { auditBaselineDiff, projectAuditReport } from '../../src/audit/baseline.js';
import { buildAuditReport } from '../../src/audit/report.js';

const tools = [{
  name: 'search',
  description: 'Find text.',
  inputSchema: { type: 'object', properties: {} },
}];

describe('audit baseline', () => {
  it('ignores the clock and notices a finding change', () => {
    const first = buildAuditReport({
      source: 'tools.json',
      tools,
      diagnostics: [],
      generatedAt: '2026-01-01T00:00:00.000Z',
      version: '1.0.0',
    });
    const later = buildAuditReport({
      source: 'tools.json',
      tools,
      diagnostics: [],
      generatedAt: '2026-11-01T00:00:00.000Z',
      version: '1.0.0',
    });
    expect(auditBaselineDiff(projectAuditReport(first), projectAuditReport(later))).toBeNull();

    const changed = buildAuditReport({
      source: 'tools.json',
      tools,
      diagnostics: [{
        ruleId: 'tool-name/client-safe',
        severity: 'error',
        message: 'bad name',
        toolName: 'search',
        path: 'name',
        clients: [],
      }],
      generatedAt: '2026-01-01T00:00:00.000Z',
      version: '1.0.0',
    });
    expect(auditBaselineDiff(projectAuditReport(changed), projectAuditReport(first))).toMatch(/line /);
  });
});
