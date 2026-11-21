import { useEffect, useState } from 'react'
import CountryView from './CountryView'
import Landing from './Landing'
import { countries, loadCountry } from './data'
import type { Country } from './data'

// The site launched as Israel only, at "/#<term>"; keep those links working.
if (location.pathname === '/' && /^#\d{4}/.test(location.hash)) history.replaceState(null, '', `/israel${location.hash.replace(/^(#\d{4})-k.*/, '$1')}`)

export default function App() {
  const meta = countries.find((c) => `/${c.slug}` === location.pathname.replace(/\/$/, ''))
  const [country, setCountry] = useState<Country | null>(null)

  useEffect(() => {
    if (meta) loadCountry(meta.code).then(setCountry)
  }, [meta])

  if (!meta) return <Landing />
  return country ? <CountryView country={country} /> : null
}
