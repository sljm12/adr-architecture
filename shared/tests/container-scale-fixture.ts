import { fitContainerLayout, type Component, type DiagramDocument } from '../src/index';
import { emptyChildFixture, generalParentFixture } from './container-fixtures';

const uuid = (value: number) => `91000000-0000-4000-8000-${String(value).padStart(12, '0')}`;

/** A validation envelope, not a product limit. Every external has a distinct parent source. */
export function containerScaleFixture() {
  const parent = generalParentFixture() as DiagramDocument;
  const child = emptyChildFixture() as DiagramDocument;
  child.name = 'Scale runtime';
  const base = parent.components[0];
  const internal: Component[] = Array.from({ length: 100 }, (_, index) => ({
    ...base, id: uuid(1000 + index), diagramId: child.id, name: `Container ${index}`,
    role: 'container', type: 'container', containerType: index % 2 ? 'datastore' : 'application',
    description: `Responsibility ${index}`, technology: index % 2 ? 'PostgreSQL' : 'TypeScript',
    position: { x: (index % 10) * 320, y: Math.floor(index / 10) * 240 },
    size: { width: 260, height: 180 },
  }));
  const sources: Component[] = Array.from({ length: 100 }, (_, index) => ({
    ...base, id: uuid(2000 + index), name: `Participant ${index}`,
    type: index % 2 ? 'software-system' : 'person', description: `Source responsibility ${index}`,
    position: { x: index * 300, y: 600 },
  }));
  parent.components.push(...sources);
  const external: Component[] = sources.map((source, index) => ({
    ...source, id: uuid(3000 + index), diagramId: child.id, role: 'external',
    sourceComponentId: source.id, position: { x: 0, y: 0 },
  }));
  const fitted = fitContainerLayout(internal, external);
  child.boundary = fitted.boundary;
  child.components = [...internal, ...fitted.externalComponents];
  child.relationships = Array.from({ length: 300 }, (_, index) => ({
    id: uuid(4000 + index), diagramId: child.id,
    sourceComponentId: internal[index % 100].id,
    targetComponentId: index < 100 ? internal[(index + 1) % 100].id : external[index % 100].id,
    direction: 'directed', label: `Interaction ${index}`, protocol: 'HTTPS',
    createdAt: child.createdAt, updatedAt: child.updatedAt,
  }));
  const generalIds = new Map(child.components.map((component, index) => [component.id, uuid(6000 + index)]));
  const general: DiagramDocument = {
    ...parent, id: uuid(5000), name: 'General scale baseline', groups: [],
    components: child.components.map(component => ({
      ...component, id: generalIds.get(component.id)!, diagramId: uuid(5000), role: 'element', type: 'software-system',
      containerType: null, technology: null, sourceComponentId: null,
    })),
    relationships: child.relationships.map((relationship, index) => ({
      ...relationship, id: uuid(7000 + index), diagramId: uuid(5000), protocol: null,
      sourceComponentId: generalIds.get(relationship.sourceComponentId)!,
      targetComponentId: generalIds.get(relationship.targetComponentId)!,
    })),
  };
  return { parent, child, general };
}
