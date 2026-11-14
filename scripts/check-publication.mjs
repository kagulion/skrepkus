import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, sep } from 'node:path';

const root = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const site = new URL('https://skrepkus.ayku.ru/');
asset('404.html');
asset('_headers');
const pages = ['', 'about/'];

function asset(path) {
  const full = resolve(root, path);
  assert(full.startsWith(root + sep), `Path outside dist: ${path}`);
  assert(existsSync(full), `Missing published file: ${path}`);
  return full;
}

function meta(html, property) {
  const matches = [...html.matchAll(/<meta\s+([^>]+)>/g)].filter((match) =>
    match[1].includes(`="${property}"`),
  );
  assert.equal(matches.length, 1, `Expected one ${property} tag`);
  return matches[0][1].match(/content="([^"]+)"/)?.[1];
}

for (const page of pages) {
  const html = readFileSync(asset(`${page}index.html`), 'utf8');
  const pageUrl = new URL(page, site).href;
  assert.equal(meta(html, 'og:url'), pageUrl);
  assert(html.includes(`<link rel="canonical" href="${pageUrl}"`), `Wrong canonical URL: ${page}`);
  assert(meta(html, 'description'), `Missing description: ${page}`);
  assert(meta(html, 'og:title'), `Missing sharing title: ${page}`);
  assert(meta(html, 'og:description'), `Missing sharing description: ${page}`);
  assert.equal(meta(html, 'twitter:card'), 'summary_large_image');
  const imageUrl = new URL('social/paperclips.png', site);
  assert.equal(meta(html, 'og:image'), imageUrl.href);
  assert.equal(meta(html, 'twitter:image'), imageUrl.href);
  assert(meta(html, 'og:image:alt'), `Missing image description: ${page}`);
  const png = readFileSync(asset('social/paperclips.png'));
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
  assert.equal(meta(html, 'og:image:width'), '1200');
  assert.equal(meta(html, 'og:image:height'), '630');

  for (const [, reference] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const url = new URL(reference, pageUrl);
    if (url.origin !== site.origin) continue;
    const path = decodeURIComponent(url.pathname).replace(/^\//, '');
    asset(url.pathname.endsWith('/') ? `${path}index.html` : path);
  }
  console.log(`${page}index.html: metadata, preview image and local links OK`);
}

for (const file of ['project-mit.txt', 'third-party-notices.txt', 'ibm-plex-mono.txt']) {
  asset(`licenses/${file}`);
}
const sitemap = readFileSync(asset('sitemap.xml'), 'utf8');
for (const page of pages) {
  assert(sitemap.includes(`<loc>${new URL(page, site).href}</loc>`));
}
assert(readFileSync(asset('robots.txt'), 'utf8').includes(`Sitemap: ${new URL('sitemap.xml', site).href}`));
console.log('Sitemap, robots.txt and license notices OK');
