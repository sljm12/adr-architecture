import type { HtmlExportSnapshot } from './html-snapshot';
import { escapeMarkup, renderPlainText } from './escaping';

function artifactReferences(snapshot: HtmlExportSnapshot, adrId: string): string {
  const adr = snapshot.adrs.find(item => item.id === adrId)!;
  const componentReferences = adr.componentIds.map(id => {
    const component = snapshot.diagram.components.find(item => item.id === id)!;
    return `<li><a href="index.html#component-${id}">${escapeMarkup(component.name)} (${id})</a></li>`;
  });
  const relationshipReferences = adr.relationshipIds.map(id => {
    const relationship = snapshot.diagram.relationships.find(item => item.id === id)!;
    const source = snapshot.diagram.components.find(item => item.id === relationship.sourceComponentId)!;
    const target = snapshot.diagram.components.find(item => item.id === relationship.targetComponentId)!;
    const name = relationship.label || `${source.name} to ${target.name}`;
    return `<li><a href="index.html#relationship-${id}">${escapeMarkup(name)} (${id})</a></li>`;
  });
  const references = [...componentReferences, ...relationshipReferences];
  return `<section class="adr-field adr-references"><h3>Diagram references</h3>${references.length ? `<ul>${references.join('')}</ul>` : '<p class="empty-state">This ADR is not linked to a diagram artifact.</p>'}</section>`;
}

export function renderAdrPage(snapshot: HtmlExportSnapshot): string {
  const { adrs } = snapshot;
  const emptyState = adrs.length === 0 ? '<p class="empty-state">No ADRs belong to this diagram.</p>' : '';
  const index = adrs.length
    ? `<nav class="adr-catalog" aria-label="All architecture decision records"><h2>All ADRs</h2><ol>${adrs.map(adr => `<li><a class="adr-index-link" href="#adr-${adr.id}">${escapeMarkup(adr.title)}</a><span class="adr-status">${escapeMarkup(adr.status)}</span></li>`).join('')}</ol></nav>`
    : '';
  const sections = adrs.map(adr => `<article id="adr-${adr.id}" class="adr-detail" aria-labelledby="adr-heading-${adr.id}"><header><h2 id="adr-heading-${adr.id}">${escapeMarkup(adr.title)}</h2><span class="adr-status">${escapeMarkup(adr.status)}</span></header><dl class="adr-metadata"><dt>Status</dt><dd>${escapeMarkup(adr.status)}</dd><dt>Created</dt><dd><time datetime="${escapeMarkup(adr.createdAt)}">${escapeMarkup(adr.createdAt)}</time></dd><dt>Updated</dt><dd><time datetime="${escapeMarkup(adr.updatedAt)}">${escapeMarkup(adr.updatedAt)}</time></dd>${adr.replacementAdrId ? `<dt>Replacement ADR</dt><dd><a href="#adr-${adr.replacementAdrId}">${escapeMarkup(adr.replacementAdrId)}</a></dd>` : ''}</dl><section class="adr-field"><h3>Context</h3><p>${renderPlainText(adr.context)}</p></section><section class="adr-field"><h3>Decision</h3><p>${renderPlainText(adr.decision)}</p></section><section class="adr-field"><h3>Consequences</h3><p>${renderPlainText(adr.consequences)}</p></section><section class="adr-field"><h3>Alternatives or constraints</h3><p>${adr.alternativesOrConstraints ? renderPlainText(adr.alternativesOrConstraints) : '<span class="empty-state">None recorded.</span>'}</p></section>${artifactReferences(snapshot, adr.id)}</article>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Architecture Decision Records - ${escapeMarkup(snapshot.diagram.name)}</title><link rel="stylesheet" href="styles.css"></head><body><header class="package-header"><span class="eyebrow">Architecture decision records</span><h1>${escapeMarkup(snapshot.diagram.name)}</h1><p>${adrs.length} ADRs in this export</p><nav class="package-nav" aria-label="Package pages"><a href="index.html">Return to diagram</a></nav></header><main class="package-main">${index}${emptyState}${sections}</main><footer class="package-footer"><p>Read-only snapshot captured ${escapeMarkup(snapshot.capturedAt)}.</p></footer></body></html>`;
}

function renderAdrPageLegacy(snapshot: HtmlExportSnapshot): string {
  const { adrs } = snapshot;
  const emptyState = adrs.length === 0 ? '<p class="empty-state">No ADRs belong to this diagram.</p>' : '';
  const sections = adrs.map(adr => `<article id="adr-${adr.id}" class="adr-detail" aria-labelledby="adr-heading-${adr.id}"><header><h2 id="adr-heading-${adr.id}">${escapeMarkup(adr.title)}</h2><span class="adr-status">${escapeMarkup(adr.status)}</span></header><dl class="adr-metadata"><dt>Status</dt><dd>${escapeMarkup(adr.status)}</dd><dt>Created</dt><dd><time datetime="${escapeMarkup(adr.createdAt)}">${escapeMarkup(adr.createdAt)}</time></dd><dt>Updated</dt><dd><time datetime="${escapeMarkup(adr.updatedAt)}">${escapeMarkup(adr.updatedAt)}</time></dd>${adr.replacementAdrId ? `<dt>Replacement ADR</dt><dd><a href="#adr-${adr.replacementAdrId}">${escapeMarkup(adr.replacementAdrId)}</a></dd>` : ''}</dl><section class="adr-field"><h3>Context</h3><p>${renderPlainText(adr.context)}</p></section><section class="adr-field"><h3>Decision</h3><p>${renderPlainText(adr.decision)}</p></section><section class="adr-field"><h3>Consequences</h3><p>${renderPlainText(adr.consequences)}</p></section><section class="adr-field"><h3>Alternatives or constraints</h3><p>${adr.alternativesOrConstraints ? renderPlainText(adr.alternativesOrConstraints) : '<span class="empty-state">None recorded.</span>'}</p></section></article>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Architecture Decision Records — ${escapeMarkup(snapshot.diagram.name)}</title><link rel="stylesheet" href="styles.css"></head><body><header class="package-header"><span class="eyebrow">Architecture decision records</span><h1>${escapeMarkup(snapshot.diagram.name)}</h1><p>${adrs.length} ADRs in this export</p><nav class="package-nav" aria-label="Package pages"><a href="index.html">Return to diagram</a></nav></header><main class="package-main">${emptyState}${sections}</main><footer class="package-footer"><p>Read-only snapshot captured ${escapeMarkup(snapshot.capturedAt)}.</p></footer></body></html>`;
}
