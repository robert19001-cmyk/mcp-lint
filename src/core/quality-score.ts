import type { Diagnostic } from './diagnostic.js';
import type { MCPTool } from './rule.js';

export const QUALITY_WEIGHTS = {
  description: 25,
  inputSchema: 25,
  outputSchema: 10,
  lintClean: 40,
  error: 15,
  warning: 5,
} as const;

export interface ToolScore {
  toolName: string;
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  errors: number;
  warnings: number;
}

export interface QualityCoverage {
  toolCount: number;
  withDescription: number;
  withInputSchema: number;
  withOutputSchema: number;
}

export interface QualityReport {
  algorithm: 'quality-v2';
  overall: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  tools: ToolScore[];
  weights: typeof QUALITY_WEIGHTS;
  coverage: QualityCoverage;
  confidence: 'low' | 'medium';
  measured: boolean;
}

function gradeFromScore(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

function scoreTool(tool: MCPTool, diagnostics: Diagnostic[]): ToolScore {
  const errors = diagnostics.filter((item) => item.severity === 'error').length;
  const warnings = diagnostics.filter((item) => item.severity === 'warning').length;
  let score = QUALITY_WEIGHTS.lintClean;
  if (hasText(tool.description)) score += QUALITY_WEIGHTS.description;
  if (tool.inputSchema && typeof tool.inputSchema === 'object') score += QUALITY_WEIGHTS.inputSchema;
  if (tool.outputSchema && typeof tool.outputSchema === 'object') score += QUALITY_WEIGHTS.outputSchema;
  score -= errors * QUALITY_WEIGHTS.error;
  score -= warnings * QUALITY_WEIGHTS.warning;
  const bounded = Math.max(0, Math.min(100, score));
  return { toolName: tool.name, score: bounded, grade: gradeFromScore(bounded), errors, warnings };
}

export function computeQualityReport(tools: MCPTool[], diagnostics: Diagnostic[]): QualityReport {
  const byTool = new Map<string, Diagnostic[]>();
  for (const tool of tools) byTool.set(tool.name, []);
  for (const diagnostic of diagnostics) byTool.get(diagnostic.toolName)?.push(diagnostic);

  const toolScores = tools.map((tool) => scoreTool(tool, byTool.get(tool.name) ?? []));
  const coverage: QualityCoverage = {
    toolCount: tools.length,
    withDescription: tools.filter((tool) => hasText(tool.description)).length,
    withInputSchema: tools.filter((tool) => tool.inputSchema && typeof tool.inputSchema === 'object').length,
    withOutputSchema: tools.filter((tool) => tool.outputSchema !== undefined && typeof tool.outputSchema === 'object').length,
  };
  const measured = tools.length > 0;
  const overall = measured
    ? Math.round(toolScores.reduce((sum, tool) => sum + tool.score, 0) / toolScores.length)
    : 100;
  const confidence = measured && coverage.withDescription === coverage.toolCount && coverage.withInputSchema === coverage.toolCount
    ? 'medium'
    : 'low';

  return {
    algorithm: 'quality-v2',
    overall,
    grade: gradeFromScore(overall),
    tools: toolScores,
    weights: QUALITY_WEIGHTS,
    coverage,
    confidence,
    measured,
  };
}
