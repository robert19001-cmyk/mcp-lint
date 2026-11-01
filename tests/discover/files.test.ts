import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { discoverToolFiles, missingToolsMessage, TOOL_FILE_NAMES } from '../../src/discover/files.js';

describe('discover tool files', () => {
  it('returns the conventional files that exist, in a stable order', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mcp-lint-discover-'));
    await writeFile(join(dir, 'mcp-tools.json'), '[]\n');
    await writeFile(join(dir, 'tools.json'), '[]\n');
    await writeFile(join(dir, 'notes.txt'), 'nope');

    const found = await discoverToolFiles(dir);
    expect(found.map((path) => path.slice(dir.length + 1))).toEqual(['tools.json', 'mcp-tools.json']);
  });

  it('looks one directory down and skips node_modules, dot dirs, and grandchildren', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mcp-lint-discover-'));
    await mkdir(join(dir, 'packages', 'web'), { recursive: true });
    await mkdir(join(dir, 'node_modules', 'pkg'), { recursive: true });
    await mkdir(join(dir, '.hidden'), { recursive: true });
    await writeFile(join(dir, 'packages', 'tools.yaml'), '[]\n');
    await writeFile(join(dir, 'packages', 'web', 'tools.json'), '[]\n');
    await writeFile(join(dir, 'node_modules', 'pkg', 'tools.json'), '[]\n');
    await writeFile(join(dir, '.hidden', 'tools.json'), '[]\n');

    const found = await discoverToolFiles(dir);
    expect(found.map((path) => path.slice(dir.length + 1))).toEqual(['packages/tools.yaml']);
  });

  it('names every place a bare run looks', () => {
    const message = missingToolsMessage('/work');
    expect(message).toContain('No tool schema in /work.');
    for (const name of TOOL_FILE_NAMES) expect(message).toContain(name);
  });
});
