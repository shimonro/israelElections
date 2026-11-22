/** Text in several languages, keyed by language code ("en", "he", "hu"...). */
export type Text = Record<string, string>

export interface Party {
  id: string | number
  name: Text
  seats: number
  bloc: string
  /** Party color; parties without one get a shade of their bloc's hue. */
  color?: string
}

export interface Term {
  /** Parliament number (such as Knesset 26) or span (such as "2022–2026"). */
  term: number | string
  /** Government number or name; null when none was formed; absent for countries that do not name governments. */
  government?: number | string | Text | null
  year: number
  pm: string
  note?: Text
  seats: number
  results: Party[]
}

export interface Bloc {
  key: string
  name?: Text
  hue?: number
  color?: string
}

export interface CountryMeta {
  code: string
  slug: string
  name: Text
  languages: string[]
  emblem: string | null
  years: [number, number]
  chamber: Text
  blocs: Bloc[]
  latest: { year: number; seats: number; results: Party[] }
}

export interface Country {
  meta: Omit<CountryMeta, 'years' | 'chamber' | 'blocs' | 'latest'>
  chamber: Text
  termLabel: Text
  /** Title of the head of government, such as "Chancellor"; defaults to Prime Minister. */
  leaderTitle?: Text
  /** Ordered across the political spectrum, as seated in the hemicycle. */
  blocs: Bloc[]
  pms: Record<string, { name: Text; photo?: string }>
  terms: Term[]
  sources: { label: string; url: string }[]
  credits: string[]
}

// Every folder in src/countries is a country: meta.json loads up front, data.json on demand.
const metaFiles = import.meta.glob<CountryMeta>('./countries/*/meta.json', { eager: true, import: 'default' })
const dataFiles = import.meta.glob<Country>('./countries/*/data.json', { import: 'default' })

export const countries = Object.values(metaFiles).sort((a, b) => a.name.en.localeCompare(b.name.en))

export const loadCountry = (code: string) => dataFiles[`./countries/${code}/data.json`]()

export const RTL = new Set(['he', 'ar', 'fa', 'ur', 'yi'])

export const tr = (text: Text | undefined, lang: string) => (text ? (text[lang] ?? text.en ?? Object.values(text)[0]) : '')

export const majorityOf = (seats: number) => Math.floor(seats / 2) + 1

export function blocColor(blocs: Bloc[], key: string) {
  const b = blocs.find((x) => x.key === key)
  return b?.color ?? `hsl(${b?.hue ?? 0} 70% 52%)`
}

/** A party keeps one color in every term: its own, or a stable shade of its bloc's hue. */
export function partyColor(blocs: Bloc[], p: Party) {
  if (p.color) return readable(p.color)
  const b = blocs.find((x) => x.key === p.bloc)
  if (b?.color && b.hue === undefined) return b.color
  let h = typeof p.id === 'number' ? (p.id * 2654435761) >>> 0 : 0
  if (typeof p.id === 'string') {
    for (const c of p.id) h = Math.imul(h ^ c.charCodeAt(0), 2654435761) >>> 0
    h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0
  }
  return `hsl(${(b?.hue ?? 0) + ((h >>> 16) % 17) - 8} ${58 + ((h >>> 8) % 28)}% ${38 + (h % 29)}%)`
}

/** Lightens colors too dark to see on the dark background, such as the CDU's black. */
function readable(color: string) {
  const m = color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) return color
  const [r, g, b] = m.slice(1).map((h) => parseInt(h, 16))
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  if (luminance >= 0.18) return color
  const mix = (c: number) => Math.round(c + (255 - c) * 0.45)
  return `rgb(${mix(r)} ${mix(g)} ${mix(b)})`
}

export function bySpectrum(blocs: Bloc[], results: Party[]) {
  const order = blocs.map((b) => b.key)
  return [...results].sort((a, b) => order.indexOf(a.bloc) - order.indexOf(b.bloc) || b.seats - a.seats)
}

/** Deep link for a term: its year, plus a counter when a year has several terms ("1969", "1969-2"). */
export function termSlugs(terms: Term[]) {
  const count = new Map<number, number>()
  return terms.map((t) => {
    const n = (count.get(t.year) ?? 0) + 1
    count.set(t.year, n)
    return n === 1 ? String(t.year) : `${t.year}-${n}`
  })
}
