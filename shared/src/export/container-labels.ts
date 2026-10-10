import type { Component, Relationship } from '../domain/types';
import { getComponentTypeLabel } from '../domain/c4';

export const exportTypography = {
  'component-type-label': { fontSize: 12, fontWeight: 600, lineHeight: 18, monospace: false },
  'component-role-label': { fontSize: 12, fontWeight: 400, lineHeight: 18, monospace: false },
  'component-name': { fontSize: 21, fontWeight: 600, lineHeight: 26, monospace: false },
  'component-description': { fontSize: 17, fontWeight: 400, lineHeight: 25, monospace: false },
  'component-technology': { fontSize: 14, fontWeight: 400, lineHeight: 21, monospace: true },
  'relationship-label': { fontSize: 14, fontWeight: 600, lineHeight: 21, monospace: false },
  'relationship-protocol': { fontSize: 12, fontWeight: 400, lineHeight: 18, monospace: true },
  'system-group-label': { fontSize: 14, fontWeight: 600, lineHeight: 21, monospace: false },
} as const;

export type ExportTextClass = keyof typeof exportTypography;
export type ExportLabelBlock = { className: ExportTextClass; lines: string[]; height: number };
export const EXPORT_LABEL_GAP = 8;

export function wrapExportText(value: string, width: number, fontSize = 17, monospace = false): string[] {
  const available = Math.max(32, width - 28);
  // Conservative font metrics include wide ASCII and full-width Unicode glyphs.
  const measure = (text: string) => Array.from(text).reduce((size, character) => size + (/\p{Mark}/u.test(character) ? 0 : character.codePointAt(0)! > 127 ? 17 : monospace ? 11 : /\s/u.test(character) ? 5 : /[MW@#%&]/.test(character) ? 16 : 10), 0) * fontSize / 17;
  return value.split(/\r\n|\r|\n/).flatMap(paragraph => {
    const lines: string[] = []; let line = '';
    for (const word of paragraph.split(/\s+/)) {
      const characters = Array.from(word);
      const pieces: string[] = []; let piece = '';
      for (const character of characters) {
        if (piece && measure(piece + character) > available) { pieces.push(piece); piece = ''; }
        piece += character;
      }
      pieces.push(piece);
      for (const piece of pieces) {
        const next = line ? `${line} ${piece}` : piece;
        if (measure(next) > available && line) { lines.push(line); line = piece; } else line = next;
      }
    }
    return [...lines, line];
  });
}
function labelBlock(className: ExportTextClass, value: string | null | undefined, width: number): ExportLabelBlock[] {
  if (!value?.trim()) return [];
  const { fontSize, lineHeight, monospace } = exportTypography[className];
  const lines = wrapExportText(value, width, fontSize, monospace);
  return [{ className, lines, height: lines.length * lineHeight }];
}

export function componentLabelBlocks(component: Component, width: number, scoped: boolean): ExportLabelBlock[] {
  return [
    ...labelBlock('component-type-label', getComponentTypeLabel(component), width),
    ...(scoped && component.role === 'external' ? labelBlock('component-role-label', 'Supporting participant', width) : []),
    ...labelBlock('component-name', component.name, width),
    ...(scoped ? labelBlock('component-description', component.description, width) : []),
    ...(scoped && component.technology ? labelBlock('component-technology', `Technology: ${component.technology}`, width) : []),
  ];
}

export function relationshipLabelBlocks(relationship: Relationship, scoped: boolean): ExportLabelBlock[] {
  return [...labelBlock('relationship-label', relationship.label, 260), ...(scoped ? labelBlock('relationship-protocol', relationship.protocol, 260) : [])];
}

export const exportLabelHeight = (blocks: ExportLabelBlock[]) => blocks.reduce((total, block) => total + block.height, 0) + Math.max(0, blocks.length - 1) * EXPORT_LABEL_GAP;
