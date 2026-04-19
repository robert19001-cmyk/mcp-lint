import type { Config } from '../core/rule.js';

const recommended: Config = {
  clients: ['claude', 'cursor', 'gemini', 'vscode', 'windsurf', 'cline', 'openai', 'continue'],
  ignore: [],
  maxDepth: 5,
};

const strict: Config = {
  clients: ['claude', 'cursor', 'gemini', 'vscode', 'windsurf', 'cline', 'openai', 'continue'],
  ignore: [],
  maxDepth: 3,
  rules: {
    'no-required-false': 'error',
    'no-content-encoding': 'error',
    'description-exists': 'error',
    'no-empty-enum': 'error',
    'max-depth': 'error',
    'no-recursive-refs': 'error',
    'valid-json-schema-subset': 'error',
    'no-unsupported-formats': 'error',
    'claude/no-type-array': 'error',
    'cursor/no-default-without-type': 'error',
    'gemini/no-optional-without-default': 'error',
    'gemini/no-nested-objects': 'error',
    'vscode/max-params': 'error',
    'windsurf/no-union-types': 'error',
    'cline/description-max-length': 'error',
    'openai/no-additional-properties': 'error',
    'openai/strict-types': 'error',
    'continue/no-default-values': 'error',
  },
};

const PRESETS: Record<string, Config> = { recommended, strict };

export function applyExtends(userConfig: Config): Config {
  const presetName = userConfig.extends;
  if (!presetName) return userConfig;

  const preset = PRESETS[presetName];
  if (!preset) {
    throw new Error(`Unknown preset "${presetName}". Available: ${Object.keys(PRESETS).join(', ')}`);
  }

  const { extends: _removed, ...restUser } = userConfig;
  return {
    ...preset,
    ...restUser,
    rules: { ...preset.rules, ...restUser.rules },
    clients: restUser.clients ?? preset.clients,
    ignore: [...(preset.ignore ?? []), ...(restUser.ignore ?? [])],
  };
}
