import { describe,expect,it } from 'vitest'; import fs from 'node:fs'; describe('OpenAPI contract',()=>{it('declares diagram endpoints and saved-document summaries',()=>{const s=fs.readFileSync('specs/001-software-architecture-diagrams/contracts/openapi.yaml','utf8');expect(s).toContain('/diagrams/{diagramId}:');expect(s).toContain('DiagramDocument');expect(s).toContain('List active saved-diagram summaries');expect(s).toContain('DiagramSummaryList');});it('declares the complete diagram-scoped ADR read for HTML package export',()=>{const s=fs.readFileSync('specs/007-export-interactive-html/contracts/openapi.yaml','utf8');expect(s).toContain('/diagrams/{diagramId}/adrs/full:');expect(s).toContain('componentIds');expect(s).toContain('relationshipIds');expect(s).toContain('replacementAdrId');});});
describe('HTML source OpenAPI boundary', () => {
  it('declares the scoped source, required full members, context and all safe error responses', () => {
    const source = fs.readFileSync('specs/007-export-interactive-html/contracts/openapi.yaml', 'utf8');
    expect(source).toContain('/diagrams/{diagramId}/export/html-source:');
    expect(source).toContain('required: [entryDiagramId, sourceCapturedAt, diagrams, availability, containerContext]');
    expect(source).toContain('required: [diagram, adrs]');
    expect(source).toContain('required: [message, code, diagramId, artifactKind, field, remedy]');
    for (const status of ['200', '404', '409', '422', '500']) expect(source).toContain(`'${status}':`);
    for (const code of ['HTML_EXPORT_NOT_FOUND', 'HTML_EXPORT_SOURCE_INCOMPLETE', 'HTML_EXPORT_VALIDATION_FAILED', 'HTML_EXPORT_SOURCE_FAILED']) expect(source).toContain(code);
    expect(source).toContain('minItems: 1');
  });
});
