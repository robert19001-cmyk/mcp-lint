import type { Diagnostic } from '../core/diagnostic.js';
import type { ClientId } from '../core/rule.js';
import {
  promptArgumentDescription,
  promptArgumentName,
  promptDescription,
  promptName,
  resourceDescription,
  resourceName,
  resourceUri,
} from '../rules/catalog.js';
import type { CatalogPrompt, CatalogReport, CatalogResource } from './list.js';

const CLIENTS: ClientId[] = [
  'claude', 'cursor', 'gemini', 'vscode', 'windsurf', 'cline', 'openai', 'continue',
];

export interface CatalogFinding {
  kind: 'resource' | 'prompt';
  ruleId: string;
  severity: 'error' | 'warning';
  message: string;
  name: string;
  path: string;
}

export function lintCatalog(report: CatalogReport): CatalogFinding[] {
  const findings: CatalogFinding[] = [];
  if (report.resources.status === 'ran') lintResources(report.resources.items, findings);
  if (report.prompts.status === 'ran') lintPrompts(report.prompts.items, findings);
  return findings;
}

export function catalogFindingsToDiagnostics(findings: CatalogFinding[]): Diagnostic[] {
  return findings.map((finding) => ({
    ruleId: finding.ruleId,
    severity: finding.severity,
    message: finding.message,
    toolName: finding.name,
    path: finding.path,
    clients: CLIENTS,
    fix: {
      class: 'manual',
      description: 'You edit this on the server. mcp-lint does not write it.',
    },
  }));
}

function lintResources(items: CatalogResource[], findings: CatalogFinding[]): void {
  const seenUris = new Map<string, number>();
  const seenNames = new Map<string, number>();
  for (const item of items) {
    const uri = item.uri?.trim() ?? '';
    if (uri) seenUris.set(uri, (seenUris.get(uri) ?? 0) + 1);
    const name = item.name?.trim() ?? '';
    if (name) seenNames.set(name, (seenNames.get(name) ?? 0) + 1);
  }

  const reportedUris = new Set<string>();
  const reportedNames = new Set<string>();
  for (const item of items) {
    const uri = item.uri?.trim() ?? '';
    const name = item.name?.trim() ?? '';
    const label = name || uri || '(resource)';
    if (!uri) {
      findings.push(finding('resource', resourceUri.id, 'error', `Resource "${label}" has an empty URI.`, label, 'uri'));
    } else if ((seenUris.get(uri) ?? 0) > 1 && !reportedUris.has(uri)) {
      reportedUris.add(uri);
      findings.push(finding('resource', resourceUri.id, 'error', `Resource URI "${uri}" appears ${seenUris.get(uri)} times in this list.`, label, 'uri'));
    }
    if (!name) {
      findings.push(finding('resource', resourceName.id, 'error', `Resource "${uri || '(resource)'}" is missing a name.`, label, 'name'));
    } else if ((seenNames.get(name) ?? 0) > 1 && !reportedNames.has(name)) {
      reportedNames.add(name);
      findings.push(finding('resource', resourceName.id, 'warning', `Resource name "${name}" appears ${seenNames.get(name)} times. The URIs still differ, and the picker shows one label twice.`, name, 'name'));
    }
    if (!item.description?.trim()) {
      findings.push(finding('resource', resourceDescription.id, 'warning', `Resource "${label}" is missing a description.`, label, 'description'));
    }
  }
}

function lintPrompts(items: CatalogPrompt[], findings: CatalogFinding[]): void {
  const seenNames = new Map<string, number>();
  for (const item of items) {
    const name = item.name?.trim() ?? '';
    if (name) seenNames.set(name, (seenNames.get(name) ?? 0) + 1);
  }
  const reportedNames = new Set<string>();
  for (const item of items) {
    const name = item.name?.trim() ?? '';
    const label = name || '(prompt)';
    if (!name) {
      findings.push(finding('prompt', promptName.id, 'error', 'A prompt is missing a name.', label, 'name'));
    } else if ((seenNames.get(name) ?? 0) > 1 && !reportedNames.has(name)) {
      reportedNames.add(name);
      findings.push(finding('prompt', promptName.id, 'error', `Prompt name "${name}" appears ${seenNames.get(name)} times in this list.`, name, 'name'));
    }
    if (!item.description?.trim()) {
      findings.push(finding('prompt', promptDescription.id, 'warning', `Prompt "${label}" is missing a description.`, label, 'description'));
    }
    lintArguments(label, item.arguments ?? [], findings);
  }
}

function lintArguments(promptLabel: string, args: NonNullable<CatalogPrompt['arguments']>, findings: CatalogFinding[]): void {
  const seen = new Map<string, number>();
  for (const arg of args) {
    const name = arg.name?.trim() ?? '';
    if (name) seen.set(name, (seen.get(name) ?? 0) + 1);
  }
  const reported = new Set<string>();
  args.forEach((arg, index) => {
    const name = arg.name?.trim() ?? '';
    const path = name ? `arguments.${name}` : `arguments.${index}`;
    if (!name) {
      findings.push(finding('prompt', promptArgumentName.id, 'error', `Prompt "${promptLabel}" has an argument with an empty name.`, promptLabel, path));
    } else if ((seen.get(name) ?? 0) > 1 && !reported.has(name)) {
      reported.add(name);
      findings.push(finding('prompt', promptArgumentName.id, 'error', `Prompt "${promptLabel}" uses argument name "${name}" ${seen.get(name)} times.`, promptLabel, path));
    }
    if (name && !arg.description?.trim()) {
      findings.push(finding('prompt', promptArgumentDescription.id, 'warning', `Argument "${name}" in prompt "${promptLabel}" is missing a description.`, promptLabel, path));
    }
  });
}

function finding(
  kind: CatalogFinding['kind'],
  ruleId: string,
  severity: CatalogFinding['severity'],
  message: string,
  name: string,
  path: string,
): CatalogFinding {
  return { kind, ruleId, severity, message, name, path };
}
