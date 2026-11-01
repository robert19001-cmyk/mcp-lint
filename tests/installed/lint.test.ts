import { describe, expect, it } from 'vitest';
import type { InstalledServer } from '../../src/installed/config.js';
import { formatInstalled } from '../../src/installed/format.js';
import { lintInstalledServers } from '../../src/installed/lint.js';
import type { MCPTool } from '../../src/core/rule.js';

const tool: MCPTool = {
  name: 'search files',
  description: 'Search',
  inputSchema: { type: 'object' },
};

function server(overrides: Partial<InstalledServer>): InstalledServer {
  return {
    sourceLabel: 'Cursor',
    sourcePath: '/tmp/mcp.json',
    name: 'github',
    kind: 'stdio',
    command: 'node',
    args: ['server.js'],
    env: { TOKEN: 'secret-token' },
    ...overrides,
  };
}

describe('lint installed servers', () => {
  it('skips remote URLs unless remote mode is on', async () => {
    const reports = await lintInstalledServers([
      server({ name: 'web', kind: 'remote', url: 'https://example.com/mcp' }),
    ], {
      remote: false,
      timeoutMs: 1000,
      lint: () => [],
      loadStdio: async () => { throw new Error('should not spawn'); },
    });
    expect(reports[0]?.status).toBe('skipped-remote');
    const text = formatInstalled(reports, 'terminal', true);
    expect(text).toContain('skipped remote URL');
    expect(text).not.toContain('secret-token');
  });

  it('lints stdio tools and reports a start failure without printing env values', async () => {
    const reports = await lintInstalledServers([
      server({ name: 'ok', args: ['ok.js'] }),
      server({ name: 'bad', args: ['bad.js'] }),
    ], {
      remote: false,
      timeoutMs: 1000,
      lint: (tools) => tools.map((item) => ({
        ruleId: 'tool-name/client-safe',
        severity: 'error' as const,
        message: `bad name ${item.name}`,
        toolName: item.name,
        path: 'name',
        clients: ['openai' as const],
      })),
      loadStdio: async (_command, args) => {
        if (args[0] === 'bad.js') throw new Error('command not found');
        return [tool];
      },
    });

    expect(reports[0]?.status).toBe('linted');
    expect(reports[0]?.diagnostics).toHaveLength(1);
    expect(reports[1]?.status).toBe('failed');
    const text = formatInstalled(reports, 'terminal', true);
    expect(text).toContain('command not found');
    expect(text).toContain('search files');
    expect(text).not.toContain('secret-token');
  });

  it('flags a tool name exposed by two linted servers', async () => {
    const reports = await lintInstalledServers([
      server({ name: 'alpha', args: ['a.js'] }),
      server({ name: 'beta', args: ['b.js'] }),
    ], {
      remote: false,
      timeoutMs: 1000,
      lint: () => [],
      loadStdio: async () => [{ ...tool, name: 'search' }],
    });

    expect(reports.map((report) => report.status)).toEqual(['linted', 'linted']);
    for (const report of reports) {
      expect(report.diagnostics).toHaveLength(1);
      expect(report.diagnostics[0]).toMatchObject({
        ruleId: 'tool-name/server-collision',
        toolName: 'search',
        path: 'name',
      });
      expect(report.diagnostics[0]?.message).toContain('alpha');
      expect(report.diagnostics[0]?.message).toContain('beta');
    }
  });

  it('skips the cross-server name check when the rule is off', async () => {
    const reports = await lintInstalledServers([
      server({ name: 'alpha', args: ['a.js'] }),
      server({ name: 'beta', args: ['b.js'] }),
    ], {
      remote: false,
      timeoutMs: 1000,
      lint: () => [],
      rules: { 'tool-name/server-collision': 'off' },
      loadStdio: async () => [{ ...tool, name: 'search' }],
    });
    expect(reports.every((report) => report.diagnostics.length === 0)).toBe(true);
  });
});
