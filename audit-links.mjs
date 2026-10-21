import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const html = await readFile('dist/index.html', 'utf8');
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
const links = [...html.matchAll(/<a\b[^>]*\bhref="([^"]*)"[^>]*>/g)];
const assets = [...html.matchAll(/<(?:img|link|script)\b[^>]*(?:src|href)="(assets\/[^"]+|styles\.css|menu\.js)"/g)];
const errors = [];

if (!/<button\b[^>]*\bclass="[^"]*\bpay\b[^"]*"[^>]*\bdisabled\b[^>]*>Pay Online<\/button>/.test(html)) {
  errors.push('Pay Online must be a disabled button without a link.');
}
if (/pay\.vynetrellis\.com/i.test(html)) errors.push('Live payment URL remains on the concept page.');
if ((await readFile('menu.js', 'utf8')) !== (await readFile('dist/menu.js', 'utf8'))) {
  errors.push('Published menu.js differs from its source.');
}
const mainNav = html.match(/<nav id="site-navigation"[^>]*>(.*?)<\/nav>/s)?.[1] ?? '';
for (const target of ['#about', '#services', '#reviews', '#contact']) {
  if (!mainNav.includes(`href="${target}"`)) errors.push(`Main navigation is missing ${target}`);
}

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
