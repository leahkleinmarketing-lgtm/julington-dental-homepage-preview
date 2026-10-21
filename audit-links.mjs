import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const html = await readFile('dist/index.html', 'utf8');
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
const links = [...html.matchAll(/<a\b[^>]*\bhref="([^"]*)"[^>]*>/g)];
const assets = [...html.matchAll(/<(?:img|link)\b[^>]*(?:src|href)="(assets\/[^"]+|styles\.css)"/g)];
const errors = [];

for (const [, href] of links) {
  if (!href || href === '#') errors.push(`Dead link: ${href || '(empty)'}`);
  else if (/julingtondental\.com/i.test(href)) errors.push(`Existing-site link: ${href}`);
  else if (href.startsWith('#') && !ids.has(href.slice(1))) errors.push(`Missing section: ${href}`);
  else if (!href.startsWith('#') && !/^(https:\/\/|tel:)/.test(href)) errors.push(`Unexpected link: ${href}`);
}

for (const [, asset] of assets) {
  try {
    if (!(await stat(resolve('dist', asset))).isFile()) errors.push(`Missing asset: ${asset}`);
  } catch {
    errors.push(`Missing asset: ${asset}`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Checked ${links.length} links and ${assets.length} local assets; all internal targets resolve and no links point to julingtondental.com.`);
  console.log([...new Set(links.map(([, href]) => href))].join('\n'));
}
