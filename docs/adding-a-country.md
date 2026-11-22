# Adding a country

A country is one folder, `src/countries/<code>/`, holding `data.json` (the full history, loaded when the country page opens) and `meta.json` (the summary the landing page shows). The landing page, routing at `/<slug>`, the hemicycle size, the history chart and the language toggle all come from those files; no app code changes.

The scripts build both files from two sources:

- **Wikipedia**: every election article has an infobox that links to the previous election, and an `{{Election results}}` table with seats per party.
- **Wikidata**: the country's languages, its head of government and every holder of that office with their photos, the coat of arms, and each party's native name, colour and political alignment.

A country works with these scripts when its election articles use `{{Election results}}`. That holds for Germany, the US House, the Nordic countries, Austria, the Netherlands, Portugal and Hungary. The UK, Spain, Italy, Ireland, Australia and Canada don't (their tables are hand-made wikitables, or the infobox leaves out seats), so they need hand-written data.

## Steps

1. **Fetch.** Pass the latest election's English Wikipedia article and the first year to include:

   ```sh
   npm run country:fetch -- nl "2025 Dutch general election" --from 1946
   ```

   This walks back through the elections and writes `countries/nl/source.json` (yours to edit) and `countries/nl/raw.json` (the parsed results; don't edit). Then it fills in everything it can:
   - the country's name, official languages (up to three, `--lang` to override) and chamber;
   - one government per election plus one per change of head of government, from Wikidata's office holders;
   - the heads of government, with photos from Wikidata, or failing that a free Commons lead image from their article in one of the country's languages;
   - every party with its native name, colour and bloc. The bloc comes from the party's Wikidata alignment (`centre-left`, `far-right`…), or else from its ideology, or for a joint list from its members' average.

   It prints a warning for everything it could not settle, such as a party with no alignment (put in bloc `other`) or a leader with no free photo.

2. **Review `countries/<code>/source.json`.** Fix the warnings and check the judgment calls:
   - `languages`: check them; Wikidata sometimes lists a minority language as official (Finnish for Sweden).
   - `parties`: set `bloc` for each party left in `other`, and check the big parties' blocs. Use `blocByYear` for a party that moved bloc. Several entries with one `key` merge into one party (a party that renamed); entries that share a Wikidata item get one key automatically.
   - `blocs`: the standard left-to-right scale is filled in. Replace it for a country with its own blocs (Israel's Arab, religious…), or override colours (the US uses blue for the Democrats' bloc and red for the Republicans').
   - `termLabel`, `termStart`: set `termStart` to a number to number parliaments (the Bundestag from 1, Congress from 80); otherwise terms show as years (`2021–2025`).
   - `leaderTitle`: the head of government's title, filled in from Wikidata (`President`, `Federal Chancellor`).
   - `governments`: add a `label` (and optional `note`) to name a government; without labels the page leaves the Government row out.
   - `fixes`: `{ "<election key>": { "<party>": seats } }` when the Wikipedia table is wrong or incomplete.
   - `maxGap`: share of the chamber that may be missing from a table and shown as "Others" (default `0.05`; vacancies and undecided races).

   To regenerate a generated field, delete it and fetch again; everything still in the file is kept.

3. **Build** `src/countries/<code>/data.json` and `meta.json`:

   ```sh
   npm run country:build -- nl
   ```

   It lists every problem to fix in `source.json` and writes nothing until there are none: unknown parties or blocs, seat totals that don't add up, two different parties sharing a key, missing leaders. Notes (such as a leader shown with initials because no photo exists) don't block the build.

4. **Check:** `npm test` validates every country (seat totals, blocs, photos, meta up to date), then `npm run dev` and open `/<slug>`.

If the interface should also be translated into the new language, add its strings to `src/i18n.ts`; otherwise the interface stays in English while the data shows native names.

## Edge cases the scripts handle

- Two elections in one year get keys `1974` and `1974-2`.
- A broken previous-election link in the infobox (West Germany 1987) falls back to a title search.
- Results tables with gaps in their row numbers, a "Total" seat column, joint lists (`Farmers–Conservatives`), or rows named by template (`{{Party name with color|…}}`).
- Several Wikipedia titles for one party, including redirects to the same article (`Die Linke`, `The Left (Germany)`).
- Different parties with one name (Portugal's 1979 and 2024 "Democratic Alliance") get distinct keys.
- Wikidata people whose name is only in the multilingual (`mul`) label.
- Short caretaker terms and terms nested inside another are dropped from the office holders; a leader taking office within 150 days of an election heads that election's government.
- Tables with more seats than the infobox (West Berlin's non-voting members) are trusted; small shortfalls become "Others".
- Party colours too dark for the dark background (the CDU's black) are lightened when shown.

## Hand-curated data

`data.json` can also be written by hand, as Israel's is (it has Hebrew names and notes that Wikipedia does not provide). After editing it, run `npm run country:meta -- <code>` to refresh `meta.json`.

## A new election

Run `npm run country:fetch -- <code> "<new election article>"`. It re-walks the chain and keeps your edits. If `governments` was generated, delete it to generate the new ones; otherwise add the new government by hand. Then build.
