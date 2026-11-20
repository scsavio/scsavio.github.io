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
   Ø 0,05 cm (legibilidade). Agulha curva 3/8 de círculo, 2,0 cm, corte reverso
   (fio Ø 0,06 cm desenhado). Porta-agulha Mayo-Hegar ~14,5 cm; tesoura de fio
   ~11,5 cm. Nós: hélice dupla compacta (as laçadas estão resumidas).
   Desempenho: curvas e poses pré-calculadas no layout; por quadro só se refazem
   as posições dos tubos do fio (quando fixStep muda) e as poses/opacidades.
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

  let ins = ctx.engine && ctx.engine.results ? ctx.engine.results.instruments : null;
  if (ins && typeof ins.then === 'function') { try { ins = await ins; } catch (_) { ins = null; } }
  const iapi = ins && ins.api;
  const root = new THREE.Group(); root.name = 'Fixação do cateter (bailarina)'; root.visible = false;
  layers.instrument.add(root);
  if (!iapi || typeof iapi.external !== 'function' || !iapi.external()) {
    return { anchors, update() {}, api: { steps: STEPS, focusView: null, available: false } };
  }
  const sZ = (x, y) => iapi.surfaceZ(x, y);   // superfície de apoio atual (pele ou campo)
  const kZ = (x, y) => iapi.skinZ(x, y);      // pele
  const nrm = (fz, x, y, e = 0.3) => V3(-(fz(x + e, y) - fz(x - e, y)) / (2 * e), -(fz(x, y + e) - fz(x, y - e)) / (2 * e), 1).normalize();

  /* ======================================================================
     1. Constantes, materiais e texturas
     ====================================================================== */
  const R_T = 0.025;                    // raio do fio desenhado
  const RK = 0.028, BULGE = 0.3;        // raio da hélice dos nós e abaulamento central
  const NEEDLE_LEN = 2.0, ARC = 0.75 * PI, RN = NEEDLE_LEN / ARC, R_ND = 0.03;
  const D_A = 0.6, S_P1 = 0.22, BITE = 0.8;   // âncora: distância ao eixo, posição do nó (cm de cateter desde a saída), pegada
  const TILT = 35 * PI / 180;           // elevação da haste do porta-agulha sobre a pele
  const TH_K = 0.62, TH_KF = 0.82;      // meia-abertura angular dos nós sobre o cateter (cruzamentos / nó final)
  const LOOSE = 0.3, LIFT = 0.22;       // laço frouxo: raio extra e elevação
  const L_TAIL = [9.0, 8.0, 7.0, 6.0], L_STUB = 0.55;   // pontas (cm) após o nó de ancoragem e cada cruzamento; coto após o corte
  const N1 = 240, N2 = 900, RAD = 8;    // amostras dos tubos dinâmicos (trecho da âncora / restante) e segmentos radiais
  const GAP = 0.033;                    // meia-abertura entre as mandíbulas (agulha presa)

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
  const PM = (o) => new THREE.MeshPhysicalMaterial(Object.assign({ transparent: true, opacity: 1, depthWrite: true }, o));
  const mats = {
    // náilon preto monofilamentar: quase preto, brilho especular discreto (sem reflexo metálico do ambiente)
    thread: PM({ color: '#08090b', roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.32, envMapIntensity: 0.35 }),
    wing: PM({ color: '#08090b', roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.32, envMapIntensity: 0.35 }),
    feed: PM({ color: '#08090b', roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.32, envMapIntensity: 0.35 }),
    offcut: PM({ color: '#08090b', roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.32, envMapIntensity: 0.35 }),
    holder: PM({ color: '#cdd3d8', metalness: 1, roughness: 0.3, normalMap: brushed, normalScale: new THREE.Vector2(0.3, 0.3) }),
    jaw: PM({ color: '#b3b9be', metalness: 1, roughness: 0.38, normalMap: hatch, normalScale: new THREE.Vector2(0.32, 0.32) }),
    scissors: PM({ color: '#d4dade', metalness: 1, roughness: 0.24 }),
    needle: PM({ color: '#dfe4e8', metalness: 1, roughness: 0.18 }),
    puncture: new THREE.MeshStandardMaterial({ color: '#4c1915', roughness: 0.55, transparent: true, opacity: 0.92, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
  };
  mats.puncture.clippingPlanes = C.clipPlanes;
  mats.crust = mats.puncture.clone(); mats.crust.color.set('#6a2a22'); mats.crust.opacity = 0.55; mats.crust.userData.op0 = 0.55; mats.crust.clippingPlanes = C.clipPlanes;
  // halo róseo discreto (reação local, pele perfundida — não isquêmica) ao redor dos orifícios
  const haloTex = (() => { const cv = canvas(64, 64), g = cv.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); })();
  mats.halo = new THREE.MeshStandardMaterial({ color: '#b4584c', roughness: 0.7, transparent: true, opacity: 0.26, alphaMap: haloTex, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  mats.halo.clippingPlanes = C.clipPlanes;
  // sítio de saída: materiais próprios (aparecem com a fixação, sem alterar os demais capítulos com fase 6)
  mats.exitHalo = mats.halo.clone(); mats.exitHalo.clippingPlanes = C.clipPlanes; mats.exitHalo.userData.op0 = 0.26;

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
     3. Peças rígidas: porta-agulha, tesoura, agulha
     ====================================================================== */
  const infoHolder = GI({ id: 'needle-holder', name: 'Porta-agulha tipo Mayo-Hegar (~14,5 cm)', desc: 'Aço inoxidável, argolas, cremalheira e mandíbulas serrilhadas. A agulha é presa pela ponta das mandíbulas, no terço posterior do corpo, perpendicular a elas; também faz os nós instrumentais.' });
  const infoScissors = GI({ id: 'suture-scissors', name: 'Tesoura de fio', desc: 'Corta as pontas do fio deixando ~0,5–1 cm além do nó final, com as lâminas longe do cateter.' });
  const infoNeedle = GI({ id: 'suture-needle', name: 'Agulha curva 3/8 de círculo, corte reverso (~2 cm)', desc: 'Montada no fio de náilon monofilamentar 3-0. Percorre o arco pela pronossupinação do punho; nunca é segura com os dedos.' });
  /** Porta-agulha. Local: origem = ponto de pega (agulha), +X = haste até as argolas, +Y = abertura das mandíbulas
      (rumo ao centro da agulha), Z = X × Y. Ponta das mandíbulas em x = −0,12. */
  function buildHolder() {
    const grp = new THREE.Group(); grp.name = 'Porta-agulha (Mayo-Hegar)';
    for (const sg of [1, -1]) {
      const jaw = C.sweepGeometry([[-0.12, sg * (GAP + 0.05), 0], [0.55, sg * (GAP + 0.07), 0], [1.2, sg * (GAP + 0.088), 0], [1.82, sg * (GAP + 0.1), 0]],
        { rx: [[0, 0.05], [0.35, 0.07], [1, 0.1]], ry: [[0, 0.075], [0.45, 0.115], [1, 0.16]], up: [0, 1, 0], exp: 3.2, segments: 16, radial: 16, caps: 'round' });
      C.mesh(jaw, mats.jaw, grp, infoHolder);
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
      (a ponta avança no sentido +θ). Secção triangular com o gume na curvatura externa (corte reverso) perto da ponta. */
  function buildNeedle() {
    const pts = []; for (let i = 0; i <= 64; i++) { const th = -ARC * (i / 64); pts.push(V3(RN * Math.cos(th), RN * Math.sin(th), 0)); }
    const tri = (a) => 0.5 / Math.cos((((a % (TWO_PI / 3)) + TWO_PI / 3) % (TWO_PI / 3)) - PI / 3);
    const g = C.sweepGeometry(pts, {
      r: (t) => (t < 0.09 ? 0.004 + (R_ND - 0.004) * C.smooth(0, 0.09, t) : t > 0.94 ? R_ND * (1 + 0.22 * C.smooth(0.94, 0.97, t)) : R_ND),
      up: (t, p) => V3(p.x, p.y, 0).normalize(), radial: 12, segments: 72, caps: 'round',
      radial_fn: (t, a) => { const w = 1 - C.smooth(0.16, 0.42, t); return lerp(1, tri(a) * 1.22, w); },
    });
    const grp = new THREE.Group(); grp.name = 'Agulha curva';
    C.mesh(g, mats.needle, grp, infoNeedle);
    C.reg(grp, infoNeedle);
    return grp;
  }
  const holder = buildHolder(); root.add(holder);
  const scissors = buildScissors(); root.add(scissors); scissors.scale.setScalar(0.85); // ~11,5 cm × 0,85 ≈ 10 cm (tesoura de fio delicada)
  const needle = buildNeedle(); root.add(needle);
  // sondas (referencial local do porta-agulha) para checagem de folga contra pele/campo e cateter
  const HOLDER_PROBES = [];
  { const prx = C.profile([[0, 0.05], [0.35, 0.07], [1, 0.1]]), pry = C.profile([[0, 0.075], [0.45, 0.115], [1, 0.16]]);
    for (const x of [-0.16, 0.25, 0.85, 1.85]) { const tt = clamp((x + 0.12) / 1.94, 0, 1); for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) if (y || z) HOLDER_PROBES.push(V3(x, y * (GAP + 2 * prx(tt)), z * pry(tt))); }
    for (const x of [2.2, 3.5, 5.5, 8, 10.5, 12.3]) for (const y of [-1, 1]) for (const z of [-1, 0, 1]) HOLDER_PROBES.push(V3(x, y * (0.2 + 0.05 * x), z * 0.17));
    for (const y of [-1, 1]) for (const dx of [-0.9, 0, 0.9]) HOLDER_PROBES.push(V3(13.3 + dx, y * (dx ? 1.1 : 1.95), 0)); }

  // fios dinâmicos: A e B (cada um em dois tubos: trecho da âncora e restante), sobras cortadas e fio de alimentação das asas
  const infoBall = GI({ id: 'suture-ballerina', name: 'Fixação em bailarina (fio de náilon 3-0 e nós)', desc: 'Duas pontas do mesmo fio, a partir do ponto de ancoragem, trocam de lado por baixo do cateter e se cruzam por cima com um nó a cada cruzamento. Fio desenhado mais grosso (Ø 0,5 mm) para leitura.' });
  const infoAnchor = GI({ id: 'suture-anchor', name: 'Ponto de ancoragem na pele (nó cirúrgico + seminós)', desc: 'Pegada dérmica paralela ao cateter, de um lado do trecho externo, junto à saída; o nó assenta sobre a pele sem estrangulá-la e deixa as duas pontas longas.' });
  const infoWing = GI({ id: 'suture-wing', name: 'Pontos nas asas do canhão', desc: 'Um ponto por orifício da asa, com nó sobre a asa e pontas curtas; o cateter fica em curva suave entre a bailarina e o canhão.' });
  const A1 = strandMesh(N1, mats.thread, infoAnchor, root), B1 = strandMesh(N1, mats.thread, infoAnchor, root);
  const A2 = strandMesh(N2, mats.thread, infoBall, root), B2 = strandMesh(N2, mats.thread, infoBall, root);
  const OA = strandMesh(260, mats.offcut, infoBall, root), OB = strandMesh(260, mats.offcut, infoBall, root);
  const FEED = strandMesh(300, mats.feed, infoWing, root);
  const markGrp = new THREE.Group(); markGrp.name = 'Orifícios do ponto de ancoragem'; root.add(markGrp); C.reg(markGrp, infoAnchor);
  const wingGrp = new THREE.Group(); wingGrp.name = 'Pontos nas asas'; root.add(wingGrp); C.reg(wingGrp, infoWing);
  const dressGrp = new THREE.Group(); dressGrp.name = 'Curativo transparente'; root.add(dressGrp);

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
    const lo = Math.max(0, hint - 25), hi = Math.min(n - 1, hint + 25);
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
  const onSurf = (x, y, dz = R_T + 0.003) => V3(x, y, sZ(x, y) + dz);
  const quatFromBasis = (X, Y, Z) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));

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
    const Bh = (s) => { frameAt(s); return horiz(FR.B); }, Th = (s) => { frameAt(s); return horiz(FR.T); };
    g.exit = entry.clone();

    /* ---- 4b. ponto de ancoragem: pegada paralela ao cateter, do lado +B (lateral-cranial), nó no orifício junto à saída ---- */
    const sP2 = Math.min(S_P1 + BITE, g.sTip - 0.3);
    const atOff = (s, d) => { const f = foot(s), b = Bh(s); const q = f.addScaledVector(b, d); q.z = kZ(q.x, q.y); return q; };
    const P1 = atOff(S_P1, D_A), P2 = atOff(sP2, D_A);
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
      P1, P2, e1, Bout, nPerp, S, sP2,
      plane: { C: PmPlane.clone().addScaledVector(e2, hc), e1, e2, NZ, q0: quatFromBasis(e1, e2, NZ), sX: Math.sign(NZ.dot(S)) || -1 },
      thIn: Math.atan2(-hc, -hb), thOut: Math.atan2(-hc, hb),
    };
    g.anc.thMid = (g.anc.thIn + g.anc.thOut) / 2;
    // nó de ancoragem: sobre o orifício P1, eixo rumo à saída (−T): a ponte (A) chega por trás, B sobe de P1, as pontas saem para −T
    const n1 = nrm(kZ, P1.x, P1.y, 0.25), ax = e1.clone().negate().addScaledVector(n1, e1.dot(n1)).normalize();
    const qk = V3().crossVectors(n1, ax).normalize();
    g.ak = { c: P1.clone().addScaledVector(ax, 0.1).addScaledVector(n1, R_T + RK * (1 + BULGE) + 0.004), ax, n: n1, q: qk, half: 0.12, b: (PI / 2 + 4 * PI) / 2 };

    /* ---- 4c. cruzamentos: s1 junto ao nó de ancoragem, último a ≥ 0,24 cm do nariz do canhão ---- */
    const s1 = S_P1 + 0.38, s3 = Math.min(g.sTip - 0.24, s1 + 1.0), s2 = (s1 + s3) / 2;
    g.spacing = (s3 - s1) / 2;
    g.knots = [null, { s: s1, th: TH_K, b: 1.5 * PI }, { s: s2, th: TH_K, b: 1.5 * PI }, { s: s3, th: TH_KF, b: 2.5 * PI }];
    g.contact = [{ s: S_P1 + 0.14, phi: 0.75 * PI }, { s: S_P1 + 0.2, phi: 0.35 * PI }];

    /* ---- 4d. curvas de repouso das pontas (no plano da pele/campo) ---- */
    const restCurve = (Q, h0, h1, turn, total, seed) => {
      const out = [[Q.x, Q.y]]; let x = Q.x, y = Q.y; const st = 0.08;
      for (let sg = st; sg <= total + 1e-6; sg += st) {
        const w = C.smooth(0, turn, sg); let hx = lerp(h0.x, h1.x, w), hy = lerp(h0.y, h1.y, w); const l = Math.hypot(hx, hy); hx /= l; hy /= l;
        const wig = 0.1 * Math.sin(sg * 1.25 + seed) * C.smooth(turn * 0.6, turn + 1, sg), cw = Math.cos(wig), sw = Math.sin(wig);
        x += (hx * cw - hy * sw) * st; y += (hx * sw + hy * cw) * st; out.push([x, y]);
      }
      return out;
    };
    const offsetCurve = (c, d) => c.map((q, i) => { const a = c[Math.max(0, i - 1)], b = c[Math.min(c.length - 1, i + 1)]; let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; return [q[0] - (ty / l) * d, q[1] + (tx / l) * d]; });
    g.rest = { A: [], B: [] };
    {
      // após o nó de ancoragem: as duas pontas saem rumo ao cateter e deitam lado a lado em direção cranial (−T)
      const ex = akPt(g, 'A', 1, 1, V3()).add(akPt(g, 'B', 1, 1, V3())).multiplyScalar(0.5);
      const Q = V3(ex.x + ax.x * 0.08, ex.y + ax.y * 0.08, 0);
      const T0 = Th(0.1), B0 = Bh(0.1);
      const mid = restCurve(Q, horiz(ax), V3(-T0.x * 0.9 + B0.x * 0.42, -T0.y * 0.9 + B0.y * 0.42, 0).normalize(), 1.6, 13, 0.6);
      // A sai do lado q = n × (−T) ≈ −B do nó (lado do cateter); B, do lado +B
      const sA = Math.sign(akPt(g, 'A', 1, 1, V3()).sub(ex).dot(V3().crossVectors(V3(0, 0, 1), horiz(ax)))) || 1;
      g.rest.A.push(offsetCurve(mid, 0.045 * sA)); g.rest.B.push(offsetCurve(mid, -0.045 * sA));
    }
    for (let k = 1; k <= 3; k++) {
      const sk = g.knots[k].s + 0.03, f0 = foot(sk), Tk = Th(sk), Bk = Bh(sk);
      const QA = f0.clone().addScaledVector(Bk, 0.42), QB = f0.clone().addScaledVector(Bk, -0.42);
      g.rest.A.push(restCurve(QA, Bk, V3(-Tk.x * 0.9 + Bk.x * 0.45, -Tk.y * 0.9 + Bk.y * 0.45, 0).normalize(), 1.4, 13, 1.3 + k));
      g.rest.B.push(restCurve(QB, Bk.clone().negate(), V3(-Tk.x * 0.9 - Bk.x * 0.45, -Tk.y * 0.9 - Bk.y * 0.45, 0).normalize(), 1.4, 13, 2.1 + k));
    }
    // fio antes do ponto (etapas 1–2): deita a partir de P1 rumo cranial
    { const T0 = Th(0.1), B0 = Bh(0.1); g.restB0 = restCurve(P1, T0.clone().negate(), V3(-T0.x * 0.95 + B0.x * 0.3, -T0.y * 0.95 + B0.y * 0.3, 0).normalize(), 2.5, 22, 0.4); }
    // obstáculos (pontas deitadas passam por cima): ponte do ponto de ancoragem e nó de ancoragem
    g.obst = [{ a: P2.clone(), b: P1.clone(), r: R_T }, { a: g.ak.c.clone().addScaledVector(ax, -g.ak.half), b: g.ak.c.clone().addScaledVector(ax, g.ak.half), r: RK * (1 + BULGE) + R_T }];

    /* ---- 4e. poses do porta-agulha para os nós instrumentais (fio enrolado 2 voltas nas mandíbulas) ---- */
    const tiePose = (J, X, Tref) => { X.normalize(); const Y = Tref.clone().addScaledVector(X, -Tref.dot(X)).normalize(); const Z = V3().crossVectors(X, Y); return { p: J.clone().addScaledVector(X, 0.12), q: quatFromBasis(X, Y, Z), X, Y, Z }; };
    g.tie = [];
    { const Tn = Th(S_P1); g.tie.push(tiePose(g.ak.c.clone().addScaledVector(n1, 0.6).addScaledVector(Bout, 0.2).addScaledVector(Tn, -0.5), Bout.clone().multiplyScalar(0.62).addScaledVector(n1, 0.62).addScaledVector(Tn, -0.48), Tn)); }
    for (let k = 1; k <= 3; k++) {
      frameAt(g.knots[k].s); const K = FR.c.clone().addScaledVector(FR.U, g.rhoK), Uk = FR.U.clone(), Bk = FR.B.clone(), Tk = FR.T.clone();
      g.tie.push(tiePose(K.clone().addScaledVector(Uk, 0.58).addScaledVector(Bk, 0.45).addScaledVector(Tk, 0.08), Bk.clone().multiplyScalar(0.6).addScaledVector(Uk, 0.66).addScaledVector(Tk, 0.42), Tk));
    }
    g.tieLift = g.tie.map((tp) => ({ p: tp.p.clone().addScaledVector(tp.X, 1.0).add(V3(0, 0, 0.6)), q: tp.q.clone(), X: tp.X, Y: tp.Y, Z: tp.Z }));
    // garante folga das poses de nó em relação a pele/campo e cateter
    for (const tp of [...g.tie, ...g.tieLift]) { for (let it = 0; it < 10; it++) { const c = holderClear(tp); if (c.skin >= 0.06 && c.cath >= 0.08 && c.hub >= 0.06) break; tp.p.z += 0.08; } }

    mk('tie');
    /* ---- 4f. passagens da agulha (âncora e asas): regrasp e folgas calculados numericamente ---- */
    g.passA = planPass(g.anc.plane, g.anc.thIn, g.anc.thOut, S);
    mk('passA'); g.wings = ext.wingHoles.map((wh, i) => planWing(g, v3(wh), i)); mk('wings');

    /* ---- 4g. tesoura: pose de corte a partir do estado das pontas no instante do corte ---- */
    g.cut = null; g.offcut = null; g.stubs = null;
    G = g;
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
      r.position.copy(g.exit).addScaledVector(nq, 0.005).addScaledVector(Xr, -0.0); r.quaternion.copy(quat); r.scale.set(1 / sinA, 1, 1); r.userData.exitMark = true; }
    buildWingStitches(g); mk('wingGeo');
    g.dressing = null; // refeito sob demanda
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

  /** Folga de uma pose do porta-agulha: menor altura das sondas sobre a superfície e menor distância ao eixo do cateter. */
  function holderClear(pose) {
    let skin = Infinity, cath = Infinity, hub = Infinity; const q = V3();
    for (const pr of HOLDER_PROBES) {
      q.copy(pr).applyQuaternion(pose.q).add(pose.p);
      const hz = q.z - sZ(q.x, q.y); skin = Math.min(skin, hz);
      if (G && G.hubC) hub = Math.min(hub, hubDist(q));
      if (G && G.cseg && hz < 1.5) cath = Math.min(cath, cathDist(q));
    }
    return { skin, cath, hub };
  }
  /* ---- poses da agulha / porta-agulha ---- */
  const RZ = (th) => new THREE.Quaternion().setFromAxisAngle(V3(0, 0, 1), th);
  function needlePose(plane, th) { return { p: plane.C.clone(), q: plane.q0.clone().multiply(RZ(th)) }; }
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
  const lerpPose = (a, b, t) => ({ p: a.p.clone().lerp(b.p, t), q: a.q.clone().slerp(b.q, t) });
  const movePose = (a, d) => ({ p: a.p.clone().add(d), q: a.q.clone() });
  /** Planeja uma passagem: pega posterior (terço posterior, β ≈ −105°) até o limite de folga das mandíbulas,
      repega o corpo exteriorizado (β ≈ −15°, com rolagem) e completa o arco até o engaste sair da pele. */
  function planPass(plane, thIn, thOut, shaft) {
    const pl = plane, BPOST = -110 * PI / 180, log = [];
    const clr = (th, beta, gam) => { const c = holderClear(holderOnNeedle(needlePose(pl, th), beta, gam, pl.sX)); return Math.min(c.skin - 0.05, c.cath - 0.05, c.hub - 0.04); };
    // pega posterior: gira até as mandíbulas chegarem perto da pele/canhão
    let thDrive = thIn;
    for (let th = thIn; th <= thOut + 0.7; th += 0.025) { if (clr(th, BPOST, 0) < 0) { const c = holderClear(holderOnNeedle(needlePose(pl, th), BPOST, 0, pl.sX)); log.push({ stopAt: +th.toFixed(3), skin: +c.skin.toFixed(3), cath: +c.cath.toFixed(3), hub: +c.hub.toFixed(3) }); break; } thDrive = th; }
    // repega no corpo exteriorizado (β ≥ 13° da ponta): menor ângulo da agulha a partir do qual toda a saída do arco tem folga.
    // Se esse ângulo passa de thDrive, a agulha avança um pouco durante a repega (contratração da pele com a pinça, não modelada).
    const thSwOut = thOut + ARC + 0.18;
    let best = null;
    for (const bdeg of [-15, -20]) for (const gam of [0, -0.4]) {
      const beta = (bdeg * PI) / 180, th0 = Math.max(thDrive, thOut - beta + 0.04), st = 0.05;
      const n = Math.max(1, Math.ceil((thSwOut - th0) / st)); let thA = null;
      for (let i = n; i >= 0; i--) { const th = th0 + i * st; if (clr(th, beta, gam) < 0) break; thA = th; }
      log.push({ bdeg, gam, thA: thA === null ? null : +thA.toFixed(3) });
      if (thA === null || thA > thOut + 1.25) continue;
      const cost = thA + Math.abs(gam) * 0.12 + Math.abs(bdeg + 15) * 0.004;
      if (!best || cost < best.cost) best = { beta, gam, thA, cost };
    }
    const bad = !best;
    if (!best) best = { beta: (-15 * PI) / 180, gam: 0, thA: Math.max(thDrive, thOut + 0.5) };
    return { plane: pl, thIn, thOut, thDrive, bPost: BPOST, bAnt: best.beta, gAnt: best.gam, thA: best.thA, thSwOut, bad, shaft, log };
  }
  /** Poses de uma passagem em função do subtempo. */
  function passPoses(ps) {
    const pl = ps.plane, sX = pl.sX;
    const entry = needlePose(pl, ps.thIn);
    const up = V3(0, 0, 1);
    return {
      ready: (d) => { const np = movePose(entry, up.clone().multiplyScalar(d).addScaledVector(pl.e1, -0.3 * d)); return { np, hp: holderOnNeedle(np, ps.bPost, 0, sX) }; },
      drive: (u) => { const np = needlePose(pl, lerp(ps.thIn, ps.thDrive, u)); return { np, hp: holderOnNeedle(np, ps.bPost, 0, sX) }; },
      // repega: solta a pega posterior, a agulha avança até thA (se preciso) e o porta-agulha prende o corpo exteriorizado
      regrasp: (u) => {
        const th = lerp(ps.thDrive, Math.max(ps.thDrive, ps.thA), ss(u, 0.25, 0.85)), np = needlePose(pl, th);
        const a = holderOnNeedle(needlePose(pl, ps.thDrive), ps.bPost, 0, sX), b = holderOnNeedle(np, ps.bAnt, ps.gAnt, sX);
        const hp = lerpPose(a, b, ss(u, 0, 1)); hp.p.addScaledVector(up, 0.9 * Math.sin(PI * u)).addScaledVector(ps.shaft, 0.5 * Math.sin(PI * u));
        return { np, hp, th };
      },
      ant: (th) => { const np = needlePose(pl, th); return { np, hp: holderOnNeedle(np, ps.bAnt, ps.gAnt, sX) }; },
    };
  }

  /* ---- pontos nas asas: geometria estática (crescimento por drawRange) e passagem da agulha ---- */
  function planWing(g, H, i) {
    const lx = H.clone().sub(g.hubC).dot(g.hubX), sgn = Math.sign(lx) || (i ? 1 : -1);
    const o = g.hubX.clone().multiplyScalar(sgn), nh = g.hubN.clone(), yh = g.hubY.clone();
    // haste para fora do canhão (e um pouco para cima); a pegada corre ao longo do eixo do canhão, rumo ao nariz (+y)
    let best = null;
    for (const deg of [10, 20, 0]) { const w = planWingTilt(g, H, i, o, nh, yh, (deg * PI) / 180); if (!w.ps.bad) return w; if (!best || w.ps.thA < best.ps.thA) best = w; }
    return best;
  }
  function planWingTilt(g, H, i, o, nh, yh, TW) {
    const shaft = o.clone().multiplyScalar(Math.cos(TW)).addScaledVector(nh, Math.sin(TW)).normalize();
    const e1w = yh.clone().addScaledVector(shaft, -yh.dot(shaft)).normalize();
    let e2w = V3().crossVectors(shaft, e1w).normalize(); if (e2w.dot(nh) < 0) e2w.negate();
    const NZ = V3().crossVectors(e1w, e2w);
    const a50 = 50 * PI / 180, cdir = e1w.clone().multiplyScalar(Math.sin(a50)).addScaledVector(e2w, Math.cos(a50));
    const Cw = H.clone().addScaledVector(cdir, RN);
    const plane = { C: Cw, e1: e1w, e2: e2w, NZ, q0: quatFromBasis(e1w, e2w, NZ), sX: Math.sign(NZ.dot(shaft)) || 1 };
    const pt = (th) => Cw.clone().addScaledVector(e1w, RN * Math.cos(th)).addScaledVector(e2w, RN * Math.sin(th));
    const thH = Math.atan2(-Math.cos(a50), -Math.sin(a50));
    let thN = null, thF = null;
    for (let th = thH; th < thH + PI; th += 0.004) { const q = pt(th), d = q.z - kZ(q.x, q.y); if (thN === null && d < 0) thN = th; else if (thN !== null && d > 0) { thF = th; break; } }
    if (thN === null) { thN = thH + 0.15; thF = thH + 1.6; } if (thF === null) thF = thN + 1.2;
    const Pn = pt(thN), Pf = pt(thF);
    const underDrape = sZ(Pf.x, Pf.y) - kZ(Pf.x, Pf.y) > 0.06 || sZ(H.x, H.y) - kZ(H.x, H.y) > 0.06;
    // nó sobre a asa, entre o orifício (r = 0,14) e a borda anterior da asa (0,55 à frente do centro do orifício)
    const top = H.clone().addScaledVector(nh, 0.1);
    const knotC = top.clone().addScaledVector(yh, 0.29).addScaledVector(nh, R_T + RK * (1 + BULGE) + 0.003);
    const ps = planPass(plane, thH - 0.42, thF, shaft);
    return { H, o, nh, yh, top, knotC, plane, Pn, Pf, thN, thF, thH, underDrape, ps, idx: i };
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
     5. Geradores do fio (polilinhas planas x,y,z)
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
    let acc = 0; for (let j = 3; j < a.length; j += 3) { const d = Math.hypot(a[j] - a[j - 3], a[j + 1] - a[j - 2], a[j + 2] - a[j - 1]); if (acc + d >= L) { const f = (L - acc) / (d || 1); const out = a.slice(0, j); out.push(a[j - 3] + (a[j] - a[j - 3]) * f, a[j - 2] + (a[j + 1] - a[j - 2]) * f, a[j - 1] + (a[j + 2] - a[j - 1]) * f); return out; } acc += d; }
    return a.slice();
  }
  /** Curva de repouso (2D) mesclada, deitada sobre a superfície a partir do índice inicial, até o comprimento L. */
  function pushRest(arr, cA, cB, wmix, L) {
    let acc = 0, px = null, py = null, pz = null;
    for (let i = 0; i < cA.length; i++) {
      const x = lerp(cA[i][0], cB[i][0], wmix), y = lerp(cA[i][1], cB[i][1], wmix), z = sZ(x, y) + R_T + 0.003;
      if (px !== null) { const d = Math.hypot(x - px, y - py, z - pz); if (acc + d > L) { const f = (L - acc) / (d || 1); arr.push(px + (x - px) * f, py + (y - py) * f, pz + (z - pz) * f); return; } acc += d; }
      arr.push(x, y, z); px = x; py = y; pz = z;
    }
  }
  /** Ponta livre (comprimento Lt a partir de D0): mescla, ponto a ponto por comprimento de arco, entre a forma em
      repouso (desce pelo lado do cateter, toca a superfície e deita na curva de repouso), a forma "segura pela mão"
      (reta para cima/para o lado, na direção liftDir) e, para a ponta A, a forma enrolada no porta-agulha (nó
      instrumental: duas voltas nas mandíbulas). Resultado sem saltos para qualquer combinação dos pesos. */
  const M_T = 170, bufR = new Float32Array(M_T * 3), bufL = new Float32Array(M_T * 3), bufC = new Float32Array(M_T * 3);
  function pushTail(arr, D0, extPts, tD, Lt, beta, liftDir, coil, restA, restB, wmix) {
    const up = V3(0, 0, 1);
    const q0x = lerp(restA[0][0], restB[0][0], wmix), q0y = lerp(restA[0][1], restB[0][1], wmix);
    const Q = onSurf(q0x, q0y), q1x = lerp(restA[3][0], restB[3][0], wmix), q1y = lerp(restA[3][1], restB[3][1], wmix);
    const Qd = V3(q0x - q1x, q0y - q1y, 0).normalize();
    const restTail = (poly) => { const rr = []; pushRest(rr, restA, restB, wmix, 13); for (let j = 3; j < rr.length; j++) poly.push(rr[j]); };
    // repouso
    const R = []; push(R, D0); for (const e of extPts) push(R, e);
    const Dr = extPts.length ? extPts[extPts.length - 1] : D0;
    const tR = extPts.length > 1 ? Dr.clone().sub(extPts[extPts.length - 2]).normalize() : tD.clone();
    pushCurve(R, [Dr.clone(), Dr.clone().addScaledVector(tR, 0.1), Q.clone().addScaledVector(Qd, 0.16).addScaledVector(up, 0.04), Q], 0.02);
    restTail(R);
    resample(truncate(R, Lt), M_T, bufR);
    // segura (reta com leve flecha)
    if (beta > 0.001) {
      const Lf = []; for (let i = 0; i <= 24; i++) { const sg = (i / 24) * Lt; push(Lf, tmpV.copy(D0).addScaledVector(liftDir, sg).addScaledVector(up, -0.035 * sg * (i / 24))); }
      resample(Lf, M_T, bufL);
      for (let j = 0; j < M_T * 3; j++) bufR[j] = lerp(bufR[j], bufL[j], beta);
    }
    // enrolada no porta-agulha
    const wc = coil ? ss(coil.c, 0, 0.6) : 0;
    if (wc > 0.001) {
      const tp = coil.pose, nT = Math.max(0.02, coil.c), r1 = 0.196, r2 = 0.135;
      const cs = (psi, out) => out.copy(tp.p).addScaledVector(tp.X, 0.32 + 0.08 * psi / TWO_PI).addScaledVector(tp.Y, r1 * Math.cos(psi)).addScaledVector(tp.Z, r2 * Math.sin(psi));
      const Cp = []; push(Cp, D0);
      const CS = cs(0, V3()), Pa = D0.clone().addScaledVector(tD, 0.14), Pb = Pa.clone().lerp(CS, 0.55).addScaledVector(up, 0.08);
      pushCurve(Cp, [D0.clone(), Pa, Pb, CS], 0.025);
      const turns = nT * TWO_PI, nn = Math.ceil(turns / 0.2);
      for (let i = 1; i <= nn; i++) push(Cp, cs((turns * i) / nn, tmpV));
      const CE = cs(turns, V3());
      pushCurve(Cp, [CE, CE.clone().lerp(Q, 0.3).addScaledVector(up, 0.06), Q.clone().addScaledVector(Qd, 0.25).addScaledVector(up, 0.1), Q], 0.025);
      restTail(Cp);
      resample(truncate(Cp, Lt), M_T, bufC);
      for (let j = 0; j < M_T * 3; j++) bufR[j] = lerp(bufR[j], bufC[j], wc);
    }
    for (let j = 3; j < M_T * 3; j++) arr.push(bufR[j]);
  }

  /** Estágio da agulha (etapas 1–2): o fio parte do engaste; antes de entrar, deita a partir do ponto de toque;
      depois segue o trajeto da agulha na pele. Saída: {A1, A2, B1, B2, tissueA, tissueB} (polilinhas). */
  function genNeedleStage(np, stage, thT, pull, L0) {
    const onPlane = stage === 'plane';
    const an = G.anc, pl = an.plane;
    const thS = thT - ARC; // ângulo do engaste no círculo (só vale com a agulha no plano)
    const S = V3(RN * Math.cos(-ARC), RN * Math.sin(-ARC), 0).applyQuaternion(np.q).add(np.p);
    const tS = V3(Math.sin(-ARC), -Math.cos(-ARC), 0).applyQuaternion(np.q).normalize(); // sai do engaste para trás
    const out = { A1: [], A2: [], B1: [], B2: [], tA: 0, tB: 0 };
    const inside = onPlane && thS > an.thIn && thS <= an.thOut;
    const passed = stage === 'pulled' || (onPlane && thS > an.thOut);
    const restA = G.restB0;
    if (!inside && !passed) {
      // ainda não entrou: engaste → ar → toque na curva de repouso (σ_D) → repouso
      const sig = clamp(1.3 * S.distanceTo(an.P1), 0, 2.6), iD = Math.min(restA.length - 4, Math.round(sig / 0.08));
      const Dq = onSurf(restA[iD][0], restA[iD][1]), Dn = onSurf(restA[iD + 3][0], restA[iD + 3][1]);
      push(out.B1, S); push(out.B2, S);
      const lAir = pushCurve(out.B2, [S.clone(), S.clone().addScaledVector(tS, 0.25), S.clone().lerp(Dq, 0.6).add(V3(0, 0, 0.15)), Dq, Dn], 0.025, true);
      const rest = []; for (let i = iD + 3; i < restA.length; i++) rest.push(restA[i]);
      const tailL = Math.max(0.05, L0 - lAir); const rr = []; pushRest(rr, rest, rest, 0, tailL); for (let j = 3; j < rr.length; j++) out.B2.push(rr[j]);
      push(out.A1, S); push(out.A2, S);
      return out;
    }
    // B: (divisão) → P1 → repouso a partir de P1
    const thSplit = inside ? Math.min(thS, an.thMid) : an.thMid;
    pushArc(out.B1, pl, thSplit, an.thIn); out.tB = out.B1.length / 3;
    push(out.B1, tmpW.copy(an.P1).addScaledVector(nrm(kZ, an.P1.x, an.P1.y), 0.05));
    let used = Math.abs((inside ? thS : an.thOut) - an.thIn) * RN;
    // A: divisão → engaste (na pele) ou divisão → P2 → ar → engaste
    if (inside) {
      if (thS > an.thMid) pushArc(out.A1, pl, an.thMid, thS); else push(out.A1, S);
      out.tA = out.A1.length / 3; push(out.A2, S);
    } else {
      pushArc(out.A1, pl, an.thMid, an.thOut); out.tA = out.A1.length / 3;
      // ar: segue o arco (agulha girando) e, ao puxar, vira uma curva direta
      const arcPts = []; pushArc(arcPts, pl, an.thOut, onPlane ? thS : an.thOut + 0.6, 0.03);
      const direct = [];
      const tOut = V3(-Math.sin(an.thOut), Math.cos(an.thOut), 0); const tOutW = pl.e1.clone().multiplyScalar(tOut.x).addScaledVector(pl.e2, tOut.y).normalize();
      const hh = Math.min(0.3, 0.35 * an.P2.distanceTo(S));
      pushCurve(direct, [an.P2.clone(), an.P2.clone().addScaledVector(tOutW, hh), S.clone().addScaledVector(tS, hh), S.clone()], 0.02, false);
      const nA = 80, ra = new Float32Array(nA * 3), rd = new Float32Array(nA * 3);
      if (onPlane && pull <= 0) { for (let j = 0; j < arcPts.length; j++) out.A2.push(arcPts[j]); }
      else { resample(arcPts, nA, ra); resample(direct, nA, rd); const w = onPlane ? ss(pull, 0, 1) : 1; for (let j = 0; j < nA * 3; j++) out.A2.push(lerp(ra[j], rd[j], w)); }
      used += polyLen(out.A2);
    }
    // repouso de B a partir de P1 (o que sobra do fio)
    const Lb = Math.max(0.3, L0 - used);
    const p1o = lastV(out.B1); out.B2.push(p1o.x, p1o.y, p1o.z);
    pushRest(out.B2, restA, restA, 0, Lb);
    return out;
  }

  /** Estágio amarrado (etapas 3–7): ponto de ancoragem, nó de ancoragem (κa), cruzamentos concluídos, cruzamento em
      andamento (ω avanço, λ frouxidão, κ aperto do nó), pontas (β elevação, espiras no porta-agulha, mescla das curvas
      de repouso), corte (pontas curtas). */
  function genTied(st) {
    const an = G.anc, out = { A1: [], A2: [], B1: [], B2: [], tA: 0, tB: 0, cutA: null, cutB: null };
    const kap0 = st.kapA;
    // ---- trecho da âncora (A: meio → P2 → ponte → nó; B: meio → P1 → nó) ----
    pushArc(out.A1, an.plane, an.thMid, an.thOut); out.tA = out.A1.length / 3;
    pushArc(out.B1, an.plane, an.thMid, an.thIn); out.tB = out.B1.length / 3;
    const kA0 = akPt(G, 'A', -1, kap0, V3()), kB0 = akPt(G, 'B', -1, kap0, V3());
    const nP2 = nrm(kZ, an.P2.x, an.P2.y), nP1 = nrm(kZ, an.P1.x, an.P1.y);
    const brA = an.P2.clone().lerp(an.P1, 0.18); brA.z = kZ(brA.x, brA.y) + R_T + 0.003;
    const brB = an.P2.clone().lerp(an.P1, 0.62); brB.z = kZ(brB.x, brB.y) + R_T + 0.003;
    const preK = kA0.clone().addScaledVector(G.ak.ax, -0.12); preK.z = Math.max(preK.z - 0.02, kZ(preK.x, preK.y) + R_T + 0.003);
    pushCurve(out.A1, [an.P2.clone(), an.P2.clone().addScaledVector(nP2, 0.05).addScaledVector(an.e1, -0.04), brA, brB, preK, kA0], 0.02);
    pushCurve(out.B1, [an.P1.clone(), an.P1.clone().addScaledVector(nP1, 0.04), kB0.clone().addScaledVector(G.ak.n, -0.02), kB0], 0.015);
    for (let i = 1; i <= 60; i++) { push(out.A1, akPt(G, 'A', -1 + 2 * i / 60, kap0, tmpV)); push(out.B1, akPt(G, 'B', -1 + 2 * i / 60, kap0, tmpV)); }
    const EA = akPt(G, 'A', 1, kap0, V3()), EB = akPt(G, 'B', 1, kap0, V3());
    out.A2.push(EA.x, EA.y, EA.z); out.B2.push(EB.x, EB.y, EB.z);
    // ---- cruzamentos ----
    const done = st.done, inK = done + 1, prog = inK <= 3 ? st.omega : 0;
    const strands = [{ X: 'A', arr: out.A2, E: EA, ext: [] }, { X: 'B', arr: out.B2, E: EB, ext: [] }];
    for (const sd of strands) {
      const X = sd.X, isA = X === 'A';
      const full = [];               // trajeto completo até o fim do nó em andamento (truncado em ω)
      const pt = (Phi, s, rho, lam) => wrapPt(s, isA ? Phi : TWO_PI - Phi, rho, lam * LIFT, tmpV);
      const nK = prog > 0 ? inK : done; // último nó com algum trajeto
      if (nK >= 1) {
        // vão livre do nó de ancoragem ao contato com o cateter
        const ct = G.contact[isA ? 0 : 1], Phi0 = isA ? ct.phi : TWO_PI - ct.phi;
        const lam1 = nK === 1 && prog > 0 ? st.lam : 0;
        const c0 = pt(Phi0, ct.s, G.rhoW + lam1 * LOOSE, lam1).clone();
        const c1 = pt(Phi0 + 0.25, ct.s + 0.012, G.rhoW + lam1 * LOOSE, lam1).clone();
        const tC = c1.clone().sub(c0).normalize();
        const dirIn = c0.clone().sub(sd.E).normalize();
        pushCurve(full, [sd.E.clone(), sd.E.clone().addScaledVector(G.ak.ax, 0.025).addScaledVector(dirIn, 0.05).add(V3(0, 0, 0.04)), c0.clone().addScaledVector(tC, -0.09), c0], 0.02, false);
        // voltas e nós
        let PhiA = Phi0, sA = ct.s, rhoA = G.rhoW, slope = 1;
        for (let k = 1; k <= nK; k++) {
          const K = G.knots[k], lam = k === inK && prog > 0 ? st.lam : 0, kap = k === inK && prog > 0 ? st.kap : 1;
          const PhiB = TWO_PI * k - K.th;
          const wIn = isA ? -1 : 1, eIn = knotEnd(k, X, wIn, kap);
          const n = Math.max(4, Math.ceil((PhiB - PhiA) / 0.06));
          for (let i = 1; i <= n; i++) {
            const u = i / n, Phi = lerp(PhiA, PhiB, u);
            const h = (u * u * u - 2 * u * u + u) * slope + (-2 * u * u * u + 3 * u * u);
            const s = lerp(sA, eIn.s, h);
            let rho = G.rhoW + (rhoA - G.rhoW) * Math.exp(-(((Phi - PhiA) / 0.45) ** 2)) + (eIn.rho - G.rhoW) * Math.exp(-(((PhiB - Phi) / 0.45) ** 2));
            if (isA && k >= 2) rho += 2.3 * R_T * Math.exp(-(((Phi - (TWO_PI * (k - 1) + PI)) / 0.5) ** 2));
            const lm = k === 1 ? lam : lam * C.smooth(0, 0.5, u); // a frouxidão cresce a partir do nó anterior (já apertado)
            push(full, pt(Phi, s, rho + lm * LOOSE, lm));
          }
          const nk = Math.ceil(K.th * 2 / 0.025);
          for (let i = 1; i <= nk; i++) { const w = isA ? -1 + 2 * i / nk : 1 - 2 * i / nk; push(full, knotPt(k, X, w, kap, lam, tmpV)); }
          const eOut = knotEnd(k, X, isA ? 1 : -1, kap);
          PhiA = TWO_PI * k + K.th; sA = eOut.s; rhoA = eOut.rho; slope = 0;
        }
        // trecho completo do nó em andamento → truncado em ω
        let use = full;
        if (prog > 0 && prog < 1) use = truncate(full, polyLen(full) * prog);
        for (let j = 3; j < use.length; j++) sd.arr.push(use[j]);
        // forma de repouso da ponta: desce pelo lado do cateter a partir do nó concluído
        if (!(prog > 0 && prog < 1) && nK >= 1 && !st.cut) {
          const K = G.knots[nK], ext = PI / 2 - K.th;
          const e = knotEnd(nK, X, isA ? 1 : -1, nK === inK ? st.kap : 1), lam = nK === inK ? st.lam : 0;
          const n = Math.max(1, Math.ceil(ext / 0.06));
          for (let i = 1; i <= n; i++) { const Phi = TWO_PI * nK + K.th + ext * i / n; sd.ext.push(pt(Phi, e.s + 0.02 * i / n, lerp(e.rho, G.rhoW, i / n) + lam * LOOSE, lam).clone()); }
        }
      }
      // ---- ponta ----
      const D = lastV(sd.arr, V3());
      let tD = sd.arr.length >= 6 ? D.clone().sub(V3(sd.arr[sd.arr.length - 6], sd.arr[sd.arr.length - 5], sd.arr[sd.arr.length - 4])) : V3();
      if (!(tD.lengthSq() > 1e-10)) tD = D.clone().sub(akPt(G, X, 0.9, kap0, V3()));
      if (!(tD.lengthSq() > 1e-10)) tD.copy(G.ak.ax);
      tD.normalize();
      if (st.cut) {
        // pontas cortadas: coto rígido (náilon) — mescla da forma elevada no instante do corte para o repouso
        const stub = st.stubs[X], lifted = st.liftStub ? st.liftStub[X] : null, w = st.stubRelax;
        for (let i = 1; i < stub.length; i++) { const p = lifted ? lifted[i].clone().lerp(stub[i], w) : stub[i]; push(sd.arr, p); }
        continue;
      }
      // direção "segura pela mão": para o lado em que o fio avança e para cima (na passagem por baixo do cateter,
      // a ponta sai pelo lado e sobe); no corte, as duas pontas convergem para um ponto acima do nó final
      const up = V3(0, 0, 1);
      let liftDir;
      if (nK >= 1 || prog > 0) {
        // sai do cateter: componente radial (para fora do eixo) + sentido do avanço + para cima
        const iS = nearestS(D, null); frameAt(G.S0 + iS * G.DS); const rad = D.clone().sub(FR.c); rad.addScaledVector(FR.T, -rad.dot(FR.T)).normalize();
        liftDir = tD.clone().multiplyScalar(0.6).addScaledVector(rad, 0.6).addScaledVector(up, 0.8);
        if (liftDir.z < 0.25 * liftDir.length()) liftDir.z = 0.25 * liftDir.length();
        liftDir.normalize();
      } else liftDir = isA ? G.anc.e1.clone().multiplyScalar(0.45).addScaledVector(up, 0.8).addScaledVector(G.anc.Bout, 0.45).normalize() // para onde a agulha foi
        : G.ak.ax.clone().multiplyScalar(0.5).addScaledVector(up, 0.65).addScaledVector(G.anc.Bout, 0.2).normalize();
      if (st.cutLift && G.cut) liftDir.lerp(G.cut.apex[X].clone().sub(D).normalize(), st.cutLift).normalize();
      const kRest = Math.min(3, done), kNext = Math.min(3, done + 1);
      const rA = G.rest[X][kRest], rB = G.rest[X][prog > 0 ? kNext : kRest];
      const coil = isA && st.coil > 0.001 ? { c: st.coil, pose: st.coilPose } : null;
      pushTail(sd.arr, D, sd.ext, tD, st.Lt, st.beta, liftDir, coil, rA, rB, prog > 0 ? st.restMix : 0);
    }
    return out;
  }

  /** Empurra pontos para fora do cateter (ρ ≥ ρ_w), por cima dos obstáculos (ponte e nó) e acima da superfície. */
  function settle(arr, from, opts = {}) {
    const p = V3(); let hint = null;
    for (let j = from * 3; j < arr.length; j += 3) {
      p.set(arr[j], arr[j + 1], arr[j + 2]);
      // cateter
      if (!opts.noCath) {
        const i = nearestS(p, hint); const s = G.S0 + i * G.DS;
        hint = (P_DIST2(p, i) > 0.16) ? null : i; // longe do eixo: a próxima busca volta a ser global
        if (s > -0.02 && s < G.sTip + 0.05) {
          frameAt(s); const r = p.clone().sub(FR.c); const ax = r.dot(FR.T); r.addScaledVector(FR.T, -ax); const d = r.length();
          const need = G.rC + R_T + 0.002;
          if (d < need && d > 1e-6) p.copy(FR.c).addScaledVector(FR.T, ax).addScaledVector(r, need / d);
        }
      }
      // obstáculos deitados (só para pontos rentes à superfície)
      const zs = sZ(p.x, p.y);
      if (opts.obst && p.z - zs < 0.12) for (const ob of G.obst) {
        const ab = tmpW.copy(ob.b).sub(ob.a), l2 = ab.lengthSq(); let u = l2 > 0 ? ((p.x - ob.a.x) * ab.x + (p.y - ob.a.y) * ab.y) / (ab.x * ab.x + ab.y * ab.y || 1) : 0; u = clamp(u, 0, 1);
        const cx = ob.a.x + ab.x * u, cy = ob.a.y + ab.y * u, cz = ob.a.z + ab.z * u, dh = Math.hypot(p.x - cx, p.y - cy), R = ob.r + R_T + 0.002;
        if (dh < R) p.z = Math.max(p.z, cz + Math.sqrt(R * R - dh * dh));
      }
      p.z = Math.max(p.z, zs + R_T + 0.002);
      arr[j] = p.x; arr[j + 1] = p.y; arr[j + 2] = p.z;
    }
  }

  /* ---- pose de corte da tesoura e cotos (calculados uma vez por layout) ---- */
  function computeCut() {
    const g = G; frameAt(g.knots[3].s);
    const K = FR.c.clone().addScaledVector(FR.U, g.rhoK), U3 = FR.U.clone(), B3 = FR.B.clone(), T3 = FR.T.clone();
    g.cut = { apex: { A: K.clone().addScaledVector(U3, 1.7).addScaledVector(T3, 0.35).addScaledVector(B3, 0.05), B: K.clone().addScaledVector(U3, 1.7).addScaledVector(T3, 0.35).addScaledVector(B3, -0.05) } };
    // cotos em repouso: saem das extremidades do nó final para os lados, levemente para cima (náilon é rígido)
    const stubs = {};
    for (const X of ['A', 'B']) {
      const e = knotPt(3, X, X === 'A' ? 1 : -1, 1, 0, V3()), sgn = X === 'A' ? 1 : -1;
      // coto de náilon: sai da ponta do nó para o lado, rígido, e curva um pouco para baixo, rente ao cateter
      const d = B3.clone().multiplyScalar(0.84 * sgn).addScaledVector(U3, 0.12).addScaledVector(T3, 0.52).normalize();
      const pts = []; for (let i = 0; i <= 12; i++) { const sg = (i / 12) * L_STUB; pts.push(e.clone().addScaledVector(d, sg).addScaledVector(U3, -0.75 * sg * sg)); }
      stubs[X] = pts;
    }
    g.stubs = stubs;
    // estado das pontas elevadas no instante do corte → pontos de corte, cotos "elevados" e sobras
    const st = tiedState(6 + 0.56, true);
    const cfg = genTied(st);
    const cutInfo = {};
    for (const X of ['A', 'B']) {
      const arr = cfg[X + '2'];
      // índice da extremidade do nó final na polilinha: procura o ponto mais próximo da saída do nó
      const e = knotPt(3, X, X === 'A' ? 1 : -1, 1, 0, V3());
      let j0 = 0, bd2 = Infinity; for (let j = 0; j < arr.length; j += 3) { const d = (arr[j] - e.x) ** 2 + (arr[j + 1] - e.y) ** 2 + (arr[j + 2] - e.z) ** 2; if (d < bd2) { bd2 = d; j0 = j; } }
      const tail = arr.slice(j0); settle(tail, 0, { obst: true });
      const lifted = truncate(tail, L_STUB), rs = new Float32Array(13 * 3); resample(lifted, 13, rs);
      const lp = []; for (let i = 0; i < 13; i++) lp.push(V3(rs[i * 3], rs[i * 3 + 1], rs[i * 3 + 2]));
      // sobra: do ponto de corte ao fim
      let acc = 0, jc = 0; for (let j = 3; j < tail.length; j += 3) { acc += Math.hypot(tail[j] - tail[j - 3], tail[j + 1] - tail[j - 2], tail[j + 2] - tail[j - 1]); if (acc >= L_STUB) { jc = j; break; } }
      cutInfo[X] = { cp: V3(tail[jc], tail[jc + 1], tail[jc + 2]), dir: V3(tail[jc + 3] - tail[jc - 3], tail[jc + 4] - tail[jc - 2], tail[jc + 5] - tail[jc - 1]).normalize(), lifted: lp, off: tail.slice(jc) };
    }
    g.liftStub = { A: cutInfo.A.lifted, B: cutInfo.B.lifted };
    g.offcut = { A: cutInfo.A.off, B: cutInfo.B.off };
    const CP = cutInfo.A.cp.clone().add(cutInfo.B.cp).multiplyScalar(0.5);
    g.cutDbg = { cpA: cutInfo.A.cp.toArray().map((x) => +x.toFixed(2)), cpB: cutInfo.B.cp.toArray().map((x) => +x.toFixed(2)), dA: cutInfo.A.dir.toArray().map((x) => +x.toFixed(2)), dB: cutInfo.B.dir.toArray().map((x) => +x.toFixed(2)), K: K.toArray().map((x) => +x.toFixed(2)), U: U3.toArray().map((x) => +x.toFixed(2)) };
    const Zs = cutInfo.A.dir.clone().add(cutInfo.B.dir).normalize();
    let Xs = B3.clone().multiplyScalar(0.8).addScaledVector(T3, -0.35).addScaledVector(U3, 0.25); Xs.addScaledVector(Zs, -Xs.dot(Zs)).normalize();
    const Ys = V3().crossVectors(Zs, Xs);
    const q = quatFromBasis(Xs, Ys, Zs);
    // corte com o terço distal das lâminas (a ~1 cm das pontas)
    g.cut.pose = { p: CP.clone().addScaledVector(Xs, -1.0), q, X: Xs };
    g.cut.far = { p: g.cut.pose.p.clone().addScaledVector(Xs, 3.0).add(V3(0, 0, 1.2)), q };
    g.cut.back = { p: g.cut.pose.p.clone().addScaledVector(Xs, 1.6).add(V3(0, 0, 0.7)), q };
    // sobras: tubos estáticos (animados por translação/opacidade)
    for (const [S, X] of [[OA, 'A'], [OB, 'B']]) { const L = resample(g.offcut[X], S.N, S.P); S.commit(L, null); S.mesh.visible = false; }
  }

  /* ======================================================================
     6. Coreografia: estado de cena em função de fixStep
     ====================================================================== */
  /** Parâmetros do estágio amarrado para f ∈ [2.45, 7]. */
  function tiedState(f, forCut) {
    const k = Math.floor(f + 1e-9), t = f - k;
    const st = { kapA: 1, done: 0, omega: 0, lam: 0, kap: 1, beta: 0, coil: 2, coilPose: G.tie[0], restMix: 0, Lt: L_TAIL[0], cut: false, cutLift: 0, stubs: G.stubs, liftStub: null, stubRelax: 1 };
    if (f < 3) { // nó de ancoragem se fechando
      st.kapA = ss(t, 0.6, 0.92); st.beta = 1 - ss(t, 0.82, 1.0); st.coil = 2 * ss(t, 0.66, 0.8); st.coilPose = G.tie[0]; st.Lt = L_TAIL[0];
      return st;
    }
    if (k >= 3 && k <= 5) {
      const c = k - 2; // cruzamento em andamento
      st.done = c - 1; st.omega = ss(t, 0.22, 0.6); st.lam = 0.6 * (1 - ss(t, 0.58, 0.84)); st.kap = ss(t, 0.64, 0.9);
      st.beta = t < 0.6 ? ss(t, 0.06, 0.22) : 1 - ss(t, 0.82, 1.0);
      st.coil = t < 0.5 ? 2 * (1 - ss(t, 0, 0.15)) : 2 * ss(t, 0.74, 0.92);
      st.coilPose = holderTied(k, t);
      st.restMix = ss(t, 0.2, 0.7); st.Lt = lerp(L_TAIL[c - 1], L_TAIL[c], ss(t, 0.2, 0.8));
      return st;
    }
    // k = 6: corte (ou além)
    st.done = 3; st.Lt = L_TAIL[3];
    if (k === 6) {
      st.coil = 2 * (1 - ss(t, 0, 0.15)); st.coilPose = holderTied(6, t);
      st.beta = ss(t, 0.06, 0.32); st.cutLift = ss(t, 0.06, 0.32);
      if (t >= 0.56 && !forCut) { st.cut = true; st.liftStub = G.liftStub; st.stubRelax = ss(t, 0.58, 0.85); }
      return st;
    }
    st.cut = true; st.stubRelax = 1; st.coil = 0; st.beta = 0;
    return st;
  }
  /** Pose do porta-agulha nas etapas de nós (k = 3..6, subtempo t), com eixos X, Y, Z (para as espiras do fio). */
  function holderTied(k, t) {
    const withAxes = (pp, a) => Object.assign(pp, { X: V3(1, 0, 0).applyQuaternion(pp.q), Y: V3(0, 1, 0).applyQuaternion(pp.q), Z: V3(0, 0, 1).applyQuaternion(pp.q) });
    if (k === 6) {
      const away = movePose(G.tieLift[3], G.tieLift[3].X.clone().multiplyScalar(3).add(V3(0, 0, 1.5)));
      return withAxes(t < 0.15 ? lerpPose(G.tie[3], G.tieLift[3], ss(t, 0, 0.15)) : lerpPose(G.tieLift[3], away, ss(t, 0.15, 0.3)));
    }
    const c = k - 2;
    if (t < 0.15) return withAxes(lerpPose(G.tie[c - 1], G.tieLift[c - 1], ss(t, 0, 0.15)));
    if (t < 0.55) return withAxes(lerpPose(G.tieLift[c - 1], G.tieLift[c], ss(t, 0.15, 0.55)));
    return withAxes(lerpPose(G.tieLift[c], G.tie[c], ss(t, 0.6, 0.76)));
  }
  /** Agulha e porta-agulha nas etapas 0 → 2 (subtempo t da etapa k). */
  function needleStep(k, t) {
    const g = G, an = g.anc, PP = passPoses(g.passA), ps = g.passA;
    const th2 = Math.max(ps.thDrive, ps.thA) + 0.07;
    const o = { stage: 'plane', thT: an.thIn, pull: 0, hOp: 1, nOp: 1, thrOp: 1 };
    let r;
    if (k === 0) { r = PP.ready(lerp(3.2, 1.0, ss(t, 0, 0.8))); o.stage = 'pre'; o.hOp = o.nOp = o.thrOp = ss(t, 0, 0.35); }
    else if (k === 1) {
      if (t < 0.3) { r = PP.ready(lerp(1.0, 0, ss(t, 0, 0.3))); o.stage = 'pre'; }
      else if (t < 0.78) { const u = ss(t, 0.3, 0.78); r = PP.drive(u); o.thT = lerp(an.thIn, ps.thDrive, u); }
      else if (t < 0.94) { r = PP.regrasp(seg(t, 0.78, 0.94)); o.thT = r.th; }
      else { o.thT = lerp(Math.max(ps.thDrive, ps.thA), th2, ss(t, 0.94, 1)); r = PP.ant(o.thT); }
    } else {
      if (t < 0.25) { o.thT = lerp(th2, ps.thSwOut, ss(t, 0, 0.25)); r = PP.ant(o.thT); }
      else {
        const a = PP.ant(ps.thSwOut);
        const pv = an.e1.clone().multiplyScalar(1.0).addScaledVector(an.Bout, 0.9).add(V3(0, 0, 1.5));
        const pv2 = an.Bout.clone().multiplyScalar(2.2).add(V3(0, 0, 2.2));
        const off = pv.multiplyScalar(ss(t, 0.25, 0.42)).addScaledVector(pv2, ss(t, 0.42, 0.56));
        r = { np: movePose(a.np, off), hp: movePose(a.hp, off) };
        o.thT = ps.thSwOut; o.pull = ss(t, 0.25, 0.42); o.stage = 'pulled'; o.nOp = 1 - ss(t, 0.47, 0.55);
        if (t >= 0.5) r.hp = lerpPose(r.hp, G.tie[0], ss(t, 0.52, 0.68)); // porta-agulha (sem agulha) volta para o nó instrumental
      }
    }
    o.np = r.np; o.hp = r.hp; return o;
  }

  /** Gera, assenta e reamostra uma configuração em buffers (para mesclas). */
  function bake(cfg, dst) {
    for (const [key, N] of [['A1', N1], ['B1', N1], ['A2', N2], ['B2', N2]]) {
      const arr = cfg[key];
      const from = key === 'A1' ? cfg.tA : key === 'B1' ? cfg.tB : 0;
      settle(arr, Math.max(0, from), { obst: key[1] === '2' });
      dst[key + 'L'] = resample(arr, N, dst[key]);
    }
    return dst;
  }
  const bufX = { A1: new Float32Array(N1 * 3), B1: new Float32Array(N1 * 3), A2: new Float32Array(N2 * 3), B2: new Float32Array(N2 * 3) };
  const bufY = { A1: new Float32Array(N1 * 3), B1: new Float32Array(N1 * 3), A2: new Float32Array(N2 * 3), B2: new Float32Array(N2 * 3) };

  function setOpacity(mat, op) { mat.opacity = op; mat.depthWrite = op > 0.98; }
  function setPose(obj, pose) { obj.position.copy(pose.p); obj.quaternion.copy(pose.q); }
  let debugInfo = {};

  function applyF(f) {
    const g = G;
    const k = Math.min(9, Math.floor(f + 1e-9)), t = Math.min(1, f - k);
    let hp = null, np = null, hOp = 0, nOp = 0, thrOp = 1, mode = 'none';
    let scis = null, sOp = 0, alpha = 0.4;
    const wingsGrow = [0, 0]; let feed = null, fOp = 0, dress = 0, dressDrop = 0, gelOp = 0, labelOp = 0;
    // ---- etapas 0 → 2: agulha ----
    let ns = null;
    if (f <= 0) { mode = 'none'; }
    else if (k <= 2) {
      ns = needleStep(k, t); np = ns.np; hp = ns.hp; hOp = ns.hOp; nOp = ns.nOp; thrOp = ns.thrOp;
      mode = k < 2 || t < 0.45 ? 'needle' : t < 0.68 ? 'blend' : 'tied';
    }
    // ---- etapas 3 → 6: nós e cruzamentos (porta-agulha nas poses do nó instrumental) ----
    else if (k >= 3 && k <= 5) { mode = 'tied'; hOp = 1; hp = holderTied(k, t); }
    else if (k === 6) {
      mode = 'tied'; hp = holderTied(6, t); hOp = 1 - ss(t, 0.1, 0.26);
      sOp = ss(t, 0.2, 0.32);
      scis = t < 0.48 ? lerpPose(g.cut.far, g.cut.pose, ss(t, 0.2, 0.48)) : lerpPose(g.cut.pose, g.cut.back, ss(t, 0.65, 1));
      alpha = t < 0.48 ? 0.38 : t < 0.65 ? lerp(0.38, 0.03, ss(t, 0.48, 0.58)) : lerp(0.03, 0.15, ss(t, 0.65, 1));
    } else if (k === 7) {
      mode = 'tied';
      sOp = 1 - ss(t, 0, 0.12); scis = lerpPose(g.cut.back, movePose(g.cut.back, g.cut.pose.X.clone().multiplyScalar(3).add(V3(0, 0, 1.2))), ss(t, 0, 0.15)); alpha = 0.15;
      // pontos nas asas: asa A (0,06–0,5), asa B (0,5–0,9)
      hOp = nOp = ss(t, 0.04, 0.16);
      const wa = wingPhase(g.wings[0], seg(t, 0.04, 0.5)), wb = wingPhase(g.wings[1], seg(t, 0.5, 0.92));
      const r = t < 0.5 ? wa : wb; np = r.np; hp = r.hp;
      if (t >= 0.5 && t < 0.56) { const e = ss(t, 0.5, 0.56); hp = lerpPose(wa.hp, wb.hp, e); np = lerpPose(wa.np, wb.np, e); }
      wingsGrow[0] = wa.grow; wingsGrow[1] = wb.grow; fOp = hOp; feed = { np, w: t < 0.53 ? g.wings[0] : g.wings[1] };
    } else if (k === 8) {
      mode = 'tied'; wingsGrow[0] = wingsGrow[1] = 1;
      const r = wingPhase(g.wings[1], 1), up = V3(0, 0, 2.5).multiplyScalar(ss(t, 0, 0.25));
      np = movePose(r.np, up); hp = movePose(r.hp, up); hOp = nOp = fOp = 1 - ss(t, 0, 0.22); feed = { np, w: g.wings[1] };
      gelOp = ss(t, 0.18, 0.45); dress = ss(t, 0.35, 0.85); dressDrop = (1 - ss(t, 0.35, 0.9)) * 0.8; labelOp = ss(t, 0.82, 1);
    } else { mode = 'tied'; wingsGrow[0] = wingsGrow[1] = 1; gelOp = dress = labelOp = 1; }

    // ---- objetos rígidos ----
    holder.visible = !!hp && hOp > 0.01; if (holder.visible) { setPose(holder, hp); setOpacity(mats.holder, hOp); setOpacity(mats.jaw, hOp); }
    needle.visible = !!np && nOp > 0.01 && (k <= 2 || k === 7 || k === 8); if (needle.visible) { setPose(needle, np); setOpacity(mats.needle, nOp); }
    scissors.visible = !!scis && sOp > 0.01; if (scissors.visible) { setPose(scissors, scis); scissors.userData.setOpen(alpha); setOpacity(mats.scissors, sOp); }
    if (hp) setA('needleHolder', V3(2.2, 0, 0).applyQuaternion(hp.q).add(hp.p));
    if (np) setA('sutureNeedle', V3(RN * Math.cos(-ARC / 2), RN * Math.sin(-ARC / 2), 0).applyQuaternion(np.q).add(np.p));
    // ---- fio ----
    const strandsOn = mode !== 'none';
    for (const S of [A1, A2, B1, B2]) S.mesh.visible = strandsOn;
    if (strandsOn) {
      setOpacity(mats.thread, thrOp);
      let dst = null;
      if (mode === 'needle') dst = bake(genNeedleStage(ns.np, ns.stage, ns.thT, ns.pull, 14), bufX);
      else if (mode === 'tied') dst = bake(genTied(tiedState(Math.max(f, 2.68))), bufX);
      else { // mescla curta entre o estágio da agulha (congelado em t = 0,45) e o amarrado
        const n45 = needleStep(2, 0.45);
        const a = bake(genNeedleStage(n45.np, n45.stage, n45.thT, n45.pull, 14), bufX);
        const b = bake(genTied(tiedState(Math.max(f, 2.68))), bufY);
        const w = ss(t, 0.45, 0.68);
        for (const key of ['A1', 'B1', 'A2', 'B2']) { const X = a[key], Y = b[key]; for (let j = 0; j < X.length; j++) X[j] = lerp(X[j], Y[j], w); a[key + 'L'] = lerp(a[key + 'L'], b[key + 'L'], w); }
        settle(a.A2, 0, { obst: true }); settle(a.B2, 0, { obst: true });
        dst = a;
      }
      A1.P.set(dst.A1); B1.P.set(dst.B1); A2.P.set(dst.A2); B2.P.set(dst.B2);
      const nAe = A1.commit(dst.A1L, null), nBe = B1.commit(dst.B1L, null);
      A2.commit(dst.A2L, nAe); B2.commit(dst.B2L, nBe);
      // após o corte, só os cotos ficam: A2/B2 já terminam no coto
    }
    // sobras do corte
    const offOn = k === 6 && t >= 0.56 && t < 0.92;
    OA.mesh.visible = OB.mesh.visible = offOn;
    if (offOn) { const u = ss(t, 0.56, 0.9), d = V3(0, 0, 1.6 * u).addScaledVector(g.cut.pose.X, -1.2 * u); OA.mesh.position.copy(d); OB.mesh.position.copy(d); setOpacity(mats.offcut, 1 - ss(t, 0.6, 0.9)); }
    // pontos de ancoragem visíveis assim que a agulha atravessa
    const eOp = ss(f, 0, 0.3); mats.exitHalo.opacity = 0.26 * eOp; mats.crust.opacity = 0.55 * eOp;
    markGrp.visible = true; markGrp.children.forEach((m) => { m.visible = m.userData.exitMark ? eOp > 0.01 : f >= 1.55; });
    // pontos nas asas
    g.wings.forEach((w, i) => { const gr = wingsGrow[i]; const on = gr > 0.001 && !(w.underDrape && iapi.external().surface === 'drape'); w.meshes.forEach((m) => { m.visible = on; if (on) m.userData.grow(gr); }); w.marks.forEach((m) => { m.visible = on; }); });
    // fio de alimentação (2º fio, etapas 7–8): do engaste ao campo
    FEED.mesh.visible = !!feed && fOp > 0.01 && !!np;
    if (FEED.mesh.visible) { setOpacity(mats.feed, fOp); const L = resample(genFeed(np, feed.w), FEED.N, FEED.P); FEED.commit(L, null); }
    // curativo
    if (gelOp > 0 || dress > 0 || labelOp > 0) { ensureDressing(); }
    if (G.dressing) {
      const D = G.dressing; D.film.visible = dress > 0.01; D.gel.visible = gelOp > 0.01; D.label.visible = labelOp > 0.01;
      D.film.material.opacity = dress; D.film.position.set(0, 0, dressDrop); D.gel.material.opacity = 0.5 * gelOp; D.label.material.opacity = labelOp; D.label.position.set(0, 0, dressDrop);
    }
    debugInfo = { f, k, t, mode };
  }

  /** Fase de um ponto na asa (subtempo u ∈ [0, 1]): aproximação, pega posterior, repega, saída do arco, afastamento. */
  function wingPhase(w, u) {
    const ps = w.ps, PP = passPoses(ps);
    const thDone = ps.thSwOut, liftV = V3(0, 0, 1.3).addScaledVector(ps.shaft, 0.6);
    let r;
    if (u < 0.22) { const e = ss(u, 0, 0.22); r = PP.ready(lerp(2.4, 0, e)); }
    else if (u < 0.5) r = PP.drive(ss(u, 0.22, 0.5));
    else if (u < 0.64) r = PP.regrasp(seg(u, 0.5, 0.64));
    else if (u < 0.86) { const th = lerp(Math.max(ps.thDrive, ps.thA), thDone, ss(u, 0.64, 0.86)); r = PP.ant(th); }
    if (r && r.th === undefined) r.th = null;
    else { const a = PP.ant(thDone), e = ss(u, 0.86, 1); r = { np: movePose(a.np, liftV.clone().multiplyScalar(e)), hp: movePose(a.hp, liftV.clone().multiplyScalar(e)) }; }
    r.grow = ss(u, 0.62, 0.95);
    return r;
  }
  /** Fio de alimentação: do engaste da agulha das asas até a superfície, deitado ~4 cm rumo à traseira do canhão. */
  function genFeed(np, w) {
    const S = V3(RN * Math.cos(-ARC), RN * Math.sin(-ARC), 0).applyQuaternion(np.q).add(np.p);
    const tS = V3(Math.sin(-ARC), -Math.cos(-ARC), 0).applyQuaternion(np.q).normalize();
    // deita para fora da asa em trabalho (nunca por cima do canhão)
    const o = w ? w.o : G.hubX, base = G.hubC.clone().addScaledVector(G.hubY, -0.6).addScaledVector(o, 2.5);
    const Q = onSurf(base.x, base.y), dir = horiz(G.hubY.clone().multiplyScalar(-0.7).addScaledVector(o, 0.7));
    const arr = []; push(arr, S);
    pushCurve(arr, [S.clone(), S.clone().addScaledVector(tS, 0.4), S.clone().lerp(Q, 0.5).add(V3(0, 0, 0.6)), Q], 0.03);
    for (let i = 1; i <= 40; i++) { const q = Q.clone().addScaledVector(dir, i * 0.1); q.x += 0.15 * Math.sin(i * 0.15); push(arr, onSurf(q.x, q.y)); }
    settle(arr, 1, {});
    return arr;
  }

  /* ======================================================================
     7. Curativo transparente semipermeável + gel de clorexidina + etiqueta
        (malhas de grade conformadas por mapa de altura: pele/campo, cateter, canhão, fios; "tenda" nas bordas dos objetos)
     ====================================================================== */
  function ensureDressing() {
    if (G.dressing) return;
    const tD0 = performance.now(), dp = {}; const dmk = (k) => { dp[k] = Math.round(performance.now() - tD0); };
    const g = G;
    const exit = g.exit, hubC = g.hubC;
    const ax = horiz(hubC.clone().sub(exit)), bx = V3(-ax.y, ax.x, 0);
    const ctr = exit.clone().lerp(hubC, 0.5).addScaledVector(ax, 0.1);
    const U0 = -3.4, U1 = 3.6, W0 = -3.0, W1 = 3.0, HS = 0.1;
    const nu = Math.round((U1 - U0) / HS) + 1, nw = Math.round((W1 - W0) / HS) + 1;
    const Hh = new Float32Array(nu * nw), base = new Float32Array(nu * nw);
    const toXY = (u, w) => [ctr.x + ax.x * u + bx.x * w, ctr.y + ax.y * u + bx.y * w];
    // apoio: máximo da superfície na vizinhança da célula (a corda do filme entre vértices não pode afundar na pele convexa)
    const hs2 = HS * 0.55;
    for (let j = 0; j < nw; j++) for (let i = 0; i < nu; i++) { const [x, y] = toXY(U0 + i * HS, W0 + j * HS); base[j * nu + i] = Math.max(sZ(x, y), sZ(x + hs2, y), sZ(x - hs2, y), sZ(x, y + hs2), sZ(x, y - hs2)) + 0.016; }
    // rasteriza objetos (vértices em coordenadas anatômicas): malhas do cateter (instruments), fios desta etapa, pontos das asas
    ctx.world.updateMatrixWorld(true);
    const W2A = new THREE.Matrix4().copy(ctx.world.matrixWorld).invert(), M = new THREE.Matrix4(), v = V3();
    const stamp = (x, y, z, r) => {
      const du = (x - ctr.x) * ax.x + (y - ctr.y) * ax.y, dw = (x - ctr.x) * bx.x + (y - ctr.y) * bx.y;
      const ci = Math.round((du - U0) / HS), cj = Math.round((dw - W0) / HS), rr = Math.ceil(r / HS);
      for (let jj = cj - rr; jj <= cj + rr; jj++) for (let ii = ci - rr; ii <= ci + rr; ii++) {
        if (ii < 0 || jj < 0 || ii >= nu || jj >= nw) continue;
        const d = Math.hypot(U0 + ii * HS - du, W0 + jj * HS - dw); if (d > r) continue;
        const z2 = z + Math.sqrt(r * r - d * d) * 0.6 + 0.02; const kk = jj * nu + ii; if (z2 > base[kk]) base[kk] = z2;
      }
    };
    const meshes = [];
    layers.instrument.traverse((o) => { if (o.isMesh && o.visible !== false && o.userData.info && o.userData.info.id === 'catheter' && !o.userData.internal) meshes.push(o); });
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
    for (const S of [A1, A2, B1, B2]) { if (!S.mesh.visible) continue; for (let i = 0; i < S.N; i += 2) stamp(S.P[i * 3], S.P[i * 3 + 1], S.P[i * 3 + 2], R_T + 0.03); }
    for (const w of g.wings) for (const m of (w.meshes || [])) { const pa = m.geometry.attributes.position; for (let i = 0; i < pa.count; i += 3) { v.fromBufferAttribute(pa, i); stamp(v.x, v.y, v.z, 0.03); } }
    dmk('raster');
    // tenda: o filme não acompanha quedas abruptas (dilatação parabólica) e é levemente suavizado
    const R = 6, kq = 1.7;
    for (let j = 0; j < nw; j++) for (let i = 0; i < nu; i++) {
      let m = base[j * nu + i];
      for (let jj = Math.max(0, j - R); jj <= Math.min(nw - 1, j + R); jj++) for (let ii = Math.max(0, i - R); ii <= Math.min(nu - 1, i + R); ii++) {
        const d2 = ((ii - i) * HS) ** 2 + ((jj - j) * HS) ** 2; const z = base[jj * nu + ii] - kq * d2; if (z > m) m = z;
      }
      Hh[j * nu + i] = m;
    }
    const Hs = Hh.slice();
    for (let j = 1; j < nw - 1; j++) for (let i = 1; i < nu - 1; i++) { let s = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) s += Hh[(j + dj) * nu + i + di]; Hs[j * nu + i] = Math.max(base[j * nu + i], s / 9); }
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
    // textura alfa: retângulo arredondado, borda reforçada mais opaca, centro quase transparente
    const alphaFilm = (() => { const cv = canvas(512, 448), c2 = cv.getContext('2d'); c2.fillStyle = '#000'; c2.fillRect(0, 0, 512, 448);
      const rr = (x, y, w, h, r) => { c2.beginPath(); c2.moveTo(x + r, y); c2.lineTo(x + w - r, y); c2.quadraticCurveTo(x + w, y, x + w, y + r); c2.lineTo(x + w, y + h - r); c2.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c2.lineTo(x + r, y + h); c2.quadraticCurveTo(x, y + h, x, y + h - r); c2.lineTo(x, y + r); c2.quadraticCurveTo(x, y, x + r, y); c2.closePath(); };
      c2.fillStyle = 'rgb(125,125,125)'; rr(6, 6, 500, 436, 60); c2.fill(); c2.fillStyle = 'rgb(20,20,20)'; rr(34, 34, 444, 380, 40); c2.fill();
      c2.strokeStyle = 'rgb(205,205,205)'; c2.lineWidth = 3; rr(6, 6, 500, 436, 60); c2.stroke();
      const t2 = new THREE.CanvasTexture(cv); return t2; })();
    const film = new THREE.Mesh(mk(U0 + 0.05, U1 - 0.05, W0 + 0.05, W1 - 0.05, 0.004), PM({ color: '#f2f7f9', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08, alphaMap: alphaFilm, opacity: 1, depthWrite: false, side: THREE.DoubleSide }));
    film.renderOrder = 12; film.castShadow = false; film.receiveShadow = false;
    C.reg(film, GI({ id: 'dressing-transparent', name: 'Curativo transparente semipermeável (poliuretano)', desc: 'Cobre a saída, a bailarina e as asas, aplicado sem tensão sobre pele limpa e seca; borda reforçada e etiqueta com data e hora da troca.', pickTransparent: true }));
    dressGrp.add(film);
    // gel de clorexidina: almofada oval translúcida sob o filme, centrada na saída
    const alphaGel = (() => { const cv = canvas(128, 128), c2 = cv.getContext('2d'); c2.fillStyle = '#000'; c2.fillRect(0, 0, 128, 128); c2.fillStyle = 'rgb(170,170,170)'; c2.beginPath(); c2.ellipse(64, 64, 60, 60, 0, 0, TWO_PI); c2.fill(); c2.fillStyle = 'rgb(120,120,120)'; c2.beginPath(); c2.ellipse(64, 64, 52, 52, 0, 0, TWO_PI); c2.fill(); return new THREE.CanvasTexture(cv); })();
    const eu = (exit.x - ctr.x) * ax.x + (exit.y - ctr.y) * ax.y, ew = (exit.x - ctr.x) * bx.x + (exit.y - ctr.y) * bx.y;
    const gel = new THREE.Mesh(mk(clamp(eu - 1.3, U0, U1), clamp(eu + 1.3, U0, U1), clamp(ew - 1.0, W0, W1), clamp(ew + 1.0, W0, W1), -0.002), PM({ color: '#9fd0e6', roughness: 0.2, clearcoat: 0.8, alphaMap: alphaGel, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
    gel.renderOrder = 11; gel.castShadow = false;
    C.reg(gel, GI({ id: 'chg-pad', name: 'Almofada de gel com clorexidina (integrada ao curativo)', desc: 'Gel com gliconato de clorexidina em contato com o sítio de saída, sob o filme transparente; uso conforme o protocolo do serviço.', pickTransparent: true }));
    dressGrp.add(gel);
    // etiqueta de data (papel) sobre o filme, no canto próximo à traseira do canhão
    const lab = (() => { const cv = canvas(256, 112), c2 = cv.getContext('2d'); c2.fillStyle = '#fbfaf3'; c2.fillRect(0, 0, 256, 112); c2.strokeStyle = '#9aa7ad'; c2.lineWidth = 3; c2.strokeRect(2, 2, 252, 108);
      c2.fillStyle = '#4a5560'; c2.font = 'bold 20px sans-serif'; c2.fillText('DATA', 12, 32); c2.fillText('HORA', 12, 66); c2.fillText('CVC SCV D', 12, 100);
      c2.fillStyle = '#1d3f8f'; c2.font = 'italic 26px serif'; c2.fillText('20/11', 92, 34); c2.fillText('14:30', 92, 68); c2.fillStyle = '#4a5560'; c2.font = '18px sans-serif'; c2.fillText('· 15 cm', 140, 100);
      const t2 = new THREE.CanvasTexture(cv); t2.colorSpace = THREE.SRGBColorSpace; return t2; })();
    const lu0 = U1 - 2.55, lw0 = W0 + 0.35, label = new THREE.Mesh(mk(lu0, lu0 + 2.0, lw0, lw0 + 0.9, 0.012, true), new THREE.MeshStandardMaterial({ map: lab, roughness: 0.85, transparent: true, opacity: 1, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
    label.renderOrder = 13; C.reg(label, GI({ id: 'dressing-transparent', name: 'Etiqueta do curativo (data, hora, marca do cateter)' }));
    dressGrp.add(label);
    dmk('meshes'); g.dressing = { film, gel, label, prof: dp };
    setA('fixDressing', V3(...toXY(lu0 + 1.0, lw0 + 0.45), 0).setZ(Hs[Math.round((lw0 + 0.45 - W0) / HS) * nu + Math.round((lu0 + 1.0 - U0) / HS)] + 0.02));
  }

  /* ======================================================================
     8. Construção inicial, reassentamento, update e API
     ====================================================================== */
  layout();
  iapi.onExternal(() => { if (G && G.dressing) clearGroup(dressGrp); layout(); lastKey = ''; });
  // âncora do curativo antes da 1ª construção: centro entre a saída e o canhão
  setA('fixDressing', G.exit.clone().lerp(G.hubC, 0.5).add(V3(0, 0, 0.2)));
  setA('fixTails', G.exit.clone().add(V3(-0.6, 1.2, 0.1)));
  setA('needleHolder', G.anc.P1); setA('sutureNeedle', G.anc.P1);

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
    if (key === lastKey) { if (!G.dressing && ++idleFrames > 3 && f >= 2) ensureDressing(); return; } // quadros parados: pré-calcula o curativo
    idleFrames = 0;
    lastKey = key;
    applyF(f);
    // âncora das pontas: meio das pontas livres (ou cotos após o corte)
    const S = A2, i = Math.min(S.N - 1, Math.round(S.N * (f >= 6.56 ? 0.97 : 0.6)));
    if (S.mesh.visible) setA('fixTails', V3(S.P[i * 3], S.P[i * 3 + 1], S.P[i * 3 + 2]));
  }
  // vista recomendada: close-up oblíquo de cima (anterior), um pouco a partir da cabeça e da linha média
  const fv = G.exit.clone().lerp(G.hubC, 0.42);
  const focusView = { target: [+fv.x.toFixed(2), +fv.y.toFixed(2), +(fv.z + 0.2).toFixed(2)], radius: 8.5, az: 0.3, el: 0.5 };
  const buildMs = Math.round(performance.now() - T_BUILD0);
  // estado inicial
  update({ phase: 0, fixStep: 0 });

  return {
    anchors,
    update,
    api: {
      steps: STEPS,
      focusView,
      available: true,
      /** Diagnóstico numérico (dev): folgas e parâmetros do layout. */
      debug() {
        const g = G, tris = (() => { let n = 0; root.traverse((o) => { if (o.isMesh && o.geometry) { const gg = o.geometry; n += (gg.index ? gg.index.count : gg.attributes.position.count) / 3; } }); return Math.round(n); })();
        const pass = (ps) => ({ log: ps.log.slice(0, 8), thIn: +ps.thIn.toFixed(3), thOut: +ps.thOut.toFixed(3), thDrive: +ps.thDrive.toFixed(3), tipOutDeg: +(((ps.thDrive - ps.thOut) * 180) / PI).toFixed(1), bAntDeg: +((ps.bAnt * 180) / PI).toFixed(1), gAnt: ps.gAnt, bad: ps.bad });
        return {
          buildMs, tris, freeLen: +g.sTip.toFixed(3), spacing: +g.spacing.toFixed(3), knots: g.knots.slice(1).map((k) => +k.s.toFixed(3)),
          anchor: { P1: g.anc.P1.toArray().map((x) => +x.toFixed(2)), P2: g.anc.P2.toArray().map((x) => +x.toFixed(2)), depth: +(RN - Math.sqrt(RN * RN - (g.anc.P1.distanceTo(g.anc.P2) / 2) ** 2)).toFixed(3) },
          passA: pass(g.passA), wings: g.wings.map((w) => ({ underDrape: w.underDrape, pass: pass(w.ps), Pf: w.Pf.toArray().map((x) => +x.toFixed(2)) })),
          tie: g.tie.map((tp) => { const c = holderClear(tp); return { skin: +c.skin.toFixed(2), cath: +c.cath.toFixed(2) }; }),
          surface: g.ext.surface, state: debugInfo, prof: g.prof, cut: g.cutDbg, dressProf: g.dressing && g.dressing.prof,
        };
      },
      /** (dev) s mais próximo e distância ao eixo do cateter de um ponto anatômico. */
      near(pp) { const q = V3(pp[0], pp[1], pp[2]); const i = nearestS(q, null), s = G.S0 + i * G.DS; frameAt(s); const r = q.clone().sub(FR.c); const ax = r.dot(FR.T); r.addScaledVector(FR.T, -ax); return { s: +s.toFixed(3), d: +r.length().toFixed(3), ax: +ax.toFixed(3), c: FR.c.toArray().map((x) => +x.toFixed(3)) }; },
      /** Polilinhas atuais dos fios (dev). */
      strands(step = 30) { const o = {}; for (const [nm, S] of [['A1', A1], ['B1', B1], ['A2', A2], ['B2', B2]]) { const pts = []; for (let i = 0; i < S.N; i += step) pts.push([S.P[i * 3], S.P[i * 3 + 1], S.P[i * 3 + 2]].map((x) => +x.toFixed(2))); o[nm] = { len: +S.len.toFixed(2), vis: S.mesh.visible, pts }; } return o; },
      /** Folga mínima (pele/campo e cateter) de todos os objetos rígidos e dos fios no fixStep atual (dev). */
      clearance() {
        const out = {}; const q = V3();
        const fz = (o) => { let skin = Infinity; o.updateWorldMatrix(true, true); const W2A = new THREE.Matrix4().copy(ctx.world.matrixWorld).invert(), M = new THREE.Matrix4();
          o.traverse((m) => { if (!m.isMesh || !m.visible) return; M.multiplyMatrices(W2A, m.matrixWorld); const pa = m.geometry.attributes.position; for (let i = 0; i < pa.count; i += 2) { q.fromBufferAttribute(pa, i).applyMatrix4(M); skin = Math.min(skin, q.z - sZ(q.x, q.y)); } }); return +skin.toFixed(3); };
        if (holder.visible) out.holder = fz(holder); if (needle.visible) out.needle = fz(needle); if (scissors.visible) out.scissors = fz(scissors);
        const ch = (o) => { let c = Infinity, h = Infinity; const W2A = new THREE.Matrix4().copy(ctx.world.matrixWorld).invert(), M = new THREE.Matrix4(); o.updateWorldMatrix(true, true);
          o.traverse((m) => { if (!m.isMesh || !m.visible) return; M.multiplyMatrices(W2A, m.matrixWorld); const pa = m.geometry.attributes.position; for (let i = 0; i < pa.count; i += 2) { q.fromBufferAttribute(pa, i).applyMatrix4(M); c = Math.min(c, cathDist(q)); h = Math.min(h, hubDist(q)); } }); return [+c.toFixed(3), +h.toFixed(3)]; };
        for (const [nm, o] of [['holderCH', holder], ['needleCH', needle], ['scissorsCH', scissors]]) if (o.visible) out[nm] = ch(o);
        const cath = (S) => { let m = Infinity, wi = -1, ws = 0; for (let i = 0; i < S.N; i += 1) { q.set(S.P[i * 3], S.P[i * 3 + 1], S.P[i * 3 + 2]); const j = nearestS(q, null); const s = G.S0 + j * G.DS; if (s < 0 || s > G.sTip) continue; frameAt(s); const r = q.clone().sub(FR.c); r.addScaledVector(FR.T, -r.dot(FR.T)); const d = r.length() - G.rC - R_T; if (d < m) { m = d; wi = i; ws = s; } } return [+m.toFixed(3), wi, +ws.toFixed(2)]; };
        const skinS = (S, from) => { let m = Infinity; for (let i = from; i < S.N; i++) m = Math.min(m, S.P[i * 3 + 2] - R_T - sZ(S.P[i * 3], S.P[i * 3 + 1])); return +m.toFixed(3); };
        for (const [nm, S] of [['A2', A2], ['B2', B2]]) if (S.mesh.visible) out[nm] = { cath: cath(S), skin: skinS(S, 0) };
        return out;
      },
    },
  };
});
