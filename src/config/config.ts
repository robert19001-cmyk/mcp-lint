import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import type { Config } from '../core/rule.js';
import { applyExtends } from './presets.js';

async function readConfigFile(filePath: string): Promise<Config> {
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content) as Config;
}

export async function loadConfig(configPath?: string): Promise<Config> {
  if (configPath) {
    try {
      const raw = await readConfigFile(configPath);
      return await applyExtends(raw);
    } catch (err) {
      throw new Error(`Cannot load config from "${configPath}": ${(err as Error).message}`);
    }
  }

  let dir = process.cwd();
  const home = homedir();

  while (true) {
    try {
      const raw = await readConfigFile(resolve(dir, '.mcplintrc.json'));
      return await applyExtends(raw);
    } catch {
      // not found here, try parent
    }

    const parent = dirname(dir);
    if (parent === dir || dir === home) break;
    dir = parent;
  }

  return {};
}

export const DEFAULT_CONFIG: Required<Omit<Config, 'rules' | 'extends' | 'plugins'>> = {
  clients: ['claude', 'cursor', 'gemini', 'vscode', 'windsurf', 'cline', 'openai', 'continue'],
  ignore: [],
  maxDepth: 5,
};
