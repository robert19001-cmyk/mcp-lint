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
    'cursor/no-missing-title': 'error',
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

export async function applyExtends(userConfig: Config): Promise<Config> {
  const presetName = userConfig.extends;
  if (!presetName) return userConfig;

  let preset: Config;
  if (PRESETS[presetName]) {
    preset = PRESETS[presetName];
  } else {
    try {
      const mod = await import(presetName);
      preset = ((mod as { default?: Config }).default ?? mod) as Config;
    } catch {
      throw new Error(`Unknown preset "${presetName}". Builtin presets: ${Object.keys(PRESETS).join(', ')}`);
    }
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
