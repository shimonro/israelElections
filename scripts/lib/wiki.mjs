// Small helpers for reading Wikipedia election articles through the MediaWiki API.
const API = 'https://en.wikipedia.org/w/api.php'
const HEADERS = { 'User-Agent': 'elections-history-bot/1.0 (https://github.com/shimonro/israelelections)' }

export async function api(params, base = API) {
  const url = new URL(base)
  const defaults = base === API ? { redirects: '1' } : {}
  for (const [k, v] of Object.entries({ format: 'json', formatversion: '2', ...defaults, ...params }))
    if (v !== null && v !== undefined) url.searchParams.set(k, v)
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: HEADERS })
    const body = res.ok ? await res.json() : null
    if (body && !body.error) return body
    // Wikimedia throttles bursts (429); other errors are final.
    const retry = res.status === 429 || res.status >= 500 || ['maxlag', 'ratelimited'].includes(body?.error?.code)
    if (!retry || attempt >= 6) throw new Error(`${res.status} ${body?.error?.info ?? ''} ${url}`)
    const wait = Number(res.headers.get('retry-after')) || 2 ** attempt
    await new Promise((r) => setTimeout(r, wait * 1000))
  }
}

/** Runs `fn` over `items` with at most `limit` calls at once, keeping order. */
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i], i)
      }
    }),
  )
  return out
}

export async function wikitext(title) {
  const data = await api({ action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', titles: title })
  const page = data.query.pages[0]
  if (page.missing) throw new Error(`No Wikipedia article "${title}"`)
  return { title: page.title, text: page.revisions[0].slots.main.content }
}

/** Finds `{{Name ...}}` (name may be a regex alternation) and returns its parameters, splitting only on top-level pipes. */
export function template(rawText, name) {
  const text = rawText.replace(/<!--[\s\S]*?-->/g, '')
  const start = text.search(new RegExp(`\\{\\{\\s*(?:${name})\\s*[|\\n]`, 'i'))
  if (start < 0) return null
  let depth = 0
  let i = start
  const parts = []
  let current = ''
  for (; i < text.length; i++) {
    const two = text.slice(i, i + 2)
    if (two === '{{' || two === '[[') {
      depth++
      if (depth > 1) current += two
      i++
      continue
    }
    if (two === '}}' || two === ']]') {
      depth--
      if (depth === 0) break
      current += two
      i++
      continue
    }
    if (text[i] === '|' && depth === 1) {
      parts.push(current)
      current = ''
      continue
    }
    current += text[i]
  }
  parts.push(current)
  const params = {}
  for (const part of parts.slice(1)) {
    const eq = part.indexOf('=')
    if (eq > 0) params[part.slice(0, eq).trim()] = part.slice(eq + 1).trim()
  }
  return params
}

/** Removes references, footnotes and markup, keeping a link's target as `link`. */
export function clean(value = '') {
  let v = value
    .replace(/<ref[^>]*\/>/g, '')
    .replace(/<ref[\s\S]*?<\/ref>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
  // Drop nested templates such as {{efn|...}}, innermost first.
  while (/\{\{[^{}]*\}\}/.test(v)) v = v.replace(/\{\{[^{}]*\}\}/g, '')
  const link = v.match(/\[\[([^\]|#]+)/)?.[1]?.trim() ?? null
  const textValue = v
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/'''?/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim()
  return { text: textValue, link }
}

const num = (v) => {
  const m = clean(v).text.replace(/(\d),(\d{3})/g, '$1$2').match(/\d+/)
  return m ? parseInt(m[0], 10) : 0
}

/** Numbers n for which `params` has a `<prefix>n` key, ascending (rows may skip numbers). */
const rowNumbers = (params, prefixes) =>
  [...new Set(Object.keys(params).map((k) => k.match(new RegExp(`^(?:${prefixes})(\\d+)$`))?.[1]).filter(Boolean))]
    .map(Number)
    .sort((a, b) => a - b)

/**
 * One result row. `link` identifies the party: its article, or the row's text for joint lists,
 * which keep their member articles in `parts`. Names written as templates (such as
 * {{Canadian party colour|CA|Liberal|name}}) keep the markup in `template` to expand later.
 */
function row(raw, seats) {
  const { text: name, link } = clean(raw)
  const links = [...raw.replace(/\{\{[^{}]*\}\}/g, '').matchAll(/\[\[([^\]|#]+)/g)].map((m) => m[1].trim())
  const out = { name, link: links.length === 1 && link ? link : name, seats }
  if (links.length > 1) out.parts = links
  if (!name && /\{\{/.test(raw)) out.template = raw.trim()
  return out
}

/** Seats per party from an article's {{Election results}} table, falling back to the infobox. */
export function electionResults(text) {
  const table = template(text, 'Election results')
  const rows = []
  if (table) {
    // Extra seat columns are named seattype1, seattype2...; one of them may already be the total.
    const types = Object.keys(table).filter((k) => /^seattype\d+$/.test(k)).map((k) => k.slice(8))
    const totalType = types.find((k) => /total/i.test(table[`seattype${k}`]))
    for (const n of rowNumbers(table, 'party|alliance')) {
      const seats = totalType
        ? num(table[`st${totalType}t${n}`])
        : table[`totseats${n}`] !== undefined
          ? num(table[`totseats${n}`])
          : num(table[`seats${n}`]) + num(table[`seats${n}_2`]) + num(table[`seats${n}_3`]) +
            types.reduce((a, k) => a + num(table[`st${k}t${n}`]), 0)
      const r = row(table[`party${n}`] ?? table[`alliance${n}`], seats)
      if (r.name || r.template) rows.push(r)
    }
  }
  if (rows.some((r) => r.seats > 0)) return { source: 'Election results', rows: rows.filter((r) => r.seats > 0) }
  const box = template(text, INFOBOX) ?? {}
  for (const n of rowNumbers(box, 'party')) {
    const seats = num(box[`seats${n}`] ?? box[`seats_after${n}`])
    const r = row(box[`alliance${n}`] || box[`party${n}`], seats)
    if (seats > 0 && (r.name || r.template)) rows.push(r)
  }
  return { source: 'Infobox election', rows }
}

export const INFOBOX = 'Infobox (?:legislative )?election'

/** What an election's infobox says: neighbouring elections, date, chamber and its size. */
export function electionChain(text) {
  const box = template(text, INFOBOX) ?? {}
  const linkOf = (v) => (v ? (clean(v).link ?? (clean(v).text || null)) : null)
  // "All [[...|650 seats]] in the [[House of Commons of the United Kingdom|House of Commons]]"
  const seatsText = box.seats_for_election ?? ''
  const chamberLinks = [...seatsText.matchAll(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g)].filter((m) => !/\d/.test(m[2] ?? m[1]))
  const chamber = chamberLinks[0] ? { link: chamberLinks[0][1].trim(), text: (chamberLinks[0][2] ?? chamberLinks[0][1]).trim() } : null
  return {
    previous: linkOf(box.previous_election),
    next: linkOf(box.next_election),
    date: parseDate(box.election_date),
    seats: num(seatsText),
    majority: num(box.majority_seats),
    chamber,
    country: clean(box.country).text || null,
    after: linkOf(box.after_election),
  }
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

/** ISO date of an election, from "{{Start date|2017|09|24}}", "4 July 2024" or "July 4, 2024"; the last round if several. */
export function parseDate(value = '') {
  const tpl = [...value.matchAll(/\{\{\s*(?:start date|election date|date)[^}]*?\|\s*(\d{4})\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})/gi)]
  const pad = (n) => String(n).padStart(2, '0')
  if (tpl.length) {
    const m = tpl[tpl.length - 1]
    return `${m[1]}-${pad(m[2])}-${pad(m[3])}`
  }
  const t = clean(value).text.toLowerCase()
  const found = []
  for (const m of t.matchAll(/(\d{1,2})(?:[–-]\d{1,2})?\s+([a-z]+)\s+(\d{4})/g)) found.push([m[3], m[2], m[1]])
  for (const m of t.matchAll(/([a-z]+)\s+(\d{1,2}),?\s+(\d{4})/g)) found.push([m[3], m[1], m[2]])
  const dates = found
    .filter(([, mon]) => MONTHS.includes(mon))
    .map(([y, mon, d]) => `${y}-${pad(MONTHS.indexOf(mon) + 1)}-${pad(d)}`)
    .sort()
  if (dates.length) return dates[dates.length - 1]
  const year = t.match(/\d{4}/)?.[0]
  return year ? `${year}-01-01` : null
}

/**
 * Finds the election before `title` when its infobox does not link one, by searching for
 * titles with the same wording and an earlier year, such as "1987 West German federal election"
 * before "1990 German federal election".
 */
export async function previousByTitle(title, from = 0) {
  const year = Number(title.match(/\d{4}/)?.[0])
  const wording = title.replace(/^.*?\d{4}\s*/, '').replace(/\s*\(.*\)$/, '')
  if (!year || !wording) return null
  const data = await api({ action: 'query', list: 'search', srsearch: `intitle:"${wording}"`, srlimit: '100', srnamespace: '0' })
  const candidates = data.query.search
    .map((r) => r.title)
    .filter((t) => t.endsWith(wording) && !/(results|opinion|polling|list|candidates|by[- ]election|referendum|primary|leadership)/i.test(t))
    .map((t) => ({ t, y: Number(t.match(/^(?:\w+ )?(\d{4})/)?.[1]) }))
    .filter((c) => c.y && c.y < year && c.y >= from)
    .sort((a, b) => b.y - a.y)
  return candidates[0]?.t ?? null
}

/** Maps a title as asked to the page title the API answered with, through normalization and redirects. */
export function resolver(data) {
  const forward = Object.fromEntries([...(data.query.normalized ?? []), ...(data.query.redirects ?? [])].map((r) => [r.from, r.to]))
  return (title) => {
    let t = title
    for (let i = 0; i < 5 && forward[t]; i++) t = forward[t]
    return t
  }
}

/** Title of the same article in another language edition, such as the Hungarian name of a party. */
export async function langTitles(titles, lang) {
  const out = {}
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50)
    const data = await api({ action: 'query', prop: 'langlinks', lllang: lang, lllimit: 'max', titles: batch.join('|') })
    const resolve = resolver(data)
    const byTitle = Object.fromEntries(data.query.pages.map((p) => [p.title, p.langlinks?.[0]?.title]))
    for (const t of batch) if (byTitle[resolve(t)]) out[t] = byTitle[resolve(t)].replace(/\s*\([^)]*\)$/, '')
  }
  return out
}

/** License and author of a Commons file, for photo credits. */
export async function commonsCredit(file) {
  const data = await api(
    { action: 'query', prop: 'imageinfo', iiprop: 'extmetadata', titles: `File:${file}` },
    'https://commons.wikimedia.org/w/api.php',
  )
  const meta = data.query.pages[0]?.imageinfo?.[0]?.extmetadata ?? {}
  const strip = (s = '') => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  return { author: strip(meta.Artist?.value) || 'Unknown', license: strip(meta.LicenseShortName?.value) || 'see Commons' }
}
