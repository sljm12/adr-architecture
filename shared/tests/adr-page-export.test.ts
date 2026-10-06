import { describe, expect, it } from 'vitest';
import { renderAdrPage } from '../src/export/adr-page';
import { exportAdrFixture, exportDiagramFixture, exportIds, exportTimestamp } from './html-export-fixtures';
import { aggregateInput } from './html-package-input';
import { buildAggregateHtmlPackage } from '../src/export/html-package';
import { assembleHtmlPackageSnapshot } from '../src/export/html-package-snapshot';
import { createPackageLinks, validatePackageReferences } from '../src/export/package-links';

describe('all-ADR HTML page', () => {
  const adrs = [
    exportAdrFixture({ id: exportIds.adr, title: 'Shared title', status: 'draft', componentIds: [exportIds.systemA] }),
    exportAdrFixture({ id: exportIds.relationshipAdr, title: 'Shared title', status: 'accepted', componentIds: [], relationshipIds: [exportIds.relationship] }),
    exportAdrFixture({ id: exportIds.replacement, title: 'Legacy choice', status: 'superseded', replacementAdrId: exportIds.relationshipAdr, componentIds: [exportIds.systemB] }),
    exportAdrFixture({ id: exportIds.unlinkedAdr, title: 'Shared title', status: 'rejected', componentIds: [], relationshipIds: [], alternativesOrConstraints: null }),
  ];

  it('indexes every ADR once with status and UUID anchors, including duplicate titles', () => {
    const page = renderAdrPage({ diagram: exportDiagramFixture(), adrs, capturedAt: exportTimestamp, hasDraft: false });

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
    const page = renderAdrPage({ diagram: exportDiagramFixture(), adrs, capturedAt: exportTimestamp, hasDraft: false });

    expect(page).toContain('<h3>Context</h3><p>Payments need a clear owner.</p>');
    expect(page).toContain('<h3>Decision</h3><p>Route commands through Payments.</p>');
    expect(page).toContain('<h3>Consequences</h3><p>The boundary owns retries.</p>');
    expect(page).toContain(`<time datetime="${exportTimestamp}">${exportTimestamp}</time>`);
    expect(page).toContain(`href="#adr-${exportIds.relationshipAdr}">${exportIds.relationshipAdr}</a>`);
    expect(page).toContain(`href="index.html#component-${exportIds.systemA}">Payments &lt;Core&gt; (${exportIds.systemA})</a>`);
    expect(page).toContain(`href="index.html#relationship-${exportIds.relationship}">writes &lt;events&gt; (${exportIds.relationship})</a>`);
    expect(page).toContain('This ADR is not linked to a diagram artifact.');
    expect(page).toContain('<span class="empty-value">Not specified.</span>');
    expect(page).not.toContain('<span class="empty-state">');
  });

  it('renders a useful empty catalog when the diagram has no ADRs', () => {
    const page = renderAdrPage({ diagram: exportDiagramFixture(), adrs: [], capturedAt: exportTimestamp, hasDraft: false });

    expect(page).toContain('0 ADRs in this export');
    expect(page).toContain('No ADRs belong to this diagram.');
    expect(page).not.toContain('class="adr-detail"');
  });
});

describe('package-wide ADR catalog', () => {
  it('indexes and renders every decision once with diagram scope, lifecycle, fields and dates', () => {
    const { capture, source, fixture } = aggregateInput();
    const child = source.diagrams.find(member => member.diagram.kind === 'container' && member.adrs.length)!;
    child.diagram.components.find(component => component.role === 'container')!.name = '<img src=x onerror=alert(1)> 支付';
    child.adrs[0].context = '<script>unsafe()</script>\nSecond line';
    child.adrs[0].alternativesOrConstraints = 'A & B';
    child.adrs[1].alternativesOrConstraints = null;
    child.adrs[0].updatedAt = '2026-10-06T01:02:03.000Z';
    const files = buildAggregateHtmlPackage(capture, source);
    const page = files['adrs.html'];
    const entries = [...page.matchAll(/<li class="adr-catalog-entry">([\s\S]*?)<\/li>/g)].map(match => match[1]);
    const details = [...page.matchAll(/<article id="adr-([^"]+)"[\s\S]*?<\/article>/g)];
    expect(entries).toHaveLength(fixture.expected.adrIds.length);
    expect(details.map(match => match[1]).sort()).toEqual([...fixture.expected.adrIds].sort());
    for (const member of source.diagrams) for (const adr of member.adrs) {
      const entry = entries.find(entry => entry.includes(`href="#adr-${adr.id}"`))!;
      const detail = details.find(match => match[1] === adr.id)![0];
      for (const content of [entry, detail]) {
        expect(content).toContain(member.diagram.id);
        expect(content).toContain(member.diagram.kind === 'container' ? 'Container diagram' : 'System context');
        expect(content).toContain(member.diagram.name);
        expect(content).toContain(`>${adr.status}<`);
      }
      for (const field of ['Context', 'Decision', 'Consequences', 'Alternatives or constraints']) expect(detail).toContain(`<h3>${field}</h3>`);
      expect(detail).toContain(`<time datetime="${adr.createdAt}">${adr.createdAt}</time>`);
      expect(detail).toContain(`<time datetime="${adr.updatedAt}">${adr.updatedAt}</time>`);
      expect(detail).toContain(adr.decision);
      expect(detail).toContain(adr.consequences);
      if (adr.replacementAdrId) expect(detail).toContain(`href="#adr-${adr.replacementAdrId}"`);
      if (!adr.componentIds.length && !adr.relationshipIds.length) expect(detail).toContain('This ADR is not linked to a diagram artifact.');
    }
    expect(page).toContain('&lt;script&gt;unsafe()&lt;/script&gt;<br>Second line');
    expect(page).toContain('A &amp; B');
    expect(page).toContain('Not specified.');
    expect(page).toContain('&lt;img src=x onerror=alert(1)&gt; 支付');
    expect(page).not.toMatch(/<script|<img/);
    expect(() => validatePackageReferences(files)).not.toThrow();
  });

  it('orders the entry diagram first, children by UUID, and decisions by UUID without mutating input', () => {
    const { capture, source } = aggregateInput();
    const snapshot = assembleHtmlPackageSnapshot(capture, source);
    const links = createPackageLinks(snapshot);
    const expected = [snapshot.diagrams[0], ...snapshot.diagrams.slice(1).sort((a, b) => a.diagram.id.localeCompare(b.diagram.id))]
      .flatMap(member => [...member.adrs].sort((a, b) => a.id.localeCompare(b.id)).map(adr => adr.id));
    snapshot.diagrams.reverse();
    for (const member of snapshot.diagrams) member.adrs.reverse();
    const before = structuredClone(snapshot);
    const page = renderAdrPage(snapshot.diagrams.find(member => member.diagram.id === snapshot.entryDiagramId)!, { snapshot, links });
    const actual = [...page.matchAll(/class="adr-index-link" href="#adr-([^"]+)"/g)].map(match => match[1]);
    expect(actual).toEqual(expected);
    expect(snapshot).toEqual(before);
  });

  it('uses only exact owning-diagram artifact and replacement destinations despite duplicate names', () => {
    const { capture, source } = aggregateInput();
    const page = buildAggregateHtmlPackage(capture, source)['adrs.html'];
    for (const member of source.diagrams) for (const adr of member.adrs) {
      const article = page.match(new RegExp(`<article id="adr-${adr.id}"[\\s\\S]*?</article>`))![0];
      const references = [...article.matchAll(/href="([^"]*#(?:component|relationship)-[^"]+)"/g)].map(match => match[1]);
      const path = member.diagram.id === source.entryDiagramId ? 'index.html' : `diagrams/${member.diagram.id}/index.html`;
      expect(references).toEqual([
        ...adr.componentIds.map(id => `${path}#component-${id}`),
        ...adr.relationshipIds.map(id => `${path}#relationship-${id}`),
      ]);
      if (adr.replacementAdrId) expect(member.adrs.some(item => item.id === adr.replacementAdrId)).toBe(true);
    }
  });

  it('links every diagram to the shared catalog with its package count while preserving local empty states', () => {
    const { capture, source, fixture } = aggregateInput();
    const files = buildAggregateHtmlPackage(capture, source);
    for (const member of source.diagrams) {
      const root = member.diagram.id === source.entryDiagramId;
      const page = files[root ? 'index.html' : `diagrams/${member.diagram.id}/index.html`];
      expect(page).toContain(`href="${root ? '' : '../../'}adrs.html">Browse all ADRs (${fixture.expected.adrIds.length})</a>`);
      expect(page).toContain(`· ${member.adrs.length} ADRs`);
      if (!member.adrs.length) expect(page).toContain('No ADRs belong to this diagram.');
    }
  });

  it('explains a globally empty package catalog and keeps all zero-local diagrams browseable', () => {
    const { capture, source } = aggregateInput();
    for (const member of source.diagrams) member.adrs = [];
    const files = buildAggregateHtmlPackage(capture, source);
    expect(files['adrs.html']).toContain('0 ADRs in this export');
    expect(files['adrs.html']).toContain('No ADRs are included in this package.');
    expect(files['adrs.html']).not.toContain('class="adr-detail"');
    for (const member of source.diagrams) {
      const path = member.diagram.id === source.entryDiagramId ? 'index.html' : `diagrams/${member.diagram.id}/index.html`;
      expect(files[path]).toContain('Browse all ADRs (0)');
      expect(files[path]).toContain('No ADRs are included in this package.');
    }
  });
});
