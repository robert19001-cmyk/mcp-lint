import type { Command } from 'commander';
import { allRules } from '../../rules/index.js';
import chalk from 'chalk';

export function registerExplainCommand(program: Command): void {
  program
    .command('explain <rule-id>')
    .description('Show documentation and examples for a rule')
    .option('--no-color', 'Disable terminal colors')
    .action((ruleId: string, options: { color: boolean }) => {
      if (!options.color) chalk.level = 0;

      const rule = allRules.find((r) => r.id === ruleId);

      if (!rule) {
        const available = allRules.map((r) => `  ${r.id}`).join('\n');
        process.stderr.write(
          `Unknown rule "${ruleId}".\n\nAvailable rules:\n${available}\n`,
        );
        process.exit(2);
      }

      const lines: string[] = [];
      lines.push('');
      lines.push(chalk.bold(`Rule: ${chalk.cyan(rule.id)}`));
      lines.push(`Severity:  ${rule.severity === 'error' ? chalk.red(rule.severity) : chalk.yellow(rule.severity)}`);
      lines.push(`Clients:   ${rule.clients.join(', ')}`);
      lines.push(`Fixable:   ${rule.docs?.fixNote ? chalk.green('yes') : chalk.dim('no')}`);
      lines.push('');
      lines.push(chalk.bold('Description'));
      lines.push(rule.description);

      if (rule.docs) {
        lines.push('');
        lines.push(chalk.bold('Why'));
        lines.push(rule.docs.why);

        lines.push('');
        lines.push(chalk.bold('Bad example'));
        lines.push(JSON.stringify(rule.docs.badExample, null, 2));

        lines.push('');
        lines.push(chalk.bold('Good example'));
        lines.push(JSON.stringify(rule.docs.goodExample, null, 2));

        if (rule.docs.fixNote) {
          lines.push('');
          lines.push(chalk.bold('Auto-fix'));
          lines.push(rule.docs.fixNote);
        }
      } else {
        lines.push('');
        lines.push(chalk.dim('No additional documentation available for this rule.'));
      }

      lines.push('');
      process.stdout.write(lines.join('\n'));
    });
}
