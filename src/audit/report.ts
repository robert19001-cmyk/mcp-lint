import { z } from 'zod';
import type { Diagnostic } from '../core/diagnostic.js';
import { computeQualityReport } from '../core/quality-score.js';
import type { MCPTool } from '../core/rule.js';
import {
  buildTokenBudget,
  DEFAULT_TOKEN_THRESHOLDS,
  type TokenBudget,
  type TokenThresholds,
} from './tokens.js';

export const AUDIT_REPORT_SCHEMA_VERSION = 1 as const;
export const QUALITY_ALGORITHM = 'quality-v2' as const;

export class AuditInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuditInputError';
  }
}

export type SectionStatus = 'ran' | 'not_run' | 'partial' | 'failed';

export interface RanSection<T> {
  status: 'ran';
  data: T;
}

export interface NotRunSection {
  status: 'not_run' | 'failed';
  reason: string;
}

export interface PartialSection<T> {
  status: 'partial';
  reason: string;
  data: T;
}

export type Section<T> = RanSection<T> | NotRunSection | PartialSection<T>;

export interface AuditFinding {
  ruleId: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  toolName: string;
  path: string;
  clients: string[];
  fixable: boolean;
}

export interface AuditTool {
  name: string;
  hasDescription: boolean;
  hasInputSchema: boolean;
  hasOutputSchema: boolean;
}

export interface QualitySectionData {
  algorithm: typeof QUALITY_ALGORITHM;
  overall: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  weights: {
    description: number;
    inputSchema: number;
    outputSchema: number;
    lintClean: number;
    error: number;
    warning: number;
  };
  coverage: {
    toolCount: number;
    withDescription: number;
    withInputSchema: number;
    withOutputSchema: number;
  };
  confidence: 'low' | 'medium';
  note: string;
}

export interface SeverityCounts {
  error: number;
  warning: number;
  info: number;
}

export interface MCPAuditReport {
  schemaVersion: typeof AUDIT_REPORT_SCHEMA_VERSION;
  generatedAt: string;
  tool: { name: 'mcp-lint'; version: string };
  scope: {
    source: string;
    mode: 'offline-tools';
    liveServer: false;
    toolsInvoked: false;
  };
  tools: AuditTool[];
  duplicateToolNames: string[];
  findings: Section<AuditFinding[]>;
  severity: Section<SeverityCounts>;
  compatibility: NotRunSection;
  tokenBudget: Section<TokenBudget>;
  quality: Section<QualitySectionData>;
  recovery: NotRunSection;
  preflight: NotRunSection;
  recommendations: string[];
  coverage: {
    ran: string[];
    notRun: string[];
    confidence: 'low' | 'medium' | 'high';
  };
}

export interface BuildAuditReportInput {
  source: string;
  tools: unknown;
  diagnostics?: Diagnostic[];
  version?: string;
  generatedAt?: string;
  thresholds?: TokenThresholds;
}

const severitySchema = z.enum(['error', 'warning', 'info']);

const findingSchema = z.object({
  ruleId: z.string().min(1),
  severity: severitySchema,
  message: z.string(),
  toolName: z.string(),
  path: z.string(),
  clients: z.array(z.string()),
  fixable: z.boolean(),
}).strict();

const auditToolSchema = z.object({
  name: z.string().min(1),
  hasDescription: z.boolean(),
  hasInputSchema: z.boolean(),
  hasOutputSchema: z.boolean(),
}).strict();

const tokenBudgetSchema = z.object({
  method: z.literal('chars-div-4'),
  approximate: z.literal(true),
  chars: z.number().int().nonnegative(),
  tokens: z.number().int().nonnegative(),
  toolCount: z.number().int().nonnegative(),
  thresholds: z.object({
    warn: z.number().int().positive(),
    over: z.number().int().positive(),
    schemaWarn: z.number().int().positive(),
  }).strict(),
  level: z.enum(['ok', 'warn', 'over']),
  tools: z.array(z.object({
    name: z.string(),
    chars: z.number().int().nonnegative(),
    tokens: z.number().int().nonnegative(),
    schemaTokens: z.number().int().nonnegative(),
    oversizedSchema: z.boolean(),
  }).strict()),
  repeatedDescriptions: z.array(z.object({
    description: z.string(),
    tools: z.array(z.string()),
  }).strict()),
  note: z.string().min(1),
}).strict();

const qualitySchema = z.object({
  algorithm: z.literal(QUALITY_ALGORITHM),
  overall: z.number().int().min(0).max(100),
  grade: z.enum(['A', 'B', 'C', 'D', 'F']),
  weights: z.object({
    description: z.literal(25),
    inputSchema: z.literal(25),
    outputSchema: z.literal(10),
    lintClean: z.literal(40),
    error: z.literal(15),
    warning: z.literal(5),
  }).strict(),
  coverage: z.object({
    toolCount: z.number().int().nonnegative(),
    withDescription: z.number().int().nonnegative(),
    withInputSchema: z.number().int().nonnegative(),
    withOutputSchema: z.number().int().nonnegative(),
  }).strict(),
  confidence: z.enum(['low', 'medium']),
  note: z.string().min(1),
}).strict();

function sectionSchema<T extends z.ZodType>(data: T) {
  return z.object({
    status: z.enum(['ran', 'not_run', 'partial', 'failed']),
    reason: z.string().min(1).optional(),
    data: data.optional(),
  }).strict().superRefine((value, ctx) => {
    if (value.status === 'ran' && value.data === undefined) {
      ctx.addIssue({ code: 'custom', message: 'A ran section needs data.' });
    }
    if ((value.status === 'not_run' || value.status === 'failed') && (value.reason === undefined || value.data !== undefined)) {
      ctx.addIssue({ code: 'custom', message: 'A not_run or failed section needs a reason and no data.' });
    }
    if (value.status === 'partial' && (value.reason === undefined || value.data === undefined)) {
      ctx.addIssue({ code: 'custom', message: 'A partial section needs a reason and data.' });
    }
  });
}

const notRunSchema = z.object({
  status: z.enum(['not_run', 'failed']),
  reason: z.string().min(1),
}).strict();

export const AuditReportSchema = z.object({
  schemaVersion: z.literal(AUDIT_REPORT_SCHEMA_VERSION),
  generatedAt: z.string().min(1),
  tool: z.object({ name: z.literal('mcp-lint'), version: z.string().min(1) }).strict(),
  scope: z.object({
    source: z.string().min(1),
    mode: z.literal('offline-tools'),
    liveServer: z.literal(false),
    toolsInvoked: z.literal(false),
  }).strict(),
  tools: z.array(auditToolSchema),
  duplicateToolNames: z.array(z.string()),
  findings: sectionSchema(z.array(findingSchema)),
  severity: sectionSchema(z.object({
    error: z.number().int().nonnegative(),
    warning: z.number().int().nonnegative(),
    info: z.number().int().nonnegative(),
  }).strict()),
  compatibility: notRunSchema,
  tokenBudget: sectionSchema(tokenBudgetSchema),
  quality: sectionSchema(qualitySchema),
  recovery: notRunSchema,
  preflight: notRunSchema,
  recommendations: z.array(z.string()),
  coverage: z.object({
    ran: z.array(z.string()),
    notRun: z.array(z.string()),
    confidence: z.enum(['low', 'medium', 'high']),
  }).strict(),
}).strict();

function notRun(reason: string): NotRunSection {
  return { status: 'not_run', reason };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireTools(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    throw new AuditInputError('tools must be an array.');
  }
  return value.map((tool, index) => {
    if (!isRecord(tool)) throw new AuditInputError(`tools[${index}] must be an object.`);
    if (typeof tool.name !== 'string' || tool.name.trim() === '') {
      throw new AuditInputError(`tools[${index}].name must be a non-empty string.`);
    }
    if (tool.description !== undefined && typeof tool.description !== 'string') {
      throw new AuditInputError(`tools[${index}].description must be a string.`);
    }
    if (tool.inputSchema !== undefined && !isRecord(tool.inputSchema)) {
      throw new AuditInputError(`tools[${index}].inputSchema must be an object.`);
    }
    if (tool.outputSchema !== undefined && !isRecord(tool.outputSchema)) {
      throw new AuditInputError(`tools[${index}].outputSchema must be an object.`);
    }
    return tool;
  });
}

function duplicateNames(tools: ReadonlyArray<Record<string, unknown>>): string[] {
  const counts = new Map<string, number>();
  for (const tool of tools) {
    const name = tool.name as string;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([name]) => name)
    .sort((a, b) => a.localeCompare(b));
}

function findingsFrom(diagnostics: Diagnostic[]): AuditFinding[] {
  return diagnostics
    .map((diagnostic) => ({
      ruleId: diagnostic.ruleId,
      severity: diagnostic.severity,
      message: diagnostic.message,
      toolName: diagnostic.toolName,
      path: diagnostic.path,
      clients: [...diagnostic.clients].sort((a, b) => a.localeCompare(b)),
      fixable: diagnostic.fix != null,
    }))
    .sort((a, b) =>
      a.toolName.localeCompare(b.toolName)
      || a.path.localeCompare(b.path)
      || a.ruleId.localeCompare(b.ruleId)
      || a.message.localeCompare(b.message),
    );
}

function recommendations(input: {
  findingsRan: boolean;
  counts: SeverityCounts | undefined;
  duplicates: string[];
  missingDescriptions: number;
  missingSchemas: number;
  toolCount: number;
  tokenLevel: TokenBudget['level'] | undefined;
  repeated: number;
}): string[] {
  const lines: string[] = [];
  if (!input.findingsRan) {
    lines.push('Schema lint did not run. A missing finding list is not a pass.');
  } else if ((input.counts?.error ?? 0) > 0) {
    lines.push('Fix error findings before shipping this tools list.');
  }
  if (input.duplicates.length > 0) {
    lines.push(`Rename duplicate tool names: ${input.duplicates.join(', ')}.`);
  }
  if (input.missingDescriptions > 0) {
    lines.push('Add a description to every tool. Clients use it to choose a call.');
  }
  if (input.missingSchemas > 0) {
    lines.push('Add inputSchema to every tool. An absent schema was not scored as valid.');
  }
  if (input.tokenLevel === 'over' || input.tokenLevel === 'warn') {
    lines.push('The approximate token estimate is at or above a configured threshold.');
  }
  if (input.repeated > 0) {
    lines.push('Repeated descriptions hide which tool the agent should call.');
  }
  if (input.toolCount === 0) {
    lines.push('No tools were supplied, so the quality score was withheld.');
  } else if (input.findingsRan && (input.counts?.error ?? 0) === 0 && lines.length === 0) {
    lines.push('No schema errors in this run. Recovery, preflight, and live inspection were not measured.');
  }
  return lines;
}

export function buildAuditReport(input: BuildAuditReportInput): MCPAuditReport {
  if (input.source.trim() === '') throw new AuditInputError('source must be a non-empty string.');
  const tools = requireTools(input.tools);
  const inventory: AuditTool[] = tools.map((tool) => ({
    name: tool.name as string,
    hasDescription: typeof tool.description === 'string' && tool.description.trim() !== '',
    hasInputSchema: isRecord(tool.inputSchema),
    hasOutputSchema: isRecord(tool.outputSchema),
  }));
  const duplicates = duplicateNames(tools);
  const findingsRan = input.diagnostics !== undefined;
  const findings = findingsRan ? findingsFrom(input.diagnostics ?? []) : undefined;
  const counts = findings
    ? {
        error: findings.filter((finding) => finding.severity === 'error').length,
        warning: findings.filter((finding) => finding.severity === 'warning').length,
        info: findings.filter((finding) => finding.severity === 'info').length,
      }
    : undefined;

  let tokenSection: Section<TokenBudget>;
  try {
    tokenSection = {
      status: 'ran',
      data: buildTokenBudget(tools, input.thresholds ?? DEFAULT_TOKEN_THRESHOLDS),
    };
  } catch (err) {
    tokenSection = {
      status: 'failed',
      reason: err instanceof Error ? err.message : 'Token estimate failed.',
    };
  }

  let quality: Section<QualitySectionData>;
  if (!findingsRan) {
    quality = notRun('Schema lint did not run, so the quality score was withheld.');
  } else if (tools.length === 0) {
    quality = notRun('No tools were supplied, so the quality score was withheld.');
  } else {
    const scored = computeQualityReport(tools as unknown as MCPTool[], input.diagnostics ?? []);
    quality = {
      status: 'ran',
      data: {
        algorithm: QUALITY_ALGORITHM,
        overall: scored.overall,
        grade: scored.grade,
        weights: scored.weights,
        coverage: scored.coverage,
        confidence: scored.confidence,
        note: 'quality-v2 adds points only for a description, an input schema, an output schema, and a clean lint. Missing fields add nothing. This is not a security guarantee.',
      },
    };
  }

  const tokenLevel = tokenSection.status === 'ran' ? tokenSection.data.level : undefined;
  const lines = recommendations({
    findingsRan,
    counts,
    duplicates,
    missingDescriptions: inventory.filter((tool) => !tool.hasDescription).length,
    missingSchemas: inventory.filter((tool) => !tool.hasInputSchema).length,
    toolCount: tools.length,
    tokenLevel,
    repeated: tokenSection.status === 'ran' ? tokenSection.data.repeatedDescriptions.length : 0,
  });

  const ran = ['tools'];
  if (tokenSection.status === 'ran') ran.push('tokenBudget');
  if (findingsRan) ran.push('findings', 'severity');
  if (quality.status === 'ran') ran.push('quality');
  const notRunNames = ['compatibility', 'recovery', 'preflight'];
  if (!findingsRan) notRunNames.push('findings', 'severity');
  if (quality.status !== 'ran') notRunNames.push('quality');
  if (tokenSection.status !== 'ran') notRunNames.push('tokenBudget');

  const confidence = tools.length === 0 || !findingsRan
    ? 'low'
    : quality.status === 'ran' && tokenSection.status === 'ran'
      ? 'medium'
      : 'low';

  return {
    schemaVersion: AUDIT_REPORT_SCHEMA_VERSION,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    tool: { name: 'mcp-lint', version: input.version ?? '0.8.0' },
    scope: {
      source: input.source,
      mode: 'offline-tools',
      liveServer: false,
      toolsInvoked: false,
    },
    tools: inventory,
    duplicateToolNames: duplicates,
    findings: findings ? { status: 'ran', data: findings } : notRun('Schema lint did not run.'),
    severity: counts ? { status: 'ran', data: counts } : notRun('Schema lint did not run.'),
    compatibility: notRun('Client compatibility was not re-checked for this report.'),
    tokenBudget: tokenSection,
    quality,
    recovery: notRun('Recovery was not scored.'),
    preflight: notRun('Preflight was not evaluated.'),
    recommendations: lines,
    coverage: {
      ran,
      notRun: notRunNames,
      confidence,
    },
  };
}

export function parseAuditReport(value: unknown): MCPAuditReport {
  return AuditReportSchema.parse(value) as MCPAuditReport;
}
