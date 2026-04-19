import { describe, it, expect } from 'vitest';
import { buildCompatMatrix } from '../../src/core/compat-matrix.js';
import type { MCPTool } from '../../src/core/rule.js';
import type { Diagnostic } from '../../src/core/diagnostic.js';

const tools: MCPTool[] = [
  { name: 'search-tool', description: 'Search', inputSchema: { type: 'object' } },
  { name: 'file-reader', description: 'Read file', inputSchema: { type: 'object' } },
];

const diagnostics: Diagnostic[] = [
  {
    ruleId: 'cursor/no-default-without-type',
    severity: 'error',
    message: 'error msg',
    toolName: 'search-tool',
    path: 'inputSchema',
    clients: ['cursor'],
  },
  {
    ruleId: 'gemini/no-nested-objects',
    severity: 'warning',
    message: 'warning msg',
    toolName: 'search-tool',
    path: 'inputSchema',
    clients: ['gemini'],
  },
];

describe('buildCompatMatrix', () => {
  it('marks tool with error as incompatible for that client', () => {
    const matrix = buildCompatMatrix(tools, diagnostics);
    expect(matrix.cells['search-tool']['cursor'].compatible).toBe(false);
    expect(matrix.cells['search-tool']['cursor'].errorCount).toBe(1);
  });

  it('marks tool with only warning as compatible', () => {
    const matrix = buildCompatMatrix(tools, diagnostics);
    expect(matrix.cells['search-tool']['gemini'].compatible).toBe(true);
    expect(matrix.cells['search-tool']['gemini'].errorCount).toBe(0);
  });

  it('marks tool with no issues as compatible for all clients', () => {
    const matrix = buildCompatMatrix(tools, diagnostics);
    expect(matrix.cells['file-reader']['claude'].compatible).toBe(true);
    expect(matrix.cells['file-reader']['cursor'].compatible).toBe(true);
  });

  it('includes all 8 clients in matrix', () => {
    const matrix = buildCompatMatrix(tools, diagnostics);
    expect(matrix.clients).toContain('claude');
    expect(matrix.clients).toContain('windsurf');
    expect(matrix.clients).toContain('openai');
    expect(matrix.clients).toContain('continue');
    expect(matrix.clients).toHaveLength(8);
  });

  it('includes all tools in matrix', () => {
    const matrix = buildCompatMatrix(tools, diagnostics);
    expect(matrix.tools).toEqual(['search-tool', 'file-reader']);
  });
});
