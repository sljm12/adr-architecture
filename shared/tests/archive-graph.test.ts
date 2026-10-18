import { describe, expect, it } from 'vitest';
import { archiveFixture, archiveId, emptyArchiveFixture, dependencyArchiveFixture } from './archive-fixtures';
import { parseArchive } from '../src/archive/validation';

describe('archive standalone graph', () => {
  it('validates without rewriting raw caches, text, microseconds or signed zero', () => {
    const raw = archiveFixture(); const copy = structuredClone(raw);
    expect(parseArchive(JSON.stringify(raw))).toEqual(copy); expect(raw).toEqual(copy);
  });
  it('uses collection scoped, case insensitive identities and endpoint pairs', () => {
    const fixture = archiveFixture(); fixture.records.components.push({ ...fixture.records.components[0], id: fixture.records.components[0].id.toUpperCase() });
    expect(() => parseArchive(JSON.stringify(fixture))).toThrow(/duplicate/i);
    const pair = archiveFixture(); pair.records.adrComponentLinks.push({ ...pair.records.adrComponentLinks[0], componentId: pair.records.adrComponentLinks[0].componentId.toUpperCase() });
    expect(() => parseArchive(JSON.stringify(pair))).toThrow(/duplicate/i);
    const scoped = emptyArchiveFixture(); scoped.records.components.push({ ...archiveFixture().records.components[0], id: archiveId(1) });
    expect(() => parseArchive(JSON.stringify(scoped))).not.toThrow();
    const shared = archiveFixture(); shared.records.systemGroups[0].id = shared.records.components[0].id;
    for (const member of shared.records.systemGroupMembers) member.groupId = shared.records.systemGroups[0].id;
    expect(() => parseArchive(JSON.stringify(shared))).not.toThrow();
  });
  it('rejects missing, extra, duplicate and incorrectly ordered manifests/seeds', () => {
    for (const mutate of [
      (f: ReturnType<typeof archiveFixture>) => f.includedDiagramIds.pop(),
      (f: ReturnType<typeof archiveFixture>) => f.includedDiagramIds.reverse(),
      (f: ReturnType<typeof archiveFixture>) => f.seedDiagramIds.push(archiveId(99)),
      (f: ReturnType<typeof archiveFixture>) => f.records.diagrams.push({ ...f.records.diagrams[0], id: archiveId(99) }),
    ]) { const f = archiveFixture(); mutate(f); expect(() => parseArchive(JSON.stringify(f))).toThrow(); }
  });
  it('rejects broken hierarchy, ownership, source, relationship, group, ADR and Trash references', () => {
    const mutations: Array<(f: ReturnType<typeof archiveFixture>) => void> = [
      f => { f.records.diagrams[1].parentDiagramId = archiveId(3); },
      f => { f.records.diagrams[1].ownerComponentId = archiveId(13); },
      f => { f.records.components[4].sourceComponentId = archiveId(99); },
      f => { f.records.relationships[0].targetComponentId = archiveId(21); },
      f => { f.records.systemGroupMembers[0].componentId = archiveId(13); },
      f => { f.records.adrs[2].replacementAdrId = archiveId(99); },
      f => { f.records.adrRelationshipLinks[0].relationshipId = archiveId(99); },
      f => { f.records.diagrams[2].trashBatchId = null; },
      f => { f.records.diagrams[0].trashRootDiagramId = archiveId(3); },
    ];
    for (const mutate of mutations) { const f = archiveFixture(); mutate(f); expect(() => parseArchive(JSON.stringify(f))).toThrow(); }
  });
  it('preserves existing valid multi-ADR replacement cycles', () => {
    const fixture = archiveFixture(); fixture.records.adrs[1].replacementAdrId = fixture.records.adrs[2].id;
    expect(parseArchive(JSON.stringify(fixture))).toEqual(fixture);
  });
  it('closes recovery-root dependencies and retains supported legacy null provenance', () => {
    const dependency = dependencyArchiveFixture();
    expect(parseArchive(JSON.stringify(dependency))).toEqual(dependency);
    dependency.records.diagrams[2].trashRootDiagramId = null; dependency.records.diagrams[2].trashBatchId = null;
    dependency.records.diagrams.pop(); dependency.includedDiagramIds.pop();
    expect(parseArchive(JSON.stringify(dependency))).toEqual(dependency);
  });
  it('validates the union of multiple recovery seeds and its source digest', () => {
    const f = archiveFixture(); f.purpose = 'recovery'; f.selectedDiagramId = archiveId(1); f.seedDiagramIds = [archiveId(3),archiveId(1)]; f.recoveryForFileSha256 = 'a'.repeat(64);
    expect(parseArchive(JSON.stringify(f))).toEqual(f);
    f.selectedDiagramId = archiveId(3); expect(() => parseArchive(JSON.stringify(f))).toThrow(/first seed/i);
  });
  it('requires a Component external participant to reference an immediate Container source', () => {
    const f = archiveFixture(); f.records.components.push({ ...f.records.components[4], id: archiveId(32), diagramId: archiveId(3) });
    expect(() => parseArchive(JSON.stringify(f))).toThrow(/source/i);
    f.records.components.at(-1)!.sourceComponentId = archiveId(22);
    expect(() => parseArchive(JSON.stringify(f))).not.toThrow();
  });
});
