import { describe, expect, it } from 'vitest';
import { adrFixtureIds, adrComponentFixtures, completeAdrFixture, incompleteAdrFixture, supersededAdrFixture, unlinkedAdrFixture } from './adr-fixtures';
import { assertAdrComponentOwnership, assertAdrInvariants, assertAdrReplacement } from '../src/index';

describe('ADR domain invariants', () => {
  it('accepts complete, unlinked, and long multilingual ADR artifacts', () => {
    expect(() => assertAdrInvariants(unlinkedAdrFixture)).not.toThrow();
    expect(() => assertAdrInvariants(completeAdrFixture({ title: '决定 • ' + 'x'.repeat(5000) }))).not.toThrow();
  });

  it('rejects missing required fields, duplicate links, and invalid superseded records', () => {
    expect(() => assertAdrInvariants(completeAdrFixture({ ...incompleteAdrFixture('context') } as never))).toThrow('Context is required');
    expect(() => assertAdrInvariants(completeAdrFixture({ componentIds: [adrFixtureIds.componentA, adrFixtureIds.componentA] }))).toThrow('Duplicate ADR component link');
    expect(() => assertAdrInvariants(completeAdrFixture({ status: 'superseded', replacementAdrId: null }))).toThrow('replacement ADR');
  });

  it('requires replacement and linked components to remain in the same diagram', () => {
    const superseded = supersededAdrFixture;
    expect(() => assertAdrReplacement(superseded, completeAdrFixture({ id: adrFixtureIds.replacementAdr }))).not.toThrow();
    expect(() => assertAdrReplacement(superseded, completeAdrFixture({ id: adrFixtureIds.replacementAdr, diagramId: adrFixtureIds.otherDiagram }))).toThrow('same diagram');
    expect(() => assertAdrComponentOwnership(completeAdrFixture({ componentIds: [adrFixtureIds.otherComponent] }), adrComponentFixtures)).toThrow('different diagram');
  });

  it('permits every supported status transition while keeping superseded records explicit', () => {
    for (const status of ['draft', 'accepted', 'rejected'] as const) {
      expect(() => assertAdrInvariants(completeAdrFixture({ status, replacementAdrId: null }))).not.toThrow();
    }
    expect(() => assertAdrInvariants(completeAdrFixture({ status: 'superseded', replacementAdrId: adrFixtureIds.replacementAdr }))).not.toThrow();
    expect(() => assertAdrInvariants(completeAdrFixture({ status: 'superseded', replacementAdrId: null }))).toThrow('replacement ADR');
  });

  it('keeps rejected decisions valid and discoverable as first-class records', () => {
    const rejected = completeAdrFixture({ status: 'rejected', replacementAdrId: null });
    expect(rejected.status).toBe('rejected');
    expect(() => assertAdrInvariants(rejected)).not.toThrow();
  });
});
