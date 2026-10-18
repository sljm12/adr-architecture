// Independent inventory: keep this aligned with contracts/archive.schema.json, not the encoder.
export const archiveFieldInventory = {
  diagrams: ['id','name','status','kind','createdAt','updatedAt','trashedAt','parentDiagramId','ownerComponentId','scopeX','scopeY','scopeWidth','scopeHeight','trashBatchId','trashRootDiagramId','deletionRevision'],
  components: ['id','diagramId','name','description','type','role','containerType','technology','sourceComponentId','x','y','width','height','createdAt','updatedAt'],
  relationships: ['id','diagramId','sourceComponentId','targetComponentId','direction','label','protocol','createdAt','updatedAt'],
  systemGroups: ['id','diagramId','name','x','y','width','height','createdAt','updatedAt'],
  systemGroupMembers: ['groupId','componentId','createdAt'],
  adrs: ['id','diagramId','title','context','decision','consequences','alternativesOrConstraints','status','replacementAdrId','createdAt','updatedAt'],
  adrComponentLinks: ['adrId','componentId','createdAt'],
  adrRelationshipLinks: ['adrId','relationshipId','createdAt'],
} as const;

export const archiveId = (n: number) => `aaaaaaaa-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
export const archiveTime = '2024-02-29T12:34:56.123456Z';
export function archiveFixture() {
  const times = { createdAt: archiveTime, updatedAt: '2026-10-18T01:02:03.654321Z' };
  const diagram = (n: number) => ({ id: archiveId(n), name: '  Architecture 世界  ', kind: 'general', status: 'active', ...times, trashedAt: null as string | null, parentDiagramId: null as string | null, ownerComponentId: null as string | null, scopeX: null as string | null, scopeY: null as string | null, scopeWidth: null as string | null, scopeHeight: null as string | null, trashBatchId: null as string | null, trashRootDiagramId: null as string | null, deletionRevision: '9007199254740993' });
  const component = (n: number, owner: number) => ({ id: archiveId(n), diagramId: archiveId(owner), name: `  Element ${n} 日本語  `, description: null as string | null, type: 'software-system' as string | null, role: 'element', containerType: null as 'application' | 'datastore' | null, technology: null as string | null, sourceComponentId: null as string | null, x: '-0', y: '80.125', width: '180', height: '72', ...times });
  const root = diagram(1), child = { ...diagram(2), name: 'Raw cached child', kind: 'container', parentDiagramId: root.id, ownerComponentId: archiveId(11), scopeX: '-0', scopeY: '0', scopeWidth: '900', scopeHeight: '600' };
  const leaf = { ...diagram(3), name: 'Raw cached leaf', kind: 'component', parentDiagramId: child.id, ownerComponentId: archiveId(21), scopeX: '0', scopeY: '-0', scopeWidth: '900', scopeHeight: '600', status: 'trashed', trashedAt: archiveTime, trashBatchId: archiveId(91), trashRootDiagramId: archiveId(3), deletionRevision: '9223372036854775807' };
  const independent = { ...diagram(4), kind: 'container', parentDiagramId: root.id, ownerComponentId: archiveId(12), scopeX: '0', scopeY: '0', scopeWidth: '900', scopeHeight: '600', status: 'trashed', trashedAt: archiveTime, trashBatchId: archiveId(92), trashRootDiagramId: archiveId(4) };
  const internal = { ...component(21, 2), role: 'container', type: 'container', containerType: 'application' as const, description: '  API responsibility  ', technology: ' Node.js ', x: '40', y: '100' };
  const external = { ...component(22, 2), role: 'external', sourceComponentId: archiveId(12), name: 'Raw cached external', x: '-300' };
  const components = [component(11, 1), { ...component(12, 1), x: '240', description: '' }, { ...component(13, 1), type: 'legacy / free-form', x: '600', description: ' Unicode 🐈\n ' }, internal, external, { ...component(31, 3), type: 'component', role: 'component', description: 'worker', technology: ' TS ', x: '40', y: '100' }];
  const relationship = { id: archiveId(41), diagramId: root.id, sourceComponentId: archiveId(11), targetComponentId: archiveId(12), direction: 'undirected', label: '', protocol: null, ...times };
  const adrs = ['draft','accepted','superseded','rejected'].map((status, i) => ({ id: archiveId(60+i), diagramId: root.id, title: `  Decision ${i}  `, context: 'Context 世界', decision: ' Decision ', consequences: 'Consequence\n', alternativesOrConstraints: i % 2 ? '' : null, status, replacementAdrId: status === 'superseded' ? archiveId(61) : null, ...times }));
  return { format: 'adr-diagram-archive', version: 1, purpose: 'diagram', exportedAt: archiveTime, selectedDiagramId: child.id, seedDiagramIds: [child.id], includedDiagramIds: [root.id, child.id, leaf.id, independent.id], recoveryForFileSha256: null as string | null, records: { diagrams: [root, child, leaf, independent], components, relationships: [relationship], systemGroups: [{ id: archiveId(51), diagramId: root.id, name: ' Systems ', x: '-32', y: '0', width: '484', height: '240', ...times }], systemGroupMembers: [11,12].map(n => ({ groupId: archiveId(51), componentId: archiveId(n), createdAt: `2024-02-29T12:34:56.1234${n}Z` })), adrs, adrComponentLinks: [{ adrId: archiveId(60), componentId: archiveId(11), createdAt: '2024-03-01T00:00:00.000001Z' }], adrRelationshipLinks: [{ adrId: archiveId(61), relationshipId: relationship.id, createdAt: '2024-03-01T00:00:00.000002Z' }] } };
}

export function emptyArchiveFixture() {
  const fixture = archiveFixture();
  fixture.selectedDiagramId = archiveId(1); fixture.seedDiagramIds = [archiveId(1)]; fixture.includedDiagramIds = [archiveId(1)];
  fixture.records = { diagrams: [fixture.records.diagrams[0]], components: [], relationships: [], systemGroups: [], systemGroupMembers: [], adrs: [], adrComponentLinks: [], adrRelationshipLinks: [] };
  return fixture;
}

export function dependencyArchiveFixture() {
  const fixture = archiveFixture();
  const dependency = { ...fixture.records.diagrams[0], id: archiveId(5), status: 'trashed', trashedAt: archiveTime, trashBatchId: archiveId(91), trashRootDiagramId: archiveId(5) };
  fixture.records.diagrams.push(dependency);
  fixture.records.diagrams[2].trashRootDiagramId = dependency.id;
  fixture.includedDiagramIds.push(dependency.id);
  return fixture;
}
