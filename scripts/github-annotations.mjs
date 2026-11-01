function escapeCommand(value) {
  return String(value).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

const LEVEL = { error: 'error', warning: 'warning', info: 'notice' };

export function formatGitHubAnnotations(diagnostics, file) {
  if (!Array.isArray(diagnostics)) return '';
  const lines = [];
  for (const diagnostic of diagnostics) {
    if (!diagnostic || typeof diagnostic !== 'object') continue;
    const kind = LEVEL[diagnostic.severity] ?? 'notice';
    const title = escapeCommand(diagnostic.ruleId || 'mcp-lint');
    const toolName = diagnostic.toolName ? `${diagnostic.toolName} ` : '';
    const path = diagnostic.path ? `${diagnostic.path}: ` : '';
    const message = escapeCommand(`${toolName}${path}${diagnostic.message ?? ''}`);
    lines.push(`::${kind} file=${escapeCommand(file)},title=${title}::${message}`);
  }
  return lines.join('\n');
}

const invokedDirectly = process.argv[1] && import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  const { readFileSync } = await import('node:fs');
  const file = process.argv[2] ?? 'tools.json';
  const raw = readFileSync(process.argv[3] ?? 0, 'utf8');
  let diagnostics = [];
  try {
    diagnostics = JSON.parse(raw);
  } catch {
    diagnostics = [];
  }
  const text = formatGitHubAnnotations(diagnostics, file);
  if (text) process.stdout.write(`${text}\n`);
}
