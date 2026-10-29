import { scoreRecovery } from '../../src/recover/score.ts';
import type { FailureKind } from '../../src/recover/types.ts';

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

const kindEl = document.querySelector<HTMLSelectElement>('#kind');
const messageEl = document.querySelector<HTMLTextAreaElement>('#message');
const verdictEl = document.querySelector<HTMLElement>('#verdict');
const stampEl = document.querySelector<HTMLElement>('#stamp');

if (!kindEl || !messageEl || !verdictEl || !stampEl) {
  throw new Error('Bench markup is missing');
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
  stampEl.classList.remove('pop');
  void stampEl.offsetWidth;
  stampEl.classList.add('pop');

  const findings = report.findings.length === 0
    ? '<p>Recoverable. The agent has a tool it can call next.</p>'
    : report.findings.map((finding) => `
        <p class="finding ${finding.severity}">
          <strong>${finding.ruleId}</strong>
          ${escapeHtml(finding.message)}
        </p>
      `).join('');

  verdictEl.innerHTML = `${findings}<p>${report.errors} error${report.errors === 1 ? '' : 's'} of ${report.samples}.</p>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
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
