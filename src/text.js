const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const escapeHTML = value => String(value).replace(/[&<>"']/g, ch => ENTITIES[ch]);

// Card text uses the library's markup: *italic*, **bold**, ***bold italic***, {symbol}, blank
// lines between paragraphs, and "*Name*." opening a leader ability.
export function renderCardText(text) {
  return escapeHTML(text)
    .split(/\n\s*\n/)
    .map(paragraph => `<p>${renderInline(paragraph.trim())}</p>`)
    .join('');
}

function renderInline(text) {
  return text
    .replace(/\{(\w+)\}/g, '<span class="sym">$1</span>')
    .replace(/^\*([^*]+)\*\./, '<span class="ability">$1.</span>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}
