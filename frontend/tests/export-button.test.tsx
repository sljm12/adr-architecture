import { describe, expect, it } from 'vitest';
import { getExportBlockReason } from '../src/components/ExportButton';

describe('Mermaid export save guard', () => {
  it.each([
    ['unsaved', 'Save changes before exporting. Export uses the last saved diagram.'],
    ['saving', 'Wait for saving to finish before exporting.'],
    ['failed', 'Resolve the save failure before exporting.'],
  ] as const)('blocks %s drafts without initiating an implicit save', (status, message) => {
    expect(getExportBlockReason(status)).toBe(message);
  });

  it('allows export only when the document has no pending save state', () => {
    expect(getExportBlockReason('saved')).toBeNull();
    expect(getExportBlockReason('idle')).toBeNull();
  });
});
