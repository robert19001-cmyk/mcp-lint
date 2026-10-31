import { mkdtemp, writeFile } from 'node:fs/promises';
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

  it('names every place a bare run looks', () => {
    const message = missingToolsMessage('/work');
    expect(message).toContain('No tool schema in /work.');
    for (const name of TOOL_FILE_NAMES) expect(message).toContain(name);
  });
});
