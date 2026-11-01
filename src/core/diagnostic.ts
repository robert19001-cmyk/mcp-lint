import type { Severity } from './severity.js';
import type { ClientId } from './rule.js';

export type FixClass = 'safe' | 'review' | 'manual';

export interface Fix {
  description: string;
  class?: FixClass;
  apply?: (schema: Record<string, unknown>) => Record<string, unknown>;
}

export interface Diagnostic {
  ruleId: string;
  severity: Severity;
  message: string;
  toolName: string;
  path: string;
  clients: ClientId[];
  fix?: Fix;
}
