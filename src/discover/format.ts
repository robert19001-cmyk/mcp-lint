import chalk from 'chalk';
import type { Diagnostic } from '../core/diagnostic.js';
import { formatMarkdown } from '../cli/formatters/markdown.js';
import { formatTerminal } from '../cli/formatters/terminal.js';

export interface DiscoveredFile {
  file: string;
  diagnostics: Diagnostic[];
}

export function formatDiscovered(groups: DiscoveredFile[], format: string, noColor = false): string {
  if (format === 'json') {
    return `${JSON.stringify({
      files: groups.map((group) => ({
        file: group.file,
        diagnostics: group.diagnostics.map(({ fix: _fix, ...diagnostic }) => diagnostic),
      })),
    }, null, 2)}\n`;
  }

  if (format === 'markdown') {
    return `${groups.map((group) => `## ${group.file}\n\n${formatMarkdown(group.diagnostics).trimEnd()}`).join('\n\n')}\n`;
  }

  if (noColor) chalk.level = 0;
  return `${groups.map((group) => `${chalk.bold(group.file)}\n${formatTerminal(group.diagnostics, noColor)}`).join('\n')}`;
}
