#!/usr/bin/env node
/**
 * Batch-fetch MULTIPLE cover images per series from Open Library.
 * Instead of one cover for all issues, we collect many cover_i values
 * per series and distribute them across issues for visual variety.
 * Run: node fetch-covers.js
 */

const fs = require('fs');
const path = require('path');

const CATALOG_PATH = path.join(__dirname, 'seed-catalog.json');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Extract significant words from a title for fuzzy matching.
 * Strips articles, parenthetical year tags, and short filler words.
 */
function significantWords(title) {
  const stripped = title.replace(/\(.*?\)/g, '').trim();
  const stop = new Set(['the', 'a', 'an', 'of', 'and', 'in', 'on', 'at', 'to', 'for', 'by', 'is', 'it']);
  return stripped
    .toLowerCase()
    .split(/[\s\-:,]+/)
    .filter(w => w.length > 1 && !stop.has(w));
}

/**
 * Check if a candidate title from Open Library is a reasonable match for our series title.
 * At least half the significant words from our title must appear in the candidate.
 * This prevents e.g. a "Batman" search returning "The Batman Files" (a non-comic reference book).
 */
function titleMatches(seriesTitle, candidateTitle) {
  const ourWords = significantWords(seriesTitle);
  if (ourWords.length === 0) return true; // can't validate, assume OK
  const candidateLower = candidateTitle.toLowerCase();
  const matched = ourWords.filter(w => candidateLower.includes(w));
  return matched.length >= Math.ceil(ourWords.length / 2);
}

/**
 * Fetch up to `limit` unique cover IDs from Open Library for a given query.
 * Returns an array of cover URLs (could be 0 to many).
 * Now includes TITLE VALIDATION: skips results where the Open Library doc title
 * doesn't match our series title, preventing mismatched covers.
 */
async function fetchCovers(title, author, limit = 40) {
  // Try multiple search strategies to maximize cover variety
  const queries = [
    `${title} ${author} comic`,
    `${title} comic book`,
    `${title}`,
  ];

  const coverIds = new Set();
  let skippedMismatch = 0;

  for (const rawQ of queries) {
    if (coverIds.size >= limit) break;

    const q = encodeURIComponent(rawQ.trim());
    const url = `https://openlibrary.org/search.json?q=${q}&fields=cover_i,title,edition_key&limit=100`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) continue;
      const data = await res.json();

      for (const doc of (data.docs || [])) {
        if (!doc.cover_i || coverIds.has(doc.cover_i)) continue;

        // Title validation: skip results where the title doesn't match our series
        if (doc.title && !titleMatches(title, doc.title)) {
          skippedMismatch++;
          continue;
        }

        coverIds.add(doc.cover_i);
        if (coverIds.size >= limit) break;
      }
    } catch (e) {
      // timeout or network error, continue to next query
    }

    // Rate limit between queries
    await sleep(400);
  }

  if (skippedMismatch > 0) {
    process.stdout.write(` [skipped ${skippedMismatch} title mismatches]`);
  }

  return [...coverIds].map(id => `https://covers.openlibrary.org/b/id/${id}-M.jpg`);
}

async function main() {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'));
  console.log(`Loaded ${catalog.length} entries`);

  // Group entries by series (title + publisher + writer)
  const seriesMap = new Map();
  for (let i = 0; i < catalog.length; i++) {
    const entry = catalog[i];
    const key = `${entry.title}|||${entry.publisher}|||${entry.writer}`;
    if (!seriesMap.has(key)) {
      seriesMap.set(key, {
        title: entry.title,
        writer: entry.writer,
        publisher: entry.publisher,
        indices: []
      });
    }
    seriesMap.get(key).indices.push(i);
  }

  console.log(`Found ${seriesMap.size} unique series to fetch covers for\n`);

  let seriesFetched = 0;
  let seriesWithCovers = 0;
  let totalCovered = 0;
  let totalUniqueCovers = 0;

  for (const [key, info] of seriesMap) {
    seriesFetched++;
    const issueCount = info.indices.length;

    // Fetch multiple covers for this series
    const covers = await fetchCovers(info.title, info.writer, Math.min(issueCount, 40));

    if (covers.length > 0) {
      seriesWithCovers++;
      totalUniqueCovers += covers.length;

      // Distribute covers across issues
      // Strategy: cycle through available covers so adjacent issues get different covers
      for (let j = 0; j < info.indices.length; j++) {
        const coverIndex = j % covers.length;
        catalog[info.indices[j]].cover_image = covers[coverIndex];
        totalCovered++;
      }

      const pct = (seriesFetched / seriesMap.size * 100).toFixed(0);
      process.stdout.write(
        `\r[${pct}%] ${seriesFetched}/${seriesMap.size} | ` +
        `Covers: ${seriesWithCovers} series, ${totalUniqueCovers} unique | ` +
        `${info.title} (${covers.length} covers for ${issueCount} issues)    `
      );
    } else {
      const pct = (seriesFetched / seriesMap.size * 100).toFixed(0);
      process.stdout.write(
        `\r[${pct}%] ${seriesFetched}/${seriesMap.size} | ` +
        `Covers: ${seriesWithCovers} series | ` +
        `${info.title} (NO COVERS)    `
      );
    }

    // Rate limit between series (we already sleep between queries inside fetchCovers)
    await sleep(300);
  }

  console.log(`\n\n=== Cover Fetch Summary ===`);
  console.log(`Series with covers: ${seriesWithCovers}/${seriesMap.size} (${(seriesWithCovers/seriesMap.size*100).toFixed(1)}%)`);
  console.log(`Total unique covers found: ${totalUniqueCovers}`);
  console.log(`Entries with covers: ${totalCovered}/${catalog.length} (${(totalCovered/catalog.length*100).toFixed(1)}%)`);
  console.log(`Avg covers per series: ${(totalUniqueCovers/Math.max(seriesWithCovers,1)).toFixed(1)}`);

  // Write updated catalog
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 0));
  const sizeMB = (fs.statSync(CATALOG_PATH).size / 1024 / 1024).toFixed(2);
  console.log(`\nWrote updated catalog (${sizeMB} MB)`);
}

main().catch(console.error);
