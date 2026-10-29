import { writeFile } from 'node:fs/promises';
import type { Command } from 'commander';
import { loadRemote } from '../../loaders/remote-loader.js';
import { loadStdio } from '../../loaders/stdio-loader.js';
import { serializeTools } from '../../snapshot/serialize.js';
import type { MCPTool } from '../../core/rule.js';

export function registerSnapshotCommand(program: Command): void {
  program
    .command('snapshot')
    .description('Write a stable tools JSON snapshot from a live MCP server')
    .option('-o, --output <path>', 'Write the snapshot to this file instead of stdout')
    .option('--server <type>', 'Server transport: stdio|sse|http')
    .option('--url <url>', 'Remote server URL (use with --server sse|http)')
    .option('--timeout <ms>', 'How long to wait for tools/list, in milliseconds', '20000')
    .allowExcessArguments(true)
    .action(async (options: { output?: string; server?: string; url?: string; timeout?: string }) => {
      try {
        const timeoutMs = parseTimeout(options.timeout);
        const tools = await loadSnapshot(options.server, options.url, timeoutMs);
        const body = serializeTools(tools);
        if (options.output) {
          await writeFile(options.output, body, 'utf8');
          process.stderr.write(`Wrote ${tools.length} tool${tools.length === 1 ? '' : 's'} to ${options.output}\n`);
        } else {
          process.stdout.write(body);
        }
      } catch (err) {
        process.stderr.write(`Error: ${(err as Error).message}\n`);
        process.exit(2);
      }
    });
}

function parseTimeout(value: string | undefined): number {
  const timeoutMs = Number(value ?? '20000');
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1) {
    throw new Error('--timeout must be a positive number of milliseconds');
  }
  return timeoutMs;
}

async function loadSnapshot(server: string | undefined, url: string | undefined, timeoutMs: number): Promise<MCPTool[]> {
  if (server === 'stdio') {
    const separator = process.argv.indexOf('--');
    if (separator === -1 || separator >= process.argv.length - 1) {
      throw new Error('snapshot --server stdio requires a command after --, e.g.: mcp-lint snapshot -o tools.json --server stdio -- node server.js');
    }
    const [command, ...args] = process.argv.slice(separator + 1);
    return loadStdio(command, args, { timeoutMs });
  }

  if (server === 'sse' || server === 'http') {
    if (!url) throw new Error(`snapshot --server ${server} requires --url <url>`);
    return loadRemote(url, server, timeoutMs);
  }

  throw new Error('snapshot requires --server stdio|sse|http');
}
