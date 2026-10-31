import { stat } from 'node:fs/promises';
import { join } from 'node:path';

export const TOOL_FILE_NAMES = [
  'tools.json',
  'tools.yaml',
  'tools.yml',
  'mcp-tools.json',
  'mcp-tools.yaml',
  'mcp-tools.yml',
] as const;

export async function discoverToolFiles(dir: string): Promise<string[]> {
  const found: string[] = [];
  for (const name of TOOL_FILE_NAMES) {
    const path = join(dir, name);
    try {
      if ((await stat(path)).isFile()) found.push(path);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }
  return found;
}

export function missingToolsMessage(dir: string): string {
  return [
    `No tool schema in ${dir}.`,
    `Looked for ${TOOL_FILE_NAMES.join(', ')}.`,
    'npx mcp-lint check tools.json',
    'npx mcp-lint check --from .cursor/mcp.json',
    'npx mcp-lint snapshot -o tools.json --server stdio -- node server.js',
  ].join('\n');
}
