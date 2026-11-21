// The small summary of a country that the landing page loads up front (src/countries/<code>/meta.json).
export function metaOf(data) {
  const first = data.terms[0]
  const last = data.terms[data.terms.length - 1]
  return {
    ...data.meta,
    years: [first.year, last.year],
    chamber: data.chamber,
    blocs: data.blocs.map(({ key, hue, color }) => ({ key, hue, color })),
    latest: {
      year: last.year,
      seats: last.seats,
      results: last.results.map(({ id, seats, bloc, color }) => ({ id, seats, bloc, ...(color && { color }) })),
    },
  }
}
