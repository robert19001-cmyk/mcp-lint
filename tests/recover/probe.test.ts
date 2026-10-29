import { describe, expect, it } from 'vitest';
import { probeClient } from '../../src/recover/probe.js';
import type { ProbeClient } from '../../src/recover/probe.js';

function client(handlers: Record<string, () => Promise<{ isError?: boolean; content?: Array<{ type: string; text?: string }> }>>): ProbeClient {
  return {
    async listTools() {
      return {
        tools: [
          ...Object.keys(handlers).map((name) => ({
            name,
            inputSchema: { required: ['query'] },
          })),
          { name: 'ping', inputSchema: { required: [] } },
        ],
      };
    },
    async callTool(params) {
      const handler = handlers[params.name];
      if (!handler) throw new Error(`unexpected tool ${params.name}`);
      return handler();
    },
  };
}

describe('probeClient', () => {
  it('scores the error a required tool actually returns', async () => {
    const probed = await probeClient(client({
      search: async () => ({
        isError: true,
        content: [{ type: 'text', text: 'Unauthorized. Run npm login in your terminal.' }],
      }),
    }), { hangMs: 1000 });

    expect(probed.skipped).toEqual(['ping']);
    expect(probed.report.errors).toBeGreaterThan(0);
    expect(probed.report.findings.map((finding) => finding.ruleId)).toEqual(expect.arrayContaining([
      'recover/names-tool',
      'recover/agent-reachable',
    ]));
  });

  it('cuts off a tool that does not return', async () => {
    const probed = await probeClient(client({
      search: () => new Promise(() => {}),
    }), { hangMs: 30 });

    expect(probed.samples[0]?.kind).toBe('timeout');
    expect(probed.report.findings.map((finding) => finding.ruleId)).toContain('recover/bounded-hang');
  });

  it('passes a validation error that tells the agent what argument is missing', async () => {
    const probed = await probeClient(client({
      search: async () => ({
        isError: true,
        content: [{ type: 'text', text: 'Invalid arguments: query is required.' }],
      }),
    }), { hangMs: 1000 });

    expect(probed.report.errors).toBe(0);
    expect(probed.report.recoverable).toBe(1);
  });
});
