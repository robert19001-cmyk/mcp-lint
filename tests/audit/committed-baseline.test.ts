import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { auditBaselineDiff, projectAuditReport } from '../../src/audit/baseline.js';
import { buildFileAuditReport } from '../../src/cli/commands/report.js';

describe('committed audit baseline', () => {
  it('matches minimal-tool.json at this version', async () => {
    const report = await buildFileAuditReport('tests/fixtures/valid/minimal-tool.json');
    const actual = projectAuditReport(report);
    const expected = await readFile('tests/fixtures/audit/minimal-tool.baseline.json', 'utf8');
    expect(auditBaselineDiff(actual, expected)).toBeNull();
    expect(actual).toContain('"version": "1.0.4"');
    expect(actual).toContain('No schema errors in this run. Recovery, preflight, and live inspection were not measured.');
  });
});
