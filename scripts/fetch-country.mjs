#!/usr/bin/env node
// Fetches a country's election results, party names and colors, and PM photos from Wikipedia.
//
//   node scripts/fetch-country.mjs <code> ["<latest election article>"] [--from <year>] [--lang <code>]
//
// The first run creates countries/<code>/source.json, walking back from the latest election
// article through each infobox's "previous election" link. Later runs refresh the results and
// add any new parties, keeping everything already edited by hand. Then run build-country.mjs.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { api, commonsCredit, electionChain, electionResults, langTitles, leadImages, wikitext } from './lib/wiki.mjs'

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(`--${name}`)
  return i < 0 ? undefined : args.splice(i, 2)[1]
}
const from = Number(flag('from') ?? 0)
const langArg = flag('lang')
const [code, latest] = args
if (!code) {
  console.error('Usage: node scripts/fetch-country.mjs <code> ["<latest election article>"] [--from <year>] [--lang <code>]')
  process.exit(1)
}

const dir = `countries/${code}`
const sourcePath = `${dir}/source.json`
const rawPath = `${dir}/raw.json`
mkdirSync(dir, { recursive: true })
const source = existsSync(sourcePath) ? JSON.parse(readFileSync(sourcePath, 'utf8')) : null
const lang = langArg ?? source?.languages?.[1]
if (!source && (!latest || !lang)) {
  console.error('First run: pass the latest election article and --lang <native language code>.')
  process.exit(1)
}

// 1. Elections: the list in source.json, or the infobox chain back from the latest one.
let elections = source?.elections
if (!elections || latest) {
  elections = []
  for (let title = latest; title; ) {
    const { title: t, text } = await wikitext(title)
    const year = Number(t.match(/\d{4}/)?.[0])
    if (year < from) break
    elections.unshift({ year, wiki: t })
    title = electionChain(text).previous
  }
  console.log(`Found ${elections.length} elections: ${elections.map((e) => e.year).join(', ')}`)
}

// 2. Results of every election.
const raw = {}
for (const e of elections) {
  const { text } = await wikitext(e.wiki)
  const chain = electionChain(text)
  const { source: table, rows } = electionResults(text)
  const total = rows.reduce((a, r) => a + r.seats, 0)
  raw[e.year] = { wiki: e.wiki, date: chain.date, seats: chain.seats || total, majority: chain.majority, after: chain.after, table, rows }
  const gap = chain.seats && chain.seats !== total ? `  ⚠ parsed ${total} of ${chain.seats} seats` : ''
  console.log(`${e.year}: ${rows.length} parties, ${total} seats (${table})${gap}`)
}

// 3. Parties: native names and Wikipedia colors for any party not yet in source.json.
const parties = source?.parties ?? {}
const seen = [...new Set(Object.values(raw).flatMap((r) => r.rows.map((x) => x.link)))]
const fresh = seen.filter((p) => !parties[p])
if (fresh.length) {
  const native = await langTitles(fresh, lang)
  for (const p of fresh) {
    const color = await partyColor(p)
    parties[p] = { key: slug(p), name: { en: p.replace(/\s*\([^)]*\)$/, ''), [lang]: native[p] ?? p }, bloc: null, ...(color && { color }) }
  }
  console.log(`Added ${fresh.length} parties; give each a bloc in ${sourcePath}: ${fresh.join('; ')}`)
}

// 4. Governments: one per election to start with, from the infobox's "government after election".
const governments =
  source?.governments ??
  elections.map((e) => ({ year: e.year, election: e.year, label: raw[e.year].after, pm: null }))

const next = {
  code,
  slug: source?.slug ?? code,
  name: source?.name ?? { en: code, [lang]: code },
  languages: source?.languages ?? ['en', lang],
  chamber: source?.chamber ?? { en: 'Parliament', [lang]: '' },
  termLabel: source?.termLabel ?? { en: 'Term', [lang]: '' },
  emblem: source?.emblem ?? { wiki: '' },
  blocs: source?.blocs ?? [{ key: 'left', name: { en: 'Left', [lang]: '' }, hue: 0 }],
  pms: source?.pms ?? {},
  sources: source?.sources ?? [{ label: 'Wikipedia', url: `https://en.wikipedia.org/wiki/${encodeURIComponent(latest ?? '')}` }],
  ...source,
  elections,
  governments,
  parties,
}

// 5. Photos: each PM's and the emblem's lead image from Wikipedia, with credits.
const publicDir = `public/countries/${code}`
mkdirSync(`${publicDir}/pm`, { recursive: true })
const pmTitles = Object.values(next.pms).map((p) => p.wiki).filter(Boolean)
const missingNative = Object.values(next.pms).filter((p) => p.wiki && !p.name?.[lang])
if (missingNative.length) {
  const native = await langTitles(missingNative.map((p) => p.wiki), lang)
  for (const p of missingNative) p.name = { en: p.wiki.replace(/\s*\([^)]*\)$/, ''), ...p.name, [lang]: native[p.wiki] ?? p.wiki }
}
const images = pmTitles.length ? await leadImages([...pmTitles, next.emblem.wiki].filter(Boolean)) : {}
const credits = {}
for (const [key, pm] of Object.entries(next.pms)) {
  const img = images[pm.wiki]
  const have = ['jpg', 'png', 'webp'].some((ext) => existsSync(`${publicDir}/pm/${key}.${ext}`))
  if (!img) {
    if (!have) console.log(`⚠ No photo for ${pm.wiki}; add ${publicDir}/pm/${key}.jpg by hand`)
    continue
  }
  if (!have) await download(img.url, `${publicDir}/pm/${key}`)
  credits[key] = { file: img.file, ...(await commonsCredit(img.file)) }
}
if (next.emblem.wiki && images[next.emblem.wiki] && !['jpg', 'png', 'webp'].some((ext) => existsSync(`${publicDir}/emblem.${ext}`)))
  await download(images[next.emblem.wiki].url, `${publicDir}/emblem`)

writeFileSync(sourcePath, JSON.stringify(next, null, 2) + '\n')
writeFileSync(rawPath, JSON.stringify({ results: raw, credits }, null, 1) + '\n')
console.log(`Wrote ${sourcePath} and ${rawPath}`)

async function partyColor(title) {
  const data = await api({ action: 'expandtemplates', prop: 'wikitext', text: `{{party color|${title}}}` })
  const c = data.expandtemplates.wikitext.replace('&#35;', '#').trim()
  return /^#?[0-9a-f]{6}$/i.test(c) && !/f8f9fa/i.test(c) ? (c.startsWith('#') ? c : `#${c}`) : null
}

function slug(s) {
  return s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/** Saves an image as <base>.jpg, .png or .webp, matching what the server sent. */
async function download(url, base) {
  const res = await fetch(url, { headers: { 'User-Agent': 'elections-history-bot/1.0' } })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  const ext = { 'image/png': 'png', 'image/webp': 'webp' }[res.headers.get('content-type')] ?? 'jpg'
  writeFileSync(`${base}.${ext}`, Buffer.from(await res.arrayBuffer()))
}
