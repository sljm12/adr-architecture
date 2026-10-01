export type UUID = string;
export type DiagramStatus = 'active' | 'trashed';
export type RelationshipDirection = 'directed' | 'undirected';
export type C4ArtifactType = 'person' | 'software-system';
export type DiagramKind = 'general' | 'container';
export type ComponentRole = 'element' | 'container' | 'external';
export interface Position { x: number; y: number }
export interface ComponentSize { width: number; height: number }
export const DEFAULT_COMPONENT_SIZE = { width: 180, height: 72 } as const satisfies ComponentSize;
export interface ContainerScope {
  parentDiagramId: UUID;
  softwareSystemId: UUID;
  parentDiagramName: string;
  softwareSystemName: string;
  softwareSystemDescription: string | null;
}
export interface Component { id: UUID; diagramId: UUID; name: string; description: string | null; type: C4ArtifactType | string | null; role?: ComponentRole; technology?: string | null; sourceComponentId?: UUID | null; position: Position; size: ComponentSize; createdAt: string; updatedAt: string }
export interface Relationship { id: UUID; diagramId: UUID; sourceComponentId: UUID; targetComponentId: UUID; direction: RelationshipDirection; label: string | null; protocol?: string | null; createdAt: string; updatedAt: string }
export interface Diagram { id: UUID; name: string; status: DiagramStatus; createdAt: string; updatedAt: string; trashedAt: string | null; kind?: DiagramKind; scope?: ContainerScope | null; boundary?: GroupBoundaryLayout | null }
export interface GroupBoundaryLayout { position: Position; size: { width: number; height: number } }
export interface SystemGroup extends GroupBoundaryLayout { id: UUID; diagramId: UUID; name: string; memberComponentIds: UUID[]; createdAt: string; updatedAt: string }
export interface DiagramDocument extends Diagram { components: Component[]; relationships: Relationship[]; groups: SystemGroup[] }
export interface DiagramSummary extends Pick<Diagram, 'id' | 'name' | 'status' | 'createdAt' | 'updatedAt'> { kind?: DiagramKind; scope?: ContainerScope | null }
export interface ContainerSourceSummary { id: UUID; name: string; description: string | null; type: C4ArtifactType }
export type ContainerAvailabilityState = 'none' | 'active' | 'trashed';
export interface ContainerAvailability {
  parentDiagramId: UUID;
  softwareSystemId: UUID;
  availability: ContainerAvailabilityState;
  diagram: DiagramSummary | null;
}
export interface ContainerContext {
  scope: ContainerScope;
  sources: ContainerSourceSummary[];
  capturedAt: string;
}
export interface DiagramDependencyBlocker {
  diagramId: UUID;
  name: string;
  status: DiagramStatus;
  componentId?: UUID;
  sourceComponentId?: UUID;
  reason: string;
  nextAction: string;
}

export type AdrStatus = 'draft' | 'accepted' | 'superseded' | 'rejected';

export interface ArchitectureDecisionRecord {
  id: UUID;
  diagramId: UUID;
  title: string;
  context: string;
  decision: string;
  consequences: string;
  alternativesOrConstraints: string | null;
  status: AdrStatus;
  replacementAdrId: UUID | null;
  componentIds: UUID[];
  relationshipIds: UUID[];
  createdAt: string;
  updatedAt: string;
}

export interface ComponentReference {
  adrId: UUID;
  componentId: UUID;
  createdAt: string;
}

export interface RelationshipReference {
  adrId: UUID;
  relationshipId: UUID;
  createdAt: string;
}

export interface AdrSummary {
  id: UUID;
  title: string;
  status: AdrStatus;
  updatedAt: string;
  componentCount: number;
  relationshipCount: number;
}

export interface ComponentAdrCount {
  componentId: UUID;
  count: number;
}

export interface ComponentAdrSummary {
  id: UUID;
  title: string;
  status: AdrStatus;
  updatedAt: string;
}

export interface RelationshipAdrSummary {
  id: UUID;
  title: string;
  status: AdrStatus;
  updatedAt: string;
}

export interface AdrWritePayload {
  title: string;
  context: string;
  decision: string;
  consequences: string;
  alternativesOrConstraints?: string | null;
  status: AdrStatus;
  replacementAdrId?: UUID | null;
}

export interface AdrComponentsWritePayload { componentIds: UUID[] }
export interface AdrRelationshipsWritePayload { relationshipIds: UUID[] }

export interface AdrDependencyBlocker {
  adrId: UUID;
  title: string;
  reason: string;
}
