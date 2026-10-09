import type { Diagram } from './types';

/** Scoped titles are display metadata resolved from their stable owner UUID. */
export function getDiagramName(diagram: Pick<Diagram, 'name' | 'kind' | 'scope'>): string {
  if (diagram.kind === 'component' && diagram.scope && 'containerId' in diagram.scope) return diagram.scope.containerName;
  return diagram.kind === 'container' && diagram.scope ? diagram.scope.softwareSystemName : diagram.name;
}
