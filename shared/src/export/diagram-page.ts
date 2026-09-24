import type { ArchitectureDecisionRecord } from '../domain/types';
import type { HtmlExportSnapshot } from './html-snapshot';
import { escapeMarkup, renderPlainText } from './escaping';
import { renderDiagramSvg } from './svg-export';

function linkedAdrs(snapshot: HtmlExportSnapshot, kind: 'component' | 'relationship', artifactId: string): ArchitectureDecisionRecord[] {
  return snapshot.adrs.filter(adr => kind === 'component'
    ? adr.componentIds.includes(artifactId)
    : adr.relationshipIds.includes(artifactId));
}

function adrLinks(adrs: ArchitectureDecisionRecord[]): string {
  if (!adrs.length) return '<p class="empty-state">No ADRs linked.</p>';
  return `<ul class="linked-adrs">${adrs.map(adr => `<li><a href="adrs.html#adr-${adr.id}">${escapeMarkup(adr.title)}</a><span class="adr-status">${escapeMarkup(adr.status)}</span></li>`).join('')}</ul>`;
}

export function renderDiagramPage(snapshot: HtmlExportSnapshot): string {
  let html = renderDiagramPageLegacy(snapshot);
  html = html.replace('>Browse all ADRs</a>', `>Browse all ADRs (${snapshot.adrs.length})</a>`);
  if (snapshot.adrs.length === 0) {
    html = html.replace('<div class="diagram-panel">', '<p class="empty-state">No ADRs are included in this package.</p><div class="diagram-panel">');
  }
  return html;
}

function renderDiagramPageLegacy(snapshot: HtmlExportSnapshot): string {
  const { diagram } = snapshot;
  const componentIndex = diagram.components.length
    ? `<section><h3>Components</h3><ul>${diagram.components.map(component => `<li><a href="#component-${component.id}">${escapeMarkup(component.name)}</a></li>`).join('')}</ul></section>`
    : '<section><h3>Components</h3><p class="empty-state">This diagram has no components.</p></section>';
  const relationshipIndex = diagram.relationships.length
    ? `<section><h3>Relationships</h3><ul>${diagram.relationships.map(relationship => `<li><a href="#relationship-${relationship.id}">${escapeMarkup(relationship.label || `${diagram.components.find(component => component.id === relationship.sourceComponentId)?.name ?? 'Component'} to ${diagram.components.find(component => component.id === relationship.targetComponentId)?.name ?? 'Component'}`)}</a></li>`).join('')}</ul></section>`
    : '<section><h3>Relationships</h3><p class="empty-state">This diagram has no relationships.</p></section>';
  const componentDetails = diagram.components.map(component => `<section id="component-${component.id}" class="artifact-detail" aria-labelledby="component-heading-${component.id}"><h2 id="component-heading-${component.id}">${escapeMarkup(component.name)}</h2><dl><dt>Type</dt><dd>${component.type === 'person' ? 'Person' : component.type === 'software-system' ? 'Software System' : 'Unclassified'}</dd><dt>Position</dt><dd>${component.position.x}, ${component.position.y}</dd><dt>Size</dt><dd>${component.size.width} × ${component.size.height}</dd>${component.description ? `<dt>Description</dt><dd>${renderPlainText(component.description)}</dd>` : ''}</dl><h3>Linked ADRs</h3>${adrLinks(linkedAdrs(snapshot, 'component', component.id))}</section>`).join('');
  const relationshipDetails = diagram.relationships.map(relationship => {
    const source = diagram.components.find(component => component.id === relationship.sourceComponentId)!;
    const target = diagram.components.find(component => component.id === relationship.targetComponentId)!;
    return `<section id="relationship-${relationship.id}" class="artifact-detail" aria-labelledby="relationship-heading-${relationship.id}"><h2 id="relationship-heading-${relationship.id}">${escapeMarkup(relationship.label || 'Relationship')}</h2><dl><dt>Source</dt><dd>${escapeMarkup(source.name)}</dd><dt>Target</dt><dd>${escapeMarkup(target.name)}</dd><dt>Direction</dt><dd>${relationship.direction === 'directed' ? 'Directed' : 'Undirected'}</dd></dl><h3>Linked ADRs</h3>${adrLinks(linkedAdrs(snapshot, 'relationship', relationship.id))}</section>`;
  }).join('');
  const svg = renderDiagramSvg(diagram);
  const noArtifacts = diagram.components.length === 0 && diagram.relationships.length === 0;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeMarkup(diagram.name)} — Architecture diagram</title><link rel="stylesheet" href="styles.css"></head><body><header class="package-header"><span class="eyebrow">Architecture diagram package</span><h1>${escapeMarkup(diagram.name)}</h1><p>${diagram.components.length} components · ${diagram.relationships.length} relationships · ${snapshot.adrs.length} ADRs</p><nav class="package-nav" aria-label="Package pages"><a href="adrs.html">Browse all ADRs</a></nav></header><main class="package-main"><h2 class="visually-hidden">Interactive architecture diagram</h2>${noArtifacts ? '<p class="empty-state">This diagram has no components or relationships.</p>' : ''}<div class="diagram-panel">${svg}</div><nav class="artifact-index" aria-label="Diagram artifacts"><h2>Diagram artifacts</h2>${componentIndex}${relationshipIndex}</nav><section id="artifact-intro" class="artifact-intro"><h2>Select a component or relationship</h2><p>Use the diagram or artifact links to see the ADRs attached directly to that item.</p></section>${componentDetails}${relationshipDetails}</main><footer class="package-footer"><p>Read-only snapshot captured ${escapeMarkup(snapshot.capturedAt)}.</p></footer></body></html>`;
}
