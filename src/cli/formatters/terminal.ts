import chalk from 'chalk';
import type { Diagnostic } from '../../core/diagnostic.js';
import { layoutDiagnostics, type TitleItem } from './layout.js';

const ICONS = { error: '✖', warning: '⚠', info: 'ℹ' } as const;

export function formatTerminal(diagnostics: Diagnostic[], noColor = false, source?: string): string {
  if (noColor) chalk.level = 0;

  if (diagnostics.length === 0) {
    return chalk.green('✔ No issues found.\n');
  }

  const layout = layoutDiagnostics(diagnostics);
  const lines: string[] = [''];

  if (layout.index.length > 0) {
    lines.push(chalk.bold('Errors'));
    for (const row of layout.index) {
      lines.push(`  ${chalk.red(`${row.name}  ${row.count}`)}  ${chalk.dim(row.rules.join(', '))}`);
    }
    lines.push('');
  }

  for (const tool of layout.tools) {
    lines.push(chalk.bold(tool.name));
    for (const item of tool.items) {
      if (item.kind === 'finding') writeDiagnostic(lines, item.diagnostic);
      else writeCollapsedTitles(lines, item);
    }
    lines.push('');
  }

  const errors = diagnostics.filter(d => d.severity === 'error').length;
  const warnings = diagnostics.filter(d => d.severity === 'warning').length;
  const infos = diagnostics.filter(d => d.severity === 'info').length;

  const summary: string[] = [];
  if (errors > 0) summary.push(chalk.red(`${errors} error${errors !== 1 ? 's' : ''}`));
  if (warnings > 0) summary.push(chalk.yellow(`${warnings} warning${warnings !== 1 ? 's' : ''}`));
  if (infos > 0) summary.push(chalk.blue(`${infos} info`));

  lines.push(summary.join(', '));
  if (layout.explainRule) {
    lines.push(`Next: mcp-lint explain ${layout.explainRule}`);
    if (layout.hasSafeFix) lines.push(`      mcp-lint fix ${source ?? '<file>'} --dry-run`);
  }
  lines.push('');

  return lines.join('\n');
}

function writeDiagnostic(lines: string[], d: Diagnostic): void {
  const icon = d.severity === 'error'
    ? chalk.red(ICONS.error)
    : d.severity === 'warning'
      ? chalk.yellow(ICONS.warning)
      : chalk.blue(ICONS.info);

  const msgColor = d.severity === 'error'
    ? chalk.red
    : d.severity === 'warning'
      ? chalk.yellow
      : chalk.blue;

  lines.push(`  ${icon} ${msgColor(d.message)}`);
  lines.push(`    ${chalk.gray(d.path)}  ${chalk.dim(`[${d.ruleId}]`)}`);
}

function writeCollapsedTitles(lines: string[], titles: TitleItem): void {
  const shown = titles.paths.slice(0, 3);
  const extra = titles.count - shown.length;
  const where = extra > 0 ? `${shown.join(', ')}, +${extra}` : shown.join(', ');
  lines.push(`  ${chalk.yellow(ICONS.warning)} ${chalk.yellow(`${titles.count} missing titles. Cursor can display raw names without them.`)}`);
  lines.push(`    ${chalk.gray(where)}  ${chalk.dim(`[${titles.ruleId}]`)}`);
}
