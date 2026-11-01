import { describe, expect, it } from 'vitest';
import { formatGitHubAnnotations } from '../../scripts/github-annotations.mjs';

describe('GitHub annotations', () => {
  it('maps severities and escapes newlines', () => {
    const text = formatGitHubAnnotations([
      {
        ruleId: 'tool-name/duplicate',
        severity: 'error',
        message: 'line\n2',
        toolName: 'search',
        path: 'name',
      },
      {
        ruleId: 'description-exists',
        severity: 'warning',
        message: 'missing',
        toolName: 'search',
        path: 'description',
      },
    ], 'tools.json');
    expect(text).toBe([
      '::error file=tools.json,title=tool-name/duplicate::search name: line%0A2',
      '::warning file=tools.json,title=description-exists::search description: missing',
    ].join('\n'));
  });

  it('returns nothing for a non-array', () => {
    expect(formatGitHubAnnotations({ files: [] }, 'tools.json')).toBe('');
  });
});
