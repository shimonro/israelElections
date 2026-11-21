import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { metaOf } from '../scripts/lib/meta.mjs'
import type { Country } from './data'

const codes = readdirSync('src/countries')
const read = (code: string, file: string) => JSON.parse(readFileSync(`src/countries/${code}/${file}`, 'utf8'))

test('every country folder has data', () => {
  expect(codes).toEqual(expect.arrayContaining(['hu', 'il']))
})

describe.each(codes)('%s', (code) => {
  const data: Country = read(code, 'data.json')
  const blocs = new Set(data.blocs.map((b) => b.key))

  test('every term seats its whole chamber in known blocs', () => {
    for (const t of data.terms) {
      expect(t.results.reduce((a, p) => a + p.seats, 0), `${t.year}`).toBe(t.seats)
      for (const p of t.results) expect(blocs.has(p.bloc), `${t.year} ${p.id} bloc ${p.bloc}`).toBe(true)
      expect(new Set(t.results.map((p) => p.id)).size, `${t.year} duplicate party`).toBe(t.results.length)
    }
  })

  test('terms are in chronological order', () => {
    const years = data.terms.map((t) => t.year)
    expect(years).toEqual([...years].sort((a, b) => a - b))
  })

  test('every prime minister has a photo', () => {
    for (const t of data.terms) {
      expect(data.pms[t.pm], `${t.year} ${t.pm}`).toBeDefined()
      expect(existsSync(`public${data.pms[t.pm].photo}`), data.pms[t.pm].photo).toBe(true)
    }
  })

  test('meta.json is up to date (run scripts/write-meta.mjs)', () => {
    expect(read(code, 'meta.json')).toEqual(metaOf(data))
  })
})
