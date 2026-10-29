import chalk from 'chalk';
import { formatMarkdown } from '../cli/formatters/markdown.js';
import { formatTerminal } from '../cli/formatters/terminal.js';
import type { ServerReport } from './lint.js';

export function formatInstalled(reports: ServerReport[], format: string, noColor = false): string {
  if (format === 'json') return formatInstalledJson(reports);
  if (format === 'markdown') return formatInstalledMarkdown(reports);
  return formatInstalledTerminal(reports, noColor);
}

function formatInstalledTerminal(reports: ServerReport[], noColor: boolean): string {
  if (noColor) chalk.level = 0;
  const lines: string[] = [];
  for (const report of reports) {
    const where = `${report.server.sourceLabel}  ${report.server.sourcePath}`;
    lines.push(chalk.bold(where));
    lines.push(chalk.bold(`  ${report.server.name}`));
    if (report.status === 'skipped-remote') {
      lines.push(chalk.dim('  skipped remote URL. Pass --remote to connect.'));
      lines.push('');
      continue;
    }
    if (report.status === 'failed') {
      lines.push(chalk.red(`  failed to start: ${report.error ?? 'unknown error'}`));
      lines.push('');
      continue;
    }
    lines.push(chalk.dim(`  ${report.tools.length} tool${report.tools.length === 1 ? '' : 's'}`));
    lines.push(indent(formatTerminal(report.diagnostics, noColor)));
  }
  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

function formatInstalledMarkdown(reports: ServerReport[]): string {
  const lines: string[] = [];
  for (const report of reports) {
    lines.push(`## ${report.server.name}`);
    lines.push('');
    lines.push(`Source: \`${report.server.sourcePath}\``);
    lines.push('');
    if (report.status === 'skipped-remote') {
      lines.push('_Skipped remote URL. Pass `--remote` to connect._');
      lines.push('');
      continue;
    }
    if (report.status === 'failed') {
      lines.push(`Failed to start: ${report.error ?? 'unknown error'}`);
      lines.push('');
      continue;
    }
    lines.push(formatMarkdown(report.diagnostics).trimEnd());
    lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

function formatInstalledJson(reports: ServerReport[]): string {
  return `${JSON.stringify({
    servers: reports.map((report) => ({
      source: report.server.sourcePath,
      label: report.server.sourceLabel,
      name: report.server.name,
      status: report.status,
      toolCount: report.tools.length,
      ...(report.error ? { error: report.error } : {}),
      diagnostics: report.diagnostics.map(({ fix: _fix, ...diagnostic }) => diagnostic),
    })),
  }, null, 2)}\n`;
}

function indent(text: string): string {
  return text.split('\n').map((line) => (line.length > 0 ? `  ${line}` : line)).join('\n');
}
