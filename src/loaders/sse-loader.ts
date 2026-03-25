import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { MCPTool } from '../core/rule.js';

export async function loadSSE(url: string): Promise<MCPTool[]> {
  const transport = new SSEClientTransport(new URL(url));
  const client = new Client({ name: 'mcp-lint', version: '0.1.0' }, { capabilities: {} });

  await client.connect(transport);

  try {
    const result = await client.listTools();
    return result.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema as MCPTool['inputSchema'],
    }));
  } finally {
    await client.close();
  }
}
