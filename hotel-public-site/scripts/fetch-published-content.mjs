#!/usr/bin/env node
/**
 * Build-Time Content Fetcher for Public Hotel Website (Netlify Build Step)
 *
 * Fetches the latest published website snapshot from the private CRM export endpoint
 * during `npm run build` on Netlify, validates the structure, and writes a static
 * JSON artifact (`src/generated/published-site-data.json`) plus `public/robots.txt`
 * and `public/sitemap.xml`.
 *
 * Security Guarantees:
 * - Reads PUBLIC_SITE_EXPORT_API_URL and PUBLIC_SITE_EXPORT_TOKEN from server-side build env.
 * - Rejects VITE_ or REACT_APP_ prefixed secret exposures.
 * - Never logs tokens or writes credentials into generated files.
 * - Fails the Netlify build with exit code 1 if fetching or validation fails so that
 *   Netlify preserves the last working public deployment.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const GENERATED_DIR = path.join(ROOT_DIR, 'src', 'generated');
const OUTPUT_JSON_PATH = path.join(GENERATED_DIR, 'published-site-data.json');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

const MAX_RETRIES = 3;
const TIMEOUT_MS = 20000; // 20s per attempt to accommodate Render cold-start wakeups

function logInfo(msg) {
  console.log(`[PublicSiteBuild] ${msg}`);
}

function logError(msg) {
  console.error(`[PublicSiteBuild ERROR] ${msg}`);
}

// 1. Security Check: Ensure secrets were not accidentally exposed with VITE_ or REACT_APP_ prefixes
if (
  process.env.VITE_PUBLIC_SITE_EXPORT_TOKEN ||
  process.env.REACT_APP_PUBLIC_SITE_EXPORT_TOKEN ||
  process.env.VITE_CRM_PUBLIC_EXPORT_TOKEN ||
  process.env.REACT_APP_CRM_PUBLIC_EXPORT_TOKEN
) {
  logError(
    'SECURITY VIOLATION: Do not define the export token with a VITE_ or REACT_APP_ prefix! Configure it only as PUBLIC_SITE_EXPORT_TOKEN or CRM_PUBLIC_EXPORT_TOKEN in Netlify Environment Variables.'
  );
  process.exit(1);
}

function normalizeExportUrl(rawUrl) {
  const trimmed = (rawUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (trimmed.endsWith('/api/public-site/export')) {
    return trimmed;
  }
  if (trimmed.endsWith('/api')) {
    return `${trimmed}/public-site/export`;
  }
  return `${trimmed}/api/public-site/export`;
}

const rawExportUrl =
  process.env.PUBLIC_SITE_EXPORT_API_URL ||
  process.env.CRM_PUBLIC_EXPORT_URL ||
  '';
const exportApiUrl = normalizeExportUrl(rawExportUrl);
const exportToken = (
  process.env.PUBLIC_SITE_EXPORT_TOKEN ||
  process.env.CRM_PUBLIC_EXPORT_TOKEN ||
  ''
).trim();
const isNetlifyCi = process.env.NETLIFY === 'true';

/**
 * Validates that the fetched snapshot contains only expected public website structures
 * and has not been corrupted.
 */
function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new Error('Snapshot payload is missing or not an object.');
  }
  if (snapshot.schema_version !== '1.0') {
    throw new Error(`Unsupported snapshot schema_version: ${snapshot.schema_version}`);
  }
  if (!snapshot.hotel || typeof snapshot.hotel !== 'object') {
    throw new Error('Snapshot is missing required "hotel" object.');
  }
  if (!snapshot.homepage || typeof snapshot.homepage !== 'object') {
    throw new Error('Snapshot is missing required "homepage" object.');
  }
  if (!Array.isArray(snapshot.rooms) || !Array.isArray(snapshot.facilities) || !Array.isArray(snapshot.gallery) || !Array.isArray(snapshot.faqs)) {
    throw new Error('Snapshot is missing required array collections (rooms, facilities, gallery, or faqs).');
  }

  // Ensure no private CRM keys ever exist in the payload
  const forbiddenKeys = ['clients', 'passport_number', 'applications', 'invoices', 'users', 'password_hash', 'token'];
  for (const key of forbiddenKeys) {
    if (key in snapshot) {
      throw new Error(`Security validation failed: Forbidden key "${key}" detected in snapshot.`);
    }
  }
  return true;
}

/**
 * Generates robots.txt and sitemap.xml in public/ from the validated snapshot
 */
function writeSeoStaticFiles(snapshot) {
  try {
    if (!fs.existsSync(PUBLIC_DIR)) {
      fs.mkdirSync(PUBLIC_DIR, { recursive: true });
    }

    const seo = snapshot.seo || {};
    const canonical = (seo.canonical_domain || '').replace(/\/+$/, '');
    const disallowAll = seo.robots_indexing && seo.robots_indexing.includes('noindex');

    const robotsLines = [
      'User-agent: *',
      disallowAll ? 'Disallow: /' : 'Allow: /',
    ];
    if (canonical && seo.sitemap_enabled !== false && !disallowAll) {
      robotsLines.push(`Sitemap: ${canonical}/sitemap.xml`);
    }
    fs.writeFileSync(path.join(PUBLIC_DIR, 'robots.txt'), robotsLines.join('\n') + '\n', 'utf-8');

    if (seo.sitemap_enabled !== false && canonical) {
      const lastMod = (snapshot.published_at || new Date().toISOString()).slice(0, 10);
      const urls = [
        `${canonical}/`,
      ];
      const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`;
      fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap.xml'), sitemapXml, 'utf-8');
    }
  } catch (err) {
    logInfo(`Non-fatal warning generating robots.txt/sitemap.xml: ${err.message}`);
  }
}

async function fetchWithRetries(url, token) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      logInfo(`Fetching published snapshot from CRM export endpoint: ${url} (Attempt ${attempt}/${MAX_RETRIES})...`);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Public-Export-Token': token,
          Accept: 'application/json',
          'User-Agent': 'Netlify-PublicHotelSite-Builder/1.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timer);

      // If 404 (no snapshot published yet in CRM) and we have the initial unconfigured placeholder,
      // allow the first-time Netlify setup deploy to succeed with the "Setup Pending" screen.
      if (response.status === 404 && fs.existsSync(OUTPUT_JSON_PATH)) {
        const existing = JSON.parse(fs.readFileSync(OUTPUT_JSON_PATH, 'utf-8'));
        if (existing && existing.published_version === 0) {
          logInfo(
            'CRM reported 404 (no snapshot published yet). Using initial "Setup Pending" snapshot so your first Netlify deploy succeeds.'
          );
          validateSnapshot(existing);
          return existing;
        }
      }

      if (!response.ok) {
        let errorDetail = `HTTP ${response.status}`;
        try {
          const errJson = await response.json();
          if (errJson && errJson.error) errorDetail += ` — ${errJson.error}`;
        } catch {}
        throw new Error(`Export endpoint rejected request: ${errorDetail}`);
      }

      const data = await response.json();
      if (!data || !data.snapshot) {
        throw new Error('Response JSON did not contain a "snapshot" object.');
      }

      validateSnapshot(data.snapshot);
      return data.snapshot;
    } catch (err) {
      lastError = err;
      logError(`Attempt ${attempt} failed: ${err.message}`);
      if (attempt < MAX_RETRIES) {
        const backoffMs = attempt * 3000;
        logInfo(`Waiting ${backoffMs / 1000}s before retrying...`);
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }
  }

  throw lastError || new Error('Failed to fetch published website snapshot.');
}

async function main() {
  if (!fs.existsSync(GENERATED_DIR)) {
    fs.mkdirSync(GENERATED_DIR, { recursive: true });
  }

  // Case A: Running on Netlify CI or when export credentials are provided
  if (exportApiUrl || exportToken || isNetlifyCi) {
    if (!exportApiUrl) {
      logError(
        'Missing CRM_PUBLIC_EXPORT_URL (or PUBLIC_SITE_EXPORT_API_URL) environment variable. Configure it in Netlify -> Site configuration -> Environment variables.'
      );
      process.exit(1);
    }
    if (!exportToken || exportToken.length < 12) {
      logError(
        'Missing or invalid CRM_PUBLIC_EXPORT_TOKEN (or PUBLIC_SITE_EXPORT_TOKEN) environment variable (must be at least 12 characters).'
      );
      process.exit(1);
    }

    try {
      const snapshot = await fetchWithRetries(exportApiUrl, exportToken);
      fs.writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(snapshot, null, 2), 'utf-8');
      writeSeoStaticFiles(snapshot);
      logInfo(
        `Successfully wrote validated published snapshot v${snapshot.published_version} (${snapshot.hotel.name || 'Setup Pending'}) to src/generated/published-site-data.json`
      );
      process.exit(0);
    } catch (err) {
      logError(`Build aborted to protect live website: ${err.message}`);
      process.exit(1);
    }
  }

  // Case B: Local offline build verification when env vars are not set
  if (fs.existsSync(OUTPUT_JSON_PATH)) {
    logInfo(
      'Export URL not set in local environment; using existing src/generated/published-site-data.json for local build verification.'
    );
    const existing = JSON.parse(fs.readFileSync(OUTPUT_JSON_PATH, 'utf-8'));
    validateSnapshot(existing);
    writeSeoStaticFiles(existing);
    process.exit(0);
  } else {
    logError('No published-site-data.json found and CRM_PUBLIC_EXPORT_URL is not configured.');
    process.exit(1);
  }
}

main();
