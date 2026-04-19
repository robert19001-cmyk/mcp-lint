import type { Command } from 'commander';
import { loadFile } from '../../loaders/file-loader.js';
import { LintEngine } from '../../core/engine.js';
import { allRules } from '../../rules/index.js';
import { loadConfig, DEFAULT_CONFIG } from '../../config/config.js';
import { loadPluginRules } from '../../config/plugin-loader.js';
import type { ClientId } from '../../core/rule.js';
import type { Diagnostic } from '../../core/diagnostic.js';
import chalk from 'chalk';

interface DiffResult {
  fixed: Diagnostic[];
  introduced: Diagnostic[];
  unchanged: Diagnostic[];
}

function diffDiagnostics(before: Diagnostic[], after: Diagnostic[]): DiffResult {
  const key = (d: Diagnostic) => `${d.toolName}::${d.ruleId}::${d.path}`;

  const beforeMap = new Map(before.map((d) => [key(d), d]));
  const afterMap = new Map(after.map((d) => [key(d), d]));

  const fixed = before.filter((d) => !afterMap.has(key(d)));
  const introduced = after.filter((d) => !beforeMap.has(key(d)));
  const unchanged = after.filter((d) => beforeMap.has(key(d)));

  return { fixed, introduced, unchanged };
}

function formatDiffTerminal(diff: DiffResult, noColor: boolean): string {
  if (noColor) chalk.level = 0;

  const lines: string[] = [''];

  if (diff.introduced.length === 0 && diff.fixed.length === 0) {
    lines.push(chalk.dim('No changes in lint results.\n'));
    return lines.join('\n');
  }

  if (diff.introduced.length > 0) {
    lines.push(chalk.bold.red(`✖ ${diff.introduced.length} new issue${diff.introduced.length !== 1 ? 's' : ''} introduced:`));
    for (const d of diff.introduced) {
      const icon = d.severity === 'error' ? chalk.red('✖') : chalk.yellow('⚠');
      lines.push(`  ${icon} [${d.toolName}] ${chalk.red(d.message)}`);
      lines.push(`    ${chalk.gray(d.path)}  ${chalk.dim(`[${d.ruleId}]`)}`);
    }
    lines.push('');
  }

  if (diff.fixed.length > 0) {
    lines.push(chalk.bold.green(`✔ ${diff.fixed.length} issue${diff.fixed.length !== 1 ? 's' : ''} fixed:`));
    for (const d of diff.fixed) {
      lines.push(`  ${chalk.green('✔')} [${d.toolName}] ${chalk.green(d.message)}`);
      lines.push(`    ${chalk.gray(d.path)}  ${chalk.dim(`[${d.ruleId}]`)}`);
    }
    lines.push('');
  }

  if (diff.unchanged.length > 0) {
    lines.push(chalk.dim(`${diff.unchanged.length} existing issue${diff.unchanged.length !== 1 ? 's' : ''} unchanged.`));
    lines.push('');
  }

  return lines.join('\n');
}

function formatDiffJson(diff: DiffResult): string {
  return JSON.stringify({
    introduced: diff.introduced,
    fixed: diff.fixed,
    unchanged: diff.unchanged,
    summary: {
      introduced: diff.introduced.length,
      fixed: diff.fixed.length,
      unchanged: diff.unchanged.length,
    },
  }, null, 2) + '\n';
}

function formatDiffMarkdown(diff: DiffResult): string {
  const lines: string[] = [];

  if (diff.introduced.length === 0 && diff.fixed.length === 0) {
    lines.push('_No changes in lint results._');
    return lines.join('\n') + '\n';
  }

  if (diff.introduced.length > 0) {
    lines.push(`### ❌ ${diff.introduced.length} new issue${diff.introduced.length !== 1 ? 's' : ''} introduced`);
    lines.push('');
    for (const d of diff.introduced) {
      lines.push(`- **[${d.toolName}]** \`${d.ruleId}\` — ${d.message}`);
    }
    lines.push('');
  }

  if (diff.fixed.length > 0) {
    lines.push(`### ✅ ${diff.fixed.length} issue${diff.fixed.length !== 1 ? 's' : ''} fixed`);
    lines.push('');
    for (const d of diff.fixed) {
      lines.push(`- **[${d.toolName}]** \`${d.ruleId}\` — ${d.message}`);
    }
    lines.push('');
  }

  if (diff.unchanged.length > 0) {
    lines.push(`_${diff.unchanged.length} existing issue${diff.unchanged.length !== 1 ? 's' : ''} unchanged._`);
  }

  return lines.join('\n') + '\n';
}

export function registerDiffCommand(program: Command): void {
  program
    .command('diff <before> <after>')
    .description('Compare lint results between two schema versions')
    .option('--format <format>', 'Output format: terminal|json|markdown', 'terminal')
    .option('--no-color', 'Disable terminal colors')
    .option('--config <path>', 'Path to .mcplintrc.json config file')
    .option('--clients <clients>', 'Comma-separated client filter')
    .action(async (
      before: string,
      after: string,
      options: { format: string; color: boolean; config?: string; clients?: string },
    ) => {
      try {
        const fileConfig = await loadConfig(options.config);
        const cliClients = options.clients
          ? (options.clients.split(',').map((s) => s.trim()) as ClientId[])
          : undefined;
        const config = {
          clients: DEFAULT_CONFIG.clients as ClientId[],
          ...fileConfig,
          ...(cliClients ? { clients: cliClients } : {}),
        };

        const [toolsBefore, toolsAfter] = await Promise.all([
          loadFile(before),
          loadFile(after),
        ]);

        const pluginRules = await loadPluginRules(config);
        const engine = new LintEngine([...allRules, ...pluginRules], config);
        const diagBefore = engine.lint(toolsBefore);
        const diagAfter = engine.lint(toolsAfter);
        const diff = diffDiagnostics(diagBefore, diagAfter);

        let output: string;
        if (options.format === 'json') {
          output = formatDiffJson(diff);
        } else if (options.format === 'markdown') {
          output = formatDiffMarkdown(diff);
        } else {
          output = formatDiffTerminal(diff, !options.color);
        }

        process.stdout.write(output);

        const hasNewErrors = diff.introduced.some((d) => d.severity === 'error');
        process.exit(hasNewErrors ? 1 : 0);
      } catch (err) {
        process.stderr.write(`Error: ${(err as Error).message}\n`);
        process.exit(2);
      }
    });
}
