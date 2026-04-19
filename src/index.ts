#!/usr/bin/env node
import { Command } from 'commander';
import { registerCheckCommand } from './cli/commands/check.js';
import { registerFixCommand } from './cli/commands/fix.js';
import { registerInitCommand } from './cli/commands/init.js';
import { registerCompatCommand } from './cli/commands/compat.js';
import { registerExplainCommand } from './cli/commands/explain.js';
import { registerDiffCommand } from './cli/commands/diff.js';

const program = new Command();

program
  .name('mcp-lint')
  .description('Lint MCP server tool schemas for cross-client compatibility')
  .version('0.3.0');

registerCheckCommand(program);
registerFixCommand(program);
registerInitCommand(program);
registerCompatCommand(program);
registerExplainCommand(program);
registerDiffCommand(program);

program.parse();
