import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { MCPTool } from '../core/rule.js';
import { mapListedTools } from './map-tools.js';

export async function loadRemote(url: string, remoteType = 'http', timeoutMs?: number): Promise<MCPTool[]> {
  const target = new URL(url);
  const transport = remoteType === 'sse'
    ? new SSEClientTransport(target)
    : new StreamableHTTPClientTransport(target);
  const client = new Client({ name: 'mcp-lint', version: '0.7.0' }, { capabilities: {} });

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const connect = async () => {
      await client.connect(transport);
      const result = await client.listTools();
      return mapListedTools(result.tools);
    };
    if (!timeoutMs || timeoutMs < 1) return await connect();
    return await Promise.race([
      connect(),
      new Promise<MCPTool[]>((_, reject) => {
        timer = setTimeout(() => {
          void transport.close();
          reject(new Error(`Timed out after ${timeoutMs}ms waiting for ${url}`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    await client.close().catch(() => {});
    await transport.close().catch(() => {});
  }
}
