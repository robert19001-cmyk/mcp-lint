import { readFile, writeFile } from 'node:fs/promises';
import type { Command } from 'commander';
import { auditBaselineDiff, projectAuditReport } from '../../audit/baseline.js';
import { buildAuditReport } from '../../audit/report.js';
import { formatAuditReport } from '../../audit/format.js';
import { loadConfig } from '../../config/config.js';
import { loadPluginRules } from '../../config/plugin-loader.js';
import { LintEngine } from '../../core/engine.js';
import type { ClientId, Config } from '../../core/rule.js';
import { loadFile } from '../../loaders/file-loader.js';
import { allRules } from '../../rules/index.js';
import { DEFAULT_TOKEN_THRESHOLDS, type TokenThresholds } from '../../audit/tokens.js';

export async function buildFileAuditReport(file: string, options: {
  config?: Config;
  pluginRules?: typeof allRules;
  generatedAt?: string;
  version?: string;
  thresholds?: TokenThresholds;
} = {}) {
  const tools = await loadFile(file);
  const engine = new LintEngine([...allRules, ...(options.pluginRules ?? [])], options.config ?? {});
  return buildAuditReport({
    source: file,
    tools,
    diagnostics: engine.lint(tools),
    generatedAt: options.generatedAt,
    version: options.version,
    thresholds: options.thresholds,
  });
}

export function registerReportCommand(program: Command): void {
  program
    .command('report <file>')
    .description('Write an MCPAuditReport for one tools file. Does not change check --format json.')
    .option('--format <format>', 'terminal, json, markdown, sarif, or html', 'terminal')
    .option('--output <path>', 'Write the report to a file')
    .option('--no-color', 'Disable terminal color')
    .option('--config <path>', 'Path to .mcplintrc.json')
    .option('--clients <clients>', 'Comma-separated client filter')
    .option('--ignore <tools>', 'Comma-separated tool names to skip')
    .option('--token-warn <n>', 'Approximate token warn threshold', String(DEFAULT_TOKEN_THRESHOLDS.warn))
    .option('--token-over <n>', 'Approximate token over threshold', String(DEFAULT_TOKEN_THRESHOLDS.over))
    .option('--baseline <path>', 'Fail when the stable audit report differs from this snapshot')
    .option('--update-baseline <path>', 'Write the stable audit report snapshot')
    .action(async (file: string, options: {
      format: string;
      output?: string;
      color: boolean;
      config?: string;
      clients?: string;
      ignore?: string;
      tokenWarn: string;
      tokenOver: string;
      baseline?: string;
      updateBaseline?: string;
    }) => {
      try {
        const fileConfig = await loadConfig(options.config);
        const cliClients = options.clients
          ? (options.clients.split(',').map((part) => part.trim()) as ClientId[])
          : undefined;
        const config: Config = {
          ...fileConfig,
          ...(cliClients ? { clients: cliClients } : {}),
          ignore: [
            ...(fileConfig.ignore ?? []),
            ...(options.ignore ? options.ignore.split(',').map((part) => part.trim()) : []),
          ],
        };
        const thresholds = {
          ...DEFAULT_TOKEN_THRESHOLDS,
          warn: positiveInt(options.tokenWarn, '--token-warn'),
          over: positiveInt(options.tokenOver, '--token-over'),
        };
        if (options.baseline && options.updateBaseline) {
          throw new Error('Pass either --baseline or --update-baseline, not both.');
        }
        const pluginRules = await loadPluginRules(fileConfig);
        const report = await buildFileAuditReport(file, { config, pluginRules, thresholds });
        const projection = projectAuditReport(report);
        if (options.updateBaseline) {
          await writeFile(options.updateBaseline, projection, 'utf8');
        }
        if (options.baseline) {
          const expected = await readFile(options.baseline, 'utf8');
          const diff = auditBaselineDiff(projection, expected);
          if (diff) {
            process.stderr.write(`Error: ${diff}\n`);
            process.exit(1);
          }
        }
        const rendered = formatAuditReport(report, options.format, !options.color);
        if (options.output) await writeFile(options.output, rendered, 'utf8');
        else process.stdout.write(rendered);
        const errors = report.severity.status === 'ran' ? report.severity.data.error : 0;
        process.exit(errors > 0 ? 1 : 0);
      } catch (err) {
        process.stderr.write(`Error: ${(err as Error).message}\n`);
        process.exit(1);
      }
    });
}

function positiveInt(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${flag} must be a positive integer.`);
  }
  return parsed;
}
