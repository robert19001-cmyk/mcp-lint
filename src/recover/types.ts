export type FailureKind =
  | 'credential'
  | 'permission'
  | 'rate_limit'
  | 'explicit'
  | 'silent'
  | 'timeout'
  | 'malformed';

export type RecoveryRuleId =
  | 'recover/names-tool'
  | 'recover/names-retry'
  | 'recover/agent-reachable'
  | 'recover/not-silent'
  | 'recover/bounded-hang';

export interface RecoverySample {
  id?: string;
  tool: string;
  kind: FailureKind;
  message?: string;
  isError?: boolean;
  durationMs?: number;
  tools: string[];
}

export interface RecoverySampleInput {
  id?: string;
  tool: string;
  kind: FailureKind;
  message?: string;
  isError?: boolean;
  durationMs?: number;
  tools?: string[];
}

export interface RecoveryFile {
  tools: string[];
  hangMs?: number;
  samples: RecoverySampleInput[];
}

export interface RecoveryFinding {
  ruleId: RecoveryRuleId;
  severity: 'error' | 'warning';
  tool: string;
  sampleId: string;
  message: string;
}

export interface RecoveryReport {
  samples: number;
  errors: number;
  warnings: number;
  recoverable: number;
  findings: RecoveryFinding[];
}

export const DEFAULT_HANG_MS = 15_000;

export const FAILURE_KINDS: readonly FailureKind[] = [
  'credential',
  'permission',
  'rate_limit',
  'explicit',
  'silent',
  'timeout',
  'malformed',
];
