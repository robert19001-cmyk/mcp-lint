import type { Diagnostic } from '../core/diagnostic.js';
import type { MCPTool } from '../core/rule.js';
import { loadRemote } from '../loaders/remote-loader.js';
import { loadStdio } from '../loaders/stdio-loader.js';
import type { InstalledServer } from './config.js';

export interface ServerReport {
  server: InstalledServer;
  status: 'linted' | 'skipped-remote' | 'failed';
  tools: MCPTool[];
  diagnostics: Diagnostic[];
  error?: string;
}

export async function lintInstalledServers(
  servers: InstalledServer[],
  options: {
    remote: boolean;
    timeoutMs: number;
    lint: (tools: MCPTool[]) => Diagnostic[];
    loadStdio?: typeof loadStdio;
    loadRemote?: typeof loadRemote;
  },
): Promise<ServerReport[]> {
  const loadLocal = options.loadStdio ?? loadStdio;
  const loadUrl = options.loadRemote ?? loadRemote;
  const reports: ServerReport[] = [];

  for (const server of servers) {
    if (server.kind === 'invalid') {
      reports.push(failed(server, server.detail ?? 'Server entry is incomplete'));
      continue;
    }

    if (server.kind === 'remote') {
      if (!options.remote) {
        reports.push({
          server,
          status: 'skipped-remote',
          tools: [],
          diagnostics: [],
        });
        continue;
      }
      try {
        const tools = await loadUrl(server.url ?? '', server.remoteType ?? 'http', options.timeoutMs);
        reports.push({ server, status: 'linted', tools, diagnostics: options.lint(tools) });
      } catch (err) {
        reports.push(failed(server, (err as Error).message));
      }
      continue;
    }

    try {
      const tools = await loadLocal(server.command ?? '', server.args, {
        env: server.env,
        cwd: server.cwd,
        timeoutMs: options.timeoutMs,
        inheritProcessEnv: true,
      });
      reports.push({ server, status: 'linted', tools, diagnostics: options.lint(tools) });
    } catch (err) {
      reports.push(failed(server, (err as Error).message));
    }
  }

  return reports;
}

function failed(server: InstalledServer, error: string): ServerReport {
  return { server, status: 'failed', tools: [], diagnostics: [], error };
}
