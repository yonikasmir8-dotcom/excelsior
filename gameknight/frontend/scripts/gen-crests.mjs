// Generates src/crests.json: club / competition name → crest URL, using the
// football-logos package's catalog of football-logos.cc (512×512 PNGs).
// Covers every club in Europe's top five leagues plus UEFA competitions.
//   node scripts/gen-crests.mjs
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
const { getCatalog } = require('football-logos')

const cat = getCatalog()
const url = (country, slug, hash) => `${cat.assetBase}/${country}/512x512/${slug}.${hash}.png`
const norm = s => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\b(fc|afc|cf|ac|as|sc|vfb|rc|ssc|calcio|club|de|logo)\b/g, '').replace(/[^a-z0-9]/g, '')

const teams = {}
// Top flights plus the English Championship (clubs move between them every season)
const LEAGUES = { england: ['english-premier-league', 'efl-championship'], spain: ['la-liga'], italy: ['serie-a'], germany: ['bundesliga'], france: ['ligue-1'], portugal: null, netherlands: null, scotland: null }
for (const [country, leagues] of Object.entries(LEAGUES)) {
  const co = cat.countries[country]
  for (const c of Object.values(co.clubs).filter(c => (leagues || [co.defaultLeague]).includes(c.league) || /west-ham|wolverhampton|burnley/.test(c.slug))) {
    const u = url(country, c.slug, c.hash)
    for (const key of [norm(c.name), norm(c.slug)]) if (key && !teams[key]) teams[key] = u
  }
}
// Names used in-app that don't normalise to the catalog's
const ALIASES = {
  'Newcastle United': 'newcastle', 'Tottenham Hotspur': 'tottenham', 'Leeds': 'leedsunited', 'Paris Saint-Germain': 'parissaintgermain',
  'Athletic Club': 'athleticclubbilbao', 'West Ham United': 'westham', 'Bayern Munich': 'bayernmunich', 'Stuttgart': 'stuttgart', 'West Ham United': 'westhamunited', 'Wolves': 'wolverhamptonwanderers',
}
for (const [name, key] of Object.entries(ALIASES)) if (teams[key]) teams[norm(name)] = teams[key]

const L = (country, slug) => { const l = cat.countries[country].leagues[slug]; return l ? url(country, slug, l.hash) : null }
const comps = {
  'Premier League': L('england', 'english-premier-league'), 'La Liga': L('spain', 'la-liga'), 'Serie A': L('italy', 'serie-a'),
  Bundesliga: L('germany', 'bundesliga'), 'Ligue 1': L('france', 'ligue-1'), 'Champions League': L('tournaments', 'uefa-champions-league'),
  'Europa League': L('tournaments', 'uefa-europa-league'), 'Conference League': L('tournaments', 'uefa-conference-league'),
}
fs.writeFileSync(new URL('../src/crests.json', import.meta.url), JSON.stringify({ source: 'football-logos.cc', teams, comps }))
console.log(`crests: ${Object.keys(teams).length} team keys, ${Object.values(comps).filter(Boolean).length} competitions`)
