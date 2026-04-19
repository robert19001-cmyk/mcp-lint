import * as vscode from 'vscode';
import { parseTree, findNodeAtLocation, type Node } from 'jsonc-parser';

export function parseToolsDocument(text: string): {
  rootNode: Node | undefined;
  toolsNode: Node | undefined;
  tools: Array<Record<string, unknown>>;
} {
  const rootNode = parseTree(text, [], { allowTrailingComma: true });
  if (!rootNode) return { rootNode: undefined, toolsNode: undefined, tools: [] };

  let toolsNode: Node | undefined;

  if (rootNode.type === 'array') {
    toolsNode = rootNode;
  } else if (rootNode.type === 'object') {
    const toolsProp = findNodeAtLocation(rootNode, ['tools']);
    if (toolsProp && toolsProp.type === 'array') {
      toolsNode = toolsProp;
    } else if (hasToolShape(rootNode)) {
      toolsNode = rootNode;
    }
  }

  if (!toolsNode) return { rootNode, toolsNode: undefined, tools: [] };

  if (toolsNode.type === 'object') {
    const obj = jsoncNodeToValue(toolsNode);
    return { rootNode, toolsNode, tools: [obj as Record<string, unknown>] };
  }

  const tools = (toolsNode.children ?? [])
    .filter((n) => n.type === 'object')
    .map((n) => jsoncNodeToValue(n) as Record<string, unknown>);

  return { rootNode, toolsNode, tools };
}

function hasToolShape(node: Node): boolean {
  const name = findNodeAtLocation(node, ['name']);
  const schema = findNodeAtLocation(node, ['inputSchema']);
  return name?.type === 'string' && schema?.type === 'object';
}

function jsoncNodeToValue(node: Node): unknown {
  switch (node.type) {
    case 'string':
    case 'number':
    case 'boolean':
    case 'null':
      return node.value;
    case 'array':
      return (node.children ?? []).map(jsoncNodeToValue);
    case 'object': {
      const obj: Record<string, unknown> = {};
      for (const prop of node.children ?? []) {
        if (prop.type === 'property' && prop.children && prop.children.length === 2) {
          const key = prop.children[0].value as string;
          obj[key] = jsoncNodeToValue(prop.children[1]);
        }
      }
      return obj;
    }
    default:
      return undefined;
  }
}

export function findToolNode(toolsNode: Node, toolName: string): Node | undefined {
  if (toolsNode.type === 'object') {
    const name = findNodeAtLocation(toolsNode, ['name']);
    return name?.value === toolName ? toolsNode : undefined;
  }
  for (const child of toolsNode.children ?? []) {
    const name = findNodeAtLocation(child, ['name']);
    if (name?.value === toolName) return child;
  }
  return undefined;
}

export function parsePath(path: string): Array<string | number> {
  if (!path) return [];
  return path.split('.').flatMap((part) => {
    const m = part.match(/^([^\[]+)\[(\d+)\]$/);
    if (m) return [m[1], Number(m[2])];
    const arrOnly = part.match(/^\[(\d+)\]$/);
    if (arrOnly) return [Number(arrOnly[1])];
    return [part];
  });
}

export function resolvePath(toolNode: Node, path: string): Node | undefined {
  const parts = parsePath(path);
  if (parts.length === 0) return toolNode;
  return findNodeAtLocation(toolNode, parts);
}

export function nodeToRange(document: vscode.TextDocument, node: Node): vscode.Range {
  const start = document.positionAt(node.offset);
  const end = document.positionAt(node.offset + node.length);
  return new vscode.Range(start, end);
}
