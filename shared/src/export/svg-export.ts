import type { Component, DiagramDocument } from '../domain/types';
import { escapeMarkup } from './escaping';
import { formatSvgNumber, layoutDiagramForSvg } from './svg-layout';

export type SvgExportOptions = { standalone?: boolean };

function displayType(type: string | null): string {
  return type === 'person' ? 'Person' : type === 'software-system' ? 'Software System' : 'Unclassified';
}

function wrappedLines(value: string, width: number): string[] {
  const maxCharacters = Math.max(12, Math.floor((width - 28) / 8));
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const characters = Array.from(word);
    const pieces = characters.length > maxCharacters
      ? Array.from({ length: Math.ceil(characters.length / maxCharacters) }, (_, index) => characters.slice(index * maxCharacters, (index + 1) * maxCharacters).join(''))
      : [word];
    for (const piece of pieces) {
      const next = line ? `${line} ${piece}` : piece;
      if (next.length > maxCharacters && line) {
        lines.push(line);
        line = piece;
      } else line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function componentMarkup(component: Component, rect: { x: number; y: number; width: number; height: number }): string {
  const type = component.type ?? 'unclassified';
  const typeLabel = displayType(component.type);
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const isPerson = component.type === 'person';
  const shape = isPerson
    ? `<ellipse class="component-shape component-person-shape" cx="${formatSvgNumber(cx)}" cy="${formatSvgNumber(cy)}" rx="${formatSvgNumber(rect.width / 2)}" ry="${formatSvgNumber(rect.height / 2)}"/>`
    : `<rect class="component-shape component-${escapeMarkup(type)}-shape" x="${formatSvgNumber(rect.x)}" y="${formatSvgNumber(rect.y)}" width="${formatSvgNumber(rect.width)}" height="${formatSvgNumber(rect.height)}" rx="8"/>`;
  const lines = wrappedLines(component.name, rect.width);
  const nameY = cy - ((lines.length - 1) * 8) + 8;
  const typeY = nameY - 18;
  const nameMarkup = lines.map((line, index) => `<tspan x="${formatSvgNumber(cx)}" dy="${index === 0 ? 0 : 16}">${escapeMarkup(line)}</tspan>`).join('');
  return `<a href="#component-${component.id}" class="diagram-component-link" tabindex="0" aria-label="Component ${escapeMarkup(component.name)}, ${typeLabel}"><g id="visual-component-${component.id}" class="diagram-component component-type-${escapeMarkup(type)}" data-artifact-id="${component.id}"><title>${escapeMarkup(component.name)} — ${typeLabel}</title>${shape}<text class="component-type-label" x="${formatSvgNumber(cx)}" y="${formatSvgNumber(typeY)}" text-anchor="middle">${typeLabel}</text><text class="component-name" x="${formatSvgNumber(cx)}" y="${formatSvgNumber(nameY)}" text-anchor="middle">${nameMarkup}</text></g></a>`;
}

const relationshipName = (diagram: DiagramDocument, id: string) => diagram.components.find(component => component.id === id)?.name ?? 'Unknown component';

export function renderDiagramSvg(diagram: DiagramDocument, options: SvgExportOptions = {}): string {
  const layout = layoutDiagramForSvg(diagram);
  const viewBox = layout.viewBox;
  const groups = (diagram.groups ?? []).map(group => {
    const rect = layout.groupRects.get(group.id)!;
    return `<g class="system-group" data-artifact-id="${group.id}"><rect class="system-group-shape" x="${formatSvgNumber(rect.x)}" y="${formatSvgNumber(rect.y)}" width="${formatSvgNumber(rect.width)}" height="${formatSvgNumber(rect.height)}" rx="8"/><text class="system-group-label" x="${formatSvgNumber(rect.x + 14)}" y="${formatSvgNumber(rect.y + 32)}">${escapeMarkup(group.name)}</text></g>`;
  }).join('');
  const relationships = layout.relationshipRoutes.map(route => {
    const relationship = route.relationship;
    const label = relationship.label
      ? `<text class="relationship-label" x="${formatSvgNumber(route.label.x)}" y="${formatSvgNumber(route.label.y)}" text-anchor="middle">${escapeMarkup(relationship.label)}</text>`
      : '';
    const arrow = route.arrow
      ? `<polygon class="relationship-arrow" points="${route.arrow.map(point => `${formatSvgNumber(point.x)},${formatSvgNumber(point.y)}`).join(' ')}"/>`
      : '';
    const accessibleLabel = `Relationship from ${relationshipName(diagram, relationship.sourceComponentId)} to ${relationshipName(diagram, relationship.targetComponentId)}${relationship.label ? `: ${relationship.label}` : ''}`;
    return `<a href="#relationship-${relationship.id}" class="diagram-relationship-link" tabindex="0" aria-label="${escapeMarkup(accessibleLabel)}"><g id="visual-relationship-${relationship.id}" class="diagram-relationship" data-artifact-id="${relationship.id}"><path class="relationship-path" d="${route.path}"/>${arrow}${label}</g></a>`;
  }).join('');
  const components = diagram.components.map(component => componentMarkup(component, layout.componentRects.get(component.id)!)).join('');
  const standaloneStyle = options.standalone ? `<style>
    .component-shape{fill:#fff;stroke:#707780;stroke-width:2}.component-person-shape{stroke-dasharray:6 4}.component-type-software-system .component-shape{stroke-dasharray:none}.component-type-person .component-shape{stroke-dasharray:6 4}.component-type-unclassified .component-shape{stroke-dasharray:2 3}.component-type-label,.system-group-label{font:600 12px system-ui,sans-serif;fill:#5f6368}.component-name{font:600 15px system-ui,sans-serif;fill:#1d1d1f}.system-group-shape{fill:#f5f5f7;fill-opacity:.5;stroke:#7a7a7a;stroke-width:2;stroke-dasharray:8 6}.relationship-path{fill:none;stroke:#5f6368;stroke-width:2}.relationship-arrow{fill:#5f6368}.relationship-label{font:600 13px system-ui,sans-serif;fill:#1d1d1f;paint-order:stroke;stroke:#fff;stroke-width:5px;stroke-linejoin:round}
  </style>` : '';
  const title = `<title id="architecture-diagram-title">Architecture diagram: ${escapeMarkup(diagram.name)}</title>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${formatSvgNumber(viewBox.x)} ${formatSvgNumber(viewBox.y)} ${formatSvgNumber(viewBox.width)} ${formatSvgNumber(viewBox.height)}" role="img" aria-labelledby="architecture-diagram-title">${title}${standaloneStyle}<g class="diagram-groups">${groups}</g><g class="diagram-relationships">${relationships}</g><g class="diagram-components">${components}</g></svg>`;
}
