export const TOKEN_ESTIMATE_METHOD = 'chars-div-4' as const;

export class TokenEstimateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenEstimateError';
  }
}

export interface TokenEstimate {
  method: typeof TOKEN_ESTIMATE_METHOD;
  approximate: true;
  chars: number;
  tokens: number;
}

export interface TokenThresholds {
  warn: number;
  over: number;
  schemaWarn: number;
}

export interface ToolTokenRank {
  name: string;
  chars: number;
  tokens: number;
  schemaTokens: number;
  oversizedSchema: boolean;
}

export interface RepeatedDescription {
  description: string;
  tools: string[];
}

export interface TokenBudget {
  method: typeof TOKEN_ESTIMATE_METHOD;
  approximate: true;
  chars: number;
  tokens: number;
  toolCount: number;
  thresholds: TokenThresholds;
  level: 'ok' | 'warn' | 'over';
  tools: ToolTokenRank[];
  repeatedDescriptions: RepeatedDescription[];
  note: string;
}

export interface TokenBudgetDiff {
  method: typeof TOKEN_ESTIMATE_METHOD;
  approximate: true;
  beforeTokens: number;
  afterTokens: number;
  deltaTokens: number;
  addedTools: string[];
  removedTools: string[];
  grew: string[];
}

export const DEFAULT_TOKEN_THRESHOLDS: TokenThresholds = {
  warn: 4000,
  over: 8000,
  schemaWarn: 800,
};

const PROJECTION_KEYS = ['name', 'description', 'inputSchema', 'outputSchema'] as const;

export function estimateTokens(value: unknown): TokenEstimate {
  let json: unknown;
  try {
    json = JSON.stringify(value);
  } catch (err) {
    throw new TokenEstimateError(err instanceof Error ? err.message : 'Value could not be serialized.');
  }
  if (typeof json !== 'string') {
    throw new TokenEstimateError('Value could not be serialized.');
  }
  return {
    method: TOKEN_ESTIMATE_METHOD,
    approximate: true,
    chars: json.length,
    tokens: Math.ceil(json.length / 4),
  };
}

export function assertThresholds(thresholds: TokenThresholds): void {
  for (const [key, value] of Object.entries(thresholds) as Array<[keyof TokenThresholds, number]>) {
    if (!Number.isInteger(value) || value < 1) {
      throw new TokenEstimateError(`Token threshold "${key}" must be a positive integer.`);
    }
  }
  if (thresholds.warn > thresholds.over) {
    throw new TokenEstimateError('Token warn threshold cannot be above the over threshold.');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function projectTool(tool: Record<string, unknown>): Record<string, unknown> {
  const projected: Record<string, unknown> = {};
  for (const key of PROJECTION_KEYS) {
    if (tool[key] !== undefined) projected[key] = tool[key];
  }
  return projected;
}

function normalizeDescription(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().replace(/\s+/g, ' ').toLowerCase();
  return normalized.length >= 12 ? normalized : undefined;
}

export function buildTokenBudget(
  tools: ReadonlyArray<Record<string, unknown>>,
  thresholds: TokenThresholds = DEFAULT_TOKEN_THRESHOLDS,
): TokenBudget {
  assertThresholds(thresholds);
  const projected = tools.map(projectTool);
  const total = estimateTokens(projected);
  const ranked: ToolTokenRank[] = tools.map((tool) => {
    const name = typeof tool.name === 'string' ? tool.name : '';
    const whole = estimateTokens(projectTool(tool));
    const schema = estimateTokens(isRecord(tool.inputSchema) ? tool.inputSchema : {});
    return {
      name,
      chars: whole.chars,
      tokens: whole.tokens,
      schemaTokens: schema.tokens,
      oversizedSchema: schema.tokens >= thresholds.schemaWarn,
    };
  });
  ranked.sort((a, b) => b.tokens - a.tokens || a.name.localeCompare(b.name));

  const groups = new Map<string, { description: string; tools: string[] }>();
  for (const tool of tools) {
    if (typeof tool.description !== 'string' || typeof tool.name !== 'string') continue;
    const normalized = normalizeDescription(tool.description);
    if (!normalized) continue;
    const group = groups.get(normalized) ?? {
      description: tool.description.trim().replace(/\s+/g, ' '),
      tools: [],
    };
    group.tools.push(tool.name);
    groups.set(normalized, group);
  }
  const repeatedDescriptions = [...groups.values()]
    .filter((group) => group.tools.length > 1)
    .map((group) => ({ description: group.description, tools: [...group.tools].sort((a, b) => a.localeCompare(b)) }))
    .sort((a, b) => a.description.localeCompare(b.description));

  const level = total.tokens >= thresholds.over ? 'over' : total.tokens >= thresholds.warn ? 'warn' : 'ok';
  const note = tools.length === 0
    ? 'Empty tool list. Zero tokens is not a healthy server. Estimate is ceil(JSON chars / 4), not a tokenizer.'
    : 'Estimate is ceil(JSON chars / 4) of name, description, inputSchema, and outputSchema. It is not a tokenizer count. Per-tool tokens do not sum to the total.';

  return {
    method: TOKEN_ESTIMATE_METHOD,
    approximate: true,
    chars: total.chars,
    tokens: total.tokens,
    toolCount: tools.length,
    thresholds: { ...thresholds },
    level,
    tools: ranked,
    repeatedDescriptions,
    note,
  };
}

export function compareTokenBudgets(before: TokenBudget, after: TokenBudget): TokenBudgetDiff {
  const beforeNames = new Set(before.tools.map((tool) => tool.name));
  const afterNames = new Map(after.tools.map((tool) => [tool.name, tool.tokens]));
  const beforeTokens = new Map(before.tools.map((tool) => [tool.name, tool.tokens]));
  const addedTools = [...afterNames.keys()].filter((name) => !beforeNames.has(name)).sort((a, b) => a.localeCompare(b));
  const removedTools = [...beforeNames].filter((name) => !afterNames.has(name)).sort((a, b) => a.localeCompare(b));
  const grew = [...afterNames.keys()]
    .filter((name) => beforeTokens.has(name) && (afterNames.get(name) ?? 0) > (beforeTokens.get(name) ?? 0))
    .sort((a, b) => a.localeCompare(b));
  return {
    method: TOKEN_ESTIMATE_METHOD,
    approximate: true,
    beforeTokens: before.tokens,
    afterTokens: after.tokens,
    deltaTokens: after.tokens - before.tokens,
    addedTools,
    removedTools,
    grew,
  };
}
