import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadStdio } from '../../src/loaders/stdio-loader.js';
import { serializeTools } from '../../src/snapshot/serialize.js';

const fixture = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'stdio-name-server.mjs');

describe('loadStdio', () => {
  it('keeps the title, description, and annotations from tools/list', async () => {
    const tools = await loadStdio(process.execPath, [fixture], { timeoutMs: 10_000 });
    expect(serializeTools(tools)).toContain('"name": "search_files"');
    expect(tools[0]).toMatchObject({
      name: 'search_files',
      title: 'Search files',
      description: 'Find a file by name',
      annotations: { readOnlyHint: true, destructiveHint: false },
    });
  }, 15_000);

  it('stops a server that never answers', async () => {
    const started = Date.now();
    await expect(loadStdio(process.execPath, ['-e', 'process.stdin.resume(); setInterval(() => {}, 1e9);'], {
      timeoutMs: 400,
    })).rejects.toThrow(/Timed out after 400ms/);
    expect(Date.now() - started).toBeLessThan(3_000);
  }, 10_000);
});
