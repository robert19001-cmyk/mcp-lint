import { describe, expect, it } from 'vitest';
import { catalogFindingsToDiagnostics, lintCatalog } from '../../src/catalog/lint.js';
import type { CatalogReport } from '../../src/catalog/list.js';
import { catalogExitCode } from '../../src/cli/commands/catalog.js';
import { layoutDiagnostics } from '../../src/cli/formatters/layout.js';
import { allRules } from '../../src/rules/index.js';

function report(partial: Partial<CatalogReport> = {}): CatalogReport {
  return {
    resources: { status: 'ran', items: [], truncated: false },
    prompts: { status: 'ran', items: [], truncated: false },
    toolsInvoked: false,
    ...partial,
  };
}

describe('lintCatalog', () => {
  it('accepts a named resource and prompt with descriptions', () => {
    const findings = lintCatalog(report({
      resources: {
        status: 'ran',
        truncated: false,
        items: [{ uri: 'file://readme', name: 'readme', description: 'Overview' }],
      },
      prompts: {
        status: 'ran',
        truncated: false,
        items: [{
          name: 'review',
          description: 'Review a diff',
          arguments: [{ name: 'path', description: 'File to review' }],
        }],
      },
    }));
    expect(findings).toEqual([]);
  });

  it('flags an empty URI, a repeated URI, and a repeated display name', () => {
    const findings = lintCatalog(report({
      resources: {
        status: 'ran',
        truncated: false,
        items: [
          { uri: '  ', name: 'blank', description: 'x' },
          { uri: 'file://readme', name: 'notes', description: 'a' },
          { uri: 'file://readme', name: 'notes', description: 'b' },
        ],
      },
    }));
    expect(findings.map((item) => [item.ruleId, item.severity])).toEqual([
      ['resource/uri', 'error'],
      ['resource/uri', 'error'],
      ['resource/name', 'warning'],
    ]);
    expect(findings.filter((item) => item.ruleId === 'resource/uri')).toHaveLength(2);
  });

  it('flags a missing prompt name, a repeated prompt name, and a missing description', () => {
    const findings = lintCatalog(report({
      prompts: {
        status: 'ran',
        truncated: false,
        items: [
          { name: '', description: 'no name' },
          { name: 'review' },
          { name: 'review', description: 'second' },
        ],
      },
    }));
    expect(findings.map((item) => item.ruleId)).toEqual([
      'prompt/name',
      'prompt/name',
      'prompt/description',
    ]);
    expect(findings[0]?.severity).toBe('error');
    expect(findings[2]?.severity).toBe('warning');
  });

  it('flags an empty argument name, a repeated argument name, and a missing argument description', () => {
    const findings = lintCatalog(report({
      prompts: {
        status: 'ran',
        truncated: false,
        items: [{
          name: 'review',
          description: 'Review',
          arguments: [
            { name: '' },
            { name: 'path' },
            { name: 'path', description: 'again' },
          ],
        }],
      },
    }));
    expect(findings.map((item) => [item.ruleId, item.severity])).toEqual([
      ['prompt/argument-name', 'error'],
      ['prompt/argument-name', 'error'],
      ['prompt/argument-description', 'warning'],
    ]);
  });

  it('does not lint a list the server does not implement', () => {
    const findings = lintCatalog(report({
      resources: { status: 'unsupported', items: [], truncated: false, reason: 'Method not found' },
      prompts: { status: 'ran', truncated: false, items: [] },
    }));
    expect(findings).toEqual([]);
  });

  it('exits 1 for a lint error and stays 0 for a warning', () => {
    const clean = report();
    expect(catalogExitCode(clean, [])).toBe(0);
    const warning = lintCatalog(report({
      prompts: { status: 'ran', truncated: false, items: [{ name: 'review' }] },
    }));
    expect(catalogExitCode(report(), warning)).toBe(0);
    const error = lintCatalog(report({
      prompts: { status: 'ran', truncated: false, items: [{ name: 'review' }, { name: 'review', description: 'x' }] },
    }));
    expect(catalogExitCode(report(), error)).toBe(1);
    expect(catalogExitCode(report({
      resources: { status: 'failed', items: [], truncated: false, reason: 'down' },
    }), [])).toBe(1);
  });

  it('keeps the fix class manual so the next line does not offer a write', () => {
    const findings = lintCatalog(report({
      prompts: { status: 'ran', truncated: false, items: [{ name: 'review' }] },
    }));
    const layout = layoutDiagnostics(catalogFindingsToDiagnostics(findings));
    expect(layout.hasSafeFix).toBe(false);
    expect(layout.explainRule).toBe('prompt/description');
    const rule = allRules.find((item) => item.id === 'prompt/description');
    expect(rule?.fixClass).toBe('manual');
    expect(rule?.check({ name: 't', inputSchema: {} }, { config: {} })).toEqual([]);
  });
});
