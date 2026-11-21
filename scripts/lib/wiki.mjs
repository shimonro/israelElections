// Small helpers for reading Wikipedia election articles through the MediaWiki API.
const API = 'https://en.wikipedia.org/w/api.php'
const HEADERS = { 'User-Agent': 'elections-history-bot/1.0 (https://github.com/shimonro/israelelections)' }

export async function api(params, base = API) {
  const url = new URL(base)
  for (const [k, v] of Object.entries({ format: 'json', formatversion: '2', redirects: '1', ...params }))
    url.searchParams.set(k, v)
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: HEADERS })
    if (res.ok) return res.json()
    if (attempt >= 3) throw new Error(`${res.status} ${url}`)
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
  }
}

export async function wikitext(title) {
  const data = await api({ action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', titles: title })
  const page = data.query.pages[0]
  if (page.missing) throw new Error(`No Wikipedia article "${title}"`)
  return { title: page.title, text: page.revisions[0].slots.main.content }
}

/** Finds `{{Name ...}}` and returns its parameters, splitting only on top-level pipes. */
export function template(text, name) {
  const start = text.search(new RegExp(`\\{\\{\\s*${name}\\s*[|\\n]`, 'i'))
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

/** Seats per party from an article's {{Election results}} table, falling back to the infobox. */
export function electionResults(text) {
  const table = template(text, 'Election results')
  const rows = []
  if (table) {
    // Extra seat columns are named seattype1, seattype2...; one of them may already be the total.
    const types = Object.keys(table).filter((k) => /^seattype\d+$/.test(k)).map((k) => k.slice(8))
    const totalType = types.find((k) => /total/i.test(table[`seattype${k}`]))
    const numbers = [...new Set(Object.keys(table).map((k) => k.match(/^(?:party|alliance)(\d+)$/)?.[1]).filter(Boolean))]
    for (const n of numbers.map(Number).sort((a, b) => a - b)) {
      const raw = table[`party${n}`] ?? table[`alliance${n}`]
      const { text: name, link } = clean(raw)
      const seats = totalType
        ? num(table[`st${totalType}t${n}`])
        : table[`totseats${n}`] !== undefined
          ? num(table[`totseats${n}`])
          : num(table[`seats${n}`]) + num(table[`seats${n}_2`]) + num(table[`seats${n}_3`]) +
            types.reduce((a, k) => a + num(table[`st${k}t${n}`]), 0)
      // A row naming several parties (a joint candidacy) keeps its own name rather than its first link.
      const links = (raw.match(/\[\[/g) ?? []).length
      if (name) rows.push({ name, link: links === 1 && link ? link : name, seats })
    }
  }
  if (rows.some((r) => r.seats > 0)) return { source: 'Election results', rows: rows.filter((r) => r.seats > 0) }
  const box = template(text, 'Infobox election') ?? {}
  for (let n = 1; box[`party${n}`] !== undefined; n++) {
    const { text: name, link } = clean(box[`alliance${n}`] || box[`party${n}`])
    const seats = num(box[`seats${n}`] ?? box[`seats_after${n}`])
    if (seats > 0) rows.push({ name, link: link ?? name, seats })
  }
  return { source: 'Infobox election', rows }
}

/** Links an election infobox gives for the previous and next elections. */
export function electionChain(text) {
  const box = template(text, 'Infobox election') ?? {}
  const linkOf = (v) => (v ? clean(v).link ?? clean(v).text : null)
  return {
    previous: linkOf(box.previous_election),
    next: linkOf(box.next_election),
    date: clean(box.election_date).text,
    seats: num(box.seats_for_election),
    majority: num(box.majority_seats),
    after: clean(box.after_election).link ?? clean(box.after_election).text,
  }
}

/** Title of the same article in another language edition, such as the Hungarian name of a party. */
export async function langTitles(titles, lang) {
  const out = {}
  for (let i = 0; i < titles.length; i += 50) {
    const data = await api({ action: 'query', prop: 'langlinks', lllang: lang, lllimit: 'max', titles: titles.slice(i, i + 50).join('|') })
    const redirects = Object.fromEntries((data.query.redirects ?? []).map((r) => [r.to, r.from]))
    const normalized = Object.fromEntries((data.query.normalized ?? []).map((r) => [r.to, r.from]))
    for (const page of data.query.pages) {
      const original = normalized[redirects[page.title] ?? page.title] ?? redirects[page.title] ?? page.title
      const t = page.langlinks?.[0]?.title
      if (t) out[original] = t.replace(/\s*\([^)]*\)$/, '')
    }
  }
  return out
}

/** Lead image of each article, as a thumbnail URL with its Commons file name. */
export async function leadImages(titles, size = 330) {
  const data = await api({ action: 'query', prop: 'pageimages', piprop: 'thumbnail|name', pithumbsize: String(size), titles: titles.join('|') })
  const redirects = Object.fromEntries((data.query.redirects ?? []).map((r) => [r.to, r.from]))
  const out = {}
  for (const page of data.query.pages)
    if (page.thumbnail) out[redirects[page.title] ?? page.title] = { url: page.thumbnail.source, file: page.pageimage }
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
