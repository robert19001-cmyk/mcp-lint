import type { Command } from 'commander';
import { loadFile } from '../../loaders/file-loader.js';
import { loadStdio } from '../../loaders/stdio-loader.js';
import { loadSSE } from '../../loaders/sse-loader.js';
import { LintEngine } from '../../core/engine.js';
import { allRules } from '../../rules/index.js';
import { formatTerminal } from '../formatters/terminal.js';
import { formatJson } from '../formatters/json.js';
import { formatMarkdown } from '../formatters/markdown.js';
import { loadConfig } from '../../config/config.js';
import type { Config, Severity, ClientId } from '../../core/rule.js';
import type { Diagnostic } from '../../core/diagnostic.js';
import type { MCPTool } from '../../core/rule.js';
import { writeFile } from 'fs/promises';
const SEVERITY_ORDER: Record<Severity, number> = { error: 3, warning: 2, info: 1 };

function filterBySeverity(diagnostics: Diagnostic[], min: Severity): Diagnostic[] {
  return diagnostics.filter((d) => SEVERITY_ORDER[d.severity] >= SEVERITY_ORDER[min]);
}

export function registerCheckCommand(program: Command): void {
  program
    .command('check [input]')
    .description('Check MCP tool schemas for compatibility issues')
    .option('--format <format>', 'Output format: terminal|json|markdown', 'terminal')
    .option('--no-color', 'Disable terminal colors')
    .option('--config <path>', 'Path to .mcplintrc.json config file')
    .option('--severity <level>', 'Minimum severity to report: error|warning|info')
    .option('--clients <clients>', 'Comma-separated client filter: claude,cursor,gemini,vscode')
    .option('--ignore <tools>', 'Comma-separated tool names to skip')
    .option('--quiet', 'Only output errors (no warnings/info)')
    .option('--server <type>', 'Server transport: stdio|sse')
    .option('--url <url>', 'SSE server URL (use with --server sse)')
    .option('--output-file <path>', 'Write results to a file instead of stdout')
    .allowExcessArguments(true)
    .action(async (
      input: string | undefined,
      options: {
        format: string;
        color: boolean;
        config?: string;
        severity?: string;
        clients?: string;
        ignore?: string;
        quiet?: boolean;
        server?: string;
        url?: string;
        outputFile?: string;
      },
    ) => {
      try {
        const fileConfig = await loadConfig(options.config);

        const cliClients = options.clients
          ? (options.clients.split(',').map((s) => s.trim()) as ClientId[])
          : undefined;

        const config: Config = {
          ...fileConfig,
          ...(cliClients ? { clients: cliClients } : {}),
          ignore: [
            ...(fileConfig.ignore ?? []),
            ...(options.ignore ? options.ignore.split(',').map((s) => s.trim()) : []),
          ],
        };

        let tools: MCPTool[];

        if (options.server === 'stdio') {
          // Get everything after '--' in process.argv
          const rawArgv = process.argv;
          const sepIdx = rawArgv.indexOf('--');
          if (sepIdx === -1 || sepIdx >= rawArgv.length - 1) {
            throw new Error('--server stdio requires a command after --, e.g.: mcp-lint check --server stdio -- node server.js');
          }
          const [cmd, ...cmdArgs] = rawArgv.slice(sepIdx + 1);
          tools = await loadStdio(cmd, cmdArgs);
        } else if (options.server === 'sse') {
          if (!options.url) throw new Error('--server sse requires --url <url>');
          tools = await loadSSE(options.url);
        } else {
          if (!input) throw new Error('Specify an input file or use --server stdio|sse');
          tools = await loadFile(input);
        }

        const engine = new LintEngine(allRules, config);
        let diagnostics = engine.lint(tools);

        const minSeverity: Severity = options.quiet
          ? 'error'
          : (options.severity as Severity | undefined) ?? 'info';

        diagnostics = filterBySeverity(diagnostics, minSeverity);

        let output: string;
        if (options.format === 'json') {
          output = formatJson(diagnostics);
        } else if (options.format === 'markdown') {
          output = formatMarkdown(diagnostics);
        } else {
          output = formatTerminal(diagnostics, !options.color);
        }

        if (options.outputFile) {
          await writeFile(options.outputFile, output, 'utf8');
        } else {
          process.stdout.write(output);
        }

        const hasErrors = diagnostics.some((d) => d.severity === 'error');
        process.exit(hasErrors ? 1 : 0);
      } catch (err) {
        process.stderr.write(`Error: ${(err as Error).message}\n`);
        process.exit(2);
      }
    });
}
