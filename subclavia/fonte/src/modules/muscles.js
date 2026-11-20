/* ==========================================================================
   muscles.js — músculos, ligamentos costoclavicular e nucal e fáscia clavipeitoral (camada 'muscle')
   Coordenadas ANATÔMICAS (x = direita do paciente, y cranial, z anterior, cm) — ver landmarks.js.
   Lado direito construído a partir de LM; lado esquerdo por espelhamento (C.mirrorGeometry).

   Técnica
   - Lâminas musculares (peitorais, deltoide, trapézio, intercostais): superfície média em grade
     (pontos de controle origem → inserção, interpolação Catmull-Rom em u e v) + espessura th(u,v).
     A superfície média é relaxada (Laplaciano) e "assentada" por projeção contra obstáculos analíticos:
     parede costal (raster polar das costelas/cartilagens/esterno), tubos ósseos com secção elíptica
     idêntica à do esqueleto (clavícula, costelas, acrômio, coracoide, espinha, úmero), esferas/elipsoides
     (cabeça e tubérculos do úmero), a lâmina escapular (superfície compartilhada LM.scapulaGeom), eixos vasculares de LM
     e outras lâminas (camadas musculares). O deslocamento de projeção é suavizado na grade (dilatação pelo
     vetor de maior norma) e a face SUPERFICIAL é suavizada à parte (Laplaciano com bordas fixas e espessura
     limitada): o relevo do leito fica na face profunda, a superficial permanece lisa e convexa.
   - Peitoral maior com tendão bilaminar dobrado em "U" (prega axilar anterior); manguito rotador posterior
     (supraespinal, infraespinal, redondo menor) renderizado como leito do deltoide e do trapézio.
   - Músculos fusiformes/acintados (ECM, escalenos, subclávio, omo-hióideo, infra-hióideos): varreduras
     de secção elíptica com orientação controlada; moldados contra os eixos REAIS dos vasos/nervos (deformação macia).
   - Extremidades de origem/inserção (intercostais, deltoide, trapézio, ligamento costoclavicular, subclávio, escalenos,
     infra-hióideos, peitoral maior) assentadas na MALHA REAL do esqueleto: raios de direção fixa com teste de paridade
     (o vértice dentro do osso sai pela primeira face) e, nas bordas das lâminas, parede da borda sem cortar a quina.
   - Trapézio cervical assentado sobre os espinhosos reais do esqueleto (mapa de altura da linha média) e sobre o
     ligamento nucal (septo mediano); sulco deltopeitoral aberto ao longo do eixo real da veia cefálica.
   - Cor por vértice: ventre muscular ↔ tendão/aponeurose (transição nítida de ~0,45 cm, junção miotendínea
     levemente escurecida) + mosqueado sutil;
     textura normal de fibras (C.mats.muscle) com v ao longo das fibras.
   ========================================================================== */
ATLAS.define('muscles', function (ctx) {
  'use strict';
  const { THREE, C, LM, layers } = ctx;
  const LAY = layers.muscle;
  const Vec = THREE.Vector3;
  const v3 = (p) => (p.isVector3 ? p.clone() : new Vec(p[0], p[1], p[2]));
  const arr = (v) => [v.x, v.y, v.z];
  const lerp = C.lerp, clamp = C.clamp, sm = C.smooth;
  const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const add3 = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
  const deg = Math.PI / 180;
  const anchors = {};
  const ZC = -6.2; // eixo vertical da caixa torácica (mesmo usado pelo esqueleto)
  const G = (k) => Object.assign({ group: 'Músculos' }, k);

  /* =====================================================================
     Materiais e cores
     ===================================================================== */
  // sheen baixo e avermelhado (o veludo salmão claro lavava o ventre); relevo de fibras discreto; leve verniz úmido
  const MUS = C.mat({
    color: '#ffffff', vertexColors: true, roughness: 0.5, sheen: 0.25, sheenRoughness: 0.6, sheenColor: '#cf7563',
    clearcoat: 0.2, clearcoatRoughness: 0.4, normalMap: C.mats.muscle.normalMap, normalScale: new THREE.Vector2(0.2, 0.2), cut: 0x8e3a33,
  });
  const LIG = C.mats.ligament;
  const FAS = C.mat({ color: '#f1e9da', roughness: 0.28, clearcoat: 0.7, clearcoatRoughness: 0.2, sheen: 0.4, sheenColor: '#ffffff',
    transparent: true, opacity: 0.36, depthWrite: false, side: THREE.DoubleSide });
  const MEMB = C.mat({ color: '#eadfcd', roughness: 0.3, clearcoat: 0.5, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
  const COL = { mus: '#983a31', deep: '#8c3a31', dark: '#80342d', ten: '#e3dccb', apo: '#d8c6ae' };
  const colCache = {};
  const lin = (hex) => colCache[hex] || (colCache[hex] = new THREE.Color(hex)); // sRGB → linear (ColorManagement)
  /** cor final: base ↔ tendão (k), mosqueado sutil por ruído 3D; j (0..1) escurece a junção miotendínea */
  function musRGB(base, k, x, y, z, seed, j = 0) {
    const b = lin(base), t = lin(COL.ten);
    const n = C.fbm3(x * 0.42 + seed, y * 0.42, z * 0.42, 2, 7) - 0.5;
    const n2 = C.noise3(x * 2.1, y * 2.1, z * 2.1, 3) - 0.5;
    const m = (1 + n * 0.22 * (1 - k) + n2 * 0.06) * (1 - 0.1 * clamp(j, 0, 1));
    return [lerp(b.r, t.r, k) * m, lerp(b.g, t.g, k) * m, lerp(b.b, t.b, k) * m];
  }
  /* Transições ventre → tendão/aponeurose NÍTIDAS (≈0,4–0,5 cm), como a borda prateada de uma aponeurose real,
     em vez de degradês longos ("geada"). x = parâmetro ao longo das fibras; c = posição da junção; w = largura
     da rampa no mesmo parâmetro (em geral 0,45 cm ÷ comprimento). */
  const ramp = (x, c, w) => sm(c - w / 2, c + w / 2, x);
  /** faixa da junção miotendínea, do lado MUSCULAR (escurecida ~10% em musRGB); dir = +1 se o tendão fica em x > c */
  const band = (x, c, w, dir = 1) => Math.max(0, 1 - Math.abs(x - (c - dir * w * 0.9)) / (w * 0.9));
  const RW = 0.45; // largura-alvo da rampa (cm)
  /** aplica cores por vértice a uma geometria: fn(i, x,y,z) → [r,g,b] */
  function paint(geo, fn) {
    const pos = geo.attributes.position, n = pos.count, out = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const c = fn(i, pos.getX(i), pos.getY(i), pos.getZ(i)); out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2]; }
    geo.setAttribute('color', new THREE.BufferAttribute(out, 3));
    return geo;
  }

  /* =====================================================================
     Quadros de tubos (réplica da varredura do esqueleto) e consultas de superfície
     ===================================================================== */
  function frames(pts, o = {}) {
    const curve = C.curve(pts, false, 0.5), len = curve.getLength();
    const n = o.n || Math.max(12, Math.round(len / (o.step || 0.15)));
    const rx = C.profile(o.rx ?? 0.5), ry = C.profile(o.ry ?? o.rx ?? 0.5);
    const S = [];
    let prevN = null;
    for (let j = 0; j <= n; j++) {
      const t = j / n, c = curve.getPointAt(t), T = curve.getTangentAt(t).normalize();
      let up;
      if (typeof o.up === 'function') up = v3(o.up(t, c, T));
      else if (o.up) up = v3(o.up);
      else up = prevN ? prevN.clone() : (Math.abs(T.y) < 0.95 ? new Vec(0, 1, 0) : new Vec(0, 0, 1));
      let N = up.sub(T.clone().multiplyScalar(up.dot(T)));
      if (N.lengthSq() < 1e-8) N = new Vec(1, 0, 0).sub(T.clone().multiplyScalar(T.x));
      N.normalize();
      if (o.up && typeof o.up !== 'function' && prevN && N.dot(prevN) < -0.2) N.negate();
      prevN = N;
      S.push({ t, c, T, N, B: new Vec().crossVectors(T, N).normalize(), rx: rx(t), ry: ry(t) });
    }
    return { curve, len, S, exp: o.exp || 2, rfn: o.radial_fn || null };
  }
  function fAt(F, t) {
    const S = F.S, f = clamp(t, 0, 1) * (S.length - 1), i = Math.min(S.length - 2, Math.floor(f)), w = f - i, a = S[i], b = S[i + 1];
    return { c: a.c.clone().lerp(b.c, w), T: a.T.clone().lerp(b.T, w).normalize(), N: a.N.clone().lerp(b.N, w).normalize(), B: a.B.clone().lerp(b.B, w).normalize(), rx: lerp(a.rx, b.rx, w), ry: lerp(a.ry, b.ry, w) };
  }
  const se = (x, e) => Math.sign(x) * Math.pow(Math.abs(x), 2 / e);
  /** Ponto da superfície do tubo em t cuja normal aponta ~dir (+ afastamento off ao longo da normal). */
  function onTube(F, t, dir, off = 0) {
    const f = fAt(F, t), d = v3(dir).normalize();
    const a = Math.atan2(d.dot(f.B) * f.ry, d.dot(f.N) * f.rx);
    const m = F.rfn ? F.rfn(t, a) : 1, ca = Math.cos(a), sa = Math.sin(a);
    const p = f.c.clone().addScaledVector(f.N, f.rx * m * se(ca, F.exp)).addScaledVector(f.B, f.ry * m * se(sa, F.exp));
    return p.addScaledVector(f.N.clone().multiplyScalar(ca / f.rx).addScaledVector(f.B, sa / f.ry).normalize(), off);
  }
  /** t do quadro mais próximo de um valor de coordenada (eixo 0=x,1=y,2=z) */
  function tAt(F, axis, val) {
    let best = 0, bd = 1e9;
    for (const s of F.S) { const d = Math.abs(s.c.getComponent(axis) - val); if (d < bd) { bd = d; best = s.t; } }
    return best;
  }

  /* =====================================================================
     Obstáculos (projeção para fora com folga d): ob(p:Vector3, d)
     ===================================================================== */
  const obSphere = (c, r) => (p, d) => {
    const dx = p.x - c[0], dy = p.y - c[1], dz = p.z - c[2], L = Math.hypot(dx, dy, dz), need = r + d;
    if (L < need && L > 1e-6) { const s = need / L; p.set(c[0] + dx * s, c[1] + dy * s, c[2] + dz * s); }
  };
  const obEllipsoid = (c, R) => (p, d) => {
    const ax = R[0] + d, ay = R[1] + d, az = R[2] + d;
    const qx = (p.x - c[0]) / ax, qy = (p.y - c[1]) / ay, qz = (p.z - c[2]) / az, L = Math.hypot(qx, qy, qz);
    if (L < 1 && L > 1e-6) p.set(c[0] + qx / L * ax, c[1] + qy / L * ay, c[2] + qz / L * az);
  };
  /** tubo de secção elíptica (quadros F); extra = folga adicional fixa; exact = raio da SUPERELIPSE exato na direção
   *  (sem a margem ×1,05 que cobre a secção superelíptica em todas as direções) — para contatos justos de inserção */
  function obTube(F, extra = 0, exact = false) {
    const S = F.S, lo = new Vec(1e9, 1e9, 1e9), hi = new Vec(-1e9, -1e9, -1e9);
    let rmax = 0;
    for (const s of S) { lo.min(s.c); hi.max(s.c); rmax = Math.max(rmax, s.rx, s.ry); }
    const boost = F.exp > 2.05 ? 1.05 : 1;
    return (p, d) => {
      const pad = rmax * boost + d + extra;
      if (p.x < lo.x - pad || p.x > hi.x + pad || p.y < lo.y - pad || p.y > hi.y + pad || p.z < lo.z - pad || p.z > hi.z + pad) return;
      let bi = 0, bd = Infinity;
      for (let i = 0; i < S.length; i += 4) { const c = S[i].c, q = (p.x - c.x) ** 2 + (p.y - c.y) ** 2 + (p.z - c.z) ** 2; if (q < bd) { bd = q; bi = i; } }
      for (let i = Math.max(0, bi - 4), e = Math.min(S.length - 1, bi + 4); i <= e; i++) { const c = S[i].c, q = (p.x - c.x) ** 2 + (p.y - c.y) ** 2 + (p.z - c.z) ** 2; if (q < bd) { bd = q; bi = i; } }
      const s = S[bi], dx = p.x - s.c.x, dy = p.y - s.c.y, dz = p.z - s.c.z;
      const along = dx * s.T.x + dy * s.T.y + dz * s.T.z;
      if ((bi === 0 && along < -0.02) || (bi === S.length - 1 && along > 0.02)) { // além das pontas: tampa arredondada
        const r = Math.min(s.rx, s.ry), L = Math.sqrt(bd), need = r + d + extra;
        if (L < need && L > 1e-6) { const k = need / L; p.set(s.c.x + dx * k, s.c.y + dy * k, s.c.z + dz * k); }
        return;
      }
      const a = dx * s.N.x + dy * s.N.y + dz * s.N.z, b = dx * s.B.x + dy * s.B.y + dz * s.B.z, L = Math.hypot(a, b);
      if (L < 1e-6) return;
      const ca = a / L, sb = b / L, m = F.rfn ? F.rfn(s.t, Math.atan2(sb, ca)) : 1;
      const e = F.exp, rdir = exact && e > 2.05 ? m * Math.pow(Math.abs(ca / s.rx) ** e + Math.abs(sb / s.ry) ** e, -1 / e)
        : m * boost / Math.sqrt((ca / s.rx) ** 2 + (sb / s.ry) ** 2), need = rdir + d + extra;
      if (L >= need) return;
      const k = need / L;
      p.set(s.c.x + s.T.x * along + (s.N.x * a + s.B.x * b) * k, s.c.y + s.T.y * along + (s.N.y * a + s.B.y * b) * k, s.c.z + s.T.z * along + (s.N.z * a + s.B.z * b) * k);
    };
  }
  /** eixo de LM (pts + raio) como tubo circular */
  const lmTube = (pts, r, extra = 0) => obTube(frames(pts, { rx: r, ry: r, step: 0.2 }), extra);
  /** outra lâmina muscular: mantém p do lado indicado por hint(q) (vetor que aponta para o lado "livre") */
  function obSheet(sh, hint) {
    const cell = 1.3, map = new Map(), P = sh.P, H = sh.H;
    const hv = (q) => (typeof hint === 'function' ? v3(hint(q)) : v3(hint));
    // normais orientadas pelo lado desejado (a lâmina pode estar torcida, p.ex. tendão do peitoral maior)
    const N = sh.N.map((n, i) => (n.dot(hv(P[i])) >= 0 ? n.clone() : n.clone().negate()));
    const key = (x, y, z) => ((Math.floor(x / cell) + 300) * 700 + (Math.floor(y / cell) + 300)) * 700 + (Math.floor(z / cell) + 300);
    P.forEach((p, i) => { const k = key(p.x, p.y, p.z); let a = map.get(k); if (!a) map.set(k, (a = [])); a.push(i); });
    const lat = sh.spacing * 1.1, lo = new Vec(1e9, 1e9, 1e9), hi = new Vec(-1e9, -1e9, -1e9);
    let hmax = 0; P.forEach((q, i) => { lo.min(q); hi.max(q); hmax = Math.max(hmax, H[i]); });
    return (p, d) => {
      const pad = hmax + d + 0.1;
      if (p.x < lo.x - pad || p.x > hi.x + pad || p.y < lo.y - pad || p.y > hi.y + pad || p.z < lo.z - pad || p.z > hi.z + pad) return;
      const cx = Math.floor(p.x / cell), cy = Math.floor(p.y / cell), cz = Math.floor(p.z / cell);
      let bi = -1, bd = Infinity;
      const scan = (ix, iy, iz) => { const a = map.get(((cx + ix + 300) * 700 + (cy + iy + 300)) * 700 + (cz + iz + 300)); if (!a) return;
        for (const i of a) { const q = P[i], dd = (p.x - q.x) ** 2 + (p.y - q.y) ** 2 + (p.z - q.z) ** 2; if (dd < bd) { bd = dd; bi = i; } } };
      scan(0, 0, 0);
      // a amostra da célula central só é garantidamente a mais próxima se estiver mais perto que as paredes da célula
      const fx = p.x / cell - cx, fy = p.y / cell - cy, fz = p.z / cell - cz, wall = cell * Math.min(fx, 1 - fx, fy, 1 - fy, fz, 1 - fz);
      if (bd > wall * wall) for (let ix = -1; ix <= 1; ix++) for (let iy = -1; iy <= 1; iy++) for (let iz = -1; iz <= 1; iz++) if (ix || iy || iz) scan(ix, iy, iz);
      if (bi < 0) return;
      const q = P[bi], n = N[bi], dx = p.x - q.x, dy = p.y - q.y, dz = p.z - q.z;
      const s = dx * n.x + dy * n.y + dz * n.z, l2 = bd - s * s, lt = lat + 0.8 * H[bi]; // borda arredondada da lâmina
      if (l2 > lt * lt) return;
      const need = H[bi] + d;
      if (s < need) { const ds = need - s; p.x += n.x * ds; p.y += n.y * ds; p.z += n.z * ds; }
    };
  }

  /* =====================================================================
     Ossos como quadros (mesmas secções do esqueleto)
     ===================================================================== */
  const K = LM.clavicle;
  const clavF = frames(K.pts, { up: [0, 1, 0], rx: K.ry, ry: K.rh, exp: 2.15, step: 0.12,
    radial_fn: (t, a) => { const inf = Math.max(0, -Math.cos(a)); return 1 - 0.13 * inf * inf * sm(0.22, 0.38, t) * sm(0.72, 0.56, t); } });
  const chestUp = (t, p, T) => { const o = new Vec(p.x, 0, p.z - ZC).normalize(); const n = new Vec().crossVectors(T, o); if (n.y < 0) n.negate(); return n; };
  const ribs = LM.ribs.map((R) => {
    const body = R.flat
      ? frames(R.pts, { up: (t, p) => new Vec(p.x - 3.9, 0, p.z + 3.9).normalize(), rx: [[0, 0.5], [0.12, 0.42], [0.3, 0.62], [0.55, R.t / 2], [0.85, R.t / 2 * 0.95], [1, 0.62]], ry: [[0, 0.42], [0.12, 0.3], [0.3, R.h / 2], [1, R.h / 2 * 1.15]], exp: 2.3, step: 0.18 })
      : frames(R.pts, { up: chestUp, rx: [[0, 0.46], [0.06, 0.34], [0.12, 0.5], [0.25, R.h / 2], [0.9, R.h / 2], [1, R.h / 2 * 0.98]], ry: [[0, 0.44], [0.06, 0.3], [0.12, 0.42], [0.25, R.t / 2], [0.9, R.t / 2 * 1.05], [1, R.t / 2 * 1.25]], exp: 2.25, step: 0.2 });
    let cart = null;
    if (R.cartilage) {
      const end = R.i >= 8 ? 0.22 : R.i === 1 ? 0.55 : 0.36;
      cart = frames(R.cartilage, { up: chestUp, rx: R.i === 1 ? [0.55, 0.6] : [R.h / 2 * 0.95, Math.max(end, 0.3)], ry: R.i === 1 ? [0.4, 0.42] : [R.t / 2 * 1.2, end * 0.75], step: 0.15 });
    }
    // amostras unificadas (corpo + cartilagem) com eixo vertical (up/hv) e externo (out/ho)
    const U = [];
    const pushS = (F, flat, skipFirst) => F.S.forEach((s, i) => {
      if (skipFirst && i === 0) return;
      let up, hv, out, ho;
      if (flat) { up = s.B.clone(); if (up.y < 0) up.negate(); hv = s.ry; out = s.N.clone(); ho = s.rx; }
      else { up = s.N.clone(); hv = s.rx; out = s.B.clone(); ho = s.ry; }
      const rad = new Vec(s.c.x, 0, s.c.z - ZC); if (out.dot(rad) < 0) out.negate();
      U.push({ c: s.c, up, hv, out, ho, th: Math.atan2(s.c.x, s.c.z - ZC), ant: F !== body || s.t >= 0.3 });
    });
    pushS(body, !!R.flat, false);
    if (cart) pushS(cart, false, true);
    return { R, body, cart, U };
  });
  const Sc = LM.scapula, Hm = LM.humerus;
  const acromF = frames([Sc.acromion.base, Sc.acromion.mid, Sc.acromion.tip], { up: [0, 1, 0], rx: [0.42, 0.36, 0.3], ry: [0.85, 1.25, 0.95], exp: 2.4, step: 0.1 });
  const coracF = frames([Sc.coracoid.base, [13.5, -0.35, -4.0], Sc.coracoid.knee, [13.25, -0.3, -1.5], Sc.coracoid.tip], { rx: [0.72, 0.6, 0.5, 0.45, 0.42], ry: [0.72, 0.6, 0.5, 0.45, 0.42], step: 0.1 });
  const spineF = frames(LM.scapulaGeom().spinePts, { up: [0, 0.6, -0.8], rx: [0.42, 0.75, 0.85, 0.7, 0.55], ry: [0.25, 0.32, 0.36, 0.4, 0.45], step: 0.15 });
  const humF = frames([[17.0, -2.6, -3.7], Hm.surgicalNeck, [17.6, -9.0, -3.7], Hm.shaftEnd], { rx: [1.75, 1.3, 1.12, 1.05], ry: [1.75, 1.3, 1.12, 1.05], step: 0.2 });
  const obClav = obTube(clavF), obAcrom = obTube(acromF), obCorac = obTube(coracF), obSpine = obTube(spineF), obHum = obTube(humF);
  const obClavX = obTube(clavF, 0, true); // secção superelíptica exata (contatos justos de inserção)
  const obClavEnd = obEllipsoid([2.75, 0.62, -0.4], [0.62, 1.0, 0.92]);
  const obConoid = obEllipsoid(K.conoidTubercle, [0.45, 0.3, 0.4]);
  const obHead = obSphere(Hm.headCenter, Hm.headR * 1.02);
  const obHeadCuff = obSphere(Hm.headCenter, Hm.headR * 1.02 + 0.45), obGTCuff = obEllipsoid(Hm.greaterTubercle, [1.15 + 0.3, 1.5 + 0.3, 1.35 + 0.3]);
  const obGT = obEllipsoid(Hm.greaterTubercle, [1.15, 1.5, 1.35]);
  const obLT = obEllipsoid(Hm.lesserTubercle, [0.75, 1.0, 0.75]);
  const obRib = ribs.map((r) => obTube(r.body));
  const obCart = ribs.map((r) => (r.cart ? obTube(r.cart) : () => {}));
  const obScapSup = obSphere(LM.scapulaGeom().superiorAngle, 0.9);

  /* =====================================================================
     Escápula: superfície média compartilhada com o esqueleto (LM.scapulaGeom), normal POSTERIOR, meia-espessura.
     Serve de leito ao manguito rotador e de obstáculo (face posterior / face costal).
     ===================================================================== */
  const scap = (() => {
    // superfície média compartilhada com o esqueleto (LM.scapulaGeom: Coons + afastamento do gradil costal)
    const SG = LM.scapulaGeom();
    const c01 = (x) => clamp(x, 0, 1);
    const mid = (u, v) => SG.midV(c01(u), c01(v));
    const thF = SG.th;
    const n = 40, W = n + 1, P = [], N = [], H = [];
    let vote = 0;
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) { P.push(mid(i / n, j / n)); H.push(thF(i / n, j / n) / 2); }
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const du = P[j * W + Math.min(n, i + 1)].clone().sub(P[j * W + Math.max(0, i - 1)]), dv = P[Math.min(n, j + 1) * W + i].clone().sub(P[Math.max(0, j - 1) * W + i]);
      const nn = new Vec().crossVectors(du, dv).normalize(), p = P[j * W + i];
      vote += nn.dot(new Vec(p.x * 0.3, 0, p.z + 6)) >= 0 ? 1 : -1;
      N.push(nn);
    }
    if (vote < 0) N.forEach((q) => q.negate());
    let sp = 0, cnt = 0;
    for (let k = 0; k < P.length - W - 1; k += 7) { sp += P[k].distanceTo(P[k + 1]) + P[k].distanceTo(P[k + W]); cnt += 2; }
    const S = { P, N, H, spacing: sp / cnt };
    /** ponto da face posterior em (u,v) com afastamento off ao longo da normal */
    const post = (u, v, off = 0) => {
      const fi = c01(u) * n, fj = c01(v) * n, i = Math.min(n - 1, Math.floor(fi)), j = Math.min(n - 1, Math.floor(fj)), a = fi - i, b = fj - j, out = new Vec();
      [[0, 0, (1 - a) * (1 - b)], [1, 0, a * (1 - b)], [0, 1, (1 - a) * b], [1, 1, a * b]].forEach(([di, dj, w]) => { const k = (j + dj) * W + i + di; out.addScaledVector(P[k].clone().addScaledVector(N[k], H[k] + off), w); });
      return arr(out);
    };
    // espaçamentos médios em u e v (cm por amostra) — para a distância até a margem do osso
    let su = 0, sv = 0;
    for (let j = 0; j < n; j += 4) for (let i = 0; i < n; i += 4) { const k = j * W + i; su += P[k].distanceTo(P[k + 1]); sv += P[k].distanceTo(P[k + W]); }
    su /= (Math.ceil(n / 4) ** 2); sv /= (Math.ceil(n / 4) ** 2);
    // grade espacial para a amostra mais próxima
    const cell = 1.5, hash = new Map(), hk = (a, b, c) => ((a + 300) * 700 + (b + 300)) * 700 + (c + 300);
    P.forEach((q, k) => { const key = hk(Math.floor(q.x / cell), Math.floor(q.y / cell), Math.floor(q.z / cell)); let a = hash.get(key); if (!a) hash.set(key, (a = [])); a.push(k); });
    /** amostra mais próxima: (u,v), distância, s (com sinal, ao longo da normal posterior), afastamento lateral e
     *  distância (cm) até a margem da lâmina; null se nada a ≤ ~1–2 cm */
    const near = (p) => {
      const cx = Math.floor(p.x / cell), cy = Math.floor(p.y / cell), cz = Math.floor(p.z / cell);
      let bk = -1, bd = Infinity;
      const scan = (ix, iy, iz) => { const a = hash.get(hk(cx + ix, cy + iy, cz + iz)); if (!a) return;
        for (const k of a) { const q = P[k], d = (p.x - q.x) ** 2 + (p.y - q.y) ** 2 + (p.z - q.z) ** 2; if (d < bd) { bd = d; bk = k; } } };
      scan(0, 0, 0);
      const fx = p.x / cell - cx, fy = p.y / cell - cy, fz = p.z / cell - cz, wl = cell * Math.min(fx, 1 - fx, fy, 1 - fy, fz, 1 - fz);
      if (bd > wl * wl) for (let ix = -1; ix <= 1; ix++) for (let iy = -1; iy <= 1; iy++) for (let iz = -1; iz <= 1; iz++) if (ix || iy || iz) scan(ix, iy, iz);
      if (bk < 0) return null;
      const q = P[bk], s = (p.x - q.x) * N[bk].x + (p.y - q.y) * N[bk].y + (p.z - q.z) * N[bk].z, i = bk % W, j = Math.floor(bk / W);
      return { k: bk, u: i / n, v: j / n, d: Math.sqrt(bd), s, lat: Math.sqrt(Math.max(0, bd - s * s)), edge: Math.min(Math.min(i, n - i) * su, Math.min(j, n - j) * sv) };
    };
    /** o ponto está "sob" a lâmina escapular (projeção ao longo da normal cai dentro do contorno)? */
    const under = (p, band = 3, margin = 0) => { const r = near(p); return !!r && r.lat < Math.max(su, sv) * 1.2 && r.edge > margin && Math.abs(r.s) < band; };
    /** obstáculo da face costal com entrada gradual sob a margem (o degrau fica DENTRO do osso, invisível) */
    const obAntSoft = (p, d) => {
      const r = near(p); if (!r || r.lat > Math.max(su, sv) * 1.2 || r.s > 2.5) return;
      const need = H[r.k] + d, sa = -r.s; // distância para o lado costal
      if (sa >= need) return;
      const w = sm(0.05, 0.7, r.edge), nk = N[r.k], dd = (need - sa) * w;
      p.x -= nk.x * dd; p.y -= nk.y * dd; p.z -= nk.z * dd;
    };
    const nearBF = (p) => { // busca exaustiva (poucas chamadas)
      let bk = 0, bd = Infinity;
      for (let k = 0; k < P.length; k++) { const q = P[k], d = (p.x - q.x) ** 2 + (p.y - q.y) ** 2 + (p.z - q.z) ** 2; if (d < bd) { bd = d; bk = k; } }
      return { u: (bk % W) / n, v: Math.floor(bk / W) / n, d: Math.sqrt(bd) };
    };
    // linha da espinha sobre a face posterior: v(u) por amostragem do eixo da espinha
    const spUV = [];
    spineF.S.forEach((s, i) => { if (i % 3) return; const r = nearBF(s.c); if (r.d < 2.8 && r.u < 0.97) spUV.push([r.u, r.v]); });
    spUV.sort((a, b) => a[0] - b[0]);
    const vSpine = (u) => {
      if (spUV.length < 2) return 0.77 + 0.2 * u;
      if (u <= spUV[0][0]) return spUV[0][1];
      for (let k = 1; k < spUV.length; k++) if (u <= spUV[k][0]) { const a = spUV[k - 1], b = spUV[k]; return lerp(a[1], b[1], (u - a[0]) / Math.max(1e-6, b[0] - a[0])); }
      return spUV[spUV.length - 1][1];
    };
    const outHint = (q) => [q.x * 0.3, 0, q.z + 6];
    return {
      S, post, near, under, vSpine, outHint,
      obPost: obSheet(S, outHint),                                   // mantém o ponto POSTERIOR à lâmina
      obAnt: obAntSoft,                                              // mantém o ponto ANTERIOR (face costal)
    };
  })();
  // vasos de LM (as lâminas devem passar à frente/ao redor)
  const VS = LM.vessels;
  const obAxV = lmTube(VS.axillaryV.pts, 0.66, 0.05), obScv = lmTube(VS.scv.pts, 0.7, 0.05), obAxA = lmTube(VS.axillaryA.pts, 0.42, 0.05);
  // cefálica: eixo REAL do módulo de vasos (LM v2 se ausente)
  const obCeph = solidTube('cephalic-v-R', VS.cephalicR.pts, VS.cephalicR.r, 0.06), obIJV = lmTube(VS.ijvR.pts, 0.82, 0.04), obCCA = lmTube(VS.ccaR.pts, 0.46, 0.04);
  const obEJV = lmTube(VS.ejvR.pts, 0.28, 0.05);
  // cefálica no sulco deltopeitoral: as BORDAS das lâminas apenas a margeiam (folga fixa, não a meia-espessura inteira)
  const obCephEdge = (p, d) => obCeph(p, Math.min(d, 0.1));
  // borda anterior do deltoide (espessa, ≥ 0,6 cm): afasta-se mais, para a veia ficar NO sulco e não sob o músculo
  const obCephDelt = (p, d) => obCeph(p, Math.min(d, 0.32));
  /* Parede LATERAL do sulco deltopeitoral (só para o deltoide): ao longo do eixo REAL da cefálica (sólido do módulo de
     vasos; LM se ausente), no trecho em que ela corre no sulco (y −8,8 … −0,6), nenhum ponto do deltoide à altura da veia
     ou à frente dela pode ficar medial a (eixo + r + 0,08 + meia-espessura): a borda anterior do músculo termina
     LATERAL à veia, que fica visível no sulco entre deltoide e peitoral maior (antes a borda a cobria entre y −6,3 e −2). */
  const obCephGroove = (() => {
    const sc = (ATLAS.solids || []).find((q) => q.id === 'cephalic-v-R');
    const P0 = sc ? sc.pts : C.sample(VS.cephalicR.pts, 40), rF = sc ? sc.r : C.profile(VS.cephalicR.r);
    // trecho ascendente (do braço até o ponto mais alto, antes de mergulhar para a veia axilar), amostrado por y
    let top = 0; P0.forEach((q, i) => { if (q[1] > P0[top][1]) top = i; });
    const A = P0.slice(0, top + 1).map((q, i) => ({ x: q[0], y: q[1], z: q[2], r: rF(i / (P0.length - 1)) })).sort((a, b) => a.y - b.y);
    const at = (y) => { for (let k = 1; k < A.length; k++) if (y <= A[k].y) { const a = A[k - 1], b = A[k], w = (y - a.y) / Math.max(1e-6, b.y - a.y); return { x: lerp(a.x, b.x, w), z: lerp(a.z, b.z, w), r: lerp(a.r, b.r, w), tx: b.x - a.x, ty: b.y - a.y }; } return null; };
    return (p, d) => {
      if (p.y < -8.8 || p.y > -0.6) return;
      const a = at(p.y); if (!a || p.z < a.z - 1.6) return;
      // distância perpendicular à veia no plano frontal = afastamento horizontal × cos(inclinação do sulco)
      const nx = Math.abs(a.ty) / (Math.hypot(a.tx, a.ty) || 1), s = (p.x - a.x) * nx;
      const need = a.r + 0.08 + d, w = sm(-8.8, -7.6, p.y) * (1 - sm(-1.5, -0.6, p.y));
      if (s < need) p.x += (need - s) / Math.max(0.5, nx) * w; // desloca só em x (lateral)
    };
  })();

  /* =====================================================================
     Parede costal: raster polar (θ, y) → raio externo ρ (envoltório das costelas + cartilagens + esterno)
     ===================================================================== */
  const W_TH0 = -0.25, W_DTH = 0.015, W_NTH = 186, W_Y0 = -28, W_DY = 0.1, W_NY = 340;
  let wallA = new Float32Array(W_NTH * W_NY).fill(-1);
  {
    const splat = (x, y, z) => {
      const dz = z - ZC, i = Math.round((Math.atan2(x, dz) - W_TH0) / W_DTH), j = Math.round((y - W_Y0) / W_DY);
      if (i < 0 || i >= W_NTH || j < 0 || j >= W_NY) return;
      const k = j * W_NTH + i, r = Math.hypot(x, dz); if (r > wallA[k]) wallA[k] = r;
    };
    const splatF = (F) => F.S.forEach((s) => { for (let a = 0; a < 16; a++) { const ang = a / 16 * Math.PI * 2, ca = se(Math.cos(ang), F.exp), sa = se(Math.sin(ang), F.exp);
      splat(s.c.x + s.N.x * s.rx * ca + s.B.x * s.ry * sa, s.c.y + s.N.y * s.rx * ca + s.B.y * s.ry * sa, s.c.z + s.N.z * s.rx * ca + s.B.z * s.ry * sa); } });
    ribs.forEach((r) => { splatF(r.body); if (r.cart) splatF(r.cart); });
    const S = LM.sternum;
    for (let y = 0.05; y >= S.xiphoidTipY; y -= 0.08) { const hw = S.halfWidth(y); for (let x = 0; x <= hw; x += 0.1) splat(x, y, S.zAnt(y) - 0.035 * x * x); }
    // preenchimento vertical entre costelas (interpolação linear por coluna θ)
    for (let i = 0; i < W_NTH; i++) {
      let last = -1;
      for (let j = 0; j < W_NY; j++) {
        const v = wallA[j * W_NTH + i]; if (v < 0) continue;
        if (last >= 0 && j - last > 1) { const a = wallA[last * W_NTH + i]; for (let q = last + 1; q < j; q++) wallA[q * W_NTH + i] = lerp(a, v, (q - last) / (j - last)); }
        last = j;
      }
    }
    // envoltório: máximo local em y (±0,3 cm) e suavização leve
    const B = new Float32Array(wallA.length).fill(-1);
    for (let j = 0; j < W_NY; j++) for (let i = 0; i < W_NTH; i++) {
      let m = -1; for (let q = Math.max(0, j - 3); q <= Math.min(W_NY - 1, j + 3); q++) m = Math.max(m, wallA[q * W_NTH + i]);
      if (wallA[j * W_NTH + i] > 0) B[j * W_NTH + i] = m;
    }
    const D = new Float32Array(wallA.length).fill(-1), kw = [1, 2, 3, 2, 1];
    for (let j = 0; j < W_NY; j++) for (let i = 0; i < W_NTH; i++) {
      if (B[j * W_NTH + i] < 0) continue; let s = 0, w = 0;
      for (let dj = -2; dj <= 2; dj++) for (let di = -1; di <= 1; di++) { const jj = j + dj, ii = i + di; if (jj < 0 || jj >= W_NY || ii < 0 || ii >= W_NTH) continue; const v = B[jj * W_NTH + ii]; if (v < 0) continue; const ww = kw[dj + 2] * (di ? 1 : 2); s += v * ww; w += ww; }
      D[j * W_NTH + i] = s / w;
    }
    wallA = D;
  }
  function wallR(th, y) {
    const fi = (th - W_TH0) / W_DTH, fj = (y - W_Y0) / W_DY, i0 = Math.floor(fi), j0 = Math.floor(fj);
    if (i0 < 0 || j0 < 0 || i0 >= W_NTH - 1 || j0 >= W_NY - 1) return -1;
    const wi = fi - i0, wj = fj - j0;
    let s = 0, ws = 0;
    const acc = (i, j, w) => { const v = wallA[j * W_NTH + i]; if (v > 0) { s += v * w; ws += w; } };
    acc(i0, j0, (1 - wi) * (1 - wj)); acc(i0 + 1, j0, wi * (1 - wj)); acc(i0, j0 + 1, (1 - wi) * wj); acc(i0 + 1, j0 + 1, wi * wj);
    return ws > 1e-3 ? s / ws : -1;
  }
  const obWall = (p, d) => {
    const dz = p.z - ZC, r = Math.hypot(p.x, dz); if (r < 1e-3) return;
    const w = wallR(Math.atan2(p.x, dz), p.y);
    if (w > 0 && r < w + d) { const s = (w + d) / r; p.x *= s; p.z = ZC + dz * s; }
  };
  /** ponto da parede costal com coordenada x dada (na altura y), afastado h para fora; null se não houver parede */
  function wallPt(x, y, h = 0) {
    let lo = -0.2, hi = 1.65, ok = false;
    const X = (th) => { const r = wallR(th, y); return r > 0 ? r * Math.sin(th) : NaN; };
    if (!(X(hi) >= x)) { // procura limite superior válido
      for (let th = 1.65; th > 0; th -= 0.05) { const xx = X(th); if (xx >= x) { hi = th; ok = true; break; } }
      if (!ok) return null;
    }
    for (let it = 0; it < 30; it++) { const mid = (lo + hi) / 2, xx = X(mid); if (isNaN(xx) || xx < x) lo = mid; else hi = mid; }
    const th = (lo + hi) / 2, r = wallR(th, y); if (r < 0) return null;
    return [(r + h) * Math.sin(th), y, ZC + (r + h) * Math.cos(th)];
  }

  /* =====================================================================
     Lâminas (superfície média em grade + espessura)
     ===================================================================== */
  /** superfície por pontos de controle rows[r][f] (r: origem→inserção ao longo de v; f: fibras ao longo de u) */
  function ctrlPatch(rows) {
    const nf = rows[0].length;
    const fibers = [];
    for (let f = 0; f < nf; f++) fibers.push(new THREE.CatmullRomCurve3(rows.map((r) => v3(r[f])), false, 'centripetal'));
    const cache = new Map();
    return (u, v) => {
      let cr = cache.get(v);
      if (!cr) { cr = new THREE.CatmullRomCurve3(fibers.map((c) => c.getPoint(v)), false, 'centripetal'); cache.set(v, cr); }
      return arr(cr.getPoint(u));
    };
  }
  function relax(P, nu, nv, lam, pin) {
    const W = nu + 1, Q = P.map((p) => p.clone()), acc = new Vec();
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      if (pin && pin(i, j)) continue;
      const k = j * W + i, eu = i === 0 || i === nu, ev = j === 0 || j === nv;
      if (eu && ev) continue;
      acc.set(0, 0, 0); let n = 0;
      if (eu) { acc.add(Q[k - W]).add(Q[k + W]); n = 2; }
      else if (ev) { acc.add(Q[k - 1]).add(Q[k + 1]); n = 2; }
      else { acc.add(Q[k - 1]).add(Q[k + 1]).add(Q[k - W]).add(Q[k + W]); n = 4; }
      P[k].lerp(acc.multiplyScalar(1 / n), lam);
    }
  }
  function gridNormals(P, nu, nv) {
    const W = nu + 1, out = [];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const du = P[j * W + Math.min(nu, i + 1)].clone().sub(P[j * W + Math.max(0, i - 1)]);
      const dv = P[Math.min(nv, j + 1) * W + i].clone().sub(P[Math.max(0, j - 1) * W + i]);
      out.push(new Vec().crossVectors(du, dv).normalize());
    }
    return out;
  }
  /**
   * o: { nu, nv, f(u,v), th(u,v), out(p)→[x,y,z] (sentido externo), obst[], gap, iters, lam, pin(i,j),
   *      col, tendon(u,v)→0..1, uvW (cm de largura p/ textura), tile (cm), seed, darkBottom }
   */
  function sheet(o) {
    const nu = o.nu, nv = o.nv, W = nu + 1, NV = W * (nv + 1);
    const P = new Array(NV), TH = new Float32Array(NV);
    const grooveFn = o.bundles ? (u, v) => Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * (u * o.bundles + 0.22 * Math.sin(u * 9.1 + v * 2.3) + 0.12 * Math.sin(u * 23.7 - v * 4.1))), 3) * sm(0.03, 0.15, v) * (1 - sm(0.8, 0.9, v)) : null;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const k = j * W + i; P[k] = v3(o.f(i / nu, j / nv)); TH[k] = o.th(i / nu, j / nv) * (grooveFn ? 1 - (o.grooveAmp ?? 0.12) * grooveFn(i / nu, j / nv) : 1); }
    o.grooveFn = grooveFn;
    const gap = o.gap ?? 0.06, obst = o.obst || [];
    const fixed = new Uint8Array(NV); if (o.pin) for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) fixed[j * W + i] = o.pin(i, j) ? 1 : 0;
    const hard = () => { for (let k = 0; k < NV; k++) if (!fixed[k]) for (const ob of obst) ob(P[k], TH[k] / 2 + gap); };
    // projeção "macia": desloca, suaviza o campo de deslocamento na grade e reaplica (evita dentes/dobras locais)
    const D = P.map(() => new Vec()), E = P.map(() => new Vec());
    const soft = (passes) => {
      const Q = P.map((p) => p.clone()); hard();
      for (let k = 0; k < NV; k++) D[k].subVectors(P[k], Q[k]);
      for (let ps = 0; ps < passes; ps++) {
        for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
          const k = j * W + i; let n = 1; E[k].copy(D[k]).multiplyScalar(2);
          if (i > 0) { E[k].add(D[k - 1]); n++; } if (i < nu) { E[k].add(D[k + 1]); n++; } if (j > 0) { E[k].add(D[k - W]); n++; } if (j < nv) { E[k].add(D[k + W]); n++; }
          E[k].multiplyScalar(1 / (n + 1));
        }
        // dilatação do campo: por vértice fica o VETOR de maior norma (invariante à rotação — não cria
        // deslocamentos que nenhum obstáculo produziu, como fazia o máximo componente a componente)
        for (let k = 0; k < NV; k++) if (E[k].lengthSq() > D[k].lengthSq()) D[k].copy(E[k]);
      }
      for (let k = 0; k < NV; k++) if (!fixed[k]) P[k].copy(Q[k]).add(D[k]);
    };
    if (obst.length) {
      soft(o.softPasses ?? 4);
      for (let it = 0; it < (o.iters ?? 3); it++) { relax(P, nu, nv, o.lam ?? 0.5, o.pin); soft(o.softPasses ?? 4); }
      hard();
    } else for (let it = 0; it < (o.iters ?? 0); it++) relax(P, nu, nv, o.lam ?? 0.5, o.pin);
    // obstáculos aplicados só no fim, sem espalhamento (p.ex. serrátil sob a escápula: o degrau fica oculto pelo osso)
    if (o.obstFinal) for (let k = 0; k < NV; k++) if (!fixed[k]) for (const ob of o.obstFinal) ob(P[k], TH[k] / 2 + gap);
    // ajuste de espessura pós-assentamento por máscara suavizada na grade: mask(p) → 0..1 ⇒ TH → lerp(TH, thMask, m)
    if (o.mask) {
      let M = new Float32Array(NV);
      for (let k = 0; k < NV; k++) M[k] = o.mask(P[k]) ? 1 : 0;
      for (let ps = 0; ps < (o.maskSmooth ?? 2); ps++) {
        const Q = new Float32Array(NV);
        for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { let s = 0, w = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii > nu || jj > nv) continue; s += M[jj * W + ii]; w++; } Q[j * W + i] = s / w; }
        M = Q;
      }
      for (let k = 0; k < NV; k++) TH[k] = lerp(TH[k], Math.min(TH[k], o.thMask ?? 0.08), clamp(M[k] * 1.5, 0, 1));
    }
    const Nn = gridNormals(P, nu, nv);
    // suaviza o campo de normais (evita dobras das faces deslocadas sobre pequenas quinas da superfície média)
    for (let ps = 0; ps < (o.nSmooth ?? 2); ps++) {
      const Q = Nn.map((n) => n.clone());
      for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
        const k = j * W + i, a = Nn[k].clone().multiplyScalar(2);
        if (i > 0) a.add(Q[k - 1]); if (i < nu) a.add(Q[k + 1]); if (j > 0) a.add(Q[k - W]); if (j < nv) a.add(Q[k + W]);
        if (a.lengthSq() > 1e-8) Nn[k].copy(a.normalize());
      }
    }
    let vote = 0;
    for (let k = 0; k < NV; k += 3) vote += Nn[k].dot(v3(o.out(P[k]))) >= 0 ? 1 : -1;
    const flip = vote < 0;
    if (flip) Nn.forEach((n) => n.negate());
    // espaçamento médio (para obSheet)
    let sp = 0, cnt = 0;
    for (let k = 0; k < NV - W - 1; k += 5) { sp += P[k].distanceTo(P[k + 1]) + P[k].distanceTo(P[k + W]); cnt += 2; }
    const sh = { P, N: Nn, H: Array.from(TH, (t) => t / 2), nu, nv, spacing: sp / cnt };
    sh.geo = buildSlab(sh, flip, o);
    /** ponto em (u,v) na face s (+1 externa, −1 interna, 0 média) */
    sh.at = (u, v, s = 1, extra = 0) => {
      const fi = clamp(u, 0, 1) * nu, fj = clamp(v, 0, 1) * nv, i = Math.min(nu - 1, Math.floor(fi)), j = Math.min(nv - 1, Math.floor(fj)), a = fi - i, b = fj - j;
      const out = new Vec(), Hh = sh.H;
      [[0, 0, (1 - a) * (1 - b)], [1, 0, a * (1 - b)], [0, 1, (1 - a) * b], [1, 1, a * b]].forEach(([di, dj, w]) => { const k = (j + dj) * W + i + di; out.addScaledVector(P[k].clone().addScaledVector(Nn[k], s * Hh[k] + extra), w); });
      return arr(out).map((x) => +x.toFixed(2));
    };
    return sh;
  }
  function buildSlab(sh, flip, o) {
    const { P, N: Nn, nu, nv } = sh, W = nu + 1, NV = W * (nv + 1);
    const pos = new Float32Array(NV * 6), uv = new Float32Array(NV * 4), col = new Float32Array(NV * 6);
    const tile = o.tile || 6, uvW = o.uvW || 10;
    const arc = new Float32Array(NV);
    for (let i = 0; i <= nu; i++) for (let j = 1; j <= nv; j++) arc[j * W + i] = arc[(j - 1) * W + i] + P[j * W + i].distanceTo(P[(j - 1) * W + i]);
    // anti-dobra: onde a face deslocada (externa/interna) inverteria em relação à superfície média (curvatura local
    // menor que a meia-espessura), reduz a espessura localmente e recalcula
    const H = sh.H, H0 = H.slice(), hMin = o.hMin ?? 0.06;
    const Tp = P.map((p) => p.clone()), Bp = P.map((p) => p.clone()); // faces superficial (Tp) e profunda (Bp)
    const write = () => { for (let k = 0; k < NV; k++) { pos[k * 3] = Tp[k].x; pos[k * 3 + 1] = Tp[k].y; pos[k * 3 + 2] = Tp[k].z; pos[(NV + k) * 3] = Bp[k].x; pos[(NV + k) * 3 + 1] = Bp[k].y; pos[(NV + k) * 3 + 2] = Bp[k].z; } };
    const place = () => { for (let k = 0; k < NV; k++) { Tp[k].copy(P[k]).addScaledVector(Nn[k], H[k]); Bp[k].copy(P[k]).addScaledVector(Nn[k], -H[k]); } write(); };
    place();
    const ta = new Vec(), tb = new Vec(), tc = new Vec(), fnv = new Vec(), mn = new Vec();
    const bad = (o0, a, b, c) => { ta.fromArray(pos, (o0 + a) * 3); tb.fromArray(pos, (o0 + b) * 3).sub(ta); tc.fromArray(pos, (o0 + c) * 3).sub(ta); fnv.crossVectors(tb, tc);
      mn.copy(Nn[a]).add(Nn[b]).add(Nn[c]); return fnv.dot(mn) * (flip ? -1 : 1) < 0; }; // camadas paralelas: mesma orientação geométrica (a,b,c)
    for (let it = 0; it < 8; it++) {
      const shrink = new Float32Array(NV); let any = false;
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
        const a = j * W + i, b = a + 1, c = a + W, d = a + W + 1;
        for (const o0 of [0, NV]) if (bad(o0, a, b, c) || bad(o0, b, d, c)) { shrink[a] = shrink[b] = shrink[c] = shrink[d] = 1; any = true; }
      }
      if (!any) break;
      // fator de redução suavizado na vizinhança (sem degraus) e com piso de espessura
      for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
        let s = 0, w = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii > nu || jj > nv) continue; const ww = di || dj ? 1 : 2; s += shrink[jj * W + ii] * ww; w += ww; }
        const k = j * W + i, f = s / w;
        if (f > 0) H[k] = Math.max(H[k] * (1 - 0.3 * Math.min(1, f * 1.6)), Math.min(H0[k], hMin));
      }
      place();
    }
    // face superficial suavizada (Laplaciano, bordas fixas): o relevo do leito (costelas, peitoral menor, fáscia)
    // fica na face profunda; a face superficial permanece convexa, sem "rugas", com espessura entre topMin e topMax
    if (o.smoothTop) {
      const Q = Tp.map((p) => p.clone()), lo = o.topMin ?? 0.72, hi = o.topMax ?? 1.45, tmp = new Vec();
      for (let ps = 0; ps < o.smoothTop; ps++) {
        for (let j = 1; j < nv; j++) for (let i = 1; i < nu; i++) { const k = j * W + i; Q[k].copy(Tp[k]).multiplyScalar(0.5).addScaledVector(Tp[k - 1], 0.125).addScaledVector(Tp[k + 1], 0.125).addScaledVector(Tp[k - W], 0.125).addScaledVector(Tp[k + W], 0.125); }
        for (let j = 1; j < nv; j++) for (let i = 1; i < nu; i++) {
          const k = j * W + i, n = Nn[k], t0 = 2 * H[k], d = tmp.subVectors(Q[k], Bp[k]).dot(n);
          if (d < t0 * lo) Q[k].addScaledVector(n, t0 * lo - d); else if (d > t0 * hi + 0.08) Q[k].addScaledVector(n, t0 * hi + 0.08 - d);
          Tp[k].copy(Q[k]);
        }
      }
      // superfície média e meia-espessura coerentes com as faces finais (usadas por obSheet e sh.at)
      for (let k = 0; k < NV; k++) { const d = tmp.subVectors(Tp[k], Bp[k]).dot(Nn[k]); H[k] = Math.max(0.01, d / 2); P[k].copy(Tp[k]).add(Bp[k]).multiplyScalar(0.5); }
      write();
    }
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const k = j * W + i, p = P[k], u = i / nu, v = j / nv;
      const U = o.uvFn ? o.uvFn(u, v, arc[k]) : [u * uvW / (o.tileU || 3.4), arc[k] / (o.tileV || 12)];
      uv.set(U, k * 2); uv.set(U, (NV + k) * 2);
      // tendon(u, v, w, p) → k ou [k, junção]; w = largura (em v) de uma rampa de RW cm nesta coluna de fibras; p = ponto final
      const tv = o.tendon ? o.tendon(u, v, RW / Math.max(1, arc[nv * W + i]), p) : 0;
      const kt = clamp(Array.isArray(tv) ? tv[0] : tv, 0, 1), jt = Array.isArray(tv) ? tv[1] : 0;
      const c = musRGB(o.colFn ? o.colFn(u, v) : (o.col || COL.mus), kt, p.x, p.y, p.z, o.seed || 0, jt);
      if (o.grooveFn) { const gq = 1 - 0.22 * o.grooveFn(u, v) * (1 - kt); c[0] *= gq; c[1] *= gq; c[2] *= gq; }
      col.set(c, k * 3);
      const db = o.darkBottom ?? 0.82; col.set([c[0] * db, c[1] * db, c[2] * db], (NV + k) * 3);
    }
    const idx = [];
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const q = j * W + i, a = q, b = q + 1, c = q + W, d = q + W + 1;
      if (!flip) { idx.push(a, b, c, b, d, c); idx.push(NV + a, NV + c, NV + b, NV + b, NV + c, NV + d); }
      else { idx.push(a, c, b, b, c, d); idx.push(NV + a, NV + b, NV + c, NV + b, NV + d, NV + c); }
    }
    const V = (k) => new Vec(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
    const side = (ka, kb, hint) => { // quad entre topo(ka,kb) e base(ka,kb)
      const ta = V(ka), tb = V(kb), bb = V(NV + kb), n = tb.clone().sub(ta).cross(bb.clone().sub(ta));
      if (n.dot(hint) >= 0) idx.push(ka, kb, NV + kb, ka, NV + kb, NV + ka); else idx.push(ka, NV + kb, kb, ka, NV + ka, NV + kb);
    };
    for (let i = 0; i < nu; i++) {
      side(i, i + 1, P[i].clone().sub(P[i + W]));
      const t = nv * W + i; side(t, t + 1, P[t].clone().sub(P[t - W]));
    }
    for (let j = 0; j < nv; j++) {
      const a = j * W, b = (j + 1) * W; side(a, b, P[a].clone().sub(P[a + 1]));
      const c = j * W + nu, d = (j + 1) * W + nu; side(c, d, P[c].clone().sub(P[c - 1]));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    g.userData.NV = NV;
    return g;
  }
  /** deforma posições (fn(Vector3) in place) e recalcula normais soldando vértices coincidentes (costura da varredura) */
  function deformWeld(g, fn) {
    const p = g.attributes.position, v = new Vec();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); fn(v, i); p.setXYZ(i, v.x, v.y, v.z); }
    p.needsUpdate = true; g.computeVertexNormals();
    const n = g.attributes.normal, map = new Map();
    for (let i = 0; i < p.count; i++) { const k = Math.round(p.getX(i) * 2000) + ',' + Math.round(p.getY(i) * 2000) + ',' + Math.round(p.getZ(i) * 2000); let a = map.get(k); if (!a) map.set(k, (a = [])); a.push(i); }
    for (const a of map.values()) if (a.length > 1) { const s = new Vec(); for (const i of a) s.x += n.getX(i), s.y += n.getY(i), s.z += n.getZ(i); s.normalize(); for (const i of a) n.setXYZ(i, s.x, s.y, s.z); }
    n.needsUpdate = true; return g;
  }
  /**
   * Deformação MACIA de uma varredura contra obstáculos (fn(Vector3) in place): o deslocamento bruto de cada vértice
   * (soldado na costura) é espalhado pela malha (dilatação pelo vetor de maior norma, como em sheet/soft) e as posições
   * deslocadas recebem suavização laplaciana; por fim, só as penetrações residuais (> tol) são corrigidas. Produz sulcos
   * e achatamentos de contato lisos, sem as facetas/dobras de uma projeção vértice a vértice.
   * o: { weight(p0)→0..1, passes, smooth, lam, tol, unfold (voltas de desdobra; só varreduras fechadas) }
   */
  function deformSoft(g, fn, o = {}) {
    const p = g.attributes.position, n = p.count, idx = g.index;
    const map = new Map(), wid = new Int32Array(n); let nw = 0;
    for (let i = 0; i < n; i++) {
      const k = Math.round(p.getX(i) * 2000) + ',' + Math.round(p.getY(i) * 2000) + ',' + Math.round(p.getZ(i) * 2000);
      let w = map.get(k); if (w === undefined) { w = nw++; map.set(k, w); } wid[i] = w;
    }
    const P0 = Array.from({ length: nw }, () => new Vec());
    for (let i = 0; i < n; i++) P0[wid[i]].fromBufferAttribute(p, i);
    const nbS = Array.from({ length: nw }, () => new Set());
    for (let t = 0; t < idx.count; t += 3) {
      const a = wid[idx.getX(t)], b = wid[idx.getX(t + 1)], c = wid[idx.getX(t + 2)];
      nbS[a].add(b).add(c); nbS[b].add(a).add(c); nbS[c].add(a).add(b);
    }
    const NB = nbS.map((s, i) => [...s].filter((j) => j !== i));
    const wf = o.weight || (() => 1);
    const D = P0.map((q) => { const v = q.clone(); fn(v); return v.sub(q).multiplyScalar(wf(q)); });
    for (let ps = 0; ps < (o.passes ?? 3); ps++) {
      const E = D.map((d, i) => { const a = d.clone().multiplyScalar(2); for (const j of NB[i]) a.add(D[j]); return a.multiplyScalar(1 / (2 + NB[i].length)); });
      for (let i = 0; i < nw; i++) if (E[i].lengthSq() > D[i].lengthSq()) D[i].copy(E[i]);
    }
    const P = P0.map((q, i) => q.clone().add(D[i])), moved = D.map((d) => d.lengthSq() > 1e-6);
    const lam = o.lam ?? 0.5;
    for (let it = 0; it < (o.smooth ?? 2); it++) {
      const Q = P.map((q, i) => { if (!moved[i] || !NB[i].length) return q; const a = new Vec(); for (const j of NB[i]) a.add(P[j]); return q.clone().lerp(a.multiplyScalar(1 / NB[i].length), lam); });
      for (let i = 0; i < nw; i++) P[i].copy(Q[i]);
    }
    const tol = o.tol ?? 0.03, tmp = new Vec();
    for (let i = 0; i < nw; i++) { const wi = wf(P0[i]); if (wi <= 0) continue; tmp.copy(P[i]); fn(tmp); if (tmp.distanceToSquared(P[i]) > tol * tol) P[i].lerp(tmp, wi); }
    // desfaz DOBRAS: triângulos cuja orientação se inverteu em relação à malha original (lascas no vinco de contato, onde
    // vértices vizinhos saem do osso por caminhos diferentes) — os vértices envolvidos são relaxados para a média dos
    // vizinhos e reprojetados (o.unfold voltas; só em varreduras fechadas — numa lâmina a borda livre seria puxada para dentro)
    const e1 = new Vec(), e2 = new Vec(), n0 = new Vec(), n1 = new Vec(), avg = new Vec();
    for (let it = 0; it < (o.unfold || 0); it++) {
      const bad = new Set();
      for (let t = 0; t < idx.count; t += 3) {
        const a = wid[idx.getX(t)], b = wid[idx.getX(t + 1)], c = wid[idx.getX(t + 2)]; if (a === b || b === c || a === c) continue;
        n0.crossVectors(e1.subVectors(P0[b], P0[a]), e2.subVectors(P0[c], P0[a])); if (n0.lengthSq() < 1e-12) continue;
        n1.crossVectors(e1.subVectors(P[b], P[a]), e2.subVectors(P[c], P[a]));
        if (n0.dot(n1) < 0) { bad.add(a); bad.add(b); bad.add(c); }
      }
      if (!bad.size) break;
      for (const i of bad) {
        if (!NB[i].length) continue; avg.set(0, 0, 0); for (const j of NB[i]) avg.add(P[j]); P[i].lerp(avg.multiplyScalar(1 / NB[i].length), 0.6);
        const wi = wf(P0[i]); if (wi > 0) { tmp.copy(P[i]); fn(tmp); P[i].lerp(tmp, wi); }
      }
    }
    for (let i = 0; i < n; i++) { const q = P[wid[i]]; p.setXYZ(i, q.x, q.y, q.z); }
    return deformWeld(g, () => {});
  }
  /** raio INSCRITO da malha já moldada ao longo do eixo (quadros F): perfil [[t, r]] para C.solid — os sulcos e
   *  achatamentos de contato entram na checagem automática de interpenetração */
  function inscribedR(geo, F, n = 30) {
    const p = geo.attributes.position, v = new Vec(), out = [];
    for (let k = 0; k <= n; k++) {
      const f = fAt(F, k / n); let best = Infinity;
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).sub(f.c); const a = v.dot(f.T);
        if (Math.abs(a) < 0.12) best = Math.min(best, Math.sqrt(Math.max(0, v.lengthSq() - a * a)));
      }
      out.push([k / n, isFinite(best) ? Math.max(0.05, best) : Math.min(f.rx, f.ry)]);
    }
    return out;
  }
  /** ponto da superfície de uma geometria atingido por um raio que vem de fora (dir) em direção a c; + afastamento off */
  function surfHit(geo, c, dir, off = 0) {
    const d = v3(dir).normalize(), from = v3(c).addScaledVector(d, 5);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    const h = new THREE.Raycaster(from, d.clone().negate(), 0, 5).intersectObject(m, false)[0];
    return h ? arr(h.point.addScaledVector(d, off)) : null;
  }
  /** tubo de um sólido já registrado por outro módulo (eixo real construído), ou do eixo de LM se ausente */
  function solidTube(id, pts, r, extra = 0) {
    const s = (ATLAS.solids || []).find((q) => q.id === id);
    // id '-L': eixo refletido para o lado direito (a malha direita é espelhada para formar a esquerda)
    if (s) return obTube(frames(/-L$/.test(id) ? s.pts.map((q) => [-q[0], q[1], q[2]]) : s.pts, { rx: s.r, ry: s.r, step: 0.2 }), extra);
    return pts ? obTube(frames(pts, { rx: r, ry: r, step: 0.2 }), extra) : () => {};
  }
  /**
   * Obstáculo a partir da MALHA REAL de ossos já construídos pelo esqueleto (ids, lado direito), DIRECIONAL: um ponto
   * DENTRO do osso (paridade das interseções de um raio ao longo de dir) sai pela primeira face no sentido de dir, d cm
   * além dela. Usado para assentar extremidades de inserção (ligamento costoclavicular, tendão do subclávio) SOBRE o
   * osso: as réplicas analíticas da 1ª costela/cartilagem não têm os sulcos nem a secção atual da 1ª cartilagem; e,
   * pelo ponto mais próximo, os vértices fundos de uma tampa saíam pela face OPOSTA (inferior) da cartilagem e o
   * ligamento a atravessava (até ~0,29 cm de osso "dentro" do ligamento). Sem as malhas (módulo isolado): nulo. Os triângulos
   * de cada malha ficam numa grade 2D no plano perpendicular a dir (cada raio testa só a sua coluna; Möller–Trumbore
   * sem alocações). Só entram os triângulos dentro de box ([min, max]): a caixa deve conter, ao longo de dir, todo o
   * osso que os raios de interesse atravessam (os cortes da caixa ficam longe deles). Malhas em sequência, 2 voltas
   * (costela e cartilagem se sobrepõem na junção). pads: deslocamentos de teste ([[dx,dy,dz], ...]); o ponto sai pela
   * maior distância entre p e p+pad — "engorda" o osso nessas direções para os vértices vizinhos de uma quina (sem
   * isso, o triângulo entre um vértice fora, rente à quina, e outro já assentado cortava a quina).
   */
  const boneTriCache = new Map(); // malha → posições dos triângulos (não indexadas) no referencial anatômico
  function boneTris(o, inv) {
    let T = boneTriCache.get(o); if (T) return T;
    const M = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld), ident = M.equals(new THREE.Matrix4());
    const p = o.geometry.attributes.position, ix = o.geometry.index, n = ix ? ix.count : p.count, v = new Vec();
    T = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) { v.fromBufferAttribute(p, ix ? ix.getX(k) : k); if (!ident) v.applyMatrix4(M); T[k * 3] = v.x; T[k * 3 + 1] = v.y; T[k * 3 + 2] = v.z; }
    boneTriCache.set(o, T); return T;
  }
  function boneMeshRayOb(ids, dir, box, pads = [[0, 0, 0]]) {
    const bones = layers.bones; if (!bones) return () => {};
    bones.updateWorldMatrix(true, true);
    const inv = new THREE.Matrix4().copy(bones.matrixWorld).invert(), sets = [];
    bones.traverse((o) => { if (o.isMesh && o.userData.info && ids.includes(o.userData.info.id)) sets.push(boneTris(o, inv)); });
    return triRayOb(sets, dir, box, pads);
  }
  /**
   * Paredes de BORDA de uma lâmina (sheet) contra a malha real de ossos: na fileira de origem/inserção a parede que une
   * a face superficial (Tp) à profunda (Bp) de cada coluna é um quadrilátero sem vértices intermediários; depois que os
   * vértices são assentados (cada um sai do osso por um raio de direção fixa) ela ainda pode cortar a quina do osso
   * quando Tp e Bp ficam em lados diferentes dela (acrômio, articulação acromioclavicular). Aqui, se o segmento Tp → Bp
   * toca o osso, Bp recua AO LONGO dele até d cm antes do primeiro contato — a borda tendínea afina, sem cruzar o osso.
   * snap = { band, test(p, i) }: ANTES disso, Bp (face profunda da borda) que ficou fora do osso a menos de band cm dele é
   * levado ao ponto mais próximo do osso (+ d) — fecha frestas de contato da origem/inserção (via de luz vista de cima).
   */
  function clipEdgeWalls(geo, nu, rows, ids, d = 0.012, snap = null) {
    const bones = layers.bones; if (!bones) return geo;
    bones.updateWorldMatrix(true, true);
    const inv = new THREE.Matrix4().copy(bones.matrixWorld).invert(), sets = [];
    bones.traverse((o) => { if (o.isMesh && o.userData.info && ids.includes(o.userData.info.id)) sets.push(boneTris(o, inv)); });
    const pos = geo.attributes.position, NV = geo.userData.NV, W = nu + 1, a = new Vec(), b = new Vec();
    const firstHit = (T, ax, ay, az, dx, dy, dz) => { // menor fração t ∈ (0, 1] do segmento que cruza um triângulo
      let best = Infinity;
      for (let k = 0; k < T.length; k += 9) {
        const e1x = T[k + 3] - T[k], e1y = T[k + 4] - T[k + 1], e1z = T[k + 5] - T[k + 2], e2x = T[k + 6] - T[k], e2y = T[k + 7] - T[k + 1], e2z = T[k + 8] - T[k + 2];
        const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x, det = e1x * px + e1y * py + e1z * pz;
        if (det > -1e-12 && det < 1e-12) continue;
        const iv = 1 / det, tx = ax - T[k], ty = ay - T[k + 1], tz = az - T[k + 2], u = (tx * px + ty * py + tz * pz) * iv;
        if (u < 0 || u > 1) continue;
        const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, v = (dx * qx + dy * qy + dz * qz) * iv;
        if (v < 0 || u + v > 1) continue;
        const t = (e2x * qx + e2y * qy + e2z * qz) * iv;
        if (t > 1e-6 && t <= 1 && t < best) best = t;
      }
      return best;
    };
    // só os triângulos perto da fileira (caixa da borda + 1 cm)
    const bx = new THREE.Box3();
    for (const j of rows) for (let i = 0; i <= nu; i++) { bx.expandByPoint(a.fromBufferAttribute(pos, j * W + i)); bx.expandByPoint(a.fromBufferAttribute(pos, NV + j * W + i)); }
    bx.expandByScalar(1);
    const near = sets.map((T) => { const o = []; for (let k = 0; k < T.length; k += 9) { let inB = false; for (let q = 0; q < 9; q += 3) if (bx.containsPoint(a.set(T[k + q], T[k + q + 1], T[k + q + 2]))) inB = true; if (inB) for (let q = 0; q < 9; q++) o.push(T[k + q]); } return Float32Array.from(o); });
    if (snap) {
      const tri = new THREE.Triangle(), cp = new Vec(), best = new Vec(), A = new Vec(), B = new Vec(), Cc = new Vec();
      for (const j of rows) for (let i = 0; i <= nu; i++) {
        const k = NV + j * W + i; b.fromBufferAttribute(pos, k); if (snap.test && !snap.test(b, i)) continue;
        let dm = Infinity;
        for (const T of near) for (let q = 0; q < T.length; q += 9) {
          A.set(T[q], T[q + 1], T[q + 2]); B.set(T[q + 3], T[q + 4], T[q + 5]); Cc.set(T[q + 6], T[q + 7], T[q + 8]);
          if (Math.min(A.distanceToSquared(b), B.distanceToSquared(b), Cc.distanceToSquared(b)) > (snap.band + 0.6) ** 2) continue;
          tri.set(A, B, Cc); tri.closestPointToPoint(b, cp); const dd = cp.distanceTo(b); if (dd < dm) { dm = dd; best.copy(cp); }
        }
        if (dm > d + 0.003 && dm < snap.band) { b.sub(best).multiplyScalar(d / dm).add(best); pos.setXYZ(k, b.x, b.y, b.z); }
      }
    }
    for (const j of rows) for (let i = 0; i <= nu; i++) {
      const k = j * W + i; a.fromBufferAttribute(pos, k); b.fromBufferAttribute(pos, NV + k);
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L = Math.hypot(dx, dy, dz); if (L < 1e-4) continue;
      let t = Infinity; for (const T of near) t = Math.min(t, firstHit(T, a.x, a.y, a.z, dx, dy, dz));
      if (t > 1) continue;
      const f = Math.max(0.05, t - d / L); pos.setXYZ(NV + k, a.x + dx * f, a.y + dy * f, a.z + dz * f);
    }
    pos.needsUpdate = true;
    return deformWeld(geo, () => {});
  }
  /** núcleo: sets = listas de triângulos (posições não indexadas), cada lista um sólido fechado (paridade própria) */
  function triRayOb(sets, dir, box, pads = [[0, 0, 0]]) {
    const D = v3(dir).normalize();
    const U = new Vec(0, 0, 1).cross(D); if (U.lengthSq() < 0.01) U.set(1, 0, 0).cross(D); U.normalize(); const W = new Vec().crossVectors(D, U);
    const [x0, y0, z0] = box[0], [x1, y1, z1] = box[1];
    const a = new Vec(), b = new Vec(), c = new Vec(), q = new Vec(), cell = 0.2, obs = [], PD = pads.map(v3);
    sets.forEach((P) => {
      const Ta = [], grid = new Map(), gmax = new Map(); // gmax: maior projeção em dir dos triângulos da coluna (saída rápida)
      const bb = new THREE.Box3();
      for (let k = 0; k < P.length; k += 9) {
        a.set(P[k], P[k + 1], P[k + 2]); b.set(P[k + 3], P[k + 4], P[k + 5]); c.set(P[k + 6], P[k + 7], P[k + 8]);
        if (Math.max(a.x, b.x, c.x) < x0 || Math.min(a.x, b.x, c.x) > x1 || Math.max(a.y, b.y, c.y) < y0 || Math.min(a.y, b.y, c.y) > y1 ||
          Math.max(a.z, b.z, c.z) < z0 || Math.min(a.z, b.z, c.z) > z1) continue;
        bb.expandByPoint(a).expandByPoint(b).expandByPoint(c);
        const qi = Ta.length; Ta.push(a.x, a.y, a.z, b.x - a.x, b.y - a.y, b.z - a.z, c.x - a.x, c.y - a.y, c.z - a.z);
        const ua = a.dot(U), ub = b.dot(U), uc = c.dot(U), wa = a.dot(W), wb = b.dot(W), wc = c.dot(W), dm = Math.max(a.dot(D), b.dot(D), c.dot(D));
        for (let i = Math.floor(Math.min(ua, ub, uc) / cell); i <= Math.floor(Math.max(ua, ub, uc) / cell); i++)
          for (let j = Math.floor(Math.min(wa, wb, wc) / cell); j <= Math.floor(Math.max(wa, wb, wc) / cell); j++) {
            const g = i * 100003 + j; let l = grid.get(g); if (!l) { grid.set(g, (l = [])); gmax.set(g, dm); } else if (dm > gmax.get(g)) gmax.set(g, dm); l.push(qi);
          }
      }
      if (!Ta.length) return;
      const T = Float64Array.from(Ta);
      const exitT = (pt) => { // distância ao longo de dir até sair do osso (−1: fora)
        if (!bb.containsPoint(pt)) return -1;
        const g = Math.floor(pt.dot(U) / cell) * 100003 + Math.floor(pt.dot(W) / cell), l = grid.get(g); if (!l) return -1;
        if (pt.dot(D) > gmax.get(g) + 1e-6) return -1; // todo o osso da coluna fica atrás do ponto: nenhuma face à frente
        let cnt = 0, tmin = Infinity;
        for (const k of l) { // raio pt + t·D × triângulo [a, e1, e2]
          const e1x = T[k + 3], e1y = T[k + 4], e1z = T[k + 5], e2x = T[k + 6], e2y = T[k + 7], e2z = T[k + 8];
          const px = D.y * e2z - D.z * e2y, py = D.z * e2x - D.x * e2z, pz = D.x * e2y - D.y * e2x, det = e1x * px + e1y * py + e1z * pz;
          if (det > -1e-12 && det < 1e-12) continue;
          const iv = 1 / det, tx = pt.x - T[k], ty = pt.y - T[k + 1], tz = pt.z - T[k + 2], u = (tx * px + ty * py + tz * pz) * iv;
          if (u < 0 || u > 1) continue;
          const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, v = (D.x * qx + D.y * qy + D.z * qz) * iv;
          if (v < 0 || u + v > 1) continue;
          const t = (e2x * qx + e2y * qy + e2z * qz) * iv;
          if (t > 1e-7) { cnt++; if (t < tmin) tmin = t; }
        }
        return cnt % 2 === 1 ? tmin : -1; // dentro: primeira face no sentido de dir
      };
      obs.push((pt, d) => {
        let best = -1;
        for (const o of PD) { const t = exitT(q.copy(pt).add(o)); if (t > best) best = t; }
        if (best >= 0) pt.addScaledVector(D, best + d);
      });
    });
    if (!obs.length) return () => {};
    return (pt, d) => { for (let r = 0; r < 2; r++) for (const ob of obs) ob(pt, d); };
  }
  // saída para CIMA (≈ eixo do ligamento costoclavicular e do tendão do subclávio, que sobem da junção costocondral;
  // a caixa corta a 1ª costela bem abaixo/atrás dos raios) e LATERAL na borda do manúbrio (incisura da 1ª cartilagem)
  const obRib1Up = boneMeshRayOb(['rib-1-R', 'costal-cartilage-1-R'], [0.21, 0.97, 0.12], [[1.6, -3.0, -2.2], [6.2, 5.0, 1.8]]);
  const obManuM = boneMeshRayOb(['manubrium'], [1, 0, 0], [[1.0, -2.6, -2.4], [5.0, 0.8, 1.8]]);
  // face superior da 1ª costela na região dos tubérculos/inserções dos escalenos (saída para cima)
  const obRib1Top = boneMeshRayOb(['rib-1-R'], [0, 1, 0], [[3.8, -1.5, -5.0], [8.0, 6.0, -0.8]]);
  // face POSTERIOR do manúbrio/articulação esternoclavicular/extremidade esternal da clavícula (origens dos infra-hióideos)
  // (pads 0,1–0,2 cm para baixo: a fita passa atrás da quina superoposterior do manúbrio, não através dela)
  const obManuPost = boneMeshRayOb(['manubrium', 'sc-joint-R', 'clavicle-R'], [0, 0, -1], [[0.3, -2.6, -3.6], [4.6, 2.6, 1.8]], [[0, 0, 0], [0, -0.1, 0], [0, -0.2, 0]]);
  // face ANTERIOR do esterno (origem esternal do peitoral maior)
  const obSternAnt = boneMeshRayOb(['manubrium', 'sternal-angle', 'sternum-body'], [0, 0, 1], [[-0.6, -16.0, -3.0], [4.6, 1.0, 6.0]]);

  /** varredura (C.sweepGeometry) + cores por vértice; colFn(t, w, x,y,z) → {base, k, j?}; w = rampa de RW cm em t */
  function sweep(pts, o, colFn, seed = 0) {
    o = Object.assign({}, o, { vScale: o.vScale ? o.vScale * 2.6 : 10 });
    const g = C.sweepGeometry(pts, o);
    const len = g.userData.length, vS = o.vScale || 4, uvA = g.attributes.uv, w = RW / Math.max(0.5, len);
    paint(g, (i, x, y, z) => { const t = clamp(uvA.getY(i) * vS / len, 0, 1); const c = colFn(t, w, x, y, z); return musRGB(c.base, c.k, x, y, z, seed, c.j || 0); });
    return g;
  }

  /* =====================================================================
     Registro / espelhamento
     ===================================================================== */
  const toL = (info) => Object.assign({}, info, {
    id: info.id.replace(/-R$/, '-L'),
    name: info.name.replace(/direit([oa])/g, 'esquerd$1'),
  });
  const built = []; // [{mesh, info}] lado direito → espelhar ao final
  function addR(geo, mat, info, opts = {}) {
    const m = C.mesh(geo, mat, LAY, info);
    if (opts.noShadow) { m.castShadow = false; }
    if (mat.transparent) { m.castShadow = false; m.renderOrder = 2; }
    if (!opts.noMirror) built.push({ m, info });
    return m;
  }
  /** lado esquerdo construído à parte (assimetria real): geometria em coordenadas "direitas" → espelhada */
  function addL(geoR, mat, infoR) {
    const m = C.mesh(C.mirrorGeometry(geoR), mat, LAY, toL(infoR));
    if (mat.transparent) { m.castShadow = false; m.renderOrder = 2; }
    return m;
  }

  /* =====================================================================
     1) Ligamento costoclavicular
     ===================================================================== */
  const r1 = ribs[0];
  {
    const g = C.sweepGeometry([[3.22, -1.32, -0.42], [3.33, -0.75, -0.36], [3.47, -0.15, -0.3], [3.6, 0.32, -0.24]],
      { up: [0.15, 0, 1], rx: [[0, 0.52], [0.5, 0.44], [1, 0.5]], ry: [[0, 0.3], [0.5, 0.24], [1, 0.3]], radial: 18, segments: 10, caps: 'round', vScale: 1.5 });
    // extremidades ASSENTADAS na impressão costoclavicular (face inferior da clavícula) e na junção 1ª costela/cartilagem:
    // as tampas entravam até ~0,38 cm na clavícula e ~0,29 cm na cartilagem (nos cortes parassagitais x 3,2–3,9 a secção
    // do ligamento aparecia como anel pálido com o osso visto "por dentro"). Folga 0,015 cm: contato visual mantido.
    // Extremidade costal: saída ao longo do EIXO do ligamento (para cima), não pelo ponto mais próximo — a tampa se
    // achata sobre a face superior da cartilagem em vez de atravessá-la.
    deformSoft(g, (p) => { obClavX(p, 0.015); obClavEnd(p, 0.015); if (p.y < -0.4) obRib1Up(p, 0.015); obManuM(p, 0.015); }, { passes: 1, smooth: 2, tol: 0.003, unfold: 8 });
    addR(g, LIG, G({ id: 'costoclavicular-lig-R', name: 'Ligamento costoclavicular direito',
      desc: 'Une a 1ª costela/cartilagem à face inferior da extremidade esternal da clavícula; limita a elevação da clavícula. A veia subclávia passa imediatamente posterolateral a ele.' }));
    anchors.costoclavLigR = [3.42, -0.45, 0.12];
  }

  /* =====================================================================
     2) Subclávio — ventre no sulco inferior do terço médio da clavícula; tendão à junção 1ª costela/cartilagem
     ===================================================================== */
  let subclF;
  {
    const sv = C.profile([[0, 0.12], [0.18, 0.14], [0.34, 0.24], [0.6, 0.31], [0.84, 0.27], [1, 0.14]]); // semi-eixo vertical
    const sa = C.profile([[0, 0.18], [0.18, 0.2], [0.34, 0.4], [0.6, 0.5], [0.84, 0.44], [1, 0.22]]);   // semi-eixo AP
    // tendão de origem SOBRE a face superior da junção 1ª costela/cartilagem (face superior medida ≈ y −1,04 em x 3,8;
    // antes o eixo começava em y −1,10, dentro da costela, e o tendão ficava enterrado até ~0,18 cm em x 3,8–4,2)
    const pts = [[3.78, -0.9, -0.2], [4.55, -0.43, 0.12]];
    const ts = [0.2, 0.28, 0.37, 0.46, 0.55, 0.62, 0.67];
    ts.forEach((t, i) => {
      const s = (i + 2) / (ts.length + 1); // posição aproximada ao longo do músculo (para os raios)
      const p = onTube(clavF, t, [0, -1, -0.12], sv(s) + 0.05);
      pts.push(arr(p));
    });
    subclF = frames(pts, { up: [0, 1, 0], rx: sv, ry: sa, step: 0.1 });
    const g = sweep(pts, { up: [0, 1, 0], rx: sv, ry: sa, radial: 22, density: 9, caps: 'round', vScale: 3 },
      (t, w) => ({ base: COL.deep, k: 1 - ramp(t, 0.28, w) + 0.25 * ramp(t, 0.97, w), j: band(t, 0.28, w, -1) }), 11);
    // o que ainda tocar a costela (face superior inclinada) se achata sobre ela: saída para CIMA, folga 0,015 cm
    deformSoft(g, (p) => { if (p.y < -0.3) obRib1Up(p, 0.015); }, { weight: (p) => 1 - sm(-0.55, -0.3, p.y), passes: 1, smooth: 2, tol: 0.003 });
    addR(g, MUS, G({ id: 'subclavius-R', name: 'Músculo subclávio direito',
      desc: 'Fusiforme, no sulco da face inferior do terço médio da clavícula, envolto pela fáscia clavipeitoral, anterossuperior à veia subclávia. No acesso infraclavicular a agulha atravessa a fáscia e o ventre do subclávio imediatamente antes de alcançar a parede anterior da veia.' }));
    C.solid('mus-subclavius-R', pts, (t) => Math.min(sv(t), sa(t)));
    anchors.subclaviusR = arr(onTube(clavF, 0.45, [0, -1, 0.35], 0.62));
  }
  const obSubcl = obTube(subclF);

  /* =====================================================================
     3) Escalenos anterior e médio (+ fascículos de origem nos tubérculos cervicais)
     ===================================================================== */
  const vt = (n) => LM.vert(n);
  const antTub = (n) => { const s = vt(n), cz = s.zf - s.d / 2; return [s.w / 2 + 0.55, s.y - 0.05, cz + s.d / 2 * 0.2]; };
  const postTub = (n) => { const s = vt(n), cz = s.zf - s.d / 2; return [s.w / 2 + 0.85, s.y - 0.1, cz - s.d / 2 - 0.45]; };
  {
    const SA = LM.muscles.scaleneAnt;
    const pts = SA.pts.slice(0, 4).concat([[5.1, 0.5, -1.78], [5.16, 0.12, -1.74]]);
    // ventre de ~1 cm de espessura AP junto à 1ª costela (Bannon et al.: 1–1,5 cm) — é a barreira entre veia e artéria
    const w = C.profile([[0, 0.5], [0.25, 0.64], [0.5, 0.72], [0.78, 0.62], [0.92, 0.54], [1, 0.44]]);
    const t = C.profile([[0, 0.3], [0.25, 0.42], [0.5, 0.5], [0.78, 0.5], [0.92, 0.42], [1, 0.3]]);
    const g = sweep(pts, { up: [1, 0, -0.32], rx: w, ry: t, radial: 22, density: 6, caps: 'round', vScale: 4 },
      (s, w) => ({ base: COL.deep, k: 0.85 * ramp(s, 0.945, w) + 0.3 * (1 - ramp(s, 0.03, w)), j: band(s, 0.945, w) }), 21);
    // a VJI (medial), a veia subclávia (anterior), a artéria subclávia (posterior) e os ramos que cruzam a face anterior
    // (supraescapular, cervical transversa) moldam o ventre: as faces em contato são achatadas, sem invadir os vasos
    // arco da subclávia: eixo REAL do módulo de vasos e, além dele, o eixo-mestre LM v2 (arco elevado, r 0,44–0,48) —
    // se os dois divergirem, a face posterior não invade nenhum deles. Ramos que cruzam a face anterior (supraescapular,
    // cervical transversa D/E) com folga maior (0,1 cm): pequenas mudanças no rebase dos ramos não voltam a penetrar.
    const obsSA = [solidTube('ijv-R', VS.ijvR.pts, VS.ijvR.r, 0.06), solidTube('scv-R', VS.scv.pts, VS.scv.r, 0.05), solidTube('sca-R', VS.scaR.pts, VS.scaR.r, 0.05),
      obTube(frames(VS.scaR.pts, { rx: VS.scaR.r, ry: VS.scaR.r, step: 0.2 }), 0.06),
      solidTube('suprascapular-a-R', null, 0, 0.1), solidTube('transverse-cervical-a-R', null, 0, 0.1),
      solidTube('thyrocervical-R', null, 0, 0.05), solidTube('inferior-thyroid-a-R', null, 0, 0.05), solidTube('vertebral-a-R', null, 0, 0.03),
      // ramos do lado esquerdo (não exatamente simétricos): o mesmo leito serve à malha espelhada
      solidTube('suprascapular-a-L', null, 0, 0.1), solidTube('transverse-cervical-a-L', null, 0, 0.1)];
    // smooth 3: a prega da borda medial (y ≈ 3,3, junto à VJI e aos ramos) é alisada; tol 0,02 na correção final
    // + inserção ASSENTADA no tubérculo do escaleno (face superior da 1ª costela): a tampa entrava até ~0,22 cm no osso
    deformSoft(g, (p) => { for (const ob of obsSA) ob(p, 0); if (p.y < 1.2) obRib1Top(p, 0.015); }, { passes: 3, smooth: 3, tol: 0.02 });
    const info = G({ id: 'scalene-ant-R', name: 'Músculo escaleno anterior direito',
      desc: 'Dos tubérculos anteriores de C3–C6 ao tubérculo do escaleno da 1ª costela. A veia subclávia passa ANTERIOR a ele; a artéria subclávia e o plexo braquial, POSTERIORES — barreira entre veia e artéria.' });
    addR(g, MUS, info);
    const Fa = frames(pts, { rx: w, ry: t, up: [1, 0, -0.32] });
    C.solid('mus-scalene-ant-R', pts, inscribedR(g, Fa));
    // fascículos de origem (C4–C6): tendíneos junto ao osso, carnosos junto ao ventre
    [['C4', 0.06], ['C5', 0.26], ['C6', 0.44]].forEach(([n, s], i) => {
      const a = antTub(n), f = fAt(Fa, s);
      const end = arr(f.c.clone().addScaledVector(f.N, -w(s) * 0.35));
      const start = [a[0] + 0.12, a[1] + 0.05, a[2] + 0.28];
      const mid = lerp3(start, end, 0.5); mid[2] += 0.15;
      const gg = sweep([start, mid, end], { rx: [[0, 0.16], [1, 0.3]], ry: [[0, 0.11], [1, 0.22]], up: [0, 1, 0], radial: 12, segments: 12, caps: 'round', vScale: 2 },
        (q, w) => ({ base: COL.deep, k: 1 - ramp(q, 0.45, w), j: band(q, 0.45, w, -1) }), 23 + i);
      addR(gg, MUS, Object.assign({}, info, { name: info.name + ' — fascículo de origem (' + n + ')' }));
    });
    // âncora na face ANTEROLATERAL do terço inferior (y ≈ 2,45), medida sobre a malha já moldada: visível de frente
    // (acima da clavícula, lateral à VJI e ao frênico) e, no corte parassagital do cap. 08 visto pela direita,
    // projetada sobre a secção do próprio músculo (não sobre a VJI, medial a ele)
    anchors.scaleneAntR = surfHit(g, fAt(Fa, tAt(Fa, 1, 2.45)).c, [0.62, 0, 0.78], 0.03) || arr(onTube(Fa, 0.8, [0.62, 0, 0.78], 0.03));
  }
  {
    const SM = LM.muscles.scaleneMid;
    // inserção na face superior da 1ª costela, posterior ao sulco da artéria subclávia e ao tronco inferior do plexo
    // (ligeiramente mais posterior que LM.muscles.scaleneMid, com a ponta mais estreita: deixa o leito do tronco livre)
    const tR = tAt(r1.body, 2, -3.92), ins = onTube(r1.body, tR, [0, 1, 0], -0.05);
    const pts = SM.pts.slice(0, 3).concat([[5.95, 2.45, -3.95], arr(ins)]);
    const w = C.profile([[0, 0.6], [0.3, 0.82], [0.6, 0.9], [0.86, 0.78], [1, 0.6]]);
    const t = C.profile([[0, 0.4], [0.3, 0.5], [0.6, 0.55], [0.86, 0.42], [1, 0.22]]);
    const g = sweep(pts, { up: [0.42, 0, -0.9], rx: w, ry: t, radial: 22, density: 6, caps: 'round', vScale: 4 },
      (s, w) => ({ base: COL.deep, k: 0.5 * ramp(s, 0.965, w) + 0.3 * (1 - ramp(s, 0.03, w)), j: 0.5 * band(s, 0.965, w) }), 31);
    // troncos do plexo e artéria subclávia apoiam-se na face ANTERIOR do escaleno médio (hiato interescalênico):
    // a face é rebaixada em canaletas rasas e lisas (deformação macia); o módulo de nervos assenta os troncos
    // contra esta malha, então não são necessárias cópias deslocadas dos eixos
    const obTr = LM.nerves.plexusTrunks.map((T) => lmTube(T.pts, 0.26, 0.05));
    // tronco inferior: sobre a 1ª costela fica ATRÁS da 3ª parte da artéria (que o afasta para baixo/trás) e à frente
    // da inserção do escaleno médio — canaleta também nessa posição (o módulo de nervos o assenta ali)
    // (onda 3: segue o trajeto assentado pelo módulo de nervos, monotônico em y sobre a 1ª costela — sem o vale antigo)
    obTr.push(lmTube([[4.43, 3.59, -4.68], [4.98, 2.5, -3.79], [5.5, 1.81, -3.4], [5.74, 1.63, -3.3], [6.01, 1.51, -3.2], [6.33, 1.5, -3.16], [6.64, 1.48, -3.05], [6.95, 1.43, -2.96], [7.24, 1.3, -2.87], [7.5, 1.14, -2.88], [7.75, 0.92, -2.92]], 0.25, 0.08));
    const obScaM = solidTube('sca-R', VS.scaR.pts, VS.scaR.r, 0.06);
    deformSoft(g, (p) => { for (const ob of obTr) ob(p, 0); obScaM(p, 0); },
      { weight: (p) => sm(1.0, 1.7, p.y) * (1 - sm(8.0, 8.8, p.y)), passes: 4, smooth: 3, tol: Infinity }); // sem correção dura final (recriaria dobras); os troncos são assentados pelo módulo de nervos
    // inserção ASSENTADA sobre a face superior da 1ª costela (a ponta do eixo fica 0,05 cm abaixo dela: a tampa entrava
    // até ~0,21 cm no osso, bolsão vermelho na secção da costela em cortes parassagitais x 6–7)
    deformSoft(g, (p) => obRib1Top(p, 0.015), { weight: (p) => 1 - sm(2.0, 2.5, p.y), passes: 1, smooth: 2, tol: 0.003 });
    const info = G({ id: 'scalene-mid-R', name: 'Músculo escaleno médio direito',
      desc: 'Dos tubérculos posteriores de C2–C7 à face superior da 1ª costela, atrás do sulco da artéria subclávia. Com o escaleno anterior delimita o hiato interescalênico (artéria subclávia e troncos do plexo).' });
    addR(g, MUS, info);
    const Fm = frames(pts, { rx: w, ry: t });
    C.solid('mus-scalene-mid-R', pts, inscribedR(g, Fm));
    [['C4', 0.04], ['C5', 0.2], ['C6', 0.38], ['C7', 0.55]].forEach(([n, s], i) => {
      const a = postTub(n), f = fAt(Fm, s);
      const end = arr(f.c.clone().addScaledVector(new Vec(-1, 0, 0), 0.25));
      const start = [a[0] + 0.15, a[1] + 0.05, a[2] + 0.1];
      const gg = sweep([start, lerp3(start, end, 0.5), end], { rx: [[0, 0.17], [1, 0.32]], ry: [[0, 0.12], [1, 0.24]], up: [0, 1, 0], radial: 12, segments: 12, caps: 'round', vScale: 2 },
        (q, w) => ({ base: COL.deep, k: 1 - ramp(q, 0.45, w), j: band(q, 0.45, w, -1) }), 33 + i);
      addR(gg, MUS, Object.assign({}, info, { name: info.name + ' — fascículo de origem (' + n + ')' }));
    });
    anchors.scaleneMidR = arr(fAt(Fm, 0.55).c.clone().add(new Vec(0.6, 0, -0.1)));
  }

  const scmObs = [], strapObs = []; // ECM e esternotireóideo como obstáculos (trajeto do omo-hióideo)
  /* =====================================================================
     4) Esternocleidomastóideo — cabeças esternal (tendínea) e clavicular (larga, carnosa); corte em y = 11
     ===================================================================== */
  {
    const scm = LM.muscles.scm;
    const upFn = (t) => new Vec(lerp(1, 0.86, t), 0, lerp(-0.25, -0.5, t));
    const info = G({ id: 'scm-R', name: 'Músculo esternocleidomastóideo direito',
      desc: 'Cabeça esternal (tendínea, da face anterior do manúbrio) e clavicular (larga, do terço medial da clavícula), fundidas num ventre comum. Entre as cabeças, a fossa supraclavicular menor, sobre a veia jugular interna.' });
    // cabeça esternal: tendão arredondado → ventre; termina dentro do ventre comum. Origem na face anterior do manúbrio
    // LATERAL à incisura jugular (centro x ≈ 1,45; borda medial ≈ 1,15): a fossa supraesternal entre os dois tendões
    // tem ~2,3 cm (LM.muscles.scm.sternalOrigin, x 0,95, deixava a fossa estreita demais para a polpa do indicador)
    const so = scm.sternalOrigin, so2 = [Math.max(so[0], 1.45), so[1] - 0.05, so[2]];
    const stPts = [so2, [1.62, 0.55, 0.8], [2.0, 2.3, 0.62], [2.68, 4.6, 0.2], [3.36, 6.6, -0.22], [3.62, 7.4, -0.4]];
    const stW = C.profile([[0, 0.3], [0.14, 0.36], [0.3, 0.62], [0.6, 0.95], [1, 0.9]]);
    const stT = C.profile([[0, 0.27], [0.14, 0.3], [0.3, 0.38], [0.6, 0.44], [1, 0.38]]);
    const g1 = sweep(stPts, { up: (t) => upFn(t * 0.6), rx: stW, ry: stT, radial: 26, density: 6, caps: 'round', vScale: 4 },
      (t, w) => ({ base: COL.mus, k: 1 - ramp(t, 0.25, w), j: band(t, 0.25, w, -1) }), 41);
    addR(g1, MUS, Object.assign({}, info, { name: info.name + ' — cabeça esternal' }));
    // cabeça clavicular: larga e achatada, sobe quase verticalmente e passa profundamente à esternal
    const clPts = [[4.4, 1.82, 0.42], [4.3, 2.65, 0.26], [4.14, 4.3, -0.24], [4.22, 6.2, -0.82], [4.35, 7.1, -1.02]];
    const clW = C.profile([[0, 1.25], [0.15, 1.15], [0.45, 0.95], [0.8, 0.85], [1, 0.7]]);
    const clT = C.profile([[0, 0.2], [0.15, 0.27], [0.45, 0.36], [1, 0.34]]);
    const g2 = sweep(clPts, { up: (t) => upFn(t * 0.5 + 0.05), rx: clW, ry: clT, radial: 26, density: 6, caps: 'round', vScale: 4 },
      (t, w) => ({ base: COL.mus, k: 0.35 * (1 - ramp(t, 0.03, w)) }), 43);
    // origem assentada SOBRE a face superior da clavícula (antes: tampa da varredura enterrada até ~0,35 cm no osso,
    // bolsão vermelho na secção da clavícula no corte parassagital do cap. 08, x 3,4–5,5). Deformação macia contra a
    // clavícula (secção superelíptica EXATA do esqueleto, folga 0,015 cm) só na porção de origem: a tampa se achata
    // sobre o osso e o contato visual da inserção é mantido (folga medida 0,012–0,025 cm em toda a largura, x 3,3–5,5;
    // sem a fenda escura que a margem ×1,05 do obstáculo genérico deixava ver no corte ampliado). Uma única passada de
    // espalhamento: com mais passadas a margem lateral da tampa subia junto e abria um vão de ~0,08 cm. O ventre acima
    // de y ≈ 3,2 fica intacto.
    deformSoft(g2, (p) => { obClavX(p, 0.015); obClavEnd(p, 0.015); }, { weight: (p) => 1 - sm(2.5, 3.2, p.y), passes: 1, smooth: 2, tol: 0.003, unfold: 8 });
    addR(g2, MUS, Object.assign({}, info, { name: info.name + ' — cabeça clavicular' }));
    // ventre comum (envolve as extremidades superiores das duas cabeças); corte plano em y = 11
    const bPts = [[3.32, 4.1, -0.05], [3.6, 5.6, -0.34], [4.12, 7.7, -0.78], [4.62, 9.6, -1.18], [4.88, 10.45, -1.36], [4.9, 11.0, -1.38]];
    const bW = C.profile([[0, 0.55], [0.18, 1.35], [0.45, 1.62], [1, 1.52]]);
    const bT = C.profile([[0, 0.22], [0.18, 0.46], [0.45, 0.56], [1, 0.52]]);
    const g3 = sweep(bPts, { up: (t) => upFn(0.35 + 0.65 * t), rx: bW, ry: bT, radial: 30, density: 6, caps: 'flat', vScale: 4 },
      (t) => ({ base: COL.mus, k: 0 }), 45);
    addR(g3, MUS, Object.assign({}, info, { name: info.name + ' — ventre' }));
    scmObs.push(obTube(frames(bPts, { up: (t) => upFn(0.35 + 0.65 * t), rx: bW, ry: bT, step: 0.1 })), obTube(frames(clPts, { up: (t) => upFn(t * 0.5 + 0.05), rx: clW, ry: clT, step: 0.1 })),
      obTube(frames(stPts, { up: (t) => upFn(t * 0.6), rx: stW, ry: stT, step: 0.1 })));
    C.solid('mus-scm-sternal-R', stPts, (t) => Math.min(stW(t), stT(t)));
    C.solid('mus-scm-clav-R', clPts.slice(1), (t) => Math.min(clW(t), clT(t)));
    C.solid('mus-scm-belly-R', bPts, (t) => Math.min(bW(t), bT(t)));
    const Fs = frames(stPts, { up: (t) => upFn(t * 0.6), rx: stW, ry: stT }), Fc = frames(clPts, { up: (t) => upFn(t * 0.5 + 0.05), rx: clW, ry: clT });
    anchors.scmSternalR = arr(onTube(Fs, 0.16, [0, 0, 1], 0.02));
    anchors.scmClavicularR = arr(onTube(Fc, 0.16, [0.2, 0, 1], 0.02));
  }

  /* =====================================================================
     5) Esterno-hióideo e esternotireóideo (finos, posteriores ao manúbrio → acima, anteriores à traqueia)
     ===================================================================== */
  {
    const shPts = [[1.95, -0.45, -1.42], [1.85, 0.9, -1.3], [1.5, 3.6, -0.98], [1.08, 7.2, -0.55], [0.78, 11.0, -0.22]];
    const shO = { up: (t, p, T) => new Vec(1, 0, 0.18), rx: [[0, 0.62], [0.3, 0.72], [1, 0.62]], ry: [[0, 0.1], [0.3, 0.14], [1, 0.13]], radial: 18, density: 5, caps: 'flat', vScale: 4 };
    const shC = (t, w) => ({ base: COL.mus, k: 0.35 * (1 - ramp(t, 0.03, w)) });
    const shInfo = G({ id: 'sternohyoid-R', name: 'Músculo esterno-hióideo direito',
      desc: 'Infra-hióideo fino que nasce da face posterior do manúbrio e da extremidade medial da clavícula; anterior à traqueia e à confluência venosa.' });
    // origens ATRÁS do manúbrio/articulação esternoclavicular: as fitas atravessavam o ângulo superolateral do manúbrio
    // (até ~0,19 cm à direita; ~0,25 cm à esquerda, onde o afastamento da VBC E as levava para dentro do osso).
    // 1) behindManu: o eixo é reamostrado (0,3 cm) e cada ponto recua (−z) o necessário para que a face anterior da
    //    fita, em toda a largura, fique atrás da face posterior do osso (folga 0,03) — a secção recua inteira, sem
    //    achatar (há 0,4–0,6 cm entre o manúbrio e as VBC). 2) seatPost: resíduos entre amostras saem para trás.
    const behindManu = (pts, o) => {
      const cv = C.curve(pts), L = cv.getLength(), n = Math.max(8, Math.ceil(L / 0.3)), rxF = C.profile(o.rx), ryF = C.profile(o.ry);
      const X = new Vec(1, 0, 0.18).normalize(), q = new Vec(), q2 = new Vec();
      const P = [], S = [];
      for (let k = 0; k <= n; k++) {
        const t = k / n, p = cv.getPointAt(t); let sh = 0;
        if (p.y < 1.8) for (const f of [-1, -0.5, 0, 0.5, 1]) {
          // face anterior da secção elíptica nesta posição da largura (mais fina nas bordas)
          q.copy(p).addScaledVector(X, f * rxF(t) * 0.9); q.z += ryF(t) * Math.sqrt(1 - 0.81 * f * f) + 0.03; q2.copy(q); obManuPost(q2, 0);
          sh = Math.max(sh, q.z - q2.z);
        }
        P.push(p); S.push(sh);
      }
      // recuo suavizado ao longo do eixo (máximo dos vizinhos, depois média): sem degraus
      const S1 = S.map((v, k) => Math.max(v, S[k - 1] || 0, S[k + 1] || 0));
      return P.map((p, k) => { const v = ((S1[k - 1] ?? S1[k]) + 2 * S1[k] + (S1[k + 1] ?? S1[k])) / 4; return [p.x, p.y, p.z - Math.max(v, S[k])]; });
    };
    //    obV: veia aplicada por último (prevalece): a borda lateral do esterno-hióideo D, junto à articulação
    //    esternoclavicular, recuava até a VBC D (~0,05 cm)
    const seatPost0 = (g, obV) => deformSoft(g, (p) => { obManuPost(p, 0.03); if (obV) obV(p, 0.02); }, { weight: (p) => 1 - sm(1.6, 2.4, p.y), passes: 1, smooth: 2, tol: 0.003 });
    // acima do manúbrio as fitas ficam ANTERIORES à traqueia (e à laringe, aqui o prolongamento cranial do tubo traqueal
    // de LM; anéis em C até ~R·1,015 + 0,085): o esterno-hióideo entrava ~0,27 cm no tubo junto ao hioide (y ≈ 10,8) e o
    // esternotireóideo ~0,1 cm em y ≈ 3,9 — afastamento radial macio (a secção inteira se desloca), só em y > 0,8
    const obTrach = lmTube(LM.trachea.pts, LM.trachea.r * 1.015 + 0.09);
    const seatPost = (g, obV) => deformSoft(seatPost0(g, obV), (p) => obTrach(p, 0.02), { weight: (p) => sm(0.8, 1.6, p.y), passes: 5, smooth: 4, tol: 0.01 });
    const obBcvR = solidTube('bcv-R', VS.rbcv.pts, Math.max(...VS.rbcv.r));
    const shR = behindManu(shPts, shO);
    const gShR = seatPost(sweep(shR, shO, shC, 51), obBcvR);
    addR(gShR, MUS, shInfo, { noMirror: true });
    const stPts = [[0.95, -1.28, -1.02], [1.15, 0.5, -1.68], [1.55, 3.6, -1.42], [1.9, 7.0, -1.18], [2.05, 9.6, -1.0]];
    const stO = { up: (t, p, T) => new Vec(1, 0, 0.2), rx: [[0, 0.78], [0.25, 0.9], [0.8, 0.85], [1, 0.7]], ry: [[0, 0.07], [0.2, 0.12], [1, 0.12]], radial: 18, density: 5, caps: 'flat', vScale: 4 };
    const stC = (t, w) => ({ base: COL.deep, k: 0.4 * (1 - ramp(t, 0.035, w)) + 0.4 * ramp(t, 0.97, w) });
    const stInfo = G({ id: 'sternothyroid-R', name: 'Músculo esternotireóideo direito',
      desc: 'Profundo ao esterno-hióideo, da face posterior do manúbrio (nível da 1ª cartilagem) à linha oblíqua da cartilagem tireóidea; separa-se da veia braquiocefálica por poucos milímetros.' });
    /* Esternotireóideo PROFUNDO ao esterno-hióideo: cada fita recuava sozinha para trás do manúbrio (behindManu) e,
       na origem, a porção lateral do esternotireóideo ficava DENTRO do esterno-hióideo (até ~0,12 cm, D e E; as duas
       secções se fundiam nos cortes). Campo de recuo em z, por coluna (x, y): sobreposição entre a face anterior do
       esternotireóideo e a face posterior do esterno-hióideo + 0,02 cm, dilatado e suavizado (~0,3 cm) — a fita recua
       inteira (sem afinar) só onde passa sob o esterno-hióideo, sem degraus. */
    const zSpan = (geo) => { // (x, y) → [z mín, z máx] da malha ao longo de uma reta paralela a z (null: fora)
      const p = geo.attributes.position, ix = geo.index, T = [], grid = new Map(), cs = 0.1, key = (i, j) => (i + 500) * 2000 + (j + 500);
      for (let t = 0; t < ix.count; t += 3) {
        const q = [0, 1, 2].map((k) => { const i = ix.getX(t + k); return [p.getX(i), p.getY(i), p.getZ(i)]; }), id = T.length;
        T.push(q);
        for (let i = Math.floor(Math.min(q[0][0], q[1][0], q[2][0]) / cs); i <= Math.floor(Math.max(q[0][0], q[1][0], q[2][0]) / cs); i++)
          for (let j = Math.floor(Math.min(q[0][1], q[1][1], q[2][1]) / cs); j <= Math.floor(Math.max(q[0][1], q[1][1], q[2][1]) / cs); j++) { const k = key(i, j); let l = grid.get(k); if (!l) grid.set(k, (l = [])); l.push(id); }
      }
      return (x, y) => {
        const l = grid.get(key(Math.floor(x / cs), Math.floor(y / cs))); if (!l) return null;
        let lo = Infinity, hi = -Infinity;
        for (const id of l) {
          const [a, b, c] = T[id], d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]); if (Math.abs(d) < 1e-12) continue;
          const w1 = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / d, w2 = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / d, w3 = 1 - w1 - w2;
          if (w1 < 0 || w2 < 0 || w3 < 0) continue;
          const z = w1 * a[2] + w2 * b[2] + w3 * c[2]; if (z < lo) lo = z; if (z > hi) hi = z;
        }
        return lo <= hi ? [lo, hi] : null;
      };
    };
    const underStrap = (gSt, gSh, ptsSt) => {
      const A = zSpan(gSt), B = zSpan(gSh), X0 = -0.6, Y0 = -2.2, cs = 0.1, NX = 46, NY = 50, S0 = new Float32Array(NX * NY);
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        const x = X0 + i * cs, y = Y0 + j * cs, a = A(x, y), b = a && B(x, y);
        if (b) S0[j * NX + i] = Math.max(0, a[1] - b[0] + 0.025);
      }
      const box = (S, r, op) => { const O = new Float32Array(NX * NY); for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { let m = 0, w = 0; for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= NX || jj >= NY) continue; const v = S[jj * NX + ii]; if (op === 'max') m = Math.max(m, v); else { m += v; w++; } } O[j * NX + i] = op === 'max' ? m : m / w; } return O; };
      const D1 = box(S0, 2, 'max'), S1 = box(box(S0, 3, 'max'), 3, 'avg'), S = S1.map((v, k) => Math.max(v, D1[k]));
      const at = (x, y) => { const fi = (x - X0) / cs, fj = (y - Y0) / cs, i = Math.floor(fi), j = Math.floor(fj); if (i < 0 || j < 0 || i >= NX - 1 || j >= NY - 1) return 0; const u = fi - i, v = fj - j;
        return S[j * NX + i] * (1 - u) * (1 - v) + S[j * NX + i + 1] * u * (1 - v) + S[(j + 1) * NX + i] * (1 - u) * v + S[(j + 1) * NX + i + 1] * u * v; };
      deformWeld(gSt, (p) => { p.z -= at(p.x, p.y); });
      return ptsSt.map((q) => [q[0], q[1], q[2] - at(q[0], q[1])]); // eixo recuado (para C.solid)
    };
    const stR0 = behindManu(stPts, stO), gStR = seatPost(sweep(stR0, stO, stC, 53)), stR = underStrap(gStR, gShR, stR0);
    addR(gStR, MUS, stInfo, { noMirror: true });
    C.solid('mus-sternohyoid-R', shR, 0.12); C.solid('mus-sternothyroid-R', stR, 0.1);
    strapObs.push(obTube(frames(stR, { up: stO.up, rx: stO.rx, ry: stO.ry, step: 0.12 }), 0.03));
    // Lado esquerdo: a VBC esquerda cruza obliquamente logo atrás do manúbrio (assimetria real) — as origens
    // esquerdas são afastadas dela (para cima/à frente), em coordenadas refletidas para o lado direito.
    const lb = LM.vessels.lbcv, obL = lmTube(lb.pts.map((p) => [-p[0], p[1], p[2]]), Math.max(...lb.r), 0.1);
    // desloca cada ponto do trajeto ao longo de dir (sobretudo para CIMA, atrás da articulação esternoclavicular, em vez de
    // para dentro do manúbrio) até que toda a largura da fita fique fora da VBC esquerda
    const clearL = (pts, w, t, dir) => pts.map((p0) => {
      if (p0[1] > 1.8) return p0;
      const p = v3(p0), dv = v3(dir).normalize();
      const hit = () => [-1, -0.5, 0, 0.5, 1].some((f) => { const q = p.clone().add(new Vec(f * w, 0, 0)), q0 = q.clone(); obL(q, t); return q.distanceToSquared(q0) > 1e-6; });
      for (let it = 0; it < 40 && hit(); it++) p.addScaledVector(dv, 0.05);
      return arr(p);
    });
    // (o deslocamento para cima/à frente que afasta a origem esquerda da VBC a levava para DENTRO do manúbrio: depois
    // dele, a fita recua para trás do osso — manúbrio simétrico; a VBC E continua livre, conferido na malha)
    const shL = behindManu(clearL(shPts, 0.68, 0.15, [0, 1, 0.2]), shO), stL0 = behindManu(clearL(stPts, 0.85, 0.13, [0, 0.75, 0.66]), stO);
    const gShL = seatPost(sweep(shL, shO, shC, 52)), gStL = seatPost(sweep(stL0, stO, stC, 54)), stL = underStrap(gStL, gShL, stL0);
    addL(gShL, MUS, shInfo);
    addL(gStL, MUS, stInfo);
    C.solid('mus-sternohyoid-L', shL.map((p) => [-p[0], p[1], p[2]]), 0.12); C.solid('mus-sternothyroid-L', stL.map((p) => [-p[0], p[1], p[2]]), 0.1);
  }

  /* =====================================================================
     6) Omo-hióideo — ventre inferior (escápula → cruza o trígono posterior, superficial ao plexo/artéria),
        tendão intermédio sobre a VJI sob o ECM, ventre superior (corte em y = 11)
     ===================================================================== */
  {
    const pts = [[11.6, 0.5, -8.9], [10.45, 1.55, -6.95], [8.85, 2.85, -4.8], [7.05, 3.95, -2.85], [5.45, 5.1, -1.64], [4.2, 5.95, -1.24], [3.35, 6.6, -1.08], [2.65, 7.6, -0.9], [2.05, 9.4, -0.58], [1.82, 11.0, -0.4]];
    const w = C.profile([[0, 0.5], [0.08, 0.58], [0.3, 0.55], [0.5, 0.42], [0.56, 0.2], [0.66, 0.18], [0.74, 0.38], [0.86, 0.45], [1, 0.42]]);
    const t = C.profile([[0, 0.12], [0.3, 0.15], [0.5, 0.13], [0.56, 0.1], [0.66, 0.1], [0.74, 0.12], [1, 0.12]]);
    // sob o ECM o tendão intermédio e o ventre superior ficam "deitados" (face larga paralela à face profunda do ECM)
    const upO = (s, p, T) => { const a = new Vec(0, 1, 0.45).normalize(), b = new Vec(T.y, -T.x, 0).normalize(); return a.lerp(b, sm(0.36, 0.52, s)).normalize(); };
    const g = sweep(pts, { up: upO, rx: w, ry: t, radial: 16, density: 6, caps: 'flat', capStart: true, vScale: 3 },
      (s, w) => ({ base: COL.mus, k: ramp(s, 0.53, w) * (1 - ramp(s, 0.695, w)) + 0.5 * (1 - ramp(s, 0.02, w)), j: band(s, 0.53, w) + band(s, 0.695, w, -1) }), 61);
    // entre a face profunda do ECM e a VJI: afasta-se do ECM e, por último, da veia
    const obIJVo = obTube(frames(VS.ijvR.pts, { rx: VS.ijvR.r, ry: VS.ijvR.r, step: 0.2 }), 0.03);
    // a cervical transversa passa PROFUNDAMENTE ao ventre inferior (D e E, esta refletida para o lado da malha)
    const obTCAo = [solidTube('transverse-cervical-a-R', null, 0, 0.03), solidTube('transverse-cervical-a-L', null, 0, 0.03)];
    deformWeld(g, (p) => { for (const ob of obTCAo) ob(p, 0); if (p.x > 6.2 || p.y < 3.5) return; for (const ob of scmObs) ob(p, 0.02); for (const ob of strapObs) ob(p, 0.02); obIJVo(p, 0); });
    addR(g, MUS, G({ id: 'omohyoid-R', name: 'Músculo omo-hióideo direito',
      desc: 'Ventre inferior cruza o trígono cervical posterior ~2 cm acima da clavícula, superficial ao plexo braquial e à artéria subclávia; o tendão intermédio fica sobre a veia jugular interna, sob o ECM.' }));
    C.solid('mus-omohyoid-R', pts, (s) => t(s) + 0.02);
    anchors.omohyoidR = arr(fAt(frames(pts, { rx: w, ry: t }), 0.3).c);
  }

  /* =====================================================================
     7) Intercostais (espaços 1–6): camada externa (fibras inferomediais) e interna (inferolaterais);
        anteriormente, entre as cartilagens, a membrana intercostal externa (translúcida) deixa ver os internos
     ===================================================================== */
  const ribMemo = new Map();
  const ribAtTh = (rb, th) => { const key = rb.R.i * 100000 + Math.round(th * 10000); let r = ribMemo.get(key); if (!r) { r = ribAtTh0(rb, th); ribMemo.set(key, r); } return r; };
  const ribAtTh0 = (rb, th) => { // amostra interpolada de costela+cartilagem no ângulo polar th (porção anterior)
    const U = rb.U;
    let best = -1;
    for (let i = U.length - 1; i > 0; i--) { if (!U[i - 1].ant) break; const a = U[i - 1].th, b = U[i].th; if ((a - th) * (b - th) <= 0) { best = i; break; } }
    if (best < 0) { // fora da faixa: extremidade mais próxima
      const e = Math.abs(U[U.length - 1].th - th) < Math.abs(U[0].th - th) ? U[U.length - 1] : U[0];
      return { c: e.c.clone(), up: e.up.clone(), hv: e.hv, out: e.out.clone(), ho: e.ho };
    }
    const a = U[best - 1], b = U[best], w = clamp((th - a.th) / ((b.th - a.th) || 1e-6), 0, 1);
    return { c: a.c.clone().lerp(b.c, w), up: a.up.clone().lerp(b.up, w).normalize(), hv: lerp(a.hv, b.hv, w), out: a.out.clone().lerp(b.out, w).normalize(), ho: lerp(a.ho, b.ho, w) };
  };
  const thEnd = (rb) => rb.U[rb.U.length - 1].th;
  const thCC = (rb) => { const p = rb.R.pts[rb.R.pts.length - 1]; return Math.atan2(p[0], p[2] - ZC); };
  const icInfo = G({ id: 'intercostal-R', name: 'Músculos intercostais direitos',
    desc: 'Externos (fibras inferomediais) e internos (inferolaterais) nos espaços intercostais; o feixe vasculonervoso corre sob a margem inferior de cada costela. O 1º espaço fica abaixo da 1ª costela, posterior ao trajeto da agulha.' });
  for (let s = 1; s <= 6; s++) {
    const ra = ribs[s - 1], rb = ribs[s];
    const th0 = Math.max(thEnd(ra), thEnd(rb)) + 0.012, thCc = Math.max(thCC(ra), thCC(rb));
    // limite posterior: termina antes da lâmina escapular (a escápula cobre o espaço; evita interpenetração)
    let th1 = s === 1 ? 1.5 : 1.9;
    for (let th = th0 + 0.2; th <= th1; th += 0.02) {
      const A = ribAtTh(ra, th), Bb = ribAtTh(rb, th);
      const m = A.c.clone().lerp(Bb.c, 0.5).addScaledVector(A.out, 0.3);
      if ([0.15, 0.5, 0.85].some((f) => scap.under(A.c.clone().lerp(Bb.c, f).addScaledVector(A.out, 0.2), 2.5)) || scap.under(m, 2.5)) { th1 = th - 0.06; break; }
    }
    /* Bordas ASSENTADAS nas costelas/cartilagens REAIS: as fileiras de borda ficam (por construção) ~0,6 × meia-altura
       dentro do osso, e as faixas apareciam como listras vermelhas na secção das costelas nos cortes parassagitais
       (cap. 08, x = 5,5: secção da 1ª costela/cartilagem; até ~0,24 cm de músculo dentro das costelas 2–7). Cada vértice
       dentro da costela de CIMA sai pela face inferior dela (raio para baixo); dentro da de BAIXO, pela face superior
       (raio para cima); folga 0,01 cm + "engorda" horizontal de 0,04 cm (pads): os triângulos entre a borda assentada
       e a fileira seguinte não cortam a quina arredondada da costela nem o degrau da junção costocondral. Sem
       suavização laplaciana (ela recuava a borda e abria fresta de ~0,12 cm sob a 1ª costela); medido: borda a
       0,02–0,04 cm do osso, músculo dentro do osso ≤ 0,05 cm (antes 0,13–0,24). Caixa: toda a faixa ± 2,5 cm em y
       (os raios verticais atravessam a costela inteira dentro dela). */
    const bx = new THREE.Box3();
    for (let th = th0 - 0.05; th <= Math.max(th1, thCc) + 0.08; th += 0.04) for (const rr of [ra, rb]) { const q = ribAtTh(rr, th); bx.expandByPoint(q.c); }
    const icBox = [[bx.min.x - 1.2, bx.min.y - 2.5, bx.min.z - 1.2], [bx.max.x + 1.2, bx.max.y + 2.5, bx.max.z + 1.2]];
    const icPads = [[0, 0, 0], [0.04, 0, 0], [-0.04, 0, 0], [0, 0, 0.04], [0, 0, -0.04]];
    const obRibAbove = boneMeshRayOb(['rib-' + s + '-R', 'costal-cartilage-' + s + '-R'], [0, -1, 0], icBox, icPads);
    const obRibBelow = boneMeshRayOb(['rib-' + (s + 1) + '-R', 'costal-cartilage-' + (s + 1) + '-R'], [0, 1, 0], icBox, icPads);
    // 1º espaço: a extremidade esternal entrava ~0,16 cm na borda lateral do manúbrio (mancha vermelha vista "dentro"
    // da secção do manúbrio nos cortes parassagitais x 1–1,8) — sai lateralmente, rente à borda
    const seatIC = (g) => deformSoft(g, (p) => { obRibAbove(p, 0.01); obRibBelow(p, 0.01); if (s === 1) obManuM(p, 0.015); }, { passes: 1, smooth: 0, tol: 0.003 });
    for (const layer of ['ext', 'int', 'memb']) {
      const tA = layer === 'ext' ? thCc - 0.03 : th0, tB = layer === 'memb' ? thCc + 0.02 : th1;
      if (tB <= tA) continue;
      const depth = layer === 'int' ? -0.11 : 0.11;
      const nu = Math.max(8, Math.round((tB - tA) * 46)), nv = 5;
      const f = (u, v) => {
        const th = lerp(tA, tB, u);
        const A = ribAtTh(ra, th), Bb = ribAtTh(rb, th); // (objetos reutilizados: não modificar)
        // borda inferior da costela de cima / superior da de baixo (dentro do osso para esconder a junção)
        const top = s === 1 ? A.c.clone().addScaledVector(A.out, A.ho * 0.45).addScaledVector(A.up, -A.hv * 0.4) : A.c.clone().addScaledVector(A.up, -A.hv * 0.62);
        const bot = Bb.c.clone().addScaledVector(Bb.up, Bb.hv * 0.62);
        const out = A.out.clone().lerp(Bb.out, v).normalize();
        const p = top.lerp(bot, v).addScaledVector(out, depth - 0.04 * Math.sin(Math.PI * v));
        return arr(p);
      };
      if (layer === 'memb') {
        const sh = sheet({ nu, nv, f: (u, v) => { const p = f(u, v); const A = ribAtTh(ra, lerp(tA, tB, u)); return add3(p, arr(A.out), 0.05); }, th: () => 0.05, out: (p) => [p.x, 0, p.z - ZC], iters: 0, tile: 3, uvW: 3, col: COL.apo });
        seatIC(sh.geo);
        addR(sh.geo, MEMB, Object.assign({}, icInfo, { name: 'Membrana intercostal externa — ' + s + 'º espaço (direito)' }));
        continue;
      }
      const sh = sheet({ nu, nv, f, th: (u, v) => 0.17 * (0.75 + 0.25 * Math.sin(Math.PI * v)), out: (p) => [p.x, 0, p.z - ZC], iters: 0, tile: 3.2,
        uvFn: (u, v, a) => { const sLen = (tB - tA) * 9 * u, h = v * 2.2; return layer === 'ext' ? [(sLen + h) / 3.2, (sLen - h) / 3.2] : [(sLen - h) / 3.2, (sLen + h) / 3.2]; },
        col: layer === 'ext' ? COL.deep : COL.dark, tendon: () => 0.06, seed: 70 + s, darkBottom: 0.75 });
      seatIC(sh.geo);
      addR(sh.geo, MUS, Object.assign({}, icInfo, { name: 'Músculo intercostal ' + (layer === 'ext' ? 'externo' : 'interno') + ' — ' + s + 'º espaço (direito)' }));
      if (s === 1 && layer === 'ext') anchors.intercostal1R = sh.at(0.12, 0.5, 1, 0.05);
    }
  }

  /* =====================================================================
     8) Peitoral menor — 3ª–5ª costelas (perto das cartilagens) → processo coracoide
     ===================================================================== */
  let pmSh;
  {
    const ribPt = (ri, x) => { const rb = ribs[ri - 1]; const t = tAt(rb.body, 0, x); let best = 0, bd = 1e9; rb.body.S.forEach((s) => { if (s.c.z > -4 && Math.abs(s.c.x - x) < bd) { bd = Math.abs(s.c.x - x); best = s.t; } }); return onTube(rb.body, best, [0.45, 0.25, 0.85], 0.3); };
    const O = [ribPt(3, 8.8), ribPt(4, 9.65), ribPt(5, 10.35)].map(arr);
    // inserção: borda medial/face superior do coracoide, do joelho (fibras da 3ª costela) à ponta (fibras da 5ª)
    const ins = [0.8, 0.89, 0.98].map((t) => arr(onTube(coracF, t, [-0.85, -0.35, 0.35], 0.16)));
    // bordas medial (3ª costela → joelho do coracoide) e lateral (5ª costela → ponta) interpoladas diretamente: triângulo
    // que converge para o coracoide (borda lateral ~ x 11 na altura da 4ª costela), com leve abaulamento anterior do ventre
    const Oc = v3(O[1]), Ic = v3(ins[1]);
    const row = (r, b) => {
      const c = Oc.clone().lerp(Ic, r), q = Math.pow(r, 1.4);
      return [0, 1, 2].map((k) => { const off = v3(O[k]).sub(Oc).lerp(v3(ins[k]).sub(Ic), q);
        return arr(c.clone().add(off).add(new Vec(0.05, 0.08, 1).normalize().multiplyScalar(b * (1 - 0.35 * Math.abs(k - 1))))); });
    };
    const rows = [O, row(0.26, 0.12), row(0.52, 0.22), row(0.74, 0.32), row(0.9, 0.25), ins]; // assenta na parede (projeção)
    const f0 = ctrlPatch(rows);
    const serr = (u) => 0.1 * Math.pow(Math.sin(2 * Math.PI * u), 2); // origem em três digitações
    pmSh = sheet({
      nu: 24, nv: 34, f: (u, v) => f0(u, serr(u) + v * (1 - serr(u))),
      th: (u, v) => (0.24 + 0.52 * Math.pow(Math.sin(Math.PI * clamp(v / 0.86, 0, 1)), 0.7)) * (0.55 + 0.45 * Math.pow(Math.sin(Math.PI * u), 0.5)) * (v > 0.86 ? 0.8 : 1),
      out: (p) => [0.3, 0.1, 1], obst: [obWall, obAxV, obAxA, obCeph], gap: 0.06, iters: 4, lam: 0.45,
      pin: (i, j) => j === 34 || j === 0, col: COL.deep, tendon: (u, v, w) => [ramp(v, 0.86, w) + 0.35 * (1 - ramp(v, 0.025, w)), band(v, 0.86, w)], uvW: 5, seed: 81, bundles: 4, grooveAmp: 0.1,
    });
    addR(pmSh.geo, MUS, G({ id: 'pec-minor-R', name: 'Músculo peitoral menor direito',
      desc: 'Da 3ª–5ª costelas ao processo coracoide. Divide a artéria axilar em três partes (2ª parte atrás dele); a veia e o plexo passam profundamente a ele, abaixo do coracoide.' }));
    C.solid('mus-pec-minor-R', [0.15, 0.5, 0.85].map((v) => pmSh.at(0.5, v, 0)), 0.25);
    anchors.pecMinorR = pmSh.at(0.5, 0.45, 1, 0.02);
  }
  const obPM = obSheet(pmSh, [0.15, 0.1, 1]);

  /* =====================================================================
     9) Fáscia clavipeitoral — da clavícula (envolvendo o subclávio) ao peitoral menor; coracoide → 1ª costela
     ===================================================================== */
  let fasSh;
  {
    const topE = (u) => arr(onTube(clavF, lerp(0.1, 0.68, u), [0, -0.75, 0.66], 0.03));
    const botE = (u) => pmSh.at(0.02, lerp(0.08, 0.93, u), 1, 0.02); // borda superior do peitoral menor
    const leftC = new THREE.CatmullRomCurve3([v3(topE(0)), new Vec(3.9, -1.0, 0.3), new Vec(5.2, -3.9, 0.75), v3(botE(0))], false, 'centripetal');
    const rightC = new THREE.CatmullRomCurve3([v3(topE(1)), new Vec(12.3, -0.25, 0.32), v3(botE(1))], false, 'centripetal');
    const T0 = v3(topE(0)), T1 = v3(topE(1)), B0 = v3(botE(0)), B1 = v3(botE(1));
    const f = (u, v) => {
      const p = v3(topE(u)).multiplyScalar(1 - v).add(v3(botE(u)).multiplyScalar(v))
        .add(leftC.getPoint(v).multiplyScalar(1 - u)).add(rightC.getPoint(v).multiplyScalar(u))
        .sub(T0.clone().multiplyScalar((1 - u) * (1 - v))).sub(T1.clone().multiplyScalar(u * (1 - v))).sub(B0.clone().multiplyScalar((1 - u) * v)).sub(B1.clone().multiplyScalar(u * v));
      return arr(p);
    };
    fasSh = sheet({ nu: 30, nv: 22, f, th: () => 0.04, out: (p) => [0, 0, 1], obst: [obWall, obSubcl, obAxV, obAxA, obScv, obPM, obClav], gap: 0.08, iters: 5, lam: 0.5,
      pin: (i, j) => j === 0, col: COL.apo, uvW: 8, tile: 8 });
    addR(fasSh.geo, FAS, G({ id: 'clavipectoral-fascia-R', name: 'Fáscia clavipeitoral direita',
      desc: 'Lâmina profunda ao peitoral maior: desdobra-se para envolver o subclávio e desce ao peitoral menor (membrana costocoracoide). Perfurada pela veia cefálica, artéria toracoacromial e nervo peitoral lateral. No trajeto infraclavicular a agulha a atravessa logo após o peitoral maior e, em seguida, o subclávio.', pickTransparent: true }));
    anchors.clavipectoralR = fasSh.at(0.62, 0.35, 1, 0.05);
  }
  const obFas = obSheet(fasSh, [0.1, 0.1, 1]);

  /* =====================================================================
     10) Peitoral maior — partes clavicular, esternocostal e abdominal. Tendão BILAMINAR dobrado em "U" na crista
         do tubérculo maior (Gray): a lâmina anterior recebe as fibras claviculares e esternais superiores (as mais
         laterais da clavícula no alto da lâmina); a lâmina posterior recebe as fibras esternocostais inferiores e
         abdominais, que passam POR TRÁS das superiores e se inserem MAIS ALTO. As lâminas unem-se embaixo (dobra),
         o que forma a prega axilar anterior arredondada, sem "gargalo" torcido.
     ===================================================================== */
  let pMSh;
  {
    const clavO = (t) => arr(onTube(clavF, t, [0, -0.32, 0.95], 0.12));
    const stO = (x, y) => [x, y, LM.sternum.zAnt(y) - 0.035 * x * x + 0.12];
    const humAt = (y) => fAt(humF, tAt(humF, 1, y));
    /** ponto no referencial do úmero: altura y, azimute φ (0 = anterior, 90° = lateral), raio r a partir do eixo da diáfise */
    const hPt = (y, phiD, r) => { const h = humAt(y); return [h.c.x + r * Math.sin(phiD * deg), y, h.c.z + r * Math.cos(phiD * deg)]; };
    const NF = 13, KF = 8, UF = (KF + 0.5) / 12; // 13 fibras-guia; dobra (fundo do "U") entre as fibras 8 e 9
    const lamA = (k) => k / (NF - 1) / UF;                             // 0 (alto) → 1 (dobra) na lâmina anterior
    const lamP = (k) => (k / (NF - 1) - UF) / (1 - UF);                // 0 (dobra) → 1 (alto) na lâmina posterior
    // origens: metade medial da clavícula; face anterior do manúbrio/corpo do esterno; 6ª cartilagem; aponeurose do oblíquo externo
    const O = [clavO(0.62), clavO(0.47), clavO(0.3), clavO(0.12), stO(1.0, -1.1), stO(0.9, -3.4), stO(0.85, -5.7), stO(0.82, -8.0), stO(0.85, -10.2), stO(0.95, -12.3),
      [3.0, -13.9, LM.sternum.zAnt(-13.9) - 0.2], [5.3, -15.6, 3.9], [7.6, -17.0, 3.85]];
    // fileiras sobre a parede costal: (x, y, z mínimo, altura sobre a parede)
    const mid = (k) => { const w = wallPt(k[0], k[1], k[3]); const z = w ? Math.max(w[2], k[2]) : k[2]; return [k[0], k[1], z]; };
    const R1 = [[12.9, -0.95, 1.1, 0.6], [10.9, -1.6, 1.55, 0.75], [8.2, -1.95, 1.7, 0.8], [6.0, -2.35, 1.35, 0.85], [4.3, -3.1, 1.0, 0.85], [3.9, -4.9, 1.3, 0.9], [3.85, -6.9, 1.5, 0.9],
      [3.9, -8.9, 1.6, 0.9], [4.05, -10.8, 2.0, 0.9], [4.4, -12.6, 2.4, 0.9], [5.7, -13.85, 2.7, 0.85], [7.3, -14.6, 2.75, 0.8], [8.9, -15.0, 2.7, 0.7]].map(mid);
    const R2 = [[13.95, -2.85, 1.3, 0.7], [12.55, -3.5, 1.7, 0.8], [11.0, -4.1, 1.95, 0.85], [9.6, -4.75, 1.9, 0.95], [8.75, -5.55, 1.8, 1.0], [8.4, -6.6, 1.65, 1.0], [8.35, -7.75, 1.65, 1.0],
      [8.5, -8.85, 1.75, 1.0], [8.8, -9.85, 1.85, 1.0], [9.25, -10.7, 1.9, 0.95], [9.85, -11.4, 1.85, 0.9], [10.45, -11.85, 1.75, 0.8], [11.05, -12.15, 1.65, 0.7]].map(mid);
    // prega axilar anterior: faixa larga cuja borda inferior começa a enrolar-se para trás em "C" (raio ~1 cm)
    const R3 = [[14.55, -5.2, 1.1], [14.45, -5.85, 1.08], [14.32, -6.5, 1.05], [14.18, -7.15, 1.0], [14.04, -7.8, 0.94], [13.9, -8.45, 0.84], [13.76, -9.1, 0.68],
      [13.62, -9.68, 0.42], [13.5, -10.12, 0.04], [13.45, -10.3, -0.42], [13.48, -10.12, -0.85], [13.55, -9.75, -1.15], [13.64, -9.3, -1.36]];
    // tendão a ~1,4 cm da crista: "U" completo (lâmina anterior φ≈−20°, r 2,1; posterior φ≈−24°, r 1,72)
    const R4 = Array.from({ length: NF }, (_, k) => (k <= KF ? hPt(lerp(-5.4, -8.8, lamA(k)), -20, 2.1) : hPt(lerp(-9.05, -4.35, lamP(k)), -24, 1.72)));
    // inserção: crista do tubérculo maior (lábio lateral do sulco intertubercular), lâminas anterior e posterior
    const R5 = Array.from({ length: NF }, (_, k) => { if (k <= KF) { const y = lerp(-5.7, -8.7, lamA(k)); return hPt(y, 36, humAt(y).rx + 0.5); }
      const y = lerp(-8.95, -3.95, lamP(k)); return hPt(y, 40, humAt(y).rx + 0.15); });
    const f0 = ctrlPatch([O, R1, R2, R3, R4, R5]);
    const nu = 64, nv = 44;
    pMSh = sheet({
      nu, nv, f: f0,
      th: (u, v) => {
        // origem fina/aponeurótica → ventre (massa maior na parte esternocostal e na prega axilar) → tendão
        const peak = 1.0 + 0.45 * sm(0.25, 0.4, u) * (1 - 0.3 * sm(0.8, 1, u));
        const along = v < 0.5 ? lerp(0.24, 1, sm(0, 0.32, v)) : lerp(1, 0.66, sm(0.5, 0.8, v)) * lerp(1, 0.42, sm(0.84, 0.97, v));
        const edge = lerp(0.62, 1, sm(0, 0.13, u)) * lerp(0.55, 1, sm(1, 0.86, u));     // bordas arredondadas
        const cleft = 1 - 0.35 * Math.exp(-(((u - 0.29) / 0.04) ** 2)) * (1 - sm(0.15, 0.5, v)); // sulco clavicular/esternal
        return peak * along * edge * cleft;
      },
      out: (p) => [0.25, 0.05, 1], obst: [obWall, obClav, obClavEnd, (p, d) => obPM(p, d + 0.12), obFas, obSubcl, obAxV, obAxA, obCorac, obHead, obLT, obGT, obHum, obCephEdge],
      gap: 0.07, iters: 4, lam: 0.5, softPasses: 6, pin: (i, j) => j === 0 || j === nv, smoothTop: 12, topMax: 1.4,
      col: COL.mus, tendon: (u, v, w) => [ramp(v, 0.89, w) + lerp(0.12, 0.3, sm(0.3, 0.36, u)) * (1 - ramp(v, 0.02, w)), band(v, 0.89, w)], // origem clavicular carnosa; esternal aponeurótica
      uvW: 24, tileU: 4.2, seed: 91, bundles: 10, grooveAmp: 0.07,
    });
    // origens ASSENTADAS: a face profunda da fileira de origem (fixa) tocava a clavícula e o esterno por dentro
    // (lâmina de ~0,03 cm visível na secção da clavícula no corte do cap. 08; até ~0,15 cm no manúbrio junto ao ângulo
    // esternal). Só os vértices dentro do osso se movem (clavícula: secção exata; esterno: saída anterior), por projeção
    // direta: deslocamentos ≤ 0,15 cm na face profunda, contra o osso (a deformação macia custava ~30 ms nesta lâmina).
    deformWeld(pMSh.geo, (p) => { if (p.y > -0.6 && p.x < 10) obClavX(p, 0.012); if (p.x < 3) obSternAnt(p, 0.012); });
    addR(pMSh.geo, MUS, G({ id: 'pec-major-R', name: 'Músculo peitoral maior direito',
      desc: 'Partes clavicular, esternocostal e abdominal convergindo, por um tendão bilaminar dobrado em "U" (prega axilar anterior), para a crista do tubérculo maior do úmero. No acesso infraclavicular a agulha atravessa a parte clavicular antes de passar sob a clavícula.' }));
    C.solid('mus-pec-major-clav-R', [0.04, 0.3, 0.55].map((v) => pMSh.at(0.12, v, 0)), 0.5);
    C.solid('mus-pec-major-stern-R', [0.1, 0.35, 0.6].map((v) => pMSh.at(0.6, v, 0)), 0.6);
    anchors.pecMajorClavR = pMSh.at(0.1, 0.22, 1, 0.02);
    anchors.pecMajorSternR = pMSh.at(0.62, 0.3, 1, 0.02);
  }
  const obPMaj = obSheet(pMSh, (q) => [q.x - 17.3, 0, q.z + 3.8]);

  let serSh;
  /* =====================================================================
     10b) Serrátil anterior — digitações das costelas 1–8 (face lateral) → face costal da margem medial da escápula;
          a parte inferior converge para o ângulo inferior. Assenta sobre a parede costal, profundo à escápula.
     ===================================================================== */
  {
    const wallPtTh = (th, y, h) => { const r = wallR(th, y); return r > 0 ? [(r + h) * Math.sin(th), y, ZC + (r + h) * Math.cos(th)] : null; };
    // origens por ângulo polar (linha axilar anterior/média), na face externa de cada costela
    const thO0 = [1.32, 1.22, 1.18, 1.18, 1.2, 1.24, 1.3, 1.37];
    const O = thO0.map((th, i) => {
      const rb = ribs[i]; let best = 0, bd = 1e9;
      rb.body.S.forEach((q) => { if (q.t > 0.25) { const d = Math.abs(Math.atan2(q.c.x, q.c.z - ZC) - th); if (d < bd) { bd = d; best = q.t; } } });
      return arr(onTube(rb.body, best, [0.85, 0.1, 0.35], 0.22));
    });
    const ribX = thO0;
    const Sp = LM.scapula;
    const insC = new THREE.CatmullRomCurve3([[6.75, 1.0, -14.55], [6.35, -1.9, -15.05], [6.2, -5.6, -15.3], [6.95, -9.2, -14.75], [8.25, -11.3, -13.85]].map(v3), false, 'centripetal');
    const insT = [0, 0.14, 0.3, 0.48, 0.66, 0.82, 0.92, 1.0];
    const I = insT.map((t) => arr(insC.getPoint(t)));
    const thO = O.map((p) => Math.atan2(p[0], p[2] - ZC)), thI = I.map((p) => Math.atan2(p[0], p[2] - ZC));
    const rowAt = (v) => O.map((o, i) => { const th = lerp(thO[i], thI[i], v), y = lerp(o[1], I[i][1], v) + 0.6 * Math.sin(Math.PI * v); const w = wallPtTh(th, y, 0.32); return w || lerp3(o, I[i], v); });
    const f0 = ctrlPatch([O, rowAt(0.22), rowAt(0.45), rowAt(0.68), rowAt(0.86), I]);
    const nsl = ribX.length - 1, serr = (u) => 0.07 * Math.pow(Math.sin(Math.PI * u * nsl), 2);
    // face costal da escápula: o serrátil só é levado à frente dela onde HÁ espaço entre a lâmina e as costelas
    // (junto à margem medial); onde a escápula do esqueleto cruza as costelas ele permanece fino sobre a parede, oculto
    const obScapSerr = (p, d) => {
      const q = p.clone(); scap.obAnt(q, d); if (q.distanceToSquared(p) < 1e-8) return;
      const dz = q.z - ZC, r = Math.hypot(q.x, dz), w = wallR(Math.atan2(q.x, dz), q.y);
      if (w > 0 && r < w + 0.05) return;
      p.copy(q);
    };
    const sSh = serSh = sheet({
      nu: 56, nv: 26, f: (u, v) => f0(u, serr(u) + v * (1 - serr(u))),
      th: (u, v) => (0.28 + 0.32 * Math.pow(Math.sin(Math.PI * clamp(v * 0.95 + 0.04, 0, 1)), 0.6)) * lerp(0.6, 1, sm(0, 0.08, u)) * lerp(0.6, 1, sm(1, 0.92, u)),
      // a face costal da escápula (obstáculo final) mantém o serrátil PROFUNDO à lâmina escapular
      out: (p) => [p.x, 0, p.z - ZC], obst: [obWall], obstFinal: [obScapSerr], gap: 0.05, iters: 3, lam: 0.45, pin: (i, j) => j === 26,
      // sob a lâmina (oculto pela escápula/infraespinal) a lâmina muscular é afinada: não aflora através do osso
      mask: (p) => scap.under(p, 2.2, 0.15), thMask: 0.08, maskSmooth: 2,
      col: COL.deep, tendon: (u, v, w) => 0.3 * (1 - ramp(v, 0.03, w)) + 0.5 * ramp(v, 0.95, w), uvW: 18, seed: 121, bundles: nsl, grooveAmp: 0.14,
    });
    addR(sSh.geo, MUS, G({ id: 'serratus-anterior-R', name: 'Músculo serrátil anterior direito',
      desc: 'Digitações das oito costelas superiores à face costal da margem medial da escápula, passando PROFUNDAMENTE à escápula; forma a parede medial da axila, lateral ao trajeto infraclavicular.' }));
    anchors.serratusR = sSh.at(0.55, 0.12, 1, 0.02);
  }

  /* =====================================================================
     10c) Manguito rotador posterior — supraespinal, infraespinal e redondo menor, assentados na face posterior
          da escápula e convergindo às facetas superior, média e inferior do tubérculo maior. Dão ao deltoide e ao
          trapézio o leito real (sem "casca oca").
     ===================================================================== */
  const hc = v3(Hm.headCenter), headR = Hm.headR * 1.02;
  const headPt = (dir, off) => arr(hc.clone().addScaledVector(v3(dir).normalize(), headR + off));
  const GTc = v3(Hm.greaterTubercle), GTr = [1.15, 1.5, 1.35];
  const gtPt = (dir, off) => { const d = v3(dir).normalize(), t = 1 / Math.hypot(d.x / GTr[0], d.y / GTr[1], d.z / GTr[2]); return arr(GTc.clone().addScaledVector(d, t + off)); };
  const obGlen = obEllipsoid([14.18, -1.91, -5.66], [0.8, 1.95, 1.1]), obNeck = obSphere(Sc.neck, 1.05);
  const cuffHint = (q) => { const d = new Vec(q.x - hc.x, q.y - hc.y, q.z - hc.z); return d.length() < headR + 1.6 ? arr(d) : scap.outHint(q); };
  const vS = scap.vSpine;
  const across = (nf, fn) => Array.from({ length: nf }, (_, k) => fn(k / (nf - 1)));
  const rowScap = (nf, u, v0, v1, off) => across(nf, (a) => scap.post(u, lerp(v0, v1, a), off));
  // além da face posterior da escápula, o envoltório costal (+ serrátil afinado): na escápula do esqueleto as costelas
  // laterais chegam a cruzar a lâmina — o manguito passa por fora de ambos
  const obWallCuff = (p, d) => obWall(p, d + 0.14);
  const obSerrCuff = obSheet(serSh, (q) => [q.x, 0, q.z - ZC]);
  const cuffObst = [scap.obPost, obWallCuff, obSerrCuff, obSpine, obAcrom, obGlen, obNeck, obGT, obHum, obHead];
  let infSh, supSh, tmSh;
  {
    // infraespinal: fossa infraespinal (margem medial abaixo da espinha) → faceta MÉDIA do tubérculo maior
    const nf = 7, rows = [
      rowScap(nf, 0.035, 0.18, vS(0.035) - 0.06, 0.4),
      rowScap(nf, 0.3, 0.21, vS(0.3) - 0.05, 0.75),
      rowScap(nf, 0.6, 0.37, vS(0.6) - 0.04, 0.8),
      rowScap(nf, 0.88, 0.6, Math.min(0.95, vS(0.88) - 0.03), 0.7),
      across(nf, (a) => headPt([0.24, lerp(-0.5, -0.02, a), -1], 0.5)),
      across(nf, (a) => gtPt([0.62, lerp(-0.22, 0.32, a), -0.78], 0.08)),
    ];
    const f0 = ctrlPatch(rows);
    infSh = sheet({ nu: 20, nv: 28, f: f0,
      th: (u, v) => (v < 0.8 ? 0.3 + 1.15 * Math.pow(Math.sin(Math.PI * clamp(v / 0.8, 0, 1) * 0.94 + 0.05), 0.7) : lerp(0.55, 0.3, sm(0.8, 0.96, v))) * lerp(0.45, 1, sm(0, 0.18, u)) * lerp(0.55, 1, sm(1, 0.85, u)),
      out: cuffHint, obst: cuffObst, gap: 0.05, iters: 4, lam: 0.45, pin: (i, j) => j === 28, smoothTop: 10,
      col: COL.deep, tendon: (u, v, w) => [ramp(v, 0.86, w) + 0.35 * (1 - ramp(v, 0.03, w)), band(v, 0.86, w)], uvW: 9, seed: 131, bundles: 5, grooveAmp: 0.08 });
    addR(infSh.geo, MUS, G({ id: 'infraspinatus-R', name: 'Músculo infraespinal direito',
      desc: 'Manguito rotador: da fossa infraespinal à faceta média do tubérculo maior; rotador lateral do braço, profundo ao deltoide e ao trapézio.' }));
  }
  {
    // redondo menor: 2/3 superiores da margem lateral (face posterior) → faceta INFERIOR do tubérculo maior
    const nf = 5, obInfTmp = obSheet(infSh, cuffHint), rows = [
      rowScap(nf, 0.84, 0.27, 0.48, 0.5),
      rowScap(nf, 0.97, 0.4, 0.62, 0.7),
      across(nf, (a) => [lerp(14.7, 14.9, a), lerp(-4.75, -3.95, a), lerp(-8.0, -7.55, a)]),
      across(nf, (a) => headPt([0.25, lerp(-0.85, -0.66, a), -1], 0.55)),
      across(nf, (a) => gtPt([0.3, lerp(-1.0, -0.72, a), -0.9], 0.08)),
    ];
    tmSh = sheet({ nu: 10, nv: 22, f: ctrlPatch(rows),
      th: (u, v) => (v < 0.8 ? 0.4 + 1.0 * Math.pow(Math.sin(Math.PI * clamp(v / 0.8, 0, 1) * 0.94 + 0.05), 0.6) : lerp(0.55, 0.3, sm(0.8, 0.96, v))) * lerp(0.6, 1, sm(0, 0.3, u)) * lerp(0.6, 1, sm(1, 0.7, u)),
      out: cuffHint, obst: cuffObst.concat([obInfTmp]), gap: 0.05, iters: 4, lam: 0.45, pin: (i, j) => j === 22, smoothTop: 6,
      col: COL.deep, tendon: (u, v, w) => [ramp(v, 0.86, w) + 0.3 * (1 - ramp(v, 0.04, w)), band(v, 0.86, w)], uvW: 3, seed: 137, bundles: 2, grooveAmp: 0.06 });
    addR(tmSh.geo, MUS, G({ id: 'teres-minor-R', name: 'Músculo redondo menor direito',
      desc: 'Manguito rotador: da margem lateral da escápula à faceta inferior do tubérculo maior; rotador lateral, abaixo do infraespinal.' }));
  }
  {
    // supraespinal: fossa supraespinal → sob o acrômio, sobre a cabeça → faceta SUPERIOR do tubérculo maior
    const nf = 6, rows = [
      rowScap(nf, 0.07, vS(0.07) + 0.03, 0.975, 0.45),
      rowScap(nf, 0.36, vS(0.36) + 0.03, 0.985, 0.8),
      rowScap(nf, 0.7, vS(0.7) + 0.025, 0.99, 0.8),
      across(nf, (a) => [lerp(14.25, 13.95, a), lerp(-0.1, 0.25, a), lerp(-7.0, -5.45, a)]),
      across(nf, (a) => headPt([lerp(0.0, 0.1, a), 1, lerp(-0.62, -0.12, a)], 0.3)),
      across(nf, (a) => gtPt([-0.05, 1, lerp(-0.5, 0.18, a)], 0.08)),
    ];
    supSh = sheet({ nu: 12, nv: 26, f: ctrlPatch(rows),
      th: (u, v) => (v < 0.58 ? 0.35 + 1.15 * Math.pow(Math.sin(Math.PI * clamp(v / 0.58, 0, 1) * 0.85 + 0.12), 0.7) : lerp(0.9, 0.32, sm(0.58, 0.9, v))) * lerp(0.5, 1, sm(0, 0.25, u)) * lerp(0.5, 1, sm(1, 0.75, u)),
      out: cuffHint, obst: cuffObst.concat([obClav, obCorac]), gap: 0.05, iters: 4, lam: 0.45, pin: (i, j) => j === 26, smoothTop: 6,
      col: COL.deep, tendon: (u, v, w) => [ramp(v, 0.755, w) + 0.35 * (1 - ramp(v, 0.03, w)), band(v, 0.755, w)], uvW: 4, seed: 141, bundles: 3, grooveAmp: 0.06 });
    addR(supSh.geo, MUS, G({ id: 'supraspinatus-R', name: 'Músculo supraespinal direito',
      desc: 'Manguito rotador: da fossa supraespinal, sob o acrômio e sobre a cabeça do úmero, à faceta superior do tubérculo maior; profundo ao trapézio e ao deltoide.' }));
  }
  const obInf = obSheet(infSh, cuffHint), obSup = obSheet(supSh, cuffHint), obTMin = obSheet(tmSh, cuffHint);
  anchors.infraspinatusR = infSh.at(0.5, 0.35, 1, 0.02);
  anchors.supraspinatusR = supSh.at(0.5, 0.3, 1, 0.02);
  anchors.teresMinorR = tmSh.at(0.5, 0.45, 1, 0.02);

  /* =====================================================================
     11) Deltoide — partes clavicular, acromial e espinal → tuberosidade deltóidea (V); envolve a cabeça umeral
     ===================================================================== */
  let dSh;
  {
    const nf = 9, keyU = Array.from({ length: nf }, (_, i) => i / (nf - 1));
    const O = [
      arr(onTube(clavF, 0.735, [0.15, 0.25, 0.95], 0.1)), arr(onTube(clavF, 0.84, [0.2, 0.35, 0.9], 0.1)), arr(onTube(clavF, 0.95, [0.35, 0.45, 0.8], 0.1)),
      arr(onTube(acromF, 0.98, [0.85, -0.2, -0.1], 0.08)), arr(onTube(acromF, 0.55, [0.75, -0.25, -0.6], 0.08)), arr(onTube(acromF, 0.08, [0.3, -0.3, -0.9], 0.08)),
      arr(onTube(spineF, tAt(spineF, 0, 12.9), [0, -0.7, -0.7], 0.08)), arr(onTube(spineF, tAt(spineF, 0, 10.8), [0, -0.7, -0.7], 0.08)), arr(onTube(spineF, tAt(spineF, 0, 8.7), [0, -0.75, -0.65], 0.08)),
    ];
    const ring = (y, ax, phiD, R) => [ax[0] + R * Math.sin(phiD * deg), y, ax[1] + R * Math.cos(phiD * deg)];
    // borda anterior (u=0) junto à veia cefálica (sulco deltopeitoral estreito); partes posteriores rentes ao manguito
    const phi2 = [-33, -15, 6, 40, 86, 126, 158, 182, 203], R2v = [5.45, 4.55, 4.05, 3.8, 3.72, 3.8, 4.0, 4.3, 4.6], y2 = [-2.0, -1.8, -1.7, -2.0, -2.45, -2.85, -3.25, -3.75, -4.25];
    const phi3 = [-24, 2, 27, 55, 84, 113, 140, 166, 194], R3v = [5.15, 4.2, 3.6, 3.25, 3.08, 3.12, 3.3, 3.7, 4.15];
    const outs = [[0.15, 0, 1], [0.25, 0, 1], [0.45, 0, 0.9], [0.9, 0, 0.4], [1, 0, -0.2], [0.6, 0, -0.8], [0.3, 0, -1], [0.2, 0, -1], [0.15, 0, -1]];
    const R1 = O.map((o, i) => add3(add3(o, outs[i], 0.75 / Math.hypot(...outs[i])), [0, -1.15, 0]));
    const R2 = phi2.map((p, i) => ring(y2[i], [17.25, -3.75], p, R2v[i]));
    const R3 = phi3.map((p, i) => ring(-6.35, [17.55, -3.7], p, R3v[i]));
    // tuberosidade deltóidea em "V" (ápice inferior, ~y −12): fibras anteriores no ramo anterior, posteriores no posterior;
    // o ramo anterior começa lateral à crista do tubérculo maior (inserção do peitoral maior, φ≈38°)
    const vY = (u) => -12.0 + 3.2 * Math.abs(2 * u - 1);
    const ins = keyU.map((u) => {
      const phi = lerp(47, 132, u), y = vY(u), c = fAt(humF, tAt(humF, 1, y));
      return [c.c.x + (c.rx + 0.2) * Math.sin(phi * deg), y, c.c.z + (c.rx + 0.2) * Math.cos(phi * deg)];
    });
    // fileira de aproximação: tangente ao osso (sem "aba" ao chegar à tuberosidade)
    const R4p = keyU.map((u) => { const y = vY(u) + 1.6, c = fAt(humF, tAt(humF, 1, y)); return ring(y, [c.c.x, c.c.z], lerp(8, 140, u), c.rx + lerp(1.6, 0.95, u)); });
    const f0 = ctrlPatch([O, R1, R2, R3, R4p, ins]);
    const nu = 56, nv = 40;
    dSh = sheet({
      nu, nv, f: f0,
      th: (u, v) => {
        const belly = v < 0.84 ? 0.3 + 1.4 * Math.pow(Math.sin(Math.PI * clamp(v / 0.84, 0, 1) * 0.92 + 0.03), 0.75) : lerp(0.75, 0.35, sm(0.84, 0.97, v));
        const part = 1 + 0.12 * Math.exp(-(((u - 0.45) / 0.18) ** 2)); // parte acromial multipenada, mais espessa
        // borda anterior arredondada e espessa (≥ 0,6 cm) no sulco deltopeitoral
        return belly * part * lerp(0.62, 1, sm(0, 0.12, u)) * lerp(0.42, 1, sm(1, 0.82, u));
      },
      out: (p) => [p.x - 17.2, 0.3, p.z + 3.8], obst: [obHeadCuff, obGTCuff, obLT, obHum, obAcrom, obClav, obCorac, obSup, obInf, obTMin, obSpine, obPMaj, obCephDelt, obPM, obCephGroove],
      gap: 0.06, iters: 4, lam: 0.5, pin: (i, j) => j === 0 || j === nv, smoothTop: 12, topMax: 1.35,
      col: COL.mus, tendon: (u, v, w) => [ramp(v, 0.925, w) + 0.3 * (1 - ramp(v, 0.025, w)) + 0.25 * sm(0.64, 0.72, u) * (1 - ramp(v, 0.06, w)), band(v, 0.925, w)],
      uvW: 24, seed: 101, bundles: 11, grooveAmp: 0.12,
    });
    // origem ASSENTADA (a fileira fixa entrava até ~0,23 cm no terço lateral da clavícula) na MALHA REAL da clavícula
    // (saída anterossuperior) e do acrômio (saída lateral, a face da ponta): só os vértices de fato dentro do osso se
    // movem, sem suavização laplaciana (ela recuava a borda). A secção analítica exata (obClavX) é maior que a malha do
    // esqueleto em x 13–15,2 — afastava a origem 0,065–0,09 cm do osso (fenda com entalhe na vista superior do ombro) —
    // e menor junto à articulação acromioclavicular (0,07 cm dentro do osso). Em seguida, a face profunda da borda de
    // origem que ficou a < 0,1 cm é levada ao osso e a parede da borda não corta a quina (clipEdgeWalls). Medido: borda
    // a 0,009–0,014 cm da clavícula em x 13–16,2; ≤ 0,04 cm de músculo dentro do osso.
    const obClavDelt = boneMeshRayOb(['clavicle-R'], [0, 0.35, 0.94], [[11.5, -1.0, -6.0], [18.5, 4.5, 2.0]]);
    const obAcromDelt = boneMeshRayOb(['acromion-R'], [0.95, -0.1, 0.3], [[13.5, -1.5, -9.5], [19.0, 4.5, -2.5]]);
    deformSoft(dSh.geo, (p) => { if (p.x > 12) { obClavDelt(p, 0.012); obAcromDelt(p, 0.012); } }, { passes: 1, smooth: 0, tol: 0.003 });
    clipEdgeWalls(dSh.geo, nu, [0], ['clavicle-R', 'acromion-R'], 0.012, { band: 0.1, test: (p, i) => i <= 16 && p.x > 12.5 });
    addR(dSh.geo, MUS, G({ id: 'deltoid-R', name: 'Músculo deltoide direito',
      desc: 'Do terço lateral da clavícula, acrômio e espinha da escápula à tuberosidade deltóidea. Sua borda anterior forma, com o peitoral maior, o sulco deltopeitoral (veia cefálica) e o trígono clavipeitoral.' }));
    anchors.deltoidR = dSh.at(0.45, 0.4, 1, 0.02);
  }

  /* =====================================================================
     12a) Processos espinhosos REAIS (malhas das vértebras do esqueleto) como mapa de altura da linha média:
          zB(x, y) = z mais posterior dos elementos posteriores em |x| ≤ 1,3 (dilatado ±0,24 × ±0,48 cm, para a grade
          do trapézio, de ~0,45 cm na linha média, não "cortar" a ponta entre amostras). Leito do trapézio e do
          ligamento nucal; acompanha o esqueleto real (p.ex. o espinhoso longo de C7, ponta em z ≈ −12,6).
     ===================================================================== */
  const spineHF = (() => {
    const X0 = -1.6, DX = 0.08, NX = 41, Y0 = -26, DY = 0.08, NY = 476, BIG = 1e9;
    const Z = new Float32Array(NX * NY).fill(BIG), tips = {};
    const bones = layers.bones; bones.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(bones.matrixWorld).invert(), M = new THREE.Matrix4();
    const a = new Vec(), b = new Vec(), c = new Vec(), q = new Vec(), e1 = new Vec(), e2 = new Vec();
    const splat = (x, y, z) => { const i = Math.round((x - X0) / DX), j = Math.round((y - Y0) / DY); if (i < 0 || j < 0 || i >= NX || j >= NY) return; const k = j * NX + i; if (z < Z[k]) Z[k] = z; };
    bones.traverse((o) => {
      const id = o.isMesh && o.userData.info && o.userData.info.id;
      if (!id || !/^vertebra-/.test(id)) return;
      M.multiplyMatrices(inv, o.matrixWorld);
      const pos = o.geometry.attributes.position, idx = o.geometry.index, n = idx ? idx.count : pos.count;
      let tip = null;
      for (let t = 0; t < n; t += 3) {
        a.fromBufferAttribute(pos, idx ? idx.getX(t) : t).applyMatrix4(M);
        b.fromBufferAttribute(pos, idx ? idx.getX(t + 1) : t + 1).applyMatrix4(M);
        c.fromBufferAttribute(pos, idx ? idx.getX(t + 2) : t + 2).applyMatrix4(M);
        if (Math.min(a.x, b.x, c.x) > 1.3 || Math.max(a.x, b.x, c.x) < -1.3) continue;
        // só elementos posteriores (lâminas, espinhosos): o corpo/pedículos nunca limitam o trapézio
        if (Math.min(a.z, b.z, c.z) > LM.spineFront((a.y + b.y + c.y) / 3) - 2.6) continue;
        for (const v of [a, b, c]) if (Math.abs(v.x) < 1 && (!tip || v.z < tip.z)) tip = v.clone();
        const ns = Math.max(1, Math.ceil(Math.max(a.distanceTo(b), a.distanceTo(c), b.distanceTo(c)) / 0.07));
        e1.subVectors(b, a); e2.subVectors(c, a);
        for (let i = 0; i <= ns; i++) for (let j = 0; i + j <= ns; j++) { q.copy(a).addScaledVector(e1, i / ns).addScaledVector(e2, j / ns); splat(q.x, q.y, q.z); }
      }
      if (tip) tips[id.slice(9)] = arr(tip);
    });
    // dilatação (mínimo de z, separável: ±0,24 cm em x, ±0,48 cm em y) — ponta romba equivalente para a grade grossa
    const Dx = new Float32Array(NX * NY).fill(BIG), D = new Float32Array(NX * NY).fill(BIG), ri = 3, rj = 6;
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { let m = BIG; for (let di = Math.max(0, i - ri); di <= Math.min(NX - 1, i + ri); di++) { const z = Z[j * NX + di]; if (z < m) m = z; } Dx[j * NX + i] = m; }
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { let m = BIG; for (let dj = Math.max(0, j - rj); dj <= Math.min(NY - 1, j + rj); dj++) { const z = Dx[dj * NX + i]; if (z < m) m = z; } D[j * NX + i] = m; }
    /** z mais posterior do osso perto de (x, y) (mínimo das 4 células vizinhas); BIG se não há osso */
    const zAt = (x, y) => {
      const fi = (x - X0) / DX, fj = (y - Y0) / DY, i = Math.floor(fi), j = Math.floor(fj);
      if (i < 0 || j < 0 || i >= NX - 1 || j >= NY - 1) return BIG;
      return Math.min(D[j * NX + i], D[j * NX + i + 1], D[(j + 1) * NX + i], D[(j + 1) * NX + i + 1]);
    };
    /** obstáculo: mantém o ponto POSTERIOR ao osso (desloca só em −z) */
    const ob = (p, d) => { const z = zAt(p.x, p.y); if (z < BIG && p.z > z - d) p.z = z - d; };
    return { zAt, ob, tips, BIG };
  })();

  /* =====================================================================
     12) Trapézio — fibras superiores (corte em y = 11), médias e inferiores; inserção no terço lateral
         da clavícula, acrômio e espinha da escápula. Parte cervical sobre o ligamento nucal: a nuca fica ~3 cm
         atrás das pontas dos espinhosos C4–C6 (AP do pescoço ≈ 13 cm com a pele) e a aponeurose em losango
         (C6–T3), fina, deixa saliente a ponta de C7 (vértebra proeminente).
     ===================================================================== */
  let trapNuchal = null; // linha média da face profunda do trapézio cervical (para o ligamento nucal)
  {
    const tipZ = (y) => LM.spinousTipZ(y);
    const midZ = (y) => tipZ(y) - 0.42;
    // origem: borda do corte (anterior → linha média) e linha média (ligamento nucal → T12)
    const xm = -0.025; // a linha média é ligeiramente ultrapassada para que as metades D/E se encontrem sem fresta
    const O = [[5.55, 11, -7.75], [3.6, 11, -11.25], [xm, 11, midZ(11)], [xm, 6.6, midZ(6.6)], [xm, 2.4, midZ(2.4)], [xm, -2.0, midZ(-2.0)], [xm, -7.2, midZ(-7.2)], [xm, -12.8, midZ(-12.8)], [xm, -18.4, midZ(-18.4)], [xm, -23.6, midZ(-23.6)]];
    const clavPost = (t, off) => arr(onTube(clavF, t, [-0.25, 0.55, -0.8], off));
    const ins = [clavPost(0.7, 0.12), clavPost(0.86, 0.12), arr(onTube(acromF, 0.95, [-0.4, 0.75, -0.2], 0.12)), arr(onTube(acromF, 0.5, [-0.55, 0.7, 0.1], 0.12)),
      arr(onTube(spineF, tAt(spineF, 0, 13.6), [0, 0.8, -0.6], 0.12)), arr(onTube(spineF, tAt(spineF, 0, 11.6), [0, 0.75, -0.65], 0.12)), arr(onTube(spineF, tAt(spineF, 0, 9.4), [0, 0.6, -0.8], 0.12)),
      arr(onTube(spineF, tAt(spineF, 0, 7.6), [0, 0.2, -0.95], 0.14)), arr(onTube(spineF, tAt(spineF, 0, 6.7), [-0.2, -0.3, -0.95], 0.16)), arr(onTube(spineF, 0.0, [-0.3, -0.6, -0.75], 0.18))];
    const R1 = [[7.35, 7.4, -6.35], [6.8, 8.3, -10.6], [4.8, 8.4, -13.75], [4.6, 5.0, -14.6], [4.4, 1.6, -15.75], [3.6, -2.35, -16.35], [3.1, -6.6, -16.6], [2.8, -11.6, -16.45], [2.7, -16.3, -16.2], [2.6, -20.7, -15.9]];
    const R2 = [[9.65, 4.25, -4.1], [10.6, 5.0, -7.2], [10.0, 4.65, -11.0], [9.3, 3.15, -13.0], [8.4, 1.25, -15.1], [6.9, -1.6, -16.45], [5.85, -4.6, -16.7], [5.1, -8.0, -16.65], [4.6, -11.4, -16.45], [4.25, -14.8, -16.25]];
    const f0 = ctrlPatch([O, R1, R2, ins]);
    /* Nuca anteriorizada: a face posterior do pescoço (antes −14,5 em y = 8, AP ≈ 15 cm com a pele) avança ~2 cm.
       Campo Δz(x, y, z): pleno na nuca (x ≤ 5,5, partes posteriores z < −11,5); zero na borda anterior do músculo
       (z > −8), no ombro (x ≥ 10, inserções) e no dorso torácico; a rampa inferior começa em T1–T2 na linha média e
       sobe lateralmente (yR), de modo que o ângulo superior da escápula e o supraespinal não são tocados. */
    const yR = (x) => 0.4 + 0.15 * Math.max(0, x - 2);
    const dZ = (x, y, z) => ((1.95 + 0.2 * sm(0.5, 2.5, Math.abs(x))) * sm(yR(x), yR(x) + 2.6, y) - 0.2 * sm(9, 11, y)) * sm(-8, -11.5, z) * (1 - sm(5.5, 10, x));
    // aponeurose em losango (speculum rhomboideum) em coordenadas físicas: C6 (y 6,6) → T3 (y −2,2), meia-largura
    // máxima ~2,3 cm na altura de C7–T1 (y ≈ 3)
    const diaK = (x, y) => {
      const s = (y + 2.2) / 8.8; if (s <= 0 || s >= 1) return 0;
      const hw = 2.3 * Math.pow(Math.sin(Math.PI * Math.pow(s, 1.32)), 0.6);
      // rampa ~0,7 cm, ALARGADA onde a meia-largura é pequena (ápices: hw varia depressa e a grade de ~0,45 × 0,4 cm
      // produzia degraus na metade superior do losango)
      const rw = 0.35 + 0.45 * (1 - sm(0.4, 1.4, hw));
      return sm(-rw, rw + 0.05, hw - Math.abs(x));
    };
    const thBase = (u, v) => {
      const reg = lerp(1.25, 0.55, sm(0.12, 0.62, u)); // espesso no pescoço, fino nas fibras inferiores
      const prof = 0.35 + 0.65 * Math.pow(Math.sin(Math.PI * clamp(v * 0.95 + 0.04, 0, 1)), 0.6);
      return reg * prof * lerp(0.55, 1, sm(0, 0.08, u)) * lerp(0.6, 1, sm(1, 0.9, u));
    };
    const fT = (u, v) => {
      const p = f0(u, v), z1 = p[2] + dZ(p[0], p[1], p[2]);
      const pp = [p[0], p[1], z1], k = diaK(pp[0], pp[1]);
      // pré-assentamento sobre os espinhosos (mínimo suave, sem vinco): vale também para a linha média fixada (pin)
      const zb = spineHF.zAt(pp[0], pp[1]);
      if (zb < spineHF.BIG) { const lim = zb - (thBase(u, v) * (1 - 0.5 * k) / 2 + 0.1), h = 0.35; pp[2] = z1 - h * Math.log(1 + Math.exp((z1 - lim) / h)); }
      return pp;
    };
    // nu 80 (antes 56): ~0,45 cm por coluna na linha média cervical — borda do losango e saliência de C7 sem degraus
    const nu = 80, nv = 32;
    const tSh = sheet({
      nu, nv, f: fT,
      // a aponeurose em losango é fina (~metade da espessura muscular vizinha)
      th: (u, v) => { const p = fT(u, v); return thBase(u, v) * (1 - 0.5 * diaK(p[0], p[1])); },
      out: (p) => [p.x * 0.3, 0.4, -1], obst: [obClav, obAcrom, obSpine, obSup, obInf, obScapSup, scap.obPost, spineHF.ob],
      gap: 0.12, iters: 5, lam: 0.42, softPasses: 5, pin: (i, j) => j === nv || (j === 0 && i > 12),
      col: COL.mus, tendon: (u, v, w, p) => {
        // losango aponeurótico definido no espaço físico (borda lisa, sem o serrilhado do losango em u,v); aponeurose
        // das fibras inferiores sobre o tubérculo da espinha (borda nítida, alinhada à grade)
        const kd = diaK(p.x, p.y);
        return [0.9 * kd + 0.3 * (1 - ramp(v, 0.02, w)) * sm(0.25, 0.35, u) + ramp(v, 0.925, w) * sm(0.6, 0.75, u) * 0.8,
          0.8 * band(v, 0.925, w) * sm(0.6, 0.75, u) + 2 * kd * (1 - kd)]; // junção na borda do losango
      },
      uvW: 30, seed: 111, bundles: 12, grooveAmp: 0.1,
    });
    // inserção clavicular ASSENTADA (entrava até ~0,22 cm no terço lateral da clavícula), como no deltoide: malha REAL
    // da clavícula e do acrômio, saída posterossuperior e um pouco lateral (restavam até 0,074 cm dentro do osso em
    // x 14,5–16 com a secção analítica; agora ≤ 0,02 cm, salvo ~0,07 na quina da extremidade acromial da clavícula)
    const obClavTrap = boneMeshRayOb(['clavicle-R', 'acromion-R'], [0.35, 0.55, -0.75], [[11.5, -1.0, -9.5], [18.5, 4.5, 2.0]]);
    deformSoft(tSh.geo, (p) => { if (p.x > 12) obClavTrap(p, 0.012); }, { passes: 1, smooth: 0, tol: 0.003 });
    // + borda de inserção levada ao osso no terço lateral da clavícula (x 11,4–13,7 ficava 0,12–0,16 cm afastada da
    // margem posterior: fresta escura entre o trapézio e a clavícula na vista superior do ombro)
    clipEdgeWalls(tSh.geo, nu, [nv], ['clavicle-R', 'acromion-R'], 0.012, { band: 0.32, test: (p, i) => i <= 15 && p.x > 11 });
    addR(tSh.geo, MUS, G({ id: 'trapezius-R', name: 'Músculo trapézio direito',
      desc: 'Fibras superiores, médias e inferiores da linha média (ligamento nucal, processos espinhosos) ao terço lateral da clavícula, acrômio e espinha da escápula; limite posterior do trígono cervical posterior.' }));
    anchors.trapeziusR = tSh.at(0.12, 0.45, 1, 0.02);
    // linha média da face profunda (origem, v = 0) entre y 11 e C7, para o ligamento nucal
    trapNuchal = [];
    // (a face profunda junto à rafe é a mais anterior entre a borda de origem e a 1ª fileira: o septo, com ±0,1 cm de
    // largura, não a atravessa)
    for (let k = 0; k <= 60; k++) { const uu = lerp(0.2, 0.5, k / 60), q = tSh.at(uu, 0, -1), q1 = tSh.at(uu, 1 / 32, -1); q[2] = Math.max(q[2], q1[2]); if (q[1] <= 11.001 && q[1] >= 3) trapNuchal.push(q); }
  }

  /* =====================================================================
     12b) Ligamento nucal — septo mediano das pontas dos espinhosos C4–C7 até a face profunda do trapézio
          (parte funicular, onde o trapézio se origina); corte em y = 11
     ===================================================================== */
  {
    const T = spineHF.tips, tipPts = ['C4', 'C5', 'C6', 'C7'].filter((n) => T[n]).map((n) => T[n]);
    if (tipPts.length >= 2 && trapNuchal.length >= 4) {
      const yLo = T.C7 ? T.C7[1] + 0.05 : tipPts[tipPts.length - 1][1];
      // borda anterior: pelas pontas (0,08 cm dentro do osso — inserção sem fresta), prolongada até o corte
      const a0 = tipPts[0], a1 = tipPts[1], up = [0, 11.2, a0[2] + (a0[2] - a1[2]) / (a0[1] - a1[1]) * (11.2 - a0[1]) * 0.6];
      const lowC = new THREE.CatmullRomCurve3([up].concat(tipPts).map((q) => new Vec(0, q[1], q[2] + 0.08)), false, 'centripetal');
      const lowS = lowC.getPoints(80);
      const zLow = (y) => { let best = lowS[0], bd = 1e9; for (const q of lowS) { const d = Math.abs(q.y - y); if (d < bd) { bd = d; best = q; } } return best.z; };
      const back = trapNuchal.slice().sort((p, q) => p[1] - q[1]);
      const zBack = (y) => { for (let k = 1; k < back.length; k++) if (y <= back[k][1]) { const p = back[k - 1], q = back[k], w = (y - p[1]) / Math.max(1e-6, q[1] - p[1]); return lerp(p[2], q[2], w); } return back[back.length - 1][2]; };
      const yTop = Math.min(11, back[back.length - 1][1]);
      const sh = sheet({ nu: 28, nv: 4, iters: 0, th: (u, v) => 0.2 * (0.6 + 0.4 * Math.sin(Math.PI * v)), out: () => [1, 0, 0],
        // borda posterior 0,06 cm à frente da face profunda do trapézio; anterior nas pontas dos espinhosos
        f: (u, v) => { const y = lerp(yLo, yTop, u), zl = zLow(y), zb = Math.min(zBack(y) + 0.06, zl - 0.02); return [0, y, lerp(zl, zb, v)]; },
        // fibras (v da textura) no sentido craniocaudal, como na parte funicular
        uvFn: (u, v) => [v * 0.8, u * (yTop - yLo) / 2.5], col: COL.apo });
      addR(sh.geo, LIG, G({ id: 'nuchal-ligament', name: 'Ligamento nucal',
        desc: 'Septo fibroso mediano da nuca, das pontas dos processos espinhosos cervicais (C7 = vértebra proeminente, palpável) à protuberância occipital externa; origem da parte descendente do trapézio.' }), { noMirror: true });
      anchors.nuchalLig = arr(new Vec(0, 7.5, (zLow(7.5) + zBack(7.5)) / 2));
    }
  }

  /* =====================================================================
     Espelhamento (lado esquerdo) e retorno
     ===================================================================== */
  built.forEach(({ m, info }) => { const ml = C.mirrorMesh(m, LAY, toL(info)); ml.castShadow = m.castShadow; ml.renderOrder = m.renderOrder; });

  return { anchors: Object.fromEntries(Object.entries(anchors).map(([k, v]) => [k, v.map((x) => +(+x).toFixed(2))])) };
});
