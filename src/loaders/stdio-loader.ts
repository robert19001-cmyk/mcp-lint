import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { MCPTool } from '../core/rule.js';

export async function loadStdio(command: string, args: string[]): Promise<MCPTool[]> {
  const transport = new StdioClientTransport({ command, args });
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
