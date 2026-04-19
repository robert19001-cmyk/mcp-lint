import type { Command } from 'commander';
import { readFile, writeFile } from 'node:fs/promises';
import { loadFile } from '../../loaders/file-loader.js';
import { LintEngine } from '../../core/engine.js';
import { allRules } from '../../rules/index.js';
import { applyFixes } from '../../core/fixer.js';
import { loadConfig } from '../../config/config.js';
import { loadPluginRules } from '../../config/plugin-loader.js';

export function registerFixCommand(program: Command): void {
  program
    .command('fix <input>')
    .description('Auto-fix MCP tool schema issues and write the result')
    .option('--output <path>', 'Write fixed output to file instead of stdout')
    .option('--in-place', 'Overwrite the input file')
    .option('--dry-run', 'Show what would be fixed without applying changes')
    .option('--rules <rules>', 'Comma-separated list of rule IDs to apply fixes for')
    .option('--config <path>', 'Path to .mcplintrc.json config file')
    .action(async (
      input: string,
      options: {
        output?: string;
        inPlace?: boolean;
        dryRun?: boolean;
        rules?: string;
        config?: string;
      },
    ) => {
      try {
        const fileConfig = await loadConfig(options.config);
        const pluginRules = await loadPluginRules(fileConfig);
        const tools = await loadFile(input);
        const engine = new LintEngine([...allRules, ...pluginRules], fileConfig);
        const diagnostics = engine.lint(tools);

        const onlyRules = options.rules
          ? options.rules.split(',').map((r) => r.trim())
          : undefined;

        const fixable = diagnostics.filter(
          (d) => d.fix != null && (!onlyRules || onlyRules.includes(d.ruleId)),
        );

        if (options.dryRun) {
          if (fixable.length === 0) {
            process.stdout.write('No fixable issues found.\n');
          } else {
            process.stdout.write(`Would fix ${fixable.length} issue(s):\n`);
            for (const d of fixable) {
              process.stdout.write(`  [${d.ruleId}] ${d.path}: ${d.fix!.description}\n`);
            }
          }
          process.exit(0);
          return;
        }

        const fixed = applyFixes(tools, diagnostics, onlyRules);
        const output = JSON.stringify(fixed, null, 2) + '\n';

        if (options.inPlace) {
          await writeFile(input, output, 'utf-8');
          process.stdout.write(`Fixed ${fixable.length} issue(s) in ${input}\n`);
        } else if (options.output) {
          await writeFile(options.output, output, 'utf-8');
          process.stdout.write(`Fixed ${fixable.length} issue(s). Output written to ${options.output}\n`);
        } else {
          process.stdout.write(output);
        }

        process.exit(0);
      } catch (err) {
        process.stderr.write(`Error: ${(err as Error).message}\n`);
        process.exit(2);
      }
    });
}
