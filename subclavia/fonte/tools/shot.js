// uso: node tools/shot.js "<query>" out.png [largura altura]
// ex.: node tools/shot.js "mods=skeleton&layers=bones&view=front" shots/sk.png 1100 900
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [query = '', out = 'shot.png', w = '1100', h = '850'] = process.argv.slice(2);
  const root = path.resolve(__dirname, '..');
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' || t.startsWith('PICK') || t.startsWith('[atlas]')) logs.push(m.type() + ': ' + t); });
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message));
  await page.goto('file://' + root + '/dev.html?' + query, { timeout: 240000, waitUntil: 'commit' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 }).catch(() => logs.push('TIMEOUT'));
  await page.waitForTimeout(400);
  const info = await page.evaluate(() => window.__info || { fatal: window.__fatal });
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: +w, height: +h } });
  console.log(JSON.stringify(info));
  if (logs.length) console.log(logs.slice(0, 30).join('\n'));
  await browser.close();
})();
