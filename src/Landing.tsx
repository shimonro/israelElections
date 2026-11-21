import { useEffect, useState } from 'react'
import { Hemicycle } from './charts'
import { RTL, countries, tr } from './data'
import { languageName, ui } from './i18n'

const LANGS = ['en', ...new Set(countries.flatMap((c) => c.languages).filter((l) => l !== 'en'))]

export default function Landing() {
  const [lang, setLang] = useState(() => LANGS.find((l) => navigator.language.startsWith(l)) ?? 'en')
  const s = ui(lang)

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = RTL.has(lang) ? 'rtl' : 'ltr'
    document.title = s.siteTitle
  }, [lang, s])

  return (
    <div className="app landing">
      <header className="top">
        <div className="brand">
          <div>
            <h1>{s.siteTitle}</h1>
            <p>{s.siteIntro}</p>
          </div>
        </div>
        <nav className="controls" aria-label="Language">
          <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Language">
            {LANGS.map((l) => (
              <option key={l} value={l}>
                {languageName(l)}
              </option>
            ))}
          </select>
        </nav>
      </header>
      <ul className="country-grid">
        {countries.map((c) => (
          <li key={c.code}>
            <a className="card country" href={`/${c.slug}`}>
              <div className="country-head">
                {c.emblem && <img src={c.emblem} alt="" height="56" />}
                <div>
                  <h2>{tr(c.name, lang)}</h2>
                  <p>
                    {tr(c.chamber, lang)} · {c.years[0]}–{c.years[1]}
                  </p>
                </div>
              </div>
              <Hemicycle results={c.latest.results} blocs={c.blocs} lang={lang} seats={c.latest.seats} />
              <span className="country-cta">
                {s.latest(c.latest.year)} <span aria-hidden>→</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      <footer>
        <a href="https://github.com/shimonro/israelelections" target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
      </footer>
    </div>
  )
}
