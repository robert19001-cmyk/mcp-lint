import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({ name: 'fixture', version: '1.0.0' });
server.registerTool(
  'search_files',
  {
    title: 'Search files',
    description: 'Find a file by name',
    inputSchema: { query: z.string().describe('Text to find') },
    annotations: { readOnlyHint: true, destructiveHint: false },
  },
  async () => ({ content: [{ type: 'text', text: 'ok' }] }),
);
await server.connect(new StdioServerTransport());
