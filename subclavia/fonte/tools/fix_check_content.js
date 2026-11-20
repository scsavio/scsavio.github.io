#!/usr/bin/env node
/* fix_check_content.js — valida src/data.js + src/data.fixacao.js (contrato notes/FIXACAO_CONTRACT.md).
   Uso: node tools/fix_check_content.js   (sai com código 1 se houver erros) */
'use strict';
const path = require('path');
const P = path.resolve(__dirname, '..');
global.window = {};
require(path.join(P, 'src/data.js'));
const before = JSON.parse(JSON.stringify({ n: window.ATLAS_DATA.chapters.length, s: window.ATLAS_DATA.sources.length, c: window.ATLAS_DATA.checklist.length }));
require(path.join(P, 'src/data.fixacao.js'));
const D = window.ATLAS_DATA;
// carga repetida deve ser idempotente
delete require.cache[require.resolve(path.join(P, 'src/data.fixacao.js'))];
require(path.join(P, 'src/data.fixacao.js'));

const err = [], warn = [];
const isArr = Array.isArray;
const CONTRACT_ANCHORS = ['fixExit', 'fixAnchorStitch', 'fixAnchorKnot', 'fixTails', 'fixCross1', 'fixCross2', 'fixCross3', 'fixFinalKnot', 'fixWingStitchA', 'fixWingStitchB', 'fixDressing', 'needleHolder', 'sutureNeedle'];
const CONTRACT_IDS = ['suture-ballerina', 'suture-anchor', 'suture-wing', 'needle-holder', 'suture-needle', 'dressing-transparent', 'chg-pad'];

/* capítulos */
if (D.chapters.length !== 15) err.push('esperados 15 capítulos, há ' + D.chapters.length);
if (D.chapters.length !== before.n + 1) err.push('carga repetida duplicou o capítulo');
D.chapters.forEach((c, i) => { if (c.n !== String(i + 1).padStart(2, '0')) err.push('n fora de sequência em ' + c.id + ': ' + c.n); });
const iCat = D.chapters.findIndex((c) => c.id === 'cateter'), iFix = D.chapters.findIndex((c) => c.id === 'fixacao');
if (iFix !== iCat + 1) err.push('fixacao não está logo após cateter');
const c = D.chapters[iFix];
const srcN = new Set(D.sources.map((s) => s.n));
['id', 'n', 'short', 'title', 'focus', 'detail'].forEach((k) => { if (!c[k]) err.push('fixacao.' + k + ' ausente'); });
if ([...c.short].length > 14) err.push('short > 14');
if (!isArr(c.body) || c.body.length < 2 || c.body.length > 4) err.push('body 2–4');
if (!isArr(c.keyPoints) || c.keyPoints.length < 3 || c.keyPoints.length > 5) err.push('keyPoints 3–5');
if (!isArr(c.pitfalls) || c.pitfalls.length > 3) err.push('pitfalls 0–3');
c.sources.forEach((n) => { if (!srcN.has(n)) err.push('fonte inexistente ' + n); });
const q = c.quiz;
if (!q || !q.q || !isArr(q.options) || q.options.length !== 4 || new Set(q.options).size !== 4 || !Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3 || !q.explain) err.push('quiz inválido');
const s = c.scene;
if (!s.view || s.view.target.length !== 3 || !(s.view.radius > 0)) err.push('view inválida');
['phase', 'handPose', 'breath', 'rollMode', 'wireMal', 'showPlanes', 'fixStep'].forEach((k) => { if (!(k in s.state)) err.push('state.' + k + ' ausente'); });
if (s.state.phase !== 6 || s.state.fixStep !== 9) err.push('state deve ter phase 6, fixStep 9');
if (s.anim !== 'fix' || c.inset !== 'fixation') err.push('anim/inset');
if (!s.layers.includes('instrument') || !s.layers.includes('skin')) err.push('camadas skin/instrument');
if (s.labels.length < 3 || s.labels.length > 7) err.push('labels 3–7');
s.labels.forEach(([k, t]) => { if (!CONTRACT_ANCHORS.includes(k)) err.push('âncora fora do contrato ' + k); if (!t) err.push('rótulo vazio'); });
if (!CONTRACT_IDS.includes(s.highlight)) err.push('highlight fora do contrato');
D.chapters.forEach((ch) => { if (ch !== c && ch.scene && ch.scene.state && ch.scene.state.fixStep !== 0) err.push('fixStep≠0 em ' + ch.id); });

/* passo a passo */
const F = D.fixation;
if (!F || !F.title || !F.intro || !isArr(F.material) || !isArr(F.steps) || !isArr(F.errors) || !isArr(F.alternatives) || !isArr(F.afterCare)) err.push('fixation incompleto');
else {
  if (F.steps.length !== 9) err.push('fixation.steps deve ter 9');
  F.steps.forEach((st, i) => {
    if (st.k !== i + 1) err.push('step k fora de ordem ' + st.k);
    ['title', 'text', 'movement', 'why'].forEach((k) => { if (!st[k]) err.push('step ' + st.k + '.' + k); });
    if (!isArr(st.cautions) || !st.cautions.length) err.push('step ' + st.k + '.cautions');
  });
  (F.sources || []).forEach((n) => { if (!srcN.has(n)) err.push('fixation.sources ' + n); });
}

/* glossário */
CONTRACT_IDS.forEach((id) => { const e = D.glossary[id]; if (!e) err.push('glossário sem ' + id); else ['name', 'group', 'desc', 'relevance'].forEach((k) => { if (!e[k]) err.push('glossário ' + id + '.' + k); }); if (e && !D.glossaryGroups.includes(e.group)) err.push('grupo inválido ' + id); });

/* fontes: sequência 1..N sem colisão; novas citadas */
D.sources.forEach((x, i) => { if (x.n !== i + 1) err.push('sources[' + i + '].n = ' + x.n); if (!x.title || !x.detail || !/^https:\/\//.test(x.url)) err.push('fonte ' + x.n + ' incompleta'); });
if (new Set(D.sources.map((x) => x.n)).size !== D.sources.length) err.push('números de fonte repetidos');
const newS = D.sources.slice(before.s);
newS.forEach((x) => { if (!c.sources.includes(x.n)) warn.push('fonte nova não citada no capítulo ' + x.n); });
// todo autor citado no texto deve ter fonte correspondente
const txt = JSON.stringify([c, F]);
const authors = { Ullman: 'Ullman', Xu: 'Xu H', Yamamoto: 'Yamamoto', 'O’Grady': 'O’Grady', Whitney: 'Whitney', Howes: 'Howes', Fricke: 'Fricke', Wong: 'Wong C', Alsherawi: 'Alsherawi', Rosin: 'Rosin', Nelson: 'Nelson', Kleidon: 'Kleidon', Tomeo: 'Tomeo', Vinjirayer: 'Vinjirayer' };
Object.entries(authors).forEach(([a, d]) => { if (txt.includes(a) && !newS.some((x) => x.detail.includes(d))) err.push('autor citado sem fonte: ' + a); if (!txt.includes(a)) warn.push('fonte sem citação no texto: ' + a); });

/* checklist */
if (D.checklist.length !== before.c + 4) err.push('checklist: esperados +4 itens');

/* HTML simples */
const all = JSON.stringify(D);
const bad = [...new Set((all.match(/<\/?([a-z]+)/g) || []).map((t) => t.replace(/[<\/]/g, '')))].filter((t) => !['strong', 'em'].includes(t));
if (bad.length) err.push('tags não permitidas: ' + bad);

console.log(JSON.stringify({
  chapters: D.chapters.map((x) => x.n + ':' + x.id).join(' '),
  answers: D.chapters.map((x) => x.quiz.answer).join(''),
  newSources: newS.map((x) => x.n + ' ' + x.detail.split('.')[0]),
  sourcesTotal: D.sources.length, checklist: D.checklist.length,
  steps: F && F.steps.map((st) => st.k + ' ' + st.title),
  errors: err, warnings: warn,
}, null, 1));
process.exit(err.length ? 1 : 0);
