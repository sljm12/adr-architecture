import { DiagramRepository } from '../src/persistence/diagram-repository';
import { componentContextFixture, componentParentFixture, populatedComponentFixture, emptyComponentFixture } from '../../shared/tests/component-fixtures';
import type { DiagramDocument } from '../../shared/src/index';
import { AdrRepository, type AdrRepositoryLike } from '../src/persistence/adr-repository';
import type { DiagramRepositoryLike } from '../src/persistence/diagram-repository';
import { componentAdrFixtures, componentFixtureIds as ids } from '../../shared/tests/component-fixtures';
import { calculateGroupBounds } from '../../shared/src/index';
export function componentRecoveryFixture() {
  const repository = new DiagramRepository();
  for (const document of [componentContextFixture(), componentParentFixture(), populatedComponentFixture(), emptyComponentFixture('datastore')]) repository.create(document as DiagramDocument);
  return repository;
}

/** Disposable populated graph shared by memory and PostgreSQL deletion tests. */
export async function diagramDeletionFixture(repository: DiagramRepositoryLike = new DiagramRepository(), adrs: AdrRepositoryLike = new AdrRepository()) {
  const context = componentContextFixture();
  const owner = context.components[0];
  context.groups = [{ id: crypto.randomUUID(), diagramId: context.id, name: 'Payments team', memberComponentIds: [owner.id, context.components[2].id], ...calculateGroupBounds([owner.position, context.components[2].position]), createdAt: context.createdAt, updatedAt: context.updatedAt }];
  const unrelated: DiagramDocument = { ...context, id: crypto.randomUUID(), name: 'Unrelated', components: [], relationships: [], groups: [] };
  for (const document of [context, componentParentFixture(), populatedComponentFixture(), emptyComponentFixture('datastore'), unrelated]) {
    await repository.create(document as DiagramDocument);
    if (adrs instanceof AdrRepository) {
      adrs.registerDiagram(document.id);
      document.components.forEach(c => adrs.registerComponent(c));
      document.relationships.forEach(r => adrs.registerRelationship(r));
    }
  }
  const decisions = componentAdrFixtures();
  const accepted = await adrs.create(ids.child, decisions[0]);
  await adrs.replaceLinks(accepted.id, decisions[0].componentIds);
  await adrs.replaceRelationshipLinks(accepted.id, decisions[0].relationshipIds);
  for (const status of ['draft', 'rejected', 'superseded'] as const) await adrs.create(ids.child, { ...decisions[1], status, replacementAdrId: status === 'superseded' ? accepted.id : null });
  await repository.trash(ids.datastoreChild, { trashBatchId: ids.independentBatch, trashRootDiagramId: ids.datastoreChild });
  const before = { documents: await repository.listAll(), adrs: await adrs.listFull(ids.child), independentProvenance: await repository.getTrashProvenance(ids.datastoreChild) };
  return { repository, adrs, ids: { ...ids, unrelated: unrelated.id }, before };
}
