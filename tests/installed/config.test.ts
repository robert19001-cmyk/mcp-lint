import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { candidateConfigFiles, collectInstalledServers, parseInstalledConfig } from '../../src/installed/config.js';

const origin = { label: 'Cursor', path: '/tmp/mcp.json' };

describe('installed config', () => {
  it('reads Cursor, VS Code, and nested VS Code server maps', () => {
    const servers = parseInstalledConfig({
      mcpServers: {
        github: { command: 'npx', args: ['-y', 'server'], env: { TOKEN: 'secret' } },
        skipped: { command: 'npx', disabled: true },
        remote: { url: 'https://example.com/mcp' },
      },
      servers: {
        local: { type: 'stdio', command: 'node', args: ['server.js'], cwd: '/work' },
      },
      mcp: {
        servers: {
          http: { type: 'http', url: 'http://127.0.0.1:9/mcp' },
        },
      },
    }, origin);

    expect(servers.map((server) => server.name)).toEqual(['github', 'remote', 'local', 'http']);
    expect(servers[0]).toMatchObject({ kind: 'stdio', args: ['-y', 'server'], env: { TOKEN: 'secret' } });
    expect(servers[1]).toMatchObject({ kind: 'remote', url: 'https://example.com/mcp' });
    expect(servers[2]).toMatchObject({ kind: 'stdio', cwd: '/work' });
    expect(servers[3]).toMatchObject({ kind: 'remote', remoteType: 'http' });
  });

  it('marks a server invalid when the command or args are unusable', () => {
    const servers = parseInstalledConfig({
      mcpServers: {
        blank: { command: '  ' },
        badArgs: { command: 'node', args: ['ok', 1] },
      },
    }, origin);
    expect(servers.map((server) => server.kind)).toEqual(['invalid', 'invalid']);
  });

  it('keeps a name once when it appears in two blocks', () => {
    const servers = parseInstalledConfig({
      mcpServers: { same: { command: 'a' } },
      servers: { same: { command: 'b' } },
    }, origin);
    expect(servers).toHaveLength(1);
    expect(servers[0]?.command).toBe('a');
  });

  it('points macOS at Claude Desktop and VS Code user configs', () => {
    const paths = candidateConfigFiles('/Users/robert', 'darwin', '/work');
    expect(paths.map((item) => item.path)).toEqual(expect.arrayContaining([
      '/Users/robert/.cursor/mcp.json',
      '/work/.cursor/mcp.json',
      '/work/.mcp.json',
      '/work/.vscode/mcp.json',
      '/Users/robert/Library/Application Support/Claude/claude_desktop_config.json',
      '/Users/robert/Library/Application Support/Code/User/mcp.json',
    ]));
  });

  it('reads only the files that exist', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mcp-lint-config-'));
    const configPath = join(dir, 'mcp.json');
    await writeFile(configPath, JSON.stringify({
      mcpServers: { files: { command: 'node', args: ['server.js'] } },
    }));

    const found = await collectInstalledServers({
      scanInstalled: false,
      from: [configPath, join(dir, 'missing.json')],
      home: dir,
      platform: 'darwin',
      cwd: dir,
    });
    expect(found.errors).toEqual([]);
    expect(found.servers).toHaveLength(1);
    expect(found.servers[0]?.name).toBe('files');
  });
});
