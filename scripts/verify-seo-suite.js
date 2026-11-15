/**
 * RAGHUL AI — COMPREHENSIVE SEO & DISCOVERY AUDIT SUITE
 * Validates Technical SEO, Robots Directives, Sitemap, Open Graph, Twitter Cards,
 * Structured Data (JSON-LD), Asset Compression, and Heading Structure.
 */

import * as cheerio from 'cheerio';
import http from 'http';

const BASE_URL = 'http://localhost:3000';
let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function assert(condition, message, details = '') {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    failedChecks++;
    console.error(`  ❌ [FAIL] ${message} - ${details}`);
  }
}

async function fetchUrl(urlPath, headers = {}) {
  const url = `${BASE_URL}${urlPath}`;
  const res = await fetch(url, { headers });
  const text = await res.text();
  return {
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    body: text
  };
}

async function runSeoSuite() {
  console.log('================================================================');
  console.log('🔍 RAGHUL AI — COMPREHENSIVE PRODUCTION SEO & METADATA AUDIT');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // 1. Robots.txt Verification (RFC 9309)
  // ---------------------------------------------------------------------------
  console.log('--- 1. Robots.txt Technical Verification ---');
  const robots = await fetchUrl('/robots.txt');
  assert(robots.status === 200, 'GET /robots.txt returns HTTP 200');
  assert(robots.headers['content-type']?.includes('text/plain'), 'Content-Type is text/plain');
  assert(robots.body.includes('User-agent: *'), 'Declares User-agent: *');
  assert(robots.body.includes('Allow: /'), 'Allows public root crawling');
  assert(robots.body.includes('Disallow: /os'), 'Disallows private /os dashboard');
  assert(robots.body.includes('Disallow: /api/'), 'Disallows private backend /api/ endpoints');
  assert(robots.body.includes('Sitemap: https://raghulraja.is-a.dev/sitemap.xml'), 'Includes canonical Sitemap declaration');

  // ---------------------------------------------------------------------------
  // 2. XML Sitemap Verification (Sitemap Schema 0.9)
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. XML Sitemap Verification ---');
  const sitemap = await fetchUrl('/sitemap.xml');
  assert(sitemap.status === 200, 'GET /sitemap.xml returns HTTP 200');
  assert(sitemap.headers['content-type']?.includes('xml'), 'Content-Type is XML');
  assert(sitemap.body.includes('<urlset') && sitemap.body.includes('sitemaps.org/schemas/sitemap/0.9'), 'Declares valid XML Schema 0.9');
  assert(sitemap.body.includes('<loc>https://raghulraja.is-a.dev/</loc>'), 'Contains canonical production homepage URL');
  assert(sitemap.body.includes('<changefreq>daily</changefreq>'), 'Contains changefreq daily');
  assert(sitemap.body.includes('<priority>1.0</priority>'), 'Contains priority 1.0');
  assert(!sitemap.body.includes('/os') && !sitemap.body.includes('/api'), 'Zero private or internal URLs in public sitemap');

  // ---------------------------------------------------------------------------
  // 3. Homepage HTML Document & Technical SEO Inspection
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Homepage HTML Document & Metadata Inspection ---');
  const home = await fetchUrl('/');
  assert(home.status === 200, 'GET / returns HTTP 200');
  
  const $ = cheerio.load(home.body);

  // Document language & doctype
  assert($('html').attr('lang') === 'en', 'HTML lang attribute set to "en"');
  assert($('meta[charset]').attr('charset')?.toLowerCase() === 'utf-8', 'Meta charset is UTF-8');
  assert(Boolean($('meta[name="viewport"]').attr('content')), 'Viewport meta tag configured with mobile responsiveness');

  // Title & Description
  const title = $('title').text().trim();
  assert(title.includes('Raghul AI'), `Page title contains "Raghul AI" (Title: "${title}")`);
  assert(title.length >= 20 && title.length <= 80, `Page title length optimal (${title.length} chars, standard: 30-70)`);

  const metaDesc = $('meta[name="description"]').attr('content');
  assert(Boolean(metaDesc) && metaDesc.includes('Raghul AI'), 'Meta description exists and mentions brand');
  assert(metaDesc.length >= 70 && metaDesc.length <= 180, `Meta description length optimal (${metaDesc.length} chars, standard: 120-160)`);

  // Canonical Tag
  const canonical = $('link[rel="canonical"]').attr('href');
  assert(canonical === 'https://raghulraja.is-a.dev/', `Canonical URL matches production domain: "${canonical}"`);

  // Robots Directive on Homepage
  const robotsMeta = $('meta[name="robots"]').attr('content');
  assert(robotsMeta && robotsMeta.includes('index') && robotsMeta.includes('follow'), `Homepage robots meta allows index and follow ("${robotsMeta}")`);

  // Open Graph Metadata
  console.log('\n--- 4. Open Graph & Social Sharing Verification ---');
  assert($('meta[property="og:site_name"]').attr('content') === 'Raghul AI', 'og:site_name matches "Raghul AI"');
  assert(Boolean($('meta[property="og:title"]').attr('content')), 'og:title present');
  assert(Boolean($('meta[property="og:description"]').attr('content')), 'og:description present');
  assert($('meta[property="og:type"]').attr('content') === 'website', 'og:type is "website"');
  assert($('meta[property="og:url"]').attr('content') === 'https://raghulraja.is-a.dev/', 'og:url matches canonical domain');
  
  const ogImage = $('meta[property="og:image"]').attr('content');
  assert(ogImage && ogImage.includes('raghul_ai_og_banner'), `og:image references banner asset: "${ogImage}"`);
  assert($('meta[property="og:image:width"]').attr('content') === '1200', 'og:image:width declared (1200)');
  assert($('meta[property="og:image:height"]').attr('content') === '630', 'og:image:height declared (630)');

  // Twitter Card Metadata
  assert($('meta[name="twitter:card"]').attr('content') === 'summary_large_image', 'twitter:card set to summary_large_image');
  assert($('meta[name="twitter:site"]').attr('content') === '@raghul692', 'twitter:site set to @raghul692');
  assert($('meta[name="twitter:creator"]').attr('content') === '@raghul692', 'twitter:creator set to @raghul692');
  assert(Boolean($('meta[name="twitter:image"]').attr('content')), 'twitter:image declared');

  // Favicons & Mobile Web App
  assert(Boolean($('link[rel="icon"]').attr('href')), 'Favicon icon link present');
  assert(Boolean($('link[rel="apple-touch-icon"]').attr('href')), 'Apple touch icon link present');
  assert($('meta[name="theme-color"]').attr('content') === '#0a0d14', 'theme-color declared (#0a0d14)');

  // JSON-LD Structured Data
  console.log('\n--- 5. JSON-LD Structured Data Verification ---');
  const jsonLdScript = $('script[type="application/ld+json"]').html();
  assert(Boolean(jsonLdScript), 'JSON-LD structured data block present');
  if (jsonLdScript) {
    try {
      const parsedLd = JSON.parse(jsonLdScript);
      assert(parsedLd['@context'] === 'https://schema.org', 'Schema.org context verified');
      assert(parsedLd['@type'] === 'WebApplication', 'Schema @type is WebApplication');
      assert(parsedLd.name === 'Raghul AI Assistant', 'Schema name is Raghul AI Assistant');
      assert(parsedLd.author?.name === 'Raghul Raja M', 'Schema author is Raghul Raja M');
      assert(Array.isArray(parsedLd.featureList) && parsedLd.featureList.length >= 4, `Schema declares ${parsedLd.featureList?.length} core capabilities`);
    } catch (e) {
      assert(false, 'JSON-LD is valid JSON', e.message);
    }
  }

  // ---------------------------------------------------------------------------
  // 6. Private Route SEO Protection (/os and /portfolio-os)
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. Private Route Search Isolation Verification ---');
  const osPage = await fetchUrl('/os');
  assert(osPage.status === 200, 'GET /os returns HTTP 200');
  const $os = cheerio.load(osPage.body);
  const osRobots = $os('meta[name="robots"]').attr('content');
  assert(osRobots && osRobots.includes('noindex') && osRobots.includes('nofollow'), `Private Dashboard has noindex, nofollow ("${osRobots}")`);

  // ---------------------------------------------------------------------------
  // 7. Core Static Asset Performance & Caching
  // ---------------------------------------------------------------------------
  console.log('\n--- 7. Asset Caching & Header Verification ---');
  const cssAsset = await fetchUrl('/style.css?v=20261114_audit_v4');
  assert(cssAsset.status === 200, 'GET /style.css returns HTTP 200');
  assert(Boolean(cssAsset.headers['etag']), 'Static asset returns ETag for cache revalidation');
  assert(cssAsset.headers['cache-control']?.includes('max-age'), `Cache-Control configured: "${cssAsset.headers['cache-control']}"`);

  // Open Graph Banner Asset Accessibility
  const ogBannerRes = await fetchUrl('/assets/raghul_ai_og_banner.png');
  assert(ogBannerRes.status === 200, 'GET /assets/raghul_ai_og_banner.png returns HTTP 200');
  assert(ogBannerRes.headers['content-type']?.includes('image'), `Banner Content-Type is image/png: "${ogBannerRes.headers['content-type']}"`);

  // ---------------------------------------------------------------------------
  // 8. Broken Internal Link & Asset Check
  // ---------------------------------------------------------------------------
  console.log('\n--- 8. Internal Asset & Link Integrity Check ---');
  const internalAssets = [
    '/assets/raghul_ai_app_icon_circle.png',
    '/assets/raghul_profile.jpg',
    '/style.css',
    '/app.js',
    '/studioIde.js',
    '/robots.txt',
    '/sitemap.xml'
  ];

  for (const assetPath of internalAssets) {
    const res = await fetchUrl(assetPath);
    assert(res.status === 200, `Internal asset "${assetPath}" resolves with HTTP 200`);
  }

  // ---------------------------------------------------------------------------
  // Audit Summary
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`📊 SEO AUDIT SUMMARY: ${passedChecks} / ${totalChecks} Checks Passed (${failedChecks} Failed)`);
  console.log('================================================================');

  if (failedChecks > 0) {
    console.error(`❌ SEO audit failed with ${failedChecks} failing checks.`);
    process.exit(1);
  } else {
    console.log('🎉 100% SEO, robots, sitemap, Open Graph, and metadata checks PASSED.');
    process.exit(0);
  }
}

runSeoSuite().catch(err => {
  console.error('Fatal SEO audit error:', err);
  process.exit(1);
});
