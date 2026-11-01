import { describe, expect, it } from 'vitest';
import { listCatalog } from '../../src/catalog/list.js';

describe('listCatalog', () => {
  it('lists resources and prompts and does not call a tool', async () => {
    const report = await listCatalog({
      async listResources() {
        return { resources: [{ uri: 'file://readme', name: 'readme', description: 'notes' }] };
      },
      async listPrompts() {
        return { prompts: [{ name: 'review', title: 'Review' }] };
      },
    });

    expect(report.toolsInvoked).toBe(false);
    expect(report.resources.items).toEqual([{ uri: 'file://readme', name: 'readme', description: 'notes' }]);
    expect(report.prompts.status).toBe('ran');
    expect(report.prompts.items[0]?.name).toBe('review');
  });

  it('marks a missing method as unsupported', async () => {
    const report = await listCatalog({
      async listResources() {
        throw new Error('Method not found');
      },
      async listPrompts() {
        return { prompts: [] };
      },
    });

    expect(report.resources.status).toBe('unsupported');
    expect(report.prompts.status).toBe('ran');
    expect(report.prompts.items).toEqual([]);
  });

  it('stops when the byte budget is full', async () => {
    const report = await listCatalog({
      async listResources() {
        return {
          resources: [
            { uri: 'file://a', name: 'a', description: 'one' },
            { uri: 'file://b', name: 'b', description: 'two' },
          ],
        };
      },
      async listPrompts() {
        return { prompts: [] };
      },
    }, { maxBytes: 40, maxItems: 10 });

    expect(report.resources.truncated).toBe(true);
    expect(report.resources.items.length).toBeLessThan(2);
  });

  it('fails when the list does not return in time', async () => {
    const report = await listCatalog({
      listResources: () => new Promise(() => {}),
      async listPrompts() {
        return { prompts: [] };
      },
    }, { timeoutMs: 20 });

    expect(report.resources.status).toBe('failed');
    expect(report.resources.reason).toMatch(/Timed out/);
  });
});
