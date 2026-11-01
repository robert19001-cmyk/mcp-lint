import type { MCPTool } from './rule.js';
import type { Diagnostic } from './diagnostic.js';

function parsePath(path: string): string[] {
  return path.split('.').flatMap((part) => {
    const m = part.match(/^([^\[]+)\[(\d+)\]$/);
    return m ? [m[1], m[2]] : [part];
  });
}

export function applyFixes(
  tools: MCPTool[],
  diagnostics: Diagnostic[],
  onlyRules?: string[],
): MCPTool[] {
  const fixable = diagnostics.filter(
    (d) => d.fix?.class === 'safe' && d.fix.apply != null && (!onlyRules || onlyRules.includes(d.ruleId)),
  );
  if (fixable.length === 0) return tools;

  const result: MCPTool[] = structuredClone(tools);

  for (const diag of fixable) {
    const toolIndex = result.findIndex((t) => t.name === diag.toolName);
    if (toolIndex === -1) continue;

    const parts = parsePath(diag.path);
    if (parts.length === 0) continue;

    const toolObj = result[toolIndex] as unknown as Record<string, unknown>;

    let parent: Record<string, unknown> = toolObj;
    for (let i = 0; i < parts.length - 1; i++) {
      const next = parent[parts[i]];
      if (next == null || typeof next !== 'object') {
        parent = {} as Record<string, unknown>; // will be skipped below
        break;
      }
      parent = next as Record<string, unknown>;
    }

    const lastKey = parts[parts.length - 1];
    const node = parent[lastKey];
    const apply = diag.fix?.apply;
    if (node != null && typeof node === 'object' && apply) {
      parent[lastKey] = apply(node as Record<string, unknown>);
    }
  }

  return result;
}
