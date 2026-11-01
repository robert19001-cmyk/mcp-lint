import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildFileAuditReport } from '../../src/cli/commands/report.js';
import { escapeHtml, formatAuditReport } from '../../src/audit/format.js';
import { buildAuditReport, parseAuditReport } from '../../src/audit/report.js';
import type { Diagnostic } from '../../src/core/diagnostic.js';

const generatedAt = '2026-11-01T00:00:00.000Z';

function finding(message: string): Diagnostic {
  return {
    ruleId: 'description-exists',
    severity: 'info',
    message,
    toolName: '<script>',
    path: 'description "quoted"',
    clients: ['claude'],
  };
}

function reportWith(message: string) {
  return buildAuditReport({
    source: 'tools.json',
    generatedAt,
    version: '0.9.0',
    tools: [{ name: '<script>', description: 'Find documents.', inputSchema: { type: 'object' } }],
    diagnostics: [finding(message)],
  });
}

describe('formatAuditReport', () => {
  it('round-trips json through the audit schema', () => {
    const report = reportWith('Missing description');
    const parsed = parseAuditReport(JSON.parse(formatAuditReport(report, 'json')));
    expect(parsed.findings.status).toBe('ran');
    expect(parsed.tool.version).toBe('0.9.0');
  });

  it('renders markdown with the estimate label and a not-run section', () => {
    const output = formatAuditReport(reportWith('Missing description'), 'markdown');
    expect(output).toContain('chars / 4');
    expect(output).toContain('recovery');
    expect(output).toContain('description-exists');
    expect(output).toContain('not a pass');
  });

  it('renders terminal text without color codes when asked', () => {
    const output = formatAuditReport(reportWith('Missing description'), 'terminal', true);
    expect(output).not.toContain('\u001b');
    expect(output).toContain('description-exists');
    expect(output).toContain('approximate');
  });

  it('emits SARIF 2.1.0 and does not treat info as an error', () => {
    const sarif = JSON.parse(formatAuditReport(reportWith('Missing description'), 'sarif')) as {
      version: string;
      runs: Array<{
        results: Array<{ level: string; ruleId: string; locations: unknown[] }>;
        invocations: Array<{ toolExecutionNotifications: unknown[] }>;
      }>;
    };
    expect(sarif.version).toBe('2.1.0');
    expect(sarif.runs[0].results[0]).toMatchObject({
      ruleId: 'description-exists',
      level: 'note',
    });
    expect(sarif.runs[0].invocations[0].toolExecutionNotifications.length).toBeGreaterThan(0);
    expect(JSON.stringify(sarif)).not.toContain('"startLine"');
  });

  it('escapes HTML text and does not emit a script tag', () => {
    const payload = `<script>alert("x")</script> & 'quote'`;
    const html = formatAuditReport(reportWith(payload), 'html');
    expect(html).toContain(escapeHtml(payload));
    expect(html).toContain('&lt;script&gt;');
    expect(html.toLowerCase()).not.toContain('<script');
    expect(html).not.toContain(payload);
  });

  it('rejects an unknown format', () => {
    expect(() => formatAuditReport(reportWith('x'), 'pdf')).toThrow(/Unknown format/);
  });
});

describe('buildFileAuditReport', () => {
  it('lints a tools file and keeps an error in the report', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mcp-lint-report-'));
    const file = join(dir, 'tools.json');
    await writeFile(file, JSON.stringify([
      {
        name: 'search',
        description: 'Find documents in the index.',
        inputSchema: { type: 'object', properties: { query: { type: 'string', required: false } } },
      },
    ]));
    const report = await buildFileAuditReport(file, { generatedAt, version: '0.9.0' });
    expect(report.severity.status).toBe('ran');
    if (report.severity.status === 'ran') expect(report.severity.data.error).toBeGreaterThan(0);
    if (report.findings.status === 'ran') {
      expect(report.findings.data.some((item) => item.ruleId === 'no-required-false')).toBe(true);
    }
    const sarif = formatAuditReport(report, 'sarif');
    expect(sarif).toContain('"level": "error"');
    expect(sarif).toContain('no-required-false');
  });

  it('withholds the quality score for an empty tools file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mcp-lint-report-empty-'));
    const file = join(dir, 'tools.json');
    await writeFile(file, '[]\n');
    const report = await buildFileAuditReport(file, { generatedAt });
    expect(report.quality.status).toBe('not_run');
  });
});
