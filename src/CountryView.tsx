import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarRace, BlocBar, Hemicycle } from './charts'
import { RTL, termSlugs, tr } from './data'
import type { Country, Term } from './data'
import { languageName, ui } from './i18n'

const STEP_MS = 2400
const SPEEDS = [0.5, 1, 2, 4]
const SONG_ID = '90WD_ats6eE'

const governmentText = (g: Term['government'], lang: string) =>
  g === null ? null : typeof g === 'object' ? tr(g, lang) : String(g)

export default function CountryView({ country }: { country: Country }) {
  const { terms, blocs, pms, meta } = country
  const last = terms.length - 1
  const slugs = useMemo(() => termSlugs(terms), [terms])
  // Timeline labels: the first term of each parliament, skipping ones too close to the previous label.
  const ticks = useMemo(
    () =>
      terms.reduce<number[]>((acc, term, i) => {
        const isNew = i === 0 || term.term !== terms[i - 1].term
        const gap = Math.max(2, Math.round(terms.length / 18))
        if (isNew && (acc.length === 0 || i - acc[acc.length - 1] >= gap) && (last - i >= gap || i === last)) acc.push(i)
        return acc
      }, []),
    [terms, last],
  )
  const indexFromHash = useCallback(() => Math.max(0, slugs.indexOf(location.hash.slice(1))), [slugs])

  const [index, setIndex] = useState(indexFromHash)
  const [playing, setPlaying] = useState(false)
  const [started, setStarted] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [lang, setLang] = useState(() => meta.languages.find((l) => navigator.language.startsWith(l)) ?? 'en')
  const [music, setMusic] = useState(false)
  const s = ui(lang)
  const term = terms[index]
  const pm = pms[term.pm]
  const chamber = tr(country.chamber, lang)
  const government = governmentText(term.government, lang)

  const step = useCallback((delta: number) => setIndex((i) => (i + delta + terms.length) % terms.length), [terms.length])

  useEffect(() => {
    if (!playing) return
    // Linger on the latest election before starting over.
    const id = setTimeout(() => step(1), (index === last ? 3 : 1) * (STEP_MS / speed))
    return () => clearTimeout(id)
  }, [playing, index, speed, step, last])

  useEffect(() => {
    history.replaceState(null, '', `#${slugs[index]}`)
  }, [index, slugs])

  useEffect(() => {
    const onHash = () => setIndex(indexFromHash())
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [indexFromHash])

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = RTL.has(lang) ? 'rtl' : 'ltr'
    document.title = `${tr(meta.name, lang)} · ${s.title(chamber)}, ${terms[0].year}–${terms[last].year}`
  }, [lang, meta, s, chamber, terms, last])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!started || e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) return
      const dir = RTL.has(lang) ? -1 : 1
      if (e.key === ' ') setPlaying((p) => !p)
      else if (e.key === 'ArrowRight') step(dir)
      else if (e.key === 'ArrowLeft') step(-dir)
      else if (e.key === 'Home') setIndex(0)
      else if (e.key === 'End') setIndex(last)
      else return
      e.preventDefault()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [started, lang, step, last])

  const start = (withMusic: boolean) => {
    setStarted(true)
    setPlaying(true)
    setMusic(withMusic)
  }
  const nextLang = meta.languages[(meta.languages.indexOf(lang) + 1) % meta.languages.length]

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          {meta.emblem && <img src={meta.emblem} alt="" height="44" />}
          <div>
            <h1>{tr(meta.name, lang)}</h1>
            <p>
              {s.title(chamber)} · {s.subtitle(terms[0].year, terms[last].year)}
            </p>
          </div>
        </div>
        <nav className="controls" aria-label="Playback">
          <a className="button" href="/">
            ← {s.allCountries}
          </a>
          <button className="primary" onClick={() => setPlaying(!playing)} aria-pressed={playing}>
            {playing ? `❚❚ ${s.pause}` : `▶ ${s.play}`}
          </button>
          <label className="speed">
            <span>{s.speed}</span>
            <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
              {SPEEDS.map((v) => (
                <option key={v} value={v}>
                  {v}×
                </option>
              ))}
            </select>
          </label>
          <button onClick={() => setMusic(!music)} aria-pressed={music} title={s.music}>
            {music ? '♫' : '♪'} {s.music}
          </button>
          {meta.languages.length > 1 && (
            <button onClick={() => setLang(nextLang)} lang={nextLang}>
              {languageName(nextLang)}
            </button>
          )}
        </nav>
      </header>

      <main className="grid">
        <section className="card term" aria-live="polite">
          <div className="year">{term.year}</div>
          <dl>
            <div>
              <dt>{tr(country.termLabel, lang)}</dt>
              <dd>{term.term}</dd>
            </div>
            <div>
              <dt>{s.government}</dt>
              <dd>{government ?? s.noGovernment}</dd>
            </div>
          </dl>
          <figure className="pm">
            <img key={pm.photo} src={pm.photo} alt={tr(pm.name, lang)} width="96" height="120" />
            <figcaption>
              <small>{s.pm}</small>
              <strong>{tr(pm.name, lang)}</strong>
            </figcaption>
          </figure>
          {term.note && <p className="note">{tr(term.note, lang)}</p>}
        </section>

        <section className="card parliament">
          <h2>{s.blocs}</h2>
          <Hemicycle results={term.results} blocs={blocs} lang={lang} seats={term.seats} label={s.seatsWord} />
          <BlocBar results={term.results} blocs={blocs} lang={lang} seats={term.seats} />
        </section>

        <section className="card wide">
          <h2>{s.seats}</h2>
          <BarRace results={term.results} blocs={blocs} lang={lang} />
        </section>
      </main>

      <section className="card timeline" aria-label={s.timeline}>
        <input
          type="range"
          min={0}
          max={last}
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
          aria-valuetext={`${term.year}, ${tr(country.termLabel, lang)} ${term.term}`}
        />
        <div className="ticks" aria-hidden>
          {ticks.map((i) => (
            <button
              key={i}
              tabIndex={-1}
              className={i === index ? 'on' : ''}
              style={{ insetInlineStart: `${(i / last) * 100}%` }}
              onClick={() => setIndex(i)}
            >
              {terms[i].year}
            </button>
          ))}
        </div>
        <p className="hint">{s.keys}</p>
      </section>

      <footer>
        {s.sources}:{' '}
        {country.sources.map((src, i) => (
          <span key={src.url}>
            {i > 0 && ' · '}
            <a href={src.url} target="_blank" rel="noopener noreferrer">
              {src.label}
            </a>
          </span>
        ))}
        {country.credits.length > 0 && (
          <details>
            <summary>{s.photos}</summary>
            {country.credits.map((c) => (
              <div key={c}>{c}</div>
            ))}
          </details>
        )}
      </footer>

      {music && (
        <aside className="player">
          <div>
            <small>{s.nowPlaying}</small>
            <strong dir="ltr">Bob Dylan — The Times They Are A-Changin'</strong>
          </div>
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${SONG_ID}?autoplay=1&loop=1&playlist=${SONG_ID}&rel=0`}
            title="Bob Dylan — The Times They Are A-Changin' (Official Audio)"
            allow="autoplay; encrypted-media"
            referrerPolicy="strict-origin-when-cross-origin"
          />
          <button onClick={() => setMusic(false)} aria-label={s.close}>
            ✕
          </button>
        </aside>
      )}

      {!started && (
        <div className="intro" role="dialog" aria-modal="true" aria-labelledby="intro-title">
          <div className="intro-card">
            {meta.emblem && <img src={meta.emblem} alt="" height="79" />}
            <h2 id="intro-title">{tr(meta.name, lang)}</h2>
            <p>{s.intro(terms[0].year, terms[last].year, terms[last].seats)}</p>
            <p className="song">♫ “The Times They Are A-Changin’” — Bob Dylan</p>
            <button className="primary big" onClick={() => start(true)} autoFocus>
              ▶ {s.start}
            </button>
            <button className="link" onClick={() => start(false)}>
              {s.silent}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
