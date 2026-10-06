import type { HtmlPackageSnapshot } from './html-package-snapshot';
import { HtmlExportError } from './html-snapshot';

export function assertSafePackagePath(path: string): void {
  if (!path || /[\\:#?%\s]/.test(path) || path.startsWith('/') || path.split('/').some(segment => !segment || segment === '.' || segment === '..')) throw new Error(`Unsafe HTML package path: ${path}`);
}

export interface PackageLinkContext {
  diagram(id: string): string;
  svg(id: string): string;
  markdown(id: string): string;
  relative(origin: string, destination: string): string;
  adr(origin: string, adrId: string): string;
  artifact(origin: string, diagramId: string, kind: 'component' | 'relationship', artifactId: string): string;
  ownerReturn(diagramId: string): string | null;
  childAction(diagramId: string, componentId: string): string | null;
}

export function createPackageLinks(snapshot: HtmlPackageSnapshot): PackageLinkContext {
  const paths = new Set(['adrs.html', 'styles.css']);
  const diagrams = new Map<string, string>();
  const svgs = new Map<string, string>();
  const markdown = new Map<string, string>();
  const members = new Map(snapshot.diagrams.map(member => [member.diagram.id, member]));
  const register = (path: string) => { assertSafePackagePath(path); if (paths.has(path)) throw new Error(`Duplicate HTML package path: ${path}`); paths.add(path); };
  for (const member of snapshot.diagrams) {
    const id = member.diagram.id;
    const root = id === snapshot.entryDiagramId ? '' : `diagrams/${id}/`;
    for (const path of [`${root}index.html`, `${root}diagram.svg`]) register(path);
    diagrams.set(id, `${root}index.html`); svgs.set(id, `${root}diagram.svg`);
    for (const adr of member.adrs) { const path = `adrs/${adr.id}.md`; register(path); markdown.set(adr.id, path); }
  }
  const lookup = (map: Map<string, string>, id: string) => { const path = map.get(id); if (!path) throw new Error(`Missing included package destination: ${id}`); return path; };
  const relative = (origin: string, destination: string) => {
    const [target, fragment] = destination.split('#');
    if (!paths.has(origin) || !paths.has(target)) throw new Error(`Missing included package destination: ${destination}`);
    if (origin === target && fragment) return `#${fragment}`;
    const from = origin.split('/').slice(0, -1), to = target.split('/');
    while (from.length && to.length && from[0] === to[0]) { from.shift(); to.shift(); }
    return `${'../'.repeat(from.length)}${to.join('/')}${fragment ? `#${fragment}` : ''}`;
  };
  const artifact = (origin: string, diagramId: string, kind: 'component' | 'relationship', artifactId: string) => {
    const member = members.get(diagramId);
    const artifacts = kind === 'component' ? member?.diagram.components : member?.diagram.relationships;
    if (!artifacts?.some(a => a.id === artifactId)) throw new Error(`Missing ${kind} package destination: ${artifactId}`);
    return relative(origin, `${lookup(diagrams, diagramId)}#${kind}-${artifactId}`);
  };
  return {
    diagram: id => lookup(diagrams, id), svg: id => lookup(svgs, id), markdown: id => lookup(markdown, id), relative,
    adr: (origin, id) => { lookup(markdown, id); return relative(origin, `adrs.html#adr-${id}`); }, artifact,
    ownerReturn: id => {
      const scope = members.get(id)?.diagram.scope;
      return scope && diagrams.has(scope.parentDiagramId) ? artifact(lookup(diagrams, id), scope.parentDiagramId, 'component', scope.softwareSystemId) : null;
    },
    childAction: (id, componentId) => {
      const component = members.get(id)?.diagram.components.find(c => c.id === componentId);
      if (!component || component.type !== 'software-system' || component.role === 'container') return null;
      const ownerId = component.role === 'external' ? component.sourceComponentId : component.id;
      const target = ownerId ? snapshot.ownerChildren[ownerId] : undefined;
      return target ? relative(lookup(diagrams, id), lookup(diagrams, target)) : null;
    },
  };
}

function resolveReference(origin: string, href: string): { file: string; fragment?: string } {
  if (/[\\:%\s]/.test(href) || href.startsWith('/') || href.includes('?')) throw new Error(`Unsafe package reference: ${href}`);
  const [path, fragment] = href.split('#');
  const parts = path ? origin.split('/').slice(0, -1) : origin.split('/');
  if (path) for (const segment of path.split('/')) {
    if (segment === '..') { if (!parts.length) throw new Error(`Package reference escapes root: ${href}`); parts.pop(); }
    else if (!segment || segment === '.') throw new Error(`Unsafe package reference: ${href}`);
    else parts.push(segment);
  }
  return { file: parts.join('/'), fragment };
}

/** Fail the complete map if any generated local file/fragment is missing or ambiguous. */
export function validatePackageReferences(files: Record<string, string>, diagramId?: string): void {
  try {
    const anchors = new Map<string, Set<string>>();
    for (const [path, content] of Object.entries(files)) {
      assertSafePackagePath(path);
      if (!/\.(html|svg)$/.test(path)) continue;
      const ids = [...content.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
      if (ids.length !== new Set(ids).size) throw new Error(`Duplicate fragment destination in ${path}`);
      anchors.set(path, new Set(ids));
    }
    for (const [path, content] of Object.entries(files)) {
      const references = /\.(html|svg)$/.test(path) ? [...content.matchAll(/\b(?:href|src)="([^"]+)"/g)].map(match => match[1])
        : path.endsWith('.md') ? [...content.matchAll(/\]\(([^)]+)\)/g)].map(match => match[1]) : [];
      for (const href of references) {
        const { file, fragment } = resolveReference(path, href);
        if (!Object.hasOwn(files, file)) throw new Error(`Unresolved file destination from ${path}: ${href}`);
        if (fragment && !anchors.get(file)?.has(fragment)) throw new Error(`Unresolved fragment destination from ${path}: ${href}`);
      }
    }
  } catch (error) { throw new HtmlExportError('diagram', diagramId, 'package.links', (error as Error).message, 'Correct the package destination and retry the export.', diagramId); }
}
