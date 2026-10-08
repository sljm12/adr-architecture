import type { C4ArtifactType, C4ComponentType, Component, ComponentRole, ContainerType, DiagramKind, Diagram, ContainerScope, ComponentScope } from './types';

export const containerTypes = { application: { label: 'Application' }, datastore: { label: 'Datastore' } } as const;
export function isContainerType(value: unknown): value is ContainerType { return value === 'application' || value === 'datastore'; }
export function getComponentTypeLabel(component: Pick<Component, 'role' | 'type' | 'containerType'>): string {
  if (component.role === 'component') return 'Component';
  if (component.role !== 'container' && !(component.role === 'external' && component.type === 'container')) return getC4ArtifactTypeLabel(component.type);
  if (!isContainerType(component.containerType)) throw new Error('Choose Application or Datastore for this container.');
  return containerTypes[component.containerType].label;
}

/** Conservative wrapping metrics shared by domain edits and canvas labels. */
export function getContainerComponentMinimumSize(component: Pick<Component, 'name' | 'description' | 'technology'>) {
  const width = 280;
  const lines = (text: string) => text.split('\n').reduce((total, line) => total + Math.max(1, Math.ceil(line.length / 24)), 0);
  return { width, height: 96 + 26 * (lines(component.name) + lines(component.description ?? '') + lines(component.technology ? `Technology: ${component.technology}` : '')) };
}

export const c4ArtifactTypes = {
  person: {
    label: 'Person',
    description: 'A user, actor, role, or persona interacting with systems.',
  },
  'software-system': {
    label: 'Software System',
    description: 'A software system shown in the system-context view.',
  },
} as const satisfies Record<C4ArtifactType, { label: string; description: string }>;

export const C4_ARTIFACT_TYPES = c4ArtifactTypes;
export const c4ArtifactMetadata = c4ArtifactTypes;

export const c4ComponentRoles = {
  element: { label: 'Element', diagramKind: 'general' },
  container: { label: 'Container', diagramKind: 'container' },
  component: { label: 'Component', diagramKind: 'component' },
  external: { label: 'External participant', diagramKind: 'container' },
} as const satisfies Record<ComponentRole, { label: string; diagramKind: DiagramKind }>;

export function isContainerDiagram(kind: DiagramKind | null | undefined): kind is 'container' {
  return kind === 'container';
}
export function isComponentDiagram(kind: DiagramKind | null | undefined): kind is 'component' { return kind === 'component'; }
export function isC4ComponentType(value: unknown): value is C4ComponentType { return value === 'component'; }
export function isContainerDocument<T extends Diagram>(document: T): document is T & { kind: 'container'; scope: ContainerScope } {
  return document.kind === 'container' && !!document.scope && !('containerId' in document.scope);
}
export function isComponentDocument<T extends Diagram>(document: T): document is T & { kind: 'component'; scope: ComponentScope } {
  return document.kind === 'component' && !!document.scope && 'containerId' in document.scope;
}
export function getContainerScope(document: Pick<Diagram, 'kind' | 'scope'>): ContainerScope | null {
  return document.kind === 'container' && document.scope && !('containerId' in document.scope) ? document.scope : null;
}
export function getComponentScope(document: Pick<Diagram, 'kind' | 'scope'>): ComponentScope | null {
  return document.kind === 'component' && document.scope && 'containerId' in document.scope ? document.scope : null;
}
export function getDiagramOwnerId(document: Pick<Diagram, 'kind' | 'scope'>): string | null {
  if (!document.scope) return null;
  return document.kind === 'component' && 'containerId' in document.scope ? document.scope.containerId : document.scope.softwareSystemId;
}
export function isInternalComponent(component: Pick<Component, 'role' | 'type'>, kind: DiagramKind): boolean {
  return kind === 'component' ? component.role === 'component' && component.type === 'component'
    : kind === 'container' ? component.role === 'container' && component.type === 'container'
      : (component.role ?? 'element') === 'element';
}

export function getComponentRoleLabel(role: ComponentRole | null | undefined): string {
  return role ? c4ComponentRoles[role].label : c4ComponentRoles.element.label;
}

export function isC4ArtifactType(value: string | null | undefined): value is C4ArtifactType {
  return value === 'person' || value === 'software-system';
}

export function getC4ArtifactTypeLabel(value: string | null | undefined): string {
  if (isC4ArtifactType(value)) return c4ArtifactTypes[value].label;
  return value ? value : 'Unclassified';
}

export function getC4ArtifactTypeDescription(value: C4ArtifactType): string {
  return c4ArtifactTypes[value].description;
}

