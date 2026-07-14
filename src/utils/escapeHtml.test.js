import { escapeHtml, escapeHtmlMultiline } from './escapeHtml'

test('escapes HTML-significant characters', () => {
  expect(escapeHtml(`<script>alert("x&y")</script>`))
    .toBe('&lt;script&gt;alert(&quot;x&amp;y&quot;)&lt;/script&gt;')
})

test('escapes single quotes', () => {
  expect(escapeHtml("O'Brien")).toBe('O&#39;Brien')
})

test('null and undefined become empty string', () => {
  expect(escapeHtml(null)).toBe('')
  expect(escapeHtml(undefined)).toBe('')
})

test('non-string values are coerced', () => {
  expect(escapeHtml(42)).toBe('42')
})

test('multiline turns newlines into <br/> after escaping', () => {
  expect(escapeHtmlMultiline('a\n<b>')).toBe('a<br/>&lt;b&gt;')
})
