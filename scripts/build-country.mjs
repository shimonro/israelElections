#!/usr/bin/env node
// Builds the app's data for a country from countries/<code>/source.json and raw.json.
//
//   node scripts/build-country.mjs <code>
//
// Writes src/countries/<code>/data.json and meta.json, and lists every problem to fix in
// source.json (unknown parties or blocs, seat totals that do not add up, missing leaders).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { withStandardBlocs } from './lib/blocs.mjs'
import { metaOf } from './lib/meta.mjs'

const code = process.argv[2]
if (!code) {
  console.error('Usage: node scripts/build-country.mjs <code>')
  process.exit(1)
}
const source = JSON.parse(readFileSync(`countries/${code}/source.json`, 'utf8'))
const { results, credits } = JSON.parse(readFileSync(`countries/${code}/raw.json`, 'utf8'))
const problems = []
const notes = []
// Parties moved to a standard bloc the country did not list yet bring that bloc along.
const blocs = withStandardBlocs(source.blocs, new Set(Object.values(source.parties).map((p) => p.bloc)))
const keys = source.elections.map((e) => e.key ?? String(e.year))
// One key may cover several titles of one party, never two different parties.
const itemOfKey = {}
for (const [title, p] of Object.entries(source.parties)) {
  if (!p.wikidata) continue
  const other = itemOfKey[p.key]
  if (other && other.wikidata !== p.wikidata) problems.push(`Parties "${other.title}" and "${title}" share the key "${p.key}"; give one another key`)
  itemOfKey[p.key] ??= { wikidata: p.wikidata, title }
}
// Up to this share of a chamber may be missing from Wikipedia's table (vacancies, tiny parties)
// and is shown as "Others"; a bigger gap needs a fix in source.json.
const MAX_GAP = source.maxGap ?? 0.05

const terms = source.governments.map((g, i) => {
  const key = String(g.election)
  const r = results[key]
  if (!r) return problems.push(`Government ${i + 1}: no election "${key}" in raw.json`)
  // `fixes` corrects what the Wikipedia table got wrong: { "2002": { "Party": seats } }.
  const rows = r.rows.map((x) => ({ ...x }))
  for (const [party, seats] of Object.entries(source.fixes?.[key] ?? {})) {
    const row = rows.find((x) => x.link === party)
    if (row) row.seats = seats
    else rows.push({ link: party, seats })
  }
  const merged = new Map()
  for (const row of rows.filter((x) => x.seats > 0)) {
    const p = source.parties[row.link]
    if (!p) {
      problems.push(`${key}: party "${row.link}" is not in parties (run fetch-country.mjs again)`)
      continue
    }
    const bloc = p.blocByYear?.[key] ?? p.bloc
    if (!blocs.some((b) => b.key === bloc)) problems.push(`Party "${row.link}" has bloc ${JSON.stringify(bloc)}, not one of ${blocs.map((b) => b.key)}`)
    const prev = merged.get(p.key)
    if (prev) prev.seats += row.seats
    else merged.set(p.key, { id: p.key, name: p.name, seats: row.seats, bloc, ...(p.color && { color: p.color }) })
  }
  let total = [...merged.values()].reduce((a, p) => a + p.seats, 0)
  // More seats than the infobox states usually means members it leaves out (such as West
  // Berlin's non-voting members of the Bundestag); trust the table.
  if (total > r.seats) notes.push(`${key}: the table has ${total} seats, the infobox ${r.seats}; using ${total}`)
  const gap = Math.max(0, (r.seats || total) - total)
  if (gap > 0 && gap <= MAX_GAP * r.seats) {
    if (!blocs.some((b) => b.key === 'other')) blocs.splice(blocs.length, 0, ...withStandardBlocs([], ['other']))
    merged.set('others', { id: 'others', name: { en: 'Others' }, seats: gap, bloc: 'other' })
    notes.push(`${key}: ${gap} of ${r.seats} seats not in Wikipedia's table, shown as "Others"`)
    total += gap
  } else if (gap) {
    problems.push(`${key}: parties add up to ${total} seats, but the chamber has ${r.seats}; add a fix`)
  }
  if (!source.pms[g.pm]) problems.push(`Government ${i + 1} (${g.year}): leader ${JSON.stringify(g.pm)} is not in pms`)
  const e = keys.indexOf(key)
  const nextYear = source.elections[e + 1]?.year
  return {
    term: source.termStart ? source.termStart + e : `${source.elections[e].year}–${nextYear ?? ''}`,
    // Only countries that name their governments show one; null means none was formed.
    ...('label' in g && { government: g.label }),
    year: g.year,
    pm: g.pm,
    ...(g.note && { note: g.note }),
    seats: total,
    results: [...merged.values()].sort((a, b) => b.seats - a.seats),
  }
})

const image = (base) => ['jpg', 'png', 'webp', 'gif'].map((ext) => `${base}.${ext}`).find((f) => existsSync(`public${f}`))
const pms = {}
for (const key of new Set(source.governments.map((g) => g.pm))) {
  const pm = source.pms[key]
  if (!pm) continue
  const photo = image(`/countries/${code}/pm/${key}`)
  // A leader without a free photo shows initials; add public/countries/<code>/pm/<key>.jpg to replace them.
  if (!photo) notes.push(`No photo for ${pm.wiki ?? key}; showing initials (add public/countries/${code}/pm/${key}.jpg)`)
  pms[key] = { name: pm.name, ...(photo && { photo }) }
}

if (problems.length) {
  console.error(`${problems.length} problem(s) in countries/${code}/source.json:\n- ${[...new Set(problems)].join('\n- ')}`)
  process.exit(1)
}
for (const n of new Set(notes)) console.log(`note: ${n}`)

// Keep only blocs some term uses, so the legend has no empty entries.
const usedBlocs = new Set(terms.flatMap((t) => t.results.map((p) => p.bloc)))
const data = {
  meta: {
    code,
    slug: source.slug,
    name: source.name,
    languages: source.languages,
    emblem: image(`/countries/${code}/emblem`) ?? null,
  },
  chamber: source.chamber,
  termLabel: source.termLabel,
  ...(source.leaderTitle && { leaderTitle: source.leaderTitle }),
  blocs: blocs.filter((b) => usedBlocs.has(b.key)),
  pms,
  terms,
  sources: source.sources,
  credits: Object.entries(credits ?? {})
    .filter(([key]) => pms[key])
    .map(([key, c]) => `${source.pms[key]?.name?.en ?? key}: ${c.author}, ${c.license}, via Wikimedia Commons`),
}
mkdirSync(`src/countries/${code}`, { recursive: true })
writeFileSync(`src/countries/${code}/data.json`, JSON.stringify(data, null, 1) + '\n')
writeFileSync(`src/countries/${code}/meta.json`, JSON.stringify(metaOf(data)) + '\n')
console.log(`Wrote src/countries/${code}/data.json: ${terms.length} terms, ${terms[0].year}–${terms[terms.length - 1].year}`)
