import * as vscode from 'vscode';
import { lintDocument } from './linter.js';
import { McpLintCodeActionProvider, applyFixAll } from './codeActions.js';
import { McpLintHoverProvider } from './hover.js';
import { showCompatPanel } from './compatPanel.js';
import { parseToolsDocument } from './pathMapper.js';
import { minimatch } from 'minimatch';

let diagnosticCollection: vscode.DiagnosticCollection;
const debounceTimers = new Map<string, NodeJS.Timeout>();

export function activate(context: vscode.ExtensionContext): void {
  diagnosticCollection = vscode.languages.createDiagnosticCollection('mcp-lint');
  context.subscriptions.push(diagnosticCollection);

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => lintIfRelevant(doc)),
    vscode.workspace.onDidChangeTextDocument((e) => scheduleLint(e.document)),
    vscode.workspace.onDidSaveTextDocument((doc) => lintIfRelevant(doc)),
    vscode.workspace.onDidCloseTextDocument((doc) => diagnosticCollection.delete(doc.uri)),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('mcpLint')) {
        for (const doc of vscode.workspace.textDocuments) lintIfRelevant(doc);
      }
    }),
  );

  for (const doc of vscode.workspace.textDocuments) lintIfRelevant(doc);

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      [{ language: 'json' }, { language: 'jsonc' }],
      new McpLintCodeActionProvider(),
      { providedCodeActionKinds: McpLintCodeActionProvider.providedKinds },
    ),
    vscode.languages.registerHoverProvider(
      [{ language: 'json' }, { language: 'jsonc' }],
      new McpLintHoverProvider(),
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcpLint.fixAll', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const edit = applyFixAll(editor.document);
      if (!edit) {
        vscode.window.showInformationMessage('No auto-fixable issues found.');
        return;
      }
      await vscode.workspace.applyEdit(edit);
      await editor.document.save();
      vscode.window.showInformationMessage('MCP Lint: fixes applied.');
    }),
    vscode.commands.registerCommand('mcpLint.showCompat', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('Open an MCP tools file first.');
        return;
      }
      showCompatPanel(editor.document);
    }),
    vscode.commands.registerCommand('mcpLint.toggle', () => {
      const config = vscode.workspace.getConfiguration('mcpLint');
      const current = config.get<boolean>('enabled') ?? true;
      config.update('enabled', !current, vscode.ConfigurationTarget.Workspace);
      vscode.window.showInformationMessage(`MCP Lint ${!current ? 'enabled' : 'disabled'}.`);
    }),
    vscode.commands.registerCommand('mcpLint.explainRule', (ruleId: string) => {
      vscode.env.openExternal(
        vscode.Uri.parse(`https://github.com/robert19001-cmyk/mcp-lint#${ruleId.replace(/\//g, '')}`),
      );
    }),
  );
}

function scheduleLint(document: vscode.TextDocument): void {
  const key = document.uri.toString();
  const existing = debounceTimers.get(key);
  if (existing) clearTimeout(existing);
  debounceTimers.set(
    key,
    setTimeout(() => {
      debounceTimers.delete(key);
      lintIfRelevant(document);
    }, 300),
  );
}

function lintIfRelevant(document: vscode.TextDocument): void {
  if (!isRelevantDocument(document)) {
    diagnosticCollection.delete(document.uri);
    return;
  }

  try {
    const { diagnostics } = lintDocument(document);
    diagnosticCollection.set(document.uri, diagnostics);
  } catch {
    diagnosticCollection.delete(document.uri);
  }
}

function isRelevantDocument(document: vscode.TextDocument): boolean {
  const config = vscode.workspace.getConfiguration('mcpLint');
  if (!config.get<boolean>('enabled', true)) return false;
  if (document.languageId !== 'json' && document.languageId !== 'jsonc') return false;

  const patterns = config.get<string[]>('filePatterns') ?? [];
  const path = document.uri.fsPath.replace(/\\/g, '/');
  for (const pattern of patterns) {
    if (minimatch(path, pattern)) return true;
  }

  if (config.get<boolean>('autoDetect', true)) {
    try {
      const { tools } = parseToolsDocument(document.getText());
      return tools.length > 0 && tools.every((t) => typeof t.name === 'string' && typeof t.inputSchema === 'object');
    } catch {
      return false;
    }
  }

  return false;
}

export function deactivate(): void {
  if (diagnosticCollection) diagnosticCollection.dispose();
  for (const t of debounceTimers.values()) clearTimeout(t);
  debounceTimers.clear();
}
