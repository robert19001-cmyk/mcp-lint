import type { Diagnostic } from '../../core/diagnostic.js';
import type { Severity } from '../../core/severity.js';

const SEVERITY_RANK: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
export const TITLE_RULE = 'cursor/no-missing-title';

export interface FindingItem {
  kind: 'finding';
  diagnostic: Diagnostic;
}

export interface TitleItem {
  kind: 'titles';
  count: number;
  paths: string[];
  ruleId: typeof TITLE_RULE;
}

export interface ToolBlock {
  name: string;
  items: Array<FindingItem | TitleItem>;
}

export interface ErrorIndexRow {
  name: string;
  count: number;
  rules: string[];
}

export interface CheckLayout {
  tools: ToolBlock[];
  errors: number;
  warnings: number;
  infos: number;
  index: ErrorIndexRow[];
  explainRule: string | null;
  hasSafeFix: boolean;
}

export function layoutDiagnostics(diagnostics: Diagnostic[]): CheckLayout {
  const byTool = new Map<string, Diagnostic[]>();
  for (const diagnostic of diagnostics) {
    const list = byTool.get(diagnostic.toolName) ?? [];
    list.push(diagnostic);
    byTool.set(diagnostic.toolName, list);
  }

  const tools: ToolBlock[] = [];
  for (const [name, toolDiags] of byTool) {
    const titles = toolDiags.filter((diagnostic) => diagnostic.ruleId === TITLE_RULE);
    const collapseTitles = titles.length >= 2;
    const rest = toolDiags
      .filter((diagnostic) => diagnostic.ruleId !== TITLE_RULE || !collapseTitles)
      .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
    const items: ToolBlock['items'] = rest.map((diagnostic) => ({ kind: 'finding', diagnostic }));
    if (collapseTitles) {
      items.push({
        kind: 'titles',
        count: titles.length,
        paths: titles.map((diagnostic) => diagnostic.path),
        ruleId: TITLE_RULE,
      });
    }
    tools.push({ name, items });
  }

  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
  const index = errorIndex(errors);
  const ordered = [...diagnostics].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

  return {
    tools,
    errors: errors.length,
    warnings: diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length,
    infos: diagnostics.filter((diagnostic) => diagnostic.severity === 'info').length,
    index: index.length >= 2 ? index : [],
    explainRule: ordered[0]?.ruleId ?? null,
    hasSafeFix: diagnostics.some((diagnostic) => diagnostic.fix?.class === 'safe'),
  };
}

function errorIndex(errors: Diagnostic[]): ErrorIndexRow[] {
  const rows = new Map<string, ErrorIndexRow>();
  for (const diagnostic of errors) {
    const row = rows.get(diagnostic.toolName) ?? { name: diagnostic.toolName, count: 0, rules: [] };
    row.count += 1;
    if (!row.rules.includes(diagnostic.ruleId)) row.rules.push(diagnostic.ruleId);
    rows.set(diagnostic.toolName, row);
  }
  return [...rows.values()];
}
