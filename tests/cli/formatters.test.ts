import { describe, it, expect } from 'vitest';
import { formatJson } from '../../src/cli/formatters/json.js';
import { formatMarkdown } from '../../src/cli/formatters/markdown.js';
import { formatTerminal } from '../../src/cli/formatters/terminal.js';
import type { Diagnostic } from '../../src/core/diagnostic.js';

const errorDiag: Diagnostic = {
  ruleId: 'no-required-false',
  severity: 'error',
  message: 'required: false is invalid',
  toolName: 'search',
  path: 'inputSchema.properties.query',
  clients: ['claude'],
};

const warningDiag: Diagnostic = {
  ruleId: 'description-exists',
  severity: 'warning',
  message: 'Missing description',
  toolName: 'search',
  path: 'description',
  clients: ['claude'],
};

describe('formatJson', () => {
  it('outputs valid JSON array', () => {
    const output = formatJson([errorDiag]);
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].ruleId).toBe('no-required-false');
  });

  it('outputs empty array for no diagnostics', () => {
    const output = formatJson([]);
    expect(JSON.parse(output)).toEqual([]);
  });

  it('includes all diagnostic fields', () => {
    const parsed = JSON.parse(formatJson([errorDiag]));
    expect(parsed[0]).toMatchObject({
      ruleId: 'no-required-false',
      severity: 'error',
      toolName: 'search',
      path: 'inputSchema.properties.query',
    });
  });
});

describe('formatMarkdown', () => {
  it('outputs no-issues message when empty', () => {
    expect(formatMarkdown([])).toContain('No issues found');
  });

  it('includes tool name as heading', () => {
    const output = formatMarkdown([errorDiag]);
    expect(output).toContain('### `search`');
  });

  it('includes summary with counts', () => {
    const output = formatMarkdown([errorDiag, warningDiag]);
    expect(output).toContain('1 error');
    expect(output).toContain('1 warning');
  });

  it('includes rule id and path in table', () => {
    const output = formatMarkdown([errorDiag]);
    expect(output).toContain('no-required-false');
    expect(output).toContain('inputSchema.properties.query');
  });
});

describe('formatTerminal', () => {
  it('outputs success message when no diagnostics', () => {
    const output = formatTerminal([], true);
    expect(output).toContain('No issues found');
  });

  it('includes tool name', () => {
    const output = formatTerminal([errorDiag], true);
    expect(output).toContain('search');
  });

  it('includes rule id', () => {
    const output = formatTerminal([errorDiag], true);
    expect(output).toContain('no-required-false');
  });

  it('shows error count in summary', () => {
    const output = formatTerminal([errorDiag], true);
    expect(output).toContain('1 error');
  });

  it('shows error and warning counts', () => {
    const output = formatTerminal([errorDiag, warningDiag], true);
    expect(output).toContain('1 error');
    expect(output).toContain('1 warning');
  });

  it('prints errors before warnings and names the next command', () => {
    const output = formatTerminal([warningDiag, errorDiag], true, 'tools.json');
    const errorAt = output.indexOf('required: false is invalid');
    const warningAt = output.indexOf('Missing description');
    expect(errorAt).toBeGreaterThan(-1);
    expect(warningAt).toBeGreaterThan(errorAt);
    expect(output).toContain('Next: mcp-lint explain no-required-false');
    expect(output).not.toContain('mcp-lint fix');
  });

  it('collapses repeated Cursor title warnings and keeps the count', () => {
    const titles: Diagnostic[] = [0, 1, 2].map((n) => ({
      ruleId: 'cursor/no-missing-title',
      severity: 'warning',
      message: `missing title ${n}`,
      toolName: 'search',
      path: n === 0 ? 'title' : `inputSchema.properties.p${n}.title`,
      clients: ['cursor'],
    }));
    const output = formatTerminal([...titles, errorDiag], true);
    expect(output).toContain('3 missing titles');
    expect(output).toContain('3 warnings');
    expect(output.indexOf('required: false is invalid')).toBeLessThan(output.indexOf('3 missing titles'));
    expect(output.match(/cursor\/no-missing-title/g)).toHaveLength(1);
  });

  it('prints an error index when two tools have errors', () => {
    const other: Diagnostic = {
      ...errorDiag,
      toolName: 'read',
      ruleId: 'no-content-encoding',
      message: 'encoding is unsupported',
    };
    const output = formatTerminal([warningDiag, errorDiag, other], true);
    expect(output).toContain('Errors');
    expect(output).toContain('search  1');
    expect(output).toContain('read  1');
    expect(output.indexOf('Errors')).toBeLessThan(output.indexOf('required: false is invalid'));
  });

  it('offers a dry run when a safe fix is present', () => {
    const safe: Diagnostic = {
      ...errorDiag,
      fix: { class: 'safe', description: 'Remove required: false' },
    };
    const output = formatTerminal([safe], true, 'demo/tools.json');
    expect(output).toContain('mcp-lint fix demo/tools.json --dry-run');
  });
});
