import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('component ADR count contract', () => {
  it('uses one bulk endpoint and independent stale-safe cache state', () => {
    const client = source('../src/api/adr-client.ts');
    const store = source('../src/state/adr-store.ts');
    const canvas = source('../src/components/DiagramCanvas.tsx');
    const node = source('../src/components/ComponentNode.tsx');
    expect(client).toContain('/component-adr-counts');
    expect(store).toContain('componentAdrCountsRequest');
    expect(store).toContain('loadComponentAdrCounts');
    expect(canvas).toContain('adrCounts');
    expect(node).toContain('component-adr-badge');
    expect(node).toContain('aria-label={`${data.adrCount}');
  });
});
