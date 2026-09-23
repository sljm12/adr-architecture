import type { HtmlExportInput, HtmlExportSnapshot } from './html-snapshot';
import { validateHtmlExportSnapshot } from './html-snapshot';
import { renderAdrPage } from './adr-page';
import { renderDiagramPage } from './diagram-page';
import { renderExportStyles } from './styles';
import { renderDiagramSvg } from './svg-export';

export type HtmlPackageFiles = Record<'index.html' | 'adrs.html' | 'diagram.svg' | 'styles.css', string>;

export function renderHtmlPackage(snapshot: HtmlExportSnapshot): HtmlPackageFiles {
  return {
    'index.html': renderDiagramPage(snapshot),
    'adrs.html': renderAdrPage(snapshot),
    'diagram.svg': renderDiagramSvg(snapshot.diagram, { standalone: true }),
    'styles.css': renderExportStyles(),
  };
}

/** Validates and fully renders every initial package file before returning any files. */
export function buildHtmlPackage(input: HtmlExportInput): HtmlPackageFiles {
  const snapshot = validateHtmlExportSnapshot(input);
  return renderHtmlPackage(snapshot);
}
