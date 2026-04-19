import { readFile } from 'node:fs/promises';
import YAML from 'yaml';
import type { Action, Policy, PolicyRule } from './types.js';

export async function loadPolicy(path: string): Promise<Policy> {
  const raw = await readFile(path, 'utf8');
  const parsed = YAML.parse(raw) as Partial<Policy>;
  return normalizePolicy(parsed);
}

export function parsePolicy(yaml: string): Policy {
  const parsed = YAML.parse(yaml) as Partial<Policy>;
  return normalizePolicy(parsed);
}

function normalizePolicy(parsed: Partial<Policy>): Policy {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Policy file is empty or not an object');
  }
  const rules = Array.isArray(parsed.rules) ? parsed.rules : [];
  for (const [idx, rule] of rules.entries()) {
    if (!rule.id) throw new Error(`Policy rule #${idx} missing "id"`);
    if (!rule.when) throw new Error(`Policy rule "${rule.id}" missing "when"`);
    if (!rule.effect) throw new Error(`Policy rule "${rule.id}" missing "effect"`);
  }
  return {
    version: parsed.version ?? 1,
    defaults: parsed.defaults ?? {},
    budgets: parsed.budgets ?? {},
    rules,
  };
}

export function matchRule(rule: PolicyRule, action: Action, riskScore: number): boolean {
  const w = rule.when;

  if (w.tool_type) {
    const types = Array.isArray(w.tool_type) ? w.tool_type : [w.tool_type];
    if (!types.includes(action.tool_type)) return false;
  }

  if (w.tool_name) {
    const names = Array.isArray(w.tool_name) ? w.tool_name : [w.tool_name];
    if (!names.includes(action.tool_name)) return false;
  }

  if (w.action_matches && w.action_matches.length > 0) {
    const hit = w.action_matches.some((m) => action.action.includes(m));
    if (!hit) return false;
  }

  if (w.target_matches && w.target_matches.length > 0) {
    const target = action.target ?? '';
    const hit = w.target_matches.some((m) => matchesGlob(target, m));
    if (!hit) return false;
  }

  if (w.domain_not_in_allowlist) {
    const domain = extractDomain(action);
    const allow = w.allowlist ?? [];
    if (!domain) return false;
    if (allow.includes(domain)) return false;
  }

  if (typeof w.min_risk === 'number') {
    if (riskScore < w.min_risk) return false;
  }

  if (typeof w.max_cost_usd === 'number') {
    const cost = action.estimated_cost_usd ?? 0;
    if (cost <= w.max_cost_usd) return false;
  }

  return true;
}

function matchesGlob(value: string, pattern: string): boolean {
  if (pattern.includes('**') || pattern.includes('*')) {
    const regex = new RegExp(
      '^' +
        pattern
          .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
          .replace(/\*\*/g, '§§')
          .replace(/\*/g, '[^/]*')
          .replace(/§§/g, '.*') +
        '$',
    );
    return regex.test(value);
  }
  return value.includes(pattern);
}

function extractDomain(action: Action): string | null {
  const candidate = action.target ?? action.action;
  const match = candidate.match(/https?:\/\/([^/\s]+)/i);
  if (match) return match[1].toLowerCase();
  if (action.context && typeof action.context.domain === 'string') {
    return (action.context.domain as string).toLowerCase();
  }
  return null;
}
