import { describe, it, expect } from 'vitest';
import { applyExtends } from '../../src/config/presets.js';

describe('applyExtends', () => {
  it('returns config unchanged when no extends', async () => {
    const cfg = { maxDepth: 3 };
    expect(await applyExtends(cfg)).toEqual({ maxDepth: 3 });
  });

  it('applies recommended preset as base', async () => {
    const result = await applyExtends({ extends: 'recommended' });
    expect(result.clients).toContain('windsurf');
    expect(result.clients).toContain('openai');
    expect(result.extends).toBeUndefined();
  });

  it('applies strict preset — all rules become error', async () => {
    const result = await applyExtends({ extends: 'strict' });
    expect(result.rules?.['description-exists']).toBe('error');
    expect(result.rules?.['windsurf/no-union-types']).toBe('error');
    expect(result.maxDepth).toBe(3);
  });

  it('user rule overrides win over preset', async () => {
    const result = await applyExtends({
      extends: 'strict',
      rules: { 'description-exists': 'warning' },
    });
    expect(result.rules?.['description-exists']).toBe('warning');
    expect(result.rules?.['no-required-false']).toBe('error');
  });

  it('rejects unknown preset name', async () => {
    await expect(applyExtends({ extends: 'nonexistent' })).rejects.toThrow('Unknown preset');
  });

  it('merges ignore lists', async () => {
    const result = await applyExtends({ extends: 'recommended', ignore: ['my-tool'] });
    expect(result.ignore).toContain('my-tool');
  });

  it('user clients override preset clients', async () => {
    const result = await applyExtends({ extends: 'strict', clients: ['claude'] });
    expect(result.clients).toEqual(['claude']);
  });

  it('extends key is stripped from result', async () => {
    const result = await applyExtends({ extends: 'recommended', maxDepth: 4 });
    expect(result.extends).toBeUndefined();
    expect(result.maxDepth).toBe(4);
  });
});
