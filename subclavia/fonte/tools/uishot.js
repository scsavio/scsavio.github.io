// uishot.js — capturas e verificações automáticas da interface (Playwright + SwiftShader).
// uso: node tools/uishot.js [--dist] [--sample] [--only=desktop,chapters,card,dark,print,mobile,checks,widths,material]
//                           [--chapters=all|1,5,9] [--prefix=ui] [--pdf] [--fastprint] [--dsf=1]
//   --fastprint folhas de impressão com ilustração neutra (testa só a diagramação)
//   --dist     abre dist/atlas.html (gere antes com python3 tools/build.py)
//   --sample   injeta src/data.sample.js e ignora src/data.js (teste da UI sem o conteúdo final)
//   --only     subconjunto de capturas (padrão: todas)
//   --chapters capítulos (1-based) para capturas por cena (padrão: all)
//   checks    (desktop) renderização sob demanda (renders com a cena parada), seleção através de camadas
//             fantasma (cap. 02), foco do cartão aberto por teclado (glossário → cartão → Esc devolve o foco)
//   widths    nota de orientação × barra de vistas e controles em 1024/1180/1280 px
//   material  capturas de elemento: prancha, planos, tecidos+ultrassom (desktop e celular)
// Saídas: shots/<prefix>_*.png (+ .pdf com --pdf) e um resumo JSON no stdout
// (erros de console, recursos ausentes, âncoras ausentes, sobreposição de rótulos, scroll horizontal).
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] == null ? true : m[2]] : [a, true]; }));
const root = path.resolve(__dirname, '..');
const prefix = args.prefix || 'ui';
const only = args.only ? new Set(String(args.only).split(',')) : null;
const want = (k) => !only || only.has(k);
const out = (name) => path.join(root, 'shots', `${prefix}_${name}`);
const url = 'file://' + path.join(root, args.dist ? 'dist/atlas.html' : 'index.html');
const GL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const report = { url, shots: [], console: [], missing: [], checks: {} };

async function newPage(browser, opts) {
  const ctx = await browser.newContext(opts);
  if (args.sample) {
    const code = fs.readFileSync(path.join(root, 'src/data.sample.js'), 'utf8');
    // a amostra prevalece: o src/data.js carregado depois não sobrescreve
    await ctx.addInitScript({ content: code + ';(function(){var d=window.ATLAS_DATA;Object.defineProperty(window,"ATLAS_DATA",{get:function(){return d},set:function(){},configurable:false});})();' });
  }
  const page = await ctx.newPage();
  const tag = opts.isMobile ? 'mobile' : 'desktop';
  page.on('console', (m) => {
    if (m.type() !== 'error' && m.type() !== 'warning') return;
    const t = m.text();
    if (/ERR_FILE_NOT_FOUND|Failed to load resource/.test(t)) return; // tratado em requestfailed
    if (/GPU stall|GL Driver Message|swiftshader|WebGL/i.test(t) && m.type() === 'warning') return;
    report.console.push(`[${tag}] ${m.type()}: ${t}`);
  });
  page.on('pageerror', (e) => report.console.push(`[${tag}] PAGEERROR: ${e.message}`));
  page.on('requestfailed', (r) => { const u = r.url().replace('file://' + root + '/', ''); if (!report.missing.includes(u)) report.missing.push(u); });
  return { ctx, page };
}

/** Espera a rolagem da página estabilizar (rolagem suave lenta sob SwiftShader). */
async function settle(page, maxMs = 8000) {
  let last = -1, same = 0; const t0 = Date.now();
  while (Date.now() - t0 < maxMs) { await page.waitForTimeout(250); const y = await page.evaluate(() => scrollY); if (Math.abs(y - last) < 1) { if (++same >= 3) return; } else same = 0; last = y; }
}

async function waitReady(page) {
  await page.goto(url);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 420000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.APP && APP.still && APP.still());
  await page.waitForTimeout(300);
}

/** Verificações de layout no visor: rótulos sobrepostos entre si ou com sobreposições da UI. */
async function labelChecks(page) {
  return page.evaluate(() => {
    const vis = (el) => el && !el.hidden && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && el.getBoundingClientRect().width > 0;
    const rect = (el) => el.getBoundingClientRect();
    const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const lbls = [...document.querySelectorAll('#labels .lbl')].filter((el) => vis(el) && !el.classList.contains('clash')).map((el) => ({ t: el.textContent, r: rect(el) }));
    const ui = ['.vp-views', '.legend', '#gizmo', '.vp-zoom', '.vp-top', '#card'].map((s) => document.querySelector(s)).filter(vis).map((el) => ({ t: el.className.baseVal || el.className || el.id, r: rect(el) }));
    const vr = rect(document.getElementById('viewer'));
    const overlaps = [], uiHits = [], outside = [];
    for (let i = 0; i < lbls.length; i++) {
      for (let j = i + 1; j < lbls.length; j++) if (hit(lbls[i].r, lbls[j].r)) overlaps.push(lbls[i].t + ' × ' + lbls[j].t);
      for (const u of ui) if (hit(lbls[i].r, u.r)) uiHits.push(lbls[i].t + ' × ' + u.t);
      const r = lbls[i].r; if (r.left < vr.left || r.right > vr.right || r.top < vr.top || r.bottom > vr.bottom) outside.push(lbls[i].t);
    }
    return { labels: lbls.length, collapsed: document.querySelectorAll('#labels .lbl.clash').length, overlaps, uiHits, outside };
  });
}

(async () => {
  const t0 = Date.now();
  const browser = await chromium.launch({ args: GL_ARGS });
  // o laço de renderização contínuo satura o SwiftShader: congela um quadro estável antes de cada captura
  const still = (page) => page.evaluate(() => window.APP && APP.still && APP.still());
  const shot = async (page, name, opt = {}) => { const p = out(name); await page.screenshot(Object.assign({ path: p, timeout: 120000 }, opt)); report.shots.push(path.relative(root, p)); };

  if (['desktop', 'chapters', 'card', 'dark', 'print', 'checks', 'widths', 'material'].some(want)) {
    const { ctx, page } = await newPage(browser, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: +(args.dsf || 1), colorScheme: 'light' });
    const tl = Date.now(); await waitReady(page); report.checks.desktopLoadMs = Date.now() - tl;
    report.checks.meta = await page.evaluate(() => ({ chapters: APP.data.chapters.length, engine: !!APP.E, errors: APP.E ? APP.E.errors : null, modules: APP.E ? Object.keys(APP.E.results) : [], anchors: APP.E ? Object.keys(APP.E.anchors).length : 0 }));
    if (want('desktop')) {
      await shot(page, 'desktop.png');
      report.checks.desktopLabels = await labelChecks(page);
      await shot(page, 'desktop_full.png', { fullPage: true });
      report.checks.desktopOverflowX = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    }
    if (want('chapters')) {
      const n = report.checks.meta.chapters;
      const list = !args.chapters || args.chapters === 'all' ? [...Array(n).keys()] : String(args.chapters).split(',').map((v) => +v - 1).filter((v) => v >= 0 && v < n);
      report.checks.chapters = {};
      await page.evaluate(() => window.scrollTo(0, document.querySelector('.masthead').offsetHeight));
      for (const i of list) {
        await page.evaluate((k) => { APP.go(k, { animate: false }); APP.still(); }, i);
        await page.waitForTimeout(250);
        const nn = String(i + 1).padStart(2, '0');
        await shot(page, `cap${nn}.png`);
        report.checks.chapters[nn] = await labelChecks(page);
      }
      report.checks.missingAnchors = await page.evaluate(() => APP.missingAnchors());
    }
    if (want('card')) {
      await page.evaluate(() => { window.scrollTo(0, 0); APP.go(1, { animate: false }); APP.still(); });
      await page.waitForTimeout(300);
      const pt = await page.evaluate(() => {
        const E = APP.E, keys = ['scvR', 'subclaviusR', 'clavicleMidR', 'clavicleR', 'firstRibR', 'notch', 'sternalAngle'];
        const r = E.renderer.domElement.getBoundingClientRect();
        for (const k of keys) {
          const a = E.anchors[k]; if (!a) continue;
          const p = E.project(a); const x = r.left + p.x, y = r.top + p.y;
          const hit = APP.pick(x, y); if (hit && hit.info) return { x, y, id: hit.info.id, k };
        }
        // varredura grossa como recurso
        for (let y = r.top + r.height * 0.3; y < r.bottom - 60; y += 40) for (let x = r.left + 60; x < r.right - 60; x += 40) { const h = APP.pick(x, y); if (h && h.info) return { x, y, id: h.info.id, k: 'scan' }; }
        return null;
      });
      report.checks.cardTarget = pt;
      if (pt) {
        await page.evaluate(() => APP.resume());
        await page.mouse.move(pt.x - 20, pt.y - 10); await page.mouse.move(pt.x, pt.y, { steps: 3 });
        await page.waitForTimeout(1500);
        await still(page);
        report.checks.tooltip = await page.evaluate(() => { const t = document.getElementById('tooltip'); return t.hidden ? null : t.textContent; });
        await shot(page, 'tooltip.png');
        await page.evaluate(() => APP.resume());
        await page.mouse.click(pt.x, pt.y);
        await page.waitForTimeout(1200);
        await still(page);
        report.checks.card = await page.evaluate(() => { const c = document.getElementById('card'); return c.hidden ? null : document.getElementById('cardName').textContent; });
        await shot(page, 'card.png');
        await page.keyboard.press('Escape');
        report.checks.cardClosedByEsc = await page.evaluate(() => document.getElementById('card').hidden);
      }
      // glossário → 3D
      const gid = await page.evaluate(() => { const b = document.querySelector('#glossBody [data-show]'); return b ? b.dataset.show : null; });
      if (gid) {
        await page.evaluate((id) => { APP.resume(); document.querySelector(`#glossBody [data-show="${id}"]`).click(); }, gid);
        await page.waitForTimeout(2500);
        await still(page);
        await shot(page, 'gloss_focus.png');
        report.checks.glossFocus = { id: gid, card: await page.evaluate(() => document.getElementById('cardName').textContent) };
      }
    }
    if (want('checks')) {
      // renderização sob demanda: com a cena parada o laço pausa ('idle'); interação o retoma
      await page.evaluate(() => { window.scrollTo(0, 0); APP.go(0, { animate: false }); APP.resume(); const r = APP.E.renderer; if (!r.__cnt) { const f = r.render.bind(r); r.__n = 0; r.render = (a, b) => { r.__n++; return f(a, b); }; r.__cnt = true; } });
      await page.waitForTimeout(4500);
      const n0 = await page.evaluate(() => APP.E.renderer.__n);
      await page.waitForTimeout(3000);
      const idle = await page.evaluate((n) => ({ rendersIn3s: APP.E.renderer.__n - n, loop: APP.loop() }), n0);
      await page.click('[data-view="oblique"]', { timeout: 15000 });
      await page.waitForTimeout(1200);
      const after = await page.evaluate((n) => ({ rendersAfterClick: APP.E.renderer.__n - n }), n0 + idle.rendersIn3s);
      report.checks.idle = Object.assign(idle, after);
      // seleção através de fantasmas (cap. 02: músculos a 0,35; destaque no escaleno anterior)
      report.checks.ghostPick = await page.evaluate(() => {
        APP.go(1, { animate: false }); APP.still();
        const E = APP.E, r = E.renderer.domElement.getBoundingClientRect(), o = {};
        for (const k of ['scaleneAntR', 'scvR', 'subclaviusR', 'firstRibR', 'scaR']) {
          const a = E.anchors[k]; if (!a) { o[k] = 'sem âncora'; continue; }
          const p = E.project(a); const h = APP.pick(r.left + p.x, r.top + p.y); o[k] = h && h.info ? h.info.id : null;
        }
        o.highlight = APP.state.highlightId; return o;
      });
      // teclado: glossário → "Ver no 3D" → foco no cartão → Tab dentro do cartão → Esc devolve o foco ao botão
      await page.evaluate(() => { APP.resume(); const b = document.querySelector('#glossBody [data-show]'); b.scrollIntoView({ block: 'center' }); b.focus(); });
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);
      const k1 = await page.evaluate(() => ({ card: !document.getElementById('card').hidden, activeIsCard: document.activeElement === document.getElementById('card'), sr: document.getElementById('srStatus').textContent }));
      await page.keyboard.press('Tab');
      const k2 = await page.evaluate(() => ({ tabInsideCard: document.getElementById('card').contains(document.activeElement), active: (document.activeElement.id || document.activeElement.textContent || '').trim().slice(0, 30) }));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      const k3 = await page.evaluate(() => ({ closed: document.getElementById('card').hidden, backToButton: !!(document.activeElement && document.activeElement.matches('#glossBody [data-show]')) }));
      report.checks.cardKeyboard = Object.assign(k1, k2, k3);
      await still(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.evaluate(() => { APP.resume(); APP.go(1, { animate: false }); APP.still(); });
      await shot(page, 'cap02_ghostpick_view.png', { clip: { x: 0, y: 0, width: 1440, height: 900 } });
    }
    if (want('widths')) {
      report.checks.widths = {};
      for (const [w, h] of [[1024, 768], [1180, 800], [1280, 800]]) {
        await page.setViewportSize({ width: w, height: h });
        await page.evaluate(() => { window.scrollTo(0, 0); APP.resume(); APP.go(7, { animate: false }); });
        await page.waitForTimeout(900);
        await still(page);
        report.checks.widths[w] = await page.evaluate(() => {
          const r = (s) => document.querySelector(s).getBoundingClientRect();
          const a = r('#orientNote'), b = r('#viewBar');
          const ov = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * (Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) ? 1 : 0);
          const seg = document.getElementById('rollSeg'); const cut = [...seg.querySelectorAll('button')].filter((x) => x.scrollWidth > x.clientWidth + 1).map((x) => x.textContent);
          return { orientViewsOverlapPx: Math.round(ov), stacked: document.getElementById('viewer').classList.contains('vp-stack'), segClipped: cut, segOverflow: seg.scrollWidth > seg.clientWidth + 1 };
        });
        await shot(page, `w${w}_top.png`, { clip: { x: 0, y: 0, width: w, height: h } });
      }
      await page.setViewportSize({ width: 1440, height: 900 });
    }
    if (want('material')) {
      await page.evaluate(() => APP.resume());
      for (const [sel, name] of [['#prancha', 'mat_prancha'], ['#planos', 'mat_planos'], ['#usg', 'mat_usg'], ['#tecidos', 'mat_tecidos']]) {
        const el = await page.$(sel); await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(200);
        const p = out(name + '.png'); await el.screenshot({ path: p, timeout: 120000 }); report.shots.push(path.relative(root, p));
      }
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    if (want('dark')) {
      await page.evaluate(() => { window.scrollTo(0, 0); APP.closeCard(); APP.setTheme('dark', false); APP.go(1, { animate: false }); APP.still(); });
      await page.waitForTimeout(300);
      await shot(page, 'dark.png');
      await page.evaluate(() => document.getElementById('material').scrollIntoView());
      await page.waitForTimeout(300);
      await shot(page, 'dark_material.png');
      await page.evaluate(() => document.getElementById('usg').scrollIntoView());
      await page.waitForTimeout(300);
      await shot(page, 'dark_usg.png');
      await page.evaluate(() => { APP.setTheme('light', false); window.scrollTo(0, 0); });
    }
    if (want('print')) {
      const tp = Date.now();
      if (args.fastprint) await page.evaluate(() => (window.__PH = true));
      await page.evaluate(async () => { await APP.buildPrint({ print: false, placeholder: !!window.__PH }); APP.still(); });
      report.checks.printBuildMs = Date.now() - tp;
      await page.emulateMedia({ media: 'print' });
      await page.waitForTimeout(400);
      report.checks.printFit = await page.evaluate(() => [...document.querySelectorAll('#printRoot .sheet')].map((s) => s.dataset.fit + ':' + s.style.getPropertyValue('--fs') + '/' + s.style.getPropertyValue('--hero')));
      await shot(page, 'print.png', { fullPage: true });
      if (args.pdf) { await page.pdf({ path: out('print.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true }); report.shots.push(path.relative(root, out('print.pdf'))); }
      await page.emulateMedia({ media: 'screen' });
      if (args.pdf) { // impressão nativa (sem as folhas do botão): margens de @page padrão
        await page.evaluate(() => { document.body.classList.remove('print-sheets'); const st = document.getElementById('sheetPageCss'); if (st) st.remove(); });
        await page.emulateMedia({ media: 'print' });
        await page.pdf({ path: out('native_print.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true }); report.shots.push(path.relative(root, out('native_print.pdf')));
        await page.emulateMedia({ media: 'screen' });
      }
    }
    await ctx.close();
  }

  if (want('mobile')) {
    const { ctx, page } = await newPage(browser, { viewport: { width: 390, height: 844 }, deviceScaleFactor: +(args.dsf || 1), isMobile: true, hasTouch: true, colorScheme: 'light' });
    const tl = Date.now(); await waitReady(page); report.checks.mobileLoadMs = Date.now() - tl;
    await shot(page, 'mobile.png');
    report.checks.mobileLabels = await labelChecks(page);
    report.checks.mobileOverflow = await page.evaluate(() => {
      const W = document.documentElement.clientWidth; const bad = [];
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect(); if (!r.width) continue;
        if (r.right > W + 1 && !el.closest('.chap-list, .vp-views, .tbl-wrap, pre, svg, #printRoot, .labels, .leaders')) bad.push((el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0]) + ' ' + Math.round(r.right));
      }
      return { scrollW: document.documentElement.scrollWidth, clientW: W, offenders: bad.slice(0, 12) };
    });
    await page.evaluate(() => window.scrollTo(0, document.querySelector('.panel').offsetTop - 60));
    await page.waitForTimeout(300);
    await shot(page, 'mobile_panel.png');
    await page.evaluate(() => window.scrollTo(0, document.querySelector('.controls').offsetTop - 300));
    await page.waitForTimeout(300);
    await shot(page, 'mobile_controls.png');
    await shot(page, 'mobile_full.png', { fullPage: true });
    // rolagem com o dedo sobre o visor (proteção ativa): a página deve rolar, o modelo não deve girar
    await page.evaluate(() => { window.scrollTo(0, 0); APP.resume(); });
    // estrutura: no centro do visor o alvo do toque é a proteção (touch-action pan-y → a página rola); ativada, é o canvas
    const hitTA = () => page.evaluate(() => { const r = document.getElementById('viewer').getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height * 0.6); return { el: el ? el.id || el.tagName.toLowerCase() : null, touchAction: el ? getComputedStyle(el).touchAction : null }; });
    report.checks.mobileShield = Object.assign({ shield: await page.evaluate(() => !document.getElementById('touchShield').hidden) }, await hitTA());
    try {
      const cdp = await ctx.newCDPSession(page);
      const v0 = await page.evaluate(() => ({ y: scrollY, view: JSON.stringify(APP.E.getView()) }));
      const vr = await page.evaluate(() => { const r = document.getElementById('viewer').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.6 }; });
      await cdp.send('Input.synthesizeScrollGesture', { x: Math.round(vr.x), y: Math.round(vr.y), yDistance: -260, gestureSourceType: 'touch', speed: 800, repeatCount: 0 });
      await settle(page);
      const v1 = await page.evaluate(() => ({ y: scrollY, view: JSON.stringify(APP.E.getView()) }));
      // controle: o mesmo gesto fora do visor (sobre os controles)
      const cr = await page.evaluate(() => { const r = document.getElementById('controls').getBoundingClientRect(); return { x: r.left + r.width / 2, y: Math.min(innerHeight - 60, r.top + 40) }; });
      await cdp.send('Input.synthesizeScrollGesture', { x: Math.round(cr.x), y: Math.round(cr.y), yDistance: -200, gestureSourceType: 'touch', speed: 800, repeatCount: 0 });
      await settle(page);
      const v2 = await page.evaluate(() => scrollY);
      report.checks.mobileSwipeOverViewer = { scrolledPx: Math.round(v1.y - v0.y), modelRotated: v0.view !== v1.view, controlSwipePx: Math.round(v2 - v1.y) };
    } catch (e) { report.checks.mobileSwipeOverViewer = 'cdp indisponível: ' + e.message; }
    // "Próxima →" no fim do painel: a cena nova deve ficar à vista
    await page.evaluate(() => { APP.go(0, { animate: false }); const b = document.querySelector('.stepnav .next'); b.scrollIntoView({ block: 'center' }); });
    await page.waitForTimeout(400);
    await page.tap('.stepnav .next', { timeout: 15000 });
    await settle(page);
    report.checks.mobileNext = await page.evaluate(() => { const nav = document.querySelector('.chapnav').offsetHeight; const r = document.getElementById('viewer').getBoundingClientRect(); return { idx: APP.state.idx, viewerTop: Math.round(r.top), navH: nav, inView: r.top >= nav - 6 && r.top < innerHeight * 0.4 }; });
    await still(page);
    await shot(page, 'mobile_after_next.png');
    // toque numa estrutura → cartão em folha inferior (antes, um toque ativa o 3D)
    await page.evaluate(() => { window.scrollTo(0, 0); APP.resume(); });
    await page.waitForTimeout(300);
    if (await page.evaluate(() => !document.getElementById('touchShield').hidden)) { await page.tap('#touchShield'); await page.waitForTimeout(300); }
    report.checks.mobileLive = Object.assign(await page.evaluate(() => ({ live: APP.state.touchLive, done: !document.getElementById('touchDone').hidden })), await hitTA());
    const pt = await page.evaluate(() => {
      const E = APP.E; if (!E) return null; const r = E.renderer.domElement.getBoundingClientRect();
      for (let y = r.top + r.height * 0.35; y < r.bottom - 80; y += 36) for (let x = r.left + 40; x < r.right - 70; x += 36) { const h = APP.pick(x, y); if (h && h.info) return { x, y, id: h.info.id }; }
      return null;
    });
    if (pt) { await page.touchscreen.tap(pt.x, pt.y); await page.waitForTimeout(1200); await still(page); await shot(page, 'mobile_card.png'); report.checks.mobileCard = await page.evaluate(() => (document.getElementById('card').hidden ? null : document.getElementById('cardName').textContent)); report.checks.mobileCardLabels = await labelChecks(page); }
    if (want('material') || !only) {
      await page.evaluate(() => { APP.closeCard(); APP.resume(); });
      for (const [sel, name] of [['#prancha', 'm_prancha'], ['#planos', 'm_planos'], ['#usg', 'm_usg']]) {
        const el = await page.$(sel); await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(200);
        const p = out(name + '.png'); await el.screenshot({ path: p, timeout: 120000 }); report.shots.push(path.relative(root, p));
      }
    }
    await ctx.close();
  }

  await browser.close();
  report.totalMs = Date.now() - t0;
  console.log(JSON.stringify(report, null, 1));
})().catch((e) => { report.fatal = String(e && e.message || e).split('\n')[0]; console.log(JSON.stringify(report, null, 1)); process.exit(1); });
