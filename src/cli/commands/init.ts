import type { Command } from 'commander';
import { writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';

const DEFAULT_CONFIG = {
  rules: {
    'no-required-false': 'error',
    'no-content-encoding': 'error',
    'description-exists': 'warning',
    'no-empty-enum': 'error',
    'max-depth': 'warning',
    'no-recursive-refs': 'error',
    'valid-json-schema-subset': 'error',
    'no-unsupported-formats': 'warning',
  },
  clients: ['claude', 'cursor', 'gemini', 'vscode', 'windsurf', 'cline', 'openai', 'continue'],
  ignore: [],
  maxDepth: 5,
};

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Generate a default .mcplintrc.json in the current directory')
    .option('--force', 'Overwrite existing config file')
    .action(async (options: { force?: boolean }) => {
      const configPath = resolve(process.cwd(), '.mcplintrc.json');

      if (!options.force) {
        try {
          await access(configPath);
          process.stderr.write(
            `.mcplintrc.json already exists. Use --force to overwrite.\n`,
          );
          process.exit(2);
          return;
        } catch {
          // file doesn't exist, proceed
        }
      }

      await writeFile(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n', 'utf-8');
      process.stdout.write(`Created .mcplintrc.json\n`);
      process.exit(0);
    });
}
