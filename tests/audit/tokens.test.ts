import { describe, expect, it } from 'vitest';
import {
  buildTokenBudget,
  compareTokenBudgets,
  estimateTokens,
  TokenEstimateError,
} from '../../src/audit/tokens.js';

describe('estimateTokens', () => {
  it('estimates an empty schema as ceil(chars / 4)', () => {
    const estimate = estimateTokens({});
    expect(estimate).toEqual({
      method: 'chars-div-4',
      approximate: true,
      chars: 2,
      tokens: 1,
    });
  });

  it('estimates a small object from its JSON length', () => {
    const value = { name: 'search' };
    const json = JSON.stringify(value);
    expect(estimateTokens(value).tokens).toBe(Math.ceil(json.length / 4));
    expect(estimateTokens(value).approximate).toBe(true);
  });

  it('estimates a large string without a tokenizer', () => {
    const value = { description: 'x'.repeat(20_000) };
    const estimate = estimateTokens(value);
    expect(estimate.chars).toBe(JSON.stringify(value).length);
    expect(estimate.tokens).toBe(Math.ceil(estimate.chars / 4));
    expect(estimate.tokens).toBeGreaterThan(4000);
  });

  it('rejects values that JSON cannot serialize', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => estimateTokens(circular)).toThrow(TokenEstimateError);
    expect(() => estimateTokens(undefined)).toThrow(TokenEstimateError);
    expect(() => estimateTokens(1n)).toThrow(TokenEstimateError);
  });
});

describe('buildTokenBudget', () => {
  it('withholds a healthy reading of an empty list', () => {
    const budget = buildTokenBudget([]);
    expect(budget.toolCount).toBe(0);
    expect(budget.tokens).toBe(1);
    expect(budget.level).toBe('ok');
    expect(budget.note).toMatch(/not a healthy server/);
    expect(budget.approximate).toBe(true);
  });

  it('ranks the larger tool first and flags a repeated description', () => {
    const shared = 'Look up a document in the workspace index.';
    const budget = buildTokenBudget([
      { name: 'small', description: shared, inputSchema: { type: 'object' } },
      {
        name: 'large',
        description: shared,
        inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'q'.repeat(4000) } } },
      },
    ]);
    expect(budget.tools.map((tool) => tool.name)).toEqual(['large', 'small']);
    expect(budget.repeatedDescriptions).toEqual([{ description: shared, tools: ['large', 'small'] }]);
    expect(budget.tools[0].oversizedSchema).toBe(true);
  });

  it('uses configured warn and over thresholds', () => {
    const tools = [{ name: 'big', description: 'y'.repeat(20_000), inputSchema: { type: 'object' } }];
    const warned = buildTokenBudget(tools, { warn: 100, over: 50_000, schemaWarn: 800 });
    const over = buildTokenBudget(tools, { warn: 100, over: 200, schemaWarn: 800 });
    expect(warned.level).toBe('warn');
    expect(over.level).toBe('over');
  });

  it('rejects a warn threshold above the over threshold', () => {
    expect(() => buildTokenBudget([], { warn: 10, over: 5, schemaWarn: 1 })).toThrow(TokenEstimateError);
  });
});

describe('compareTokenBudgets', () => {
  it('reports added, removed, and grown tools', () => {
    const before = buildTokenBudget([
      { name: 'kept', description: 'short text here', inputSchema: { type: 'object' } },
      { name: 'gone', description: 'removed tool', inputSchema: { type: 'object' } },
    ]);
    const after = buildTokenBudget([
      { name: 'kept', description: 'short text here and now much longer than before', inputSchema: { type: 'object' } },
      { name: 'added', description: 'new tool', inputSchema: { type: 'object' } },
    ]);
    const diff = compareTokenBudgets(before, after);
    expect(diff.approximate).toBe(true);
    expect(diff.addedTools).toEqual(['added']);
    expect(diff.removedTools).toEqual(['gone']);
    expect(diff.grew).toEqual(['kept']);
    expect(diff.deltaTokens).toBe(after.tokens - before.tokens);
  });
});
