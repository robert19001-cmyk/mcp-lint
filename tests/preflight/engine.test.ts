import { describe, it, expect } from 'vitest';
import { preflight } from '../../src/preflight/engine.js';
import { parsePolicy } from '../../src/preflight/policy.js';
import type { Action } from '../../src/preflight/types.js';

describe('preflight engine', () => {
  it('allows a low-risk file read with no policy', () => {
    const action: Action = {
      tool_type: 'file_read',
      tool_name: 'read',
      action: 'cat README.md',
      target: './README.md',
    };
    const d = preflight(action);
    expect(d.decision).toBe('allow');
    expect(d.risk_score).toBeLessThan(0.3);
    expect(d.reversibility).toBe('reversible');
  });

  it('requires approval for a high-risk destructive shell command', () => {
    const action: Action = {
      tool_type: 'shell',
      tool_name: 'bash',
      action: 'rm -rf ./tmp',
      target: './tmp',
    };
    const d = preflight(action);
    expect(['require_approval', 'deny']).toContain(d.decision);
    expect(d.reasons).toContain('destructive_pattern');
    expect(d.reversibility).toBe('irreversible');
  });

  it('denies when a deny rule matches', () => {
    const policy = parsePolicy(`
version: 1
rules:
  - id: block-prod-delete
    when:
      tool_type: shell
      action_matches: ["rm -rf"]
      target_matches: ["/prod"]
    effect: deny
    reason: Cannot delete prod paths
`);
    const action: Action = {
      tool_type: 'shell',
      tool_name: 'bash',
      action: 'rm -rf /prod/data',
      target: '/prod/data',
    };
    const d = preflight(action, policy);
    expect(d.decision).toBe('deny');
    expect(d.matched_policies).toContain('block-prod-delete');
    expect(d.reasons).toContain('Cannot delete prod paths');
  });

  it('allows with rewrite when matched rule provides a safe alternative', () => {
    const policy = parsePolicy(`
version: 1
rules:
  - id: rewrite-tmp-delete
    when:
      tool_type: shell
      action_matches: ["rm -rf ./tmp"]
    effect: allow_with_rewrite
    rewrite:
      tool_type: file_delete
      action: move_to_trash
      target: ./tmp
`);
    const action: Action = {
      tool_type: 'shell',
      tool_name: 'bash',
      action: 'rm -rf ./tmp',
      target: './tmp',
    };
    const d = preflight(action, policy);
    expect(d.decision).toBe('allow_with_rewrite');
    expect(d.safe_alternative).toEqual({
      tool_type: 'file_delete',
      action: 'move_to_trash',
      target: './tmp',
    });
  });

  it('uses default thresholds when no policy rule matches', () => {
    const policy = parsePolicy(`
version: 1
defaults:
  approval_threshold: 0.5
  block_threshold: 0.9
rules: []
`);
    const action: Action = {
      tool_type: 'file_write',
      tool_name: 'write',
      action: 'write config',
      target: '.env',
    };
    const d = preflight(action, policy);
    expect(d.decision).toBe('require_approval');
    expect(d.reasons).toContain('risk_above_approval_threshold');
  });

  it('requires approval for HTTP to non-allowlisted domain', () => {
    const policy = parsePolicy(`
version: 1
rules:
  - id: approval-external-http
    when:
      tool_type: http
      domain_not_in_allowlist: true
      allowlist: ["api.github.com", "api.openai.com"]
    effect: require_approval
    reason: External HTTP requires approval
`);
    const action: Action = {
      tool_type: 'http',
      tool_name: 'fetch',
      action: 'GET https://evil.example.com/data',
      target: 'https://evil.example.com/data',
    };
    const d = preflight(action, policy);
    expect(d.decision).toBe('require_approval');
    expect(d.matched_policies).toContain('approval-external-http');
  });

  it('boosts score when action targets sensitive paths', () => {
    const action: Action = {
      tool_type: 'file_write',
      tool_name: 'write',
      action: 'write secrets',
      target: '/etc/secrets.conf',
    };
    const d = preflight(action);
    expect(d.risk_score).toBeGreaterThan(0.5);
    expect(d.reasons).toContain('sensitive_target');
  });

  it('boosts score in prod environment', () => {
    const action: Action = {
      tool_type: 'file_write',
      tool_name: 'write',
      action: 'write config',
      target: './config.json',
      context: { environment: 'prod' },
    };
    const d = preflight(action);
    expect(d.reasons).toContain('prod_environment');
  });

  it('includes cost in decision output', () => {
    const action: Action = {
      tool_type: 'payment',
      tool_name: 'charge',
      action: 'charge customer',
      estimated_cost_usd: 42.5,
    };
    const d = preflight(action);
    expect(d.estimated_cost_usd).toBe(42.5);
    expect(d.reasons).toContain('high_cost');
  });

  it('rejects actions with missing required fields', () => {
    expect(() => preflight({} as Action)).toThrow();
    expect(() => preflight({ tool_type: 'shell' } as Action)).toThrow();
  });

  it('denies when deny rule overrides lower-priority allow', () => {
    const policy = parsePolicy(`
version: 1
rules:
  - id: allow-all-shell
    when:
      tool_type: shell
    effect: allow
  - id: block-dangerous
    when:
      tool_type: shell
      action_matches: ["rm -rf"]
    effect: deny
`);
    const action: Action = {
      tool_type: 'shell',
      tool_name: 'bash',
      action: 'rm -rf /',
    };
    const d = preflight(action, policy);
    expect(d.decision).toBe('deny');
  });

  it('matches glob patterns in target_matches', () => {
    const policy = parsePolicy(`
version: 1
rules:
  - id: workspace-only
    when:
      tool_type: file_write
      target_matches: ["./workspace/**"]
    effect: allow
`);
    const action: Action = {
      tool_type: 'file_write',
      tool_name: 'write',
      action: 'write',
      target: './workspace/src/app.ts',
    };
    const d = preflight(action, policy);
    expect(d.matched_policies).toContain('workspace-only');
  });

  it('uses min_risk threshold in rule matching', () => {
    const policy = parsePolicy(`
version: 1
rules:
  - id: high-risk-approval
    when:
      min_risk: 0.8
    effect: require_approval
`);
    const lowRisk: Action = {
      tool_type: 'file_read',
      tool_name: 'read',
      action: 'cat x',
    };
    const highRisk: Action = {
      tool_type: 'shell',
      tool_name: 'bash',
      action: 'rm -rf /etc/secrets',
    };
    expect(preflight(lowRisk, policy).matched_policies).not.toContain('high-risk-approval');
    expect(preflight(highRisk, policy).matched_policies).toContain('high-risk-approval');
  });
});
