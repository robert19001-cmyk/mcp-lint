import type { MCPTool, ToolAnnotations } from '../core/rule.js';

interface ListedTool {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: object;
  annotations?: {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
}

export function mapListedTools(tools: ListedTool[]): MCPTool[] {
  return tools.map((tool) => {
    const mapped: MCPTool = {
      name: tool.name,
      inputSchema: (tool.inputSchema as MCPTool['inputSchema'] | undefined) ?? { type: 'object' },
    };
    if (tool.title) mapped.title = tool.title;
    if (tool.description) mapped.description = tool.description;
    const annotations = pickAnnotations(tool.annotations);
    if (annotations) mapped.annotations = annotations;
    return mapped;
  });
}

function pickAnnotations(annotations: ListedTool['annotations']): ToolAnnotations | undefined {
  if (!annotations) return undefined;
  const picked: ToolAnnotations = {};
  if (annotations.title !== undefined) picked.title = annotations.title;
  if (annotations.readOnlyHint !== undefined) picked.readOnlyHint = annotations.readOnlyHint;
  if (annotations.destructiveHint !== undefined) picked.destructiveHint = annotations.destructiveHint;
  if (annotations.idempotentHint !== undefined) picked.idempotentHint = annotations.idempotentHint;
  if (annotations.openWorldHint !== undefined) picked.openWorldHint = annotations.openWorldHint;
  return Object.keys(picked).length > 0 ? picked : undefined;
}
