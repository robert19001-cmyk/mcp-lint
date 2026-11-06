import { describe, it, expect, beforeEach } from 'vitest';
import chalk from 'chalk';
import { allRules } from '../../src/rules/index.js';
import { renderExplain } from '../../src/cli/commands/explain.js';
import { formatCompatIssueCount } from '../../src/cli/commands/compat.js';

beforeEach(() => {
  chalk.level = 0;
});

describe('renderExplain', () => {
  it('marks a safe fix as something fix writes', () => {
    const rule = allRules.find((item) => item.id === 'no-required-false');
    expect(rule?.fixClass).toBe('safe');
    const output = renderExplain(rule!);
    expect(output).toContain('Fix:       safe');
    expect(output).toContain('mcp-lint fix writes this.');
    expect(output).not.toContain('Fixable:');
  });

  it('marks a review fix as listed, not written', () => {
    const rule = allRules.find((item) => item.id === 'openai/no-additional-properties');
    expect(rule?.fixClass).toBe('review');
    const output = renderExplain(rule!);
    expect(output).toContain('Fix:       review');
    expect(output).toContain('does not write it');
    expect(output).toContain('Change');
    expect(output).not.toContain('Auto-fix');
  });

  it('marks a missing title as manual', () => {
    const rule = allRules.find((item) => item.id === 'cursor/no-missing-title');
    expect(rule?.fixClass).toBe('manual');
    const output = renderExplain(rule!);
    expect(output).toContain('You edit this yourself');
  });
});

describe('formatCompatIssueCount', () => {
  it('uses a singular verb for one tool', () => {
    expect(formatCompatIssueCount(1)).toBe(
      '1 tool has compatibility issues. Run `mcp-lint check` for details.',
    );
    expect(formatCompatIssueCount(2)).toContain('2 tools have');
  });
});
