import type {
  FailureKind,
  RecoveryFinding,
  RecoveryReport,
  RecoveryRuleId,
  RecoverySample,
  RecoverySampleInput,
} from './types.js';
import { DEFAULT_HANG_MS, FAILURE_KINDS } from './types.js';

const NAMED_TOOL_KINDS = new Set<FailureKind>(['credential', 'permission']);
const RETRY_KINDS = new Set<FailureKind>(['rate_limit', 'timeout']);
const SILENT_KINDS = new Set<FailureKind>(['silent', 'malformed']);

export function scoreRecovery(
  samples: RecoverySampleInput[],
  options: { hangMs?: number; tools?: string[] } = {},
): RecoveryReport {
  const hangMs = options.hangMs ?? DEFAULT_HANG_MS;
  const findings: RecoveryFinding[] = [];
  let recoverable = 0;

  samples.forEach((input, index) => {
    const sample = normalizeSample(input, options.tools, index);
    const before = findings.length;
    findings.push(...scoreSample(sample, hangMs));
    const errors = findings.slice(before).filter((finding) => finding.severity === 'error');
    if (errors.length === 0) recoverable += 1;
  });

  return {
    samples: samples.length,
    errors: findings.filter((finding) => finding.severity === 'error').length,
    warnings: findings.filter((finding) => finding.severity === 'warning').length,
    recoverable,
    findings,
  };
}

export function normalizeSample(
  input: RecoverySampleInput,
  fallbackTools: string[] | undefined,
  index: number,
): RecoverySample {
  if (!input.tool?.trim()) {
    throw new Error(`Sample ${index + 1} is missing a tool name`);
  }
  if (!FAILURE_KINDS.includes(input.kind)) {
    throw new Error(`Sample ${index + 1} has unknown kind "${String(input.kind)}"`);
  }
  const tools = input.tools ?? fallbackTools;
  if (!tools || tools.length === 0) {
    throw new Error(`Sample ${index + 1} has no tool list. Put tool names on the sample or on the file.`);
  }
  return {
    id: input.id ?? `${input.tool}#${index + 1}`,
    tool: input.tool,
    kind: input.kind,
    message: input.message,
    isError: input.isError,
    durationMs: input.durationMs,
    tools,
  };
}

function scoreSample(sample: RecoverySample, hangMs: number): RecoveryFinding[] {
  const findings: RecoveryFinding[] = [];
  const text = sample.message?.trim() ?? '';
  const named = mentionedTool(text, sample.tools);
  const blocked = unreachableStep(text);

  if (SILENT_KINDS.has(sample.kind) || (sample.kind === 'explicit' && text.length === 0)) {
    findings.push(finding(sample, 'recover/not-silent',
      'Failure has no text an agent can act on. Return an error that names the tool to call next.'));
  }

  const hung = sample.durationMs === undefined
    ? sample.kind === 'timeout'
    : sample.durationMs >= hangMs;
  if (hung) {
    const took = sample.durationMs !== undefined ? `${sample.durationMs}ms` : 'too long';
    findings.push(finding(sample, 'recover/bounded-hang',
      `Call ran ${took}, past the ${hangMs}ms hang budget. Cut it off instead of waiting.`));
  }

  if (NAMED_TOOL_KINDS.has(sample.kind) && !named) {
    findings.push(finding(sample, 'recover/names-tool',
      'Credential or permission error does not name a tool on this server. Say which tool to call, for example `login`, then retry.'));
  }

  if (RETRY_KINDS.has(sample.kind) && !named) {
    findings.push(finding(sample, 'recover/names-retry',
      `Retry text does not name the call to repeat. Name \`${sample.tool}\` instead of "wait and retry".`));
  }

  if (blocked && !named) {
    findings.push(finding(sample, 'recover/agent-reachable',
      `Next step asks for ${blocked}, which an agent limited to MCP tools cannot do. Name a tool from this server instead.`));
  } else if (blocked && named) {
    findings.push(finding(sample, 'recover/agent-reachable',
      `Next step still mentions ${blocked} beside tool \`${named}\`. Agents follow that step and stop. Leave only the tool call.`,
      'warning'));
  }

  return findings;
}

function finding(
  sample: RecoverySample,
  ruleId: RecoveryRuleId,
  message: string,
  severity: 'error' | 'warning' = 'error',
): RecoveryFinding {
  return {
    ruleId,
    severity,
    tool: sample.tool,
    sampleId: sample.id ?? sample.tool,
    message,
  };
}

export function mentionedTool(message: string, tools: string[]): string | null {
  const visible = message
    .replace(/\b(npm|npx|pnpm|yarn|pip|brew|sudo)\s+\S+/gi, ' ')
    .replace(/`[^`]*(?:npm |npx |sudo |export )[^`]*`/gi, ' ')
    .replace(/\bhttps?:\/\/\S+/gi, ' ');
  const ordered = [...tools].filter((tool) => tool.trim().length > 0).sort((a, b) => b.length - a.length);
  for (const tool of ordered) {
    const pattern = new RegExp(`(^|[^A-Za-z0-9_-])${escapeRegExp(tool)}(?![A-Za-z0-9_-])`);
    if (pattern.test(visible)) return tool;
  }
  return null;
}

export type BlockedStep = 'a terminal command' | 'a config change' | 'a web page';

export function unreachableStep(message: string): BlockedStep | null {
  if (!message.trim()) return null;
  if (TERMINAL.test(message)) return 'a terminal command';
  if (CONFIG.test(message)) return 'a config change';
  if (WEB.test(message)) return 'a web page';
  return null;
}

/** Description lint ignores a bare URL. Error text still treats a URL as a step the agent cannot open. */
export function instructionBlocker(message: string): BlockedStep | null {
  if (!message.trim()) return null;
  if (TERMINAL.test(message)) return 'a terminal command';
  if (CONFIG.test(message)) return 'a config change';
  if (WEB_INSTRUCTION.test(message)) return 'a web page';
  return null;
}

const TERMINAL = /\b(npm|npx|pnpm|yarn|pip|brew|sudo)\s+\S|\b(in (your |the )?terminal|command line|shell command)\b|`[^`]*(npm |npx |sudo |export )/i;
const CONFIG = /\b(config(uration)? file|\.env|environment variable|edit your config)\b|\bset [A-Z][A-Z0-9_]{2,}\b/;
const WEB = /\bhttps?:\/\/\S|\b(open|visit|go to|sign in at|log in at)\b[^.]{0,80}\b(browser|page|dashboard)\b/i;
const WEB_INSTRUCTION = /\b(open|visit|go to|sign in at|log in at)\b[^.]{0,80}\b(browser|page|dashboard)\b/i;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function classifyFailure(input: {
  message: string;
  isError?: boolean;
  durationMs: number;
  hangMs: number;
  timedOut?: boolean;
}): FailureKind {
  const text = input.message.trim();
  if (input.timedOut || input.durationMs >= input.hangMs || /\btime(?:d)? out\b/i.test(text)) {
    return 'timeout';
  }
  if (/rate limit|too many requests|\b429\b/i.test(text)) return 'rate_limit';
  if (/unauthori[sz]ed|invalid (token|api key|credential)|expired (token|credential)|\b401\b/i.test(text)) {
    return 'credential';
  }
  if (/\bforbidden\b|permission denied|\b403\b/i.test(text)) return 'permission';
  if (input.isError === false && text.length === 0) return 'silent';
  if (text.length === 0) return 'malformed';
  return 'explicit';
}
