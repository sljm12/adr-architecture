import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('selected relationship ADR summary', () => {
  it('renders relationship context, title/status rows, and direct-open actions', () => {
    const component = source('../src/components/RelationshipAdrSummary.tsx');
    const workspace = source('../src/components/WorkspaceInspector.tsx');
    expect(component).toContain('Linked ADRs');
    expect(component).toContain('relationship.label');
    expect(component).toContain('summary.title');
    expect(component).toContain('summary.status');
    expect(component).toContain('onOpenAdr(summary.id)');
    expect(component).toContain('Open ADR:');
    expect(workspace).toContain("selection?.kind === 'relationship'");
  });

  it('has loading, error, and empty feedback for the selected relationship', () => {
    const component = source('../src/components/RelationshipAdrSummary.tsx');
    const client = source('../src/api/adr-client.ts');
    const store = source('../src/state/adr-store.ts');
    expect(component).toContain('Loading linked ADRs');
    expect(component).toContain('role="alert"');
    expect(component).toContain('No linked ADRs for this relationship.');
    expect(client).toContain('/relationships/${relationshipId}/adrs');
    expect(store).toContain('relationshipSummaryStatus');
    expect(store).toContain('relationshipSummaryError');
  });
});
