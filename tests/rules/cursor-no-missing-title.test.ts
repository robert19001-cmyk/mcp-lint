import { describe, it, expect } from 'vitest';
import { cursorNoMissingTitle } from '../../src/rules/client-specific/cursor.js';
import type { MCPTool, RuleContext } from '../../src/core/rule.js';

const ctx: RuleContext = { config: {} };
const makeTool = (tool: Partial<MCPTool>): MCPTool => ({
  name: 'search_docs',
  description: 'Search documentation',
  title: 'Search Docs',
  inputSchema: {
    type: 'object',
    properties: {
      query_text: { title: 'Query Text', type: 'string', description: 'Search query' },
    },
  },
  ...tool,
});

describe('cursor/no-missing-title', () => {
  it('returns no diagnostics when tool and parameters have titles', () => {
    expect(cursorNoMissingTitle.check(makeTool({}), ctx)).toHaveLength(0);
  });

  it('detects a missing tool title', () => {
    const diagnostics = cursorNoMissingTitle.check(makeTool({ title: undefined }), ctx);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      ruleId: 'cursor/no-missing-title',
      severity: 'warning',
      path: 'title',
      clients: ['cursor'],
    });
  });

  it('detects a blank tool title', () => {
    const diagnostics = cursorNoMissingTitle.check(makeTool({ title: '   ' }), ctx);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].path).toBe('title');
  });

  it('detects missing parameter titles', () => {
    const diagnostics = cursorNoMissingTitle.check(
      makeTool({
        inputSchema: {
          type: 'object',
          properties: {
            query_text: { type: 'string', description: 'Search query' },
            limit_count: { title: '', type: 'number', description: 'Max results' },
          },
        },
      }),
      ctx,
    );

    expect(diagnostics).toHaveLength(2);
    expect(diagnostics.map((d) => d.path)).toEqual([
      'inputSchema.properties.query_text.title',
      'inputSchema.properties.limit_count.title',
    ]);
  });
});
