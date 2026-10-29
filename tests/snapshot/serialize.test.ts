import { describe, expect, it } from 'vitest';
import { serializeTools } from '../../src/snapshot/serialize.js';
import type { MCPTool } from '../../src/core/rule.js';

describe('serializeTools', () => {
  it('sorts tools by name and keeps a stable key order', () => {
    const tools: MCPTool[] = [
      {
        name: 'zeta',
        description: 'Last',
        inputSchema: { type: 'object' },
      },
      {
        name: 'alpha',
        title: 'Alpha',
        description: 'First',
        inputSchema: { type: 'object', properties: { q: { type: 'string' } } },
        annotations: { readOnlyHint: true },
      },
    ];

    const text = serializeTools(tools);
    const parsed = JSON.parse(text) as Array<Record<string, unknown>>;
    expect(parsed.map((item) => item.name)).toEqual(['alpha', 'zeta']);
    expect(Object.keys(parsed[0] ?? {})).toEqual(['name', 'title', 'description', 'inputSchema', 'annotations']);
    expect(text.endsWith('\n')).toBe(true);
  });
});
