import type { Diagram } from './types';

/** Container titles are display metadata resolved from their stable owner reference. */
export function getDiagramName(diagram: Pick<Diagram, 'name' | 'kind' | 'scope'>): string {
  if (diagram.kind === 'component' && diagram.scope && 'containerId' in diagram.scope) return diagram.scope.containerName;
  return diagram.kind === 'container' && diagram.scope ? diagram.scope.softwareSystemName : diagram.name;
}
