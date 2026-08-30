export type UUID = string;
export type DiagramStatus = 'active' | 'trashed';
export type RelationshipDirection = 'directed' | 'undirected';
export interface Position { x: number; y: number }
export interface Component { id: UUID; diagramId: UUID; name: string; description: string | null; type: string | null; position: Position; createdAt: string; updatedAt: string }
export interface Relationship { id: UUID; diagramId: UUID; sourceComponentId: UUID; targetComponentId: UUID; direction: RelationshipDirection; label: string | null; createdAt: string; updatedAt: string }
export interface Diagram { id: UUID; name: string; status: DiagramStatus; createdAt: string; updatedAt: string; trashedAt: string | null }
export interface DiagramDocument extends Diagram { components: Component[]; relationships: Relationship[] }
