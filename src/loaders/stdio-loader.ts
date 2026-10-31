import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { MCPTool } from '../core/rule.js';
import { mapListedTools } from './map-tools.js';

export interface StdioLoadOptions {
  env?: Record<string, string>;
  cwd?: string;
  timeoutMs?: number;
  inheritProcessEnv?: boolean;
}

export async function loadStdio(
  command: string,
  args: string[],
  options: StdioLoadOptions = {},
): Promise<MCPTool[]> {
  const transport = new StdioClientTransport({
    command,
    args,
    env: options.env || options.inheritProcessEnv
      ? childEnvironment(options.env, Boolean(options.inheritProcessEnv))
      : undefined,
    stderr: 'pipe',
    cwd: options.cwd,
  });
  drain(transport.stderr);
  const client = new Client({ name: 'mcp-lint', version: '0.8.0' }, { capabilities: {} });

  try {
    return await withTimeout(options.timeoutMs, command, async () => {
      await client.connect(transport);
      const result = await client.listTools();
      return mapListedTools(result.tools);
    }, async () => {
      await transport.close();
    });
  } finally {
    await client.close().catch(() => {});
    await transport.close().catch(() => {});
  }
}

export function childEnvironment(
  extra?: Record<string, string>,
  inheritProcessEnv = false,
): Record<string, string> {
  const env: Record<string, string> = { ...getDefaultEnvironment() };
  if (inheritProcessEnv) {
    for (const [key, value] of Object.entries(process.env)) {
      if (typeof value === 'string') env[key] = value;
    }
  }
  if (extra) Object.assign(env, extra);
  return env;
}

async function withTimeout<T>(
  timeoutMs: number | undefined,
  label: string,
  run: () => Promise<T>,
  cancel: () => Promise<void>,
): Promise<T> {
  if (!timeoutMs || timeoutMs < 1) return run();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      run(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          void cancel();
          reject(new Error(`Timed out after ${timeoutMs}ms waiting for ${label}`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function drain(stream: { on(event: 'data', listener: () => void): unknown } | null): void {
  stream?.on('data', () => {});
}
