import type { Diagram } from './types';

/** Container titles are display metadata resolved from their stable owner reference. */
export function getDiagramName(diagram: Pick<Diagram, 'name' | 'kind' | 'scope'>): string {
  return diagram.kind === 'container' && diagram.scope ? diagram.scope.softwareSystemName : diagram.name;
}
