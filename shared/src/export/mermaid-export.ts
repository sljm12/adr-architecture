import { assertDiagramInvariants } from '../domain/invariants';
import type { DiagramDocument } from '../domain/types';
import { diagramDocumentSchema, validationFields } from '../validation/schemas';
import { getComponentTypeLabel } from '../domain/c4';
import { hasValidXmlCharacters } from './escaping';

export class MermaidExportError extends Error {
  constructor(message: string, readonly fields: Record<string, string>, readonly code?: 'EMPTY_CONTAINER_MERMAID') { super(message); this.name = 'MermaidExportError'; }
}

const mermaidId = (id: string) => `component_${id.replaceAll('-', '_')}`;
const groupMermaidId = (id: string) => `group_${id.replaceAll('-', '_')}`;
function safeText(value: string, entity: 'Component' | 'Relationship' | 'Group' | 'Diagram', id: string, field?: string): string {
  if (!hasValidXmlCharacters(value) || /\u007f/.test(value)) throw new MermaidExportError(`${entity} ${id} contains a control character that Mermaid cannot represent safely`, { [field ?? id]: 'Remove control characters before exporting.' });
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('|', '#124;').replaceAll('"', '#quot;').replaceAll('\\', '\\\\').replace(/\r\n|\r|\n/g, '<br/>').replaceAll('\t', '    ');
}

function groupInvariantFields(document: DiagramDocument, message: string): Record<string, string> {
  const index = (document.groups ?? []).findIndex(group => message.includes(group.id));
  if (index < 0) return { document: message };
  const suffix = /name|blank|duplicate/.test(message) ? 'name' : /layout|boundary/.test(message) ? 'size' : 'memberComponentIds';
  return { [`groups[${index}].${suffix}`]: message };
}

function componentNode(component: DiagramDocument['components'][number], child = false): string {
  const id = mermaidId(component.id);
  const fields = child ? [component.name, getComponentTypeLabel(component), component.description, component.technology ? `Technology: ${component.technology}` : null] : [component.name];
  const name = fields.filter((field): field is string => Boolean(field)).map(field => safeText(field, 'Component', component.id)).join('<br/>');
  if (component.type === 'person') return `  ${id}(("${name}"))`;
  return `  ${id}["${name}"]`;
}

export function exportMermaid(document: DiagramDocument): string {
  // Keep the legacy component/relationship error context stable before parsing the document.
  for (const component of document.components) safeText(component.name, 'Component', component.id);
  for (const component of document.components) { if (component.description) safeText(component.description, 'Component', component.id); if (component.technology) safeText(component.technology, 'Component', component.id); }
  for (const relationship of document.relationships) if (relationship.label) safeText(relationship.label, 'Relationship', relationship.id);
  for (const relationship of document.relationships) if (relationship.protocol) safeText(relationship.protocol, 'Relationship', relationship.id);
  safeText(document.name, 'Diagram', document.id);
  if (document.scope) for (const value of [document.scope.parentDiagramName, document.scope.softwareSystemName, document.scope.softwareSystemDescription]) if (value) safeText(value, 'Diagram', document.id);
  const parsed = diagramDocumentSchema.safeParse(document);
  if (!parsed.success) {
    const issue = parsed.error.issues[0], collection = issue.path[0], index = issue.path[1];
    const artifact = typeof index === 'number' && (collection === 'components' || collection === 'relationships' || collection === 'groups') ? document[collection]?.[index]?.id : document.id;
    const remedy = issue.path.at(-1) === 'containerType' ? 'Choose Application or Datastore in the editor, then retry export.' : 'Correct this field and retry export.';
    throw new MermaidExportError(`Artifact ${artifact ?? document.id}, field ${issue.path.join('.')}: ${issue.message}. ${remedy}`, validationFields(parsed.error));
  }
  try { assertDiagramInvariants(parsed.data); } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid diagram';
    throw new MermaidExportError('Diagram cannot be exported until validation errors are corrected', groupInvariantFields(parsed.data, message));
  }
  if (parsed.data.kind === 'container' && !parsed.data.components.some(c => c.role === 'container')) throw new MermaidExportError('Add a container or choose SVG/HTML for this empty container diagram.', { document: 'Empty container diagrams support SVG/HTML export.' }, 'EMPTY_CONTAINER_MERMAID');
  if (!parsed.data.components.length) throw new MermaidExportError('Add at least one component before exporting Mermaid.', { document: 'A Mermaid diagram needs at least one component.' });
  for (const component of parsed.data.components) if (component.diagramId !== parsed.data.id) throw new MermaidExportError(`Component ${component.id} does not belong to this diagram`, { [component.id]: 'Use a component from the active diagram.' });
  for (const relationship of parsed.data.relationships) if (relationship.diagramId !== parsed.data.id) throw new MermaidExportError(`Relationship ${relationship.id} does not belong to this diagram`, { [relationship.id]: 'Use a relationship from the active diagram.' });
  for (const group of parsed.data.groups) safeText(group.name, 'Group', group.id, `groups[${parsed.data.groups.indexOf(group)}].name`);
  const groupedComponentIds = new Set(parsed.data.groups.flatMap(group => group.memberComponentIds));
  const componentById = new Map(parsed.data.components.map(component => [component.id, component]));
  const child = parsed.data.kind === 'container';
  const nodes = parsed.data.components.filter(component => !groupedComponentIds.has(component.id)).map(component => componentNode(component, child));
  const subgraphs = parsed.data.groups.flatMap(group => [
    `  subgraph ${groupMermaidId(group.id)}["${safeText(group.name, 'Group', group.id, `groups[${parsed.data.groups.indexOf(group)}].name`)}"]`,
    ...group.memberComponentIds.map(componentId => componentNode(componentById.get(componentId)!)),
    '  end',
  ]);
  const edges = parsed.data.relationships.map(relationship => {
    const text = [relationship.label, ...(child ? [relationship.protocol] : [])].filter((part): part is string => Boolean(part)).map(part => safeText(part, 'Relationship', relationship.id)).join('<br/>');
    const label = text ? `|${child ? '"' : ''}${text}${child ? '"' : ''}|` : '';
    return `  ${mermaidId(relationship.sourceComponentId)} ${relationship.direction === 'directed' ? '-->' : '---'}${label} ${mermaidId(relationship.targetComponentId)}`;
  });
  if (child) {
    const scope = parsed.data.scope!;
    const comment = (value: string) => safeText(value, 'Diagram', parsed.data.id).replaceAll('<br/>', ' ');
    return ['flowchart TD', `  %% Single-diagram snapshot: ${comment(parsed.data.name)}; Container diagram.`, `  %% Parent ${scope.parentDiagramId}; owner ${scope.softwareSystemId}; ${comment(scope.parentDiagramName)}`, ...parsed.data.components.filter(c => c.role === 'external').map(c => `  %% Occurrence ${c.id}; source ${c.sourceComponentId}`), `  subgraph system_${scope.softwareSystemId.replaceAll('-', '_')}["${safeText(scope.softwareSystemName, 'Diagram', parsed.data.id)}"]`, ...parsed.data.components.filter(c => c.role === 'container').map(c => componentNode(c, true)), '  end', ...parsed.data.components.filter(c => c.role === 'external').map(c => componentNode(c, true)), ...edges, ''].join('\n');
  }
  return ['flowchart TD', '  %% Single-diagram snapshot. Child container contents are not bundled.', '  %% Semantic group membership is preserved; exact canvas positions are not exported.', ...nodes, ...subgraphs, ...edges, ''].join('\n');
}
