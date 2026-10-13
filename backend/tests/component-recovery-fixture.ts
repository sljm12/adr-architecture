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

/** Disjoint and overlapping exact-name roots; all snapshots include recovery and revisions. */
export async function collectionDeletionFixture(repository: DiagramRepositoryLike = new DiagramRepository(), adrs: AdrRepositoryLike = new AdrRepository()) {
  const first = await diagramDeletionFixture(repository, adrs);
  const identityMap = new Map<string, string>();
  const remap = <T>(value: T): T => JSON.parse(JSON.stringify(value).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, id => {
    if (!identityMap.has(id)) identityMap.set(id, crypto.randomUUID());
    return identityMap.get(id)!;
  }));
  const originals = first.before.documents.filter(d => d.id !== first.ids.unrelated);
  const copies = remap(originals);
  for (const document of copies) {
    await repository.create({ ...document, status: 'active', trashedAt: null });
    if (adrs instanceof AdrRepository) {
      adrs.registerDiagram(document.id);
      document.components.forEach(c => adrs.registerComponent(c));
      document.relationships.forEach(r => adrs.registerRelationship(r));
    }
  }
  const second = remap(first.ids);
  for (const decision of [...first.before.adrs].sort((a, b) => Number(a.status === 'superseded') - Number(b.status === 'superseded'))) {
    const payload = remap(decision);
    if (decision.replacementAdrId) payload.replacementAdrId = identityMap.get(decision.replacementAdrId)!;
    const created = await adrs.create(payload.diagramId, payload);
    identityMap.set(decision.id, created.id);
    await adrs.replaceLinks(created.id, payload.componentIds);
    await adrs.replaceRelationshipLinks(created.id, payload.relationshipIds);
  }
  await repository.trash(second.datastoreChild, { trashBatchId: crypto.randomUUID(), trashRootDiagramId: second.datastoreChild });
  const name = (await repository.get(first.ids.context))!.name;
  for (const graph of [first.ids, second]) {
    const context = (await repository.get(graph.context))!;
    await repository.replace({ ...context, components: context.components.map(c => c.id === graph.system ? { ...c, name } : c) });
    const parent = (await repository.get(graph.parent))!;
    await repository.replace({ ...parent, components: parent.components.map(c => c.id === graph.application ? { ...c, name } : c) });
  }
  const nearNames: string[] = [];
  for (const nearName of [name + ' API', name.toLowerCase(), name + '!']) {
    const document = { ...(await repository.get(first.ids.unrelated))!, id: crypto.randomUUID(), name: nearName };
    await repository.create(document); nearNames.push(document.id);
    if (adrs instanceof AdrRepository) adrs.registerDiagram(document.id);
  }
  const snapshot = async () => {
    const documents = (await repository.listAll()).sort((a, b) => a.id.localeCompare(b.id));
    return { documents, saved: await Promise.all(documents.map(async d => ({ id: d.id, adrs: await adrs.listFull(d.id), provenance: await repository.getTrashProvenance(d.id), revision: await repository.getDeletionRevision(d.id) }))), indexes: adrs instanceof AdrRepository ? adrs.snapshotGraph() : undefined };
  };
  const crossRootReferences = async (outside = false) => {
    const decision = (await adrs.listFull(first.ids.child)).find(a => a.status === 'accepted')!;
    await adrs.replaceLinks(decision.id, [second.internal]);
    if (outside) await adrs.create(first.ids.unrelated, { title: 'Outside replacement', context: 'Context', decision: 'Decision', consequences: 'Consequences', status: 'superseded', replacementAdrId: decision.id });
    else {
      const other = (await adrs.listFull(second.child)).find(a => a.status === 'draft')!;
      await adrs.update(other.id, { ...other, status: 'superseded', replacementAdrId: decision.id });
    }
  };
  const activeDescendantBlocker = () => repository.trash(first.ids.parent, { trashBatchId: crypto.randomUUID(), trashRootDiagramId: first.ids.parent });
  return { repository, adrs, first: first.ids, second, name, nearNames, snapshot, before: await snapshot(), crossRootReferences, activeDescendantBlocker };
}
