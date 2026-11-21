import { useCallback, useEffect, useState } from 'react'
import { BarRace, BlocBar, Hemicycle } from './charts'
import { pms, termSlug, terms } from './data'
import type { Lang } from './data'

const STEP_MS = 2400
const SPEEDS = [0.5, 1, 2, 4]
const SONG_ID = '90WD_ats6eE'
const LAST = terms.length - 1

/** Timeline labels: the first term of each Knesset, skipping ones too close to the previous label. */
const ticks = terms.reduce<number[]>((acc, term, i) => {
  const isNewKnesset = i === 0 || term.knesset !== terms[i - 1].knesset
  if (isNewKnesset && (acc.length === 0 || i - acc[acc.length - 1] >= 2) && LAST - i !== 1) acc.push(i)
  return acc
}, [])

const t = {
  en: {
    title: "Israel's Knesset elections",
    subtitle: `Every government, ${terms[0].year}–${terms[LAST].year}`,
    play: 'Play',
    pause: 'Pause',
    speed: 'Speed',
    music: 'Music',
    knesset: 'Knesset',
    government: 'Government',
    noGovernment: 'None formed',
    pm: 'Prime Minister',
    seats: 'Seats by party',
    blocs: 'Seats by bloc',
    timeline: 'Timeline',
    start: 'Start with music',
    silent: 'Start without music',
    intro: 'Watch 77 years of Israeli democracy reshape the 120 seats of the Knesset.',
    nowPlaying: 'Now playing',
    close: 'Stop music',
    keys: 'Space: play/pause · ← →: step',
    sources: 'Sources',
  },
  he: {
    title: 'הבחירות לכנסת',
    subtitle: `כל הממשלות, ${terms[0].year}–${terms[LAST].year}`,
    play: 'הפעל',
    pause: 'עצור',
    speed: 'מהירות',
    music: 'מוזיקה',
    knesset: 'כנסת',
    government: 'ממשלה',
    noGovernment: 'לא הוקמה',
    pm: 'ראש הממשלה',
    seats: 'מושבים לפי מפלגה',
    blocs: 'מושבים לפי גוש',
    timeline: 'ציר זמן',
    start: 'התחל עם מוזיקה',
    silent: 'התחל בלי מוזיקה',
    intro: '77 שנים של דמוקרטיה ישראלית ב-120 המושבים של הכנסת.',
    nowPlaying: 'מתנגן עכשיו',
    close: 'עצור מוזיקה',
    keys: 'רווח: הפעל/עצור · ← →: צעד',
    sources: 'מקורות',
  },
}

const indexFromHash = () => {
  const i = terms.findIndex((term) => termSlug(term) === location.hash.slice(1))
  return i < 0 ? 0 : i
}

export default function App() {
  const [index, setIndex] = useState(indexFromHash)
  const [playing, setPlaying] = useState(false)
  const [started, setStarted] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [lang, setLang] = useState<Lang>(() => (navigator.language.startsWith('he') ? 'he' : 'en'))
  const [music, setMusic] = useState(false)
  const s = t[lang]
  const term = terms[index]
  const pm = pms[term.pm]

  const step = useCallback((delta: number) => setIndex((i) => (i + delta + terms.length) % terms.length), [])

  useEffect(() => {
    if (!playing) return
    // Linger on the latest election before starting over.
    const id = setTimeout(() => step(1), (index === LAST ? 3 : 1) * (STEP_MS / speed))
    return () => clearTimeout(id)
  }, [playing, index, speed, step])

  useEffect(() => {
    history.replaceState(null, '', `#${termSlug(term)}`)
  }, [term])

  useEffect(() => {
    const onHash = () => setIndex(indexFromHash())
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr'
  }, [lang])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!started || e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) return
      const rtl = lang === 'he' ? -1 : 1
      if (e.key === ' ') setPlaying((p) => !p)
      else if (e.key === 'ArrowRight') step(rtl)
      else if (e.key === 'ArrowLeft') step(-rtl)
      else if (e.key === 'Home') setIndex(0)
      else if (e.key === 'End') setIndex(LAST)
      else return
      e.preventDefault()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [started, lang, step])

  const start = (withMusic: boolean) => {
    setStarted(true)
    setPlaying(true)
    setMusic(withMusic)
  }

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <img src="/resources/emblem-160.png" alt="" width="36" height="44" />
          <div>
            <h1>{s.title}</h1>
            <p>{s.subtitle}</p>
          </div>
        </div>
        <nav className="controls" aria-label="Playback">
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
          <button onClick={() => setLang(lang === 'en' ? 'he' : 'en')} lang={lang === 'en' ? 'he' : 'en'}>
            {lang === 'en' ? 'עברית' : 'English'}
          </button>
        </nav>
      </header>

      <main className="grid">
        <section className="card term" aria-live="polite">
          <div className="year">{term.year}</div>
          <dl>
            <div>
              <dt>{s.knesset}</dt>
              <dd>{term.knesset}</dd>
            </div>
            <div>
              <dt>{s.government}</dt>
              <dd>{term.government ?? s.noGovernment}</dd>
            </div>
          </dl>
          <figure className="pm">
            <img key={pm.photo} src={pm.photo} alt={pm[lang]} width="96" height="120" />
            <figcaption>
              <small>{s.pm}</small>
              <strong>{pm[lang]}</strong>
            </figcaption>
          </figure>
          {term.note && <p className="note">{term.note[lang]}</p>}
        </section>

        <section className="card parliament">
          <h2>{s.blocs}</h2>
          <Hemicycle results={term.results} lang={lang} />
          <BlocBar results={term.results} lang={lang} />
        </section>

        <section className="card wide">
          <h2>{s.seats}</h2>
          <BarRace results={term.results} lang={lang} />
        </section>
      </main>

      <section className="card timeline" aria-label={s.timeline}>
        <input
          type="range"
          min={0}
          max={LAST}
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
          aria-valuetext={`${term.year}, ${s.knesset} ${term.knesset}`}
        />
        <div className="ticks" aria-hidden>
          {ticks.map((i) => (
            <button
              key={i}
              tabIndex={-1}
              className={i === index ? 'on' : ''}
              style={{ insetInlineStart: `${(i / LAST) * 100}%` }}
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
        <a href="https://main.knesset.gov.il/mk/elections/Pages/default.aspx" target="_blank" rel="noopener noreferrer">
          Knesset
        </a>{' '}
        ·{' '}
        <a href="https://votes26.bechirot.gov.il/" target="_blank" rel="noopener noreferrer">
          Central Elections Committee (26th Knesset)
        </a>{' '}
        · Bennett & Lapid photos: Avi Ohayon / GPO, CC BY-SA 3.0 via Wikimedia Commons ·{' '}
        <a href="https://github.com/shimonro/israelelections" target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
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
            <img src="/resources/emblem-160.png" alt="" width="64" height="79" />
            <h2 id="intro-title">{s.title}</h2>
            <p>{s.intro}</p>
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
