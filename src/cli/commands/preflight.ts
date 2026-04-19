import type { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import chalk from 'chalk';
import { preflight } from '../../preflight/engine.js';
import { loadPolicy } from '../../preflight/policy.js';
import type { Action, Decision } from '../../preflight/types.js';

export function registerPreflightCommand(program: Command): void {
  program
    .command('preflight [action-file]')
    .description('Evaluate a proposed agent action against a policy before execution')
    .option('--policy <path>', 'Path to preflight policy YAML file')
    .option('--format <format>', 'Output format: terminal|json', 'terminal')
    .option('--no-color', 'Disable terminal colors')
    .option('--stdin', 'Read action JSON from stdin')
    .action(
      async (
        actionFile: string | undefined,
        options: { policy?: string; format: string; color: boolean; stdin?: boolean },
      ) => {
        if (!options.color) chalk.level = 0;

        try {
          const action = await readAction(actionFile, options.stdin ?? false);
          const policy = options.policy ? await loadPolicy(options.policy) : undefined;
          const decision = preflight(action, policy);

          if (options.format === 'json') {
            process.stdout.write(JSON.stringify(decision, null, 2) + '\n');
          } else {
            process.stdout.write(renderTerminal(decision));
          }

          const exitCode = decisionExitCode(decision);
          process.exit(exitCode);
        } catch (err) {
          process.stderr.write(`Error: ${(err as Error).message}\n`);
          process.exit(2);
        }
      },
    );
}

async function readAction(path: string | undefined, stdin: boolean): Promise<Action> {
  let raw: string;
  if (stdin || !path) {
    if (process.stdin.isTTY && !stdin) {
      throw new Error('Specify an action file or use --stdin');
    }
    raw = await readStdin();
  } else {
    raw = await readFile(path, 'utf8');
  }
  return JSON.parse(raw) as Action;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function decisionExitCode(d: Decision): number {
  switch (d.decision) {
    case 'allow':
    case 'allow_with_rewrite':
      return 0;
    case 'require_approval':
      return 1;
    case 'deny':
      return 2;
  }
}

function renderTerminal(d: Decision): string {
  const lines: string[] = [];
  const decisionColor =
    d.decision === 'deny'
      ? chalk.red
      : d.decision === 'require_approval'
        ? chalk.yellow
        : d.decision === 'allow_with_rewrite'
          ? chalk.cyan
          : chalk.green;

  lines.push('');
  lines.push(chalk.bold('Preflight Decision'));
  lines.push('─'.repeat(40));
  lines.push(`Decision:      ${decisionColor(d.decision.toUpperCase())}`);
  lines.push(`Risk score:    ${riskColor(d.risk_score)}`);
  lines.push(`Reversibility: ${d.reversibility}`);
  lines.push(`Est. cost:     $${d.estimated_cost_usd.toFixed(2)}`);
  if (d.matched_policies.length > 0) {
    lines.push(`Policies:      ${d.matched_policies.join(', ')}`);
  }
  if (d.reasons.length > 0) {
    lines.push(`Reasons:       ${d.reasons.join(', ')}`);
  }
  if (d.safe_alternative) {
    lines.push('');
    lines.push(chalk.bold('Safe alternative:'));
    lines.push(`  ${d.safe_alternative.tool_type} → ${d.safe_alternative.action}`);
    if (d.safe_alternative.target) {
      lines.push(`  target: ${d.safe_alternative.target}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

function riskColor(score: number): string {
  const s = score.toFixed(2);
  if (score >= 0.9) return chalk.red(s);
  if (score >= 0.7) return chalk.yellow(s);
  if (score >= 0.4) return chalk.cyan(s);
  return chalk.green(s);
}
