import { describe, expect, it } from 'vitest';
import { classifyFailure, mentionedTool, scoreRecovery, unreachableStep } from '../../src/recover/score.js';

const tools = ['login', 'search', 'search_issues'];

describe('scoreRecovery', () => {
  it('accepts a credential error that names a server tool', () => {
    const report = scoreRecovery([
      {
        tool: 'search',
        kind: 'credential',
        message: 'Unauthorized. Call the login tool, then retry search.',
      },
    ], { tools });

    expect(report.errors).toBe(0);
    expect(report.recoverable).toBe(1);
  });

  it('rejects a terminal command the agent cannot run', () => {
    const report = scoreRecovery([
      {
        tool: 'search',
        kind: 'credential',
        message: 'Unauthorized. Run npm login in your terminal.',
      },
    ], { tools });

    expect(report.errors).toBeGreaterThan(0);
    expect(report.findings.map((finding) => finding.ruleId)).toEqual(expect.arrayContaining([
      'recover/agent-reachable',
      'recover/names-tool',
    ]));
  });

  it('rejects a rate limit that says to wait without naming the call', () => {
    const report = scoreRecovery([
      {
        tool: 'search',
        kind: 'rate_limit',
        message: 'Wait before retrying.',
      },
    ], { tools });

    expect(report.findings.map((finding) => finding.ruleId)).toContain('recover/names-retry');
  });

  it('accepts a rate limit that names the tool to repeat', () => {
    const report = scoreRecovery([
      {
        tool: 'search',
        kind: 'rate_limit',
        message: 'Rate limit. Wait, then call search again.',
        durationMs: 40,
      },
    ], { tools, hangMs: 15_000 });

    expect(report.errors).toBe(0);
  });

  it('rejects silent content and a hang past the budget', () => {
    const report = scoreRecovery([
      { tool: 'search', kind: 'silent', message: '' },
      { tool: 'search', kind: 'timeout', message: 'Timed out. Retry search.', durationMs: 60_000 },
    ], { tools, hangMs: 15_000 });

    expect(report.findings.map((finding) => finding.ruleId)).toEqual(expect.arrayContaining([
      'recover/not-silent',
      'recover/bounded-hang',
    ]));
    expect(report.recoverable).toBe(0);
  });

  it('leaves a plain validation error alone', () => {
    const report = scoreRecovery([
      {
        tool: 'search',
        kind: 'explicit',
        message: 'Invalid arguments: query is required.',
        isError: true,
        durationMs: 12,
      },
    ], { tools });

    expect(report.errors).toBe(0);
  });

  it('warns when a tool name sits next to a web page', () => {
    const report = scoreRecovery([
      {
        tool: 'search',
        kind: 'credential',
        message: 'Call login, or sign in at the browser page https://example.com/login.',
      },
    ], { tools });

    const web = report.findings.find((finding) => finding.ruleId === 'recover/agent-reachable');
    expect(web?.severity).toBe('warning');
    expect(report.errors).toBe(0);
  });

  it('does not treat a shell argument as a tool call', () => {
    expect(mentionedTool('Run npm login in your terminal.', ['login', 'search'])).toBeNull();
    expect(mentionedTool('use search_issues now', ['search', 'search_issues'])).toBe('search_issues');
  });

  it('classifies unreachable steps', () => {
    expect(unreachableStep('set MCP_TOKEN in the environment variable')).toBe('a config change');
    expect(unreachableStep('Call login, then retry search.')).toBeNull();
  });

  it('classifies live probe text', () => {
    expect(classifyFailure({ message: 'Unauthorized', isError: true, durationMs: 10, hangMs: 1000 })).toBe('credential');
    expect(classifyFailure({ message: '', isError: false, durationMs: 10, hangMs: 1000 })).toBe('silent');
    expect(classifyFailure({ message: 'nope', isError: true, durationMs: 5000, hangMs: 1000 })).toBe('timeout');
  });
});
