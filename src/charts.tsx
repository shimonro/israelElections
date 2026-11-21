import { MAJORITY, TOTAL_SEATS, blocColor, blocOrder, blocs, bySpectrum, partyColor } from './data'
import type { Lang, Party } from './data'

const ROWS = 6
const R_OUTER = 100
const R_INNER = 42

/** Seat centres of a semicircular parliament, ordered left to right by angle. */
const seatPositions = (() => {
  const radii = Array.from({ length: ROWS }, (_, i) => R_INNER + ((R_OUTER - R_INNER) * i) / (ROWS - 1))
  const sum = radii.reduce((a, b) => a + b, 0)
  const perRow = radii.map((r) => Math.round((TOTAL_SEATS * r) / sum))
  perRow[ROWS - 1] += TOTAL_SEATS - perRow.reduce((a, b) => a + b, 0)
  const seats = radii.flatMap((r, row) =>
    Array.from({ length: perRow[row] }, (_, i) => {
      const angle = Math.PI - (Math.PI * i) / (perRow[row] - 1)
      return { x: r * Math.cos(angle), y: -r * Math.sin(angle), angle }
    }),
  )
  return seats.sort((a, b) => b.angle - a.angle)
})()

export function Hemicycle({ results, lang }: { results: Party[]; lang: Lang }) {
  const colors = bySpectrum(results).flatMap((p) => Array<string>(p.seats).fill(partyColor(p)))
  const label = bySpectrum(results)
    .map((p) => `${p[lang]} ${p.seats}`)
    .join(', ')
  return (
    <svg className="hemicycle" viewBox="-106 -106 212 112" role="img" aria-label={label}>
      {seatPositions.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={4.6} style={{ fill: colors[i] ?? 'transparent' }} />
      ))}
      <text x="0" y="-14" className="hemicycle-total">
        {TOTAL_SEATS}
      </text>
      <text x="0" y="-2" className="hemicycle-sub">
        {lang === 'en' ? 'seats' : 'מושבים'}
      </text>
    </svg>
  )
}

export function BlocBar({ results, lang }: { results: Party[]; lang: Lang }) {
  const totals = blocOrder
    .map((bloc) => ({ bloc, seats: results.filter((p) => p.bloc === bloc).reduce((a, p) => a + p.seats, 0) }))
  return (
    <div className="blocs">
      <div className="bloc-bar" dir="ltr">
        {totals.map(({ bloc, seats }) => (
          <div
            key={bloc}
            className="bloc-segment"
            style={{ flexGrow: seats, background: blocColor(bloc) }}
            title={`${blocs[bloc].name[lang]}: ${seats}`}
          >
            {seats >= 6 && seats}
          </div>
        ))}
        <div className="majority-line" style={{ left: `${(MAJORITY / TOTAL_SEATS) * 100}%` }}>
          <span>{MAJORITY}</span>
        </div>
      </div>
      <ul className="legend">
        {totals.map(({ bloc, seats }) => (
          <li key={bloc}>
            <i style={{ background: blocColor(bloc) }} />
            {blocs[bloc].name[lang]} <b>{seats}</b>
          </li>
        ))}
      </ul>
    </div>
  )
}

const ROW = 30

export function BarRace({ results, lang }: { results: Party[]; lang: Lang }) {
  const max = Math.max(...results.map((p) => p.seats))
  // Render in a stable order so React keeps each party's element and CSS animates its move.
  const stable = [...results].sort((a, b) => a.id - b.id)
  const rank = new Map([...results].sort((a, b) => b.seats - a.seats).map((p, i) => [p.id, i]))
  return (
    <ol className="race" style={{ height: results.length * ROW }}>
      {stable.map((p) => (
        <li key={p.id} style={{ transform: `translateY(${rank.get(p.id)! * ROW}px)` }}>
          <span className="race-name" title={`${p[lang]} · ${blocs[p.bloc].name[lang]}`}>
            {p[lang]}
          </span>
          <span className="race-track">
            <span className="race-bar" style={{ width: `${(p.seats / max) * 100}%`, background: partyColor(p) }} />
            <b className="race-seats">{p.seats}</b>
          </span>
        </li>
      ))}
    </ol>
  )
}
