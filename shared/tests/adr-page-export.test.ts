import { describe, expect, it } from 'vitest';
import { renderAdrPage } from '../src/export/adr-page';
import { exportAdrFixture, exportDiagramFixture, exportIds, exportTimestamp } from './html-export-fixtures';

describe('all-ADR HTML page', () => {
  const adrs = [
    exportAdrFixture({ id: exportIds.adr, title: 'Shared title', status: 'draft', componentIds: [exportIds.systemA] }),
    exportAdrFixture({ id: exportIds.relationshipAdr, title: 'Shared title', status: 'accepted', componentIds: [], relationshipIds: [exportIds.relationship] }),
    exportAdrFixture({ id: exportIds.replacement, title: 'Legacy choice', status: 'superseded', replacementAdrId: exportIds.relationshipAdr, componentIds: [exportIds.systemB] }),
    exportAdrFixture({ id: exportIds.unlinkedAdr, title: 'Shared title', status: 'rejected', componentIds: [], relationshipIds: [], alternativesOrConstraints: null }),
  ];

  it('indexes every ADR once with status and UUID anchors, including duplicate titles', () => {
    const page = renderAdrPage({ diagram: exportDiagramFixture(), adrs, capturedAt: exportTimestamp });

    expect(page).toContain('4 ADRs in this export');
    expect(page.match(/class="adr-index-link"/g)).toHaveLength(4);
    expect(page.match(/class="adr-detail"/g)).toHaveLength(4);
    for (const adr of adrs) {
      expect(page).toContain(`href="#adr-${adr.id}"`);
      expect(page).toContain(`id="adr-${adr.id}"`);
      expect(page).toContain(`>${adr.status}<`);
    }
    expect(page.match(/Shared title/g)).toHaveLength(6);
  });

  it('shows full fields, available dates, replacement links, and UUID-disambiguated diagram back-links', () => {
    const page = renderAdrPage({ diagram: exportDiagramFixture(), adrs, capturedAt: exportTimestamp });

    expect(page).toContain('<h3>Context</h3><p>Payments need a clear owner.</p>');
    expect(page).toContain('<h3>Decision</h3><p>Route commands through Payments.</p>');
    expect(page).toContain('<h3>Consequences</h3><p>The boundary owns retries.</p>');
    expect(page).toContain(`<time datetime="${exportTimestamp}">${exportTimestamp}</time>`);
    expect(page).toContain(`href="#adr-${exportIds.relationshipAdr}">${exportIds.relationshipAdr}</a>`);
    expect(page).toContain(`href="index.html#component-${exportIds.systemA}">Payments &lt;Core&gt; (${exportIds.systemA})</a>`);
    expect(page).toContain(`href="index.html#relationship-${exportIds.relationship}">writes &lt;events&gt; (${exportIds.relationship})</a>`);
    expect(page).toContain('This ADR is not linked to a diagram artifact.');
    expect(page).toContain('None recorded.');
  });

  it('renders a useful empty catalog when the diagram has no ADRs', () => {
    const page = renderAdrPage({ diagram: exportDiagramFixture(), adrs: [], capturedAt: exportTimestamp });

    expect(page).toContain('0 ADRs in this export');
    expect(page).toContain('No ADRs belong to this diagram.');
    expect(page).not.toContain('class="adr-detail"');
  });
});
