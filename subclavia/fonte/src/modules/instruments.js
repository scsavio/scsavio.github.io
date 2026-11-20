/* ==========================================================================
   instruments.js — mão esquerda do operador (luva estéril), agulha introdutora
   18G + seringa de 5 mL, fio-guia em J, cateter venoso central 7 Fr triplo
   lúmen e auxílios didáticos (vetor do polegar, marcadores, plano coronal e
   ângulo de inclinação).
   Camadas: hand, instrument, aids.
   Coordenadas ANATÔMICAS (x = direita do paciente, y cranial, z anterior; cm).
   A mão é um ativo GLB de mão ESQUERDA (WebXR generic-hand, MIT). Ela é montada
   sob um grupo com scale.x = −1, que cancela o espelho do mundo: dentro dele
   usamos coordenadas "físicas" P = (−x, y, z), nas quais o produto vetorial tem
   a quiralidade real — assim a mão continua ESQUERDA na tela.
   Os instrumentos NÃO recebem os planos de corte (ficam visíveis à frente do
   corte parassagital, que é o uso didático).
   Princípios: a mão tem ESCALA FIXA (anatômica) e o vão polegar–indicador vem da
   pose; a agulha só avança até o bisel ficar na luz (nunca até o canhão);
   fio-guia e cateter seguem eixos derivados de LM.vessels, com autoverificação
   de luz; a ponta do cateter fica acima do átrio direito medido na malha do
   coração; o trecho externo do cateter assenta na pele ou no campo estéril.
   ========================================================================== */
ATLAS.define('instruments', async function (ctx) {
  'use strict';
  const { THREE, C, LM, layers } = ctx;
  const GI = (k) => Object.assign({ group: 'Instrumentos' }, k);
  const NL = LM.needle;
  const anchors = {};
  const T0 = performance.now(), prof = {}; const mark = (k) => { prof[k] = Math.round(performance.now() - T0); };
  const phys = (p) => [-p[0], p[1], p[2]];          // anatômico ↔ físico (involução)
  const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const setA = (key, p) => { if (!anchors[key]) anchors[key] = [0, 0, 0]; const a = anchors[key]; a[0] = +p[0]; a[1] = +p[1]; a[2] = +p[2]; return a; };

  /* ======================================================================
     1. Superfície de apoio: mapa de altura z(x,y) da pele (e do campo)
        rasterizado a partir das malhas do módulo "skin" (se existir).
     ====================================================================== */
  function makeField(layerNames) {
    const meshes = [];
    for (const ln of layerNames) {
      const L = layers[ln]; if (!L) continue;
      L.traverse((o) => {
        if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
        const id = o.userData.info && o.userData.info.id;
        if (id === 'subcutaneous') return; // superfície interna — não é apoio
        meshes.push(o);
      });
    }
    if (!meshes.length) return null;
    const X0 = -8, Y0 = -20, H = 0.25, NX = 124, NY = 168; // x ∈ [−8, 22.75], y ∈ [−20, 21.75]
    const Z = new Float32Array(NX * NY).fill(-1e9);
    ctx.world.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(ctx.world.matrixWorld).invert();
    const M = new THREE.Matrix4(), v = new THREE.Vector3();
    for (const m of meshes) {
      M.multiplyMatrices(inv, m.matrixWorld);
      const pa = m.geometry.attributes.position, n = pa.count;
      const P = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { v.fromBufferAttribute(pa, i).applyMatrix4(M); P[i * 3] = (v.x - X0) / H; P[i * 3 + 1] = (v.y - Y0) / H; P[i * 3 + 2] = v.z; }
      const ix = m.geometry.index ? m.geometry.index.array : null;
      const tc = ix ? ix.length / 3 : n / 3;
      for (let t = 0; t < tc; t++) {
        const a = ix ? ix[t * 3] : t * 3, b = ix ? ix[t * 3 + 1] : t * 3 + 1, c = ix ? ix[t * 3 + 2] : t * 3 + 2;
        const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2], bx = P[b * 3], by = P[b * 3 + 1], bz = P[b * 3 + 2], cx = P[c * 3], cy = P[c * 3 + 1], cz = P[c * 3 + 2];
        const x0 = Math.max(0, Math.ceil(Math.min(ax, bx, cx))), x1 = Math.min(NX - 1, Math.floor(Math.max(ax, bx, cx)));
        if (x0 > x1) continue;
        const y0 = Math.max(0, Math.ceil(Math.min(ay, by, cy))), y1 = Math.min(NY - 1, Math.floor(Math.max(ay, by, cy)));
        if (y0 > y1) continue;
        const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
        if (Math.abs(det) < 1e-9) continue;
        for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
          const l1 = ((by - cy) * (gx - cx) + (cx - bx) * (gy - cy)) / det;
          const l2 = ((cy - ay) * (gx - cx) + (ax - cx) * (gy - cy)) / det;
          const l3 = 1 - l1 - l2;
          if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
          const z = l1 * az + l2 * bz + l3 * cz, k = gy * NX + gx;
          if (z > Z[k]) Z[k] = z;
        }
      }
    }
    return function (x, y) {
      const fx = (x - X0) / H, fy = (y - Y0) / H, i = Math.floor(fx), j = Math.floor(fy);
      if (i < 0 || j < 0 || i >= NX - 1 || j >= NY - 1) return NaN;
      const u = fx - i, w = fy - j;
      const z00 = Z[j * NX + i], z10 = Z[j * NX + i + 1], z01 = Z[(j + 1) * NX + i], z11 = Z[(j + 1) * NX + i + 1];
      if (Math.min(z00, z10, z01, z11) < -1e8) { const mx = Math.max(z00, z10, z01, z11); return mx < -1e8 ? NaN : mx; }
      return (z00 * (1 - u) + z10 * u) * (1 - w) + (z01 * (1 - u) + z11 * u) * w;
    };
  }
  // Aproximação analítica da face anterior (só é usada se o módulo de pele não existir): tórax + relevo da
  // clavícula (a partir de LM.clavicle) + incisura jugular + pescoço com o relevo do ECM.
  const clavTab = (() => { const cv = C.curve(LM.clavicle.pts), ry = C.profile(LM.clavicle.ry), rh = C.profile(LM.clavicle.rh), t = []; for (let k = 0; k <= 60; k++) { const u = k / 60, p = cv.getPointAt(u); t.push([p.x, p.y, p.z, ry(u), rh(u)]); } return t; })();
  function zApprox(x, y) {
    const ax = Math.min(Math.abs(x), 17);
    const chest = 1.05 + 0.27 * ax - 0.0135 * ax * ax - 0.2 * Math.min(0, y - 0.35);
    const Rn = 6.4 - 0.12 * Math.max(0, y - 0.35), xs = 1.6 + 0.35 * Math.max(0, y - 0.35);
    const neck = -3.2 + 3.4 * Math.sqrt(Math.max(0, 1 - (ax / Rn) ** 2)) + 0.8 * Math.exp(-(((ax - xs) / 1.1) ** 2));
    let z = Math.max(chest - 3.2 * C.smooth(0.4, 3.6, y), y > 0 ? neck : -9);
    z -= 0.55 * Math.exp(-((ax / 1.3) ** 2) - (((y - 0.9) / 1.0) ** 2)); // fossa da incisura jugular
    if (ax > 2.4 && ax < 16.2) { // relevo da clavícula (osso + ~0,55 cm de partes moles)
      let i = 0; while (i < clavTab.length - 2 && clavTab[i + 1][0] < ax) i++;
      const c0 = clavTab[i], c1 = clavTab[i + 1], f = C.clamp((ax - c0[0]) / ((c1[0] - c0[0]) || 1), 0, 1);
      const yc = C.lerp(c0[1], c1[1], f), zc = C.lerp(c0[2], c1[2], f), ry = C.lerp(c0[3], c1[3], f) + 0.9, rh = C.lerp(c0[4], c1[4], f) + 0.55;
      const q = 1 - ((y - yc) / ry) ** 2; if (q > 0) z = Math.max(z, zc + rh * Math.sqrt(q));
    }
    return z;
  }
  const skinField = makeField(['skin']);
  // superfície de apoio (pele + campo estéril). O campo do módulo skin é construído sob demanda (quando a camada
  // 'drape' fica visível): enquanto ele não existe, restField = pele; em update() detectamos a chegada das malhas
  // do campo e refazemos este mapa, reassentando o canhão/extensões do cateter e os dedos 3–5 (ver relayoutOnDrape).
  const countMeshes = (L) => { let n = 0; if (L) L.traverse((o) => { if (o.isMesh) n++; }); return n; };
  let drapeMeshes = countMeshes(layers.drape);
  let drapeField = drapeMeshes ? makeField(['skin', 'drape']) : null;
  let restField = skinField, surfKey = 'skin'; // a superfície com campo só é usada enquanto a camada 'drape' estiver visível
  const hasSkin = !!skinField;
  mark('field');
  const skinZ = (x, y) => { const z = skinField ? skinField(x, y) : NaN; return Number.isFinite(z) ? z : zApprox(x, y); };
  const restZ = (x, y) => { const z = restField ? restField(x, y) : NaN; return Number.isFinite(z) ? z : zApprox(x, y); };
  const surfNormal = (fz, x, y, e = 0.35) => { const n = new THREE.Vector3(-(fz(x + e, y) - fz(x - e, y)) / (2 * e), -(fz(x, y + e) - fz(x, y - e)) / (2 * e), 1); return n.normalize(); };
  // anatômico ↔ mundo (o mundo é espelhado em x pelo motor)
  ctx.world.updateMatrixWorld(true);
  const W2A = new THREE.Matrix4().copy(ctx.world.matrixWorld).invert();
  /** Maior penetração (cm) dos vértices de um objeto abaixo de fz + clear (amostragem a cada `step` vértices). */
  function penetration(obj, fz, clear = 0, step = 3) {
    obj.updateWorldMatrix(true, true);
    const M = new THREE.Matrix4(), v = new THREE.Vector3(); let mx = -1e9;
    obj.traverse((o) => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
      M.multiplyMatrices(W2A, o.matrixWorld); const pa = o.geometry.attributes.position;
      for (let i = 0; i < pa.count; i += step) { v.fromBufferAttribute(pa, i).applyMatrix4(M); const d = fz(v.x, v.y) + clear - v.z; if (d > mx) mx = d; }
    });
    return mx;
  }

  /* ======================================================================
     2. Trajeto da agulha (retilíneo): entrySkin → veinTarget
     ====================================================================== */
  const P0 = v3(NL.entrySkin), PT = v3(NL.veinTarget);
  const dir = PT.clone().sub(P0); const sVein = dir.length(); dir.normalize();
  const along = (s) => P0.clone().addScaledVector(dir, s);
  // ponto em que a reta cruza a pele efetiva (busca simples ao longo da reta)
  let sSkin = 0;
  { let best = 1e9, sb = 0; for (let s = -1.2; s <= 1.2; s += 0.02) { const p = along(s); const d = Math.abs(p.z - skinZ(p.x, p.y)); if (d < best) { best = d; sb = s; } } if (best < 0.3) sSkin = sb; }
  const entryEff = along(sSkin);
  const sClav = (P0.x - 7.5) / -dir.x;                 // ponta sob a clavícula (x ≈ 7,5)

  /* ---- 2b. Luz venosa (de LM.vessels): eixo contínuo com raio, para derivar fio, cateter e profundidade ---- */
  const vs = LM.vessels;
  /** Tabela amostrada (≈0,03 cm) de uma cadeia de vasos: [{p, r, s}] com s = comprimento de arco. */
  function chainTable(parts, n = 700) {
    const P = [], R = [];
    parts.forEach((pt, i) => { const rr = Array.isArray(pt.r) ? pt.r : pt.pts.map(() => pt.r); pt.pts.forEach((p, k) => { if (i > 0 && k === 0) return; P.push(p); R.push(rr[k]); }); });
    const cv = C.curve(P), m = P.length - 1, tab = []; let s = 0, prev = null;
    for (let j = 0; j <= n; j++) { const t = j / n, p = cv.getPoint(t); if (prev) s += p.distanceTo(prev); prev = p; const f = t * m, i = Math.min(m - 1, Math.floor(f)); tab.push({ p, r: C.lerp(R[i], R[i + 1], f - i), s }); }
    tab.L = s; return tab;
  }
  const nearestOn = (tab, q) => { let k = 0, d = 1e9; for (let i = 0; i < tab.length; i++) { const dd = tab[i].p.distanceToSquared(q); if (dd < d) { d = dd; k = i; } } return { k, d: Math.sqrt(d), r: tab[k].r, s: tab[k].s }; };
  const atS = (tab, s) => {
    s = C.clamp(s, 0, tab.L); let i = 1; while (i < tab.length - 1 && tab[i].s < s) i++;
    const a = tab[i - 1], b = tab[i], f = (s - a.s) / ((b.s - a.s) || 1);
    return { p: a.p.clone().lerp(b.p, f), r: C.lerp(a.r, b.r, f), T: b.p.clone().sub(a.p).normalize() };
  };
  const sAtY = (tab, y, sFrom = 0) => { for (let i = 1; i < tab.length; i++) if (tab[i].s >= sFrom && tab[i].p.y <= y && tab[i - 1].p.y > y) { const f = (tab[i - 1].p.y - y) / (tab[i - 1].p.y - tab[i].p.y); return C.lerp(tab[i - 1].s, tab[i].s, f); } return null; };
  const sAtYUp = (tab, y, sFrom = 0) => { for (let i = 1; i < tab.length; i++) if (tab[i].s >= sFrom && tab[i].p.y >= y && tab[i - 1].p.y < y) { const f = (y - tab[i - 1].p.y) / (tab[i].p.y - tab[i - 1].p.y); return C.lerp(tab[i - 1].s, tab[i].s, f); } return null; };
  // trajeto esperado: axilar (trecho final) → subclávia → braquiocefálica D → VCS; anômalo: subclávia → VJI (ascendente)
  const axTail = { pts: vs.axillaryV.pts.slice(-3), r: vs.axillaryV.r.slice(-3) };
  const tabMain = chainTable([axTail, vs.scv, vs.rbcv, vs.svc]);
  const tabMal = chainTable([axTail, vs.scv, { pts: vs.ijvR.pts.slice().reverse(), r: vs.ijvR.r.slice().reverse() }], 600);
  // parede anterior da subclávia: primeiro ponto do trajeto da agulha dentro do raio da veia
  let sWall = null;
  for (let s = Math.max(0, sSkin); s <= sVein + 1.5; s += 0.01) { const q = nearestOn(tabMain, along(s)); if (q.d < q.r) { sWall = s; break; } }
  if (sWall === null) sWall = sVein - 1.3;
  /* Fases 4–5: a ponta avança só o suficiente para que todo o bisel (~4 mm) fique na luz — ~5 mm além da parede
     anterior (a agulha cruza a veia em ângulo raso: isso equivale a ~2 mm "radiais" dentro da luz). Nunca até o canhão. */
  const sTip4 = sWall + 0.5;
  // eixo "bisel para cima": componente de +z perpendicular à agulha
  const bevelUp = new THREE.Vector3(0, 0, 1).addScaledVector(dir, -dir.z).normalize();
  const needleQuat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(dir, bevelUp), dir, bevelUp));
  setA('entry', entryEff.toArray());

  /* ======================================================================
     3. Materiais (instâncias próprias — os esmaecimentos não afetam outros módulos)
     ====================================================================== */
  const fineN = C.tex.noiseNormal('fine', { freq: 0.16, strength: 1.6, seed: 8 });
  const PM = (o) => new THREE.MeshPhysicalMaterial(o);
  const mats = {
    steel: PM({ color: '#d9e0e6', metalness: 1, roughness: 0.17, transparent: true, depthWrite: true }),
    wire: PM({ color: '#c9d1d8', metalness: 1, roughness: 0.28, transparent: true, depthWrite: true }),
    hub: PM({ color: '#f08fb2', roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08, transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide }),
    barrel: PM({ color: '#eef6f8', roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.24, depthWrite: false, side: THREE.DoubleSide }),
    rod: PM({ color: '#f4f5f2', roughness: 0.3, clearcoat: 0.4, transparent: true, opacity: 0.94, depthWrite: true }),
    rubber: PM({ color: '#2a2b2f', roughness: 0.55, clearcoat: 0.25, transparent: true, depthWrite: true }),
    blood: PM({ color: '#4d0b12', roughness: 0.22, clearcoat: 0.8, clearcoatRoughness: 0.15, transparent: true, opacity: 0.94, depthWrite: true }),
    bloodHub: PM({ color: '#4d0b12', roughness: 0.22, clearcoat: 0.8, clearcoatRoughness: 0.15, transparent: true, opacity: 0.94, depthWrite: true }),
    ink: new THREE.MeshBasicMaterial({ color: '#1b2328', transparent: true, opacity: 0.88, depthWrite: false }),
    cath: PM({ color: '#ffffff', roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.2, transparent: true, depthWrite: true }),
    cathHub: PM({ color: '#e9eef0', roughness: 0.25, clearcoat: 0.8, transparent: true, opacity: 0.97, depthWrite: true }),
    tubing: PM({ color: '#e8f1f2', roughness: 0.12, clearcoat: 1, transparent: true, opacity: 0.62, depthWrite: false }),
    brown: PM({ color: '#6e4128', roughness: 0.35, clearcoat: 0.5, transparent: true, depthWrite: true }),
    blue: PM({ color: '#2d6db5', roughness: 0.35, clearcoat: 0.5, transparent: true, depthWrite: true }),
    white: PM({ color: '#f3f3ef', roughness: 0.35, clearcoat: 0.5, transparent: true, depthWrite: true }),
    wireMal: PM({ color: '#e5a03a', metalness: 0.4, roughness: 0.35, transparent: true, opacity: 0.5, depthWrite: false }),
    gold: new THREE.MeshStandardMaterial({ color: '#c99a3e', emissive: '#6b4a12', emissiveIntensity: 0.55, roughness: 0.35, metalness: 0.3 }),
    marker: new THREE.MeshBasicMaterial({ color: '#c99a3e', transparent: true, opacity: 0.92 }),
    plane: new THREE.MeshBasicMaterial({ color: '#8fd0de', transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }),
    planeEdge: new THREE.MeshBasicMaterial({ color: '#2f8ea3', transparent: true, opacity: 0.7, depthWrite: false }),
    sector: new THREE.MeshBasicMaterial({ color: '#e0b24f', transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }),
    xrayWire: new THREE.MeshBasicMaterial({ color: '#eef4f7', transparent: true, opacity: 0.72, depthWrite: false, depthFunc: THREE.GreaterDepth }),
    xrayCath: new THREE.MeshBasicMaterial({ color: '#fbf7e8', transparent: true, opacity: 0.55, depthWrite: false, depthFunc: THREE.GreaterDepth }),
    xrayMal: new THREE.MeshBasicMaterial({ color: '#f2a93b', transparent: true, opacity: 0.7, depthWrite: false, depthFunc: THREE.GreaterDepth }),
  };
  mats.wire.normalMap = fineN; mats.wire.normalScale = new THREE.Vector2(0.25, 0.25);

  const mesh = (geo, mat, parent, info, o) => C.mesh(geo, mat, parent, info, o);
  // LatheGeometry: normal = perfil girado no sentido horário em (r, y) → percorra subindo pelo lado externo.
  const lathe = (pts, seg = 32) => new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), seg);
  const latheTD = (pts, seg) => lathe(pts.slice().reverse(), seg); // lista escrita do topo (+y) para baixo

  /* ======================================================================
     4. Agulha introdutora 18G (parede fina) + canhão + seringa de 5 mL
        Referencial local: +Y = sentido de avanço (ponta em y=0), +Z = bisel.
     ====================================================================== */
  const NEEDLE_L = 6.35, R_OUT = 0.0635, R_IN = 0.052, BEVEL_DEG = 17;
  /** Cânula oca com bisel real (plano oblíquo); ponta aguda no lado −Z, face do bisel voltada para +Z. */
  function needleGeometry(L, ro, ri, bevelDeg, R) {
    const ta = Math.tan(bevelDeg * Math.PI / 180);
    const yCut = (z) => -(ro + z) / ta;
    const pos = [], nor = [], idx = [];
    const us = [0, 0.35, 0.7, 0.88, 0.95, 1];
    const W = R + 1;
    const wall = (rad, sgn) => { const base = pos.length / 3; for (let j = 0; j < us.length; j++) for (let k = 0; k <= R; k++) { const th = (k / R) * Math.PI * 2, x = rad * Math.sin(th), z = rad * Math.cos(th); pos.push(x, -L + (yCut(z) + L) * us[j], z); nor.push(sgn * Math.sin(th), 0, sgn * Math.cos(th)); } return base; };
    const o = wall(ro, 1), i = wall(ri, -1);
    for (let j = 0; j < us.length - 1; j++) for (let k = 0; k < R; k++) {
      const a = o + j * W + k; idx.push(a, a + 1, a + W, a + 1, a + W + 1, a + W);
      const b = i + j * W + k; idx.push(b, b + W, b + 1, b + 1, b + W, b + W + 1);
    }
    const nb = new THREE.Vector3(0, ta, 1).normalize();
    const bo = pos.length / 3;
    for (let k = 0; k <= R; k++) { const th = (k / R) * Math.PI * 2; for (const rad of [ro, ri]) { const x = rad * Math.sin(th), z = rad * Math.cos(th); pos.push(x, yCut(z), z); nor.push(nb.x, nb.y, nb.z); } }
    for (let k = 0; k < R; k++) { const a = bo + k * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const bb = pos.length / 3;
    for (let k = 0; k <= R; k++) { const th = (k / R) * Math.PI * 2; for (const rad of [ro, ri]) { pos.push(rad * Math.sin(th), -L, rad * Math.cos(th)); nor.push(0, -1, 0); } }
    for (let k = 0; k < R; k++) { const a = bb + k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    return g;
  }
  const L_HUB0 = -NEEDLE_L, L_HUB1 = -NEEDLE_L - 1.6; // canhão: do "nariz" (−6,35) à boca (−7,95)
  const needleAsm = new THREE.Group(); needleAsm.name = 'Agulha + seringa'; layers.instrument.add(needleAsm);
  needleAsm.quaternion.copy(needleQuat);
  const needleGrp = new THREE.Group(); needleAsm.add(needleGrp);
  const infoNeedle = GI({ id: 'needle', name: 'Agulha introdutora 18G de parede fina (6,35 cm)', desc: 'Bisel voltado para cima; avança rente à face posterior da clavícula, rumo à incisura jugular, sob aspiração contínua. Diâmetro externo 1,27 mm.' });
  {
    const g = needleGeometry(NEEDLE_L + 0.5, R_OUT, R_IN, BEVEL_DEG, 28);
    mesh(g, mats.steel, needleGrp, infoNeedle);
    // canhão Luer fêmea (rosa = 18G, ISO 6009), translúcido
    const hub = lathe([[0.215, -7.95], [0.47, -7.95], [0.49, -7.9], [0.47, -7.84], [0.37, -7.82], [0.36, -7.55], [0.355, -7.1], [0.3, -6.86], [0.2, -6.62], [0.13, -6.46], [0.1, -6.37], [0.075, -6.35], [0.066, -6.4], [0.07, -6.62], [0.17, -6.96], [0.195, -7.3], [0.215, -7.95]], 36);
    mesh(hub, mats.hub, needleGrp, GI({ id: 'needle', name: 'Canhão Luer da agulha (18G)' }), { cast: false });
    // abas de trava Luer (2 orelhas em cunha na borda da boca): raio externo ≤ 0,55 — encaixam-se na rosca interna
    // do colar da seringa (0,50–0,58) sem atravessá-lo
    {
      const sh = new THREE.Shape(); const r0 = 0.44, r1 = 0.548, w0 = 0.15, w1 = 0.085;
      sh.moveTo(r0, -w0); sh.lineTo(r1, -w1); sh.quadraticCurveTo(r1 + 0.008, 0, r1, w1); sh.lineTo(r0, w0); sh.closePath();
      for (const sg of [0, Math.PI]) {
        const e = new THREE.ExtrudeGeometry(sh, { depth: 0.07, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 1, curveSegments: 4 });
        e.rotateX(Math.PI / 2); e.rotateY(sg); e.translate(0, -7.86, 0); // extrusão ao longo de −y (eixo da agulha)
        mesh(e, mats.hub, needleGrp, GI({ id: 'needle', name: 'Canhão Luer da agulha (18G)' }), { cast: false });
      }
    }
  }
  // sangue no canhão (refluxo) — visível pela parede translúcida
  const hubBlood = mesh(latheTD([[0.001, -6.45], [0.055, -6.45], [0.15, -6.95], [0.175, -7.3], [0.19, -7.86], [0.001, -7.86]], 20), mats.bloodHub, needleGrp, GI({ id: 'aspirated-blood', name: 'Sangue venoso no canhão (refluxo)', desc: 'Sangue escuro e não pulsátil sugere punção venosa, mas não a confirma: confirmar (p.ex., transdução/USG) antes de dilatar.' }), { cast: false });

  // ---- seringa de 5 mL (corpo DE ~1,4 cm) ----
  const syringe = new THREE.Group(); syringe.name = 'Seringa 5 mL'; needleAsm.add(syringe);
  const infoSyr = GI({ id: 'syringe', name: 'Seringa de 5 mL (Luer)', desc: 'Acoplada à agulha; mantém pressão negativa suave durante o avanço. Graduações ilustrativas, sem números.' });
  const B_FRONT = -8.95, B_REAR = -15.12; // cavidade interna
  {
    // bico Luer macho (entra no canhão) + luva de trava
    mesh(lathe([[0.06, -6.97], [0.06, -8.62], [0.21, -8.62], [0.205, -7.95], [0.19, -7.3], [0.17, -6.97], [0.06, -6.97]], 28), mats.barrel, syringe, infoSyr, { cast: false });
    mesh(lathe([[0.5, -8.56], [0.57, -8.56], [0.58, -8.5], [0.58, -7.82], [0.5, -7.8], [0.5, -8.56]], 36), mats.barrel, syringe, infoSyr, { cast: false });
    // corpo (cilindro com ombro cônico), parede com espessura
    mesh(lathe([[0.62, B_REAR], [0.7, B_REAR], [0.7, -8.88], [0.6, -8.72], [0.2, -8.55], [0.15, -8.62], [0.55, -8.84], [0.62, B_FRONT], [0.62, B_REAR]], 48), mats.barrel, syringe, infoSyr, { cast: false });
    // aletas (apoio dos dedos)
    const sh = new THREE.Shape();
    const ax = 1.62, az = 0.92;
    sh.moveTo(ax, 0); sh.bezierCurveTo(ax, az * 0.75, ax * 0.55, az, 0, az * 0.7); sh.bezierCurveTo(-ax * 0.55, az, -ax, az * 0.75, -ax, 0);
    sh.bezierCurveTo(-ax, -az * 0.75, -ax * 0.55, -az, 0, -az * 0.7); sh.bezierCurveTo(ax * 0.55, -az, ax, -az * 0.75, ax, 0);
    const hole = new THREE.Path(); hole.absarc(0, 0, 0.62, 0, Math.PI * 2, true); sh.holes.push(hole);
    const fg = new THREE.ExtrudeGeometry(sh, { depth: 0.13, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 20 });
    fg.rotateX(Math.PI / 2); fg.translate(0, B_REAR + 0.1, 0);
    mesh(fg, mats.barrel, syringe, infoSyr, { cast: false });
    // graduações (sem números) impressas numa faixa voltada para o bisel
    const CH = 1024, cv = document.createElement('canvas'); cv.width = 64; cv.height = CH;
    const g2 = cv.getContext('2d'); g2.clearRect(0, 0, 64, CH); g2.fillStyle = '#ffffff';
    const H = 5.26, mL = H / 6; // 0–6 mL (1 mL ≈ 0,88 cm)
    for (let k = 0; k <= 30; k++) { const y = Math.round((k * 0.2 * mL) / H * CH); const major = k % 5 === 0; const w = major ? 0.62 : 0.3; g2.fillRect(64 * (0.5 - w / 2), Math.min(CH - 4, Math.max(1, y)), 64 * w, major ? 4 : 2.5); }
    const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 8;
    mats.ink.alphaMap = tex; mats.ink.needsUpdate = true;
    const sleeve = new THREE.CylinderGeometry(0.704, 0.704, H, 24, 1, true, -Math.PI / 3.2, (2 * Math.PI) / 3.2);
    sleeve.translate(0, B_FRONT - 0.05 - H / 2, 0);
    mesh(sleeve, mats.ink, syringe, infoSyr, { cast: false, receive: false }).renderOrder = 4;
  }
  // êmbolo (rolha de borracha + haste em cruz + apoio do polegar) — desloca-se em y
  const plunger = new THREE.Group(); syringe.add(plunger);
  {
    mesh(latheTD([[0.001, B_FRONT - 0.02], [0.3, B_FRONT - 0.04], [0.55, B_FRONT - 0.12], [0.612, B_FRONT - 0.18], [0.612, B_FRONT - 0.3], [0.585, B_FRONT - 0.36], [0.585, B_FRONT - 0.46], [0.612, B_FRONT - 0.52], [0.612, B_FRONT - 0.64], [0.56, B_FRONT - 0.72], [0.3, B_FRONT - 0.78], [0.001, B_FRONT - 0.78]], 32), mats.rubber, plunger, GI({ id: 'syringe', name: 'Êmbolo da seringa (rolha de borracha)' }));
    const len = 6.75, y0 = B_FRONT - 0.78, yc = y0 - len / 2;
    const a = new THREE.BoxGeometry(1.08, len, 0.11); a.translate(0, yc, 0);
    const b = new THREE.BoxGeometry(0.11, len, 1.08); b.translate(0, yc, 0);
    mesh(a, mats.rod, plunger, infoSyr); mesh(b, mats.rod, plunger, infoSyr);
    const disc = new THREE.CylinderGeometry(0.78, 0.78, 0.14, 36); disc.translate(0, y0 - len - 0.07, 0);
    mesh(disc, mats.rod, plunger, infoSyr);
    const sd = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 28); sd.translate(0, y0 - 0.05, 0);
    mesh(sd, mats.rod, plunger, infoSyr);
  }
  // sangue aspirado no corpo da seringa (coluna entre o ombro e a rolha) e no bico
  const syrBlood = new THREE.Group(); syringe.add(syrBlood);
  const bloodCol = mesh(new THREE.CylinderGeometry(0.6, 0.6, 1, 32).translate(0, -0.5, 0), mats.blood, syrBlood, GI({ id: 'aspirated-blood', name: 'Sangue venoso aspirado (escuro, não pulsátil)', desc: 'Refluxo fácil de sangue escuro, não pulsátil, durante a aspiração: sinal sugestivo de luz venosa — não substitui a confirmação antes da dilatação.' }), { cast: false });
  bloodCol.position.y = B_FRONT + 0.04;
  mesh(latheTD([[0.001, -6.99], [0.055, -6.99], [0.055, -8.6], [0.5, -8.86], [0.58, -8.95], [0.001, -8.95]], 24), mats.blood, syrBlood, GI({ id: 'aspirated-blood', name: 'Sangue venoso aspirado (escuro, não pulsátil)' }), { cast: false });

  // ordem de desenho dos translúcidos: paredes de plástico → sangue → tinta das graduações
  needleAsm.traverse((o) => { if (!o.isMesh) return; if (o.material === mats.barrel || o.material === mats.hub) o.renderOrder = 1; if (o.material === mats.blood || o.material === mats.bloodHub) o.renderOrder = 2; });

  mark('needle');
  /* ======================================================================
     5. Fio-guia em J (0,89 mm) e trajeto anômalo (VJI)
        Os trajetos intravasculares são DERIVADOS de LM.vessels (eixo + raio), não escritos à mão: se os marcos
        mudarem, fio e cateter acompanham — e uma autoverificação acusa qualquer saída da luz (engine.errors).
     ====================================================================== */
  const R_WIRE = 0.0445;
  // ponta em J (raio 3 mm): a partir de 'start', avança em 'head' e retorna pelo lado 'side'
  const jPts = (start, head, side, rad) => { const out = []; const cc = start.clone().addScaledVector(side, rad); for (let k = 1; k <= 8; k++) { const ph = (k / 8) * Math.PI; out.push(cc.clone().addScaledVector(side, -rad * Math.cos(ph)).addScaledVector(head, rad * Math.sin(ph))); } out.push(out[out.length - 1].clone().addScaledVector(head, -0.12)); return out; };
  const perpTo = (v, axis) => v.clone().addScaledVector(axis, -v.dot(axis)).normalize();
  const hubRear = (s) => along(s).addScaledVector(dir, L_HUB1 - 0.02);
  function wireExternal(sTip) { // trecho externo: sai da boca do canhão e arqueia para lateral/anterior (segurado pela mão direita)
    const r0 = hubRear(sTip), out = [];
    const lift = new THREE.Vector3(0.15, 0.35, 1).normalize();
    for (let k = 9; k >= 1; k--) { const s = k * 1.6; out.push(r0.clone().addScaledVector(dir, -s).addScaledVector(lift, 0.022 * s * s)); }
    out.push(r0.clone());
    return out;
  }
  // dentro da agulha: da boca do canhão até a ponta (último ponto = ponta)
  const insideNeedle = (sTip) => { const out = []; for (let k = 1; k <= 4; k++) out.push(hubRear(sTip).addScaledVector(dir, -(L_HUB1 - 0.02) * (k / 4))); return out; };
  /** Trajeto intravascular: parte de 'start' (já na luz), segue 'dir0' por ~3,5 mm e converge suavemente ao eixo
      do vaso (o afastamento inicial do eixo decai em ~1 cm) até o comprimento de arco sEnd da cadeia. */
  function veinRoute(tab, start, dir0, sEnd, step = 0.55) {
    const a = start.clone().addScaledVector(dir0, 0.35);
    const n0 = nearestOn(tab, a), off0 = a.clone().sub(tab[n0.k].p);
    const pts = [a], ss = [n0.s];
    for (let s = n0.s + 0.5; s < sEnd - 0.25; s += step) {
      const q = atS(tab, s), w = Math.exp(-(s - n0.s) / 0.8);
      pts.push(q.p.clone().add(off0.clone().addScaledVector(q.T, -off0.dot(q.T)).multiplyScalar(w))); ss.push(s);
    }
    pts.push(atS(tab, sEnd).p); ss.push(sEnd);
    return { pts, ss };
  }
  /** Autoverificação: o eixo do dispositivo (raio rad) deve permanecer dentro da luz (distância ao eixo < r − rad). */
  const lumenReport = {};
  function lumenCheck(label, pts, tabs, rad) {
    const cv = C.curve(pts), L = cv.getLength(); let worst = -1e9, at = null;
    for (let u = 0; u <= L; u += 0.1) {
      const p = cv.getPointAt(Math.min(1, u / L)); let best = 1e9;
      for (const tb of tabs) { const q = nearestOn(tb, p); best = Math.min(best, q.d - q.r); }
      if (best + rad > worst) { worst = best + rad; at = p; }
    }
    lumenReport[label] = { margin: +(-worst).toFixed(3), at: at && at.toArray().map((x) => +x.toFixed(2)) };
    if (worst > 0.03 && ctx.engine && ctx.engine.errors) ctx.engine.errors.push('instruments: ' + label + ' sai da luz venosa em ' + lumenReport[label].at.join(',') + ' (' + worst.toFixed(2) + ' cm)');
    return worst;
  }
  const tipVein = along(sTip4);                                   // ponta da agulha na luz (fases 4–5)
  const sSvc0 = nearestOn(tabMain, v3(vs.svc.pts[0])).s;         // início da VCS na cadeia
  /* Ponta do cateter: VCS distal, 0,7 cm acima do início do átrio direito. O começo do coração é medido por raio ao
     longo do eixo da VCS na malha do módulo viscera (se existir); senão, usa-se a junção cavoatrial de LM. */
  function heartStartOnSVC() {
    const reg = (ctx.ATLAS || window.ATLAS || {}).registry, e = reg && reg.get('heart'); if (!e) return null;
    const ms = []; e.objects.forEach((o) => o.traverse((c) => { if (c.isMesh && c.geometry) ms.push(c); })); if (!ms.length) return null;
    const Wm = ctx.world.matrixWorld, rc = new THREE.Raycaster(); let hit = null;
    const sides = ms.map((m) => m.material.side); ms.forEach((m) => { m.material.side = THREE.DoubleSide; });
    try {
      for (let s = sSvc0; s < tabMain.L - 1e-3 && !hit; s += 0.4) {
        const a = atS(tabMain, s).p.applyMatrix4(Wm), b = atS(tabMain, Math.min(tabMain.L, s + 0.4)).p.applyMatrix4(Wm);
        rc.set(a, b.clone().sub(a).normalize()); rc.far = a.distanceTo(b) + 1e-4;
        const h = rc.intersectObjects(ms, false); if (h.length) hit = h[0].point.clone().applyMatrix4(W2A);
      }
    } finally { ms.forEach((m, i) => { m.material.side = sides[i]; }); }
    return hit;
  }
  const heartHit = heartStartOnSVC();
  const sHeart = heartHit ? Math.min(tabMain.L, nearestOn(tabMain, heartHit).s) : tabMain.L;
  const sCathTip = Math.max(sSvc0 + 2.5, sHeart - 0.7);
  const cathTipP = atS(tabMain, sCathTip).p;
  // fio: J (raio 3 mm) na VCS média, sempre acima da ponta prevista do cateter
  const sJ = Math.min(sAtY(tabMain, -5.0, sSvc0) ?? (sSvc0 + 2.7), sCathTip - 0.45);
  const jA = atS(tabMain, sJ), jStart = jA.p, jHead = jA.T;
  const wireJ = jPts(jStart, jHead, perpTo(new THREE.Vector3(-1, 0, 0.25), jHead), 0.3);
  const wireVein = veinRoute(tabMain, tipVein, dir, sJ);
  const wirePath = [...wireExternal(sTip4), ...insideNeedle(sTip4), ...wireVein.pts, ...wireJ];
  lumenCheck('fio-guia', [tipVein, ...wireVein.pts, ...wireJ], [tabMain], R_WIRE);
  const infoWire = GI({ id: 'guidewire', name: 'Fio-guia com ponta em J (0,035″ / 0,89 mm)', desc: 'Passa pela agulha sem resistência; a ponta em J reduz o risco de lesão da parede. Trajeto esperado: subclávia → braquiocefálica direita → VCS. Nunca soltar o fio; atenção a arritmias.' });
  /** (Re)define a geometria de um tubo que "cresce" (drawRange) do início ao fim do trajeto. */
  function setTube(m, pts, o) {
    const Q = C.quality || 1, qf = Q < 1 ? Math.max(0.6, Q) : 1;
    const segs = Math.max(4, Math.round(o.segments * qf)), R = Math.max(8, Math.round(o.radial * qf));
    const g = C.sweepGeometry(pts, Object.assign({ caps: 'round' }, o));
    if (m.geometry) m.geometry.dispose();
    m.geometry = g;
    const ringsBefore = o.capStart === false || o.caps === 'none' ? 0 : o.caps === 'flat' ? 1 : 6;
    m.userData.grow = (f) => { const n = Math.round(C.clamp(f, 0, 1) * segs); g.setDrawRange(0, f >= 0.999 ? Infinity : (ringsBefore + n) * R * 6); };
    return m;
  }
  const growTube = (pts, o, mat, parent, info) => setTube(mesh(new THREE.BufferGeometry(), mat, parent, info), pts, o);
  const wire = growTube(wirePath, { r: R_WIRE, radial: 10, segments: 420, tension: 0.5 }, mats.wire, layers.instrument, infoWire);
  wire.castShadow = true;
  // trecho anômalo: diverge do trajeto correto ~1,2 cm antes do ângulo venoso e sobe pela VJI até y ≈ 5,6
  const sVA = nearestOn(tabMal, v3(vs.venousAngleR)).s;
  const sMalEnd = sAtYUp(tabMal, 5.6, sVA) ?? (tabMal.L - 1);
  const malRoute = veinRoute(tabMal, tipVein, dir, sMalEnd);
  const malPts = malRoute.pts.filter((p, i) => malRoute.ss[i] >= sVA - 1.2);
  const mA = atS(tabMal, sMalEnd), wireIJVTip = mA.p;
  const malJ = jPts(wireIJVTip, mA.T, perpTo(new THREE.Vector3(1, 0, 0.2), mA.T), 0.3);
  lumenCheck('fio-guia (trajeto anômalo)', [...malPts, ...malJ], [tabMal, tabMain], R_WIRE * 1.04);
  const wireMal = growTube([...malPts, ...malJ], { r: R_WIRE * 1.04, radial: 10, segments: 160 }, mats.wireMal, layers.instrument, GI({ id: 'guidewire-ijv', name: 'Trajeto anômalo do fio-guia: ascensão para a veia jugular interna', desc: 'Malposição clássica na via subclávia direita: o fio sobe pela VJI em vez de descer para a braquiocefálica. Suspeitar se houver resistência/ectopia; confirmar por imagem.' }));
  wireMal.castShadow = false;
  setA('wireTip', wireJ[3].toArray());
  setA('wireIJV', malJ[3].toArray());

  /* ======================================================================
     6. Cateter venoso central 7 Fr (Ø 2,3 mm), triplo lúmen
     ====================================================================== */
  const R_CATH = 0.1167;
  let xrayCath = null; // cópia "raio X" (seção 7) — compartilha a geometria do cateter
  // trecho interno: pele → trajeto da agulha (tecidos) → venotomia → eixo venoso até a ponta
  const cathRoute = veinRoute(tabMain, tipVein, dir, sCathTip);
  const cathInt = [entryEff.clone(), ...[1.2, 2.45, 3.65].map((d) => along(sSkin + d)).filter((p) => p.distanceTo(P0) + 0.2 < tipVein.distanceTo(P0)), along(sWall), tipVein.clone(), ...cathRoute.pts];
  lumenCheck('cateter', [tipVein, ...cathRoute.pts], [tabMain], R_CATH);
  const infoCath = GI({ id: 'catheter', name: 'Cateter venoso central 7 Fr, triplo lúmen', desc: 'Inserido sobre o fio (Seldinger); ponta na VCS distal, acima do átrio direito. Vias: distal (marrom), medial (azul) e proximal (branca). Confirmar a posição por imagem.' });
  const catheterGrp = new THREE.Group(); catheterGrp.name = 'Cateter'; layers.instrument.add(catheterGrp);
  // marcas de profundidade (faixas a cada 1 cm, sem números) via textura em v (vScale = 1 cm)
  const markTex = (() => { const cv = document.createElement('canvas'); cv.width = 8; cv.height = 128; const g2 = cv.getContext('2d'); g2.fillStyle = '#f1f1ea'; g2.fillRect(0, 0, 8, 128); g2.fillStyle = '#2a3035'; g2.fillRect(0, 0, 8, 7); const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; })();
  mats.cath.map = markTex;
  const cathTaper = (t) => (t > 0.985 ? R_CATH * (1 - 0.45 * C.smooth(0.985, 1, t)) : R_CATH);
  const cath = mesh(new THREE.BufferGeometry(), mats.cath, catheterGrp, infoCath);
  // orifícios laterais (vias medial e proximal) — pequenas elipses escuras perto da ponta
  const holeMat = new THREE.MeshBasicMaterial({ color: '#2b1d1d' });
  const holes = [1.6, 3.2].map((back) => { const e = mesh(new THREE.SphereGeometry(1, 12, 8), holeMat, catheterGrp, infoCath, { cast: false }); e.scale.set(0.035, 0.07, 0.035); e.userData.internal = true; e.userData.back = back; return e; });
  // canhão de junção com asas de sutura (geometria local; a posição é definida em layoutExternal)
  const hubGrp = new THREE.Group(); hubGrp.name = 'Canhão do cateter'; catheterGrp.add(hubGrp);
  const infoHub = GI({ id: 'catheter', name: 'Canhão de junção do cateter (asas de sutura) e extensões' });
  const hubLocal = new THREE.Group(); hubLocal.matrixAutoUpdate = false; hubGrp.add(hubLocal);
  {
    // corpo achatado (perpendicular à pele); o "nariz" (+y local) aponta para o sítio de inserção
    const body = latheTD([[0.001, 1.95], [0.13, 1.95], [0.2, 1.6], [0.33, 1.05], [0.47, 0.55], [0.5, -0.1], [0.46, -0.85], [0.38, -1.15], [0.001, -1.2]], 32);
    body.scale(1, 1, 0.62);
    mesh(body, mats.cathHub, hubLocal, infoHub);
    // asas com dois orifícios de sutura
    const sh = new THREE.Shape(); const w = 1.45, h = 0.55;
    sh.moveTo(-w, -h * 0.6); sh.quadraticCurveTo(-w, -h, -w + 0.4, -h); sh.lineTo(w - 0.4, -h); sh.quadraticCurveTo(w, -h, w, -h * 0.6); sh.lineTo(w, h * 0.6); sh.quadraticCurveTo(w, h, w - 0.4, h); sh.lineTo(-w + 0.4, h); sh.quadraticCurveTo(-w, h, -w, h * 0.6); sh.closePath();
    for (const sx of [-1.02, 1.02]) { const hp = new THREE.Path(); hp.absarc(sx, 0, 0.14, 0, Math.PI * 2, true); sh.holes.push(hp); }
    const wg = new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2, curveSegments: 14 });
    wg.translate(0, 0.15, -0.3);
    mesh(wg, mats.cathHub, hubLocal, infoHub);
  }
  /* Clampe de pinçamento (cor da via): base sob o tubo, braço superior levemente inclinado (aberto), dobradiça
     traseira em dois pilares laterais e trava frontal — o tubo passa livre entre os pilares (sem interpenetração).
     Local: x = lateral, y = normal da superfície, z = tangente do tubo (comprimento ~1,45 cm). */
  const mergeGeos = (list) => { const P = [], N = []; for (const g0 of list) { const g = g0.index ? g0.toNonIndexed() : g0; P.push(...g.attributes.position.array); N.push(...g.attributes.normal.array); g0.dispose(); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); return g; };
  const plate = (w, l, th, r) => { const s = new THREE.Shape(); s.moveTo(-w / 2 + r, -l / 2); s.lineTo(w / 2 - r, -l / 2); s.quadraticCurveTo(w / 2, -l / 2, w / 2, -l / 2 + r); s.lineTo(w / 2, l / 2 - r); s.quadraticCurveTo(w / 2, l / 2, w / 2 - r, l / 2); s.lineTo(-w / 2 + r, l / 2); s.quadraticCurveTo(-w / 2, l / 2, -w / 2, l / 2 - r); s.lineTo(-w / 2, -l / 2 + r); s.quadraticCurveTo(-w / 2, -l / 2, -w / 2 + r, -l / 2);
    const g = new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 6 }); g.rotateX(-Math.PI / 2); return g; }; // espessura ao longo de +y
  const clampGeo = (() => {
    const base = plate(0.46, 1.45, 0.08, 0.09); base.translate(0, -0.2, 0);
    const arm = plate(0.42, 1.2, 0.07, 0.08); arm.rotateX(0.06); arm.translate(0, 0.155, 0.06);
    const posts = [-0.19, 0.19].map((x) => { const b = new THREE.BoxGeometry(0.07, 0.42, 0.16); b.translate(x, 0.0, -0.64); return b; });
    const latch = new THREE.BoxGeometry(0.07, 0.4, 0.12); latch.translate(0.19, -0.01, 0.6);
    const tab = plate(0.3, 0.32, 0.05, 0.1); tab.rotateX(-0.5); tab.translate(0, 0.24, 0.68); // aba de acionamento
    return mergeGeos([base, arm, ...posts, latch, tab]);
  })();
  const extDefs = [[mats.blue, 'medial (azul)', -1], [mats.brown, 'distal (marrom, 16G)', 0], [mats.white, 'proximal (branca)', 1]];
  const exts = extDefs.map(([cm, nm]) => {
    const tube = mesh(new THREE.BufferGeometry(), mats.tubing, catheterGrp, GI({ id: 'catheter', name: 'Extensão da via ' + nm }), { cast: false });
    const clamp = mesh(clampGeo, cm, catheterGrp, GI({ id: 'catheter', name: 'Clampe da via ' + nm }));
    const conn = new THREE.Group(); catheterGrp.add(conn);
    mesh(latheTD([[0.001, 0.25], [0.12, 0.25], [0.24, -0.1], [0.27, -0.9], [0.33, -0.95], [0.33, -1.05], [0.001, -1.05]], 24), mats.tubing, conn, GI({ id: 'catheter', name: 'Conector Luer da via ' + nm }));
    mesh(latheTD([[0.001, -0.95], [0.36, -0.95], [0.38, -1.05], [0.36, -1.75], [0.3, -1.85], [0.001, -1.85]], 24), cm, conn, GI({ id: 'catheter', name: 'Tampa da via ' + nm }));
    return { tube, clamp, conn };
  });
  const xyLen = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  /** Maior altura da superfície sob um segmento (amostras a cada ~0,25 cm) — para assentar peças rígidas. */
  const maxUnder = (fz, a, b, pad = 0.25) => { const n = Math.max(2, Math.ceil(xyLen(a, b) / 0.25)); let m = -1e9; for (let k = 0; k <= n; k++) { const x = C.lerp(a.x, b.x, k / n), y = C.lerp(a.y, b.y, k / n); for (const [dx, dy] of [[0, 0], [pad, 0], [-pad, 0], [0, pad], [0, -pad]]) m = Math.max(m, fz(x + dx, y + dy)); } return m; };
  let hubC = new THREE.Vector3(), extReport = {};
  /** Geometria do trecho externo (para o módulo fixation): atualizada a cada layoutExternal; ouvintes notificados. */
  let extInfo = null; const extListeners = [];
  /* Assenta todo o trecho externo (canhão, saída do cateter, extensões, clampes e conectores) sobre a superfície de
     apoio atual (pele, ou pele + campo estéril). Refeito a cada troca pele ↔ campo (ver syncSurface). */
  function layoutExternal() {
    const fz = restZ;
    // canhão: ínfero-lateral à inserção (continuação natural da saída do cateter), deitado sobre a superfície
    const hubDirXY = new THREE.Vector2(0.6, -0.8).normalize();
    const hc2 = new THREE.Vector2(entryEff.x + hubDirXY.x * 3.3, entryEff.y + hubDirXY.y * 3.3);
    const hubN = surfNormal(fz, hc2.x, hc2.y, 1.1); // normal suavizada (ignora pregas do campo)
    let hz = -1e9; for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1.2], [0, -1.2], [0.7, 0.7], [-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7]]) hz = Math.max(hz, fz(hc2.x + dx * 0.9, hc2.y + dy * 0.9));
    hubC = new THREE.Vector3(hc2.x, hc2.y, hz + 0.36);
    const hubY = new THREE.Vector3(-hubDirXY.x, -hubDirXY.y, 0); hubY.addScaledVector(hubN, -hubY.dot(hubN)).normalize();
    const hubX = new THREE.Vector3().crossVectors(hubY, hubN).normalize();
    const setHub = () => { hubLocal.matrix.makeBasis(hubX, hubY, hubN).setPosition(hubC); hubLocal.matrixWorldNeedsUpdate = true; };
    setHub();
    { const pen = penetration(hubLocal, fz, 0.03, 2); if (pen > 0) { hubC.addScaledVector(hubN, pen / Math.max(0.5, hubN.z)); setHub(); } }
    const hubNose = hubC.clone().addScaledVector(hubY, 1.35);
    // saída suave: acompanha o trajeto por ~3 mm, encurva e deita sobre a superfície até o canhão
    const ext1 = entryEff.clone().addScaledVector(dir, -0.32);
    const ext2 = hubNose.clone().addScaledVector(hubY, 0.9); ext2.z = Math.max(ext2.z, fz(ext2.x, ext2.y) + R_CATH + 0.06);
    const extM = ext1.clone().lerp(ext2, 0.5); extM.z = Math.max(extM.z, fz(extM.x, extM.y) + R_CATH + 0.12);
    const cathPath = [hubNose.clone().addScaledVector(hubY, -0.4), hubNose, ext2, extM, ext1, ...cathInt];
    setTube(cath, cathPath, { r: cathTaper, radial: 14, segments: 360, vScale: 1, capStart: true });
    { hubLocal.updateMatrix && hubLocal.matrixWorldNeedsUpdate; const M = hubLocal.matrix, wing = (lx) => new THREE.Vector3(lx, 0.15, -0.24).applyMatrix4(M).toArray();
      extInfo = { path: cathPath.map((p) => p.toArray()), nExternal: 5, entry: entryEff.toArray(), exitDir: dir.clone().negate().toArray(), hub: hubC.toArray(), hubX: hubX.toArray(), hubY: hubY.toArray(), hubN: hubN.toArray(), hubNose: hubNose.toArray(), wingHoles: [wing(-1.02), wing(1.02)], rCath: R_CATH, surface: surfKey || 'skin' }; }
    if (xrayCath) xrayCath.geometry = cath.geometry;
    { const cv = C.curve(cathPath), L = cv.getLength();
      for (const e of holes) { const t = 1 - e.userData.back / L, p = cv.getPointAt(t), T = cv.getTangentAt(t); const side = new THREE.Vector3(0, 0, 1).cross(T).normalize(); e.position.copy(p.addScaledVector(side, R_CATH * 0.93)); e.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), T); } }
    // extensões: saem da traseira do canhão e se abrem em leque para inferomedial, sobre o peitoral (superfície plana)
    const toA = (lx, ly) => hubC.clone().addScaledVector(hubX, lx).addScaledVector(hubY, ly);
    const th0 = Math.atan2(-hubY.y, -hubY.x);
    extReport = {};
    // 1º passo: trajetos 2D em leque (a extensão do lado interno da curva gira mais — não se cruzam)
    const paths = exts.map((E, i) => {
      const side = extDefs[i][2], len = side === 0 ? 5.6 : 5.0;
      const th1 = th0 - (1.0 - 0.34 * side);
      const start = toA(side * 0.3, -1.05);
      const xy = [new THREE.Vector2(start.x, start.y)], N = 24;
      for (let k = 1; k <= N; k++) { const s = (k - 0.5) / N, th = th0 + (th1 - th0) * C.smooth(0.0, 0.7, s); const p = xy[k - 1]; xy.push(new THREE.Vector2(p.x + Math.cos(th) * len / N, p.y + Math.sin(th) * len / N)); }
      const at2 = (u) => { const f = C.clamp(u, 0, 1) * N, k = Math.min(N - 1, Math.floor(f)); return xy[k].clone().lerp(xy[k + 1], f - k); };
      const tan2 = (u) => { const k = Math.min(N - 1, Math.floor(C.clamp(u, 0, 1) * N)); return xy[k + 1].clone().sub(xy[k]).normalize(); };
      return { side, len, xy, N, at2, tan2 };
    });
    // 2º passo: posição de cada clampe — o primeiro ponto (u ≥ 0,42) em que o clampe (1,5 × 0,5 cm) não encoste nas
    // outras extensões nem nos clampes já posicionados
    const segPts = (P, u) => { const c = P.at2(u), tg = P.tan2(u), out = []; for (let k = -3; k <= 3; k++) out.push(c.clone().addScaledVector(tg, k * 0.25)); return out; };
    const dPath = (q, P) => { let m = 1e9; for (const p of P.xy) m = Math.min(m, p.distanceTo(q)); return m; };
    const placed = [];
    for (const i of [0, 1, 2]) {
      const P = paths[i]; let ucBest = 0.6;
      for (let u = 0.42; u <= 0.8; u += 0.02) {
        const sp = segPts(P, u); let ok = true;
        for (let j = 0; j < 3 && ok; j++) if (j !== i) for (const q of sp) if (dPath(q, paths[j]) < 0.4) { ok = false; break; }
        for (const c of placed) for (const q of sp) if (c.some((r) => r.distanceTo(q) < 0.55)) { ok = false; break; }
        if (ok) { ucBest = u; break; }
      }
      P.uc = ucBest; placed.push(segPts(P, ucBest));
    }
    exts.forEach((E, i) => {
      const { side, len, N, at2, tan2, uc } = paths[i];
      // clampe e conector + tampa (no fim): alturas do eixo garantem folga sobre a superfície
      const pc2 = at2(uc), tc2 = tan2(uc);
      const zc = maxUnder(fz, pc2.clone().addScaledVector(tc2, -0.75), pc2.clone().addScaledVector(tc2, 0.75), 0.25) + 0.25;
      const pe2 = at2(1), te2 = tan2(0.97), tail2 = pe2.clone().addScaledVector(te2, 2.1);
      const zN = maxUnder(fz, pe2, pe2.clone().addScaledVector(te2, 0.6), 0.4) + 0.42, zT = maxUnder(fz, tail2.clone().addScaledVector(te2, -0.6), tail2, 0.4) + 0.42;
      // perfil de altura do tubo: apoio (0,14), sobe ao clampe e ao conector, parte da altura do canhão
      const pts = [];
      for (let k = 0; k <= N; k++) {
        const u = k / N, p2 = at2(u); const base = fz(p2.x, p2.y) + 0.14;
        const dc = Math.max(0, Math.abs((u - uc) * len) - 0.8); // patamar sob o clampe (tubo reto e na altura do eixo)
        let z = base + Math.max(0, zc - base) * Math.exp(-((dc / 0.6) ** 2));
        z = C.lerp(z, Math.max(z, zN), C.smooth(0.82, 1, u));
        z = C.lerp(hubC.z, z, C.smooth(0, 0.22, u));
        pts.push(new THREE.Vector3(p2.x, p2.y, z));
      }
      setTube(E.tube, pts, { r: 0.1, radial: 10, segments: 70, caps: 'flat' });
      E.tube.geometry.setDrawRange(0, Infinity);
      // clampe: base (x lateral, y normal, z tangente)
      const nC = surfNormal(fz, pc2.x, pc2.y, 0.5), t3 = new THREE.Vector3(tc2.x, tc2.y, 0); const tC = perpTo(t3, nC);
      E.clamp.position.set(pc2.x, pc2.y, zc); E.clamp.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(nC, tC).normalize(), nC, tC));
      // conector + tampa: eixo local −y ao longo da extensão, inclinado conforme a superfície
      const nose = new THREE.Vector3(pe2.x, pe2.y, zN), tail = new THREE.Vector3(tail2.x, tail2.y, zT);
      const ax = tail.clone().sub(nose).normalize(), Y = ax.clone().negate(), Zs = perpTo(surfNormal(fz, pe2.x, pe2.y, 0.6), Y), X = new THREE.Vector3().crossVectors(Y, Zs).normalize();
      E.conn.position.copy(nose).addScaledVector(ax, -0.25); E.conn.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Zs));
      // folga residual: se ainda houver penetração (relevo fino), levanta a peça ao longo da normal
      for (const o of [E.clamp, E.conn]) { const pen = penetration(o, fz, 0.02, 2); if (pen > 0) o.position.z += pen; }
      extReport[extDefs[i][1]] = { uc: +uc.toFixed(2), tube: +penetration(E.tube, fz, 0, 3).toFixed(2), clamp: +penetration(E.clamp, fz, 0, 2).toFixed(2), conn: +penetration(E.conn, fz, 0, 2).toFixed(2) };
    });
    extReport.hub = +penetration(hubLocal, fz, 0, 2).toFixed(2);
    extReport.cathExternal = (() => { const cv = C.curve(cathPath.slice(0, 5)), L = cv.getLength(); let m = -1e9; for (let u = 0; u <= L; u += 0.1) { const p = cv.getPointAt(Math.min(1, u / L)); m = Math.max(m, fz(p.x, p.y) + R_CATH - p.z); } return +m.toFixed(2); })();
    setA('catheterHub', hubC.toArray());
    extListeners.forEach((f) => { try { f(extInfo); } catch (e) { /* noop */ } });
  }
  layoutExternal();
  setA('catheterTip', cathTipP.toArray());

  mark('wire+cath');
  /* ======================================================================
     7. Auxílios: marcadores, vetor do polegar, linha-guia, plano coronal, ângulo
     ====================================================================== */
  const aids = new THREE.Group(); aids.name = 'Auxílios (instrumentos)'; layers.aids.add(aids);
  const ring = (p, n, r, info) => { const m = mesh(new THREE.TorusGeometry(r, 0.035, 10, 56), mats.marker, aids, info, { cast: false, receive: false }); m.position.copy(p).addScaledVector(n, 0.07); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n); return m; };
  const notchP = new THREE.Vector3(NL.indexSkin[0], NL.indexSkin[1], skinZ(NL.indexSkin[0], NL.indexSkin[1]));
  const markers = [];
  markers.push(ring(notchP, surfNormal(skinZ, notchP.x, notchP.y), 0.95, GI({ id: 'landmark-notch', name: 'Marcador: incisura jugular (polpa do indicador)' })));
  markers.push(ring(entryEff, surfNormal(skinZ, entryEff.x, entryEff.y), 0.42, GI({ id: 'landmark-entry', name: 'Marcador: região ilustrativa de entrada', desc: 'Cerca de 1 cm abaixo da clavícula, lateral à junção dos terços medial e médio. Referência didática — não é coordenada fixa.' })));
  // planos/ângulos (state.showPlanes)
  const planes = new THREE.Group(); planes.name = 'Planos e ângulo'; aids.add(planes);
  {
    // linha tracejada sobre a pele: entrada → incisura (direção-guia na vista frontal)
    const aim = v3(NL.notchAim), info = GI({ id: 'needle-direction', name: 'Direção-guia: rumo à incisura jugular (projeção frontal)' });
    const A = new THREE.Vector2(entryEff.x, entryEff.y), B = new THREE.Vector2(aim.x, aim.y);
    const Ltot = A.distanceTo(B), stop = Ltot - 1.5;
    const pAt = (s) => { const q = A.clone().lerp(B, s / Ltot); return new THREE.Vector3(q.x, q.y, restZ(q.x, q.y) + 0.14); };
    for (let s = 0.55; s < stop - 0.45; s += 0.75) { const a = pAt(s), b = pAt(s + 0.42); mesh(C.segmentGeometry(a.toArray(), b.toArray(), 0.045, 0.045, 8), mats.marker, planes, info, { cast: false, receive: false }); }
    // ponta de seta
    const tip = pAt(stop + 0.2), base = pAt(stop - 0.35);
    const cone = mesh(new THREE.ConeGeometry(0.17, 0.55, 14), mats.marker, planes, info, { cast: false, receive: false });
    cone.position.copy(tip.clone().add(base).multiplyScalar(0.5)); cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tip.clone().sub(base).normalize());
    setA('needleGuide', pAt(Ltot * 0.5).toArray());
    // plano coronal translúcido pelo ponto de entrada
    const zc = entryEff.z, xa = entryEff.x - 6.5, xb = entryEff.x + 5.5, ya = entryEff.y - 3.6, yb = entryEff.y + 3.4;
    const pg = new THREE.PlaneGeometry(xb - xa, yb - ya); pg.translate((xa + xb) / 2, (ya + yb) / 2, zc);
    mesh(pg, mats.plane, planes, GI({ id: 'coronal-plane', name: 'Plano coronal de referência (pelo ponto de entrada)' }), { cast: false, receive: false });
    const edge = [[xa, ya], [xb, ya], [xb, yb], [xa, yb], [xa, ya]];
    for (let k = 0; k < 4; k++) mesh(C.segmentGeometry([edge[k][0], edge[k][1], zc], [edge[k + 1][0], edge[k + 1][1], zc], 0.025, 0.025, 6), mats.planeEdge, planes, GI({ id: 'coronal-plane', name: 'Plano coronal de referência' }), { cast: false, receive: false });
    setA('coronalPlane', [xb - 0.6, yb - 0.6, zc]);
    // ângulo entre a agulha e o plano coronal — desenhado no lado externo (entre o eixo da seringa e o plano)
    const back = dir.clone().negate();                                    // eixo externo (seringa)
    const proj = new THREE.Vector3(back.x, back.y, 0).normalize();        // projeção no plano coronal
    const ang = back.angleTo(proj), R = 3.2;
    const e1 = proj, e2 = new THREE.Vector3(0, 0, 1).addScaledVector(proj, -proj.z).normalize(); // base no plano (proj, +z)
    const arcPts = []; for (let k = 0; k <= 24; k++) { const a = (k / 24) * ang; arcPts.push(entryEff.clone().addScaledVector(e1, R * Math.cos(a)).addScaledVector(e2, R * Math.sin(a))); }
    const infoAng = GI({ id: 'needle-angle', name: 'Inclinação da agulha em relação ao plano coronal (~' + Math.round(ang * 180 / Math.PI) + '°)', desc: 'Ângulo didático deste modelo. Na prática, a agulha é mantida o mais paralela possível ao plano coronal, rente à clavícula.' });
    mesh(C.sweepGeometry(arcPts, { r: 0.04, radial: 8, segments: 48 }), mats.gold, planes, infoAng, { cast: false });
    // setor translúcido
    const sp = [entryEff.x, entryEff.y, entryEff.z]; const sv = [];
    for (let k = 0; k < 24; k++) { const a0 = (k / 24) * ang, a1 = ((k + 1) / 24) * ang; const q0 = entryEff.clone().addScaledVector(e1, R * Math.cos(a0)).addScaledVector(e2, R * Math.sin(a0)); const q1 = entryEff.clone().addScaledVector(e1, R * Math.cos(a1)).addScaledVector(e2, R * Math.sin(a1)); sv.push(...sp, ...q0.toArray(), ...q1.toArray(), ...sp, ...q1.toArray(), ...q0.toArray()); } // duas faces
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sv, 3)); sg.computeVertexNormals();
    mesh(sg, mats.sector, planes, infoAng, { cast: false, receive: false });
    // pernas do ângulo (projeção no plano e eixo da agulha prolongado)
    mesh(C.segmentGeometry(entryEff.toArray(), entryEff.clone().addScaledVector(proj, R + 0.6).toArray(), 0.03, 0.03, 8), mats.planeEdge, planes, infoAng, { cast: false });
    mesh(C.segmentGeometry(entryEff.toArray(), entryEff.clone().addScaledVector(back, R + 0.6).toArray(), 0.03, 0.03, 8), mats.gold, planes, infoAng, { cast: false });
    const mid = ang / 2; setA('angleArc', entryEff.clone().addScaledVector(e1, (R + 0.4) * Math.cos(mid)).addScaledVector(e2, (R + 0.4) * Math.sin(mid)).toArray());
  }
  /* "Raio X" didático: os trechos intravasculares do fio/cateter vistos através das veias opacas e dos ossos.
     Fica na camada 'instrument' (não em 'aids'): nas vistas anatômicas (pele oculta) o trajeto correto e o anômalo
     aparecem mesmo com os auxílios desligados — p.ex. phase=5&wireMal=1&layers=bones,vein,instrument. */
  const xrayGrp = new THREE.Group(); xrayGrp.name = 'Trajeto interno (raio X)'; layers.instrument.add(xrayGrp);
  const xrayWire = new THREE.Mesh(wire.geometry, mats.xrayWire); xrayWire.renderOrder = 3; xrayGrp.add(xrayWire); C.reg(xrayWire, infoWire);
  xrayCath = new THREE.Mesh(cath.geometry, mats.xrayCath); xrayCath.renderOrder = 3; xrayGrp.add(xrayCath); C.reg(xrayCath, infoCath);
  const xrayMal = new THREE.Mesh(wireMal.geometry, mats.xrayMal); xrayMal.renderOrder = 3; xrayGrp.add(xrayMal);
  C.reg(xrayMal, { id: 'guidewire-ijv', name: 'Trajeto anômalo do fio-guia (VJI)', group: 'Instrumentos' });
  [xrayWire, xrayCath, xrayMal].forEach((m) => { m.castShadow = false; m.receiveShadow = false; });

  /* ======================================================================
     8. Mão esquerda do operador (GLB) — pose e alinhamento por 3 restrições
     ====================================================================== */
  const handRoot = new THREE.Group(); handRoot.name = 'Mão esquerda (referencial físico)'; handRoot.scale.x = -1; layers.hand.add(handRoot);
  const infoHand = GI({ id: 'operator-hand', name: 'Mão esquerda do operador (luva estéril)', desc: 'Polpa do indicador na incisura jugular (referência de direção) e polpa do polegar logo abaixo da clavícula, na junção dos terços medial e médio, deprimindo suavemente os tecidos. Demais dedos fletidos, afastados do campo da agulha.' });
  mark('aids');
  let hand = null;
  try { hand = await buildHand(); } catch (e) { ctx.engine && ctx.engine.errors && ctx.engine.errors.push('instruments/mão: ' + (e && e.message)); }

  async function buildHand() {
    if (!window.HAND_GLB || !window.GLTFLoader) return null;
    const bin = Uint8Array.from(atob(window.HAND_GLB), (c) => c.charCodeAt(0)).buffer;
    const gltf = await new Promise((res, rej) => new window.GLTFLoader().parse(bin, '', res, rej));
    mark('glb');
    const asset = gltf.scene; const rig = new THREE.Group(); rig.add(asset);
    const bones = {}; let skin = null;
    asset.traverse((o) => { if (o.isBone) bones[o.name] = o; if (o.isSkinnedMesh) skin = o; });
    if (!skin || !bones.wrist) return null;
    // hierarquia (o ativo vem "achatado"): punho → metacarpo → falanges
    const FING = ['thumb', 'index', 'middle', 'ring', 'pinky'];
    const chain = (f) => (f === 'thumb' ? ['thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip'] : ['metacarpal', 'phalanx-proximal', 'phalanx-intermediate', 'phalanx-distal', 'tip'].map((s) => f + '-finger-' + s));
    for (const f of FING) { const nn = chain(f); asset.updateMatrixWorld(true); bones.wrist.attach(bones[nn[0]]); for (let i = 1; i < nn.length; i++) { asset.updateMatrixWorld(true); bones[nn[i - 1]].attach(bones[nn[i]]); } }
    const rest = {}; for (const [k, b] of Object.entries(bones)) rest[k] = b.quaternion.clone();
    // luva de látex estéril (cor creme): micro-textura (normal map) + relevo procedural no shader (ver abaixo)
    // (reaproveita as texturas de ruído já geradas pelo núcleo; clones têm repetição própria)
    const texRep = (key, rx, ry) => { const t = C.tex.noiseNormal(key).clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.needsUpdate = true; return t; };
    const gloveMat = PM({ color: '#d8c49c', roughness: 0.42, sheen: 0.45, sheenRoughness: 0.45, sheenColor: '#fff3da', clearcoat: 0.3, clearcoatRoughness: 0.32,
      normalMap: texRep('fine', 14, 14), normalScale: new THREE.Vector2(0.1, 0.1) });
    skin.material = gloveMat; skin.frustumCulled = false; skin.castShadow = true; skin.receiveShadow = true;
    C.reg(skin, infoHand);

    /* ---- relevo anatômico sob a luva ----
       Espaço de ligação (bind) da malha, em metros do ativo; +Y local de cada osso = dorsal (convenção WebXR).
       (a) nós dos dedos: cabeças dos metacarpos (MCF) e IFP elevadas no dorso, deslocando vértices ao longo da normal;
       (b) unhas sob o látex, rugas da luva (concentradas nas articulações) — relevo por "bump" procedural no shader. */
    const geo = skin.geometry, posA = geo.attributes.position, sI = geo.attributes.skinIndex, sW = geo.attributes.skinWeight;
    // (bindMatrixInverse não serve aqui: no modo "attached" ela é refeita a cada quadro a partir de matrixWorld)
    const bindInv = new THREE.Matrix4().copy(skin.bindMatrix).invert();
    const bindM = (name) => { const i = skin.skeleton.bones.indexOf(bones[name]); return skin.skeleton.boneInverses[i].clone().invert().premultiply(bindInv); };
    const jO = (name) => new THREE.Vector3().setFromMatrixPosition(bindM(name));
    const jDorsal = (name) => new THREE.Vector3(0, 1, 0).transformDirection(bindM(name));
    const domIdx = (i) => { let bi = 0, bw = -1; for (let c = 0; c < 4; c++) if (sW.getComponent(i, c) > bw) { bw = sW.getComponent(i, c); bi = sI.getComponent(i, c); } return bi; };
    const FINGERS4 = ['index', 'middle', 'ring', 'pinky'];
    {
      const bumps = [];
      for (const f of FINGERS4) {
        const n = (s) => f + '-finger-' + s, mcp = jO(n('phalanx-proximal')), pip = jO(n('phalanx-intermediate')), dip = jO(n('phalanx-distal'));
        const big = f === 'index' || f === 'middle';
        bumps.push({ c: mcp.clone().addScaledVector(pip.clone().sub(mcp).normalize(), -0.0015), ax: pip.clone().sub(mcp).normalize(), d: jDorsal(n('metacarpal')), amp: big ? 0.0026 : 0.0021, sa: 0.0064, sl: 0.0072 });
        bumps.push({ c: pip, ax: dip.clone().sub(pip).normalize(), d: jDorsal(n('phalanx-proximal')), amp: 0.0014, sa: 0.0042, sl: 0.0048 });
      }
      const na = geo.attributes.normal, v = new THREE.Vector3(), nn = new THREE.Vector3(), r = new THREE.Vector3(), moved = new Uint8Array(posA.count);
      for (let i = 0; i < posA.count; i++) {
        v.fromBufferAttribute(posA, i); nn.fromBufferAttribute(na, i);
        let disp = 0;
        for (const b of bumps) {
          r.copy(v).sub(b.c); const a = r.dot(b.ax), dd = r.dot(b.d); if (dd <= 0) continue;
          const l = Math.sqrt(Math.max(0, r.lengthSq() - a * a - dd * dd));
          disp += b.amp * C.smooth(0.2, 0.75, nn.dot(b.d)) * Math.exp(-(a * a) / (b.sa * b.sa) - (l * l) / (b.sl * b.sl));
        }
        if (disp > 2e-6) { posA.setXYZ(i, v.x + nn.x * disp, v.y + nn.y * disp, v.z + nn.z * disp); moved[i] = 1; }
      }
      posA.needsUpdate = true;
      // normais novas só onde houve deslocamento (média entre vértices coincidentes das costuras de UV)
      const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', posA); g2.setIndex(geo.index); g2.computeVertexNormals();
      const n2 = g2.attributes.normal, key = (i) => Math.round(posA.getX(i) * 2e4) + ',' + Math.round(posA.getY(i) * 2e4) + ',' + Math.round(posA.getZ(i) * 2e4), groups = new Map();
      for (let i = 0; i < posA.count; i++) if (moved[i]) { const k = key(i); (groups.get(k) || groups.set(k, []).get(k)).push(i); }
      for (const ids of groups.values()) { nn.set(0, 0, 0); for (const i of ids) nn.add(v.fromBufferAttribute(n2, i)); nn.normalize(); for (const i of ids) na.setXYZ(i, nn.x, nn.y, nn.z); }
      na.needsUpdate = true;
    }
    // articulações (máscara das rugas) e unhas (centro, eixo, lado, dorsal, semi-eixos) no espaço de ligação
    const uJ = [];
    for (const f of FINGERS4) for (const s of ['phalanx-proximal', 'phalanx-intermediate', 'phalanx-distal']) uJ.push(jO(f + '-finger-' + s));
    uJ.push(jO('thumb-phalanx-proximal'), jO('thumb-phalanx-distal'), jO('thumb-metacarpal'));
    const nails = { c: [], a: [], s: [], d: [], h: [] };
    for (const f of ['thumb', ...FINGERS4]) {
      const dn = f === 'thumb' ? 'thumb-phalanx-distal' : f + '-finger-phalanx-distal', tn = f === 'thumb' ? 'thumb-tip' : f + '-finger-tip';
      const o = jO(dn), tip = jO(tn), len = o.distanceTo(tip), A = tip.clone().sub(o).normalize();
      const D = jDorsal(dn); D.addScaledVector(A, -D.dot(A)).normalize(); const S = new THREE.Vector3().crossVectors(A, D);
      // superfície dorsal e meia-largura da polpa medidas nos vértices da falange distal
      const bd = skin.skeleton.bones.indexOf(bones[dn]), bt = skin.skeleton.bones.indexOf(bones[tn]); let hD = 0, wH = 0; const v = new THREE.Vector3();
      for (let i = 0; i < posA.count; i++) { const bi = domIdx(i); if (bi !== bd && bi !== bt) continue; v.fromBufferAttribute(posA, i).sub(o); const a = v.dot(A) / len; if (a < 0.45 || a > 0.75) continue; const lat = v.dot(S); if (Math.abs(lat) < 0.0015) hD = Math.max(hD, v.dot(D)); wH = Math.max(wH, Math.abs(lat)); }
      const thumb = f === 'thumb';
      nails.c.push(o.clone().addScaledVector(A, len * (thumb ? 0.62 : 0.64)).addScaledVector(D, hD || 0.006));
      nails.a.push(A); nails.s.push(S); nails.d.push(D);
      nails.h.push(new THREE.Vector2(len * (thumb ? 0.36 : 0.34), (wH || 0.007) * (thumb ? 0.78 : 0.74)));
    }
    const gloveBump = { value: 1 }; // intensidade do relevo procedural (0 desliga)
    gloveMat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, { uBump: gloveBump, uJ: { value: uJ }, uNC: { value: nails.c }, uNA: { value: nails.a }, uNS: { value: nails.s }, uND: { value: nails.d }, uNH: { value: nails.h } });
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vBindP; varying vec3 vBindN;')
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvBindN = objectNormal;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBindP = position;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vBindP; varying vec3 vBindN;
uniform float uBump; uniform vec3 uJ[${uJ.length}]; uniform vec3 uNC[5]; uniform vec3 uNA[5]; uniform vec3 uNS[5]; uniform vec3 uND[5]; uniform vec2 uNH[5];
float gHash(vec3 p) { p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.23)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float gNoise(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(gHash(i), gHash(i + vec3(1, 0, 0)), f.x), mix(gHash(i + vec3(0, 1, 0)), gHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(gHash(i + vec3(0, 0, 1)), gHash(i + vec3(1, 0, 1)), f.x), mix(gHash(i + vec3(0, 1, 1)), gHash(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
// altura do relevo (cm, unidades da cena): unhas sob o látex + rugas da luva concentradas nas articulações
float gloveHeight(vec3 p, vec3 n) {
  float h = 0.0;
  for (int k = 0; k < 5; k++) {
    vec3 q = p - uNC[k]; float u = dot(q, uNA[k]) / uNH[k].x, w = dot(q, uNS[k]) / uNH[k].y;
    float e = pow(pow(abs(u), 3.0) + pow(abs(w), 2.4), 0.36);           // contorno de unha (retângulo arredondado)
    float dors = smoothstep(0.15, 0.55, dot(n, uND[k]));
    h += dors * (0.020 * (1.0 - smoothstep(0.80, 1.0, e)) - 0.010 * exp(-pow((u + 1.08) / 0.16, 2.0)) * (1.0 - smoothstep(0.7, 1.0, abs(w))));
  }
  float m = 0.28;
  for (int k = 0; k < ${uJ.length}; k++) { vec3 d = p - uJ[k]; m += 0.9 * exp(-dot(d, d) / 0.00011); }
  m = min(m, 1.25);
  vec3 q = p * vec3(140.0, 400.0, 140.0); q.y += 1.6 * gNoise(p * 70.0);  // pregas transversais ao eixo dos dedos (~2,5 mm)
  float r = 1.0 - abs(2.0 * gNoise(q) - 1.0); r = r * r;
  float fw = length(fwidth(p));                                         // metros do ativo por pixel: some ao afastar (sem moiré)
  h += 0.012 * r * m * (1.0 - smoothstep(0.00012, 0.00045, fw));
  return h;
}`).replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{ // bump procedural (Mikkelsen): altura em unidades da cena, derivadas em espaço de tela
  // atenuado nas bordas rasantes da silhueta (onde as derivadas de tela serrilham)
  float gh = uBump * gloveHeight(vBindP, normalize(vBindN)) * smoothstep(0.08, 0.4, abs(dot(normal, normalize(vViewPosition))));
  vec3 sp = -vViewPosition, sx = dFdx(sp), sy = dFdy(sp);
  vec3 R1 = cross(sy, normal), R2 = cross(normal, sx);
  float det = dot(sx, R1);
  vec3 grad = sign(det) * (dFdx(gh) * R1 + dFdy(gh) * R2);
  normal = normalize(abs(det) * normal - grad);
}`);
    };
    gloveMat.customProgramCacheKey = () => 'glove-bump-v1';

    /* ---- pose: ângulos (rad) relativos ao repouso; flexão = rotação NEGATIVA em X local (convenção WebXR) ---- */
    const POSE = {
      final: {
        // indicador estendido, com leve flexão da IFD (a polpa — não a ponta — apoia na incisura)
        index: { mcp: [-0.58, 0.06, 0], pip: -0.08, dip: -0.16 },
        // 3º–5º: MCF ~70°, IFP ~95°, IFD ~37°
        middle: { mcp: [-1.22, -0.04, 0], pip: -1.65, dip: -0.65 },
        ring: { mcp: [-1.26, -0.08, 0], pip: -1.65, dip: -0.65 },
        pinky: { mcp: [-1.3, -0.14, 0], pip: -1.6, dip: -0.61 },
        // polegar abduzido, MCF levemente fletida, IF em leve hiperextensão (polpa pressionando)
        thumb: { cmc: [-0.3, 0, 0], mcp: -0.1, ip: 0.2 },
      },
      approach: {
        index: { mcp: [-0.2, 0.04, 0], pip: -0.08, dip: -0.05 },
        middle: { mcp: [-0.6, -0.02, 0], pip: -0.75, dip: -0.3 },
        ring: { mcp: [-0.62, -0.05, 0], pip: -0.76, dip: -0.3 },
        pinky: { mcp: [-0.64, -0.1, 0], pip: -0.74, dip: -0.28 },
        thumb: { cmc: [-0.05, 0, 0], mcp: -0.05, ip: -0.05 },
      },
    };
    const qE = new THREE.Quaternion(), eu = new THREE.Euler();
    const rot = (name, x, y = 0, z = 0) => { const b = bones[name]; if (!b) return; b.quaternion.copy(rest[name]).multiply(qE.setFromEuler(eu.set(x, y, z, 'XYZ'))); };
    const lp = (a, b, t) => a + (b - a) * t;
    function applyPose(k) {
      const A = POSE.approach, F = POSE.final;
      for (const f of ['index', 'middle', 'ring', 'pinky']) {
        const a = A[f], b = F[f];
        rot(f + '-finger-phalanx-proximal', lp(a.mcp[0], b.mcp[0], k), lp(a.mcp[1], b.mcp[1], k), lp(a.mcp[2], b.mcp[2], k));
        rot(f + '-finger-phalanx-intermediate', lp(a.pip, b.pip, k));
        rot(f + '-finger-phalanx-distal', lp(a.dip, b.dip, k));
      }
      const a = A.thumb, b = F.thumb;
      rot('thumb-metacarpal', lp(a.cmc[0], b.cmc[0], k), lp(a.cmc[1], b.cmc[1], k), lp(a.cmc[2], b.cmc[2], k));
      rot('thumb-phalanx-proximal', lp(a.mcp, b.mcp, k));
      rot('thumb-phalanx-distal', lp(a.ip, b.ip, k));
      rig.updateMatrixWorld(true);
    }

    /* ---- antebraço: punho da luva + manga do avental estéril (precauções de barreira máxima) ---- */
    // no espaço do ativo (metros): dedos → −y, dorso → −x, polegar (radial) → −z
    const W0 = new THREE.Vector3(-0.0377, 0.042, 0.0092), W1 = new THREE.Vector3(-0.0377, 0.062, 0.0092);
    // punho em leve extensão (antebraço elevado em relação ao dorso) e desvio radial (antebraço vem mais de lateral)
    const WRIST = { ext: 20, rad: 18 };
    const fa = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(-WRIST.rad * Math.PI / 180, 0, WRIST.ext * Math.PI / 180, 'XYZ'));
    const armPath = [W0, W1, ...[0.03, 0.08, 0.14, 0.22, 0.31, 0.4].map((s) => W1.clone().addScaledVector(fa, s))];
    const curveArm = C.curve(armPath), lenArm = curveArm.getLength();
    // semi-eixos do antebraço "nu" (dorsopalmar rx, radioulnar ry) em função do comprimento m (m) a partir de W0
    const baseRx = (m) => 0.0184 + 0.0115 * C.smooth(0.03, 0.17, m) + 0.004 * C.smooth(0.2, 0.36, m);
    const baseRy = (m) => 0.0250 + 0.011 * C.smooth(0.03, 0.17, m) + 0.004 * C.smooth(0.2, 0.36, m);
    const up = () => new THREE.Vector3(-1, 0, 0);
    const CUFF = 0.09; // o punho da luva cobre ~7 cm do antebraço
    const cuffPath = [W0, W1, W1.clone().addScaledVector(fa, 0.03), W1.clone().addScaledVector(fa, CUFF - 0.02)];
    const lenCuff = C.curve(cuffPath).getLength();
    // folga sobre a manga + rolete da borda; nos últimos 2 mm a borda "dobra" para dentro, encostando na manga (sem fresta)
    const cuffAdd = (m) => 0.0058 * C.smooth(0.004, 0.034, m) + 0.0026 * Math.exp(-(((m - lenCuff + 0.0045) / 0.0032) ** 2)) - 0.0042 * C.smooth(lenCuff - 0.0022, lenCuff, m);
    const cuffGeo = C.sweepGeometry(cuffPath, { up, rx: (t) => baseRx(t * lenCuff) + cuffAdd(t * lenCuff), ry: (t) => baseRy(t * lenCuff) + cuffAdd(t * lenCuff), segments: 56, radial: 40, caps: 'none' });
    mesh(cuffGeo, gloveMat, asset, GI({ id: 'operator-hand', name: 'Punho da luva estéril (sobre a manga do avental)' }));
    const sleeveMat = PM({ color: '#86a9c6', roughness: 0.9, sheen: 0.7, sheenRoughness: 0.6, sheenColor: '#d8e8f6', normalMap: texRep('fine', 10, 1), normalScale: new THREE.Vector2(0.7, 0.7) });
    const sleevePath = armPath.slice(1), lenSl = C.curve(sleevePath).getLength();
    const slAdd = (m) => 0.0034 * C.smooth(0.03, 0.08, m) + 0.004 * C.smooth(0.1, 0.2, m); // manga folgada (sob o punho: justa)
    const sleeveGeo = C.sweepGeometry(sleevePath, {
      up, rx: (t) => { const m = 0.02 + t * lenSl; return baseRx(m) + slAdd(m); }, ry: (t) => { const m = 0.02 + t * lenSl; return baseRy(m) + slAdd(m); },
      radial_fn: (t, a) => 1 + C.smooth(0.25, 0.45, t) * (0.03 * Math.sin(a * 5 + t * 9) + 0.015 * Math.sin(a * 9 - t * 23)),
      segments: 70, radial: 36, caps: 'flat', capStart: false, vScale: 0.02,
    });
    mesh(sleeveGeo, sleeveMat, asset, GI({ id: 'operator-hand', name: 'Manga do avental estéril' }));

    const physToAnat = (w) => [-w.x, w.y, w.z]; // coordenadas da cena (= físicas) → anatômicas
    const physToAnatV = (w) => new THREE.Vector3(-w.x, w.y, w.z);
    /* ---- polpas (vértices da superfície palmar das falanges distais) ---- */
    const boneIdx = (n) => skin.skeleton.bones.indexOf(bones[n]);
    const vW = new THREE.Vector3();
    // posição "de mundo" de um vértice deformado, direto das matrizes dos ossos (não depende de bindMatrixInverse,
    // que só é atualizada por updateMatrixWorld — evitando transformação dupla após updateWorldMatrix)
    const _sm = new THREE.Matrix4(), _sv = new THREE.Vector3(), _sa = new THREE.Vector3();
    const vPos = (i, out = new THREE.Vector3()) => {
      _sv.fromBufferAttribute(posA, i).applyMatrix4(skin.bindMatrix); out.set(0, 0, 0);
      for (let c = 0; c < 4; c++) { const w = sW.getComponent(i, c); if (!w) continue; const b = sI.getComponent(i, c); _sm.multiplyMatrices(skin.skeleton.bones[b].matrixWorld, skin.skeleton.boneInverses[b]); out.addScaledVector(_sa.copy(_sv).applyMatrix4(_sm), w); }
      return out;
    };
    applyPose(1);
    function findPad(distal, tip) {
      const bd = boneIdx(distal), bt = boneIdx(tip);
      const D = bones[distal].getWorldPosition(new THREE.Vector3()), T = bones[tip].getWorldPosition(new THREE.Vector3());
      const ax = T.clone().sub(D).normalize();
      const palm = new THREE.Vector3(0, -1, 0).applyQuaternion(bones[distal].getWorldQuaternion(new THREE.Quaternion())); // −Y local = palmar
      let best = -1, bestV = -1e9; const cand = [];
      for (let i = 0; i < posA.count; i++) {
        let w = 0; for (let c = 0; c < 4; c++) { const bi = sI.getComponent(i, c); if (bi === bd || bi === bt) w += sW.getComponent(i, c); }
        if (w < 0.5) continue;
        vPos(i, vW); const s = vW.clone().sub(T).dot(ax), sc = vW.clone().sub(D).dot(palm);
        if (sc > -0.001) cand.push(i); // falange distal (polpa e extremidade), exceto a face ungueal
        if (s > -0.0055 || s < -0.012) continue;
        if (sc > bestV) { bestV = sc; best = i; }
      }
      return { best, cand };
    }
    mark('arm');
    const fpI = findPad('index-finger-phalanx-distal', 'index-finger-tip'), fpT = findPad('thumb-phalanx-distal', 'thumb-tip');
    let padIdx = fpI.best, padThumb = fpT.best;

    /* ---- alinhamento: escala, rotação e translação (ativo → físico) ----
       Restrições: (1) polpa do indicador no alvo; (2) polpa do polegar no alvo; (3) o giro restante em torno do eixo
       indicador–polegar é escolhido para dorso anterior/superolateral, antebraço vindo de cranial-lateral e nenhuma
       parte da mão/antebraço abaixo da pele.
       A ESCALA É FIXA (anatômica: mão masculina média com luva, ~18,8 cm do punho à ponta do médio). O vão entre as
       polpas é obtido pela POSE — abdução/extensão do polegar na CMC (busca binária) —, e não esticando a mão;
       assim o tamanho da mão não depende do contorno da pele de outro módulo. */
    const S_HAND = 105; // cm por metro do ativo
    // polpas exatamente sobre a pele efetiva (se plausível: até 1,2 cm do valor de LM)
    const onSkin = (p) => { const z = skinZ(p[0], p[1]); return new THREE.Vector3(p[0], p[1], hasSkin && Math.abs(z - p[2]) < 1.2 ? z : p[2]); };
    let idxShift = 0;                                  // deslocamento lateral (+x) do alvo do indicador, se a ponta tocar a encosta contralateral
    let tI = onSkin(NL.indexSkin), tT = onSkin(NL.thumbSkin);
    // o ponto mais profundo da falange distal fica levemente "dentro" da pele: depressão das partes moles pela
    // pressão (polegar ~2 mm, indicador ~1 mm) — sem deformar a malha da pele
    const PRESS_I = 0.1, PRESS_T = 0.2;
    let pI, pT;
    const setTargets = () => { tI = onSkin([NL.indexSkin[0] + idxShift, NL.indexSkin[1], NL.indexSkin[2]]); pI = v3(phys([tI.x, tI.y, tI.z - PRESS_I])); pT = v3(phys([tT.x, tT.y, tT.z - PRESS_T])); };
    setTargets();
    const Dn = new THREE.Vector3(-1, 0, 0), Fa = fa.clone();                       // dorso e antebraço (ativo)
    const Ddes = v3(phys([0.3, 0.35, 1])).normalize(), Fdes = v3(phys([0.55, 0.62, 0.55])).normalize();
    const armS = []; for (let k = 2; k <= 10; k++) armS.push(curveArm.getPointAt(k / 10));
    const qTmp = new THREE.Quaternion(), pp = new THREE.Vector3(), invRig = new THREE.Matrix4();
    const baseMatrix = new THREE.Matrix4();
    let fitInfo = null;
    function fit() {
      rig.matrixAutoUpdate = false; rig.matrix.identity(); rig.matrixWorldNeedsUpdate = true;
      const aP = (i) => vPos(i).applyMatrix4(invRig);
      const upd = () => { applyPose(1); if (rig.parent) rig.parent.updateWorldMatrix(true, true); invRig.copy(rig.matrixWorld).invert(); };
      // vão polpa-polpa desejado (no espaço do ativo) → flexão/abdução da CMC do polegar por busca binária
      const want = pT.distanceTo(pI) / S_HAND, Fth = POSE.final.thumb;
      const span = (c) => { Fth.cmc[0] = c; upd(); return aP(padThumb).distanceTo(aP(padIdx)); };
      let lo = -0.85, hi = 0.2;
      if (span(lo) >= want) hi = lo; else if (span(hi) <= want) lo = hi;
      else for (let k = 0; k < 18; k++) { const m = (lo + hi) / 2; if (span(m) < want) lo = m; else hi = m; }
      span((lo + hi) / 2);
      const aI = aP(padIdx), aT = aP(padThumb);
      // fora do alcance da pose: tolera-se ±4% de escala (o resto fica como folga no polegar)
      const scale = C.clamp(pT.distanceTo(pI) / aT.distanceTo(aI), S_HAND * 0.96, S_HAND * 1.04);
      const ua = aT.clone().sub(aI).normalize(), up_ = pT.clone().sub(pI).normalize();
      const R0 = new THREE.Quaternion().setFromUnitVectors(ua, up_);
      // amostra de vértices (exclui as polpas) para penalizar penetração na pele
      const samp = []; for (let i = 0; i < posA.count; i += 23) { const p = aP(i); if (p.distanceTo(aI) < 0.015 || p.distanceTo(aT) < 0.015) continue; samp.push(p); }
      const evalPhi = (phi) => {
        const q = qTmp.setFromAxisAngle(up_, phi).multiply(R0);
        const t = pI.clone().sub(aI.clone().applyQuaternion(q).multiplyScalar(scale));
        let pen = 0;
        // penetração (cm²): por amostra limitada a 2 cm, para que uma pele defeituosa não domine a escolha
        for (const s of samp) { pp.copy(s).applyQuaternion(q).multiplyScalar(scale).add(t); const d = Math.min(2, restZ(-pp.x, pp.y) + 0.15 - pp.z); if (d > 0) pen += d * d; }
        for (const s of armS) { pp.copy(s).applyQuaternion(q).multiplyScalar(scale).add(t); const d = Math.min(3, restZ(-pp.x, pp.y) + 4.6 - pp.z); if (d > 0) pen += 0.3 * d * d; }
        const dors = Dn.clone().applyQuaternion(q).dot(Ddes), fore = Fa.clone().applyQuaternion(q).dot(Fdes);
        return { q: q.clone(), t, cost: -1.0 * dors - 0.8 * fore + 0.25 * pen, pen, dors, fore };
      };
      // giro admissível: dorso ao menos parcialmente anterior e antebraço vindo de cranial/lateral
      let best = null, bestAny = null;
      for (let k = 0; k < 144; k++) { const r = evalPhi((k / 144) * Math.PI * 2); if (!bestAny || r.cost < bestAny.cost) bestAny = r; if (r.dors > 0.25 && r.fore > 0.2 && (!best || r.cost < best.cost)) best = r; }
      best = best || bestAny;
      baseMatrix.compose(best.t, best.q, new THREE.Vector3(scale, scale, scale));
      rig.matrix.copy(baseMatrix); rig.matrixWorldNeedsUpdate = true;
      fitInfo = { scale, thumbCMC: +Fth.cmc[0].toFixed(3), spanErr: +(pT.distanceTo(pI) - aT.distanceTo(aI) * scale).toFixed(3), cost: best.cost, pen: best.pen, dors: best.dors, fore: best.fore, padDist: aT.distanceTo(aI) };
      return fitInfo;
    }
    mark('pads');
    fit();
    handRoot.add(rig);
    const domBone = (i) => { let bi = 0, bw = -1; for (let c = 0; c < 4; c++) if (sW.getComponent(i, c) > bw) { bw = sW.getComponent(i, c); bi = sI.getComponent(i, c); } return skin.skeleton.bones[bi].name; };
    // vértices de cada dedo (por osso dominante), para medir penetração
    const fingerVerts = {};
    for (let i = 0; i < posA.count; i++) { const n = domBone(i); const f = n.split('-')[0]; (fingerVerts[f] || (fingerVerts[f] = [])).push(i); }
    const idxDistal = []; for (const i of fingerVerts.index || []) { const n = domBone(i); if (n === 'index-finger-phalanx-distal' || n === 'index-finger-tip' || n === 'index-finger-phalanx-intermediate') idxDistal.push(i); }
    const maxPen = (list, fz, clear = 0, step = 1) => { const w = new THREE.Vector3(); let mx = -1e9; for (let k = 0; k < list.length; k += step) { vPos(list[k], w); const a = physToAnatV(w); const d = fz(a.x, a.y) + clear - a.z; if (d > mx) mx = d; } return mx; };
    /* Refinamento do contato: num dedo inclinado, o ponto que toca a pele é o mais "profundo" da polpa (próximo à
       extremidade). Escolhe-se esse vértice como novo alvo e repete-se o ajuste (até 5 iterações). */
    const refineContact = () => {
      const w = new THREE.Vector3();
      const deepest = (cand) => { let bi = -1, bd = -1e9; for (const i of cand) { vPos(i, w); const a = physToAnatV(w); const d = skinZ(a.x, a.y) - a.z; if (d > bd) { bd = d; bi = i; } } return { i: bi, d: bd }; };
      const allowI = PRESS_I + 0.04, allowT = PRESS_T + 0.04;
      for (let it = 0; it < 5; it++) {
        rig.parent.updateWorldMatrix(true, true);
        const di = deepest(fpI.cand), dt = deepest(fpT.cand);
        if (di.d < allowI && dt.d < allowT) break;
        if (di.d >= allowI) padIdx = di.i;
        if (dt.d >= allowT) padThumb = dt.i;
        fit();
      }
    };
    refineContact();
    /* Indicador × incisura: a ponta não pode afundar na encosta contralateral da incisura. Critério: penetração máxima
       de TODOS os vértices das falanges média/distal do indicador ≤ pressão pretendida + 0,5 mm. Se exceder, o alvo
       da polpa desliza para a direita (+x, até 0,6 cm, ainda dentro da incisura) e refaz-se o ajuste. */
    const idxPen = () => { rig.parent.updateWorldMatrix(true, true); return maxPen(idxDistal, skinZ); };
    let pIdx = idxPen();
    for (let it = 0; it < 6 && pIdx > PRESS_I + 0.05; it++) { idxShift += 0.1; setTargets(); fit(); refineContact(); pIdx = idxPen(); }
    if (pIdx > PRESS_I + 0.05) { pI.z += pIdx - PRESS_I; fit(); pIdx = idxPen(); } // último recurso: eleva o alvo
    /* Adaptação da pose à superfície (pele, ou pele + campo): dedos 3–5 que toquem a superfície têm a flexão da MCF
       reduzida e a da IFP aumentada (enrolam-se mais junto à palma), sem alterar as polpas do indicador e do polegar. */
    function adaptFingers() {
      for (const f of ['middle', 'ring', 'pinky']) {
        const list = fingerVerts[f] || [];
        for (let it = 0; it < 6; it++) {
          applyPose(1); rig.parent.updateWorldMatrix(true, true);
          if (maxPen(list, restZ, 0.05, 3) < 0.04) break;
          const P = POSE.final[f]; P.mcp[0] = Math.min(-0.45, P.mcp[0] + 0.12); P.pip = Math.max(-1.95, P.pip - 0.08); P.dip = Math.max(-0.9, P.dip - 0.04);
        }
      }
      applyPose(1);
    }
    adaptFingers();
    mark('fit');
    // direção de afastamento (pose 0): normal média da pele nas polpas
    const awayAnat = surfNormal(skinZ, tI.x, tI.y).add(surfNormal(skinZ, tT.x, tT.y)).add(new THREE.Vector3(0, 0.35, 0.6)).normalize();
    const awayPhys = v3(phys(awayAnat.toArray()));
    let lastK = -1;
    const tmpQ = new THREE.Quaternion();
    function setPose(k) {
      k = C.clamp(k, 0, 1); if (Math.abs(k - lastK) < 1e-4) return; lastK = k;
      if (!rig.parent) return;
      rig.matrix.copy(baseMatrix); const off = awayPhys.clone().multiplyScalar(3.0 * (1 - k));
      rig.matrix.elements[12] += off.x; rig.matrix.elements[13] += off.y; rig.matrix.elements[14] += off.z;
      rig.matrixWorldNeedsUpdate = true;
      applyPose(k); handRoot.updateWorldMatrix(true, false); rig.updateMatrixWorld(true);
      setA('indexTip', physToAnat(vPos(padIdx)));
      setA('thumbTip', physToAnat(vPos(padThumb)));
      const palm = new THREE.Vector3();
      for (const n of ['index-finger-phalanx-proximal', 'middle-finger-phalanx-proximal', 'ring-finger-phalanx-proximal', 'wrist']) palm.add(bones[n].getWorldPosition(new THREE.Vector3()));
      setA('palm', physToAnat(palm.multiplyScalar(0.25)));
    }
    setPose(1);
    // centro da falange distal do polegar (para a seta do vetor de pressão)
    const thumbD = bones['thumb-phalanx-distal'].getWorldPosition(new THREE.Vector3()), thumbT = bones['thumb-tip'].getWorldPosition(new THREE.Vector3());
    const nailAnat = new THREE.Vector3(...physToAnat(thumbD.clone().lerp(thumbT, 0.5)));
    const dorsalThumb = new THREE.Vector3(...physToAnat(new THREE.Vector3(0, 1, 0).applyQuaternion(bones['thumb-phalanx-distal'].getWorldQuaternion(tmpQ)))).normalize();
    const refit = () => { padIdx = fpI.best; padThumb = fpT.best; fit(); refineContact(); lastK = -1; setPose(1); return fitInfo; };
    // comprimento da mão (centro do punho → ponta do médio, soma dos segmentos ósseos em repouso × escala), em cm
    const handLen = (() => { const nn = ['wrist', 'middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip'].map(jO); let L = 0; for (let k = 1; k < nn.length; k++) L += nn[k].distanceTo(nn[k - 1]); return L * fitInfo.scale; })();
    /** Reajuste ao surgir o campo estéril: os dedos 3–5 voltam a ser enrolados contra a nova superfície de apoio. */
    const onSurfaceChange = () => { adaptFingers(); lastK = -1; setPose(1); };
    // diagnóstico: vértices da mão abaixo da superfície (por osso dominante)
    const penReport = (fz = restZ, clear = 0) => { const out = {}; const w = new THREE.Vector3(); for (let i = 0; i < posA.count; i += 7) { vPos(i, w); const a = physToAnat(w); const d = fz(a[0], a[1]) + clear - a[2]; if (d > 0) { let bi = 0, bw = -1; for (let c = 0; c < 4; c++) if (sW.getComponent(i, c) > bw) { bw = sW.getComponent(i, c); bi = sI.getComponent(i, c); } const n = skin.skeleton.bones[bi].name; const o = out[n] || (out[n] = { n: 0, max: 0, at: null }); o.n++; if (d > o.max) { o.max = +d.toFixed(2); o.at = a.map((x) => +x.toFixed(1)); } } } return out; };
    return { gloveMat, gloveBump, rig, bones, skin, setPose, get fitInfo() { return Object.assign({ handLenCm: +handLen.toFixed(1), indexShift: +idxShift.toFixed(2), indexPen: +pIdx.toFixed(3) }, fitInfo); }, refit, penReport, onSurfaceChange, get padIdx() { return padIdx; }, get padThumb() { return padThumb; }, tI, tT, nailAnat, dorsalThumb, applyPose, POSE, baseMatrix, vPos, physToAnat, maxPen, fingerVerts, idxDistal };
  }

  /* Vetor de pressão do polegar: seta dourada (posterior/inferior) AO LADO do polegar — não sobre a unha —, com a
     ponta 2–3 mm acima da pele, e dois anéis de "depressão" na pele sob a polpa (legíveis também na vista frontal).
     A posição lateral é escolhida automaticamente para não tocar a mão (preferência: lateral, depois inferolateral). */
  const thumbArrow = new THREE.Group(); thumbArrow.name = 'Vetor do polegar'; aids.add(thumbArrow);
  {
    const tT = hand ? hand.tT : new THREE.Vector3(NL.thumbSkin[0], NL.thumbSkin[1], skinZ(NL.thumbSkin[0], NL.thumbSkin[1]));
    const dP = new THREE.Vector3(0, -0.7, -0.71).normalize(); // posterior e inferior (~45°: legível também de frente)
    const info = GI({ id: 'thumb-vector', name: 'Vetor do polegar: depressão suave dos tecidos (posterior/inferior)', desc: 'Indica apenas a direção do apoio do polegar; não quantifica força nem serve de batente de profundidade.' });
    const LEN = 3.6, RR = 1.42;
    const hv = []; if (hand) { const n = hand.skin.geometry.attributes.position.count; for (let i = 0; i < n; i += 7) hv.push(new THREE.Vector3(...hand.physToAnat(hand.vPos(i)))); }
    const segD = (p, a, b) => { const ab = b.clone().sub(a), t = C.clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1); return p.distanceTo(a.clone().addScaledVector(ab, t)); };
    let best = null;
    for (const deg of [0, -20, 20, -40, -60, 40, -80, 60, -100, 90, 180]) {
      const a = (deg * Math.PI) / 180, hx = tT.x + RR * Math.cos(a), hy = tT.y + RR * Math.sin(a);
      const head = new THREE.Vector3(hx, hy, skinZ(hx, hy) + 0.25), tail = head.clone().addScaledVector(dP, -LEN);
      let clr = 1e9; for (const p of hv) clr = Math.min(clr, segD(p, head, tail) - 0.3);
      const score = Math.min(clr, 0.6) - 0.004 * Math.abs(deg);
      if (!best || score > best.score) best = { head, tail, clr, deg, score };
    }
    const { head, tail } = best;
    const shaftEnd = head.clone().addScaledVector(dP, -0.78);
    mesh(C.segmentGeometry(tail.toArray(), shaftEnd.toArray(), 0.09, 0.09, 14), mats.gold, thumbArrow, info, { cast: false });
    const cone = mesh(new THREE.ConeGeometry(0.32, 0.86, 20), mats.gold, thumbArrow, info, { cast: false });
    cone.position.copy(head.clone().addScaledVector(dP, -0.43)); cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dP);
    // "ondas" de depressão na pele, entre a polpa do polegar e a seta (arcos concêntricos que acompanham a pele)
    const n0 = surfNormal(skinZ, tT.x, tT.y), e1 = new THREE.Vector3(1, 0, 0).addScaledVector(n0, -n0.x).normalize(), e2 = new THREE.Vector3().crossVectors(n0, e1);
    const a0 = (best.deg * Math.PI) / 180;
    [[0.92, 0.9, 0.03], [1.16, 0.55, 0.024]].forEach(([r, op, rt]) => {
      const pts = []; for (let i = 0; i <= 40; i++) { const a = a0 + (-1.25 + 2.5 * (i / 40)); const p = tT.clone().addScaledVector(e1, r * Math.cos(a)).addScaledVector(e2, r * Math.sin(a)); p.z = skinZ(p.x, p.y) + 0.05; pts.push(p); }
      const m = new THREE.MeshBasicMaterial({ color: '#c99a3e', transparent: true, opacity: op, depthWrite: false });
      const arc = mesh(C.sweepGeometry(pts, { r: rt, radial: 8, segments: 60, caps: 'round' }), m, thumbArrow, GI({ id: 'thumb-vector', name: 'Depressão dos tecidos sob a polpa do polegar' }), { cast: false, receive: false });
      arc.renderOrder = 2;
    });
    setA('thumbVector', tail.clone().lerp(head, 0.35).toArray());
    thumbArrow.userData.choice = { deg: best.deg, clearance: +best.clr.toFixed(2) };
  }
  if (!hand) { setA('indexTip', NL.indexSkin); setA('thumbTip', NL.thumbSkin); setA('palm', [6, 4.5, 6]); }

  /* ======================================================================
     9. Estado: fases com transições suaves (~0,6 s)
     ====================================================================== */
  const PH = [
    { s: sSkin - 2.0, nd: 0, syr: 1, ret: 0, blood: 0, wire: 0, cath: 0 },  // 0 sem agulha
    { s: sSkin - 2.0, nd: 1, syr: 1, ret: 0, blood: 0, wire: 0, cath: 0 },  // 1 aproximação (2 cm fora da pele)
    { s: sSkin + 0.5, nd: 1, syr: 1, ret: 0.25, blood: 0, wire: 0, cath: 0 }, // 2 ponta sob a pele
    { s: sClav, nd: 1, syr: 1, ret: 0.35, blood: 0, wire: 0, cath: 0 },     // 3 ponta sob a clavícula
    { s: sTip4, nd: 1, syr: 1, ret: 1.35, blood: 1, wire: 0, cath: 0 },     // 4 ponta (bisel inteiro) logo além da parede: refluxo de sangue escuro
    { s: sTip4, nd: 1, syr: 0, ret: 1.35, blood: 1, wire: 1, cath: 0 },     // 5 seringa removida (agulha imóvel), fio-guia avançado
    { s: sTip4 - 7, nd: 0, syr: 0, ret: 0, blood: 0, wire: 0, cath: 1 },    // 6 agulha e fio retirados; cateter posicionado
  ];
  const cur = Object.assign({}, PH[0]); let from = Object.assign({}, PH[0]), to = PH[0], tt = 1, lastPhase = -1;
  const fade = (g, k) => { g.visible = k > 0.01; g.traverse((o) => { const m = o.material; if (!m || !m.isMaterial) return; if (m.userData.op0 === undefined) m.userData.op0 = m.opacity; m.opacity = m.userData.op0 * k; }); };
  const tipNow = new THREE.Vector3();
  function applyCur(state) {
    tipNow.copy(along(cur.s));
    needleAsm.position.copy(tipNow);
    needleAsm.visible = cur.nd > 0.01;
    fade(needleGrp, cur.nd); hubBlood.visible = cur.blood > 0.05 && cur.nd > 0.05 && cur.syr < 0.5;
    fade(syringe, Math.min(cur.syr, cur.nd)); syringe.position.y = -(1 - cur.syr) * 4.5;
    plunger.position.y = -cur.ret;
    syrBlood.visible = cur.blood > 0.02; bloodCol.scale.y = Math.max(0.001, (cur.ret + 0.1) * cur.blood);
    wire.userData.grow(cur.wire); wire.visible = cur.wire > 0.01;
    const mal = !!(state && state.wireMal);
    wireMal.visible = mal && cur.wire > 0.5; wireMal.userData.grow(mal ? C.clamp((cur.wire - 0.5) * 2, 0, 1) : 0);
    cath.userData.grow(cur.cath); catheterGrp.visible = cur.cath > 0.01;
    fade(hubGrp, C.smooth(0.6, 1, cur.cath));
    catheterGrp.children.forEach((c) => { if (c !== cath && c !== hubGrp && !c.userData.internal) { c.visible = cur.cath > 0.97; } });
    setA('needleTip', tipNow.toArray());
    setA('needleHub', along(cur.s).addScaledVector(dir, (L_HUB0 + L_HUB1) / 2).toArray());
    setA('syringe', along(cur.s).addScaledVector(dir, (B_FRONT + B_REAR) / 2 - (1 - cur.syr) * 4.5).toArray());
  }
  let lastWireMal = null, lastState = {};
  /** Superfície de apoio = pele, ou pele + campo estéril quando a camada 'drape' está visível. O campo (módulo skin) é
      construído sob demanda: quando suas malhas aparecem, rasteriza-se o novo mapa; a cada troca pele ↔ campo
      reassentam-se o canhão/extensões do cateter (e, com o campo, os dedos 3–5 da mão). */
  function syncSurface(state) {
    const vis = !!layers.drape.visible;
    if (vis) { const n = countMeshes(layers.drape); if (n !== drapeMeshes) { drapeMeshes = n; drapeField = n ? makeField(['skin', 'drape']) : null; surfKey = ''; } }
    const want = vis && drapeField ? 'drape' : 'skin';
    if (want === surfKey) return;
    surfKey = want; restField = (want === 'drape' ? drapeField : skinField) || skinField;
    layoutExternal(); if (hand && want === 'drape') hand.onSurfaceChange();
    applyCur(state);
  }
  function update(state, dt) {
    state = state || {}; lastState = state;
    syncSurface(state);
    const p = Math.max(0, Math.min(6, Math.round(+state.phase || 0)));
    if (p !== lastPhase) { from = Object.assign({}, cur); to = PH[p]; tt = dt > 0 && lastPhase >= 0 ? 0 : 1; lastPhase = p; }
    const animating = tt < 1; // inclui o quadro em que a transição termina
    if (tt < 1) tt = Math.min(1, tt + (dt || 0) / 0.6);
    const e = ease(tt); for (const k in to) cur[k] = from[k] + (to[k] - from[k]) * e;
    if (animating || !dt || lastWireMal !== !!state.wireMal) { applyCur(state); lastWireMal = !!state.wireMal; }
    if (hand) hand.setPose(state.handPose === undefined ? 1 : +state.handPose);
    planes.visible = !!state.showPlanes;
    const hp = state.handPose === undefined ? 1 : +state.handPose;
    thumbArrow.visible = !!hand && hp > 0.85 && layers.hand.visible;
    markers.forEach((m) => { m.visible = layers.skin.visible || layers.hand.visible; });
    const instOn = layers.instrument.visible;
    // "raio X" só nas vistas anatômicas (sem pele): numa vista realista o trajeto interno não deve atravessar mão/pele
    const xr = instOn && !layers.skin.visible;
    xrayWire.visible = xr && wire.visible; xrayCath.visible = xr && catheterGrp.visible; xrayMal.visible = xr && wireMal.visible;
  }
  update({ phase: 0, handPose: 1 }, 0);
  mark('total');

  return {
    anchors,
    update,
    api: {
      settle() { tt = 1; for (const k in to) cur[k] = to[k]; applyCur(lastState); },
      /** trecho externo do cateter (coords anatômicas): path[0..nExternal-1] = canhão→saída; entry = sítio de saída na pele;
          surfaceZ(x,y) = superfície de apoio atual (pele ou campo); onExternal(fn) chamado a cada reassentamento */
      external: () => extInfo, surfaceZ: (x, y) => restZ(x, y), skinZ: (x, y) => skinZ(x, y), onExternal: (fn) => { extListeners.push(fn); },
      setXray(on) { [mats.xrayWire, mats.xrayCath, mats.xrayMal].forEach((m) => { m.visible = !!on; }); },
      // vista caudal, perpendicular ao plano agulha–eixo anteroposterior: o setor do ângulo aparece em verdadeira grandeza
      // (a vista lateral olha quase ao longo da agulha, que corre mediolateralmente, e achata o setor)
      angleView: { target: entryEff.toArray(), radius: 16, az: -0.25, el: -1.2 },
      debug: () => ({
        prof, hasSkin, sSkin, sClav, sVein, sWall, sTip4,
        needle4: { depthFromSkin: +(sTip4 - sSkin).toFixed(2), shaftOutsideSkin: +(NEEDLE_L - (sTip4 - sSkin)).toFixed(2), pastWall: +(sTip4 - sWall).toFixed(2) },
        lumen: lumenReport, external: extReport, heartStartY: heartHit && +heartHit.y.toFixed(2), cathTip: cathTipP.toArray().map((x) => +x.toFixed(2)),
        thumbArrow: thumbArrow.userData.choice, drapeMeshes, surface: surfKey,
        hand: hand && Object.assign({ fingersPenRest: Object.fromEntries(['index', 'middle', 'ring', 'pinky', 'thumb'].map((f) => [f, +hand.maxPen(hand.fingerVerts[f] || [], restZ, 0, 2).toFixed(2)])) }, hand.fitInfo),
      }),
      hand,
    },
  };
});
