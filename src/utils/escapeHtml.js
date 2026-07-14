// Escape user-supplied text before interpolating it into email HTML so that
// names, notes, and descriptions can't inject markup or break the layout.
export function escapeHtml(value) {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Same as escapeHtml but turns newlines into <br/> for multi-line fields
// (e.g. ticket descriptions) after escaping.
export function escapeHtmlMultiline(value) {
  return escapeHtml(value).replace(/\n/g, '<br/>')
}
