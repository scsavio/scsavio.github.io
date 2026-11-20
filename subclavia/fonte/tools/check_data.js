#!/usr/bin/env node
/* check_data.js — valida src/data.js contra CONTENT_SPEC.md e SPEC.md §4.
   Uso: node tools/check_data.js   (sai com código 1 se houver erros) */
'use strict';
const fs = require('fs');
const path = require('path');
const P = path.resolve(__dirname, '..');

global.window = {};
require(path.join(P, 'src/landmarks.js'));
const LM = global.window.LM;
require(path.join(P, 'src/data.js'));
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

const err = [], warn = [];
const LAYERS = ['skin', 'bones', 'muscle', 'vein', 'artery', 'nerve', 'lymph', 'lung', 'pleura', 'mediastinum', 'hand', 'instrument', 'drape', 'aids'];
const INSETS = [null, 'planes', 'layers', 'distances', 'complications', 'usg', 'checklist', 'asymmetry'];
const ANIMS = [null, 'hand', 'breath', 'needle', 'wire'];
const srcN = new Set(D.sources.map((s) => s.n));
const isArr = Array.isArray;

['title', 'subtitle', 'version', 'reviewDate', 'disclaimer', 'basedOn', 'modelNote'].forEach((k) => { if (!D.meta || !D.meta[k]) err.push('meta.' + k + ' ausente'); });
if (D.meta.version !== '2.0') err.push('meta.version ≠ 2.0');

const chIds = new Set();
D.chapters.forEach((c, i) => {
  const tag = 'cap ' + (c.n || i);
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
  (s.layers || []).forEach((l) => { if (!LAYERS.includes(l)) err.push(tag + ': camada inválida ' + l); });
  if (s.ghost) Object.keys(s.ghost).forEach((l) => { if (!LAYERS.includes(l)) err.push(tag + ': ghost em camada inválida ' + l); else if (!(s.layers || []).includes(l)) warn.push(tag + ': ghost em camada oculta ' + l); });
  const st = s.state || {};
  ['phase', 'handPose', 'breath', 'rollMode', 'wireMal', 'showPlanes'].forEach((k) => { if (!(k in st)) err.push(tag + ': state.' + k + ' ausente'); });
  if (!(st.phase >= 0 && st.phase <= 6)) err.push(tag + ': phase fora de 0–6');
  if (!['none', 'interscapular', 'ipsilateral'].includes(st.rollMode)) err.push(tag + ': rollMode inválido');
  if (st.phase > 0 && !(s.layers || []).includes('instrument')) warn.push(tag + ': phase>0 sem camada instrument');
  if ((s.anim === 'hand' || st.handPose) && false) void 0;
  if (s.clip && (!isArr(s.clip.normal) || !isArr(s.clip.point) || !s.clip.label)) err.push(tag + ': clip inválido');
  if (!isArr(s.labels) || s.labels.length < 3 || s.labels.length > 7) err.push(tag + ': labels 3–7');
  (s.labels || []).forEach(([k, t]) => { if (!anchors.has(k)) err.push(tag + ': âncora não canônica ' + k); if (!t) err.push(tag + ': rótulo vazio ' + k); });
  if (s.highlight && !ids.has(s.highlight)) err.push(tag + ': highlight não canônico ' + s.highlight);
  if (!ANIMS.includes(s.anim)) err.push(tag + ': anim inválida');
  if (!INSETS.includes(c.inset)) err.push(tag + ': inset inválido');
});

/* glossário */
const gl = D.glossary;
ids.forEach((id) => { if (!gl[id]) err.push('glossário sem id canônico: ' + id); });
Object.entries(gl).forEach(([id, e]) => {
  ['name', 'group', 'desc', 'relevance'].forEach((k) => { if (!e[k]) err.push('glossário ' + id + ': ' + k + ' ausente'); });
  if (!D.glossaryGroups.includes(e.group)) err.push('glossário ' + id + ': grupo inválido ' + e.group);
  if (!ids.has(id)) warn.push('glossário: id extra (não listado em §4) ' + id);
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
const used = new Set();
D.chapters.forEach((c) => c.sources.forEach((n) => used.add(n)));
[...D.measurements, ...D.complications].forEach((x) => (isArr(x.source) ? x.source : [x.source]).forEach((n) => used.add(n)));
D.sources.forEach((s) => { if (!used.has(s.n)) warn.push('fonte ' + s.n + ' não citada em capítulos/tabelas'); });

/* texto: HTML simples apenas */
const allText = JSON.stringify(D);
const tags = (allText.match(/<\/?([a-z]+)/g) || []).map((t) => t.replace(/[<\/]/g, ''));
const bad = [...new Set(tags)].filter((t) => !['strong', 'em'].includes(t));
if (bad.length) err.push('tags HTML não permitidas: ' + bad.join(','));

console.log(JSON.stringify({
  chapters: D.chapters.length, glossary: Object.keys(gl).length, canonicalIds: ids.size, canonicalAnchors: anchors.size,
  sources: D.sources.length, measurements: D.measurements.length, complications: D.complications.length,
  answers: D.chapters.map((c) => c.quiz.answer).join(''), errors: err, warnings: warn,
}, null, 1));
process.exit(err.length ? 1 : 0);
