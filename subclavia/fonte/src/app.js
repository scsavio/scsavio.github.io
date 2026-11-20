/* ==========================================================================
   app.js — interface do Atlas 3D da punção da subclávia direita.
   Lê window.ATLAS_DATA (src/data.js; esquema em CONTENT_SPEC.md) e dirige o
   visor criado por ATLAS.createEngine (src/engine.js).
   Globais expostas: window.APP (depuração/testes) e window.__ready.
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* utilidades                                                          */
  /* ------------------------------------------------------------------ */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const SVGNS = 'http://www.w3.org/2000/svg';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const stripTags = (s) => String(s || '').replace(/<[^>]*>/g, '');
  const arr = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);
  const refNums = (v) => (v == null ? [] : Array.isArray(v) ? v.flatMap(refNums) : typeof v === 'number' ? [v] : (String(v).match(/\d+/g) || []).map(Number));
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const fmtCm = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1).replace('.', ',') + ' cm';
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /** Armazenamento local opcional (preferências do leitor); falhas são silenciosas. */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } },
    raw(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } return null; },
  };

  const mqReduced = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => mqReduced.matches;
  const mqNarrow = matchMedia('(max-width: 980px)');
  const coarse = matchMedia('(pointer: coarse)').matches;

  /** Sanitiza HTML simples vindo do conteúdo (permite ênfases, quebras, links). */
  const ALLOWED = new Set(['STRONG', 'EM', 'B', 'I', 'BR', 'SUP', 'SUB', 'SMALL', 'CODE', 'ABBR', 'SPAN', 'A', 'MARK', 'U']);
  function rich(html) {
    const t = document.createElement('template');
    t.innerHTML = String(html == null ? '' : html);
    (function walk(node) {
      for (const c of Array.from(node.childNodes)) {
        if (c.nodeType === 1) {
          walk(c);
          if (!ALLOWED.has(c.tagName)) { c.replaceWith(...Array.from(c.childNodes)); continue; }
          for (const a of Array.from(c.attributes)) {
            const ok = a.name === 'title' || (c.tagName === 'A' && a.name === 'href' && /^(https?:|#)/i.test(a.value));
            if (!ok) c.removeAttribute(a.name);
          }
          if (c.tagName === 'A' && /^https?:/i.test(c.getAttribute('href') || '')) { c.setAttribute('target', '_blank'); c.setAttribute('rel', 'noopener noreferrer'); }
          // link para capítulo pelo id estável (#cap-fixacao) → número atual (#cap-11): a renumeração não quebra links
          const hm = c.tagName === 'A' && /^#cap-([a-z][\w-]*)$/i.exec(c.getAttribute('href') || '');
          if (hm) { const ch = chapById(hm[1]); if (ch) c.setAttribute('href', '#cap-' + ch.n); }
        } else if (c.nodeType !== 3) c.remove();
      }
    })(t.content);
    return t.innerHTML;
  }

  /* ------------------------------------------------------------------ */
  /* constantes                                                          */
  /* ------------------------------------------------------------------ */
  /* Cores das camadas (chips e legenda) = MEDIANA RENDERIZADA de cada tecido (ACES + IBL + paleta do núcleo), medida
     por tools/w2fix_ui_colors.js nas vistas anterior e oblíqua — não a cor-base do material, que o render desloca.
     Pleura (translúcida), mão, campo e auxílios: cor de referência. Refaça a medida se a paleta ou a luz mudarem. */
  const LAYERS = [
    { id: 'skin', label: 'Pele', color: '#d8aa89' },
    { id: 'bones', label: 'Ossos', color: '#cfc5a9' },
    { id: 'muscle', label: 'Músculos', color: '#b34c41' },
    { id: 'vein', label: 'Veias', color: '#43699a' },
    { id: 'artery', label: 'Artérias', color: '#ba5046' },
    { id: 'nerve', label: 'Nervos', color: '#d5ba5c' },
    { id: 'lymph', label: 'Linfáticos', color: '#b4cf8c' },
    { id: 'lung', label: 'Pulmões', color: '#deb4ab' },
    { id: 'pleura', label: 'Pleura', color: '#9fd3de' },
    { id: 'mediastinum', label: 'Mediastino', color: '#bc847b' },
    { id: 'hand', label: 'Mão', color: '#c6bea4' },
    { id: 'instrument', label: 'Instrumentos', color: '#a9b4bc' },
    { id: 'drape', label: 'Campo estéril', color: '#4f86b8' },
    { id: 'aids', label: 'Auxílios', color: '#c1954c' },
  ];
  const DEFAULT_LAYERS = ['bones', 'muscle', 'vein', 'artery', 'nerve', 'lymph', 'lung', 'pleura', 'mediastinum'];
  const GROUPS = ['Ossos', 'Veias', 'Artérias', 'Músculos', 'Nervos', 'Linfáticos', 'Pulmões e pleura', 'Mediastino', 'Pele e superfície', 'Instrumentos'];
  const GROUP_COLORS = { 'Ossos': '#cfc5a9', 'Veias': '#43699a', 'Artérias': '#ba5046', 'Músculos': '#b34c41', 'Nervos': '#d5ba5c', 'Linfáticos': '#9fc27a', 'Pulmões e pleura': '#d9a69c', 'Mediastino': '#bc847b', 'Pele e superfície': '#d8aa89', 'Instrumentos': '#8d99a3' };
  // etapa 3: a ponta fica junto à borda inferior da clavícula, caudal e anterior a ela (não "sob" o osso)
  const PHASES = ['Sem agulha', 'Aproximação', 'Ponta sob a pele', 'Ponta junto à borda inferior da clavícula', 'Ponta na luz venosa (aspiração)', 'Fio-guia avançado', 'Cateter posicionado'];
  const PHASES_SHORT = ['Sem', 'Aprox.', 'Pele', 'Infraclav.', 'Veia', 'Fio', 'Cateter'];
  const VIEWS = [['front', 'Anterior'], ['oblique', 'Oblíqua'], ['side', 'Perfil'], ['hand', 'Mão'], ['close', 'Profunda'], ['top', 'Superior'], ['back', 'Posterior']];
  const MODULE_NAMES = { skeleton: 'esqueleto', vessels: 'vasos', muscles: 'músculos e fáscias', nerves: 'nervos e linfáticos', viscera: 'pulmões, pleura e mediastino', skin: 'pele e superfície', instruments: 'mão e instrumentos', fixation: 'fixação do cateter' };
  const DEFAULT_STATE = { phase: 0, handPose: 1, breath: 0, rollMode: 'none', wireMal: false, showPlanes: false, fixStep: 0 };
  const DEFAULT_CLIP = { normal: [-1, 0, 0], point: [7, 0, 0], label: 'Corte parassagital no trajeto da agulha' };
  const HAND_MS = 1600, BREATH_MS = 4000, WIRE_MS = 2600;
  /* Fixação em bailarina (notes/FIXACAO_CONTRACT.md): E.state.fixStep 0..9; a animação passa por valores k + t
     (t = progresso do movimento da etapa k+1), com pausa em cada etapa concluída. */
  const FIX_MAX = 9, FIX_MOVE_MS = 1500, FIX_PAUSE_MS = 900;
  const FIX_SHORT = ['Sem fixação', 'Preparo', 'Ancoragem', 'Nó de ancoragem', '1º cruzamento', '2º cruzamento', '3º cruzamento + nó', 'Corte e conferência', 'Pontos nas asas', 'Curativo'];
  /* Âncoras situadas DENTRO de uma estrutura (centro de vaso, polpa dos dedos): a parede da própria estrutura não
     conta como obstáculo na oclusão dos rótulos (senão "· profundo" aparece com a estrutura em plena vista). */
  const ANCHOR_OWNER = {
    scvR: /^scv-R$/, scvL: /^scv-L$/, scvLateralR: /^(scv|axillary-v)-R$/, bcvR: /^bcv-R$/, lbcv: /^bcv-L$/, venousAngleR: /^(scv|ijv|bcv)-R$/, svc: /^svc$/, cavoatrial: /^(svc|heart)$/,
    ijvR: /^ijv-R$/, ejvR: /^ejv-R$/, cephalicR: /^cephalic-v-R$/, axillaryVR: /^axillary-v-R$/, axillaryAR: /^axillary-a-R$/, scaR: /^sca-R$/, scaR1: /^sca-R$/, bct: /^bct$/, ccaR: /^cca-R$/, aorticArch: /^aorta$/, itaR: /^ita-R$/, vertebralAR: /^vertebral-a-R$/,
    indexTip: /^operator-hand$/, thumbTip: /^operator-hand$/, palm: /^operator-hand$/, thumbVector: /^operator-hand$/,
    catheterTip: /^catheter$/, needleTip: /^needle$/, needleHub: /^(needle|syringe)$/, wireTip: /^guidewire/, wireIJV: /^guidewire/,
    trachea: /^trachea$/, carina: /^(trachea|bronchus-[RL])$/, esophagus: /^esophagus$/, heart: /^heart$/, lungR: /^lung-R-/, lungL: /^lung-L-/,
  };
  const HAND_ANCHORS = new Set(['indexTip', 'thumbTip', 'palm', 'thumbVector']);
  /* Âncoras da fixação → primeira etapa em que a peça existe: o rótulo só aparece a partir dela (na animação, os
     rótulos surgem junto com o ponto, os cruzamentos, as asas e o curativo — nunca apontam para o vazio). */
  const FIX_ANCHOR_STEP = { fixAnchorStitch: 2, sutureNeedle: 1, needleHolder: 1, fixAnchorKnot: 3, fixTails: 3, fixCross1: 4, fixCross2: 5, fixCross3: 6, fixFinalKnot: 6, fixWingStitchA: 8, fixWingStitchB: 8, fixDressing: 9 };
  /* Renderização sob demanda: sem interação, animação, mudança de estado ou rótulos em movimento por IDLE_MS,
     o laço pausa ('idle'). Os módulos suavizam transições internas (agulha ~0,6 s; respiração ~1 s), daí a folga. */
  const IDLE_MS = 1500;
  const SEQ = [[1, 1200], [2, 1300], [3, 1400], [4, 1800]];
  const GIZMO_AXES = [
    { v: [0, 1, 0], short: 'Cranial', color: 'var(--teal)' },
    { v: [1, 0, 0], short: 'Dir.', color: 'var(--gold-ink)' },
    { v: [0, 0, 1], short: 'Ant.', color: 'var(--ink-2)' },
  ];
  const ICON = {
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12.5 10 18 19.5 6.5"/></svg>',
    warn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 21.5 20h-19z"/><path d="M12 10v4.5M12 17.2v.3"/></svg>',
  };

  /* ------------------------------------------------------------------ */
  /* dados                                                               */
  /* ------------------------------------------------------------------ */
  function normalize(raw) {
    const d = raw && typeof raw === 'object' ? raw : {};
    const o = Object.assign({}, d);
    o.meta = d.meta || {};
    o.chapters = arr(d.chapters).filter(Boolean).map((c, i) => Object.assign({}, c, {
      n: String(c.n || String(i + 1).padStart(2, '0')),
      id: c.id || 'cap' + (i + 1),
      short: c.short || c.title || 'Capítulo ' + (i + 1),
      title: c.title || c.short || '',
      body: arr(c.body), keyPoints: arr(c.keyPoints), pitfalls: arr(c.pitfalls),
      sources: refNums(c.sources != null ? c.sources : c.source),
      scene: c.scene || {},
    }));
    o.glossary = d.glossary && typeof d.glossary === 'object' ? d.glossary : {};
    o.sources = arr(d.sources).map((s, i) => (Array.isArray(s) ? { n: +s[0] || i + 1, title: s[1], detail: s[2], url: s[3] } : Object.assign({ n: i + 1 }, s)));
    ['measurements', 'complications', 'layersTable', 'checklist', 'asymmetry'].forEach((k) => (o[k] = arr(d[k])));
    o.usg = d.usg || {};
    o.prancha = d.prancha || {};
    o.glossaryGroups = arr(d.glossaryGroups).length ? d.glossaryGroups : GROUPS;
    return o;
  }
  const D = normalize(window.ATLAS_DATA);
  function chapById(id) { return D.chapters.find((c) => c.id === id) || null; }
  /** "do capítulo NN (Curto)" pelo id estável — números mudam quando capítulos são inseridos. */
  const capRef = (id) => { const c = chapById(id); return c ? `do capítulo ${esc(c.n)} (${esc(stripTags(c.short))})` : 'correspondente'; };
  const srcByN = (n) => D.sources.find((s) => +s.n === +n);
  const refLinks = (v) => refNums(v).map((n) => `<a href="#fonte-${n}" title="${esc(stripTags((srcByN(n) || {}).title || 'Fonte ' + n))}">[${n}]</a>`).join(' ');

  /* ------------------------------------------------------------------ */
  /* estado                                                              */
  /* ------------------------------------------------------------------ */
  const S = {
    E: null, idx: 0, started: false,
    labels: [], labelsOn: true, missingAnchors: new Set(),
    ghosts: {}, clipBase: null, clipOn: false, clipOffset: 0,
    highlightId: null, cardId: null, viewName: 'front',
    visKey: 0, occKey: '', occT: 0, layoutKey: '', gizmoKey: '',
    hover: null, hoverT: 0,
    answered: store.get('atlas-quiz', {}), checks: store.get('atlas-checklist', {}),
    printing: false, pseudoFull: false,
    actT: 0, stKey: '', stT: 0, ptr: 0, cardReturn: null, missingMods: [], touchLive: false,
  };
  const A = { hand: null, breath: null, seq: null, wire: null, fix: null };
  let R = {}; // referências DOM

  /* ------------------------------------------------------------------ */
  /* tema                                                                */
  /* ------------------------------------------------------------------ */
  function currentTheme() {
    const t = document.documentElement.getAttribute('data-theme');
    if (t === 'dark' || t === 'light') return t;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function setTheme(t, persist = true) {
    const html = document.documentElement;
    html.classList.add('no-tr'); // troca de tema sem transições (evita estados intermediários)
    html.setAttribute('data-theme', t);
    void html.offsetWidth;
    setTimeout(() => html.classList.remove('no-tr'), 60);
    if (persist) store.raw('atlas-theme', t);
    syncThemeButton();
    S.gizmoKey = '';
    if (R.tooltip) hideTooltip();
    wake();
  }
  function syncThemeButton() {
    const dark = currentTheme() === 'dark';
    R.btnTheme.setAttribute('aria-pressed', String(dark)); // rótulo fixo ("Tema escuro"): o estado vem de aria-pressed
  }

  /* ------------------------------------------------------------------ */
  /* cabeçalho, navegação de capítulos                                   */
  /* ------------------------------------------------------------------ */
  function buildHeader() {
    const m = D.meta;
    if (m.title) { R.docTitle.innerHTML = rich(m.title); document.title = stripTags(m.title) + ' · Atlas 3D'; }
    if (m.subtitle) R.docSubtitle.innerHTML = rich(m.subtitle);
    if (m.disclaimer) { // aviso completo no rodapé; o selo do cabeçalho permanece curto
      const t = rich(m.disclaimer); const k = t.indexOf('. ');
      R.footDisclaimer.innerHTML = k > 0 ? `<strong>${t.slice(0, k + 1)}</strong>${t.slice(k + 1)}` : t;
    }
    const ver = [m.version ? 'Versão ' + esc(m.version) : '', m.reviewDate ? 'revisão editorial ' + esc(m.reviewDate) : ''].filter(Boolean).join(' · ');
    if (ver) R.footMeta.textContent = stripTags(ver);
  }

  function buildNav() {
    R.chapList.innerHTML = D.chapters.map((c, i) => `<li><button type="button" class="pill" data-i="${i}" title="${esc(stripTags(c.title))}"><b>${esc(c.n)}</b><span>${esc(stripTags(c.short))}</span><i class="done" aria-hidden="true"></i></button></li>`).join('');
    R.chapList.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) go(+b.dataset.i, { reveal: true }); });
    // foco por teclado numa pílula parcialmente oculta: traz a pílula inteira para dentro da faixa rolável
    R.chapList.addEventListener('focusin', (e) => { const b = e.target.closest('.pill'); if (b) scrollPillIntoView(b, false); });
  }
  /** Rola a faixa de pílulas (só no eixo horizontal); center=true centraliza, senão garante visibilidade com folga. */
  function scrollPillIntoView(b, center) {
    const L = R.chapList, lr = L.getBoundingClientRect(), br = b.getBoundingClientRect();
    const x = L.scrollLeft + (br.left - lr.left); // posição da pílula no conteúdo rolável
    let left = L.scrollLeft;
    if (center) left = x - (L.clientWidth - br.width) / 2;
    else if (br.left < lr.left + 6) left = x - 10;
    else if (br.right > lr.right - 38) left = x + br.width - L.clientWidth + 40; // 34 px de esmaecimento à direita
    left = clamp(left, 0, Math.max(0, L.scrollWidth - L.clientWidth));
    if (Math.abs(left - L.scrollLeft) > 1) L.scrollTo({ left, behavior: reduced() || !S.navScrolled ? 'auto' : 'smooth' });
  }
  function updateNav() {
    const pills = $$('.pill', R.chapList);
    pills.forEach((p, i) => {
      const c = D.chapters[i]; const st = S.answered[c.id];
      if (i === S.idx) p.setAttribute('aria-current', 'step'); else p.removeAttribute('aria-current');
      p.classList.toggle('answered', !!st);
      p.classList.toggle('missed', !!st && !st.ok);
      p.setAttribute('aria-label', `Capítulo ${c.n}: ${stripTags(c.short)}${st ? (st.ok ? ' (autoteste correto)' : ' (autoteste respondido)') : ''}`);
    });
    const n = D.chapters.length || 1;
    R.chapBar.style.width = ((S.idx + 1) / n) * 100 + '%';
    const act = pills[S.idx];
    if (act) { scrollPillIntoView(act, true); S.navScrolled = true; }
  }

  const chapter = () => D.chapters[S.idx] || { scene: {}, body: [], keyPoints: [], pitfalls: [], sources: [] };

  /** Vai ao capítulo i (texto + cena). */
  function go(i, o = {}) {
    if (!D.chapters.length) return;
    i = clamp(i | 0, 0, D.chapters.length - 1);
    const first = !S.started;
    S.idx = i; S.started = true;
    renderPanel();
    updateNav();
    if (!first && R.srStatus) R.srStatus.textContent = `Capítulo ${D.chapters[i].n} de ${D.chapters.length}: ${stripTags(D.chapters[i].title)}`;
    const hash = '#cap-' + D.chapters[i].n;
    if (location.hash !== hash) { try { history.replaceState(null, '', hash); } catch (e) { /* file:// restrito */ } }
    if (S.E) applyScene(D.chapters[i].scene, o.animate !== false);
    if (o.reveal) revealScene();
    if (o.focusPanel) R.panel.focus({ preventScroll: true });
  }
  /** Troca de capítulo pelo leitor (pílula, anterior/próxima): garante que a cena nova esteja à vista.
      ≤ 980 px o painel não tem rolagem própria — sem isto o leitor ficaria no meio do texto ou no material
      complementar enquanto a cena muda fora da tela. No desktop só rola se o visor estiver praticamente oculto. */
  function revealScene() {
    const navH = (document.querySelector('.chapnav') || {}).offsetHeight || 0;
    const r = R.viewer.getBoundingClientRect(), vh = window.innerHeight;
    const narrow = mqNarrow.matches;
    const ok = narrow ? r.top >= navH - 4 && r.top <= navH + vh * 0.2 : r.bottom > navH + 160 && r.top < vh - 160;
    if (ok) return;
    window.scrollTo({ top: Math.max(0, window.scrollY + r.top - navH), behavior: reduced() ? 'auto' : 'smooth' });
  }
  /** #cap-NN (número atual) ou #cap-<id> (id estável do capítulo: sobrevive à renumeração, p. ex. #cap-fixacao). */
  function chapterFromHash() {
    const m = /^#cap-([\w-]+)/.exec(location.hash || '');
    if (!m) return null;
    if (!/^\d+$/.test(m[1])) { const j = D.chapters.findIndex((c) => c.id === m[1]); return j >= 0 ? j : null; }
    const k = D.chapters.findIndex((c) => +c.n === +m[1]);
    return k >= 0 ? k : clamp(+m[1] - 1, 0, D.chapters.length - 1);
  }

  /* ------------------------------------------------------------------ */
  /* painel de texto                                                     */
  /* ------------------------------------------------------------------ */
  function renderPanel() {
    const c = chapter(); const n = D.chapters.length;
    if (!n) { R.panel.innerHTML = '<p class="empty">Conteúdo dos capítulos indisponível (src/data.js não carregado).</p>'; return; }
    let h = `<div class="panel-meta"><p class="scene-no">Cena <b>${esc(c.n)}</b> / ${String(n).padStart(2, '0')}</p><span class="scene-tag">${esc(stripTags(c.short))}</span></div>`;
    h += `<h2 id="chTitle">${rich(c.title)}</h2>`;
    if (c.focus) h += `<p class="focus">${rich(c.focus)}</p>`;
    h += `<div class="body">${c.body.map((p) => `<p>${rich(p)}</p>`).join('')}</div>`;
    if (c.keyPoints.length) h += `<section class="box key" aria-label="Pontos-chave"><h3>${ICON.check}Pontos-chave</h3><ul>${c.keyPoints.map((p) => `<li>${rich(p)}</li>`).join('')}</ul></section>`;
    if (c.pitfalls.length) h += `<section class="box pit" aria-label="Armadilhas"><h3>${ICON.warn}Armadilhas</h3><ul>${c.pitfalls.map((p) => `<li>${rich(p)}</li>`).join('')}</ul></section>`;
    if (c.inset) h += insetHTML(c.inset);
    if (c.detail) h += `<div class="detail"><h3>Limites do modelo</h3><p>${rich(c.detail)}</p></div>`;
    if (c.sources.length) h += `<p class="srcs">Fontes do capítulo: ${refLinks(c.sources)} · <a href="#fontes">bibliografia</a></p>`;
    if (c.quiz && c.quiz.q) h += `<section class="quiz" id="quiz" aria-labelledby="quizQ">${quizInner(c)}</section>`;
    const prev = D.chapters[S.idx - 1], next = D.chapters[S.idx + 1];
    h += `<div class="stepnav">
      <button type="button" class="prev" data-go="-1" ${prev ? '' : 'disabled'} aria-label="Capítulo anterior${prev ? ': ' + esc(stripTags(prev.title)) : ''}"><span class="dir">← Anterior</span><span class="ttl">${prev ? esc(stripTags(prev.short)) : '—'}</span></button>
      <button type="button" class="next" data-go="1" ${next ? '' : 'disabled'} aria-label="Próximo capítulo${next ? ': ' + esc(stripTags(next.title)) : ''}"><span class="dir">Próxima →</span><span class="ttl">${next ? esc(stripTags(next.short)) : '—'}</span></button>
    </div>
    <p class="kbd-hint">Teclas <kbd>←</kbd> <kbd>→</kbd> trocam de capítulo · <kbd>Esc</kbd> fecha o cartão de estrutura</p>`;
    R.panel.innerHTML = h;
    R.panel.scrollTop = 0;
    centerScrollers(R.panel);
    syncFixInset(true);
  }
  /** Esquemas com rolagem horizontal (celular): começam centralizados — as relações-chave ficam no meio. */
  function centerScrollers(root) {
    requestAnimationFrame(() => $$('.dg-scroll', root).forEach((el) => { const d = el.scrollWidth - el.clientWidth; if (d > 2) el.scrollLeft = d / 2; }));
  }

  function quizInner(c) {
    const q = c.quiz; const st = S.answered[c.id];
    const done = D.chapters.filter((x) => S.answered[x.id]).length;
    const L = 'ABCDEFG';
    let h = `<p class="quiz-h"><span>Autoteste</span><span>${done} de ${D.chapters.length} respondidos</span></p><p class="quiz-q" id="quizQ">${rich(q.q)}</p><ul class="quiz-opts">`;
    arr(q.options).forEach((opt, i) => {
      let cls = '';
      if (st) cls = i === +q.answer ? 'right' : i === st.choice ? 'wrong' : 'dim';
      h += `<li><button type="button" data-opt="${i}" class="${cls}" ${st ? 'disabled' : ''} aria-pressed="${st && st.choice === i ? 'true' : 'false'}"><span class="let" aria-hidden="true">${L[i]}</span><span>${rich(opt)}</span></button></li>`;
    });
    h += '</ul>';
    if (st) {
      h += `<div class="quiz-fb ${st.ok ? 'ok' : 'no'}" role="status"><strong>${st.ok ? 'Correto.' : 'Resposta esperada: ' + L[+q.answer] + '.'}</strong>${rich(q.explain || '')}</div>`;
      h += '<button type="button" class="btn small quiz-retry" data-retry="1">Tentar de novo</button>';
    }
    return h;
  }
  function answerQuiz(i) {
    const c = chapter(); if (!c.quiz) return;
    S.answered[c.id] = { choice: i, ok: i === +c.quiz.answer };
    store.set('atlas-quiz', S.answered);
    const box = $('#quiz', R.panel); if (box) box.innerHTML = quizInner(c);
    const fb = $('.quiz-fb', R.panel); if (fb && fb.scrollIntoView) fb.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
    updateNav();
  }
  function onPanelClick(e) {
    const t = e.target.closest('button, a'); if (!t) return;
    if (t.dataset.opt != null) return answerQuiz(+t.dataset.opt);
    if (t.dataset.retry) { delete S.answered[chapter().id]; store.set('atlas-quiz', S.answered); const box = $('#quiz', R.panel); if (box) box.innerHTML = quizInner(chapter()); updateNav(); const b = $('[data-opt="0"]', R.panel); if (b) b.focus(); return; }
    if (t.dataset.go) return go(S.idx + +t.dataset.go, { focusPanel: true, reveal: true });
    if (t.dataset.fxk) return fixInsetGo(+t.dataset.fxk);
    if (t.dataset.show) return showStructure(t.dataset.show, t);
  }

  /* insets compactos citados pelos capítulos */
  function insetHTML(kind) {
    const map = {
      planes: ['Planos da agulha', '#planos', () => planesHTML(true)],
      layers: ['Tecidos atravessados', '#tecidos', () => `<ol class="mini-list">${D.layersTable.map((r, i) => `<li><b>${esc(r.depth != null ? r.depth : i + 1)}</b><span>${rich(r.tissue)}</span></li>`).join('')}</ol>`],
      distances: ['Medidas publicadas', '#medidas', () => `<ul class="mini-list">${D.measurements.slice(0, 5).map((r) => `<li><span><strong>${rich(r.label)}</strong> — ${rich(r.value)}</span></li>`).join('')}</ul>`],
      complications: ['Complicações por estrutura', '#complicacoes', () => `<ul class="mini-list">${D.complications.map((c) => `<li><span style="flex:1">${rich(c.name)}</span>${c.structure ? `<button type="button" class="btn small" data-show="${esc(c.structure)}">Ver no 3D</button>` : ''}</li>`).join('')}</ul>`],
      usg: ['Ultrassom esquemático', '#usg', () => `<div class="usg-wrap">${usgSVG('in')}</div>`],
      checklist: ['Checklist do treino', '#checklist', () => `<ul class="mini-list">${D.checklist.slice(0, 6).map((t, i) => `<li><b>${i + 1}</b><span>${rich(t)}</span></li>`).join('')}</ul>`],
      asymmetry: ['Assimetria D × E', '#assimetria', () => `<ul class="mini-list">${D.asymmetry.slice(0, 5).map((r) => `<li><span><strong>${rich(r.topic)}</strong> — D: ${rich(r.right)} · E: ${rich(r.left)}</span></li>`).join('')}</ul>`],
      fixation: ['Fixação em bailarina — passo a passo', '#fixacao', () => fixInsetHTML()],
    };
    const k = map[kind]; if (!k) return '';
    let inner = '';
    try { inner = k[2](); } catch (e) { inner = ''; }
    if (!inner || /<(ol|ul)[^>]*>\s*<\/(ol|ul)>/.test(inner)) return `<div class="inset"><div class="inset-head"><h3>${k[0]}</h3><a href="${k[1]}">Ver seção ↓</a></div></div>`;
    return `<div class="inset inset-${esc(kind)}"><div class="inset-head"><h3>${k[0]}</h3><a href="${k[1]}">Ver seção completa ↓</a></div>${inner}</div>`;
  }

  /* ------------------------------------------------------------------ */
  /* motor 3D                                                            */
  /* ------------------------------------------------------------------ */
  function hasWebGL() {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) return false;
      const ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext();
      return true;
    } catch (e) { return false; }
  }
  function setLoader(p, text) {
    R.loaderBar.style.width = Math.round(clamp(p, 0.04, 1) * 100) + '%';
    if (text) R.loaderStep.textContent = text;
  }
  function failGL(msg) {
    R.loader.hidden = true;
    if (msg) R.noglMsg.textContent = msg + ' Todo o conteúdo textual, a prancha e os esquemas continuam disponíveis.';
    R.nogl.hidden = false;
    R.controls.setAttribute('inert', '');
    R.controls.style.opacity = '0.45';
    $$('.vp-views, .vp-zoom, .legend, .gizmo', R.viewer).forEach((el) => (el.hidden = true));
  }

  async function boot3D() {
    if (!window.ATLAS || !window.ATLAS.createEngine || !window.THREE || !window.LM) return failGL('Os arquivos do motor 3D não foram carregados.');
    if (!hasWebGL()) return failGL('Este navegador não oferece WebGL. Abra o arquivo em um navegador atualizado (Chrome, Edge, Firefox ou Safari recentes).');
    const low = coarse || (navigator.deviceMemory && navigator.deviceMemory <= 4);
    const opts = {
      view: 'front',
      onProgress: (name, i, n) => setLoader((i + 0.2) / Math.max(1, n), `Construindo ${MODULE_NAMES[name] || name} (${i + 1}/${n})…`),
    };
    if (low) Object.assign(opts, { quality: 0.6, shadowSize: 1024, maxDPR: 1.5 });
    let E;
    try { E = await window.ATLAS.createEngine(R.viewer, opts); }
    catch (err) { return failGL('Erro ao iniciar o visor 3D (' + ((err && err.message) || err) + ').'); }
    S.E = E;
    setLoader(1, 'Pronto.');
    E._hover = onHover;
    E._click = onClick;
    E.frameHooks.push(onFrame);
    const cv = E.renderer.domElement;
    cv.setAttribute('role', 'application');
    setupCanvasKeys(cv);
    cv.addEventListener('pointerdown', () => { hideTooltip(); if (S.viewName) { S.viewName = null; syncViewBar(); } });
    R.viewer.addEventListener('pointerleave', () => { S.hover = null; clearTimeout(S.hoverTimer); hideTooltip(); });
    // atividade no visor reativa o laço (renderização sob demanda)
    // (mover o mouse sem arrastar não reativa o laço: a dica é DOM, com seleção própria por temporizador)
    R.viewer.addEventListener('pointerdown', () => { S.ptr++; wake(); }, true);
    R.viewer.addEventListener('wheel', wake, { capture: true, passive: true });
    const ptrUp = () => { if (S.ptr) { S.ptr = 0; wake(); } };
    window.addEventListener('pointerup', ptrUp, true); window.addEventListener('pointercancel', ptrUp, true);
    reportMissingModules(E);
    renderGlossary();
    applyScene(chapter().scene, false);
    loopSync();
    // fora da tela o visor não renderiza (economia de GPU/bateria); no toque, sair da tela devolve a proteção de rolagem
    if (window.IntersectionObserver) new IntersectionObserver((en) => {
      if (en[0].isIntersecting) unpause('offscreen'); else { pause('offscreen'); if (S.touchLive && !isFull()) setTouchLive(false); }
    }).observe(R.viewer);
    await sleep(150); R.loader.classList.add('done');
    await sleep(500); R.loader.hidden = true;
  }

  /** Módulo que não carregou (erro de sintaxe impede ATLAS.define; erro na construção vai para E.errors):
      avisa no visor e guarda a lista para as notas por capítulo (renderSceneWarn). */
  function reportMissingModules(E) {
    S.missingMods = Object.keys(MODULE_NAMES).filter((n) => !E.results[n]);
    const other = E.errors.filter((m) => !S.missingMods.some((n) => String(m).indexOf(n + ':') === 0));
    if (S.missingMods.length) {
      const names = S.missingMods.map((n) => MODULE_NAMES[n]);
      showNotice(`Partes do modelo 3D não foram carregadas: ${names.join(', ')}. As cenas que dependem delas ficam incompletas; texto, prancha e esquemas continuam disponíveis.`, 14000);
    } else if (other.length) showNotice('Algumas partes do modelo não puderam ser construídas. O restante do atlas continua utilizável.', 9000);
  }

  /* laço de renderização: E.start() não é idempotente, então o estado fica aqui.
     Motivos para pausar: 'offscreen' (visor fora da tela), 'print' (capturas), 'still' (testes) e
     'idle' (cena parada: nada a redesenhar — o canvas mantém o último quadro). */
  const pauses = new Set();
  function loopSync() {
    const E = S.E; if (!E) return;
    const want = pauses.size === 0;
    if (want && !S.loopOn) { S.loopOn = true; S.loopGen = (S.loopGen || 0) + 1; const g = S.loopGen; requestAnimationFrame(() => { if (S.loopOn && g === S.loopGen) E.start(); }); }
    else if (!want && S.loopOn) { S.loopOn = false; S.loopGen = (S.loopGen || 0) + 1; E.stop(); }
  }
  const pause = (why) => { pauses.add(why); loopSync(); };
  const unpause = (why) => { pauses.delete(why); loopSync(); };
  /** Registra atividade e retoma o laço se estiver pausado por ociosidade. */
  function wake() {
    S.actT = performance.now();
    if (pauses.has('idle')) unpause('idle');
  }
  /** Pausa por ociosidade quando nada muda há IDLE_MS (chamado ao fim de cada quadro). */
  function idleCheck(now) {
    if (A.hand || A.breath || A.seq || A.wire || A.fix || S.ptr || S.printing) return;
    const quiet = now - Math.max(S.actT, S.camMoveT || 0, S.stT);
    if (quiet > IDLE_MS * 4) { pause('idle'); return; } // salvaguarda: nada pendente prende o laço indefinidamente
    if (S.occQ) return;
    if (S.labelsOn && S.labels.length) {
      if (S.occKey !== S.occWant) return; // oclusão dos rótulos ainda pendente
      if (S.labels.some((L) => L.vis && !L.settled)) return;
    }
    if (quiet > IDLE_MS) pause('idle');
  }

  function showNotice(text, ms) {
    R.notice.textContent = text; R.notice.hidden = false;
    clearTimeout(S.noticeT); S.noticeT = setTimeout(() => (R.notice.hidden = true), ms || 5000);
  }

  /** Aplica a cena de um capítulo; mode = true (animada), false (imediata) ou 'print'. */
  function applyScene(sc, mode) {
    const E = S.E; if (!E) return;
    sc = sc || {};
    stopAnims();
    S.hover = null; hideTooltip(); // a dica da cena anterior não sobrevive à troca
    E.showOnly(Array.isArray(sc.layers) && sc.layers.length ? sc.layers : DEFAULT_LAYERS);
    // corte ANTES dos fantasmas: os materiais clonados de destaque/fantasma partem do estado de corte da cena nova
    S.clipBase = sc.clip && sc.clip.normal && sc.clip.point ? sc.clip : null;
    S.clipOn = !!S.clipBase; S.clipOffset = 0;
    applyClip();
    E.highlight(null); // destaque e "fantasma" trocam materiais: sempre desfazer o destaque antes (ver ghost())
    E.clearGhosts(); S.ghosts = {};
    if (sc.ghost && typeof sc.ghost === 'object') for (const [n, o] of Object.entries(sc.ghost)) if (o != null && E.layers[n]) { E.setGhost(n, +o); S.ghosts[n] = +o; }
    Object.assign(E.state, DEFAULT_STATE, sc.state || {});
    E.state.chapter = S.idx;
    // cena da fixação: a vista recomendada pelo módulo 3D (api.focusView), quando existir, prevalece
    const v = sc.anim === 'fix' ? fixView() : sc.view || 'front';
    E.setView(v, mode === true ? 900 : 0);
    S.viewName = typeof v === 'string' ? v : null;
    S.highlightId = sc.highlight || null;
    E.highlight(S.highlightId);
    setLabels(sc.labels);
    closeCard();
    if (mode === 'print') {
      if (sc.anim === 'hand') E.state.handPose = 1;
      if (sc.anim === 'needle') E.state.phase = Math.max(E.state.phase, 4);
      if (sc.anim === 'wire') { E.state.phase = 5; if (!sc.state || sc.state.wireMal == null) E.state.wireMal = true; }
      if (sc.anim === 'fix') { E.state.phase = 6; E.state.fixStep = sc.state && sc.state.fixStep != null ? +sc.state.fixStep : FIX_MAX; }
    } else if (sc.anim) startAnim(sc.anim);
    S.visKey++;
    syncControls();
    if (mode !== 'print') syncFixInset(true);
    wake();
  }

  /** Liga camadas ocultas de que um controle depende (senão o controle parece não fazer nada) e avisa no visor. */
  function ensureLayers(list) {
    const E = S.E; if (!E) return;
    const on = [];
    for (const n of list) if (E.layers[n] && !E.layers[n].visible) { E.setLayer(n, true); on.push(n); }
    if (!on.length) return;
    S.visKey++; S.hover = null; hideTooltip();
    syncControls();
    const names = on.map((n) => (LAYERS.find((l) => l.id === n) || { label: n }).label);
    showNotice((names.length > 1 ? 'Camadas ativadas: ' : 'Camada ativada: ') + names.join(', '), 2500);
  }

  /** Executa as atualizações dos módulos algumas vezes (para capturas fora do laço). */
  function settleModules() {
    const E = S.E; if (!E) return;
    for (let k = 0; k < 8; k++) for (const r of Object.values(E.results)) if (r && r.update) { try { r.update(E.state, 0.1); } catch (e) { /* módulo tolera */ } }
  }

  /* ---------------- animações ---------------- */
  function startAnim(kind) {
    const E = S.E; if (!E) return;
    const now = performance.now();
    if (kind === 'hand') {
      ensureLayers(handLayers());
      A.hand = null;
      if (reduced()) { E.state.handPose = 1; }
      else { const from = E.state.handPose >= 0.98 ? 0 : E.state.handPose; E.state.handPose = from; A.hand = { t0: now, from }; }
    } else if (kind === 'breath') {
      ensureLayers(['lung', 'pleura']);
      if (reduced()) { E.state.breath = E.state.breath > 0.5 ? 0 : 1; }
      else { const th = Math.acos(clamp(1 - 2 * E.state.breath, -1, 1)); A.breath = { t0: now - (th / (2 * Math.PI)) * BREATH_MS }; }
    } else if (kind === 'needle') {
      ensureLayers(['instrument']);
      A.wire = null; A.fix = null;
      if (reduced()) { E.state.phase = 4; A.seq = null; }
      else { E.state.phase = SEQ[0][0]; A.seq = { i: 0, tNext: now + SEQ[0][1] }; }
    } else if (kind === 'wire') {
      ensureLayers(['instrument']);
      A.seq = null; A.fix = null;
      E.state.phase = 5;
      if (reduced()) { E.state.wireMal = !E.state.wireMal; A.wire = null; }
      else A.wire = { t0: now, base: !!E.state.wireMal };
    } else if (kind === 'fix') {
      A.seq = null; A.wire = null;
      fixPrepare();
      if (reduced()) { E.state.fixStep = FIX_MAX; A.fix = null; }
      else {
        let k = Math.floor((+E.state.fixStep || 0) + 1e-6); if (k >= FIX_MAX) k = 0;
        E.state.fixStep = k;
        A.fix = { k, move: false, t0: now - FIX_PAUSE_MS * 0.4 }; // começa com uma pausa curta no estado inicial
      }
    }
    S.visKey++;
    syncControls();
    wake();
  }
  /** Camadas que tornam a mão visível e situável (pele como referência quando pele e ossos estão ocultos). */
  function handLayers() {
    const L = S.E.layers;
    return !L.skin.visible && !L.bones.visible ? ['hand', 'skin'] : ['hand'];
  }
  /** Fixação: exige cateter posicionado (fase 6), instrumentos e pele; fora do capítulo da fixação aproxima a
      câmera do sítio de saída (senão a malha, de poucos milímetros, não se vê na vista de outro capítulo). */
  function fixPrepare() {
    const E = S.E; if (!E) return;
    if (E.state.phase !== 6) { E.state.phase = 6; E.state.wireMal = false; }
    ensureLayers(['instrument', 'skin']);
    const c = chapter();
    if (c.id !== 'fixacao' && E.orbit.radius > 24) { E.setView(fixView(), reduced() ? 0 : 900); S.viewName = null; syncViewBar(); }
  }
  function fixView() {
    const api = S.E && S.E.results.fixation && S.E.results.fixation.api;
    if (api && api.focusView && api.focusView.target) return api.focusView;
    const ch = D.chapters.find((c) => c.id === 'fixacao');
    return (ch && ch.scene && typeof ch.scene.view === 'object' && ch.scene.view) || { target: [11.4, -2.0, 3.0], radius: 12.5, az: -0.3, el: 0.42 };
  }
  function stopAnims(...kinds) {
    (kinds.length ? kinds : Object.keys(A)).forEach((k) => (A[k] = null));
    syncPlayButtons();
  }
  function tickAnims(now) {
    const E = S.E; let ch = false;
    if (A.hand) {
      const k = clamp((now - A.hand.t0) / HAND_MS, 0, 1);
      E.state.handPose = A.hand.from + (1 - A.hand.from) * easeInOut(k);
      if (k >= 1) { A.hand = null; syncPlayButtons(); }
      ch = true;
    }
    if (A.breath) { E.state.breath = 0.5 - 0.5 * Math.cos((2 * Math.PI * (now - A.breath.t0)) / BREATH_MS); ch = true; }
    if (A.seq && now >= A.seq.tNext) {
      A.seq.i++;
      if (A.seq.i >= SEQ.length) { A.seq = null; syncPlayButtons(); }
      else { E.state.phase = SEQ[A.seq.i][0]; A.seq.tNext = now + SEQ[A.seq.i][1]; }
      ch = true;
    }
    if (A.wire) {
      const flip = Math.floor((now - A.wire.t0) / WIRE_MS) % 2 === 1;
      const w = A.wire.base ? !flip : flip;
      if (w !== E.state.wireMal) { E.state.wireMal = w; ch = true; }
    }
    if (A.fix) {
      const F = A.fix;
      if (!F.move) { if (now - F.t0 >= FIX_PAUSE_MS) { F.move = true; F.t0 = now; } }
      else {
        const t = (now - F.t0) / FIX_MOVE_MS;
        if (t >= 1) { F.k++; E.state.fixStep = F.k; F.move = false; F.t0 = now; if (F.k >= FIX_MAX) { A.fix = null; syncPlayButtons(); } }
        else E.state.fixStep = F.k + Math.min(0.999, easeInOut(t)); // k + t: movimento da etapa k+1 em andamento
        ch = true;
      }
    }
    if (ch) syncDynamic();
  }

  /* ---------------- laço por quadro ---------------- */
  function onFrame(now) {
    const E = S.E; if (!E) return;
    tickAnims(now);
    // movimento de câmera e mudanças de estado (inclui transições do motor) — base da pausa por ociosidade
    const ck = camOnlyKey();
    if (ck !== S.lastCk) { S.lastCk = ck; S.camMoveT = now; }
    const st = E.state;
    const sk = st.phase + ',' + (+st.handPose || 0).toFixed(3) + ',' + (+st.breath || 0).toFixed(3) + ',' + st.wireMal + ',' + st.rollMode + ',' + st.showPlanes + ',' + (+st.fixStep || 0).toFixed(3) + '|' + S.visKey;
    if (sk !== S.stKey) { S.stKey = sk; S.stT = now; }
    updateGizmo();
    updateLabels(now);
    idleCheck(now);
  }

  /* ---------------- rótulos com linhas-guia ---------------- */
  /** Visor estreito (< 600 px): rótulos viram marcadores numerados na âncora, com a legenda "n — texto" numa lista
      logo abaixo do visor (#lblKey) — caixas de texto não cabem sem cobrir a anatomia e os controles. */
  const narrowLabels = () => !isFull() && (R.viewer.clientWidth || window.innerWidth) < 600; // em tela cheia a lista não aparece
  function setLabels(list) {
    R.labels.textContent = ''; R.leaders.textContent = '';
    S.labels = []; S.labelList = list;
    const E = S.E, miss = [];
    const num = S.labelMode = narrowLabels() ? 'num' : 'text';
    let n = 0, keyHtml = '';
    for (const item of arr(list)) {
      const key = Array.isArray(item) ? item[0] : item && (item.key || item.anchor);
      const text = Array.isArray(item) ? item[1] : item && (item.text || item.label);
      if (!key) continue;
      if (!E || !E.anchors[key]) { S.missingAnchors.add(key); miss.push(stripTags(text || key)); continue; }
      n++;
      const el = document.createElement('div');
      if (num === 'num') { el.className = 'lbl num'; el.textContent = n; keyHtml += `<li data-k="${esc(key)}"><span class="n" aria-hidden="true">${n}</span><span class="t">${esc(stripTags(text || key))}</span><span class="o"> · profundo</span></li>`; }
      else { el.className = 'lbl'; el.textContent = stripTags(text || key); }
      R.labels.appendChild(el);
      const g = document.createElementNS(SVGNS, 'g');
      const ln = document.createElementNS(SVGNS, 'line');
      const c = document.createElementNS(SVGNS, 'circle'); c.setAttribute('r', num === 'num' ? '2.6' : '3.2');
      g.append(ln, c); R.leaders.appendChild(g);
      el.style.visibility = 'hidden'; g.style.display = 'none'; // aparece só após a primeira disposição (visibility: mede a largura)
      S.labels.push({ key, text, n, el, g, ln, c, x: 0, y: 0, w: 0, h: 0, px: 0, py: 0, init: false, occ: false, vis: false, clash: false });
    }
    if (R.lblKey) {
      R.lblKey.innerHTML = keyHtml;
      R.lblKey.hidden = !(num === 'num' && n && S.labelsOn);
      S.labels.forEach((L) => (L.li = R.lblKey.querySelector(`[data-k="${CSS.escape(L.key)}"]`)));
    }
    S.occKey = ''; S.layoutKey = '';
    R.labels.hidden = R.leaders.hidden = !S.labelsOn;
    if (E && !S.printing) renderSceneWarn(miss);
  }

  /** Nota discreta no painel quando a cena do capítulo depende de partes do modelo que não carregaram. */
  function renderSceneWarn(miss) {
    let el = $('.scene-warn', R.panel);
    const sc = chapter().scene || {};
    const needs = { skin: 'skin', drape: 'skin', hand: 'instruments', instrument: 'instruments', muscle: 'muscles', nerve: 'nerves', lymph: 'nerves', lung: 'viscera', pleura: 'viscera', mediastinum: 'viscera', vein: 'vessels', artery: 'vessels', bones: 'skeleton' };
    const want = arr(sc.layers).map((l) => needs[l]);
    if (sc.state && +sc.state.fixStep > 0) want.push('fixation'); // a cena da fixação depende do módulo 'fixation'
    const mods = Array.from(new Set(want.filter((n) => n && S.missingMods.indexOf(n) >= 0))).map((n) => MODULE_NAMES[n]);
    if (!miss.length && !mods.length) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('p'); el.className = 'scene-warn'; el.setAttribute('role', 'note');
      const ref = $('.focus', R.panel) || $('#chTitle', R.panel);
      if (ref) ref.after(el); else R.panel.prepend(el);
    }
    el.innerHTML = `<strong>Cena incompleta neste arquivo.</strong> ${mods.length ? 'Não carregou: ' + esc(mods.join(', ')) + '. ' : ''}${miss.length ? 'Rótulos indisponíveis: ' + esc(miss.join(' · ')) + '.' : ''}`;
  }

  /** Disposição de rótulos (função pura). Para cada rótulo, na ordem do conteúdo, testa posições candidatas
      ao redor da âncora (lado externo primeiro, depois linhas acima/abaixo e o lado oposto) e escolhe a de menor
      custo: sobreposição com rótulos já postos e com controles do visor, âncoras cobertas e distância.
      items: [{px, py, w, h, prev?:{dir,dy}}] → [{x, y, w, h, dir, dy}] */
  function layoutLabels(items, W, H, o) {
    const pad = 4, obs = o.obstacles || [], placed = [];
    const ovl = (a, b) => {
      const x = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) + pad, y = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) + pad;
      return x > 0 && y > 0 ? x * y : 0;
    };
    // linha-guia: da âncora até a borda mais próxima da caixa (mesma regra do desenho em updateLabels)
    const leaderEnd = (px, py, c) => (px < c.x ? [c.x, clamp(py, c.y + 4, c.y + c.h - 4)] : px > c.x + c.w ? [c.x + c.w, clamp(py, c.y + 4, c.y + c.h - 4)] : [px, py < c.y ? c.y : c.y + c.h]);
    // segmento × retângulo (amostragem: segmentos curtos, poucos rótulos)
    const segHits = (x1, y1, x2, y2, b) => {
      for (let k = 1; k < 10; k++) { const t = k / 10, x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t; if (x > b.x + 1 && x < b.x + b.w - 1 && y > b.y + 1 && y < b.y + b.h - 1) return true; }
      return false;
    };
    return items.map((it) => {
      const out0 = it.px < W * 0.5 ? -1 : 1;
      let best = null, bestS = Infinity;
      for (const dir of [out0, -out0]) {
        for (let r = 0; r <= 7; r++) {
          for (const sg of r ? [-1, 1] : [1]) {
            const dy = sg * r, gap = o.gap + r * 5;
            const x = dir < 0 ? it.px - gap - it.w : it.px + gap;
            const y = it.py - it.h / 2 - o.lift + dy * (it.h + 5);
            if (x < 4 || x + it.w > W - 4 || y < 4 || y + it.h > H - 4) continue;
            const c = { x, y, w: it.w, h: it.h, dir, dy };
            let sc = r * 3 + (dir === out0 ? 0 : 14);
            if (it.prev && it.prev.dir === dir && it.prev.dy === dy) sc -= 8; // histerese: evita saltos
            let ov = 0;
            for (const p of placed) ov += ovl(c, p);
            for (const b of obs) ov += ovl(c, b);
            c.clash = ov > 0; sc += ov * 4;
            for (const q of items) if (q.px > x - 4 && q.px < x + it.w + 4 && q.py > y - 4 && q.py < y + it.h + 4) sc += 600;
            // linhas-guia cruzando caixas: a própria linha sobre rótulos já postos e linhas já postas sob esta caixa
            const [ex, ey] = leaderEnd(it.px, it.py, c);
            for (const p of placed) {
              if (segHits(it.px, it.py, ex, ey, p)) sc += 160;
              if (segHits(p.px, p.py, p.ex, p.ey, c)) sc += 160;
            }
            if (sc < bestS) { bestS = sc; best = c; best.ex = ex; best.ey = ey; }
          }
        }
      }
      // nenhuma posição dentro do visor: posição nominal marcada como conflito (o texto é recolhido, não sobrepõe controles)
      if (!best) best = { x: clamp(it.px + o.gap, 4, Math.max(4, W - it.w - 4)), y: clamp(it.py - it.h / 2, 4, Math.max(4, H - it.h - 4)), w: it.w, h: it.h, dir: 1, dy: 0, clash: true };
      if (best.ex == null) [best.ex, best.ey] = leaderEnd(it.px, it.py, best);
      best.px = it.px; best.py = it.py;
      // sem posição livre: o texto é recolhido (fica só o ponto da âncora) em vez de sobrepor outro rótulo
      if (!best.clash) placed.push(best);
      return best;
    });
  }

  /* Raycasts restritos às camadas visíveis (o Raycaster do three.js percorre também grupos ocultos). */
  let RAY = null, NDC = null;
  function visibleMeshes(withTransparent) {
    const out = [];
    for (const g of Object.values(S.E.layers)) if (g.visible) g.traverseVisible((o) => {
      if (!o.isMesh) return;
      const m = o.material;
      if (!withTransparent && m && m.transparent && m.opacity < 0.6) return;
      out.push(o);
    });
    return out;
  }
  const clipped = (pt) => { const P = S.E.C.clipPlanes; return P.length > 0 && P.some((pl) => pl.distanceToPoint(pt) < 0); };
  /** Registro (info) de uma malha: dela própria ou do grupo registrado mais próximo (com cache). */
  const INFO_OF = new WeakMap();
  function infoOf(o) {
    if (INFO_OF.has(o)) return INFO_OF.get(o);
    let p = o, r = null;
    while (p) { if (p.userData && p.userData.info && p.userData.info.id) { r = p.userData.info; break; } p = p.parent; }
    INFO_OF.set(o, r); return r;
  }
  /** Equivalente a E.occluded(p), mais barato: para no primeiro obstáculo opaco visível.
      Não conta como obstáculo a própria estrutura em que a âncora está (key → ANCHOR_OWNER; mão para as âncoras
      dos dedos) nem qualquer malha que envolva a âncora — atingida também pelo raio que sai da âncora para longe
      da câmera (3 cm): a âncora está dentro dela (parede de vaso, polpa do dedo). */
  let RAY2 = null;
  function occludedFast(p, tol = 0.8, meshes, key) {
    const E = S.E, T = E.THREE;
    RAY = RAY || new T.Raycaster(); RAY2 = RAY2 || new T.Raycaster();
    const w = E.toWorld(p), cam = E.camera.position, dir = w.clone().sub(cam), d = dir.length();
    dir.normalize(); RAY.set(cam, dir); RAY.near = 0; RAY.far = Math.max(0, d - tol);
    RAY2.set(w, dir); RAY2.near = 0; RAY2.far = 3;
    const own = key && ANCHOR_OWNER[key], handKey = key && HAND_ANCHORS.has(key);
    for (const o of meshes || visibleMeshes(false)) {
      const hits = RAY.intersectObject(o, false);
      if (!hits.some((h) => !clipped(h.point))) continue;
      if (handKey && meshLayer(o) === 'hand') continue;
      const info = infoOf(o);
      if (own && info && own.test(info.id)) continue;
      if (RAY2.intersectObject(o, false).some((h) => !clipped(h.point))) continue; // a âncora está dentro desta malha
      return true;
    }
    return false;
  }
  /** Camada (nome do grupo 'layer:*') de uma malha, com cache. */
  const LAYER_OF = new WeakMap();
  function meshLayer(o) {
    if (LAYER_OF.has(o)) return LAYER_OF.get(o);
    let p = o, n = null;
    while (p) { if (p.name && p.name.indexOf('layer:') === 0) { n = p.name.slice(6); break; } p = p.parent; }
    LAYER_OF.set(o, n); return n;
  }
  /** Equivalente a E.pick(cx, cy) restrito às camadas visíveis, mas atravessando camadas "fantasma":
      uma malha de camada translúcida (S.ghosts, definidas pela cena, pelo leitor ou por showStructure) só é
      devolvida se nada opaco estiver atrás dela. A estrutura destacada nunca conta como fantasma. */
  function pickFast(cx, cy) {
    const E = S.E, T = E.THREE;
    RAY = RAY || new T.Raycaster(); NDC = NDC || new T.Vector2();
    const r = E.renderer.domElement.getBoundingClientRect();
    NDC.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    RAY.setFromCamera(NDC, E.camera); RAY.near = 0; RAY.far = Infinity;
    /* Malhas em ordem de entrada na esfera envolvente: quando a próxima esfera começa além do acerto que já
       decide a seleção, as demais (e seus triângulos) não precisam ser testadas. Mesmo resultado do teste
       exaustivo, com muito menos triângulos percorridos na maioria dos cliques. */
    SPH = SPH || new T.Sphere(); PV = PV || new T.Vector3();
    const cand = [];
    for (const o of visibleMeshes(true)) {
      const g = o.geometry; if (!g) continue;
      if (!g.boundingSphere) g.computeBoundingSphere();
      SPH.copy(g.boundingSphere).applyMatrix4(o.matrixWorld);
      const inside = RAY.ray.origin.distanceToSquared(SPH.center) <= SPH.radius * SPH.radius;
      if (!inside && !RAY.ray.intersectSphere(SPH, PV)) continue;
      cand.push([inside ? 0 : PV.distanceTo(RAY.ray.origin), o]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    const hits = [];
    let ghost = null;
    /** Percorre os acertos até `limit`; devolve {res} quando a seleção já está decidida. */
    const decide = (limit) => {
      ghost = null;
      for (const h of hits) {
        if (h.distance > limit) return null;
        if (clipped(h.point)) continue;
        const o = h.object, info = o.userData.info, m = o.material;
        const op = m && m.transparent ? m.opacity : 1;
        const isHl = !!(info && S.highlightId && info.id === S.highlightId);
        const ghosted = !isHl && S.ghosts[meshLayer(o)] != null;
        if (!info) { if (ghosted || op < 0.5) continue; return { res: ghost }; } // malha opaca sem registro: encobre o que está atrás
        if (op < 0.3 && !info.pickTransparent && !isHl) continue;
        const res = { info, object: o, point: [-h.point.x, h.point.y, h.point.z], distance: h.distance };
        if (ghosted) { if (!ghost) ghost = res; continue; }
        return { res };
      }
      return null;
    };
    const st = S.pickStats = { meshes: cand.length, tested: 0, tris: 0, trisAll: 0 };
    for (const c of cand) { const g = c[1].geometry; st.trisAll += (g.index ? g.index.count : g.attributes.position.count) / 3; }
    for (let i = 0; i < cand.length; i++) {
      const g = cand[i][1].geometry; st.tested++; st.tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
      const got = RAY.intersectObject(cand[i][1], false);
      if (got.length) { hits.push(...got); hits.sort((a, b) => a.distance - b.distance); }
      const next = i + 1 < cand.length ? cand[i + 1][0] : Infinity;
      const d = decide(next);
      if (d) return d.res;
    }
    return ghost;
  }
  let SPH = null, PV = null;

  const q5 = (v) => Math.round((+v || 0) * 5) / 5;
  /** Retângulos (coordenadas do visor) ocupados pelos controles sobrepostos, evitados pelos rótulos. */
  function overlayRects() {
    const vr = R.viewer.getBoundingClientRect(), out = [];
    for (const el of [$('.orient', R.viewer), R.clipBadge, R.viewBar, $('.vp-zoom', R.viewer), $('.legend', R.viewer), R.gizmo, R.card, R.notice, R.tsPill, R.touchDone]) {
      if (!el || el.hidden) continue;
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
      out.push({ x: r.left - vr.left - 3, y: r.top - vr.top - 3, w: r.width + 6, h: r.height + 6 });
    }
    return out;
  }
  function camOnlyKey() {
    const c = S.E.camera.position, t = S.E.orbit.target;
    return [c.x, c.y, c.z, t.x, t.y, t.z].map((v) => v.toFixed(2)).join(',');
  }

  function updateLabels(now) {
    const E = S.E;
    if (!S.labelsOn) return;
    // largura do visor cruzou 600 px (rotação, janela, tela cheia): refaz os rótulos no outro modo
    if (S.labelMode && (narrowLabels() ? 'num' : 'text') !== S.labelMode) setLabels(S.labelList);
    if (!S.labels.length) return;
    const W = R.viewer.clientWidth, H = R.viewer.clientHeight;
    const ck = S.lastCk || camOnlyKey(); // atualizado em onFrame (ou em APP.still)
    const st = E.state;
    const ok = ck + '|' + st.phase + ',' + q5(st.handPose) + ',' + q5(st.breath) + ',' + st.wireMal + ',' + st.rollMode + ',' + Math.round(+st.fixStep || 0) + '|' + S.visKey;
    S.occWant = ok;
    // oclusão: só com a câmera parada (~160 ms), em lotes com orçamento de tempo por quadro
    if (ok !== S.occKey && now - (S.camMoveT || 0) > 160 && now - S.occT > 120) {
      if (!S.occQ || S.occQKey !== ok) { S.occQ = S.labels.slice(); S.occQKey = ok; S.occMeshes = visibleMeshes(false); }
      const t0 = performance.now();
      while (S.occQ.length && performance.now() - t0 < 12) {
        const L = S.occQ.shift();
        let o = false; try { o = occludedFast(E.anchors[L.key], 0.8, S.occMeshes, L.key); } catch (e) { o = false; }
        if (o !== L.occ) { L.occ = o; L.el.classList.toggle('occ', o); L.g.classList.toggle('occ', o); L.ln.classList.toggle('occ', o); L.c.classList.toggle('occ', o); if (L.li) L.li.classList.toggle('occ', o); L.w = 0; S.layoutKey = ''; }
      }
      if (!S.occQ.length) { S.occKey = ok; S.occT = now; S.occQ = null; S.occMeshes = null; }
    }
    const key = ck + '|' + (st.phase === 6 ? fixShown() : 0);
    const lk = key + '|' + W + 'x' + H;
    if (lk === S.layoutKey && S.labels.every((L) => !L.vis || L.settled)) return;
    S.layoutKey = lk;
    const vis = [];
    for (const L of S.labels) {
      if (!L.w) { L.w = L.el.offsetWidth; L.h = L.el.offsetHeight; }
      const p = E.project(E.anchors[L.key]);
      L.px = p.x; L.py = p.y;
      const fs = FIX_ANCHOR_STEP[L.key], fixOk = fs == null || (st.phase === 6 && fixShown() >= fs);
      const v = fixOk && p.inFront && p.x > -4 && p.x < W + 4 && p.y > -4 && p.y < H + 4;
      if (v !== L.vis) { L.vis = v; L.el.style.visibility = v ? '' : 'hidden'; L.g.style.display = v && !L.clash ? '' : 'none'; if (!v) L.init = false; }
      if (L.li) L.li.classList.toggle('off', !v);
      if (v) vis.push(L);
    }
    const num = S.labelMode === 'num';
    const pos = layoutLabels(vis.map((L) => ({ px: L.px, py: L.py, w: L.w, h: L.h, prev: L.slot })), W, H,
      num ? { gap: 9, lift: 0, top: 4, bottom: 4, obstacles: overlayRects() } : { gap: 28, lift: 12, top: 6, bottom: 6, obstacles: overlayRects() });
    vis.forEach((L, i) => {
      const t = pos[i]; const k = L.init && !reduced() ? 0.32 : 1;
      L.slot = { dir: t.dir, dy: t.dy };
      L.x += (t.x - L.x) * k; L.y += (t.y - L.y) * k; L.init = true;
      L.settled = Math.abs(t.x - L.x) < 0.3 && Math.abs(t.y - L.y) < 0.3;
      L.el.style.transform = `translate(${L.x.toFixed(1)}px,${L.y.toFixed(1)}px)`;
      // sem posição livre: no modo texto o rótulo inteiro (caixa, linha e ponto) some — nada de ponto órfão;
      // marcadores numerados ficam sempre (a lista abaixo do visor os identifica)
      const cl = !num && !!t.clash;
      if (cl !== L.clash) { L.clash = cl; L.el.classList.toggle('clash', cl); L.g.style.display = cl ? 'none' : ''; }
      let ex, ey;
      if (L.px < L.x) { ex = L.x; ey = clamp(L.py, L.y + 4, L.y + L.h - 4); }
      else if (L.px > L.x + L.w) { ex = L.x + L.w; ey = clamp(L.py, L.y + 4, L.y + L.h - 4); }
      else { ex = L.px; ey = L.py < L.y ? L.y : L.y + L.h; }
      L.ln.setAttribute('x1', L.px.toFixed(1)); L.ln.setAttribute('y1', L.py.toFixed(1));
      L.ln.setAttribute('x2', ex.toFixed(1)); L.ln.setAttribute('y2', ey.toFixed(1));
      L.c.setAttribute('cx', L.px.toFixed(1)); L.c.setAttribute('cy', L.py.toFixed(1));
    });
  }

  /* ---------------- gizmo de orientação ---------------- */
  function updateGizmo() {
    const E = S.E, q = E.camera.quaternion;
    const key = [q.x, q.y, q.z, q.w].map((v) => v.toFixed(3)).join(',');
    if (key === S.gizmoKey) return;
    S.gizmoKey = key;
    const inv = q.clone().invert();
    const ax = GIZMO_AXES.map((a) => {
      const v = new E.THREE.Vector3(-a.v[0], a.v[1], a.v[2]).applyQuaternion(inv); // anatômico → mundo → câmera
      return Object.assign({}, a, { x: v.x, y: -v.y, z: v.z });
    }).sort((a, b) => a.z - b.z);
    let s = '<title>Orientação: Cranial, Direita do paciente (Dir.) e Anterior (Ant.)</title><circle class="g-bg" r="49"/>';
    const L = 30;
    for (const a of ax) {
      const op = (0.42 + 0.58 * (a.z + 1) / 2).toFixed(2);
      if (Math.hypot(a.x, a.y) < 0.3) {
        // eixo quase alinhado ao olhar: símbolo ⊙ (para o observador) ou ⊗ (para longe), rótulo afastado dos outros eixos
        const o = ax.filter((b) => b !== a); let dx = -(o[0].x + o[1].x), dy = -(o[0].y + o[1].y); const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
        const sx = (dx * 19).toFixed(1), sy = (dy * 19).toFixed(1);
        s += `<circle cx="${sx}" cy="${sy}" r="6" style="fill:none;stroke:${a.color};stroke-width:1.6"/>`;
        s += a.z > 0 ? `<circle cx="${sx}" cy="${sy}" r="2" style="fill:${a.color}"/>` : `<path d="M${(sx - 3.5).toFixed(1)} ${(sy - 3.5).toFixed(1)} l7 7 m0 -7 l-7 7" style="stroke:${a.color};stroke-width:1.5"/>`;
        s += `<text x="${(dx * 36).toFixed(1)}" y="${(dy * 36 + 3.4).toFixed(1)}" text-anchor="middle" style="fill:${a.color}">${a.short}</text>`;
        continue;
      }
      s += `<circle class="neg" cx="${(-a.x * L).toFixed(1)}" cy="${(-a.y * L).toFixed(1)}" r="2.6" style="stroke:${a.color};opacity:${(op * 0.75).toFixed(2)}"/>`;
      s += `<line x1="0" y1="0" x2="${(a.x * L).toFixed(1)}" y2="${(a.y * L).toFixed(1)}" style="stroke:${a.color};opacity:${op}"/>`;
      const lx = a.x * (L + 11), ly = a.y * (L + 11) + 3.4;
      s += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" style="fill:${a.color};opacity:${op}">${a.short}</text>`;
    }
    s += '<circle r="2.4" style="fill:var(--ink-2)"/>';
    R.gizmo.innerHTML = s;
  }

  /* ---------------- dica (hover) e cartão (clique) ---------------- */
  /** Movimento do mouse sem botão: a seleção sob o cursor roda fora do laço de renderização, quando o mouse
      para (~60 ms) ou, em movimento contínuo, no máximo a cada ~300 ms (raycast é o custo dominante). */
  function onHover(e) {
    if (e.pointerType === 'touch') return;
    const now = performance.now();
    S.hover = { x: e.clientX, y: e.clientY };
    if (!R.tooltip.hidden) positionTooltip();
    clearTimeout(S.hoverTimer);
    const wait = now - S.hoverT > 300 ? 0 : 60;
    S.hoverTimer = setTimeout(() => { S.hoverT = performance.now(); doHoverPick(); }, wait);
  }
  function doHoverPick() {
    const E = S.E; if (!E || !S.hover) return;
    let r = null; try { r = pickFast(S.hover.x, S.hover.y); } catch (e) { r = null; }
    R.viewer.classList.toggle('pick', !!r);
    if (!r || !r.info) return hideTooltip();
    const g = glossEntry(r.info.id, r.info);
    R.tooltip.innerHTML = `${esc(stripTags(g.name))}${g.group ? `<small>${esc(g.group)}</small>` : ''}`;
    R.tooltip.hidden = false;
    positionTooltip();
  }
  function positionTooltip() {
    if (!S.hover) return;
    const rc = R.viewer.getBoundingClientRect();
    const w = R.tooltip.offsetWidth, h = R.tooltip.offsetHeight;
    let x = S.hover.x - rc.left + 14, y = S.hover.y - rc.top + 16;
    if (x + w > rc.width - 6) x = S.hover.x - rc.left - w - 12;
    if (y + h > rc.height - 6) y = S.hover.y - rc.top - h - 12;
    R.tooltip.style.transform = `translate(${Math.max(4, x)}px,${Math.max(4, y)}px)`;
  }
  function hideTooltip() { R.tooltip.hidden = true; R.viewer.classList.remove('pick'); }

  function onClick(e) {
    const E = S.E; if (!E) return;
    let r = null; try { r = pickFast(e.clientX, e.clientY); } catch (err) { r = null; }
    if (r && r.info && r.info.id) openCard(r.info.id, r.info); else closeCard();
  }

  /** Entrada de glossário (dados) com recurso ao registro do motor. Sem entrada própria, nome e descrição vêm do
      REGISTRO da estrutura (nunca do glossário de outra: o fio anômalo não é "Fio-guia (ponta em J)"); do id-pai
      (guidewire-ijv → guidewire) aproveita-se só a relevância, rotulada como relacionada. */
  function glossEntry(id, info) {
    const own = D.glossary[id];
    const reg = window.ATLAS && window.ATLAS.registry && window.ATLAS.registry.get(id);
    const ri = (reg && reg.info) || info || {};
    if (own) return { id, name: own.name || ri.name || id, group: own.group || ri.group || '', desc: own.desc || ri.desc || '', relevance: own.relevance || ri.tip || '' };
    let parent = null;
    if (id) { const parts = id.split('-'); while (!parent && parts.length > 1) { parts.pop(); const pid = parts.join('-'); if (D.glossary[pid]) parent = Object.assign({ id: pid }, D.glossary[pid]); } }
    let relevance = ri.tip || '';
    if (!relevance && parent && parent.relevance) relevance = `<em>Relacionado: ${esc(stripTags(parent.name || parent.id))}.</em> ${parent.relevance}`;
    return { id, name: ri.name || id, group: ri.group || (parent && parent.group) || '', desc: ri.desc || '', relevance };
  }
  /** Abre o cartão de estrutura. o.focus: move o foco para o cartão (aberto por botão/teclado) e guarda o
      elemento de origem para devolver o foco ao fechar com Esc ou ×. */
  function openCard(id, info, o = {}) {
    const g = glossEntry(id, info);
    S.cardId = id;
    R.cardGroup.innerHTML = g.group ? `<i style="--c:${GROUP_COLORS[g.group] || 'var(--teal)'}"></i>${esc(g.group)}` : '';
    R.cardName.textContent = stripTags(g.name);
    R.cardDesc.innerHTML = rich(g.desc || 'Sem descrição no glossário.');
    R.cardRel.innerHTML = rich(g.relevance);
    R.cardRelWrap.hidden = !g.relevance;
    const inGloss = !!D.glossary[id];
    R.cardGloss.hidden = !inGloss;
    R.cardGloss.setAttribute('href', '#gl-' + id);
    R.cardHl.setAttribute('aria-pressed', String(S.highlightId === id));
    R.card.hidden = false; S.layoutKey = '';
    R.card.scrollTop = 0;
    hideTooltip();
    if (R.srStatus) R.srStatus.textContent = `Estrutura: ${stripTags(g.name)}${g.group ? ' (' + g.group + ')' : ''}. Esc fecha o cartão.`;
    if (o.focus) {
      S.cardReturn = o.returnTo || document.activeElement;
      R.card.focus({ preventScroll: true });
    } else S.cardReturn = null; // aberto por clique/toque no 3D: Esc não deve saltar para um botão antigo
    wake();
  }
  /** Fecha o cartão. o.restore: devolve o foco a quem o abriu (Esc, botão ×); nas trocas de cena não. */
  function closeCard(o = {}) {
    const wasOpen = !R.card.hidden;
    const inside = wasOpen && R.card.contains(document.activeElement);
    R.card.hidden = true; S.cardId = null; S.layoutKey = '';
    const back = S.cardReturn; S.cardReturn = null;
    if (!wasOpen) return;
    if (o.restore && back && back.isConnected && back.focus) back.focus();
    else if (inside) R.panel.focus({ preventScroll: true }); // o foco não fica perdido num elemento oculto
    wake();
  }

  function layerOf(id) {
    const reg = window.ATLAS && window.ATLAS.registry && window.ATLAS.registry.get(id); if (!reg) return null;
    for (const o of reg.objects) { let p = o; while (p) { if (p.name && p.name.indexOf('layer:') === 0) return p.name.slice(6); p = p.parent; } }
    return null;
  }
  /** Mostra uma estrutura no 3D: liga a camada, torna translúcidas as que a cobrem, destaca, foca e abre o cartão. */
  function showStructure(id, from) {
    const E = S.E; if (!E || !id) return;
    if (!window.ATLAS.registry.has(id)) { showNotice('Esta estrutura não está disponível no modelo carregado.', 3500); return; }
    const layer = layerOf(id);
    if (layer && E.layers[layer] && !E.layers[layer].visible) E.setLayer(layer, true);
    E.highlight(null);
    if (layer && S.ghosts[layer] != null) { E.setGhost(layer, null); delete S.ghosts[layer]; }
    const deep = layer && ['skin', 'drape', 'hand', 'instrument', 'aids'].indexOf(layer) < 0;
    if (deep) {
      ['skin', 'drape'].forEach((cv) => { if (E.layers[cv].visible && S.ghosts[cv] == null) { E.setGhost(cv, 0.16); S.ghosts[cv] = 0.16; } });
      if (layer !== 'muscle' && layer !== 'bones' && E.layers.muscle.visible && S.ghosts.muscle == null) { E.setGhost('muscle', 0.22); S.ghosts.muscle = 0.22; }
    }
    S.highlightId = id; E.highlight(id);
    E.focus(id); S.viewName = null;
    S.visKey++;
    syncControls();
    const top = R.viewer.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.5) R.viewer.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    // aberto por um botão: o foco vai para o cartão (Focar/Destacar/Fechar alcançáveis por teclado; Esc devolve)
    openCard(id, null, { focus: true, returnTo: from && from.focus ? from : document.activeElement });
    wake();
  }

  /* ---------------- corte ---------------- */
  function applyClip() {
    const E = S.E; if (!E) return;
    const base = S.clipBase || DEFAULT_CLIP;
    if (!S.clipOn) E.setClip(null);
    else {
      const n = base.normal, L = Math.hypot(n[0], n[1], n[2]) || 1;
      E.setClip({ normal: n, point: base.point.map((v, i) => v + (n[i] / L) * S.clipOffset) });
    }
    S.visKey++;
  }

  /* ------------------------------------------------------------------ */
  /* controles                                                           */
  /* ------------------------------------------------------------------ */
  function buildControls() {
    R.layerChips.innerHTML = LAYERS.map((l) => `<button type="button" class="chip" data-layer="${l.id}" aria-pressed="false"><i style="--c:${l.color}" aria-hidden="true"></i>${l.label}</button>`).join('');
    R.layerChips.addEventListener('click', (e) => {
      const b = e.target.closest('[data-layer]'); const E = S.E; if (!b || !E) return;
      const id = b.dataset.layer; E.setLayer(id, !E.layers[id].visible); S.visKey++; S.hover = null; hideTooltip(); syncControls();
    });
    R.viewBar.innerHTML = VIEWS.map(([k, t]) => `<button type="button" data-view="${k}" aria-pressed="false">${t}</button>`).join('');
    R.viewBar.addEventListener('click', (e) => {
      const b = e.target.closest('[data-view]'); if (!b || !S.E) return;
      S.E.setView(b.dataset.view, 900); S.viewName = b.dataset.view; syncViewBar();
    });
    R.stepper.innerHTML = PHASES.map((p, i) => `<li><button type="button" data-phase="${i}" aria-pressed="false" aria-label="Etapa ${i}: ${p}" title="${p}"><span class="dot">${i}</span><span class="nm">${PHASES_SHORT[i]}</span></button></li>`).join('');
    R.stepper.addEventListener('click', (e) => {
      const b = e.target.closest('[data-phase]'); const E = S.E; if (!b || !E) return;
      stopAnims('seq', 'wire', 'fix'); E.state.phase = +b.dataset.phase;
      if (E.state.phase > 0) ensureLayers(['instrument']);
      S.visKey++; syncControls();
    });
    // fixação em bailarina (etapa 6): 0–9, rótulos curtos do módulo 3D (api.steps) ou dos dados
    R.fixStepper.innerHTML = Array.from({ length: FIX_MAX + 1 }, (_, k) => `<li><button type="button" data-fix="${k}" aria-pressed="false" aria-label="Fixação, etapa ${k}: ${esc(fixShort(k))}" title="${k} · ${esc(fixShort(k))}"><span class="dot">${k}</span></button></li>`).join('');
    R.fixStepper.addEventListener('click', (e) => {
      const b = e.target.closest('[data-fix]'); const E = S.E; if (!b || !E) return;
      stopAnims('fix'); fixPrepare(); E.state.fixStep = +b.dataset.fix; S.visKey++; syncControls();
    });
    R.fixPlay.addEventListener('click', () => { if (A.fix) stopAnims('fix'); else startAnim('fix'); syncPlayButtons(); });
    R.fixStepper.addEventListener('keydown', (e) => rovingKeys(e, '[data-fix]'));
    R.stepper.addEventListener('keydown', (e) => rovingKeys(e, '[data-phase]'));
    R.ghostToggle.addEventListener('change', () => {
      const E = S.E; if (!E) return;
      E.highlight(null);
      if (R.ghostToggle.checked) { E.setGhost('muscle', 0.22); S.ghosts.muscle = 0.22; ensureLayers(['muscle']); } else { E.setGhost('muscle', null); delete S.ghosts.muscle; }
      E.highlight(S.highlightId);
      S.visKey++;
    });
    R.labelsToggle.addEventListener('change', () => {
      S.labelsOn = R.labelsToggle.checked; R.labels.hidden = R.leaders.hidden = !S.labelsOn;
      R.lblKey.hidden = !(S.labelsOn && S.labelMode === 'num' && S.labels.length);
      S.layoutKey = ''; S.labels.forEach((L) => (L.init = false));
    });
    // valor lido ANTES de ensureLayers (que sincroniza os controles com o estado ainda antigo)
    R.handRange.addEventListener('input', () => { const E = S.E; if (!E) return; const v = R.handRange.value / 100; stopAnims('hand'); E.state.handPose = v; ensureLayers(handLayers()); S.visKey++; syncDynamic(); });
    R.breathRange.addEventListener('input', () => { const E = S.E; if (!E) return; const v = R.breathRange.value / 100; stopAnims('breath'); E.state.breath = v; ensureLayers(['lung', 'pleura']); S.visKey++; syncDynamic(); });
    R.handPlay.addEventListener('click', () => { if (A.hand) stopAnims('hand'); else startAnim('hand'); syncPlayButtons(); });
    R.breathPlay.addEventListener('click', () => { if (A.breath) stopAnims('breath'); else startAnim('breath'); syncPlayButtons(); });
    R.seqPlay.addEventListener('click', () => { if (A.seq || A.wire) stopAnims('seq', 'wire'); else startAnim('needle'); syncPlayButtons(); });
    R.wireToggle.addEventListener('change', () => {
      const E = S.E; if (!E) return; stopAnims('wire'); E.state.wireMal = R.wireToggle.checked;
      if (E.state.wireMal) { if (E.state.phase !== 5) E.state.phase = 5; ensureLayers(['instrument']); }
      S.visKey++; syncControls();
    });
    R.planesToggle.addEventListener('change', () => { const E = S.E; if (!E) return; E.state.showPlanes = R.planesToggle.checked; if (E.state.showPlanes) ensureLayers(['aids']); S.visKey++; });
    R.clipToggle.addEventListener('change', () => { S.clipOn = R.clipToggle.checked; applyClip(); syncControls(); });
    R.clipRange.addEventListener('input', () => { S.clipOffset = R.clipRange.value / 10; applyClip(); syncClip(); });
    R.clipBadgeOff.addEventListener('click', () => { S.clipOn = false; applyClip(); syncControls(); });
    R.rollSeg.addEventListener('click', (e) => {
      const b = e.target.closest('[data-roll]'); const E = S.E; if (!b || !E) return;
      E.state.rollMode = b.dataset.roll; if (E.state.rollMode !== 'none') ensureLayers(['aids']);
      S.visKey++; syncControls();
    });
    R.rollSeg.addEventListener('keydown', (e) => { // radiogroup: setas (tabindex móvel: uma só parada de Tab)
      if (!/Arrow(Left|Right|Up|Down)/.test(e.key)) return;
      const bs = $$('[data-roll]', R.rollSeg); const i = bs.findIndex((b) => b.getAttribute('aria-checked') === 'true');
      const j = (i + (/Right|Down/.test(e.key) ? 1 : -1) + bs.length) % bs.length;
      bs[j].click(); bs[j].focus(); e.preventDefault();
    });
    R.btnSnap.addEventListener('click', snapshotPNG);
    R.zoomIn.addEventListener('click', () => S.E && S.E.zoom(0.82));
    R.zoomOut.addEventListener('click', () => S.E && S.E.zoom(1 / 0.82));
    R.sceneReset.addEventListener('click', () => applyScene(chapter().scene, true));
    R.cardClose.addEventListener('click', () => closeCard({ restore: true }));
    R.cardFocus.addEventListener('click', () => { if (S.E && S.cardId) { S.E.focus(S.cardId); S.viewName = null; syncViewBar(); } });
    R.cardHl.addEventListener('click', () => {
      const E = S.E; if (!E || !S.cardId) return;
      S.highlightId = S.highlightId === S.cardId ? null : S.cardId; E.highlight(S.highlightId);
      R.cardHl.setAttribute('aria-pressed', String(S.highlightId === S.cardId));
    });
    R.cardGloss.addEventListener('click', (e) => { const id = S.cardId; if (!id) return; e.preventDefault(); revealGlossary(id); });
  }

  function syncControls() {
    const E = S.E; if (!E) return;
    $$('[data-layer]', R.layerChips).forEach((b) => b.setAttribute('aria-pressed', String(!!(E.layers[b.dataset.layer] && E.layers[b.dataset.layer].visible))));
    R.ghostToggle.checked = S.ghosts.muscle != null;
    R.labelsToggle.checked = S.labelsOn;
    R.planesToggle.checked = !!E.state.showPlanes;
    // radiogroup com tabindex móvel: só a opção marcada entra na sequência de Tab
    $$('[data-roll]', R.rollSeg).forEach((b) => { const on = b.dataset.roll === (E.state.rollMode || 'none'); b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
    syncLegend();
    syncClip(); syncViewBar(); syncDynamic(); syncPlayButtons();
  }
  /** Legenda do visor: só as camadas visíveis (as cores vêm de LAYERS — mediana renderizada de cada tecido). */
  function syncLegend() {
    const E = S.E; if (!E || !R.legendKeys) return;
    let n = 0;
    $$('li[data-lg]', R.legendKeys).forEach((li) => { const g = E.layers[li.dataset.lg]; const on = !!(g && g.visible); li.hidden = !on; n += on; });
    R.legendKeys.hidden = !n;
    if (R.legendKeys.dataset.n !== String(n)) { R.legendKeys.dataset.n = String(n); S.layoutKey = ''; } // a legenda é obstáculo dos rótulos
  }
  function setRange(input, v, text) {
    input.value = v; input.style.setProperty('--fill', ((v - input.min) / (input.max - input.min)) * 100 + '%');
    if (text != null) input.setAttribute('aria-valuetext', text);
  }
  /** Rótulo curto da etapa k da fixação: módulo 3D (api.steps) → dados (títulos) → padrão. */
  function fixShort(k) {
    const api = S.E && S.E.results.fixation && S.E.results.fixation.api;
    const st = api && Array.isArray(api.steps) ? api.steps.find((x) => +x.n === k) || api.steps[k] : null;
    if (st && st.short) return stripTags(st.short);
    return FIX_SHORT[k] || 'Etapa ' + k;
  }
  /** Etapa exibida: com fixStep = k + t (t > 0) o movimento da etapa k+1 está em andamento. */
  const fixShown = () => clamp(Math.ceil((+(S.E && S.E.state.fixStep) || 0) - 0.001), 0, FIX_MAX);
  /** Controles que mudam durante animações. */
  function syncDynamic() {
    const E = S.E; if (!E) return;
    const hp = clamp(+E.state.handPose || 0, 0, 1), br = clamp(+E.state.breath || 0, 0, 1);
    R.handOut.textContent = hp < 0.02 ? 'Preparar' : hp > 0.98 ? 'Apoiar' : Math.round(hp * 100) + '%';
    setRange(R.handRange, Math.round(hp * 100), 'Mão: ' + (hp < 0.02 ? 'preparar' : hp > 0.98 ? 'apoiar' : Math.round(hp * 100) + '% do apoio'));
    R.breathOut.textContent = br < 0.03 ? 'Expiração' : br > 0.97 ? 'Inspiração' : 'Intermediária';
    setRange(R.breathRange, Math.round(br * 100), 'Respiração: ' + R.breathOut.textContent.toLowerCase() + (br >= 0.03 && br <= 0.97 ? ' (' + Math.round(br * 100) + '%)' : ''));
    const ph = clamp(Math.round(+E.state.phase || 0), 0, 6);
    if (S.lastPhase !== ph) {
      S.lastPhase = ph;
      $$('[data-phase]', R.stepper).forEach((b) => { const k = +b.dataset.phase; b.setAttribute('aria-pressed', String(k === ph)); b.classList.toggle('past', k < ph); b.tabIndex = k === ph ? 0 : -1; });
      R.stepper.style.setProperty('--p', String(ph / 6));
      R.phaseNum.textContent = ph; R.phaseName.textContent = PHASES[ph];
      // cateter posicionado: a linha de opções da agulha dá lugar à fixação (mesma altura, sem salto de layout)
      R.needleOpts.hidden = ph === 6; R.fixRow.hidden = ph !== 6;
      S.lastFix = null;
    }
    R.wireToggle.checked = !!E.state.wireMal;
    const fk = ph === 6 ? fixShown() : 0;
    if (S.lastFix !== fk) {
      S.lastFix = fk;
      $$('[data-fix]', R.fixStepper).forEach((b) => { const k = +b.dataset.fix; b.setAttribute('aria-pressed', String(k === fk)); b.classList.toggle('past', k < fk); b.tabIndex = k === fk ? 0 : -1; });
      R.fixStepper.style.setProperty('--p', String(fk / FIX_MAX));
      R.phaseName.textContent = ph === 6 && fk > 0 ? `Fixação ${fk}/${FIX_MAX}: ${fixShort(fk)}` : PHASES[ph];
      R.stepperNow.title = ph === 6 ? `${PHASES[6]} · fixação ${fk}/${FIX_MAX}: ${fixShort(fk)}` : PHASES[ph];
      syncFixInset();
    }
  }
  function syncClip() {
    R.clipToggle.checked = S.clipOn;
    R.clipRange.disabled = !S.clipOn;
    setRange(R.clipRange, Math.round(S.clipOffset * 10), 'Plano de corte deslocado ' + fmtCm(S.clipOffset).replace('−', 'menos ').replace('+', 'mais '));
    R.clipOut.textContent = fmtCm(S.clipOffset);
    if (R.clipBadge.hidden === S.clipOn) S.layoutKey = '';
    R.clipBadge.hidden = !S.clipOn;
    R.clipBadgeText.textContent = ((S.clipBase || DEFAULT_CLIP).label || 'Corte ativo') + (S.clipOffset ? ' (' + fmtCm(S.clipOffset) + ')' : '');
  }
  function syncViewBar() { $$('[data-view]', R.viewBar).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === S.viewName))); }
  function syncPlayButtons() {
    if (!R.handPlay) return;
    R.handPlay.setAttribute('aria-pressed', String(!!A.hand));
    R.breathPlay.setAttribute('aria-pressed', String(!!A.breath));
    R.seqPlay.setAttribute('aria-pressed', String(!!(A.seq || A.wire)));
    R.fixPlay.setAttribute('aria-pressed', String(!!A.fix));
    R.breathPlay.setAttribute('aria-label', A.breath ? 'Pausar a respiração' : 'Animar a respiração');
    R.handPlay.setAttribute('aria-label', A.hand ? 'Pausar a animação da mão' : 'Animar a mão: preparar e apoiar');
    R.seqPlay.setAttribute('aria-label', A.seq || A.wire ? 'Pausar a sequência' : 'Reproduzir a sequência da agulha (aproximação até a luz venosa)');
    R.fixPlay.setAttribute('aria-label', A.fix ? 'Pausar a fixação' : 'Reproduzir a fixação em bailarina, etapa por etapa');
  }
  /** Teclado nos steppers (tabindex móvel): setas mudam de etapa, Home/End vão às pontas. */
  function rovingKeys(e, sel) {
    if (!/^(Arrow(Left|Right|Up|Down)|Home|End)$/.test(e.key)) return;
    const bs = $$(sel, e.currentTarget); const i = Math.max(0, bs.findIndex((b) => b.getAttribute('aria-pressed') === 'true'));
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? bs.length - 1 : clamp(i + (/Right|Down/.test(e.key) ? 1 : -1), 0, bs.length - 1);
    bs[j].click(); bs[j].focus(); e.preventDefault(); e.stopPropagation();
  }

  /* ------------------------------------------------------------------ */
  /* captura (PNG) e impressão                                            */
  /* ------------------------------------------------------------------ */
  const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  /** Renderiza o visor em w×h, compõe fundo e rótulos num canvas 2D e devolve dataURL. */
  async function composeSnapshot(w, h, opt = {}) {
    const E = S.E;
    const raw = E.snapshot(w, h);
    const img = await loadImg(raw);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    const dark = opt.theme === 'dark';
    const g = ctx.createRadialGradient(w * 0.5, h * 0.3, 0, w * 0.5, h * 0.3, Math.max(w, h) * 0.8);
    (dark ? [[0, '#24474a'], [0.5, '#163235'], [1, '#0a1719']] : [[0, '#f8f6ee'], [0.46, '#e9ece5'], [1, '#cfdad4']]).forEach(([k, c]) => g.addColorStop(k, c));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    if (opt.labels !== false && S.labels.length) {
      const cam = E.camera, a0 = cam.aspect;
      cam.aspect = w / h; cam.updateProjectionMatrix();
      const fs = clamp(Math.round(w / 64), 12, 30), padX = fs * 0.6, lh = fs * 1.75;
      ctx.font = `600 ${fs}px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
      const items = [], occMeshes = visibleMeshes(false);
      for (const L of S.labels) {
        const a = E.anchors[L.key]; const v = new E.THREE.Vector3(-a[0], a[1], a[2]).project(cam);
        if (!(v.z < 1 && v.z > -1)) continue;
        const px = (v.x * 0.5 + 0.5) * w, py = (-v.y * 0.5 + 0.5) * h;
        if (px < 0 || px > w || py < 0 || py > h) continue;
        let occ = false; try { occ = occludedFast(a, 0.8, occMeshes, L.key); } catch (e) { occ = false; }
        items.push({ px, py, w: ctx.measureText(stripTags(L.text || L.key)).width + padX * 2 + 3, h: lh, text: stripTags(L.text || L.key), occ });
      }
      cam.aspect = a0; cam.updateProjectionMatrix();
      const pos = layoutLabels(items, w, h, { gap: fs * 2.3, lift: fs, top: fs, bottom: fs });
      items.forEach((it, i) => {
        const p = pos[i];
        const ex = it.px < p.x ? p.x : it.px > p.x + p.w ? p.x + p.w : it.px;
        const ey = it.px < p.x || it.px > p.x + p.w ? clamp(it.py, p.y + 4, p.y + p.h - 4) : it.py < p.y ? p.y : p.y + p.h;
        ctx.strokeStyle = dark ? '#6cc6bb' : '#176d66'; ctx.lineWidth = Math.max(1.5, fs / 9);
        if (p.clash) return; // sem espaço livre: o rótulo é omitido inteiro (sem ponto órfão)
        ctx.setLineDash(it.occ ? [fs / 3, fs / 3] : []);
        ctx.beginPath(); ctx.moveTo(it.px, it.py); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = dark ? '#6cc6bb' : '#176d66'; ctx.beginPath(); ctx.arc(it.px, it.py, fs / 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = dark ? 'rgba(14,30,32,0.92)' : 'rgba(255,253,244,0.95)';
        roundRect(ctx, p.x, p.y, p.w, p.h, fs * 0.35); ctx.fill();
        ctx.fillStyle = dark ? '#6cc6bb' : '#176d66'; ctx.fillRect(p.x, p.y, Math.max(3, fs / 5), p.h);
        ctx.fillStyle = dark ? '#e7f0ec' : '#1d3c39'; ctx.globalAlpha = it.occ ? 0.75 : 1;
        ctx.textBaseline = 'middle'; ctx.fillText(it.text, p.x + padX + 3, p.y + p.h / 2 + 1); ctx.globalAlpha = 1;
      });
    }
    wake(); // E.snapshot redimensiona o canvas (o que o limpa): o laço precisa redesenhar o visor
    return cv.toDataURL(opt.fmt || 'image/jpeg', 0.9);
  }

  async function snapshotPNG() {
    if (!S.E) return;
    const W = R.viewer.clientWidth, H = R.viewer.clientHeight, k = clamp(2400 / W, 1, 2);
    R.btnSnap.disabled = true;
    try {
      const url = await composeSnapshot(Math.round(W * k), Math.round(H * k), { labels: S.labelsOn, theme: currentTheme(), fmt: 'image/png' });
      const a = document.createElement('a'); a.href = url; a.download = `atlas-subclavia-cena-${chapter().n}.png`;
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { showNotice('Não foi possível gerar a imagem neste navegador.', 4000); }
    R.btnSnap.disabled = false;
  }

  function busy(text) { if (text == null) { R.busy.hidden = true; return; } R.busyText.textContent = text; R.busy.hidden = false; }

  /** Reduz ilustração e corpo de texto de cada folha até caber numa página A4. */
  async function fitSheets() {
    const root = R.printRoot;
    root.classList.add('measure');
    await Promise.all($$('img', root).map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = r; im.onerror = r; }))));
    for (const sh of $$('.sheet', root)) {
      const cover = sh.classList.contains('cover');
      let hero = cover ? 104 : 92, fs = 9.2;
      const set = () => { sh.style.setProperty('--hero', hero + 'mm'); sh.style.setProperty('--fs', fs.toFixed(2) + 'pt'); };
      const over = () => sh.scrollHeight > sh.clientHeight + 1;
      set();
      // alterna: ilustração até 74 mm, texto até 8,2 pt, ilustração até 58 mm, texto até 7 pt
      while (over() && hero > 74) { hero -= 3; set(); }
      while (over() && fs > 8.2) { fs -= 0.2; set(); }
      while (over() && hero > 58) { hero -= 3; set(); }
      while (over() && fs > 7) { fs -= 0.2; set(); }
      sh.dataset.fit = over() ? 'overflow' : 'ok';
    }
    root.classList.remove('measure');
  }

  /** Modo "folhas": só #printRoot é impresso e a página fica sem margem (o padding da .sheet faz as margens).
      Além da página nomeada "sheet" do CSS, injeta @page{margin:0} — cobre navegadores sem páginas nomeadas;
      fora deste modo (Ctrl+P direto) vale a margem normal de @page. */
  function setSheetPage(on) {
    document.body.classList.toggle('print-sheets', on);
    let st = document.getElementById('sheetPageCss');
    if (on && !st) { st = document.createElement('style'); st.id = 'sheetPageCss'; st.textContent = '@page { size: A4; margin: 0; }'; document.head.appendChild(st); }
    else if (!on && st) st.remove();
  }
  /** Gera #printRoot (capa + 1 folha A4 por capítulo) e chama window.print(). */
  async function buildPrint(opt = {}) {
    if (S.printing) return;
    S.printing = true;
    const prev = S.idx, E = S.E, chs = D.chapters, imgs = [];
    const m = D.meta, title = stripTags(m.title || 'Punção da subclávia direita');
    try {
      busy('Preparando a versão para impressão…');
      await nextFrame();
      if (opt.placeholder) { // testes de diagramação: ilustração neutra 2:1 sem renderizar (funciona sem o visor 3D)
        const c = document.createElement('canvas'); c.width = 160; c.height = 80; const x = c.getContext('2d'); x.fillStyle = '#dfe6e1'; x.fillRect(0, 0, 160, 80);
        const u = c.toDataURL('image/png'); chs.forEach((_, i) => (imgs[i] = u));
      } else if (E) {
        stopAnims();
        pause('print'); // sem laço contínuo durante as capturas
        for (let i = 0; i < chs.length; i++) {
          busy(`Gerando a ilustração da cena ${i + 1} de ${chs.length}…`);
          await nextFrame();
          S.idx = i;
          applyScene(chs[i].scene, 'print');
          settleModules();
          try { imgs[i] = await composeSnapshot(1600, 800, { labels: true, theme: 'light' }); } catch (e) { imgs[i] = null; }
        }
      }
      const ver = [m.version ? 'Versão ' + m.version : '', m.reviewDate ? 'Revisão ' + m.reviewDate : ''].filter(Boolean).join(' · ');
      const foot = 'Material educacional para simulação supervisionada. Não fornece trajetória nem profundidade seguras para uso em pacientes.';
      const coverImg = window.PRANCHA_JPG ? 'data:image/jpeg;base64,' + window.PRANCHA_JPG : imgs[0];
      let html = `<section class="sheet cover"><div class="sh-top"><span>Atlas espacial 3D · ensino e simulação</span><span>${esc(ver)}</span></div>
        <h1>${rich(m.title || title)}</h1><p class="cv-sub">${rich(m.subtitle || '')}</p>
        ${coverImg ? `<img class="hero" src="${coverImg}" alt="">` : ''}
        <ol class="cv-toc">${chs.map((c) => `<li><b>${esc(c.n)}</b>${rich(c.title)}</li>`).join('')}</ol>
        <p class="cv-note">${rich(m.disclaimer || 'Modelo 3D didático e sintético, sem escala clínica.')} ${rich(m.modelNote || '')}</p>
        <div class="sh-foot"><span>${esc(foot)}</span><span>Capa</span></div></section>`;
      let page = 1;
      chs.forEach((c, i) => {
        const refs = c.sources.map((n) => srcByN(n)).filter(Boolean);
        page++;
        html += `<section class="sheet"><div class="sh-top"><span>${esc(title)}</span><span>Cena ${esc(c.n)} / ${String(chs.length).padStart(2, '0')}</span></div>
          <p class="num">${esc(stripTags(c.short))}</p><h2>${rich(c.title)}</h2>
          ${imgs[i] ? `<img class="hero" src="${imgs[i]}" alt="">` : ''}
          ${c.focus ? `<p class="sh-focus">${rich(c.focus)}</p>` : ''}
          <div class="sh-body">${c.body.map((p) => `<p>${rich(p)}</p>`).join('')}</div>
          ${c.keyPoints.length || c.pitfalls.length ? `<div class="sh-boxes">${c.keyPoints.length ? `<div class="sh-box key"><h3>Pontos-chave</h3><ul>${c.keyPoints.map((p) => `<li>${rich(p)}</li>`).join('')}</ul></div>` : ''}${c.pitfalls.length ? `<div class="sh-box pit"><h3>Armadilhas</h3><ul>${c.pitfalls.map((p) => `<li>${rich(p)}</li>`).join('')}</ul></div>` : ''}</div>` : ''}
          ${refs.length > 8 ? `<div class="sh-refs"><p>Fontes do capítulo: ${refs.map((s) => '[' + esc(s.n) + ']').join(' ')} — referências completas na seção “Fontes e limites do modelo”.</p></div>`
            : refs.length ? `<div class="sh-refs${refs.length > 5 ? ' many' : ''}">${refs.map((s) => refs.length > 5 ? `<p>[${esc(s.n)}] ${rich(s.title)}</p>` : `<p>[${esc(s.n)}] ${rich(s.title)}${s.detail ? ' — ' + rich(s.detail) : ''}${s.url ? '. ' + esc(s.url) : ''}</p>`).join('')}</div>` : ''}
          <div class="sh-foot"><span>${esc(foot)}</span><span>${page}</span></div></section>`;
        // fixação: folha extra com as 9 etapas em miniatura, logo após a folha do capítulo
        if (c.id === 'fixacao' && D.fixation) html += fixSheetHTML(title, foot, ++page);
      });
      R.printRoot.innerHTML = html;
      busy('Ajustando as folhas A4…');
      await fitSheets();
      setSheetPage(true);
    } finally {
      S.idx = prev;
      if (E) { applyScene(chapter().scene, false); unpause('print'); }
      busy(null);
      S.printing = false;
    }
    if (opt.print !== false) { await sleep(80); window.print(); }
  }

  /** Legenda do visor gerada de LAYERS (cores = mediana renderizada de cada tecido, ver LAYERS). */
  const LEGEND_LAYERS = [['vein', 'Veia'], ['artery', 'Artéria'], ['nerve', 'Nervo'], ['lymph', 'Linfático'], ['muscle', 'Músculo'], ['bones', 'Osso'], ['lung', 'Pulmão'], ['pleura', 'Pleura'], ['skin', 'Pele'], ['hand', 'Mão (luva)'], ['instrument', 'Instrumentos']];
  function buildLegend() {
    if (!R.legendKeys) return;
    R.legendKeys.innerHTML = LEGEND_LAYERS.map(([id, t]) => { const l = LAYERS.find((x) => x.id === id); return `<li data-lg="${id}"><i style="--c:${l ? l.color : '#999'}"></i>${t}</li>`; }).join('');
  }

  /** Impressão nativa (Ctrl+P, sem o botão): glossário completo e detalhes da fixação abertos; restaura depois. */
  function printNative(on) {
    if (document.body.classList.contains('print-sheets')) return; // folhas do botão: só #printRoot
    if (on) {
      S.printSaved = { limit: G.limit, open: $$('#fixBody details:not([open]), #painel details:not([open])') };
      G.limit = 1e9; renderGlossary();
      S.printSaved.open.forEach((d) => (d.open = true));
    } else if (S.printSaved) {
      G.limit = S.printSaved.limit; renderGlossary();
      S.printSaved.open.forEach((d) => { if (d.isConnected) d.open = false; });
      S.printSaved = null;
    }
  }

  /** Teclado no visor (canvas focável): setas giram, Shift+setas deslocam, + e − aproximam, Enter identifica a
      estrutura no centro (cartão). Esc fecha o cartão (tratado no documento). */
  function setupCanvasKeys(cv) {
    cv.tabIndex = 0;
    cv.setAttribute('aria-roledescription', 'visor 3D');
    cv.setAttribute('aria-label', 'Modelo 3D interativo da região infraclavicular direita. Setas giram, Shift mais setas deslocam, mais e menos aproximam, Enter identifica a estrutura no centro. Também há botões de vista e controles abaixo do visor.');
    cv.addEventListener('keydown', (e) => {
      const E = S.E; if (!E || e.altKey || e.ctrlKey || e.metaKey) return;
      const o = E.orbit; let used = true;
      if (/^Arrow/.test(e.key) && e.shiftKey) {
        const T = E.THREE; E.camera.updateMatrixWorld();
        const right = new T.Vector3().setFromMatrixColumn(E.camera.matrixWorld, 0), up = new T.Vector3().setFromMatrixColumn(E.camera.matrixWorld, 1);
        const st = o.radius * 0.03;
        // deslocar a vista (como num mapa): seta para a esquerda leva o enquadramento para a esquerda
        if (e.key === 'ArrowLeft') o.target.addScaledVector(right, -st); else if (e.key === 'ArrowRight') o.target.addScaledVector(right, st);
        else if (e.key === 'ArrowUp') o.target.addScaledVector(up, st); else o.target.addScaledVector(up, -st);
        E.applyCam();
      } // girar: as setas imitam o arrasto do mouse na mesma direção
      else if (e.key === 'ArrowLeft') { o.az += 0.08; E.applyCam(); }
      else if (e.key === 'ArrowRight') { o.az -= 0.08; E.applyCam(); }
      else if (e.key === 'ArrowUp') { o.el = clamp(o.el - 0.06, -1.35, 1.45); E.applyCam(); }
      else if (e.key === 'ArrowDown') { o.el = clamp(o.el + 0.06, -1.35, 1.45); E.applyCam(); }
      else if (e.key === '+' || e.key === '=') E.zoom(0.9);
      else if (e.key === '-' || e.key === '_') E.zoom(1 / 0.9);
      else if (e.key === 'Enter' || e.key === ' ') {
        const r = cv.getBoundingClientRect();
        let hit = null; try { hit = pickFast(r.left + r.width / 2, r.top + r.height / 2); } catch (err) { hit = null; }
        if (hit && hit.info && hit.info.id) openCard(hit.info.id, hit.info, { focus: true, returnTo: cv });
        else showNotice('Nenhuma estrutura no centro do visor.', 2200);
      } else used = false;
      if (!used) return;
      e.preventDefault();
      if (S.viewName) { S.viewName = null; syncViewBar(); }
      wake();
    });
  }

  /* ------------------------------------------------------------------ */
  /* tela cheia                                                          */
  /* ------------------------------------------------------------------ */
  function isFull() { return !!(document.fullscreenElement || document.webkitFullscreenElement) || S.pseudoFull; }
  function toggleFull() {
    const v = R.viewer;
    if (document.fullscreenElement || document.webkitFullscreenElement) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    if (S.pseudoFull) { S.pseudoFull = false; v.classList.remove('full'); document.body.style.overflow = ''; syncFull(); return; }
    const pseudo = () => { S.pseudoFull = true; v.classList.add('full'); document.body.style.overflow = 'hidden'; syncFull(); };
    const req = v.requestFullscreen || v.webkitRequestFullscreen;
    if (req) { try { Promise.resolve(req.call(v)).catch(pseudo); } catch (e) { pseudo(); } } else pseudo();
  }
  function syncFull() {
    const f = isFull();
    R.btnFull.setAttribute('aria-pressed', String(f));
    R.fullExit.hidden = !f;
    if (coarse && R.touchShield) { setTouchLive(f); R.touchDone.hidden = f || !S.touchLive; } // em tela cheia não há página a rolar
    S.layoutKey = '';
    wake();
  }

  /* ------------------------------------------------------------------ */
  /* toque: proteção de rolagem do visor                                 */
  /* ------------------------------------------------------------------ */
  /* Em telas de toque o visor ocupa boa parte da altura e o canvas usa touch-action:none: todo arrasto sobre
     ele girava o modelo e o leitor ficava preso ao tentar rolar até o texto. Até o primeiro toque, uma camada
     transparente (touch-action: pan-y) deixa a página rolar; tocar nela ativa o 3D; "Concluir" — ou o visor sair
     da tela — devolve a proteção. Controles do visor (vistas, zoom) ficam acima dela e funcionam sempre. */
  function setupTouchShield() {
    if (!coarse || !R.touchShield) return;
    R.touchShield.hidden = false;
    R.touchShield.addEventListener('click', () => setTouchLive(true));
    pillTimer();
    R.touchDone.addEventListener('click', () => { setTouchLive(false); R.touchShield.focus({ preventScroll: true }); });
  }
  /** A pílula "Toque para girar" encolhe para um ícone discreto depois de 4 s (não cobre a anatomia). */
  function pillTimer() {
    if (!R.tsPill) return;
    R.tsPill.classList.remove('min'); clearTimeout(S.pillT);
    S.pillT = setTimeout(() => { R.tsPill.classList.add('min'); S.layoutKey = ''; wake(); }, 4000);
  }
  function setTouchLive(on) {
    if (!coarse || !R.touchShield) return;
    if (!on && S.touchLive) pillTimer();
    S.touchLive = !!on;
    R.touchShield.hidden = S.touchLive;
    R.touchDone.hidden = !S.touchLive;
    R.viewer.classList.toggle('live', S.touchLive);
    S.layoutKey = '';
    wake();
  }

  /** A barra de vistas (direita) e a nota de orientação (esquerda) disputam o topo do visor entre ~980 e
      ~1300 px: medido de fato (fontes, zoom do navegador), não por ponto de quebra. Se colidem, a nota desce. */
  function fixOverlays() {
    const v = R.viewer, a = R.orientNote, b = R.viewBar; if (!v || !a || !b) return;
    v.classList.remove('vp-stack');
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const hit = ra.width > 0 && rb.width > 0 && ra.right + 8 > rb.left && rb.right + 8 > ra.left && ra.bottom + 4 > rb.top && rb.bottom + 4 > ra.top;
    v.classList.toggle('vp-stack', hit);
    S.layoutKey = '';
  }

  /* ------------------------------------------------------------------ */
  /* fixação em bailarina (inset 'fixation', seção #fixacao, folha extra) */
  /* ------------------------------------------------------------------ */
  /** Passo k (0..9) de ATLAS_DATA.fixation (k = 0: step0, sem movimento). */
  function fixStepData(k) {
    const F = D.fixation; if (!F) return null;
    if (k === 0) { const s0 = F.step0 || { title: 'Sem fixação', text: '' }; return Object.assign({ k: 0, movement: '', cautions: [], why: '' }, s0); }
    return arr(F.steps).find((s) => +s.k === k) || null;
  }

  /* Ilustração esquemática por etapa, vista de cima (pele de frente para o leitor), sem escala: a saída do cateter
     à direita, o trecho externo seguindo até o canhão (à esquerda, lateral, como na vista anterior do 3D). As etapas
     são cumulativas; os elementos da etapa atual recebem halo dourado. Por baixo do cateter = traço coberto pelo
     cateter (tracejado onde aparece); por cima = traço contínuo desenhado depois do cateter.
     Coordenadas (viewBox 360×210, ~26 px/cm): saída E(262,112); cruzamentos em x 226/200/174; canhão até x 108. */
  const FX = {
    exit: [262, 112], knot0: [248, 125], bite: [[257, 125], [239, 125]], // pegada paralela ao cateter, a ~3 mm dele
    cross: [226, 200, 174], half: 9, top: 104, bot: 120,
    holes: [[81, 76], [81, 132]], wingSkin: [[81, 55], [81, 153]],
  };
  function fixSVG(k, o = {}) {
    k = clamp(k | 0, 0, FIX_MAX);
    const id = o.id || 'fx' + k;
    const TH = '#1f3f8a'; // fio monofilamentar azul
    const halo = (d, w) => `<path d="${d}" style="fill:none;stroke:#e2b65a;stroke-width:${w || 9};stroke-linecap:round;stroke-linejoin:round;opacity:.55"/>`;
    const th = (d, cur, w) => (cur ? halo(d, (w || 2.2) + 7) : '') + `<path d="${d}" style="fill:none;stroke:${TH};stroke-width:${w || 2.2};stroke-linecap:round;stroke-linejoin:round"/>`;
    const thUnder = (d, cur) => (cur ? halo(d, 8) : '') + `<path d="${d}" style="fill:none;stroke:${TH};stroke-width:1.7;stroke-dasharray:3 2.4;opacity:.75"/>`;
    const knot = (x, y, cur, big) => (cur ? `<circle cx="${x}" cy="${y}" r="${big ? 10 : 8}" style="fill:#e2b65a;opacity:.55"/>` : '') +
      `<ellipse cx="${x}" cy="${y}" rx="${big ? 5.2 : 3.8}" ry="${big ? 4 : 3}" style="fill:${TH}"/>` + (big ? `<ellipse cx="${x - 3}" cy="${y - 2}" rx="2.6" ry="2" style="fill:#3b5fae"/><ellipse cx="${x + 2.6}" cy="${y + 2}" rx="2.4" ry="1.8" style="fill:#3b5fae"/>` : `<ellipse cx="${x - 1.2}" cy="${y - 1}" rx="1.6" ry="1.1" style="fill:#4d70bd"/>`);
    const lbl = (x, y, t, anchor, cur) => `<text x="${x}" y="${y}" text-anchor="${anchor || 'start'}" class="fx-l${cur ? ' cur' : ''}">${t}</text>`;
    const lead = (x1, y1, x2, y2) => `<path d="M${x1} ${y1} L${x2} ${y2}" class="fx-lead"/>`;
    const [ex, ey] = FX.exit, [kx, ky] = FX.knot0, T = FX.top, B = FX.bot, H = FX.half;
    const cath = 'M262 112 L 168 112 C 142 112 130 104 108 104';
    let under = '', over = '', marks = '', notes = '';

    // pele, trajeto subcutâneo (sob a pele) e saída
    let s = `<rect x="0" y="0" width="360" height="210" rx="10" style="fill:#f0d6c3"/>
      <path d="M0 40 C 90 30 200 48 360 36 M0 182 C 120 172 230 190 360 178" style="fill:none;stroke:#e2bfa6;stroke-width:1.2"/>
      <path d="M268 112 L 356 112" style="stroke:#b48a73;stroke-width:9;stroke-linecap:round;opacity:.22"/>
      <path d="M268 112 L 352 112" style="stroke:#8c9aa3;stroke-width:1.4;stroke-dasharray:5 4"/>`;
    // ponto de ancoragem (etapa 2+): pegada dérmica ao lado do cateter, do lado do canhão
    if (k >= 2) {
      const [[ax, ay], [bx, by]] = FX.bite;
      under += `<path d="M${ax} ${ay} L${bx} ${by}" style="stroke:${TH};stroke-width:1.4;stroke-dasharray:2.5 2.5;opacity:.6"/>`;
      notes += `<circle cx="${ax}" cy="${ay}" r="1.8" style="fill:#7a3b2a"/><circle cx="${bx}" cy="${by}" r="1.8" style="fill:#7a3b2a"/>`;
      if (k === 2) {
        // agulha curva saindo da pele (entra em ax, sai em bx); as duas pontas do mesmo lado, de comprimento semelhante
        over += halo(`M${ax} ${ay} L${bx} ${by}`, 8);
        over += `<path d="M${bx} ${by} C 232 128 228 136 229 146" style="fill:none;stroke:#7d8a92;stroke-width:2.6;stroke-linecap:round"/>`;
        over += th(`M${ax} ${ay} C 262 140 258 162 252 186`, true) + th(`M${bx} ${by} C 226 140 216 160 206 182`, true);
        notes += lbl(196, 150, 'ponto de ancoragem:', 'end', true) + lbl(196, 162, 'pegada dérmica', 'end', true) + lbl(196, 174, 'paralela ao cateter', 'end', true) + lead(199, 150, 236, 128);
      }
    }
    // nó de ancoragem e pontas longas (etapa 3)
    if (k >= 3) {
      over += `<path d="M${FX.bite[0][0]} ${FX.bite[0][1]} L${FX.bite[1][0]} ${FX.bite[1][1]}" style="stroke:${TH};stroke-width:2"/>`;
      over += knot(kx, ky, k === 3);
      if (k === 3) {
        over += th(`M${kx} ${ky} C 236 140 220 158 208 180`, true) + th(`M${kx} ${ky} C 246 148 240 170 234 192`, true);
        notes += lbl(270, 152, 'nó de ancoragem', 'start', true) + lead(268, 148, 252, 129) + lbl(104, 196, 'pontas longas, iguais, do mesmo lado', 'start', true);
      }
    }
    // cruzamentos: por baixo (coberto pelo cateter) → por cima (X) → nó
    const nc = k >= 6 ? 3 : k >= 5 ? 2 : k >= 4 ? 1 : 0;
    let fromTop = [kx, ky], fromBot = [kx, ky];
    for (let i = 0; i < nc; i++) {
      const x = FX.cross[i], cur = k === 4 + i;
      const Tp = [x + H, T], Bp = [x + H, B];
      // a ponta que está embaixo passa por baixo para o lado de cima (e vice-versa)
      under += thUnder(`M${fromBot[0]} ${fromBot[1]} L${Tp[0]} ${Tp[1]}`, cur);
      if (i === 0) under += th(`M${kx} ${ky} L${Bp[0]} ${Bp[1]}`, cur, 2); // 1º: a outra ponta segue rente à pele, do mesmo lado
      else under += thUnder(`M${fromTop[0]} ${fromTop[1]} L${Bp[0]} ${Bp[1]}`, cur);
      over += th(`M${Tp[0]} ${Tp[1]} L${x - H} ${B}`, cur) + th(`M${Bp[0]} ${Bp[1]} L${x - H} ${T}`, cur);
      over += knot(x, 112, cur, i === 2);
      fromTop = [x - H, T]; fromBot = [x - H, B];
      if (cur) {
        const t = ['1º cruzamento', '2º cruzamento', '3º cruzamento + nó final'][i];
        notes += lbl(x + 4, 76, t, 'middle', true) + lead(x, 80, x, 101);
        notes += lbl(x + 4, 160, 'por baixo → por cima → nó', 'middle', true);
      }
    }
    // pontas livres (etapa 6) ou cortadas (7+)
    if (k === 6) over += th(`M${fromTop[0]} ${fromTop[1]} C 150 92 130 150 120 186`, true) + th(`M${fromBot[0]} ${fromBot[1]} C 152 140 146 170 140 194`, true);
    if (k >= 7) {
      over += th(`M${fromTop[0]} ${fromTop[1]} L${fromTop[0] - 7} ${fromTop[1] - 10}`, k === 7) + th(`M${fromBot[0]} ${fromBot[1]} L${fromBot[0] - 7} ${fromBot[1] + 10}`, k === 7);
      if (k === 7) {
        // tesoura (pontas de 0,5–1 cm) e conferência
        notes += `<g transform="translate(128 150) rotate(-35)" style="fill:none;stroke:#4a565c;stroke-width:1.8;stroke-linecap:round"><circle cx="-12" cy="-5" r="4.5"/><circle cx="-12" cy="5" r="4.5"/><path d="M-8 -3 L 14 4 M-8 3 L 14 -4"/></g>`;
        notes += lbl(150, 168, 'pontas de 0,5–1 cm', 'start', true) + lbl(150, 180, 'marca em cm · refluxo · lavagem', 'start', true);
      }
    }
    // asas do canhão (etapa 8)
    if (k >= 8) FX.holes.forEach(([hx, hy], i) => {
      const [sx, sy] = FX.wingSkin[i], cur = k === 8;
      over += th(`M${hx} ${hy} L${sx} ${sy}`, cur, 2.2) + knot(hx, hy + (i ? 6 : -6), cur);
      notes += `<circle cx="${sx}" cy="${sy}" r="1.8" style="fill:#7a3b2a"/>`;
      if (cur && !i) notes += lbl(102, 44, 'pontos nas asas', 'start', true) + lead(100, 42, 86, 54);
    });
    // marca em cm junto à saída (referência de migração; destacada no preparo e na conferência)
    const mcur = k === 1 || k === 7;
    marks += (mcur ? `<rect x="234" y="104" width="26" height="16" rx="3" style="fill:#e2b65a;opacity:.5"/>` : '') +
      [238, 246, 254].map((x, i) => `<path d="M${x} ${i === 1 ? 106 : 108} L${x} 116" style="stroke:#3d4a50;stroke-width:${i === 1 ? 1.3 : 0.9}"/>`).join('') +
      `<text x="246" y="101" text-anchor="middle" class="fx-cm">15</text>`;
    if (k === 1) {
      // porta-agulha com a agulha curva presa no terço posterior; fio inteiro
      notes += halo('M286 52 L 330 30', 10) + `<g style="fill:none;stroke:#59656c;stroke-width:2.6;stroke-linecap:round"><path d="M290 50 L 334 28 M290 56 L 336 36"/><circle cx="340" cy="26" r="5"/><circle cx="342" cy="38" r="5"/></g>`;
      notes += `<path d="M282 60 A 12 12 0 0 1 292 44" style="fill:none;stroke:#7d8a92;stroke-width:2.4"/>` + th('M282 60 C 270 80 300 84 318 74', true, 1.8);
      notes += lbl(280, 30, 'porta-agulha', 'end', true) + lbl(280, 42, 'e fio inteiro', 'end', true) + lbl(198, 140, 'marca em cm', 'start', true) + lead(212, 132, 240, 118);
    }

    // cateter (semitransparente: o fio que passa por baixo aparece apagado), canhão, asas, extensões
    const hub = `<g>
      <path d="M8 92 L 50 100 M8 120 L 50 108" style="stroke:#9aa7ae;stroke-width:4;stroke-linecap:round"/>
      <rect x="18" y="86" width="9" height="12" rx="2" style="fill:#5d8fbf"/><rect x="18" y="114" width="9" height="12" rx="2" style="fill:#d9a23f"/>
      <rect x="68" y="${k >= 8 ? 64 : 64}" width="26" height="84" rx="9" style="fill:#e3e9ed;stroke:#8c9aa3;stroke-width:1.3"/>
      ${FX.holes.map(([hx, hy]) => `<circle cx="${hx}" cy="${hy}" r="4.3" style="fill:#f0d6c3;stroke:#8c9aa3;stroke-width:1.1"/>`).join('')}
      <path d="M48 95 L 100 97 L 110 101 L 110 107 L 100 111 L 48 113 Z" style="fill:#eef2f4;stroke:#8c9aa3;stroke-width:1.3"/>
    </g>`;
    const cathSvg = `<path d="${cath}" style="fill:none;stroke:#8c9aa3;stroke-width:11.5;stroke-linecap:round;opacity:.95"/><path d="${cath}" style="fill:none;stroke:#f3f6f8;stroke-width:9;stroke-linecap:round;opacity:.82"/>`;
    s += under + hub + cathSvg + marks + over + notes;
    s += `<circle cx="${ex}" cy="${ey}" r="6.5" style="fill:none;stroke:#8a4a3a;stroke-width:1.6"/>`;
    s += lbl(266, 91, 'saída', 'middle') + lbl(356, 104, 'trajeto subcutâneo →', 'end') + lbl(30, 194, 'canhão e asas', 'start') + lead(50, 186, 70, 150);
    // curativo (etapa 9): esponja/gel de clorexidina no sítio (se padronizado) e filme transparente
    if (k >= 9) {
      s += `<circle cx="${ex}" cy="${ey}" r="15" style="fill:rgba(150,120,205,.28);stroke:#8e6cc0;stroke-width:1.2"/>`;
      s += halo('M30 38 H 306 V 188 H 30 Z', 8) + `<rect x="30" y="38" width="276" height="150" rx="14" style="fill:rgba(205,228,244,.42);stroke:#7fa7c2;stroke-width:1.6"/>`;
      s += `<rect x="236" y="42" width="66" height="17" rx="3" style="fill:#fffef6;stroke:#7fa7c2"/>` + lbl(269, 54, 'data · inic.', 'middle');
      s += lbl(112, 206, 'curativo transparente sobre saída, bailarina e asas', 'start', true) + lbl(316, 92, 'CHG*', 'start');
    }
    const title = o.title === false ? '' : `<text x="12" y="20" class="fx-t">${k}. ${esc(fixShort(k))}</text>`;
    return `<svg viewBox="0 0 360 210" role="img" aria-labelledby="${id}-t" class="fx-svg"><title id="${id}-t">Esquema da fixação em bailarina, vista de cima, etapa ${k}: ${esc(fixShort(k))}</title>${s}${title}</svg>`;
  }

  function fixStepHTML(k, o = {}) {
    const st = fixStepData(k); if (!st) return '';
    const cau = arr(st.cautions);
    return `<div class="fx-step" data-k="${k}">
      <figure class="fx-fig">${fixSVG(k, { id: (o.id || 'fxi') + k, title: false })}${k === 9 ? '<figcaption>*CHG: esponja ou gel com clorexidina, se padronizado no serviço.</figcaption>' : ''}</figure>
      <div class="fx-txt">
        <p class="fx-k">${k ? `Etapa ${k} de ${FIX_MAX}` : 'Antes da fixação'}</p>
        <h4>${rich(st.title)}</h4>
        ${st.text ? `<p>${rich(st.text)}</p>` : ''}
        ${st.movement ? `<div class="fx-move"><h5>Movimento</h5><p>${rich(st.movement)}</p></div>` : ''}
        ${cau.length ? `<div class="fx-caut"><h5>Cuidados</h5><ul>${cau.map((c) => `<li>${rich(c)}</li>`).join('')}</ul></div>` : ''}
        ${st.why ? `<p class="fx-why"><b>Por quê.</b> ${rich(st.why)}</p>` : ''}
      </div></div>`;
  }
  const fixLists = (F) => [['Material', F.material], ['Erros comuns', F.errors], ['Complicações', F.complications], ['Alternativas à sutura', F.alternatives], ['Cuidados depois', F.afterCare]].filter(([, l]) => arr(l).length);

  /** Inset do capítulo: passo atual sincronizado com o stepper "Fixação" (e com a animação). */
  function fixInsetHTML() {
    const F = D.fixation; if (!F) return '';
    const k = fixCurrentK();
    return `<p class="fx-intro">${rich(F.intro || '')}</p>
      <div class="fx-nav" role="group" aria-label="Etapa da fixação mostrada no texto">
        <button type="button" class="btn small" data-fxk="-1" aria-label="Etapa anterior da fixação">←</button>
        <p class="fx-now" id="fxNow" aria-live="polite"></p>
        <button type="button" class="btn small" data-fxk="1" aria-label="Próxima etapa da fixação">→</button>
      </div>
      <div class="fx-stepbox" id="fixInsetStep" data-k="${k}">${fixStepHTML(k)}</div>
      ${fixLists(F).map(([h, l]) => `<details class="fx-more"><summary>${h}</summary><ul>${arr(l).map((t) => `<li>${rich(t)}</li>`).join('')}</ul></details>`).join('')}
      ${arr(F.sources).length ? `<p class="srcs">Fontes da fixação: ${refLinks(F.sources)}</p>` : ''}`;
  }
  /** Etapa mostrada no texto: a do 3D (fase 6) ou, sem visor 3D, a escolhida no próprio inset. */
  function fixCurrentK() { const E = S.E; return E ? (E.state.phase === 6 ? fixShown() : 0) : (S.fixK || 0); }
  function syncFixInset(force) {
    const box = R.panel && $('#fixInsetStep', R.panel); if (!box) return;
    const k = fixCurrentK();
    const now = $('#fxNow', R.panel);
    if (now) now.textContent = (k ? `Etapa ${k}/${FIX_MAX}: ` : '') + stripTags(fixShort(k));
    $$('[data-fxk]', R.panel).forEach((b) => (b.disabled = +b.dataset.fxk < 0 ? k <= 0 : k >= FIX_MAX));
    if (!force && box.dataset.k === String(k)) return;
    // durante a animação a altura mínima só cresce (o painel não "pula" a cada etapa); parada, volta ao natural
    box.style.minHeight = A.fix ? Math.max(parseFloat(box.style.minHeight) || 0, box.offsetHeight) + 'px' : '';
    box.dataset.k = String(k);
    box.innerHTML = fixStepHTML(k);
  }
  function fixInsetGo(d) {
    const E = S.E, k = clamp(fixCurrentK() + d, 0, FIX_MAX);
    if (!E) { S.fixK = k; syncFixInset(); return; }
    stopAnims('fix'); fixPrepare(); E.state.fixStep = k; S.visKey++; syncControls(); wake();
  }

  /** Seção do material complementar: as 9 etapas completas, listas e fontes. */
  function renderFixSection() {
    if (!R.fixBody) return;
    const F = D.fixation;
    if (!F) { R.fixBody.innerHTML = '<p class="empty">Conteúdo da fixação indisponível neste arquivo.</p>'; return; }
    const ch = D.chapters.find((c) => c.id === 'fixacao');
    R.fixBody.innerHTML = `<p class="lede">${rich(F.intro || '')}${ch ? ` <a href="#cap-${esc(ch.n)}">Ver no 3D (cena ${esc(ch.n)}) →</a>` : ''}</p>
      <ol class="fx-grid">${arr(F.steps).map((st) => `<li class="fx-card"><figure class="fx-fig">${fixSVG(+st.k, { id: 'fxs' + st.k })}</figure>
        <h3><span class="fx-n">${esc(st.k)}</span>${rich(st.title)}</h3><p>${rich(st.text)}</p>
        <details class="fx-more"><summary>Movimento, cuidados e porquê</summary>
          ${st.movement ? `<h5>Movimento</h5><p>${rich(st.movement)}</p>` : ''}
          ${arr(st.cautions).length ? `<h5>Cuidados</h5><ul>${arr(st.cautions).map((c) => `<li>${rich(c)}</li>`).join('')}</ul>` : ''}
          ${st.why ? `<h5>Por quê</h5><p>${rich(st.why)}</p>` : ''}</details></li>`).join('')}</ol>
      <p class="hint">*CHG: esponja ou gel com clorexidina, se padronizado no serviço. Esquemas sem escala, vista de cima; o canhão fica à esquerda (lateral), como na vista anterior do modelo 3D.</p>
      <div class="fx-lists">${fixLists(F).map(([h, l]) => `<section class="fx-box"><h3>${h}</h3><ul>${arr(l).map((t) => `<li>${rich(t)}</li>`).join('')}</ul></section>`).join('')}</div>
      ${arr(F.sources).length ? `<p class="srcs">Fontes: ${refLinks(F.sources)} · <a href="#fontes">bibliografia</a></p>` : ''}`;
  }
  /** Primeiras frases inteiras de um texto até ~max caracteres (resumo da folha impressa; o texto completo fica na
      seção do material complementar). */
  function leadSentences(t, max) {
    const str = String(t || ''); if (stripTags(str).length <= max) return str;
    const parts = str.match(/[^.!?]+[.!?]+(\s|$)/g) || [str];
    let out = '';
    for (const p of parts) { if (out && stripTags(out + p).length > max) break; out += p; }
    return out.trim() + (out.length < str.length ? ' (…)' : '');
  }
  /** Folha A4 extra (impressão pelo botão): as 9 etapas em miniatura, logo após a folha do capítulo da fixação. */
  function fixSheetHTML(title, foot, pageNo) {
    const F = D.fixation; if (!F) return '';
    return `<section class="sheet extra fx-sheet"><div class="sh-top"><span>${esc(title)}</span><span>Fixação em bailarina · passo a passo</span></div>
      <h2>${rich(F.title || 'Fixação em bailarina — passo a passo')}</h2>
      <ol class="fx-mini">${arr(F.steps).map((st) => `<li>${fixSVG(+st.k, { id: 'fxp' + st.k })}<h3>${esc(st.k)}. ${rich(st.title)}</h3><p>${rich(leadSentences(st.text, 280))}</p></li>`).join('')}</ol>
      <p class="sh-refs">Esquemas sem escala, vista de cima (canhão à esquerda). *CHG: esponja ou gel com clorexidina, se padronizado. Movimentos, cuidados e alternativas: seção “Fixação em bailarina” do material complementar.${arr(F.sources).length ? ' Fontes: ' + refNums(F.sources).map((n) => '[' + n + ']').join(' ') + '.' : ''}</p>
      <div class="sh-foot"><span>${esc(foot)}</span><span>${pageNo}</span></div></section>`;
  }

  /* ------------------------------------------------------------------ */
  /* esquemas SVG                                                        */
  /* ------------------------------------------------------------------ */
  /** Dois painéis: frontal (direção) e axial visto pela cabeceira (inclinação). compact = versão do inset. */
  function planesHTML(compact) {
    const id = compact ? 'pi' : 'pf';
    /* Vista anterior (direita do paciente à esquerda). Relações: a v. subclávia cruza a 1ª costela e passa POSTERIOR
       ao terço medial da clavícula (trecho tracejado); o ângulo venoso fica atrás da articulação esternoclavicular e a
       v. braquiocefálica D desce atrás da borda direita do manúbrio até a VCS. Lateralmente à borda externa da 1ª costela
       a veia emerge abaixo da clavícula (v. axilar) — a região de entrada fica abaixo da junção dos terços e a agulha
       passa SOB a clavícula para alcançar a veia. Esquema não calibrado. */
    const vLat = 'M54 192 C 100 178 150 158 196 141 C 214 135 228 132 242 130';
    const vMed = 'M242 130 C 272 127 302 126 336 125 C 358 124 372 123 383 123';
    const vIjv = 'M378 30 C 380 60 382 92 383 123';
    const vBcv = 'M383 123 C 388 150 394 178 398 206 C 400 224 401 240 402 252'; // VBC → VCS (segue para baixo)
    const rib = 'M374 150 C 342 157 300 157 266 149 C 242 143 222 131 208 115';
    const front = `<svg viewBox="0 0 480 300" role="img" aria-labelledby="${id}-ft">
      <title id="${id}-ft">Esquema frontal: clavícula direita, incisura jugular, primeira costela, veia subclávia passando atrás do terço medial da clavícula até o ângulo venoso atrás da articulação esternoclavicular, região de entrada infraclavicular e direção para a referência esternal</title>
      <defs><marker id="${id}-ar" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--teal)"/></marker></defs>
      <text class="dg-title" x="16" y="24">VISTA ANTERIOR</text><text class="dg-sub" x="16" y="41">plano frontal · direção</text>
      <text class="dg-sub" x="466" y="22" text-anchor="end">↑ cranial · ← direita do paciente</text>
      <path d="M50 110 C 40 150 60 230 84 292" style="fill:none;stroke:var(--line-2);stroke-width:1.2;stroke-dasharray:3 4"/>
      <text class="dg-sub" x="66" y="268" transform="rotate(-76 66 268)">sulco deltopeitoral</text>
      <path d="${rib}" style="fill:none;stroke:#c9b68c;stroke-width:12;stroke-linecap:round;opacity:.55"/>
      <path d="${rib}" style="fill:none;stroke:#efe4c8;stroke-width:9;stroke-linecap:round;opacity:.9"/>
      <path d="M208 115 C 198 99 196 82 205 64" style="fill:none;stroke:#bfa676;stroke-width:1.4;stroke-dasharray:4 3"/>
      <g style="fill:none;stroke:#2d5e9c;stroke-linecap:round;opacity:.6"><path d="${vLat}" style="stroke-width:13"/><path d="${vMed}" style="stroke-width:13"/><path d="${vIjv}" style="stroke-width:12"/><path d="${vBcv}" style="stroke-width:14"/></g>
      <path d="M383 108 C 395 101 405 100 412 106 Q 420 115 428 106 C 435 100 445 101 457 108 L 468 210 Q 420 222 372 210 Z" style="fill:#efe4c8;stroke:#c9b68c;stroke-width:1.5"/>
      <path d="M392 114 C 330 124 282 126 232 118 C 182 110 122 98 64 102" style="fill:none;stroke:#c9b68c;stroke-width:25;stroke-linecap:round"/>
      <path d="M392 114 C 330 124 282 126 232 118 C 182 110 122 98 64 102" style="fill:none;stroke:#efe4c8;stroke-width:21;stroke-linecap:round"/>
      <path d="M452 114 C 470 116 480 117 500 118" style="fill:none;stroke:#efe4c8;stroke-width:21"/>
      <circle cx="52" cy="104" r="15" style="fill:#efe4c8;stroke:#c9b68c;stroke-width:1.5"/>
      <g style="fill:none;stroke:#2d5e9c;stroke-linecap:round"><path d="${vMed}" style="stroke-width:13;opacity:.2"/><path d="${vBcv}" style="stroke-width:14;opacity:.2"/><path d="M382 96 L 383 123" style="stroke-width:12;opacity:.2"/>
        <path d="${vMed}" style="stroke-width:1.6;stroke-dasharray:5 4;opacity:.95"/><path d="${vBcv}" style="stroke-width:1.6;stroke-dasharray:5 4;opacity:.95"/><path d="M382 96 L 383 123" style="stroke-width:1.6;stroke-dasharray:5 4;opacity:.95"/></g>
      <circle cx="383" cy="123" r="4" style="fill:var(--surface);stroke:#2d5e9c;stroke-width:1.6"/>
      <line x1="282" y1="104" x2="282" y2="140" style="stroke:var(--gold);stroke-width:2.5"/>
      <ellipse cx="258" cy="168" rx="22" ry="11" style="fill:var(--gold-soft);stroke:var(--gold);stroke-width:2;stroke-dasharray:4 3"/>
      <path d="M266 163 L 408 110" style="stroke:var(--teal);stroke-width:2.6;fill:none" marker-end="url(#${id}-ar)"/>
      <circle cx="420" cy="104" r="5" style="fill:var(--gold);stroke:var(--surface);stroke-width:1.5"/>
      <text class="dg-lbl gold" x="450" y="74" text-anchor="middle">incisura</text><text class="dg-lbl gold" x="450" y="88" text-anchor="middle">jugular</text>
      <text class="dg-lbl" x="140" y="80">clavícula direita</text>
      <text class="dg-lbl gold" x="282" y="62" text-anchor="middle">junção dos terços</text><text class="dg-sub" x="282" y="76" text-anchor="middle">medial / médio</text>
      <path class="dg-lead" d="M282 82 L 282 102"/>
      <text class="dg-lbl blue" x="370" y="46" text-anchor="end">v. jugular interna</text>
      <text class="dg-lbl blue" x="128" y="147">v. axilar</text>
      <text class="dg-lbl blue" x="386" y="246" text-anchor="end">v. braquiocefálica D</text><path class="dg-lead" d="M388 240 L 396 214"/>
      <text class="dg-lbl" x="128" y="214">região de entrada</text><text class="dg-sub" x="128" y="229">(ilustrativa, não coordenada)</text>
      <path class="dg-lead" d="M200 212 L 240 178"/>
      <text class="dg-lbl teal" x="300" y="188">direção: referência</text><text class="dg-lbl teal" x="300" y="203">esternal</text>
      <text class="dg-sub" x="104" y="272">tracejado: v. subclávia atrás do terço medial da clavícula</text><text class="dg-sub" x="104" y="287">bege: 1ª costela, sob a veia (cúpula pleural atrás dela)</text>
    </svg>`;
    /* PLANO AXIAL (vista pela cabeceira), como a cena 3D do cap. 07: direita do paciente à ESQUERDA e, por
       consequência (vista de cima da cabeça, não dos pés), anterior para BAIXO — com a direita à esquerda, "anterior
       para cima" seria a vista pelos pés (convenção da TC). Plano quase axial que contém a agulha (normal ≈ eixo
       cranial, inclinação ~5°). Contornos medidos no modelo 3D v2 por tools/w2fix_ui_axial_probe.js ([x, z] em cm,
       mesma escala nos dois eixos: θ desenhado = θ do modelo). A clavícula fica CRANIAL ao plano: aparece como
       projeção tracejada; idem o arco da artéria subclávia, que sobe atrás do escaleno anterior. */
    const AX = (x) => 30 + (11.8 - x) * 34, AY = (z) => 78 + (z + 5) * 34;
    const pt = (p) => AX(p[0]).toFixed(1) + ' ' + AY(p[1]).toFixed(1);
    const line = (ps) => 'M' + ps.map(pt).join(' L');
    const poly = (a, b) => line(a.concat(b.slice().reverse())) + ' Z';
    const SKIN = [[11.8, 1.9], [11.5, 2.02], [11, 2.22], [10.5, 2.35], [10, 2.44], [9, 2.48], [8, 2.41], [7, 2.3], [6, 2.19], [5, 2.07], [4, 1.95], [3, 1.75], [2, 1.67], [1.5, 1.65], [1, 1.46], [0.5, 0.76], [0, 0.39], [-0.5, 0.72], [-1, 1.44], [-1.45, 1.6]];
    const SKIN_IN = SKIN.map(([x, z]) => [x, z - 0.2]);
    // subcutâneo: da pele ao peitoral maior (x ≥ 3,2); medialmente, lâmina fina sob a pele até a incisura
    const PEC_A = [[11.8, 1.15], [11.5, 1.23], [11, 1.35], [10.5, 1.46], [10, 1.56], [9.5, 1.64], [9, 1.7], [8.5, 1.74], [8, 1.77], [7.5, 1.77], [7, 1.75], [6.5, 1.7], [6, 1.64], [5.5, 1.56], [5, 1.47], [4.5, 1.37], [4, 1.27], [3.5, 1.16], [3.2, 1.08]];
    const PEC_P = [[11.8, 0.85], [11.5, 0.91], [11, 1.04], [10.5, 1.16], [10, 1.26], [9.5, 1.34], [9, 1.4], [8.5, 1.44], [8, 1.47], [7.5, 1.48], [7, 1.47], [6.5, 1.44], [6, 1.38], [5.5, 1.3], [5, 1.21], [4.5, 1.13], [4, 1.04], [3.5, 0.98], [3.2, 1.0]];
    const FASC = [[11.8, 0.55], [11.5, 0.65], [11, 0.83], [10.5, 0.96], [10, 1.02], [9, 1.08], [8, 1.15], [7, 1.21], [6.5, 1.19], [6, 1.14], [5.5, 1.05], [5, 1.0], [4.5, 0.95]];
    const SUBCL_A = [[7.7, 0.72], [7.5, 0.96], [7, 1.07], [6.5, 1.09], [6, 1.03], [5.5, 0.89], [5.3, 0.62]];
    const SUBCL_P = [[7.7, 0.6], [7.5, 0.48], [7, 0.38], [6.5, 0.31], [6, 0.27], [5.5, 0.27], [5.3, 0.45]];
    const VEIN_A = [[9.6, -0.57], [9.5, -0.36], [9, -0.12], [8.5, 0.01], [8, 0.1], [7.5, 0.16], [7, 0.19], [6.5, 0.21], [6, 0.18], [5.5, 0.1], [5, -0.02], [4.5, -0.24], [4, -0.56], [3.5, -0.85], [3.2, -1.1]];
    const VEIN_P = [[9.6, -0.62], [9.5, -0.78], [9, -0.99], [8.5, -1.09], [8, -1.13], [7.5, -1.15], [7, -1.17], [6.5, -1.21], [6, -1.28], [5.5, -1.4], [5, -1.58], [4.5, -1.85], [4, -2.15], [3.5, -2.25], [3.2, -2.3]];
    const ART_A = [[9.45, -1.6], [9, -1.34], [8.5, -1.37], [8, -1.52], [7.5, -1.82], [7.25, -1.98]];
    const ART_P = [[9.45, -1.75], [9, -2.05], [8.5, -2.2], [8, -2.26], [7.5, -2.18], [7.25, -2.08]];
    const ARCH = [[7.25, -2.03], [6.6, -2.3], [5.9, -2.6], [5.0, -2.8], [4.1, -3.15], [3.1, -3.5], [2.85, -3.5]];
    const PLEURA = [[7.45, -6.2], [7.2, -5.5], [7.0, -5.03], [6.5, -4.25], [6.0, -3.72], [5.5, -2.89], [5.0, -2.31], [4.5, -2.2], [4.0, -2.48], [3.5, -3.24], [3.0, -4.11], [2.5, -4.16], [2.0, -3.92], [1.5, -3.7], [1.15, -3.85], [1.0, -4.6], [0.95, -6.2]];
    const CLAV = [[11.0, -0.2], [10.2, 0.25], [9.3, 0.62], [8.2, 0.82], [7.2, 0.88], [6.2, 0.8], [5.2, 0.62], [4.3, 0.36], [3.4, 0.05], [2.55, -0.42]];
    const CLAV_D = CLAV.map(([x, z]) => [x, z - 0.72]), CLAV_A = CLAV.map(([x, z]) => [x, z + 0.72]);
    const nE = [10.0, 2.44], nT = [5.0, -0.75], pDome = [4.5, -2.2];
    const ex = AX(nE[0]), ey = AY(nE[1]), tx = AX(nT[0]), ty = AY(nT[1]);
    const dl = Math.hypot(tx - ex, ty - ey), ux = (tx - ex) / dl, uy = (ty - ey) / dl;
    const th = Math.atan2(-(ty - ey), tx - ex); // ângulo com a linha coronal (horizontal) — mesmo do modelo
    const ar = 58, f1 = (v) => v.toFixed(1);
    const out = (k) => f1(ex - ux * k) + ' ' + f1(ey - uy * k);
    const sag = `<svg viewBox="0 0 480 392" role="img" aria-labelledby="${id}-st">
      <title id="${id}-st">Esquema em plano axial que contém a agulha, visto pela cabeceira, com a direita do paciente à esquerda e a face anterior embaixo: pele, subcutâneo, peitoral maior, fáscia clavipeitoral e músculo subclávio; clavícula projetada acima do plano; veia axilar e subclávia sobre a primeira costela; escaleno anterior e artéria posteriores à veia; cúpula pleural e pulmão posteromediais; agulha de lateral e anterior para medial e posterior, com o ângulo θ medido contra o plano coronal</title>
      <defs><marker id="${id}-ar2" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--danger)"/></marker>
      <pattern id="${id}-fib" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(8)"><path d="M0 4 H8" style="stroke:#8e3a33;stroke-width:1;opacity:.45"/></pattern>
      <clipPath id="${id}-cl"><rect x="0" y="54" width="480" height="338"/></clipPath></defs>
      <text class="dg-title" x="16" y="24">PLANO AXIAL</text><text class="dg-sub" x="16" y="41">vista pela cabeceira · inclinação</text>
      <text class="dg-sub" x="466" y="22" text-anchor="end">← direita do paciente</text><text class="dg-sub" x="466" y="38" text-anchor="end">↓ anterior (pele)</text>
      <g clip-path="url(#${id}-cl)">
        <path d="${line(SKIN)} L ${AX(-1.45)} 40 L ${AX(11.8)} 40 Z" class="dg-body"/>
        <path d="${line(PLEURA)} Z" style="fill:#e8b8b8;opacity:.6"/>
        <path d="${line(PLEURA)}" style="fill:none;stroke:#5fa3b6;stroke-width:2.4"/>
        <path d="${poly(SKIN_IN, PEC_A.concat(SKIN.filter((p) => p[0] < 3.2).map(([x, z]) => [x, z - 0.62])))}" style="fill:#f1dc9e"/>
        <path d="${poly(SKIN, SKIN_IN)}" style="fill:#d6a07f"/>
        <path d="${poly(PEC_A, PEC_P)}" style="fill:#b5574d"/><path d="${poly(PEC_A, PEC_P)}" style="fill:url(#${id}-fib)"/>
        <path d="${line(FASC)}" style="fill:none;stroke:#7f9aa6;stroke-width:1.6;stroke-dasharray:5 3"/>
        <path d="${poly(SUBCL_A, SUBCL_P)}" style="fill:#a34a41"/>
        <path d="${line(ARCH)}" style="fill:none;stroke:#c0392f;stroke-width:9;stroke-linecap:round;opacity:.16"/>
        <path d="${line(ARCH)}" style="fill:none;stroke:#c0392f;stroke-width:1.5;stroke-dasharray:5 4"/>
        <ellipse cx="${f1(AX(6.05))}" cy="${f1(AY(-2.25))}" rx="29" ry="14" transform="rotate(-46 ${f1(AX(6.05))} ${f1(AY(-2.25))})" style="fill:#efe4c8;stroke:#bfa676;stroke-width:2.4"/>
        <ellipse cx="${f1(AX(5.25))}" cy="${f1(AY(-1.8))}" rx="10.5" ry="8.5" style="fill:#a34a41"/>
        <path d="${poly(ART_A, ART_P)}" style="fill:#c0392f"/>
        <circle cx="${f1(AX(2.85))}" cy="${f1(AY(-3.5))}" r="12" style="fill:#c0392f"/>
        <circle cx="${f1(AX(2.3))}" cy="${f1(AY(-3.33))}" r="15" style="fill:#c0392f"/>
        ${[[8.3, -3.0], [8.9, -2.72], [9.5, -2.88], [9.95, -2.15]].map((p) => `<circle cx="${f1(AX(p[0]))}" cy="${f1(AY(p[1]))}" r="6.5" style="fill:#e9c64f;stroke:#b8962c"/>`).join('')}
        <path d="${poly(VEIN_A, VEIN_P)}" style="fill:#2d5e9c"/>
        <ellipse cx="${f1(AX(3.0))}" cy="${f1(AY(-2.05))}" rx="17" ry="25" style="fill:#2d5e9c"/>
        <circle cx="${f1(AX(0.25))}" cy="${f1(AY(-2.85))}" r="29" style="fill:#d9e2e4;stroke:#9fb0b5;stroke-width:2"/><circle cx="${f1(AX(0.25))}" cy="${f1(AY(-2.85))}" r="19" style="fill:#2a3a3f;opacity:.75"/>
        <path d="${poly(CLAV_D, CLAV_A)}" style="fill:#efe4c8;opacity:.22;stroke:#a88c55;stroke-width:1.6;stroke-dasharray:6 4"/>
      </g>
      <path d="M${f1(ex - 8)} ${f1(ey)} L ${f1(AX(3.4))} ${f1(ey)}" style="stroke:var(--gold-ink);stroke-width:1.4;stroke-dasharray:6 4"/>
      <path d="M${f1(ex)} ${f1(ey)} L ${f1(AX(pDome[0]))} ${f1(AY(pDome[1]))}" style="fill:none;stroke:var(--danger);stroke-width:1.8;stroke-dasharray:4 4" marker-end="url(#${id}-ar2)"/>
      <path d="M${out(64)} L ${out(40)}" style="stroke:#59656c;stroke-width:6;stroke-linecap:round"/>
      <path d="M${out(40)} L ${f1(tx)} ${f1(ty)}" style="stroke:#9aa7ae;stroke-width:2.6;stroke-linecap:round"/>
      <circle cx="${f1(tx)}" cy="${f1(ty)}" r="3.6" style="fill:var(--gold);stroke:#fff;stroke-width:1"/>
      <path d="M${f1(ex + ar)} ${f1(ey)} A ${ar} ${ar} 0 0 0 ${f1(ex + ar * Math.cos(th))} ${f1(ey - ar * Math.sin(th))}" style="fill:none;stroke:var(--gold);stroke-width:2.4"/>
      <text x="${f1(ex + ar + 6)}" y="${f1(ey - 9)}" style="font:700 14px var(--serif);fill:var(--gold-ink)">θ</text>
      <text class="dg-sub" x="${f1(AX(3.4) + 4)}" y="${f1(ey + 4)}">plano coronal</text>
      <text class="dg-lbl" x="14" y="378">agulha</text>
      <text class="dg-lbl" x="116" y="356">pele</text><path class="dg-lead" d="M126 346 L 128 ${f1(AY(2.47) + 1)}"/>
      <text class="dg-lbl" x="160" y="356">subcutâneo</text><path class="dg-lead" d="M184 346 L 184 ${f1(AY(2.06))}"/>
      <text class="dg-lbl" x="246" y="356">peitoral maior</text><path class="dg-lead" d="M268 346 L 268 ${f1(AY(1.32))}"/>
      <text class="dg-lbl" x="132" y="378">fáscia clavipeitoral</text><path class="dg-lead" d="M150 368 C 150 340 146 ${f1(AY(1.12) + 12)} 146 ${f1(AY(1.12))}"/>
      <text class="dg-lbl" x="266" y="378">m. subclávio</text><path class="dg-lead" d="M282 368 C 270 330 236 ${f1(AY(0.7) + 18)} 222 ${f1(AY(0.7))}"/>
      <text class="dg-lbl" x="352" y="226">clavícula</text><text class="dg-sub" x="352" y="239">(cranial ao plano)</text><path class="dg-lead" d="M350 223 L 336 ${f1(AY(-0.3))}"/>
      <text class="dg-lbl" x="${f1(AX(0))}" y="300" text-anchor="middle">incisura</text><text class="dg-lbl" x="${f1(AX(0))}" y="313" text-anchor="middle">jugular</text>
      <text class="dg-lbl" x="${f1(AX(8.3))}" y="${f1(AY(-0.5) + 4)}" text-anchor="middle" style="fill:#fff">v. axilar</text>
      <text class="dg-lbl" x="${f1(AX(4.1))}" y="${f1(AY(-1.25) + 4)}" text-anchor="middle" style="fill:#fff">v. subclávia</text>
      <text class="dg-lbl blue" x="352" y="199">ângulo venoso</text><path class="dg-lead" d="M350 195 L 343 188"/>
      <text class="dg-lbl" x="14" y="120">plexo braquial</text><path class="dg-lead" d="M92 123 L ${f1(AX(9.5) - 5)} ${f1(AY(-2.88) - 4)}"/>
      <text class="dg-lbl red" x="14" y="${f1(AY(-1.0))}">a. axilar</text><path class="dg-lead" d="M66 ${f1(AY(-1.0) - 4)} L ${f1(AX(9.1))} ${f1(AY(-1.7))}"/>
      <text class="dg-lbl" x="112" y="92">1ª costela</text><path class="dg-lead" d="M150 96 L ${f1(AX(6.3))} ${f1(AY(-2.55))}"/>
      <text class="dg-lbl" x="112" y="70">escaleno ant.</text><path class="dg-lead" d="M186 67 C 230 80 248 140 ${f1(AX(5.25))} ${f1(AY(-1.8) - 8)}"/>
      <text class="dg-lbl" x="318" y="124" text-anchor="end" style="fill:#2f6f80">cúpula pleural</text><path class="dg-lead" d="M290 127 L ${f1(AX(4.5))} ${f1(AY(-2.2) - 2)}"/>
      <text x="250" y="96" style="font:600 11px var(--sans);fill:#7c3c44">pulmão</text>
      <text class="dg-lbl red" x="352" y="90">a. subclávia</text><text class="dg-sub" x="352" y="103">(arco acima do plano)</text><path class="dg-lead" d="M352 107 L ${f1(AX(2.85) + 6)} ${f1(AY(-3.5) - 9)}"/>
      <text class="dg-lbl" x="${f1(AX(0.25))}" y="114" text-anchor="middle">traqueia</text>
      <text class="dg-lbl red" x="352" y="355" style="font-size:10.5px">θ maior: a ponta vai</text><text class="dg-lbl red" x="352" y="368" style="font-size:10.5px">à cúpula pleural</text>
    </svg>`;
    return `<div class="planes">
      <figure class="plane-fig"><div class="dg-scroll">${front}</div><p class="dg-swipe" aria-hidden="true">← deslize para ver o esquema inteiro →</p><figcaption><strong>Direção.</strong> No plano frontal, a agulha é orientada da região infraclavicular em direção à referência esternal (incisura). A veia subclávia (tracejada) corre atrás do terço medial da clavícula até o ângulo venoso, atrás da articulação esternoclavicular: a agulha passa sob o osso para alcançá-la. A seta indica direção, não profundidade nem posição da ponta.</figcaption></figure>
      <figure class="plane-fig"><div class="dg-scroll">${sag}</div><p class="dg-swipe" aria-hidden="true">← deslize para ver o esquema inteiro →</p><figcaption><strong>Inclinação.</strong> No plano axial, θ é o ângulo com o plano coronal (tracejado dourado). A agulha vai de lateral e anterior para medial e posterior: pele, subcutâneo, peitoral maior, fáscia clavipeitoral e subclávio, caudal à clavícula (projetada, tracejada), até a veia, que repousa sobre a 1ª costela; escaleno anterior e artéria ficam posteriores, e a cúpula pleural, logo atrás da veia, medialmente. Mesma orientação da cena 3D ${capRef('planos')} (vista pela cabeceira). Ângulos publicados dependem do plano e do marco de referência.</figcaption></figure>
    </div>`;
  }

  /** Esquema de ultrassom (janela infraclavicular, eixo curto da veia axilar). */
  /* Geometria (viewBox 520×380; cranial à esquerda, profundidade para baixo): veia axilar oval logo abaixo da fáscia
     do peitoral menor (cy 238); artéria axilar redonda CRANIAL e MAIS PROFUNDA (cy 278), com fascículos ao redor;
     costela com sombra acústica e linha pleural (y ≈ 334) abaixo dos vasos. Os selos numerados ficam ao lado das
     estruturas (não sobre elas). */
  const USG = { vein: [300, 238, 42, 22], art: [194, 278, 20], pleuraY: 334 };
  const USG_SLOTS = {
    skin: [474, 40], subcut: [474, 56], pecMajor: [474, 110], pecMinor: [474, 176], artery: [194, 240], vein: [362, 236], needle: [336, 212],
    plexus: [124, 260], pleura: [474, 316], rib: [72, 300], shadow: [84, 352], lung: [474, 356],
  };
  function usgSlot(key, text) {
    const s = norm(key + ' ' + text);
    if (/agulha|needle/.test(s)) return 'needle';
    if (/arter/.test(s)) return 'artery';
    if (/vei|vein/.test(s)) return 'vein';
    if (/pleur/.test(s)) return 'pleura';
    if (/costel|rib/.test(s)) return 'rib';
    if (/sombra|shadow|clav/.test(s)) return 'shadow';
    if (/menor|minor/.test(s)) return 'pecMinor';
    if (/peit|pec/.test(s)) return 'pecMajor';
    if (/plex|nerv|cord/.test(s)) return 'plexus';
    if (/subcut|gordur|fat/.test(s)) return 'subcut';
    if (/pele|skin/.test(s)) return 'skin';
    if (/pulm|lung|linha a|a-line|artefato/.test(s)) return 'lung';
    return null;
  }
  function usgLabels() {
    const L = arr(D.usg.labels).length ? D.usg.labels : [
      { key: 'skin', text: 'Pele' }, { key: 'subcut', text: 'Subcutâneo' }, { key: 'pecMajor', text: 'Peitoral maior' }, { key: 'pecMinor', text: 'Peitoral menor' },
      { key: 'artery', text: 'Artéria axilar' }, { key: 'vein', text: 'Veia axilar' }, { key: 'plexus', text: 'Fascículos do plexo braquial' },
      { key: 'pleura', text: 'Linha pleural' }, { key: 'rib', text: 'Costela' }, { key: 'shadow', text: 'Sombra acústica' }];
    const used = new Set(); let n = 0;
    return L.map((l) => {
      const o = typeof l === 'string' ? { key: l, text: l } : l;
      let slot = usgSlot(o.key || '', o.text || '');
      if (slot && used.has(slot)) slot = null;
      if (slot) used.add(slot);
      return { text: o.text || o.key, slot, n: slot ? ++n : null };
    });
  }
  function usgSVG(prefix) {
    const id = 'us' + prefix;
    const labels = usgLabels();
    const badges = labels.filter((l) => l.slot).map((l) => { const [x, y] = USG_SLOTS[l.slot]; return `<g><circle class="usg-badge" cx="${x}" cy="${y}" r="12"/><text class="usg-num" x="${x}" y="${y + 5.2}" text-anchor="middle">${l.n}</text></g>`; }).join('');
    let striae = '';
    for (let i = 0; i < 16; i++) { const y = 74 + i * 5 + (i % 3); striae += `<path d="M20 ${y} Q 180 ${y - 5} 340 ${y + 3} T 500 ${y - 2}" style="stroke:#8a8a8a;stroke-width:${i % 2 ? 1 : 1.6};opacity:.42;fill:none"/>`; }
    for (let i = 0; i < 8; i++) { const y = 158 + i * 5 + (i % 2); striae += `<path d="M20 ${y} Q 200 ${y + 4} 360 ${y - 2} T 500 ${y + 1}" style="stroke:#7d7d7d;stroke-width:1.2;opacity:.4;fill:none"/>`; }
    return `<svg viewBox="0 0 520 380" role="img" aria-labelledby="${id}-t">
      <title id="${id}-t">Esquema de ultrassom infraclavicular em eixo curto: pele, subcutâneo, peitorais maior e menor, veia axilar ovalada logo abaixo do peitoral menor e, cranial e mais profunda, a artéria axilar redonda com os fascículos do plexo ao redor; costela com sombra acústica e linha pleural abaixo dos vasos</title>
      <defs>
        <filter id="${id}-sp" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -2.1 1.25"/></filter>
        <linearGradient id="${id}-deep" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f2f2f"/><stop offset="1" stop-color="#1c1c1c"/></linearGradient>
        <linearGradient id="${id}-sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".92"/><stop offset="1" stop-color="#000" stop-opacity="1"/></linearGradient>
        <radialGradient id="${id}-enh" cx=".5" cy="0" r=".9"><stop offset="0" stop-color="#9a9a9a" stop-opacity=".55"/><stop offset="1" stop-color="#9a9a9a" stop-opacity="0"/></radialGradient>
        <clipPath id="${id}-cl"><rect x="20" y="16" width="480" height="350" rx="4"/></clipPath>
      </defs>
      <rect width="520" height="380" fill="#050607"/>
      <g clip-path="url(#${id}-cl)">
        <rect x="20" y="16" width="480" height="350" fill="url(#${id}-deep)"/>
        <rect x="20" y="16" width="480" height="8" fill="#cfcfcf"/>
        <rect x="20" y="24" width="480" height="44" fill="#3a3a3a"/>
        <ellipse cx="90" cy="46" rx="26" ry="9" fill="#262626"/><ellipse cx="230" cy="40" rx="34" ry="8" fill="#282828"/><ellipse cx="380" cy="50" rx="30" ry="9" fill="#262626"/>
        <path d="M20 58 Q 160 50 300 60 T 500 54" style="stroke:#777;stroke-width:1.4;fill:none;opacity:.7"/>
        <rect x="20" y="68" width="480" height="82" fill="#4a4a4a"/>
        <rect x="20" y="153" width="480" height="45" fill="#434343"/>
        ${striae}
        <path d="M20 151 Q 200 146 340 153 T 500 149" style="stroke:#b5b5b5;stroke-width:2.6;fill:none"/>
        <path d="M20 199 Q 180 204 330 197 T 500 201" style="stroke:#a5a5a5;stroke-width:2.2;fill:none"/>
        <ellipse cx="${USG.vein[0]}" cy="${USG.vein[1] + 50}" rx="40" ry="30" fill="url(#${id}-enh)" style="opacity:.5"/>
        <ellipse cx="${USG.art[0]}" cy="${USG.art[1] + 34}" rx="22" ry="16" fill="url(#${id}-enh)" style="opacity:.4"/>
        <path d="M36 330 Q 74 312 128 322" style="stroke:#e8e8e8;stroke-width:5;fill:none;stroke-linecap:round"/>
        <path d="M36 330 Q 74 312 128 322 L 128 366 L 36 366 Z" fill="url(#${id}-sh)"/>
        <path d="M128 ${USG.pleuraY} Q 260 ${USG.pleuraY + 6} 360 ${USG.pleuraY + 2} T 500 ${USG.pleuraY}" class="usg-pleura" style="stroke:#e6e6e6;stroke-width:3.2;fill:none;stroke-dasharray:9 3"/>
        <path d="M136 360 Q 270 364 360 361 T 500 360" style="stroke:#9a9a9a;stroke-width:1.6;fill:none;opacity:.4"/>
        <rect x="20" y="16" width="480" height="350" filter="url(#${id}-sp)" style="opacity:.38;mix-blend-mode:overlay"/>
        <g class="usg-art"><circle cx="${USG.art[0]}" cy="${USG.art[1]}" r="${USG.art[2]}" fill="#050505" stroke="#c8c8c8" stroke-width="3.2"/></g>
        <g class="usg-vein"><ellipse cx="${USG.vein[0]}" cy="${USG.vein[1]}" rx="${USG.vein[2]}" ry="${USG.vein[3]}" fill="#040404" stroke="#8d8d8d" stroke-width="1.6"/></g>
        ${labels.some((l) => l.slot === 'needle') ? '<circle cx="300" cy="221" r="4.2" fill="#f4f4f4"/><g style="stroke:#d0d0d0;stroke-linecap:round">' + [229, 236, 242, 247].map((y, k) => `<path d="M${296 + k} ${y} h ${8 - 2 * k}" style="opacity:${(0.8 - k * 0.18).toFixed(2)};stroke-width:2"/>`).join('') + '</g>' : ''}
        <circle cx="156" cy="262" r="7.5" fill="#1a1a1a" stroke="#bdbdbd" stroke-width="2"/><circle cx="196" cy="312" r="7" fill="#1a1a1a" stroke="#bdbdbd" stroke-width="2"/><circle cx="234" cy="292" r="7" fill="#1a1a1a" stroke="#bdbdbd" stroke-width="2"/>
      </g>
      <g style="stroke:#7d8b87;stroke-width:1.2">${[56, 106, 156, 206, 256, 306, 356].map((y) => `<path d="M504 ${y} h 8"/>`).join('')}</g>
      <circle cx="30" cy="9" r="4" fill="#4dbf9f"/>
      <text class="usg-txt" x="40" y="12" style="font-size:10px">cranial</text><text class="usg-txt" x="496" y="12" text-anchor="end" style="font-size:10px">caudal</text>
      ${badges}
    </svg>`;
  }

  /* ------------------------------------------------------------------ */
  /* seções do material complementar                                     */
  /* ------------------------------------------------------------------ */
  const PRANCHA_POS = {
    index: { x: 1018, y: 600, bx: 1150, by: 470 },
    thumb: { x: 648, y: 724, bx: 455, by: 772 },
    clavicle: { x: 470, y: 676, bx: 330, by: 575 },
    entry: { x: 586, y: 782, bx: 520, by: 918 },
    junction: { x: 819, y: 647, bx: 846, by: 560 },
  };
  function pranchaSlot(a, i) {
    const s = norm(a.text);
    if (/indicador|index/.test(s)) return 'index';
    if (/polegar|thumb/.test(s)) return 'thumb';
    if (/clavic/.test(s)) return 'clavicle';
    if (/entrada|entry|puncao|insercao/.test(s)) return 'entry';
    return ['index', 'thumb', 'clavicle', 'entry'][i] || null;
  }
  function renderPrancha() {
    const P = D.prancha, ann = arr(P.annotations).map((a, i) => (typeof a === 'string' ? { n: i + 1, text: a } : a));
    const hasImg = !!window.PRANCHA_JPG;
    if (P.title) $('#h-prancha').innerHTML = rich(P.title);
    const used = new Set();
    const marks = ann.map((a, i) => { let s = pranchaSlot(a, i); if (used.has(s)) s = null; if (s) used.add(s); return { n: a.n || i + 1, text: a.text, slot: s }; });
    let svg = '', pins = '';
    // selos numerados em HTML (tamanho fixo em px, legíveis no celular); no SVG ficam só traçados e linhas-guia
    const badge = (x, y, n, gold) => { pins += `<span class="pr-badge${gold ? ' gold' : ''}" style="left:${((x / 1535) * 100).toFixed(2)}%;top:${((y / 1024) * 100).toFixed(2)}%">${esc(n)}</span>`; return ''; };
    const lead = (x1, y1, x2, y2) => `<path d="M${x1} ${y1} L ${x2} ${y2}" style="stroke:#fff;stroke-width:6;opacity:.85"/><path d="M${x1} ${y1} L ${x2} ${y2}" style="stroke:#176d66;stroke-width:2.6"/>`;
    for (const m of marks) {
      if (!m.slot) continue;
      const p = PRANCHA_POS[m.slot];
      if (m.slot === 'clavicle') {
        svg += '<path d="M285 636 C 380 650 470 676 560 676 C 680 676 800 650 900 640 C 980 633 1040 628 1086 626" style="fill:none;stroke:#fff;stroke-width:9;opacity:.55;stroke-linecap:round"/><path d="M285 636 C 380 650 470 676 560 676 C 680 676 800 650 900 640 C 980 633 1040 628 1086 626" style="fill:none;stroke:#c1954c;stroke-width:4.5;stroke-dasharray:16 10;stroke-linecap:round"/>';
        // junção dos terços medial e médio: 1/3 do traçado a partir da extremidade medial (x 1086 → 285), x ≈ 819
        const J = PRANCHA_POS.junction;
        svg += `<path d="M${J.x} ${J.y - 22} L ${J.x} ${J.y + 22}" style="stroke:#fff;stroke-width:10;opacity:.8;stroke-linecap:round"/><path d="M${J.x} ${J.y - 22} L ${J.x} ${J.y + 22}" style="stroke:#87612a;stroke-width:5;stroke-linecap:round"/>` + lead(J.x, J.y - 22, J.bx, J.by);
        badge(J.bx, J.by, 'J', true);
      }
      // direção no plano frontal: da região de entrada até logo cranial à polpa do indicador (referência esternal)
      if (m.slot === 'entry') svg += '<path d="M600 774 L 1028 588" style="stroke:#fff;stroke-width:6;opacity:.6;stroke-dasharray:14 12"/><path d="M600 774 L 1028 588" style="stroke:#176d66;stroke-width:3;stroke-dasharray:14 12"/><ellipse cx="586" cy="782" rx="46" ry="28" style="fill:rgba(193,149,76,.22);stroke:#fff;stroke-width:6;opacity:.7"/><ellipse cx="586" cy="782" rx="46" ry="28" style="fill:none;stroke:#c1954c;stroke-width:3.5;stroke-dasharray:10 7"/>';
      if (m.slot === 'index' || m.slot === 'thumb') svg += `<circle cx="${p.x}" cy="${p.y}" r="22" style="fill:none;stroke:#fff;stroke-width:7;opacity:.8"/><circle cx="${p.x}" cy="${p.y}" r="22" style="fill:none;stroke:#176d66;stroke-width:3.5"/>`;
      svg += lead(p.x, p.y, p.bx, p.by) + badge(p.bx, p.by, m.n, m.slot === 'entry' || m.slot === 'clavicle');
    }
    const fig = hasImg
      ? `<div class="prancha-wrap" id="pranchaWrap"><img src="data:image/jpeg;base64,${window.PRANCHA_JPG}" width="1535" height="1024" alt="Mão esquerda enluvada: indicador apoiado na incisura jugular, polegar em apoio infraclavicular direito e demais dedos flexionados." decoding="async"><svg viewBox="0 0 1535 1024" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${svg}</svg><div class="pr-pins" aria-hidden="true">${pins}</div></div>`
      : '<div class="placeholder">Imagem da prancha indisponível neste arquivo.</div>';
    let legend = marks.map((m) => `<li><span class="badge-n${m.slot === 'entry' || m.slot === 'clavicle' ? ' gold' : ''}">${esc(m.n)}</span><span>${rich(m.text)}</span></li>`).join('');
    if (used.has('clavicle')) legend += '<li><span class="badge-n gold">J</span><span>Junção dos terços medial e médio, estimada na foto a um terço do comprimento da clavícula a partir da extremidade medial. Nesta foto o polegar está mais lateral que no modelo 3D.</span></li>';
    R.pranchaBody.innerHTML = `<div class="prancha-grid"><figure class="prancha-fig">${fig}<figcaption>${rich(P.caption || '')}</figcaption></figure>
      <div class="prancha-side">${hasImg && marks.length ? '<label class="switch"><input type="checkbox" id="pranchaToggle" checked><span class="sw" aria-hidden="true"></span>Mostrar marcações</label>' : ''}
      ${legend ? `<ol class="ann-list">${legend}</ol>` : ''}
      ${used.has('entry') ? '<p class="hint">Linha tracejada verde-petróleo: direção no plano frontal, da região de entrada até logo acima da polpa do indicador (referência esternal). Não representa profundidade.</p>' : ''}
      ${arr(P.notes).length ? `<ul class="prancha-notes">${arr(P.notes).map((t) => `<li>${rich(t)}</li>`).join('')}</ul>` : ''}</div></div>`;
    const tg = $('#pranchaToggle'); if (tg) tg.addEventListener('change', () => $('#pranchaWrap').classList.toggle('off', !tg.checked));
  }

  // ordem importa: "Fáscia peitoral e músculo peitoral maior" é músculo; "tecido fibroso que suspende a veia" é
  // tecido conjuntivo (não a veia); "além da veia" é zona a não atingir (hachura de alerta)
  const TISSUE_COLORS = [[/^pele|derme|epiderm/, '#d6a07f'], [/subcut|gordur|tela sub/, '#f1dc9e'], [/alem da veia|nao atingir/, 'repeating-linear-gradient(135deg, #c0392f 0 5px, #e9b3a9 5px 10px)'], [/musculo|peitoral maior|subclavio/, '#b5574d'], [/fasc/, '#b9cbd2'], [/fibros|ligament|adventic|conjuntiv/, '#d8cba7'], [/veia|venos|parede/, '#2d5e9c'], [/arter/, '#c0392f'], [/pleura/, '#9fd3de'], [/pulm/, '#e0a3a3'], [/costel|clavic|osso|periost/, '#e2d3b1'], [/nerv|plexo/, '#e9c64f']];
  const tissueColor = (t) => { const s = norm(stripTags(t)); for (const [re, c] of TISSUE_COLORS) if (re.test(s)) return c; return '#cfd8d3'; };

  function renderTables() {
    // tecidos atravessados
    R.layersBody.innerHTML = D.layersTable.length
      ? `<ol class="stack">${D.layersTable.map((r, i) => `<li style="--c:${tissueColor(r.tissue)}"><span class="d">${esc(r.depth != null ? r.depth : i + 1)}</span><span class="sw" aria-hidden="true"></span><span class="t"><strong>${rich(r.tissue)}</strong>${r.note ? `<span>${rich(r.note)}</span>` : ''}</span></li>`).join('')}</ol><p class="stack-foot">Ordem do superficial para o profundo no trajeto infraclavicular. Espessuras variam entre pacientes; a figura não representa profundidade.</p>`
      : '<p class="empty">Tabela não disponível.</p>';
    // medidas
    R.measBody.innerHTML = D.measurements.length
      ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Medida</th><th>Valor</th><th>Observação</th><th>Fonte</th></tr></thead><tbody>${D.measurements.map((r) => `<tr><td data-h="Medida" class="topic">${rich(r.label)}</td><td data-h="Valor" class="v">${rich(r.value)}</td><td data-h="Observação" class="note">${rich(r.note || '')}</td><td data-h="Fonte" class="refs">${refLinks(r.source)}</td></tr>`).join('')}</tbody></table></div><p class="stack-foot">Valores de estudos com métodos e populações distintos; não são parâmetros para um paciente.</p>`
      : '<p class="empty">Tabela não disponível.</p>';
    // assimetria
    R.asymBody.innerHTML = D.asymmetry.length
      ? `<div class="tbl-wrap"><table class="tbl tbl-asym"><thead><tr><th>Aspecto</th><th>Lado direito</th><th>Lado esquerdo</th></tr></thead><tbody>${D.asymmetry.map((r) => `<tr><td data-h="Aspecto" class="topic">${rich(r.topic)}</td><td data-h="Lado direito">${rich(r.right)}</td><td data-h="Lado esquerdo">${rich(r.left)}</td></tr>`).join('')}</tbody></table></div>`
      : '<p class="empty">Tabela não disponível.</p>';
    // complicações
    R.compBody.innerHTML = D.complications.length
      ? D.complications.map((c, i) => {
        const g = c.structure ? glossEntry(c.structure) : null;
        return `<article class="comp" data-ci="${i}"><h3>${rich(c.name)}</h3>
          ${g ? `<p class="struct"><i style="--c:${GROUP_COLORS[g.group] || 'var(--teal)'}"></i>${esc(stripTags(g.name))}</p>` : ''}
          <dl>${c.mechanism ? `<dt>Mecanismo</dt><dd>${rich(c.mechanism)}</dd>` : ''}${c.recognition ? `<dt>Reconhecimento</dt><dd>${rich(c.recognition)}</dd>` : ''}${c.prevention ? `<dt>Prevenção</dt><dd>${rich(c.prevention)}</dd>` : ''}${c.incidence ? `<dt>Frequência</dt><dd>${rich(c.incidence)}</dd>` : ''}</dl>
          <div class="comp-foot"><span class="refs">${c.source != null ? 'Fonte ' + refLinks(c.source) : ''}</span>${c.structure ? `<button type="button" class="btn small" data-show="${esc(c.structure)}" data-ci="${i}">Ver no 3D</button>` : ''}</div></article>`;
      }).join('')
      : '<p class="empty">Lista não disponível.</p>';
    R.compBody.addEventListener('click', (e) => {
      const b = e.target.closest('[data-show]'); if (!b) return;
      $$('.comp', R.compBody).forEach((el) => el.classList.toggle('active', el.dataset.ci === b.dataset.ci));
      showStructure(b.dataset.show, b);
    });
    // ultrassom
    const labs = usgLabels();
    R.usgBody.innerHTML = `<figure class="usg-fig"><div class="usg-wrap" id="usgWrap">${usgSVG('main')}</div>
      <div class="usg-tools"><button type="button" class="btn small" id="usgPress" aria-pressed="false">Simular compressão com o transdutor</button><span class="hint">A veia colapsa; a artéria mantém a forma.</span></div>
      <ol class="usg-legend">${labs.map((l) => `<li><span class="badge-n">${l.n || '–'}</span><span>${rich(l.text)}</span></li>`).join('')}</ol>
      <figcaption class="usg-cap">${rich(D.usg.caption || 'Esquema didático da janela infraclavicular em eixo curto. Não representa uma imagem real nem calibra profundidades.')}</figcaption></figure>`;
    const press = $('#usgPress');
    press.addEventListener('click', () => { const on = press.getAttribute('aria-pressed') !== 'true'; press.setAttribute('aria-pressed', String(on)); $('#usgWrap').classList.toggle('press', on); press.textContent = on ? 'Liberar compressão' : 'Simular compressão com o transdutor'; });
    // checklist
    renderChecklist();
  }

  function renderChecklist() {
    const items = D.checklist;
    if (!items.length) { R.checkBody.innerHTML = '<p class="empty">Checklist não disponível.</p>'; return; }
    const done = items.filter((_, i) => S.checks[i]).length;
    R.checkBody.innerHTML = `<div class="check-head"><div class="check-prog" aria-hidden="true"><span style="width:${(done / items.length) * 100}%"></span></div><span class="check-count">${done}/${items.length}</span><button type="button" class="btn small" id="checkReset">Limpar</button></div>
      <ul class="check">${items.map((t, i) => `<li><label><input type="checkbox" data-ck="${i}" ${S.checks[i] ? 'checked' : ''}><span>${rich(t)}</span></label></li>`).join('')}</ul>
      <p class="stack-foot">Marcações ficam só neste navegador. Use como roteiro de observação em simulação supervisionada.</p>`;
  }
  function onCheck(e) {
    const t = e.target;
    if (t.dataset && t.dataset.ck != null) { S.checks[t.dataset.ck] = t.checked; store.set('atlas-checklist', S.checks); const f = R.checkBody.scrollTop; renderChecklist(); R.checkBody.scrollTop = f; const el = $(`[data-ck="${t.dataset.ck}"]`, R.checkBody); if (el) el.focus(); }
  }

  /* glossário */
  const G = { q: '', group: 'Todos', left: false, minor: false, limit: 24 };
  // estruturas centrais para a punção, em ordem de importância: em "Todos" vêm primeiro, qualquer que seja o grupo
  const KEY_IDS = new Set(['scv-R', 'clavicle-R', 'subclavius-R', 'rib-1-R', 'scalene-ant-R', 'sca-R', 'brachial-plexus-R', 'pleura-R', 'lung-R-upper', 'phrenic-R',
    'axillary-v-R', 'ijv-R', 'bcv-R', 'svc', 'pec-major-R', 'clavipectoral-fascia-R', 'costoclavicular-lig-R', 'pec-minor-R', 'manubrium', 'sc-joint-R', 'sternal-angle', 'coracoid-R',
    'operator-hand', 'needle', 'syringe', 'guidewire', 'catheter', 'suture-ballerina', 'suture-anchor', 'suture-wing', 'skin', 'subcutaneous',
    'axillary-a-R', 'cephalic-v-R', 'ejv-R', 'ita-R', 'itv-R', 'vertebral-a-R', 'thyrocervical-R', 'cca-R', 'bct', 'aorta', 'scv-L', 'bcv-L', 'cca-L', 'sca-L', 'azygos',
    'scm-R', 'scalene-mid-R', 'deltoid-R', 'trapezius-R', 'omohyoid-R', 'intercostal-R',
    'vagus-R', 'recurrent-laryngeal-R', 'recurrent-laryngeal-L', 'sympathetic-trunk-R', 'stellate-R', 'thoracic-duct', 'right-lymphatic-duct',
    'lung-R-middle', 'lung-R-lower', 'lung-L-upper', 'lung-L-lower', 'pleura-L', 'trachea', 'bronchus-R', 'bronchus-L', 'esophagus', 'heart', 'pericardium', 'diaphragm', 'thymus',
    'rib-2-R', 'costal-cartilage-1-R', 'acromion-R', 'drape', 'skin-prep', 'needle-holder', 'suture-needle', 'dressing-transparent', 'chg-pad']);
  /** Costelas 3–12 e cartilagens 3–10: fora do trajeto, texto repetitivo — ocultas por padrão (interruptor ou busca). */
  const isMinor = (id) => /^(rib-([3-9]|1[0-2])|costal-cartilage-([3-9]|10))-[RL]$/.test(id);
  function glossList() {
    const order = (g) => { const k = D.glossaryGroups.indexOf(g); return k < 0 ? 99 : k; };
    const usedIds = new Set(D.chapters.map((c) => c.scene && c.scene.highlight).concat(D.complications.map((c) => c.structure)).filter(Boolean));
    const keyOrder = Array.from(KEY_IDS);
    const prio = (id) => { const k = keyOrder.indexOf(id); return k >= 0 ? k : usedIds.has(id) ? 500 : 1000; };
    return Object.entries(D.glossary).map(([id, g]) => Object.assign({ id }, g))
      .sort((a, b) => prio(a.id) - prio(b.id) || order(a.group) - order(b.group) || String(stripTags(a.name)).localeCompare(String(stripTags(b.name)), 'pt-BR', { numeric: true }));
  }
  /** Homólogo esquerdo "redundante": termina em -L, existe o -R correspondente e não é estrutura-chave da assimetria. */
  const isMirror = (id) => /-L$/.test(id) && !KEY_IDS.has(id) && !!D.glossary[id.replace(/-L$/, '-R')];
  function renderGlossary() {
    const all = glossList();
    const q = norm(G.q.trim());
    const base = all.filter((g) => q || ((G.left || !isMirror(g.id)) && (G.minor || !isMinor(g.id))));
    const counts = {}; base.forEach((g) => (counts[g.group] = (counts[g.group] || 0) + 1));
    const groups = D.glossaryGroups.filter((g) => counts[g]).concat(Object.keys(counts).filter((g) => D.glossaryGroups.indexOf(g) < 0));
    if (G.group !== 'Todos' && !counts[G.group]) G.group = 'Todos';
    R.glossFilters.innerHTML = [['Todos', base.length]].concat(groups.map((g) => [g, counts[g]])).map(([g, n]) =>
      `<button type="button" class="chip" data-g="${esc(g)}" aria-pressed="${G.group === g}">${g !== 'Todos' ? `<i style="--c:${GROUP_COLORS[g] || 'var(--teal)'}" aria-hidden="true"></i>` : ''}${esc(g)} <span class="n">${n}</span></button>`).join('');
    const list = base.filter((g) => (G.group === 'Todos' || g.group === G.group) && (!q || norm(stripTags([g.name, g.desc, g.relevance, g.id].join(' '))).indexOf(q) >= 0));
    const shown = list.slice(0, G.limit);
    const reg = window.ATLAS && window.ATLAS.registry;
    const hiddenL = q || G.left ? 0 : all.filter((g) => isMirror(g.id)).length;
    const hiddenM = q || G.minor ? 0 : all.filter((g) => isMinor(g.id) && (G.left || !isMirror(g.id))).length;
    R.glossCount.textContent = (list.length === base.length ? `${base.length} estruturas` : `${list.length} de ${base.length} estruturas`) + (hiddenL ? ` · ${hiddenL} homólogos esquerdos ocultos` : '') + (hiddenM ? ` · ${hiddenM} costelas/cartilagens fora do trajeto ocultas` : '');
    R.glossBody.innerHTML = shown.length ? shown.map((g) => {
      const avail = !!(S.E && reg && reg.has(g.id));
      return `<article class="gl" id="gl-${esc(g.id)}"><p class="gl-g"><i style="--c:${GROUP_COLORS[g.group] || 'var(--teal)'}"></i>${esc(g.group || '')}</p><h3>${rich(g.name)}</h3>${g.desc ? `<p>${rich(g.desc)}</p>` : ''}${g.relevance ? `<p class="rel"><b>Na punção:</b> ${rich(g.relevance)}</p>` : ''}
        <div class="gl-foot"><span class="gl-id">${esc(g.id)}</span>${avail ? `<button type="button" class="btn small" data-show="${esc(g.id)}" aria-label="Ver ${esc(stripTags(g.name))} no modelo 3D">Ver no 3D</button>` : ''}</div></article>`;
    }).join('') : '<p class="empty">Nenhuma estrutura encontrada.</p>';
    const rest = list.length - shown.length;
    R.glossMore.hidden = rest <= 0;
    R.glossMore.textContent = `Mostrar mais ${Math.min(rest, 24)} (${rest} restantes)`;
  }
  function revealGlossary(id) {
    G.q = ''; G.group = 'Todos'; R.glossSearch.value = '';
    if (isMirror(id)) { G.left = true; R.glossLeft.checked = true; }
    if (isMinor(id)) { G.minor = true; R.glossMinor.checked = true; }
    const k = glossList().filter((g) => (G.left || !isMirror(g.id)) && (G.minor || !isMinor(g.id))).findIndex((g) => g.id === id);
    G.limit = Math.max(24, k + 1);
    renderGlossary();
    const el = document.getElementById('gl-' + id); if (!el) return;
    el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  }

  function renderSources() {
    const m = D.meta;
    const intro = [m.basedOn, m.modelNote].filter(Boolean).map((t) => `<p>${rich(t)}</p>`).join('');
    R.sourcesBody.innerHTML = `<div class="sources-intro">${intro}<p>Revisão editorial ${esc(m.reviewDate || '19/11/2026')}. As referências abaixo fundamentam o conteúdo; a geometria foi criada para este atlas.</p></div>
      ${D.sources.length ? `<ol class="src-list">${D.sources.map((s) => `<li id="fonte-${esc(s.n)}"><span class="src-n">[${esc(s.n)}]</span><div><div class="src-t">${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${rich(s.title)}</a>` : rich(s.title)}</div>${s.detail ? `<div class="src-d">${rich(s.detail)}</div>` : ''}</div></li>`).join('')}</ol>` : '<p class="empty">Bibliografia indisponível.</p>'}
      <div class="limits"><h3>Limites do modelo</h3><ul>
        <li>Geometria procedural, sem segmentação de exames de pacientes; proporções de um adulto médio, simplificadas.</li>
        <li>Espessuras de estruturas pequenas (nervos, fáscias, pleura) foram ampliadas para leitura; algumas estruturas foram omitidas.</li>
        <li>Cores convencionais de atlas: veias azuis, artérias vermelhas, nervos amarelos, linfáticos verdes.</li>
        <li>Cada capítulo é uma cena conceitual; a troca de cenas não simula o avanço contínuo da agulha.</li>
        <li>Nenhuma distância, profundidade ou ângulo do modelo deve ser transposta para um paciente. Não houve validação clínica independente.</li>
      </ul></div>`;
  }

  /* ------------------------------------------------------------------ */
  /* inicialização                                                       */
  /* ------------------------------------------------------------------ */
  function refs() {
    const ids = ['docTitle', 'docSubtitle', 'docSeal', 'footMeta', 'footDisclaimer', 'glossLeft', 'glossMore', 'srStatus', 'btnTheme', 'btnPrint', 'btnFull', 'chapList', 'chapBar', 'viewer', 'leaders', 'labels', 'viewBar', 'zoomIn', 'zoomOut', 'sceneReset',
      'gizmo', 'tooltip', 'card', 'cardClose', 'cardGroup', 'cardName', 'cardDesc', 'cardRel', 'cardRelWrap', 'cardFocus', 'cardHl', 'cardGloss', 'notice', 'loader', 'loaderStep', 'loaderBar', 'nogl', 'noglMsg',
      'clipBadge', 'clipBadgeText', 'clipBadgeOff', 'controls', 'layerChips', 'ghostToggle', 'labelsToggle', 'handPlay', 'handRange', 'handOut', 'breathPlay', 'breathRange', 'breathOut',
      'seqPlay', 'phaseNum', 'phaseName', 'stepper', 'wireToggle', 'planesToggle', 'clipToggle', 'clipRange', 'clipOut', 'rollSeg', 'btnSnap', 'painel',
      'pranchaBody', 'planesBody', 'layersBody', 'measBody', 'asymBody', 'compBody', 'usgBody', 'checkBody', 'glossSearch', 'glossFilters', 'glossCount', 'glossBody', 'sourcesBody', 'busy', 'busyText', 'printRoot',
      'orientNote', 'touchShield', 'touchDone', 'tsPill', 'lblKey', 'legendKeys', 'needleOpts', 'fixRow', 'fixPlay', 'fixStepper', 'fixLbl', 'stepperNow', 'glossMinor', 'fixBody'];
    const o = {}; ids.forEach((k) => (o[k] = document.getElementById(k)));
    o.panel = o.painel;
    return o;
  }

  function addFullExit() {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn icon glass'; b.id = 'fullExit'; b.hidden = true;
    b.setAttribute('aria-label', 'Sair da tela cheia'); b.title = 'Sair da tela cheia';
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';
    $('.vp-zoom', R.viewer).appendChild(b);
    b.addEventListener('click', toggleFull);
    R.fullExit = b;
  }

  function syncCtlOpen() { $$('[data-ctl]').forEach((d, i) => { d.open = !mqNarrow.matches || i === 0; }); }

  function init() {
    R = refs();
    addFullExit();
    syncThemeButton();
    buildHeader();
    buildNav();
    buildControls();
    syncCtlOpen();
    if (mqNarrow.addEventListener) mqNarrow.addEventListener('change', syncCtlOpen);
    setupTouchShield();
    renderPrancha();
    R.planesBody.innerHTML = planesHTML(false);
    centerScrollers(R.planesBody);
    renderTables();
    renderFixSection();
    renderGlossary();
    renderSources();
    buildLegend();

    // altura da barra de capítulos → variável CSS (painel fixo e rolagem para âncoras)
    const nav = $('.chapnav');
    const setNavH = () => document.documentElement.style.setProperty('--nav-h', nav.offsetHeight + 'px');
    setNavH(); if (window.ResizeObserver) new ResizeObserver(setNavH).observe(nav);
    // altura real dos controles → --ctl-h: no desktop, visor + controles cabem juntos abaixo da barra fixa
    const setCtlH = () => document.documentElement.style.setProperty('--ctl-h', R.controls.offsetHeight + (R.lblKey.hidden ? 0 : R.lblKey.offsetHeight) + 'px');
    setCtlH(); if (window.ResizeObserver) { const ro = new ResizeObserver(setCtlH); ro.observe(R.controls); ro.observe(R.lblKey); }
    // visor: colisão entre sobreposições e retomada do laço (o canvas é limpo quando muda de tamanho)
    fixOverlays();
    if (window.ResizeObserver) new ResizeObserver(() => { fixOverlays(); wake(); }).observe(R.viewer);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fixOverlays).catch(() => {});
    // qualquer interação reativa a renderização sob demanda (barato: só marca o instante)
    ['click', 'input', 'change', 'keydown'].forEach((t) => document.addEventListener(t, wake, true));

    R.btnTheme.addEventListener('click', () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark'));
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { syncThemeButton(); S.gizmoKey = ''; });
    R.btnPrint.addEventListener('click', () => buildPrint());
    R.btnFull.addEventListener('click', toggleFull);
    document.addEventListener('fullscreenchange', syncFull);
    document.addEventListener('webkitfullscreenchange', syncFull);
    window.addEventListener('afterprint', () => { setSheetPage(false); printNative(false); });
    window.addEventListener('beforeprint', () => printNative(true));
    R.panel.addEventListener('click', onPanelClick);
    R.checkBody.addEventListener('change', onCheck);
    R.checkBody.addEventListener('click', (e) => { if (e.target.id === 'checkReset') { S.checks = {}; store.set('atlas-checklist', S.checks); renderChecklist(); } });
    R.glossFilters.addEventListener('click', (e) => { const b = e.target.closest('[data-g]'); if (!b) return; G.group = b.dataset.g; G.limit = 24; renderGlossary(); });
    let gt = 0; R.glossSearch.addEventListener('input', () => { clearTimeout(gt); gt = setTimeout(() => { G.q = R.glossSearch.value; G.limit = 24; renderGlossary(); }, 120); });
    R.glossLeft.addEventListener('change', () => { G.left = R.glossLeft.checked; G.limit = 24; renderGlossary(); });
    R.glossMinor.addEventListener('change', () => { G.minor = R.glossMinor.checked; G.limit = 24; renderGlossary(); });
    R.glossMore.addEventListener('click', () => { G.limit += 24; renderGlossary(); });
    R.glossBody.addEventListener('click', (e) => { const b = e.target.closest('[data-show]'); if (b) showStructure(b.dataset.show, b); });
    window.addEventListener('hashchange', () => { const k = chapterFromHash(); if (k != null && k !== S.idx) go(k); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!R.card.hidden) { closeCard({ restore: true }); e.preventDefault(); }
        else if (S.pseudoFull) toggleFull();
        return;
      }
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = e.target;
      if (t && t.closest && t.closest('input, textarea, select, [contenteditable="true"], .seg, .stepper, .fixer, .vp-views, canvas')) return;
      if (e.key === 'ArrowRight') { go(S.idx + 1); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { go(S.idx - 1); e.preventDefault(); }
    });

    const k = chapterFromHash();
    S.idx = k != null ? k : 0;
    go(S.idx, { animate: false });

    boot3D().catch((e) => failGL('Erro inesperado no visor 3D (' + ((e && e.message) || e) + ').')).finally(() => {
      window.__ready = true;
    });
  }

  window.APP = {
    get E() { return S.E; },
    data: D, state: S, anims: A,
    go, applyScene, buildPrint, setTheme, showStructure, openCard, closeCard, composeSnapshot, layoutLabels,
    missingAnchors: () => Array.from(S.missingAnchors),
    /** Estado do laço (renderização sob demanda): {on, pauses}. */
    loop: () => ({ on: !!S.loopOn, pauses: Array.from(pauses) }),
    wake, setTouchLive, fixOverlays, syncControls, fixSVG,
    /** Testes: para a animação da fixação (o stepper continua sincronizado). */
    stopFix() { stopAnims('fix'); },
    /** Testes: avança os relógios das animações como se dt ms tivessem passado (sem depender do laço). */
    tickAnims(dt) { tickAnims(performance.now() + (+dt || 0)); },
    pick: (x, y) => (S.E ? pickFast(x, y) : null),
    /** Testes: congela o laço e desenha um quadro estável (rótulos, oclusão e gizmo atualizados). */
    still() {
      const E = S.E; if (!E) return false;
      pause('still'); settleModules(); E.setView(E.getView(), 0); E.renderOnce();
      S.occKey = ''; S.occQ = null; S.occT = -1e9; S.camMoveT = -1e9; S.lastCk = camOnlyKey(); S.layoutKey = ''; S.gizmoKey = '';
      S.labels.forEach((L) => (L.init = false));
      const t = performance.now() + 1e6; updateGizmo();
      for (let k = 0; k < 40; k++) { updateLabels(t + k * 1000); if (k > 0 && !S.occQ) break; }
      // os instantes fictícios acima não podem vazar para o laço real (occT no futuro travaria a oclusão e a pausa 'idle')
      S.occT = performance.now() - 1000;
      return true;
    },
    resume() { unpause('still'); wake(); },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
