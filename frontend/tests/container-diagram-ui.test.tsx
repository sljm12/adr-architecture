import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { diagramDocumentSchema, type DiagramDocument } from '../../shared/src/index';
import { populatedChildFixture } from '../../shared/tests/container-fixtures';
import { useDiagramStore } from '../src/state/diagram-store';
import { WorkspaceInspector } from '../src/components/WorkspaceInspector';
import { DiagramToolbar } from '../src/components/DiagramToolbar';
vi.mock('../src/state/diagram-store',async importOriginal=>{
  const actual=await importOriginal<typeof import('../src/state/diagram-store')>();
  return {...actual,useDiagramStore:Object.assign((selector:any=(state:any)=>state)=>selector(actual.useDiagramStore.getState()),actual.useDiagramStore)};
});
describe('container authoring surfaces',()=>{
  it('offers precisely Application and Datastore for internal creation, defaulting to Application',()=>{
    useDiagramStore.getState().open(diagramDocumentSchema.parse(populatedChildFixture()) as DiagramDocument);
    const html=renderToStaticMarkup(<WorkspaceInspector mode="component" selection={null} onClose={()=>{}}/>);
    expect(html).toContain('Application');expect(html).toContain('Datastore');expect(html).not.toContain('value="person"');expect(html).not.toContain('value="software-system"');expect(html).toContain('Responsibilities');expect(html).toContain('Technology');expect(html).toMatch(/value="application"[^>]*checked|checked[^>]*value="application"/);
  });
  it('uses a separate external mode and omits general grouping in a child toolbar',()=>{
    useDiagramStore.getState().open(diagramDocumentSchema.parse(populatedChildFixture()) as DiagramDocument);
    const html=renderToStaticMarkup(<DiagramToolbar onOpenInspector={()=>{}} onToggleLibrary={()=>{}} libraryOpen onToggleInspector={()=>{}} inspectorOpen/>);
    expect(html).toContain('Include external participant');expect(html).not.toContain('Group selected systems');
  });
  it('retains selected Datastore and presents external metadata as read-only',()=>{
    const child=diagramDocumentSchema.parse(populatedChildFixture()) as DiagramDocument;child.components[0].containerType='datastore';useDiagramStore.getState().open(child);
    const edit=renderToStaticMarkup(<WorkspaceInspector mode={null} selection={{kind:'component',id:child.components[0].id}} onClose={()=>{}}/>);
    expect(edit).toMatch(/value="datastore"[^>]*checked|checked[^>]*value="datastore"/);expect(edit).not.toContain('Legacy type');
    const external=renderToStaticMarkup(<WorkspaceInspector mode={null} selection={{kind:'component',id:child.components[1].id}} onClose={()=>{}}/>);
    expect(external).toContain('Source details are read-only');expect(external).not.toContain('component-edit-name');expect(external).not.toContain('type="radio"');
  });
});
