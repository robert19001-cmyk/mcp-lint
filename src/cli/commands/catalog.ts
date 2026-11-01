import type { Command } from 'commander';
import { catalogRemote, catalogStdio } from '../../catalog/connect.js';
import {
  DEFAULT_CATALOG_MAX_BYTES,
  DEFAULT_CATALOG_MAX_ITEMS,
  DEFAULT_CATALOG_TIMEOUT_MS,
  type CatalogReport,
} from '../../catalog/list.js';

export function registerCatalogCommand(program: Command): void {
  program
    .command('catalog')
    .description('List resources and prompts from a live MCP server. Does not call tools.')
    .option('--server <type>', 'Server transport: stdio|sse|http')
    .option('--url <url>', 'Remote server URL for sse or http')
    .option('--timeout <ms>', 'Timeout in milliseconds', String(DEFAULT_CATALOG_TIMEOUT_MS))
    .option('--max-items <n>', 'Maximum items kept per list', String(DEFAULT_CATALOG_MAX_ITEMS))
    .option('--max-bytes <n>', 'Maximum JSON bytes kept per list', String(DEFAULT_CATALOG_MAX_BYTES))
    .option('--format <format>', 'Output format: json|terminal', 'terminal')
    .allowExcessArguments(true)
    .action(async (options: {
      server?: string;
      url?: string;
      timeout: string;
      maxItems: string;
      maxBytes: string;
      format: string;
    }) => {
      try {
        const limits = {
          timeoutMs: positiveInt(options.timeout, '--timeout'),
          maxItems: positiveInt(options.maxItems, '--max-items'),
          maxBytes: positiveInt(options.maxBytes, '--max-bytes'),
        };
        let report: CatalogReport;
        if (options.server === 'stdio') {
          const rawArgv = process.argv;
          const sepIdx = rawArgv.indexOf('--');
          if (sepIdx === -1 || sepIdx >= rawArgv.length - 1) {
            throw new Error('--server stdio requires a command after --, e.g.: mcp-lint catalog --server stdio -- node server.js');
          }
          const [cmd, ...cmdArgs] = rawArgv.slice(sepIdx + 1);
          report = await catalogStdio(cmd, cmdArgs, limits);
        } else if (options.server === 'sse' || options.server === 'http') {
          if (!options.url) throw new Error(`--server ${options.server} requires --url <url>`);
          report = await catalogRemote(options.url, options.server, limits);
        } else {
          throw new Error('catalog requires --server stdio|sse|http. It does not scan installed configs and it does not call tools.');
        }
        if (options.format !== 'json' && options.format !== 'terminal') {
          throw new Error('--format must be json or terminal');
        }
        process.stdout.write(options.format === 'json' ? JSON.stringify(report, null, 2) + '\n' : render(report));
        const failed = report.resources.status === 'failed' || report.prompts.status === 'failed';
        process.exit(failed ? 1 : 0);
      } catch (err) {
        process.stderr.write(`Error: ${(err as Error).message}\n`);
        process.exit(2);
      }
    });
}

function render(report: CatalogReport): string {
  const lines = ['', 'resources'];
  lines.push(...sectionLines(report.resources, (item) => `${item.uri}  ${item.name}`));
  lines.push('', 'prompts');
  lines.push(...sectionLines(report.prompts, (item) => item.title ? `${item.name}  ${item.title}` : item.name));
  lines.push('');
  return lines.join('\n');
}

function sectionLines<T>(section: { status: string; items: T[]; truncated: boolean; reason?: string }, line: (item: T) => string): string[] {
  if (section.status !== 'ran') return [`  ${section.status}: ${section.reason ?? section.status}`];
  const rows = section.items.map((item) => `  ${line(item)}`);
  if (section.truncated) rows.push('  truncated');
  if (rows.length === 0) rows.push('  none');
  return rows;
}

function positiveInt(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${flag} must be a positive integer`);
  return parsed;
}
