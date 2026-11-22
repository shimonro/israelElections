# Elections through time

Animated histories of every election and government, country by country: Israel, Hungary, Germany, the United States, the Netherlands, Sweden, Norway, Finland, Austria and Portugal, each from 1945 or its first free election to the latest. Live at https://israel-elections.vercel.app.

For each government it shows the year, parliament and government, the prime minister, a hemicycle of the whole chamber, seats by bloc against the majority line, a bar race of seats by party, and a chart of every bloc's or party's share over the whole period, as lines or 100% stacked. It plays automatically. You can scrub the timeline, change the speed, switch between English and the country's language (right-to-left for Hebrew), and link straight to a term (for example `/israel#2026`). Background music is Bob Dylan's "The Times They Are A-Changin'", played from his official YouTube upload after the visitor opts in.

## Develop

```sh
npm install
npm run dev     # local dev server
npm test        # data integrity checks for every country
npm run build   # production build in dist/
```

Stack: Vite, React 19 and TypeScript, with hand-drawn SVG and CSS charts and no runtime dependencies beyond React.

## Countries

Each country is a folder in `src/countries/`, found automatically. Israel's data is hand-curated; the others are built from Wikipedia and Wikidata by scripts. To add a country, see [docs/adding-a-country.md](docs/adding-a-country.md).

## Hosting

Vercel deploys every push to `master`; `vercel.json` sets the security headers, including a strict Content Security Policy, and serves the app for every country path.
