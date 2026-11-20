/* ==========================================================================
   nerves.js — nervos e linfáticos da região cervicotorácica
   Camada `nerve`: plexo braquial D/E (raízes C5–T1 → troncos → divisões → fascículos → ramos
   terminais e colaterais), nervos frênicos, vagos, laríngeos recorrentes, troncos simpáticos com
   gânglios (cervical médio, estrelado, torácicos) e alça subclávia.
   Camada `lymph`: ducto torácico (com cisterna do quilo e tronco jugular E), ducto linfático direito
   (com troncos jugular e broncomediastinal D) e linfonodos supraclaviculares.
   Coordenadas ANATÔMICAS (x = direita do paciente, y cranial, z anterior; cm) — ver landmarks.js.
   Método:
   • trajetos-guia derivados de LM → "relaxamento" (afastamento mútuo entre nervos não conectados, com ordem
     ântero-posterior explícita nos cruzamentos; afastamento dos sólidos de vasos/músculos — ou dos eixos de LM —,
     além de 1ª costela, clavícula, cúpula, traqueia, brônquios e esôfago; mola de retorno ao guia; desvio máximo);
   • acabamento contra as MALHAS reais de músculos em lâmina (escalenos, serrátil, peitorais) e da escápula;
   • trechos torácicos (frênicos sobre o pericárdio; vagos sobre o esôfago) presos a guias medidos na geometria do
     mediastino (o módulo de vísceras é construído depois deste);
   • linhagens contínuas do plexo (raiz → tronco → divisão → fascículo → ramo) varridas como UMA superfície e depois
     fatiadas em malhas nomeadas — calibre e quadros contínuos, sem colares nas junções; ramos laterais nascem
     dentro do pai, mais finos e sem tampa.
   Lado esquerdo = espelho do direito onde a anatomia é simétrica; trajetos próprios onde não é (vago/recorrente/
   frênico E, ducto torácico, alça subclávia E, linfonodos E). `ctx.__marks` (opcional) recebe tempos parciais.
   ========================================================================== */
ATLAS.define('nerves', function (ctx) {
  'use strict';
  const { THREE, C, LM, layers } = ctx;
  const LN = layers.nerve, LL = layers.lymph;
  const T0 = performance.now(), mark = (k) => { if (ctx.__marks) ctx.__marks[k] = Math.round(performance.now() - T0); };
  const VS = LM.vessels;
  const v3 = (p) => new THREE.Vector3(p[0], p[1], p[2]);
  const ar = (v) => [v.x, v.y, v.z];
  const mx = (p) => [-p[0], p[1], p[2]];
  const mxs = (pts) => pts.map(mx);
  const crv = (pts) => C.curve(pts);
  const ptAt = (c, t) => ar(c.getPointAt(C.clamp(t, 0, 1)));

  /** Parâmetro t (comprimento de arco) em que uma curva monotônica em x atinge a abscissa x. */
  function tAtX(c, x) {
    const sgn = c.getPointAt(1).x > c.getPointAt(0).x ? 1 : -1;
    let lo = 0, hi = 1;
    for (let k = 0; k < 28; k++) { const m = (lo + hi) / 2; if ((c.getPointAt(m).x - x) * sgn < 0) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }
  /** Sub-trecho de curva (t0→t1) em n+1 pontos. */
  const sub = (c, t0, t1, n = 6) => { const o = []; for (let i = 0; i <= n; i++) o.push(ptAt(c, C.lerp(t0, t1, i / n))); return o; };
  /** Interpolação linear de tabela [[y, v], ...] (y decrescente ou crescente). */
  const tabY = (T, y) => { const s = T[0][0] > T[T.length - 1][0] ? -1 : 1; if ((y - T[0][0]) * s <= 0) return T[0][1]; for (let i = 1; i < T.length; i++) if ((y - T[i][0]) * s <= 0) { const u = (y - T[i - 1][0]) / (T[i][0] - T[i - 1][0]); return C.lerp(T[i - 1][1], T[i][1], u); } return T[T.length - 1][1]; };

  /* ---------------- materiais ---------------- */
  // Textura fascicular: poucas faixas longitudinais onduladas (feixes) — mais "nervo" que "músculo".
  const fasc = C.tex.fibers('nerveFasc', { cycles: 7, size: 128, strength: 3.2 });
  // reutiliza os mapas de ruído já gerados pelo núcleo (cache por chave) — evita custo de construção
  const gangN = C.tex.noiseNormal('nz', { freq: 0.05, strength: 2.5 });
  const ductN = C.tex.noiseNormal('fine', { freq: 0.16, strength: 1.6, seed: 8 });
  // variação sutil de cor (mosqueado) multiplicada pela cor do material — tira o aspecto "plástico" uniforme
  const mot = C.tex.mottle('nerveMot', '#ffffff', { size: 128, amp: 0.09, freq: 0.07, seed: 6 });
  const MAT = {
    // nervos somáticos: amarelo convencional, brilho acetinado do epineuro
    nerve: C.mat({ map: mot, color: '#efcf62', roughness: 0.42, sheen: 0.55, sheenRoughness: 0.45, sheenColor: '#fff3c2', clearcoat: 0.14, clearcoatRoughness: 0.5, normalMap: fasc, normalScale: new THREE.Vector2(0.5, 0.5), cut: 0xe2c062 }),
    // vago/recorrente: mesmo código de cor, tom levemente mais claro
    vagus: C.mat({ map: mot, color: '#f1d877', roughness: 0.42, sheen: 0.55, sheenRoughness: 0.45, sheenColor: '#fff6d2', clearcoat: 0.14, clearcoatRoughness: 0.5, normalMap: fasc, normalScale: new THREE.Vector2(0.45, 0.45), cut: 0xe4c86f }),
    // autonômico (tronco simpático): ocre um pouco mais escuro, para diferenciar do somático
    auto: C.mat({ map: mot, color: '#ddb24e', roughness: 0.46, sheen: 0.45, sheenColor: '#ffe9b0', normalMap: fasc, normalScale: new THREE.Vector2(0.35, 0.35), cut: 0xc89c3e }),
    ganglion: C.mat({ map: mot, color: '#d9a955', roughness: 0.5, sheen: 0.5, sheenRoughness: 0.5, sheenColor: '#ffe2a8', normalMap: gangN, normalScale: new THREE.Vector2(0.55, 0.55), cut: 0xc4943f }),
    // linfáticos: verde convencional; ducto com superfície úmida
    duct: C.mat({ color: '#86bd5c', roughness: 0.3, clearcoat: 0.65, clearcoatRoughness: 0.3, sheen: 0.3, sheenColor: '#e6ffd0', normalMap: ductN, normalScale: new THREE.Vector2(0.25, 0.25), cut: 0x6a9a45 }),
    node: C.mat({ color: '#9cc46e', roughness: 0.5, sheen: 0.45, sheenColor: '#efffd8', clearcoat: 0.25, clearcoatRoughness: 0.5, normalMap: gangN, normalScale: new THREE.Vector2(0.3, 0.3), cut: 0x7aa54f }),
  };

  mark('mats');
  /* ---------------- obstáculos anatômicos (eixos de LM) ---------------- */
  /** Tubo-obstáculo: amostras a cada ~0,3 cm + raio por amostra. */
  function obsTube(key, pts, r) {
    const c = crv(pts), len = c.getLength(), n = Math.max(2, Math.ceil(len / 0.3)), rf = C.profile(r);
    const P = [], R = [];
    for (let i = 0; i <= n; i++) { P.push(c.getPointAt(i / n)); R.push(rf(i / n)); }
    return flat({ key, P, R, rmax: Math.max(...R), box: boxOf(P) });
  }
  const obsSphere = (key, c, r) => flat({ key, P: [v3(c)], R: [r], rmax: r, box: boxOf([v3(c)]) });
  /** Cópia em Float64Array (laço de colisão sem chamadas de método). */
  function flat(O) { O.X = new Float64Array(O.P.length * 3); O.P.forEach((p, i) => { O.X[i * 3] = p.x; O.X[i * 3 + 1] = p.y; O.X[i * 3 + 2] = p.z; }); O.m = O.P.length; return O; }
  /** Ponto mais próximo do eixo do obstáculo O a (x,y,z): busca grossa (passo 3) + refinamento por projeção nos segmentos vizinhos. */
  const NEAR = [0, 0, 0, 0, 0, 0, 0, 0]; // [dist, raio, qx, qy, qz, tx, ty, tz] (t = direção do segmento mais próximo)
  function nearest(O, x, y, z) {
    const X = O.X, m = O.m;
    if (m === 1) { NEAR[0] = Math.hypot(x - X[0], y - X[1], z - X[2]); NEAR[1] = O.R[0]; NEAR[2] = X[0]; NEAR[3] = X[1]; NEAR[4] = X[2]; NEAR[5] = NEAR[6] = NEAR[7] = 0; return NEAR; }
    let bs = 0, bd = Infinity;
    for (let s = 0; s < m; s += 3) { const dx = x - X[s * 3], dy = y - X[s * 3 + 1], dz = z - X[s * 3 + 2], d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; bs = s; } }
    { const s = m - 1, dx = x - X[s * 3], dy = y - X[s * 3 + 1], dz = z - X[s * 3 + 2], d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; bs = s; } }
    bd = Infinity;
    for (let s = Math.max(0, bs - 4), e = Math.min(m - 2, bs + 3); s <= e; s++) {
      const ax = X[s * 3], ay = X[s * 3 + 1], az = X[s * 3 + 2], sx = X[s * 3 + 3] - ax, sy = X[s * 3 + 4] - ay, sz = X[s * 3 + 5] - az;
      const L2 = sx * sx + sy * sy + sz * sz || 1e-9; let u = ((x - ax) * sx + (y - ay) * sy + (z - az) * sz) / L2; u = u < 0 ? 0 : u > 1 ? 1 : u;
      const qx = ax + sx * u, qy = ay + sy * u, qz = az + sz * u, d = (x - qx) ** 2 + (y - qy) ** 2 + (z - qz) ** 2;
      if (d < bd) { bd = d; NEAR[1] = O.R[s] + (O.R[s + 1] - O.R[s]) * u; NEAR[2] = qx; NEAR[3] = qy; NEAR[4] = qz; const L = Math.sqrt(L2); NEAR[5] = sx / L; NEAR[6] = sy / L; NEAR[7] = sz / L; }
    }
    NEAR[0] = Math.sqrt(bd); return NEAR;
  }
  function boxOf(P) { const b = new THREE.Box3(); P.forEach((p) => b.expandByPoint(p)); return b; }
  const inBox = (p, b, m) => p.x > b.min.x - m && p.x < b.max.x + m && p.y > b.min.y - m && p.y < b.max.y + m && p.z > b.min.z - m && p.z < b.max.z + m;
  const boxNear = (a, b, m) => !(a.max.x + m < b.min.x || b.max.x + m < a.min.x || a.max.y + m < b.min.y || b.max.y + m < a.min.y || a.max.z + m < b.min.z || b.max.z + m < a.min.z);
  const clavR = (t) => (C.profile(LM.clavicle.ry)(t) + C.profile(LM.clavicle.rh)(t)) / 2;
  const scAntR = LM.muscles.scaleneAnt.w.map((w, i) => Math.min(w, LM.muscles.scaleneAnt.t[i]) + 0.05);

  /* Sólidos já registrados por módulos anteriores (vasos, músculos): quando existem, são os obstáculos "reais"
     (acompanham a geometria efetiva desses módulos); senão, usam-se os eixos de LM. Classificados por categoria
     para que cada nervo possa ignorar o que anatomicamente atravessa ou toca (ex.: torácico longo × escaleno médio). */
  // aceita qualquer sólido de vasos/músculos (módulos anteriores); exclui referências e estruturas de módulos posteriores
  // (vísceras, pele, instrumentos) que porventura existam de uma construção anterior, e sólidos gigantes (> 1,6 cm)
  const NOT_UPSTREAM = /^(nerve:|lymph:|ref:|REF:|lung|pleura|trachea|bronch|esophag|heart|pericard|diaphragm|thym|pulmonary|ivc|skin|subcut|drape|needle|syringe|guidewire|wire|catheter|operator|hand|cupula|instr)/i;
  const EXT = ((ctx.ATLAS || window.ATLAS).solids || []).filter((q) => q && q.id && q.pts && q.pts.length && typeof q.r === 'function' && !NOT_UPSTREAM.test(q.id) && !(q.r(0.5) > 1.6));
  function cat(id) {
    if (/scalene-ant/.test(id)) return 'scAnt';
    if (/scalene-mid/.test(id)) return 'scMid';
    if (/subclavius/.test(id)) return 'subclavius';
    if (/^mus-/.test(id)) return 'muscle';
    if (/^ijv/.test(id)) return 'ijv';
    if (/^(scv|axillary-v)/.test(id)) return 'vein';
    if (/^bcv/.test(id)) return 'bcv';
    if (/^(svc|azygos|itv|ejv|cephalic|anterior-jugular)/.test(id)) return 'vein2';
    if (/^ita/.test(id)) return 'ita';
    if (/^vertebral/.test(id)) return 'vert';
    if (/^(sca|axillary-a)/.test(id)) return 'artery';
    if (/^(aorta|bct|cca)/.test(id)) return 'artery2';
    return 'branch';
  }
  const extObs = (side) => EXT.filter((q) => { const xs = q.pts.map((p) => p[0]); return side > 0 ? Math.max(...xs) > -0.5 : Math.min(...xs) < 0.5; })
    .map((q) => { const n = q.pts.length - 1; return flat({ key: cat(q.id), id: q.id, P: q.pts.map(v3), R: q.pts.map((_, i) => Math.max(0.02, +q.r(n ? i / n : 0) || 0)), get rmax() { return Math.max(...this.R); }, box: boxOf(q.pts.map(v3)) }); });
  const hasVessels = EXT.some((q) => /^(sca|scv|ijv)-/.test(q.id)), hasMuscles = EXT.some((q) => /^mus-scalene/.test(q.id));
  // Brônquios principais e lobares: mesmas cadeias do módulo de vísceras (construído depois), +0,1 cm de folga para os
  // anéis cartilagíneos. Garantem que os vagos passem POSTERIORES às raízes pulmonares. Se o integrador expuser
  // LM.bronchi ({R:[[pts, r], ...], L:[...]}), ela é a fonte única.
  const CAR = LM.trachea.carina;
  const BRONCHI = LM.bronchi || {
    R: [[[CAR, [1.25, -5.9, -6.0], [2.4, -6.7, -6.3]], [0.78, 0.75, 0.72]],
      [[[1.9, -6.35, -6.15], [3.0, -5.7, -6.3], [3.9, -5.3, -6.4]], [0.45, 0.42, 0.38]],
      [[[2.4, -6.7, -6.3], [2.9, -7.9, -6.3], [3.2, -8.9, -6.25]], [0.62, 0.58, 0.56]]],
    L: [[[CAR, [-0.6, -5.3, -5.25], [-1.5, -5.85, -5.1], [-2.9, -6.6, -4.95], [-4.0, -7.35, -5.15]], [0.7, 0.64, 0.62, 0.6, 0.57]],
      [[[-4.0, -7.35, -5.15], [-4.6, -8.8, -5.8], [-5.2, -10.5, -6.6]], [0.5, 0.46, 0.4]],
      [[[-4.0, -7.35, -5.15], [-4.9, -7.0, -5.6], [-5.8, -6.5, -5.9]], [0.46, 0.42, 0.38]]],
  };
  const bronchObs = (side) => BRONCHI[side].map(([pts, r]) => { const rf = C.profile(r); return obsTube('bronchus', pts, (t) => rf(t) + 0.1); });
  function obstaclesRight() {
    const O = [
      obsTube('rib1', LM.ribs[0].pts, 0.3), obsTube('clav', LM.clavicle.pts, clavR), ...bronchObs('R'),
      obsSphere('cupula', LM.pleura.cupulaCenter, LM.pleura.cupulaR),
      obsTube('trachea', LM.trachea.pts, LM.trachea.r), obsTube('esoph', LM.esophagus.pts, LM.esophagus.r),
    ];
    if (!hasVessels) O.push(
      obsTube('artery', [...VS.scaR.pts, ...VS.axillaryA.pts.slice(1)], [...VS.scaR.r, ...VS.axillaryA.r.slice(1)]),
      obsTube('vein', [...VS.axillaryV.pts, ...VS.scv.pts.slice(1)], [...VS.axillaryV.r, ...VS.scv.r.slice(1)]),
      obsTube('ijv', VS.ijvR.pts, VS.ijvR.r), obsTube('bcv', VS.rbcv.pts, VS.rbcv.r), obsTube('vein2', VS.svc.pts, VS.svc.r),
      obsTube('artery2', VS.bct.pts, VS.bct.r), obsTube('artery2', VS.ccaR.pts, VS.ccaR.r),
      obsTube('vert', VS.vertebralAR.pts, VS.vertebralAR.r), obsTube('ita', VS.itaR.pts, VS.itaR.r));
    if (!hasMuscles) O.push(obsTube('scAnt', LM.muscles.scaleneAnt.pts, scAntR), obsTube('scMid', LM.muscles.scaleneMid.pts, LM.muscles.scaleneMid.t));
    // cabeças/colos das costelas 2–10 (para o tronco simpático torácico)
    for (let i = 1; i < 10; i++) O.push(obsTube('ribhead', LM.ribs[i].pts.slice(0, 2), 0.42));
    return O.concat(extObs(1));
  }
  function obstaclesLeft() {
    const O = [
      obsTube('trachea', LM.trachea.pts, LM.trachea.r), obsTube('esoph', LM.esophagus.pts, LM.esophagus.r), ...bronchObs('L'),
      obsSphere('cupula', mx(LM.pleura.cupulaCenter), LM.pleura.cupulaR),
      obsTube('rib1', mxs(LM.ribs[0].pts), 0.3), obsTube('clav', mxs(LM.clavicle.pts), clavR),
    ];
    if (!hasVessels) O.push(
      obsTube('artery', VS.scaL.pts, VS.scaL.r), obsTube('artery2', VS.ccaL.pts, VS.ccaL.r),
      obsTube('ijv', mxs(VS.ijvR.pts), VS.ijvR.r), obsTube('vein', mxs(VS.scv.pts), VS.scv.r), obsTube('bcv', VS.lbcv.pts, VS.lbcv.r),
      obsTube('artery2', VS.aorta.pts, VS.aorta.r), obsTube('vert', mxs(VS.vertebralAR.pts), VS.vertebralAR.r), obsTube('ita', mxs(VS.itaR.pts), VS.itaR.r));
    if (!hasMuscles) O.push(obsTube('scAnt', mxs(LM.muscles.scaleneAnt.pts), scAntR), obsTube('scMid', mxs(LM.muscles.scaleneMid.pts), LM.muscles.scaleneMid.t));
    return O.concat(extObs(-1));
  }

  /* ---------------- obstáculos de MALHA ----------------
     Músculos em lâmina (escalenos, serrátil, peitorais) e a escápula já existem quando este módulo é construído.
     Os sólidos que eles registram são eixos finos, que não representam a espessura da lâmina; por isso as malhas
     reais são consultadas no acabamento: distância com sinal ao triângulo mais próximo (grade espacial de 0,6 cm;
     sinal pela soma das normais das faces empatadas, robusto em arestas e vértices). */
  const MCS = 0.6, cellKey = (i, j, k) => ((i + 600) * 1201 + (j + 600)) * 1201 + (k + 600);
  function meshObs(re, layerName) {
    const L = layers[layerName]; if (!L) return null;
    L.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(L.matrixWorld).invert(), M = new THREE.Matrix4(), v = new THREE.Vector3(), tris = [];
    L.traverse((o) => {
      if (!o.isMesh || !o.userData.info || !re.test(o.userData.info.id) || !o.geometry.attributes.position) return;
      if (o.material && o.material.transparent) return; // fáscias/lâminas translúcidas não são obstáculo
      M.multiplyMatrices(inv, o.matrixWorld);
      const pos = o.geometry.attributes.position, idx = o.geometry.index, n = idx ? idx.count : pos.count;
      for (let i = 0; i < n; i++) { v.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(M); tris.push(v.x, v.y, v.z); }
    });
    if (!tris.length) return null;
    const T = new Float64Array(tris), nt = T.length / 9, Nn = new Float64Array(nt * 3), grid = new Map(), box = new THREE.Box3();
    let X0 = Infinity, Y0 = Infinity, Z0 = Infinity, X1 = -Infinity, Y1 = -Infinity, Z1 = -Infinity;
    for (let t = 0; t < nt; t++) {
      const o = t * 9;
      const ux = T[o + 3] - T[o], uy = T[o + 4] - T[o + 1], uz = T[o + 5] - T[o + 2], wx = T[o + 6] - T[o], wy = T[o + 7] - T[o + 1], wz = T[o + 8] - T[o + 2];
      const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx, l = Math.hypot(nx, ny, nz) || 1;
      Nn[t * 3] = nx / l; Nn[t * 3 + 1] = ny / l; Nn[t * 3 + 2] = nz / l;
      const x0 = Math.min(T[o], T[o + 3], T[o + 6]), y0 = Math.min(T[o + 1], T[o + 4], T[o + 7]), z0 = Math.min(T[o + 2], T[o + 5], T[o + 8]);
      const x1 = Math.max(T[o], T[o + 3], T[o + 6]), y1 = Math.max(T[o + 1], T[o + 4], T[o + 7]), z1 = Math.max(T[o + 2], T[o + 5], T[o + 8]);
      X0 = Math.min(X0, x0); Y0 = Math.min(Y0, y0); Z0 = Math.min(Z0, z0); X1 = Math.max(X1, x1); Y1 = Math.max(Y1, y1); Z1 = Math.max(Z1, z1);
      for (let i = Math.floor(x0 / MCS); i <= Math.floor(x1 / MCS); i++) for (let j = Math.floor(y0 / MCS); j <= Math.floor(y1 / MCS); j++) for (let k = Math.floor(z0 / MCS); k <= Math.floor(z1 / MCS); k++) {
        const kk = cellKey(i, j, k); let a = grid.get(kk); if (!a) grid.set(kk, (a = [])); a.push(t);
      }
    }
    box.min.set(X0, Y0, Z0); box.max.set(X1, Y1, Z1);
    return { T, Nn, grid, box, rmax: 0, mark: new Int32Array(nt), stamp: 0 };
  }
  const MOBS = {}; // construção preguiçosa (só as malhas efetivamente usadas)
  const meshOf = (k) => {
    if (!(k in MOBS)) {
      const spec = { scMidR: [/^scalene-mid-R$/, 'muscle'], scAntR: [/^scalene-ant-R$/, 'muscle'], serrR: [/^serratus-anterior-R$/, 'muscle'], pecMajR: [/^pec-major-R$/, 'muscle'],
        pecMinR: [/^pec-minor-R$/, 'muscle'], scapR: [/^scapula-R$/, 'bones'], rib1R: [/^rib-1-R$/, 'bones'], scAntL: [/^scalene-ant-L$/, 'muscle'], scMidL: [/^scalene-mid-L$/, 'muscle'] }[k];
      MOBS[k] = spec ? meshObs(spec[0], spec[1]) : null;
    }
    return MOBS[k];
  };
  // ponto mais próximo de um triângulo (Ericson) → CP
  const CP = [0, 0, 0];
  function closestTri(px, py, pz, T, o) {
    const ax = T[o], ay = T[o + 1], az = T[o + 2], bx = T[o + 3], by = T[o + 4], bz = T[o + 5], cx = T[o + 6], cy = T[o + 7], cz = T[o + 8];
    const abx = bx - ax, aby = by - ay, abz = bz - az, acx = cx - ax, acy = cy - ay, acz = cz - az, apx = px - ax, apy = py - ay, apz = pz - az;
    const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
    if (d1 <= 0 && d2 <= 0) { CP[0] = ax; CP[1] = ay; CP[2] = az; return; }
    const bpx = px - bx, bpy = py - by, bpz = pz - bz, d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
    if (d3 >= 0 && d4 <= d3) { CP[0] = bx; CP[1] = by; CP[2] = bz; return; }
    const vc = d1 * d4 - d3 * d2;
    if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); CP[0] = ax + abx * v; CP[1] = ay + aby * v; CP[2] = az + abz * v; return; }
    const cpx = px - cx, cpy = py - cy, cpz = pz - cz, d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
    if (d6 >= 0 && d5 <= d6) { CP[0] = cx; CP[1] = cy; CP[2] = cz; return; }
    const vb = d5 * d2 - d1 * d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); CP[0] = ax + acx * w; CP[1] = ay + acy * w; CP[2] = az + acz * w; return; }
    const va = d3 * d6 - d5 * d4;
    if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / (d4 - d3 + (d5 - d6)); CP[0] = bx + (cx - bx) * w; CP[1] = by + (cy - by) * w; CP[2] = bz + (cz - bz) * w; return; }
    const dn = 1 / (va + vb + vc), v = vb * dn, w = vc * dn;
    CP[0] = ax + abx * v + acx * w; CP[1] = ay + aby * v + acy * w; CP[2] = az + abz * v + acz * w;
  }
  const SDQ = { d: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0 };
  /** Distância com sinal (negativa = dentro) de (px,py,pz) à malha MO; null se não houver triângulo a ≤ ~0,6 cm. */
  function meshSD(MO, px, py, pz) {
    const i0 = Math.floor(px / MCS), j0 = Math.floor(py / MCS), k0 = Math.floor(pz / MCS);
    const T = MO.T, Nn = MO.Nn, mk = MO.mark, st = ++MO.stamp;
    let best = Infinity, qx = 0, qy = 0, qz = 0, sx = 0, sy = 0, sz = 0;
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) for (let dk = -1; dk <= 1; dk++) {
      const a = MO.grid.get(cellKey(i0 + di, j0 + dj, k0 + dk)); if (!a) continue;
      for (let u = 0; u < a.length; u++) {
        const t = a[u]; if (mk[t] === st) continue; mk[t] = st;
        closestTri(px, py, pz, T, t * 9);
        const dx = px - CP[0], dy = py - CP[1], dz = pz - CP[2], d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < best - 1e-9) { best = d2; qx = CP[0]; qy = CP[1]; qz = CP[2]; sx = Nn[t * 3]; sy = Nn[t * 3 + 1]; sz = Nn[t * 3 + 2]; }
        else if (d2 < best + 1e-9) { sx += Nn[t * 3]; sy += Nn[t * 3 + 1]; sz += Nn[t * 3 + 2]; }
      }
    }
    if (best === Infinity) return null;
    const d = Math.sqrt(best), s = (px - qx) * sx + (py - qy) * sy + (pz - qz) * sz, l = Math.hypot(sx, sy, sz) || 1;
    SDQ.d = s >= 0 ? d : -d; SDQ.x = qx; SDQ.y = qy; SDQ.z = qz; SDQ.nx = sx / l; SDQ.ny = sy / l; SDQ.nz = sz / l;
    return SDQ;
  }
  /** Empurra o ponto x (Vector3) para fora da malha até a folga `need`; tng (opcional) = tangente do nervo (empurrão ⟂). */
  const MP = new THREE.Vector3();
  function pushOutMesh(MO, x, need, tng) {
    const q = meshSD(MO, x.x, x.y, x.z); if (!q || q.d >= need) return 0;
    MP.set(x.x - q.x, x.y - q.y, x.z - q.z); let L = MP.length();
    if (L < 1e-5) MP.set(q.nx, q.ny, q.nz); else { if (q.d < 0) MP.negate(); MP.multiplyScalar(1 / L); }
    if (tng) { const k = MP.dot(tng); const l2 = Math.sqrt(Math.max(0, 1 - k * k)); if (l2 > 0.35) { MP.addScaledVector(tng, -k).multiplyScalar(1 / l2); } }
    x.addScaledVector(MP, need - q.d);
    return need - q.d;
  }

  /* ---------------- sistema de relaxamento ----------------
     Cada trajeto é reamostrado (~0,34 cm). Iterações: (1) suavização Laplaciana (contínua através das linhagens)
     + mola de retorno ao guia; (2) desvio máximo; (3) afastamento entre trajetos não conectados (r1 + r2 + folga),
     exceto perto das junções, com ordem ântero-posterior explícita onde declarada; (4) afastamento de obstáculos;
     (5) extremidades presas às junções. Acabamento: idem + malhas reais (músculos/escápula). Amostras "fixadas"
     (o.pin) seguem o guia medido (trechos torácicos sobre pericárdio/esôfago). */
  function System() { this.paths = []; this.by = {}; this.obs = []; }
  System.prototype.path = function (key, ctrl, r, o = {}) {
    const c = crv(ctrl), len = c.getLength(), n = Math.max(4, Math.ceil(len / (o.spacing || 0.34)));
    const rf = C.profile(r), P = [], R = [], S = [];
    for (let i = 0; i <= n; i++) { const p = c.getPointAt(i / n); P.push(p); R.push(rf(i / n)); S.push((i / n) * len); }
    // G: guia original; P0: guia corrente (G + deslocamento das junções, com decaimento ao longo do ramo)
    const p = { key, P, G: P.map((v) => v.clone()), P0: P.map((v) => v.clone()), R, S, n, len, rf, o, att: [], rmax: Math.max(...R), fixed: !!o.fixed, box: new THREE.Box3(), next: null };
    // pin: amostras abaixo de pin.y presas ao guia (peso 1), com transição de pin.blend cm
    p.pinW = P.map((q) => (o.pin ? C.smooth(o.pin.y, o.pin.y - (o.pin.blend || 1), q.y) : 0));
    this.paths.push(p); this.by[key] = p; return p;
  };
  /** Prende a extremidade `end` ('start'|'end') do filho ao ponto do pai mais próximo de `point` (ou da própria extremidade). */
  System.prototype.attach = function (child, end, parent, point, idxForce) {
    const ch = this.by[child], pa = this.by[parent];
    const q = point ? v3(point) : (end === 'start' ? ch.P[0] : ch.P[ch.n]);
    let best = 0, bd = Infinity; pa.P.forEach((p, i) => { const d = p.distanceToSquared(q); if (d < bd) { bd = d; best = i; } });
    if (idxForce !== undefined) best = idxForce;
    const k = end === 'start' ? 0 : ch.n;
    // a extremidade passa a coincidir com o eixo do pai já no trajeto-guia; o resto do guia acompanha (decaimento em ~1,6 cm)
    const delta = pa.G[best].clone().sub(ch.G[k]);
    ch.G.forEach((g, i) => { const sd = end === 'start' ? ch.S[i] : ch.len - ch.S[i]; const w = 1 - C.smooth(0, 1.6, sd); g.addScaledVector(delta, w); ch.P[i].copy(g); ch.P0[i].copy(g); });
    ch.att.push({ end, pa, idx: best, k });
  };
  /** Continuação de linhagem: o início de `b` é o FIM de `a` (mesmo ponto), com suavização contínua através da junção. */
  System.prototype.link = function (a, b) { this.attach(b, 'start', a, null, this.by[a].n); this.by[a].next = this.by[b]; };
  /** Ponto do guia de um trajeto a `s` cm do início. */
  System.prototype.atS = function (key, s) { const p = this.by[key]; let i = 0; while (i < p.n && p.S[i] < s) i++; return ar(p.G[i]); };
  System.prototype.solve = function (iters = 34) {
    // gap: folga entre nervos; gapO: folga para obstáculos (maior, cobre o espaço entre amostras de ~0,34 cm); JL: isenção nas junções
    const paths = this.paths, gap = 0.05, gapO = 0.1, JL = 1.0;
    // junções e "aglomerados" (todos os trajetos que se encontram num mesmo ponto ficam isentos entre si ali)
    const J = [];
    paths.forEach((ch) => ch.att.forEach((a) => J.push({ members: new Set([ch.key, a.pa.key]), get: () => a.pa.P[a.idx] })));
    for (let i = 0; i < J.length; i++) for (let j = i + 1; j < J.length; j++) if (J[i].get().distanceTo(J[j].get()) < 0.4) { J[j].members.forEach((m) => J[i].members.add(m)); J[i].members.forEach((m) => J[j].members.add(m)); }
    const exempt = (A, B) => J.filter((j) => j.members.has(A.key) && j.members.has(B.key));
    const pairs = [];
    const orderOf = (A, B) => ((A.o.anteriorTo || []).includes(B.key) ? 1 : (B.o.anteriorTo || []).includes(A.key) ? -1 : 0);
    for (let a = 0; a < paths.length; a++) for (let b = a + 1; b < paths.length; b++) pairs.push([paths[a], paths[b], exempt(paths[a], paths[b]), orderOf(paths[a], paths[b])]);
    const tmp = new THREE.Vector3(), dl = new THREE.Vector3(), acc = new THREE.Vector3();
    const NMAX = Math.max(...paths.map((p) => p.n + 1)), IA = new Int32Array(NMAX), IB = new Int32Array(NMAX), NOEX = [];
    // filhos seguem o ponto de junção do pai; o guia (P0) do filho é transladado com decaimento a partir da junção
    const enforce = () => paths.forEach((p) => {
      if (!p.att.length) return;
      p.P0.forEach((v, i) => v.copy(p.G[i]));
      p.att.forEach((a) => {
        dl.subVectors(a.pa.P[a.idx], p.G[a.k]);
        for (let i = 0; i <= p.n; i++) { const sd = a.end === 'start' ? p.S[i] : p.len - p.S[i]; const w = 1 - C.smooth(0, 1.6, sd); if (w > 0) p.P0[i].addScaledVector(dl, w); }
        p.P[a.k].copy(a.pa.P[a.idx]);
      });
    });
    /** Direção de empurrão perpendicular à tangente do nervo em i (sem deslizar amostras ao longo dele). Em cruzamentos
        (d quase tangencial), usa a normal comum aos dois eixos, com o sinal do lado em que está o guia. → escreve em `out`. */
    const TT = new THREE.Vector3(), TO = new THREE.Vector3(), CN = new THREE.Vector3(), GS = new THREE.Vector3(), PD = new THREE.Vector3(), PD2 = new THREE.Vector3(), TB = new THREE.Vector3();
    const tangent = (p, i, out) => out.subVectors(p.P[Math.min(p.n, i + 1)], p.P[Math.max(0, i - 1)]).normalize();
    const perpDir = (p, i, d, to, guideSide, out) => {
      tangent(p, i, TT); if (TT.lengthSq() < 1e-10) { out.copy(d).normalize(); return out; }
      const dl = d.length() || 1e-6;
      out.copy(d).addScaledVector(TT, -d.dot(TT));
      if (out.length() > 0.35 * dl || !to) return out.lengthSq() > 1e-12 ? out.normalize() : out.copy(d).normalize();
      CN.crossVectors(TT, to); if (CN.lengthSq() < 1e-8) return out.lengthSq() > 1e-12 ? out.normalize() : out.copy(d).normalize();
      CN.normalize(); const sg = (guideSide ?? d).dot(CN) >= 0 ? 1 : -1;
      return out.copy(CN).multiplyScalar(sg);
    };
    const movable = (p, i) => !p.fixed && p.pinW[i] < 0.999 && !((i === 0 && (p.o.fixStart || p.att.some((a) => a.end === 'start'))) || (i === p.n && (p.o.fixEnd || p.att.some((a) => a.end === 'end'))));
    const pairPass = () => {
      for (const [A, B, ex, ord] of pairs) {
        if (A.fixed && B.fixed) continue;
        const m = A.rmax + B.rmax + gap;
        if (!boxNear(A.box, B.box, m)) continue;
        let na = 0, nb = 0;
        for (let i = 0; i <= A.n; i++) if (inBox(A.P[i], B.box, m)) IA[na++] = i;
        if (!na) continue;
        for (let k = 0; k <= B.n; k++) if (inBox(B.P[k], A.box, m)) IB[nb++] = k;
        const exP = ex.length ? ex.map((j) => j.get()) : NOEX;
        for (let u = 0; u < na; u++) {
          const i = IA[u], pa = A.P[i];
          for (let w = 0; w < nb; w++) {
            const k = IB[w];
            const pb = B.P[k], need = A.R[i] + B.R[k] + gap;
            const dx = pa.x - pb.x, dy = pa.y - pb.y, dz = pa.z - pb.z, d2 = dx * dx + dy * dy + dz * dz;
            if (d2 >= need * need) continue;
            let skip = false;
            for (const e of exP) if (pa.distanceTo(e) < JL + A.R[i] && pb.distanceTo(e) < JL + B.R[k]) { skip = true; break; }
            if (skip) continue;
            const d = Math.sqrt(d2) || 1e-4;
            const ma = movable(A, i), mb = movable(B, k);
            const wa = ma && mb ? B.R[k] / (A.R[i] + B.R[k]) : ma ? 1 : 0, wb = ma && mb ? 1 - wa : mb ? 1 : 0;
            if (ord) {
              // ordem declarada (ex.: ducto torácico ANTERIOR ao frênico E): separação ao longo da normal comum, com o
              // sinal fixado para que o anterior fique à frente — não depende do lado do guia quando os guias coincidem
              tangent(A, i, TO); tangent(B, k, TB); CN.crossVectors(TO, TB);
              if (CN.lengthSq() < 1e-6) CN.set(0, 0, 1).addScaledVector(TO, -TO.z);
              CN.normalize(); if (CN.z * ord < 0) CN.negate();
              const sep = dx * CN.x + dy * CN.y + dz * CN.z;
              if (sep < need) { const push = need - sep; if (wa) pa.addScaledVector(CN, push * wa * 0.8); if (wb) pb.addScaledVector(CN, -push * wb * 0.8); }
              continue;
            }
            const push = need - d;
            tmp.set(dx, dy, dz).multiplyScalar(1 / d);
            // direções perpendiculares às tangentes de cada nervo (cruzamentos se resolvem passando um à frente do outro)
            tangent(B, k, TB);
            if (wa) { GS.subVectors(A.P0[i], pb); pa.addScaledVector(perpDir(A, i, tmp, TB, GS, PD), push * wa * 0.8); }
            if (wb) { tangent(A, i, TO); PD2.copy(tmp).negate(); GS.subVectors(B.P0[k], pa); pb.addScaledVector(perpDir(B, k, PD2, TO, GS, PD), push * wb * 0.8); }
          }
        }
      }
    };
    // empurrões do acabamento distribuídos às amostras vizinhas (núcleo 0,2–0,5–1–0,5–0,2): o nervo se curva com
    // suavidade em vez de formar "quinas" num único ponto
    const KER = [0.2, 0.5, 1, 0.5, 0.2], DX = new Float64Array(NMAX * 3);
    const kernelApply = (p) => {
      for (let i = 0; i <= p.n; i++) {
        if (!movable(p, i)) continue;
        let x = 0, y = 0, z = 0, w = 0;
        for (let k = -2; k <= 2; k++) { const j = i + k; if (j < 0 || j > p.n) continue; const kk = KER[k + 2]; x += DX[j * 3] * kk; y += DX[j * 3 + 1] * kk; z += DX[j * 3 + 2] * kk; w = Math.max(w, kk * (Math.abs(DX[j * 3]) + Math.abs(DX[j * 3 + 1]) + Math.abs(DX[j * 3 + 2]) > 0 ? 1 : 0)); }
        // o próprio empurrão é sempre aplicado por inteiro; os vizinhos recebem fração
        const own = Math.abs(DX[i * 3]) + Math.abs(DX[i * 3 + 1]) + Math.abs(DX[i * 3 + 2]) > 0;
        if (own) p.P[i].set(p.P[i].x + DX[i * 3], p.P[i].y + DX[i * 3 + 1], p.P[i].z + DX[i * 3 + 2]);
        else if (w > 0) p.P[i].set(p.P[i].x + x, p.P[i].y + y, p.P[i].z + z);
      }
    };
    const obstaclePass = (kernel) => {
      // obstáculos: os empurrões de todos os obstáculos são somados e aplicados juntos — num "aperto" (ex.: vago entre
      // VJI, carótida comum e subclávia) o nervo vai para a posição de equilíbrio, em vez de o último processado vencer.
      for (const p of paths) {
        if (p.fixed) continue;
        const obs = this.obs.filter((O) => !(p.o.ignore && p.o.ignore.includes(O.key)) && !(p.o.ignoreId && p.o.ignoreId.test(O.id || '')) && boxNear(p.box, O.box, p.rmax + O.rmax + gap));
        if (!obs.length) continue;
        if (kernel) DX.fill(0, 0, (p.n + 1) * 3);
        for (let i = 0; i <= p.n; i++) {
          if (!movable(p, i)) continue;
          const x = p.P[i]; acc.set(0, 0, 0); let hits = 0;
          for (const O of obs) {
            if (p.o.freeEnd && p.len - p.S[i] < p.o.freeEnd && (!p.o.endIgnore || p.o.endIgnore.includes(O.key))) continue;
            if (p.o.freeStart && p.S[i] < p.o.freeStart && (!p.o.startIgnore || p.o.startIgnore.includes(O.key))) continue;
            if (p.o.ignoreAbove && x.y > p.o.ignoreAbove.y && p.o.ignoreAbove.keys.includes(O.key)) continue;
            if (!inBox(x, O.box, O.rmax + p.R[i] + gapO)) continue;
            const nr = nearest(O, x.x, x.y, x.z), bd = nr[0], need = nr[1] + p.R[i] + gapO + ((p.o.obsGap && p.o.obsGap[O.key]) || 0);
            if (bd < need) {
              tmp.set(x.x - nr[2], x.y - nr[3], x.z - nr[4]); if (tmp.lengthSq() < 1e-8) tmp.set(0, 0, 1);
              TO.set(nr[5], nr[6], nr[7]); GS.set(p.P0[i].x - nr[2], p.P0[i].y - nr[3], p.P0[i].z - nr[4]);
              perpDir(p, i, tmp, TO.lengthSq() > 0.5 ? TO : null, GS, PD);
              acc.addScaledVector(PD, need - bd); hits++;
            }
          }
          if (hits) { if (kernel) { const f = hits > 1 ? 0.7 : 1; DX[i * 3] = acc.x * f; DX[i * 3 + 1] = acc.y * f; DX[i * 3 + 2] = acc.z * f; } else x.addScaledVector(acc, hits > 1 ? 0.7 : 1); }
        }
        if (kernel) kernelApply(p);
      }
    };
    // malhas reais (acabamento): o.mesh = [{k: chave de meshOf, y0?, y1?, gap?}]
    const MV = new THREE.Vector3();
    const meshPass = () => {
      for (const p of paths) {
        if (p.fixed || !p.o.mesh) continue;
        for (const spec of p.o.mesh) {
          const MO = meshOf(spec.k); if (!MO || !boxNear(p.box, MO.box, p.rmax + 0.3)) continue;
          DX.fill(0, 0, (p.n + 1) * 3); let any = false;
          for (let i = 0; i <= p.n; i++) {
            if (!movable(p, i)) continue;
            const x = p.P[i];
            if ((spec.y0 !== undefined && x.y < spec.y0) || (spec.y1 !== undefined && x.y > spec.y1) || !inBox(x, MO.box, p.R[i] + 0.3)) continue;
            MV.copy(x);
            if (pushOutMesh(MO, MV, p.R[i] + (spec.gap ?? 0.04), tangent(p, i, TT))) { DX[i * 3] = MV.x - x.x; DX[i * 3 + 1] = MV.y - x.y; DX[i * 3 + 2] = MV.z - x.z; any = true; }
          }
          if (any) kernelApply(p);
        }
      }
    };
    const smoothPass = (kl0, spring) => {
      for (const p of paths) {
        if (p.fixed) continue;
        const ks = p.o.spring ?? 0.07, kl = kl0 ?? p.o.smooth ?? 0.3;
        let px = p.P[0].x, py = p.P[0].y, pz = p.P[0].z; // valor anterior (antes de suavizar)
        for (let i = 0; i <= p.n; i++) {
          const x = p.P[i], cx = x.x, cy = x.y, cz = x.z;
          if (movable(p, i)) {
            // vizinho seguinte: no fim de um trajeto com continuação de linhagem, é a 2ª amostra do trajeto seguinte
            const nx = i < p.n ? p.P[i + 1] : p.next ? p.next.P[Math.min(1, p.next.n)] : null;
            if (i > 0 && nx) { x.x += kl * ((px + nx.x) / 2 - cx); x.y += kl * ((py + nx.y) / 2 - cy); x.z += kl * ((pz + nx.z) / 2 - cz); }
            if (spring) x.lerp(p.P0[i], Math.max(ks, p.pinW[i]));
          } else if (p.pinW[i] >= 0.999) x.copy(p.P0[i]);
          px = cx; py = cy; pz = cz;
        }
        if (spring) {
          // desvio máximo em relação ao guia (preserva a anatomia de LM mesmo com obstáculos imprecisos)
          const md = p.o.maxDev ?? 1.0;
          for (let i = 0; i <= p.n; i++) { const x = p.P[i], d = x.distanceTo(p.P0[i]); if (d > md) x.lerpVectors(p.P0[i], x, md / d); }
        }
      }
    };
    for (let it = 0; it < iters; it++) {
      smoothPass(null, true);
      paths.forEach((p) => p.box.setFromPoints(p.P));
      pairPass();
      obstaclePass();
      enforce();
    }
    // acabamento: suavização leve (remove o "serrilhado" dos empurrões contra eixos poligonais), afastamento entre
    // nervos, obstáculos e malhas reais
    for (let k = 0; k < 3; k++) {
      smoothPass(0.4, false);
      enforce();
      paths.forEach((p) => p.box.setFromPoints(p.P));
      pairPass();
      obstaclePass(true);
      meshPass();
      enforce();
    }
    // alisamento final (remove quinas deixadas pelos empurrões) e última passada de obstáculos/malhas
    for (let k = 0; k < 2; k++) { smoothPass(0.45, false); enforce(); }
    paths.forEach((p) => p.box.setFromPoints(p.P));
    obstaclePass(true); meshPass(); enforce();
    return this;
  };
  /** Decimação adaptativa: descarta pontos ímpares que só carregam "serrilhado" (< 0,06 cm da corda dos vizinhos),
      mas mantém os que contornam obstáculos (desvio real) — a Catmull-Rom da varredura fica lisa e fiel. */
  function decimate(P, keepIdx) {
    const keep = [0];
    for (let i = 1; i < P.length - 1; i++) {
      if (i % 2 === 0 || (keepIdx && keepIdx.has(i))) { keep.push(i); continue; }
      const a = P[i - 1], b = P[i + 1], x = P[i];
      if (Math.hypot(x.x - (a.x + b.x) / 2, x.y - (a.y + b.y) / 2, x.z - (a.z + b.z) / 2) > 0.06) keep.push(i);
    }
    const n = P.length - 1;
    if (keep[keep.length - 1] !== n) { if (P[n].distanceTo(P[keep[keep.length - 1]]) < 0.15 && keep.length > 1 && !(keepIdx && keepIdx.has(keep[keep.length - 1]))) keep.pop(); keep.push(n); }
    return keep;
  }
  /** Pontos relaxados de um trajeto (arrays), opcionalmente espelhados. */
  System.prototype.pts = function (key, mirror) {
    const P = this.by[key].P;
    return decimate(P).map((i) => (mirror ? [-P[i].x, P[i].y, P[i].z] : [P[i].x, P[i].y, P[i].z]));
  };

  /* ---------------- construção de malhas ---------------- */
  const BUILT = []; // {key, side, pts}
  /** Varredura de nervo. o: {r (perfil), flat (achatamento), radial, density, caps, capStart, capEnd, noise}. */
  function sweep(pts, o, mat, parent, info) {
    const rf = C.profile(o.r), fl = o.flat ?? (rf(0.5) > 0.15 ? 0.08 : 0.03);
    const g = C.sweepGeometry(pts, {
      rx: (t) => rf(t) * (1 + fl), ry: (t) => rf(t) * (1 - fl), radial: o.radial || 12, density: o.density || 5,
      caps: o.caps || 'round', capStart: o.capStart ?? true, capEnd: o.capEnd ?? true, up: o.up,
      noise: o.noise || null, vScale: o.vScale || 2.6,
    });
    return C.mesh(g, mat, parent, info);
  }
  /** Afilamento: perfil com raio r0 → r1 e fim arredondado (para extremidades "livres"). */
  const taper = (r0, r1, endFrac = 0.06, endScale = 0.35) => (t) => C.lerp(r0, r1, t) * (t > 1 - endFrac ? C.lerp(1, endScale, Math.sqrt((t - (1 - endFrac)) / endFrac)) : 1);
  /** Recorta uma polilinha pelos comprimentos (cm) no início e no fim. */
  function trim(pts, a, b) {
    const c = crv(pts), L = c.getLength(), t0 = Math.min(0.45, a / L), t1 = 1 - Math.min(0.45, b / L), n = Math.max(6, Math.round(pts.length * (t1 - t0)));
    return sub(c, t0, t1, n);
  }
  /** Fatia uma geometria de varredura em partes pelo parâmetro de comprimento (uv.v · vScale / comprimento):
      cada triângulo vai para a parte do seu baricentro; os vértices da fronteira são duplicados com a MESMA
      posição e normal → nenhuma emenda visível entre as malhas nomeadas. */
  function splitGeo(g, cuts, vScale) {
    const len = g.userData.length, pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, idx = g.index.array;
    const parts = cuts.length + 1, maps = [], P = [], N = [], U = [], I = [];
    for (let s = 0; s < parts; s++) { maps.push(new Map()); P.push([]); N.push([]); U.push([]); I.push([]); }
    for (let f = 0; f < idx.length; f += 3) {
      const tm = ((uv.getY(idx[f]) + uv.getY(idx[f + 1]) + uv.getY(idx[f + 2])) / 3) * vScale / len;
      let s = 0; while (s < cuts.length && tm > cuts[s]) s++;
      for (let e = 0; e < 3; e++) {
        const vi = idx[f + e]; let ni = maps[s].get(vi);
        if (ni === undefined) { ni = maps[s].size; maps[s].set(vi, ni); P[s].push(pos.getX(vi), pos.getY(vi), pos.getZ(vi)); N[s].push(nor.getX(vi), nor.getY(vi), nor.getZ(vi)); U[s].push(uv.getX(vi), uv.getY(vi)); }
        I[s].push(ni);
      }
    }
    return P.map((_, s) => {
      const q = new THREE.BufferGeometry();
      q.setAttribute('position', new THREE.Float32BufferAttribute(P[s], 3)); q.setAttribute('normal', new THREE.Float32BufferAttribute(N[s], 3));
      q.setAttribute('uv', new THREE.Float32BufferAttribute(U[s], 2)); q.setIndex(I[s]);
      return q;
    });
  }

  /* ======================================================================
     LADO DIREITO — sistema de relaxamento
     ====================================================================== */
  const SR = new System();
  SR.obs = obstaclesRight();

  /* ---- guias de LM ---- */
  // Os três eixos de LM convergem a ~0,2–0,4 cm entre si atrás da clavícula (x≈6–10); para que troncos/divisões
  // (r 0,2–0,3) não se fundam, afastam-se suavemente nessa zona preservando a ordem anatômica: superior em cima/anterior,
  // médio no meio, inferior embaixo/posterior (atrás da artéria). Fora da zona, os eixos de LM são mantidos.
  const spread = (pts, off) => { const c = crv(pts), o = []; for (let i = 0; i <= 48; i++) { const q = c.getPointAt(i / 48), w = C.smooth(5.6, 7.0, q.x) * (1 - C.smooth(9.6, 11.0, q.x)); o.push([q.x + off[0] * w, q.y + off[1] * w, q.z + off[2] * w]); } return o; };
  const TS = crv(spread(LM.nerves.plexusTrunks[0].pts, [0, 0.3, 0.15])), TM = crv(spread(LM.nerves.plexusTrunks[1].pts, [0, 0.05, -0.12])), TI = crv(spread(LM.nerves.plexusTrunks[2].pts, [0, -0.4, -0.2]));
  // artéria subclávia → axilar (+ ponto extrapolado no braço, só para orientar os ramos terminais)
  const ART = crv([...VS.scaR.pts, ...VS.axillaryA.pts.slice(1), [15.5, -9.6, -4.35]]);
  function frameArt(x) {
    const t = tAtX(ART, x), P = ART.getPointAt(t), T = ART.getTangentAt(t).normalize();
    const Lat = new THREE.Vector3(1, 0.35, 0); Lat.addScaledVector(T, -Lat.dot(T)).normalize();   // "lateral" (para o braço)
    const Pos = new THREE.Vector3().crossVectors(T, Lat).normalize(); if (Pos.z > 0) Pos.negate(); // "posterior"
    return { P, T, Lat, Pos };
  }
  /** Ponto em torno da artéria axilar: ângulo θ (0 = lateral, 90 = posterior, 180 = medial, 270 = anterior) e distância d do eixo. */
  const around = (x, deg, d) => { const f = frameArt(x), a = (deg * Math.PI) / 180; return ar(f.P.clone().addScaledVector(f.Lat, d * Math.cos(a)).addScaledVector(f.Pos, d * Math.sin(a))); };

  /* ---- forames intervertebrais e goteiras dos processos transversos (mesmas fórmulas do esqueleto) ---- */
  const VT = (n) => LM.vert(n);
  const back = (s) => s.zf - s.d / 2 - (s.d / 2) * (s.n[0] === 'T' ? 0.62 : 0.55) + 0.1;
  const foramen = (u, l) => { const U = VT(u), L = VT(l); return [((U.w + L.w) / 4) * 0.72 + 0.15, (U.y + L.y) / 2, (back(U) + back(L)) / 2 - 0.6]; };
  // goteira do nervo espinal: face superior do processo transverso, na metade POSTERIOR (atrás do forame transversário,
  // por onde sobe a artéria vertebral — o ramo anterior cruza posteriormente a ela)
  const gutter = (n, r) => { const s = VT(n), hw = s.w / 2, hd = s.d / 2, cz = s.zf - hd; const at = [hw + 0.55, s.y - 0.05, cz + hd * 0.2], pt = [hw + 0.85, s.y - 0.1, cz - hd - 0.45]; return [C.lerp(at[0], pt[0], 0.75) + 0.1, s.y - 0.075 + 0.3 + r + 0.05, C.lerp(at[2], pt[2], 0.62)]; };
  const F5 = foramen('C4', 'C5'), F6 = foramen('C5', 'C6'), F7 = foramen('C6', 'C7'), F8 = foramen('C7', 'T1'), F1 = foramen('T1', 'T2');
  const G5 = gutter('C5', 0.2), G6 = gutter('C6', 0.24), G7 = gutter('C7', 0.25);

  /* ---- pontos de divisão (atrás da clávícula, perto da borda lateral da 1ª costela) ---- */
  const tSd = tAtX(TS, 7.2), tMd = tAtX(TM, 7.5), tId = tAtX(TI, 7.75);
  const tSc = tAtX(TS, 9.4), tMc = tAtX(TM, 9.7), tIc = tAtX(TI, 9.8);
  const DS = ptAt(TS, tSd), DM = ptAt(TM, tMd), DI = ptAt(TI, tId);

  // malhas reais consultadas no acabamento (ver meshPass)
  const mScal = [{ k: 'scMidR', gap: 0.03 }, { k: 'scAntR', gap: 0.03 }], mPec = [{ k: 'pecMinR' }, { k: 'pecMajR' }];
  /* ---- raízes (ramos anteriores C5–T1): forame → goteira do processo transverso → entre os escalenos ----
     Perfis contínuos ao longo das linhagens (raiz → tronco → divisão → fascículo → ramo); ramos que confluem de lado
     (C6, T1) afinam para ≤ 0,75 × o raio do pai na junção. */
  SR.path('C5', [F5, G5, [2.9, 8.72, -5.3], LM.nerves.plexusTrunks[0].pts[0], ptAt(TS, 0.1)], [[0, 0.17], [0.25, 0.2], [1, 0.22]], { fixStart: true, mesh: mScal });
  SR.path('C6', [F6, G6, [3.0, 7.32, -5.65], [3.9, 7.08, -4.78], ptAt(TS, 0.15)], [[0, 0.19], [0.25, 0.24], [0.82, 0.24], [1, 0.2]], { fixStart: true, mesh: mScal });
  SR.path('C7', [F7, G7, [3.15, 5.65, -6.0], ptAt(TM, 0.1)], [[0, 0.2], [0.25, 0.25], [1, 0.25]], { fixStart: true, mesh: mScal });
  SR.path('C8', [F8, [2.15, 4.02, -7.1], LM.nerves.plexusTrunks[2].pts[0], ptAt(TI, 0.1)], [[0, 0.19], [0.25, 0.24], [1, 0.24]], { fixStart: true, ignore: ['rib1'], mesh: mScal });
  SR.path('T1', [F1, [2.2, 2.45, -7.95], [3.05, 3.0, -7.45], [3.65, 3.55, -6.5], ptAt(TI, 0.16)], [[0, 0.16], [0.3, 0.2], [0.85, 0.2], [1, 0.185]], { fixStart: true, ignore: ['rib1'], mesh: mScal });
  /* ---- troncos ---- */
  SR.path('trS', sub(TS, 0.08, tSd, 8), [[0, 0.22], [0.18, 0.28], [0.85, 0.3], [1, 0.26]], { mesh: mScal });
  SR.path('trM', sub(TM, 0.08, tMd, 8), [[0, 0.25], [0.85, 0.25], [1, 0.23]], { mesh: mScal });
  SR.path('trI', sub(TI, 0.08, tId, 8), [[0, 0.24], [0.2, 0.255], [0.85, 0.255], [1, 0.24]], { mesh: [...mScal, { k: 'rib1R', gap: 0.03 }], obsGap: { artery: 0.12 } });
  /* ---- fascículos (guias: final dos eixos de LM → em torno da 2ª parte da axilar, atrás do peitoral menor) ---- */
  SR.path('cordL', [ptAt(TS, tSc), ptAt(TS, 0.92), LM.nerves.plexusTrunks[0].pts[5], around(12.4, 12, 0.74), around(13.3, -10, 0.72)], [[0, 0.22], [0.8, 0.23], [1, 0.17]], { mesh: mPec });
  SR.path('cordP', [ptAt(TM, tMc), ptAt(TM, 0.92), LM.nerves.plexusTrunks[1].pts[5], around(12.4, 92, 0.8), around(13.3, 98, 0.82)], [[0, 0.23], [0.75, 0.26], [1, 0.21]], { mesh: mPec });
  SR.path('cordM', [ptAt(TI, tIc), ptAt(TI, 0.92), LM.nerves.plexusTrunks[2].pts[6], around(12.4, 140, 0.8), around(13.25, 172, 0.75)], [[0, 0.21], [0.8, 0.21], [1, 0.16]], { mesh: mPec });
  const LC = SR.by.cordL, PC = SR.by.cordP, MC = SR.by.cordM;
  /* ---- divisões (anteriores → fascículos lateral/medial; posteriores → fascículo posterior) ---- */
  const cAt = (c, t) => ptAt(crv(c.P0.map(ar)), t);
  SR.path('divSA', sub(TS, tSd, tSc, 5), [[0, 0.26], [1, 0.22]]);
  SR.path('divMP', sub(TM, tMd, tMc, 5), [[0, 0.23], [1, 0.23]]);
  SR.path('divIA', sub(TI, tId, tIc, 5), [[0, 0.24], [1, 0.21]]);
  // divisões que saem de lado: mais finas (≤ 0,75 × pai) e sem tampa (nascem dentro do tronco)
  const side = (r0, r) => [[0, r0], [0.18, r], [0.82, r], [1, r0]];
  SR.path('divMA', [DM, C.lerp3(DM, cAt(LC, 0.12), 0.5).map((v, i) => v + [0, 0.3, 0.32][i]), cAt(LC, 0.12)], side(0.15, 0.16));
  SR.path('divSP', [DS, C.lerp3(DS, cAt(PC, 0.1), 0.5).map((v, i) => v + [0, -0.25, -0.35][i]), cAt(PC, 0.1)], side(0.15, 0.16));
  SR.path('divIP', [DI, C.lerp3(DI, cAt(PC, 0.17), 0.5).map((v, i) => v + [0, 0.25, -0.2][i]), cAt(PC, 0.17)], side(0.16, 0.17));
  /* ---- ramos terminais (borda inferior do peitoral menor, 3ª parte da axilar) ---- */
  const LCe = cAt(LC, 1), PCe = cAt(PC, 1), MCe = cAt(MC, 1);
  // linhagem lateral: fascículo lateral → raiz lateral → nervo mediano (o "M" se fecha com a raiz medial, que entra de lado)
  SR.path('latRoot', [LCe, around(13.65, -48, 0.74), around(13.95, 282, 0.66)], [[0, 0.17], [0.4, 0.155], [1, 0.165]], { mesh: mPec });
  SR.path('median', [around(13.95, 282, 0.66), around(14.4, 300, 0.7), around(14.85, 318, 0.72), around(15.3, 328, 0.75)], [[0, 0.165], [0.18, 0.2], [1, 0.2]], { fixEnd: true, mesh: mPec });
  SR.path('medRoot', [MCe, around(13.55, 212, 0.76), around(13.8, 248, 0.72), around(13.95, 282, 0.66)], side(0.12, 0.13), { mesh: mPec, obsGap: { artery: 0.07, vein: 0.05 } });
  // musculocutâneo: sai de lado do fim do fascículo lateral; termina recuado (atrás do peitoral maior, rumo ao coracobraquial)
  SR.path('musculocut', [LCe, around(13.85, -38, 1.15), [15.2, -5.3, -1.95], [15.85, -7.3, -2.05], [16.15, -8.7, -2.0]], [[0, 0.125], [0.12, 0.14], [1, 0.14]], { fixEnd: true, mesh: mPec });
  SR.path('ulnar', [MCe, around(13.9, 185, 0.8), around(14.5, 190, 0.86), around(15.0, 196, 0.92), around(15.35, 200, 0.96)], [[0, 0.16], [0.3, 0.17], [1, 0.17]], { fixEnd: true, mesh: mPec });
  SR.path('radial', [PCe, around(13.9, 103, 0.9), around(14.5, 110, 1.0), around(15.0, 116, 1.15), around(15.35, 120, 1.25)], 0.21, { fixEnd: true, mesh: mPec });
  SR.path('axillary', [cAt(PC, 0.9), around(13.7, 68, 1.3), [15.3, -4.75, -5.2], [16.5, -5.35, -5.6], [17.5, -5.3, -5.45]], (t) => Math.min(taper(0.17, 0.14)(t), C.lerp(0.15, 0.17, C.smooth(0, 0.08, t))), { mesh: mPec });
  /* ---- ramos colaterais ---- */
  // supraescapular: segue lateralmente acima do plexo, desce à incisura da escápula (sob o ligamento transverso superior)
  // e entra na fossa supraespinal; a escápula real é obstáculo (não cruza a borda superior medial à incisura)
  const NOTCH = LM.scapulaGeom ? LM.scapulaGeom().suprascapularNotch : LM.scapula.suprascapularNotch;
  SR.path('suprascap', [ptAt(TS, tAtX(TS, 5.45)), [6.7, 3.85, -4.2], [8.6, 2.6, -6.05], [10.3, 1.55, -7.75], [11.25, 1.05, -8.65], [NOTCH[0], NOTCH[1] + 0.22, NOTCH[2] - 0.05], [11.92, 0.05, -9.38], [12.25, -0.38, -9.05], [12.6, -0.85, -8.78]],
    taper(0.13, 0.11), { ignore: ['scMid'], mesh: [{ k: 'scapR', gap: 0.04 }] });
  SR.path('subclN', [ptAt(TS, tAtX(TS, 6.3)), [6.85, 2.1, -1.85], [7.4, 1.3, -0.85], [7.85, 0.95, -0.35]], taper(0.055, 0.05), { ignore: ['subclavius'] });
  // peitoral lateral: anterior à artéria/veia axilares, medial ao tronco toracoacromial; perfura a fáscia clavipeitoral
  // e acompanha o ramo peitoral da artéria toracoacromial até a face profunda do peitoral maior
  SR.path('latPect', [cAt(LC, 0.22), [10.55, 0.15, -1.4], [10.6, -0.05, -0.45], [10.55, -0.85, 0.45], [10.3, -1.7, 0.95], [10.1, -2.4, 1.25]], taper(0.085, 0.075), { freeEnd: 1.2, endIgnore: ['muscle'] });
  SR.path('dorsScap', [[2.4, 8.9, -5.7], [3.3, 9.2, -6.6], [4.3, 8.9, -7.6], [5.3, 8.3, -8.5]], taper(0.075, 0.065), { ignore: ['scMid'] });
  // torácico longo: raízes C5 e C6 perfuram o escaleno médio; C7 passa à frente dele; o tronco desce atrás do plexo e
  // corre na face EXTERNA do serrátil anterior (malha real)
  SR.path('ltC5', [[2.65, 8.85, -5.6], [3.4, 8.1, -6.35], [3.85, 7.4, -6.5]], [[0, 0.06], [1, 0.075]], { ignore: ['scMid'] });
  SR.path('ltC6', [[2.65, 7.3, -5.95], [3.4, 7.0, -6.45], [4.05, 6.75, -6.55]], side(0.058, 0.065), { ignore: ['scMid'] });
  SR.path('ltC7', [[2.7, 5.62, -6.55], [3.7, 5.45, -6.75], [4.75, 5.15, -6.55]], side(0.055, 0.06), { ignore: ['scMid'] });
  SR.path('longThor', [[3.85, 7.4, -6.5], [4.4, 6.0, -6.6], [5.2, 4.4, -6.45], [6.3, 2.95, -6.1], [7.0, 2.5, -6.0], [7.6, 2.12, -5.85], [8.3, 1.52, -5.75], [8.8, 0.98, -5.8], [9.2, 0.52, -5.85], [10.0, -0.4, -6.0], [10.5, -1.0, -6.1], [10.78, -1.7, -6.2], [11.42, -3.0, -6.25], [12.3, -4.9, -6.25], [13.4, -7.6, -6.15], [14.15, -10.2, -5.95], [14.45, -12.0, -5.8]],
    (t) => taper(0.085, 0.075)(t) * (t < 0.04 ? C.lerp(0.88, 1, t / 0.04) : 1), { ignore: ['scMid', 'rib1'], mesh: [{ k: 'serrR', gap: 0.04 }, { k: 'rib1R', gap: 0.03 }] });

  // conexões: continuações de linhagem (mesmo calibre e eixo) e junções laterais
  [['C5', 'trS'], ['trS', 'divSA'], ['divSA', 'cordL'], ['cordL', 'latRoot'], ['latRoot', 'median'],
    ['C7', 'trM'], ['trM', 'divMP'], ['divMP', 'cordP'], ['cordP', 'radial'],
    ['C8', 'trI'], ['trI', 'divIA'], ['divIA', 'cordM'], ['cordM', 'ulnar'], ['ltC5', 'longThor']].forEach(([a, b]) => SR.link(a, b));
  SR.attach('C6', 'end', 'trS'); SR.attach('T1', 'end', 'trI');
  SR.attach('divSP', 'start', 'trS', DS); SR.attach('divMA', 'start', 'trM', DM); SR.attach('divIP', 'start', 'trI', DI);
  SR.attach('divMA', 'end', 'cordL'); SR.attach('divSP', 'end', 'cordP'); SR.attach('divIP', 'end', 'cordP');
  SR.attach('musculocut', 'start', 'cordL', LCe); SR.attach('medRoot', 'start', 'cordM', MCe); SR.attach('axillary', 'start', 'cordP');
  SR.attach('medRoot', 'end', 'median', SR.atS('median', 0.35));
  SR.attach('suprascap', 'start', 'trS'); SR.attach('subclN', 'start', 'trS'); SR.attach('latPect', 'start', 'cordL');
  SR.attach('dorsScap', 'start', 'C5'); SR.attach('ltC5', 'start', 'C5'); SR.attach('ltC6', 'start', 'C6'); SR.attach('ltC7', 'start', 'C7');
  SR.attach('ltC6', 'end', 'longThor'); SR.attach('ltC7', 'end', 'longThor');

  /* ---- frênico D (C3–C5): face anterior do escaleno anterior → entre artéria e veia subclávias → VBC/VCS → face
     lateral do pericárdio (sobre o átrio D) → diafragma, junto à VCI. Abaixo de y≈−1,2 o trajeto é o do espaço medido
     entre o pericárdio fibroso e a pleura/pulmão (o nervo corre na face EXTERNA do pericárdio). Tabela [y, x, z] medida
     na geometria de vísceras (fendas de 0,2–0,3 cm; módulo construído depois deste): se vísceras mudar, refazer a
     medição — o ideal é vísceras esculpir o pulmão a partir dos sólidos `nerve:*` (ver api.paths). ---- */
  const PHR_R = [[-1.6, 3.41, -2.68], [-2.0, 3.34, -2.8], [-2.5, 3.375, -2.8], [-3.0, 3.415, -2.8], [-3.5, 3.45, -2.82], [-4.0, 3.45, -2.9], [-5.0, 3.62, -3.1], [-6.0, 3.915, -2.85], [-7.0, 3.88, -2.9], [-8.0, 3.96, -2.97],
    [-9.0, 4.15, -3.02], [-10.0, 4.46, -3.07], [-11.0, 4.59, -3.12], [-11.5, 4.6, -3.15], [-12.0, 4.66, -3.2], [-12.5, 4.67, -3.25], [-13.0, 4.61, -3.2], [-13.5, 4.58, -3.21], [-14.13, 4.56, -3.25]];
  const rPhr = (y) => (y > 0 ? 0.11 : C.lerp(0.11, 0.088, C.smooth(0, -4.5, y)));
  SR.path('phrenic', [[3.45, 11.0, -3.95], ...LM.nerves.phrenicR.slice(0, 5), [3.47, -1.0, -2.64], ...PHR_R.map(([y, x, z]) => [x, y, z])], 0.1, { maxDev: 0.6, spring: 0.12, pin: { y: -1.2, blend: 1.0 }, mesh: [{ k: 'scAntR', y0: 0, gap: 0.03 }] });
  SR.path('phrC5', [[3.35, 8.48, -5.0], [3.9, 8.45, -4.2], [4.1, 8.3, -3.4], [4.0, 7.95, -2.85]], 0.055, { ignore: ['scAnt'] });
  SR.attach('phrC5', 'start', 'C5'); SR.attach('phrC5', 'end', 'phrenic');
  /* ---- vago D: bainha carotídea (posterior, entre VJI e ACC) → cruza a 1ª parte da subclávia → face D da traqueia
     (medial ao arco da ázigo) → posterior ao brônquio principal D → face POSTERIOR do esôfago (plexo esofágico,
     tronco vagal posterior). ---- */
  const ESO = crv(LM.esophagus.pts);
  /** Ponto sobre a face do esôfago (mesma varredura das vísceras: elipse 0,6 cm AP × 0,8 cm transversal, ruído ±4%),
      no ângulo `deg` (0 = anterior, +90 = esquerda, ±180 = posterior, −90 = direita), afastado `off` da superfície. */
  function esoAt(y, deg, off) {
    let lo = 0, hi = 1; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (ESO.getPointAt(m).y > y) lo = m; else hi = m; }
    const t = (lo + hi) / 2, P = ESO.getPointAt(t), T = ESO.getTangentAt(t).normalize();
    const N = new THREE.Vector3(0, 0, 1).addScaledVector(T, -T.z).normalize(), B = new THREE.Vector3().crossVectors(T, N).normalize();
    const a = (deg * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a), nn = N.clone().multiplyScalar(ca / 0.6).addScaledVector(B, sa / 0.8).normalize();
    return ar(P.addScaledVector(N, 0.6 * ca).addScaledVector(B, 0.8 * sa).addScaledVector(nn, off));
  }
  const VAG_ESO_R = [[-6.7, -118], [-7.6, -128], [-9.0, -140], [-10.5, -150], [-12.0, -157], [-13.5, -163], [-15.0, -168], [-15.85, -171]];
  SR.path('vagus', [...LM.nerves.vagusR.slice(0, 5), [2.2, -1.25, -3.95], [1.3, -2.15, -4.5], [1.38, -3.0, -4.9], [1.35, -3.9, -5.45], [1.15, -4.7, -6.05], [0.92, -5.6, -6.6],
    ...VAG_ESO_R.map(([y, a]) => esoAt(y, a, 0.185))], [[0, 0.15], [0.3, 0.14], [0.4, 0.13], [1, 0.12]], { maxDev: 0.6, spring: 0.12, pin: { y: -6.4, blend: 1.0 }, obsGap: { artery: 0.08, trachea: -0.06 } });
  /* ---- laríngeo recorrente D: contorna a artéria subclávia por baixo e sobe no sulco traqueoesofágico ---- */
  SR.path('rln', [...LM.nerves.recurrentR, [0.8, 8.5, -2.1], [0.75, 10.6, -1.75]], 0.075, { maxDev: 0.6, spring: 0.12 });
  SR.attach('rln', 'start', 'vagus');
  /* ---- tronco simpático D: cervical (sobre o longo do pescoço) → gânglio cervical médio (C6) → estrelado (colo da 1ª costela) → torácico (cabeças das costelas) ---- */
  const SYM = [[1.42, 11.0, -4.3], [1.45, 10.2, -4.45], [1.5, 8.5, -4.75], [1.55, 6.9, -5.1], [1.6, 5.6, -5.65], [1.95, 4.75, -6.05], [2.2, 4.0, -6.45], [2.35, 3.3, -6.95], [2.5, 2.6, -7.25],
    // no tórax, sobre as cabeças das costelas, ~0,3 cm medial ao sulco paravertebral ocupado pela borda posterior do pulmão
    [2.1, 1.6, -7.4], [2.1, -0.55, -7.85], [2.05, -2.75, -8.2], [2.0, -5.0, -8.48], [2.0, -7.35, -8.62], [2.02, -9.75, -8.72], [2.05, -12.2, -8.72], [2.05, -14.75, -8.62], [2.0, -17.35, -8.4], [1.9, -20.0, -8.0], [1.75, -22.2, -7.6]];
  const symG = crv(SYM), gau = (y, c, w) => Math.exp(-(((y - c) / w) ** 2));
  // no relaxamento, o tronco "ocupa" o volume dos gânglios (estrelado ~0,3; cervical médio ~0,17) para que raízes e alça se afastem
  SR.path('sym', SYM, (t) => { const y = symG.getPointAt(t).y; return 0.085 + 0.24 * gau(y, 3.65, 0.85) * (y < 4.6 && y > 2.7 ? 1 : 0.7) + 0.09 * gau(y, 6.9, 0.4); }, { ignore: ['rib1'], maxDev: 0.6, spring: 0.15 });
  /* ---- alça subclávia D: do tronco cervical (acima) contorna anteriormente/inferiormente a 1ª parte da subclávia até o estrelado ---- */
  SR.path('ansa', [[1.62, 5.1, -5.65], [2.2, 3.6, -4.25], [2.75, 2.3, -3.25], [3.05, 1.3, -2.85], [3.05, 0.45, -3.45], [2.95, 1.0, -4.15], [2.55, 1.9, -5.1], [2.45, 2.7, -6.6]], 0.055, { spring: 0.14, smooth: 0.5 });
  SR.attach('ansa', 'start', 'sym'); SR.attach('ansa', 'end', 'sym', [2.5, 2.7, -7.2]);
  /* ---- ducto linfático direito + troncos jugular e broncomediastinal ---- */
  SR.path('rld', [[4.15, 1.7, -2.72], ...LM.lymph.rightLymphDuct.slice(1)], [[0, 0.1], [0.8, 0.12], [1, 0.13]], { freeEnd: 0.45, endIgnore: ['bcv', 'ijv', 'vein'], ignore: ['scAnt'], mesh: [{ k: 'scAntR' }], obsGap: { ita: 0.08 } });
  SR.path('rldJug', [[4.15, 1.7, -2.72], [4.0, 2.5, -2.78], [3.75, 3.6, -2.78], [3.65, 4.6, -2.72]], taper(0.065, 0.055), { ignore: ['scAnt'], mesh: [{ k: 'scAntR' }] });
  // broncomediastinal: sobe do mediastino superior (atrás da VBC/VCS, lateral à traqueia) até o ducto
  SR.path('rldBm', [[3.55, 0.95, -2.5], [3.2, 0.2, -3.1], [2.75, -0.9, -3.45]], taper(0.06, 0.05), {});
  SR.attach('rldJug', 'start', 'rld'); SR.attach('rldBm', 'start', 'rld');
  // o frênico D usa raio em função de y (fino no tórax): substitui o perfil provisório
  { const p = SR.by.phrenic, c = crv(p.G.map(ar)); p.rf = (t) => { const y = c.getPointAt(t).y; return rPhr(y) * (t > 0.985 ? C.lerp(1, 0.55, (t - 0.985) / 0.015) : 1); }; p.R = p.R.map((_, i) => p.rf(i / p.n)); p.rmax = Math.max(...p.R); }

  mark('setupR'); SR.solve(18); mark('solveR');

  /* ======================================================================
     MALHAS — lado direito (e esquerdo espelhado para as estruturas simétricas)
     ====================================================================== */
  const G = (o) => Object.assign({ group: 'Nervos' }, o);
  const groups = {};
  function grp(id, parent, info) { const g = new THREE.Group(); g.name = info.name; parent.add(g); C.reg(g, info); groups[id] = g; return g; }
  const DESC = {
    plexus: 'Raízes C5–T1 emergem entre os escalenos anterior e médio; troncos acima e atrás da 3ª parte da artéria subclávia, divisões atrás da clavícula e fascículos (lateral, posterior, medial) em torno da artéria axilar, atrás do peitoral menor. Fica posterossuperior ao trajeto correto da agulha: direção muito lateral, posterior ou cranial pode provocar parestesia/lesão.',
    phrenic: 'C3–C5. Desce sobre a face anterior do escaleno anterior (de lateral para medial) e entra no tórax entre a artéria (posterior) e a veia (anterior) subclávias; segue sobre a VBC/VCS (D) ou o arco aórtico (E), anterior à raiz do pulmão, entre o pericárdio fibroso e a pleura mediastinal, até o diafragma. Lesão → paralisia hemidiafragmática.',
    vagus: 'Na bainha carotídea, posterior, entre a VJI (lateral) e a carótida comum (medial). O direito cruza anteriormente a 1ª parte da artéria subclávia e ali origina o laríngeo recorrente; o esquerdo cruza o arco aórtico. Ambos passam posteriores à raiz do pulmão e formam o plexo esofágico (o E na face anterior, o D na posterior do esôfago).',
    rln: 'Direito: contorna a artéria subclávia por baixo e sobe no sulco traqueoesofágico. Esquerdo: contorna o arco aórtico (lateral ao ligamento arterial). Lesão → rouquidão/disfonia.',
    sym: 'Cadeia paravertebral: no pescoço, sobre o longo do pescoço, posterior à bainha carotídea; no tórax, sobre as cabeças das costelas. A alça subclávia contorna a 1ª parte da artéria subclávia.',
    stellate: 'Gânglio cervicotorácico (fusão do cervical inferior com o 1º torácico), anterior ao colo da 1ª costela e ao processo transverso de C7, posterior à artéria vertebral e junto à cúpula pleural. Lesão → síndrome de Horner (ptose, miose, anidrose).',
    duct: 'Principal via linfática: sobe à direita da aorta e atrás do esôfago, cruza para a esquerda (~T5), arqueia no nível de C7 (anterior à artéria vertebral e ao tronco tireocervical, posterior à bainha carotídea) e desce atrás da VJI até o ÂNGULO VENOSO ESQUERDO. A punção subclávia/jugular esquerda pode lesá-lo (quilotórax) — um dos motivos para preferir o lado direito.',
    rld: 'Curto (~1 cm): recebe os troncos jugular, subclávio e broncomediastinal direitos e drena no ângulo venoso direito (junção VJI–subclávia).',
    nodes: 'Linfonodos cervicais profundos inferiores/supraclaviculares, ao longo da VJI e da artéria cervical transversa. À esquerda, o linfonodo de Virchow (junto à terminação do ducto torácico) pode aumentar em neoplasias abdominais.',
  };
  const sideName = { R: { a: 'direito', A: 'direita' }, L: { a: 'esquerdo', A: 'esquerda' } };
  const gPlex = { R: grp('brachial-plexus-R', LN, G({ id: 'brachial-plexus-R', name: 'Plexo braquial direito', desc: DESC.plexus })), L: grp('brachial-plexus-L', LN, G({ id: 'brachial-plexus-L', name: 'Plexo braquial esquerdo', desc: DESC.plexus })) };
  const gPhr = { R: grp('phrenic-R', LN, G({ id: 'phrenic-R', name: 'Nervo frênico direito', desc: DESC.phrenic })), L: grp('phrenic-L', LN, G({ id: 'phrenic-L', name: 'Nervo frênico esquerdo', desc: DESC.phrenic })) };
  const gVag = { R: grp('vagus-R', LN, G({ id: 'vagus-R', name: 'Nervo vago direito (NC X)', desc: DESC.vagus })), L: grp('vagus-L', LN, G({ id: 'vagus-L', name: 'Nervo vago esquerdo (NC X)', desc: DESC.vagus })) };
  const gRln = { R: grp('recurrent-laryngeal-R', LN, G({ id: 'recurrent-laryngeal-R', name: 'Nervo laríngeo recorrente direito', desc: DESC.rln })), L: grp('recurrent-laryngeal-L', LN, G({ id: 'recurrent-laryngeal-L', name: 'Nervo laríngeo recorrente esquerdo', desc: DESC.rln })) };
  const gSym = { R: grp('sympathetic-trunk-R', LN, G({ id: 'sympathetic-trunk-R', name: 'Tronco simpático direito', desc: DESC.sym })), L: grp('sympathetic-trunk-L', LN, G({ id: 'sympathetic-trunk-L', name: 'Tronco simpático esquerdo', desc: DESC.sym })) };
  const gStel = { R: grp('stellate-R', LN, G({ id: 'stellate-R', name: 'Gânglio cervicotorácico (estrelado) direito', desc: DESC.stellate })), L: grp('stellate-L', LN, G({ id: 'stellate-L', name: 'Gânglio cervicotorácico (estrelado) esquerdo', desc: DESC.stellate })) };

  const solidId = (mat, key, s, j) => (mat === MAT.duct ? 'lymph:' : 'nerve:') + key + (j ? '#' + j : '') + '-' + s;
  /** Cria a malha D e (opcional) a espelhada E; registra sólido(s). spec: {grp, name(side)→str, mat, o, solid:[a,b], mirror} */
  function build(sys, key, spec) {
    const out = {};
    const sides = spec.mirror === false ? [spec.side || 'R'] : ['R', 'L'];
    const ptsR = sys.pts(key);
    const p = sys.by[key];
    for (const s of sides) {
      const pts = s === 'L' && spec.mirror !== false ? ptsR.map(mx) : ptsR;
      const g = spec.grp[s];
      const info = Object.assign({}, g.userData.info, { name: spec.name(s) });
      out[s] = sweep(pts, spec.o, spec.mat || MAT.nerve, g, info);
      if (spec.solid !== false) {
        // eixo de colisão recortado nas extremidades conectadas (junções não contam como interpenetração)
        const tr = (v) => (v === true ? 1.3 : +v || 0), sl = spec.solid || [0, 0];
        const segs = spec.solidSegs ? spec.solidSegs(pts) : [trim(pts, tr(sl[0]), tr(sl[1]))];
        segs.forEach((sp, j) => C.solid(solidId(spec.mat, key, s, j), sp, spec.solidRadius || Math.max(...p.R) * 0.9));
      }
      BUILT.push({ key, side: s, pts });
    }
    return out;
  }
  /** Linhagem contínua: UMA varredura por todos os segmentos (calibre/quadros contínuos), fatiada em malhas nomeadas.
      segs: [[key, nome, [recorteIni, recorteFim] do sólido], ...]; o: {radial, density, capEnd, caps}. */
  function lineage(sys, segs, o) {
    const P = [], Rr = [], bounds = [], keepIdx = new Set();
    segs.forEach(([k], j) => {
      const p = sys.by[k];
      if (j) { bounds.push(P.length - 1); keepIdx.add(P.length - 1); }
      for (let i = j ? 1 : 0; i <= p.n; i++) { P.push(p.P[i]); Rr.push(p.R[i]); }
    });
    const keep = decimate(P, keepIdx), pts = keep.map((i) => ar(P[i])), rad = keep.map((i) => Rr[i]);
    // parâmetro por corda (≈ comprimento de arco da Catmull-Rom)
    const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]));
    const Ltot = cum[cum.length - 1], tk = cum.map((c) => c / Ltot);
    const cuts = bounds.map((b) => tk[keep.indexOf(b)]);
    const fl = 0.06, vScale = 2.6;
    const g = C.sweepGeometry(pts, {
      rx: tk.map((t, i) => [t, rad[i] * (1 + fl)]), ry: tk.map((t, i) => [t, rad[i] * (1 - fl)]), radial: o.radial || 13, density: o.density || 4.6,
      caps: o.caps || 'round', capStart: true, capEnd: o.capEnd ?? true, vScale,
    });
    const parts = splitGeo(g, cuts, vScale); g.dispose();
    for (const s of ['R', 'L']) {
      parts.forEach((pg, j) => {
        const [k, nm, sl] = segs[j], info = Object.assign({}, gPlex[s].userData.info, { name: P_(s, nm) });
        C.mesh(s === 'R' ? pg : C.mirrorGeometry(pg), MAT.nerve, gPlex[s], info);
        const own = sys.pts(k), ptsS = s === 'R' ? own : own.map(mx);
        C.solid(solidId(MAT.nerve, k, s, 0), trim(ptsS, sl[0], sl[1]), Math.max(...sys.by[k].R) * 0.9);
        BUILT.push({ key: k, side: s, pts: ptsS });
      });
    }
  }
  const P_ = (s, t) => `Plexo braquial ${sideName[s].a} — ${t}`;
  const N_ = (s, t) => `${t} ${sideName[s].a}`;
  const big = { radial: 13, density: 4.6 }, med = { radial: 11, density: 4.2 }, thin = { radial: 8, density: 3.2 };
  const prof = (key) => SR.by[key].rf;
  // linhagens do plexo (lateral, posterior, medial) e do torácico longo
  lineage(SR, [['C5', 'raiz C5 (ramo anterior)', [0.4, 0.3]], ['trS', 'tronco superior (C5–C6)', [2.2, 1.0]], ['divSA', 'divisão anterior do tronco superior', [0.6, 0.6]],
    ['cordL', 'fascículo lateral', [1.4, 1.1]], ['latRoot', 'nervo mediano — raiz lateral', [0.6, 0.6]], ['median', 'nervo mediano (ramo terminal)', [0.8, 0]]], { ...big, caps: 'flat' });
  lineage(SR, [['C7', 'raiz C7 (ramo anterior)', [0.4, 0.3]], ['trM', 'tronco médio (C7)', [0.3, 1.0]], ['divMP', 'divisão posterior do tronco médio', [0.6, 0.6]],
    ['cordP', 'fascículo posterior', [1.4, 1.1]], ['radial', 'nervo radial (ramo terminal)', [1.0, 0]]], { ...big, caps: 'flat' });
  lineage(SR, [['C8', 'raiz C8 (ramo anterior)', [0.4, 0.3]], ['trI', 'tronco inferior (C8–T1)', [1.2, 1.0]], ['divIA', 'divisão anterior do tronco inferior', [0.6, 0.6]],
    ['cordM', 'fascículo medial', [1.4, 1.1]], ['ulnar', 'nervo ulnar (ramo terminal)', [1.0, 0]]], { ...big, caps: 'flat' });
  lineage(SR, [['ltC5', 'nervo torácico longo — raiz C5', [2.0, 0.3]], ['longThor', 'nervo torácico longo (C5–C7; serrátil anterior)', [0.4, 0]]], { ...thin });
  // raízes e divisões que confluem/saem de lado (sem tampa na extremidade enterrada no pai)
  build(SR, 'C6', { grp: gPlex, name: (s) => P_(s, 'raiz C6 (ramo anterior)'), o: { ...big, r: prof('C6'), capEnd: false }, solid: [0.4, 1.9] });
  build(SR, 'T1', { grp: gPlex, name: (s) => P_(s, 'raiz T1 (ramo anterior)'), o: { ...big, r: prof('T1'), capEnd: false }, solid: [0.4, 1.9] });
  [['divSP', 'divisão posterior do tronco superior'], ['divMA', 'divisão anterior do tronco médio'], ['divIP', 'divisão posterior do tronco inferior']].forEach(([k, n]) =>
    build(SR, k, { grp: gPlex, name: (s) => P_(s, n), o: { ...med, r: prof(k), capStart: false, capEnd: false }, solid: [1.1, 1.4] }));
  build(SR, 'medRoot', { grp: gPlex, name: (s) => N_(s, 'Nervo mediano') + ' — raiz medial', o: { ...med, r: prof('medRoot'), capStart: false, capEnd: false }, solid: [1.1, 1.1] });
  build(SR, 'musculocut', { grp: gPlex, name: (s) => N_(s, 'Nervo musculocutâneo') + ' (ramo terminal do plexo braquial)', o: { ...med, r: prof('musculocut'), caps: 'flat', capStart: false }, solid: [1.3, 0] });
  build(SR, 'axillary', { grp: gPlex, name: (s) => N_(s, 'Nervo axilar') + ' (ramo terminal do plexo braquial)', o: { ...med, r: prof('axillary'), capStart: false }, solid: [2, 0] });
  // colaterais
  build(SR, 'suprascap', { grp: gPlex, name: (s) => N_(s, 'Nervo supraescapular') + ' (ramo do tronco superior)', o: { ...med, r: prof('suprascap'), capStart: false }, solid: [2, 0] });
  build(SR, 'subclN', { grp: gPlex, name: (s) => N_(s, 'Nervo subclávio') + ' (para o músculo subclávio)', o: { ...thin, r: prof('subclN'), capStart: false }, solid: [2, 0] });
  build(SR, 'latPect', { grp: gPlex, name: (s) => N_(s, 'Nervo peitoral lateral'), o: { ...thin, r: prof('latPect'), capStart: false }, solid: [2, 0] });
  build(SR, 'dorsScap', { grp: gPlex, name: (s) => N_(s, 'Nervo dorsal da escápula') + ' (C5)', o: { ...thin, r: prof('dorsScap'), capStart: false }, solid: [2, 0] });
  [['ltC6', 6], ['ltC7', 7]].forEach(([k, n]) => build(SR, k, { grp: gPlex, name: (s) => N_(s, 'Nervo torácico longo') + ` — raiz C${n}`, o: { ...thin, r: prof(k), capStart: false, capEnd: false }, solid: [2, 2] }));

  // frênico D (topo cortado em y≈11) + contribuição de C5; ramúsculos terminais sobre a cúpula D (perfura o diafragma junto à VCI)
  build(SR, 'phrenic', { grp: gPhr, mirror: false, name: () => 'Nervo frênico direito', o: { ...med, radial: 12, r: prof('phrenic'), caps: 'flat', capEnd: true }, solid: [0, 0] });
  build(SR, 'phrC5', { grp: gPhr, mirror: false, name: () => 'Nervo frênico direito — contribuição de C5', o: { ...thin, r: prof('phrC5'), capStart: false, capEnd: false }, solid: [2, 1.3] });
  /** Ramúsculos frênicos terminais: partem do fim do nervo e correm sobre a face superior do diafragma (alturas medidas
      na cúpula), afilando-se e mergulhando na lâmina muscular. */
  function twigs(endP, list, grpS, name) {
    list.forEach((pts, i) => {
      const g = C.sweepGeometry([endP, ...pts], { r: (t) => C.lerp(0.04, 0.016, t), radial: 7, density: 6, caps: 'round', capStart: false, vScale: 2.6 });
      C.mesh(g, MAT.nerve, grpS, Object.assign({}, grpS.userData.info, { name: name + ' — ramúsculo diafragmático ' + (i + 1) }));
    });
  }
  { const e = SR.by.phrenic.P[SR.by.phrenic.n], E0 = [e.x, e.y + 0.02, e.z];
    twigs(E0, [[[4.45, -14.23, -2.4], [4.3, -14.58, -1.65]], [[5.35, -14.02, -3.3], [6.15, -14.0, -3.55]], [[4.7, -14.1, -4.05], [4.85, -14.34, -4.6]]], gPhr.R, 'Nervo frênico direito'); }
  // vago D, recorrente D
  build(SR, 'vagus', { grp: gVag, mirror: false, name: () => 'Nervo vago direito (NC X)', o: { ...med, radial: 14, r: prof('vagus'), caps: 'flat' }, solid: [0, 0] });
  build(SR, 'rln', { grp: gRln, mirror: false, name: () => 'Nervo laríngeo recorrente direito', o: { ...thin, radial: 10, r: prof('rln'), caps: 'flat', capStart: false }, solid: [1.3, 0] });

  /* ---- tronco simpático (com gânglios torácicos como intumescências) ---- */
  const symP = SR.by.sym;
  const symS = (y) => { let b = 0, bd = Infinity; symP.P.forEach((p, i) => { const d = Math.abs(p.y - y); if (d < bd) { bd = d; b = i; } }); return symP.S[b] / symP.len; };
  const gangl = [1.6, -0.55, -2.75, -5.0, -7.35, -9.75, -12.2, -14.75, -17.35, -20.0].map(symS);
  const symR = (t) => { let r = 0.085; for (const g of gangl) r += 0.075 * Math.exp(-((((t - g) * symP.len) / 0.32) ** 2)); return r * (t > 0.985 ? C.lerp(1, 0.4, (t - 0.985) / 0.015) : 1); };
  // sólidos do tronco: acima e abaixo do estrelado (que tem sólido próprio), recortados junto às alças
  const symSegs = (pts) => [pts.filter((q) => q[1] > 5.6), pts.filter((q) => q[1] < 1.9)];
  build(SR, 'sym', { grp: gSym, name: (s) => `Tronco simpático ${sideName[s].a}`, mat: MAT.auto, o: { radial: 10, density: 4, r: symR, caps: 'flat' }, solidSegs: symSegs, solidRadius: 0.085 });
  build(SR, 'ansa', { grp: gSym, name: (s) => `Alça subclávia (${sideName[s].A})`, mat: MAT.auto, o: { ...thin, r: 0.055, capStart: false, capEnd: false }, solid: [1.2, 1.8], mirror: false });
  // gânglio cervical médio (≈C6) e gânglio estrelado: malhas próprias sobre o eixo relaxado do tronco
  function ganglion(y0, y1, w, d, sides, grpS, nameF, extra) {
    const i0 = symP.P.findIndex((p) => p.y <= y0), i1 = symP.P.findIndex((p) => p.y <= y1);
    const ptsR = symP.P.slice(Math.max(0, i0 - 1), i1 + 2).map(ar);
    const meshes = {};
    for (const s of sides) {
      const pts = s === 'R' ? ptsR : ptsR.map(mx);
      const g = C.sweepGeometry(pts, { up: [s === 'R' ? 1 : -1, 0, 0], rx: w, ry: d, radial: 16, density: 9, caps: 'round', noise: { amp: 0.08, freq: 2.6, seed: 21 }, vScale: 2 });
      meshes[s] = C.mesh(g, MAT.ganglion, grpS[s], Object.assign({}, grpS[s].userData.info, { name: nameF(s) }));
      if (extra) C.solid('nerve:' + extra + '-' + s, pts, (t) => C.profile(w)(t) * 0.8);
    }
    return { meshes, ptsR };
  }
  const stel = ganglion(4.75, 2.55, [[0, 0.07], [0.12, 0.26], [0.3, 0.42], [0.55, 0.47], [0.78, 0.4], [0.92, 0.22], [1, 0.07]], [[0, 0.06], [0.15, 0.17], [0.4, 0.27], [0.6, 0.29], [0.85, 0.2], [1, 0.06]], ['R', 'L'], gStel, (s) => `Gânglio cervicotorácico (estrelado) ${sideName[s].a}`, 'stellate');
  ganglion(7.35, 6.45, [[0, 0.07], [0.3, 0.2], [0.6, 0.21], [1, 0.07]], [[0, 0.06], [0.4, 0.15], [1, 0.06]], ['R', 'L'], gSym, (s) => `Gânglio cervical médio (${sideName[s].A})`, null);

  /* ---- linfáticos direitos ---- */
  const gRld = grp('right-lymphatic-duct', LL, { id: 'right-lymphatic-duct', name: 'Ducto linfático direito', group: 'Linfáticos', desc: DESC.rld });
  const rldOnly = { R: gRld };
  build(SR, 'rld', { grp: rldOnly, mirror: false, name: () => 'Ducto linfático direito', mat: MAT.duct, o: { radial: 12, density: 6, r: prof('rld') }, solid: [0, 1.1] });
  build(SR, 'rldJug', { grp: rldOnly, mirror: false, name: () => 'Tronco jugular direito', mat: MAT.duct, o: { ...thin, r: prof('rldJug'), capStart: false }, solid: [1.5, 0] });
  build(SR, 'rldBm', { grp: rldOnly, mirror: false, name: () => 'Tronco broncomediastinal direito', mat: MAT.duct, o: { ...thin, r: prof('rldBm'), capStart: false }, solid: [1.5, 0] });

  /* ======================================================================
     LADO ESQUERDO — trajetos próprios (assimetrias) relaxados contra os obstáculos esquerdos
     ====================================================================== */
  const SL = new System();
  SL.obs = obstaclesLeft();
  // estruturas já construídas por espelho entram como fixas (para os demais se afastarem delas)
  SL.path('symL', SR.pts('sym', true), 0.085, { fixed: true, spacing: 0.5 });
  ['C5', 'C6', 'C7', 'C8', 'T1', 'trS', 'trM', 'trI', 'suprascap', 'ltC5', 'ltC6', 'dorsScap'].forEach((k) => SL.path(k + 'L', SR.pts(k, true), Math.max(...SR.by[k].R), { fixed: true, spacing: 0.5 }));
  /* frênico E: topo = espelho EXATO do direito (face anterior do escaleno anterior); desce lateral à carótida comum E,
     entre a subclávia E e a VBC E, cruza o arco aórtico (anterior ao vago) e, anterior à raiz do pulmão, corre entre o
     pericárdio fibroso (sobre a aurícula e o VE) e a pleura até o diafragma, lateral ao ápice. Abaixo de y≈−0,8 segue o
     espaço medido entre o mediastino e o pulmão E. */
  const PHR_L = [[-0.5, -2.95, -2.85], [-1.0, -2.4, -2.88], [-1.5, -2.25, -2.87], [-2.0, -2.56, -2.97], [-2.5, -3.08, -3.2], [-3.0, -3.26, -3.3], [-3.5, -3.2, -3.3], [-4.0, -2.78, -3.12], [-4.5, -3.12, -3.17],
    [-5.0, -3.64, -3.28], [-5.5, -3.955, -3.27], [-6.0, -4.015, -3.24], [-6.5, -3.985, -3.2], [-7.0, -3.9, -3.1], [-7.5, -3.67, -3.11], [-8.0, -3.64, -3.06], [-8.5, -3.78, -2.97],
    [-9.0, -3.97, -2.86], [-9.5, -4.8, -2.62], [-10.0, -5.77, -2.41], [-10.5, -6.455, -2.16], [-11.0, -6.99, -1.92], [-11.5, -7.4, -1.77], [-12.0, -7.72, -1.61], [-12.5, -7.98, -1.48],
    [-13.0, -8.175, -1.35], [-13.5, -8.34, -1.23], [-14.0, -8.4, -1.2], [-14.5, -8.38, -1.02], [-15.0, -8.39, -0.92], [-15.68, -8.39, -0.82]];
  const phrTopL = mxs([[3.45, 11.0, -3.95], ...LM.nerves.phrenicR.slice(0, 5)]);
  SL.path('phrenicL', [...phrTopL, ...PHR_L.map(([y, x, z]) => [x, y, z])], 0.1,
    { ignore: ['ita'], maxDev: 0.6, spring: 0.15, smooth: 0.45, pin: { y: -0.4, blend: 0.9 }, mesh: [{ k: 'scAntL', y0: 0, gap: 0.03 }], obsGap: { branch: -0.07 } });
  { const p = SL.by.phrenicL, c = crv(p.G.map(ar)); p.rf = (t) => { const y = c.getPointAt(t).y; return C.lerp(0.11, 0.092, C.smooth(0, -4.5, y)) * (t > 0.985 ? C.lerp(1, 0.55, (t - 0.985) / 0.015) : 1); }; p.R = p.R.map((_, i) => p.rf(i / p.n)); p.rmax = Math.max(...p.R); }
  SL.path('phrC5L', SR.pts('phrC5', true), 0.055, { fixed: true });
  /* vago E: bainha carotídea → entre carótida comum E e subclávia E → face esquerda do arco aórtico (posterior ao
     frênico) → posterior ao brônquio principal E (entre ele e a aorta descendente) → face esquerda e depois ANTERIOR do
     esôfago (plexo esofágico, tronco vagal anterior), atrás do pericárdio. */
  const VAG_ESO_L = [[-8.6, 92], [-10.0, 88], [-11.5, 84], [-12.5, 58], [-13.5, 38], [-14.5, 26], [-15.4, 20]];
  SL.path('vagusL', [[-2.75, 11.0, -3.3], [-2.8, 6.0, -3.05], [-2.65, 2.0, -3.3], [-2.55, 0.5, -3.4], [-2.5, -1.0, -3.62], [-3.05, -2.3, -3.4], [-3.55, -3.3, -3.75], [-3.45, -4.3, -4.4],
    [-3.6, -5.5, -5.7], [-2.95, -6.6, -6.0], [-2.2, -7.6, -6.22], ...VAG_ESO_L.map(([y, a]) => esoAt(y, a, 0.185))], [[0, 0.15], [0.4, 0.14], [0.48, 0.13], [1, 0.12]],
  { maxDev: 0.6, spring: 0.12, pin: { y: -8.3, blend: 0.9 } });
  // recorrente E: contorna o arco aórtico por baixo (lateral ao ligamento arterial) e sobe no sulco traqueoesofágico E
  SL.path('rlnL', [[-3.48, -3.45, -3.75], [-3.15, -4.55, -4.15], [-2.3, -4.75, -4.55], [-1.4, -4.15, -4.95], [-1.15, -2.6, -4.85], [-1.05, -1.0, -4.6], [-1.0, 1.0, -4.05], [-1.0, 3.0, -3.45], [-0.85, 6.0, -2.55], [-0.8, 8.5, -2.1], [-0.75, 10.6, -1.75]], 0.075, { maxDev: 0.6, spring: 0.12 });
  SL.attach('rlnL', 'start', 'vagusL');
  SL.attach('phrC5L', 'end', 'phrenicL');
  // alça subclávia E (em torno da 1ª parte da subclávia E, que sobe do arco)
  {
    const A = crv(VS.scaL.pts), t = tAtX(A, -3.0), P0 = A.getPointAt(t), T = A.getTangentAt(t).normalize();
    const an = new THREE.Vector3(0, 0, 1).addScaledVector(T, -T.z).normalize(); // anterior ⟂ eixo
    const b = new THREE.Vector3().crossVectors(T, an).normalize(); if (b.y > 0) b.negate(); // inferior ⟂ eixo
    const d = 0.46 + 0.2, L = (deg) => { const a = (deg * Math.PI) / 180; return ar(P0.clone().addScaledVector(an, d * Math.cos(a)).addScaledVector(b, d * Math.sin(a))); };
    SL.path('ansaL', [[-1.62, 5.1, -5.65], [-2.2, 3.6, -4.25], L(-50), L(0), L(70), L(140), L(185), [-2.55, 1.9, -5.15], [-2.45, 2.7, -6.6]], 0.055, { spring: 0.14, smooth: 0.5 });
    SL.attach('ansaL', 'start', 'symL', [-1.62, 5.1, -5.65]); SL.attach('ansaL', 'end', 'symL', [-2.5, 2.7, -7.2]);
  }
  /* ducto torácico (ESQUERDO): LM até o ápice do arco (C7, atrás da bainha carotídea, à frente da vertebral e do tronco
     tireocervical); desce então ATRÁS da VJI E — medial ao frênico E e ao escaleno anterior, à frente da subclávia E —
     e abre-se na face posterior do ângulo venoso E. Se trajetos se aproximarem, o ducto passa À FRENTE do frênico. */
  const TD = LM.lymph.thoracicDuct;
  SL.path('duct', [...TD.slice(0, 9), [-3.68, 3.35, -3.12], [-3.7, 2.6, -2.98], [-3.52, 1.8, -2.94], [-3.32, 1.15, -2.72], [-3.12, 0.7, -2.42]], 0.15,
    { freeEnd: 1.3, endIgnore: ['ijv', 'vein', 'bcv'], ignore: ['trachea'], maxDev: 0.6, spring: 0.15, anteriorTo: ['phrenicL'], mesh: [{ k: 'scAntL', y0: 0 }] });
  SL.path('ductJug', [[-3.7, 3.0, -3.0], [-3.8, 3.9, -2.75], [-3.65, 4.8, -2.6]], taper(0.07, 0.06), { mesh: [{ k: 'scAntL' }] });
  SL.attach('ductJug', 'start', 'duct', [-3.7, 3.0, -3.0]);
  mark('meshR'); SL.solve(16); mark('solveL');

  // malhas do lado esquerdo próprio
  const only = (g) => ({ L: g });
  build(SL, 'phrenicL', { grp: only(gPhr.L), mirror: false, side: 'L', name: () => 'Nervo frênico esquerdo', o: { ...med, radial: 12, r: SL.by.phrenicL.rf, caps: 'flat' }, solid: [0, 0] });
  { const e = SL.by.phrenicL.P[SL.by.phrenicL.n], E0 = [e.x, e.y + 0.02, e.z];
    twigs(E0, [[[-8.55, -15.83, -0.1], [-8.65, -15.96, 0.55]], [[-9.0, -15.83, -0.95], [-9.55, -15.9, -1.15]], [[-8.35, -15.69, -1.6], [-8.4, -15.68, -2.15]]], gPhr.L, 'Nervo frênico esquerdo'); }
  build(SL, 'vagusL', { grp: only(gVag.L), mirror: false, side: 'L', name: () => 'Nervo vago esquerdo (NC X)', o: { ...med, radial: 14, r: SL.by.vagusL.rf, caps: 'flat' }, solid: [0, 0] });
  build(SL, 'rlnL', { grp: only(gRln.L), mirror: false, side: 'L', name: () => 'Nervo laríngeo recorrente esquerdo', o: { ...thin, radial: 10, r: 0.075, caps: 'flat', capStart: false }, solid: [1.3, 0] });
  build(SL, 'phrC5L', { grp: only(gPhr.L), mirror: false, side: 'L', name: () => 'Nervo frênico esquerdo — contribuição de C5', o: { ...thin, r: 0.055, capStart: false, capEnd: false }, solid: [2, 1.3] });
  build(SL, 'ansaL', { grp: only(gSym.L), mirror: false, side: 'L', name: () => 'Alça subclávia (esquerda)', mat: MAT.auto, o: { ...thin, r: 0.055, capStart: false, capEnd: false }, solid: [1.2, 1.8] });

  /* ---- ducto torácico: contas (válvulas), ampola terminal; cisterna do quilo ---- */
  const gTD = grp('thoracic-duct', LL, { id: 'thoracic-duct', name: 'Ducto torácico', group: 'Linfáticos', desc: DESC.duct });
  const dP = SL.by.duct;
  const ductR = (t) => { const s = t * dP.len; const bead = 1 + 0.17 * Math.pow(0.5 + 0.5 * Math.cos((2 * Math.PI * s) / 0.95), 4); const amp = 1 + 0.4 * C.smooth(0.9, 0.985, t); return 0.13 * bead * amp; };
  build(SL, 'duct', { grp: only(gTD), mirror: false, side: 'L', name: () => 'Ducto torácico', mat: MAT.duct, o: { radial: 12, density: 7, r: ductR, flat: 0.06 }, solid: [0.5, 1.1] });
  build(SL, 'ductJug', { grp: only(gTD), mirror: false, side: 'L', name: () => 'Tronco jugular esquerdo (afluente do ducto torácico)', mat: MAT.duct, o: { ...thin, r: SL.by.ductJug.rf, capStart: false }, solid: [1.5, 0] });
  // cisterna do quilo (dilatação saculiforme anterior a T12–L1, à direita da aorta) — topo funde-se com o início do ducto
  {
    const pts = [[0.32, -20.7, -6.9], [0.6, -22.2, -6.5], [0.9, -23.6, -6.28], [0.98, -25.0, -6.15]];
    const g = C.sweepGeometry(pts, { up: [1, 0, 0], rx: [[0, 0.13], [0.25, 0.42], [0.6, 0.55], [0.9, 0.42], [1, 0.25]], ry: [[0, 0.13], [0.25, 0.32], [0.6, 0.4], [1, 0.22]], radial: 16, density: 7, caps: 'round', noise: { amp: 0.06, freq: 2, seed: 4 } });
    C.mesh(g, MAT.duct, gTD, { id: 'thoracic-duct', name: 'Cisterna do quilo (origem do ducto torácico)', group: 'Linfáticos', desc: DESC.duct });
    C.solid('lymph:cisterna', pts.slice(1), 0.4);
  }

  /* ---- linfonodos supraclaviculares (ovoides com hilo discreto) ---- */
  const gNodes = {
    R: grp('supraclavicular-nodes-R', LL, { id: 'supraclavicular-nodes-R', name: 'Linfonodos supraclaviculares direitos', group: 'Linfáticos', desc: DESC.nodes }),
    L: grp('supraclavicular-nodes-L', LL, { id: 'supraclavicular-nodes-L', name: 'Linfonodos supraclaviculares esquerdos', group: 'Linfáticos', desc: DESC.nodes }),
  };
  const nodeGeo = (rx, ry, rz, seed) => {
    const g = C.ellipsoidGeometry([rx, ry, rz], 20, 14);
    return C.deform(g, (v) => {
      const k = 1 + 0.07 * (C.noise3(v.x * 3 + seed, v.y * 3, v.z * 3, seed) - 0.5) * 2;
      const hil = 1 - 0.18 * Math.exp(-((v.x / rx + 0.95) ** 2) / 0.05) * Math.exp(-((v.y / ry) ** 2) / 0.25); // hilo (face medial)
      v.multiplyScalar(k * hil);
    });
  };
  /** Assenta um linfonodo (esfera envolvente rr) fora de vasos/músculos (eixos), das lâminas reais e dos trajetos dados. */
  function settle(p0, rr, obs, meshes, paths) {
    const x = v3(p0), t = new THREE.Vector3();
    for (let it = 0; it < 10; it++) {
      for (const O of obs) {
        if (!inBox(x, O.box, O.rmax + rr + 0.05)) continue;
        const nr = nearest(O, x.x, x.y, x.z), need = nr[1] + rr + 0.05;
        if (nr[0] < need) { t.set(x.x - nr[2], x.y - nr[3], x.z - nr[4]).normalize(); x.addScaledVector(t, need - nr[0]); }
      }
      for (const p of paths) for (let i = 0; i <= p.n; i++) { const d = x.distanceTo(p.P[i]), need = rr + p.R[i] + 0.05; if (d < need) { t.subVectors(x, p.P[i]).normalize(); x.addScaledVector(t, need - d); } }
      for (const k of meshes) { const MO = meshOf(k); if (MO && inBox(x, MO.box, rr + 0.3)) pushOutMesh(MO, x, rr * 0.92 + 0.03); }
    }
    return ar(x);
  }
  const NODES = [
    { p: [5.3, 3.1, -1.3], r: [0.3, 0.42, 0.24], rot: [0.3, 0.4, 0.5] },
    { p: [4.35, 5.0, -1.12], r: [0.24, 0.36, 0.2], rot: [0.1, -0.3, 0.2] },
    { p: [6.6, 3.65, -2.3], r: [0.26, 0.34, 0.22], rot: [0.5, 0.2, -0.6] },
    { p: [7.6, 2.45, -1.4], r: [0.2, 0.28, 0.18], rot: [-0.2, 0.6, 0.9] },
  ];
  // cada lado assenta os seus (a vizinhança à esquerda difere: ducto torácico, frênico E, ramos tireocervicais E)
  const nodePos = { R: NODES.map((n) => settle(n.p, Math.max(...n.r), SR.obs, ['scAntR', 'scMidR'], [SR.by.phrenic, SR.by.rldJug, SR.by.trS])),
    L: NODES.map((n) => settle(mx(n.p), Math.max(...n.r), SL.obs, ['scAntL', 'scMidL'], [SL.by.phrenicL, SL.by.duct, SL.by.ductJug, SL.by.trSL])) };
  NODES.forEach((n, i) => {
    for (const s of ['R', 'L']) {
      const g = nodeGeo(n.r[0], n.r[1], n.r[2], 11 + i), P = nodePos[s][i];
      const m = C.mesh(s === 'R' ? g : C.mirrorGeometry(g), MAT.node, gNodes[s], { id: 'supraclavicular-nodes-' + s, name: `Linfonodo supraclavicular ${sideName[s].a}`, group: 'Linfáticos', desc: DESC.nodes });
      m.position.copy(v3(P)); m.rotation.set(n.rot[0], s === 'R' ? n.rot[1] : -n.rot[1], s === 'R' ? n.rot[2] : -n.rot[2]);
      C.solid('lymph:node' + i + s, [P, P], Math.max(...n.r));
    }
  });
  // linfonodo de Virchow (supraclavicular esquerdo, junto à terminação do ducto torácico): lateral e um pouco acima da
  // ampola — não a encobre nas vistas anteriores; assentado fora do escaleno, dos ramos arteriais e do frênico E
  const VIR = settle([-4.75, 2.05, -1.3], 0.4, SL.obs, ['scAntL', 'scMidL'], [SL.by.phrenicL, SL.by.duct, SL.by.ductJug]);
  {
    const m = C.mesh(nodeGeo(0.3, 0.4, 0.26, 31), MAT.node, gNodes.L, { id: 'supraclavicular-nodes-L', name: 'Linfonodo supraclavicular esquerdo (de Virchow)', group: 'Linfáticos', desc: DESC.nodes });
    m.position.copy(v3(VIR)); m.rotation.set(0.2, 0.5, -0.3);
    C.solid('lymph:virchow', [VIR, VIR], 0.4);
  }

  mark('end');
  /* ---------------- âncoras ---------------- */
  const onP = (sys, key, f) => { const p = sys.by[key]; return ar(p.P[Math.round(f * p.n)]); };
  const surf = (sys, key, f, dir) => { const c = onP(sys, key, f), R = sys.by[key].R[Math.round(f * sys.by[key].n)]; return C.lerp3(c, [c[0] + dir[0], c[1] + dir[1], c[2] + dir[2]], R); };
  const stelC = stel.ptsR[Math.floor(stel.ptsR.length / 2)];
  const anchors = {
    plexusR: surf(SR, 'trS', 0.45, [0, 0, 1]),
    plexusRootsR: onP(SR, 'C6', 0.62),
    plexusCordsR: onP(SR, 'cordP', 0.72),
    phrenicR: surf(SR, 'phrenic', 0.2, [0, 0, 1]),
    vagusR: onP(SR, 'vagus', 0.22),
    recurrentR: onP(SR, 'rln', 0.16),
    stellateR: stelC,
    ansaSubclaviaR: onP(SR, 'ansa', 0.55),
    longThoracicR: onP(SR, 'longThor', 0.55),
    suprascapularR: onP(SR, 'suprascap', 0.5),
    plexusL: mx(surf(SR, 'trS', 0.45, [0, 0, 1])),
    phrenicL: onP(SL, 'phrenicL', 0.2),
    vagusL: onP(SL, 'vagusL', 0.22),
    recurrentL: onP(SL, 'rlnL', 0.12),
    stellateL: mx(stelC),
    thoracicDuct: onP(SL, 'duct', 0.86),
    thoracicDuctTerminal: onP(SL, 'duct', 0.985),
    cisternaChyli: [0.95, -23.4, -6.3],
    rightLymphDuct: onP(SR, 'rld', 0.5),
    virchowNode: VIR,
  };
  return {
    anchors,
    api: {
      /** Trajetos (pontos relaxados, coordenadas anatômicas) de cada estrutura construída — útil para rótulos/animações
          e para que módulos posteriores (vísceras) moldem sulcos/folgas ao longo dos nervos. */
      paths: () => BUILT.map((b) => ({ key: b.key, side: b.side, pts: b.pts })),
      /** Diagnóstico: amostras densas relaxadas (antes da decimação) de um trajeto do sistema D ou E. */
      dense: (key) => { const p = SR.by[key] || SL.by[key]; return p ? p.P.map(ar) : null; },
    },
  };
});
