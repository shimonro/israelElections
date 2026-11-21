import { blocColor, bySpectrum, majorityOf, partyColor, tr } from './data'
import type { Bloc, Party } from './data'

const R_OUTER = 100

/** Seat centres of a semicircular parliament of `total` seats, ordered left to right by angle. */
const layouts = new Map<number, { x: number; y: number; r: number }[]>()
function seatLayout(total: number) {
  const cached = layouts.get(total)
  if (cached) return cached
  const rows = Math.max(3, Math.round(Math.sqrt(total / 3.2)))
  const inner = R_OUTER * 0.4
  const step = (R_OUTER - inner) / (rows - 1)
  const radii = Array.from({ length: rows }, (_, i) => inner + step * i)
  const sum = radii.reduce((a, b) => a + b, 0)
  const perRow = radii.map((r) => Math.round((total * r) / sum))
  perRow[rows - 1] += total - perRow.reduce((a, b) => a + b, 0)
  const dot = Math.min(step, (Math.PI * R_OUTER) / perRow[rows - 1]) * 0.43
  const seats = radii.flatMap((r, row) =>
    Array.from({ length: perRow[row] }, (_, i) => {
      const angle = Math.PI - (Math.PI * i) / Math.max(1, perRow[row] - 1)
      return { x: r * Math.cos(angle), y: -r * Math.sin(angle), angle, r: dot }
    }),
  )
  const sorted = seats.sort((a, b) => b.angle - a.angle)
  layouts.set(total, sorted)
  return sorted
}

interface ChartProps {
  results: Party[]
  blocs: Bloc[]
  lang: string
}

export function Hemicycle({ results, blocs, lang, seats, label }: ChartProps & { seats: number; label?: string }) {
  const ordered = bySpectrum(blocs, results)
  const colors = ordered.flatMap((p) => Array<string>(p.seats).fill(partyColor(blocs, p)))
  return (
    <svg
      className="hemicycle"
      viewBox="-106 -106 212 112"
      role="img"
      aria-label={ordered.map((p) => `${tr(p.name, lang)} ${p.seats}`).join(', ')}
    >
      {seatLayout(seats).map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} style={{ fill: colors[i] ?? 'transparent' }} />
      ))}
      <text x="0" y="-14" className="hemicycle-total">
        {seats}
      </text>
      {label && (
        <text x="0" y="-2" className="hemicycle-sub">
          {label}
        </text>
      )}
    </svg>
  )
}

export function BlocBar({ results, blocs, lang, seats }: ChartProps & { seats: number }) {
  const majority = majorityOf(seats)
  const totals = blocs.map((b) => ({ ...b, seats: results.filter((p) => p.bloc === b.key).reduce((a, p) => a + p.seats, 0) }))
  return (
    <div className="blocs">
      <div className="bloc-bar" dir="ltr">
        {totals.map((b) => (
          <div
            key={b.key}
            className="bloc-segment"
            style={{ flexGrow: b.seats, background: blocColor(blocs, b.key) }}
            title={`${tr(b.name, lang)}: ${b.seats}`}
          >
            {b.seats >= seats / 20 && b.seats}
          </div>
        ))}
        <div className="majority-line" style={{ left: `${(majority / seats) * 100}%` }}>
          <span>{majority}</span>
        </div>
      </div>
      <ul className="legend">
        {totals.map((b) => (
          <li key={b.key}>
            <i style={{ background: blocColor(blocs, b.key) }} />
            {tr(b.name, lang)} <b>{b.seats}</b>
          </li>
        ))}
      </ul>
    </div>
  )
}

const ROW = 30

export function BarRace({ results, blocs, lang }: ChartProps) {
  const max = Math.max(...results.map((p) => p.seats))
  // Render in a stable order so React keeps each party's element and CSS animates its move.
  const stable = [...results].sort((a, b) => String(a.id).localeCompare(String(b.id)))
  const rank = new Map([...results].sort((a, b) => b.seats - a.seats).map((p, i) => [p.id, i]))
  return (
    <ol className="race" style={{ height: results.length * ROW }}>
      {stable.map((p) => (
        <li key={p.id} style={{ transform: `translateY(${rank.get(p.id)! * ROW}px)` }}>
          <span className="race-name" title={`${tr(p.name, lang)} · ${tr(blocs.find((b) => b.key === p.bloc)?.name, lang)}`}>
            {tr(p.name, lang)}
          </span>
          <span className="race-track">
            <span className="race-bar" style={{ width: `${(p.seats / max) * 100}%`, background: partyColor(blocs, p) }} />
            <b className="race-seats">{p.seats}</b>
          </span>
        </li>
      ))}
    </ol>
  )
}
