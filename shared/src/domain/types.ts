export type UUID = string;
export type DiagramStatus = 'active' | 'trashed';
export type RelationshipDirection = 'directed' | 'undirected';
export interface Position { x: number; y: number }
export interface Component { id: UUID; diagramId: UUID; name: string; description: string | null; type: string | null; position: Position; createdAt: string; updatedAt: string }
export interface Relationship { id: UUID; diagramId: UUID; sourceComponentId: UUID; targetComponentId: UUID; direction: RelationshipDirection; label: string | null; createdAt: string; updatedAt: string }
export interface Diagram { id: UUID; name: string; status: DiagramStatus; createdAt: string; updatedAt: string; trashedAt: string | null }
export interface DiagramDocument extends Diagram { components: Component[]; relationships: Relationship[] }
export interface DiagramSummary { id: UUID; name: string; status: DiagramStatus; updatedAt: string }

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
  createdAt: string;
  updatedAt: string;
}

export interface ComponentReference {
  adrId: UUID;
  componentId: UUID;
  createdAt: string;
}

export interface AdrSummary {
  id: UUID;
  title: string;
  status: AdrStatus;
  updatedAt: string;
  componentCount: number;
}

export interface ComponentAdrSummary {
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

export interface AdrDependencyBlocker {
  adrId: UUID;
  title: string;
  reason: string;
}
