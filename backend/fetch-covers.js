#!/usr/bin/env node
/**
 * Batch-fetch cover images from Open Library for each unique series in seed-catalog.json.
 * Assigns one cover per series (same cover for all issues in a series).
 * Run: node fetch-covers.js
 */

const fs = require('fs');
const path = require('path');

const CATALOG_PATH = path.join(__dirname, 'seed-catalog.json');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchCover(title, author) {
  const q = encodeURIComponent(`${title} ${author} comic`.trim());
  const url = `https://openlibrary.org/search.json?q=${q}&fields=cover_i,title&limit=5`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const data = await res.json();
    const hit = data.docs?.find(d => d.cover_i);
    return hit?.cover_i ? `https://covers.openlibrary.org/b/id/${hit.cover_i}-M.jpg` : null;
  } catch (e) {
    return null;
  }
}

async function main() {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'));
  console.log(`Loaded ${catalog.length} entries`);

  // Get unique series (title + publisher)
  const seriesMap = new Map();
  for (const entry of catalog) {
    const key = `${entry.title}|||${entry.publisher}|||${entry.writer}`;
    if (!seriesMap.has(key)) {
      seriesMap.set(key, { title: entry.title, writer: entry.writer, publisher: entry.publisher });
    }
  }

  console.log(`Found ${seriesMap.size} unique series to fetch covers for`);

  const coverMap = new Map(); // key -> cover URL
  let fetched = 0;
  let found = 0;
  let failed = 0;

  for (const [key, info] of seriesMap) {
    fetched++;
    const coverUrl = await fetchCover(info.title, info.writer);

    if (coverUrl) {
      coverMap.set(key, coverUrl);
      found++;
      process.stdout.write(`\r[${fetched}/${seriesMap.size}] Found: ${found} | Missing: ${failed} | ${info.title}`);
    } else {
      failed++;
      process.stdout.write(`\r[${fetched}/${seriesMap.size}] Found: ${found} | Missing: ${failed} | ${info.title} (no cover)`);
    }

    // Rate limit: ~2 requests per second
    await sleep(500);
  }

  console.log(`\n\nCover fetch complete: ${found}/${seriesMap.size} series have covers (${(found/seriesMap.size*100).toFixed(1)}%)`);

  // Apply covers to catalog
  let coveredEntries = 0;
  for (const entry of catalog) {
    const key = `${entry.title}|||${entry.publisher}|||${entry.writer}`;
    const cover = coverMap.get(key);
    if (cover) {
      entry.cover_image = cover;
      coveredEntries++;
    }
  }

  console.log(`Applied covers to ${coveredEntries}/${catalog.length} entries (${(coveredEntries/catalog.length*100).toFixed(1)}%)`);

  // Write updated catalog
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 0));
  const sizeMB = (fs.statSync(CATALOG_PATH).size / 1024 / 1024).toFixed(2);
  console.log(`Wrote updated catalog (${sizeMB} MB)`);
}

main().catch(console.error);
