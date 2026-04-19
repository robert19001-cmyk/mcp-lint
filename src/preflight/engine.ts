import type { Action, Decision, DecisionType, Policy, PolicyRule } from './types.js';
import { matchRule } from './policy.js';
import { scoreAction } from './scorer.js';

const DEFAULT_APPROVAL_THRESHOLD = 0.7;
const DEFAULT_BLOCK_THRESHOLD = 0.92;

export function preflight(action: Action, policy?: Policy): Decision {
  validateAction(action);

  const { score, reasons, reversibility } = scoreAction(action);

  const approvalThreshold = policy?.defaults?.approval_threshold ?? DEFAULT_APPROVAL_THRESHOLD;
  const blockThreshold = policy?.defaults?.block_threshold ?? DEFAULT_BLOCK_THRESHOLD;

  const matched: PolicyRule[] = [];
  if (policy) {
    for (const rule of policy.rules) {
      if (matchRule(rule, action, score)) {
        matched.push(rule);
      }
    }
  }

  let decision: DecisionType | null = null;
  let safeAlternative = undefined;
  const policyReasons: string[] = [];

  for (const rule of matched) {
    if (rule.reason) policyReasons.push(rule.reason);

    if (rule.effect === 'deny') {
      decision = 'deny';
      break;
    }
    if (rule.effect === 'require_approval') {
      decision = 'require_approval';
    } else if (rule.effect === 'allow_with_rewrite' && decision === null) {
      decision = 'allow_with_rewrite';
      safeAlternative = rule.rewrite;
    } else if (rule.effect === 'allow' && decision === null) {
      decision = 'allow';
    }
  }

  if (decision === null) {
    if (score >= blockThreshold) {
      decision = 'deny';
      policyReasons.push('risk_above_block_threshold');
    } else if (score >= approvalThreshold) {
      decision = 'require_approval';
      policyReasons.push('risk_above_approval_threshold');
    } else {
      decision = 'allow';
    }
  }

  return {
    decision,
    risk_score: Number(score.toFixed(2)),
    reversibility,
    estimated_cost_usd: action.estimated_cost_usd ?? 0,
    matched_policies: matched.map((r) => r.id),
    reasons: [...reasons, ...policyReasons],
    safe_alternative: safeAlternative,
  };
}

function validateAction(action: Action): void {
  if (!action || typeof action !== 'object') {
    throw new Error('Action must be an object');
  }
  if (!action.tool_type) throw new Error('Action missing tool_type');
  if (!action.tool_name) throw new Error('Action missing tool_name');
  if (typeof action.action !== 'string') throw new Error('Action missing action string');
}
