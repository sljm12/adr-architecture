import type { Component } from '../domain/types';
import { getComponentTypeLabel } from '../domain/c4';

export function wrapExportText(value: string, width: number): string[] {
  const available = Math.max(32, width - 28);
  // Conservative font metrics include wide ASCII and full-width Unicode glyphs.
  const measure = (text: string) => Array.from(text).reduce((size, character) => size + (/\p{Mark}/u.test(character) ? 0 : /\s/u.test(character) ? 5 : /[MW@#%&]/.test(character) ? 14 : character.codePointAt(0)! > 127 ? 16 : 8), 0);
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
export const containerLabelLines = (component: Component, width: number) => [getComponentTypeLabel(component), component.name, component.description, component.technology ? `Technology: ${component.technology}` : null].filter((text): text is string => Boolean(text)).flatMap(text => wrapExportText(text, width));
