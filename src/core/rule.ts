import type { Severity } from './severity.js';
export type { Severity } from './severity.js';
import type { Diagnostic } from './diagnostic.js';

export type ClientId =
  | 'claude' | 'cursor' | 'gemini' | 'vscode'
  | 'windsurf' | 'cline' | 'openai' | 'continue';

export interface JSONSchema {
  type?: string | string[];
  properties?: Record<string, JSONSchema>;
  required?: string[] | boolean;
  items?: JSONSchema | JSONSchema[];
  enum?: unknown[];
  $ref?: string;
  $defs?: Record<string, JSONSchema>;
  definitions?: Record<string, JSONSchema>;
  if?: JSONSchema;
  then?: JSONSchema;
  else?: JSONSchema;
  oneOf?: JSONSchema[];
  anyOf?: JSONSchema[];
  allOf?: JSONSchema[];
  not?: JSONSchema;
  patternProperties?: Record<string, JSONSchema>;
  additionalItems?: JSONSchema | boolean;
  additionalProperties?: JSONSchema | boolean;
  dependencies?: Record<string, JSONSchema | string[]>;
  $dynamicRef?: string;
  contentEncoding?: string;
  format?: string;
  default?: unknown;
  description?: string;
  [key: string]: unknown;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: JSONSchema;
}

export interface Config {
  extends?: string;
  rules?: Record<string, Severity | 'off'>;
  clients?: ClientId[];
  ignore?: string[];
  maxDepth?: number;
}

export interface RuleContext {
  config: Config;
}

export interface RuleDocs {
  why: string;
  badExample: object;
  goodExample: object;
  fixNote?: string;
}

export interface Rule {
  id: string;
  severity: Severity;
  description: string;
  url?: string;
  clients: ClientId[];
  docs?: RuleDocs;
  check: (tool: MCPTool, context: RuleContext) => Diagnostic[];
}
