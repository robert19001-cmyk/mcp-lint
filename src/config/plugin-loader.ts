import type { Rule, Config } from '../core/rule.js';

export interface PluginModule {
  rules?: Rule[];
  config?: Config;
}

export async function loadPluginRules(config: Config): Promise<Rule[]> {
  if (!config.plugins?.length) return [];

  const extraRules: Rule[] = [];
  for (const pkgName of config.plugins) {
    let mod: PluginModule;
    try {
      mod = (await import(pkgName)) as PluginModule;
    } catch (err) {
      throw new Error(`Cannot load plugin "${pkgName}": ${(err as Error).message}`);
    }

    const plugin: PluginModule = (mod as { default?: PluginModule }).default ?? mod;
    if (plugin.rules) extraRules.push(...plugin.rules);
  }
  return extraRules;
}
