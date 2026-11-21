import { existsSync } from 'node:fs'
import { expect, test } from 'vitest'
import { TOTAL_SEATS, blocs, pms, termSlug, terms } from './data'

test('every term seats exactly 120 members in known blocs', () => {
  for (const t of terms) {
    expect(t.results.reduce((a, p) => a + p.seats, 0), termSlug(t)).toBe(TOTAL_SEATS)
    for (const p of t.results) expect(blocs[p.bloc], `${termSlug(t)} ${p.en}`).toBeDefined()
  }
})

test('terms are chronological with unique deep links', () => {
  for (let i = 1; i < terms.length; i++) {
    expect(terms[i].year).toBeGreaterThanOrEqual(terms[i - 1].year)
    expect(terms[i].knesset).toBeGreaterThanOrEqual(terms[i - 1].knesset)
  }
  expect(new Set(terms.map(termSlug)).size).toBe(terms.length)
})

test('every prime minister has a photo', () => {
  for (const t of terms) {
    expect(pms[t.pm], termSlug(t)).toBeDefined()
    expect(existsSync(`public${pms[t.pm].photo}`), pms[t.pm].photo).toBe(true)
  }
})
