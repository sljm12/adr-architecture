import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('selected component ADR summary', () => {
  it('renders title/status rows with stable direct-open actions', () => {
    const component = source('../src/components/ComponentAdrSummary.tsx');
    expect(component).toContain('Linked ADRs');
    expect(component).toContain('summary.title');
    expect(component).toContain('summary.status');
    expect(component).toContain('onOpenAdr(summary.id)');
    expect(component).toContain('Open ADR:');
  });

  it('has distinct loading, error, and no-linked-ADRs feedback', () => {
    const component = source('../src/components/ComponentAdrSummary.tsx');
    const workspace = source('../src/components/WorkspaceInspector.tsx');
    const client = source('../src/api/adr-client.ts');
    const store = source('../src/state/adr-store.ts');
    expect(component).toContain('Loading linked ADRs');
    expect(component).toContain('role="alert"');
    expect(component).toContain('No linked ADRs for this component.');
    expect(workspace).toContain('ComponentAdrSummary');
    expect(workspace).toContain('selection?.kind === \'component\'');
    expect(workspace).toContain('onOpenAdr');
    expect(client).toContain('/components/${componentId}/adrs');
    expect(store).toContain('loadComponentSummary');
    expect(store).toContain('componentSummaryStatus');
  });
});
