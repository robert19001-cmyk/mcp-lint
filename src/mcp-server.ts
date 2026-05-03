#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { LintEngine } from './core/engine.js';
import { applyFixes } from './core/fixer.js';
import { computeQualityReport } from './core/quality-score.js';
import type { Config, MCPTool } from './core/rule.js';
import { DEFAULT_CONFIG } from './config/config.js';
import { allRules } from './rules/index.js';
import { preflight } from './preflight/engine.js';
import { parsePolicy } from './preflight/policy.js';
import type { Action } from './preflight/types.js';

const VERSION = '0.5.3';

const ClientIdSchema = z.enum([
  'claude',
  'cursor',
  'gemini',
  'vscode',
  'windsurf',
  'cline',
  'openai',
  'continue',
]);

const SeveritySchema = z.enum(['error', 'warning', 'info']);
const RuleSeveritySchema = z.union([SeveritySchema, z.literal('off')]);

const JsonObjectSchema = z.object({}).passthrough();

const MCPToolInputSchema = z.object({
  name: z.string().min(1).describe('MCP tool name to lint.'),
  title: z.string().optional().describe('Optional human-readable MCP tool title.'),
  description: z.string().optional().describe('Optional MCP tool description.'),
  inputSchema: JsonObjectSchema.describe('JSON Schema object exposed by the MCP tool.'),
});

const ConfigShape = {
  clients: z.array(ClientIdSchema).optional().describe('Only run rules for these MCP clients.'),
  ignore: z.array(z.string()).optional().describe('Tool names to ignore.'),
  rules: z.record(z.string(), RuleSeveritySchema).optional().describe('Rule severity overrides by rule id.'),
  maxDepth: z.number().int().min(1).max(20).optional().describe('Maximum schema nesting depth before warning.'),
};

const ActionSchema = z.object({
  actor_id: z.string().optional(),
  workspace_id: z.string().optional(),
  tool_type: z.enum([
    'shell',
    'file_read',
    'file_write',
    'file_delete',
    'http',
    'mcp_tool',
    'email',
    'payment',
    'database',
    'other',
  ]),
  tool_name: z.string().min(1),
  action: z.string().min(1),
  target: z.string().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  estimated_cost_usd: z.number().min(0).optional(),
});

function normalizeConfig(input: Partial<Config>): Config {
  return {
    clients: input.clients ?? DEFAULT_CONFIG.clients,
    ignore: input.ignore ?? DEFAULT_CONFIG.ignore,
    maxDepth: input.maxDepth ?? DEFAULT_CONFIG.maxDepth,
    rules: input.rules,
  };
}

function lintTools(tools: MCPTool[], configInput: Partial<Config>) {
  const config = normalizeConfig(configInput);
  const engine = new LintEngine(allRules, config);
  const diagnostics = engine.lint(tools);
  const summary = {
    tools: tools.length,
    diagnostics: diagnostics.length,
    errors: diagnostics.filter((d) => d.severity === 'error').length,
    warnings: diagnostics.filter((d) => d.severity === 'warning').length,
    info: diagnostics.filter((d) => d.severity === 'info').length,
  };
  return { config, diagnostics, summary };
}

function result(output: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
    structuredContent: output,
  };
}

export function createMcpLintServer(): McpServer {
  const server = new McpServer({
    name: 'mcp-lint-mcp-server',
    version: VERSION,
  });

  server.registerTool(
    'mcp_lint_list_rules',
    {
      title: 'List mcp-lint Rules',
      description: 'List every built-in mcp-lint rule with severity, supported clients, fixability, and description.',
      outputSchema: {
        rules: z.array(JsonObjectSchema),
        total: z.number(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const rules = allRules.map((rule) => ({
        id: rule.id,
        severity: rule.severity,
        clients: rule.clients,
        fixable: Boolean(rule.docs?.fixNote),
        description: rule.description,
      }));
      return result({ total: rules.length, rules });
    },
  );

  server.registerTool(
    'mcp_lint_explain_rule',
    {
      title: 'Explain mcp-lint Rule',
      description: 'Return detailed documentation, examples, and auto-fix notes for one mcp-lint rule id.',
      inputSchema: {
        ruleId: z.string().min(1).describe('Rule id such as openai/no-additional-properties.'),
      },
      outputSchema: {
        rule: JsonObjectSchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ ruleId }) => {
      const rule = allRules.find((candidate) => candidate.id === ruleId);
      if (!rule) {
        throw new Error(`Unknown rule "${ruleId}". Use mcp_lint_list_rules to discover available rule ids.`);
      }
      return result({
        rule: {
          id: rule.id,
          severity: rule.severity,
          clients: rule.clients,
          fixable: Boolean(rule.docs?.fixNote),
          description: rule.description,
          docs: rule.docs ?? null,
        },
      });
    },
  );

  server.registerTool(
    'mcp_lint_check_tools',
    {
      title: 'Lint MCP Tool Schemas',
      description: 'Lint MCP tool schemas for compatibility across Claude, Cursor, Gemini, VS Code, Windsurf, Cline, OpenAI Agents SDK, and Continue.dev.',
      inputSchema: {
        tools: z.array(MCPToolInputSchema).describe('Array of MCP tools with name, description, and inputSchema.'),
        includeScore: z.boolean().default(false).describe('Include quality score and grade per tool.'),
        ...ConfigShape,
      },
      outputSchema: {
        summary: JsonObjectSchema,
        diagnostics: z.array(JsonObjectSchema),
        quality: JsonObjectSchema.optional(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ tools, includeScore, clients, ignore, rules, maxDepth }) => {
      const { diagnostics, summary } = lintTools(tools as MCPTool[], {
        clients,
        ignore,
        rules,
        maxDepth,
      });
      const output = {
        summary,
        diagnostics,
        ...(includeScore ? { quality: computeQualityReport(tools as MCPTool[], diagnostics) } : {}),
      };
      return result(output);
    },
  );

  server.registerTool(
    'mcp_lint_fix_tools',
    {
      title: 'Auto-fix MCP Tool Schemas',
      description: 'Apply safe mcp-lint schema fixes and return the corrected tool definitions without writing to disk.',
      inputSchema: {
        tools: z.array(MCPToolInputSchema).describe('Array of MCP tools to lint and fix.'),
        onlyRules: z.array(z.string()).optional().describe('Optional list of fixable rule ids to apply.'),
        ...ConfigShape,
      },
      outputSchema: {
        fixedTools: z.array(JsonObjectSchema),
        fixesApplied: z.number(),
        diagnosticsBeforeFix: z.array(JsonObjectSchema),
        diagnosticsAfterFix: z.array(JsonObjectSchema),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ tools, onlyRules, clients, ignore, rules, maxDepth }) => {
      const config = { clients, ignore, rules, maxDepth };
      const before = lintTools(tools as MCPTool[], config);
      const fixedTools = applyFixes(tools as MCPTool[], before.diagnostics, onlyRules);
      const after = lintTools(fixedTools, config);
      return result({
        fixedTools,
        fixesApplied: before.diagnostics.filter((d) => d.fix && (!onlyRules || onlyRules.includes(d.ruleId))).length,
        diagnosticsBeforeFix: before.diagnostics,
        diagnosticsAfterFix: after.diagnostics,
      });
    },
  );

  server.registerTool(
    'mcp_lint_preflight_action',
    {
      title: 'Preflight Agent Action',
      description: 'Evaluate a proposed agent tool call before execution and return allow, deny, approval, or safe rewrite guidance. This tool never executes the action.',
      inputSchema: {
        action: ActionSchema.describe('Action object to score and evaluate.'),
        policyYaml: z.string().optional().describe('Optional mcp-lint preflight policy YAML. Defaults to built-in thresholds.'),
      },
      outputSchema: {
        decision: JsonObjectSchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ action, policyYaml }) => {
      const policy = policyYaml ? parsePolicy(policyYaml) : undefined;
      return result({ decision: preflight(action as Action, policy) });
    },
  );

  return server;
}

async function main(): Promise<void> {
  const server = createMcpLintServer();
  await server.connect(new StdioServerTransport());
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`mcp-lint MCP server failed: ${(error as Error).message}\n`);
    process.exit(1);
  });
}
