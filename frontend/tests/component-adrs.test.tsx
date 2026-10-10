import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AdrLinkPicker } from '../src/components/AdrLinkPicker';
import { useAdrStore } from '../src/state/adr-store';
import { populatedComponentFixture, componentAdrFixtures, componentFixtureIds as ids } from '../../shared/tests/component-fixtures';
import type { DiagramDocument } from '../../shared/src/index';
describe('Component-local ADR selection and history', () => {
  it('offers local internals, occurrences and relationships and retains exact IDs through history', () => {
    const child = populatedComponentFixture() as DiagramDocument;
    const html = renderToStaticMarkup(<AdrLinkPicker components={child.components} relationships={child.relationships} selectedIds={[ids.childPerson]} relationshipIds={[ids.relationship]} onChange={() => {}} onRelationshipChange={() => {}} />);
    expect(html).toContain('Payment handler'); expect(html).toContain('Customer');
    expect(html).not.toContain(ids.canonicalPerson);
    useAdrStore.getState().open(componentAdrFixtures()[0]);
    useAdrStore.getState().removeComponentLink(ids.childPerson);
    useAdrStore.getState().undo();
    expect(useAdrStore.getState().draft?.componentIds).toEqual([ids.internal, ids.childPerson]);
    expect(useAdrStore.getState().draft?.relationshipIds).toEqual([ids.relationship]);
    useAdrStore.getState().redo();
    expect(useAdrStore.getState().draft?.componentIds).toEqual([ids.internal]);
  });
});
