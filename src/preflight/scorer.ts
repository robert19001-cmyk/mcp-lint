import type { Action, Reversibility, ToolType } from './types.js';

const BASE_SCORES: Record<ToolType, number> = {
  file_read: 0.1,
  file_write: 0.35,
  file_delete: 0.75,
  shell: 0.5,
  http: 0.35,
  mcp_tool: 0.3,
  email: 0.6,
  payment: 0.95,
  database: 0.7,
  other: 0.4,
};

const DESTRUCTIVE_PATTERNS: RegExp[] = [
  /\brm\s+-rf\b/i,
  /\brmdir\s+\/s\b/i,
  /\bdel\s+\/s\b/i,
  /\bdrop\s+table\b/i,
  /\btruncate\s+table\b/i,
  /\bformat\s+\/\w+/i,
  /\bmkfs\b/i,
  /\b:\(\)\{\s*:\|:&\s*\};:/,
  /\bgit\s+push\s+.*--force\b/i,
  /\bgit\s+reset\s+--hard\b/i,
];

const SENSITIVE_TARGETS: RegExp[] = [
  /\/etc\b/,
  /\/prod\b/,
  /\/production\b/,
  /\/app\/data\b/,
  /\.env(\.|$)/,
  /\bsecrets?\b/i,
  /\bcredentials?\b/i,
  /\/root\b/,
  /\bC:\\Windows\b/i,
];

const MASS_OPERATION_PATTERNS: RegExp[] = [
  /\*\*\/\*/,
  /\brecursive\b/i,
  /\s+-r\b/,
  /\s+-R\b/,
  /\bALL\b/,
];

export interface ScoreBreakdown {
  score: number;
  reasons: string[];
  reversibility: Reversibility;
}

export function scoreAction(action: Action): ScoreBreakdown {
  const reasons: string[] = [];
  let score = BASE_SCORES[action.tool_type] ?? 0.4;
  reasons.push(`base_${action.tool_type}`);

  const actionText = action.action ?? '';
  const targetText = action.target ?? '';
  const haystack = `${actionText} ${targetText}`;

  let destructive = false;
  for (const pattern of DESTRUCTIVE_PATTERNS) {
    if (pattern.test(haystack)) {
      destructive = true;
      score += 0.25;
      reasons.push('destructive_pattern');
      break;
    }
  }

  if (action.tool_type === 'file_delete') {
    destructive = true;
  }

  for (const pattern of SENSITIVE_TARGETS) {
    if (pattern.test(haystack)) {
      score += 0.2;
      reasons.push('sensitive_target');
      break;
    }
  }

  for (const pattern of MASS_OPERATION_PATTERNS) {
    if (pattern.test(haystack)) {
      score += 0.1;
      reasons.push('mass_operation');
      break;
    }
  }

  if (action.context?.environment === 'prod' || action.context?.environment === 'production') {
    score += 0.15;
    reasons.push('prod_environment');
  }

  const cost = action.estimated_cost_usd ?? 0;
  if (cost >= 10) {
    score += 0.15;
    reasons.push('high_cost');
  } else if (cost >= 1) {
    score += 0.05;
    reasons.push('nontrivial_cost');
  }

  score = Math.min(1, Math.max(0, score));

  const reversibility = computeReversibility(action, destructive);

  if (reversibility === 'irreversible') {
    reasons.push('irreversible_operation');
  }

  return { score, reasons, reversibility };
}

function computeReversibility(action: Action, destructive: boolean): Reversibility {
  if (destructive) return 'irreversible';
  switch (action.tool_type) {
    case 'file_read':
      return 'reversible';
    case 'file_write':
      return 'partially_reversible';
    case 'file_delete':
      return 'irreversible';
    case 'payment':
    case 'email':
      return 'irreversible';
    case 'http':
      return 'partially_reversible';
    case 'database':
      return 'partially_reversible';
    case 'shell':
      return 'partially_reversible';
    case 'mcp_tool':
      return 'partially_reversible';
    default:
      return 'partially_reversible';
  }
}
