import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpLintServer } from '../src/mcp-server.js';

const validTool = {
  name: 'search',
  description: 'Search for items matching the query',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
    },
    required: ['query'],
    additionalProperties: false,
  },
};

async function connectClient() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcpLintServer();
  const client = new Client({ name: 'mcp-lint-test-client', version: '0.0.0' });

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  return { client, server };
}

describe('mcp-lint MCP server', () => {
  it('lists the public mcp-lint tools', async () => {
    const { client, server } = await connectClient();

    try {
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toEqual(expect.arrayContaining([
        'mcp_lint_list_rules',
        'mcp_lint_check_tools',
        'mcp_lint_fix_tools',
        'mcp_lint_explain_rule',
        'mcp_lint_preflight_action',
      ]));
    } finally {
      await client.close();
      await server.close();
    }
  });

  it('lints MCP tool schemas through a structured tool call', async () => {
    const { client, server } = await connectClient();

    try {
      const response = await client.callTool({
        name: 'mcp_lint_check_tools',
        arguments: {
          tools: [validTool],
          includeScore: true,
          clients: ['openai'],
        },
      });

      expect(response.structuredContent).toMatchObject({
        summary: {
          tools: 1,
        },
      });
      expect(response.structuredContent?.quality).toMatchObject({
        tools: [
          {
            toolName: 'search',
          },
        ],
      });
    } finally {
      await client.close();
      await server.close();
    }
  });

  it('preflights risky actions without executing them', async () => {
    const { client, server } = await connectClient();

    try {
      const response = await client.callTool({
        name: 'mcp_lint_preflight_action',
        arguments: {
          action: {
            tool_type: 'shell',
            tool_name: 'bash',
            action: 'rm -rf /prod/data',
            target: '/prod/data',
          },
          policyYaml: `
version: 1
rules:
  - id: block-prod-delete
    when:
      tool_type: shell
      action_matches: ["rm -rf"]
      target_matches: ["/prod"]
    effect: deny
`,
        },
      });

      expect(response.structuredContent).toMatchObject({
        decision: {
          decision: 'deny',
          matched_policies: ['block-prod-delete'],
        },
      });
    } finally {
      await client.close();
      await server.close();
    }
  });
});
