import type { Diagnostic } from './diagnostic.js';
import type { MCPTool } from './rule.js';

export interface ToolScore {
  toolName: string;
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  errors: number;
  warnings: number;
}

export interface QualityReport {
  overall: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  tools: ToolScore[];
}

function gradeFromScore(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

export function computeQualityReport(tools: MCPTool[], diagnostics: Diagnostic[]): QualityReport {
  const byTool = new Map<string, Diagnostic[]>();
  for (const tool of tools) byTool.set(tool.name, []);
  for (const d of diagnostics) byTool.get(d.toolName)?.push(d);

  const toolScores: ToolScore[] = tools.map((tool) => {
    const diags = byTool.get(tool.name) ?? [];
    const errors = diags.filter((d) => d.severity === 'error').length;
    const warnings = diags.filter((d) => d.severity === 'warning').length;
    const score = Math.max(0, 100 - errors * 15 - warnings * 5);
    return { toolName: tool.name, score, grade: gradeFromScore(score), errors, warnings };
  });

  const overall = tools.length === 0
    ? 100
    : Math.round(toolScores.reduce((sum, t) => sum + t.score, 0) / toolScores.length);

  return { overall, grade: gradeFromScore(overall), tools: toolScores };
}
