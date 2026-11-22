// Wikidata helpers: entities, labels, and SPARQL queries.
import { api, resolver } from './wiki.mjs'

const WD = 'https://www.wikidata.org/w/api.php'
const SPARQL = 'https://query.wikidata.org/sparql'

/** Entities by id, 50 at a time. */
export async function entities(ids, props = 'claims|labels|sitelinks') {
  const out = {}
  const unique = [...new Set(ids.filter(Boolean))]
  for (let i = 0; i < unique.length; i += 50) {
    const data = await api({ action: 'wbgetentities', ids: unique.slice(i, i + 50).join('|'), props }, WD)
    Object.assign(out, data.entities)
  }
  return out
}

/** Wikidata ids of English Wikipedia articles (following redirects), keyed by the title asked for. */
export async function qidsOf(titles) {
  const out = {}
  const unique = [...new Set(titles.filter(Boolean))]
  for (let i = 0; i < unique.length; i += 50) {
    const data = await api({ action: 'query', prop: 'pageprops', ppprop: 'wikibase_item', titles: unique.slice(i, i + 50).join('|') })
    const resolve = resolver(data)
    const byTitle = Object.fromEntries(data.query.pages.map((p) => [p.title, p.pageprops?.wikibase_item]))
    for (const t of unique.slice(i, i + 50)) if (byTitle[resolve(t)]) out[t] = byTitle[resolve(t)]
  }
  return out
}

export async function sparql(query) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${SPARQL}?query=${encodeURIComponent(query)}`, {
      headers: { Accept: 'application/sparql-results+json', 'User-Agent': 'elections-history-bot/1.0 (https://github.com/shimonro/israelelections)' },
    })
    if (res.ok) return (await res.json()).results.bindings
    if (attempt >= 4) throw new Error(`SPARQL ${res.status}`)
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
  }
}

export const claimIds = (entity, prop) =>
  (entity?.claims?.[prop] ?? [])
    .filter((c) => c.rank !== 'deprecated')
    .sort((a, b) => (b.rank === 'preferred') - (a.rank === 'preferred'))
    .map((c) => c.mainsnak.datavalue?.value)
    .map((v) => (typeof v === 'object' && v?.id ? v.id : v))
    .filter(Boolean)

export const label = (entity, lang) => entity?.labels?.[lang]?.value ?? entity?.labels?.mul?.value ?? null

/**
 * Everyone who held `officeId`, as non-overlapping terms { qid, start, end } in date order.
 * Terms shorter than `minDays` (acting holders) and terms starting inside another term
 * (data errors) are dropped; consecutive terms of one person are merged.
 */
export async function officeHolders(officeId, minDays = 30) {
  const rows = await sparql(`SELECT ?p ?start ?end WHERE {
    ?p p:P39 ?st. ?st ps:P39 wd:${officeId}; pq:P580 ?start. OPTIONAL { ?st pq:P582 ?end }
  } ORDER BY ?start`)
  const day = (t) => t?.slice(0, 10)
  let terms = rows.map((r) => ({ qid: r.p.value.split('/').pop(), start: day(r.start.value), end: day(r.end?.value) ?? null }))
  terms = terms.filter((t) => !t.end || (Date.parse(t.end) - Date.parse(t.start)) / 864e5 >= minDays)
  const inside = (t) =>
    terms.some((o) => o !== t && o.qid !== t.qid && o.start < t.start && o.end && Date.parse(t.start) < Date.parse(o.end) - 30 * 864e5)
  terms = terms.filter((t) => !inside(t))
  const merged = []
  for (const t of terms.sort((a, b) => a.start.localeCompare(b.start))) {
    const prev = merged[merged.length - 1]
    if (prev?.qid === t.qid) prev.end = t.end
    else merged.push({ ...t })
  }
  return merged
}

/** Political alignment of a party (Wikidata P1387) as one bloc on a left-right scale. */
export const ALIGNMENTS = ['far-left', 'left', 'centre-left', 'centre', 'centre-right', 'right', 'far-right']
/** Maps a Wikidata alignment label ("centre-left", "right-wing extremism", "big tent"...) to a bloc. */
export function alignmentOf(text) {
  const t = text?.toLowerCase().replace(/center/g, 'centre').replace(/\s+politics$/, '').trim()
  if (!t) return null
  if (/^(far[- ]left|radical left|left-wing (extremism|radicalism|populism))/.test(t)) return 'far-left'
  if (/^(far[- ]right|radical right|right-wing (extremism|radicalism|populism)|extreme right)/.test(t)) return 'far-right'
  if (/^centre[- ]left/.test(t)) return 'centre-left'
  if (/^centre[- ]right/.test(t)) return 'centre-right'
  if (/^(centre|centrism|radical centrism|big tent|syncretic)/.test(t)) return 'centre'
  if (/^left(-wing)?$/.test(t)) return 'left'
  if (/^right(-wing)?$/.test(t)) return 'right'
  return null
}

/** A party's bloc: its first alignment that maps to one (Wikidata lists the main one first). */
export function alignmentBloc(labels) {
  for (const l of labels) {
    const b = alignmentOf(l)
    if (b) return b
  }
  return null
}

/** Fallback for parties without an alignment: their first ideology (Wikidata P1142) that implies one. */
const IDEOLOGIES = [
  ['far-left', /^(communism|marxism|marxism.leninism|trotskyism|maoism|anarchism|anti-capitalism)$/],
  ['left', /^(democratic socialism|socialism|eco-socialism|left-wing populism|libertarian socialism)$/],
  ['centre-left', /^(social democracy|green politics|social liberalism|progressivism|third way)$/],
  ['centre', /^(liberalism|centrism|agrarianism|radical centrism|big tent|pro-europeanism)$/],
  ['centre-right', /^(christian democracy|conservatism|liberal conservatism|conservative liberalism|economic liberalism|classical liberalism)$/],
  ['right', /^(national conservatism|nationalism|right-wing populism|national liberalism|social conservatism)$/],
  ['far-right', /^(neo-nazism|fascism|ultranationalism|neo-fascism|white nationalism)$/],
]
export function ideologyBloc(labels) {
  for (const l of labels) {
    const t = l?.toLowerCase()
    const hit = IDEOLOGIES.find(([, re]) => re.test(t ?? ''))
    if (hit) return hit[0]
  }
  return null
}
