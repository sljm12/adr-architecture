import type { HtmlExportInput, HtmlExportSnapshot } from './html-snapshot';
import { validateHtmlExportSnapshot } from './html-snapshot';
import { renderAdrPage } from './adr-page';
import { renderDiagramPage } from './diagram-page';
import { renderExportStyles } from './styles';
import { renderDiagramSvg } from './svg-export';
import { renderAdrMarkdown } from './adr-markdown';

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
