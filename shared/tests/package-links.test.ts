import { describe, expect, it } from 'vitest';
import { createPackageLinks, assertSafePackagePath, validatePackageReferences } from '../src/export/package-links';
import { assembleHtmlPackageSnapshot } from '../src/export/html-package-snapshot';
import { aggregateInput } from './html-package-input';

describe('UUID package link registry', () => {
  it('resolves every contract destination relative to its root, child or Markdown origin', () => {
    const { source, capture, fixture } = aggregateInput();
    const links = createPackageLinks(assembleHtmlPackageSnapshot(capture, source));
    const child = fixture.children.find(d => d.components.length)!;
    const sibling = fixture.children.find(d => !d.components.length)!;
    const path = `diagrams/${child.id}/index.html`;
    expect(links.diagram(fixture.parent.id)).toBe('index.html');
    expect(links.svg(child.id)).toBe(`diagrams/${child.id}/diagram.svg`);
    expect(links.relative('index.html', path)).toBe(path);
    expect(links.relative(path, 'styles.css')).toBe('../../styles.css');
    expect(links.adr(path, fixture.adrsByDiagram[child.id][0].id)).toBe(`../../adrs.html#adr-${fixture.adrsByDiagram[child.id][0].id}`);
    expect(links.ownerReturn(child.id)).toBe(`../../index.html#component-${child.scope!.softwareSystemId}`);
    const external = child.components.find(c => c.role === 'external')!;
    expect(links.childAction(child.id, external.id)).toBe(`../${sibling.id}/index.html`);
    const adr = fixture.adrsByDiagram[child.id][0];
    expect(links.artifact('adrs.html', child.id, 'component', child.components[0].id)).toBe(`${path}#component-${child.components[0].id}`);
    expect(links.artifact(links.markdown(adr.id), child.id, 'relationship', child.relationships[0].id)).toBe(`../${path}#relationship-${child.relationships[0].id}`);
    expect(links.childAction(fixture.parent.id, fixture.parent.components.find(c => c.id === fixture.trashedChild.scope!.softwareSystemId)!.id)).toBeNull();
    expect(() => links.diagram(fixture.trashedChild.id)).toThrow();
    expect(() => links.relative(path, 'missing.html')).toThrow();
  });
  it.each(['/index.html', '../index.html', 'a/../index.html', 'C:/index.html', 'a\\index.html', 'https://example.com', 'a//b', './index.html'])('rejects unsafe output path %s', path => {
    expect(() => assertSafePackagePath(path)).toThrow();
  });
  it('rejects unresolved references, duplicate fragments and unsafe generated paths', () => {
    expect(() => validatePackageReferences({ 'index.html': '<a href="child.html#x">x</a>' })).toThrow(/destination/);
    expect(() => validatePackageReferences({ 'index.html': '<a href="#missing">x</a>' })).toThrow(/fragment/);
    expect(() => validatePackageReferences({ 'index.html': '<p id="x"></p><p id="x"></p>' })).toThrow(/Duplicate/);
    expect(() => validatePackageReferences({ '../index.html': '' })).toThrow();
    expect(() => validatePackageReferences({ 'index.html': '<a href="https://example.com">x</a>' })).toThrow();
  });
  it('rejects duplicate output paths before returning a registry', () => {
    const { source, capture } = aggregateInput();
    const snapshot = assembleHtmlPackageSnapshot(capture, source);
    snapshot.diagrams.push(structuredClone(snapshot.diagrams[0]));
    expect(() => createPackageLinks(snapshot)).toThrow(/Duplicate.*path/);
  });
});
