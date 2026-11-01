import { describe, it, expect } from 'vitest';
import { applyFixes } from '../../src/core/fixer.js';
import type { MCPTool } from '../../src/core/rule.js';
import type { Diagnostic } from '../../src/core/diagnostic.js';

const tool: MCPTool = {
  name: 'search',
  description: 'Search',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', required: false } as MCPTool['inputSchema'],
      data: { type: 'string', contentEncoding: 'base64' },
    },
  },
};

const diagRequiredFalse: Diagnostic = {
  ruleId: 'no-required-false',
  severity: 'error',
  message: 'required: false',
  toolName: 'search',
  path: 'inputSchema.properties.query',
  clients: ['claude'],
  fix: {
    class: 'safe',
    description: 'Remove required: false',
    apply: (s) => { const c = { ...s }; delete c['required']; return c; },
  },
};

const diagContentEncoding: Diagnostic = {
  ruleId: 'no-content-encoding',
  severity: 'error',
  message: 'contentEncoding not allowed',
  toolName: 'search',
  path: 'inputSchema.properties.data',
  clients: ['claude'],
  fix: {
    class: 'safe',
    description: 'Remove contentEncoding',
    apply: (s) => { const c = { ...s }; delete c['contentEncoding']; return c; },
  },
};

describe('applyFixes', () => {
  it('returns original tools unchanged when no fixes', () => {
    const result = applyFixes([tool], [{ ...diagRequiredFalse, fix: undefined }]);
    expect(result[0]).toEqual(tool);
  });

  it('removes required: false from property', () => {
    const result = applyFixes([tool], [diagRequiredFalse]);
    const prop = result[0].inputSchema.properties!['query'] as Record<string, unknown>;
    expect(prop).not.toHaveProperty('required');
    expect(prop.type).toBe('string');
  });

  it('removes contentEncoding from property', () => {
    const result = applyFixes([tool], [diagContentEncoding]);
    const prop = result[0].inputSchema.properties!['data'] as Record<string, unknown>;
    expect(prop).not.toHaveProperty('contentEncoding');
    expect(prop.type).toBe('string');
  });

  it('applies multiple fixes in one pass', () => {
    const result = applyFixes([tool], [diagRequiredFalse, diagContentEncoding]);
    const query = result[0].inputSchema.properties!['query'] as Record<string, unknown>;
    const data = result[0].inputSchema.properties!['data'] as Record<string, unknown>;
    expect(query).not.toHaveProperty('required');
    expect(data).not.toHaveProperty('contentEncoding');
  });

  it('does not mutate original tools', () => {
    const original = structuredClone(tool);
    applyFixes([tool], [diagRequiredFalse]);
    expect(tool).toEqual(original);
  });

  it('filters fixes by onlyRules', () => {
    const result = applyFixes([tool], [diagRequiredFalse, diagContentEncoding], ['no-required-false']);
    const query = result[0].inputSchema.properties!['query'] as Record<string, unknown>;
    const data = result[0].inputSchema.properties!['data'] as Record<string, unknown>;
    expect(query).not.toHaveProperty('required');
    expect(data).toHaveProperty('contentEncoding'); // not fixed
  });

  it('does not apply a review fix', () => {
    const review: Diagnostic = {
      ...diagRequiredFalse,
      fix: { ...diagRequiredFalse.fix!, class: 'review' },
    };
    const result = applyFixes([tool], [review]);
    const prop = result[0].inputSchema.properties!['query'] as Record<string, unknown>;
    expect(prop).toHaveProperty('required', false);
  });

  it('skips diagnostic when tool name not found', () => {
    const diag = { ...diagRequiredFalse, toolName: 'nonexistent' };
    expect(() => applyFixes([tool], [diag])).not.toThrow();
  });
});
