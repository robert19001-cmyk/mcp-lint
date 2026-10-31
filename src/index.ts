#!/usr/bin/env node
import { Command } from 'commander';
import { registerCheckCommand } from './cli/commands/check.js';
import { registerFixCommand } from './cli/commands/fix.js';
import { registerInitCommand } from './cli/commands/init.js';
import { registerCompatCommand } from './cli/commands/compat.js';
import { registerExplainCommand } from './cli/commands/explain.js';
import { registerDiffCommand } from './cli/commands/diff.js';
import { registerPreflightCommand } from './cli/commands/preflight.js';
import { registerRecoverCommand } from './cli/commands/recover.js';
import { registerSnapshotCommand } from './cli/commands/snapshot.js';

const program = new Command();

program
  .name('mcp-lint')
  .description('Lint MCP tool schemas and score whether an agent can recover from tool failures')
  .version('0.8.0');

registerCheckCommand(program);
registerFixCommand(program);
registerInitCommand(program);
registerCompatCommand(program);
registerExplainCommand(program);
registerDiffCommand(program);
registerPreflightCommand(program);
registerRecoverCommand(program);
registerSnapshotCommand(program);

program.parse();
