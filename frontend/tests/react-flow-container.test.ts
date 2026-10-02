import { describe, expect, it } from 'vitest';
import { diagramDocumentSchema, type DiagramDocument } from '../../shared/src/index';
import { populatedChildFixture } from '../../shared/tests/container-fixtures';
import { fromReactFlow, toReactFlow } from '../src/adapters/react-flow/diagram-adapter';
describe('container visual adapter', () => {
  it('keeps all domain identities and metadata while excluding the synthetic boundary', () => {
    const document = diagramDocumentSchema.parse(populatedChildFixture()) as DiagramDocument;
    document.name = 'Independent child name';
    const {nodes,edges} = toReactFlow(document);
    expect(nodes[0]).toMatchObject({selectable:false,connectable:false,deletable:false});
    expect(nodes[1].data).toMatchObject({containerType:'application', description:document.components[0].description, technology:'TypeScript'});
    expect(edges[0].data).toMatchObject({protocol:'HTTPS'});
    expect(fromReactFlow(document,nodes)).toEqual(document);
    const moved=fromReactFlow(document,nodes.map(node=>node.id===document.components[0].id?{...node,position:{x:123,y:456}}:node));
    expect(moved.components[0]).toMatchObject({position:{x:123,y:456},containerType:'application'});
    expect(moved).toMatchObject({id:document.id,name:document.name,kind:'container',scope:document.scope});
  });
});
