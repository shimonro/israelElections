#!/usr/bin/env node
// Builds the app's data file for a country from countries/<code>/source.json and raw.json.
//
//   node scripts/build-country.mjs <code>
//
// Writes src/countries/<code>/data.json and meta.json, and lists every problem to fix in source.json
// (parties without a bloc, seat totals that do not add up, missing prime ministers or photos).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { metaOf } from './lib/meta.mjs'

const code = process.argv[2]
if (!code) {
  console.error('Usage: node scripts/build-country.mjs <code>')
  process.exit(1)
}
const source = JSON.parse(readFileSync(`countries/${code}/source.json`, 'utf8'))
const { results, credits } = JSON.parse(readFileSync(`countries/${code}/raw.json`, 'utf8'))
const problems = []
const blocKeys = new Set(source.blocs.map((b) => b.key))
const years = source.elections.map((e) => e.year)

const terms = source.governments.map((g, i) => {
  const r = results[g.election]
  if (!r) return problems.push(`Government ${i + 1}: no election ${g.election} in raw.json`)
  // `fixes` corrects what the Wikipedia table got wrong: { "2002": { "Party": seats } }.
  const rows = r.rows.map((x) => ({ ...x }))
  for (const [party, seats] of Object.entries(source.fixes?.[g.election] ?? {})) {
    const row = rows.find((x) => x.link === party)
    if (row) row.seats = seats
    else rows.push({ link: party, seats })
  }
  const merged = new Map()
  for (const row of rows.filter((x) => x.seats > 0)) {
    const p = source.parties[row.link]
    if (!p) {
      problems.push(`${g.election}: party "${row.link}" is not in parties`)
      continue
    }
    const bloc = p.blocByYear?.[g.election] ?? p.bloc
    if (!blocKeys.has(bloc)) problems.push(`Party "${row.link}" has bloc ${JSON.stringify(bloc)}, not one of ${[...blocKeys]}`)
    const prev = merged.get(p.key)
    if (prev) prev.seats += row.seats
    else merged.set(p.key, { id: p.key, name: p.name, seats: row.seats, bloc, ...(p.color && { color: p.color }) })
  }
  const list = [...merged.values()].sort((a, b) => b.seats - a.seats)
  const total = list.reduce((a, p) => a + p.seats, 0)
  if (r.seats && total !== r.seats) problems.push(`${g.election}: parties add up to ${total} seats, but the chamber has ${r.seats}; add a fix`)
  if (!source.pms[g.pm]) problems.push(`Government ${i + 1} (${g.year}): prime minister ${JSON.stringify(g.pm)} is not in pms`)
  const e = years.indexOf(g.election)
  return {
    term: source.termStart ? source.termStart + e : `${g.election}–${years[e + 1] ?? ''}`,
    government: g.label ?? null,
    year: g.year,
    pm: g.pm,
    ...(g.note && { note: g.note }),
    seats: total,
    results: list,
  }
})

const image = (base) => ['jpg', 'png', 'webp'].map((ext) => `${base}.${ext}`).find((f) => existsSync(`public${f}`))
const pms = {}
for (const [key, pm] of Object.entries(source.pms)) {
  const photo = image(`/countries/${code}/pm/${key}`)
  if (!photo) problems.push(`No photo public/countries/${code}/pm/${key}.jpg for ${pm.wiki ?? key}`)
  pms[key] = { name: pm.name, photo }
}

if (problems.length) {
  console.error(`${problems.length} problem(s) in countries/${code}/source.json:\n- ${[...new Set(problems)].join('\n- ')}`)
  process.exit(1)
}

const data = {
  meta: {
    code,
    slug: source.slug,
    name: source.name,
    languages: source.languages,
    emblem: image(`/countries/${code}/emblem`) ?? null,
    years: [terms[0].year, terms[terms.length - 1].year],
  },
  chamber: source.chamber,
  termLabel: source.termLabel,
  blocs: source.blocs,
  pms,
  terms,
  sources: source.sources,
  credits: Object.entries(credits ?? {}).map(
    ([key, c]) => `${source.pms[key]?.name?.en ?? key}: ${c.author}, ${c.license}, via Wikimedia Commons`,
  ),
}
mkdirSync(`src/countries/${code}`, { recursive: true })
writeFileSync(`src/countries/${code}/data.json`, JSON.stringify(data, null, 1) + '\n')
writeFileSync(`src/countries/${code}/meta.json`, JSON.stringify(metaOf(data)) + '\n')
console.log(`Wrote src/countries/${code}/data.json: ${terms.length} terms, ${data.meta.years.join('–')}`)
