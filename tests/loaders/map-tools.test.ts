import { describe, expect, it } from 'vitest';
import { mapListedTools } from '../../src/loaders/map-tools.js';

describe('mapListedTools', () => {
  it('keeps outputSchema from tools/list', () => {
    const [tool] = mapListedTools([{
      name: 'search',
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object', properties: { ok: { type: 'boolean' } } },
    }]);
    expect(tool?.outputSchema).toEqual({
      type: 'object',
      properties: { ok: { type: 'boolean' } },
    });
  });

  it('omits outputSchema when the server did not send one', () => {
    const [tool] = mapListedTools([{ name: 'search' }]);
    expect(tool?.outputSchema).toBeUndefined();
    expect(tool?.inputSchema).toEqual({ type: 'object' });
  });
});
