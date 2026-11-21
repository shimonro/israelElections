import raw from './data/elections.json'

export type Lang = 'en' | 'he'
export type Text = Record<Lang, string>

export interface Party {
  id: number
  en: string
  he: string
  seats: number
  bloc: number
}

export interface Term {
  knesset: number
  /** null when no government was formed after the election (yet). */
  government: number | null
  year: number
  pm: string
  note?: Text
  results: Party[]
}

export interface PrimeMinister extends Text {
  photo: string
}

export const pms: Record<string, PrimeMinister> = raw.pms
export const terms: Term[] = raw.terms

export const TOTAL_SEATS = 120
export const MAJORITY = 61

export const blocs: { name: Text; hue: number }[] = [
  { name: { en: 'Centre', he: 'מרכז' }, hue: 185 },
  { name: { en: 'Religious', he: 'דתיים' }, hue: 38 },
  { name: { en: 'Right', he: 'ימין' }, hue: 224 },
  { name: { en: 'Sectorial', he: 'סקטוריאלית' }, hue: 275 },
  { name: { en: 'Arab', he: 'ערבית' }, hue: 140 },
  { name: { en: 'Left', he: 'שמאל' }, hue: 0 },
]

/** Blocs ordered across the political spectrum, as seated in the hemicycle. */
export const blocOrder = [4, 5, 0, 3, 1, 2]

export const blocColor = (bloc: number) => `hsl(${blocs[bloc].hue} 70% 52%)`

/** A party keeps one shade of its bloc's hue in every Knesset. */
export function partyColor(p: Party) {
  const h = (p.id * 2654435761) >>> 0
  const light = 38 + (h % 29)
  const sat = 58 + ((h >>> 8) % 28)
  return `hsl(${blocs[p.bloc].hue + ((h >>> 16) % 17) - 8} ${sat}% ${light}%)`
}

export function bySpectrum(results: Party[]) {
  return [...results].sort(
    (a, b) => blocOrder.indexOf(a.bloc) - blocOrder.indexOf(b.bloc) || b.seats - a.seats,
  )
}

/** Stable, readable hash for deep links, such as "1969-k6-g14" or "2026-k26". */
export const termSlug = (t: Term) =>
  `${t.year}-k${t.knesset}${t.government ? `-g${t.government}` : ''}`
