import type { Component, DiagramDocument } from '../domain/types';
import { escapeMarkup } from './escaping';
import { formatSvgNumber, layoutDiagramForSvg } from './svg-layout';
import { validateExportDiagram } from './html-snapshot';
import { componentLabelBlocks, relationshipLabelBlocks, exportLabelHeight, exportTypography, EXPORT_LABEL_GAP, wrapExportText, type ExportLabelBlock } from './container-labels';
import { renderDiagramStyles } from './styles';
import { getDiagramOwnerId } from '../domain/c4';
import { getDiagramName } from '../domain/diagram-name';

export type SvgExportOptions = { standalone?: boolean };

function labelMarkup(blocks: ExportLabelBlock[], x: number, top: number): string {
  let y = top;
  return blocks.map(block => {
    const { fontSize, lineHeight } = exportTypography[block.className];
    const text = block.lines.map((line, index) => `<tspan x="${formatSvgNumber(x)}" dy="${index ? lineHeight : 0}">${escapeMarkup(line)}</tspan>`).join('');
    const markup = `<text class="${block.className}" x="${formatSvgNumber(x)}" y="${formatSvgNumber(y + fontSize)}" text-anchor="middle">${text}</text>`;
    y += block.height + EXPORT_LABEL_GAP;
    return markup;
  }).join('');
}

function groupLabelMarkup(name: string, rect: { x: number; y: number; width: number }): string {
  const { fontSize, lineHeight } = exportTypography['system-group-label'];
  const x = formatSvgNumber(rect.x + 14);
  const lines = wrapExportText(name, rect.width, fontSize);
  return `<text class="system-group-label" x="${x}" y="${formatSvgNumber(rect.y + 28)}">${lines.map((line, index) => `<tspan x="${x}" dy="${index ? lineHeight : 0}">${escapeMarkup(line)}</tspan>`).join('')}</text>`;
}

function componentMarkup(component: Component, rect: { x: number; y: number; width: number; height: number }, child = false): string {
  const type = component.type ?? 'unclassified';
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const isPerson = component.type === 'person' && !child;
  const shape = isPerson
    ? `<ellipse class="component-shape component-person-shape" cx="${formatSvgNumber(cx)}" cy="${formatSvgNumber(cy)}" rx="${formatSvgNumber(rect.width / 2)}" ry="${formatSvgNumber(rect.height / 2)}"/>`
    : `<rect class="component-shape component-${escapeMarkup(type)}-shape" x="${formatSvgNumber(rect.x)}" y="${formatSvgNumber(rect.y)}" width="${formatSvgNumber(rect.width)}" height="${formatSvgNumber(rect.height)}" rx="8"/>`;
  const blocks = componentLabelBlocks(component, isPerson ? rect.width * .85 : rect.width, child);
  const typeLabel = blocks[0].lines.join(' ');
  const text = labelMarkup(blocks, cx, cy - exportLabelHeight(blocks) / 2);
  return `<a href="#component-${component.id}" class="diagram-component-link" tabindex="0" aria-label="${escapeMarkup(`${component.name}, ${typeLabel}`)}"><g id="visual-component-${component.id}" class="diagram-component component-type-${escapeMarkup(type)}" data-artifact-id="${component.id}"${component.sourceComponentId ? ` data-source-component-id="${component.sourceComponentId}"` : ''}><title>${escapeMarkup(`${component.name} — ${typeLabel}`)}</title>${shape}${text}</g></a>`;
}

const relationshipName = (diagram: DiagramDocument, id: string) => diagram.components.find(component => component.id === id)?.name ?? 'Unknown component';

export function renderDiagramSvg(diagram: DiagramDocument, options: SvgExportOptions = {}): string {
  diagram = validateExportDiagram(diagram);
  const layout = layoutDiagramForSvg(diagram);
  const viewBox = layout.viewBox;
  const groups = (diagram.groups ?? []).map(group => {
    const rect = layout.groupRects.get(group.id)!;
    return `<g class="system-group" data-artifact-id="${group.id}"><rect class="system-group-shape" x="${formatSvgNumber(rect.x)}" y="${formatSvgNumber(rect.y)}" width="${formatSvgNumber(rect.width)}" height="${formatSvgNumber(rect.height)}" rx="8"/>${groupLabelMarkup(group.name, rect)}</g>`;
  }).join('');
  const relationships = layout.relationshipRoutes.map(route => {
    const relationship = route.relationship;
    const label = labelMarkup(relationshipLabelBlocks(relationship, Boolean(diagram.scope)), route.label.x, route.label.y - 14);
    const arrow = route.arrow
      ? `<polygon class="relationship-arrow" points="${route.arrow.map(point => `${formatSvgNumber(point.x)},${formatSvgNumber(point.y)}`).join(' ')}"/>`
      : '';
    const accessibleLabel = `Relationship from ${relationshipName(diagram, relationship.sourceComponentId)} to ${relationshipName(diagram, relationship.targetComponentId)}${relationship.label ? `: ${relationship.label}` : ''}`;
    return `<a href="#relationship-${relationship.id}" class="diagram-relationship-link" tabindex="0" aria-label="${escapeMarkup(accessibleLabel)}"><g id="visual-relationship-${relationship.id}" class="diagram-relationship" data-artifact-id="${relationship.id}"><path class="relationship-path" d="${route.path}"/>${arrow}${label}</g></a>`;
  }).map((markup, index) => options.standalone ? `<g id="relationship-${layout.relationshipRoutes[index].relationship.id}">${markup}</g>` : markup).join('');
  const components = diagram.components.map(component => {
    const markup = componentMarkup(component, layout.componentRects.get(component.id)!, diagram.kind === 'container' || diagram.kind === 'component');
    return options.standalone ? `<g id="component-${component.id}">${markup}</g>` : markup;
  }).join('');
  const rect = layout.boundaryRect;
  const boundary = rect && diagram.scope ? `<g class="system-boundary" role="group" aria-label="${escapeMarkup(`${diagram.kind === 'component' ? 'Container' : 'Software System'} boundary for ${getDiagramName(diagram)}`)}" data-parent-diagram-id="${diagram.scope.parentDiagramId}" data-owner-component-id="${getDiagramOwnerId(diagram)}"><rect class="system-group-shape" x="${formatSvgNumber(rect.x)}" y="${formatSvgNumber(rect.y)}" width="${formatSvgNumber(rect.width)}" height="${formatSvgNumber(rect.height)}" rx="8"/>${groupLabelMarkup(getDiagramName(diagram), rect)}</g>` : '';
  const standaloneStyle = options.standalone ? `<style>${renderDiagramStyles(true)}</style>` : '';
  const scopeText = diagram.scope ? `${diagram.kind === 'component' ? 'Component' : 'Container'} diagram for ${getDiagramName(diagram)}; parent ${diagram.scope.parentDiagramName}; Software System ${diagram.scope.softwareSystemName}.${'containerId' in diagram.scope ? ` ${diagram.scope.containerType}; ${diagram.scope.containerDescription}; Technology: ${diagram.scope.containerTechnology}.` : ''}` : 'Single-diagram snapshot. Child container contents are not bundled.';
  const title = `<title id="architecture-diagram-title">Architecture diagram: ${escapeMarkup(diagram.name)}</title><desc id="architecture-diagram-scope">${escapeMarkup(scopeText)}</desc>`;
  const width = formatSvgNumber(viewBox.width), height = formatSvgNumber(viewBox.height);
  const content = `<g class="diagram-groups">${boundary}${groups}</g><g class="diagram-relationships">${relationships}</g><g class="diagram-components">${components}</g>`;
  // Some vector editors reset the view-box origin on import. Translate one outer
  // group instead, preserving all editable domain coordinates and relative layout.
  const viewport = options.standalone
    ? `<g class="diagram-viewport" transform="translate(${formatSvgNumber(-viewBox.x)} ${formatSvgNumber(-viewBox.y)})">${content}</g>`
    : content;
  const origin = options.standalone ? '0 0' : `${formatSvgNumber(viewBox.x)} ${formatSvgNumber(viewBox.y)}`;
  const dimensions = options.standalone ? ` width="${width}" height="${height}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" class="diagram-svg diagram-level-${diagram.kind === 'container' || diagram.kind === 'component' ? diagram.kind : 'system-context'}" viewBox="${origin} ${width} ${height}"${dimensions} role="img" aria-labelledby="architecture-diagram-title" aria-describedby="architecture-diagram-scope">${title}${standaloneStyle}${viewport}</svg>`;
}
