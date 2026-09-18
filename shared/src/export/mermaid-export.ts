import { assertDiagramInvariants } from '../domain/invariants';
import type { DiagramDocument } from '../domain/types';
import { diagramDocumentSchema, validationFields } from '../validation/schemas';

export class MermaidExportError extends Error {
  constructor(message: string, readonly fields: Record<string, string>) { super(message); this.name = 'MermaidExportError'; }
}

const mermaidId = (id: string) => `component_${id.replaceAll('-', '_')}`;
const groupMermaidId = (id: string) => `group_${id.replaceAll('-', '_')}`;
function safeText(value: string, entity: 'Component' | 'Relationship' | 'Group', id: string, field?: string): string {
  if (/[\u0000-\u001f\u007f]/.test(value)) throw new MermaidExportError(`${entity} ${id} contains a control character that Mermaid cannot represent safely`, { [field ?? id]: 'Remove control characters before exporting.' });
  return value.replaceAll('&', '&amp;').replaceAll('|', '#124;').replaceAll('"', '#quot;').replaceAll('\\', '\\\\');
}

function groupInvariantFields(document: DiagramDocument, message: string): Record<string, string> {
  const index = (document.groups ?? []).findIndex(group => message.includes(group.id));
  if (index < 0) return { document: message };
  const suffix = /name|blank|duplicate/.test(message) ? 'name' : /layout|boundary/.test(message) ? 'size' : 'memberComponentIds';
  return { [`groups[${index}].${suffix}`]: message };
}

function componentNode(component: DiagramDocument['components'][number]): string {
  const id = mermaidId(component.id);
  const name = safeText(component.name, 'Component', component.id);
  if (component.type === 'person') return `  ${id}(("${name}"))`;
  return `  ${id}["${name}"]`;
}

export function exportMermaid(document: DiagramDocument): string {
  // Keep the legacy component/relationship error context stable before parsing the document.
  for (const component of document.components) safeText(component.name, 'Component', component.id);
  for (const relationship of document.relationships) if (relationship.label) safeText(relationship.label, 'Relationship', relationship.id);
  const parsed = diagramDocumentSchema.safeParse(document);
  if (!parsed.success) throw new MermaidExportError('Diagram cannot be exported until validation errors are corrected', validationFields(parsed.error));
  try { assertDiagramInvariants(parsed.data); } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid diagram';
    throw new MermaidExportError('Diagram cannot be exported until validation errors are corrected', groupInvariantFields(parsed.data, message));
  }
  if (!parsed.data.components.length) throw new MermaidExportError('Add at least one component before exporting Mermaid.', { document: 'A Mermaid diagram needs at least one component.' });
  for (const component of parsed.data.components) if (component.diagramId !== parsed.data.id) throw new MermaidExportError(`Component ${component.id} does not belong to this diagram`, { [component.id]: 'Use a component from the active diagram.' });
  for (const relationship of parsed.data.relationships) if (relationship.diagramId !== parsed.data.id) throw new MermaidExportError(`Relationship ${relationship.id} does not belong to this diagram`, { [relationship.id]: 'Use a relationship from the active diagram.' });
  for (const group of parsed.data.groups) safeText(group.name, 'Group', group.id, `groups[${parsed.data.groups.indexOf(group)}].name`);
  const groupedComponentIds = new Set(parsed.data.groups.flatMap(group => group.memberComponentIds));
  const componentById = new Map(parsed.data.components.map(component => [component.id, component]));
  const nodes = parsed.data.components.filter(component => !groupedComponentIds.has(component.id)).map(componentNode);
  const subgraphs = parsed.data.groups.flatMap(group => [
    `  subgraph ${groupMermaidId(group.id)}["${safeText(group.name, 'Group', group.id, `groups[${parsed.data.groups.indexOf(group)}].name`)}"]`,
    ...group.memberComponentIds.map(componentId => componentNode(componentById.get(componentId)!)),
    '  end',
  ]);
  const edges = parsed.data.relationships.map(relationship => {
    const label = relationship.label ? `|${safeText(relationship.label, 'Relationship', relationship.id)}|` : '';
    return `  ${mermaidId(relationship.sourceComponentId)} ${relationship.direction === 'directed' ? '-->' : '---'}${label} ${mermaidId(relationship.targetComponentId)}`;
  });
  return ['flowchart TD', '  %% Semantic group membership is preserved; exact canvas positions are not exported.', ...nodes, ...subgraphs, ...edges, ''].join('\n');
}
