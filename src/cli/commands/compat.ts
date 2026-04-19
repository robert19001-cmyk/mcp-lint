import type { Command } from 'commander';
import { loadFile } from '../../loaders/file-loader.js';
import { loadStdio } from '../../loaders/stdio-loader.js';
import { loadSSE } from '../../loaders/sse-loader.js';
import { LintEngine } from '../../core/engine.js';
import { buildCompatMatrix } from '../../core/compat-matrix.js';
import type { CompatMatrix } from '../../core/compat-matrix.js';
import { allRules } from '../../rules/index.js';
import { loadConfig, DEFAULT_CONFIG } from '../../config/config.js';
import type { ClientId, MCPTool } from '../../core/rule.js';
import chalk from 'chalk';

function formatCompatTerminal(matrix: CompatMatrix, noColor: boolean): string {
  if (noColor) chalk.level = 0;

  const { tools, clients, cells } = matrix;
  if (tools.length === 0) return chalk.yellow('No tools found.\n');

  const TOOL_WIDTH = Math.max(...tools.map((t) => t.length), 12) + 2;
  const COL_WIDTH = 10;

  const header =
    ' '.repeat(TOOL_WIDTH) +
    clients.map((c) => c.padEnd(COL_WIDTH)).join('');

  const rows = tools.map((tool) => {
    const cols = clients.map((client) => {
      const cell = cells[tool][client];
      return cell.compatible
        ? chalk.green('✓'.padEnd(COL_WIDTH))
        : chalk.red('✗'.padEnd(COL_WIDTH));
    });
    return tool.padEnd(TOOL_WIDTH) + cols.join('');
  });

  const incompatible = tools.filter((t) =>
    clients.some((c) => !cells[t][c].compatible),
  );

  const summary =
    incompatible.length === 0
      ? chalk.green('\nAll tools compatible across all clients.\n')
      : chalk.yellow(
          `\n${incompatible.length} tool${incompatible.length !== 1 ? 's' : ''} have compatibility issues. Run \`mcp-lint check\` for details.\n`,
        );

  return ['\n', header, ...rows, summary].join('\n');
}

function formatCompatJson(matrix: CompatMatrix): string {
  const result: Record<string, unknown> = {
    tools: matrix.tools,
    clients: matrix.clients,
    matrix: {},
  };

  for (const tool of matrix.tools) {
    (result.matrix as Record<string, unknown>)[tool] = {};
    for (const client of matrix.clients) {
      const cell = matrix.cells[tool][client];
      ((result.matrix as Record<string, Record<string, unknown>>)[tool])[client] = {
        compatible: cell.compatible,
        errorCount: cell.errorCount,
      };
    }
  }

  return JSON.stringify(result, null, 2) + '\n';
}

function formatCompatMarkdown(matrix: CompatMatrix): string {
  const { tools, clients, cells } = matrix;
  if (tools.length === 0) return '_No tools found._\n';

  const header = `| Tool | ${clients.join(' | ')} |`;
  const separator = `|------|${clients.map(() => '------|').join('')}`;
  const rows = tools.map((tool) => {
    const cols = clients.map((c) => (cells[tool][c].compatible ? '✅' : '❌'));
    return `| ${tool} | ${cols.join(' | ')} |`;
  });

  const incompatible = tools.filter((t) => clients.some((c) => !cells[t][c].compatible));
  const summary =
    incompatible.length === 0
      ? '\n_All tools compatible across all clients._\n'
      : `\n_${incompatible.length} tool(s) have compatibility issues. Run \`mcp-lint check\` for details._\n`;

  return [header, separator, ...rows, summary].join('\n') + '\n';
}

export function registerCompatCommand(program: Command): void {
  program
    .command('compat [input]')
    .description('Show compatibility matrix across all MCP clients')
    .option('--format <format>', 'Output format: terminal|json|markdown', 'terminal')
    .option('--no-color', 'Disable terminal colors')
    .option('--config <path>', 'Path to .mcplintrc.json config file')
    .option('--server <type>', 'Server transport: stdio|sse')
    .option('--url <url>', 'SSE server URL (use with --server sse)')
    .allowExcessArguments(true)
    .action(async (
      input: string | undefined,
      options: { format: string; color: boolean; config?: string; server?: string; url?: string },
    ) => {
      try {
        const fileConfig = await loadConfig(options.config);
        const config = {
          clients: DEFAULT_CONFIG.clients as ClientId[],
          ...fileConfig,
        };

        let tools: MCPTool[];

        if (options.server === 'stdio') {
          const rawArgv = process.argv;
          const sepIdx = rawArgv.indexOf('--');
          if (sepIdx === -1 || sepIdx >= rawArgv.length - 1) {
            throw new Error('--server stdio requires a command after --');
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
        const diagnostics = engine.lint(tools);
        const matrix = buildCompatMatrix(tools, diagnostics);

        let output: string;
        if (options.format === 'json') {
          output = formatCompatJson(matrix);
        } else if (options.format === 'markdown') {
          output = formatCompatMarkdown(matrix);
        } else {
          output = formatCompatTerminal(matrix, !options.color);
        }

        process.stdout.write(output);

        const hasIncompatible = matrix.tools.some((t) =>
          matrix.clients.some((c) => !matrix.cells[t][c].compatible),
        );
        process.exit(hasIncompatible ? 1 : 0);
      } catch (err) {
        process.stderr.write(`Error: ${(err as Error).message}\n`);
        process.exit(2);
      }
    });
}
