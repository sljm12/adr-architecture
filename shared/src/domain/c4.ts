import type { C4ArtifactType, ComponentRole, DiagramKind } from './types';

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
  external: { label: 'External participant', diagramKind: 'container' },
} as const satisfies Record<ComponentRole, { label: string; diagramKind: DiagramKind }>;

export function isContainerDiagram(kind: DiagramKind | null | undefined): kind is 'container' {
  return kind === 'container';
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

