# Adding a country

A country is one folder, `src/countries/<code>/`, holding `data.json` (the full history, loaded when the country page opens) and `meta.json` (the summary the landing page shows). The landing page, routing at `/<slug>`, the hemicycle size and the language toggle all come from those files; no app code changes.

The scripts build both files from Wikipedia: every election article has an `{{Election results}}` table and an infobox that links to the previous election.

## Steps

1. **Fetch.** Pass the latest election's English Wikipedia article, the first year to include, and the native language code:

   ```sh
   npm run country:fetch -- de "2025 German federal election" --from 1949 --lang de
   ```

   This walks back through the elections and writes `countries/de/source.json` (yours to edit) and `countries/de/raw.json` (the parsed results; don't edit). It warns when an election's parties don't add up to the chamber size.

2. **Edit `countries/<code>/source.json`.** This is the only manual step:
   - `slug`, `name`, `chamber`, `termLabel`: the URL (`/germany`) and labels, in English and the native language.
   - `blocs`: the political blocs in left-to-right seating order, each `{ key, name, hue }` (or a fixed `color`).
   - `parties`: every party seen gets an entry with its native name and Wikipedia color already filled in. Set each one's `bloc`, and shorten `name` if needed. Several entries can share a `key` to merge into one party (for example a party that renamed). Use `blocByYear` for a party that moved bloc.
   - `pms`: `{ "<key>": { "wiki": "<English Wikipedia article>" } }` for every prime minister.
   - `governments`: one entry per government, prefilled with one per election. Add the governments that formed mid-term, and set each one's `pm`, `label` and optional `note`. `election` is the year of the election whose parliament it governed with.
   - `fixes`: `{ "<year>": { "<party>": seats } }` when the Wikipedia table is wrong or incomplete.
   - `termStart`: set to a number (such as `1`) to number parliaments like the Knesset; otherwise terms show as years (`2022–2026`).
   - `emblem`: `{ "wiki": "Coat of arms of …" }`.

3. **Fetch again** to download the prime ministers' photos (with credits), the emblem, and native names for anything added:

   ```sh
   npm run country:fetch -- de
   ```

4. **Build** `src/countries/<code>/data.json` and `meta.json`. It lists every problem to fix in `source.json` and writes nothing until there are none:

   ```sh
   npm run country:build -- de
   ```

5. **Check:** `npm test` validates every country (seat totals, blocs, photos, meta up to date), then `npm run dev` and open `/<slug>`.

If the interface should also be translated into the new language, add its strings to `src/i18n.ts`; otherwise the interface stays in English while the data shows native names.

## Hand-curated data

`data.json` can also be written by hand, as Israel's is (it has Hebrew names and notes that Wikipedia does not provide). After editing it, run `npm run country:meta -- <code>` to refresh `meta.json`.

To add a new election to a Wikipedia-built country later, run `npm run country:fetch -- <code> "<new election article>"` (it re-walks the chain and keeps your edits), add the new government in `source.json`, then build.
