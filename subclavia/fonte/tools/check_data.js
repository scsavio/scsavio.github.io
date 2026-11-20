#!/usr/bin/env node
/* check_data.js — valida src/data.js (+ src/data.fixacao.js, se presente) contra CONTENT_SPEC.md, SPEC.md §4 e
   notes/FIXACAO_CONTRACT.md.
   Uso: node tools/check_data.js [--registry]   (sai com código 1 se houver erros)
     --registry  constrói os módulos 3D em Node (sem render) e confere se TODO id registrado tem entrada no
                 glossário (erro) e se o grupo do glossário coincide com o do registro (aviso). Mais lento (~10–30 s). */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const P = path.resolve(__dirname, '..');
const ARGS = new Set(process.argv.slice(2));

global.window = global.window || {};
require(path.join(P, 'src/landmarks.js'));
const LM = global.window.LM;
require(path.join(P, 'src/data.js'));
const FIX_FILE = path.join(P, 'src/data.fixacao.js');
const hasFix = fs.existsSync(FIX_FILE);
if (hasFix) require(FIX_FILE);          // insere o capítulo 'fixacao' após 'cateter' e renumera
const D = global.window.ATLAS_DATA;

/* ---- ids e âncoras canônicos a partir da tabela de SPEC.md §4 ---- */
const spec = fs.readFileSync(path.join(P, 'SPEC.md'), 'utf8');
const sec = spec.split('## 4.')[1].split('## 5.')[0];
const rows = sec.split('\n').filter((l) => /^\| *(skeleton|vessels|muscles|nerves|viscera|skin|instruments)/.test(l));
const ids = new Set(), anchors = new Set();
const expand = (tok) => {
  tok = tok.replace(/\(.*?\)/g, '').trim();
  if (!tok) return [];
  if (/^rib-N-R\/L$/.test(tok)) { const o = []; for (let i = 1; i <= 12; i++) o.push('rib-' + i + '-R', 'rib-' + i + '-L'); return o; }
  if (/^costal-cartilage-N-R\/L$/.test(tok)) { const o = []; for (let i = 1; i <= 10; i++) o.push('costal-cartilage-' + i + '-R', 'costal-cartilage-' + i + '-L'); return o; }
  if (/^vertebra-XX$/.test(tok)) return ['C4', 'C5', 'C6', 'C7', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'].map((v) => 'vertebra-' + v);
  if (/-R\/L$/.test(tok)) { const b = tok.replace(/-R\/L$/, ''); return [b + '-R', b + '-L']; }
  return [tok];
};
rows.forEach((r) => {
  const c = r.split('|').map((s) => s.replace(/\([^)]*\)/g, '').trim());
  c[2].split(',').forEach((t) => expand(t).forEach((x) => ids.add(x)));
  c[3].split(',').forEach((t) => { t = t.replace(/\(.*?\)/g, '').trim(); if (t) anchors.add(t); });
});

/* ---- fixação em bailarina (notes/FIXACAO_CONTRACT.md): âncoras e ids do módulo 'fixation' ---- */
const FIX_ANCHORS = new Set(['fixExit', 'fixAnchorStitch', 'fixAnchorKnot', 'fixTails', 'fixCross1', 'fixCross2', 'fixCross3',
  'fixFinalKnot', 'fixWingStitchA', 'fixWingStitchB', 'fixDressing', 'needleHolder', 'sutureNeedle']);
const FIX_IDS = new Set(['suture-ballerina', 'suture-anchor', 'suture-wing', 'needle-holder', 'suture-needle', 'dressing-transparent', 'chg-pad']);
/* ---- âncoras e ids extras exportados pelos módulos além da tabela do SPEC §4 (dilatador, marca do cateter etc.):
   aceitos aqui; com --registry, confere-se que existem de fato nos módulos construídos ---- */
const EXTRA_ANCHORS = new Set(['dilatorTip', 'dilatorLimit', 'catheterSkinMark', 'catheterHub', 'syringe', 'needleGuide', 'angleArc', 'coronalPlane']);
const EXTRA_IDS = new Set(['dilator', 'dilator-limit', 'guidewire-ijv', 'needle-angle', 'coronal-plane', 'needle-direction', 'landmark-entry', 'landmark-notch', 'thumb-vector', 'aspirated-blood']);
const isAnchor = (k) => anchors.has(k) || FIX_ANCHORS.has(k) || EXTRA_ANCHORS.has(k);

const err = [], warn = [];
const LAYERS = ['skin', 'bones', 'muscle', 'vein', 'artery', 'nerve', 'lymph', 'lung', 'pleura', 'mediastinum', 'hand', 'instrument', 'drape', 'aids'];
const INSETS = [null, 'planes', 'layers', 'distances', 'complications', 'usg', 'checklist', 'asymmetry', 'fixation'];
const ANIMS = [null, 'hand', 'breath', 'needle', 'wire', 'fix'];
const srcN = new Set(D.sources.map((s) => s.n));
const isArr = Array.isArray;

['title', 'subtitle', 'version', 'reviewDate', 'disclaimer', 'basedOn', 'modelNote'].forEach((k) => { if (!D.meta || !D.meta[k]) err.push('meta.' + k + ' ausente'); });
if (D.meta.version !== '2.0') err.push('meta.version ≠ 2.0');

const chIds = new Set();
D.chapters.forEach((c, i) => {
  const tag = 'cap ' + (c.id || c.n || i);
  ['id', 'n', 'short', 'title', 'focus', 'detail'].forEach((k) => { if (!c[k]) err.push(tag + ': ' + k + ' ausente'); });
  if (chIds.has(c.id)) err.push(tag + ': id duplicado'); chIds.add(c.id);
  if (c.n !== String(i + 1).padStart(2, '0')) err.push(tag + ': n fora de sequência');
  if ([...c.short].length > 14) err.push(tag + ': short > 14 (' + c.short + ')');
  if (!isArr(c.body) || c.body.length < 2 || c.body.length > 4) err.push(tag + ': body deve ter 2–4 parágrafos');
  if (!isArr(c.keyPoints) || c.keyPoints.length < 3 || c.keyPoints.length > 5) err.push(tag + ': keyPoints 3–5');
  if (!isArr(c.pitfalls) || c.pitfalls.length > 3) err.push(tag + ': pitfalls 0–3');
  if (!isArr(c.sources) || !c.sources.length) err.push(tag + ': sources vazio');
  (c.sources || []).forEach((n) => { if (!srcN.has(n)) err.push(tag + ': fonte ' + n + ' inexistente'); });
  const q = c.quiz;
  if (!q || !q.q || !isArr(q.options) || q.options.length !== 4 || !Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3 || !q.explain) err.push(tag + ': quiz inválido');
  else if (new Set(q.options).size !== 4) err.push(tag + ': opções do quiz repetidas');
  const s = c.scene;
  if (!s) { err.push(tag + ': scene ausente'); return; }
  if (typeof s.view === 'string') { if (!LM.views[s.view]) err.push(tag + ': view desconhecida ' + s.view); }
  else if (!s.view || !isArr(s.view.target) || s.view.target.length !== 3 || !(s.view.radius > 0) || typeof s.view.az !== 'number' || typeof s.view.el !== 'number') err.push(tag + ': view objeto inválido');
  else {
    // limites do motor (engine.js): raio 8–140; elevação −1,35…1,45 (o arrasto não alcança além disso)
    if (s.view.radius < 8 || s.view.radius > 140) err.push(tag + ': view.radius fora de 8–140');
    if (s.view.el < -1.35 || s.view.el > 1.45) err.push(tag + ': view.el fora de −1,35…1,45');
  }
  (s.layers || []).forEach((l) => { if (!LAYERS.includes(l)) err.push(tag + ': camada inválida ' + l); });
  if (s.ghost) Object.keys(s.ghost).forEach((l) => { if (!LAYERS.includes(l)) err.push(tag + ': ghost em camada inválida ' + l); else if (!(s.layers || []).includes(l)) warn.push(tag + ': ghost em camada oculta ' + l); else if (!(s.ghost[l] > 0 && s.ghost[l] < 1)) err.push(tag + ': ghost fora de (0,1) em ' + l); });
  const st = s.state || {};
  ['phase', 'handPose', 'breath', 'rollMode', 'wireMal', 'showPlanes'].forEach((k) => { if (!(k in st)) err.push(tag + ': state.' + k + ' ausente'); });
  if (!(st.phase >= 0 && st.phase <= 6)) err.push(tag + ': phase fora de 0–6');
  // fases inteiras 0–6, mais a subfase do dilatador (instruments: 5,25–5,75)
  else if (!Number.isInteger(st.phase) && !(st.phase >= 5.25 && st.phase < 5.75)) err.push(tag + ': phase fracionária fora da subfase do dilatador (5,25–5,75)');
  if ('dilator' in st) { if (typeof st.dilator !== 'boolean') err.push(tag + ': state.dilator deve ser booleano'); }
  /* state.dilator ausente: o app zera via DEFAULT_STATE a cada cena (sem vazamento) — não é aviso */
  if (st.dilator && st.phase < 4.5) warn.push(tag + ': state.dilator sem efeito com phase < 4,5');
  const dilOn = !!(st.dilator && st.phase >= 4.5) || (st.phase >= 5.25 && st.phase < 5.75);
  if (dilOn && st.fixStep > 0) err.push(tag + ': dilatador e fixação na mesma cena (o dilatador oculta o cateter)');
  if (!['none', 'interscapular', 'ipsilateral'].includes(st.rollMode)) err.push(tag + ': rollMode inválido');
  if ('fixStep' in st) {
    if (!(Number.isInteger(st.fixStep) && st.fixStep >= 0 && st.fixStep <= 9)) err.push(tag + ': fixStep fora de 0–9 (inteiro)');
    if (st.fixStep > 0 && st.phase !== 6) err.push(tag + ': fixStep > 0 exige phase 6');
  } else if (hasFix) warn.push(tag + ': state.fixStep ausente (a bailarina pode vazar entre cenas)');
  if (st.phase > 0 && !(s.layers || []).includes('instrument')) warn.push(tag + ': phase>0 sem camada instrument');
  if (s.anim === 'fix' && c.inset !== 'fixation') warn.push(tag + ": anim 'fix' sem inset 'fixation'");
  if (s.clip && (!isArr(s.clip.normal) || !isArr(s.clip.point) || !s.clip.label)) err.push(tag + ': clip inválido');
  if (!isArr(s.labels) || s.labels.length < 3 || s.labels.length > 7) err.push(tag + ': labels 3–7');
  (s.labels || []).forEach(([k, t]) => {
    if (!isAnchor(k)) err.push(tag + ': âncora não canônica ' + k);
    if (FIX_ANCHORS.has(k) && c.id !== 'fixacao') warn.push(tag + ': âncora da fixação fora do capítulo da fixação ' + k);
    if (!t) err.push(tag + ': rótulo vazio ' + k);
  });
  const keys = (s.labels || []).map((l) => l[0]);
  if (new Set(keys).size !== keys.length) err.push(tag + ': âncora repetida nos rótulos');
  if (s.highlight && !ids.has(s.highlight) && !EXTRA_IDS.has(s.highlight) && !(FIX_IDS.has(s.highlight) && c.id === 'fixacao')) err.push(tag + ': highlight não canônico ' + s.highlight);
  if (s.highlight && !D.glossary[s.highlight]) err.push(tag + ': highlight sem entrada no glossário ' + s.highlight);
  if (s.highlight === 'dilator' && !dilOn) warn.push(tag + ': destaque do dilatador sem o dilatador em cena');
  if (keys.some((k) => /^dilator/.test(k)) && !dilOn) warn.push(tag + ': rótulo do dilatador sem o dilatador em cena');
  if (keys.includes('catheterTip') && dilOn) warn.push(tag + ': rótulo da ponta do cateter com o dilatador em cena (cateter oculto)');
  if (!ANIMS.includes(s.anim)) err.push(tag + ': anim inválida');
  if (!INSETS.includes(c.inset)) err.push(tag + ': inset inválido');
  if (c.inset === 'fixation' && !D.fixation) err.push(tag + ": inset 'fixation' sem ATLAS_DATA.fixation");
});

/* textos: capítulos se referem por nome/id, nunca por número (a fixação renumera os capítulos em tempo de carga) */
const txt = JSON.stringify(D);
const numRef = txt.match(/(cap\.|capítulo|cena)\s*\d{1,2}\b/gi);
if (numRef) err.push('referência numérica a capítulo (use o nome/id): ' + [...new Set(numRef)].join(', '));

/* glossário */
const gl = D.glossary;
ids.forEach((id) => { if (!gl[id]) err.push('glossário sem id canônico: ' + id); });
let glExtra = 0;
Object.entries(gl).forEach(([id, e]) => {
  ['name', 'group', 'desc', 'relevance'].forEach((k) => { if (!e[k]) err.push('glossário ' + id + ': ' + k + ' ausente'); });
  if (!D.glossaryGroups.includes(e.group)) err.push('glossário ' + id + ': grupo inválido ' + e.group);
  if (!ids.has(id)) glExtra++;
});

/* tabelas */
const chkSrc = (arr, name) => arr.forEach((x, i) => { const s = isArr(x.source) ? x.source : [x.source]; s.forEach((n) => { if (!srcN.has(n)) err.push(name + '[' + i + ']: fonte ' + n + ' inexistente'); }); });
chkSrc(D.measurements, 'measurements');
chkSrc(D.complications, 'complications');
D.complications.forEach((c, i) => { if (!ids.has(c.structure)) err.push('complications[' + i + ']: structure não canônica ' + c.structure); ['name', 'mechanism', 'recognition', 'prevention'].forEach((k) => { if (!c[k]) err.push('complications[' + i + '].' + k); }); });
D.layersTable.forEach((l, i) => { if (l.depth !== i + 1 || !l.tissue || !l.note) err.push('layersTable[' + i + '] inválida'); });
if (!D.checklist.length) err.push('checklist vazio');
if (!D.usg || !D.usg.caption || !D.usg.labels.length) err.push('usg incompleto');
if (!D.prancha || !D.prancha.annotations.length) err.push('prancha incompleta');
if (!D.asymmetry.length) err.push('asymmetry vazio');
D.sources.forEach((s, i) => { if (s.n !== i + 1 || !s.title || !s.detail || !/^https:\/\//.test(s.url)) err.push('sources[' + i + '] inválida'); });
if (D.fixation) {
  const f = D.fixation;
  if (!f.title || !isArr(f.steps)) err.push('fixation: title/steps ausentes');
  else {
    const ks = f.steps.map((x) => x.k);
    for (let k = 1; k <= 9; k++) if (!ks.includes(k)) err.push('fixation: etapa ' + k + ' ausente');
    f.steps.forEach((x) => { if (!x.title || !x.text) err.push('fixation: etapa ' + x.k + ' sem title/text'); });
  }
  (isArr(f.sources) ? f.sources : []).forEach((n) => { if (!srcN.has(n)) err.push('fixation.sources: fonte ' + n + ' inexistente'); });
}
const used = new Set();
D.chapters.forEach((c) => c.sources.forEach((n) => used.add(n)));
[...D.measurements, ...D.complications].forEach((x) => (isArr(x.source) ? x.source : [x.source]).forEach((n) => used.add(n)));
if (D.fixation && isArr(D.fixation.sources)) D.fixation.sources.forEach((n) => used.add(n));
D.sources.forEach((s) => { if (!used.has(s.n)) warn.push('fonte ' + s.n + ' não citada em capítulos/tabelas'); });

/* texto: HTML simples apenas */
const tags = (txt.match(/<\/?([a-z]+)/g) || []).map((t) => t.replace(/[<\/]/g, ''));
const bad = [...new Set(tags)].filter((t) => !['strong', 'em'].includes(t));
if (bad.length) err.push('tags HTML não permitidas: ' + bad.join(','));

/* ---- opcional: registro dos módulos 3D × glossário ---- */
async function registryCheck() {
  const ctx2d = new Proxy({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), measureText: () => ({ width: 10 }) },
    { get: (t, k) => (k in t ? t[k] : () => ({ addColorStop() {} })), set: () => true });
  const g = global;
  g.window = g; g.self = g;
  g.document = g.document || { createElement: () => ({ getContext: () => ctx2d, width: 0, height: 0, style: {} }) };
  vm.runInThisContext(fs.readFileSync(path.join(P, 'vendor/three.js'), 'utf8'));
  const mods = fs.readFileSync(path.join(P, 'tools/modules.txt'), 'utf8').split(/\s+/).filter(Boolean).filter((m) => fs.existsSync(path.join(P, 'src/modules', m + '.js')));
  for (const f of ['src/core.js', 'src/landmarks.js', ...mods.map((m) => 'src/modules/' + m + '.js')]) vm.runInThisContext(fs.readFileSync(path.join(P, f), 'utf8'), { filename: f });
  const THREE = g.THREE, ATLAS = g.ATLAS;
  const C = ATLAS.makeCore(THREE, 1); C.initMaterials();
  const layers = {}; LAYERS.forEach((n) => (layers[n] = new THREE.Group()));
  const world = new THREE.Group(); Object.values(layers).forEach((x) => world.add(x));
  const E = { state: { breath: 0, handPose: 1, phase: 0, fixStep: 0 }, results: {}, anchors: {}, errors: [], layers };
  const mctx = { THREE, C, LM: g.LM, layers, world, engine: E, ATLAS, scene: new THREE.Scene() };
  const modErr = [];
  for (const m of mods) {
    try { const r = await ATLAS.modules[m](mctx); E.results[m] = r || {}; if (r && r.anchors) Object.assign(E.anchors, r.anchors); }
    catch (e) { modErr.push(m + ': ' + (e && e.message)); }
  }
  const missingGloss = [], groupDiff = [];
  for (const [id, e] of ATLAS.registry) {
    if (!gl[id]) missingGloss.push(id);
    else if (e.info && e.info.group && gl[id].group !== e.info.group) groupDiff.push(id + ' (glossário ' + gl[id].group + ' × registro ' + e.info.group + ')');
  }
  missingGloss.forEach((id) => err.push('registro sem glossário: ' + id));
  // destaque: o id precisa existir no registro (a mão GLB não carrega em Node: operator-hand fica de fora)
  D.chapters.forEach((c) => { const h = c.scene && c.scene.highlight; if (h && h !== 'operator-hand' && !ATLAS.registry.has(h) && !(FIX_IDS.has(h) && !mods.includes('fixation'))) err.push('cap ' + c.id + ': highlight ' + h + ' não registrado pelos módulos'); });
  groupDiff.forEach((x) => warn.push('grupo divergente: ' + x));
  modErr.forEach((x) => warn.push('módulo (Node, sem render) falhou: ' + x));
  // âncoras usadas nos rótulos existem nos módulos construídos (a mão GLB não carrega em Node: indexTip/thumbTip/palm ficam de fora)
  const built = new Set(Object.keys(E.anchors));
  const handOnly = new Set(['indexTip', 'thumbTip', 'palm']);
  D.chapters.forEach((c) => (c.scene.labels || []).forEach(([k]) => {
    if (built.has(k) || handOnly.has(k)) return;
    if (FIX_ANCHORS.has(k) && !mods.includes('fixation')) return;
    err.push('cap ' + c.id + ': âncora ' + k + ' não exportada pelos módulos');
  }));
  return { modules: mods, registry: ATLAS.registry.size, missingGloss: missingGloss.length };
}

(async () => {
  const reg = ARGS.has('--registry') ? await registryCheck() : null;
  console.log(JSON.stringify({
    fixacao: hasFix, chapters: D.chapters.length, chapterIds: D.chapters.map((c) => c.n + ':' + c.id).join(' '),
    glossary: Object.keys(gl).length, glossaryNonCanonical: glExtra, canonicalIds: ids.size, canonicalAnchors: anchors.size,
    sources: D.sources.length, measurements: D.measurements.length, complications: D.complications.length,
    answers: D.chapters.map((c) => c.quiz.answer).join(''), registry: reg, errors: err, warnings: warn,
  }, null, 1));
  process.exit(err.length ? 1 : 0);
})();
