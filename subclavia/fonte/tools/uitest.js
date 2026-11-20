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
// Onda 4: esquema da fixação do mesmo lado do 3D (âncora lateral-cranial, acima do cateter; ponto das asas à frente
// da asa; marca "16"), captura PNG/impressão com os filtros de rótulo do visor (fixação etapa 4, cap. 10 etapa 7),
// lote [fora, dentro] do IntersectionObserver e salvaguarda do 'offscreen', curativo só na etapa 9 e campo estéril
// religado ao voltar, teclado/vista/zoom soltam a câmera da animação, stepper = api.steps, cartão "na fixação",
// inset do cap. 11 sem repetir a introdução, insets Medidas/Assimetria com as linhas do capítulo.
// Onda 5: campo estéril na animação em tempo real (7 → 9, a cada quadro, um só aviso), tema após recarregar (robusto à
// carga; distingue armazenamento perdido × script do <head>), inset Assimetria = scene.insetRows exatas, fitSheets em
// décimos exatos e folha extra da fixação com a evidência e as alternativas à sutura.
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
  // guarda os callbacks de IntersectionObserver (teste do lote [fora, dentro] do visor, mais abaixo)
  await ctx.addInitScript(() => {
    const IO = window.IntersectionObserver; if (!IO) return;
    window.__io = [];
    const W = function (cb, o) { const io = new IO(cb, o), ob = io.observe.bind(io); io.observe = (el) => { window.__io.push({ cb, el }); return ob(el); }; return io; };
    W.prototype = IO.prototype; window.IntersectionObserver = W;
  });
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(420000); // arquivo único sob carga alta: o padrão de 30 s não basta para carregar/recarregar
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

  // tema persistido. Recarregar sob carga alta: tempo-limite de navegação longo (o padrão de 30 s não basta para o
  // arquivo único) e uma pausa antes do reload (a gravação do localStorage chega ao processo do navegador de forma
  // assíncrona). Se o tema não voltar, distingue: armazenamento perdido no reload (corrida do navegador → repete uma
  // vez) × valor salvo mas não aplicado (bug real do script do <head> → falha sem repetir).
  const themeReload = async () => {
    await page.waitForTimeout(400);
    await page.reload({ timeout: 420000 });
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 420000 });
    return page.evaluate(() => ({ attr: document.documentElement.getAttribute('data-theme'), saved: localStorage.getItem('atlas-theme') }));
  };
  await page.click('#btnTheme');
  info.theme = await page.evaluate(() => ({ attr: document.documentElement.getAttribute('data-theme'), saved: localStorage.getItem('atlas-theme') }));
  check(info.theme.attr === 'dark' && info.theme.saved === 'dark', 'tema não persistiu');
  let thr = await themeReload();
  info.themeAfterReload = thr.attr; info.themeReloads = [thr];
  if (thr.attr !== 'dark' && thr.saved !== 'dark') { // armazenamento perdido no reload: grava de novo e repete uma vez
    await page.evaluate(() => APP.setTheme('dark'));
    thr = await themeReload(); info.themeAfterReload = thr.attr; info.themeReloads.push(thr);
  }
  check(info.themeAfterReload === 'dark', 'tema não restaurado após recarregar: ' + JSON.stringify(info.themeReloads));
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
      let mats = 0, bad = 0, helpers = 0, pre = 0, shells = 0, orphan = 0, ghostMats = 0, hlMats = 0, optOut = 0;
      E.world.traverse((o) => {
        if (!o.isMesh) return;
        if (o.userData.__helper) {
          // auxiliares do motor: pré-passagem do fantasma e casca do contorno, filhas da malha de origem (mesma geometria).
          // Outras malhas com __helper são de módulos que pedem para ficar fora do destaque/fantasma (ex.: sítio de
          // saída na pele, instruments.js): só o corte é conferido nelas.
          const nm = o.material && o.material.name, isPre = nm === 'ghost-depth-prepass', isShell = nm === 'highlight-outline';
          if (!isPre && !isShell) { optOut++; if (o.material && o.material.clippingPlanes && o.material.clippingPlanes !== CP) bad++; return; }
          helpers++; if (isPre) pre++; else shells++;
          if (!o.parent || !o.parent.isMesh || o.parent.geometry !== o.geometry) orphan++;
          if (o.material.clippingPlanes !== CP) bad++; return;
        }
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

  // fixação: esquema SVG das 10 etapas sem texto fora do quadro nem sobreposto (marca "16" e orifício inclusos)
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

  // (1) esquema × 3D: ponto/nó de ancoragem do MESMO lado do cateter (no esquema, acima da linha y=112 = lado
  // lateral-cranial na vista anterior), saída do ponto das asas à frente da asa (rumo ao nariz) e marca "16"
  info.fixSide = await page.evaluate(() => {
    const r = {}, host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-2000px;top:0;width:360px'; document.body.appendChild(host);
    host.innerHTML = APP.fixSVG(3);
    const dots = [...host.querySelectorAll('circle[r="1.8"]')].map((c) => [+c.getAttribute('cx'), +c.getAttribute('cy')]);
    const knots = [...host.querySelectorAll('ellipse')].map((e) => [+e.getAttribute('cx'), +e.getAttribute('cy')]);
    r.svgBiteUp = dots.length >= 2 && dots.every(([, y]) => y < 112);
    r.svgKnotUp = knots.length > 0 && knots.every(([, y]) => y < 112);
    r.cm = [...host.querySelectorAll('text.fx-cm')].map((t) => t.textContent).join();
    host.innerHTML = APP.fixSVG(8);
    const holes = [...host.querySelectorAll('circle[r="4.3"]')].map((c) => +c.getAttribute('cx')), skin = [...host.querySelectorAll('circle[r="1.8"]')].map((c) => [+c.getAttribute('cx'), +c.getAttribute('cy')]).filter(([x]) => x < 140);
    r.svgWingFront = holes.length === 2 && skin.length === 2 && skin.every(([x]) => x > Math.max(...holes)); // nariz do canhão à direita (rumo à saída)
    host.remove();
    const E = APP.E, fx = E && E.results.fixation, ins = E && E.results.instruments;
    if (fx && fx.api && fx.api.available !== false && ins && ins.api && ins.api.external) {
      const A = E.anchors, ext = ins.api.external(), ex = A.fixExit, hub = ext.hub, kn = A.fixAnchorKnot;
      const u = [hub[0] - ex[0], hub[1] - ex[1]], L = Math.hypot(u[0], u[1]); u[0] /= L; u[1] /= L;
      // lado +perp (−u_y, u_x) = para cima no referencial do esquema (a vista anterior espelha x; ver tools/w2fix_ui_fx3d.js)
      r.side3D = +((kn[0] - ex[0]) * -u[1] + (kn[1] - ex[1]) * u[0]).toFixed(2);
      r.sideAgree = (r.side3D > 0) === r.svgKnotUp;
      const d = fx.api.debug && fx.api.debug();
      // cada saída do ponto da asa (Pf) fica à frente do furo mais próximo, no sentido canhão → saída do cateter
      if (d && d.wings && ext.wingHoles) r.wing3DFront = d.wings.every((w) => { const h = ext.wingHoles.slice().sort((a, b) => Math.hypot(a[0] - w.Pf[0], a[1] - w.Pf[1]) - Math.hypot(b[0] - w.Pf[0], b[1] - w.Pf[1]))[0]; return (w.Pf[0] - h[0]) * (ex[0] - hub[0]) + (w.Pf[1] - h[1]) * (ex[1] - hub[1]) > 0; });
    }
    return r;
  });
  check(info.fixSide.svgBiteUp && info.fixSide.svgKnotUp, 'fixação: ponto/nó de ancoragem do esquema fora do lado de cima (lateral-cranial)');
  check(info.fixSide.sideAgree !== false, 'fixação: esquema e 3D com a âncora em lados opostos do cateter');
  check(info.fixSide.svgWingFront && info.fixSide.wing3DFront !== false, 'fixação: ponto das asas não sai à frente da asa (rumo ao nariz) no esquema/3D');
  check(info.fixSide.cm === '16', 'fixação: marca em cm do esquema ≠ 16');

  // (2) captura PNG/impressão com os mesmos filtros de rótulo do visor: fixação etapa 4 (sem 3º cruzamento, nó final,
  // asas nem curativo) e cap. 10 etapa 7 "Cateter" (sem os rótulos do dilatador, que saiu de cena)
  info.snapLabels = await page.evaluate(async () => {
    const E = APP.E, D = APP.data, r = {};
    const STAGE = ['indexTip', 'thumbTip', 'palm', 'thumbVector', 'needleTip', 'needleHub', 'wireTip', 'wireIJV', 'dilatorTip', 'dilatorLimit', 'catheterTip', 'catheterHub', 'catheterSkinMark'];
    const fa = (E.results.fixation && E.results.fixation.api && E.results.fixation.api.anchorSteps) || {};
    const filtered = (k) => STAGE.includes(k) || !!fa[k] || /^fix/.test(k);
    // captura com o aspecto do visor (o enquadramento horizontal é o mesmo); "à vista" = L.vis (com ou sem espaço livre)
    const cv = E.renderer.domElement, SW = 1000, SH = Math.round(1000 * cv.clientHeight / Math.max(1, cv.clientWidth));
    const onScreen = () => APP.state.labels.filter((L) => L.vis).map((L) => L.key);
    const fi = D.chapters.findIndex((c) => c.id === 'fixacao');
    if (fi >= 0) {
      APP.go(fi, { animate: false }); APP.stopFix();
      document.querySelector('#fixStepper [data-fix="4"]').click(); APP.still();
      const vis = onScreen(); await APP.composeSnapshot(SW, SH, { labels: true, fmt: 'image/png' }); const snap = APP.snapLabels();
      r.fix4 = { vis, snap, extra: snap.filter((k) => filtered(k) && !vis.includes(k)) };
      r.fix4ok = !snap.some((k) => ['fixCross3', 'fixFinalKnot', 'fixWingStitchA', 'fixWingStitchB', 'fixDressing'].includes(k)) && !r.fix4.extra.length;
    }
    const ci = D.chapters.findIndex((c) => (c.scene.labels || []).some((l) => (Array.isArray(l) ? l[0] : l.key) === 'dilatorTip'));
    if (ci >= 0) {
      APP.go(ci, { animate: false });
      document.querySelector('[data-step="7"]').click(); APP.still();
      const vis = onScreen(); await APP.composeSnapshot(SW, SH, { labels: true, fmt: 'image/png' }); const snap = APP.snapLabels();
      r.cath7 = { vis, snap, extra: snap.filter((k) => filtered(k) && !vis.includes(k)) };
      r.cath7ok = !snap.some((k) => /^dilator/.test(k)) && !r.cath7.extra.length;
      // impressão: a mesma cena em modo 'print' (cena do capítulo, dilatador em cena) tem os rótulos do dilatador
      APP.applyScene(D.chapters[ci].scene, 'print'); APP.still(); await APP.composeSnapshot(SW, SH, { labels: true }); r.cathPrint = APP.snapLabels();
    }
    APP.resume(); APP.go(0, { animate: false });
    return r;
  });
  check(info.snapLabels.fix4ok !== false, 'captura: rótulos da fixação fora de etapa na etapa 4: ' + JSON.stringify(info.snapLabels.fix4 && info.snapLabels.fix4.extra));
  check(info.snapLabels.cath7ok !== false, 'captura: rótulos do dilatador no cap. 10 etapa 7: ' + JSON.stringify(info.snapLabels.cath7 && info.snapLabels.cath7.snap));

  // (3) laço sob demanda: lote [fora, dentro] do IntersectionObserver vale a ÚLTIMA entrada; 'offscreen' com o visor
  // à vista é desfeito pela próxima atividade (clique)
  info.io = await page.evaluate(async () => {
    window.scrollTo(0, 0); await new Promise((res) => setTimeout(res, 200));
    const v = document.getElementById('viewer'), it = (window.__io || []).find((o) => o.el === v), r = { observer: !!it };
    if (!it) return r;
    it.cb([{ isIntersecting: false, target: v }, { isIntersecting: true, target: v }]);
    r.batchOk = !APP.loop().pauses.includes('offscreen');
    it.cb([{ isIntersecting: true, target: v }, { isIntersecting: false, target: v }]);
    r.pausedByBatch = APP.loop().pauses.includes('offscreen');
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    r.safeguard = !APP.loop().pauses.includes('offscreen');
    return r;
  });
  check(info.io.observer && info.io.batchOk && info.io.safeguard, 'laço: visor congelado como "offscreen" com o visor à vista: ' + JSON.stringify(info.io));

  // curativo só na etapa 9 (antes dela não há filme nem esponja visíveis) e campo estéril religado ao voltar
  info.dress = await page.evaluate(() => {
    const E = APP.E, D = APP.data, r = { steps: {} }, fi = D.chapters.findIndex((c) => c.id === 'fixacao');
    if (fi < 0 || !E.results.fixation) return r;
    const shown = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; const m = o.material; return !(m && m.transparent && m.opacity < 0.05); };
    const vis = (id) => { const g = window.ATLAS.registry.get(id); return !!g && g.objects.some((o) => { let any = false; o.traverse((q) => { if (q.isMesh && shown(q)) any = true; }); return any; }); };
    APP.go(fi, { animate: false }); APP.stopFix();
    for (const k of [2, 5, 8, 9]) { document.querySelector(`#fixStepper [data-fix="${k}"]`).click(); APP.still(); r.steps[k] = { film: vis('dressing-transparent'), chg: vis('chg-pad') }; }
    r.beforeOk = [2, 5, 8].every((k) => !r.steps[k].film && !r.steps[k].chg);
    r.at9 = r.steps[9].film;
    // campo estéril: ligado pelo leitor, retirado no curativo e religado ao voltar à etapa 5
    if (E.layers.drape) {
      document.querySelector('#fixStepper [data-fix="3"]').click(); APP.tickAnims(0);
      if (!E.layers.drape.visible) { document.querySelector('[data-layer="drape"]').click(); APP.tickAnims(0); }
      document.querySelector('#fixStepper [data-fix="9"]').click(); APP.tickAnims(0); r.drapeOffAt9 = !E.layers.drape.visible;
      document.querySelector('#fixStepper [data-fix="5"]').click(); APP.tickAnims(0); r.drapeBack = E.layers.drape.visible;
    }
    APP.resume(); APP.go(0, { animate: false });
    return r;
  });
  check(info.dress.beforeOk !== false, 'fixação: curativo visível antes da etapa 9 (módulo fixation): ' + JSON.stringify(info.dress.steps));
  check(info.dress.at9 !== false, 'fixação: curativo ausente na etapa 9');
  check(info.dress.drapeOffAt9 !== false && info.dress.drapeBack !== false, 'fixação: campo estéril não retirado no curativo ou não religado ao voltar');

  // campo estéril na animação em tempo real (▶ da fixação, etapas 7 → 9): visível até o fim da etapa 8, retirado uma
  // única vez já com k = 8 (pausa antes do curativo) e sem voltar até o fim — amostra a cada quadro
  // (requestAnimationFrame) e conta os avisos "Campo estéril retirado para o curativo" (regressão: piscava no 1º quadro
  // do movimento da 9).
  info.dressAnim = await page.evaluate(async () => {
    const E = APP.E, D = APP.data, fi = D.chapters.findIndex((c) => c.id === 'fixacao');
    if (fi < 0 || !E.results.fixation || !E.layers.drape || matchMedia('(prefers-reduced-motion: reduce)').matches) return { skipped: true };
    window.scrollTo(0, 0);
    APP.go(fi, { animate: false }); APP.stopFix(); APP.resume();
    document.querySelector('#fixStepper [data-fix="7"]').click(); APP.tickAnims(0);
    if (!E.layers.drape.visible) document.querySelector('[data-layer="drape"]').click();
    APP.tickAnims(0);
    const r = { startVisible: E.layers.drape.visible, frames: 0, log: [], notices: 0, offK: null, offEarly: false, backOn: false };
    const nb = document.getElementById('notice');
    const mo = new MutationObserver((recs) => { recs.forEach((q) => { if ([...q.addedNodes].some((n) => /Campo estéril retirado/.test(n.textContent || ''))) r.notices++; }); });
    if (nb) mo.observe(nb, { childList: true });
    document.getElementById('fixPlay').click();
    r.startK = APP.anims.fix ? APP.anims.fix.k : null;
    await new Promise((done) => {
      const t0 = performance.now(); let prev = '', off = false;
      const sample = () => {
        const F = APP.anims.fix, v = E.layers.drape.visible, k = F ? F.k : null;
        r.frames++;
        const key = k + (F && F.move ? '>' : '') + (v ? ' campo' : ' sem');
        if (key !== prev) { prev = key; r.log.push(key); }
        if (!v && !off) { off = true; r.offK = k; }
        if (v && off) r.backOn = true;
        if (!v && F && F.k < 8) r.offEarly = true;
        if (!F || performance.now() - t0 > 120000) return done();
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await new Promise((res) => setTimeout(res, 50)); // entrega dos últimos registros do MutationObserver
    mo.disconnect();
    r.timedOut = !!APP.anims.fix;
    r.end = { step: +E.state.fixStep, drape: E.layers.drape.visible };
    APP.stopFix(); APP.go(0, { animate: false });
    return r;
  });
  if (!info.dressAnim.skipped) {
    const d = info.dressAnim;
    check(d.startVisible && d.startK === 7 && !d.timedOut && d.end.step === 9, 'fixação: animação 7 → 9 não completou: ' + JSON.stringify(d));
    check(!d.offEarly && d.offK === 8 && !d.backOn && d.end.drape === false && d.notices === 1, 'fixação: campo estéril piscou ou foi retirado fora da etapa 8 → 9 na animação: ' + JSON.stringify(d));
  }

  // teclado e botões de vista/zoom soltam a câmera da animação da fixação; textos da fixação (stepper = api.steps,
  // cartão "na fixação", inset sem repetir a introdução) e insets com as linhas do capítulo
  {
    const fi = await page.evaluate(() => APP.data.chapters.findIndex((c) => c.id === 'fixacao'));
    if (fi >= 0) {
      await page.evaluate((fi) => { APP.go(fi, { animate: false }); APP.resume(); if (!APP.anims.fix) document.getElementById('fixPlay').click(); APP.E.renderer.domElement.focus(); }, fi);
      await page.keyboard.press('ArrowLeft');
      const kbd = await page.evaluate(() => !!(APP.anims.fix && APP.anims.fix.free));
      await page.evaluate(() => { APP.stopFix(); document.getElementById('fixPlay').click(); document.querySelector('#viewBar [data-view="oblique"]').click(); });
      const view = await page.evaluate(() => !!(APP.anims.fix && APP.anims.fix.free));
      await page.evaluate(() => { APP.stopFix(); document.getElementById('fixPlay').click(); document.getElementById('zoomIn').click(); });
      const zoom = await page.evaluate(() => !!(APP.anims.fix && APP.anims.fix.free));
      const reduced = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
      info.fixFree = { kbd, view, zoom };
      check(reduced || (kbd && view && zoom), 'fixação: teclado/vista/zoom não soltaram a câmera da animação: ' + JSON.stringify(info.fixFree));
    }
    info.texts = await page.evaluate((fi) => {
      const r = {}, api = APP.E.results.fixation && APP.E.results.fixation.api;
      APP.stopFix();
      const t = (k) => (document.querySelector(`#fixStepper [data-fix="${k}"]`) || {}).title || '';
      const lbl = (k) => (api && api.steps && api.steps[k] && api.steps[k].short) || '';
      r.stepper = [t(2), t(6)];
      r.stepperOk = !api || (t(2).indexOf(lbl(2)) >= 0 && t(6).indexOf(lbl(6)) >= 0 && document.querySelector('#fixStepper [data-fix="6"]').getAttribute('aria-label').indexOf(lbl(6)) >= 0);
      APP.openCard('suture-anchor'); r.cardFix = document.getElementById('cardRelH').textContent;
      APP.openCard('scv-R'); r.cardPunc = document.getElementById('cardRelH').textContent; APP.closeCard();
      if (fi >= 0) { APP.go(fi, { animate: false }); APP.stopFix(); const p = document.querySelector('#painel .fx-intro'); r.introRepeat = !!p && /é o nome usado no ensino/.test(p.textContent); }
      const ix = (id) => APP.data.chapters.findIndex((c) => c.id === id), txt = (id) => { const i = ix(id); if (i < 0) return null; APP.go(i, { animate: false }); const el = document.querySelector('#painel .inset'); return el ? el.textContent : ''; };
      const dist = txt('distancias'), asym = txt('vasos');
      r.distOk = dist == null || (/clavícula–veia/.test(dist) && !/Expiração completa|escaleno/.test(dist));
      r.asymOk = asym == null || (/Artéria subclávia/.test(asym) && /Linfáticos/.test(asym));
      // scene.insetRows do cap. 03 (Assimetria fixa): exatamente essas linhas, cada consulta casando com uma só
      const vc = APP.data.chapters[ix('vasos')], q = vc && vc.scene && vc.scene.insetRows;
      if (asym != null && Array.isArray(q) && q.length) {
        const nrm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
        const topics = [...document.querySelectorAll('#painel .inset-asymmetry .mini-list li strong')].map((e) => e.textContent);
        r.asymRows = topics;
        r.asymOk = r.asymOk && topics.length === q.length && q.every((s) => typeof s === 'number' || topics.filter((t) => nrm(t).indexOf(nrm(s)) >= 0).length === 1);
      }
      APP.go(0, { animate: false });
      return r;
    }, fi);
    check(info.texts.stepperOk, 'fixação: rótulos do stepper ≠ api.steps: ' + info.texts.stepper.join(' | '));
    check(info.texts.cardFix === 'Relevância na fixação' && info.texts.cardPunc === 'Relevância para a punção', 'cartão: título da relevância não distingue fixação × punção');
    check(!info.texts.introRepeat, 'fixação: inset repete a introdução do capítulo');
    check(info.texts.distOk && info.texts.asymOk, 'insets: linhas fora do capítulo (Medidas/Assimetria)');
  }

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
  // fitSheets: corpo em décimos exatos (9,2 − 5 × 0,2 em ponto flutuante passava de 8,2 e o 2º estágio descia a 8,0),
  // 7–9,2 pt, ilustração 58–92 mm (capa: até 104). Folha extra da fixação: evidência da própria bailarina e lista das
  // alternativas à sutura (o 3º parágrafo do capítulo remete a elas "no passo a passo").
  info.print = await page.evaluate(async () => {
    await APP.buildPrint({ print: false, placeholder: true });
    const sh = [...document.querySelectorAll('#printRoot .sheet')];
    const fit = sh.map((s) => [parseFloat(s.style.getPropertyValue('--fs')), parseFloat(s.style.getPropertyValue('--hero'))]);
    const fx = document.querySelector('#printRoot .fx-sheet'), F = APP.data.fixation;
    return { sheets: sh.length, main: sh.filter((s) => !s.classList.contains('extra')).length, extra: sh.filter((s) => s.classList.contains('extra')).length, overflow: sh.filter((s) => s.dataset.fit !== 'ok').length, overflowAt: sh.map((s, i) => (s.dataset.fit !== 'ok' ? i : -1)).filter((i) => i >= 0), chapters: APP.data.chapters.length,
      fit: fit.map(([f, h]) => f.toFixed(2) + '/' + h), fitBad: fit.map(([f, h], i) => ((Math.abs(f * 10 - Math.round(f * 10)) > 1e-6 || f < 7 - 1e-6 || f > 9.2 + 1e-6 || h < 58 || h > (i ? 92 : 104)) ? i : -1)).filter((i) => i >= 0),
      fxEvidence: !F || !F.evidence || (!!fx && /Howes/.test(fx.textContent) && /Earley/.test(fx.textContent)),
      fxAlts: !F || !(F.alternatives || []).length || (!!fx && /Alternativas à sutura/.test(fx.textContent) && /ancoragem subcutânea/i.test(fx.textContent)) };
  });
  check(info.print.main === info.print.chapters + 1 && info.print.overflow === 0, 'folhas de impressão incorretas');
  check(!info.fix.chapter || info.print.extra === 1, 'folha extra da fixação ausente');
  check(!info.print.fitBad.length, 'impressão: ajuste fora dos estágios (corpo/ilustração) nas folhas ' + info.print.fitBad.join(',') + ': ' + info.print.fit.join(' '));
  check(!info.fix.chapter || (info.print.fxEvidence && info.print.fxAlts), 'impressão: folha extra da fixação sem a evidência ou sem as alternativas à sutura');

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
