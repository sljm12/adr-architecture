import type { C4ArtifactType } from './types';

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

