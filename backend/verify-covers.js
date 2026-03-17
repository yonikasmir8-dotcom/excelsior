#!/usr/bin/env node
/**
 * verify-covers.js
 *
 * Verifies cover images in seed-catalog.json by:
 *   1. Sampling cover URLs per series and checking they return real images
 *   2. Looking up the Open Library cover ID to verify the linked work title-matches our series
 *   3. Flagging series with bad covers (404s, placeholders, title mismatches)
 *   4. Attempting more-specific searches for series with bad covers
 *   5. Updating seed-catalog.json with verified/corrected covers
 *
 * Rate-limited to ~2 requests/second.
 * Run: node verify-covers.js
 */

const fs = require('fs');
const path = require('path');

const CATALOG_PATH = path.join(__dirname, 'seed-catalog.json');
const RATE_LIMIT_MS = 500; // ~2 req/sec
const SAMPLE_SIZE = 3; // covers to sample per series
const HEAD_TIMEOUT = 8000;
const FETCH_TIMEOUT = 12000;

// ── Helpers ──────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Extract significant words from a title for fuzzy matching.
 * Strips articles, parenthetical year tags, and short words.
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
 * Check if `candidateTitle` is a reasonable match for our `seriesTitle`.
 * At least half the significant words from our title must appear in the candidate.
 */
function titleMatches(seriesTitle, candidateTitle) {
  const ourWords = significantWords(seriesTitle);
  if (ourWords.length === 0) return true; // can't validate, assume OK
  const candidateLower = candidateTitle.toLowerCase();
  const matched = ourWords.filter(w => candidateLower.includes(w));
  return matched.length >= Math.ceil(ourWords.length / 2);
}

/**
 * HEAD request to check a cover URL returns an actual image.
 * Returns { ok, contentType, status, redirected, url }
 */
async function checkCoverUrl(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEAD_TIMEOUT);
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal, redirect: 'follow' });
    clearTimeout(timeout);

    const ct = res.headers.get('content-type') || '';
    const cl = parseInt(res.headers.get('content-length') || '0', 10);

    // Open Library returns a tiny 1x1 placeholder for missing covers
    // Typically < 1000 bytes. Real covers are > 5KB.
    const isPlaceholder = cl > 0 && cl < 2000;
    const isImage = ct.startsWith('image/');

    return {
      ok: res.ok && isImage && !isPlaceholder,
      status: res.status,
      contentType: ct,
      contentLength: cl,
      isPlaceholder,
      finalUrl: res.url
    };
  } catch (e) {
    return { ok: false, status: 0, contentType: '', contentLength: 0, isPlaceholder: false, finalUrl: url, error: e.message };
  }
}

/**
 * Given an Open Library cover ID, look up the associated work and return its title.
 * Cover IDs map to editions; we fetch the edition then its work.
 */
async function lookupCoverTitle(coverId) {
  try {
    // Search for books with this cover_i
    const url = `https://openlibrary.org/search.json?q=cover_i:${coverId}&fields=title&limit=1`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const data = await res.json();
    if (data.docs && data.docs.length > 0) {
      return data.docs[0].title || null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract cover ID from an Open Library cover URL.
 * URL format: https://covers.openlibrary.org/b/id/12345-M.jpg
 */
function extractCoverId(url) {
  const m = url.match(/\/b\/id\/(\d+)-/);
  return m ? m[1] : null;
}

/**
 * More-specific cover search for a series with bad covers.
 * Uses Open Library title search with publisher context.
 * Returns array of validated cover URLs.
 */
async function searchBetterCovers(seriesTitle, publisher, limit = 40) {
  const coverIds = new Set();

  const queries = [
    { type: 'title', url: `https://openlibrary.org/search.json?title=${encodeURIComponent(seriesTitle)}&fields=cover_i,title&limit=100` },
    { type: 'q', url: `https://openlibrary.org/search.json?q=${encodeURIComponent(seriesTitle + ' ' + publisher + ' comic')}&fields=cover_i,title&limit=100` },
    { type: 'q', url: `https://openlibrary.org/search.json?q=${encodeURIComponent(seriesTitle + ' comic book')}&fields=cover_i,title&limit=100` },
  ];

  for (const query of queries) {
    if (coverIds.size >= limit) break;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
      const res = await fetch(query.url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) { await sleep(RATE_LIMIT_MS); continue; }
      const data = await res.json();

      for (const doc of (data.docs || [])) {
        if (!doc.cover_i) continue;
        if (coverIds.has(doc.cover_i)) continue;

        // Title validation: returned doc title must match our series
        if (doc.title && !titleMatches(seriesTitle, doc.title)) continue;

        coverIds.add(doc.cover_i);
        if (coverIds.size >= limit) break;
      }
    } catch {
      // network error, continue
    }

    await sleep(RATE_LIMIT_MS);
  }

  return [...coverIds].map(id => `https://covers.openlibrary.org/b/id/${id}-M.jpg`);
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'));
  console.log(`Loaded ${catalog.length} entries from seed-catalog.json`);

  // Group entries by series
  const seriesMap = new Map();
  for (let i = 0; i < catalog.length; i++) {
    const entry = catalog[i];
    const key = `${entry.title}|||${entry.publisher}|||${entry.writer}`;
    if (!seriesMap.has(key)) {
      seriesMap.set(key, {
        title: entry.title,
        writer: entry.writer,
        publisher: entry.publisher,
        indices: [],
        covers: new Set()
      });
    }
    const info = seriesMap.get(key);
    info.indices.push(i);
    if (entry.cover_image) info.covers.add(entry.cover_image);
  }

  console.log(`Found ${seriesMap.size} unique series\n`);

  // Phase 1: Verify existing covers
  console.log('=== Phase 1: Verifying existing covers ===\n');

  const results = {
    verified: [],    // series with good covers
    bad: [],         // series with bad covers
    noCover: [],     // series with no covers at all
  };

  let checked = 0;
  for (const [key, info] of seriesMap) {
    checked++;
    const pct = (checked / seriesMap.size * 100).toFixed(0);

    const coverUrls = [...info.covers];

    if (coverUrls.length === 0) {
      results.noCover.push({ key, info, reason: 'no cover URL' });
      process.stdout.write(`\r[${pct}%] ${checked}/${seriesMap.size} | ${info.title} — NO COVER`);
      continue;
    }

    // Sample up to SAMPLE_SIZE covers
    const sample = coverUrls.slice(0, SAMPLE_SIZE);
    let urlOk = 0;
    let titleOk = 0;
    let titleChecked = 0;
    const issues = [];

    for (const url of sample) {
      // Check URL returns a real image
      const check = await checkCoverUrl(url);
      await sleep(RATE_LIMIT_MS);

      if (!check.ok) {
        issues.push(`URL fail (status=${check.status}, ct=${check.contentType}, placeholder=${check.isPlaceholder}): ${url}`);
      } else {
        urlOk++;
      }

      // Check title match via cover ID lookup (only for first cover to save requests)
      if (titleChecked === 0) {
        const coverId = extractCoverId(url);
        if (coverId) {
          const olTitle = await lookupCoverTitle(coverId);
          await sleep(RATE_LIMIT_MS);
          titleChecked++;

          if (olTitle) {
            if (titleMatches(info.title, olTitle)) {
              titleOk++;
            } else {
              issues.push(`Title mismatch: series="${info.title}" but cover linked to "${olTitle}"`);
            }
          }
          // null means couldn't look up — don't count as failure
        }
      }
    }

    const isGood = urlOk === sample.length && issues.length === 0;

    if (isGood) {
      results.verified.push({ key, info });
      process.stdout.write(`\r[${pct}%] ${checked}/${seriesMap.size} | ${info.title} — OK (${urlOk}/${sample.length} urls good)         `);
    } else {
      results.bad.push({ key, info, issues });
      process.stdout.write(`\r[${pct}%] ${checked}/${seriesMap.size} | ${info.title} — BAD (${issues.length} issues)         `);
    }
  }

  console.log('\n');

  // Phase 1 Summary
  console.log('=== Phase 1 Summary ===');
  console.log(`Verified OK:   ${results.verified.length}/${seriesMap.size}`);
  console.log(`Bad covers:    ${results.bad.length}/${seriesMap.size}`);
  console.log(`No covers:     ${results.noCover.length}/${seriesMap.size}`);

  if (results.bad.length > 0) {
    console.log('\nSeries with bad covers:');
    for (const { info, issues } of results.bad) {
      console.log(`  ${info.title} (${info.publisher}, ${info.writer})`);
      for (const issue of issues) {
        console.log(`    - ${issue}`);
      }
    }
  }

  if (results.noCover.length > 0) {
    console.log('\nSeries with no covers:');
    for (const { info } of results.noCover) {
      console.log(`  ${info.title} (${info.publisher}, ${info.writer})`);
    }
  }

  // Phase 2: Fix bad/missing covers
  const toFix = [...results.bad, ...results.noCover];

  if (toFix.length === 0) {
    console.log('\nAll series covers verified! No fixes needed.');
    return;
  }

  console.log(`\n=== Phase 2: Searching better covers for ${toFix.length} series ===\n`);

  let fixed = 0;
  let stillBad = 0;

  for (let i = 0; i < toFix.length; i++) {
    const { info } = toFix[i];
    const pct = ((i + 1) / toFix.length * 100).toFixed(0);

    process.stdout.write(`\r[${pct}%] ${i + 1}/${toFix.length} | Searching: ${info.title}...         `);

    const issueCount = info.indices.length;
    const newCovers = await searchBetterCovers(info.title, info.publisher, Math.min(issueCount, 40));

    if (newCovers.length > 0) {
      // Verify at least the first cover URL actually works
      const firstCheck = await checkCoverUrl(newCovers[0]);
      await sleep(RATE_LIMIT_MS);

      if (firstCheck.ok) {
        // Distribute new covers across issues
        for (let j = 0; j < info.indices.length; j++) {
          const coverIndex = j % newCovers.length;
          catalog[info.indices[j]].cover_image = newCovers[coverIndex];
        }
        fixed++;
        process.stdout.write(`\r[${pct}%] ${i + 1}/${toFix.length} | FIXED: ${info.title} (${newCovers.length} covers)         `);
      } else {
        stillBad++;
        process.stdout.write(`\r[${pct}%] ${i + 1}/${toFix.length} | STILL BAD: ${info.title} (covers don't load)         `);
      }
    } else {
      stillBad++;
      process.stdout.write(`\r[${pct}%] ${i + 1}/${toFix.length} | NO REPLACEMENT: ${info.title}         `);
    }
  }

  console.log('\n');

  // Final summary
  console.log('=== Final Summary ===');
  console.log(`Originally verified: ${results.verified.length}/${seriesMap.size}`);
  console.log(`Fixed in Phase 2:    ${fixed}/${toFix.length}`);
  console.log(`Still problematic:   ${stillBad}/${toFix.length}`);
  console.log(`Total now verified:  ${results.verified.length + fixed}/${seriesMap.size}`);

  // Write updated catalog
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 0));
  const sizeMB = (fs.statSync(CATALOG_PATH).size / 1024 / 1024).toFixed(2);
  console.log(`\nWrote updated catalog (${sizeMB} MB)`);
}

main().catch(err => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
