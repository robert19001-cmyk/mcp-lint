export type ToolType =
  | 'shell'
  | 'file_read'
  | 'file_write'
  | 'file_delete'
  | 'http'
  | 'mcp_tool'
  | 'email'
  | 'payment'
  | 'database'
  | 'other';

export type Reversibility = 'reversible' | 'partially_reversible' | 'irreversible';

export type DecisionType = 'allow' | 'deny' | 'require_approval' | 'allow_with_rewrite';

export type Effect = 'allow' | 'deny' | 'require_approval' | 'allow_with_rewrite';

export interface Action {
  actor_id?: string;
  workspace_id?: string;
  tool_type: ToolType;
  tool_name: string;
  action: string;
  target?: string;
  context?: Record<string, unknown>;
  estimated_cost_usd?: number;
}

export interface Rewrite {
  tool_type: ToolType;
  tool_name?: string;
  action: string;
  target?: string;
}

export interface PolicyRule {
  id: string;
  when: {
    tool_type?: ToolType | ToolType[];
    tool_name?: string | string[];
    action_matches?: string[];
    target_matches?: string[];
    domain_not_in_allowlist?: boolean;
    allowlist?: string[];
    min_risk?: number;
    max_cost_usd?: number;
  };
  effect: Effect;
  rewrite?: Rewrite;
  reason?: string;
}

export interface Policy {
  version: number;
  defaults?: {
    approval_threshold?: number;
    block_threshold?: number;
  };
  budgets?: {
    max_http_cost_usd_per_action?: number;
    max_model_cost_usd_per_action?: number;
  };
  rules: PolicyRule[];
}

export interface Decision {
  decision: DecisionType;
  risk_score: number;
  reversibility: Reversibility;
  estimated_cost_usd: number;
  matched_policies: string[];
  reasons: string[];
  safe_alternative?: Rewrite;
}
