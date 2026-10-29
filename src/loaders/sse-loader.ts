import type { MCPTool } from '../core/rule.js';
import { loadRemote } from './remote-loader.js';

export async function loadSSE(url: string, timeoutMs?: number): Promise<MCPTool[]> {
  return loadRemote(url, 'sse', timeoutMs);
}
