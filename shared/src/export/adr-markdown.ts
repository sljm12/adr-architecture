import type { ArchitectureDecisionRecord } from '../domain/types';
import type { HtmlExportSnapshot } from './html-snapshot';

function escapeMarkdown(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/([`*_{}\[\]()#+\-.!|~])/g, '\\$1')
    .replace(/\r\n|\r|\n/g, '  \n');
}

function artifactLinks(snapshot: HtmlExportSnapshot, adr: ArchitectureDecisionRecord): string[] {
  const components = adr.componentIds.map(id => {
    const component = snapshot.diagram.components.find(item => item.id === id)!;
    return `- [${escapeMarkdown(component.name)} (${id})](../index.html#component-${id})`;
  });
  const relationships = adr.relationshipIds.map(id => {
    const relationship = snapshot.diagram.relationships.find(item => item.id === id)!;
    const source = snapshot.diagram.components.find(item => item.id === relationship.sourceComponentId)!;
    const target = snapshot.diagram.components.find(item => item.id === relationship.targetComponentId)!;
    const name = relationship.label || `${source.name} to ${target.name}`;
    return `- [${escapeMarkdown(name)} (${id})](../index.html#relationship-${id})`;
  });
  return [...components, ...relationships];
}

/** Renders one safe Markdown ADR document with stable links to the exported diagram. */
export function renderAdrMarkdown(snapshot: HtmlExportSnapshot, adr: ArchitectureDecisionRecord): string {
  const references = artifactLinks(snapshot, adr);
  const replacement = adr.replacementAdrId
    ? `[${adr.replacementAdrId}](../adrs.html#adr-${adr.replacementAdrId})`
    : 'None';
  const fields = [
    `# ${escapeMarkdown(adr.title)}`,
    '',
    `- ADR ID: ${adr.id}`,
    `- Status: ${adr.status}`,
    `- Created: ${escapeMarkdown(adr.createdAt)}`,
    `- Updated: ${escapeMarkdown(adr.updatedAt)}`,
    `- Replacement ADR: ${replacement}`,
    '',
    '## Context',
    '',
    escapeMarkdown(adr.context),
    '',
    '## Decision',
    '',
    escapeMarkdown(adr.decision),
    '',
    '## Consequences',
    '',
    escapeMarkdown(adr.consequences),
    '',
    '## Alternatives or constraints',
    '',
    adr.alternativesOrConstraints ? escapeMarkdown(adr.alternativesOrConstraints) : 'None recorded.',
    '',
    '## Diagram references',
    '',
    references.length ? references.join('\n') : 'This ADR is not linked to a diagram artifact.',
    '',
  ];
  return fields.join('\n');
}
