import type { ArchitectureDecisionRecord, ContainerAvailability, ContainerContext, DiagramDocument } from '../domain/types';
import type { AdrExportDraft, HtmlExportSnapshot } from './html-snapshot';

/** Transient cloned editor state. Providers contribute only drafts they actually retain. */
export interface HtmlPackageOverride {
  diagram: DiagramDocument;
  draft?: AdrExportDraft | null;
}
export interface HtmlPackageCapture {
  entryDiagramId: string;
  capturedAt: string;
  overrides: Record<string, HtmlPackageOverride>;
}
export interface HtmlExportSourceMember {
  diagram: DiagramDocument;
  adrs: ArchitectureDecisionRecord[];
}
/** Saved data only, detached after the coordinated graph read completes. */
export interface HtmlExportSource {
  entryDiagramId: string;
  sourceCapturedAt: string;
  diagrams: HtmlExportSourceMember[];
  availability: ContainerAvailability[];
  containerContext: ContainerContext | null;
}
export interface HtmlPackageSnapshot {
  entryDiagramId: string;
  capturedAt: string;
  diagrams: HtmlExportSnapshot[];
  ownerChildren: Record<string, string>;
  availability: ContainerAvailability[];
}
