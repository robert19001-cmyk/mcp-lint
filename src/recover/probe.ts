import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { classifyFailure, scoreRecovery } from './score.js';
import type { RecoveryReport, RecoverySampleInput } from './types.js';
import { DEFAULT_HANG_MS } from './types.js';

export interface ProbeTool {
  name: string;
  inputSchema?: {
    required?: unknown;
  };
}

export interface ProbeCallResult {
  isError?: boolean;
  content?: Array<{ type: string; text?: string }>;
}

export interface ProbeClient {
  listTools(): Promise<{ tools: ProbeTool[] }>;
  callTool(
    params: { name: string; arguments: Record<string, unknown> },
    resultSchema: undefined,
    options: { timeout: number },
  ): Promise<ProbeCallResult>;
}

export async function probeClient(
  client: ProbeClient,
  options: { hangMs?: number } = {},
): Promise<{ report: RecoveryReport; samples: RecoverySampleInput[]; skipped: string[] }> {
  const hangMs = options.hangMs ?? DEFAULT_HANG_MS;
  const listed = await client.listTools();
  const tools = listed.tools.map((tool) => tool.name);
  const samples: RecoverySampleInput[] = [];
  const skipped: string[] = [];

  for (const tool of listed.tools) {
    const required = Array.isArray(tool.inputSchema?.required) ? tool.inputSchema.required : [];
    if (required.length === 0) {
      skipped.push(tool.name);
      continue;
    }

    const started = Date.now();
    let timedOut = false;
    let isError: boolean | undefined;
    let message = '';

    try {
      const result = await withHang(
        client.callTool({ name: tool.name, arguments: {} }, undefined, { timeout: hangMs }),
        hangMs,
      );
      isError = result.isError;
      message = textFromContent(result.content);
    } catch (err) {
      timedOut = Date.now() - started >= hangMs || /timed out|timeout/i.test((err as Error).message);
      message = (err as Error).message;
      isError = true;
    }

    const durationMs = Date.now() - started;
    samples.push({
      id: tool.name,
      tool: tool.name,
      kind: classifyFailure({ message, isError, durationMs, hangMs, timedOut }),
      message,
      isError,
      durationMs,
      tools,
    });
  }

  return {
    report: scoreRecovery(samples, { hangMs, tools }),
    samples,
    skipped,
  };
}

export async function probeStdio(
  command: string,
  args: string[],
  options: { hangMs?: number } = {},
): Promise<{ report: RecoveryReport; samples: RecoverySampleInput[]; skipped: string[] }> {
  const transport = new StdioClientTransport({ command, args });
  const client = new Client({ name: 'mcp-lint-recover', version: '0.6.0' }, { capabilities: {} });
  await client.connect(transport);
  try {
    return await probeClient(client as unknown as ProbeClient, options);
  } finally {
    await client.close();
  }
}

function textFromContent(content: ProbeCallResult['content']): string {
  if (!content) return '';
  return content
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

function withHang<T>(work: Promise<T>, hangMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${hangMs}ms`)), hangMs);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
