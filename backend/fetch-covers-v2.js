#!/usr/bin/env node
/**
 * fetch-covers-v2.js — Multi-source cover fetcher with ACCURACY VALIDATION
 *
 * Sources:
 *   1. Open Library (current) — good for trades/collected editions
 *   2. Google Books API (free, no key) — great for trade paperbacks
 *   3. Open Library Editions — finds multiple covers per work
 *
 * Key improvements over v1:
 *   - TITLE VALIDATION: Ensures returned results actually match our comic
 *   - MULTI-SOURCE: Falls back to Google Books if Open Library fails
 *   - PER-VOLUME searches: Searches for "Batman Vol 1", "Batman Vol 2" etc.
 *   - COVER VARIETY: Tries harder to find different covers for different issues
 *   - ACCURACY REPORT: Logs how many covers were validated vs guessed
 */

const fs = require('fs');
const path = require('path');

const CATALOG_PATH = path.join(__dirname, 'seed-catalog.json');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Title Matching ──────────────────────────────────────────────────────────

/**
 * Check if a returned title is a reasonable match for our series title.
 * Returns a confidence score 0-1.
 */
function titleMatchScore(ourTitle, returnedTitle) {
  if (!returnedTitle) return 0;
  const clean = s => s.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const ours = clean(ourTitle);
  const theirs = clean(returnedTitle);

  // Exact match
  if (ours === theirs) return 1.0;

  // One contains the other
  if (theirs.includes(ours) || ours.includes(theirs)) return 0.9;

  // Check significant words overlap
  const ourWords = ours.split(' ').filter(w => w.length > 2);
  const theirWords = theirs.split(' ').filter(w => w.length > 2);

  if (ourWords.length === 0) return 0;

  const matches = ourWords.filter(w => theirWords.some(tw => tw.includes(w) || w.includes(tw)));
  const score = matches.length / ourWords.length;

  return score;
}

// ── Open Library Search ─────────────────────────────────────────────────────

async function searchOpenLibrary(query, limit = 20) {
  const q = encodeURIComponent(query.trim());
  const url = `https://openlibrary.org/search.json?q=${q}&fields=cover_i,title,author_name&limit=${limit}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return [];
    const data = await res.json();
    return (data.docs || []).filter(d => d.cover_i).map(d => ({
      coverId: d.cover_i,
      title: d.title || '',
      url: `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`,
    }));
  } catch {
    return [];
  }
}

// ── Google Books Search ─────────────────────────────────────────────────────

async function searchGoogleBooks(query, limit = 10) {
  const q = encodeURIComponent(query.trim());
  const url = `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=${limit}&printType=all`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || [])
      .filter(item => item.volumeInfo?.imageLinks?.thumbnail)
      .map(item => ({
        title: item.volumeInfo.title || '',
        // Google Books thumbnails — upgrade to higher quality
        url: item.volumeInfo.imageLinks.thumbnail
          .replace('zoom=1', 'zoom=2')
          .replace('http://', 'https://'),
      }));
  } catch {
    return [];
  }
}

// ── Main Cover Fetcher ──────────────────────────────────────────────────────

/**
 * For a given series, find as many VALIDATED covers as possible.
 * Returns array of { url, confidence } objects.
 */
async function fetchSeriesCovers(title, writer, publisher, issueCount) {
  const covers = [];
  const seenUrls = new Set();

  const addCover = (url, confidence) => {
    if (!url || seenUrls.has(url)) return;
    seenUrls.add(url);
    covers.push({ url, confidence });
  };

  // Strategy 1: Direct title search on Open Library (validated)
  const olResults = await searchOpenLibrary(`${title} ${publisher} comic`, 30);
  for (const r of olResults) {
    const score = titleMatchScore(title, r.title);
    if (score >= 0.5) {
      addCover(r.url, score);
    }
  }
  await sleep(300);

  // Strategy 2: Search for volumes/trades (gets different covers)
  if (covers.length < 5 && issueCount > 10) {
    const volSearches = ['Vol 1', 'Vol 2', 'Vol 3', 'Vol 4', 'Vol 5'];
    for (const vol of volSearches) {
      if (covers.length >= issueCount) break;
      const volResults = await searchOpenLibrary(`${title} ${vol}`, 10);
      for (const r of volResults) {
        const score = titleMatchScore(title, r.title);
        if (score >= 0.4) {
          addCover(r.url, score * 0.9); // Slightly lower confidence for vol searches
        }
      }
      await sleep(250);
    }
  }

  // Strategy 3: Google Books (different source = different covers)
  if (covers.length < 3) {
    const gbResults = await searchGoogleBooks(`${title} ${publisher} comic book`, 10);
    for (const r of gbResults) {
      const score = titleMatchScore(title, r.title);
      if (score >= 0.4) {
        addCover(r.url, score * 0.85); // Slightly lower confidence for Google
      }
    }
    await sleep(300);
  }

  // Strategy 4: Broader Google Books search if still lacking
  if (covers.length === 0) {
    const gbResults2 = await searchGoogleBooks(`${title} comic`, 10);
    for (const r of gbResults2) {
      const score = titleMatchScore(title, r.title);
      if (score >= 0.3) {
        addCover(r.url, score * 0.7);
      }
    }
    await sleep(300);
  }

  // Strategy 5: Writer-based search as last resort
  if (covers.length === 0 && writer) {
    const writerResults = await searchOpenLibrary(`${title} ${writer}`, 10);
    for (const r of writerResults) {
      const score = titleMatchScore(title, r.title);
      if (score >= 0.3) {
        addCover(r.url, score * 0.6);
      }
    }
    await sleep(300);
  }

  // Sort by confidence (highest first)
  covers.sort((a, b) => b.confidence - a.confidence);

  return covers;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'));
  console.log(`Loaded ${catalog.length} entries\n`);

  // Group by series
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

  console.log(`Found ${seriesMap.size} unique series\n`);

  // Stats
  let totalSeries = 0;
  let seriesWithCovers = 0;
  let totalCovered = 0;
  let totalValidated = 0; // covers with high confidence
  let totalUniqueCovers = 0;

  const failures = [];

  for (const [key, info] of seriesMap) {
    totalSeries++;
    const issueCount = info.indices.length;

    const covers = await fetchSeriesCovers(
      info.title, info.writer, info.publisher, issueCount
    );

    if (covers.length > 0) {
      seriesWithCovers++;
      totalUniqueCovers += covers.length;

      // Count validated (high confidence) covers
      const validated = covers.filter(c => c.confidence >= 0.7).length;
      totalValidated += validated;

      // Distribute covers across issues (cycle through available)
      for (let j = 0; j < info.indices.length; j++) {
        const coverIndex = j % covers.length;
        catalog[info.indices[j]].cover_image = covers[coverIndex].url;
        totalCovered++;
      }

      process.stdout.write(
        `\r[${totalSeries}/${seriesMap.size}] ✅ ${info.title} — ${covers.length} covers (${validated} validated)    `
      );
    } else {
      failures.push(info.title + ' (' + info.publisher + ')');
      // Clear covers for this series (don't keep unvalidated ones)
      for (const idx of info.indices) {
        catalog[idx].cover_image = '';
      }

      process.stdout.write(
        `\r[${totalSeries}/${seriesMap.size}] ❌ ${info.title} — NO COVERS    `
      );
    }
  }

  // Summary
  console.log(`\n\n${'═'.repeat(60)}`);
  console.log(`  COVER FETCH v2 — ACCURACY REPORT`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`  Series total:        ${seriesMap.size}`);
  console.log(`  Series with covers:  ${seriesWithCovers} (${(seriesWithCovers/seriesMap.size*100).toFixed(1)}%)`);
  console.log(`  Unique covers found: ${totalUniqueCovers}`);
  console.log(`  High-confidence:     ${totalValidated} covers validated by title match`);
  console.log(`  Entries covered:     ${totalCovered}/${catalog.length} (${(totalCovered/catalog.length*100).toFixed(1)}%)`);
  console.log(`  Avg covers/series:   ${(totalUniqueCovers/Math.max(seriesWithCovers,1)).toFixed(1)}`);
  console.log(`${'─'.repeat(60)}`);

  if (failures.length > 0) {
    console.log(`  Series without covers (${failures.length}):`);
    failures.forEach(f => console.log(`    - ${f}`));
  }

  console.log(`${'═'.repeat(60)}\n`);

  // Write updated catalog
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog));
  const sizeMB = (fs.statSync(CATALOG_PATH).size / 1024 / 1024).toFixed(2);
  console.log(`Wrote updated catalog (${sizeMB} MB)`);
}

main().catch(console.error);
