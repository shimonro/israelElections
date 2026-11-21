# Israel's Knesset elections, 1949–2026

An animated history of every Israeli election and government, from the 1st Knesset (1949) to the 26th (27 October 2026).

For each government it shows the year, Knesset and government number, the prime minister, a 120-seat hemicycle, seats by bloc against the 61-seat majority line, and a bar race of seats by party. It plays automatically. You can scrub the timeline, change the speed, switch between English and Hebrew (right-to-left), and link straight to a term (for example `#2026-k26`). Background music is Bob Dylan's "The Times They Are A-Changin'", played from his official YouTube upload after the visitor opts in.

## Develop

```sh
npm install
npm run dev     # local dev server
npm test        # data integrity checks (every term seats 120 members, etc.)
npm run build   # production build in dist/
```

Stack: Vite, React 19 and TypeScript, with hand-drawn SVG and CSS charts and no runtime dependencies beyond React.

## Data

`src/data/elections.json` holds one entry per government, plus elections after which no government was formed. Each entry has its Knesset seat results, and each party has a bloc: 0 Centre, 1 Religious, 2 Right, 3 Sectorial, 4 Arab, 5 Left. A party keeps its `id`, and with it its color, across Knessets.

Sources: [Knesset election results](https://main.knesset.gov.il/mk/elections/Pages/default.aspx) and the [Central Elections Committee, 26th Knesset](https://votes26.bechirot.gov.il/nationalresults?lang=en).

## Hosting

Live at https://israel-elections.vercel.app. Vercel deploys every push to `master`; `vercel.json` sets the security headers, including a strict Content Security Policy.
