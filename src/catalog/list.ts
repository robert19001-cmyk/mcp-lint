export const DEFAULT_CATALOG_TIMEOUT_MS = 10_000;
export const DEFAULT_CATALOG_MAX_ITEMS = 100;
export const DEFAULT_CATALOG_MAX_BYTES = 262_144;

export interface CatalogResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface CatalogPrompt {
  name: string;
  title?: string;
  description?: string;
}

export interface CatalogSource {
  listResources(): Promise<{ resources: CatalogResource[] }>;
  listPrompts(): Promise<{ prompts: CatalogPrompt[] }>;
}

export interface CatalogLimits {
  timeoutMs?: number;
  maxItems?: number;
  maxBytes?: number;
}

export interface CatalogSection<T> {
  status: 'ran' | 'unsupported' | 'failed';
  items: T[];
  truncated: boolean;
  reason?: string;
}

export interface CatalogReport {
  resources: CatalogSection<CatalogResource>;
  prompts: CatalogSection<CatalogPrompt>;
  toolsInvoked: false;
}

export async function listCatalog(source: CatalogSource, limits: CatalogLimits = {}): Promise<CatalogReport> {
  const timeoutMs = limits.timeoutMs ?? DEFAULT_CATALOG_TIMEOUT_MS;
  const maxItems = limits.maxItems ?? DEFAULT_CATALOG_MAX_ITEMS;
  const maxBytes = limits.maxBytes ?? DEFAULT_CATALOG_MAX_BYTES;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) throw new Error('timeout must be a positive integer');
  if (!Number.isInteger(maxItems) || maxItems < 1) throw new Error('max items must be a positive integer');
  if (!Number.isInteger(maxBytes) || maxBytes < 1) throw new Error('max bytes must be a positive integer');

  const [resources, prompts] = await Promise.all([
    readSection('resources', () => source.listResources().then((result) => result.resources ?? []), timeoutMs, maxItems, maxBytes),
    readSection('prompts', () => source.listPrompts().then((result) => result.prompts ?? []), timeoutMs, maxItems, maxBytes),
  ]);

  return { resources, prompts, toolsInvoked: false };
}

async function readSection<T>(
  label: string,
  read: () => Promise<T[]>,
  timeoutMs: number,
  maxItems: number,
  maxBytes: number,
): Promise<CatalogSection<T>> {
  try {
    const all = await withTimeout(read(), timeoutMs, label);
    return clip(all, maxItems, maxBytes);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/method not found|-32601|not supported|unknown method/i.test(message)) {
      return { status: 'unsupported', items: [], truncated: false, reason: message };
    }
    return { status: 'failed', items: [], truncated: false, reason: message };
  }
}

function clip<T>(all: T[], maxItems: number, maxBytes: number): CatalogSection<T> {
  const items: T[] = [];
  let bytes = 2;
  for (const item of all) {
    const next = Buffer.byteLength(JSON.stringify(item));
    if (items.length >= maxItems || bytes + next > maxBytes) {
      return { status: 'ran', items, truncated: true };
    }
    items.push(item);
    bytes += next;
  }
  return { status: 'ran', items, truncated: false };
}

function withTimeout<T>(work: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms waiting for ${label}`)), timeoutMs);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
