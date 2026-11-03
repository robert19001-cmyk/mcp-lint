import chalk from 'chalk';
import type { AuditFinding, MCPAuditReport } from './report.js';

export const AUDIT_FORMATS = ['terminal', 'json', 'markdown', 'sarif', 'html'] as const;
export type AuditFormat = (typeof AUDIT_FORMATS)[number];

const SITE = 'https://mcp-lint-alpha.vercel.app/';

export function formatAuditReport(
  report: MCPAuditReport,
  format: string,
  noColor = false,
): string {
  switch (format) {
    case 'json':
      return JSON.stringify(report, null, 2) + '\n';
    case 'markdown':
      return formatMarkdownReport(report);
    case 'terminal':
      return formatTerminalReport(report, noColor);
    case 'sarif':
      return formatSarif(report);
    case 'html':
      return formatHtml(report);
    default:
      throw new Error(`Unknown format "${format}". Use ${AUDIT_FORMATS.join(', ')}.`);
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function compatibilitySummary(report: MCPAuditReport): string | null {
  if (report.compatibility.status !== 'ran') return null;
  let measured = 0;
  let errors = 0;
  for (const tool of report.compatibility.data.tools) {
    for (const cell of Object.values(tool.cells)) {
      if (cell.evidence === 'measured') measured += 1;
      errors += cell.errorCount;
    }
  }
  const count = report.compatibility.data.tools.length;
  const noun = count === 1 ? 'tool' : 'tools';
  return `Compatibility ran for ${count} ${noun}. Measured cells: ${measured}. Client errors: ${errors}. A not_observed cell is not proof that the client accepts the schema.`;
}

function findingRows(findings: AuditFinding[]): string {
  return findings.map((finding) => {
    const cells = [finding.severity, finding.toolName, finding.ruleId, finding.path, finding.message]
      .map((cell) => cell.replace(/\|/g, '\\|').replace(/\n/g, ' '));
    return `| ${cells.join(' | ')} |`;
  }).join('\n');
}

function formatMarkdownReport(report: MCPAuditReport): string {
  const counts = report.severity.status === 'ran'
    ? `${report.severity.data.error} errors, ${report.severity.data.warning} warnings, ${report.severity.data.info} info`
    : report.severity.reason;
  const findings = report.findings.status === 'ran'
    ? (report.findings.data.length === 0
      ? 'No schema findings in this run.\n'
      : [
          '| Severity | Tool | Rule | Path | Message |',
          '| --- | --- | --- | --- | --- |',
          findingRows(report.findings.data),
          '',
        ].join('\n'))
    : `${report.findings.reason}\n`;
  const tokens = report.tokenBudget.status === 'ran'
    ? [
        `Approximate \`chars / 4\` estimate: **${report.tokenBudget.data.tokens}** tokens (${report.tokenBudget.data.chars} chars), level \`${report.tokenBudget.data.level}\`.`,
        report.tokenBudget.data.note,
        '',
      ].join('\n')
    : `${report.tokenBudget.status === 'partial' ? report.tokenBudget.reason : report.tokenBudget.reason}\n`;
  const notRun = report.coverage.notRun.map((name) => `- ${name}`).join('\n');
  const recommendations = report.recommendations.map((line) => `- ${line}`).join('\n');
  const compatibility = compatibilitySummary(report);
  return [
    `# mcp-lint report`,
    '',
    `Source: \`${report.scope.source}\``,
    `Generated: ${report.generatedAt}`,
    `Tool: mcp-lint ${report.tool.version}`,
    `Schema: ${report.schemaVersion}`,
    '',
    '## Summary',
    '',
    counts,
    `Confidence: ${report.coverage.confidence}. A section marked not run is not a pass.`,
    '',
    '## Findings',
    '',
    findings.trimEnd(),
    '',
    '## Token estimate',
    '',
    tokens.trimEnd(),
    '',
    ...(compatibility ? ['## Compatibility', '', compatibility, ''] : []),
    '## Not measured',
    '',
    notRun || '- none',
    '',
    '## Recommendations',
    '',
    recommendations || '- none',
    '',
  ].join('\n');
}

function formatTerminalReport(report: MCPAuditReport, noColor: boolean): string {
  const tone = (severity: string, text: string) => {
    if (noColor) return text;
    if (severity === 'error') return chalk.red(text);
    if (severity === 'warning') return chalk.yellow(text);
    return chalk.blue(text);
  };
  const lines = [
    `${noColor ? '' : chalk.bold('')}mcp-lint report  ${report.scope.source}`.trim(),
    report.severity.status === 'ran'
      ? `${report.severity.data.error} errors, ${report.severity.data.warning} warnings, ${report.severity.data.info} info`
      : report.severity.reason,
  ];
  if (report.findings.status === 'ran') {
    for (const finding of report.findings.data) {
      lines.push(tone(finding.severity, `${finding.severity}  ${finding.toolName}  ${finding.message}`));
      lines.push(`  ${finding.path}  [${finding.ruleId}]`);
    }
    if (report.findings.data.length === 0) lines.push('No schema findings in this run.');
  } else {
    lines.push(report.findings.reason);
  }
  if (report.tokenBudget.status === 'ran') {
    lines.push(`Token estimate (chars/4, approximate): ${report.tokenBudget.data.tokens}  level ${report.tokenBudget.data.level}`);
  }
  const compatibility = compatibilitySummary(report);
  if (compatibility) lines.push(compatibility);
  for (const line of report.recommendations) lines.push(line);
  lines.push(`Not measured: ${report.coverage.notRun.join(', ')}`);
  return lines.join('\n') + '\n';
}

function formatSarif(report: MCPAuditReport): string {
  const findings = report.findings.status === 'ran' ? report.findings.data : [];
  const ruleIds = [...new Set(findings.map((finding) => finding.ruleId))].sort((a, b) => a.localeCompare(b));
  const ruleIndex = new Map(ruleIds.map((id, index) => [id, index]));
  const notifications = report.coverage.notRun.map((name) => ({
    message: { text: `${name} did not run. An empty result is not a pass for that section.` },
    level: 'note',
  }));
  const sarif = {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'mcp-lint',
            version: report.tool.version,
            informationUri: SITE,
            rules: ruleIds.map((id) => ({
              id,
              shortDescription: { text: id },
            })),
          },
        },
        invocations: [
          {
            executionSuccessful: true,
            toolExecutionNotifications: notifications,
          },
        ],
        results: findings.map((finding) => ({
          ruleId: finding.ruleId,
          ruleIndex: ruleIndex.get(finding.ruleId),
          level: finding.severity === 'error' ? 'error' : finding.severity === 'warning' ? 'warning' : 'note',
          message: { text: finding.message },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: encodeURI(report.scope.source) },
              },
              logicalLocations: [
                {
                  name: finding.toolName,
                  fullyQualifiedName: `${finding.toolName}.${finding.path}`,
                },
              ],
            },
          ],
          partialFingerprints: {
            'mcpLint/v1': `${finding.toolName}/${finding.ruleId}/${finding.path}`,
          },
          properties: {
            clients: finding.clients,
            fixable: finding.fixable,
          },
        })),
      },
    ],
  };
  return JSON.stringify(sarif, null, 2) + '\n';
}

function formatHtml(report: MCPAuditReport): string {
  const findings = report.findings.status === 'ran'
    ? (report.findings.data.length === 0
      ? '<p>No schema findings in this run.</p>'
      : `<table>
<thead><tr><th>Severity</th><th>Tool</th><th>Rule</th><th>Path</th><th>Message</th></tr></thead>
<tbody>
${report.findings.data.map((finding) => `<tr>
<td>${escapeHtml(finding.severity)}</td>
<td>${escapeHtml(finding.toolName)}</td>
<td><code>${escapeHtml(finding.ruleId)}</code></td>
<td><code>${escapeHtml(finding.path)}</code></td>
<td>${escapeHtml(finding.message)}</td>
</tr>`).join('\n')}
</tbody>
</table>`)
    : `<p>${escapeHtml(report.findings.reason)}</p>`;
  const tokens = report.tokenBudget.status === 'ran'
    ? `<p>Approximate chars/4 estimate: <strong>${report.tokenBudget.data.tokens}</strong> tokens, level ${escapeHtml(report.tokenBudget.data.level)}.</p><p>${escapeHtml(report.tokenBudget.data.note)}</p>`
    : `<p>${escapeHtml(report.tokenBudget.reason)}</p>`;
  const counts = report.severity.status === 'ran'
    ? `${report.severity.data.error} errors, ${report.severity.data.warning} warnings, ${report.severity.data.info} info`
    : report.severity.reason;
  const compatibility = compatibilitySummary(report);
  const compatibilityHtml = compatibility ? `<h2>Compatibility</h2><p>${escapeHtml(compatibility)}</p>` : '';
  const notRun = report.coverage.notRun.map((name) => `<li>${escapeHtml(name)}</li>`).join('');
  const recommendations = report.recommendations.map((line) => `<li>${escapeHtml(line)}</li>`).join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>mcp-lint report: ${escapeHtml(report.scope.source)}</title>
<style>
  body { margin: 0; background: #f3efe4; color: #1c1916; font: 16px/1.5 ui-sans-serif, system-ui, sans-serif; }
  main { max-width: 880px; margin: 0 auto; padding: 32px 20px 64px; }
  h1 { font-size: 32px; line-height: 1.15; margin-bottom: 8px; }
  h2 { font-size: 18px; margin-top: 32px; }
  p, li { max-width: 68ch; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; vertical-align: top; border-bottom: 1px solid #d9d2c5; padding: 8px; }
  code { font-family: ui-monospace, monospace; }
  .meta { color: #5c564e; }
</style>
</head>
<body>
<main>
<p class="meta">mcp-lint ${escapeHtml(report.tool.version)} · schema ${report.schemaVersion} · ${escapeHtml(report.generatedAt)}</p>
<h1>${escapeHtml(report.scope.source)}</h1>
<p>${escapeHtml(counts)}. Confidence ${escapeHtml(report.coverage.confidence)}. A section that did not run is not a pass.</p>
<h2>Findings</h2>
${findings}
<h2>Token estimate</h2>
${tokens}
${compatibilityHtml}
<h2>Not measured</h2>
<ul>${notRun}</ul>
<h2>Recommendations</h2>
<ul>${recommendations}</ul>
</main>
</body>
</html>
`;
}
