const fs = require('fs');
const c = JSON.parse(fs.readFileSync(__dirname + '/seed-catalog.json', 'utf-8'));
const total = c.length;
const withCover = c.filter(x => x.cover_image).length;

const series = new Map();
c.forEach(e => {
  const k = e.title + '|||' + e.publisher;
  if (!series.has(k)) series.set(k, { title: e.title, pub: e.publisher, total: 0, covered: 0 });
  const s = series.get(k);
  s.total++;
  if (e.cover_image) s.covered++;
});

const uncovered = [...series.values()].filter(s => s.covered === 0);
const partial = [...series.values()].filter(s => s.covered > 0 && s.covered < s.total);

// Check for duplicate covers (same URL for all issues = likely wrong)
const sameCover = [...series.values()].filter(s => {
  if (s.covered === 0) return false;
  const entries = c.filter(e => e.title === s.title && e.publisher === s.pub && e.cover_image);
  const unique = new Set(entries.map(e => e.cover_image));
  s.uniqueCovers = unique.size;
  return unique.size === 1 && s.total > 5; // Only 1 unique cover for 5+ issues
});

console.log('=== Cover Analysis ===');
console.log('Total entries:', total);
console.log('With covers:', withCover, '(' + (withCover / total * 100).toFixed(1) + '%)');
console.log('Without covers:', total - withCover);
console.log('Total series:', series.size);
console.log('Series without ANY covers:', uncovered.length);
uncovered.forEach(s => console.log('  -', s.title, '(' + s.pub + ') [' + s.total + ' issues]'));
console.log('\nSeries with only 1 unique cover (5+ issues):', sameCover.length);
sameCover.slice(0, 10).forEach(s => console.log('  -', s.title, '(' + s.pub + ') [' + s.total + ' issues, 1 unique cover]'));
console.log('\nCover variety stats:');
const varietyBuckets = { '1 cover': 0, '2-5 covers': 0, '6-10 covers': 0, '10+ covers': 0 };
[...series.values()].filter(s => s.covered > 0).forEach(s => {
  const entries = c.filter(e => e.title === s.title && e.publisher === s.pub && e.cover_image);
  const unique = new Set(entries.map(e => e.cover_image)).size;
  if (unique === 1) varietyBuckets['1 cover']++;
  else if (unique <= 5) varietyBuckets['2-5 covers']++;
  else if (unique <= 10) varietyBuckets['6-10 covers']++;
  else varietyBuckets['10+ covers']++;
});
Object.entries(varietyBuckets).forEach(([k, v]) => console.log(' ', k + ':', v, 'series'));
