import type { MCPTool } from '../core/rule.js';

export function serializeTools(tools: MCPTool[]): string {
  const sorted = [...tools].sort((left, right) => left.name.localeCompare(right.name));
  const shaped = sorted.map((tool) => {
    const record: Record<string, unknown> = { name: tool.name };
    if (tool.title) record.title = tool.title;
    if (tool.description) record.description = tool.description;
    record.inputSchema = tool.inputSchema ?? {};
    if (tool.annotations && Object.keys(tool.annotations).length > 0) {
      record.annotations = tool.annotations;
    }
    return record;
  });
  return `${JSON.stringify(shaped, null, 2)}\n`;
}
