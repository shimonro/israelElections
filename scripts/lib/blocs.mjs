// The standard left-right blocs that parties get from their Wikidata alignment, in seating order.
export const STANDARD_BLOCS = [
  { key: 'far-left', name: { en: 'Far-left' }, hue: 340, color: '#9f1239' },
  { key: 'left', name: { en: 'Left' }, hue: 0, color: '#dc2626' },
  { key: 'centre-left', name: { en: 'Centre-left' }, hue: 12, color: '#f87171' },
  { key: 'centre', name: { en: 'Centre' }, hue: 48, color: '#eab308' },
  { key: 'centre-right', name: { en: 'Centre-right' }, hue: 200, color: '#38bdf8' },
  { key: 'right', name: { en: 'Right' }, hue: 222, color: '#2563eb' },
  { key: 'far-right', name: { en: 'Far-right' }, hue: 262, color: '#7c3aed' },
  { key: 'other', name: { en: 'Other' }, color: '#94a3b8' },
]
const order = STANDARD_BLOCS.map((b) => b.key)

/** `blocs` plus any standard bloc that `used` needs, each inserted at its place on the scale. */
export function withStandardBlocs(blocs, used) {
  const out = [...blocs]
  for (const key of used) {
    if (out.some((b) => b.key === key)) continue
    const std = STANDARD_BLOCS.find((b) => b.key === key)
    if (!std) continue
    const after = out.findIndex((b) => order.includes(b.key) && order.indexOf(b.key) > order.indexOf(key))
    out.splice(after < 0 ? out.length : after, 0, std)
  }
  return out
}
