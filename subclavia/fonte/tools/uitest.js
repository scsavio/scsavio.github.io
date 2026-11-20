// uitest.js — testes funcionais da interface (Playwright + SwiftShader).
// uso: node tools/uitest.js [--dist]
// Verifica: deep-link #cap-NN, teclas ←/→, troca de cena sem estado vazado, autoteste, insets compactos,
// camadas/ghost/corte/etapas, captura PNG, tema persistido, Esc no cartão, impressão (folhas = capítulos + capa
// + folhas extras marcadas .extra), fixação em bailarina (stepper 0–9 na etapa 6, inset sincronizado, animação,
// #cap-fixacao, fixStep zerado nos outros capítulos), controles que ligam a camada de que dependem, glossário
// (estruturas-chave primeiro), visor focável pelo teclado, oclusão de rótulos sem auto-oclusão (informativo).
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
    const base = JSON.stringify({ st: { phase: E.state.phase, hand: E.state.handPose, breath: E.state.breath, wire: E.state.wireMal, planes: E.state.showPlanes, roll: E.state.rollMode, fix: E.state.fixStep }, layers: Object.fromEntries(Object.entries(E.layers).map(([k, g]) => [k, g.visible])), clip: E.C.clipPlanes.length });
    document.querySelector('[data-layer="skin"]').click();
    document.getElementById('ghostToggle').click();
    document.querySelector('[data-phase="5"]').click();
    document.getElementById('wireToggle').click();
    document.getElementById('clipToggle').click();
    document.querySelector('[data-roll="ipsilateral"]').click();
    document.getElementById('breathPlay').click();
    APP.go(3, { animate: false }); APP.go(2, { animate: false });
    const again = JSON.stringify({ st: { phase: E.state.phase, hand: E.state.handPose, breath: E.state.breath, wire: E.state.wireMal, planes: E.state.showPlanes, roll: E.state.rollMode, fix: E.state.fixStep }, layers: Object.fromEntries(Object.entries(E.layers).map(([k, g]) => [k, g.visible])), clip: E.C.clipPlanes.length });
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

  // oclusão: âncoras dentro da própria estrutura não viram "profundo" (informativo — depende da geometria)
  info.occ = await page.evaluate(() => {
    const out = {};
    for (const id of ['vasos', 'mao', 'fio']) {
      const i = APP.data.chapters.findIndex((c) => c.id === id); if (i < 0) continue;
      APP.go(i, { animate: false }); APP.still();
      out[id] = APP.state.labels.filter((L) => L.vis).map((L) => L.key + (L.occ ? ':profundo' : ''));
    }
    APP.resume(); APP.go(0, { animate: false });
    return out;
  });

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
