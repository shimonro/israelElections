import { useEffect, useMemo, useRef, useState } from 'react'
import { blocColor, partyColor, tr } from './data'
import type { Country } from './data'
import { ui } from './i18n'

type Mode = 'bloc' | 'party'
type View = 'lines' | 'stack'

interface Series {
  id: string
  name: string
  color: string
  /** Share of the chamber (0–100) in each term; null where the series has no seats. */
  values: (number | null)[]
}

/** Parties below this peak share are grouped as "other parties" so the chart stays readable. */
const MIN_PEAK = 3
const PAD = { top: 12, right: 12, bottom: 26, left: 36 }

export default function HistoryChart({
  country,
  index,
  lang,
  onSelect,
}: {
  country: Country
  index: number
  lang: string
  onSelect: (i: number) => void
}) {
  const s = ui(lang)
  const { terms, blocs } = country
  const [mode, setMode] = useState<Mode>('bloc')
  const [view, setView] = useState<View>('stack')
  const [hover, setHover] = useState<number | null>(null)
  const [focus, setFocus] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(800)
  const height = Math.max(220, Math.min(340, width * 0.42))

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const series = useMemo<Series[]>(() => {
    const share = (seats: number, i: number) => (seats > 0 ? (seats / terms[i].seats) * 100 : null)
    if (mode === 'bloc')
      return blocs.map((b) => ({
        id: b.key,
        name: tr(b.name, lang),
        color: blocColor(blocs, b.key),
        values: terms.map((t, i) => share(t.results.filter((p) => p.bloc === b.key).reduce((a, p) => a + p.seats, 0), i)),
      }))
    const byId = new Map<string, { party: Country['terms'][number]['results'][number]; values: (number | null)[] }>()
    terms.forEach((t, i) =>
      t.results.forEach((p) => {
        const id = String(p.id)
        const entry = byId.get(id) ?? { party: p, values: terms.map(() => null) }
        entry.party = p
        entry.values[i] = share(p.seats, i)
        byId.set(id, entry)
      }),
    )
    const order = blocs.map((b) => b.key)
    const major = [...byId.entries()].filter(([, e]) => Math.max(...e.values.map((v) => v ?? 0)) >= MIN_PEAK)
    const majorIds = new Set(major.map(([id]) => id))
    const rest = terms.map((t, i) => share(t.results.filter((p) => !majorIds.has(String(p.id))).reduce((a, p) => a + p.seats, 0), i))
    return [
      ...major
        .sort(([, a], [, b]) => order.indexOf(a.party.bloc) - order.indexOf(b.party.bloc))
        .map(([id, e]) => ({ id, name: tr(e.party.name, lang), color: partyColor(blocs, e.party), values: e.values })),
      ...(rest.some(Boolean) ? [{ id: '_rest', name: s.otherParties, color: '#64748b', values: rest }] : []),
    ]
  }, [mode, terms, blocs, lang, s.otherParties])

  // x: each term at its year; several terms in one year are spread across it.
  const xs = useMemo(() => {
    const seen = new Map<number, number>()
    return terms.map((t) => {
      const n = seen.get(t.year) ?? 0
      seen.set(t.year, n + 1)
      return t.year + n * 0.4
    })
  }, [terms])
  const x0 = xs[0]
  const x1 = xs[xs.length - 1] + Math.max(1, (xs[xs.length - 1] - x0) / 40)
  const yMax = view === 'stack' ? 100 : Math.min(100, Math.ceil(Math.max(...series.flatMap((r) => r.values.map((v) => v ?? 0))) / 10) * 10 || 10)
  const W = width - PAD.left - PAD.right
  const H = height - PAD.top - PAD.bottom
  const X = (v: number) => PAD.left + ((v - x0) / (x1 - x0)) * W
  const Y = (v: number) => PAD.top + H - (v / yMax) * H
  const end = (i: number) => (i + 1 < xs.length ? xs[i + 1] : x1)

  const paths = (() => {
    if (view === 'stack') {
      const base = terms.map(() => 0)
      return series.map((r) => {
        const lower = [...base]
        r.values.forEach((v, i) => (base[i] += v ?? 0))
        const top = base.map((v, i) => `${i ? 'L' : 'M'}${X(xs[i])},${Y(v)}H${X(end(i))}`).join('')
        const bottom = lower.map((v, i) => `L${X(end(i))},${Y(v)}H${X(xs[i])}`).reverse().join('')
        return { r, d: `${top}${bottom}Z` }
      })
    }
    return series.map((r) => {
      let d = ''
      r.values.forEach((v, i) => {
        if (v === null) return
        const prev = i > 0 ? r.values[i - 1] : null
        d += `${prev === null ? 'M' : 'L'}${X(xs[i])},${Y(v)}H${X(end(i))}`
      })
      return { r, d }
    })
  })()

  const termAt = (clientX: number) => {
    const rect = box.current!.getBoundingClientRect()
    const v = x0 + ((clientX - rect.left - PAD.left) / W) * (x1 - x0)
    let i = 0
    while (i + 1 < xs.length && xs[i + 1] <= v) i++
    return i
  }

  const shown = hover ?? index
  const lastYear = terms[terms.length - 1].year
  const ticks = Array.from({ length: 6 }, (_, k) => Math.round(x0 + ((lastYear - x0) * k) / 5))
  const tip = hover !== null && (
    <div className="history-tip" style={{ left: Math.min(X(xs[hover]) + 12, width - 190) }}>
      <strong>
        {terms[hover].year} · {tr(country.pms[terms[hover].pm]?.name, lang)}
      </strong>
      {series
        .map((r) => ({ r, v: r.values[hover] }))
        .filter((e) => e.v)
        .sort((a, b) => b.v! - a.v!)
        .slice(0, 8)
        .map(({ r, v }) => (
          <span key={r.id}>
            <i style={{ background: r.color }} />
            {r.name} <b>{v!.toFixed(1)}%</b>
          </span>
        ))}
    </div>
  )

  return (
    <section className="card wide history">
      <div className="history-head">
        <h2>{s.history}</h2>
        <div className="segmented" role="group" aria-label={s.history}>
          <button aria-pressed={mode === 'bloc'} onClick={() => setMode('bloc')}>
            {s.byBloc}
          </button>
          <button aria-pressed={mode === 'party'} onClick={() => setMode('party')}>
            {s.byParty}
          </button>
        </div>
        <div className="segmented" role="group">
          <button aria-pressed={view === 'lines'} onClick={() => setView('lines')}>
            {s.lines}
          </button>
          <button aria-pressed={view === 'stack'} onClick={() => setView('stack')}>
            {s.stacked}
          </button>
        </div>
      </div>
      <div
        className="history-plot"
        ref={box}
        dir="ltr"
        onPointerMove={(e) => setHover(termAt(e.clientX))}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => onSelect(termAt(e.clientX))}
      >
        <svg width={width} height={height} role="img" aria-label={`${s.history}: ${s.share}`}>
          {[0, 25, 50, 75, 100]
            .filter((v) => v <= yMax)
            .map((v) => (
              <g key={v}>
                <line x1={PAD.left} x2={width - PAD.right} y1={Y(v)} y2={Y(v)} className="grid" />
                <text x={PAD.left - 6} y={Y(v) + 4} className="axis" textAnchor="end">
                  {v}%
                </text>
              </g>
            ))}
          {ticks.map((t) => (
            <text key={t} x={X(t)} y={height - 8} className="axis" textAnchor={t === lastYear ? 'end' : 'middle'}>
              {t}
            </text>
          ))}
          {paths.map(({ r, d }) => (
            <path
              key={r.id}
              d={d}
              className={view === 'stack' ? 'area' : 'line'}
              style={{
                fill: view === 'stack' ? r.color : 'none',
                stroke: view === 'stack' ? 'none' : r.color,
                opacity: focus && focus !== r.id ? 0.15 : 1,
              }}
            />
          ))}
          {yMax >= 50 && <line x1={PAD.left} x2={width - PAD.right} y1={Y(50)} y2={Y(50)} className="grid half" />}
          <line x1={X(xs[shown])} x2={X(xs[shown])} y1={PAD.top} y2={PAD.top + H} className="cursor" />
          <rect x={X(xs[index])} y={PAD.top} width={Math.max(2, X(end(index)) - X(xs[index]))} height={H} className="current" />
        </svg>
        {tip}
      </div>
      <ul className="legend history-legend">
        {series.map((r) => (
          <li key={r.id} onPointerEnter={() => setFocus(r.id)} onPointerLeave={() => setFocus(null)}>
            <i style={{ background: r.color }} />
            {r.name}
          </li>
        ))}
      </ul>
    </section>
  )
}
