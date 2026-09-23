const escapedCharacters: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapes a text or attribute value for HTML and XML output. */
export function escapeMarkup(value: string): string {
  return value.replace(/[&<>"']/g, character => escapedCharacters[character]);
}

/** Keeps authored newlines readable while preserving them as plain text. */
export function renderPlainText(value: string): string {
  return escapeMarkup(value).replace(/\r\n|\r|\n/g, '<br>');
}

export function hasValidXmlCharacters(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    if (codePoint === 0x9 || codePoint === 0xa || codePoint === 0xd) continue;
    if (codePoint < 0x20 || (codePoint >= 0xd800 && codePoint <= 0xdfff) || codePoint === 0xfffe || codePoint === 0xffff || codePoint > 0x10ffff) return false;
  }
  return true;
}
