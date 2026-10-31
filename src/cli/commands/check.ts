import type { Command } from 'commander';
import { watch } from 'node:fs';
import { stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { discoverToolFiles, missingToolsMessage } from '../../discover/files.js';
import { formatDiscovered } from '../../discover/format.js';
import { loadFile } from '../../loaders/file-loader.js';
import { loadStdio } from '../../loaders/stdio-loader.js';
import { loadRemote } from '../../loaders/remote-loader.js';
import { loadSSE } from '../../loaders/sse-loader.js';
import { collectInstalledServers } from '../../installed/config.js';
import { formatInstalled } from '../../installed/format.js';
import { lintInstalledServers, type ServerReport } from '../../installed/lint.js';
import { LintEngine } from '../../core/engine.js';
import { allRules } from '../../rules/index.js';
import { formatTerminal } from '../formatters/terminal.js';
import { formatJson } from '../formatters/json.js';
import { formatMarkdown } from '../formatters/markdown.js';
import { loadConfig } from '../../config/config.js';
import { loadPluginRules } from '../../config/plugin-loader.js';
import type { Config, Severity, ClientId } from '../../core/rule.js';
import type { Diagnostic } from '../../core/diagnostic.js';
import type { MCPTool } from '../../core/rule.js';
import { writeFile } from 'fs/promises';
import chalk from 'chalk';
import { computeQualityReport } from '../../core/quality-score.js';

const SEVERITY_ORDER: Record<Severity, number> = { error: 3, warning: 2, info: 1 };

function filterBySeverity(diagnostics: Diagnostic[], min: Severity): Diagnostic[] {
  return diagnostics.filter((d) => SEVERITY_ORDER[d.severity] >= SEVERITY_ORDER[min]);
}

export function registerCheckCommand(program: Command): void {
  program
    .command('check [input]', { isDefault: true })
    .description('Check MCP tool schemas for compatibility issues')
    .option('--format <format>', 'Output format: terminal|json|markdown', 'terminal')
    .option('--no-color', 'Disable terminal colors')
    .option('--config <path>', 'Path to .mcplintrc.json config file')
    .option('--severity <level>', 'Minimum severity to report: error|warning|info')
    .option('--clients <clients>', 'Comma-separated client filter: claude,cursor,gemini,vscode')
    .option('--ignore <tools>', 'Comma-separated tool names to skip')
    .option('--quiet', 'Only output errors (no warnings/info)')
    .option('--server <type>', 'Server transport: stdio|sse|http')
    .option('--url <url>', 'Remote server URL (use with --server sse|http)')
    .option('--installed', 'Lint stdio servers declared in local Cursor, Claude, and VS Code configs')
    .option('--from <path>', 'Lint servers declared in this MCP config. Repeatable.', collectPath, [] as string[])
    .option('--remote', 'Also connect to URL servers. Off by default, so a scan stays on this machine.')
    .option('--timeout <ms>', 'Per-server timeout in milliseconds for --installed, --from, and --server')
    .option('--strict', 'With --installed or --from, exit 1 when a server fails to start')
    .option('--output-file <path>', 'Write results to a file instead of stdout')
    .option('--watch', 'Re-lint on file change (only works with file input)')
    .option('--score', 'Show quality score (0–100) per tool')
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
        installed?: boolean;
        from?: string[];
        remote?: boolean;
        timeout?: string;
        strict?: boolean;
        outputFile?: string;
        watch?: boolean;
        score?: boolean;
      },
    ) => {
      async function runLint(): Promise<boolean> {
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

        const from = options.from ?? [];
        const scanning = Boolean(options.installed) || from.length > 0;
        if (scanning && (input || options.server || options.watch)) {
          throw new Error('Use --installed or --from on their own, without a tools file, --server, or --watch.');
        }

        const floor = severityFloor(options);
        let tools: MCPTool[];
        let diagnostics: Diagnostic[];
        let output: string;

        if (scanning) {
          const timeoutMs = parseTimeout(options.timeout, 20_000);
          const collected = await collectInstalledServers({
            scanInstalled: Boolean(options.installed),
            from,
            home: homedir(),
            platform: process.platform,
            cwd: process.cwd(),
          });
          if (collected.servers.length === 0 && collected.errors.length === 0) {
            const where = options.installed
              ? 'the Cursor, Claude, and VS Code configs on this machine'
              : from.join(', ');
            throw new Error(`No MCP servers found in ${where}.`);
          }
          const pluginRules = await loadPluginRules(fileConfig);
          const engine = new LintEngine([...allRules, ...pluginRules], config);
          const reports = await lintInstalledServers(collected.servers, {
            remote: Boolean(options.remote),
            timeoutMs,
            lint: (found) => filterBySeverity(engine.lint(found), floor),
          });
          for (const problem of collected.errors) {
            reports.unshift(configFailure(problem.path, problem.message));
          }
          tools = reports.flatMap((report) => report.tools);
          diagnostics = reports.flatMap((report) => report.diagnostics);
          output = formatInstalled(reports, options.format, !options.color);
          const failedStart = reports.some((report) => report.status === 'failed');
          await emit(output, options, tools, diagnostics);
          return diagnostics.some((item) => item.severity === 'error') || (Boolean(options.strict) && failedStart);
        } else if (options.server === 'stdio') {
          const rawArgv = process.argv;
          const sepIdx = rawArgv.indexOf('--');
          if (sepIdx === -1 || sepIdx >= rawArgv.length - 1) {
            throw new Error('--server stdio requires a command after --, e.g.: mcp-lint check --server stdio -- node server.js');
          }
          const [cmd, ...cmdArgs] = rawArgv.slice(sepIdx + 1);
          tools = await loadStdio(cmd, cmdArgs, { timeoutMs: optionalTimeout(options.timeout) });
        } else if (options.server === 'sse') {
          if (!options.url) throw new Error('--server sse requires --url <url>');
          tools = await loadSSE(options.url, optionalTimeout(options.timeout));
        } else if (options.server === 'http') {
          if (!options.url) throw new Error('--server http requires --url <url>');
          tools = await loadRemote(options.url, 'http', optionalTimeout(options.timeout));
        } else if (await shouldDiscover(input)) {
          const dir = input ? resolve(input) : process.cwd();
          const files = await discoverToolFiles(dir);
          if (files.length === 0) throw new Error(missingToolsMessage(dir));
          const pluginRules = await loadPluginRules(fileConfig);
          const engine = new LintEngine([...allRules, ...pluginRules], config);
          const groups = [];
          const discoveredTools: MCPTool[] = [];
          const discoveredDiagnostics: Diagnostic[] = [];
          for (const file of files) {
            const found = await loadFile(file);
            const foundDiagnostics = filterBySeverity(engine.lint(found), floor);
            discoveredTools.push(...found);
            discoveredDiagnostics.push(...foundDiagnostics);
            groups.push({ file, diagnostics: foundDiagnostics });
          }
          await emit(
            formatDiscovered(groups, options.format, !options.color),
            options,
            discoveredTools,
            discoveredDiagnostics,
          );
          return discoveredDiagnostics.some((item) => item.severity === 'error');
        } else {
          if (!input) throw new Error('Specify an input file, --server stdio|sse|http, --installed, or --from <mcp.json>');
          tools = await loadFile(input);
        }

        const pluginRules = await loadPluginRules(fileConfig);
        const engine = new LintEngine([...allRules, ...pluginRules], config);
        diagnostics = filterBySeverity(engine.lint(tools), floor);

        if (options.format === 'json') {
          output = formatJson(diagnostics);
        } else if (options.format === 'markdown') {
          output = formatMarkdown(diagnostics);
        } else {
          output = formatTerminal(diagnostics, !options.color);
        }

        await emit(output, options, tools, diagnostics);
        return diagnostics.some((item) => item.severity === 'error');
        } catch (err) {
          process.stderr.write(`Error: ${(err as Error).message}\n`);
          return true;
        }
      }

      if (options.watch) {
        if (!input || options.server || options.installed || (options.from?.length ?? 0) > 0) {
          process.stderr.write('Error: --watch only works with file input\n');
          process.exit(2);
        }
        process.stdout.write(chalk.dim(`Watching ${input} for changes...\n\n`));
        await runLint();

        let debounce: ReturnType<typeof setTimeout> | null = null;
        watch(input, () => {
          if (debounce) clearTimeout(debounce);
          debounce = setTimeout(async () => {
            process.stdout.write(chalk.dim(`\n[${new Date().toLocaleTimeString()}] File changed — re-linting...\n\n`));
            await runLint();
          }, 100);
        });
      } else {
        const hasErrors = await runLint();
        process.exit(hasErrors ? 1 : 0);
      }
    });
}

async function shouldDiscover(input: string | undefined): Promise<boolean> {
  if (!input) return true;
  try {
    return (await stat(input)).isDirectory();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw err;
  }
}

function collectPath(value: string, previous: string[]): string[] {
  previous.push(value);
  return previous;
}

function severityFloor(options: { quiet?: boolean; severity?: string }): Severity {
  if (options.quiet) return 'error';
  if (options.severity === 'error' || options.severity === 'warning' || options.severity === 'info') {
    return options.severity;
  }
  return 'info';
}

function parseTimeout(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const timeoutMs = Number(value);
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1) {
    throw new Error('--timeout must be a positive number of milliseconds');
  }
  return timeoutMs;
}

function optionalTimeout(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  return parseTimeout(value, 20_000);
}

function configFailure(path: string, message: string): ServerReport {
  return {
    server: {
      sourceLabel: 'config',
      sourcePath: path,
      name: '(config)',
      kind: 'invalid',
      args: [],
    },
    status: 'failed',
    tools: [],
    diagnostics: [],
    error: message,
  };
}

async function emit(
  output: string,
  options: { outputFile?: string; score?: boolean },
  tools: MCPTool[],
  diagnostics: Diagnostic[],
): Promise<void> {
  if (options.outputFile) {
    await writeFile(options.outputFile, output, 'utf8');
  } else {
    process.stdout.write(output);
  }

  if (!options.score) return;
  const report = computeQualityReport(tools, diagnostics);
  const gradeColor = (grade: string) =>
    grade === 'A' ? chalk.green(grade) : grade === 'B' ? chalk.cyan(grade) : grade === 'C' ? chalk.yellow(grade) : chalk.red(grade);
  process.stdout.write(chalk.bold('\nQuality Score\n'));
  for (const tool of report.tools) {
    process.stdout.write(
      `  ${tool.toolName.padEnd(30)} ${String(tool.score).padStart(3)}/100  ${gradeColor(tool.grade)}  (${tool.errors} errors, ${tool.warnings} warnings)\n`,
    );
  }
  process.stdout.write(`\n  Overall: ${chalk.bold(String(report.overall))}/100  ${gradeColor(report.grade)}\n\n`);
}
