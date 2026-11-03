import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

const action = parseYaml(readFileSync(new URL('../action.yml', import.meta.url), 'utf8')) as {
  inputs: Record<string, { description?: string; default?: string }>;
  runs: { steps: Array<{ env?: Record<string, string>; run?: string }> };
};
const server = JSON.parse(readFileSync(new URL('../server.json', import.meta.url), 'utf8')) as {
  description: string;
};
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  description: string;
  keywords: string[];
};

const toolFiles = [
  'tools.json',
  'tools.yaml',
  'tools.yml',
  'mcp-tools.json',
  'mcp-tools.yaml',
  'mcp-tools.yml',
];

describe('published surfaces', () => {
  it('installs the 1.x line unless version is set', () => {
    expect(action.inputs.version.default).toBe('1');
    const install = action.runs.steps[0]?.run ?? '';
    expect(install).toContain('mcp-lint@${MCP_LINT_VERSION}');
    expect(install).toContain('latest');
    expect(install).not.toContain('npm install -g mcp-lint@latest');
  });

  it('names the same six tool files the CLI looks for', () => {
    const description = action.inputs.input.description ?? '';
    for (const name of toolFiles) {
      expect(description).toContain(name);
    }
    const find = action.runs.steps[1]?.run ?? '';
    for (const name of toolFiles) {
      expect(find).toContain(name);
    }
  });

  it('names eight clients on npm and keeps the registry description short', () => {
    for (const client of ['Claude', 'Cursor', 'Gemini', 'VS Code', 'Windsurf', 'Cline', 'OpenAI', 'Continue']) {
      expect(pkg.description).toContain(client);
    }
    expect(server.description.length).toBeLessThanOrEqual(100);
    expect(server.description).toContain('eight clients');
    for (const client of ['claude', 'cursor', 'gemini', 'vscode', 'windsurf', 'cline', 'openai', 'continue']) {
      expect(pkg.keywords).toContain(client);
    }
  });
});
