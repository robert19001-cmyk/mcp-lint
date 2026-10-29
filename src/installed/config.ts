import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface ConfigOrigin {
  label: string;
  path: string;
}

export interface InstalledServer {
  sourceLabel: string;
  sourcePath: string;
  name: string;
  kind: 'stdio' | 'remote' | 'invalid';
  command?: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
  url?: string;
  remoteType?: string;
  detail?: string;
}

export function candidateConfigFiles(
  home: string,
  platform: NodeJS.Platform,
  cwd: string,
): ConfigOrigin[] {
  const files: ConfigOrigin[] = [
    { label: 'Cursor', path: join(home, '.cursor', 'mcp.json') },
    { label: 'Cursor project', path: join(cwd, '.cursor', 'mcp.json') },
    { label: 'Project', path: join(cwd, '.mcp.json') },
    { label: 'VS Code project', path: join(cwd, '.vscode', 'mcp.json') },
    { label: 'Claude Code', path: join(home, '.claude.json') },
    { label: 'Claude Code settings', path: join(home, '.claude', 'settings.json') },
  ];

  if (platform === 'darwin') {
    files.push(
      { label: 'Claude Desktop', path: join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json') },
      { label: 'VS Code', path: join(home, 'Library', 'Application Support', 'Code', 'User', 'mcp.json') },
    );
  } else if (platform === 'win32') {
    const appData = process.env.APPDATA ?? join(home, 'AppData', 'Roaming');
    files.push(
      { label: 'Claude Desktop', path: join(appData, 'Claude', 'claude_desktop_config.json') },
      { label: 'VS Code', path: join(appData, 'Code', 'User', 'mcp.json') },
    );
  } else {
    files.push(
      { label: 'Claude Desktop', path: join(home, '.config', 'Claude', 'claude_desktop_config.json') },
      { label: 'VS Code', path: join(home, '.config', 'Code', 'User', 'mcp.json') },
    );
  }

  return files;
}

export function parseInstalledConfig(raw: unknown, origin: ConfigOrigin): InstalledServer[] {
  if (!isRecord(raw)) {
    throw new Error(`Expected a JSON object in "${origin.path}"`);
  }

  const blocks: Record<string, unknown>[] = [];
  if (isRecord(raw.mcpServers)) blocks.push(raw.mcpServers);
  if (isRecord(raw.servers)) blocks.push(raw.servers);
  if (isRecord(raw.mcp) && isRecord(raw.mcp.servers)) blocks.push(raw.mcp.servers);

  const servers: InstalledServer[] = [];
  const seen = new Set<string>();
  for (const block of blocks) {
    for (const [name, value] of Object.entries(block)) {
      if (!isRecord(value) || value.disabled === true) continue;
      const key = `${origin.path}\0${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      servers.push(toServer(name, value, origin));
    }
  }
  return servers;
}

export interface CollectResult {
  servers: InstalledServer[];
  errors: Array<{ path: string; message: string }>;
  lookedAt: string[];
}

export async function collectInstalledServers(input: {
  scanInstalled: boolean;
  from: string[];
  home: string;
  platform: NodeJS.Platform;
  cwd: string;
}): Promise<CollectResult> {
  const origins: ConfigOrigin[] = input.from.map((path) => ({ label: 'File', path }));
  if (input.scanInstalled) {
    origins.push(...candidateConfigFiles(input.home, input.platform, input.cwd));
  }

  const servers: InstalledServer[] = [];
  const errors: Array<{ path: string; message: string }> = [];
  const lookedAt: string[] = [];

  for (const origin of origins) {
    lookedAt.push(origin.path);
    let content: string;
    try {
      content = await readFile(origin.path, 'utf8');
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') continue;
      errors.push({ path: origin.path, message: (err as Error).message });
      continue;
    }

    try {
      const raw = JSON.parse(content) as unknown;
      servers.push(...parseInstalledConfig(raw, origin));
    } catch (err) {
      errors.push({ path: origin.path, message: (err as Error).message });
    }
  }

  return { servers, errors, lookedAt };
}

function toServer(name: string, value: Record<string, unknown>, origin: ConfigOrigin): InstalledServer {
  const base = {
    sourceLabel: origin.label,
    sourcePath: origin.path,
    name,
    args: [] as string[],
  };
  const url = typeof value.url === 'string' ? value.url : undefined;
  const type = typeof value.type === 'string' ? value.type.toLowerCase() : undefined;
  const remote = Boolean(url) || type === 'sse' || type === 'http' || type === 'streamable-http';

  if (remote) {
    if (!url) {
      return { ...base, kind: 'invalid', remoteType: type, detail: 'Remote server is missing a url' };
    }
    return { ...base, kind: 'remote', url, remoteType: type ?? 'http' };
  }

  if (typeof value.command !== 'string' || value.command.trim() === '') {
    return { ...base, kind: 'invalid', detail: 'Server has no command' };
  }

  if (value.args !== undefined && !isStringArray(value.args)) {
    return { ...base, kind: 'invalid', command: value.command, detail: 'args must be an array of strings' };
  }

  const env = stringRecord(value.env);
  const cwd = typeof value.cwd === 'string' ? value.cwd : undefined;
  return {
    ...base,
    kind: 'stdio',
    command: value.command,
    args: isStringArray(value.args) ? value.args : [],
    ...(env ? { env } : {}),
    ...(cwd ? { cwd } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function stringRecord(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined;
  const env: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string') env[key] = item;
  }
  return Object.keys(env).length > 0 ? env : undefined;
}
