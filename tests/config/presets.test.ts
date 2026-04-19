import { describe, it, expect } from 'vitest';
import { applyExtends } from '../../src/config/presets.js';

describe('applyExtends', () => {
  it('returns config unchanged when no extends', () => {
    const cfg = { maxDepth: 3 };
    expect(applyExtends(cfg)).toEqual({ maxDepth: 3 });
  });

  it('applies recommended preset as base', () => {
    const result = applyExtends({ extends: 'recommended' });
    expect(result.clients).toContain('windsurf');
    expect(result.clients).toContain('openai');
    expect(result.extends).toBeUndefined();
  });

  it('applies strict preset — all rules become error', () => {
    const result = applyExtends({ extends: 'strict' });
    expect(result.rules?.['description-exists']).toBe('error');
    expect(result.rules?.['windsurf/no-union-types']).toBe('error');
    expect(result.maxDepth).toBe(3);
  });

  it('user rule overrides win over preset', () => {
    const result = applyExtends({
      extends: 'strict',
      rules: { 'description-exists': 'warning' },
    });
    expect(result.rules?.['description-exists']).toBe('warning');
    expect(result.rules?.['no-required-false']).toBe('error');
  });

  it('throws for unknown preset name', () => {
    expect(() => applyExtends({ extends: 'nonexistent' })).toThrow('Unknown preset');
  });

  it('merges ignore lists', () => {
    const result = applyExtends({ extends: 'recommended', ignore: ['my-tool'] });
    expect(result.ignore).toContain('my-tool');
  });

  it('user clients override preset clients', () => {
    const result = applyExtends({ extends: 'strict', clients: ['claude'] });
    expect(result.clients).toEqual(['claude']);
  });

  it('extends key is stripped from result', () => {
    const result = applyExtends({ extends: 'recommended', maxDepth: 4 });
    expect(result.extends).toBeUndefined();
    expect(result.maxDepth).toBe(4);
  });
});
