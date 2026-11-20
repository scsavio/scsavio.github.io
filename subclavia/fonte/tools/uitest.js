// uitest.js — testes funcionais da interface (Playwright + SwiftShader).
// uso: node tools/uitest.js [--dist[=arquivo]]   (--dist → dist/atlas.html; --dist=x.html → dist/x.html)
// Verifica: deep-link #cap-NN, teclas ←/→, troca de cena sem estado vazado (dilatador e fixação inclusive),
// autoteste, insets compactos, camadas/ghost/corte/etapas, captura PNG, tema persistido, Esc no cartão, impressão
// (folhas = capítulos + capa + folhas extras marcadas .extra), fixação em bailarina (stepper 0–9 com o cateter
// posicionado, inset sincronizado, animação 'fix', #cap-fixacao, fixStep zerado nos outros capítulos, esquema SVG
// das 10 etapas sem texto cortado/sobreposto), etapas da agulha (8, com o dilatador entre o fio e o cateter; mão
// indisponível a partir do fio; sombras renovadas na troca fio ↔ dilatador), motor × interface (corte × fantasma ×
// destaque entre capítulos, contorno do destaque, sombras sob demanda — de tools/w2fix_nucleo_uicheck.js), controles
// que ligam a camada de que dependem, glossário (estruturas-chave primeiro), visor focável pelo teclado, oclusão de
// rótulos (sem auto-oclusão; vaso fino não torna "profundo"; mão → "sob a mão").
// Saída: JSON com {ok, falhas[], detalhes} e capturas shots/ui_inset_*.png.
const { chromium } = require('playwright');
const path = require('path');

const distArg = process.argv.find((a) => /^--dist(=|$)/.test(a));
const distFile = distArg ? (distArg.split('=')[1] || 'atlas.html') : null;
const root = path.resolve(__dirname, '..');
const url = 'file://' + path.join(root, distFile ? 'dist/' + distFile : 'index.html');
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
    const snap = () => JSON.stringify({ st: { phase: E.state.phase, hand: E.state.handPose, breath: E.state.breath, wire: E.state.wireMal, planes: E.state.showPlanes, roll: E.state.rollMode, dil: !!E.state.dilator, fix: E.state.fixStep }, layers: Object.fromEntries(Object.entries(E.layers).map(([k, g]) => [k, g.visible])), clip: E.C.clipPlanes.length });
    const base = snap();
    document.querySelector('[data-layer="skin"]').click();
    document.getElementById('ghostToggle').click();
    document.querySelector('[data-step="6"]').click(); // dilatador
    const dilOn = E.state.dilator === true;
    document.querySelector('[data-step="5"]').click();
    document.getElementById('wireToggle').click();
    document.getElementById('clipToggle').click();
    document.querySelector('[data-roll="ipsilateral"]').click();
    document.getElementById('breathPlay').click();
    document.querySelector('[data-step="6"]').click(); // sai com o dilatador ligado
    APP.go(3, { animate: false }); APP.go(2, { animate: false });
    const again = snap();
    return { same: base === again, dilOn, anims: Object.values(APP.anims).filter(Boolean).length, ghost: document.getElementById('ghostToggle').checked };
  });
  info.leak = leak;
  check(leak.same && leak.anims === 0, 'estado vazou entre capítulos');
  check(leak.dilOn, 'etapa "Dilatador" não ligou E.state.dilator');

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

  // fixação em bailarina
  info.fix = await page.evaluate(async () => {
    const E = APP.E, D = APP.data, r = {};
    const fi = D.chapters.findIndex((c) => c.id === 'fixacao');
    r.chapter = fi >= 0 ? D.chapters[fi].n : null;
    if (fi < 0) return r;
    APP.go(fi, { animate: false });
    r.phase6 = E.state.phase === 6;
    r.anim = !!APP.anims.fix || matchMedia('(prefers-reduced-motion: reduce)').matches;
    r.rowVisible = !document.getElementById('fixRow').hidden && document.getElementById('needleOpts').hidden;
    r.dots = document.querySelectorAll('#fixStepper [data-fix]').length;
    document.querySelector('#fixStepper [data-fix="4"]').click();
    r.step4 = E.state.fixStep === 4 && !APP.anims.fix && document.querySelector('#fixStepper [data-fix="4"]').getAttribute('aria-pressed') === 'true';
    const box = document.getElementById('fixInsetStep');
    r.insetSync = !!box && box.dataset.k === '4' && /Etapa 4/.test(document.getElementById('fxNow').textContent);
    r.insetSvg = !!(box && box.querySelector('svg.fx-svg'));
    document.querySelector('#painel [data-fxk="1"]').click();
    r.insetNext = E.state.fixStep === 5 && document.getElementById('fixInsetStep').dataset.k === '5';
    APP.resume(); // o laço precisa rodar para a animação avançar (APP.still() o congela)
    document.getElementById('fixPlay').click();
    r.play = !!APP.anims.fix || matchMedia('(prefers-reduced-motion: reduce)').matches;
    // relógio simulado (o SwiftShader sob carga pode levar segundos por quadro): fim da pausa, depois meio movimento
    APP.tickAnims(1000); APP.tickAnims(1800);
    r.playAdvanced = (E.state.fixStep > 5 && E.state.fixStep < 6.001) || matchMedia('(prefers-reduced-motion: reduce)').matches;
    r.playStep = +(+E.state.fixStep).toFixed(2);
    document.getElementById('fixPlay').click();
    r.paused = !APP.anims.fix;
    r.short = [...document.querySelectorAll('#fixStepper [data-fix]')].map((b) => b.title).slice(0, 3);
    // os outros capítulos zeram a fixação, inclusive os de fase 6
    APP.go(fi - 1, { animate: false });
    r.prevReset = E.state.fixStep === 0;
    r.prevRowHidden = E.state.phase !== 6 || !document.getElementById('fixRow').hidden;
    APP.go(0, { animate: false });
    r.zeroOutside = E.state.fixStep === 0 && document.getElementById('fixRow').hidden;
    location.hash = '#cap-fixacao'; await new Promise((res) => setTimeout(res, 300));
    r.hashById = APP.state.idx === fi;
    r.section = document.querySelectorAll('#fixBody .fx-card').length;
    r.module = !!(E.results && E.results.fixation);
    r.anchors = ['fixExit', 'fixAnchorKnot', 'fixCross1', 'fixFinalKnot'].filter((k) => E.anchors[k]).length;
    APP.go(0, { animate: false });
    return r;
  });
  if (info.fix.chapter) ['phase6', 'anim', 'rowVisible', 'step4', 'insetSync', 'insetSvg', 'insetNext', 'play', 'playAdvanced', 'paused', 'prevReset', 'prevRowHidden', 'zeroOutside', 'hashById'].forEach((k) => check(info.fix[k] === true, 'fixação falhou: ' + k));
  check(!info.fix.chapter || info.fix.dots === 10, 'fixação: stepper sem 10 etapas');
  check(!info.fix.chapter || info.fix.section === 9, 'fixação: seção do material sem as 9 etapas');

  // controles ligam a camada de que dependem (cap. 01: sem instrumentos, mão, pulmão nem auxílios)
  info.ensure = await page.evaluate(() => {
    const E = APP.E; APP.go(0, { animate: false });
    const r = {};
    document.querySelector('[data-phase="4"]').click(); r.instrument = E.layers.instrument.visible;
    const hr = document.getElementById('handRange'); hr.value = 40; hr.dispatchEvent(new Event('input')); r.hand = E.layers.hand.visible;
    const br = document.getElementById('breathRange'); br.value = 60; br.dispatchEvent(new Event('input')); r.lung = E.layers.lung.visible && E.layers.pleura.visible;
    APP.go(7, { animate: false }); const pt = document.getElementById('planesToggle'); if (!pt.checked) pt.click(); r.aids = E.layers.aids.visible;
    r.notice = !document.getElementById('notice').hidden;
    r.valuetext = ['handRange', 'breathRange', 'clipRange'].every((id) => !!document.getElementById(id).getAttribute('aria-valuetext'));
    APP.go(0, { animate: false });
    return r;
  });
  ['instrument', 'hand', 'lung', 'aids', 'valuetext'].forEach((k) => check(info.ensure[k] === true, 'controle sem camada/semântica: ' + k));

  // glossário: estruturas-chave primeiro; costelas 3–12 ocultas por padrão; visor focável
  info.gloss = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('#glossBody .gl')].slice(0, 6).map((e) => e.id.replace(/^gl-/, ''));
    return { first: ids, minorHidden: !document.getElementById('gl-rib-5-R'), canvasTab: APP.E.renderer.domElement.tabIndex === 0 };
  });
  check(info.gloss.first[0] === 'scv-R', 'glossário: a veia subclávia não abre a lista');
  check(info.gloss.minorHidden && info.gloss.canvasTab, 'glossário/visor: costelas menores visíveis ou canvas sem foco');

  // oclusão dos rótulos: âncoras dentro da própria estrutura, estruturas atrás de um vaso fino (a VCS atrás da
  // ITA/ITV, o plexo atrás da cervical transversa) e pele sob a mão do operador NÃO viram "profundo" (a mão dá
  // "sob a mão"). A lista completa por capítulo fica em detalhes.occ (depende da geometria).
  info.occ = await page.evaluate(() => {
    const out = {};
    for (const id of ['espaco', 'vasos', 'mao', 'entrada', 'fio', 'distancias']) {
      const i = APP.data.chapters.findIndex((c) => c.id === id); if (i < 0) continue;
      APP.go(i, { animate: false }); APP.still();
      out[id] = APP.state.labels.filter((L) => L.vis).map((L) => L.key + (L.occ ? ':' + (L.occ === 'hand' ? 'sob-a-mao' : 'profundo') : ''));
      out[id + '_text'] = [...document.querySelectorAll('#labels .lbl.occ')].map((el) => el.textContent + getComputedStyle(el, '::after').content);
    }
    APP.resume(); APP.go(0, { animate: false });
    return out;
  });
  {
    const deep = (id, k) => (info.occ[id] || []).includes(k + ':profundo');
    const falseDeep = [['vasos', 'svc'], ['fio', 'svc'], ['espaco', 'plexusR'], ['vasos', 'scvR'], ['vasos', 'bcvR'], ['vasos', 'venousAngleR'], ['fio', 'scvR'], ['fio', 'bcvR'], ['fio', 'venousAngleR'],
      ['mao', 'indexTip'], ['mao', 'thumbTip'], ['mao', 'palm'], ['mao', 'clavicleSkinR'], ['entrada', 'clavicleSkinR'], ['entrada', 'notchSkin']].filter(([id, k]) => deep(id, k));
    check(!falseDeep.length, 'rótulo "profundo" indevido: ' + falseDeep.map((x) => x.join('/')).join(', '));
  }

  // etapas da agulha: 8 etapas, com o dilatador (fase 5 + E.state.dilator) entre o fio-guia e o cateter
  info.needle = await page.evaluate(() => {
    const E = APP.E, q = (s) => document.querySelector(s), r = {};
    APP.go(0, { animate: false });
    r.steps = document.querySelectorAll('#stepper [data-step]').length;
    r.names = [...document.querySelectorAll('#stepper [data-step]')].map((b) => b.getAttribute('aria-label'));
    r.step3 = /sob a clav/i.test(r.names[3] || '');
    q('[data-step="5"]').click(); r.wire = E.state.phase === 5 && !E.state.dilator;
    // a troca fio → dilatador (mesma fase) precisa renovar o mapa de sombras (o motor não inclui 'dilator' na chave)
    const sm = E.renderer.shadowMap; let n = 0; const orig = sm.render;
    sm.render = function (...a) { if (sm.needsUpdate || sm.autoUpdate) n++; return orig.apply(this, a); };
    E.renderOnce(); E.renderOnce(); const n0 = n;
    q('[data-step="6"]').click(); E.renderOnce(); r.shadowRenders = n - n0; sm.render = orig;
    r.dil = E.state.phase === 5 && E.state.dilator === true && q('#phaseNum').textContent === '6' && q('[data-step="6"]').getAttribute('aria-pressed') === 'true';
    APP.still();
    const reg = window.ATLAS.registry.get('dilator'); const shown = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
    r.dilVisible = !!reg && reg.objects.some(shown);
    r.handOff = q('#handRange').disabled && q('#handPlay').disabled && /fora de cena/i.test(q('#handOut').textContent);
    APP.resume();
    q('[data-step="7"]').click(); r.cath = E.state.phase === 6 && !E.state.dilator && !q('#fixRow').hidden && q('#needleOpts').hidden;
    q('[data-step="4"]').click(); r.handOn = !q('#handRange').disabled && E.state.phase === 4 && !E.state.dilator;
    q('[data-step="6"]').click(); APP.go(1, { animate: false }); APP.go(0, { animate: false });
    r.reset = E.state.dilator === false && !q('#handRange').disabled;
    return r;
  });
  check(info.needle.steps === 8, 'etapas da agulha: esperadas 8 (com o dilatador)');
  ['step3', 'wire', 'dil', 'dilVisible', 'handOff', 'cath', 'handOn', 'reset'].forEach((k) => check(info.needle[k] === true, 'etapas da agulha falhou: ' + k));
  check(info.needle.shadowRenders >= 1, 'sombras não renovadas na troca fio → dilatador');

  // motor × interface (portado de tools/w2fix_nucleo_uicheck.js): corte × fantasma × destaque entre capítulos
  info.engine = await page.evaluate(() => {
    const E = APP.E, CP = E.C.clipPlanes, ix = (id) => APP.data.chapters.findIndex((c) => c.id === id);
    const audit = () => {
      let mats = 0, bad = 0, helpers = 0, pre = 0, shells = 0, orphan = 0, ghostMats = 0, hlMats = 0;
      E.world.traverse((o) => {
        if (!o.isMesh) return;
        if (o.userData.__helper) { helpers++; if (o.material.name === 'ghost-depth-prepass') pre++; else shells++; if (!o.parent || !o.parent.isMesh) orphan++; if (o.material.clippingPlanes !== CP) bad++; return; }
        const m = o.material; if (!m || Array.isArray(m)) return; mats++;
        if (m.clippingPlanes && m.clippingPlanes !== CP) bad++;
        if (/ghostfx/.test(m.customProgramCacheKey ? m.customProgramCacheKey() : '')) ghostMats++;
        if (m.stencilWrite) hlMats++;
      });
      return { clip: CP.length, mats, bad, helpers, pre, shells, orphan, ghostMats, hlMats };
    };
    const r = {};
    APP.go(ix('tecidos'), { animate: false }); APP.still(); r.clipScene = audit();
    APP.go(ix('fio'), { animate: false }); APP.still(); r.ghostAfterClip = audit();
    APP.go(ix('atras'), { animate: false }); E.setClip({ normal: [-1, 0, 0], point: [4.5, 0, 0] }); APP.still(); r.ghostHlClip = audit();
    // contorno do destaque (verde-petróleo do tema: #176d66 claro, #6cc6bb escuro) visível com fantasmas + corte
    E.renderOnce();
    const gl = E.renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const tc = document.documentElement.getAttribute('data-theme') === 'dark' ? [0x6c, 0xc6, 0xbb] : [0x17, 0x6d, 0x66];
    let op = 0; for (let i = 0; i < px.length; i += 4) if (Math.abs(px[i] - tc[0]) < 14 && Math.abs(px[i + 1] - tc[1]) < 16 && Math.abs(px[i + 2] - tc[2]) < 16) op++;
    r.outlinePx = op;
    E.setClip(null); APP.go(ix('mao'), { animate: false }); APP.still(); r.noGhost = audit();
    return r;
  });
  // sombras sob demanda: conta renderizações do mapa. O motor mantém o mapa vivo por 1,5 s depois de cada mudança de
  // estado (transições animadas dos módulos): as medições de "parado" e "só câmera" esperam essa janela passar.
  info.engine.shadow = await page.evaluate(async () => {
    const E = APP.E, sm = E.renderer.shadowMap, wait = (ms) => new Promise((res) => setTimeout(res, ms));
    let n = 0; const orig = sm.render;
    sm.render = function (...a) { if (sm.needsUpdate || sm.autoUpdate) n++; return orig.apply(this, a); };
    E.renderOnce(); await wait(1800);
    const a = n; E.renderOnce(); E.renderOnce(); const b = n;
    E.state.breath = 0.5; E.renderOnce(); const c = n; await wait(1800);
    E.orbit.az += 0.3; E.applyCam && E.applyCam(); E.renderOnce(); const d = n;
    E.setGhost('skin', 0.3); E.renderOnce(); const e = n;
    E.setGhost('skin', null); E.state.breath = 0; E.orbit.az -= 0.3; E.applyCam && E.applyCam(); E.renderOnce();
    sm.render = orig;
    APP.resume(); APP.go(0, { animate: false });
    return { first: a, idle: b - a, stateChange: c - b, cameraOnly: d - c, ghost: e - d, autoUpdate: sm.autoUpdate };
  });
  {
    const g = info.engine;
    check(g.ghostAfterClip.clip === 0 && g.ghostAfterClip.bad === 0, 'motor: capítulo com fantasma após um com corte herdou planos de corte');
    check(g.ghostAfterClip.ghostMats > 0 && g.ghostAfterClip.pre > 0, 'motor: fantasma/pré-passagem ausentes');
    check(g.ghostHlClip.clip === 1 && g.ghostHlClip.bad === 0 && g.ghostHlClip.hlMats > 0, 'motor: fantasma/destaque sem o plano de corte vivo');
    check(g.outlinePx > 60, 'motor: contorno do destaque não aparece');
    check(g.noGhost.pre === 0 && g.noGhost.shells <= g.noGhost.hlMats && g.noGhost.ghostMats === 0 && g.noGhost.orphan === 0, 'motor: auxiliares/fantasmas vazaram para a cena sem fantasma');
    check(g.shadow.idle === 0 && g.shadow.stateChange === 1 && g.shadow.cameraOnly === 0 && g.shadow.ghost === 1, 'motor: sombras sob demanda incorretas');
  }

  // fixação: esquema SVG das 10 etapas sem texto fora do quadro nem sobreposto (marca "15" e orifício inclusos)
  info.fixSvg = await page.evaluate(() => {
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-2000px;top:0;width:360px';
    document.body.appendChild(host);
    const box = (el, pad) => { const b = el.getBBox(); return { x: b.x - pad, y: b.y - pad, w: b.width + 2 * pad, h: b.height + 2 * pad }; };
    const ov = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    const bad = [];
    for (let k = 0; k <= 9; k++) {
      host.innerHTML = APP.fixSVG(k);
      const svg = host.querySelector('svg');
      const T = [...svg.querySelectorAll('text')].map((t) => ({ t: t.textContent, cm: t.classList.contains('fx-cm'), b: box(t, t.classList.contains('fx-cm') ? 0.5 : 1.2) }));
      const M = [...svg.querySelectorAll('[data-mk], ellipse')].map((e) => ({ t: e.getAttribute('data-mk') || 'nó', b: box(e, 0) }));
      for (let i = 0; i < T.length; i++) {
        const b = T[i].b; if (b.x < 0 || b.y < 0 || b.x + b.w > 360 || b.y + b.h > 210) bad.push(k + ': fora do quadro: ' + T[i].t);
        for (let j = i + 1; j < T.length; j++) if (ov(b, T[j].b) > 1) bad.push(k + ': ' + T[i].t + ' × ' + T[j].t);
        if (!T[i].cm) for (const m of M) if (ov(b, m.b) > 2) bad.push(k + ': ' + T[i].t + ' × ' + m.t);
      }
    }
    host.remove();
    return bad;
  });
  check(!info.fixSvg.length, 'fixação: texto cortado/sobreposto no esquema: ' + info.fixSvg.slice(0, 4).join(' | '));

  // custo da seleção (informativo): média de APP.pick numa grade 5×4 do visor, cap. 02 e cap. 08
  info.pickMs = await page.evaluate(() => {
    const out = {};
    for (const k of [1, 7]) {
      APP.go(k, { animate: false }); APP.still();
      const r = APP.E.renderer.domElement.getBoundingClientRect(); const t0 = performance.now(); let n = 0, hits = 0;
      let tris = 0, trisAll = 0;
      for (let i = 1; i <= 5; i++) for (let j = 1; j <= 4; j++) { const h = APP.pick(r.left + (r.width * i) / 6, r.top + (r.height * j) / 5); n++; if (h) hits++; const st = APP.state.pickStats; if (st) { tris += st.tris; trisAll += st.trisAll; } }
      out['cap' + String(k + 1).padStart(2, '0')] = { avg: +((performance.now() - t0) / n).toFixed(1), hits, trisTestedPct: trisAll ? Math.round((100 * tris) / trisAll) : null };
    }
    APP.resume(); APP.go(0, { animate: false });
    return out;
  });

  // impressão (diagramação)
  info.print = await page.evaluate(async () => { await APP.buildPrint({ print: false, placeholder: true }); const sh = [...document.querySelectorAll('#printRoot .sheet')]; return { sheets: sh.length, main: sh.filter((s) => !s.classList.contains('extra')).length, extra: sh.filter((s) => s.classList.contains('extra')).length, overflow: sh.filter((s) => s.dataset.fit !== 'ok').length, overflowAt: sh.map((s, i) => (s.dataset.fit !== 'ok' ? i : -1)).filter((i) => i >= 0), chapters: APP.data.chapters.length }; });
  check(info.print.main === info.print.chapters + 1 && info.print.overflow === 0, 'folhas de impressão incorretas');
  check(!info.fix.chapter || info.print.extra === 1, 'folha extra da fixação ausente');

  // SPEC §4: âncoras e ids obrigatórios presentes na cena completa (todos os módulos)
  info.spec = await page.evaluate(() => {
    const A = ['notch', 'sternalAngle', 'clavicleR', 'clavicleMidR', 'firstRibR', 'scaleneTubercleR', 'coracoidR', 'acromionR', 'humeralHeadR', 'scJointR',
      'scvR', 'scvLateralR', 'axillaryVR', 'ijvR', 'venousAngleR', 'bcvR', 'lbcv', 'svc', 'cavoatrial', 'scaR', 'scaR1', 'axillaryAR', 'bct', 'ccaR', 'aorticArch', 'itaR', 'vertebralAR', 'ejvR', 'cephalicR', 'scvL', 'thoracicInletL',
      'scmSternalR', 'scmClavicularR', 'scaleneAntR', 'scaleneMidR', 'subclaviusR', 'pecMajorClavR', 'pecMajorSternR', 'pecMinorR', 'deltoidR', 'costoclavLigR', 'clavipectoralR', 'intercostal1R', 'trapeziusR', 'omohyoidR',
      'plexusR', 'plexusRootsR', 'phrenicR', 'vagusR', 'recurrentR', 'stellateR', 'thoracicDuct', 'thoracicDuctTerminal', 'rightLymphDuct',
      'cupulaR', 'lungApexR', 'lungR', 'lungBaseR', 'costophrenicR', 'horizontalFissureR', 'obliqueFissureR', 'lungL', 'cardiacNotch', 'trachea', 'carina', 'esophagus', 'heart', 'diaphragmR', 'pericardium',
      'notchSkin', 'sternalAngleSkin', 'clavicleSkinR', 'infraclavicularFossaR', 'deltopectoralR', 'lesserSupraclavFossaR', 'entrySkin', 'coracoidSkinR', 'rollInterscapular', 'rollShoulderR',
      'indexTip', 'thumbTip', 'palm', 'needleTip', 'needleHub', 'wireTip', 'wireIJV', 'catheterTip', 'entry', 'thumbVector'];
    const I = ['clavicle-R', 'clavicle-L', 'manubrium', 'sternum-body', 'sternal-angle', 'xiphoid', 'rib-1-R', 'costal-cartilage-1-R', 'scapula-R', 'acromion-R', 'coracoid-R', 'humerus-R', 'sc-joint-R',
      'scv-R', 'scv-L', 'axillary-v-R', 'ijv-R', 'ejv-R', 'cephalic-v-R', 'bcv-R', 'bcv-L', 'svc', 'azygos', 'itv-R', 'aorta', 'bct', 'cca-R', 'cca-L', 'sca-R', 'sca-L', 'axillary-a-R', 'vertebral-a-R', 'ita-R', 'thyrocervical-R',
      'scm-R', 'scalene-ant-R', 'scalene-mid-R', 'subclavius-R', 'pec-major-R', 'pec-minor-R', 'deltoid-R', 'trapezius-R', 'omohyoid-R', 'costoclavicular-lig-R', 'clavipectoral-fascia-R', 'intercostal-R',
      'brachial-plexus-R', 'phrenic-R', 'vagus-R', 'recurrent-laryngeal-R', 'sympathetic-trunk-R', 'stellate-R', 'thoracic-duct', 'right-lymphatic-duct',
      'lung-R-upper', 'lung-R-middle', 'lung-R-lower', 'lung-L-upper', 'lung-L-lower', 'pleura-R', 'pleura-L', 'trachea', 'bronchus-R', 'bronchus-L', 'esophagus', 'heart', 'pericardium', 'diaphragm', 'thymus',
      'skin', 'subcutaneous', 'drape', 'skin-prep', 'operator-hand', 'needle', 'syringe', 'guidewire', 'catheter'];
    const E = APP.E, R = window.ATLAS.registry;
    let tris = 0, meshes = 0; E.world.traverse((o) => { if (o.isMesh) { meshes++; const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
    return { missingAnchors: A.filter((k) => !E.anchors[k]), missingIds: I.filter((id) => !R.has(id)), engineErrors: E.errors, modules: Object.keys(E.results), meshes, tris: Math.round(tris), registry: R.size };
  });
  check(!info.spec.missingAnchors.length && !info.spec.missingIds.length, 'SPEC §4: âncoras/ids ausentes: ' + info.spec.missingAnchors.concat(info.spec.missingIds).join(','));
  check(!info.spec.engineErrors.length, 'erros na construção dos módulos: ' + info.spec.engineErrors.join(' | '));
  info.missingAnchors = await page.evaluate(() => APP.missingAnchors());
  info.errors = errs.slice(0, 10);
  check(errs.length === 0, 'erros no console: ' + errs.length);
  await browser.close();
  console.log(JSON.stringify({ ok: fails.length === 0, falhas: fails, detalhes: info }, null, 1));
})().catch((e) => { console.log(JSON.stringify({ ok: false, fatal: String(e && e.message || e).split('\n')[0] })); process.exit(1); });
