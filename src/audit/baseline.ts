import type { MCPAuditReport } from './report.js';

const STABLE_TIME = '1970-01-01T00:00:00.000Z';

export function projectAuditReport(report: MCPAuditReport): string {
  return JSON.stringify({ ...report, generatedAt: STABLE_TIME }, null, 2) + '\n';
}

export function auditBaselineDiff(actual: string, expected: string): string | null {
  if (actual === expected) return null;
  const actualLines = actual.split('\n');
  const expectedLines = expected.split('\n');
  const limit = Math.max(actualLines.length, expectedLines.length);
  for (let index = 0; index < limit; index += 1) {
    if (actualLines[index] !== expectedLines[index]) {
      return `Audit baseline differs at line ${index + 1}. Pass --update-baseline to replace the snapshot.`;
    }
  }
  return 'Audit baseline differs. Pass --update-baseline to replace the snapshot.';
}
