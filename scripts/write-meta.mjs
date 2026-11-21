#!/usr/bin/env node
// Regenerates src/countries/<code>/meta.json from data.json. Run after editing a data.json by hand.
//   node scripts/write-meta.mjs <code> [<code>...]   (no codes: every country)
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { metaOf } from './lib/meta.mjs'

const codes = process.argv.length > 2 ? process.argv.slice(2) : readdirSync('src/countries')
for (const code of codes) {
  const data = JSON.parse(readFileSync(`src/countries/${code}/data.json`, 'utf8'))
  writeFileSync(`src/countries/${code}/meta.json`, JSON.stringify(metaOf(data)) + '\n')
  console.log(`Wrote src/countries/${code}/meta.json`)
}
