import type { Rule, RuleContext, ClientId } from '../core/rule.js';
import type { Diagnostic } from '../core/diagnostic.js';

const CLIENTS: ClientId[] = [
  'claude', 'cursor', 'gemini', 'vscode', 'windsurf', 'cline', 'openai', 'continue',
];

function listed(id: string, severity: 'error' | 'warning', description: string, why: string, bad: object, good: object, fixNote: string): Rule {
  return {
    id,
    severity,
    description,
    fixClass: 'manual',
    clients: CLIENTS,
    docs: { why, badExample: bad, goodExample: good, fixNote },
    check(_tool, _context: RuleContext): Diagnostic[] {
      return [];
    },
  };
}

export const resourceUri: Rule = listed(
  'resource/uri',
  'error',
  'A resource URI must be present, and the same URI must not appear twice in one list.',
  'A client reads a resource by URI. An empty URI cannot be read. Two entries with the same URI do not say which body belongs to the call.',
  { resources: [{ uri: '', name: 'notes' }, { uri: 'file://readme', name: 'a' }, { uri: 'file://readme', name: 'b' }] },
  { resources: [{ uri: 'file://notes', name: 'notes' }, { uri: 'file://readme', name: 'readme' }] },
  'Give each resource its own non-empty URI. mcp-lint does not invent one.',
);

export const resourceName: Rule = listed(
  'resource/name',
  'error',
  'A resource needs a name. The same display name twice is a warning when the URIs differ.',
  'The name is what the picker shows. An empty name leaves a blank row. The same name on two URIs makes the picker ambiguous, while the URI still identifies the read.',
  { resources: [{ uri: 'file://a', name: '' }, { uri: 'file://b', name: 'notes' }, { uri: 'file://c', name: 'notes' }] },
  { resources: [{ uri: 'file://a', name: 'alpha' }, { uri: 'file://b', name: 'beta' }] },
  'Name each resource. Rename one of a pair that shares a display name. mcp-lint does not invent a name.',
);

export const resourceDescription: Rule = listed(
  'resource/description',
  'warning',
  'A resource should have a description so a client can choose it.',
  'Clients show the description next to the name when an agent decides which resource to read. A missing description leaves only the name.',
  { uri: 'file://readme', name: 'readme' },
  { uri: 'file://readme', name: 'readme', description: 'Repository overview.' },
  'Write the description on the server. mcp-lint does not invent one.',
);

export const promptName: Rule = listed(
  'prompt/name',
  'error',
  'A prompt name must be present, and the same name must not appear twice in one list.',
  'A client calls prompts/get with the name. An empty name cannot be called. Two entries with the same name make one of them unreachable.',
  { prompts: [{ name: '' }, { name: 'review' }, { name: 'review' }] },
  { prompts: [{ name: 'review_diff' }, { name: 'review_issue' }] },
  'Give each prompt its own non-empty name. mcp-lint does not rename it.',
);

export const promptDescription: Rule = listed(
  'prompt/description',
  'warning',
  'A prompt should have a description so a client can choose it.',
  'Clients show the description when an agent decides which prompt to run. A missing description leaves only the name.',
  { name: 'review' },
  { name: 'review', description: 'Review the current diff.' },
  'Write the description on the server. mcp-lint does not invent one.',
);

export const promptArgumentName: Rule = listed(
  'prompt/argument-name',
  'error',
  'Each prompt argument needs a name, and that name must be unique inside the prompt.',
  'The client fills arguments by name. An empty name or two arguments with the same name make the prompt impossible to fill.',
  { name: 'review', arguments: [{ name: '' }, { name: 'path' }, { name: 'path' }] },
  { name: 'review', arguments: [{ name: 'path', description: 'File to review.' }] },
  'Name each argument once inside the prompt. mcp-lint does not rename it.',
);

export const promptArgumentDescription: Rule = listed(
  'prompt/argument-description',
  'warning',
  'A prompt argument should have a description.',
  'The description tells the agent what to put in the argument. Without it, the name is the only hint.',
  { name: 'review', arguments: [{ name: 'path' }] },
  { name: 'review', arguments: [{ name: 'path', description: 'File to review.' }] },
  'Write the argument description on the server. mcp-lint does not invent one.',
);

export const catalogRules: Rule[] = [
  resourceUri,
  resourceName,
  resourceDescription,
  promptName,
  promptDescription,
  promptArgumentName,
  promptArgumentDescription,
];
