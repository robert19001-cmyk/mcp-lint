import '@fontsource/schibsted-grotesk/latin-400.css';
import '@fontsource/schibsted-grotesk/latin-600.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import { scoreRecovery } from '../../src/recover/score.ts';
import type { FailureKind } from '../../src/recover/types.ts';
import { LintEngine } from '../../src/core/engine.ts';
import type { MCPTool } from '../../src/core/rule.ts';
import type { Diagnostic } from '../../src/core/diagnostic.ts';
import { layoutDiagnostics } from '../../src/cli/formatters/layout.ts';
import { allRules } from '../../src/rules/index.ts';
import { preflight } from '../../src/preflight/engine.ts';
import type { Action, Decision } from '../../src/preflight/types.ts';

const tools = ['login', 'search'];

const presets: Record<string, { kind: FailureKind; message: string }> = {
  terminal: {
    kind: 'credential',
    message: 'Unauthorized. Run npm login in your terminal.',
  },
  wait: {
    kind: 'rate_limit',
    message: 'Wait before retrying.',
  },
  named: {
    kind: 'credential',
    message: 'Unauthorized. Call the login tool, then retry search.',
  },
};

const schemaSamples: Record<string, { command: string; tools: MCPTool[] }> = {
  names: {
    command: 'npx mcp-lint check examples/names/unsafe.json',
    tools: [
      {
        name: 'search files',
        description: 'Search the workspace.',
        inputSchema: {
          type: 'object',
          properties: { q: { type: 'string', description: 'Text to find' } },
        },
      },
      {
        name: 'repo/read',
        description: 'Read one file.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: '9tools',
        description: 'List tools.',
        inputSchema: { type: 'object', properties: {} },
      },
    ],
  },
  drop: {
    command: 'npx mcp-lint check tools.json',
    tools: [
      {
        name: 'delete_file',
        title: 'Delete file',
        description: 'Delete one file.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            path: { type: 'string', description: 'Path to delete' },
          },
          required: ['path'],
        },
      },
    ],
  },
  clean: {
    command: 'npx mcp-lint check tools.json',
    tools: [
      {
        name: 'search_files',
        title: 'Search files',
        description: 'Search the workspace for a text query.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            q: { type: 'string', description: 'Text to find' },
          },
          required: ['q'],
        },
      },
    ],
  },
};

const actions: Record<string, { command: string; action: Action }> = {
  drop: {
    command: 'npx mcp-lint preflight examples/actions/destructive-delete.json',
    action: {
      actor_id: 'agent:claude-code',
      workspace_id: 'team-alpha',
      tool_type: 'shell',
      tool_name: 'bash',
      action: 'rm -rf /prod/data',
      target: '/prod/data',
      context: { environment: 'prod' },
    },
  },
  read: {
    command: 'npx mcp-lint preflight examples/actions/safe-read.json',
    action: {
      actor_id: 'agent:claude-code',
      workspace_id: 'team-alpha',
      tool_type: 'file_read',
      tool_name: 'read',
      action: 'cat package.json',
      target: './package.json',
    },
  },
};

const kindEl = document.querySelector<HTMLSelectElement>('#kind');
const messageEl = document.querySelector<HTMLTextAreaElement>('#message');
const verdictEl = document.querySelector<HTMLElement>('#verdict');
const stampEl = document.querySelector<HTMLElement>('#stamp');
const checkOut = document.querySelector<HTMLElement>('#check-out');
const checkSource = document.querySelector<HTMLElement>('#check-source');
const checkStamp = document.querySelector<HTMLElement>('#check-stamp');
const checkTitle = document.querySelector<HTMLElement>('#check-title');
const preflightOut = document.querySelector<HTMLElement>('#preflight-out');
const preflightSource = document.querySelector<HTMLElement>('#preflight-source');
const preflightStamp = document.querySelector<HTMLElement>('#preflight-stamp');
const preflightTitle = document.querySelector<HTMLElement>('#preflight-title');

if (!kindEl || !messageEl || !verdictEl || !stampEl || !checkOut || !checkSource || !checkStamp || !checkTitle || !preflightOut || !preflightSource || !preflightStamp || !preflightTitle) {
  throw new Error('Bench markup is missing');
}

const engine = new LintEngine(allRules, {
  clients: ['claude', 'cursor', 'gemini', 'vscode', 'windsurf', 'cline', 'openai', 'continue'],
  ignore: [],
  maxDepth: 5,
});

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function pop(stamp: HTMLElement): void {
  stamp.classList.remove('pop');
  void stamp.offsetWidth;
  stamp.classList.add('pop');
}

function render(): void {
  const kind = kindEl.value as FailureKind;
  const report = scoreRecovery(
    [{ tool: 'search', kind, message: messageEl.value }],
    { tools },
  );
  const pass = report.errors === 0;
  stampEl.textContent = pass ? 'Pass' : 'Fail';
  stampEl.classList.toggle('pass', pass);
  pop(stampEl);

  const summary = `${report.errors} error${report.errors === 1 ? '' : 's'}, ${report.recoverable} recoverable of ${report.samples}, ${report.transient} transient, ${report.permanent} permanent`;
  const clear = report.samples === 1
    ? 'The failure is recoverable.'
    : `All ${report.samples} failures are recoverable.`;
  const body = report.findings.length === 0
    ? `<p class="ok">${clear}</p>`
    : `<p class="tool">search#1</p>${report.findings.map((finding) => `
        <p class="hit ${finding.severity === 'warning' ? 'warn' : 'error'}">${finding.severity === 'warning' ? '⚠' : '✖'} ${escapeHtml(finding.message)}</p>
        <p class="meta">[${escapeHtml(finding.ruleId)}] ${escapeHtml(finding.durability)}</p>
      `).join('')}`;

  verdictEl.innerHTML = `${body}<p class="sum ${pass ? 'ok' : 'error'}">${escapeHtml(summary)}</p>`;
}

function renderDiagnostics(target: HTMLElement, diagnostics: Diagnostic[], source?: string): void {
  if (diagnostics.length === 0) {
    target.innerHTML = '<p class="ok">✔ No issues found.</p>';
    return;
  }

  const layout = layoutDiagnostics(diagnostics);
  const index = layout.index.length === 0
    ? ''
    : `<p class="tool">Errors</p>${layout.index.map((row) =>
        `<p class="hit error">${escapeHtml(row.name)}  ${row.count}</p><p class="meta">${escapeHtml(row.rules.join(', '))}</p>`,
      ).join('')}`;

  const blocks = layout.tools.map((tool) => {
    const lines = tool.items.map((item) => {
      if (item.kind === 'titles') {
        const shown = item.paths.slice(0, 3);
        const extra = item.count - shown.length;
        const where = extra > 0 ? `${shown.join(', ')}, +${extra}` : shown.join(', ');
        return `<p class="hit warn">⚠ ${item.count} missing titles. Cursor can display raw names without them.</p><p class="meta">${escapeHtml(where)}  [${escapeHtml(item.ruleId)}]</p>`;
      }
      const diagnostic = item.diagnostic;
      const tone = diagnostic.severity === 'warning' ? 'warn' : diagnostic.severity === 'info' ? 'info' : 'error';
      const mark = diagnostic.severity === 'warning' ? '⚠' : diagnostic.severity === 'info' ? 'ℹ' : '✖';
      return `<p class="hit ${tone}">${mark} ${escapeHtml(diagnostic.message)}</p><p class="meta">${escapeHtml(diagnostic.path)}  [${escapeHtml(diagnostic.ruleId)}]</p>`;
    }).join('');
    return `<p class="tool">${escapeHtml(tool.name)}</p>${lines}`;
  }).join('');

  const parts: string[] = [];
  if (layout.errors > 0) parts.push(`<span class="error">${layout.errors} error${layout.errors === 1 ? '' : 's'}</span>`);
  if (layout.warnings > 0) parts.push(`<span class="warn">${layout.warnings} warning${layout.warnings === 1 ? '' : 's'}</span>`);
  if (layout.infos > 0) parts.push(`<span class="info">${layout.infos} info</span>`);
  const next = layout.explainRule
    ? `<p class="meta">Next: mcp-lint explain ${escapeHtml(layout.explainRule)}</p>${layout.hasSafeFix ? `<p class="meta">mcp-lint fix ${escapeHtml(source ?? '<file>')} --dry-run</p>` : ''}`
    : '';

  target.innerHTML = `${index}${blocks}<p class="sum">${parts.join(', ')}</p>${next}`;
}

function applySchema(name: string): void {
  const sample = schemaSamples[name];
  if (!sample) return;
  checkTitle.textContent = sample.command;
  checkSource.textContent = JSON.stringify(sample.tools, null, 2);
  const diagnostics = engine.lint(sample.tools);
  const errors = diagnostics.filter((item) => item.severity === 'error').length;
  checkStamp.textContent = errors === 0 ? 'Pass' : 'Fail';
  checkStamp.classList.toggle('pass', errors === 0);
  pop(checkStamp);
  const source = sample.command.split(' ').at(-1);
  renderDiagnostics(checkOut, diagnostics, source);
  document.querySelectorAll<HTMLButtonElement>('[data-schema]').forEach((button) => {
    button.setAttribute('aria-pressed', button.dataset.schema === name ? 'true' : 'false');
  });
}

function decisionTone(decision: Decision['decision']): string {
  if (decision === 'deny') return 'error';
  if (decision === 'require_approval' || decision === 'allow_with_rewrite') return 'warn';
  return 'ok';
}

function renderDecision(decision: Decision): void {
  const tone = decisionTone(decision.decision);
  const riskTone = decision.risk_score >= 0.9 ? 'error' : decision.risk_score >= 0.7 ? 'warn' : decision.risk_score >= 0.4 ? 'info' : 'ok';
  const rows = [
    ['Decision:', decision.decision.toUpperCase(), tone],
    ['Risk score:', decision.risk_score.toFixed(2), riskTone],
    ['Reversibility:', decision.reversibility, ''],
    ['Est. cost:', `$${decision.estimated_cost_usd.toFixed(2)}`, ''],
  ];
  const lines = rows.map(([label, value, rowTone]) =>
    `<p class="row"><span>${label}</span><span class="${rowTone}">${escapeHtml(value)}</span></p>`,
  ).join('');
  const reasons = decision.reasons.length > 0
    ? `<p class="row"><span>Reasons:</span><span>${escapeHtml(decision.reasons.join(', '))}</span></p>`
    : '';
  const rewrite = decision.safe_alternative
    ? `<p class="tool">Safe alternative:</p><p class="hit">${escapeHtml(decision.safe_alternative.tool_type)} → ${escapeHtml(decision.safe_alternative.action)}</p>`
    : '';
  preflightOut.innerHTML = `<p class="tool">Preflight Decision</p>${lines}${reasons}${rewrite}`;
}

function applyAction(name: string): void {
  const sample = actions[name];
  if (!sample) return;
  preflightTitle.textContent = sample.command;
  preflightSource.textContent = JSON.stringify(sample.action, null, 2);
  const decision = preflight(sample.action);
  const label = decision.decision.toUpperCase();
  preflightStamp.textContent = label;
  preflightStamp.classList.remove('pass', 'warn', 'allow', 'approval', 'rewrite');
  if (decision.decision === 'allow') preflightStamp.classList.add('pass', 'allow');
  if (decision.decision === 'require_approval') preflightStamp.classList.add('warn', 'approval');
  if (decision.decision === 'allow_with_rewrite') preflightStamp.classList.add('warn', 'rewrite');
  pop(preflightStamp);
  renderDecision(decision);
  document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
    button.setAttribute('aria-pressed', button.dataset.action === name ? 'true' : 'false');
  });
}

function applyPreset(name: string): void {
  const preset = presets[name];
  if (!preset) return;
  kindEl.value = preset.kind;
  messageEl.value = preset.message;
  document.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((button) => {
    button.setAttribute('aria-pressed', button.dataset.preset === name ? 'true' : 'false');
  });
  render();
}

document.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((button) => {
  button.addEventListener('click', () => applyPreset(button.dataset.preset ?? 'terminal'));
});
document.querySelectorAll<HTMLButtonElement>('[data-schema]').forEach((button) => {
  button.addEventListener('click', () => applySchema(button.dataset.schema ?? 'names'));
});
document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
  button.addEventListener('click', () => applyAction(button.dataset.action ?? 'drop'));
});

kindEl.addEventListener('change', () => {
  document.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((button) => {
    button.setAttribute('aria-pressed', 'false');
  });
  render();
});
messageEl.addEventListener('input', render);

document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((button) => {
  button.addEventListener('click', async () => {
    const node = document.getElementById(button.dataset.copy ?? '');
    const text = node?.textContent?.trim() ?? '';
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    const previous = button.textContent;
    button.textContent = 'Copied';
    window.setTimeout(() => {
      button.textContent = previous;
    }, 1200);
  });
});

applyPreset('terminal');
applySchema('names');
applyAction('drop');
