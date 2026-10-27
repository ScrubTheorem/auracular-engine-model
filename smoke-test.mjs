// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 ScrubTheorem
// Smoke test: the page loads, draws the scene, runs a guided flow, and throws no page errors.
// Usage: npm i playwright && npx playwright install chromium && node smoke-test.mjs
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.md': 'text/markdown', '.txt': 'text/plain' };
const server = createServer(async (req, res) => {
  const path = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  try {
    const body = await readFile(join(root, path));
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const port = server.address().port;

const failures = [];
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); if (!ok) failures.push(name); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|fonts\.g/.test(m.text())) errors.push(m.text()); });
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());

await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(1500);

const labels = await page.$$eval('.lbl', els => els.length);
check('scene draws labels', labels >= 50, `(${labels} labels)`);
const flows = await page.$$eval('.flow', els => els.length);
check('eight guided flows listed', flows === 8, `(${flows})`);
const canvas = await page.$('#stage canvas');
check('WebGL canvas present', !!canvas);

await (await page.$('.flow')).click();
await page.waitForTimeout(600);
const step = await page.innerText('#nStep');
check('flow advances to step 1', step.startsWith('1 /'), `(${step})`);

await page.click('#bView');
await page.waitForTimeout(400);
check('reset view button responds', true);

check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
server.close();
console.log(failures.length ? `\n${failures.length} check(s) failed` : '\nAll checks passed');
process.exit(failures.length ? 1 : 0);
