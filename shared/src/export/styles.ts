import { exportTypography } from './container-labels';

/** Shared by inline diagrams and independently editable standalone SVGs. */
export function renderDiagramStyles(standalone = false): string {
  const sizes = Object.entries(exportTypography).map(([name, style]) => `  --${name}-size: ${style.fontSize}px;`).join('\n');
  const textStyles = Object.entries(exportTypography).map(([name, style]) => `.${name} {
  font-family: var(--export-font-${style.monospace ? 'mono' : 'sans'});
  font-size: var(--${name}-size);
  font-weight: ${style.fontWeight};
  fill: var(--${name === 'component-name' || name === 'relationship-label' ? 'export-ink' : name === 'component-description' ? 'export-body' : 'export-muted'});
}`).join('\n\n');
  const css = `/* Diagram defaults: used by all root and nested HTML diagrams.
   Standalone SVG files embed the same defaults; edit their <style> separately.
   Colors, families and weights can be edited here. SVG wrapping/coordinates
   are fixed at export time; large font changes may need manual SVG adjustments. */
:root {
  --export-font-sans: "SF Pro Text", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  --export-font-mono: ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  --export-ink: #1d1d1f;
  --export-body: #333333;
  --export-muted: #5f6368;
  --export-canvas: #ffffff;
  --export-surface: #f5f5f7;
  --export-hairline: #e0e0e0;
  --export-action: #0066cc;
  --export-focus: #0071e3;
  /* Node border/background settings remain compatible with old exports. */
  --component-outline: #707780;
  --component-fill: #ffffff;
  --relationship-color: #5f6368;
  /* Sizes in SVG units. Each field also has an independent class below. */
${sizes}
}

/* Node shapes and independent text fields. */
.diagram-svg { letter-spacing: normal; }
.diagram-component-link, .diagram-relationship-link { text-decoration: none; }
.diagram-component-link:focus-visible, .diagram-relationship-link:focus-visible { outline: none; }
.diagram-component-link:focus-visible .component-shape,
.diagram-relationship-link:focus-visible .relationship-path {
  stroke: var(--export-focus);
  stroke-width: 4;
}
.component-shape {
  fill: var(--component-fill);
  stroke: var(--component-outline);
  stroke-width: 2;
}
.component-type-person .component-shape { stroke-dasharray: 6 4; }
.component-type-unclassified .component-shape { stroke-dasharray: 2 3; }
${textStyles}

/* C4 boundaries and relationships. */
.system-boundary { pointer-events: none; }
.system-group-shape {
  fill: var(--export-surface);
  fill-opacity: .6;
  stroke: var(--component-outline);
  stroke-width: 2;
  stroke-dasharray: 8 6;
}
.relationship-path { fill: none; stroke: var(--relationship-color); stroke-width: 2; }
.relationship-arrow { fill: var(--relationship-color); }
.relationship-label, .relationship-protocol {
  paint-order: stroke;
  stroke: var(--export-canvas);
  stroke-width: 5px;
  stroke-linejoin: round;
}`;
  // Vector editors may not support CSS variables; retain the same resolved defaults.
  const defaults = new Map([...css.matchAll(/(--[\w-]+):\s*([^;\n]+);/g)].map(match => [match[1], match[2]]));
  return standalone ? css.replace(/var\((--[\w-]+)\)/g, (_, name: string) => defaults.get(name)!) : css;
}

export function renderExportStyles(): string {
  return `${renderDiagramStyles()}

/* Page spacing: diagram, detail and ADR pages. */
:root {
  --export-page-width: 1440px;
  --export-page-gutter: clamp(16px, 3vw, 40px);
  --export-section-gap: 24px;
  font-family: var(--export-font-sans);
  color: var(--export-ink);
  background: var(--export-canvas);
  font-synthesis: none;
  line-height: 1.47;
  letter-spacing: -.01em;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--export-canvas); color: var(--export-ink); font-size: 17px; }
a { color: var(--export-action); text-underline-offset: 3px; }
a:focus-visible, .artifact-detail:focus-visible, .adr-detail:focus-visible {
  outline: 2px solid var(--export-focus);
  outline-offset: 3px;
  border-radius: 3px;
}
h1, h2, h3 { font-weight: 600; }
.package-header, .package-footer {
  padding: 24px max(var(--export-page-gutter), calc((100vw - var(--export-page-width)) / 2 + var(--export-page-gutter)));
  background: var(--export-surface);
}
.eyebrow { font-size: 12px; font-weight: 600; letter-spacing: .06em; color: var(--export-muted); }
.package-header h1 { margin: 8px 0; font-size: clamp(28px, 4vw, 40px); line-height: 1.1; letter-spacing: -.025em; }
.package-header p, .package-footer p { margin: 6px 0; color: var(--export-muted); font-size: 14px; }
.package-nav { display: flex; flex-wrap: wrap; gap: 8px 24px; margin-top: 16px; }
.package-nav a { display: inline-flex; align-items: center; min-height: 44px; font-size: 14px; }
.package-main { max-width: var(--export-page-width); margin: 0 auto; padding: 32px var(--export-page-gutter) 64px; }

/* Scope: names lead; UUIDs remain visible as secondary metadata. */
.export-scope { overflow-wrap: anywhere; margin: 0 0 var(--export-section-gap); }
.export-scope h2 { margin: 0 0 8px; font-size: 24px; line-height: 1.2; letter-spacing: -.015em; }
.export-scope > p { margin: 8px 0; }
.scope-note, .adr-scope { color: var(--export-muted); font-size: 14px; }
.scope-metadata { display: flex; flex-wrap: wrap; gap: 16px 32px; margin: 16px 0; }
.scope-metadata > div { min-width: 160px; max-width: 100%; }
.scope-metadata dt { margin-bottom: 4px; color: var(--export-muted); font-size: 12px; font-weight: 600; }
.scope-metadata dd { margin: 0; }
.scope-metadata strong { font-weight: 600; }
.artifact-id { display: block; font: 12px/1.5 var(--export-font-mono); color: var(--export-muted); overflow-wrap: anywhere; }
.artifact-technology, .artifact-protocol { font: 14px/1.5 var(--export-font-mono); color: var(--export-body); }
.artifact-responsibilities { color: var(--export-body); line-height: 1.47; }

/* Diagrams retain intrinsic proportions and scroll on small screens. */
.diagram-panel { overflow: auto; margin: 0 0 var(--export-section-gap); padding: 24px; border: 1px solid var(--export-hairline); border-radius: 8px; background: var(--export-canvas); }
.diagram-panel .diagram-svg { display: block; width: 100%; min-width: 640px; height: auto; }
.artifact-index { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 24px; padding: 24px 0; border-top: 1px solid var(--export-hairline); }
.artifact-index h2 { grid-column: 1 / -1; margin: 0; font-size: 22px; }
.artifact-index h3 { margin: 0 0 12px; font-size: 17px; }
.artifact-index ul { display: grid; gap: 8px; padding-left: 20px; margin: 0; overflow-wrap: anywhere; }
.artifact-intro { padding: 24px 0; border-top: 1px solid var(--export-hairline); }
.artifact-intro h2, .artifact-detail h2 { margin: 0 0 8px; font-size: 22px; line-height: 1.2; }
.artifact-intro p, .artifact-detail p { margin: 8px 0; }
.artifact-detail { display: none; max-width: 960px; padding: 24px; margin: 24px 0; border: 1px solid var(--export-hairline); border-radius: 8px; background: #fafafc; scroll-margin: 24px; }
.artifact-detail:target { display: block; border-color: var(--export-action); }
.artifact-detail dl, .adr-metadata { display: grid; grid-template-columns: minmax(100px, 160px) minmax(0, 1fr); gap: 12px 24px; margin: 20px 0; }
.artifact-detail dt, .adr-metadata dt { color: var(--export-muted); font-size: 14px; font-weight: 600; }
.artifact-detail dd, .adr-metadata dd { margin: 0; overflow-wrap: anywhere; }
.linked-adrs { display: grid; gap: 12px; padding-left: 20px; }
.linked-adrs li { padding-left: 2px; }

/* ADR pages share the title, body and metadata hierarchy. */
.adr-status { display: inline-block; margin-left: 8px; padding: 3px 10px; border-radius: 9999px; background: #f0f0f0; color: var(--export-body); font-size: 12px; font-weight: 600; text-transform: capitalize; }
.adr-catalog { max-width: 960px; padding: 24px; margin: 0 0 32px; border: 1px solid var(--export-hairline); border-radius: 8px; background: #fafafc; }
.adr-catalog h2 { margin: 0 0 16px; font-size: 22px; }
.adr-catalog ol { display: grid; gap: 16px; padding-left: 24px; margin: 0; }
.adr-catalog li { padding-left: 3px; }
.adr-catalog .adr-scope { margin: 4px 0 0; }
.adr-detail { max-width: 960px; padding: 32px 0; border-bottom: 1px solid var(--export-hairline); scroll-margin: 24px; }
.adr-detail:target { padding-inline: 24px; border: 1px solid var(--export-action); border-radius: 8px; background: #fafafc; }
.adr-detail > header { display: flex; flex-wrap: wrap; align-items: baseline; gap: 12px; }
.adr-detail h2 { margin: 0; font-size: 24px; line-height: 1.2; overflow-wrap: anywhere; }
.adr-field { margin: 24px 0; }
.adr-field h3 { margin: 0 0 8px; font-size: 17px; }
.adr-field p { margin: 0; color: var(--export-body); line-height: 1.6; overflow-wrap: anywhere; white-space: normal; }
.adr-references ul { display: grid; gap: 8px; padding-left: 20px; overflow-wrap: anywhere; }
.empty-value { color: var(--export-muted); font-style: italic; }
.empty-state { padding: 12px 16px; border-left: 2px solid var(--export-hairline); color: var(--export-muted); background: #fafafc; font-size: 14px; }
.visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

@media (max-width: 640px) {
  .package-header, .package-footer { padding: 20px 16px; }
  .package-main { padding: 24px 16px 40px; }
  .diagram-panel { padding: 12px; }
  .artifact-detail, .adr-catalog { padding: 16px; }
  .artifact-detail dl, .adr-metadata { grid-template-columns: 1fr; gap: 4px; }
  .artifact-detail dd, .adr-metadata dd { margin-bottom: 12px; }
}
@media print {
  .artifact-detail { display: block; }
  .diagram-panel { overflow: visible; break-inside: avoid; padding: 0; }
  .diagram-panel .diagram-svg { min-width: 0; max-height: none; }
  .package-main { padding: 16px 0; }
  .adr-detail { break-inside: avoid; }
}
@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } }

/* User overrides
   Edit this file and reload any HTML page; every included diagram shares it.
   Example rules (remove the surrounding comment to enable):
   .component-name { font-weight: 700; }
   .component-technology { font-family: Consolas, monospace; }
   .component-description { fill: #333333; }
   .diagram-level-container .component-name { fill: #1d1d1f; }
   .diagram-level-component .component-technology { font-style: italic; }
*/
`;
}
