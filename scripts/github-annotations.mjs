function escapeCommand(value) {
  return String(value).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

const LEVEL = { error: 'error', warning: 'warning', info: 'notice' };

const SEVERITY_RANK = { info: 0, warning: 1, error: 2 };

export function actionShouldFail(diagnostics, failOn) {
  if (!Object.hasOwn(SEVERITY_RANK, failOn)) {
    throw new Error('fail_on must be error, warning, or info.');
  }
  if (!Array.isArray(diagnostics)) return false;
  const floor = SEVERITY_RANK[failOn];
  return diagnostics.some((item) => {
    const severity = item && typeof item === 'object' ? item.severity : undefined;
    return Object.hasOwn(SEVERITY_RANK, severity) && SEVERITY_RANK[severity] >= floor;
  });
}

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
if (invokedDirectly && process.argv[2] === '--fail-on') {
  const { readFileSync } = await import('node:fs');
  const failOn = process.argv[3];
  const raw = readFileSync(process.argv[4] ?? 0, 'utf8');
  let diagnostics;
  try {
    diagnostics = JSON.parse(raw);
  } catch {
    process.stderr.write('Error: diagnostics JSON could not be parsed.\n');
    process.exit(2);
  }
  if (!Array.isArray(diagnostics)) {
    process.stderr.write('Error: diagnostics JSON must be an array.\n');
    process.exit(2);
  }
  try {
    process.exit(actionShouldFail(diagnostics, failOn) ? 1 : 0);
  } catch (err) {
    process.stderr.write(`Error: ${err instanceof Error ? err.message : 'Invalid fail_on.'}\n`);
    process.exit(2);
  }
}
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
