import type { ArchitectureDecisionRecord, Component } from '../domain/types';
import type { HtmlExportSnapshot } from './html-snapshot';
import type { HtmlPackageSnapshot } from './html-package-snapshot';
import type { PackageLinkContext } from './package-links';
import { escapeMarkup, renderPlainText } from './escaping';
import { renderDiagramSvg } from './svg-export';
import { getComponentTypeLabel } from '../domain/c4';

export interface DiagramPageContext { snapshot: HtmlPackageSnapshot; links: PackageLinkContext }

function linkedAdrs(snapshot: HtmlExportSnapshot, kind: 'component' | 'relationship', artifactId: string): ArchitectureDecisionRecord[] {
  return snapshot.adrs.filter(adr => kind === 'component' ? adr.componentIds.includes(artifactId) : adr.relationshipIds.includes(artifactId));
}

export function renderDiagramPage(snapshot: HtmlExportSnapshot, context?: DiagramPageContext): string {
  const { diagram } = snapshot;
  const origin = context?.links.diagram(diagram.id) ?? 'index.html';
  const adrLinks = (adrs: ArchitectureDecisionRecord[]) => adrs.length
    ? `<ul class="linked-adrs">${adrs.map(adr => `<li><a href="${context?.links.adr(origin, adr.id) ?? `adrs.html#adr-${adr.id}`}">${escapeMarkup(adr.title)}</a><span class="adr-status">${escapeMarkup(adr.status)}</span></li>`).join('')}</ul>`
    : '<p class="empty-state">No ADRs linked.</p>';
  const childNavigation = (component: Component) => {
    if (!context || component.type !== 'software-system' || component.role === 'container') return '';
    const destination = context.links.childAction(diagram.id, component.id);
    if (destination) return `<p class="container-navigation"><a href="${destination}">Open container diagram</a></p>`;
    const ownerId = component.role === 'external' ? component.sourceComponentId : component.id;
    const availability = context.snapshot.availability.find(item => item.softwareSystemId === ownerId);
    return `<p class="empty-state">No active container diagram is included.${availability?.availability === 'trashed' ? ' The child is trashed.' : ''}</p>`;
  };
  const componentIndex = diagram.components.length
    ? `<section><h3>Components</h3><ul>${diagram.components.map(component => `<li><a href="#component-${component.id}">${escapeMarkup(component.name)}</a></li>`).join('')}</ul></section>`
    : '<section><h3>Components</h3><p class="empty-state">This diagram has no components.</p></section>';
  const relationshipName = (relationship: typeof diagram.relationships[number]) => relationship.label || `${diagram.components.find(c => c.id === relationship.sourceComponentId)?.name ?? 'Component'} to ${diagram.components.find(c => c.id === relationship.targetComponentId)?.name ?? 'Component'}`;
  const relationshipIndex = diagram.relationships.length
    ? `<section><h3>Relationships</h3><ul>${diagram.relationships.map(relationship => `<li><a href="#relationship-${relationship.id}">${escapeMarkup(relationshipName(relationship))}</a></li>`).join('')}</ul></section>`
    : '<section><h3>Relationships</h3><p class="empty-state">This diagram has no relationships.</p></section>';
  const componentDetails = diagram.components.map(component => `<section id="component-${component.id}" tabindex="-1" class="artifact-detail" aria-labelledby="component-heading-${component.id}"><h2 id="component-heading-${component.id}">${escapeMarkup(component.name)}</h2><dl><dt>Type</dt><dd>${escapeMarkup(getComponentTypeLabel(component))}</dd>${component.containerType ? `<dt>Container subtype</dt><dd>${component.containerType}</dd>` : ''}${component.technology ? `<dt>Technology</dt><dd>${renderPlainText(component.technology)}</dd>` : ''}${component.sourceComponentId ? `<dt>Source component</dt><dd>${component.sourceComponentId}</dd>` : ''}<dt>Position</dt><dd>${component.position.x}, ${component.position.y}</dd><dt>Size</dt><dd>${component.size.width} × ${component.size.height}</dd>${component.description ? `<dt>${component.role === 'container' ? 'Responsibilities' : 'Description'}</dt><dd>${renderPlainText(component.description)}</dd>` : ''}</dl><h3>Linked ADRs</h3>${adrLinks(linkedAdrs(snapshot, 'component', component.id))}${childNavigation(component)}</section>`).join('');
  const relationshipDetails = diagram.relationships.map(relationship => {
    const source = diagram.components.find(component => component.id === relationship.sourceComponentId)!;
    const target = diagram.components.find(component => component.id === relationship.targetComponentId)!;
    return `<section id="relationship-${relationship.id}" tabindex="-1" class="artifact-detail" aria-labelledby="relationship-heading-${relationship.id}"><h2 id="relationship-heading-${relationship.id}">${escapeMarkup(relationship.label || 'Relationship')}</h2><dl><dt>Source</dt><dd>${escapeMarkup(source.name)}</dd><dt>Target</dt><dd>${escapeMarkup(target.name)}</dd><dt>Direction</dt><dd>${relationship.direction === 'directed' ? 'Directed' : 'Undirected'}</dd>${relationship.protocol ? `<dt>Protocol</dt><dd>${renderPlainText(relationship.protocol)}</dd>` : ''}</dl><h3>Linked ADRs</h3>${adrLinks(linkedAdrs(snapshot, 'relationship', relationship.id))}</section>`;
  }).join('');
  const scope = diagram.scope;
  const parentReturn = context?.links.ownerReturn(diagram.id);
  const scopeDetails = scope ? `<section class="export-scope"><h2>Container diagram · ${escapeMarkup(scope.softwareSystemName)}</h2><p>${parentReturn ? 'Included container snapshot.' : 'Single-diagram snapshot.'} Parent: ${escapeMarkup(scope.parentDiagramName)} (${scope.parentDiagramId}); owner: ${scope.softwareSystemId}.</p>${scope.softwareSystemDescription ? `<p>${renderPlainText(scope.softwareSystemDescription)}</p>` : ''}</section>`
    : `<p class="export-scope">${context ? 'System context snapshot with all active owned container diagrams.' : 'Single-diagram snapshot. Child container contents are not bundled.'}</p>`;
  const noArtifacts = !diagram.components.length && !diagram.relationships.length;
  const noAdrs = !snapshot.adrs.length ? `<p class="empty-state">${context && context.snapshot.diagrams.some(d => d.adrs.length) ? 'No ADRs belong to this diagram.' : 'No ADRs are included in this package.'}</p>` : '';
  const catalog = context?.links.relative(origin, 'adrs.html') ?? 'adrs.html';
  const styles = context?.links.relative(origin, 'styles.css') ?? 'styles.css';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeMarkup(diagram.name)} — Architecture diagram</title><link rel="stylesheet" href="${styles}"></head><body><header class="package-header"><span class="eyebrow">Architecture diagram package</span><h1>${escapeMarkup(diagram.name)}</h1><p>${diagram.components.length} components · ${diagram.relationships.length} relationships · ${snapshot.adrs.length} ADRs</p><nav class="package-nav" aria-label="Package pages"><a href="${catalog}">Browse all ADRs (${snapshot.adrs.length})</a>${parentReturn ? `<a href="${parentReturn}">Return to System context</a>` : ''}</nav></header><main class="package-main">${scopeDetails}<h2 class="visually-hidden">Interactive architecture diagram</h2>${noArtifacts ? '<p class="empty-state">This diagram has no components or relationships.</p>' : ''}${noAdrs}<div class="diagram-panel">${renderDiagramSvg(diagram)}</div><nav class="artifact-index" aria-label="Diagram artifacts"><h2>Diagram artifacts</h2>${componentIndex}${relationshipIndex}</nav><section id="artifact-intro" class="artifact-intro"><h2>Select a component or relationship</h2><p>Use the diagram or artifact links to see the ADRs attached directly to that item.</p></section>${componentDetails}${relationshipDetails}</main><footer class="package-footer"><p>Read-only snapshot captured ${escapeMarkup(snapshot.capturedAt)}.</p></footer></body></html>`;
}
