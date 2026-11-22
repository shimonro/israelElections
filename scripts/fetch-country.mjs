#!/usr/bin/env node
// Fetches a country's elections from Wikipedia and its heads of government, party alignments,
// names and images from Wikidata, into countries/<code>/source.json and raw.json.
//
//   node scripts/fetch-country.mjs <code> "<latest election article>" [--from <year>] [--lang <code>]
//   node scripts/fetch-country.mjs <code>      (refresh: re-reads the elections listed in source.json)
//
// Anything already in source.json is kept, so hand edits survive; fields that are missing are
// filled in. Delete a field (such as "governments") to have it generated again. Then run
// build-country.mjs. See docs/adding-a-country.md.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { api, clean, commonsCredit, electionChain, electionResults, langTitles, mapLimit, previousByTitle, wikitext } from './lib/wiki.mjs'
import { STANDARD_BLOCS } from './lib/blocs.mjs'
import { ALIGNMENTS, alignmentBloc, claimIds, ideologyBloc, entities, label, officeHolders, qidsOf } from './lib/wikidata.mjs'

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(`--${name}`)
  return i < 0 ? undefined : args.splice(i, 2)[1]
}
const fromArg = flag('from')
const langArg = flag('lang')
const [code, latest] = args
if (!code) {
  console.error('Usage: node scripts/fetch-country.mjs <code> ["<latest election article>"] [--from <year>] [--lang <code>]')
  process.exit(1)
}
const dir = `countries/${code}`
const sourcePath = `${dir}/source.json`
const publicDir = `public/countries/${code}`
mkdirSync(dir, { recursive: true })
mkdirSync(`${publicDir}/pm`, { recursive: true })
const source = existsSync(sourcePath) ? JSON.parse(readFileSync(sourcePath, 'utf8')) : {}
if (!source.elections && !latest) {
  console.error('First run: pass the latest election article.')
  process.exit(1)
}
const from = Number(fromArg ?? source.from ?? 1945)
const warn = (msg) => console.log(`⚠ ${msg}`)


// 1. Elections: walk back from the latest through each infobox's "previous election" link,
//    falling back to a title search where the chain breaks.
let elections = source.elections
if (!elections || latest) {
  const found = []
  const seen = new Set()
  for (let title = latest; title && !seen.has(title); ) {
    seen.add(title)
    const page = await wikitext(title)
    const year = Number(page.title.match(/\d{4}/)?.[0])
    if (year < from) break
    found.unshift({ year, wiki: page.title })
    const chain = electionChain(page.text)
    title = chain.previous ?? (await previousByTitle(page.title, from))
  }
  elections = found
  console.log(`Found ${elections.length} elections: ${elections.map((e) => e.year).join(', ')}`)
}

// 2. Results. Two elections in one year get keys "1974" and "1974-2".
const results = {}
let latestChain
const pages = await mapLimit(elections, 4, (e) => wikitext(e.wiki))
for (const [i, e] of elections.entries()) {
  const { text } = pages[i]
  const chain = electionChain(text)
  latestChain = chain
  const { source: table, rows } = electionResults(text)
  // Party names written as templates are expanded by Wikipedia itself.
  for (const r of rows.filter((x) => x.template)) Object.assign(r, await expandRow(r.template), { template: undefined })
  e.date ??= chain.date
  const total = rows.reduce((a, r) => a + r.seats, 0)
  e.key ??= results[String(e.year)] ? `${e.year}-2` : String(e.year)
  results[e.key] = { wiki: e.wiki, date: chain.date, seats: chain.seats || total, table, rows, chamber: chain.chamber }
  const gap = chain.seats && chain.seats !== total ? `  (infobox says ${chain.seats} seats)` : ''
  console.log(`${e.key}: ${rows.length} parties, ${total} seats (${table})${gap}`)
}

// 3. The country, from the latest infobox: languages, head-of-government office, emblem.
const countryTitle = source.countryWiki ?? latestChain.country ?? latest?.replace(/^\d{4}\s+/, '').split(' ')[0]
const countryQid = source.wikidata ?? (await qidsOf([countryTitle]))[countryTitle]
if (!countryQid) throw new Error(`No Wikidata item for country "${countryTitle}"; set "countryWiki" in ${sourcePath}`)
const country = (await entities([countryQid]))[countryQid]
let languages = source.languages
if (!languages) {
  // Official languages of the whole country only: statements limited to a region or part
  // (qualifiers "applies to part" P518, "applies to jurisdiction" P1001, "valid in place" P3005) are skipped.
  const national = (country.claims.P37 ?? [])
    .filter((c) => c.rank !== 'deprecated' && !['P518', 'P1001', 'P3005'].some((q) => c.qualifiers?.[q]))
    .map((c) => c.mainsnak.datavalue?.value?.id)
  const langItems = await entities(national, 'claims')
  const codes = Object.values(langItems).flatMap((l) => claimIds(l, 'P424').slice(0, 1))
  languages = ['en', ...new Set((langArg ? [langArg] : codes).filter((c) => c && c !== 'en'))].slice(0, 3)
}
const native = languages.filter((l) => l !== 'en')
const officeQid = source.office ?? claimIds(country, 'P1313')[0]
const office = officeQid ? (await entities([officeQid], 'labels'))[officeQid] : null
// "Chancellor of Germany" → "Chancellor"; "President of the United States" → "President".
const shortTitle = (s) => s?.replace(/\s*\(.*\)$/, '').replace(/\s+(of|von|van|de|du|des|der|i|av|för|af)\s+.*$/i, '')
const textIn = (fn) => Object.fromEntries(languages.map((l) => [l, fn(l)]).filter(([, v]) => v))

// 4. Heads of government, and one government per election plus one per change of leader.
const holders = officeQid ? await officeHolders(officeQid) : []
const firstDate = elections[0].date ?? `${elections[0].year}-01-01`
const relevant = holders.filter((h) => !h.end || h.end > firstDate)
const people = await entities(relevant.map((h) => h.qid), 'claims|labels|sitelinks')
const pms = source.pms ?? {}
const keyOfQid = {}
for (const h of relevant) {
  const person = people[h.qid]
  const en = label(person, 'en') ?? h.qid
  const existing = Object.entries(pms).find(([, p]) => p.wikidata === h.qid || p.wiki === person?.sitelinks?.enwiki?.title)
  const key = existing?.[0] ?? slug(en)
  keyOfQid[h.qid] = key
  pms[key] = {
    wiki: person?.sitelinks?.enwiki?.title,
    wikidata: h.qid,
    image: claimIds(person, 'P18')[0],
    ...pms[key],
    name: { ...textIn((l) => label(person, l) ?? (l === 'en' ? en : null)), ...pms[key]?.name },
  }
}

let governments = source.governments
if (!governments) {
  const events = [
    ...elections.map((e) => ({ date: e.date ?? `${e.year}-01-01`, election: e.key })),
    ...relevant.filter((h) => h.start >= firstDate).map((h) => ({ date: h.start, holder: h })),
  ].sort((a, b) => a.date.localeCompare(b.date))
  const holderAt = (date) => [...relevant].reverse().find((h) => h.start <= date)
  governments = []
  let election = null
  for (const ev of events) {
    if (ev.election) election = ev.election
    if (!election) continue
    const holder = ev.holder ?? holderAt(ev.date)
    if (!holder) continue
    const prev = governments[governments.length - 1]
    const g = { year: Number(ev.date.slice(0, 4)), date: ev.date, election, pm: keyOfQid[holder.qid] }
    if (prev && prev.pm === g.pm && prev.election === g.election) continue
    // A new leader taking office soon after an election replaces the caretaker shown for it.
    if (ev.holder && prev && prev.election === election && prev.pm !== g.pm && days(prev.date, ev.date) < 150 && prev.fromElection) {
      governments[governments.length - 1] = g
      continue
    }
    governments.push({ ...g, fromElection: !ev.holder })
  }
  governments = governments.map(({ fromElection, ...g }) => g)
  if (!holders.length) warn(`No heads of government found for office ${officeQid}; fill "governments" and "pms" by hand`)
}

// 5. Parties: native names, colors, and a bloc from Wikidata's political alignment.
const parties = source.parties ?? {}
const seen = [...new Set(Object.values(results).flatMap((r) => r.rows.map((x) => x.link)))]
const fresh = seen.filter((p) => !parties[p])
const blocNames = {}
if (fresh.length) {
  const qids = await qidsOf(fresh)
  const items = await entities(Object.values(qids), 'claims|labels')
  const alignIds = Object.values(items).flatMap((i) => [...claimIds(i, 'P1387'), ...claimIds(i, 'P1142')])
  const aligns = await entities(alignIds, 'labels')
  const nativeNames = native[0] ? await langTitles(fresh, native[0]) : {}
  // Titles that are the same party (one Wikidata item, such as "Die Linke" and "The Left (Germany)") share a key.
  const keyOfItem = Object.fromEntries(Object.values(parties).filter((p) => p.wikidata).map((p) => [p.wikidata, p.key]))
  // Different parties with one name, such as Portugal's 1979 and 2024 "Democratic Alliance", keep the qualifier in their keys.
  const taken = new Set(Object.values(parties).map((p) => p.key))
  const freshKey = (title) => {
    for (const key of [slug(title), slug(title.replace(/[()]/g, ' '))]) if (!taken.has(key)) return key
    let n = 2
    while (taken.has(`${slug(title)}-${n}`)) n++
    return `${slug(title)}-${n}`
  }
  for (const p of fresh) {
    const qid = qids[p]
    const item = items[qid]
    const bloc = qid
      ? (alignmentBloc(claimIds(item, 'P1387').map((id) => label(aligns[id], 'en'))) ??
        ideologyBloc(claimIds(item, 'P1142').map((id) => label(aligns[id], 'en'))))
      : await jointBloc(p)
    const color = (await partyColor(p)) ?? hexColor(claimIds(item, 'P465')[0])
    const key = (qid && keyOfItem[qid]) || freshKey(p)
    if (qid) keyOfItem[qid] ??= key
    taken.add(key)
    parties[p] = {
      key,
      ...(qid && { wikidata: qid }),
      name: textIn((l) => (l === 'en' ? p.replace(/\s*\([^)]*\)$/, '') : (label(item, l) ?? nativeNames[p] ?? null))),
      bloc: bloc ?? 'other',
      ...(color && { color }),
    }
    if (!bloc) warn(`Party "${p}" has no political alignment or telling ideology on Wikidata; set its bloc (now "other")`)
  }
  console.log(`Added ${fresh.length} parties`)
}
/** A joint list sits where its member parties sit on average, such as Norway's "Farmers–Conservatives". */
async function jointBloc(name) {
  const members = Object.values(results).flatMap((r) => r.rows).find((x) => x.link === name)?.parts
  if (!members) return null
  const ids = await qidsOf(members)
  const items = await entities(Object.values(ids), 'claims')
  const al = await entities(Object.values(items).flatMap((i) => [...claimIds(i, 'P1387'), ...claimIds(i, 'P1142')]), 'labels')
  const blocs = Object.values(items)
    .map((i) => alignmentBloc(claimIds(i, 'P1387').map((id) => label(al[id], 'en'))) ?? ideologyBloc(claimIds(i, 'P1142').map((id) => label(al[id], 'en'))))
    .filter(Boolean)
  if (!blocs.length) return null
  return ALIGNMENTS[Math.round(blocs.reduce((a, b) => a + ALIGNMENTS.indexOf(b), 0) / blocs.length)]
}

if (!source.blocs && native.length) {
  // Native bloc names from the standard articles, such as "Centre-left politics".
  const titles = { 'far-left': 'Far-left politics', left: 'Left-wing politics', 'centre-left': 'Centre-left politics', centre: 'Centrism', 'centre-right': 'Centre-right politics', right: 'Right-wing politics', 'far-right': 'Far-right politics' }
  const qids = await qidsOf(Object.values(titles))
  const items = await entities(Object.values(qids), 'labels')
  for (const [bloc, title] of Object.entries(titles)) blocNames[bloc] = textIn((l) => label(items[qids[title]], l))
}

// 6. Images: each head of government's Wikidata photo and the country's coat of arms, with credits.
const credits = {}
// Without a Wikidata photo, use the article's lead image on any of the country's Wikipedias,
// but only a free one on Commons (local uploads are often fair use).
for (const [key, pm] of Object.entries(pms)) {
  if (pm.image || image(`${publicDir}/pm/${key}`)) continue
  const person = people[pm.wikidata]
  for (const l of languages) {
    const title = person?.sitelinks?.[`${l}wiki`]?.title
    if (!title) continue
    const page = (await api({ action: 'query', prop: 'pageimages', piprop: 'name', pilicense: 'free', titles: title }, `https://${l}.wikipedia.org/w/api.php`)).query.pages[0]
    if (!page?.pageimage) continue
    const file = (await api({ action: 'query', prop: 'imageinfo', titles: `File:${page.pageimage}` }, 'https://commons.wikimedia.org/w/api.php')).query.pages[0]
    if (file && !file.missing) {
      pm.image = page.pageimage.replace(/_/g, ' ')
      break
    }
  }
}
for (const [key, pm] of Object.entries(pms)) {
  const have = image(`${publicDir}/pm/${key}`)
  if (!have && pm.image) await download(filePath(pm.image, 330), `${publicDir}/pm/${key}`)
  else if (!have) warn(`No photo for ${pm.wiki ?? key}; add ${publicDir}/pm/${key}.jpg by hand`)
}
await mapLimit(Object.entries(pms).filter(([, pm]) => pm.image), 4, async ([key, pm]) => {
  credits[key] = { file: pm.image, ...(await commonsCredit(pm.image)) }
})
const arms = source.emblemFile ?? claimIds(country, 'P94')[0]
if (arms && !image(`${publicDir}/emblem`)) await download(filePath(arms, 160), `${publicDir}/emblem`)

// 7. Labels. The chamber and the head of government's title come from the infobox and Wikidata.
const chamber = latestChain.chamber
const chamberNative = chamber && native.length ? await langTitles([chamber.link], native[0]) : {}
const used = new Set(Object.values(parties).map((p) => p.bloc))
const next = {
  code,
  slug: source.slug ?? slug(label(country, 'en') ?? code),
  name: source.name ?? textIn((l) => label(country, l)),
  languages,
  from,
  wikidata: countryQid,
  office: officeQid,
  chamber: source.chamber ?? textIn((l) => (l === 'en' ? chamber?.text : chamberNative[chamber?.link])),
  termLabel: source.termLabel ?? { en: 'Term' },
  leaderTitle: source.leaderTitle ?? textIn((l) => shortTitle(label(office, l))),
  blocs:
    source.blocs ??
    STANDARD_BLOCS.filter((b) => used.has(b.key)).map((b) => ({ ...b, name: { ...blocNames[b.key], en: b.name.en } })),
  sources: source.sources ?? [{ label: 'Wikipedia', url: `https://en.wikipedia.org/wiki/${encodeURIComponent(elections.at(-1).wiki.replaceAll(' ', '_'))}` }],
  ...source,
  elections,
  governments,
  pms,
  parties,
}
writeFileSync(sourcePath, JSON.stringify(next, null, 2) + '\n')
writeFileSync(`${dir}/raw.json`, JSON.stringify({ results, credits }, null, 1) + '\n')
console.log(`Wrote ${sourcePath} (${governments.length} governments, ${Object.keys(pms).length} leaders) and ${dir}/raw.json`)

function days(a, b) {
  return (Date.parse(b) - Date.parse(a)) / 864e5
}

async function expandRow(markup) {
  const expanded = (expandRow.cache ??= new Map())
  if (!expanded.has(markup)) {
    const data = await api({ action: 'expandtemplates', prop: 'wikitext', text: markup })
    const { text: name, link } = clean(data.expandtemplates.wikitext)
    expanded.set(markup, { name, link: link ?? name })
  }
  return expanded.get(markup)
}

async function partyColor(title) {
  const data = await api({ action: 'expandtemplates', prop: 'wikitext', text: `{{party color|${title}}}` })
  const c = data.expandtemplates.wikitext.replace('&#35;', '#').trim()
  return /^#?[0-9a-f]{6}$/i.test(c) && !/f8f9fa/i.test(c) ? (c.startsWith('#') ? c : `#${c}`) : null
}

function hexColor(v) {
  return typeof v === 'string' && /^[0-9a-f]{6}$/i.test(v) ? `#${v}` : null
}

function slug(s) {
  return s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function image(base) {
  return ['jpg', 'png', 'webp', 'gif'].map((ext) => `${base}.${ext}`).find((f) => existsSync(f))
}

function filePath(file, width) {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width}`
}

/** Saves an image as <base>.jpg, .png or .webp, matching what the server sent. */
async function download(url, base) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': 'elections-history-bot/1.0 (https://github.com/shimonro/israelelections)' } })
    if (res.ok) {
      const ext = { 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[res.headers.get('content-type')] ?? 'jpg'
      writeFileSync(`${base}.${ext}`, Buffer.from(await res.arrayBuffer()))
      return
    }
    if (attempt >= 4) return warn(`Could not download ${url} (${res.status})`)
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt))
  }
}
