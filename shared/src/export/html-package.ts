import type { HtmlExportInput, HtmlExportSnapshot } from './html-snapshot';
import { validateHtmlExportSnapshot } from './html-snapshot';
import { renderAdrPage } from './adr-page';
import { renderDiagramPage } from './diagram-page';
import { renderExportStyles } from './styles';
import { renderDiagramSvg } from './svg-export';
import { renderAdrMarkdown } from './adr-markdown';
import { assembleHtmlPackageSnapshot, type HtmlPackageCapture, type HtmlExportSource, type HtmlPackageSnapshot } from './html-package-snapshot';
import { assertSafePackagePath, createPackageLinks, validatePackageReferences } from './package-links';

export type HtmlPackageFiles = Record<string, string>;

export function renderHtmlPackage(snapshot: HtmlExportSnapshot): HtmlPackageFiles {
  const files: HtmlPackageFiles = {
    'index.html': renderDiagramPage(snapshot),
    'adrs.html': renderAdrPage(snapshot),
    'diagram.svg': renderDiagramSvg(snapshot.diagram, { standalone: true }),
    'styles.css': renderExportStyles(),
  };
  for (const adr of snapshot.adrs) {
    const path = `adrs/${adr.id}.md`;
    if (Object.hasOwn(files, path)) throw new Error(`Duplicate HTML package path: ${path}`);
    files[path] = renderAdrMarkdown(snapshot, adr);
  }
  return files;
}

/** Validates and fully renders every package file before returning any files. */
export function buildHtmlPackage(input: HtmlExportInput): HtmlPackageFiles {
  const snapshot = validateHtmlExportSnapshot(input);
  return renderHtmlPackage(snapshot);
}

export function renderAggregateHtmlPackage(snapshot: HtmlPackageSnapshot): HtmlPackageFiles {
  const links = createPackageLinks(snapshot);
  const context = { snapshot, links };
  const files: HtmlPackageFiles = {};
  const add = (path: string, content: string) => {
    assertSafePackagePath(path);
    if (Object.hasOwn(files, path)) throw new Error(`Duplicate HTML package path: ${path}`);
    files[path] = content;
  };
  for (const member of snapshot.diagrams) {
    add(links.diagram(member.diagram.id), renderDiagramPage(member, context));
    add(links.svg(member.diagram.id), renderDiagramSvg(member.diagram, { standalone: true }));
    for (const adr of member.adrs) add(links.markdown(adr.id), renderAdrMarkdown(member, adr, links));
  }
  add('adrs.html', renderAdrPage(snapshot.diagrams[0], context));
  add('styles.css', renderExportStyles());
  validatePackageReferences(files, snapshot.entryDiagramId);
  return files;
}

/** All required members validate before any rendering or archive output. */
export function buildAggregateHtmlPackage(capture: HtmlPackageCapture, source: HtmlExportSource): HtmlPackageFiles {
  return renderAggregateHtmlPackage(assembleHtmlPackageSnapshot(capture, source));
}
