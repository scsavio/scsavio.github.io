/* ==========================================================================
   fixation.js — fixação do cateter venoso central pelo "ponto em bailarina"
   (sandália romana / finger trap): ponto de ancoragem na pele ao lado do trecho
   externo, nó cirúrgico + seminós, duas pontas longas que trocam de lado por
   baixo do cateter e se cruzam por cima com um nó a cada cruzamento, corte das
   pontas, pontos nas asas do canhão e curativo transparente com gel de
   clorexidina e etiqueta de data.
   Estado: E.state.fixStep ∈ [0, 9] (k + t anima a etapa k+1; contrato em
   notes/FIXACAO_CONTRACT.md); só tem efeito com E.state.phase = 6.
   Camada: instrument. Coordenadas ANATÔMICAS (x = direita do paciente, y
   cranial, z anterior; cm). A geometria do cateter vem de
   instruments.api.external() e é refeita a cada reassentamento (campo estéril).
   Escala: o náilon 3-0 real tem Ø ≈ 0,02–0,025 cm; aqui o fio é desenhado com
   Ø 0,05 cm (legibilidade). Agulha curva 1/2 círculo, 2,0 cm, cortante;
   porta-agulha Mayo-Hegar ~14,5 cm; pinça de dissecção com dente (Adson) ~12 cm;
   tesoura de fio ~10 cm. Nós: hélice dupla compacta (as laçadas estão resumidas).
   Modelo do fio: cada ponta = trecho "formado" (ancoragem, voltas e nós, com
   frente de avanço) + ponta livre até a extremidade, que fica deitada na pele ou
   presa por um instrumento; o comprimento total de cada ponta é conservado e a
   folga vira uma alça deitada na pele (sem pontas rígidas no ar).
   Nó instrumental (por cruzamento): as pontas passam por baixo do cateter
   (cada instrumento empurra uma ponta pelo vão e recolhe a outra), porta-agulha
   paralelo à pele sobre o cateter, a pinça enrola a ponta longa 2 voltas nas
   mandíbulas, as mandíbulas pegam a outra ponta, tração para lados opostos
   (as espiras saem das mandíbulas e o nó assenta), e os instrumentos soltam.
   Etapa 2 = ponto de ancoragem (contrapressão com a pinça, condução pelo terço posterior até as mandíbulas encostarem
   na pele; a pinça prende o corpo exteriorizado ≥ 0,3 rad atrás da ponta — nunca a ponta — e o traz pela curva enquanto o
   porta-agulha solta e repega o corpo; a agulha só se move presa a um instrumento) + tração até as pontas ficarem iguais
   + separação da agulha com a tesoura e descarte; etapa 3 = nó instrumental de ancoragem e as duas pontas deitadas
   juntas do lado lateral. Pontos nas asas: pegada dérmica real (a agulha passa pelo furo, entra na pele sob a asa e sai à
   frente dela), repega assistida pela pinça e recarga da agulha (pinça segura, porta-agulha troca de pega) entre as asas.
   Pontas em repouso: curvas suaves deitadas na pele (lieTail, raio ≥ 0,3 cm). Nas etapas inteiras não há instrumentos.
   Onda 6: o porta-agulha solta e recebe a agulha pelo próprio eixo, com a mandíbula entreaberta (setOpen); a pinça entra
   e sai pelo eixo do cabo; na recarga chega por um lado livre e sai longe dos braços da agulha; fios deitados não se
   atravessam (overStrand: B passa por cima de A longe dos nós).
   API: steps, stepMs (duração sugerida do movimento de cada etapa — a coreografia foi desenhada para ela), stepViews,
   anchorSteps, focusView. Desempenho: só se recalcula quando fixStep muda.
   ========================================================================== */
ATLAS.define('fixation', async function (ctx) {
  'use strict';
  const { THREE, C, layers } = ctx;
  const T_BUILD0 = performance.now();
  const anchors = {};
  const PI = Math.PI, TWO_PI = 2 * Math.PI;
  const clamp = C.clamp, lerp = C.lerp;
  const ss = (t, a, b) => C.smooth(a, b, t);              // progresso suave de t em [a, b]
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1); // progresso linear de t em [a, b]
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  const GI = (k) => Object.assign({ group: 'Instrumentos' }, k);
  const setA = (key, p) => {
    let a = anchors[key]; if (!a) a = anchors[key] = [0, 0, 0];
    const x = p.isVector3 ? p.x : p[0], y = p.isVector3 ? p.y : p[1], z = p.isVector3 ? p.z : p[2];
    a[0] = Math.round(x * 1000) / 1000; a[1] = Math.round(y * 1000) / 1000; a[2] = Math.round(z * 1000) / 1000; return a;
  };
  const STEPS = ['Sem fixação', 'Preparo', 'Ponto de ancoragem', 'Nó de ancoragem', '1º cruzamento', '2º cruzamento',
    '3º cruzamento e nó final', 'Corte e conferência', 'Pontos nas asas', 'Curativo'].map((short, n) => ({ n, short }));
  /* duração sugerida (ms) do movimento DE CADA ETAPA k (de fixStep k−1 até k); [0] não se usa */
  // (onda 5: +1 s na etapa 2 — repega assistida pela pinça; +1 s na 3 — as pontas são deitadas juntas; +1 s na 8 — recarga
  // da agulha entre as asas; total ≈ 71,5 s)
  const STEP_MS = [0, 3000, 12000, 8000, 8500, 9000, 9000, 8500, 10000, 3500];

  let ins = ctx.engine && ctx.engine.results ? ctx.engine.results.instruments : null;
  if (ins && typeof ins.then === 'function') { try { ins = await ins; } catch (_) { ins = null; } }
  const iapi = ins && ins.api;
  const root = new THREE.Group(); root.name = 'Fixação do cateter (bailarina)'; root.visible = false;
  layers.instrument.add(root);
  if (!iapi || typeof iapi.external !== 'function' || !iapi.external()) {
    return { anchors, update() {}, api: { steps: STEPS, stepMs: STEP_MS, focusView: null, available: false } };
  }
  const sZ = (x, y) => iapi.surfaceZ(x, y);   // superfície de apoio atual (pele ou campo)
  const kZ = (x, y) => iapi.skinZ(x, y);      // pele
  const nrm = (fz, x, y, e = 0.3) => V3(-(fz(x + e, y) - fz(x - e, y)) / (2 * e), -(fz(x, y + e) - fz(x, y - e)) / (2 * e), 1).normalize();

  /* ======================================================================
     1. Constantes, materiais e texturas
     ====================================================================== */
  const R_T = 0.025;                    // raio do fio desenhado
  const RK = 0.028, BULGE = 0.3;        // raio da hélice dos nós e abaulamento central
  const NEEDLE_LEN = 2.0, ARC = PI, RN = NEEDLE_LEN / ARC, R_ND = 0.03; // agulha 1/2 círculo, 2,0 cm
  const D_A = 0.6, S_P1 = 0.22, CHORD = 1.04; // âncora: distância ao eixo, nó (cm de cateter desde a saída), corda da pegada
  const TILT = 10 * PI / 180;           // plano da agulha quase perpendicular à pele (haste quase paralela)
  // pega no terço posterior (16 % do arco a partir do engaste, longe dele) / repega no corpo exteriorizado
  const BPOST = -152 * PI / 180, BANT = -45 * PI / 180;
  const MIN_GRIP = 0.3;                 // nenhum instrumento prende a agulha a menos de 0,3 rad (~0,19 cm) da ponta
  const DRIVE_SKIN = 0.015;             // fim da condução: as mandíbulas descem até encostar na pele (folga 0,15 mm)
  const NEEDLE_GAP = 0.075, F_OPEN = 0.14; // abertura da pinça ao prender a agulha (secção triangular) / ao chegar e soltar
  const TH_K = 0.62, TH_KF = 0.82;      // meia-abertura angular dos nós sobre o cateter (cruzamentos / nó final)
  const LOOSE = 0.3, LIFT = 0.22;       // laço frouxo: raio extra e elevação
  const L_TAIL0 = 8.0, L_STUB = 0.85;   // pontas após o nó de ancoragem; coto após o corte (0,5–1 cm)
  const N1 = 240, N2 = 900, RAD = 8;    // amostras dos tubos do fio (início / restante) e segmentos radiais
  const GAP = 0.033;                    // meia-abertura entre as mandíbulas (agulha presa)
  const COIL_R1 = 0.14, COIL_R2 = 0.125, COIL_X0 = 0.34, COIL_PITCH = 0.075, WRAP_R = 0.55; // espiras nas mandíbulas
  const UPZ = V3(0, 0, 1);
  // direções em que as pontas soltas deitam (coordenadas anatômicas): lado +B do cateter → lateral, na fossa
  // infraclavicular; lado −B → caudal-medial, sobre o peitoral (longe da clavícula, da fossa supraclavicular e do canhão)
  const LIE_P = V3(0.98, -0.18, 0).normalize(), LIE_N = V3(-0.45, -0.9, 0).normalize();
  const downV = (v, k = 0.55) => v.clone().multiplyScalar(Math.sqrt(1 - k * k)).addScaledVector(UPZ, -k).normalize();

  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function normalTex(size, Hf, strength) {
    const cv = canvas(size, size), g = cv.getContext('2d'), img = g.createImageData(size, size), H = new Float32Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) H[y * size + x] = Hf(x, y);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const hl = H[y * size + (x + size - 1) % size], hr = H[y * size + (x + 1) % size], hu = H[((y + size - 1) % size) * size + x], hd = H[((y + 1) % size) * size + x];
      let nx = (hl - hr) * strength, ny = (hu - hd) * strength, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const i = (y * size + x) * 4; img.data[i] = (nx * 0.5 + 0.5) * 255; img.data[i + 1] = (ny * 0.5 + 0.5) * 255; img.data[i + 2] = (nz * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  // aço escovado: estrias finas ao longo de v (comprimento das peças varridas)
  const rnd = C.rng(91), col = []; for (let i = 0; i < 128; i++) col.push(rnd());
  const brushed = normalTex(128, (x, y) => 0.6 * col[x] + 0.4 * col[(x * 7 + (y >> 4)) % 128], 2.2);
  // serrilhado em losango das mandíbulas
  const hatch = normalTex(64, (x, y) => Math.abs(Math.sin(PI * (x + y) / 8)) + Math.abs(Math.sin(PI * (x - y) / 8)), 1.6);
  hatch.repeat.set(3, 3);
  const PM = (o) => { const m = new THREE.MeshPhysicalMaterial(Object.assign({ transparent: true, opacity: 1, depthWrite: true }, o)); m.clippingPlanes = C.clipPlanes; return m; };
  const nylon = () => PM({ color: '#08090b', roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.32, envMapIntensity: 0.35 });
  const mats = {
    // náilon preto monofilamentar: quase preto, brilho especular discreto (sem reflexo metálico do ambiente)
    thread: nylon(), wing: nylon(), feed: nylon(), offcut: nylon(),
    holder: PM({ color: '#cdd3d8', metalness: 1, roughness: 0.3, normalMap: brushed, normalScale: new THREE.Vector2(0.3, 0.3) }),
    jaw: PM({ color: '#b3b9be', metalness: 1, roughness: 0.38, normalMap: hatch, normalScale: new THREE.Vector2(0.32, 0.32) }),
    forceps: PM({ color: '#c6ccd1', metalness: 1, roughness: 0.34, normalMap: brushed, normalScale: new THREE.Vector2(0.28, 0.28) }),
    scissors: PM({ color: '#d4dade', metalness: 1, roughness: 0.24 }),
    needle: PM({ color: '#dfe4e8', metalness: 1, roughness: 0.18 }),
    glove: PM({ color: '#eadfc8', roughness: 0.45, sheen: 0.6, sheenColor: new THREE.Color('#fffaf0'), clearcoat: 0.2, clearcoatRoughness: 0.45 }),
    puncture: new THREE.MeshStandardMaterial({ color: '#4c1915', roughness: 0.55, transparent: true, opacity: 0.92, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
  };
  mats.puncture.clippingPlanes = C.clipPlanes;
  mats.crust = mats.puncture.clone(); mats.crust.color.set('#6a2a22'); mats.crust.opacity = 0.55; mats.crust.clippingPlanes = C.clipPlanes;
  // halo róseo discreto (reação local, pele perfundida — não isquêmica) ao redor dos orifícios
  const haloTex = (() => { const cv = canvas(64, 64), g = cv.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); })();
  mats.halo = new THREE.MeshStandardMaterial({ color: '#b4584c', roughness: 0.7, transparent: true, opacity: 0.26, alphaMap: haloTex, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  mats.halo.clippingPlanes = C.clipPlanes;
  // sítio de saída: materiais próprios (aparecem com a fixação, sem alterar os demais capítulos com fase 6)
  mats.exitHalo = mats.halo.clone(); mats.exitHalo.clippingPlanes = C.clipPlanes;
  // auxílios da conferência: dourado dos marcadores do atlas, sem sombra, sempre por cima do cateter
  mats.check = new THREE.MeshBasicMaterial({ color: '#d9a640', transparent: true, opacity: 0.9, depthWrite: false, depthTest: true });
  mats.check.clippingPlanes = C.clipPlanes;

  /* ======================================================================
     2. Tubo dinâmico (fio): anéis por transporte paralelo; atualiza só atributos
     ====================================================================== */
  let scratchCum = new Float64Array(4096);
  /** Reamostra a polilinha (array plano x,y,z) em N pontos por comprimento de arco; devolve o comprimento. */
  function resample(raw, N, out) {
    const m = raw.length / 3;
    if (m < 2) { for (let i = 0; i < N; i++) { out[i * 3] = raw[0] || 0; out[i * 3 + 1] = raw[1] || 0; out[i * 3 + 2] = raw[2] || 0; } return 0; }
    if (scratchCum.length < m) scratchCum = new Float64Array(m * 2);
    const cum = scratchCum; cum[0] = 0;
    for (let j = 1; j < m; j++) cum[j] = cum[j - 1] + Math.hypot(raw[j * 3] - raw[j * 3 - 3], raw[j * 3 + 1] - raw[j * 3 - 2], raw[j * 3 + 2] - raw[j * 3 - 1]);
    const L = cum[m - 1];
    if (L < 1e-6) { for (let i = 0; i < N; i++) { out[i * 3] = raw[0]; out[i * 3 + 1] = raw[1]; out[i * 3 + 2] = raw[2]; } return 0; }
    let j = 0;
    for (let i = 0; i < N; i++) {
      const tg = (L * i) / (N - 1);
      while (j < m - 2 && cum[j + 1] < tg) j++;
      const f = clamp((tg - cum[j]) / ((cum[j + 1] - cum[j]) || 1), 0, 1);
      out[i * 3] = raw[j * 3] + (raw[j * 3 + 3] - raw[j * 3]) * f;
      out[i * 3 + 1] = raw[j * 3 + 1] + (raw[j * 3 + 4] - raw[j * 3 + 1]) * f;
      out[i * 3 + 2] = raw[j * 3 + 2] + (raw[j * 3 + 5] - raw[j * 3 + 2]) * f;
    }
    return L;
  }
  function strandMesh(N, mat, info, parent) {
    const R = RAD, nv = N * R + 2;
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3);
    const idx = new Uint16Array(((N - 1) * R * 2 + 2 * R) * 3); let q = 0;
    for (let i = 0; i < N - 1; i++) for (let k = 0; k < R; k++) {
      const a = i * R + k, b = i * R + (k + 1) % R, c = a + R, d = b + R;
      idx[q++] = a; idx[q++] = b; idx[q++] = c; idx[q++] = b; idx[q++] = d; idx[q++] = c;
    }
    const c0 = N * R, c1 = c0 + 1;
    for (let k = 0; k < R; k++) { idx[q++] = c0; idx[q++] = (k + 1) % R; idx[q++] = k; idx[q++] = c1; idx[q++] = (N - 1) * R + k; idx[q++] = (N - 1) * R + (k + 1) % R; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    const mesh = C.mesh(g, mat, parent, info, { cast: true, receive: true });
    const ca = [], sa = []; for (let k = 0; k < R; k++) { ca.push(Math.cos((TWO_PI * k) / R)); sa.push(Math.sin((TWO_PI * k) / R)); }
    const P = new Float32Array(N * 3);
    const S = { mesh, N, P, len: 0, n0: null };
    /** P preenchido → anéis. n0: normal inicial (continuidade entre tubos encadeados). Devolve a normal final. */
    S.commit = function (len, n0) {
      S.len = len; mesh.visible = len > 0.004;
      if (!mesh.visible) return null;
      let tx = 0, ty = 0, tz = 1, nx = 0, ny = 0, nz = 0;
      for (let i = 0; i < N; i++) {
        const i0 = Math.max(0, i - 1), i1 = Math.min(N - 1, i + 1);
        let dx = P[i1 * 3] - P[i0 * 3], dy = P[i1 * 3 + 1] - P[i0 * 3 + 1], dz = P[i1 * 3 + 2] - P[i0 * 3 + 2];
        const l = Math.hypot(dx, dy, dz); if (l > 1e-7) { tx = dx / l; ty = dy / l; tz = dz / l; }
        if (i === 0) {
          if (n0) { nx = n0.x; ny = n0.y; nz = n0.z; } else if (Math.abs(tz) < 0.9) { nx = 0; ny = 0; nz = 1; } else { nx = 1; ny = 0; nz = 0; }
        }
        const dd = nx * tx + ny * ty + nz * tz; nx -= dd * tx; ny -= dd * ty; nz -= dd * tz;
        let ln = Math.hypot(nx, ny, nz);
        if (ln < 1e-6) { if (Math.abs(tz) < 0.9) { nx = -ty; ny = tx; nz = 0; } else { nx = 0; ny = -tz; nz = ty; } ln = Math.hypot(nx, ny, nz); }
        nx /= ln; ny /= ln; nz /= ln;
        const bx = ty * nz - tz * ny, by = tz * nx - tx * nz, bz = tx * ny - ty * nx;
        for (let k = 0; k < R; k++) {
          const ox = ca[k] * nx + sa[k] * bx, oy = ca[k] * ny + sa[k] * by, oz = ca[k] * nz + sa[k] * bz, v = (i * R + k) * 3;
          pos[v] = P[i * 3] + R_T * ox; pos[v + 1] = P[i * 3 + 1] + R_T * oy; pos[v + 2] = P[i * 3 + 2] + R_T * oz;
          nor[v] = ox; nor[v + 1] = oy; nor[v + 2] = oz;
        }
        if (i === 0) { pos[c0 * 3] = P[0]; pos[c0 * 3 + 1] = P[1]; pos[c0 * 3 + 2] = P[2]; nor[c0 * 3] = -tx; nor[c0 * 3 + 1] = -ty; nor[c0 * 3 + 2] = -tz; }
      }
      const e = (N - 1) * 3; pos[c1 * 3] = P[e]; pos[c1 * 3 + 1] = P[e + 1]; pos[c1 * 3 + 2] = P[e + 2]; nor[c1 * 3] = tx; nor[c1 * 3 + 1] = ty; nor[c1 * 3 + 2] = tz;
      g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true;
      g.computeBoundingSphere();
      return V3(nx, ny, nz);
    };
    return S;
  }

  /* ======================================================================
     3. Peças rígidas: porta-agulha, tesoura, agulha, pinça, dedo
     ====================================================================== */
  const infoHolder = GI({ id: 'needle-holder', name: 'Porta-agulha tipo Mayo-Hegar (~14,5 cm)', desc: 'Aço inoxidável, argolas, cremalheira e mandíbulas serrilhadas. A agulha é presa pela ponta das mandíbulas, no terço posterior do corpo, perpendicular a elas; também faz os nós instrumentais (fio enrolado 2 voltas nas mandíbulas).' });
  const infoScissors = GI({ id: 'suture-scissors', name: 'Tesoura de fio', desc: 'Separa a agulha rente ao engaste e corta as pontas deixando ~0,5–1 cm além do nó final, com a ponta afastada do cateter e as lâminas paralelas à pele.' });
  const infoNeedle = GI({ id: 'suture-needle', name: 'Agulha curva 1/2 círculo, cortante (~2 cm)', desc: 'Montada no fio de náilon monofilamentar 3-0. Percorre o arco pela pronossupinação do punho e só se move presa a um instrumento (porta-agulha ou pinça no corpo); nunca é segura com os dedos. Na cena, a pele não se deforma: a entrada fica em ~60° com a pele (na prática, a contrapressão com a pinça everte a borda e a ponta entra perpendicular).' });
  const infoForceps = GI({ id: 'tissue-forceps', name: 'Pinça de dissecção com dente (Adson, ~12 cm)', desc: 'Mão não dominante: contrapressão na pele ao lado da entrada da agulha; quando a ponta sai, prende o corpo exteriorizado da agulha (nunca a ponta, que se cegaria) e a traz pela curva até o porta-agulha repegá-la; passa e recolhe as pontas do fio por baixo do cateter e enrola a ponta longa nas mandíbulas do porta-agulha.' });
  const infoFinger = GI({ id: 'operator-hand', name: 'Dedo do operador estabilizando o canhão', desc: 'Durante cada nó, um dedo da mão não dominante (ou o auxiliar) apoia o canhão para que a tração dos nós não chegue ao sítio de saída.' });
  /** Porta-agulha. Local: origem = ponto de pega (agulha), +X = haste até as argolas, +Y = abertura das mandíbulas
      (rumo ao centro da agulha), Z = X × Y. Ponta das mandíbulas em x = −0,12. */
  const JAW_PIV = 2.2; // articulação da caixa (x local): as mandíbulas giram em torno dela para soltar/receber a agulha
  function buildHolder() {
    const grp = new THREE.Group(); grp.name = 'Porta-agulha (Mayo-Hegar)';
    const jaws = [];
    for (const sg of [1, -1]) {
      const jaw = C.sweepGeometry([[-0.12, sg * (GAP + 0.05), 0], [0.55, sg * (GAP + 0.07), 0], [1.2, sg * (GAP + 0.088), 0], [1.82, sg * (GAP + 0.1), 0]],
        { rx: [[0, 0.05], [0.35, 0.07], [1, 0.1]], ry: [[0, 0.075], [0.45, 0.115], [1, 0.16]], up: [0, 1, 0], exp: 3.2, segments: 16, radial: 16, caps: 'round' });
      jaw.translate(-JAW_PIV, 0, 0);
      const jg = new THREE.Group(); jg.position.set(JAW_PIV, 0, 0); grp.add(jg); jaws.push([jg, sg]);
      C.mesh(jaw, mats.jaw, jg, infoHolder);
      const shank = C.sweepGeometry([[2.5, sg * 0.1, 0], [4.6, sg * 0.18, 0], [7.6, sg * 0.31, 0], [10.2, sg * 0.5, 0], [11.9, sg * 0.7, 0], [12.5, sg * 0.84, 0]],
        { rx: [[0, 0.11], [0.5, 0.085], [1, 0.1]], ry: [[0, 0.17], [0.5, 0.12], [1, 0.14]], up: [0, 1, 0], exp: 3, segments: 40, radial: 14, caps: 'round', vScale: 2 });
      C.mesh(shank, mats.holder, grp, infoHolder);
      const ring = new THREE.TorusGeometry(0.76, 0.15, 12, 40); ring.scale(1.18, 1, 1); ring.translate(13.3, sg * 1.1, 0);
      C.mesh(ring, mats.holder, grp, infoHolder);
      // cremalheira: lâmina com dentes na face interna de cada haste (travadas no 1º dente)
      const sh = new THREE.Shape(); const y0 = 0.5, y1 = -0.02;
      sh.moveTo(0, y0); sh.lineTo(1.15, y0 + 0.05);
      for (let i = 0; i < 6; i++) { const x = 1.15 - i * 0.19; sh.lineTo(x, y1 + 0.06); sh.lineTo(x - 0.095, y1); }
      sh.lineTo(0, y1 + 0.08); sh.closePath();
      const rg = new THREE.ExtrudeGeometry(sh, { depth: 0.07, bevelEnabled: false });
      if (sg < 0) { rg.scale(1, -1, 1); rg.translate(0, 0, -0.075); } else rg.translate(0, 0, 0.005);
      rg.translate(10.55, 0, 0); if (sg < 0) { /* espelho inverteu as faces */ const ix = rg.index ? rg.index.array : null; if (!ix) { const p = rg.attributes.position; for (let i = 0; i < p.count; i += 3) { for (const a of ['X', 'Y', 'Z']) { const t1 = p['get' + a](i + 1); p['set' + a](i + 1, p['get' + a](i + 2)); p['set' + a](i + 2, t1); } } rg.computeVertexNormals(); } }
      C.mesh(rg, mats.holder, grp, infoHolder);
    }
    const box = C.sweepGeometry([[1.72, 0, 0], [2.68, 0, 0]], { rx: 0.205, ry: 0.25, up: [0, 1, 0], exp: 5, segments: 4, radial: 20, caps: 'flat' });
    C.mesh(box, mats.holder, grp, infoHolder);
    const screw = new THREE.CylinderGeometry(0.12, 0.12, 0.06, 20); screw.rotateX(PI / 2); screw.translate(2.2, 0, 0.27);
    C.mesh(screw, mats.holder, grp, infoHolder);
    /** open: abertura na ponta (cm; 0 = fechada sobre a agulha) — giro de ~1° na caixa. Abre a mandíbula do lado +Y
        (do lado do centro da agulha, longe da pele): a outra continua rente, sem descer na superfície */
    grp.userData.setOpen = (open) => { const a = Math.asin(clamp(Math.max(0, open) / (JAW_PIV + 0.12), 0, 0.05)); for (const [jg, sg] of jaws) jg.rotation.z = sg > 0 ? -a : 0; };
    C.reg(grp, infoHolder);
    return grp;
  }
  /** Tesoura de fio. Local: origem nas pontas (fechada), +X rumo às argolas, lâminas no plano XY, pivô em x = 4,2.
      Cada metade é um grupo girado em torno do pivô (abertura α). */
  function buildScissors() {
    const grp = new THREE.Group(); grp.name = 'Tesoura de fio';
    const PIV = 4.2, halves = [];
    for (const sg of [1, -1]) {
      const h = new THREE.Group(); h.position.set(PIV, 0, 0); grp.add(h); halves.push(h);
      const sh = new THREE.Shape();
      sh.moveTo(0.02, 0); sh.lineTo(4.65, -0.02); sh.lineTo(4.65, 0.36);
      sh.bezierCurveTo(3.4, 0.44, 1.6, 0.32, 0.02, 0.05); sh.closePath();
      const bl = new THREE.ExtrudeGeometry(sh, { depth: 0.055, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 1, curveSegments: 14 });
      if (sg < 0) { bl.scale(1, -1, -1); } // espelho em y e z: dois espelhos = rotação (faces continuam para fora)
      bl.translate(-PIV, 0, sg * 0.008);
      C.mesh(bl, mats.scissors, h, infoScissors);
      const shank = C.sweepGeometry([[4.3, sg * 0.12, sg * 0.04], [5.8, -sg * 0.18, sg * 0.04], [7.8, -sg * 0.5, sg * 0.04], [9.3, -sg * 0.78, sg * 0.04]].map((p) => [p[0] - PIV, p[1], p[2]]),
        { rx: [[0, 0.07], [1, 0.06]], ry: [[0, 0.12], [1, 0.1]], up: [0, 0, 1], exp: 3, segments: 26, radial: 12, caps: 'round', vScale: 2 });
      C.mesh(shank, mats.scissors, h, infoScissors);
      const ring = new THREE.TorusGeometry(0.62, 0.12, 10, 36); ring.scale(1.15, 1, 1); ring.translate(10.15 - PIV, -sg * 1.15, sg * 0.04);
      C.mesh(ring, mats.scissors, h, infoScissors);
    }
    const scr = new THREE.CylinderGeometry(0.13, 0.13, 0.2, 18); scr.rotateX(PI / 2); scr.translate(PIV, 0, 0);
    C.mesh(scr, mats.scissors, grp, infoScissors);
    grp.userData.setOpen = (alpha) => { halves[0].rotation.z = -alpha / 2; halves[1].rotation.z = alpha / 2; };
    C.reg(grp, infoScissors);
    return grp;
  }
  /** Agulha: referencial com o centro do círculo na origem, círculo no plano XY, ponta em θ = 0 e corpo em θ ∈ [−ARC, 0]
      (a ponta avança no sentido +θ). Secção triangular com o gume na curvatura externa (cortante reversa) perto da ponta. */
  function buildNeedle() {
    const pts = []; for (let i = 0; i <= 72; i++) { const th = -ARC * (i / 72); pts.push(V3(RN * Math.cos(th), RN * Math.sin(th), 0)); }
    const tri = (a) => 0.5 / Math.cos((((a % (TWO_PI / 3)) + TWO_PI / 3) % (TWO_PI / 3)) - PI / 3);
    const g = C.sweepGeometry(pts, {
      r: (t) => (t < 0.08 ? 0.004 + (R_ND - 0.004) * C.smooth(0, 0.08, t) : t > 0.95 ? R_ND * (1 + 0.22 * C.smooth(0.95, 0.975, t)) : R_ND),
      up: (t, p) => V3(p.x, p.y, 0).normalize(), radial: 12, segments: 80, caps: 'round',
      radial_fn: (t, a) => { const w = 1 - C.smooth(0.14, 0.36, t); return lerp(1, tri(a) * 1.22, w); },
    });
    const grp = new THREE.Group(); grp.name = 'Agulha curva';
    C.mesh(g, mats.needle, grp, infoNeedle);
    C.reg(grp, infoNeedle);
    return grp;
  }
  /** Pinça de dissecção (Adson). Local: origem nas pontas fechadas, +X rumo à junção posterior (cabo), +Y = abertura,
      Z = largura. Cada ramo gira em torno da junção (x = 12). */
  const F_LEN = 12;
  const prx = [[0, 0.02], [0.3, 0.03], [0.5, 0.042], [1, 0.05]];                               // espessura (eixo da abertura)
  const pry = [[0, 0.045], [0.12, 0.07], [0.3, 0.1], [0.4, 0.3], [0.86, 0.33], [1, 0.24]];     // largura
  // haste aberta 0,3 cm na ponta (recarga): eixo y(x) da haste e semieixos da secção — checagem da saída da pinça
  const TINE_RX = C.profile(prx), TINE_RY = C.profile(pry), TINE_SIN = (0.3 / 2 - 0.006) / F_LEN;
  const TINE_Y = (x) => (x <= 1.5 ? lerp(0.026, 0.05, x / 1.5) : lerp(0.05, 0.14, clamp((x - 1.5) / 2.5, 0, 1)));
  function buildForceps() {
    const grp = new THREE.Group(); grp.name = 'Pinça de dissecção (Adson)';
    const tines = [];
    for (const sg of [1, -1]) {
      const h = new THREE.Group(); h.position.set(F_LEN, 0, 0); grp.add(h); tines.push(h);
      const pts = [[0, 0.026], [1.5, 0.05], [4, 0.14], [7.5, 0.3], [10.6, 0.24], [11.6, 0.09], [12, 0.05]].map(([x, y]) => [x - F_LEN, sg * y, 0]);
      const geo = C.sweepGeometry(pts, { rx: prx, ry: pry, up: [0, 1, 0], exp: 3, segments: 48, radial: 12, caps: 'round', vScale: 2 });
      C.mesh(geo, mats.forceps, h, infoForceps);
      // dentes (1 × 2) na face interna da ponta
      for (const dz of sg > 0 ? [0] : [-0.022, 0.022]) { const tb = new THREE.BoxGeometry(0.03, 0.022, 0.014); tb.translate(0.03 - F_LEN, sg * 0.004, dz); C.mesh(tb, mats.forceps, h, infoForceps); }
    }
    const back = C.sweepGeometry([[11.6, 0, 0], [12.2, 0, 0]], { rx: 0.1, ry: 0.25, up: [0, 1, 0], exp: 4, segments: 4, radial: 16, caps: 'round' });
    C.mesh(back, mats.forceps, grp, infoForceps);
    /** gap: abertura entre as faces internas na ponta (cm); 0 = fechada. */
    grp.userData.setOpen = (gap) => { const a = Math.asin(clamp((Math.max(0, gap) / 2 - 0.006) / F_LEN, -0.05, 0.05)); tines[0].rotation.z = -a; tines[1].rotation.z = a; };
    C.reg(grp, infoForceps);
    return grp;
  }
  /** Dedo enluvado (esquemático). Local: origem no ponto de contato da polpa, +X rumo à mão, +Y = normal da superfície apoiada. */
  function buildFinger() {
    const grp = new THREE.Group(); grp.name = 'Dedo do operador (apoio no canhão)';
    const g = C.sweepGeometry([[-0.42, 0.5, 0], [0.6, 0.53, 0], [2.4, 0.66, 0], [4.6, 0.86, 0]], { rx: [[0, 0.47], [0.35, 0.52], [1, 0.6]], ry: [[0, 0.56], [0.35, 0.62], [1, 0.7]], up: [0, 1, 0], exp: 2.2, segments: 30, radial: 20, caps: 'round' });
    C.mesh(g, mats.glove, grp, infoFinger);
    C.reg(grp, infoFinger);
    return grp;
  }
  const holder = buildHolder(); root.add(holder);
  const scissors = buildScissors(); root.add(scissors); scissors.scale.setScalar(0.85); // ~11,5 cm × 0,85 ≈ 10 cm (tesoura de fio delicada)
  const needle = buildNeedle(); root.add(needle);
  const forceps = buildForceps(); root.add(forceps);
  const finger = buildFinger(); root.add(finger);
  // sondas (referencial local) para checagem de folga contra pele/campo, cateter e canhão
  const HOLDER_PROBES = [];
  { const prx = C.profile([[0, 0.05], [0.35, 0.07], [1, 0.1]]), pry = C.profile([[0, 0.075], [0.45, 0.115], [1, 0.16]]);
    for (const x of [-0.16, 0.25, 0.85, 1.85]) { const tt = clamp((x + 0.12) / 1.94, 0, 1); for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) if (y || z) HOLDER_PROBES.push(V3(x, y * (GAP + 2 * prx(tt)), z * pry(tt))); }
    for (const x of [2.2, 3.5, 5.5, 8, 10.5, 12.3]) for (const y of [-1, 1]) for (const z of [-1, 0, 1]) HOLDER_PROBES.push(V3(x, y * (0.2 + 0.05 * x), z * 0.17));
    for (const y of [-1, 1]) for (const dx of [-0.9, 0, 0.9]) HOLDER_PROBES.push(V3(13.3 + dx, y * (dx ? 1.1 : 1.95), 0)); }
  const FORCEPS_PROBES = [];
  for (const [x, yo, w] of [[0.03, 0.05, 0.05], [0.6, 0.07, 0.06], [1.6, 0.1, 0.08], [3.2, 0.16, 0.11], [5, 0.24, 0.3], [8, 0.34, 0.33], [11, 0.25, 0.3]]) for (const y of [-1, 1]) for (const z of [-1, 0, 1]) FORCEPS_PROBES.push(V3(x, y * yo, z * w));

  // fios dinâmicos: A e B (cada um em dois tubos: início e restante), sobras cortadas e fio de alimentação das asas
  const infoBall = GI({ id: 'suture-ballerina', name: 'Fixação em bailarina (fio de náilon 3-0 e nós)', desc: 'Duas pontas do mesmo fio, a partir do ponto de ancoragem, trocam de lado por baixo do cateter e se cruzam por cima com um nó a cada cruzamento. Fio desenhado mais grosso (Ø 0,5 mm) para leitura.' });
  const infoAnchor = GI({ id: 'suture-anchor', name: 'Ponto de ancoragem na pele (nó cirúrgico + seminós)', desc: 'Pegada dérmica paralela ao cateter, de um lado do trecho externo, junto à saída; o nó assenta sobre a pele sem estrangulá-la e deixa as duas pontas longas.' });
  const infoWing = GI({ id: 'suture-wing', name: 'Pontos nas asas do canhão', desc: 'Um ponto por orifício da asa, com nó sobre a asa e pontas curtas; o cateter fica em curva suave entre a bailarina e o canhão.' });
  const A1 = strandMesh(N1, mats.thread, infoAnchor, root), B1 = strandMesh(N1, mats.thread, infoAnchor, root);
  const A2 = strandMesh(N2, mats.thread, infoBall, root), B2 = strandMesh(N2, mats.thread, infoBall, root);
  const OA = strandMesh(200, mats.offcut, infoBall, root), OB = strandMesh(200, mats.offcut, infoBall, root);
  const FEED = strandMesh(300, mats.feed, infoWing, root);
  const markGrp = new THREE.Group(); markGrp.name = 'Orifícios do ponto de ancoragem'; root.add(markGrp); C.reg(markGrp, infoAnchor);
  const wingGrp = new THREE.Group(); wingGrp.name = 'Pontos nas asas'; root.add(wingGrp); C.reg(wingGrp, infoWing);
  const dressGrp = new THREE.Group(); dressGrp.name = 'Curativo transparente'; root.add(dressGrp);
  // conferência (etapa 7): anel na marca em cm rente à pele e seta da tração suave no canhão (auxílios didáticos)
  const checkGrp = new THREE.Group(); checkGrp.name = 'Conferência da fixação'; root.add(checkGrp); checkGrp.visible = false;

  /* ======================================================================
     4. Layout (a partir de instruments.api.external()) — refeito a cada reassentamento
     ====================================================================== */
  /** Remove do registro (glossário/seleção) as malhas de um grupo que será refeito. */
  function clearGroup(grp) {
    grp.traverse((o) => {
      if (o === grp) return;
      const id = o.userData && o.userData.info && o.userData.info.id, e = id && ATLAS.registry.get(id);
      if (e) { const k = e.objects.indexOf(o); if (k >= 0) e.objects.splice(k, 1); }
      if (o.isMesh && o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    });
    grp.clear();
  }
  let G = null, layoutVer = 0;
  const PLAN_CACHE = new Map();
  const FR = { c: V3(), T: V3(), U: V3(), B: V3() };
  function frameAt(s, o = FR) {
    let x = (s - G.S0) / G.DS, i = Math.floor(x), f = x - i;
    if (i < 0) { i = 0; f = 0; } else if (i > G.n - 2) { i = G.n - 2; f = 1; }
    const a = i * 3, b = a + 3, P = G.P, T = G.T, U = G.U, B = G.B;
    o.c.set(P[a] + (P[b] - P[a]) * f, P[a + 1] + (P[b + 1] - P[a + 1]) * f, P[a + 2] + (P[b + 2] - P[a + 2]) * f);
    o.T.set(T[a] + (T[b] - T[a]) * f, T[a + 1] + (T[b + 1] - T[a + 1]) * f, T[a + 2] + (T[b + 2] - T[a + 2]) * f).normalize();
    o.U.set(U[a] + (U[b] - U[a]) * f, U[a + 1] + (U[b + 1] - U[a + 1]) * f, U[a + 2] + (U[b + 2] - U[a + 2]) * f).normalize();
    o.B.set(B[a] + (B[b] - B[a]) * f, B[a + 1] + (B[b + 1] - B[a + 1]) * f, B[a + 2] + (B[b + 2] - B[a + 2]) * f).normalize();
    return o;
  }
  /** Ponto em coordenadas cilíndricas do cateter: s (cm desde a saída), φ (de U para B), ρ (raio), elevação extra em U. */
  function wrapPt(s, phi, rho, lift, out) {
    frameAt(s); out.copy(FR.c).addScaledVector(FR.U, rho * Math.cos(phi) + lift).addScaledVector(FR.B, rho * Math.sin(phi)); return out;
  }
  /** s mais próximo (busca local a partir de hint) e distância radial ao eixo. */
  function nearestS(p, hint) {
    const P = G.P, n = G.n; let best = 0, bd = Infinity;
    const d2 = (i) => (P[i * 3] - p.x) ** 2 + (P[i * 3 + 1] - p.y) ** 2 + (P[i * 3 + 2] - p.z) ** 2;
    if (hint == null) { for (let i = 0; i < n; i += 8) { const d = d2(i); if (d < bd) { bd = d; best = i; } } hint = best; }
    const lo = Math.max(0, hint - 30), hi = Math.min(n - 1, hint + 30);
    bd = Infinity; for (let i = lo; i <= hi; i++) { const d = d2(i); if (d < bd) { bd = d; best = i; } }
    return best;
  }
  const P_DIST2 = (p, i) => (G.P[i * 3] - p.x) ** 2 + (G.P[i * 3 + 1] - p.y) ** 2 + (G.P[i * 3 + 2] - p.z) ** 2;
  /** Distância da superfície do trecho externo do cateter (polilinha grossa de segmentos) a um ponto. */
  function cathDist(q) {
    const S = G.cseg; let m = Infinity;
    for (let i = 0; i < S.length - 3; i += 3) {
      const ax = S[i], ay = S[i + 1], az = S[i + 2], bx = S[i + 3] - ax, by = S[i + 4] - ay, bz = S[i + 5] - az;
      const px = q.x - ax, py = q.y - ay, pz = q.z - az, l2 = bx * bx + by * by + bz * bz;
      const u = clamp((px * bx + py * by + pz * bz) / (l2 || 1), 0, 1), dx = px - bx * u, dy = py - by * u, dz = pz - bz * u;
      const d = dx * dx + dy * dy + dz * dz; if (d < m) m = d;
    }
    return Math.sqrt(m) - G.rC;
  }
  /** Distância (aprox., com sinal) ao canhão: corpo + asas, em coordenadas locais do canhão. */
  const HUB_R = C.profile([[0, 0.02], [0.02, 0.38], [0.11, 0.46], [0.35, 0.5], [0.55, 0.47], [0.71, 0.33], [0.89, 0.2], [1, 0.13]]); // raio do corpo (y local −1,2…1,95)
  function hubDist(q) {
    const dx = q.x - G.hubC.x, dy = q.y - G.hubC.y, dz = q.z - G.hubC.z;
    const x = dx * G.hubX.x + dy * G.hubX.y + dz * G.hubX.z, y = dx * G.hubY.x + dy * G.hubY.y + dz * G.hubY.z, z = dx * G.hubN.x + dy * G.hubN.y + dz * G.hubN.z;
    if (x * x + y * y + z * z > 16) return 3;
    // corpo: cilindro elíptico (semieixos r e 0,62 r) entre y = −1,2 e 1,95; asas: placa
    const r = HUB_R(clamp((y + 1.2) / 3.15, 0, 1)), rz = 0.62 * r, e = Math.sqrt((x / r) ** 2 + (z / rz) ** 2);
    const dBody = Math.max((e - 1) * rz, -1.2 - y, y - 1.95);
    const qx = Math.abs(x) - 1.47, qy = Math.abs(y - 0.15) - 0.57, qz = Math.abs(z + 0.24) - 0.11;
    const dWing = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0);
    return Math.min(dBody, dWing);
  }
  const horiz = (v) => V3(v.x, v.y, 0).normalize();
  const LG = 2.6; // aperto dos nós: o instrumento segura o fio a ~2,6 cm do nó (o resto da ponta deita na pele)
  /** Tração simétrica para os lados (±side), paralela à pele no nó: elevação mínima (≥ 8°) que mantém o fio ≥ 0,12 cm
      acima da superfície até além da pegada, a MESMA dos dois lados (força resultante sobre o cateter ≈ nula). */
  function pullDirs(K, side, reach) {
    const n = nrm(sZ, K.x, K.y, 0.4), Bp = side.clone().addScaledVector(n, -side.dot(n)).normalize();
    let e = 8 * PI / 180;
    for (const sg of [1, -1]) for (let d = 0.3; d <= reach + 0.61; d += 0.15) {
      const q = K.clone().addScaledVector(Bp, sg * d), need = sZ(q.x, q.y) + 0.12 - q.z;
      if (need > 0) e = Math.max(e, Math.atan2(need, d));
    }
    e = Math.min(e, 30 * PI / 180);
    const c = Math.cos(e), sn = Math.sin(e);
    return { dP: Bp.clone().multiplyScalar(c).addScaledVector(n, sn).normalize(), dN: Bp.clone().multiplyScalar(-c).addScaledVector(n, sn).normalize(), deg: +(e * 180 / PI).toFixed(1) };
  }
  const onSurf = (x, y, dz = R_T + 0.003) => V3(x, y, sZ(x, y) + dz);
  const footOf = (p, dz = R_T + 0.003) => onSurf(p.x, p.y, dz);
  const quatFromBasis = (X, Y, Z) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
  /** Pose a partir da origem p, eixo X e um vetor de referência para Y (ortogonalizado). */
  function framePose(p, X, Yh) {
    const x = X.clone().normalize(); let y = Yh.clone().addScaledVector(x, -Yh.dot(x));
    if (y.lengthSq() < 1e-8) y = Math.abs(x.z) < 0.9 ? V3(0, 0, 1).addScaledVector(x, -x.z) : V3(1, 0, 0).addScaledVector(x, -x.x);
    y.normalize(); const z = V3().crossVectors(x, y);
    return { p: p.clone(), q: quatFromBasis(x, y, z), X: x, Y: y, Z: z };
  }
  const withAxes = (pp) => Object.assign(pp, { X: V3(1, 0, 0).applyQuaternion(pp.q), Y: V3(0, 1, 0).applyQuaternion(pp.q), Z: V3(0, 0, 1).applyQuaternion(pp.q) });
  const lerpPose = (a, b, t) => ({ p: a.p.clone().lerp(b.p, t), q: a.q.clone().slerp(b.q, t) });
  const movePose = (a, d) => ({ p: a.p.clone().add(d), q: a.q.clone() });
  const clonePose = (a) => ({ p: a.p.clone(), q: a.q.clone() });
  /** Interpolação por quadros-chave: keys = [[t, pose, arco?], ...] (t crescente); entre chaves, suavizado; "arco" eleva o
      trecho que termina naquela chave (cm, em +z) para contornar o que estiver no caminho. */
  function kfPose(t, keys) {
    if (t <= keys[0][0]) return withAxes(clonePose(keys[0][1]));
    for (let i = 1; i < keys.length; i++) {
      if (t < keys[i][0]) {
        const t0 = keys[i - 1][0], a = keys[i - 1][1], t1 = keys[i][0], b = keys[i][1], arc = keys[i][2] || 0;
        const e = t1 > t0 ? C.smooth(t0, t1, t) : 1, r = lerpPose(a, b, e);
        if (arc) r.p.z += arc * Math.sin(PI * e);
        return withAxes(r);
      }
    }
    return withAxes(clonePose(keys[keys.length - 1][1]));
  }
  function kfVec(t, keys) {
    if (t <= keys[0][0]) return keys[0][1].clone();
    for (let i = 1; i < keys.length; i++) {
      if (t < keys[i][0]) {
        const t0 = keys[i - 1][0], t1 = keys[i][0], e = t1 > t0 ? C.smooth(t0, t1, t) : 1;
        const r = keys[i - 1][1].clone().lerp(keys[i][1], e); if (keys[i][2]) r.z += keys[i][2] * Math.sin(PI * e); return r;
      }
    }
    return keys[keys.length - 1][1].clone();
  }

  function layout() {
    const ext = iapi.external(); if (!ext || !ext.path) return false;
    const g = { ext, rC: ext.rCath || 0.1167, prof: {} }; const tL0 = performance.now(), mk = (k) => { g.prof[k] = Math.round(performance.now() - tL0); };
    g.rhoW = g.rC + R_T + 0.003; g.rhoK = g.rC + R_T + RK * (1 + BULGE) + 0.004;
    /* ---- 4a. tabela do eixo do cateter (mesma curva de instruments: Catmull-Rom centrípeta do path inteiro) ---- */
    const cv = C.curve(ext.path), L = cv.getLength(), entry = v3(ext.entry);
    let ue = 0, bd = Infinity;
    for (let i = 0; i <= 1500; i++) { const u = (i / 1500) * 0.5; const d = cv.getPointAt(u).distanceToSquared(entry); if (d < bd) { bd = d; ue = u; } }
    for (let i = -40; i <= 40; i++) { const u = clamp(ue + (i / 40) * (0.5 / 1500), 0, 1); const d = cv.getPointAt(u).distanceToSquared(entry); if (d < bd) { bd = d; ue = u; } }
    const sHub = ue * L, DS = 0.01, S0 = -0.6, n = Math.round((sHub - S0) / DS) + 1;
    const P = new Float32Array(n * 3), T = new Float32Array(n * 3), U = new Float32Array(n * 3), B = new Float32Array(n * 3);
    const p = V3(), t = V3(), nn = V3(), u3 = V3();
    for (let i = 0; i < n; i++) {
      const s = S0 + i * DS, uu = clamp(ue - s / L, 0, 1);
      cv.getPointAt(uu, p); cv.getTangentAt(uu, t).negate().normalize();
      nn.copy(nrm(sZ, p.x, p.y, 0.35));
      u3.copy(nn).addScaledVector(t, -nn.dot(t)).normalize();
      P.set([p.x, p.y, p.z], i * 3); T.set([t.x, t.y, t.z], i * 3); U.set([u3.x, u3.y, u3.z], i * 3);
    }
    // suaviza U (o campo de altura tem degraus finos) e recalcula B = U × T (+B = lado da âncora)
    for (let it = 0; it < 3; it++) { const U2 = U.slice(); for (let i = 1; i < n - 1; i++) for (let c = 0; c < 3; c++) U2[i * 3 + c] = (U[i * 3 - 3 + c] + 2 * U[i * 3 + c] + U[i * 3 + 3 + c]) / 4; U.set(U2); }
    for (let i = 0; i < n; i++) {
      t.set(T[i * 3], T[i * 3 + 1], T[i * 3 + 2]); u3.set(U[i * 3], U[i * 3 + 1], U[i * 3 + 2]);
      u3.addScaledVector(t, -u3.dot(t)).normalize(); const b = V3().crossVectors(u3, t).normalize();
      U.set([u3.x, u3.y, u3.z], i * 3); B.set([b.x, b.y, b.z], i * 3);
    }
    Object.assign(g, { P, T, U, B, n, S0, DS, sHub }); mk('table');
    G = g;
    // ponta do nariz do canhão (y local 1,95 do corpo do canhão): limite do trecho livre
    const hubC = v3(ext.hub), hubY = v3(ext.hubY), hubX = v3(ext.hubX), hubN = v3(ext.hubN);
    g.sTip = sHub - 0.4;
    for (let s = 0; s < sHub; s += 0.01) { frameAt(s); if (FR.c.clone().sub(hubC).dot(hubY) <= 1.95) { g.sTip = s; break; } }
    g.hubC = hubC; g.hubX = hubX; g.hubY = hubY; g.hubN = hubN;
    { frameAt(0); const a = FR.c.clone(); frameAt(g.sTip); g.mid = a.clone().lerp(FR.c, 0.5); g.midR = a.distanceTo(FR.c) / 2 + 0.8;
      g.cseg = []; for (let k = 0; k <= 14; k++) { frameAt(lerp(-0.03, g.sTip, k / 14)); g.cseg.push(FR.c.x, FR.c.y, FR.c.z); } }
    const foot = (s) => { frameAt(s); return V3(FR.c.x, FR.c.y, kZ(FR.c.x, FR.c.y)); };
    const Bh = (s) => { frameAt(s); return horiz(FR.B); };
    g.exit = entry.clone();

    /* ---- 4b. ponto de ancoragem: pegada paralela ao cateter, do lado +B (lateral-cranial), nó no orifício junto à saída ----
       agulha 1/2 círculo com o plano quase perpendicular à pele: corda ≈ 1,04 cm, profundidade ≈ 0,27 cm, entrada ≈ 60° */
    const atOff = (s, d) => { const f = foot(s), b = Bh(s); const q = f.addScaledVector(b, d); q.z = kZ(q.x, q.y); return q; };
    const P1 = atOff(S_P1, D_A);
    let sP2 = S_P1 + CHORD; for (let it = 0; it < 4; it++) { const d = P1.distanceTo(atOff(sP2, D_A)); sP2 = Math.min(g.sTip - 0.3, sP2 + (CHORD - d)); }
    const P2 = atOff(sP2, D_A);
    const Pm = P1.clone().add(P2).multiplyScalar(0.5); Pm.z = kZ(Pm.x, Pm.y);
    const e1 = P2.clone().sub(P1).normalize(), nM = nrm(kZ, Pm.x, Pm.y, 0.3);
    const Bout = V3().crossVectors(nM, e1).normalize(); if (Bout.dot(Bh(0.6)) < 0) Bout.negate();
    const nPerp = V3().crossVectors(e1, Bout).normalize();
    const S = Bout.clone().multiplyScalar(Math.cos(TILT)).addScaledVector(nPerp, Math.sin(TILT)).normalize();
    const e2 = V3().crossVectors(e1, S).normalize(); if (e2.dot(nPerp) < 0) e2.negate();
    const NZ = V3().crossVectors(e1, e2);
    const hb = P1.distanceTo(P2) / 2, hc = Math.sqrt(Math.max(0.01, RN * RN - hb * hb));
    const PmPlane = P1.clone().add(P2).multiplyScalar(0.5);
    g.anc = {
      P1, P2, e1, Bout, nPerp, S, sP2, Pm,
      plane: { C: PmPlane.clone().addScaledVector(e2, hc), e1, e2, NZ, q0: quatFromBasis(e1, e2, NZ), sX: Math.sign(NZ.dot(S)) || -1 },
      thIn: Math.atan2(-hc, -hb), thOut: Math.atan2(-hc, hb), depth: RN - hc,
    };
    g.anc.thMid = (g.anc.thIn + g.anc.thOut) / 2;
    g.tissueLen = (g.anc.thOut - g.anc.thIn) * RN;
    const tanPl = (pl, th) => pl.e1.clone().multiplyScalar(-Math.sin(th)).addScaledVector(pl.e2, Math.cos(th)).normalize(); // sentido +θ
    g.anc.tOut = tanPl(g.anc.plane, g.anc.thOut);                 // A sai de P2 no sentido do avanço
    g.anc.tIn = tanPl(g.anc.plane, g.anc.thIn).negate();          // B sai de P1 (sentido contrário ao avanço)
    // nó de ancoragem: sobre o orifício P1, eixo rumo à saída (−T): a ponte (A) chega por trás, B sobe de P1, as pontas saem para −T
    const n1 = nrm(kZ, P1.x, P1.y, 0.25), ax = e1.clone().negate().addScaledVector(n1, e1.dot(n1)).normalize();
    const qk = V3().crossVectors(n1, ax).normalize();
    g.ak = { c: P1.clone().addScaledVector(ax, 0.1).addScaledVector(n1, R_T + RK * (1 + BULGE) + 0.004), ax, n: n1, q: qk, half: 0.12, b: (PI / 2 + 4 * PI) / 2 };

    /* ---- 4c. cruzamentos: s1 junto ao nó de ancoragem, último a ≥ 0,24 cm do nariz do canhão ---- */
    const s1 = S_P1 + 0.38, s3 = Math.min(g.sTip - 0.24, s1 + 1.0), s2 = (s1 + s3) / 2;
    g.spacing = (s3 - s1) / 2;
    g.knots = [null, { s: s1, th: TH_K, b: 1.5 * PI }, { s: s2, th: TH_K, b: 1.5 * PI }, { s: s3, th: TH_KF, b: 2.5 * PI }];
    g.contact = [{ s: S_P1 + 0.14, phi: 0.75 * PI }, { s: S_P1 + 0.2, phi: 0.35 * PI }];
    // obstáculos (pontas deitadas passam por cima): ponte do ponto de ancoragem e nó de ancoragem
    g.obstAll = [{ a: P2.clone(), b: P1.clone(), r: R_T }, { a: g.ak.c.clone().addScaledVector(ax, -g.ak.half), b: g.ak.c.clone().addScaledVector(ax, g.ak.half), r: RK * (1 + BULGE) + R_T }];
    mk('anchor');

    /* ---- 4d. caminhos "formados" apertados (cache) e comprimentos de fio ---- */
    g.ancPath = { A: anchorPath('A', 1), B: anchorPath('B', 1) };
    g.ancLen = { A: polyLen(g.ancPath.A), B: polyLen(g.ancPath.B) };
    g.ancEnd = { A: lastV(g.ancPath.A), B: lastV(g.ancPath.B) };
    g.form = { A: [], B: [] };
    for (const X of ['A', 'B']) for (let c = 0; c <= 3; c++) g.form[X][c] = formedPath(X, c, 1, 0, c === 3);
    g.len = { A: g.ancLen.A + L_TAIL0, B: g.ancLen.B + L_TAIL0 };   // comprimento externo de cada lado (a partir de P2 / P1)
    g.L0 = g.len.A + g.len.B + g.tissueLen;                          // fio total do ponto de ancoragem
    g.splitL = { A: g.tissueLen / 2 + 2.4, B: g.tissueLen / 2 + 0.9 };
    // frente de repouso após o cruzamento d (0: saída do nó de ancoragem; 1–2: descida pela lateral, já no caminho do
    // cruzamento seguinte; 3: descida após o nó final)
    g.restFront = { A: [], B: [] };
    for (const X of ['A', 'B']) {
      g.restFront[X][0] = { c: 0, L: 0, ext: false };
      g.restFront[X][1] = { c: 2, L: g.form[X][2].marks.side1, ext: false };
      g.restFront[X][2] = { c: 3, L: g.form[X][3].marks.side1, ext: true };
      g.restFront[X][3] = { c: 3, L: g.form[X][3].marks.full, ext: true };
    }
    mk('paths');

    /* ---- 4e. pontos de cada cruzamento ---- */
    g.cx = [null];
    for (let c = 1; c <= 3; c++) {
      const s = g.knots[c].s; frameAt(s); const c0 = FR.c.clone(), Uk = FR.U.clone(), Bk = FR.B.clone(), Tk = FR.T.clone();
      const K = c0.clone().addScaledVector(Uk, g.rhoK);
      // ponto de passagem por baixo (A) no caminho apertado
      const fpA = g.form.A[c], iu = fpA.idx.under, Gu = V3(fpA.pts[iu * 3], fpA.pts[iu * 3 + 1], fpA.pts[iu * 3 + 2]);
      const sU = G.S0 + nearestS(Gu, null) * G.DS;
      frameAt(sU); const axH = FR.c.z - sZ(FR.c.x, FR.c.y);
      const rBot = Math.max(g.rhoW, Math.min(g.rhoW + 0.035, axH - R_T - 0.006));
      const mouth = (sg) => { const q = wrapPt(sU + sg * 0.03, sg > 0 ? 0.62 * PI : 1.38 * PI, g.rhoW + 0.26, 0, V3()); q.z = Math.max(q.z, sZ(q.x, q.y) + 0.2); return q; };
      const at = (b, u, tt) => c0.clone().addScaledVector(Bk, b).addScaledVector(Uk, u).addScaledVector(Tk, tt);
      const F_A = footOf(at(-0.65, 0, -0.3));
      // nó instrumental: porta-agulha paralelo à pele sobre o cateter, entre as pontas, haste para lateral-caudal (longe do pescoço)
      const tie = framePose(K.clone().addScaledVector(Uk, 1.05), Tk.clone().multiplyScalar(0.55).addScaledVector(LIE_P, 0.6).addScaledVector(Uk, 0.15), Uk);
      // pontos "esticados": alvos um pouco além do alcance da ponta (o instrumento para onde o fio fica esticado)
      const rem = (X, L) => g.len[X] - g.ancLen[X] - L, mA = g.form.A[c].marks, mB = g.form.B[c].marks;
      const E2p = mouth(-1), E1p = mouth(1);
      // direções anatômicas: o lado −B puxa para caudal-medial (peitoral), o lado +B para lateral (fossa infraclavicular)
      // tração para os lados do cateter, subindo (eixo z do mundo): lado −B → caudal-medial; lado +B → lateral (a pele aqui
      // inclina para cranial: o B local aponta para a clavícula e para baixo, por isso se mistura com a direção lateral)
      const Bh = horiz(Bk), dN = Bh.clone().multiplyScalar(-0.6).addScaledVector(LIE_N, 0.4).addScaledVector(UPZ, 0.55).normalize(), dP = Bh.clone().multiplyScalar(0.45).addScaledVector(LIE_P, 0.55).addScaledVector(UPZ, 0.55).normalize();
      const PAfar = E2p.clone().addScaledVector(dN, 1.005 * rem('A', mA.side2));
      const PBfar = (c === 1 ? sideFront('B', 1) : E1p).clone().addScaledVector(dP, 1.005 * rem('B', mB.side2));
      const KA = ptAtLen(g.form.A[c].pts, mA.end), KB = ptAtLen(g.form.B[c].pts, mB.end);
      // aperto: tração simétrica, para os lados do cateter e paralela à pele; os instrumentos seguram o fio a LG do nó
      // (alvo um pouco além do alcance: o trecho entre o nó e a pegada fica esticado)
      const pd = pullDirs(K, Bk, LG);
      const PAtight = KA.clone().addScaledVector(pd.dP, 1.04 * LG), PBtight = KB.clone().addScaledVector(pd.dN, 1.04 * LG);
      g.cx[c] = {
        s, c0, K, U: Uk, B: Bk, T: Tk, sU, rBot, E1: E1p, E2: E2p, F_A, tie,
        PAfar, PBfar, PBhold: at(1.7, 1.7, -0.5),
        PAtight, PBtight, dPull: { A: pd.dP, B: pd.dN }, pullDeg: pd.deg, OVh: K.clone().addScaledVector(Uk, 1.35).addScaledVector(Tk, -0.15), OVf: K.clone().addScaledVector(Uk, 2.7),
        Vtop: K.clone().addScaledVector(Uk, 0.3),
      };
      g.cx[c].wrap = wrapPlan(tie, sideFront('B', c));
    }
    mk('cross');

    /* ---- 4f. passagem da agulha (âncora) e asas ---- */
    // planos das passagens (os mais caros do layout): guardados por superfície/trajeto — alternar o campo estéril não
    // os recalcula
    const pKey = ext.surface + '|' + ext.path.map((q) => q.map((v) => v.toFixed(3)).join(',')).join(';') + '|' + ext.wingHoles.map((q) => q.map((v) => v.toFixed(3)).join(',')).join(';');
    const pc = PLAN_CACHE.get(pKey);
    const planA = (bp) => planPass(g.anc.plane, g.anc.thIn, g.anc.thOut, S, { bPost: bp, bAnt: BANT, bAntList: [-45, -40, -50], forceps: true });
    if (pc) g.passA = pc.passA;
    else {
      g.passA = planA(BPOST);
      // com o campo (superfície ~0,04 cm acima da pele) a condução para antes e a ponta sai menos: se a pinça não cabe
      // acima da superfície, a pega posterior recua no terço posterior (até −160°, como nas asas) — sem campo, nada muda
      if (g.passA.assist && g.passA.assist.m < -0.012) for (const deg of [-156, -160]) { const p2 = planA(deg * PI / 180); if (!p2.bad && p2.assist && p2.assist.m > g.passA.assist.m) g.passA = p2; if (g.passA.assist.m >= -0.012) break; }
    }
    mk('passA'); g.wings = pc ? pc.wings : ext.wingHoles.map((wh, i) => planWing(g, v3(wh), i)); mk('wings');
    if (!pc) PLAN_CACHE.set(pKey, { passA: g.passA, wings: g.wings });

    /* ---- 4g. agulha e pinça: poses fixas da etapa 2 e da etapa 3 ---- */
    {
      const an = g.anc, ps = g.passA;
      // contrapressão: pontas fechadas na pele logo atrás da entrada (lado da saída), cabo para cima, longe do porta-agulha
      const cp = onSurf(P1.x - e1.x * 0.3 + Bout.x * 0.26, P1.y - e1.y * 0.3 + Bout.y * 0.26, 0.042);
      g.fCP = framePose(cp, nM.clone().multiplyScalar(0.8).addScaledVector(e1, -0.45).addScaledVector(Bout, 0.3), e1.clone().cross(nM));
      // quando a ponta sai: a pinça faz contrapressão na pele logo além do orifício de saída (P2), no prolongamento da
      // pegada — estabiliza o tecido e ajuda a ponta a emergir SEM prender a ponta da agulha (pinçar a ponta a cega e
      // entorta); cabo para cima e rumo ao canhão, longe do porta-agulha que repega o corpo exteriorizado
      const cp2 = onSurf(P2.x + e1.x * 0.34 + Bout.x * 0.04, P2.y + e1.y * 0.34 + Bout.y * 0.04, 0.03);
      const n2 = nrm(kZ, cp2.x, cp2.y, 0.25);
      g.fCP2 = framePose(cp2, n2.clone().multiplyScalar(0.8).addScaledVector(e1, 0.5).addScaledVector(Bout, -0.2), Bout.clone().cross(n2));
      // etapa 2 → 3: agulha erguida (fim da etapa 2) e levada longe, até as pontas ficarem iguais
      const a = passPoses(ps).ant(ps.thSwOut);
      g.liftVec = nM.clone().multiplyScalar(1.5).addScaledVector(Bout, 0.4).addScaledVector(e1, -0.3);
      g.lift = { np: movePose(a.np, g.liftVec), hp: movePose(a.hp, g.liftVec) };
      const S0w = swagePt(g.lift.np), dirPull = nM.clone().multiplyScalar(0.5).addScaledVector(LIE_P, 0.85).normalize();
      const Sfar = P2.clone().addScaledVector(dirPull, 4.6);
      g.pullVec = Sfar.clone().sub(S0w); g.dirPull = dirPull;
      // extremidade de B deitada (laço de folga voltado para cranial-lateral, ponta perto de P1)
      g.HB0 = onSurf(P1.x - 1.4, P1.y + 0.75);
      g.bulgeB0 = downV(V3(-0.99, 0.12, 0).normalize(), 0.72);
      // nó de ancoragem: porta-agulha paralelo à pele sobre o ponto (haste para lateral), pinça segura A e enrola nas mandíbulas
      g.tieA = framePose(g.ak.c.clone().addScaledVector(n1, 1.0).addScaledVector(Bout, 0.1), LIE_P.clone().multiplyScalar(0.95).addScaledVector(n1, 0.2), n1);
      g.wrapA = wrapPlan(g.tieA, P2.clone().lerp(P1, 0.5));
      const AK = g.ak.c;
      g.PAholdA = AK.clone().addScaledVector(n1, 1.6).addScaledVector(Bout, 1.7).addScaledVector(ax, 0.4);
      // aperto do nó de ancoragem: pontas em sentidos opostos, na linha do ponto (A para o lado de P2, B para o oposto),
      // paralelas à pele e com a mesma elevação; pegada a LG do nó
      const pdA = pullDirs(AK, e1, LG);
      g.dPullA = { A: pdA.dP, B: pdA.dN }; g.pullDegA = pdA.deg;
      g.PAtightA = g.ancEnd.A.clone().addScaledVector(pdA.dP, 1.04 * LG);
      g.PBtightA = g.ancEnd.B.clone().addScaledVector(pdA.dN, 1.04 * LG);
    }
    mk('poses');

    /* ---- 4h. repouso das pontas após cada cruzamento: cada ponta deita na pele em curva suave (lieTail): sai do nó / da
       lateral do cateter, vira para a direção de repouso (raio ≥ 0,33 cm), segue reta e termina num arco aberto
       (raio ≥ 0,8 cm) — sem dobra em "V". Após o nó de ancoragem, as DUAS pontas ficam juntas do lado lateral (lado da
       âncora, como no esquema), aninhadas: viram por cima (cranial) do nó e terminam em arco para caudal, longe da
       clavícula e da fossa supraclavicular e acima da asa lateral. Depois de cada cruzamento: A para lateral (arco para
       cranial) e B para caudal-medial (arco para medial), longe do canhão e das asas. ---- */
    g.restEnd = { A: [], B: [] }; g.restBulge = { A: [], B: [] }; g.lie = { A: [], B: [] };
    // LIE_UP: rumo 19,6° (LIE_P girado 30° para cranial); B sai 5° mais cranial (as gêmeas se afastam logo após o nó)
    const PHI_MAX = 1.6 * PI, LIE_UP = V3(Math.cos(0.342), Math.sin(0.342), 0), LIE_UP2 = V3(Math.cos(0.43), Math.sin(0.43), 0);
    for (let d = 0; d <= 3; d++) {
      const rs = { anc: { kap: 1, front: 1 }, c: g.restFront.A[d].c, kap: 1, lam: 0, ext: g.restFront.A[d].ext, front: { A: g.restFront.A[d].L, B: g.restFront.B[d].L }, len: g.len, cut: null, tail: {} };
      let aA = null;
      for (const X of ['A', 'B']) {
        const isA = X === 'A';
        rs.tail[X] = { H: g.ancEnd[X] };
        const r = genSide(X, rs), lrem = r.lrem;
        let sp;
        // d = 0: as duas pontas passam por cima do nó rumo lateral-cranial (+B, como no esquema), viram suavemente para
        // lateral e terminam em arco para caudal; gêmeas (B por fora, 0,15 cm cranial de A; mesmo trecho reto)
        if (d === 0) sp = isA ? { dir: LIE_P, turn: -1, rT: 2.0, R: 0.7, side: -1, phiT: 1.5 * PI, phiMax: 1.75 * PI, out: LIE_UP, force: true }
          : { dir: LIE_P, turn: -1, rT: 2.15, R: 0.85, side: -1, a: aA, phiMax: 1.75 * PI, out: LIE_UP2, force: true };
        else { const sJ = G.S0 + nearestS(r.J, null) * G.DS; frameAt(sJ); const ob = horiz(FR.B).multiplyScalar(isA ? 1 : -1);
          sp = isA ? { dir: LIE_P, turn: 0, rT: 0.45, R: 0.65, side: 1, phiT: 1.25 * PI, phiMax: PHI_MAX, out: ob } // arco baixo: abaixo da clavícula
            : { dir: LIE_N, turn: 0, rT: 0.45, R: 0.45, side: -1, hairpin: true, aFrac: 0.6, out: ob }; } // B: grampo arredondado (volta medial, longe da saída)
        const lt = lieTail(r.J, r.tJ, lrem, sp);
        if (isA) aA = lt.a;
        if (d === 0) { g.lieQ = g.lieQ || {}; g.lieQ[X] = ptAtLen([r.J.x, r.J.y, r.J.z].concat(lt.pts), LG).add(V3(0, 0, 0.3)); }
        g.lie[X][d] = Object.assign({}, sp, { a: lt.a, R: lt.R });
        g.restEnd[X][d] = lt.end;
        // direção da folga quando um instrumento pega a extremidade (alça deitada rumo à direção de repouso)
        g.restBulge[X][d] = downV(sp.dir.clone().addScaledVector(V3(0, 1, 0), isA ? 0.25 : -0.25).normalize(), 0.72);
      }
    }
    // B é levada por cima (cranial) do nó: pegada a ~1,7 cm cranial, 0,9 cm acima da pele; extremidade arrastada
    g.layVB = g.ak.c.clone().addScaledVector(V3(0.2, 0.98, 0), 1.7).add(V3(0, 0, 0.9));
    g.layVB2 = footOf(g.ak.c.clone().addScaledVector(V3(0.3, 0.95, 0), 1.6));
    // B, durante o nó de ancoragem: a parte além da pegada deita para medial-cranial (lado para onde B é tracionado)
    g.HBmed = footOf(g.ancEnd.B.clone().addScaledVector(V3(-0.99, 0.08, 0).normalize(), 2.4).addScaledVector(V3(0.1, 0.99, 0), 0.35));
    // B deitada ao lado de A (gêmea por fora): a folga além da pegada abaula para lateral-cranial, por fora de A
    g.layBulgeB = downV(V3(0.95, 0.3, 0).normalize(), 0.72);
    mk('rest');

    /* ---- 4i. corte das pontas: estado no instante do corte (cotos, sobras e pose da tesoura) ---- */
    // centros dos nós e do ponto de ancoragem (os fios se tocam por desenho só perto deles)
    g.knotCenters = [g.ak.c.clone(), Pm.clone()]; for (let k = 1; k <= 3; k++) { frameAt(g.knots[k].s); g.knotCenters.push(FR.c.clone().addScaledVector(FR.U, g.rhoK)); }
    g.cut = null; g.stubs = null; G = g;
    computeCut(); mk('cut');
    // âncoras fixas
    setA('fixExit', g.exit.clone().add(V3(0, 0, 0.02)));
    setA('fixAnchorStitch', Pm.clone().addScaledVector(nM, R_T));
    setA('fixAnchorKnot', g.ak.c);
    for (let k = 1; k <= 3; k++) { frameAt(g.knots[k].s); setA('fixCross' + k, FR.c.clone().addScaledVector(FR.U, g.rhoK + RK)); }
    { frameAt(s3); setA('fixFinalKnot', FR.c.clone().addScaledVector(FR.U, g.rhoK + RK * 1.6)); }
    g.wings.forEach((w, i) => setA(i === 0 ? 'fixWingStitchA' : 'fixWingStitchB', w.knotC));
    // orifícios e halo
    clearGroup(markGrp);
    for (const q of [P1, P2]) {
      const nq = nrm(kZ, q.x, q.y, 0.2), quat = new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), nq);
      const d = C.mesh(new THREE.CircleGeometry(0.034, 14), mats.puncture, markGrp, infoAnchor, { cast: false });
      d.position.copy(q).addScaledVector(nq, 0.006); d.quaternion.copy(quat);
      const h = C.mesh(new THREE.CircleGeometry(0.09, 20), mats.halo, markGrp, infoAnchor, { cast: false });
      h.position.copy(q).addScaledVector(nq, 0.004); h.quaternion.copy(quat);
    }
    // sítio de saída: halo róseo discreto e anel fino escuro (crosta/fibrina) rente ao cateter — elipse da secção oblíqua
    { const nq = nrm(kZ, g.exit.x, g.exit.y, 0.25), ed = v3(ext.exitDir).normalize();
      const Xr = ed.clone().addScaledVector(nq, -ed.dot(nq)).normalize(), Yr = V3().crossVectors(nq, Xr), sinA = Math.max(0.3, Math.abs(ed.dot(nq)));
      const quat = quatFromBasis(Xr, Yr, nq), infoExit = GI({ id: 'catheter', name: 'Sítio de saída do cateter na pele' });
      const h = C.mesh(new THREE.CircleGeometry(0.3, 28), mats.exitHalo, markGrp, infoExit, { cast: false });
      h.position.copy(g.exit).addScaledVector(nq, 0.004); h.quaternion.copy(quat); h.scale.set(1.25, 1, 1); h.userData.exitMark = true;
      const r = C.mesh(new THREE.RingGeometry(g.rC * 1.0, g.rC * 1.22, 28), mats.crust, markGrp, infoExit, { cast: false });
      r.position.copy(g.exit).addScaledVector(nq, 0.005); r.quaternion.copy(quat); r.scale.set(1 / sinA, 1, 1); r.userData.exitMark = true; }
    // dedo no canhão: polpa sobre o corpo do canhão, atrás do nariz; dedo subindo para lateral e para trás
    { const base = hubC.clone().addScaledVector(hubY, -0.3); let h = 0.1; for (let i = 0; i < 60 && hubDist(base.clone().addScaledVector(hubN, h)) < 0.004; i++) h += 0.01;
      const X = hubY.clone().multiplyScalar(-0.5).addScaledVector(hubX, 0.6).addScaledVector(hubN, 0.45);
      g.fingerPose = framePose(base.clone().addScaledVector(hubN, h - 0.004), X.addScaledVector(hubN, -X.dot(hubN) * 0.55), hubN); }
    // conferência: anel fino na marca em cm rente à pele (leitura do comprimento) e seta da tração suave no canhão
    clearGroup(checkGrp);
    { frameAt(0.07); const ring = C.mesh(new THREE.TorusGeometry(g.rC * 1.85, 0.022, 8, 40), mats.check, checkGrp, GI({ id: 'catheter', name: 'Marca em cm do cateter rente à pele (conferência)' }), { cast: false, receive: false });
      ring.position.copy(FR.c); ring.quaternion.copy(quatFromBasis(FR.B, FR.U, FR.T)); // (B, U, T) é base dextrógira: eixo do anel = T
      ring.userData.exitMark = true; ring.renderOrder = 14; // exitMark: fora do mapa de altura do curativo
      const infoPull = GI({ id: 'operator-hand', name: 'Tração suave e breve no canhão (conferência)' }), arrow = new THREE.Group();
      const shaft = new THREE.CylinderGeometry(0.035, 0.035, 0.75, 10); shaft.translate(0, 0.375, 0);
      const head = new THREE.ConeGeometry(0.11, 0.3, 14); head.translate(0, 0.9, 0);
      for (const gg of [shaft, head]) { const m = C.mesh(gg, mats.check, arrow, infoPull, { cast: false, receive: false }); m.renderOrder = 14; }
      arrow.quaternion.setFromUnitVectors(V3(0, 1, 0), hubY.clone().negate());
      // acima do eixo, entre o nariz do canhão e o nó final, apontando para trás (sentido da tração, para fora do sítio):
      // fora do dedo, que apoia o corpo do canhão atrás do nariz e sobe para lateral
      const a0 = hubC.clone().addScaledVector(hubY, 2.3).addScaledVector(hubN, 0.75);
      arrow.position.copy(a0); checkGrp.add(arrow); C.reg(arrow, infoPull);
      checkGrp.userData.arrow = arrow; checkGrp.userData.arrow0 = a0; }
    buildWingStitches(g); mk('wingGeo');
    g.dressing = null; g.reload = null; // refeitos sob demanda
    layoutVer++;
    return true;
  }

  /* ---- ponto da hélice do nó de ancoragem (κ = aperto 0..1) ---- */
  function akPt(g, X, w, kap, out) {
    const A = g.ak, lift = (1 - kap) * 0.45, half = A.half + (1 - kap) * 0.1, rk = RK * (1 + BULGE * (1 - w * w)) + (1 - kap) * 0.12;
    let psi = A.b * kap * (w + 1); if (X === 'B') psi += PI;
    return out.copy(A.c).addScaledVector(A.ax, w * half).addScaledVector(A.n, lift + rk * Math.cos(psi)).addScaledVector(A.q, rk * Math.sin(psi));
  }
  /* ---- ponto da hélice de um nó de cruzamento k (A percorre w −1→+1; B, +1→−1) ---- */
  function knotPt(k, X, w, kap, lam, out) {
    const K = G.knots[k]; frameAt(K.s);
    const phi = K.th * w, cu = Math.cos(phi), su = Math.sin(phi);
    const b = K.b * kap; let psi = -PI / 2 + b + b * w; if (X === 'B') psi += PI;
    const rk = RK * (1 + BULGE * (1 - w * w)), rho = G.rhoK + lam * LOOSE;
    const rr = rho + rk * Math.cos(psi);
    return out.copy(FR.c).addScaledVector(FR.U, rr * cu + lam * LIFT).addScaledVector(FR.B, rr * su).addScaledVector(FR.T, rk * Math.sin(psi));
  }
  /** Valores (s, ρ) de uma extremidade do nó k, para emendar com a volta helicoidal. */
  function knotEnd(k, X, w, kap) {
    const K = G.knots[k], b = K.b * kap; let psi = -PI / 2 + b + b * w; if (X === 'B') psi += PI;
    return { s: K.s + RK * Math.sin(psi), rho: G.rhoK + RK * Math.cos(psi) };
  }

  /** Folga de uma pose do porta-agulha: menor altura das sondas sobre a superfície e menor distância ao cateter/canhão. */
  function poseClear(pose, probes) {
    let skin = Infinity, cath = Infinity, hub = Infinity; const q = V3();
    for (const pr of probes) {
      q.copy(pr).applyQuaternion(pose.q).add(pose.p);
      const hz = q.z - sZ(q.x, q.y); skin = Math.min(skin, hz);
      if (G && G.hubC) hub = Math.min(hub, hubDist(q));
      if (G && G.cseg && hz < 1.5) cath = Math.min(cath, cathDist(q));
    }
    return { skin, cath, hub };
  }
  const holderClear = (pose) => poseClear(pose, HOLDER_PROBES);
  /* ---- poses da agulha / porta-agulha ---- */
  const RZ = (th) => new THREE.Quaternion().setFromAxisAngle(V3(0, 0, 1), th);
  function needlePose(plane, th) { return { p: plane.C.clone(), q: plane.q0.clone().multiply(RZ(th)) }; }
  const swagePt = (np) => V3(RN * Math.cos(-ARC), RN * Math.sin(-ARC), 0).applyQuaternion(np.q).add(np.p);
  const swageTan = (np) => V3(Math.sin(-ARC), -Math.cos(-ARC), 0).applyQuaternion(np.q).normalize(); // sai do engaste para trás
  /** Porta-agulha preso à agulha no ângulo β (rel. à ponta), com rolagem γ em torno da tangente da agulha. */
  function holderOnNeedle(np, beta, gamma, sX) {
    const cb = Math.cos(beta), sb = Math.sin(beta);
    const g0 = V3(RN * cb, RN * sb, 0), rin = V3(-cb, -sb, 0), zz = V3(0, 0, sX);
    const X = zz.clone().multiplyScalar(Math.cos(gamma)).addScaledVector(rin, Math.sin(gamma)).normalize();
    const Y = rin.clone().multiplyScalar(Math.cos(gamma)).addScaledVector(zz, -Math.sin(gamma)).normalize();
    const Z = V3().crossVectors(X, Y);
    const ql = quatFromBasis(X, Y, Z);
    return { p: np.p.clone().add(g0.applyQuaternion(np.q)), q: np.q.clone().multiply(ql) };
  }
  /** Pinça presa ao corpo da agulha a βF da ponta (βF < 0, ≥ MIN_GRIP), com as hastes dos dois lados do fio da agulha
      (abertura Y ⟂ tangente). γF gira as hastes em torno da tangente, para o lado oposto ao porta-agulha; αF inclina o
      cabo rumo à ponta. A agulha fica 0,045 cm para dentro da extremidade das hastes. */
  function forcepsOnNeedle(np, bF, gF, aF, sX) {
    const cb = Math.cos(bF), sb = Math.sin(bF);
    const g0 = V3(RN * cb, RN * sb, 0), tg = V3(-sb, cb, 0), rin = V3(-cb, -sb, 0), nz = V3(0, 0, sX);
    const Y = nz.clone().multiplyScalar(Math.cos(gF)).addScaledVector(rin, Math.sin(gF));
    const w = rin.clone().multiplyScalar(Math.cos(gF)).addScaledVector(nz, -Math.sin(gF));
    const X = w.multiplyScalar(Math.cos(aF)).addScaledVector(tg, -Math.sin(aF)).normalize();
    const Z = V3().crossVectors(X, Y);
    const ql = quatFromBasis(X, Y, Z);
    return { p: np.p.clone().add(g0.addScaledVector(X, -0.045).applyQuaternion(np.q)), q: np.q.clone().multiply(ql) };
  }
  /* cápsulas (referencial local) do porta-agulha e da pinça: folga aproximada entre os dois instrumentos */
  const HOLDER_CAPS = [], FORCEPS_CAPS = [];
  for (const sg of [1, -1]) {
    HOLDER_CAPS.push([V3(-0.12, sg * (GAP + 0.05), 0), V3(0.6, sg * (GAP + 0.07), 0), 0.11], [V3(0.6, sg * (GAP + 0.07), 0), V3(1.82, sg * (GAP + 0.1), 0), 0.16],
      [V3(2.5, sg * 0.1, 0), V3(7.6, sg * 0.31, 0), 0.17], [V3(7.6, sg * 0.31, 0), V3(12.5, sg * 0.84, 0), 0.15]);
    FORCEPS_CAPS.push([V3(0, sg * 0.04, 0), V3(1.5, sg * 0.06, 0), 0.07], [V3(1.5, sg * 0.06, 0), V3(4, sg * 0.14, 0), 0.13], [V3(4, sg * 0.14, 0), V3(7.5, sg * 0.3, 0), 0.33], [V3(7.5, sg * 0.3, 0), V3(12, 0.05, 0), 0.33]);
  }
  HOLDER_CAPS.push([V3(1.72, 0, 0), V3(2.68, 0, 0), 0.26]);
  /** Distância entre segmentos [a0,a1] e [b0,b1]. */
  function segSeg(a0, a1, b0, b1) { // sem alocações (chamada milhares de vezes no planejamento)
    const d1x = a1.x - a0.x, d1y = a1.y - a0.y, d1z = a1.z - a0.z, d2x = b1.x - b0.x, d2y = b1.y - b0.y, d2z = b1.z - b0.z, rx = a0.x - b0.x, ry = a0.y - b0.y, rz = a0.z - b0.z;
    const a = d1x * d1x + d1y * d1y + d1z * d1z, e = d2x * d2x + d2y * d2y + d2z * d2z, f = d2x * rx + d2y * ry + d2z * rz, c = d1x * rx + d1y * ry + d1z * rz, b = d1x * d2x + d1y * d2y + d1z * d2z, den = a * e - b * b;
    let s = den > 1e-9 ? clamp((b * f - c * e) / den, 0, 1) : 0, t = e > 1e-9 ? (b * s + f) / e : 0;
    if (t < 0) { t = 0; s = a > 1e-9 ? clamp(-c / a, 0, 1) : 0; } else if (t > 1) { t = 1; s = a > 1e-9 ? clamp((b - c) / a, 0, 1) : 0; }
    return Math.hypot(rx + d1x * s - d2x * t, ry + d1y * s - d2y * t, rz + d1z * s - d2z * t);
  }
  const capsAt = (caps, pose) => caps.map(([a, b, r]) => [a.clone().applyQuaternion(pose.q).add(pose.p), b.clone().applyQuaternion(pose.q).add(pose.p), r]);
  /** Folga aproximada (cápsulas) entre a pinça (pose fp) e o trecho externo do cateter. */
  function forcepsCathGap(fp) {
    const F = capsAt(FORCEPS_CAPS, fp), S = G.cseg; let m = Infinity; const a = V3(), b = V3();
    for (let i = 0; i < S.length - 3; i += 3) { a.set(S[i], S[i + 1], S[i + 2]); b.set(S[i + 3], S[i + 4], S[i + 5]); for (const [p0, p1, r] of F) m = Math.min(m, segSeg(p0, p1, a, b) - r - G.rC); }
    return m;
  }
  /** Folga aproximada (cápsulas) entre o porta-agulha (pose hp) e a pinça (pose fp). */
  function instrGap(hp, fp) {
    const H = capsAt(HOLDER_CAPS, hp), F = capsAt(FORCEPS_CAPS, fp); let m = Infinity;
    for (const [a0, a1, ra] of H) for (const [b0, b1, rb] of F) m = Math.min(m, segSeg(a0, a1, b0, b1) - ra - rb);
    return m;
  }
  const FORCEPS_TIP_PROBES = FORCEPS_PROBES.concat([V3(-0.025, 0, 0), V3(-0.02, 0.045, 0.04), V3(-0.02, -0.045, 0.04), V3(-0.02, 0.045, -0.04), V3(-0.02, -0.045, -0.04)]);
  /** Planeja uma passagem: pega posterior (β = bPost) até as mandíbulas encostarem na pele (a ponta sai); repega o corpo
      exteriorizado (β = bAnt, ≥ MIN_GRIP da ponta). Se a repega cabe com a agulha parada (corpo exteriorizado longo o
      bastante), o porta-agulha solta e repega sem que a agulha se mova. Senão, a PINÇA prende o corpo exteriorizado
      (≥ MIN_GRIP da ponta, nunca a ponta) e extrai a agulha acompanhando a curva até a repega caber (ps.assist): a
      agulha só se move presa a um instrumento. */
  function planPass(plane, thIn, thOut, shaft, opt) {
    const pl = plane, BP = opt.bPost, log = [];
    const clr = (th, beta, gam, mSkin = 0.05) => { const c = holderClear(holderOnNeedle(needlePose(pl, th), beta, gam, pl.sX)); return Math.min(c.skin - mSkin, c.cath - 0.05, c.hub - 0.04); };
    let thDrive = thIn;
    for (let th = thIn; th <= thOut + ARC; th += 0.04) { if (clr(th, BP, 0, DRIVE_SKIN) < 0) { log.push({ stopAt: +th.toFixed(3) }); break; } thDrive = th; }
    for (let th = thDrive + 0.01; th < thDrive + 0.04; th += 0.01) { if (clr(th, BP, 0, DRIVE_SKIN) < 0) break; thDrive = th; } // refino
    const thSwOut = thOut + ARC + 0.16;
    // corpo exteriorizado curto demais para a pinça prender ≥ MIN_GRIP da ponta: plano descartado (sem varrer repegas)
    if (opt.minTipOut && thDrive - thOut < opt.minTipOut) return { plane: pl, thIn, thOut, thDrive, bPost: BP, bAnt: opt.bAnt, gAnt: 0, thA: thOut + 0.9, thSwOut, bad: true, shaft, log, assist: null };
    let best = null, still = null;
    for (const bdeg of opt.bAntList || [opt.bAnt * 180 / PI]) for (const gam of [0, -0.3, 0.3]) {
      const beta = (bdeg * PI) / 180; if (-beta < MIN_GRIP) continue;
      if (gam && log.some((e) => e.bdeg === bdeg && e.gam === 0 && e.thA !== null)) continue; // rolagem só se a pega reta falha
      const th0 = Math.max(thDrive, thOut - beta + 0.04), st = 0.04;
      const nst = Math.max(1, Math.ceil((thSwOut - th0) / st)); let thA = null;
      for (let i = nst; i >= 0; i--) { const th = th0 + i * st; if (clr(th, beta, gam) < 0) break; thA = th; }
      if (thA !== null && thA > th0 + 1e-6) for (let th = thA - 0.01; th > thA - st && th >= th0 - 1e-6; th -= 0.01) { if (clr(th, beta, gam) < 0) break; thA = th; } // refino
      log.push({ bdeg, gam, thA: thA === null ? null : +thA.toFixed(3) });
      if (thA === null) continue;
      const cost = thA + Math.abs(gam) * 0.1 + Math.abs(bdeg - opt.bAnt * 180 / PI) * 0.03, c = { beta, gam, thA, cost };
      if (thA <= thDrive + 1e-6 && (!still || cost < still.cost)) still = c;
      if (!best || cost < best.cost) best = c;
    }
    if (still) best = still;
    const bad = !best;
    if (!best) best = { beta: opt.bAnt, gam: 0, thA: Math.max(thDrive, thOut + 0.9) };
    const ps = { plane: pl, thIn, thOut, thDrive, bPost: BP, bAnt: best.beta, gAnt: best.gam, thA: Math.max(best.thA, thDrive), thSwOut, bad, shaft, log };
    ps.assist = ps.thA > thDrive + 1e-3 ? planAssist(ps) : null;
    return ps;
  }
  /** Pega da pinça no corpo exteriorizado (βF, γF, αF) com a maior folga — pele/campo, cateter, canhão e porta-agulha
      (pega posterior no início, anterior no fim) — durante a extração de thDrive a thA. */
  function planAssist(ps) {
    const pl = ps.plane, sX = pl.sX; let best = null;
    const h0 = holderOnNeedle(needlePose(pl, ps.thDrive), ps.bPost, 0, sX), h1 = holderOnNeedle(needlePose(pl, ps.thA), ps.bAnt, ps.gAnt, sX);
    // ordem de preferência (hastes no plano da agulha, perto de 0,3 rad da ponta): para na 1ª com folga confortável e
    // cabo bem acima da pele em toda a extração (a pinça gira com a agulha; elevação mínima do cabo ≥ ~25°)
    const combos = []; for (const gF of [0, 0.35, 0.7, 1.0]) for (const aF of [-0.75, -0.55, -0.3, 0]) for (const bF of [-0.3, -0.34]) combos.push([bF, gF, aF]);
    for (const [bF, gF, aF] of combos) {
      if (best && best.m >= -0.012 && best.elev >= 0.42) break; // pontas a ≥ 0 da pele e cabo ≥ 24°: basta
      let m = Infinity, mSkin = Infinity, elev = Infinity;
      for (let i = 0; i <= 6; i++) {
        const th = lerp(ps.thDrive, ps.thA, i / 6), fp = forcepsOnNeedle(needlePose(pl, th), bF, gF, aF, sX), c = poseClear(fp, FORCEPS_TIP_PROBES);
        mSkin = Math.min(mSkin, c.skin); m = Math.min(m, c.skin - 0.012, c.cath - 0.04, c.hub - 0.04, forcepsCathGap(fp) - 0.03);
        elev = Math.min(elev, Math.asin(clamp(V3(1, 0, 0).applyQuaternion(fp.q).z, -1, 1)));
      }
      const g0 = instrGap(h0, forcepsOnNeedle(needlePose(pl, ps.thDrive), bF, gF, aF, sX)), g1 = instrGap(h1, forcepsOnNeedle(needlePose(pl, ps.thA), bF, gF, aF, sX));
      m = Math.min(m, g0 - 0.03, g1 - 0.03);
      const score = Math.min(m, 0.25) + 0.3 * Math.min(elev, 0.42) - 0.02 * gF - 0.05 * Math.abs(bF + 0.3) - (m < 0 ? 1 : 0);
      if (!best || score > best.score) best = { bF, gF, aF, m: +m.toFixed(3), skin: +mSkin.toFixed(3), gap0: +g0.toFixed(3), gap1: +g1.toFixed(3), elev: +elev.toFixed(2), score };
    }
    return best;
  }
  /** Poses de uma passagem em função do subtempo. hold: instrumento(s) que seguram a agulha. */
  function passPoses(ps) {
    const pl = ps.plane, sX = pl.sX, A = ps.assist;
    const entry = needlePose(pl, ps.thIn);
    const fAt = (th) => forcepsOnNeedle(needlePose(pl, th), A.bF, A.gF, A.aF, sX);
    // recuo da pinça pelo cabo: primeiro só ao longo do eixo (a agulha sai pela ponta das hastes abertas), depois sobe
    const fBack = (pose, d) => { const X = V3(1, 0, 0).applyQuaternion(pose.q); return movePose(pose, X.multiplyScalar(0.35 * d).addScaledVector(UPZ, 0.55 * ss(d, 0.35, 1))); };
    const fAx = (pose, d) => movePose(pose, V3(1, 0, 0).applyQuaternion(pose.q).multiplyScalar(d));
    const HX = (pose) => V3(1, 0, 0).applyQuaternion(pose.q);
    /** Porta-agulha entre a pega a e a pega b: recua JAW_BACK pelo próprio eixo (a agulha sai pela ponta das mandíbulas
        entreabertas), translada com arco por cima e chega pelo eixo (a agulha entra entre as mandíbulas). r0..r1: recuo;
        e0..e1: translado; c0..c1: chegada. */
    const JAW_BACK = 0.3, JAW_OPEN = 0.06;
    const holderPath = (a, b, u, r0, r1, e0, e1, c0, c1) => {
      const eH = ss(u, e0, e1), rB = ss(u, r0, r1), rC = 1 - ss(u, c0, c1);
      const hp = lerpPose(a, b, eH);
      hp.p.addScaledVector(HX(a), JAW_BACK * rB * (1 - eH)).addScaledVector(HX(b), JAW_BACK * rC * eH);
      hp.p.addScaledVector(UPZ, 0.9 * Math.sin(PI * eH)).addScaledVector(ps.shaft, 0.6 * Math.sin(PI * eH));
      // mandíbulas: abrem ao soltar, fecham no translado, abrem de novo antes de receber a agulha e fecham sobre ela
      const jaw = JAW_OPEN * Math.max(ss(u, r0, r0 + 0.3 * (r1 - r0)) * (1 - ss(u, e0 + 0.15 * (e1 - e0), e0 + 0.35 * (e1 - e0))), ss(u, e0 + 0.7 * (e1 - e0), e1 - 0.1 * (e1 - e0)) * (1 - ss(u, c1 - 0.25 * (c1 - c0), c1 + 0.12 * (c1 - c0))));
      return { hp, jaw };
    };
    return {
      ready: (d) => { const np = movePose(entry, UPZ.clone().multiplyScalar(d).addScaledVector(pl.e1, -0.3 * d)); return { np, hp: holderOnNeedle(np, ps.bPost, 0, sX), hold: 'holder' }; },
      drive: (th) => { const np = needlePose(pl, th); return { np, hp: holderOnNeedle(np, ps.bPost, 0, sX), hold: 'holder' }; },
      /** Repega (u ∈ [0, 1]). Sem assistência: a agulha fica parada enquanto o porta-agulha passa da pega posterior
          à anterior. Com assistência: 0–0,22 a pinça chega aberta (entra pelo eixo do cabo) e prende o corpo
          exteriorizado (o porta-agulha ainda segura); 0,24 o porta-agulha solta (abre a mandíbula e recua pelo próprio
          eixo: a agulha sai pela ponta das mandíbulas); 0,26–0,62 a pinça extrai a agulha pela curva; 0,68–0,78 o
          porta-agulha chega pelo eixo e prende o corpo; 0,8–0,86 a pinça abre; 0,86–1 recua pelo cabo. Nenhum
          instrumento atravessa o outro nem a agulha (w2fix_fixation_hf3.js). */
      regrasp: (u) => {
        const a = holderOnNeedle(needlePose(pl, ps.thDrive), ps.bPost, 0, sX), b = holderOnNeedle(needlePose(pl, ps.thA), ps.bAnt, ps.gAnt, sX);
        let th = ps.thDrive, fp = null, fOpen = F_OPEN, hold, H;
        if (!A) { H = holderPath(a, b, u, 0.1, 0.2, 0.18, 0.82, 0.8, 0.9); hold = u < 0.1 || u >= 0.9 ? 'holder' : null; }
        else {
          th = lerp(ps.thDrive, ps.thA, ss(u, 0.26, 0.62)); H = holderPath(a, b, u, 0.24, 0.32, 0.3, 0.7, 0.68, 0.78);
          // hastes entreabertas (0,14 cm) junto à pele: abrem só o bastante para envolver a agulha; a última parte da
          // chegada e a primeira do recuo correm ao longo do cabo (a agulha entra/sai pela ponta das hastes)
          const f0 = fAt(ps.thDrive);
          if (u < 0.22) { fp = kfPose(u, [[0, fBack(f0, 1)], [0.12, fAx(f0, 0.3)], [0.18, f0]]); fOpen = lerp(F_OPEN, NEEDLE_GAP, ss(u, 0.14, 0.18)); } // fecham até NEEDLE_GAP (> Ø da agulha) durante a entrada axial
          else if (u < 0.86) { fp = withAxes(fAt(th)); fOpen = lerp(NEEDLE_GAP, F_OPEN, ss(u, 0.8, 0.86)); }
          else { fp = withAxes(fBack(fAt(ps.thA), ss(u, 0.86, 1))); fOpen = F_OPEN; }
          hold = u < 0.22 ? 'holder' : u < 0.24 ? 'both' : u < 0.78 ? 'forceps' : u < 0.82 ? 'both' : 'holder';
        }
        return { np: needlePose(pl, th), hp: H.hp, jaw: H.jaw, th, fp, fOpen, hold };
      },
      /** Pose de chegada/saída da pinça (recuada pelo cabo) junto à agulha em thDrive / thA. */
      fPre: () => (A ? withAxes(fBack(fAt(ps.thDrive), 1)) : null),
      fPost: () => (A ? withAxes(fBack(fAt(ps.thA), 1)) : null),
      ant: (th) => { const np = needlePose(pl, th); return { np, hp: holderOnNeedle(np, ps.bAnt, ps.gAnt, sX), hold: 'holder' }; },
    };
  }
  /** Plano de enrolamento: centro das espiras nas mandíbulas, ângulo inicial voltado para a origem do fio. */
  function wrapPlan(tp, from) {
    const Cw = tp.p.clone().addScaledVector(tp.X, COIL_X0), d = from.clone().sub(Cw);
    return { psi0: Math.atan2(d.dot(tp.Z) / COIL_R2, d.dot(tp.Y) / COIL_R1), sgn: 1 };
  }
  /** Ponto da espiral nas mandíbulas (referencial do porta-agulha) e ponto do círculo da pinça ao enrolar. */
  function coilPt(cp, psi, out = V3()) {
    const tp = cp.pose, x = cp.x0 + COIL_PITCH * Math.abs(psi - cp.psi0) / TWO_PI;
    return out.copy(tp.p).addScaledVector(tp.X, x).addScaledVector(tp.Y, COIL_R1 * Math.cos(psi)).addScaledVector(tp.Z, COIL_R2 * Math.sin(psi));
  }
  function wrapCirclePt(tp, plan, psi) {
    const x = COIL_X0 + COIL_PITCH * Math.abs(psi - plan.psi0) / TWO_PI;
    return tp.p.clone().addScaledVector(tp.X, x).addScaledVector(tp.Y, WRAP_R * Math.cos(psi)).addScaledVector(tp.Z, WRAP_R * Math.sin(psi));
  }

  /* ---- pontos nas asas: geometria estática (crescimento por drawRange) e passagem da agulha ---- */
  function planWing(g, H, i) {
    const lx = H.clone().sub(g.hubC).dot(g.hubX), sgn = Math.sign(lx) || (i ? 1 : -1);
    const o = g.hubX.clone().multiplyScalar(sgn), nh = g.hubN.clone(), yh = g.hubY.clone();
    // haste para fora do canhão (e um pouco para cima); a pegada corre ao longo do eixo do canhão, rumo ao nariz (+y).
    // a0 (posição do furo no círculo, a partir do fundo) fixa a profundidade: a agulha passa pelo furo da asa, entra na
    // pele logo abaixo dela e sai à frente da asa — pegada dérmica de ~0,15–0,35 cm abaixo da pele
    let best = null;
    const cands = [];
    for (const deg of [0, 20, 10, 30]) { const row = [72, 66, 78, 60, 84].map((a0) => planWingTilt(g, H, i, o, nh, yh, (deg * PI) / 180, a0, BPOST)); row.sort((a, b) => Math.abs(a.depth - 0.22) - Math.abs(b.depth - 0.22)); cands.push(...row); }
    // pega posterior mais perto do engaste só se a de sempre não serve (mesma geometria)
    for (const w of cands.slice()) if (w.geoOk) cands.push(Object.assign({}, w, { bPost: -160 * PI / 180 }));
    // geometria válida primeiro (na ordem de preferência); a passagem (cara) só é planejada para essas
    for (const w of cands.filter((c) => c.geoOk).concat(cands.filter((c) => !c.geoOk))) {
      planWingPass(w);
      const okA = !w.ps.assist || w.ps.assist.m >= 0;
      if (w.geoOk && okA && !w.ps.bad) return w;
      const sc = (w.geoOk ? 0 : 10) + (w.ps.bad ? 5 : 0) + Math.abs(w.depth - 0.25) + (okA ? 0 : 2 - w.ps.assist.m);
      if (!best || sc < best.sc) { best = w; best.sc = sc; }
      if (!w.geoOk) break; // nenhuma geometria válida: fica com a melhor já avaliada
    }
    return best;
  }
  function planWingTilt(g, H, i, o, nh, yh, TW, a0, bPost) {
    const shaft = o.clone().multiplyScalar(Math.cos(TW)).addScaledVector(nh, Math.sin(TW)).normalize();
    const e1w = yh.clone().addScaledVector(shaft, -yh.dot(shaft)).normalize();
    let e2w = V3().crossVectors(shaft, e1w).normalize(); if (e2w.dot(nh) < 0) e2w.negate();
    const NZ = V3().crossVectors(e1w, e2w);
    const aa = a0 * PI / 180, cdir = e1w.clone().multiplyScalar(Math.sin(aa)).addScaledVector(e2w, Math.cos(aa));
    const Cw = H.clone().addScaledVector(cdir, RN);
    const plane = { C: Cw, e1: e1w, e2: e2w, NZ, q0: quatFromBasis(e1w, e2w, NZ), sX: Math.sign(NZ.dot(shaft)) || 1 };
    const pt = (th) => Cw.clone().addScaledVector(e1w, RN * Math.cos(th)).addScaledVector(e2w, RN * Math.sin(th));
    const thH = Math.atan2(-Math.cos(aa), -Math.sin(aa));
    let thN = null, thF = null, depth = 0;
    for (let th = thH; th < thH + PI; th += 0.004) { const q = pt(th), d = q.z - kZ(q.x, q.y); if (thN !== null && thF === null) depth = Math.max(depth, -d); if (thN === null && d < 0) thN = th; else if (thN !== null && d > 0) { thF = th; break; } }
    const skinBite = thN !== null && thF !== null;
    if (thN === null) { thN = thH + 0.15; thF = thH + 1.6; } if (thF === null) thF = thN + 1.2;
    const Pn = pt(thN), Pf = pt(thF);
    const underDrape = sZ(Pf.x, Pf.y) - kZ(Pf.x, Pf.y) > 0.06 || sZ(H.x, H.y) - kZ(H.x, H.y) > 0.06;
    // nó sobre a asa, entre o orifício (r = 0,14) e a borda anterior da asa (0,55 à frente do centro do orifício)
    const top = H.clone().addScaledVector(nh, 0.1);
    const knotC = top.clone().addScaledVector(yh, 0.29).addScaledVector(nh, R_T + RK * (1 + BULGE) + 0.003);
    const w = { H, o, nh, yh, top, knotC, plane, Pn, Pf, thN, thF, thH, underDrape, ps: null, idx: i, tilt: TW, a0, depth, skinBite, shaft, bPost };
    w.geoOk = skinBite && depth >= 0.13 && depth <= 0.35 && thF - thN > 0.5;
    return w;
  }
  function planWingPass(w) {
    w.ps = planPass(w.plane, w.thH - 0.42, w.thF, w.shaft, { bPost: w.bPost, bAnt: -40 * PI / 180, bAntList: [-40, -30, -22, -18], minTipOut: MIN_GRIP + 0.12 });
    return w;
  }
  function buildWingStitches(g) {
    clearGroup(wingGrp);
    for (const w of g.wings) {
      const { o, nh, yh, knotC } = w;
      const pt = (th) => w.plane.C.clone().addScaledVector(w.plane.e1, RN * Math.cos(th)).addScaledVector(w.plane.e2, RN * Math.sin(th));
      // nó com eixo ao longo do canhão: W1 entra pela extremidade posterior (w = −1), W2 pela anterior (w = +1)
      const kp = (X, ww) => { const b = 1.5 * PI, rk = RK * (1 + BULGE * (1 - ww * ww)); let psi = -PI / 2 + b + b * ww; if (X === 'B') psi += PI; return knotC.clone().addScaledVector(yh, ww * 0.1).addScaledVector(nh, rk * Math.cos(psi)).addScaledVector(o, rk * Math.sin(psi)); };
      const thM = (w.thN + w.thF) / 2, clampUp = (q) => { q.z = Math.max(q.z, sZ(q.x, q.y) + R_T + 0.004); return q; };
      // W1: meio da pegada → orifício proximal (sob o orifício da asa) → sobe pelo orifício → nó → ponta curta (para fora e à frente)
      const p1 = []; for (let k = 0; k <= 14; k++) p1.push(pt(lerp(thM, w.thN, k / 14)));
      const hb = w.H.clone().addScaledVector(nh, -0.11), ht = w.H.clone().addScaledVector(nh, 0.13);
      p1.push(hb.clone().lerp(w.Pn, 0.3), w.H.clone(), ht, kp('A', -1).addScaledVector(yh, -0.07).addScaledVector(nh, 0.005));
      for (let k = 0; k <= 24; k++) p1.push(kp('A', -1 + 2 * k / 24));
      { const e = kp('A', 1), d = yh.clone().multiplyScalar(0.55).addScaledVector(o, 0.83).normalize(); for (let k = 1; k <= 8; k++) { const sg = (k / 8) * 0.45; p1.push(clampUp(e.clone().addScaledVector(d, sg).addScaledVector(nh, -0.5 * sg * sg))); } }
      // W2: meio → orifício distal (à frente da asa) → sobe e passa sobre a borda anterior → nó → ponta curta (para fora e para trás, sobre a asa)
      const p2 = []; for (let k = 0; k <= 14; k++) p2.push(pt(lerp(thM, w.thF, k / 14)));
      const edge = w.top.clone().addScaledVector(yh, 0.56).addScaledVector(nh, R_T + 0.012);
      p2.push(w.Pf.clone().addScaledVector(nh, 0.06).addScaledVector(yh, -0.05), edge.clone().addScaledVector(yh, 0.1).addScaledVector(nh, -0.03), edge, kp('B', 1).addScaledVector(yh, 0.06));
      for (let k = 0; k <= 24; k++) p2.push(kp('B', 1 - 2 * k / 24));
      { const e = kp('B', -1), d = yh.clone().multiplyScalar(-0.6).addScaledVector(o, 0.8).normalize(); for (let k = 1; k <= 7; k++) { const sg = (k / 7) * 0.42; p2.push(e.clone().addScaledVector(d, sg).addScaledVector(nh, 0.008 * k)); } }
      // orifício distal da pegada (fora da asa): ponto escuro com halo, visível depois do ponto
      { const nq = nrm(kZ, w.Pf.x, w.Pf.y, 0.2), quat = new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), nq);
        const dk = C.mesh(new THREE.CircleGeometry(0.03, 14), mats.puncture, wingGrp, infoWing, { cast: false }); dk.position.copy(w.Pf).addScaledVector(nq, 0.006); dk.quaternion.copy(quat);
        const hl = C.mesh(new THREE.CircleGeometry(0.08, 20), mats.halo, wingGrp, infoWing, { cast: false }); hl.position.copy(w.Pf).addScaledVector(nq, 0.004); hl.quaternion.copy(quat);
        w.marks = [dk, hl]; }
      w.meshes = [p1, p2].map((pts) => {
        const geo = C.sweepGeometry(pts, { r: R_T, radial: RAD, segments: 150, caps: 'flat', tension: 0.5 });
        const m = C.mesh(geo, mats.wing, wingGrp, infoWing);
        const segs = 150; m.userData.grow = (f) => { geo.setDrawRange(0, f >= 0.999 ? Infinity : Math.round((1 + clamp(f, 0, 1) * segs) * RAD * 6)); };
        return m;
      });
    }
  }

  /* ======================================================================
     5. Caminhos do fio (polilinhas planas x,y,z)
     ====================================================================== */
  const tmpV = V3(), tmpW = V3();
  const push = (arr, v) => { arr.push(v.x, v.y, v.z); };
  const lastV = (arr, out = V3()) => out.set(arr[arr.length - 3], arr[arr.length - 2], arr[arr.length - 1]);
  function pushCurve(arr, pts, step = 0.025, skipFirst = true) {
    const cv = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5), L = cv.getLength(), n = Math.max(2, Math.ceil(L / step));
    for (let i = skipFirst ? 1 : 0; i <= n; i++) push(arr, cv.getPointAt(i / n, tmpV));
    return L;
  }
  function pushArc(arr, plane, th0, th1, step = 0.03) {
    const n = Math.max(1, Math.ceil(Math.abs(th1 - th0) * RN / step));
    for (let i = 0; i <= n; i++) { const th = lerp(th0, th1, i / n); push(arr, tmpV.copy(plane.C).addScaledVector(plane.e1, RN * Math.cos(th)).addScaledVector(plane.e2, RN * Math.sin(th))); }
  }
  /** Comprimento acumulado de uma polilinha plana. */
  const polyLen = (a) => { let L = 0; for (let j = 3; j < a.length; j += 3) L += Math.hypot(a[j] - a[j - 3], a[j + 1] - a[j - 2], a[j + 2] - a[j - 1]); return L; };
  /** Corta uma polilinha no comprimento L (devolve a parte inicial). */
  function truncate(a, L) {
    if (L <= 0) return a.slice(0, 3);
    let acc = 0; for (let j = 3; j < a.length; j += 3) { const d = Math.hypot(a[j] - a[j - 3], a[j + 1] - a[j - 2], a[j + 2] - a[j - 1]); if (acc + d >= L) { const f = (L - acc) / (d || 1); const out = a.slice(0, j); out.push(a[j - 3] + (a[j] - a[j - 3]) * f, a[j - 2] + (a[j + 1] - a[j - 2]) * f, a[j - 1] + (a[j + 2] - a[j - 1]) * f); return out; } acc += d; }
    return a.slice();
  }
  function ptAtLen(a, L) { const t = truncate(a, L); return lastV(t); }
  /** Tangente no fim de uma polilinha (último trecho não degenerado). */
  function endTan(a, fallback) {
    const n = a.length / 3;
    for (let j = n - 2; j >= 0; j--) { const d = V3(a[(n - 1) * 3] - a[j * 3], a[(n - 1) * 3 + 1] - a[j * 3 + 1], a[(n - 1) * 3 + 2] - a[j * 3 + 2]); if (d.lengthSq() > 1e-6) return d.normalize(); }
    return fallback ? fallback.clone() : V3(0, 0, 1);
  }

  /** Trecho externo do ponto de ancoragem: A (P2 → ponte deitada → nó) e B (P1 → nó), com o nó no aperto κ. */
  function anchorPath(X, kap) {
    const g = G, an = g.anc, out = [];
    const k0 = akPt(g, X, -1, kap, V3());
    if (X === 'A') {
      const nP2 = nrm(kZ, an.P2.x, an.P2.y);
      const brA = an.P2.clone().lerp(an.P1, 0.18); brA.z = kZ(brA.x, brA.y) + R_T + 0.003;
      const brB = an.P2.clone().lerp(an.P1, 0.62); brB.z = kZ(brB.x, brB.y) + R_T + 0.003;
      const preK = k0.clone().addScaledVector(g.ak.ax, -0.12); preK.z = Math.max(preK.z - 0.02, kZ(preK.x, preK.y) + R_T + 0.003);
      pushCurve(out, [an.P2.clone(), an.P2.clone().addScaledVector(nP2, 0.05).addScaledVector(an.e1, -0.04), brA, brB, preK, k0], 0.02, false);
    } else {
      const nP1 = nrm(kZ, an.P1.x, an.P1.y);
      pushCurve(out, [an.P1.clone(), an.P1.clone().addScaledVector(nP1, 0.04), k0.clone().addScaledVector(g.ak.n, -0.02), k0], 0.015, false);
    }
    for (let i = 1; i <= 60; i++) push(out, akPt(g, X, -1 + 2 * i / 60, kap, tmpV));
    return out;
  }
  /** Caminho formado a partir da saída do nó de ancoragem: vão até o cateter, voltas e nós 1..c (o nó c com κ, λ),
      e — com ext — a descida pela lateral após o nó final. Marcas (comprimentos) do cruzamento c: lateral de origem,
      ponto por baixo, lateral oposta, início e fim do nó. */
  function formedPath(X, c, kap, lam, withExt) {
    const isA = X === 'A', g = G;
    const E = g.ancEnd[X];
    const pts = [E.x, E.y, E.z];
    const idx = { side1: 0, under: 0, side2: 0, knotStart: 0, end: 0 };
    if (c >= 1) {
      const pt = (Phi, s, rho, lm) => wrapPt(s, isA ? Phi : TWO_PI - Phi, rho, lm * LIFT, tmpV);
      const ct = g.contact[isA ? 0 : 1], Phi0 = isA ? ct.phi : TWO_PI - ct.phi;
      const lam1 = c === 1 ? lam : 0;
      const c0 = pt(Phi0, ct.s, g.rhoW + lam1 * LOOSE, lam1).clone();
      const c1 = pt(Phi0 + 0.25, ct.s + 0.012, g.rhoW + lam1 * LOOSE, lam1).clone();
      const tC = c1.clone().sub(c0).normalize(), dirIn = c0.clone().sub(E).normalize();
      pushCurve(pts, [E.clone(), E.clone().addScaledVector(g.ak.ax, 0.025).addScaledVector(dirIn, 0.05).add(V3(0, 0, 0.04)), c0.clone().addScaledVector(tC, -0.09), c0], 0.02, true);
      const iC = pts.length / 3 - 1; idx.side1 = idx.under = idx.side2 = iC;
      let PhiA = Phi0, sA = ct.s, rhoA = g.rhoW, slope = 1;
      for (let k = 1; k <= c; k++) {
        const K = g.knots[k], inK = k === c, lmK = inK ? lam : 0, kp = inK ? kap : 1;
        const PhiB = TWO_PI * k - K.th;
        const eIn = knotEnd(k, X, isA ? -1 : 1, kp);
        const n = Math.max(4, Math.ceil((PhiB - PhiA) / 0.06));
        const marks = [TWO_PI * (k - 1) + PI / 2, TWO_PI * (k - 1) + PI, TWO_PI * (k - 1) + 1.5 * PI], names = ['side1', 'under', 'side2'], got = [false, false, false];
        for (let i = 1; i <= n; i++) {
          const u = i / n, Phi = lerp(PhiA, PhiB, u);
          const h = (u * u * u - 2 * u * u + u) * slope + (-2 * u * u * u + 3 * u * u);
          const s = lerp(sA, eIn.s, h);
          let rho = g.rhoW + (rhoA - g.rhoW) * Math.exp(-(((Phi - PhiA) / 0.45) ** 2)) + (eIn.rho - g.rhoW) * Math.exp(-(((PhiB - Phi) / 0.45) ** 2));
          if (isA && k >= 2) rho += 2.3 * R_T * Math.exp(-(((Phi - (TWO_PI * (k - 1) + PI)) / 0.5) ** 2));
          const lm = k === 1 ? lmK : lmK * C.smooth(0, 0.5, u); // a frouxidão cresce a partir do nó anterior (já apertado)
          push(pts, pt(Phi, s, rho + lm * LOOSE, lm));
          if (inK) for (let m = 0; m < 3; m++) if (!got[m] && Phi >= marks[m] - 1e-6) { got[m] = true; if (marks[m] > PhiA + 1e-6) idx[names[m]] = pts.length / 3 - 1; }
        }
        if (inK) idx.knotStart = pts.length / 3 - 1;
        const nk = Math.ceil(K.th * 2 / 0.025);
        for (let i = 1; i <= nk; i++) { const w = isA ? -1 + 2 * i / nk : 1 - 2 * i / nk; push(pts, knotPt(k, X, w, kp, lmK, tmpV)); }
        if (inK) idx.end = pts.length / 3 - 1;
        const eOut = knotEnd(k, X, isA ? 1 : -1, kp);
        PhiA = TWO_PI * k + K.th; sA = eOut.s; rhoA = eOut.rho; slope = 0;
      }
      if (withExt && c === 3) {
        const K = g.knots[3], ext = PI / 2 - K.th, e = knotEnd(3, X, isA ? 1 : -1, 1);
        const n = Math.max(1, Math.ceil(ext / 0.06));
        for (let i = 1; i <= n; i++) { const Phi = TWO_PI * 3 + K.th + ext * i / n; push(pts, pt(Phi, e.s + 0.02 * i / n, lerp(e.rho, g.rhoW, i / n), 0)); }
      }
    }
    // comprimentos das marcas
    const cum = [0]; for (let j = 1; j < pts.length / 3; j++) cum.push(cum[j - 1] + Math.hypot(pts[j * 3] - pts[j * 3 - 3], pts[j * 3 + 1] - pts[j * 3 - 2], pts[j * 3 + 2] - pts[j * 3 - 1]));
    const marks = { full: cum[cum.length - 1] };
    for (const k of Object.keys(idx)) marks[k] = cum[idx[k]];
    return { pts, marks, idx };
  }
  /** Frente esperada (fim da passagem por baixo) de uma ponta no cruzamento c, para orientar o enrolamento. */
  function sideFront(X, c) { const fp = G.form[X][c]; return ptAtLen(fp.pts, fp.marks.side2); }

  /** Ponta livre a partir de J (tangente tJ), com comprimento L, até a extremidade-alvo o.H. A folga (L maior que o
      caminho) vira uma alça na direção o.bulge (para baixo/para fora: deita na pele); sem folga o fio fica esticado e,
      se não alcançar, a extremidade para antes do alvo. o.via: pontos de passagem (vão sob o cateter); o.coil: espiras
      nas mandíbulas do porta-agulha; o.top: ponto sobre o cateter (com peso); o.slack: 'first' (folga antes do 1º ponto
      de passagem) ou 'last'. Devolve { pts (sem J), end, tEnd }. */
  /** Menor distância entre o segmento ab e o eixo do trecho externo do cateter: ponto no segmento, ponto no eixo, U local. */
  function cathApproach(a, b) {
    const S = G.cseg, n = S.length / 3 - 1; let best = null;
    const d1 = V3(), d2 = V3(), r = V3(), p1 = V3(), p2 = V3();
    for (let k = 0; k < n; k++) {
      d1.subVectors(b, a); d2.set(S[k * 3 + 3] - S[k * 3], S[k * 3 + 4] - S[k * 3 + 1], S[k * 3 + 5] - S[k * 3 + 2]); r.set(a.x - S[k * 3], a.y - S[k * 3 + 1], a.z - S[k * 3 + 2]);
      const aa = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r), c = d1.dot(r), bb = d1.dot(d2), den = aa * e - bb * bb;
      let sN = den > 1e-9 ? clamp((bb * f - c * e) / den, 0, 1) : 0, tN = e > 1e-9 ? (bb * sN + f) / e : 0;
      if (tN < 0) { tN = 0; sN = aa > 1e-9 ? clamp(-c / aa, 0, 1) : 0; } else if (tN > 1) { tN = 1; sN = aa > 1e-9 ? clamp((bb - c) / aa, 0, 1) : 0; }
      p1.copy(a).addScaledVector(d1, sN); p2.set(S[k * 3], S[k * 3 + 1], S[k * 3 + 2]).addScaledVector(d2, tN);
      const dd = p1.distanceTo(p2);
      if (!best || dd < best.d) best = { d: dd, pa: p1.clone(), pc: p2.clone(), s: lerp(-0.03, G.sTip, (k + tN) / n) };
    }
    return best;
  }
  /** Ponta deitada na pele (repouso): a partir de J, vira de horiz(tJ) (ou de sp.out, se tJ aponta para o cateter ou é
      quase vertical) para sp.dir com raio sp.rT (sentido sp.turn: −1 horário, +1 anti-horário, 0 o menor), segue reta
      (sp.a, ou o que sobra para um arco de sp.phiT) e termina num arco de raio sp.R para o lado sp.side, até completar o
      comprimento L. Desce de J até a superfície nos primeiros 0,35 cm; depois fica rente à pele/campo. */
  function lieTail(J, tJ, L, sp) {
    const ds = 0.02, pts = [];
    let h0 = V3(tJ.x, tJ.y, 0);
    if (sp.force || h0.length() < 0.25 || (sp.out && h0.clone().normalize().dot(sp.out) < 0.2)) h0 = (sp.out || sp.dir).clone(); h0.z = 0; h0.normalize();
    let th = Math.atan2(h0.y, h0.x);
    let dth = Math.atan2(sp.dir.y, sp.dir.x) - th; while (dth > PI) dth -= TWO_PI; while (dth < -PI) dth += TWO_PI;
    if (sp.turn && Math.sign(dth) !== sp.turn && Math.abs(dth) > 1e-3) dth += sp.turn * TWO_PI;
    let Lt = Math.abs(dth) * sp.rT; if (Lt > L) { dth *= L / Lt; Lt = L; }
    let a = sp.a != null ? sp.a : sp.hairpin ? Math.max(0.3, (L - Lt - PI * sp.R) * sp.aFrac) : Math.max(0.3, L - Lt - sp.phiT * sp.R); a = Math.min(a, Math.max(0, L - Lt));
    const rest = Math.max(0, L - Lt - a), R = sp.hairpin ? sp.R : Math.max(sp.R, rest / (sp.phiMax || 1.6 * PI));
    const zl0 = sZ(J.x, J.y) + R_T + 0.003, dz0 = J.z - zl0;
    let x = J.x, y = J.y, s = 0;
    const emit = () => { pts.push(x, y, sZ(x, y) + R_T + 0.003 + dz0 * (1 - ss(s, 0, 0.35))); };
    const run = (len, k) => { const n = Math.max(1, Math.ceil(len / ds)), h = len / n; for (let i = 0; i < n; i++) { th += k * h / 2; x += Math.cos(th) * h; y += Math.sin(th) * h; th += k * h / 2; s += h; emit(); } };
    if (Lt > 1e-4) run(Lt, dth / Lt);
    if (a > 1e-4) run(a, 0);
    if (sp.hairpin && rest > PI * sp.R) { run(PI * sp.R, sp.side / sp.R); run(rest - PI * sp.R, 0); }
    else if (rest > 1e-4) run(rest, sp.side / R);
    const n = pts.length / 3, end = V3(pts[n * 3 - 3], pts[n * 3 - 2], pts[n * 3 - 1]);
    const tEnd = n > 1 ? end.clone().sub(V3(pts[n * 3 - 6], pts[n * 3 - 5], pts[n * 3 - 4])).normalize() : tJ.clone();
    return { pts, end, tEnd, a, R, phi: rest / R };
  }
  function freeTail(J, tJ, L, o) {
    // mistura (soltura de uma ponta esticada): a forma vai da configuração presa (o.blend.o) à de repouso (o), pelo
    // comprimento de arco, sem salto
    if (o.blend && o.blend.w > 0.001) {
      const ob = Object.assign({}, o, { blend: null }), r1 = freeTail(J, tJ, L, o.blend.o), r2 = freeTail(J, tJ, L, ob);
      if (o.blend.w >= 0.999) return r1;
      const n = Math.max(r1.pts.length, r2.pts.length) / 3 + 1, a = new Float32Array(n * 3), b = new Float32Array(n * 3);
      resample([J.x, J.y, J.z].concat(Array.from(r1.pts)), n, a); resample([J.x, J.y, J.z].concat(Array.from(r2.pts)), n, b);
      const w = o.blend.w, pts = []; for (let i = 3; i < n * 3; i++) pts.push(lerp(b[i], a[i], w));
      // pega da extremidade (keepEnd): o instrumento já segura a ponta da forma-base — a extremidade fica nela e a
      // diferença se distribui ao longo do fio (rampa quadrática), sem o instrumento "afundar" até a forma de repouso
      if (o.blend.keepEnd) { const m = pts.length / 3, dx = b[n * 3 - 3] - pts[m * 3 - 3], dy = b[n * 3 - 2] - pts[m * 3 - 2], dz = b[n * 3 - 1] - pts[m * 3 - 1]; for (let i = 0; i < m; i++) { const f = ((i + 1) / m) ** 2; pts[i * 3] += dx * f; pts[i * 3 + 1] += dy * f; pts[i * 3 + 2] += dz * f; } }
      return { pts, end: lastV(pts), tEnd: endTan(pts, tJ), gi: n - 2, grip: null }; // solta: nenhum instrumento segura
    }
    // ponta deitada em repouso (curva suave na pele)
    if (o.lie) { const r = lieTail(J, tJ, L, o.lie); return { pts: r.pts, end: r.end, tEnd: r.tEnd, gi: r.pts.length / 3 - 1, grip: null }; }
    // pegada a meio fio (aperto dos nós): o instrumento segura o fio a o.grip.Lg do início (trecho esticado até ele) e o
    // resto da ponta sai das mandíbulas e deita na pele até o.grip.H2. o.grip.k (0..1) leva a pegada da extremidade
    // (k = 0) à distância Lg — continuidade com a pegada na extremidade
    if (o.grip && o.grip.k > 0.001) {
      const Lg = lerp(L, Math.min(L, o.grip.Lg), o.grip.k);
      if (L - Lg > 0.02) {
        const t1 = freeTail(J, tJ, Lg, Object.assign({}, o, { grip: null }));
        // enquanto o trecho que sai das mandíbulas ainda não alcança o repouso, a extremidade avança pela reta rumo a ele
        // sempre com ~12 % de folga (alça leve): sem a passagem esticado → frouxo que fazia o fio "estalar" num quadro.
        // fR = mínimo suave (joelho k = 0,15) entre avail/(1,12·dd) e 1: a folga passa a crescer aos poucos ao chegar
        const avail = L - Lg, H2 = o.grip.H2, dd = t1.end.distanceTo(H2), a = dd > 1e-6 ? avail / (1.12 * dd) : 9;
        const fR = clamp((a + 1 - Math.sqrt((a - 1) ** 2 + 0.0225)) / 2, 0, 1);
        const t2 = freeTail(t1.end, t1.tEnd, avail, { H: fR >= 0.9999 ? H2 : t1.end.clone().lerp(H2, fR), bulge: o.grip.bulge2 });
        const pts = t1.pts.concat(t2.pts);
        return { pts, end: t2.end, tEnd: t2.tEnd, gi: t1.pts.length / 3 - 1, grip: t1.end.clone() };
      }
    }
    const H = o.H;
    const a0 = Math.min(0.06, Math.max(0.01, L * 0.15));
    const ctrl0 = [J.clone(), J.clone().addScaledVector(tJ, a0)];
    const seq = [];
    // desvio por cima do cateter (ponta puxada de um lado para o outro): peso contínuo pela aproximação do eixo
    let dodgeW = 0;
    if (o.dodge && !(o.coil && o.coil.w > 0.001)) {
      const nxt = H;
      const ap = cathApproach(ctrl0[1], nxt);
      if (ap) {
        frameAt(ap.s); const bJ = ctrl0[1].clone().sub(FR.c).dot(FR.B), bN = nxt.clone().sub(FR.c).dot(FR.B);
        const wSide = bJ * bN < 0 ? clamp(Math.min(Math.abs(bJ), Math.abs(bN)) / 0.08, 0, 1) : 0; // só quando atravessa de um lado ao outro
        dodgeW = wSide * (1 - ss(ap.d, G.rhoW + 0.03, G.rhoW + 0.35));
      }
    }
    if (o.via) for (const v of o.via) seq.push(v.clone());
    if (o.coil && o.coil.w > 0.001) {
      const cp = o.coil, CS = coilPt(cp, cp.psi0, V3());
      const CSw = H.clone().lerp(CS, cp.w);                       // o fio "deita" sobre as mandíbulas a partir da pinça
      if (o.top && o.top.w * cp.w > 0.001) seq.push(CSw.clone().lerp(o.top.p, o.top.w * cp.w));
      if (cp.turns > 0.02) { const nC = Math.max(2, Math.ceil(cp.turns * 20)); for (let i = 0; i <= nC; i++) { const q = coilPt(cp, cp.psi0 + cp.sgn * TWO_PI * cp.turns * i / nC, V3()); seq.push(i === 0 ? CSw.clone().lerp(q, 1) : q); } }
      else seq.push(CSw);
    }
    const slackFirst = o.slack === 'first' && seq.length > 0;
    const build = (Lt) => {
      const c0e = ctrl0[ctrl0.length - 1];
      const Pa = slackFirst ? c0e : (seq.length ? seq[seq.length - 1] : c0e);
      const Pb = slackFirst ? seq[0] : H;
      let base = 0; let prev = ctrl0[0]; for (let i = 1; i < ctrl0.length; i++) { base += prev.distanceTo(ctrl0[i]); prev = ctrl0[i]; }
      for (const q of seq) { base += prev.distanceTo(q); prev = q; } base += prev.distanceTo(H);
      let M = null; soft = false;
      if (o.bulge && base >= Lt - 1e-3) M = Pa.clone().add(Pb).multiplyScalar(0.5);
      else if (o.bulge) {
        // flecha m da alça para a folga; perto de esticar, m cresce linearmente (sem o "estalo" de √folga do fio ideal)
        const cab = Pa.distanceTo(Pb), mp = Pa.clone().add(Pb).multiplyScalar(0.5), d = o.bulge;
        const solve = (sl) => { const need = cab + sl; let lo = 0, hi = need + 0.5; for (let it = 0; it < 24; it++) { const m = (lo + hi) / 2; tmpW.copy(mp).addScaledVector(d, m); const l = Pa.distanceTo(tmpW) + tmpW.distanceTo(Pb); if (l < need) lo = m; else hi = m; } return (lo + hi) / 2; };
        const sl = Lt - base, s0 = Math.max(0.25, 0.2 * cab);
        M = mp.addScaledVector(d, sl >= s0 ? solve(sl) : solve(s0) * sl / s0);
        soft = sl < s0;
      }
      const ctrl = ctrl0.slice();
      if (slackFirst && M) ctrl.push(M);
      for (const q of seq) ctrl.push(q);
      if (!slackFirst && M) ctrl.push(M);
      ctrl.push(H.clone());
      // remove pontos de controle coincidentes (a curva centrípeta não aceita trechos nulos)
      const cl = [ctrl[0]]; for (let i = 1; i < ctrl.length; i++) if (ctrl[i].distanceToSquared(cl[cl.length - 1]) > 1e-8) cl.push(ctrl[i]);
      if (cl.length < 2) cl.push(cl[0].clone().addScaledVector(tJ, 0.01));
      const cv = new THREE.CatmullRomCurve3(cl, false, 'centripetal', 0.5);
      const nS = Math.max(8, Math.min(900, Math.ceil((base + (M ? Lt - base : 0)) / 0.018)));
      cv.arcLengthDivisions = Math.max(200, nS * 2);           // amostragem por comprimento de arco (sem cordas longas)
      const arr = []; for (let i = 0; i <= nS; i++) push(arr, cv.getPointAt(i / nS, tmpV));
      return { arr, M: !!M, soft, base, cab: Pa.distanceTo(Pb) };
    };
    let soft = false;
    let r = build(L), Lc = polyLen(r.arr);
    // correção do comprimento (a curva passa um pouco do polígono de controle), com peso contínuo pela folga: nula com o
    // fio esticado, total a partir de ~1,5 × a folga de transição — sem o "estalo" na fronteira esticado ↔ frouxo
    if (r.M && o.bulge) {
      const sl = L - r.base, s0 = Math.max(0.25, 0.2 * r.cab), wc = ss(sl, 0, 1.5 * s0);
      if (wc > 0.001) {
        let Lt = L, r2 = r, Lc2 = Lc;
        for (let it = 0; it < 3 && Math.abs(Lc2 - L) > 0.004 * L; it++) { Lt -= (Lc2 - L); r2 = build(Lt); Lc2 = polyLen(r2.arr); }
        if (wc >= 0.999) { r = r2; Lc = Lc2; } else { r = build(lerp(L, Lt, wc)); Lc = polyLen(r.arr); }
      }
    }
    let arr = r.arr;
    if (Lc > L) arr = truncate(arr, L);                       // o desvio (abaixo) não encurta o alcance da ponta
    if (dodgeW > 0.001) { // deformação suave: pontos perto do eixo sobem (em U) até passar por cima do cateter
      const q = V3(), need = G.rhoW + 0.07; let hint = null;
      for (let j = 3; j < arr.length; j += 3) {
        q.set(arr[j], arr[j + 1], arr[j + 2]); if (q.distanceToSquared(G.mid) > (G.midR + 0.4) ** 2) { hint = null; continue; }
        const i = nearestS(q, hint); hint = i; const sq = G.S0 + i * G.DS; if (sq < -0.02 || sq > G.sTip + 0.05) continue;
        frameAt(sq); const rr = q.clone().sub(FR.c), u = rr.dot(FR.U), b = rr.dot(FR.B);
        const lift = dodgeW * Math.max(0, need - u) * (1 - ss(Math.abs(b), 0.08, G.rhoW + 0.3));
        if (lift > 0) { arr[j] += FR.U.x * lift; arr[j + 1] += FR.U.y * lift; arr[j + 2] += FR.U.z * lift; }
      }
    }
    const end = lastV(arr), tEnd = endTan(arr, tJ);
    return { pts: arr.slice(3), end, tEnd, gi: arr.length / 3 - 2, grip: null };
  }

  /** Empurra pontos para fora do cateter (ρ ≥ ρ_w), por cima dos obstáculos (ponte e nó), para fora do canhão e acima da superfície. */
  function settle(arr, from, opts = {}) {
    const p = V3(); let hint = null;
    // cateter: empurra radialmente para fora (ρ ≥ rC + R_T); a busca é global (a polilinha pode saltar ao longo do
    // cateter entre pontos vizinhos, p. ex. num nó)
    const outCath = () => {
      if (opts.noCath || p.distanceToSquared(G.mid) >= (G.midR + 0.4) ** 2) return;
      let i = nearestS(p, hint); if (hint != null) { const i2 = nearestS(p, null); if (P_DIST2(p, i2) < P_DIST2(p, i)) i = i2; }
      const s = G.S0 + i * G.DS; hint = i;
      if (s > -0.02 && s < G.sTip + 0.05) {
        frameAt(s); const r = p.clone().sub(FR.c); const ax = r.dot(FR.T); r.addScaledVector(FR.T, -ax); const d = r.length();
        const need = G.rC + R_T + 0.002;
        if (d < need && d > 1e-6) p.copy(FR.c).addScaledVector(FR.T, ax).addScaledVector(r, need / d);
      }
    };
    for (let j = from * 3; j < arr.length; j += 3) {
      p.set(arr[j], arr[j + 1], arr[j + 2]);
      outCath();
      // canhão (fio de alimentação das asas)
      if (opts.hub) { for (let it = 0; it < 6 && hubDist(p) < R_T + 0.004; it++) p.addScaledVector(G.hubN, 0.03); }
      // obstáculos deitados (só para pontos rentes à superfície)
      const zs = sZ(p.x, p.y);
      if (opts.obst && p.z - zs < 0.12) for (const ob of opts.obst) {
        const ab = tmpW.copy(ob.b).sub(ob.a), l2 = ab.lengthSq(); let u = l2 > 0 ? ((p.x - ob.a.x) * ab.x + (p.y - ob.a.y) * ab.y) / (ab.x * ab.x + ab.y * ab.y || 1) : 0; u = clamp(u, 0, 1);
        const cx = ob.a.x + ab.x * u, cy = ob.a.y + ab.y * u, cz = ob.a.z + ab.z * u, dh = Math.hypot(p.x - cx, p.y - cy), R = ob.r + R_T + 0.002;
        if (dh < R) p.z = Math.max(p.z, cz + Math.sqrt(R * R - dh * dh));
      }
      p.z = Math.max(p.z, zs + R_T + 0.002);
      arr[j] = p.x; arr[j + 1] = p.y; arr[j + 2] = p.z;
    }
  }

  /** Um lado do fio no estágio amarrado (ou antes do nó, com a agulha já fora): tecido + trecho formado + ponta livre
      (ou coto após o corte). st: { anc: {kap, front}, c, kap, lam, ext, front: {A, B}, tail: {A, B}, len: {A, B}, cut }. */
  function genSide(X, st) {
    const isA = X === 'A', an = G.anc, arr = [];
    if (isA) pushArc(arr, an.plane, an.thMid, an.thOut); else pushArc(arr, an.plane, an.thMid, an.thIn);
    const nT = arr.length / 3;
    let ext, used;
    if (st.anc.front < 1 || st.anc.kap < 1) {
      const ap = st.anc.kap >= 1 ? G.ancPath[X] : anchorPath(X, st.anc.kap), Lf = polyLen(ap) * st.anc.front;
      ext = st.anc.front >= 1 ? ap.slice() : truncate(ap, Lf); used = Lf;
    }
    if (st.anc.front >= 1) {
      if (st.anc.kap >= 1) { ext = G.ancPath[X].slice(); used = G.ancLen[X]; }
      const fp = st.cutFixed ? G.form[X][3] : (st.kap >= 1 && st.lam <= 0 ? G.form[X][st.c] : formedPath(X, st.c, st.kap, st.lam, st.ext));
      const Lf = Math.min(st.front[X], fp.marks.full), tr = truncate(fp.pts, Lf);
      for (let j = 3; j < tr.length; j++) ext.push(tr[j]); used += Lf;
    }
    for (let j = 0; j < ext.length; j++) arr.push(ext[j]);
    const J = lastV(ext), tJ = endTan(ext, isA ? an.tOut : an.tIn);
    if (st.cut) {
      const stub = G.stubs[X], lifted = G.liftStub[X], w = st.cut.relax;
      for (let i = 1; i < stub.length; i++) { const q = lifted[i].clone().lerp(stub[i], w); push(arr, q); }
      return { arr, nT, end: lastV(arr), J };
    }
    const n0 = arr.length / 3, tl = freeTail(J, tJ, Math.max(0.05, st.len[X] - used), st.tail[X]);
    for (let j = 0; j < tl.pts.length; j++) arr.push(tl.pts[j]);
    // gi: índice do ponto seguro pelo instrumento (extremidade, ou a pegada a meio fio)
    return { arr, nT, iJ: n0 - 1, end: tl.end, tEnd: tl.tEnd, J, tJ, lrem: st.len[X] - used, gi: n0 + tl.gi, grip: tl.grip };
  }
  /** Estágio da agulha com o engaste ainda fora da pele ou dentro dela (antes de o fio sair por P2). */
  function genNeedleIn(np, onPlane, thT) {
    const an = G.anc, pl = an.plane, S = swagePt(np), tS = swageTan(np);
    const thS = thT - ARC;
    const inside = onPlane && thS > an.thIn;
    const outA = [], outB = []; let nTA = 0, nTB = 0;
    if (!inside) {
      push(outB, S); const tl = freeTail(S, tS, G.L0, { H: G.HB0, bulge: G.bulgeB0 });
      for (const v of tl.pts) outB.push(v); push(outA, S); nTB = 0;
      return { A: { arr: outA, nT: 1 }, B: { arr: outB, nT: nTB } };
    }
    const thSplit = Math.min(thS, an.thMid);
    pushArc(outB, pl, thSplit, an.thIn); nTB = outB.length / 3;
    const P1o = an.P1.clone();
    const tl = freeTail(P1o, an.tIn, Math.max(0.3, G.L0 - (thS - an.thIn) * RN), { H: G.HB0, bulge: G.bulgeB0 });
    push(outB, P1o); for (const v of tl.pts) outB.push(v);
    if (thS > an.thMid) pushArc(outA, pl, an.thMid, thS); else push(outA, S);
    nTA = outA.length / 3;
    return { A: { arr: outA, nT: nTA }, B: { arr: outB, nT: nTB } };
  }

  /* ---- pose de corte da tesoura e cotos (calculados uma vez por layout) ---- */
  const T_CUT = 0.47;
  function computeCut() {
    const g = G; frameAt(g.knots[3].s);
    const K = FR.c.clone().addScaledVector(FR.U, g.rhoK), U3 = FR.U.clone(), B3 = FR.B.clone(), T3 = FR.T.clone();
    // cotos em repouso: saem das extremidades do nó final para os lados, levemente para cima (náilon é rígido)
    const stubs = {};
    for (const X of ['A', 'B']) {
      const e = knotPt(3, X, X === 'A' ? 1 : -1, 1, 0, V3()), sgn = X === 'A' ? 1 : -1;
      const d = B3.clone().multiplyScalar(0.84 * sgn).addScaledVector(U3, 0.12).addScaledVector(T3, 0.52).normalize();
      const pts = []; for (let i = 0; i <= 12; i++) { const sg = (i / 12) * L_STUB; pts.push(e.clone().addScaledVector(d, sg).addScaledVector(U3, -0.75 * sg * sg)); }
      stubs[X] = pts;
    }
    g.stubs = stubs; g.liftStub = stubs;
    // estado no instante do corte: pontas puxadas juntas para o lado +B, esticadas
    const sc = sceneCut(T_CUT, true);
    const info = {};
    for (const X of ['A', 'B']) {
      const r = genSide(X, sc.st); const tail = r.arr.slice();
      // ponta a partir de J (extremidade do nó final)
      const Jp = r.J; let j0 = 0, bd2 = Infinity; for (let j = 0; j < tail.length; j += 3) { const d = (tail[j] - Jp.x) ** 2 + (tail[j + 1] - Jp.y) ** 2 + (tail[j + 2] - Jp.z) ** 2; if (d < bd2) { bd2 = d; j0 = j; } }
      const tl = tail.slice(j0); settle(tl, 0, { obst: g.obstAll });
      const lifted = truncate(tl, L_STUB), rs = new Float32Array(13 * 3); resample(lifted, 13, rs);
      const lp = []; for (let i = 0; i < 13; i++) lp.push(V3(rs[i * 3], rs[i * 3 + 1], rs[i * 3 + 2]));
      let acc = 0, jc = 3; for (let j = 3; j < tl.length; j += 3) { acc += Math.hypot(tl[j] - tl[j - 3], tl[j + 1] - tl[j - 2], tl[j + 2] - tl[j - 1]); if (acc >= L_STUB) { jc = j; break; } }
      const jn = Math.min(tl.length - 3, jc + 3), jp = Math.max(0, jc - 3);
      info[X] = { cp: V3(tl[jc], tl[jc + 1], tl[jc + 2]), dir: V3(tl[jn] - tl[jp], tl[jn + 1] - tl[jp + 1], tl[jn + 2] - tl[jp + 2]).normalize(), lifted: lp, off: tl.slice(jc), inst: lastV(tl) };
    }
    g.liftStub = { A: info.A.lifted, B: info.B.lifted };
    g.offcut = { A: info.A.off, B: info.B.off, instA: info.A.inst, instB: info.B.inst };
    const CP = info.A.cp.clone().add(info.B.cp).multiplyScalar(0.5);
    // tesoura: lâminas paralelas à pele (plano B–T) e perpendiculares às pontas (quase verticais); argolas para o lado −B
    // (passa alta sobre o cateter) e PONTAS VOLTADAS PARA FORA (+B), além do ponto de corte; corta com o terço distal
    // (≈0,45 cm da ponta), ~0,7 cm acima do nó — a tesoura nunca fecha perto do corpo do cateter
    const Zs = U3.clone();
    let Xs = B3.clone().negate().addScaledVector(T3, 0.12); Xs.addScaledVector(Zs, -Xs.dot(Zs)).normalize();
    Xs.addScaledVector(Zs, 0.2).normalize(); // argolas ~11° acima do plano: o corpo da tesoura sobe ao passar sobre o cateter
    const Ys = V3().crossVectors(Zs, Xs).normalize(), Zs2 = V3().crossVectors(Xs, Ys).normalize();
    const q = quatFromBasis(Xs, Ys, Zs2);
    g.cut = { K, U3, B3, T3, CP, cpA: info.A.cp, cpB: info.B.cp };
    g.cut.pose = { p: CP.clone().addScaledVector(Xs, -0.45 / 0.85 * 0.85), q, X: Xs };
    g.cut.far = { p: g.cut.pose.p.clone().addScaledVector(Xs, 3.0).add(V3(0, 0, 1.4)), q };
    g.cut.back = { p: g.cut.pose.p.clone().addScaledVector(Xs, 2.4).add(V3(0, 0, 1.2)), q };
    g.cutDbg = { cpA: info.A.cp.toArray().map((x) => +x.toFixed(2)), cpB: info.B.cp.toArray().map((x) => +x.toFixed(2)), K: K.toArray().map((x) => +x.toFixed(2)), latA: +info.A.cp.clone().sub(K).dot(B3).toFixed(2), latB: +info.B.cp.clone().sub(K).dot(B3).toFixed(2) };
    for (const [Sx, X] of [[OA, 'A'], [OB, 'B']]) { const L = resample(g.offcut[X], Sx.N, Sx.P); Sx.commit(L, null); Sx.mesh.visible = false; }
  }

  /* ======================================================================
     6. Coreografia: cena em função de fixStep
     ====================================================================== */
  /** Estado de repouso do fio após o cruzamento d (0 = após o nó de ancoragem). */
  function restSt(d) {
    const g = G, rf = g.restFront;
    return {
      anc: { kap: 1, front: 1 }, c: rf.A[d].c, kap: 1, lam: 0, ext: rf.A[d].ext,
      front: { A: rf.A[d].L, B: rf.B[d].L },
      tail: { A: { H: g.restEnd.A[d], lie: g.lie.A[d] }, B: { H: g.restEnd.B[d], lie: g.lie.B[d] } },
      len: g.len, cut: null,
    };
  }
  function baseScene() {
    return { gen: 'none', st: null, nin: null, thrOp: 1,
      holder: { pose: null, op: 0, grips: null }, needle: { pose: null, op: 0, hold: null }, forceps: { pose: null, op: 0, open: 0, grips: null },
      scissors: { pose: null, op: 0, alpha: 0.4 }, fingerOp: 0, fingerOff: null, markOp: 0, pullW: 0, coilOn: null, wings: [0, 0], feed: null, feedOp: 0, dress: 0, dressDrop: 0, gelOp: 0, labelOp: 0, off: null };
  }
  const opIO = (t, a, b, c, d) => ss(t, a, b) * (1 - ss(t, c, d)); // aparece em [a, b], some em [c, d]
  // cabos dos instrumentos: sobem para o lado de trabalho, nunca para a cabeça/pescoço (lado +B → lateral; −B → caudal-medial)
  const sideDir = (sg) => (sg > 0 ? LIE_P.clone() : sg < 0 ? LIE_N.clone() : LIE_P.clone().add(LIE_N).normalize());
  // dir (opcional): direção de tração — o cabo segue a linha do fio (a mão fica além da pegada)
  const fAt = (p, sg, cx, dir) => { const T = cx ? cx.T : G.anc.e1; return framePose(p, UPZ.clone().multiplyScalar(0.8).addScaledVector(dir ? horiz(dir) : sideDir(sg), 0.55), T); };
  const hAt = (p, sg, cx, dir) => framePose(p, (dir ? horiz(dir) : sideDir(sg)).multiplyScalar(0.78).addScaledVector(UPZ, 0.5), UPZ);
  const lifted = (p, d = 0.17) => p.clone().addScaledVector(UPZ, d);
  /** Ao soltar uma ponta esticada, o instrumento parte de onde estava (posição ajustada ao fio), não do alvo nominal. */
  function relFix(k, t, tR, hp, fp) { const r = G.rel && G.rel[k]; if (!r || t < tR) return; const w = 1 - ss(t, tR, tR + 0.08); if (hp) hp.p.addScaledVector(r.h, w); if (fp) fp.p.addScaledVector(r.f, w); }

  /** Etapa 1 (k = 0): porta-agulha com a agulha montada chega e para acima do ponto de entrada. */
  function sceneStep0(t) {
    const S = baseScene(), PP = passPoses(G.passA);
    const r = PP.ready(lerp(4.0, 1.2, ss(t, 0, 0.8)));
    S.holder = { pose: withAxes(r.hp), op: ss(t, 0, 0.35), grips: null }; S.needle = { pose: r.np, op: ss(t, 0, 0.35), hold: 'holder' };
    S.gen = 'needleIn'; S.nin = { np: r.np, onPlane: false, thT: G.anc.thIn }; S.thrOp = ss(t, 0, 0.35);
    return S;
  }
  /** Etapa 2 (k = 1): pinça faz contrapressão; agulha entra em P1 e percorre o arco (pega posterior) até as mandíbulas
      encostarem na pele; a pinça prende o corpo exteriorizado (nunca a ponta) e extrai a agulha pela curva enquanto o
      porta-agulha solta e repega o corpo; a pinça solta e se afasta; o porta-agulha completa o arco. A agulha só se move
      presa a um instrumento (S.needle.hold). */
  function sceneStep1(t) {
    const S = baseScene(), g = G, an = g.anc, ps = g.passA, PP = passPoses(ps);
    let r, thT = an.thIn, onPlane = true, fp = null, fOpen = 0, fOp = 1;
    const T_RG0 = 0.46, T_RG1 = 0.76;
    if (t < 0.12) { r = PP.ready(lerp(1.2, 0, ss(t, 0, 0.12))); onPlane = t >= 0.12; }
    else if (t < 0.4) { thT = lerp(an.thIn, ps.thDrive, ss(t, 0.12, 0.4)); r = PP.drive(thT); }
    else if (t < T_RG0) { thT = ps.thDrive; r = PP.drive(thT); }
    else if (t < T_RG1) { r = PP.regrasp(seg(t, T_RG0, T_RG1)); thT = r.th; if (r.fp) { fp = r.fp; fOpen = r.fOpen; } }
    else if (t < 0.92) { thT = lerp(ps.thA, ps.thSwOut, ss(t, 0.78, 0.92)); r = PP.ant(thT); }
    else { thT = ps.thSwOut; const a = PP.ant(thT), e = ss(t, 0.92, 1); r = { np: movePose(a.np, g.liftVec.clone().multiplyScalar(e)), hp: movePose(a.hp, g.liftVec.clone().multiplyScalar(e)), hold: 'holder' }; }
    S.holder = { pose: withAxes(r.hp), op: 1, grips: null, jaw: r.jaw || 0 }; S.needle = { pose: r.np, op: 1, hold: r.hold || 'holder' };
    // pinça: contrapressão junto à entrada durante a condução; depois vai ao corpo exteriorizado (repega assistida) e,
    // ao soltar a agulha, recua pelo cabo e se afasta
    const pre = PP.fPre(), post = PP.fPost();
    // (fecha as hastes antes de tocar a pele; abre só depois de subir)
    if (t < 0.4 || !pre) { fp = kfPose(t, [[0, movePose(g.fCP, UPZ.clone().multiplyScalar(2.2))], [0.12, g.fCP]]); fOpen = lerp(0.5, 0, ss(t, 0.03, 0.08)); }
    else if (t < T_RG0) { fp = kfPose(t, [[0.4, g.fCP], [0.415, movePose(g.fCP, UPZ.clone().multiplyScalar(0.3))], [T_RG0, pre, 0.6]]); fOpen = lerp(0, F_OPEN, ss(t, 0.415, 0.43)); }
    else if (t >= T_RG1) { fp = kfPose(t, [[T_RG1, post], [0.86, movePose(post, UPZ.clone().multiplyScalar(1.6).addScaledVector(an.Bout, -0.4))]]); fOpen = F_OPEN; fOp = 1 - ss(t, 0.78, 0.86); }
    S.forceps = { pose: fp, op: Math.min(fOp, ss(t, 0, 0.08)), open: fOpen, grips: null, needle: r.hold === 'forceps' || r.hold === 'both' };
    // fio
    const thS = thT - ARC;
    if (!onPlane || thS <= an.thOut) { S.gen = 'needleIn'; S.nin = { np: r.np, onPlane, thT }; }
    else { S.gen = 'tied'; S.st = needleOutSt(r.np, 0, t < 0.92 ? thT : null); }
    return S;
  }
  /** Fio com a agulha já fora (A de P2 até o engaste): comprimento de A cresce com a tração (pull ∈ [0, 1]). */
  function needleOutSt(np, pull, thT) {
    const g = G, an = g.anc, Sw = swagePt(np);
    const lDesign = lerp(Math.max(0, (thT == null ? g.passA.thSwOut : thT) - ARC - an.thOut) * RN, g.len.A, pull);
    const lA = Math.max(lDesign, Sw.distanceTo(an.P2) * 1.03);
    // folga de A: no plano, acompanha o arco; ao puxar, deita na pele (para baixo, lateral e cranial)
    const arcOut = an.plane.C.clone().sub(an.P2.clone().lerp(Sw, 0.5)).negate().normalize();
    const lie = downV(LIE_P, 0.6);
    const wl = ss(Sw.distanceTo(an.P2), 0.15, 0.9);
    return {
      anc: { kap: 0, front: 0 }, c: 0, kap: 1, lam: 0, ext: false, front: { A: 0, B: 0 },
      tail: { A: { H: Sw, bulge: arcOut.lerp(lie, wl).normalize() }, B: { H: g.HB0, bulge: g.bulgeB0 } },
      len: { A: lA, B: g.L0 - g.tissueLen - lA }, cut: null,
    };
  }
  /** Quadros-chave do porta-agulha no nó de ancoragem (etapa 3). */
  /* nó de ancoragem: aperto até 0,84; 0,85–0,93 os instrumentos deitam as duas pontas juntas do lado lateral (B passa
     por cima/cranial do nó, sem cruzar A); 0,93 soltam; as pontas assentam na curva de repouso até 1 */
  const T_LAY0 = 0.85, T_LAY1 = 0.93;
  function HKA() { const g = G, dq = g.lieQ.B.clone().sub(g.ak.c), dv = g.layVB.clone().sub(g.ak.c);
    return [[0.34, movePose(g.tieA, UPZ.clone().multiplyScalar(2.5))], [0.42, g.tieA], [0.61, g.tieA], [0.69, hAt(lifted(g.HB0), -1, null), 0.3], [0.8, hAt(g.PBtightA, -1, null, g.dPullA.B)], [T_LAY0, hAt(g.PBtightA, -1, null, g.dPullA.B)],
      [0.89, hAt(g.layVB, -1, null, dv)], [T_LAY1, hAt(g.lieQ.B, -1, null, dq)], [1.0, hAt(lifted(g.lieQ.B, 2), -1, null, dq)]]; }
  /** Etapa 3 (k = 2): fio puxado até as pontas ficarem iguais, agulha separada (tesoura) e levada embora, nó instrumental
      sobre o ponto (pinça enrola A 2 voltas nas mandíbulas; o porta-agulha pega a ponta de B; tração; seminós resumidos). */
  function sceneStep2(t) {
    const S = baseScene(), g = G, an = g.anc, ak = g.ak;
    const T_SNIP = 0.245;
    // agulha e porta-agulha
    const eP = ss(t, 0, 0.16), away = UPZ.clone().multiplyScalar(3).addScaledVector(g.dirPull, 2).multiplyScalar(ss(t, 0.25, 0.34));
    const npP = movePose(g.lift.np, g.pullVec.clone().multiplyScalar(eP));
    if (t < 0.34) {
      S.needle = { pose: movePose(npP, away), op: 1 - ss(t, 0.26, 0.34), hold: 'holder' };
      S.holder = { pose: withAxes(movePose(movePose(g.lift.hp, g.pullVec.clone().multiplyScalar(eP)), away)), op: 1 - ss(t, 0.26, 0.34), grips: null };
    } else {
      const hp = kfPose(t, HKA()); relFix(2, t, T_LAY1, hp, null);
      S.holder = { pose: hp, op: opIO(t, 0.34, 0.4, 0.94, 1.0), grips: t >= 0.69 && t < T_LAY1 ? 'B' : null };
    }
    // tesoura separa a agulha junto ao engaste
    if (t >= 0.14 && t < 0.34) {
      const sp = g.snip;
      S.scissors = { pose: kfPose(t, [[0.14, sp.far], [0.22, sp.pose], [0.25, sp.pose], [0.34, sp.back]]), op: opIO(t, 0.14, 0.19, 0.27, 0.34), alpha: t < 0.22 ? 0.38 : lerp(0.38, 0.03, ss(t, 0.22, 0.245)) };
    }
    // pinça: pega a ponta de A, enrola 2 voltas nas mandíbulas, acompanha o porta-agulha e traciona para o lado oposto
    const plan = g.wrapA, tp = g.tieA;
    if (t >= 0.34) {
      const wpsi = plan.psi0 + plan.sgn * 2 * TWO_PI * ss(t, 0.5, 0.61);
      const follow = (pp) => { const cc = pp.p.clone().addScaledVector(pp.X, COIL_X0); return cc.addScaledVector(an.Bout, 0.6).addScaledVector(ak.n, 0.7); };
      let fp;
      if (t < 0.5) fp = kfPose(t, [[0.34, fAt(lifted(g.dropA, 2.2), 1, null)], [0.4, fAt(lifted(g.dropA), 1, null)], [0.47, fAt(g.PAholdA, 1, null), 0.4], [0.5, fAt(wrapCirclePt(tp, plan, plan.psi0), 1, null)]]);
      else if (t < 0.61) fp = fAt(wrapCirclePt(tp, plan, wpsi), 1, null);
      else if (t < 0.69) fp = kfPose(t, [[0.61, fAt(wrapCirclePt(tp, plan, plan.psi0 + plan.sgn * 2 * TWO_PI), 1, null)], [0.69, fAt(follow(kfPose(0.69, HKA())), 1, null)]]);
      else { const dq = g.lieQ.A.clone().sub(ak.c); fp = kfPose(t, [[0.69, fAt(follow(kfPose(0.69, HKA())), 1, null)], [0.8, fAt(g.PAtightA, 1, null, g.dPullA.A)], [T_LAY0, fAt(g.PAtightA, 1, null, g.dPullA.A)], [T_LAY1, fAt(g.lieQ.A, 1, null, dq)], [1.0, fAt(lifted(g.lieQ.A, 2), 1, null, dq)]]); }
      relFix(2, t, T_LAY1, null, fp);
      S.forceps = { pose: fp, op: opIO(t, 0.34, 0.38, 0.94, 1.0), open: t < 0.39 || t > T_LAY1 ? 0.4 : 0, grips: t >= 0.4 && t < T_LAY1 ? 'A' : null };
    }
    // fio
    if (t < T_SNIP) { S.gen = 'tied'; S.st = needleOutSt(npP, eP); return S; }
    const st = needleOutSt(movePose(g.lift.np, g.pullVec.clone()), 1);
    st.len = { A: g.len.A, B: g.len.B };
    const lie = st.tail.A.bulge.clone();
    // A: ponta cortada cai, a pinça a recolhe e enrola nas mandíbulas
    let HA = kfVec(t, [[T_SNIP, g.snipPt], [0.33, g.dropA], [0.38, g.dropA], [0.4, lifted(g.dropA)]]);
    if (t >= 0.4 && t < T_LAY1) HA = S.forceps.pose.p.clone();
    const bA = downV(LIE_P, 0.6), bulgeA = lie.clone().lerp(bA, ss(t, 0.4, 0.48)).normalize();
    // aperto (0,69–0,84): a pinça passa a segurar A a LG do nó e o resto da ponta deita na pele até o repouso; ao soltar,
    // a forma vai da presa à de repouso deitada (sem a extremidade "voar")
    const gripA = { k: ss(t, 0.69, 0.75), Lg: LG, H2: g.restEnd.A[0], bulge2: g.restBulge.A[0] };
    if (t >= T_LAY1) st.tail.A = { H: g.restEnd.A[0], lie: g.lie.A[0], blend: { w: 1 - ss(t, T_LAY1, 1.0), o: { H: g.lieQ.A, bulge: bulgeA, slack: 'first', grip: Object.assign({}, gripA, { k: 1 }) } } };
    else st.tail.A = { H: HA, bulge: bulgeA, slack: 'first', grip: gripA };
    const turns = 2 * ss(t, 0.5, 0.61) * (1 - ss(t, 0.7, 0.79)), cw = ss(t, 0.47, 0.5) * (1 - ss(t, 0.795, 0.83));
    if (cw > 0.001 && S.holder.pose) { st.tail.A.coil = { pose: S.holder.pose, slide: { w: ss(t, 0.71, 0.79), target: ak.c }, turns, psi0: plan.psi0, sgn: plan.sgn, w: cw, x0: COIL_X0 }; S.coilOn = 'A'; }
    // B: deitada (laço de folga) até o porta-agulha pegar a ponta e tracionar
    let HB = g.HB0.clone();
    if (t >= 0.67) HB = kfVec(t, [[0.67, g.HB0], [0.69, lifted(g.HB0)]]);
    if (t >= 0.69 && t < T_LAY1) HB = S.holder.pose.p.clone();
    // a extremidade de B (além da pegada) fica para medial durante o aperto e é arrastada com a ponta, por cima do nó,
    // até o lado lateral
    // a folga além da pegada gira (no plano da pele) de medial para lateral-cranial passando por caudal — longe do nó e
    // de A, sem a alça "virar" de lado num quadro
    const b2B = (() => { const e = ss(t, T_LAY0, 0.93), a0 = Math.atan2(g.bulgeB0.y, g.bulgeB0.x); let a1 = Math.atan2(g.layBulgeB.y, g.layBulgeB.x); while (a1 < a0) a1 += TWO_PI; const a = lerp(a0, a1, e); return downV(V3(Math.cos(a), Math.sin(a), 0), 0.72); })();
    const H2B = kfVec(t, [[T_LAY0, g.HBmed], [0.9, g.layVB2], [0.95, g.restEnd.B[0]]]);
    const bB = g.bulgeB0.clone(), gripB = { k: ss(t, 0.69, 0.75), Lg: LG, H2: H2B, bulge2: b2B };
    if (t >= T_LAY1) st.tail.B = { H: g.restEnd.B[0], lie: g.lie.B[0], blend: { w: 1 - ss(t, T_LAY1, 1.0), o: { H: g.lieQ.B, bulge: bB, grip: Object.assign({}, gripB, { k: 1 }) } } };
    else st.tail.B = { H: HB, bulge: bB, grip: gripB };
    st.anc = { kap: ss(t, 0.74, 0.84), front: ss(t, 0.71, 0.82) };
    S.gen = 'tied'; S.st = st;
    return S;
  }
  /** Etapas 4–6 (k = 3..5): cruzamento c. Pinça (lado +B) empurra A pelo vão e recolhe B; porta-agulha (lado −B)
      empurra B (c ≥ 2) e recolhe A; tração até esticar; A é deixada perto do cateter; porta-agulha paralelo à pele sobre
      o cateter; a pinça enrola B 2 voltas nas mandíbulas; as mandíbulas pegam A; tração para lados opostos; soltam. */
  function sceneCross(c, t) {
    const S = baseScene(), g = G, cx = g.cx[c], rf = g.restFront;
    const d0 = c - 1;
    const restA0 = g.restEnd.A[d0], restB0 = g.restEnd.B[d0], restA1 = g.restEnd.A[c], restB1 = g.restEnd.B[c];
    const transit = (X, e) => { const isA = X === 'A', ph = isA ? lerp(0.62 * PI, 1.38 * PI, e) : lerp(1.38 * PI, 0.62 * PI, e); const rho = lerp(cx.rBot, G.rhoW + 0.24, 1 - Math.sin(PI * e)); const q = wrapPt(cx.sU + (isA ? -0.04 : 0.04), ph, rho, 0, V3()); q.z = Math.max(q.z, sZ(q.x, q.y) + R_T + 0.004); return q; };
    const plan = cx.wrap, tie = cx.tie;
    // ---- porta-agulha ----
    const hKeys = c >= 2
      ? [[0, hAt(lifted(restB0, 2.2), -1, cx)], [0.09, hAt(lifted(restB0, 0.27), -1, cx)], [0.24, hAt(cx.E2, -1, cx), 0.8]]
      : [[0, hAt(lifted(cx.E2, 2.2), -1, cx)], [0.2, hAt(cx.E2, -1, cx)], [0.24, hAt(cx.E2, -1, cx)]];
    hKeys.push([0.32, hAt(cx.E2, -1, cx)], [0.42, hAt(cx.PAfar, -1, cx), 0.3], [0.47, hAt(cx.PAfar, -1, cx)], [0.54, hAt(lifted(cx.F_A), -1, cx)], [0.61, tie, 0.4], [0.71, tie], [0.77, hAt(lifted(cx.F_A), -1, cx)], [0.82, hAt(cx.OVh, 0, cx)], [0.865, hAt(cx.PAtight, 1, cx, cx.dPull.A)], [0.9, hAt(cx.PAtight, 1, cx, cx.dPull.A)], [0.98, hAt(lifted(cx.PAtight, 2), 1, cx, cx.dPull.A)]);
    const hp = kfPose(t, hKeys);
    // ---- pinça ----
    const wpsi = plan.psi0 + plan.sgn * 2 * TWO_PI * ss(t, 0.61, 0.7);
    const follow = (pp) => pp.p.clone().addScaledVector(pp.X, COIL_X0).addScaledVector(cx.B, 0.5).addScaledVector(cx.U, 0.75);
    let fp;
    const fKeys0 = [[0, fAt(lifted(restA0, 2.2), 1, cx)], [0.09, fAt(lifted(restA0), 1, cx)], [0.24, fAt(cx.E1, 1, cx), 0.8]];
    if (c >= 2) fKeys0.push([0.32, fAt(cx.E1, 1, cx)]); else fKeys0.push([0.26, fAt(cx.E1, 1, cx)], [0.34, fAt(lifted(restB0), 1, cx), 0.5]);
    fKeys0.push([0.42, fAt(cx.PBfar, 1, cx), 0.3], [0.47, fAt(cx.PBfar, 1, cx)], [0.54, fAt(cx.PBhold, 1, cx)], [0.6, fAt(wrapCirclePt(tie, plan, plan.psi0), 1, cx)]);
    if (t < 0.61) fp = kfPose(t, fKeys0);
    else if (t < 0.7) fp = fAt(wrapCirclePt(tie, plan, wpsi), 1, cx);
    else if (t < 0.77) fp = kfPose(t, [[0.7, fAt(wrapCirclePt(tie, plan, plan.psi0 + plan.sgn * 2 * TWO_PI), 1, cx)], [0.77, fAt(follow(kfPose(0.77, hKeys)), 1, cx)]]);
    else fp = kfPose(t, [[0.77, fAt(follow(kfPose(0.77, hKeys)), 1, cx)], [0.82, fAt(cx.OVf, 0, cx)], [0.865, fAt(cx.PBtight, -1, cx, cx.dPull.B)], [0.9, fAt(cx.PBtight, -1, cx, cx.dPull.B)], [0.98, fAt(lifted(cx.PBtight, 2), -1, cx, cx.dPull.B)]]);
    const hOp = opIO(t, 0, 0.06, 0.91, 0.98), fOp = opIO(t, 0, 0.06, 0.91, 0.98);
    const hGrip = (c >= 2 && t >= 0.09 && t < 0.24) ? 'B' : (t >= 0.32 && t < 0.54) || (t >= 0.77 && t < 0.9) ? 'A' : null;
    const fGrip = (t >= 0.09 && t < 0.24) ? 'A' : (t >= (c >= 2 ? 0.32 : 0.34) && t < 0.9) ? 'B' : null;
    relFix(3 + c - 1, t, 0.9, hp, fp);
    S.holder = { pose: hp, op: hOp, grips: hGrip };
    S.forceps = { pose: fp, op: fOp, open: fGrip ? 0 : 0.4, grips: fGrip };
    S.fingerOp = opIO(t, 0.7, 0.76, 0.92, 0.98);
    // ---- fio ----
    const lamK = 0.6 * ss(t, 0.0, 0.2) * (1 - ss(t, 0.84, 0.9)), kapK = ss(t, 0.82, 0.9);
    const fpA = g.form.A[c], fpB = g.form.B[c];
    const LA0 = c === 1 ? 0 : fpA.marks.side1, LB0 = c === 1 ? 0 : fpB.marks.side1;
    const st = { anc: { kap: 1, front: 1 }, c, kap: kapK, lam: lamK, ext: false, front: { A: 0, B: 0 }, tail: {}, len: g.len, cut: null };
    const wS = ss(t, 0.4, 0.47), wK = ss(t, 0.8, 0.89);
    st.front.A = lerp(lerp(LA0, fpA.marks.side2, wS), fpA.marks.end, wK);
    st.front.B = lerp(lerp(LB0, fpB.marks.side2, wS), fpB.marks.end, wK);
    if (t >= 0.9) { // soltam: frentes descem pela lateral (caminho do cruzamento seguinte)
      const rfA = rf.A[c], rfB = rf.B[c], e = ss(t, 0.9, 1);
      st.c = rfA.c; st.ext = rfA.ext; st.kap = 1; st.lam = 0;
      st.front.A = lerp(fpA.marks.end, rfA.L, e); st.front.B = lerp(fpB.marks.end, rfB.L, e);
    }
    // extremidades
    let HA, HB;
    if (t < 0.07) HA = restA0.clone(); else if (t < 0.09) HA = kfVec(t, [[0.07, restA0], [0.09, lifted(restA0)]]);
    else if (t < 0.24) HA = fp.p.clone(); else if (t < 0.32) HA = transit('A', ss(t, 0.24, 0.32));
    else if (t < 0.54) HA = hp.p.clone(); else if (t < 0.75) HA = kfVec(t, [[0.54, lifted(cx.F_A)], [0.58, cx.F_A]]);
    else if (t < 0.77) HA = kfVec(t, [[0.75, cx.F_A], [0.77, lifted(cx.F_A)]]);
    else if (t < 0.9) HA = hp.p.clone(); else HA = restA1.clone();
    if (c >= 2) {
      if (t < 0.07) HB = restB0.clone(); else if (t < 0.09) HB = kfVec(t, [[0.07, restB0], [0.09, lifted(restB0, 0.27)]]);
      else if (t < 0.24) HB = hp.p.clone(); else if (t < 0.32) HB = transit('B', ss(t, 0.24, 0.32));
      else if (t < 0.9) HB = fp.p.clone(); else HB = restB1.clone();
    } else {
      if (t < 0.32) HB = restB0.clone(); else if (t < 0.34) HB = kfVec(t, [[0.32, restB0], [0.34, lifted(restB0)]]);
      else if (t < 0.9) HB = fp.p.clone(); else HB = restB1.clone();
    }
    // direção da folga (alça deitada na pele) e pontos de passagem
    const down = (v, k = 0.55) => v.clone().multiplyScalar(Math.sqrt(1 - k * k)).addScaledVector(UPZ, -k).normalize();
    const mixv = (a, b, w) => a.clone().lerp(b, w).normalize();
    const outA1 = down(LIE_P), outA2 = down(LIE_N), outB1 = down(LIE_N), outB2 = down(LIE_P);
    const ta = { H: HA, bulge: t < 0.9 ? mixv(mixv(g.restBulge.A[d0], outA1, ss(t, 0.07, 0.12)), outA2, ss(t, 0.44, 0.48)) : g.restBulge.A[c] };
    const tb = { H: HB, bulge: t >= 0.9 ? g.restBulge.B[c] : c >= 2 ? mixv(mixv(g.restBulge.B[d0], outB1, ss(t, 0.07, 0.12)), outB2, ss(t, 0.44, 0.48)) : mixv(g.restBulge.B[d0], outB2, ss(t, 0.32, 0.44)) };
    // ao pegar a extremidade, a ponta passa da curva deitada (repouso) ao laço que acompanha o instrumento (mistura pelo
    // comprimento de arco, sem salto); ao soltar, volta a deitar em curva (repouso do cruzamento c)
    const tP = c >= 2 ? 0.07 : 0.32;
    if (t < 0.13) ta.blend = { w: 1 - ss(t, 0.07, 0.13), o: { H: restA0, lie: g.lie.A[d0] }, keepEnd: true };
    if (t < tP + 0.06) tb.blend = { w: 1 - ss(t, tP, tP + 0.06), o: { H: restB0, lie: g.lie.B[d0] }, keepEnd: true };
    if (t >= 0.9) { ta.lie = g.lie.A[c]; tb.lie = g.lie.B[c]; }
    // passagem por baixo: ponto de passagem no vão enquanto a frente não o alcança (a folga fica do lado de origem)
    const GA = ptAtLen(fpA.pts, fpA.marks.under), GB = ptAtLen(fpB.pts, fpB.marks.under);
    if (t >= 0.28 && t < 0.5 && st.front.A < fpA.marks.under - 0.005) { ta.via = [GA]; ta.slack = 'first'; }
    if (c >= 2 && t >= 0.28 && t < 0.5 && st.front.B < fpB.marks.under - 0.005) { tb.via = [GB]; tb.slack = 'first'; }
    // B enrolada nas mandíbulas (a folga fica entre a frente e as mandíbulas, deitada do lado +B)
    const turns = 2 * ss(t, 0.61, 0.7) * (1 - ss(t, 0.79, 0.865)), cw = ss(t, 0.56, 0.59) * (1 - ss(t, 0.87, 0.895));
    if (cw > 0.001) {
      tb.coil = { pose: hp, slide: { w: ss(t, 0.8, 0.87), target: cx.K }, turns, psi0: plan.psi0, sgn: plan.sgn, w: cw, x0: COIL_X0 };
      tb.slack = 'first';
      const sideH = hp.p.clone().sub(cx.c0).dot(cx.B); tb.top = { p: cx.Vtop, w: ss(-sideH, 0.05, 0.45) };
      S.coilOn = 'B';
    }
    if (t >= 0.5) { ta.dodge = true; tb.dodge = true; }
    // aperto (0,77–0,9): cada instrumento passa a segurar sua ponta a LG do nó, com tração simétrica e paralela à pele; o
    // resto da ponta sai das mandíbulas e deita na pele até a posição de repouso. Ao soltar (0,9–1), a forma vai da presa à
    // de repouso pelo comprimento de arco (a extremidade já está deitada: nada "voa")
    const gA = { k: ss(t, 0.77, 0.83), Lg: LG, H2: restA1, bulge2: g.restBulge.A[c] }, gB = { k: ss(t, 0.77, 0.83), Lg: LG, H2: restB1, bulge2: g.restBulge.B[c] };
    if (t < 0.9) { if (t >= 0.77) { ta.grip = gA; tb.grip = gB; } }
    else {
      const w = 1 - ss(t, 0.9, 1.0);
      ta.blend = { w, o: { H: cx.PAtight, bulge: outA2, dodge: true, grip: Object.assign({}, gA, { k: 1 }) } };
      tb.blend = { w, o: { H: cx.PBtight, bulge: outB2, dodge: true, grip: Object.assign({}, gB, { k: 1 }) } };
    }
    st.tail = { A: ta, B: tb };
    S.gen = 'tied'; S.st = st;
    return S;
  }
  /** Etapa 7 (k = 6): pinça e porta-agulha juntam as pontas para o lado (+B), esticadas; a tesoura corta com a ponta
      longe do cateter, lâminas paralelas à pele; as sobras saem com os instrumentos e os cotos relaxam. */
  function cutKeys() {
    const g = G, cx = g.cx[3];
    const remC = Math.min(g.len.A - g.ancLen.A - g.form.A[3].marks.end, g.len.B - g.ancLen.B - g.form.B[3].marks.end);
    // pontas juntas, esticadas para cima e um pouco para o lado +B (~65° com a pele): a tesoura entra paralela à pele,
    // perpendicular às pontas, com as pontas da tesoura voltadas para fora (longe do cateter)
    const Pc = cx.K.clone().addScaledVector(cx.B.clone().multiplyScalar(0.3).addScaledVector(cx.U, 0.95).normalize(), 1.04 * remC);
    return { f: [[0, fAt(lifted(g.restEnd.A[3], 2.2), 1, cx)], [0.12, fAt(lifted(g.restEnd.A[3]), 1, cx)], [0.3, fAt(Pc.clone().addScaledVector(cx.T, -0.45), 1, cx), 0.3], [0.48, fAt(Pc.clone().addScaledVector(cx.T, -0.45), 1, cx)], [0.68, fAt(lifted(Pc, 2.2).addScaledVector(cx.B, 1.2).addScaledVector(cx.T, -0.3), 1, cx)]],
      h: [[0, hAt(lifted(g.restEnd.B[3], 2.2), -1, cx)], [0.12, hAt(lifted(g.restEnd.B[3], 0.27), -1, cx)], [0.3, hAt(Pc.clone().addScaledVector(cx.T, 0.45), 1, cx), 0.6], [0.48, hAt(Pc.clone().addScaledVector(cx.T, 0.45), 1, cx)], [0.68, hAt(lifted(Pc, 2.2).addScaledVector(cx.B, 1.2).addScaledVector(cx.T, 0.6), 1, cx)]] };
  }
  function sceneCutDesigned(t) { const K = cutKeys(); return { f: kfPose(t, K.f).p, h: kfPose(t, K.h).p }; }
  function sceneCut(t, forCut) {
    const S = baseScene(), g = G;
    const CK = cutKeys();
    const fp = kfPose(t, CK.f);
    const hp = kfPose(t, CK.h);
    if (!forCut && t >= T_CUT && g.offcut) { // depois do corte: os instrumentos partem de onde estavam (pontas esticadas)
      const f0 = sceneCutDesigned(T_CUT); fp.p.add(g.offcut.instA.clone().sub(f0.f)); hp.p.add(g.offcut.instB.clone().sub(f0.h));
    }
    S.forceps = { pose: fp, op: opIO(t, 0, 0.06, 0.56, 0.7), open: t < 0.12 ? 0.4 : 0, grips: t >= 0.12 && t < (forCut ? 1 : 0.47) ? 'A' : null };
    S.holder = { pose: hp, op: opIO(t, 0, 0.06, 0.56, 0.7), grips: t >= 0.12 && t < (forCut ? 1 : 0.47) ? 'B' : null };
    if (g.cut) S.scissors = { pose: kfPose(t, [[0.26, g.cut.far], [0.42, g.cut.pose], [0.5, g.cut.pose], [0.78, g.cut.back]]), op: opIO(t, 0.26, 0.32, 0.62, 0.78), alpha: t < 0.42 ? 0.15 : t < 0.5 ? lerp(0.15, 0.01, ss(t, 0.42, 0.47)) : lerp(0.01, 0.1, ss(t, 0.5, 0.78)) };
    const st = restSt(3);
    const eR = ss(t, 0.12, 0.26), fA = g.form.A[3], fB = g.form.B[3];
    st.front = { A: lerp(fA.marks.full, fA.marks.end, eR), B: lerp(fB.marks.full, fB.marks.end, eR) };
    let HA = g.restEnd.A[3].clone(), HB = g.restEnd.B[3].clone();
    if (t >= 0.1) { HA = t < 0.12 ? kfVec(t, [[0.1, HA], [0.12, lifted(HA)]]) : fp.p.clone(); HB = t < 0.12 ? kfVec(t, [[0.1, HB], [0.12, lifted(HB, 0.27)]]) : hp.p.clone(); }
    const bl = downV(LIE_P, 0.6);
    st.tail = { A: { H: HA, bulge: g.restBulge.A[3].clone().lerp(bl, ss(t, 0.1, 0.18)).normalize(), dodge: true }, B: { H: HB, bulge: g.restBulge.B[3].clone().lerp(bl, ss(t, 0.1, 0.18)).normalize(), dodge: true } };
    // ao pegar as extremidades, as pontas passam da curva deitada ao laço que acompanha os instrumentos (sem salto)
    if (t < 0.16) for (const X of ['A', 'B']) st.tail[X].blend = { w: 1 - ss(t, 0.1, 0.16), o: { H: g.restEnd[X][3], lie: g.lie[X][3] }, keepEnd: true };
    if (!forCut && t >= T_CUT) { st.cut = { relax: ss(t, 0.5, 0.78) }; st.cutFixed = true; st.front = { A: fA.marks.end, B: fB.marks.end }; S.off = { A: fp.p.clone().sub(g.offcut.instA), B: hp.p.clone().sub(g.offcut.instB), op: 1 - ss(t, 0.56, 0.7) }; }
    S.gen = 'tied'; S.st = st;
    return S;
  }
  /** Etapa 7 completa: corte (t ∈ [0, T_CHK]) e conferência (resto): o dedo segura o canhão e dá uma tração suave e
      breve no sentido do canhão (seta), e o anel destaca a marca em cm rente à pele, que deve ser a anotada. */
  const T_CHK = 0.74;
  function sceneCutCheck(t) {
    const S = sceneCut(Math.min(1, t / T_CHK));
    if (t > T_CHK) {
      const u = (t - T_CHK) / (1 - T_CHK);
      S.fingerOp = opIO(u, 0, 0.15, 0.86, 1);
      S.pullW = ss(u, 0.22, 0.4) * (1 - ss(u, 0.55, 0.72));           // tração breve (o canhão não se desloca)
      S.fingerOff = G.hubY.clone().multiplyScalar(-0.04 * S.pullW);
      S.markOp = opIO(u, 0.08, 0.22, 0.84, 0.98);
    }
    return S;
  }
  /** Etapa 8 (k = 7): pontos nas asas (2º fio montado). */
  /** Recarga da agulha entre as asas (calculada uma vez por layout): ao fim da 1ª asa a agulha está na pega anterior,
      no ar; a pinça a prende no meio do corpo, o porta-agulha a solta e volta a prendê-la na pega posterior da 2ª asa
      (com a curvatura para o lado dela); a pinça solta. A agulha fica parada, presa à pinça, durante a troca. */
  function reloadPlan() {
    const g = G; if (g.reload) return g.reload;
    const w0 = g.wings[0], w1 = g.wings[1], npA = wingPhase(w0, 1).np, sXA = w0.plane.sX;
    const hA = wingPhase(w0, 1).hp;
    // pega posterior da 2ª asa: sem rolagem se o cabo passa ≥ 0,05 cm acima da superfície; senão (p. ex. campo sobre o
    // ombro) gira em torno da tangente da agulha (γ) até o cabo subir — desfaz-se no transporte à 2ª asa
    const hClr = (gm) => { const h = holderOnNeedle(npA, w1.ps.bPost, gm, w1.plane.sX), c = holderClear(h); return { h, m: Math.min(c.skin - 0.05, c.hub - 0.04) }; };
    let gB = 0, hb = hClr(0);
    if (hb.m < 0) for (const gm of [0.15, -0.15, 0.3, -0.3, 0.45, -0.45, 0.6, -0.6]) { const c = hClr(gm); if (c.m > hb.m + 1e-4) { hb = c; gB = gm; } if (hb.m >= 0) break; }
    const hB = hb.h;
    let best = null;
    const tryF = (bF, gF, aF) => {
      const fp = forcepsOnNeedle(npA, bF, gF, aF, sXA), c = poseClear(fp, FORCEPS_PROBES);
      const m = Math.min(instrGap(hA, fp), instrGap(hB, fp), c.skin - 0.3, c.hub - 0.2);
      if (!best || m > best.m) best = { bF, gF, aF, m, fp };
    };
    for (const gF of [0, 0.6, -0.6, 1.1, -1.1]) for (const aF of [0, 0.4, -0.4]) tryF(-ARC / 2, gF, aF);
    // sem folga entre os instrumentos (p. ex. com o campo, pegas diferentes): amplia a busca (pega no corpo ±0,3 rad,
    // mais rotações) — sem campo a escolha de sempre basta e não muda
    if (best.m < 0.03) for (const bF of [-ARC / 2, -ARC / 2 - 0.3, -ARC / 2 + 0.3]) for (const gF of [0, 0.6, -0.6, 1.1, -1.1, 1.5, -1.5]) for (const aF of [0, 0.4, -0.4, 0.8, -0.8]) tryF(bF, gF, aF);
    const fR = withAxes(best.fp);
    // chegada da pinça: de um ponto recuado e deslocado para o lado mais livre do porta-agulha (hA) até 0,3 cm atrás da
    // pega no eixo do cabo; depois entra pelo eixo (a agulha passa entre as hastes abertas)
    const fAxR = movePose(fR, fR.X.clone().multiplyScalar(0.3));
    let side = null;
    for (const sd of [null, fR.Y, fR.Y.clone().negate(), fR.Z, fR.Z.clone().negate()]) {
      const p0 = movePose(fR, fR.X.clone().multiplyScalar(1.2).addScaledVector(UPZ, 0.6).addScaledVector(sd || UPZ, sd ? 0.9 : 0));
      let m = Infinity; for (let i = 0; i <= 10; i++) { const fp = lerpPose(p0, fAxR, i / 10); m = Math.min(m, instrGap(hA, fp)); }
      for (let i = 0; i <= 4; i++) m = Math.min(m, instrGap(hA, lerpPose(fAxR, fR, i / 4)));
      if (!side || m > side.m + 0.02) side = { m, p0 };
    }
    // saída da pinça (hastes abertas 0,3 cm): 0,15 cm pelo eixo do cabo (a agulha sai pela ponta das hastes) e depois na
    // direção em que as hastes passam mais longe dos braços da agulha (e do porta-agulha, já em hB)
    const nPts = []; for (let i = 0; i <= 36; i++) { const th = -ARC * i / 36; nPts.push(V3(RN * Math.cos(th), RN * Math.sin(th), 0).applyQuaternion(npA.q).add(npA.p)); }
    const tineIn = (fp) => { // menor valor normalizado (< 1 = dentro) dos pontos da agulha nas hastes (superelipse da secção)
      const qi = fp.q.clone().invert(); let w = 9; const q = V3();
      for (const P of nPts) { q.copy(P).sub(fp.p).applyQuaternion(qi); if (q.x < -0.05 || q.x > 4) continue; const t = q.x / F_LEN;
        for (const sg of [1, -1]) { const yc = sg * (TINE_Y(q.x) + (F_LEN - q.x) * TINE_SIN), a = Math.abs(q.y - yc) / (TINE_RX(t) + R_ND), b = Math.abs(q.z) / (TINE_RY(t) + R_ND); w = Math.min(w, Math.pow(a ** 3 + b ** 3, 1 / 3)); } }
      return w; };
    const backOf = (v) => (d) => movePose(fR, fR.X.clone().multiplyScalar(0.15 * ss(d, 0, 0.25)).addScaledVector(v, 1.35 * ss(d, 0.2, 1)));
    let dep = null;
    for (const v0 of [fR.X.clone().multiplyScalar(0.9).addScaledVector(UPZ, 0.45), UPZ, UPZ.clone().addScaledVector(fR.Z, 0.7), UPZ.clone().addScaledVector(fR.Z, -0.7), UPZ.clone().addScaledVector(fR.Y, 0.7), UPZ.clone().addScaledVector(fR.Y, -0.7), fR.X.clone().addScaledVector(fR.Z, 0.8), fR.X.clone().addScaledVector(fR.Z, -0.8)]) {
      const v = v0.normalize(), bk = backOf(v); let m = Infinity;
      for (let i = 1; i <= 24; i++) { const fp = withAxes(bk(i / 24)); m = Math.min(m, tineIn(fp) - 1, 3 * (instrGap(hB, fp) - 0.03), poseClear(fp, FORCEPS_PROBES).skin - 0.2); }
      if (!dep || m > dep.m + 0.02) dep = { m, v };
    }
    g.reload = { npA, hA, hB, gB, fR, fAx: fAxR, f0: side.p0, back: backOf(dep.v), fGrip: [+best.bF.toFixed(2), best.gF, best.aF], m: +best.m.toFixed(3), mIn: +side.m.toFixed(3), mOut: +dep.m.toFixed(3), hBclr: +hb.m.toFixed(3) };
    return g.reload;
  }
  /** Etapa 8 (k = 7): pontos nas asas (2º fio montado). 1ª asa (0,03–0,46), recarga da agulha (0,46–0,55), transporte
      à 2ª asa (0,55–0,6), 2ª asa (0,6–0,95), afastamento. */
  function sceneWings(t) {
    const S = baseScene(), g = G;
    const st = restSt(3); st.cut = { relax: 1 }; st.cutFixed = true; st.front = { A: g.form.A[3].marks.end, B: g.form.B[3].marks.end };
    S.gen = 'tied'; S.st = st;
    const op = opIO(t, 0.0, 0.08, 0.95, 1.01);
    const wa = wingPhase(g.wings[0], seg(t, 0.03, 0.46)), wb = wingPhase(g.wings[1], seg(t, 0.6, 0.95));
    let r = t < 0.46 ? wa : wb, hOp = op;
    if (t >= 0.46 && t < 0.6) {
      const R = reloadPlan();
      if (t < 0.55) {
        // troca de pega: o porta-agulha sai (pega anterior) e volta (pega posterior); a pinça segura a agulha parada
        const hIn = t >= 0.51;
        r = { np: R.npA, hp: hIn ? R.hB : R.hA, hold: t < 0.49 ? 'both' : t < 0.53 ? 'forceps' : 'both' };
        if (t < 0.485) r.hold = 'holder';
        hOp = Math.min(op, t < 0.51 ? 1 - ss(t, 0.49, 0.505) : ss(t, 0.51, 0.525));
        if (hOp < 0.02) r.hold = 'forceps';
      } else {
        // transporte rígido (agulha na pega posterior) até a aproximação da 2ª asa (a rolagem da pega se desfaz)
        const e = ss(t, 0.55, 0.6), np = lerpPose(R.npA, wb.np, e); np.p.z += 1.2 * Math.sin(PI * e);
        r = { np, hp: holderOnNeedle(np, g.wings[1].ps.bPost, R.gB * (1 - e), g.wings[1].plane.sX), hold: 'holder' };
      }
      // pinça da recarga: chega aberta por um lado livre (0,46–0,474), entra pelo eixo (até 0,48), fecha e prende
      // (0,48–0,486), abre (0,53–0,535) e sai pelo eixo antes de subir (até 0,56)
      const fR = R.fR;
      const fp = t < 0.48 ? kfPose(t, [[0.46, R.f0], [0.474, R.fAx], [0.48, fR]]) : t < 0.533 ? withAxes(clonePose(fR)) : withAxes(R.back(ss(t, 0.533, 0.56)));
      S.forceps = { pose: fp, op: Math.min(op, ss(t, 0.46, 0.475) * (1 - ss(t, 0.545, 0.56))), open: t < 0.48 ? 0.3 : t < 0.53 ? lerp(0.3, NEEDLE_GAP, ss(t, 0.48, 0.486)) : lerp(NEEDLE_GAP, 0.3, ss(t, 0.53, 0.535)), grips: null, needle: t >= 0.485 && t < 0.53 };
    }
    if (t >= 0.95) { const e = ss(t, 0.95, 1), up = V3(0, 0, 2.5 * e); r = { np: movePose(wb.np, up), hp: movePose(wb.hp, up), hold: 'holder' }; }
    S.needle = { pose: r.np, op, hold: r.hold }; S.holder = { pose: withAxes(r.hp), op: hOp, grips: null, jaw: r.jaw || 0 };
    if (t < 0.46 ? wa.fp : (t >= 0.6 && wb.fp)) { const rf = t < 0.46 ? wa : wb; S.forceps = { pose: rf.fp, op: Math.min(op, rf.fOp), open: rf.fOpen, grips: null, needle: rf.hold === 'forceps' || rf.hold === 'both' }; }
    // o fio de alimentação acompanha a agulha de uma asa para a outra (a parte deitada é arrastada, sem salto)
    const fa = feedBase(g.wings[0]), fbb = feedBase(g.wings[1]), ew = ss(t, 0.5, 0.6);
    const fb = { base: fa.base.clone().lerp(fbb.base, ew), dir: fa.dir.clone().lerp(fbb.dir, ew).normalize() };
    const uw = t < 0.46 ? seg(t, 0.03, 0.46) : seg(t, 0.6, 0.95);
    S.wings = [wa.grow, wb.grow]; S.feed = { np: r.np, w: t < 0.46 ? g.wings[0] : g.wings[1], th: t < 0.46 ? wa.th : (t < 0.6 ? null : wb.th), fb, out: t >= 0.46 && t < 0.6 ? 1 : ss(uw, 0.86, 1.0) }; S.feedOp = op;
    return S;
  }
  /** Etapa 9 (k = 8): gel de clorexidina, curativo transparente e etiqueta. */
  function sceneDress(t) {
    const S = baseScene();
    const st = restSt(3); st.cut = { relax: 1 }; st.cutFixed = true; st.front = { A: G.form.A[3].marks.end, B: G.form.B[3].marks.end };
    S.gen = 'tied'; S.st = st; S.wings = [1, 1];
    S.gelOp = ss(t, 0.1, 0.4); S.dress = ss(t, 0.3, 0.85); S.dressDrop = (1 - ss(t, 0.3, 0.9)) * 0.8; S.labelOp = ss(t, 0.82, 1);
    return S;
  }
  const T_BITE = 0.66, T_SPLIT = 0.34;
  function sceneAt(f) {
    if (f <= 0) return baseScene();
    const k = Math.min(9, Math.floor(f + 1e-9)), t = Math.min(1, f - k);
    if (k === 0) return sceneStep0(t);
    // etapa 2 = ponto (até a agulha sair) + tração até as pontas ficarem iguais + separação e descarte da agulha;
    // etapa 3 = nó instrumental de ancoragem (os movimentos de sceneStep2 se dividem em 0,34)
    if (k === 1) return t < T_BITE ? sceneStep1(t / T_BITE) : sceneStep2(T_SPLIT * (t - T_BITE) / (1 - T_BITE));
    if (k === 2) return sceneStep2(lerp(T_SPLIT, 1, t));
    if (k >= 3 && k <= 5) return t <= 0 ? restScene(k - 3) : sceneCross(k - 2, t);
    if (k === 6) return t <= 0 ? restScene(3) : sceneCutCheck(t);
    if (k === 7) return sceneWings(t);
    if (k === 8) return sceneDress(t);
    const S = sceneDress(1); return S;
  }
  /** Etapas inteiras 3–6: fio em repouso, instrumentos afastados (ocultos). */
  function restScene(d) { const S = baseScene(); S.gen = 'tied'; S.st = restSt(d); return S; }

  /** Fase de um ponto na asa (subtempo u ∈ [0, 1]): aproximação, pega posterior, repega (agulha parada ou extraída pela
      pinça presa ao corpo), saída do arco, afastamento. r.fp/r.fOpen/r.fOp: pinça (só com repega assistida). */
  function wingPhase(w, u) {
    const ps = w.ps, PP = passPoses(ps);
    const thDone = ps.thSwOut, liftV = V3(0, 0, 1.3).addScaledVector(ps.shaft, 0.6);
    let r = null;
    if (u < 0.2) { const e = ss(u, 0, 0.2); r = PP.ready(lerp(2.4, 0, e)); r.th = ps.thIn; }
    else if (u < 0.44) { const th = lerp(ps.thIn, ps.thDrive, ss(u, 0.2, 0.44)); r = PP.drive(th); r.th = th; }
    else if (u < 0.7) { r = PP.regrasp(seg(u, 0.44, 0.7)); }
    else if (u < 0.88) { const th = lerp(ps.thA, thDone, ss(u, 0.7, 0.88)); r = PP.ant(th); r.th = th; }
    if (!r) { const a = PP.ant(thDone), e = ss(u, 0.88, 1); r = { np: movePose(a.np, liftV.clone().multiplyScalar(e)), hp: movePose(a.hp, liftV.clone().multiplyScalar(e)), th: thDone, hold: 'holder' }; }
    // pinça (repega assistida): desce até a pose recuada durante a condução, prende/extrai, recua e sobe
    if (ps.assist) {
      const pre = PP.fPre(), post = PP.fPost();
      if (u >= 0.3 && u < 0.44) { r.fp = kfPose(u, [[0.3, movePose(pre, UPZ.clone().multiplyScalar(2.2))], [0.44, pre]]); r.fOpen = 0.3; }
      else if (u >= 0.7) { r.fp = kfPose(u, [[0.7, post], [0.8, movePose(post, UPZ.clone().multiplyScalar(2))]]); r.fOpen = 0.3; }
      r.fOp = ss(u, 0.3, 0.36) * (1 - ss(u, 0.74, 0.8));
    }
    r.grow = ss(u, 0.6, 0.95);
    return r;
  }
  /** Fio de alimentação: do engaste da agulha das asas; enquanto o engaste está no tecido, o fio refaz o trajeto da
      agulha até o orifício da asa; depois deita ~4 cm rumo à traseira do canhão, por fora da asa em trabalho. */
  const feedBase = (w) => { const o = w ? w.o : G.hubX; return { base: G.hubC.clone().addScaledVector(G.hubY, -0.6).addScaledVector(o, 2.5), dir: horiz(G.hubY.clone().multiplyScalar(-0.7).addScaledVector(o, 0.7)) }; };
  function genFeed(np, w, th, fb) {
    const S = V3(RN * Math.cos(-ARC), RN * Math.sin(-ARC), 0).applyQuaternion(np.q).add(np.p);
    const tS = V3(Math.sin(-ARC), -Math.cos(-ARC), 0).applyQuaternion(np.q).normalize();
    const FB = fb || feedBase(w), base = FB.base;
    const Q = onSurf(base.x, base.y), dir = FB.dir;
    const arr = []; let from = 1;
    const thS = th != null ? th - ARC : -Infinity;
    if (w && th != null && thS > w.thH) {
      // engaste dentro do orifício/tecido: fio sai pelo orifício seguindo o arco
      // (mesmos pontos de controle do caso "engaste fora" no instante em que o engaste passa pelo orifício: sem salto)
      const pl = w.plane; pushArc(arr, pl, thS, w.thH, 0.03); from = arr.length / 3;
      const t0 = pl.e1.clone().multiplyScalar(Math.sin(w.thH)).addScaledVector(pl.e2, -Math.cos(w.thH)).normalize();
      pushCurve(arr, [w.H.clone(), w.H.clone().addScaledVector(t0, 0.4), w.H.clone().lerp(Q, 0.5).add(V3(0, 0, 0.6)), Q], 0.03);
    } else {
      push(arr, S);
      pushCurve(arr, [S.clone(), S.clone().addScaledVector(tS, 0.4), S.clone().lerp(Q, 0.5).add(V3(0, 0, 0.6)), Q], 0.03);
    }
    for (let i = 1; i <= 40; i++) { const q = Q.clone().addScaledVector(dir, i * 0.1); q.x += 0.15 * Math.sin(i * 0.15); push(arr, onSurf(q.x, q.y)); }
    settle(arr, from, { hub: true });
    return arr;
  }

  /* ---- pinça da tesoura que separa a agulha (pose no engaste, no instante do corte) ---- */
  function planSnip() {
    const g = G, an = g.anc;
    const np = movePose(g.lift.np, g.pullVec.clone()), Sw = swagePt(np);
    const st = needleOutSt(np, 1), r = genSide('A', st);
    const tE = (r.tEnd || UPZ.clone().negate()).clone().normalize();
    const cutP = Sw.clone().addScaledVector(tE, -0.06);
    const Zs = tE.clone();
    let Xs = V3().crossVectors(tE, horiz(Sw.clone().sub(an.P2))); if (Xs.lengthSq() < 1e-6) Xs = V3(1, 0, 0); Xs.addScaledVector(Zs, -Xs.dot(Zs)).normalize();
    const Ys = V3().crossVectors(Zs, Xs), q = quatFromBasis(Xs, Ys, Zs);
    const pose = { p: cutP.clone().addScaledVector(Xs, -0.45), q };
    g.snip = { pose, far: { p: pose.p.clone().addScaledVector(Xs, 2.6).add(V3(0, 0, 0.8)), q }, back: { p: pose.p.clone().addScaledVector(Xs, 2.4).add(V3(0, 0, 1.2)), q } };
    g.snipPt = Sw.clone();
    g.dropA = onSurf(Sw.x, Sw.y);
  }

  /** Pose das espiras durante o deslizamento (w: 0 = nas mandíbulas, 1 = no nó): primeiro ao longo das mandíbulas até a
      ponta delas, depois sobre a polilinha da outra ponta (rY.arr), da pegada (rY.gi) até o ponto mais próximo do nó. */
  function coilOnStrand(hp, rY, target, w) {
    const arr = rY.arr, n = arr.length / 3, gi = clamp(rY.gi != null ? rY.gi : n - 1, 1, n - 1);
    let iK = gi, bd = Infinity;
    // o nó está no trecho formado da outra ponta (até J): a busca não se perde em alças da ponta livre
    for (let i = Math.max(0, rY.nT || 0), i1 = Math.min(gi, rY.iJ != null ? rY.iJ : gi); i <= i1; i++) { const d = (arr[i * 3] - target.x) ** 2 + (arr[i * 3 + 1] - target.y) ** 2 + (arr[i * 3 + 2] - target.z) ** 2; if (d < bd) { bd = d; iK = i; } }
    let Ls = 0; for (let i = iK + 1; i <= gi; i++) Ls += Math.hypot(arr[i * 3] - arr[i * 3 - 3], arr[i * 3 + 1] - arr[i * 3 - 2], arr[i * 3 + 2] - arr[i * 3 - 1]);
    const d = w * (COIL_X0 + Ls);
    if (d <= COIL_X0 || gi <= iK) { const c = hp.p.clone().addScaledVector(hp.X, COIL_X0 - Math.min(d, COIL_X0)); return withAxes({ p: c.addScaledVector(hp.X, -COIL_X0), q: hp.q.clone() }); }
    // anda (d − COIL_X0) a partir da pegada, rumo ao nó
    let rem = d - COIL_X0, i = gi; const P = V3(arr[gi * 3], arr[gi * 3 + 1], arr[gi * 3 + 2]), Tn = V3();
    while (i > iK) {
      const ax = arr[i * 3 - 3], ay = arr[i * 3 - 2], az = arr[i * 3 - 1], l = Math.hypot(arr[i * 3] - ax, arr[i * 3 + 1] - ay, arr[i * 3 + 2] - az);
      if (l > 1e-6) Tn.set(arr[i * 3] - ax, arr[i * 3 + 1] - ay, arr[i * 3 + 2] - az).divideScalar(l);
      if (rem <= l) { P.set(arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]).addScaledVector(Tn, -rem); rem = 0; break; }
      rem -= l; i--; P.set(ax, ay, az);
    }
    if (Tn.lengthSq() < 0.5) Tn.copy(hp.X);
    // eixo das espiras: das mandíbulas (X do porta-agulha) para a tangente do fio (rumo à pegada), em ~0,4 cm de percurso
    const e = ss(d - COIL_X0, 0, 0.4), fs = framePose(P, Tn, hp.Y), q = hp.q.clone().slerp(fs.q, e), X = V3(1, 0, 0).applyQuaternion(q);
    return withAxes({ p: P.clone().addScaledVector(X, -COIL_X0), q });
  }
  /** Fios deitados não se atravessam: onde a ponta livre de B (a partir de J) encosta num trecho de A deitado na
      superfície, longe dos nós (> 0,45–0,65 cm), B passa por cima de A (perfil circular, eixo-eixo ≥ 2·R_T + folga).
      Pesos contínuos pela distância aos nós e pela altura de A e de B sobre a superfície: com A ou B no ar (espiras,
      passagem pelo vão, pontas seguras) nada muda — sem saltos de forma entre quadros. */
  const OVER_R = 2 * R_T + 0.016, OVER_CELL = 0.1, overGrid = new Map();
  let overWA = new Float32Array(2048);
  function overStrand(rB, rA) {
    const a = rA.arr, b = rB.arr, nA = a.length / 3, nB = b.length / 3, from = Math.max(rB.iJ != null ? rB.iJ : rB.nT || 0, 0);
    if (nA < 2 || nB - from < 2) return;
    const KC = G.knotCenters, key = (ix, iy) => ix * 100003 + iy; overGrid.clear();
    if (overWA.length < nA) overWA = new Float32Array(nA * 2);
    for (let i = 0; i < nA; i++) {
      const hA = a[i * 3 + 2] - sZ(a[i * 3], a[i * 3 + 1]); overWA[i] = 1 - ss(hA, 0.06, 0.14); if (overWA[i] <= 0.001) continue;
      const k = key(Math.floor(a[i * 3] / OVER_CELL), Math.floor(a[i * 3 + 1] / OVER_CELL)); let L = overGrid.get(k); if (!L) overGrid.set(k, (L = [])); L.push(i);
    }
    for (let j = from; j < nB; j++) {
      const px = b[j * 3], py = b[j * 3 + 1], pz = b[j * 3 + 2], hS = pz - sZ(px, py); if (hS > 0.3) continue;
      let dk = 9; for (const c of KC) dk = Math.min(dk, Math.hypot(px - c.x, py - c.y, pz - c.z));
      const w = ss(dk, 0.45, 0.65) * (1 - ss(hS, 0.15, 0.3)); if (w <= 0.001) continue;
      const ix = Math.floor(px / OVER_CELL), iy = Math.floor(py / OVER_CELL); let zt = pz;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const L = overGrid.get(key(ix + dx, iy + dy)); if (!L) continue;
        for (const i of L) { const dh = Math.hypot(a[i * 3] - px, a[i * 3 + 1] - py); if (dh >= OVER_R) continue; zt = Math.max(zt, pz + overWA[i] * Math.max(0, a[i * 3 + 2] + Math.sqrt(OVER_R * OVER_R - dh * dh) - pz)); }
      }
      if (zt > pz) b[j * 3 + 2] = pz + w * (zt - pz);
    }
  }
  /** Gera e assenta o fio de uma cena; reamostra nos tubos. */
  function bakeScene(S, dst) {
    const out = {};
    if (S.gen === 'needleIn') {
      const r = genNeedleIn(S.nin.np, S.nin.onPlane, S.nin.thT);
      out.A = r.A; out.B = r.B;
      settle(out.B.arr, out.B.nT, { obst: null });
    } else {
      const st = S.st, obst = st.anc.front > 0.25 ? G.obstAll : (st.anc.front > 0 ? [G.obstAll[0]] : null);
      // ordem: a ponta segura pelo porta-agulha primeiro (as espiras dependem da pose ajustada)
      const order = S.coilOn === 'A' ? ['B', 'A'] : ['A', 'B'];
      for (const X of order) {
        // espiras deslizando das mandíbulas para o nó: correm sobre o fio REAL da outra ponta (já calculada), da pegada
        // do porta-agulha até o nó — a topologia do nó se lê durante o deslizamento
        const cX = st.tail && st.tail[X] && st.tail[X].coil, Y = X === 'A' ? 'B' : 'A';
        if (cX && cX.slide && cX.slide.w > 0.001 && out[Y] && S.holder.pose) st.tail[X].coil = Object.assign({}, cX, { pose: coilOnStrand(S.holder.pose, out[Y], cX.slide.target, cX.slide.w) });
        const r = genSide(X, st);
        settle(r.arr, r.nT, { obst }); settle(r.arr, r.nT, { obst });
        r.end = lastV(r.arr);
        const gi = r.gi != null ? clamp(r.gi, 0, r.arr.length / 3 - 1) : r.arr.length / 3 - 1;
        r.gripPt = V3(r.arr[gi * 3], r.arr[gi * 3 + 1], r.arr[gi * 3 + 2]); r.gi = gi;
        out[X] = r; if (!st.cut && st.tail[X] && st.tail[X].H) S.miss = Object.assign(S.miss || {}, { [X]: +r.gripPt.distanceTo(st.tail[X].H).toFixed(3), ['l' + X]: +(r.lrem || 0).toFixed(2) });
        // instrumento que segura esta ponta acompanha o ponto real da pegada (fio esticado não alcança o alvo)
        if (S.holder.grips === X && S.holder.pose && !st.cut) { S.holder.pose.p.copy(r.gripPt); }
        if (S.forceps.grips === X && S.forceps.pose && !st.cut) { S.forceps.pose.p.copy(r.gripPt); }
      }
    }
    if (S.gen !== 'needleIn' && !S.st.cut) overStrand(out.B, out.A);
    for (const X of ['A', 'B']) {
      const r = out[X], a1 = dst[X + '1'], a2 = dst[X + '2'];
      const Ls = G.splitL[X], tot = polyLen(r.arr);
      if (tot <= Ls + 0.01) { dst[X + '1L'] = resample(r.arr, a1.length / 3, a1); dst[X + '2L'] = 0; }
      else {
        const p1 = truncate(r.arr, Ls); dst[X + '1L'] = resample(p1, a1.length / 3, a1);
        // segunda parte: do ponto de corte ao fim
        let acc = 0, j0 = 3; for (let j = 3; j < r.arr.length; j += 3) { const d = Math.hypot(r.arr[j] - r.arr[j - 3], r.arr[j + 1] - r.arr[j - 2], r.arr[j + 2] - r.arr[j - 1]); if (acc + d >= Ls) { j0 = j; break; } acc += d; }
        const p2 = [p1[p1.length - 3], p1[p1.length - 2], p1[p1.length - 1]]; for (let j = j0; j < r.arr.length; j++) p2.push(r.arr[j]);
        dst[X + '2L'] = resample(p2, a2.length / 3, a2);
      }
    }
    return out;
  }
  const bufX = { A1: new Float32Array(N1 * 3), B1: new Float32Array(N1 * 3), A2: new Float32Array(N2 * 3), B2: new Float32Array(N2 * 3) };

  /** Opacidade nos materiais-base e nas cópias (destaque/fantasma do motor clonam materiais). */
  function setOpacity(obj, mat, op) {
    if (mat) { mat.opacity = op; mat.depthWrite = op > 0.98; }
    if (obj) obj.traverse((m) => { if (m.isMesh && m.material && m.material !== mat && !m.userData.__helper && m.material.transparent !== undefined) { m.material.transparent = true; m.material.opacity = op; m.material.depthWrite = op > 0.98; } });
  }
  function setPose(obj, pose) { obj.position.copy(pose.p); obj.quaternion.copy(pose.q); }
  let debugInfo = {}, lastScene = null;

  function applyF(f) {
    const g = G, k = Math.min(9, Math.floor(f + 1e-9)), t = Math.min(1, f - k);
    const S = sceneAt(f); lastScene = S;
    // ---- fio (antes dos instrumentos: o instrumento que segura uma ponta acompanha a extremidade real) ----
    const strandsOn = S.gen !== 'none';
    for (const Sx of [A1, A2, B1, B2]) Sx.mesh.visible = strandsOn;
    if (strandsOn) {
      const dst = bufX; bakeScene(S, dst);
      setOpacity(null, mats.thread, S.thrOp); for (const Sx of [A1, A2, B1, B2]) setOpacity(Sx.mesh, null, S.thrOp);
      A1.P.set(dst.A1); B1.P.set(dst.B1); A2.P.set(dst.A2); B2.P.set(dst.B2);
      const nAe = A1.commit(dst.A1L, null), nBe = B1.commit(dst.B1L, null);
      if (dst.A2L > 0) A2.commit(dst.A2L, nAe); else A2.mesh.visible = false;
      if (dst.B2L > 0) B2.commit(dst.B2L, nBe); else B2.mesh.visible = false;
    }
    // ---- objetos rígidos ----
    const show = (obj, mat, pose, op, extraMat) => { obj.visible = !!pose && op > 0.01; if (obj.visible) { setPose(obj, pose); setOpacity(obj, mat, op); if (extraMat) setOpacity(null, extraMat, op); } };
    show(holder, mats.holder, S.holder.pose, S.holder.op, mats.jaw); if (holder.visible) holder.userData.setOpen(S.holder.jaw || 0);
    show(needle, mats.needle, S.needle.pose, S.needle.op);
    show(forceps, mats.forceps, S.forceps.pose, S.forceps.op); if (forceps.visible) forceps.userData.setOpen(S.forceps.open);
    show(scissors, mats.scissors, S.scissors.pose, S.scissors.op); if (scissors.visible) scissors.userData.setOpen(S.scissors.alpha);
    show(finger, mats.glove, g.fingerPose, S.fingerOp);
    if (S.holder.pose && S.holder.op > 0.01) setA('needleHolder', V3(2.2, 0, 0).applyQuaternion(S.holder.pose.q).add(S.holder.pose.p));
    if (S.needle.pose && S.needle.op > 0.01) setA('sutureNeedle', V3(RN * Math.cos(-ARC / 2), RN * Math.sin(-ARC / 2), 0).applyQuaternion(S.needle.pose.q).add(S.needle.pose.p));
    if (S.forceps.pose && S.forceps.op > 0.01) setA('tissueForceps', S.forceps.pose.p);
    // sobras do corte (acompanham os instrumentos)
    const offOn = !!S.off && S.off.op > 0.01;
    OA.mesh.visible = OB.mesh.visible = offOn;
    if (offOn) { OA.mesh.position.copy(S.off.A); OB.mesh.position.copy(S.off.B); setOpacity(OA.mesh, mats.offcut, S.off.op); setOpacity(OB.mesh, null, S.off.op); }
    // pontos de ancoragem visíveis assim que a agulha atravessa
    const eOp = ss(f, 0, 0.3); mats.exitHalo.opacity = 0.26 * eOp; mats.crust.opacity = 0.55 * eOp;
    markGrp.visible = true; markGrp.children.forEach((m) => { m.visible = m.userData.exitMark ? eOp > 0.01 : f >= 1.5; });
    // pontos nas asas
    g.wings.forEach((w, i) => { const gr = S.wings[i]; const on = gr > 0.001 && !(w.underDrape && iapi.external().surface === 'drape'); w.meshes.forEach((m) => { m.visible = on; if (on) m.userData.grow(gr); }); w.marks.forEach((m) => { m.visible = on; }); });
    // fio de alimentação (2º fio, etapa 8)
    FEED.mesh.visible = !!S.feed && S.feedOp > 0.01;
    if (FEED.mesh.visible) { setOpacity(FEED.mesh, mats.feed, S.feedOp); const F = S.feed; let L;
      if (F.out <= 0.001 || F.th == null) L = resample(genFeed(F.np, F.w, F.out >= 0.999 ? null : F.th, F.fb), FEED.N, FEED.P);
      else { // fim de cada ponto: o trajeto pela pegada dá lugar ao fio livre do engaste ao campo (mescla curta)
        const a = new Float32Array(FEED.N * 3); const La = resample(genFeed(F.np, F.w, F.th, F.fb), FEED.N, a); const Lb = resample(genFeed(F.np, F.w, null, F.fb), FEED.N, FEED.P);
        for (let j = 0; j < a.length; j++) FEED.P[j] = lerp(a[j], FEED.P[j], F.out); L = lerp(La, Lb, F.out);
      } FEED.commit(L, null); }
    // curativo
    if (S.gelOp > 0 || S.dress > 0 || S.labelOp > 0) ensureDressing();
    syncDressing(S);
    // conferência (etapa 7): dedo no canhão com tração breve, seta da tração e marca em cm rente à pele
    if (S.fingerOff && finger.visible) finger.position.add(S.fingerOff);
    const mOp = S.markOp || 0; checkGrp.visible = mOp > 0.01;
    if (checkGrp.visible) { mats.check.opacity = 0.9 * mOp; checkGrp.userData.arrow.position.copy(checkGrp.userData.arrow0).addScaledVector(G.hubY, -0.12 * (S.pullW || 0)); }
    debugInfo = { f, k, t, gen: S.gen };
  }
  /** Visibilidade/opacidade do curativo conforme a cena S (sem S: oculto). Chamado em applyF e logo após o pré-cálculo
      do curativo em quadro parado — as malhas nunca ficam visíveis antes da etapa 9. */
  function syncDressing(S) {
    const D = G && G.dressing; if (!D) return;
    const dr = S ? S.dress || 0 : 0, go = S ? S.gelOp || 0 : 0, lo = S ? S.labelOp || 0 : 0, dd = S ? S.dressDrop || 0 : 0;
    D.film.visible = dr > 0.01; D.gel.visible = go > 0.01; D.label.visible = lo > 0.01;
    if (D.film.visible) { setOpacity(D.film, D.film.userData.mat, dr); D.film.position.set(0, 0, dd); }
    if (D.gel.visible) setOpacity(D.gel, D.gel.userData.mat, 0.5 * go);
    if (D.label.visible) { setOpacity(D.label, D.label.userData.mat, lo); D.label.position.set(0, 0, dd); }
  }

  /* ======================================================================
     7. Curativo transparente semipermeável + gel de clorexidina + etiqueta
        (malhas de grade conformadas por mapa de altura: pele/campo, cateter, canhão, fios FINAIS; "tenda" só junto aos
        objetos — onde não há objeto o filme adere à pele)
     ====================================================================== */
  /** Referencial do filme (u: saída → canhão; w: perpendicular, +w lateral-cranial) e limites a partir do conteúdo:
      saída, ponto de ancoragem, canhão (traseira) e asas, com margem. A borda cranial-medial fica sobre a clavícula,
      antes da queda para a fossa supraclavicular (o filme não forma "vela" sobre a fossa). */
  function dressFrame(g) {
    const ax = horiz(g.hubC.clone().sub(g.exit)), bx = V3(-ax.y, ax.x, 0);
    const ctr = g.exit.clone().lerp(g.hubC, 0.5).addScaledVector(ax, 0.1);
    const uw = (p) => [(p.x - ctr.x) * ax.x + (p.y - ctr.y) * ax.y, (p.x - ctr.x) * bx.x + (p.y - ctr.y) * bx.y];
    const pts = [g.exit, g.anc.P1, g.anc.P2, g.ak.c, g.hubC.clone().addScaledVector(g.hubY, -1.2)];
    for (const sx of [-1.47, 1.47]) for (const sy of [-0.42, 0.72]) pts.push(g.hubC.clone().addScaledVector(g.hubX, sx).addScaledVector(g.hubY, sy)); // cantos das asas
    let u0 = Infinity, u1 = -Infinity, w0 = Infinity, w1 = -Infinity;
    for (const p of pts) { const [u, w] = uw(p); u0 = Math.min(u0, u); u1 = Math.max(u1, u); w0 = Math.min(w0, w); w1 = Math.max(w1, w); }
    const r1 = (x) => Math.round(x * 10) / 10;
    const f = { ax, bx, ctr, uw, U0: r1(u0 - 0.85), U1: r1(u1 + 0.95), W0: r1(Math.min(w0 - 0.75, -2.9)), W1: r1(w1 + 0.7) };
    f.toXY = (u, w) => [ctr.x + ax.x * u + bx.x * w, ctr.y + ax.y * u + bx.y * w];
    // etiqueta (2,0 × 0,9 cm) na borda caudal-medial do filme, entre a saída e o canhão (área livre); âncora do rótulo
    // "Curativo transparente" na borda reforçada, ao lado da etiqueta
    f.lab = { u0: r1(f.U0 + 1.75), w0: r1(f.W0 + 0.25), du: 2.0, dw: 0.9 };
    f.anchorUW = [f.lab.u0 + f.lab.du + 0.55, f.W0 + 0.16];
    const cu = (f.U0 + f.U1) / 2, cw = (f.W0 + f.W1) / 2, [cx, cy] = f.toXY(cu, cw);
    f.center = V3(cx, cy, sZ(cx, cy) + 0.25);
    return f;
  }
  function ensureDressing() {
    if (G.dressing) return;
    const tD0 = performance.now(), dp = {}; const dmk = (k) => { dp[k] = Math.round(performance.now() - tD0); };
    const g = G, F = dressFrame(g);
    const exit = g.exit, { ax, bx, ctr, U0, U1, W0, W1 } = F, HS = 0.1;
    const nu = Math.round((U1 - U0) / HS) + 1, nw = Math.round((W1 - W0) / HS) + 1, NC = nu * nw;
    const skinB = new Float32Array(NC), obj = new Float32Array(NC).fill(-1e9);
    const toXY = F.toXY;
    // apoio: máximo da superfície na vizinhança da célula (a corda do filme entre vértices não pode afundar na pele convexa)
    const hs2 = HS * 0.55;
    for (let j = 0; j < nw; j++) for (let i = 0; i < nu; i++) { const [x, y] = toXY(U0 + i * HS, W0 + j * HS); skinB[j * nu + i] = Math.max(sZ(x, y), sZ(x + hs2, y), sZ(x - hs2, y), sZ(x, y + hs2), sZ(x, y - hs2)) + 0.016; }
    // rasteriza objetos (vértices em coordenadas anatômicas) num campo separado: malhas do cateter (instruments), fios
    // FINAIS, pontos das asas
    ctx.world.updateMatrixWorld(true);
    const W2A = new THREE.Matrix4().copy(ctx.world.matrixWorld).invert(), M = new THREE.Matrix4(), v = V3();
    const stamp = (x, y, z, r) => {
      const du = (x - ctr.x) * ax.x + (y - ctr.y) * ax.y, dw = (x - ctr.x) * bx.x + (y - ctr.y) * bx.y;
      const ci = Math.round((du - U0) / HS), cj = Math.round((dw - W0) / HS), rr = Math.ceil(r / HS);
      for (let jj = cj - rr; jj <= cj + rr; jj++) for (let ii = ci - rr; ii <= ci + rr; ii++) {
        if (ii < 0 || jj < 0 || ii >= nu || jj >= nw) continue;
        const d = Math.hypot(U0 + ii * HS - du, W0 + jj * HS - dw); if (d > r) continue;
        const z2 = z + Math.sqrt(r * r - d * d) * 0.6 + 0.02; const kk = jj * nu + ii; if (z2 > obj[kk]) obj[kk] = z2;
      }
    };
    const meshes = [];
    layers.instrument.traverse((o) => { if (o.isMesh && o.visible !== false && o.userData.info && o.userData.info.id === 'catheter' && !o.userData.internal && !o.userData.exitMark) meshes.push(o); });
    for (const m of meshes) {
      const pa = m.geometry && m.geometry.attributes.position; if (!pa) continue;
      M.multiplyMatrices(W2A, m.matrixWorld);
      const step = pa.count > 3000 ? 2 : 1;
      for (let i = 0; i < pa.count; i += step) {
        v.fromBufferAttribute(pa, i).applyMatrix4(M);
        const du = (v.x - ctr.x) * ax.x + (v.y - ctr.y) * ax.y, dw = (v.x - ctr.x) * bx.x + (v.y - ctr.y) * bx.y;
        if (du < U0 - 0.2 || du > U1 + 0.2 || dw < W0 - 0.2 || dw > W1 + 0.2) continue;
        if (v.z < sZ(v.x, v.y) + 0.012) continue; // trecho interno (subcutâneo) do cateter e faces rentes à pele
        stamp(v.x, v.y, v.z, 0.06);
      }
    }
    // fio no estado FINAL (cotos), independentemente do quadro em que o curativo é pré-calculado
    { const S = sceneDress(1), tmp = { A1: new Float32Array(N1 * 3), B1: new Float32Array(N1 * 3), A2: new Float32Array(N2 * 3), B2: new Float32Array(N2 * 3) };
      bakeScene(S, tmp);
      for (const key of ['A1', 'B1', 'A2', 'B2']) { const a = tmp[key]; if (!(tmp[key + 'L'] > 0)) continue; for (let i = 0; i < a.length / 3; i += 2) stamp(a[i * 3], a[i * 3 + 1], a[i * 3 + 2], R_T + 0.03); } }
    for (const w of g.wings) for (const m of (w.meshes || [])) { const pa = m.geometry.attributes.position; for (let i = 0; i < pa.count; i += 3) { v.fromBufferAttribute(pa, i); stamp(v.x, v.y, v.z, 0.03); } }
    dmk('raster');
    // tenda: o filme não acompanha as quedas abruptas junto aos OBJETOS (dilatação parabólica só do campo dos objetos);
    // a pele entra só com o máximo da vizinhança. Suavização 3×3; longe dos objetos o filme adere (≤ 0,05 cm do apoio)
    const R = 6, kq = 1.7, objD = obj.slice();
    for (let j = 0; j < nw; j++) for (let i = 0; i < nu; i++) {
      const z0 = obj[j * nu + i]; if (z0 < -1e8) continue;
      for (let jj = Math.max(0, j - R); jj <= Math.min(nw - 1, j + R); jj++) for (let ii = Math.max(0, i - R); ii <= Math.min(nu - 1, i + R); ii++) {
        const z = z0 - kq * (((ii - i) * HS) ** 2 + ((jj - j) * HS) ** 2), kk = jj * nu + ii; if (z > objD[kk]) objD[kk] = z;
      }
    }
    const Hh = new Float32Array(NC); for (let k = 0; k < NC; k++) Hh[k] = Math.max(skinB[k], objD[k]);
    const Hs = Hh.slice();
    for (let j = 1; j < nw - 1; j++) for (let i = 1; i < nu - 1; i++) {
      let s = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) s += Hh[(j + dj) * nu + i + di];
      const k = j * nu + i; let h = Math.max(skinB[k], s / 9);
      if (objD[k] < skinB[k] + 0.01) h = Math.min(h, skinB[k] + 0.05);
      Hs[k] = h;
    }
    const hAt = (u, w) => Hs[clamp(Math.round((w - W0) / HS), 0, nw - 1) * nu + clamp(Math.round((u - U0) / HS), 0, nu - 1)];
    // malha do filme
    const mk = (u0, u1, w0, w1, dz, flipU) => {
      const pos = [], uv = [], ix = []; const iu0 = Math.round((u0 - U0) / HS), iu1 = Math.round((u1 - U0) / HS), iw0 = Math.round((w0 - W0) / HS), iw1 = Math.round((w1 - W0) / HS);
      for (let j = iw0; j <= iw1; j++) for (let i = iu0; i <= iu1; i++) {
        const [x, y] = toXY(U0 + i * HS, W0 + j * HS); pos.push(x, y, Hs[j * nu + i] + dz); const uu = (i - iu0) / (iu1 - iu0); uv.push(flipU ? 1 - uu : uu, (j - iw0) / (iw1 - iw0));
      }
      const cu = iu1 - iu0 + 1;
      for (let j = 0; j < iw1 - iw0; j++) for (let i = 0; i < cu - 1; i++) { const a = j * cu + i, b = a + 1, c = a + cu, d = c + 1; ix.push(a, b, d, a, d, c); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(ix); geo.computeVertexNormals();
      return geo;
    };
    // textura alfa (proporção do filme): retângulo arredondado, borda reforçada mais opaca, centro quase transparente
    const fu = U1 - U0 - 0.1, fw = W1 - W0 - 0.1, PXC = 72; // px por cm
    const alphaFilm = (() => { const cw = Math.round(fu * PXC), chh = Math.round(fw * PXC), cv = canvas(cw, chh), c2 = cv.getContext('2d'); c2.fillStyle = '#000'; c2.fillRect(0, 0, cw, chh);
      const rr = (x, y, w, h, r) => { c2.beginPath(); c2.moveTo(x + r, y); c2.lineTo(x + w - r, y); c2.quadraticCurveTo(x + w, y, x + w, y + r); c2.lineTo(x + w, y + h - r); c2.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c2.lineTo(x + r, y + h); c2.quadraticCurveTo(x, y + h, x, y + h - r); c2.lineTo(x, y + r); c2.quadraticCurveTo(x, y, x + r, y); c2.closePath(); };
      const e = 0.06 * PXC, b = 0.42 * PXC; // margem e largura da borda reforçada (cm → px)
      c2.fillStyle = 'rgb(125,125,125)'; rr(e, e, cw - 2 * e, chh - 2 * e, 0.8 * PXC); c2.fill(); c2.fillStyle = 'rgb(20,20,20)'; rr(b, b, cw - 2 * b, chh - 2 * b, 0.55 * PXC); c2.fill();
      c2.strokeStyle = 'rgb(205,205,205)'; c2.lineWidth = 3; rr(e, e, cw - 2 * e, chh - 2 * e, 0.8 * PXC); c2.stroke();
      return new THREE.CanvasTexture(cv); })();
    const filmMat = PM({ color: '#f2f7f9', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08, alphaMap: alphaFilm, opacity: 1, depthWrite: false, side: THREE.DoubleSide });
    // v (j) cresce com w; a textura do canvas cresce para baixo (flipY): o mapeamento é simétrico, sem consequência
    const film = new THREE.Mesh(mk(U0 + 0.05, U1 - 0.05, W0 + 0.05, W1 - 0.05, 0.004), filmMat); film.userData.mat = filmMat;
    film.renderOrder = 12; film.castShadow = false; film.receiveShadow = false;
    C.reg(film, GI({ id: 'dressing-transparent', name: 'Curativo transparente semipermeável (poliuretano)', desc: 'Cobre a saída, a bailarina e as asas, aplicado sem tensão sobre pele limpa e seca; borda reforçada e etiqueta com data e hora da troca.', pickTransparent: true }));
    dressGrp.add(film);
    // gel de clorexidina: almofada oval translúcida sob o filme, centrada na saída
    const alphaGel = (() => { const cv = canvas(128, 128), c2 = cv.getContext('2d'); c2.fillStyle = '#000'; c2.fillRect(0, 0, 128, 128); c2.fillStyle = 'rgb(170,170,170)'; c2.beginPath(); c2.ellipse(64, 64, 60, 60, 0, 0, TWO_PI); c2.fill(); c2.fillStyle = 'rgb(120,120,120)'; c2.beginPath(); c2.ellipse(64, 64, 52, 52, 0, 0, TWO_PI); c2.fill(); return new THREE.CanvasTexture(cv); })();
    const [eu, ew] = F.uw(exit);
    const gelMat = PM({ color: '#9fd0e6', roughness: 0.2, clearcoat: 0.8, alphaMap: alphaGel, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
    const gel = new THREE.Mesh(mk(clamp(eu - 1.3, U0, U1), clamp(eu + 1.3, U0, U1), clamp(ew - 1.0, W0, W1), clamp(ew + 1.0, W0, W1), -0.002), gelMat); gel.userData.mat = gelMat;
    gel.renderOrder = 11; gel.castShadow = false;
    C.reg(gel, GI({ id: 'chg-pad', name: 'Almofada de gel com clorexidina (integrada ao curativo)', desc: 'Gel com gliconato de clorexidina em contato com o sítio de saída, sob o filme transparente; uso conforme o protocolo do serviço.', pickTransparent: true }));
    dressGrp.add(gel);
    // etiqueta de data (papel) sobre o filme, na borda caudal-medial; a marca em cm vem do modelo do cateter
    // (instruments: comprimento introduzido, lido rente à pele)
    let cmMark = 16;
    try { const d = iapi.debug && iapi.debug(), ic = d && d.catheter && d.catheter.insertedCm; if (ic > 0) cmMark = Math.round(ic); } catch (_) { /* mantém 16 */ }
    const lab = (() => { const cv = canvas(256, 112), c2 = cv.getContext('2d'); c2.fillStyle = '#fbfaf3'; c2.fillRect(0, 0, 256, 112); c2.strokeStyle = '#9aa7ad'; c2.lineWidth = 3; c2.strokeRect(2, 2, 252, 108);
      c2.fillStyle = '#4a5560'; c2.font = 'bold 20px sans-serif'; c2.fillText('DATA', 12, 32); c2.fillText('HORA', 12, 66); c2.fillText('CVC SCV D', 12, 100);
      c2.fillStyle = '#1d3f8f'; c2.font = 'italic 26px serif'; c2.fillText('20/11', 92, 34); c2.fillText('14:30', 92, 68); c2.fillStyle = '#4a5560'; c2.font = '18px sans-serif'; c2.fillText('· ' + cmMark + ' cm', 140, 100);
      const t2 = new THREE.CanvasTexture(cv); t2.colorSpace = THREE.SRGBColorSpace; return t2; })();
    const L = F.lab;
    const labMat = new THREE.MeshStandardMaterial({ map: lab, roughness: 0.85, transparent: true, opacity: 1, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }); labMat.clippingPlanes = C.clipPlanes;
    const label = new THREE.Mesh(mk(L.u0, L.u0 + L.du, L.w0, L.w0 + L.dw, 0.012, true), labMat); label.userData.mat = labMat;
    label.renderOrder = 13; C.reg(label, GI({ id: 'dressing-transparent', name: 'Etiqueta do curativo (data, hora, marca do cateter)' }));
    dressGrp.add(label);
    // criadas ocultas: a visibilidade vem de syncDressing (etapa 9) — o pré-cálculo em quadro parado não as mostra
    film.visible = gel.visible = label.visible = false;
    dmk('meshes'); g.dressing = { film, gel, label, prof: dp, frame: { U: [U0, U1], W: [W0, W1] }, cm: cmMark };
    { const [x, y] = toXY(F.anchorUW[0], F.anchorUW[1]); setA('fixDressing', V3(x, y, hAt(F.anchorUW[0], F.anchorUW[1]) + 0.02)); }
  }

  /* ======================================================================
     8. Construção inicial, reassentamento, update e API
     ====================================================================== */
  /** Desvio entre a posição ajustada ao fio esticado e a nominal, no instante em que os instrumentos soltam as pontas. */
  function computeReleaseSnaps() {
    G.rel = null; const rel = {}, tmp = { A1: new Float32Array(N1 * 3), B1: new Float32Array(N1 * 3), A2: new Float32Array(N2 * 3), B2: new Float32Array(N2 * 3) };
    for (const [k, tR] of [[2, T_LAY1], [3, 0.9], [4, 0.9], [5, 0.9]]) {
      const S = k === 2 ? sceneStep2(tR - 1e-4) : sceneAt(k + tR - 1e-4), h0 = S.holder.pose ? S.holder.pose.p.clone() : null, f0 = S.forceps.pose ? S.forceps.pose.p.clone() : null;
      bakeScene(S, tmp);
      rel[k] = { h: h0 ? S.holder.pose.p.clone().sub(h0) : V3(), f: f0 ? S.forceps.pose.p.clone().sub(f0) : V3() };
    }
    G.rel = rel;
  }
  function fullLayout() { layout(); planSnip(); computeReleaseSnaps(); }
  fullLayout();
  iapi.onExternal(() => { if (G && G.dressing) clearGroup(dressGrp); fullLayout(); lastKey = ''; });
  // âncora do curativo antes da 1ª construção: mesmo ponto da borda reforçada (altura aproximada pela superfície)
  { const DF = dressFrame(G), [x, y] = DF.toXY(DF.anchorUW[0], DF.anchorUW[1]); setA('fixDressing', V3(x, y, sZ(x, y) + 0.04)); }
  setA('fixTails', G.exit.clone().add(V3(-0.6, 1.2, 0.1)));
  setA('needleHolder', G.anc.P1); setA('sutureNeedle', G.anc.P1); setA('tissueForceps', G.anc.P1);

  let lastKey = '', idleFrames = 0;
  // portão: a fixação só aparece com o cateter completo (instruments mostra clampes/extensões ao fim da fase 6)
  let gate = null; layers.instrument.traverse((o) => { if (!gate && o.isMesh && /^Clampe da via/.test(o.name || '')) gate = o; });
  function update(state) {
    state = state || {};
    const ph = Math.round(+state.phase || 0);
    const vis = ph >= 6 && (!gate || gate.visible);
    root.visible = vis;
    if (!vis) return;
    const f = clamp(+state.fixStep || 0, 0, 9);
    const key = f.toFixed(4) + '|' + layoutVer;
    // quadros parados: pré-calcula o curativo (fio final) e reaplica a visibilidade da etapa atual (oculto antes da etapa 9)
    if (key === lastKey) { if (!G.dressing && ++idleFrames > 3 && f >= 2) { ensureDressing(); syncDressing(lastScene); } return; }
    idleFrames = 0;
    lastKey = key;
    applyF(f);
    // âncora das pontas: meio das pontas livres (ou cotos após o corte)
    const Sx = A2, i = Math.min(Sx.N - 1, Math.round(Sx.N * (f >= 6.47 ? 0.97 : 0.6)));
    if (Sx.mesh.visible) setA('fixTails', V3(Sx.P[i * 3], Sx.P[i * 3 + 1], Sx.P[i * 3 + 2]));
  }
  // vista final (etapa 9): oblíqua de cima (anterior), um pouco a partir da cabeça e da linha média, centrada no filme e
  // com o curativo inteiro (borda, etiqueta) no quadro. É também a vista do capítulo, do modo reduzido e da impressão
  // (api.focusView === api.finalView)
  const r2 = (v) => [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)];
  // raio 16 e alvo 1,75 cm cranial / 0,5 cm medial do centro do filme: o filme inteiro (borda cranial inclusive) fica
  // abaixo da barra de vistas (y ≥ 60 px) e dentro do visor em 885×609 e 787×435 (tools: w2fix_fixation_frame2.js)
  const finalView = { target: r2(dressFrame(G).center.add(V3(-0.5, 1.75, 0))), radius: 16, az: 0.3, el: 0.55 };
  const focusView = finalView;
  // vistas sugeridas por etapa (k = 0..9)
  const vAnchor = G.anc.P1.clone().lerp(G.exit, 0.3).add(V3(0, 0, 0.5)), vCross = G.cx[2].K.clone().add(V3(0, 0, 0.6)), vHub = G.hubC.clone().lerp(G.cx[3].K, 0.3).add(V3(0, 0, 0.3));
  const stepViews = [focusView,
    // etapa 3: nó de ancoragem e as duas pontas deitadas juntas do lado lateral. Alvo 1 cm lateral e 0,75 cm cranial do
    // ponto (os instrumentos sobem ~2,5 cm ao chegar e ao sair): pontas do porta-agulha e da pinça, extremidades em
    // movimento e o fio inteiro em repouso no quadro (margem ≥ 30 px) em 885×609 e 787×435 (w2fix_fixation_frameopt.js)
    { target: r2(vAnchor), radius: 9, az: 0.3, el: 0.55 }, { target: r2(vAnchor), radius: 7.5, az: 0.3, el: 0.55 }, { target: r2(vAnchor.clone().add(V3(1, 0.75, 0))), radius: 11, az: 0.3, el: 0.6 },
    // cruzamentos: raio 12,5 para que, no aperto, as pontas dos dois instrumentos (pegada a ~2,6 cm do nó, dos dois lados),
    // o dedo no canhão e as pontas em repouso (A em arco para cranial) fiquem no quadro, abaixo da barra de vistas
    { target: r2(vCross.clone().add(V3(0.5, 0.6, 0))), radius: 12.5, az: 0.3, el: 0.6 }, { target: r2(vCross.clone().add(V3(0.5, 0.6, 0))), radius: 12.5, az: 0.3, el: 0.6 }, { target: r2(vCross.clone().add(V3(0.5, 0.6, 0))), radius: 12.5, az: 0.3, el: 0.6 },
    { target: r2(vCross), radius: 8, az: 0.3, el: 0.6 }, { target: r2(vHub), radius: 8.5, az: 0.3, el: 0.55 }, finalView];
  // etapas em que cada âncora faz sentido como rótulo [primeira, última]
  const anchorSteps = { fixExit: [0, 9], fixAnchorStitch: [2, 9], fixAnchorKnot: [3, 9], fixTails: [3, 6], fixCross1: [4, 9], fixCross2: [5, 9], fixCross3: [6, 9], fixFinalKnot: [6, 9],
    fixWingStitchA: [8, 9], fixWingStitchB: [8, 9], fixDressing: [9, 9], needleHolder: [1, 8], sutureNeedle: [1, 2], tissueForceps: [2, 8] }; // pinça: etapa 2 (repega) … etapa 8 (asas e recarga)
  const buildMs = Math.round(performance.now() - T_BUILD0);
  // estado inicial
  update({ phase: 0, fixStep: 0 });

  return {
    anchors,
    update,
    api: {
      steps: STEPS,
      /** ms sugeridos para o movimento de cada etapa k (de k−1 até k); a UI pode usar no lugar de um valor fixo. */
      stepMs: STEP_MS,
      stepViews,
      anchorSteps,
      focusView,
      /** Vista da etapa final (curativo inteiro); igual a focusView e a stepViews[9]. */
      finalView,
      available: true,
      /** Salta direto ao estado de E.state (capturas/impressão): a cena é função pura de fixStep — recalcula já, e o
          curativo (etapa 9) é construído na hora se ainda não existir. */
      settle(state) { lastKey = ''; update(state || {}); },
      /** Diagnóstico numérico (dev): folgas e parâmetros do layout. */
      debug() {
        const g = G, tris = (() => { let n = 0; root.traverse((o) => { if (o.isMesh && o.geometry) { const gg = o.geometry; n += (gg.index ? gg.index.count : gg.attributes.position.count) / 3; } }); return Math.round(n); })();
        const pass = (ps) => ({ log: ps.log.slice(0, 10), thIn: +ps.thIn.toFixed(3), thOut: +ps.thOut.toFixed(3), thDrive: +ps.thDrive.toFixed(3), thA: +ps.thA.toFixed(3), tipOutDeg: +(((ps.thDrive - ps.thOut) * 180) / PI).toFixed(1), regraspFromTipDeg: +((ps.bAnt * 180) / PI).toFixed(1), postDeg: +((ps.bPost * 180) / PI).toFixed(1), gAnt: ps.gAnt, bad: ps.bad, mode: ps.assist ? 'pinça' : 'parada', assist: ps.assist ? { bF: ps.assist.bF, gF: ps.assist.gF, aF: ps.assist.aF, m: ps.assist.m, skin: ps.assist.skin, gap0: ps.assist.gap0, gap1: ps.assist.gap1, fromTipDeg: +((ps.assist.bF * 180) / PI).toFixed(1), elevDeg: +((ps.assist.elev * 180) / PI).toFixed(0) } : null });
        const an = g.anc, nIn = an.plane.e1.clone().multiplyScalar(-Math.sin(an.thIn)).addScaledVector(an.plane.e2, Math.cos(an.thIn)).normalize(), skN = nrm(kZ, an.P1.x, an.P1.y);
        return {
          buildMs, tris, freeLen: +g.sTip.toFixed(3), spacing: +g.spacing.toFixed(3), knots: g.knots.slice(1).map((k) => +k.s.toFixed(3)),
          anchor: { P1: r2(an.P1), P2: r2(an.P2), chord: +an.P1.distanceTo(an.P2).toFixed(3), depthPlane: +an.depth.toFixed(3), depthVert: +(an.depth * an.plane.e2.dot(an.nPerp)).toFixed(3), entryDeg: +(Math.asin(Math.abs(nIn.dot(skN))) * 180 / PI).toFixed(1), tilt: +(TILT * 180 / PI).toFixed(1) },
          len: { A: +g.len.A.toFixed(2), B: +g.len.B.toFixed(2), L0: +g.L0.toFixed(2), tissue: +g.tissueLen.toFixed(2) },
          passA: pass(g.passA), wings: g.wings.map((w) => ({ underDrape: w.underDrape, tilt: +(w.tilt * 180 / PI).toFixed(0), a0: w.a0, bite: +(w.thF - w.thN).toFixed(2), skinBite: w.skinBite, depth: +w.depth.toFixed(3), biteCm: +w.Pn.distanceTo(w.Pf).toFixed(2), pass: pass(w.ps), Pf: r2(w.Pf) })),
          surface: g.ext.surface, state: debugInfo, prof: g.prof, cut: g.cutDbg, dressProf: g.dressing && g.dressing.prof,
          reload: (() => { const R = reloadPlan(); return { m: R.m, mIn: R.mIn, mOut: R.mOut, hBclr: R.hBclr, gB: R.gB, fGrip: R.fGrip }; })(),
        };
      },
      /** (dev) s mais próximo e distância ao eixo do cateter de um ponto anatômico. */
      near(pp) { const q = V3(pp[0], pp[1], pp[2]); const i = nearestS(q, null), s = G.S0 + i * G.DS; frameAt(s); const r = q.clone().sub(FR.c); const ax = r.dot(FR.T); r.addScaledVector(FR.T, -ax); return { s: +s.toFixed(3), d: +r.length().toFixed(3), ax: +ax.toFixed(3), c: FR.c.toArray().map((x) => +x.toFixed(3)) }; },
      /** (dev) polilinha bruta de um tubo do fio. */
      raw(nm) { const Sx = { A1, B1, A2, B2 }[nm]; return Sx ? Array.from(Sx.P) : null; },
      /** Polilinhas atuais dos fios (dev). */
      strands(step = 30) { const o = {}; for (const [nm, Sx] of [['A1', A1], ['B1', B1], ['A2', A2], ['B2', B2]]) { const pts = []; for (let i = 0; i < Sx.N; i += step) pts.push([Sx.P[i * 3], Sx.P[i * 3 + 1], Sx.P[i * 3 + 2]].map((x) => +x.toFixed(2))); o[nm] = { len: +Sx.len.toFixed(2), vis: Sx.mesh.visible, pts }; } return o; },
      /** Comprimentos (dev): caminhos formados por cruzamento e sobra de cada ponta. */
      lengths() { const g = G, o = {}; for (const X of ['A', 'B']) { o[X] = { len: +g.len[X].toFixed(2), anc: +g.ancLen[X].toFixed(2), cross: [] }; for (let c = 1; c <= 3; c++) { const m = g.form[X][c].marks; o[X].cross.push({ c, side1: +m.side1.toFixed(2), under: +m.under.toFixed(2), side2: +m.side2.toFixed(2), end: +m.end.toFixed(2), remAtSide2: +(g.len[X] - g.ancLen[X] - m.side2).toFixed(2), remAtEnd: +(g.len[X] - g.ancLen[X] - m.end).toFixed(2) }); } } return o; },
      /** Cena atual (dev): instrumentos e o que seguram. */
      scene() { const S = lastScene; if (!S) return null; const P = (o) => (o && o.pose && o.op > 0.01 ? r2(o.pose.p) : null); return { gen: S.gen, holder: P(S.holder), hGrip: S.holder.grips, forceps: P(S.forceps), fGrip: S.forceps.grips, needle: P(S.needle), nHold: S.needle.hold, fNeedle: !!S.forceps.needle, scissors: P(S.scissors), finger: S.fingerOp, coil: S.coilOn, miss: S.miss || null }; },
      /** Folga mínima (pele/campo, cateter, canhão) dos objetos rígidos visíveis e dos fios no fixStep atual (dev). */
      clearance() {
        const out = {}; const q = V3();
        const W2A = () => new THREE.Matrix4().copy(ctx.world.matrixWorld).invert();
        const meas = (o) => { let skin = Infinity, c = Infinity, h = Infinity; o.updateWorldMatrix(true, true); const W = W2A(), M = new THREE.Matrix4();
          o.traverse((m) => { if (!m.isMesh || !m.visible) return; M.multiplyMatrices(W, m.matrixWorld); const pa = m.geometry.attributes.position; for (let i = 0; i < pa.count; i += 2) { q.fromBufferAttribute(pa, i).applyMatrix4(M); skin = Math.min(skin, q.z - sZ(q.x, q.y)); if (q.z - sZ(q.x, q.y) < 1.5) { c = Math.min(c, cathDist(q)); h = Math.min(h, hubDist(q)); } } });
          return { skin: +skin.toFixed(3), cath: +c.toFixed(3), hub: +h.toFixed(3) }; };
        for (const [nm, o] of [['holder', holder], ['needle', needle], ['scissors', scissors], ['forceps', forceps], ['finger', finger]]) if (o.visible) out[nm] = meas(o);
        const cath = (Sx) => { let m = Infinity, wi = -1, ws = 0; for (let i = 0; i < Sx.N; i += 1) { q.set(Sx.P[i * 3], Sx.P[i * 3 + 1], Sx.P[i * 3 + 2]); const j = nearestS(q, null); const s = G.S0 + j * G.DS; if (s < 0 || s > G.sTip) continue; frameAt(s); const r = q.clone().sub(FR.c); r.addScaledVector(FR.T, -r.dot(FR.T)); const d = r.length() - G.rC - R_T; if (d < m) { m = d; wi = i; ws = s; } } return [+m.toFixed(3), wi, +ws.toFixed(2)]; };
        const skinS = (Sx, from) => { let m = Infinity; for (let i = from; i < Sx.N; i++) m = Math.min(m, Sx.P[i * 3 + 2] - R_T - sZ(Sx.P[i * 3], Sx.P[i * 3 + 1])); return +m.toFixed(3); };
        for (const [nm, Sx] of [['A2', A2], ['B2', B2]]) if (Sx.mesh.visible) out[nm] = { cath: cath(Sx), skin: skinS(Sx, 0) };
        return out;
      },
    },
  };
});
