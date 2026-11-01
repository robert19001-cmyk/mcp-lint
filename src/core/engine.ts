import type { Rule, MCPTool, Config, RuleContext } from './rule.js';
import type { Diagnostic } from './diagnostic.js';
import type { Severity } from './severity.js';
import { duplicateNameDiagnostics } from '../rules/tool-name.js';

export class LintEngine {
  constructor(
    private readonly rules: Rule[],
    private readonly config: Config,
  ) {}

  lint(tools: MCPTool[]): Diagnostic[] {
    const context: RuleContext = { config: this.config };
    const diagnostics: Diagnostic[] = [];
    const visible = tools.filter((tool) => !this.config.ignore?.includes(tool.name));

    for (const tool of visible) {
      for (const rule of this.rules) {
        diagnostics.push(...this.collect(rule, tool, context));
        if (tool.outputSchema) {
          const shadow: MCPTool = { ...tool, inputSchema: tool.outputSchema };
          for (const diagnostic of this.collect(rule, shadow, context)) {
            if (!isInputSchemaPath(diagnostic.path)) continue;
            diagnostics.push({
              ...diagnostic,
              path: `outputSchema${diagnostic.path.slice('inputSchema'.length)}`,
              message: diagnostic.message.replaceAll('inputSchema', 'outputSchema'),
            });
          }
        }
      }
    }

    const duplicateOverride = this.config.rules?.['tool-name/duplicate'];
    if (duplicateOverride !== 'off') {
      diagnostics.push(
        ...duplicateNameDiagnostics(visible).map((diagnostic) =>
          duplicateOverride ? { ...diagnostic, severity: duplicateOverride } : diagnostic,
        ),
      );
    }

    return diagnostics;
  }

  private collect(rule: Rule, tool: MCPTool, context: RuleContext): Diagnostic[] {
    const severityOverride = this.config.rules?.[rule.id];
    if (severityOverride === 'off') return [];
    if (
      this.config.clients &&
      this.config.clients.length > 0 &&
      !rule.clients.some((client) => this.config.clients!.includes(client))
    ) {
      return [];
    }
    return rule.check(tool, context).map((diagnostic) =>
      severityOverride ? { ...diagnostic, severity: severityOverride as Severity } : diagnostic,
    );
  }
}

function isInputSchemaPath(path: string): boolean {
  return path === 'inputSchema' || path.startsWith('inputSchema.') || path.startsWith('inputSchema[');
}
