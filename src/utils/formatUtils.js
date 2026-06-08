export function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).filter(Boolean).join('').toUpperCase().slice(0, 2) || '?'
}
