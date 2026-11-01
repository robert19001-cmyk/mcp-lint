import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { listCatalog, type CatalogLimits, type CatalogReport, type CatalogSource } from './list.js';
import { VERSION } from '../version.js';

export async function catalogStdio(
  command: string,
  args: string[],
  limits: CatalogLimits = {},
): Promise<CatalogReport> {
  const transport = new StdioClientTransport({ command, args, stderr: 'pipe' });
  drain(transport.stderr);
  return connect(transport, () => transport.close(), limits);
}

export async function catalogRemote(
  url: string,
  remoteType: 'sse' | 'http',
  limits: CatalogLimits = {},
): Promise<CatalogReport> {
  const target = new URL(url);
  const transport = remoteType === 'sse'
    ? new SSEClientTransport(target)
    : new StreamableHTTPClientTransport(target);
  return connect(transport, () => transport.close(), limits);
}

async function connect(
  transport: Transport,
  cancel: () => Promise<void>,
  limits: CatalogLimits,
): Promise<CatalogReport> {
  const client = new Client({ name: 'mcp-lint', version: VERSION }, { capabilities: {} });
  const timeoutMs = limits.timeoutMs;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const run = async () => {
      await client.connect(transport);
      const source: CatalogSource = {
        listResources: () => client.listResources(),
        listPrompts: () => client.listPrompts(),
      };
      return listCatalog(source, limits);
    };
    if (!timeoutMs || timeoutMs < 1) return await run();
    return await Promise.race([
      run(),
      new Promise<CatalogReport>((_, reject) => {
        timer = setTimeout(() => {
          void cancel();
          reject(new Error(`Timed out after ${timeoutMs}ms waiting for catalog`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    await client.close().catch(() => {});
    await cancel().catch(() => {});
  }
}

function drain(stream: { on(event: 'data', listener: () => void): unknown } | null): void {
  stream?.on('data', () => {});
}
