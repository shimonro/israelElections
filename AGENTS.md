# Elections through time

Vite + React 19 + TypeScript. Each country is data only: `src/countries/<code>/{data,meta}.json` plus photos in `public/countries/<code>/`.

- To add a country or a new election, follow `docs/adding-a-country.md` and use its scripts (`npm run country:fetch`, `country:build`, `country:meta`); don't write data or app code by hand for it.
- Checks: `npm test` (data integrity for every country) and `npm run build`.
- Deploys: Vercel builds every push to `master` (https://israel-elections.vercel.app).
