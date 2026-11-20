// uitest.js — testes funcionais da interface (Playwright + SwiftShader).
// uso: node tools/uitest.js [--dist]
// Verifica: deep-link #cap-NN, teclas ←/→, troca de cena sem estado vazado, autoteste, insets compactos,
// camadas/ghost/corte/etapas, captura PNG, tema persistido, Esc no cartão, impressão (folhas = capítulos + capa).
// Saída: JSON com {ok, falhas[], detalhes} e capturas shots/ui_inset_*.png.
const { chromium } = require('playwright');
const path = require('path');

const dist = process.argv.includes('--dist');
const root = path.resolve(__dirname, '..');
const url = 'file://' + path.join(root, dist ? 'dist/atlas.html' : 'index.html');
const GL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

(async () => {
  const fails = [], info = {}, errs = [];
  const check = (cond, msg) => { if (!cond) fails.push(msg); };
  const browser = await chromium.launch({ args: GL_ARGS });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await page.goto(url + '#cap-05');
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 420000 });
  await page.evaluate(() => APP.still());

  // deep-link
  info.deep = await page.evaluate(() => ({ idx: APP.state.idx, n: APP.data.chapters[APP.state.idx].n, title: document.getElementById('chTitle').textContent }));
  check(info.deep.n === '05', 'deep-link #cap-05 não abriu o capítulo 05');

  // teclado
  await page.evaluate(() => document.body.focus());
  await page.keyboard.press('ArrowRight');
  info.afterRight = await page.evaluate(() => ({ n: APP.data.chapters[APP.state.idx].n, hash: location.hash }));
  check(info.afterRight.n === '06', 'ArrowRight não avançou');
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
  info.afterLeft = await page.evaluate(() => APP.data.chapters[APP.state.idx].n);
  check(info.afterLeft === '04', 'ArrowLeft não voltou');

  // estado não vaza entre capítulos: altera tudo e troca de capítulo
  const leak = await page.evaluate(() => {
    const E = APP.E;
    APP.go(2, { animate: false });
    const base = JSON.stringify({ st: { phase: E.state.phase, hand: E.state.handPose, breath: E.state.breath, wire: E.state.wireMal, planes: E.state.showPlanes, roll: E.state.rollMode }, layers: Object.fromEntries(Object.entries(E.layers).map(([k, g]) => [k, g.visible])), clip: E.C.clipPlanes.length });
    document.querySelector('[data-layer="skin"]').click();
    document.getElementById('ghostToggle').click();
    document.querySelector('[data-phase="5"]').click();
    document.getElementById('wireToggle').click();
    document.getElementById('clipToggle').click();
    document.querySelector('[data-roll="ipsilateral"]').click();
    document.getElementById('breathPlay').click();
    APP.go(3, { animate: false }); APP.go(2, { animate: false });
    const again = JSON.stringify({ st: { phase: E.state.phase, hand: E.state.handPose, breath: E.state.breath, wire: E.state.wireMal, planes: E.state.showPlanes, roll: E.state.rollMode }, layers: Object.fromEntries(Object.entries(E.layers).map(([k, g]) => [k, g.visible])), clip: E.C.clipPlanes.length });
    return { same: base === again, anims: Object.values(APP.anims).filter(Boolean).length, ghost: document.getElementById('ghostToggle').checked };
  });
  info.leak = leak;
  check(leak.same && leak.anims === 0, 'estado vazou entre capítulos');

  // controles refletem o motor
  info.controls = await page.evaluate(() => {
    const E = APP.E;
    document.querySelector('[data-phase="3"]').click();
    const r1 = E.state.phase === 3 && document.getElementById('phaseNum').textContent === '3';
    const hr = document.getElementById('handRange'); hr.value = 30; hr.dispatchEvent(new Event('input'));
    const r2 = Math.abs(E.state.handPose - 0.3) < 1e-6;
    document.getElementById('clipToggle').checked = true; document.getElementById('clipToggle').dispatchEvent(new Event('change'));
    const cr = document.getElementById('clipRange'); cr.value = 15; cr.dispatchEvent(new Event('input'));
    const r3 = E.C.clipPlanes.length === 1 && !document.getElementById('clipBadge').hidden && /1,5/.test(document.getElementById('clipOut').textContent);
    document.querySelector('[data-layer="bones"]').click();
    const r4 = E.layers.bones.visible === (document.querySelector('[data-layer="bones"]').getAttribute('aria-pressed') === 'true');
    document.getElementById('sceneReset').click();
    const r5 = E.C.clipPlanes.length === (APP.data.chapters[APP.state.idx].scene.clip ? 1 : 0);
    return { phase: r1, hand: r2, clip: r3, layer: r4, reset: r5 };
  });
  Object.entries(info.controls).forEach(([k, v]) => check(v, 'controle falhou: ' + k));

  // autoteste
  info.quiz = await page.evaluate(() => {
    APP.go(0, { animate: false });
    const q = APP.data.chapters[0].quiz; if (!q) return 'sem quiz';
    document.querySelector(`[data-opt="${q.answer}"]`).click();
    const ok = !!document.querySelector('.quiz-fb.ok') && document.querySelector('.pill[data-i="0"]').classList.contains('answered');
    document.querySelector('[data-retry]').click();
    const wrong = (q.answer + 1) % q.options.length;
    document.querySelector(`[data-opt="${wrong}"]`).click();
    const no = !!document.querySelector('.quiz-fb.no') && document.querySelector('.pill[data-i="0"]').classList.contains('missed');
    return ok && no;
  });
  check(info.quiz === true, 'autoteste não funcionou');

  // insets compactos no painel
  info.insets = await page.evaluate(() => APP.data.chapters.map((c, i) => [i, c.inset]).filter(([, k]) => k));
  for (const [i, k] of info.insets) {
    await page.evaluate((j) => { APP.go(j, { animate: false }); APP.still(); const el = document.querySelector('#painel .inset'); if (el) el.scrollIntoView({ block: 'center' }); }, i);
    const has = await page.evaluate(() => { const el = document.querySelector('#painel .inset'); return el ? el.getBoundingClientRect().height : 0; });
    check(has > 40, 'inset vazio: ' + k);
    const box = await page.evaluate(() => { const r = document.getElementById('painel').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: Math.min(r.height, 900 - r.y) }; });
    await page.screenshot({ path: path.join(root, 'shots', `ui_inset_${k}.png`), clip: box, timeout: 120000 });
  }

  // captura PNG
  info.png = await page.evaluate(async () => { const u = await APP.composeSnapshot(400, 250, { labels: true, fmt: 'image/png' }); return u.slice(0, 22) + '… ' + u.length; });
  check(/^data:image\/png/.test(info.png), 'captura PNG falhou');

  // tema persistido
  await page.click('#btnTheme');
  info.theme = await page.evaluate(() => ({ attr: document.documentElement.getAttribute('data-theme'), saved: localStorage.getItem('atlas-theme') }));
  check(info.theme.attr === 'dark' && info.theme.saved === 'dark', 'tema não persistiu');
  await page.reload();
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 420000 });
  info.themeAfterReload = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  check(info.themeAfterReload === 'dark', 'tema não restaurado após recarregar');
  await page.evaluate(() => { APP.still(); localStorage.removeItem('atlas-theme'); });

  // cartão: abre via glossário e fecha com Esc
  info.card = await page.evaluate(() => { const b = document.querySelector('#glossBody [data-show]'); if (!b) return 'sem botão'; b.click(); return !document.getElementById('card').hidden; });
  await page.keyboard.press('Escape');
  info.cardEsc = await page.evaluate(() => document.getElementById('card').hidden);
  check(info.card === true && info.cardEsc === true, 'cartão (glossário/Esc) falhou');

  // complicação → destaque
  info.comp = await page.evaluate(() => { const b = document.querySelector('#compBody [data-show]'); if (!b) return 'sem'; b.click(); return { id: b.dataset.show, card: document.getElementById('cardName').textContent, active: !!document.querySelector('.comp.active') }; });

  // seções complementares: prancha, ultrassom, checklist, glossário, hashchange, tela cheia
  info.sections = await page.evaluate(async () => {
    const r = {};
    const tg = document.getElementById('pranchaToggle'); tg.click(); r.prancha = document.getElementById('pranchaWrap').classList.contains('off'); tg.click();
    const up = document.getElementById('usgPress'); up.click(); r.usg = document.getElementById('usgWrap').classList.contains('press') && up.getAttribute('aria-pressed') === 'true'; up.click();
    const ck = document.querySelector('[data-ck="0"]'); ck.click(); r.check = /^1\//.test(document.querySelector('.check-count').textContent); document.getElementById('checkReset').click(); r.checkReset = /^0\//.test(document.querySelector('.check-count').textContent);
    const gs = document.getElementById('glossSearch'); gs.value = 'frenico'; gs.dispatchEvent(new Event('input')); await new Promise((res) => setTimeout(res, 300));
    r.search = document.querySelectorAll('#glossBody .gl').length; gs.value = ''; gs.dispatchEvent(new Event('input')); await new Promise((res) => setTimeout(res, 300));
    const before = document.getElementById('glossCount').textContent; document.getElementById('glossLeft').click(); r.left = before !== document.getElementById('glossCount').textContent; document.getElementById('glossLeft').click();
    const n0 = document.querySelectorAll('#glossBody .gl').length; const more = document.getElementById('glossMore'); if (!more.hidden) more.click(); r.more = document.querySelectorAll('#glossBody .gl').length >= n0;
    const fb = document.querySelector('#glossFilters [data-g="Nervos"]'); if (fb) { fb.click(); r.filter = [...document.querySelectorAll('#glossBody .gl-g')].every((e) => /Nervos/.test(e.textContent)); document.querySelector('#glossFilters [data-g="Todos"]').click(); }
    location.hash = '#cap-10'; await new Promise((res) => setTimeout(res, 300)); r.hash = APP.data.chapters[APP.state.idx].n === '10';
    document.getElementById('btnFull').click(); await new Promise((res) => setTimeout(res, 400));
    r.full = document.getElementById('btnFull').getAttribute('aria-pressed') === 'true';
    document.getElementById('fullExit').click(); await new Promise((res) => setTimeout(res, 400));
    r.fullOff = document.getElementById('btnFull').getAttribute('aria-pressed') === 'false';
    return r;
  });
  Object.entries(info.sections).forEach(([k, v]) => check(v === true || (typeof v === 'number' && v > 0), 'seção falhou: ' + k));
  const dl = page.waitForEvent('download', { timeout: 120000 }).catch(() => null);
  await page.evaluate(() => document.getElementById('btnSnap').click());
  const d = await dl; info.download = d ? d.suggestedFilename() : null;
  check(!!info.download && /\.png$/.test(info.download), 'botão de captura não gerou download');

  // impressão (diagramação)
  info.print = await page.evaluate(async () => { await APP.buildPrint({ print: false, placeholder: true }); const sh = [...document.querySelectorAll('#printRoot .sheet')]; return { sheets: sh.length, overflow: sh.filter((s) => s.dataset.fit !== 'ok').length, chapters: APP.data.chapters.length }; });
  check(info.print.sheets === info.print.chapters + 1 && info.print.overflow === 0, 'folhas de impressão incorretas');

  info.missingAnchors = await page.evaluate(() => APP.missingAnchors());
  info.errors = errs.slice(0, 10);
  check(errs.length === 0, 'erros no console: ' + errs.length);
  await browser.close();
  console.log(JSON.stringify({ ok: fails.length === 0, falhas: fails, detalhes: info }, null, 1));
})().catch((e) => { console.log(JSON.stringify({ ok: false, fatal: String(e && e.message || e).split('\n')[0] })); process.exit(1); });
