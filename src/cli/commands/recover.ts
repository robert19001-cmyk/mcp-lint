import type { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import chalk from 'chalk';
import { scoreRecovery } from '../../recover/score.js';
import { probeStdio } from '../../recover/probe.js';
import type { RecoveryFile, RecoveryReport, RecoverySampleInput } from '../../recover/types.js';
import { DEFAULT_HANG_MS } from '../../recover/types.js';

export function registerRecoverCommand(program: Command): void {
  program
    .command('recover [file]')
    .description('Score MCP tool failures for whether an agent limited to tools can recover')
    .option('--format <format>', 'Output format: terminal|json', 'terminal')
    .option('--no-color', 'Disable terminal colors')
    .option('--server <type>', 'Probe a live server: stdio')
    .option('--hang-ms <ms>', 'Hang budget in milliseconds', String(DEFAULT_HANG_MS))
    .allowExcessArguments(true)
    .action(async (
      file: string | undefined,
      options: { format: string; color: boolean; server?: string; hangMs: string },
    ) => {
      if (!options.color) chalk.level = 0;
      const hangMs = Number(options.hangMs);
      if (!Number.isInteger(hangMs) || hangMs < 1) {
        process.stderr.write('Error: --hang-ms must be a positive integer\n');
        process.exit(2);
      }

      try {
        let report: RecoveryReport;
        let skipped: string[] = [];

        if (options.server === 'stdio') {
          const rawArgv = process.argv;
          const sepIdx = rawArgv.indexOf('--');
          if (sepIdx === -1 || sepIdx >= rawArgv.length - 1) {
            throw new Error('--server stdio requires a command after --, e.g.: mcp-lint recover --server stdio -- node server.js');
          }
          const [cmd, ...cmdArgs] = rawArgv.slice(sepIdx + 1);
          const probed = await probeStdio(cmd, cmdArgs, { hangMs });
          report = probed.report;
          skipped = probed.skipped;
        } else if (options.server) {
          throw new Error(`Unknown server transport "${options.server}". Use stdio.`);
        } else {
          if (!file) throw new Error('Specify a recovery file or use --server stdio -- <command>');
          const parsed = JSON.parse(await readFile(file, 'utf8')) as RecoveryFile;
          report = scoreRecovery(samplesFromFile(parsed), { hangMs: parsed.hangMs ?? hangMs, tools: parsed.tools });
        }

        const output = options.format === 'json'
          ? JSON.stringify({ ...report, skipped }, null, 2) + '\n'
          : renderTerminal(report, skipped);
        process.stdout.write(output);
        process.exit(report.errors > 0 ? 1 : 0);
      } catch (err) {
        process.stderr.write(`Error: ${(err as Error).message}\n`);
        process.exit(2);
      }
    });
}

function samplesFromFile(parsed: RecoveryFile): RecoverySampleInput[] {
  if (!parsed || !Array.isArray(parsed.samples)) {
    throw new Error('Recovery file must be { "tools": string[], "samples": [...] }');
  }
  if (!Array.isArray(parsed.tools) || parsed.tools.length === 0) {
    throw new Error('Recovery file must list the server tools in "tools"');
  }
  return parsed.samples;
}

function renderTerminal(report: RecoveryReport, skipped: string[]): string {
  const lines: string[] = [''];
  if (report.findings.length === 0) {
    lines.push(chalk.green(`All ${report.samples} failure${report.samples === 1 ? '' : 's'} are recoverable.`));
  } else {
    const grouped = new Map<string, typeof report.findings>();
    for (const item of report.findings) {
      const bucket = grouped.get(item.sampleId) ?? [];
      bucket.push(item);
      grouped.set(item.sampleId, bucket);
    }
    for (const [sampleId, items] of grouped) {
      lines.push(chalk.bold(sampleId));
      for (const item of items) {
        const mark = item.severity === 'error' ? chalk.red('✖') : chalk.yellow('⚠');
        lines.push(`  ${mark} ${item.message}`);
        lines.push(chalk.dim(`    [${item.ruleId}]`));
      }
      lines.push('');
    }
  }

  if (skipped.length > 0) {
    lines.push(chalk.dim(`Skipped ${skipped.length} tool${skipped.length === 1 ? '' : 's'} with no required arguments: ${skipped.join(', ')}`));
  }

  const summary = `${report.errors} error${report.errors === 1 ? '' : 's'}, ${report.recoverable} recoverable of ${report.samples}`;
  lines.push(report.errors > 0 ? chalk.red(summary) : chalk.green(summary));
  lines.push('');
  return lines.join('\n');
}
