import { assertDiagramInvariants } from '../domain/invariants';
import type { DiagramDocument } from '../domain/types';
import { diagramDocumentSchema, validationFields } from '../validation/schemas';

export class MermaidExportError extends Error {
  constructor(message: string, readonly fields: Record<string, string>) { super(message); this.name = 'MermaidExportError'; }
}

const mermaidId = (id: string) => `component_${id.replaceAll('-', '_')}`;
function safeText(value: string, entity: 'Component' | 'Relationship', id: string): string {
  if (/[\u0000-\u001f\u007f]/.test(value)) throw new MermaidExportError(`${entity} ${id} contains a control character that Mermaid cannot represent safely`, { [id]: 'Remove control characters before exporting.' });
  return value.replaceAll('&', '&amp;').replaceAll('|', '#124;').replaceAll('"', '#quot;').replaceAll('\\', '\\\\');
}

export function exportMermaid(document: DiagramDocument): string {
  for (const component of document.components) safeText(component.name, 'Component', component.id);
  for (const relationship of document.relationships) if (relationship.label) safeText(relationship.label, 'Relationship', relationship.id);
  const parsed = diagramDocumentSchema.safeParse(document);
  if (!parsed.success) throw new MermaidExportError('Diagram cannot be exported until validation errors are corrected', validationFields(parsed.error));
  try { assertDiagramInvariants(parsed.data); } catch (error) { throw new MermaidExportError('Diagram cannot be exported until validation errors are corrected', { document: error instanceof Error ? error.message : 'Invalid diagram' }); }
  if (!parsed.data.components.length) throw new MermaidExportError('Add at least one component before exporting Mermaid.', { document: 'A Mermaid diagram needs at least one component.' });
  for (const component of parsed.data.components) if (component.diagramId !== parsed.data.id) throw new MermaidExportError(`Component ${component.id} does not belong to this diagram`, { [component.id]: 'Use a component from the active diagram.' });
  for (const relationship of parsed.data.relationships) if (relationship.diagramId !== parsed.data.id) throw new MermaidExportError(`Relationship ${relationship.id} does not belong to this diagram`, { [relationship.id]: 'Use a relationship from the active diagram.' });
  const nodes = parsed.data.components.map(component => `  ${mermaidId(component.id)}["${safeText(component.name, 'Component', component.id)}"]`);
  const edges = parsed.data.relationships.map(relationship => {
    const label = relationship.label ? `|${safeText(relationship.label, 'Relationship', relationship.id)}|` : '';
    return `  ${mermaidId(relationship.sourceComponentId)} ${relationship.direction === 'directed' ? '-->' : '---'}${label} ${mermaidId(relationship.targetComponentId)}`;
  });
  return ['flowchart TD', ...nodes, ...edges, ''].join('\n');
}
