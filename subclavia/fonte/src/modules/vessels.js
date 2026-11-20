/* ==========================================================================
   vessels.js — árvore vascular cervicotorácica (camadas `vein` e `artery`)
   Coordenadas ANATÔMICAS: x = direita do paciente (+), y = cranial (+), z = anterior (+); cm.
   Eixos principais: LM.vessels (pontos não alterados; pontos intermediários indicados no código).

   Técnica (resumo):
   • Cada sistema contínuo (p.ex. axilar → subclávia → VBC D → VCS; aorta; TBC → carótida comum D;
     tronco tireocervical → tireóidea inferior) é varrido como UMA superfície e depois FATIADO por anéis
     em malhas com ids próprios → emendas sem fissura nem degrau, com normais contínuas.
   • Confluências = UNIÃO de superfícies: cada ramo nasce/termina dentro do tronco; a parede do ramo
     recebe um FILETE côncavo (alarga em função da distância à superfície do tronco, encontrando-a
     tangencialmente) e, ao final, as porções de cada malha que ficam DENTRO da outra são recortadas
     (triângulos cortados exatamente na curva de interseção). Resultado: luz contínua nos cortes
     (VJI ↔ subclávia ↔ VBC ↔ VCS), sem tampas internas, sem "bolas" nos óstios.
   • Veias têm secção oval (colapsáveis) e CEDEM (achatamento local) onde tocam artérias e ossos;
     artérias cedem apenas a ossos. A acomodação usa os vértices/normais reais de `layers.bones`,
     o manúbrio analítico (LM.sternum, mesma construção do esqueleto) e os eixos das artérias.
   • Extremidades de recorte didático exibem parede + luz (sangue), como nas pranchas de atlas.
   ========================================================================== */
ATLAS.define('vessels', function (ctx) {
  'use strict';
  const { THREE, C, LM, layers } = ctx;
  const VV = LM.vessels;
  const LV = layers.vein, LA = layers.artery;
  const Q = C.quality || 1;
  const V3 = THREE.Vector3;
  const mir = (p) => [-p[0], p[1], p[2]];
  const mirP = (pts) => pts.map(mir);
  const GV = (k) => Object.assign({ group: 'Veias' }, k);
  const GA = (k) => Object.assign({ group: 'Artérias' }, k);
  const gauss = (x, w) => Math.exp(-(x / w) * (x / w));
  const T_START = performance.now();

  /* =====================================================================
     MATERIAIS — superfícies úmidas (clearcoat), cor levemente mosqueada e
     "borda translúcida" (realce de Fresnel multiplicativo: depende da luz,
     não brilha na sombra). Sem transparência real.
     ===================================================================== */
  function withRim(m, key, tint, k, pw) {
    const prev = m.onBeforeCompile;
    const t = tint.map((v) => v.toFixed(3)).join(',');
    m.onBeforeCompile = (sh, r) => {
      if (prev) prev(sh, r);
      sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>',
        '{ float vxFr = pow(1.0 - saturate(abs(dot(nonPerturbedNormal, geometryViewDir))), ' + pw.toFixed(2) + ');\n' +
        '  outgoingLight *= mix(vec3(1.0), vec3(' + t + '), vxFr * ' + k.toFixed(3) + '); }\n#include <opaque_fragment>');
    };
    const prevKey = m.customProgramCacheKey ? m.customProgramCacheKey() : '';
    m.customProgramCacheKey = () => prevKey + '|vxrim:' + key;
    return m;
  }
  const nFine = C.mats.vein.normalMap;
  const nScale = (s) => new THREE.Vector2(s, s);
  // textura mosqueada NEUTRA compartilhada (cinza 0xd8 ≈ 0,686 linear); a cor do material compensa
  const MOT = C.tex.mottle('vx-mottle', 0xd8d8d8, { amp: 0.085, freq: 0.05, size: 128, seed: 4 });
  const tint = (hex) => new THREE.Color(hex).multiplyScalar(1 / 0.686);
  const MAT = {
    vein: withRim(C.mat({ color: tint('#33629f'), map: MOT, roughness: 0.3, clearcoat: 0.75, clearcoatRoughness: 0.2, sheen: 0.25, sheenColor: '#a9c8ff', sheenRoughness: 0.5, normalMap: nFine, normalScale: nScale(0.12), cut: 0x4a1f2a }), 'v', [1.55, 1.75, 2.0], 0.55, 2.4),
    veinDeep: withRim(C.mat({ color: tint('#2d5791'), map: MOT, roughness: 0.33, clearcoat: 0.7, clearcoatRoughness: 0.24, sheen: 0.2, sheenColor: '#a9c8ff', normalMap: nFine, normalScale: nScale(0.12), cut: 0x4a1f2a }), 'v2', [1.5, 1.7, 1.95], 0.5, 2.4),
    artery: withRim(C.mat({ color: tint('#bf3b30'), map: MOT, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.24, sheen: 0.3, sheenColor: '#ffb8aa', sheenRoughness: 0.5, normalMap: nFine, normalScale: nScale(0.1), cut: 0x7a1d1a }), 'a', [1.35, 1.3, 1.3], 0.45, 2.6),
    aorta: withRim(C.mat({ color: tint('#cb4b3e'), map: MOT, roughness: 0.34, clearcoat: 0.65, clearcoatRoughness: 0.26, sheen: 0.35, sheenColor: '#ffc4b4', sheenRoughness: 0.5, normalMap: nFine, normalScale: nScale(0.1), cut: 0x7a1d1a }), 'ao', [1.3, 1.28, 1.25], 0.45, 2.6),
    capV: C.mat({ vertexColors: true, color: '#ffffff', roughness: 0.36, clearcoat: 0.6, clearcoatRoughness: 0.3, cut: 0x4a1f2a }),
    capA: C.mat({ vertexColors: true, color: '#ffffff', roughness: 0.36, clearcoat: 0.6, clearcoatRoughness: 0.3, cut: 0x7a1d1a }),
  };
  const col = (h) => new THREE.Color(h);
  const CAPCOL = {
    V: { wall: col('#43679c'), lumen: col('#3c1622'), deep: col('#240a12') },
    A: { wall: col('#dba393'), lumen: col('#741816'), deep: col('#4a0b0b') },
  };


  /* =====================================================================
     UTILIDADES DE CURVA
     ===================================================================== */
  /** Parâmetro de comprimento de arco (0..1) de cada ponto de controle da Catmull-Rom. */
  function arcParams(curve, n) {
    const D = 400, L = curve.getLengths(D);
    const out = [];
    for (let i = 0; i < n; i++) out.push(L[Math.round((i / (n - 1)) * D)] / L[D]);
    return out;
  }
  /** Perfil de raio: array alinhado aos pontos (chaves nos parâmetros reais), número, função ou [[t,v]]. */
  function profileAt(curve, pts, r) {
    if (typeof r === 'function' || typeof r === 'number') return C.profile(r);
    if (Array.isArray(r[0])) return C.profile(r);
    const ts = arcParams(curve, pts.length);
    return C.profile(r.map((v, i) => [ts[i], v]));
  }
  /** t onde a coordenada `ax` (0=x,1=y,2=z) da curva mais se aproxima de c (busca densa). */
  function tAt(curve, ax, c, from = 0, to = 1) {
    let best = from, bd = 1e9;
    for (let i = 0; i <= 500; i++) { const t = from + ((to - from) * i) / 500; const d = Math.abs(curve.getPointAt(t).getComponent(ax) - c); if (d < bd) { bd = d; best = t; } }
    return best;
  }
  const P3 = (v) => [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)];

  /** Orientação do eixo N da secção: no plano coronal, perpendicular ao trajeto (B ≈ ântero-posterior). */
  const upCoronal = (t, p, T) => new V3().crossVectors(T, new V3(0, 0, 1));

  /* =====================================================================
     MANÚBRIO ANALÍTICO (a malha extrudada do esqueleto tem faces grandes, sem vértices internos, e
     não serve para a acomodação por vértices). Mesma construção do esqueleto: contorno da peça
     (incisuras jugular/clavicular/1ª costal), espessura 1,25 cm centrada em LM.sternum.zMid(y) e
     curvatura transversal −0,035·x².
     ===================================================================== */
  const MAN_OUT = [[1.75, 0.5], [2.15, 0.25], [2.5, -0.15], [2.72, -0.55], [2.82, -1.05], [2.98, -1.35], [3.0, -1.9], [2.85, -2.2], [2.45, -3.0], [2.05, -3.85], [1.85, -4.35], [1.85, -4.55]];
  const MAN_TOP = [[0, -0.02], [0.55, 0.06], [1.05, 0.3], [1.45, 0.52], [1.75, 0.5]];
  const interp = (tab, k, v, w) => { // interpolação linear de tab[*][w] em função de tab[*][k] (k monotônico)
    const inc = tab[tab.length - 1][k] > tab[0][k];
    for (let i = 0; i < tab.length - 1; i++) {
      const a = tab[i], b = tab[i + 1];
      if (inc ? v >= a[k] && v <= b[k] : v <= a[k] && v >= b[k]) return a[w] + ((b[w] - a[w]) * (v - a[k])) / (b[k] - a[k] || 1);
    }
    return null;
  };
  /** {back, front} do manúbrio em (x, y) ou null se fora do contorno (folga lateral `pad`). */
  function manubriumAt(x, y, pad = 0.08) {
    const ax = Math.abs(x);
    if (y < -4.55 || y > 0.55) return null;
    if (y <= 0.5) { const hw = interp(MAN_OUT, 1, y, 0); if (hw == null || ax > hw + pad) return null; }
    else if (ax >= 1.75 + pad) return null; // acima de y = 0,5 só existe a parte medial (incisura jugular)
    if (ax < 1.75) { const top = interp(MAN_TOP, 0, ax, 1); if (top != null && y > top + 0.05) return null; }
    const zm = LM.sternum.zMid(y) - 0.035 * ax * ax;
    return { back: zm - 0.625, front: zm + 0.625 };
  }

  /* =====================================================================
     ACOMODAÇÃO DE CONTATO (veias ↔ artérias; vasos calibrosos ↔ ossos)
     Desloca vértices da parede para fora dos obstáculos (achatamento local de contato), suaviza o campo
     de deslocamento na grade anel × setor e reprojeta o resíduo.
     ===================================================================== */
  const ART_SAMPLES = []; // {x,y,z,r} ao longo dos eixos das artérias (para as veias)

  /** Grade densa global (célula 0,3 cm) com vértices + normais das malhas de `layers.bones` (anatômicas). */
  let BG = null;
  const IDENT = new THREE.Matrix4();
  function boneGrid() {
    if (BG) return BG.n ? BG : null;
    BG = { n: 0 };
    if (!layers.bones || !layers.bones.children.length) return null;
    // região de interesse: onde há vasos que se acomodam a ossos (aorta, subclávias, canais venosos, VJI, vertebrais)
    const cs = 0.3, ox = -17.5, oy = -24.5, oz = -10.5, NX = 117, NY = 125, NZ = 54;
    const roi = new THREE.Box3(new V3(ox, oy, oz), new V3(ox + NX * cs, oy + NY * cs, oz + NZ * cs));
    ctx.world.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(ctx.world.matrixWorld).invert();
    const M = new THREE.Matrix4(), NM = new THREE.Matrix3(), v = new V3(), w = new V3(), bb = new THREE.Box3();
    const pos = [], nrm = [], cell = [];
    layers.bones.traverse((o) => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position || !o.geometry.attributes.normal) return;
      if (o.geometry.attributes.position.isInterleavedBufferAttribute || o.geometry.attributes.normal.isInterleavedBufferAttribute) return;
      M.multiplyMatrices(inv, o.matrixWorld);
      const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
      if (!bb.copy(g.boundingBox).applyMatrix4(M).intersectsBox(roi)) return;
      const pa = g.attributes.position.array, na = g.attributes.normal.array, n = pa.length / 3;
      const ident = M.equals(IDENT);
      NM.getNormalMatrix(M);
      for (let i = 0; i < n; i++) {
        let x = pa[i * 3], y = pa[i * 3 + 1], z = pa[i * 3 + 2];
        if (!ident) { v.set(x, y, z).applyMatrix4(M); x = v.x; y = v.y; z = v.z; }
        const ix = Math.floor((x - ox) / cs), iy = Math.floor((y - oy) / cs), iz = Math.floor((z - oz) / cs);
        if (ix < 0 || iy < 0 || iz < 0 || ix >= NX || iy >= NY || iz >= NZ) continue;
        if (ident) w.set(na[i * 3], na[i * 3 + 1], na[i * 3 + 2]); else w.set(na[i * 3], na[i * 3 + 1], na[i * 3 + 2]).applyMatrix3(NM).normalize();
        pos.push(x, y, z); nrm.push(w.x, w.y, w.z); cell.push((iz * NY + iy) * NX + ix);
      }
    });
    const n = cell.length, NC = NX * NY * NZ;
    const start = new Int32Array(NC + 1);
    for (let i = 0; i < n; i++) start[cell[i] + 1]++;
    for (let c = 0; c < NC; c++) start[c + 1] += start[c];
    const fill = start.slice(0, NC), item = new Int32Array(n);
    for (let i = 0; i < n; i++) item[fill[cell[i]]++] = i;
    // ocupação grossa (blocos de 4×4×4 células) para descartar anéis distantes
    const CX = Math.ceil(NX / 4), CY = Math.ceil(NY / 4), CZ = Math.ceil(NZ / 4), occ = new Uint8Array(CX * CY * CZ);
    for (let i = 0; i < n; i++) { const c = cell[i], ix = c % NX, iy = ((c / NX) | 0) % NY, iz = (c / (NX * NY)) | 0; occ[((iz >> 2) * CY + (iy >> 2)) * CX + (ix >> 2)] = 1; }
    BG = { n, pos: Float32Array.from(pos), nrm: Float32Array.from(nrm), start, item, occ, cs, ox, oy, oz, NX, NY, NZ, CX, CY, CZ };
    return BG;
  }
  /** Algum osso a menos de `rad` do ponto (consulta grossa)? */
  function boneNear(G, x, y, z, rad) {
    const b = G.cs * 4;
    const x0 = Math.max(0, Math.floor((x - rad - G.ox) / b)), x1 = Math.min(G.CX - 1, Math.floor((x + rad - G.ox) / b));
    const y0 = Math.max(0, Math.floor((y - rad - G.oy) / b)), y1 = Math.min(G.CY - 1, Math.floor((y + rad - G.oy) / b));
    const z0 = Math.max(0, Math.floor((z - rad - G.oz) / b)), z1 = Math.min(G.CZ - 1, Math.floor((z + rad - G.oz) / b));
    for (let k = z0; k <= z1; k++) for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) if (G.occ[(k * G.CY + j) * G.CX + i]) return true;
    return false;
  }

  /**
   * rLoc(i) = raio local do anel i.  o = { bones, sternum, arteries, margin, maxFrac, iters, soft }
   * Ossos: distância com sinal = média ponderada dos planos tangentes dos vértices ósseos vizinhos (≤ 0,3 cm).
   * Manúbrio: placa analítica (manubriumAt). Artérias: cápsulas dos eixos (amostras + raio).
   */
  function conformGeo(geo, Rr, rings, rLoc, o) {
    const pa = geo.attributes.position, W = Rr + 1, nV = rings * W, P = pa.array;
    const margin = o.margin ?? 0.035;
    const G = o.bones ? boneGrid() : null;
    let AS = [];
    if (o.arteries && ART_SAMPLES.length) {
      geo.computeBoundingBox();
      const ab = geo.boundingBox.clone().expandByScalar(1.6);
      AS = ART_SAMPLES.filter((s) => s.x >= ab.min.x && s.x <= ab.max.x && s.y >= ab.min.y && s.y <= ab.max.y && s.z >= ab.min.z && s.z <= ab.max.z);
    }
    if (!G && !AS.length && !o.sternum) return false;
    const ringBone = new Uint8Array(rings), ringStern = new Uint8Array(rings), ringArt = new Array(rings), RC = new Float32Array(rings * 3);
    let anyRing = false;
    for (let i = 0; i < rings; i++) {
      let cx = 0, cy = 0, cz = 0;
      for (let k = 0; k < Rr; k++) { const v = (i * W + k) * 3; cx += P[v]; cy += P[v + 1]; cz += P[v + 2]; }
      cx /= Rr; cy /= Rr; cz /= Rr; RC[i * 3] = cx; RC[i * 3 + 1] = cy; RC[i * 3 + 2] = cz;
      const rr = rLoc(i) * 1.25 + 0.08;
      if (G && boneNear(G, cx, cy, cz, rr + 0.45)) { ringBone[i] = 1; anyRing = true; }
      if (o.sternum && cy > -5.2 && cy < 1.3 && Math.abs(cx) < 3.3 + rr && cz > -3.6) { ringStern[i] = 1; anyRing = true; }
      if (AS.length) {
        const L = AS.filter((s) => Math.hypot(cx - s.x, cy - s.y, cz - s.z) < rr + s.r + 0.35);
        if (L.length) { ringArt[i] = L; anyRing = true; }
      }
    }
    if (!anyRing) return false;
    const out = [0, 0, 0];
    const solve = (i, x, y, z) => {
      out[0] = out[1] = out[2] = 0;
      let moved = false;
      const L = ringArt[i];
      if (L) {
        let best = 1e9, bs = null;
        for (const s of L) { const d = Math.hypot(x - s.x, y - s.y, z - s.z) - s.r; if (d < best) { best = d; bs = s; } }
        if (bs && best < margin) {
          const dx = x - bs.x, dy = y - bs.y, dz = z - bs.z, l = Math.hypot(dx, dy, dz) || 1;
          // eixo da artéria "dentro" da secção da veia (mais perto do centro do anel do que o vértice): a parede
          // recua para DENTRO (radialmente, em direção ao eixo da veia) até passar atrás da artéria → sulco de contato
          const ux = x - RC[i * 3], uy = y - RC[i * 3 + 1], uz = z - RC[i * 3 + 2], ul = Math.hypot(ux, uy, uz) || 1;
          const ac = Math.hypot(bs.x - RC[i * 3], bs.y - RC[i * 3 + 1], bs.z - RC[i * 3 + 2]);
          if (ac < ul) {
            const nx = ux / ul, ny = uy / ul, nz = uz / ul, R2 = (bs.r + margin) ** 2, du = dx * nx + dy * ny + dz * nz;
            const t = du + Math.sqrt(Math.max(0, du * du + R2 - (dx * dx + dy * dy + dz * dz)));
            out[0] = -nx * t; out[1] = -ny * t; out[2] = -nz * t;
          } else { const push = margin - best; out[0] = (dx / l) * push; out[1] = (dy / l) * push; out[2] = (dz / l) * push; }
          moved = true; x += out[0]; y += out[1]; z += out[2];
        }
      }
      if (ringStern[i]) {
        const m = manubriumAt(x, y);
        if (m && z > m.back - 0.06 && z < m.front) { const push = z - (m.back - 0.06); out[2] -= push; z -= push; moved = true; }
      }
      if (ringBone[i]) {
        // bloco 3×3×3 de células (cobre raio ≥ 0,3 cm: necessário nas malhas ósseas de vértices esparsos)
        const ix = Math.floor((x - G.ox) / G.cs), iy = Math.floor((y - G.oy) / G.cs), iz = Math.floor((z - G.oz) / G.cs);
        let sw = 0, sd = 0, nx = 0, ny = 0, nz = 0, best = 1e9, bi = -1;
        for (let c = -1; c <= 1; c++) { const zz = iz + c; if (zz < 0 || zz >= G.NZ) continue;
          for (let b = -1; b <= 1; b++) { const yy = iy + b; if (yy < 0 || yy >= G.NY) continue;
            for (let a = -1; a <= 1; a++) { const xx = ix + a; if (xx < 0 || xx >= G.NX) continue;
              const cc = (zz * G.NY + yy) * G.NX + xx;
              for (let q = G.start[cc], e = G.start[cc + 1]; q < e; q++) {
                const id = G.item[q] * 3, dx = x - G.pos[id], dy = y - G.pos[id + 1], dz = z - G.pos[id + 2], d = dx * dx + dy * dy + dz * dz;
                if (d > 0.09) continue;
                if (d < best) { best = d; bi = id; }
                const wgt = 1 / (d + 0.003), s = dx * G.nrm[id] + dy * G.nrm[id + 1] + dz * G.nrm[id + 2];
                sw += wgt; sd += wgt * s; nx += wgt * G.nrm[id]; ny += wgt * G.nrm[id + 1]; nz += wgt * G.nrm[id + 2];
              } } } }
        if (sw > 0) {
          sd /= sw; let nl = Math.hypot(nx, ny, nz) / sw;
          if (nl < 0.4) { // normais divergentes (dois ossos): usa o vértice mais próximo
            nx = G.nrm[bi]; ny = G.nrm[bi + 1]; nz = G.nrm[bi + 2]; nl = 1;
            sd = (x - G.pos[bi]) * nx + (y - G.pos[bi + 1]) * ny + (z - G.pos[bi + 2]) * nz;
          } else { const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l; }
          if (sd < margin) { const push = margin - sd; out[0] += nx * push; out[1] += ny * push; out[2] += nz * push; moved = true; }
        }
      }
      return moved;
    };
    const DX = new Float32Array(nV * 3);
    let any = false;
    for (let i = 0; i < rings; i++) {
      if (!ringBone[i] && !ringArt[i] && !ringStern[i]) continue;
      for (let k = 0; k < Rr; k++) { const v = (i * W + k) * 3; if (solve(i, P[v], P[v + 1], P[v + 2])) { DX[v] = out[0]; DX[v + 1] = out[1]; DX[v + 2] = out[2]; any = true; } }
    }
    if (!any) return false;
    if (o.soft) for (let i = 0; i < DX.length; i++) DX[i] *= o.soft;
    // suavização (Jacobi na grade anel × setor; costura periódica)
    const T = new Float32Array(nV * 3), iters = o.iters ?? 4;
    for (let it = 0; it < iters; it++) {
      for (let i = 0; i < rings; i++) for (let k = 0; k < Rr; k++) {
        const v = (i * W + k) * 3, kp = (i * W + ((k + 1) % Rr)) * 3, km = (i * W + ((k - 1 + Rr) % Rr)) * 3;
        const ip = i < rings - 1 ? ((i + 1) * W + k) * 3 : -1, im = i > 0 ? ((i - 1) * W + k) * 3 : -1;
        const nn = 4 + (ip >= 0) + (im >= 0);
        for (let c = 0; c < 3; c++) T[v + c] = (DX[v + c] * 2 + DX[kp + c] + DX[km + c] + (ip >= 0 ? DX[ip + c] : 0) + (im >= 0 ? DX[im + c] : 0)) / nn;
      }
      DX.set(T);
    }
    // aplica, reprojeta o resíduo (contato exato) e limita (fração do raio local)
    const maxFrac = o.maxFrac ?? 0.45, rep = o.soft ? 1.0 : 0.8;
    for (let i = 0; i < rings; i++) {
      const lim = rLoc(i) * maxFrac, act = ringBone[i] || ringArt[i] || ringStern[i];
      for (let k = 0; k < Rr; k++) {
        const v = (i * W + k) * 3;
        let dx = DX[v], dy = DX[v + 1], dz = DX[v + 2];
        if (act && solve(i, P[v] + dx, P[v + 1] + dy, P[v + 2] + dz)) { dx += out[0] * rep; dy += out[1] * rep; dz += out[2] * rep; }
        const l = Math.hypot(dx, dy, dz); if (l > lim) { dx *= lim / l; dy *= lim / l; dz *= lim / l; }
        P[v] += dx; P[v + 1] += dy; P[v + 2] += dz;
      }
      const a3 = i * W * 3, b3 = (i * W + Rr) * 3; P[b3] = P[a3]; P[b3 + 1] = P[a3 + 1]; P[b3 + 2] = P[a3 + 2];
    }
    pa.needsUpdate = true;
    return true;
  }

  /* =====================================================================
     CONFLUÊNCIAS: distância com sinal à superfície de um sistema, filete e recorte (união)
     ===================================================================== */
  /** Distância com sinal (+ fora) à superfície fechada de um sistema já construído (grade de vértices
      + planos tangentes ponderados; longe da parede usa as cápsulas do eixo). */
  function sdfOf(sys) {
    if (sys._sdf) return sys._sdf;
    const g = sys.geo, PA = g.attributes.position.array, NA = g.attributes.normal.array, n = PA.length / 3;
    g.computeBoundingBox();
    const bb = g.boundingBox, cs = 0.3;
    const ox = bb.min.x - cs, oy = bb.min.y - cs, oz = bb.min.z - cs;
    const NX = Math.ceil((bb.max.x - ox) / cs) + 2, NY = Math.ceil((bb.max.y - oy) / cs) + 2, NZ = Math.ceil((bb.max.z - oz) / cs) + 2;
    const cellOf = (x, y, z) => (Math.floor((z - oz) / cs) * NY + Math.floor((y - oy) / cs)) * NX + Math.floor((x - ox) / cs);
    const NC = NX * NY * NZ, start = new Int32Array(NC + 1), cell = new Int32Array(n);
    for (let i = 0; i < n; i++) { cell[i] = cellOf(PA[i * 3], PA[i * 3 + 1], PA[i * 3 + 2]); start[cell[i] + 1]++; }
    for (let c = 0; c < NC; c++) start[c + 1] += start[c];
    const fill = start.slice(0, NC), item = new Int32Array(n);
    for (let i = 0; i < n; i++) item[fill[cell[i]]++] = i;
    // cápsulas do eixo (longe da parede): grade de amostras (célula 1 cm) para consulta local
    const S = sys.samples, SC = 1.0, SG = new Map();
    const skey = (i, j, k) => i + ',' + j + ',' + k;
    for (const q of S) { const k = skey(Math.floor(q.x / SC), Math.floor(q.y / SC), Math.floor(q.z / SC)); let L = SG.get(k); if (!L) SG.set(k, (L = [])); L.push(q); }
    const capsule = (x, y, z) => {
      const ix = Math.floor(x / SC), iy = Math.floor(y / SC), iz = Math.floor(z / SC); let b = 9;
      for (let c = -2; c <= 2; c++) for (let bb2 = -2; bb2 <= 2; bb2++) for (let a = -2; a <= 2; a++) {
        const L = SG.get(skey(ix + a, iy + bb2, iz + c)); if (!L) continue;
        for (let i = 0; i < L.length; i++) { const q = L[i], d = Math.hypot(x - q.x, y - q.y, z - q.z) - q.r; if (d < b) b = d; }
      }
      return b;
    };
    const f = (x, y, z) => {
      if (x < bb.min.x - 1 || x > bb.max.x + 1 || y < bb.min.y - 1 || y > bb.max.y + 1 || z < bb.min.z - 1 || z > bb.max.z + 1) return 9;
      const ix = Math.floor((x - ox) / cs), iy = Math.floor((y - oy) / cs), iz = Math.floor((z - oz) / cs);
      let best = 1e9, R = 1;
      for (; R <= 3; R++) {
        for (let c = -R; c <= R; c++) { const zz = iz + c; if (zz < 0 || zz >= NZ) continue;
          for (let b = -R; b <= R; b++) { const yy = iy + b; if (yy < 0 || yy >= NY) continue;
            for (let a = -R; a <= R; a++) { const xx = ix + a; if (xx < 0 || xx >= NX) continue;
              if (R > 1 && Math.max(Math.abs(a), Math.abs(b), Math.abs(c)) < R) continue; // só a casca nova
              const cc = (zz * NY + yy) * NX + xx;
              for (let q = start[cc], e = start[cc + 1]; q < e; q++) { const j = item[q] * 3, d = (x - PA[j]) ** 2 + (y - PA[j + 1]) ** 2 + (z - PA[j + 2]) ** 2; if (d < best) best = d; }
            } } }
        if (best <= (R * cs) ** 2) break;
      }
      if (best > 1e8) return capsule(x, y, z);
      // planos tangentes ponderados dos vértices quase tão próximos quanto o mais próximo
      const lim = (Math.sqrt(best) + 0.07) ** 2, RR = Math.min(3, R);
      let sw = 0, sd = 0;
      for (let c = -RR; c <= RR; c++) { const zz = iz + c; if (zz < 0 || zz >= NZ) continue;
        for (let b = -RR; b <= RR; b++) { const yy = iy + b; if (yy < 0 || yy >= NY) continue;
          for (let a = -RR; a <= RR; a++) { const xx = ix + a; if (xx < 0 || xx >= NX) continue;
            const cc = (zz * NY + yy) * NX + xx;
            for (let q = start[cc], e = start[cc + 1]; q < e; q++) {
              const j = item[q] * 3, dx = x - PA[j], dy = y - PA[j + 1], dz = z - PA[j + 2], d = dx * dx + dy * dy + dz * dz;
              if (d > lim) continue;
              const wgt = 1 / (d + 0.002); sw += wgt; sd += wgt * (dx * NA[j] + dy * NA[j + 1] + dz * NA[j + 2]);
            } } } }
      return sw > 0 ? sd / sw : capsule(x, y, z);
    };
    sys._sdf = f;
    return f;
  }

  /**
   * Filete côncavo do ramo junto ao tronco: cada vértice do ramo (perto da extremidade unida) é afastado
   * radialmente do eixo em função da sua distância h à superfície do tronco: off = F·(1 − h/F)^2,2 (perfil bem
   * condicionado: a parede abre-se em leque e encontra o tronco num ângulo raso); dentro do tronco o efeito
   * some rapidamente (h < −F/2). O campo de deslocamentos é suavizado na grade anel × setor (sem serrilhado).
   */
  function applyFillet(geo, curve, len, rings, W, ringT, os) {
    const sdf = sdfOf(os.parent), P = geo.attributes.position.array, Rr = W - 1;
    const c = new V3(), T = new V3(), u = new V3();
    const F = os.F, reach = os.reach;
    const off = new Float32Array(rings * W), act = new Uint8Array(rings);
    for (let i = 0; i < rings; i++) {
      const t = ringT(i), s = t * len, q = os.at === 'end' ? len - s : s;
      if (q > os.sx + reach) continue;
      const wq = 1 - C.smooth(os.sx + 0.55 * reach, os.sx + reach, q);
      act[i] = 1;
      curve.getPointAt(t, c); curve.getTangentAt(t, T);
      for (let k = 0; k < Rr; k++) {
        const v = (i * W + k) * 3, x = P[v], y = P[v + 1], z = P[v + 2], h = sdf(x, y, z), uu = h / F;
        let g = uu >= 1 ? 0 : uu <= 0 ? Math.max(0, 1 + 2 * uu) : Math.pow(1 - uu, 2.2);
        if (g > 0 && uu > 0) {
          // só no lado que "olha" para o tronco (ângulo agudo/reto): no lado obtuso, alargar criaria um calombo
          const e = 0.03, gx = sdf(x + e, y, z) - sdf(x - e, y, z), gy = sdf(x, y + e, z) - sdf(x, y - e, z), gz = sdf(x, y, z + e) - sdf(x, y, z - e);
          const gl = Math.hypot(gx, gy, gz) || 1;
          u.set(x - c.x, y - c.y, z - c.z); u.addScaledVector(T, -u.dot(T)); const ul = u.length() || 1;
          const un = (u.x * gx + u.y * gy + u.z * gz) / (ul * gl);
          g *= 1 - C.smooth(-0.15, 0.6, un);
        }
        off[i * W + k] = F * g * wq;
      }
    }
    // suavização (Jacobi; costura periódica em k)
    const tmp = new Float32Array(off.length);
    for (let it = 0; it < 3; it++) {
      for (let i = 0; i < rings; i++) {
        if (!act[i] && !(i > 0 && act[i - 1]) && !(i < rings - 1 && act[i + 1])) continue;
        for (let k = 0; k < Rr; k++) {
          const a = off[i * W + k], kp = off[i * W + ((k + 1) % Rr)], km = off[i * W + ((k - 1 + Rr) % Rr)];
          const ip = i < rings - 1 ? off[(i + 1) * W + k] : a, im = i > 0 ? off[(i - 1) * W + k] : a;
          tmp[i * W + k] = (a * 2 + kp + km + ip + im) / 6;
        }
      }
      for (let i = 0; i < rings; i++) for (let k = 0; k < Rr; k++) off[i * W + k] = tmp[i * W + k];
    }
    for (let i = 0; i < rings; i++) {
      let any = false; for (let k = 0; k < Rr; k++) if (off[i * W + k] > 1e-4) { any = true; break; }
      if (!any) continue;
      const t = ringT(i); curve.getPointAt(t, c); curve.getTangentAt(t, T);
      for (let k = 0; k < W; k++) {
        const o = off[i * W + (k % Rr)]; if (o < 1e-4) continue;
        const v = (i * W + k) * 3;
        u.set(P[v] - c.x, P[v + 1] - c.y, P[v + 2] - c.z); u.addScaledVector(T, -u.dot(T));
        const l = u.length(); if (l < 1e-5) continue;
        u.multiplyScalar(o / l);
        P[v] += u.x; P[v + 1] += u.y; P[v + 2] += u.z;
      }
    }
    geo.attributes.position.needsUpdate = true;
  }

  /** Recorta da malha (indexada) as partes com s < −eps; triângulos cortados exatamente no nível −eps. */
  function trimGeometry(g, s, eps) {
    const idx = g.index.array;
    const P = Array.from(g.attributes.position.array), N = Array.from(g.attributes.normal.array), U = Array.from(g.attributes.uv.array), S = Array.from(s);
    const keep = (i) => S[i] >= -eps;
    const cache = new Map(), out = [];
    const cut = (a, b) => {
      const key = a < b ? a * 4194304 + b : b * 4194304 + a;
      let v = cache.get(key); if (v !== undefined) return v;
      const sa = S[a] + eps, sb = S[b] + eps, t = sa / (sa - sb);
      v = P.length / 3;
      for (let c = 0; c < 3; c++) P.push(P[a * 3 + c] + (P[b * 3 + c] - P[a * 3 + c]) * t);
      let nx = N[a * 3] + (N[b * 3] - N[a * 3]) * t, ny = N[a * 3 + 1] + (N[b * 3 + 1] - N[a * 3 + 1]) * t, nz = N[a * 3 + 2] + (N[b * 3 + 2] - N[a * 3 + 2]) * t;
      const l = Math.hypot(nx, ny, nz) || 1; N.push(nx / l, ny / l, nz / l);
      for (let c = 0; c < 2; c++) U.push(U[a * 2 + c] + (U[b * 2 + c] - U[a * 2 + c]) * t);
      S.push(-eps); cache.set(key, v);
      return v;
    };
    for (let f = 0; f < idx.length; f += 3) {
      const i0 = idx[f], i1 = idx[f + 1], i2 = idx[f + 2];
      const k0 = keep(i0), k1 = keep(i1), k2 = keep(i2), n = k0 + k1 + k2;
      if (n === 3) { out.push(i0, i1, i2); continue; }
      if (n === 0) continue;
      if (n === 1) { // mantém o vértice a (ordem cíclica preservada)
        const [a, b, c] = k0 ? [i0, i1, i2] : k1 ? [i1, i2, i0] : [i2, i0, i1];
        out.push(a, cut(a, b), cut(a, c));
      } else { // descarta o vértice c
        const [a, b, c] = !k0 ? [i1, i2, i0] : !k1 ? [i2, i0, i1] : [i0, i1, i2];
        const bc = cut(b, c), ca = cut(c, a);
        out.push(a, b, bc, a, bc, ca);
      }
    }
    // compacta (descarta vértices órfãos: raycast, verificações e memória)
    const remap = new Int32Array(P.length / 3).fill(-1), P2 = [], N2 = [], U2 = [];
    for (let f = 0; f < out.length; f++) {
      const v = out[f];
      if (remap[v] < 0) { remap[v] = P2.length / 3; P2.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); N2.push(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]); U2.push(U[v * 2], U[v * 2 + 1]); }
      out[f] = remap[v];
    }
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.Float32BufferAttribute(P2, 3));
    ng.setAttribute('normal', new THREE.Float32BufferAttribute(N2, 3));
    ng.setAttribute('uv', new THREE.Float32BufferAttribute(U2, 2));
    ng.setIndex(out);
    ng.computeBoundingSphere();
    return ng;
  }

  /* =====================================================================
     CONSTRUTOR DE SISTEMAS VASCULARES
     o = { kind:'V'|'A', pts, r (array nos pontos | número | fn | [[t,v]]), oval (razão eixo N/eixo B),
           up ('coronal' | vetor | fn), radial, density, noise, start/end: 'round'|'cut',
           ostium: { parent, at:'start'|'end', F (raio do filete), reach (cm), taper } — junção com um tronco,
           valves: [{ s (cm), k, a0 }], pieces: [{ t, info, mat, solid }], bones, sternum, wall, bulges }
     ===================================================================== */
  const AXES = {};
  const SYS = [];
  /** Distância (ao longo do ramo, a partir da extremidade unida) até o eixo sair do tubo-pai. */
  function exitDist(curve, len, parent, fromEnd) {
    const PS = parent.samples;
    for (let s = 0; s <= len; s += 0.03) {
      const p = curve.getPointAt(fromEnd ? 1 - s / len : s / len);
      let inside = false;
      for (let i = 0; i < PS.length; i++) { const q = PS[i]; if (Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) < q.r) { inside = true; break; } }
      if (!inside) return s;
    }
    return len;
  }
  function build(o) {
    const curve = C.curve(o.pts);
    const len = curve.getLength();
    const rBase = profileAt(curve, o.pts, o.r);
    const ovalF = o.oval == null ? () => 1 : C.profile(o.oval);
    const os = o.ostium ? Object.assign({ taper: 0.3, at: o.kind === 'A' ? 'start' : 'end' }, o.ostium) : null;
    if (os) {
      os.sx = exitDist(curve, len, os.parent, os.at === 'end');
      const rEnd = rBase(os.at === 'end' ? 1 : 0);
      os.F = os.F ?? C.clamp((o.kind === 'V' ? 0.42 : 0.34) * rEnd, 0.035, o.kind === 'V' ? 0.34 : 0.24);
      os.reach = os.reach ?? (o.kind === 'V' ? 0.9 : 1.3) * rEnd + 2 * os.F;
    }
    const mod = (t) => {
      const s = t * len; let m = 1;
      if (os && os.sx > 0.02) {
        // dentro do tronco o ramo afina (a extremidade não aflora do outro lado; de qualquer forma é recortada)
        const q = os.at === 'end' ? len - s : s;
        m *= 1 - os.taper * (1 - C.smooth(0, os.sx, q));
      }
      if (o.rootBulge) m *= 1 + o.rootBulge * gauss(s - 0.9, 0.9); // seios aórticos
      return m;
    };
    const rAt = (t) => rBase(t) * mod(t);
    const rx = (t) => rAt(t) * Math.sqrt(ovalF(t)), ry = (t) => rAt(t) / Math.sqrt(ovalF(t));
    // válvulas: dois seios (cúspides opostas, cos 2θ) discretos logo acima da linha de inserção — sem anel
    const valves = o.valves || [];
    const radialFn = valves.length ? (t, a) => {
      let m = 1; const s = t * len;
      for (const v of valves) { const g = gauss(s - v.s, 0.32); if (g < 0.01) continue; const c = Math.cos(2 * (a - (v.a0 || 0))); m *= 1 + v.k * g * (c > 0 ? c * c : 0); }
      return m;
    } : null;
    const capS = (o.start || 'round') === 'round', capE = (o.end || 'round') === 'round';
    const R = o.radial || 24;
    const geo = C.sweepGeometry(o.pts, {
      rx, ry, up: o.up === 'coronal' ? upCoronal : o.up, radial: R, density: o.density || 7, noise: o.noise, vScale: o.vScale || 3,
      caps: capS || capE ? 'round' : 'none', capStart: capS, capEnd: capE, radial_fn: radialFn,
    });
    // layout da grade gerada por C.sweepGeometry (anéis de tampa K=6 por extremidade arredondada)
    const Rr = Math.max(8, Math.round(R * (Q < 1 ? Math.max(0.6, Q) : 1)));
    const W = Rr + 1;
    const rings = Math.floor(geo.attributes.position.count / W);
    const K = 6, ks = capS ? K : 0, ke = capE ? K : 0;
    const N = rings - ks - ke - 1;
    const poleS = capS ? rings * W : -1, poleE = capE ? rings * W + (capS ? 1 : 0) : -1;
    const ringT = (i) => C.clamp((i - ks) / N, 0, 1);
    // abaulamentos localizados (confluências): empurra a parede para fora na direção `dir`
    if (o.bulges) {
      const P = geo.attributes.position.array, c = new V3(), u = new V3();
      for (const bu of o.bulges) {
        const d = new V3().fromArray(bu.dir).normalize(), s0 = bu.t * len;
        for (let i = 0; i < rings; i++) {
          const t = ringT(i), g = gauss(t * len - s0, bu.w); if (g < 0.01) continue;
          curve.getPointAt(t, c);
          for (let k = 0; k < W; k++) {
            const v = (i * W + k) * 3; u.set(P[v] - c.x, P[v + 1] - c.y, P[v + 2] - c.z);
            const l = u.length(); if (l < 1e-6) continue; u.multiplyScalar(1 / l);
            const f = Math.pow(Math.max(0, u.dot(d)), 1.5) * g * bu.k * l;
            P[v] += u.x * f; P[v + 1] += u.y * f; P[v + 2] += u.z * f;
          }
        }
      }
    }
    if (os) applyFillet(geo, curve, len, rings, W, ringT, os);
    if (o.bones || o.sternum || o.kind === 'V') {
      try { conformGeo(geo, Rr, rings, (i) => Math.min(rx(ringT(i)), ry(ringT(i))), { bones: !!o.bones, sternum: !!o.sternum, arteries: o.kind === 'V', margin: o.margin, maxFrac: o.maxFrac, iters: o.iters ?? (o.kind === 'V' ? 10 : 4), soft: o.kind === 'V' ? 1.7 : 0 }); }
      catch (e) { /* acomodação é opcional */ }
    }
    geo.computeVertexNormals();
    C.fixSeam(geo, rings, Rr);

    // fatiamento por anéis → uma malha por estrutura (id)
    const out = [];
    let a = 0;
    const tEx = os ? os.sx / len : 0; // parte do eixo dentro do tronco (fora do sólido de verificação)
    o.pieces.forEach((pc, pi) => {
      const last = pi === o.pieces.length - 1;
      const b = last ? rings - 1 : ks + Math.round(pc.t * N);
      const g = sliceRings(geo, W, a, b, a === 0 ? poleS : -1, last ? poleE : -1);
      const mesh = C.mesh(g, pc.mat || o.mat, o.layer || (o.kind === 'V' ? LV : LA), pc.info);
      const t0 = ringT(a), t1 = last ? 1 : pc.t;
      const n = Math.max(8, Math.ceil(((t1 - t0) * len) / 0.5));
      const axis = []; for (let j = 0; j <= n; j++) axis.push(P3(curve.getPointAt(Math.min(1, t0 + ((t1 - t0) * j) / n))));
      AXES[pc.info.id] = (AXES[pc.info.id] || []).concat(axis);
      if (pc.solid !== false) {
        let s0 = t0, s1 = t1;
        if (os && os.at === 'start') s0 = Math.max(s0, Math.min(tEx, s1 - 0.02));
        if (os && os.at === 'end') s1 = Math.min(s1, Math.max(1 - tEx, s0 + 0.02));
        const sax = []; for (let j = 0; j <= n; j++) sax.push(P3(curve.getPointAt(Math.min(1, s0 + ((s1 - s0) * j) / n))));
        C.solid(pc.info.id, sax, (u) => rBase(s0 + (s1 - s0) * u));
      }
      out.push({ mesh, t0, t1, info: pc.info });
      a = b;
    });
    // recortes didáticos (parede + luz)
    const wall = o.wall ?? (o.kind === 'V' ? 0.11 : 0.2);
    if (o.start === 'cut') cutCap(geo, W, 0, curve.getTangentAt(0).negate(), o.kind, wall, out[0].info, out[0].mesh.parent);
    if (o.end === 'cut') cutCap(geo, W, rings - 1, curve.getTangentAt(1), o.kind, wall, out[out.length - 1].info, out[out.length - 1].mesh.parent);
    // amostras do eixo (pai de ramos; obstáculos arteriais para as veias)
    const samples = [];
    const ns = Math.ceil(len / 0.1);
    for (let j = 0; j <= ns; j++) { const t = j / ns, p = curve.getPointAt(t); samples.push({ x: p.x, y: p.y, z: p.z, r: Math.max(rx(t), ry(t)), rm: rAt(t) }); }
    if (o.kind === 'A') for (let j = 0; j < samples.length; j += 1) ART_SAMPLES.push(samples[j]);
    const sys = {
      curve, len, rAt, rx, ry, geo, pieces: out, meshes: out.map((p) => p.mesh), parent: os ? os.parent : null, kids: [], extra: o.partners || [],
      samples: samples.map((q) => ({ x: q.x, y: q.y, z: q.z, r: q.rm })),
    };
    if (os) os.parent.kids.push(sys);
    SYS.push(sys);
    return sys;
  }

  /** União final das confluências: recorta de cada malha o que fica dentro dos sistemas unidos a ela
      (tronco, ramos e ramos-irmãos do mesmo tronco). Recorte assimétrico: o ramo é cortado rente ao tronco
      (folga 0,02 cm) e o tronco um pouco mais para dentro do ramo (0,07 cm) — a borda do furo do tronco fica sob o
      filete do ramo, sem frestas na costura. */
  function trimAll() {
    const box = (sys) => { if (!sys.geo.boundingBox) sys.geo.computeBoundingBox(); return sys.geo.boundingBox; };
    for (const S of SYS) {
      const partners = new Map(); // sistema → folga
      for (const e of S.extra) partners.set(e, 0.03);
      SYS.forEach((T) => { if (T.extra.includes(S)) partners.set(T, 0.03); });
      if (S.parent) { for (const sib of S.parent.kids) if (sib !== S) partners.set(sib, 0.03); partners.set(S.parent, 0.02); }
      for (const k of S.kids) partners.set(k, 0.07);
      partners.delete(S);
      if (!partners.size) continue;
      const PL = [...partners].map(([p, eps]) => ({ f: sdfOf(p), eps, bb: box(p).clone().expandByScalar(0.08) }));
      for (const m of S.meshes) {
        const g = m.geometry, PA = g.attributes.position.array, nv = PA.length / 3;
        if (!g.boundingBox) g.computeBoundingBox();
        const s = new Float32Array(nv).fill(9);
        let any = false;
        for (const p of PL) {
          if (!p.bb.intersectsBox(g.boundingBox)) continue;
          for (let i = 0; i < nv; i++) {
            const x = PA[i * 3], y = PA[i * 3 + 1], z = PA[i * 3 + 2];
            if (x < p.bb.min.x || x > p.bb.max.x || y < p.bb.min.y || y > p.bb.max.y || z < p.bb.min.z || z > p.bb.max.z) continue;
            const d = p.f(x, y, z) + p.eps;
            if (d < s[i]) { s[i] = d; if (d < 0) any = true; }
          }
        }
        if (any) { const ng = trimGeometry(g, s, 0); g.dispose(); m.geometry = ng; }
      }
    }
  }


  /** Nova geometria com os anéis [a..b] (inclusive) e polos/leques opcionais. */
  function sliceRings(src, W, a, b, poleS, poleE) {
    const sp = src.attributes.position.array, sn = src.attributes.normal.array, su = src.attributes.uv.array;
    const pos = [], nrm = [], uv = [], idx = [];
    const R = W - 1;
    for (let i = a; i <= b; i++) for (let k = 0; k < W; k++) {
      const v = i * W + k;
      pos.push(sp[v * 3], sp[v * 3 + 1], sp[v * 3 + 2]); nrm.push(sn[v * 3], sn[v * 3 + 1], sn[v * 3 + 2]); uv.push(su[v * 2], su[v * 2 + 1]);
    }
    const rows = b - a + 1;
    for (let i = 0; i < rows - 1; i++) for (let k = 0; k < R; k++) { const q = i * W + k; idx.push(q, q + 1, q + W, q + 1, q + W + 1, q + W); }
    const addPole = (pv, ring, reverse) => {
      const ci = pos.length / 3;
      pos.push(sp[pv * 3], sp[pv * 3 + 1], sp[pv * 3 + 2]); nrm.push(sn[pv * 3], sn[pv * 3 + 1], sn[pv * 3 + 2]); uv.push(su[pv * 2], su[pv * 2 + 1]);
      for (let k = 0; k < R; k++) { const q = ring * W + k; if (reverse) idx.push(ci, q + 1, q); else idx.push(ci, q, q + 1); }
    };
    if (poleS >= 0) addPole(poleS, 0, true);
    if (poleE >= 0) addPole(poleE, rows - 1, false);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
  }

  /** Face de recorte: anel externo (parede) → anel interno → luz (sangue), normal = `outward`. */
  function cutCap(src, W, ring, outward, kind, wall, info, parent) {
    const sp = src.attributes.position.array, R = W - 1, base = ring * W;
    const Pk = [], c = new V3();
    for (let k = 0; k < R; k++) { const v = new V3(sp[(base + k) * 3], sp[(base + k) * 3 + 1], sp[(base + k) * 3 + 2]); Pk.push(v); c.add(v); }
    c.multiplyScalar(1 / R);
    const cl = CAPCOL[kind];
    const pos = [], cols = [], nrm = [], idx = [];
    const add = (v, cc) => { pos.push(v.x, v.y, v.z); cols.push(cc.r, cc.g, cc.b); nrm.push(outward.x, outward.y, outward.z); return pos.length / 3 - 1; };
    const o0 = [], o1 = [], o2 = [];
    for (let k = 0; k < R; k++) {
      const d = Pk[k].clone().sub(c);
      o0.push(add(Pk[k], cl.wall));
      o1.push(add(c.clone().addScaledVector(d, 1 - wall), cl.wall));
      o2.push(add(c.clone().addScaledVector(d, 1 - wall - 0.06), cl.lumen));
    }
    const ci = add(c, cl.deep);
    for (let k = 0; k < R; k++) {
      const k1 = (k + 1) % R;
      idx.push(o0[k], o0[k1], o1[k], o0[k1], o1[k1], o1[k]);
      idx.push(o1[k], o1[k1], o2[k], o1[k1], o2[k1], o2[k]);
      idx.push(o2[k], o2[k1], ci);
    }
    const A = new V3().fromArray(pos, o0[0] * 3), B = new V3().fromArray(pos, o0[1] * 3), Cc = new V3().fromArray(pos, o1[0] * 3);
    if (B.sub(A).cross(Cc.sub(A)).dot(outward) < 0) for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    for (let i = 0; i < pos.length; i += 3) { pos[i] += outward.x * 0.004; pos[i + 1] += outward.y * 0.004; pos[i + 2] += outward.z * 0.004; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.setIndex(idx);
    return C.mesh(g, kind === 'V' ? MAT.capV : MAT.capA, parent, info);
  }

  /* =====================================================================
     DESCRIÇÕES (pt-BR) — relevância para a punção infraclavicular
     ===================================================================== */
  const D = {
    scv: 'Continua a veia axilar a partir da borda lateral da 1ª costela; cruza a costela ANTERIOR ao escaleno anterior, posteroinferior ao terço medial da clavícula e ao músculo subclávio. É o alvo da punção infraclavicular.',
    axv: 'Continuação das veias braquiais; torna-se subclávia na borda lateral da 1ª costela. Recebe a cefálica logo abaixo da clavícula; é o alvo da abordagem axilar guiada por ultrassom.',
    ijv: 'Desce na bainha carotídea, LATERAL à carótida comum, com o vago posterior entre ambas; o bulbo inferior (com válvula) fica logo acima da junção com a subclávia, atrás da articulação esternoclavicular. Destino possível de mau posicionamento do fio-guia.',
    ejv: 'Superficial ao esternocleidomastóideo; perfura a fáscia cervical acima da clavícula e drena na veia subclávia, lateral ao escaleno anterior.',
    ceph: 'Corre no sulco deltopeitoral; no trígono deltopeitoral passa medial e anterior à ponta do processo coracoide, perfura a fáscia clavipeitoral acima do peitoral menor e drena na veia axilar logo abaixo da clavícula.',
    bcvR: 'Curta e quase vertical, formada atrás da articulação esternoclavicular direita pela união da jugular interna com a subclávia — trajeto natural do fio-guia em direção à veia cava superior.',
    bcvL: 'Longa e oblíqua, cruza da esquerda para a direita atrás do manúbrio, ANTERIOR aos ramos do arco aórtico (tronco braquiocefálico, carótida comum e subclávia esquerdas).',
    svc: 'Formada atrás da 1ª cartilagem costal direita pela união das braquiocefálicas; recebe o arco da ázigo pela face posterior e desemboca no átrio direito (junção cavoatrial ≈ 3ª cartilagem) — referência da ponta do cateter.',
    azy: 'Sobe à direita dos corpos vertebrais, arqueia sobre a raiz do pulmão direito (brônquio principal) no nível de T4 e desemboca na face posterior da veia cava superior.',
    itv: 'Acompanha medialmente a artéria torácica interna atrás das cartilagens costais e drena na veia braquiocefálica do mesmo lado.',
    aorta: 'Parte ascendente, arco (ramos: tronco braquiocefálico, carótida comum e subclávia esquerdas) e parte torácica descendente, à esquerda dos corpos vertebrais.',
    bct: 'Primeiro ramo do arco; sobe à direita da traqueia, posterior à veia braquiocefálica esquerda, e bifurca atrás da articulação esternoclavicular direita em subclávia e carótida comum direitas.',
    cca: 'Na bainha carotídea, MEDIAL à jugular interna; a punção excessivamente medial e cranial na base do pescoço pode atingi-la.',
    scaR: 'Do tronco braquiocefálico até a borda lateral da 1ª costela. 1ª parte medial, 2ª POSTERIOR ao escaleno anterior (ponto mais alto, sobre a cúpula pleural) e 3ª lateral a ele. Fica acima e atrás da veia: trajeto profundo/cranial demais arrisca punção arterial.',
    scaL: 'Ramo direto do arco aórtico; sobe junto ao mediastino superior esquerdo e, como à direita, passa POSTERIOR ao escaleno anterior sobre a 1ª costela e a cúpula pleural.',
    axa: 'Começa na borda lateral da 1ª costela, profunda ao peitoral menor; envolvida pelos fascículos do plexo braquial. A veia axilar fica anteroinferior e medial a ela.',
    vert: 'Primeiro ramo da 1ª parte da subclávia; sobe entre o longo do pescoço e o escaleno anterior, passa anterior ao processo transverso de C7 e penetra o forame transversário de C6.',
    ita: 'Da face inferior da 1ª parte da subclávia; desce atrás da junção venosa (na face posterolateral da VBC, à frente da cúpula pleural), passa atrás da 1ª costela e das cartilagens costais, ~1–1,5 cm lateral à borda do esterno.',
    tct: 'Tronco curto da 1ª parte da subclávia, na borda medial do escaleno anterior; origina as artérias tireóidea inferior, supraescapular e cervical transversa.',
    ita3: 'Sobe na borda medial do escaleno anterior, faz alça medial atrás da bainha carotídea (anterior à artéria vertebral) e alcança o polo inferior da tireoide, perto do nervo laríngeo recorrente.',
    ssa: 'Cruza ANTERIORMENTE o escaleno anterior e o nervo frênico, depois a 3ª parte da subclávia e o plexo, atrás e paralela à clavícula, até a incisura da escápula.',
    tca: 'Cruza anteriormente o escaleno anterior e o nervo frênico ~2 cm acima da clavícula, passa sobre o plexo braquial e segue para o trapézio e o levantador da escápula.',
    ta: 'Ramo da 2ª parte da axilar na borda superior do peitoral menor; perfura a fáscia clavipeitoral junto à cefálica e se divide em ramos peitoral, deltóideo, acromial e clavicular — referência do trígono clavipeitoral, lateral ao trajeto da agulha.',
    mph: 'Ramo terminal lateral da torácica interna (6º espaço intercostal), ao longo da margem costal.',
    sep: 'Ramo terminal medial da torácica interna; passa atrás da 7ª cartilagem para a bainha do reto.',
  };


  /* =====================================================================
     ARTÉRIAS (construídas primeiro: as veias acomodam-se a elas)
     ===================================================================== */
  // ---- Aorta: parte ascendente → arco → parte torácica descendente (recorte no hiato aórtico, T12).
  //      Último ponto 0,28 cm anterior ao de LM (o de LM toca a face anterior do corpo de T12; ver `requests`).
  const aortaPts = VV.aorta.pts.slice(0, -1).concat([[-0.85, -22.3, -6.02]]);
  const aorta = build({
    kind: 'A', pts: aortaPts, r: VV.aorta.r.slice(0, -1).concat([0.88]), radial: 44, density: 6, start: 'round', end: 'cut', bones: true,
    rootBulge: 0.06, mat: MAT.aorta,
    pieces: [{ t: 1, info: GA({ id: 'aorta', name: 'Aorta (parte ascendente, arco e parte torácica)', desc: D.aorta }) }],
  });
  // ---- Tronco braquiocefálico → carótida comum D (eixo contínuo: LM.bct + LM.ccaR); recorte em y = 11.
  //      A bifurcação é um Y: a subclávia D nasce como ramo (filete côncavo + recorte) na face lateral do fim do TBC.
  const bctPts = VV.bct.pts.concat(VV.ccaR.pts.slice(1));
  const bctC = C.curve(bctPts);
  const bctCca = build({
    kind: 'A', pts: bctPts, r: VV.bct.r.concat(VV.ccaR.r.slice(1)), radial: 28, density: 8, start: 'round', end: 'cut',
    ostium: { parent: aorta }, mat: MAT.artery,
    pieces: [
      { t: arcParams(bctC, bctPts.length)[VV.bct.pts.length - 1], info: GA({ id: 'bct', name: 'Tronco braquiocefálico', desc: D.bct }) },
      { t: 1, info: GA({ id: 'cca-R', name: 'Artéria carótida comum direita', desc: D.cca }) },
    ],
  });
  // ---- Carótida comum E (do arco)
  build({
    kind: 'A', pts: VV.ccaL.pts, r: VV.ccaL.r, radial: 26, density: 7, start: 'round', end: 'cut',
    ostium: { parent: aorta }, mat: MAT.artery,
    pieces: [{ t: 1, info: GA({ id: 'cca-L', name: 'Artéria carótida comum esquerda', desc: D.cca }) }],
  });
  // ---- Subclávia → axilar (D): um único eixo (LM.scaR + LM.axillaryA). O limite subclávia/axilar é a
  //      borda lateral da 1ª costela, que no eixo da artéria (geometria de LM.ribs[0]) fica em x ≈ 6,9.
  const RIB1_BORDER_X = 6.9;
  const scaRpts = VV.scaR.pts.concat(VV.axillaryA.pts.slice(1));
  const scaRc = C.curve(scaRpts);
  const scaR = build({
    kind: 'A', pts: scaRpts, r: VV.scaR.r.concat(VV.axillaryA.r.slice(1)), radial: 26, density: 8, start: 'round', end: 'cut', bones: true,
    ostium: { parent: bctCca }, mat: MAT.artery,
    pieces: [
      { t: tAt(scaRc, 0, RIB1_BORDER_X), info: GA({ id: 'sca-R', name: 'Artéria subclávia direita', desc: D.scaR }) },
      { t: 1, info: GA({ id: 'axillary-a-R', name: 'Artéria axilar direita', desc: D.axa }) },
    ],
  });
  // ---- Subclávia → axilar (E): do arco; porção lateral espelha a direita
  const scaLpts = VV.scaL.pts.concat(mirP(VV.axillaryA.pts).slice(1));
  const scaLc = C.curve(scaLpts);
  const scaL = build({
    kind: 'A', pts: scaLpts, r: VV.scaL.r.concat(VV.axillaryA.r.slice(1)), radial: 26, density: 8, start: 'round', end: 'cut', bones: true,
    ostium: { parent: aorta }, mat: MAT.artery,
    pieces: [
      { t: tAt(scaLc, 0, -RIB1_BORDER_X, 0.3, 1), info: GA({ id: 'sca-L', name: 'Artéria subclávia esquerda', desc: D.scaL }) },
      { t: 1, info: GA({ id: 'axillary-a-L', name: 'Artéria axilar esquerda', desc: D.axa }) },
    ],
  });

  // ---- Artérias vertebrais: V1 (LM.vertebralAR até y = 6) → forame transversário de C6 → V2 pelos forames C5–C4.
  /** Centro do forame transversário (lado D) de uma vértebra cervical, pela MESMA construção de LM.spine usada
      pelo esqueleto (barra anterior corpo→tubérculo anterior, pedículo, barra posterior pedículo→tubérculo
      posterior→tubérculo anterior): maior círculo inscrito no polígono do anel, no plano da vértebra. */
  function foramenR(name) {
    const s = LM.spine.find((q) => q.n === name); if (!s) return null;
    const cz = s.zf - s.d / 2, hw = s.w / 2, hd = s.d / 2, back = cz - hd * 0.55 + 0.1;
    const b0 = [hw * 0.8, s.y, cz], at = [hw + 0.55, s.y - 0.05, cz + hd * 0.2], pt = [hw + 0.85, s.y - 0.1, cz - hd - 0.45];
    const p0 = [hw * 0.62, s.y + 0.1, back + 0.1], p1 = [hw * 0.72, s.y + 0.12, back - 0.8];
    const segs = [], poly = [[b0[0], b0[2]], [at[0], at[2]]];
    const seg = (a, b, ra, rb) => segs.push([a[0], a[2], b[0], b[2], ra, rb]);
    seg(b0, at, 0.3, 0.26); seg(p0, p1, 0.3, 0.3);
    const pc = C.curve([p1, pt, at]); let prev = p1, rp = 0.28; const back2 = [];
    for (let i = 1; i <= 16; i++) { const u = i / 16, q = pc.getPointAt(u).toArray(), r = u < 0.5 ? C.lerp(0.28, 0.3, u * 2) : C.lerp(0.3, 0.26, u * 2 - 1); seg(prev, q, rp, r); back2.push([q[0], q[2]]); prev = q; rp = r; }
    for (let i = back2.length - 2; i >= 0; i--) poly.push(back2[i]);
    poly.push([p1[0], p1[2]], [p0[0], p0[2]]);
    const inside = (x, z) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; };
    const bodyD = (x, z) => { const a = hw * 0.91, zc = cz + 0.1, b = (z < zc ? hd * 0.55 : hd) * 0.91; return (Math.hypot(x / a, (z - zc) / b) - 1) * Math.min(a, b); };
    let best = -1, bx = (b0[0] + pt[0]) / 2, bz = (b0[2] + pt[2]) / 2;
    for (let x = hw * 0.6; x <= hw + 1.1; x += 0.02) for (let z = cz - hd - 0.8; z <= cz + hd * 0.4; z += 0.02) {
      if (!inside(x, z)) continue;
      let d = bodyD(x, z);
      for (const g of segs) { const ex = g[2] - g[0], ez = g[3] - g[1], l2 = ex * ex + ez * ez || 1; const t = C.clamp(((x - g[0]) * ex + (z - g[1]) * ez) / l2, 0, 1); const dd = Math.hypot(x - g[0] - ex * t, z - g[1] - ez * t) - (g[4] + (g[5] - g[4]) * t); if (dd < d) d = dd; if (d <= best) break; }
      if (d > best) { best = d; bx = x; bz = z; }
    }
    return { p: [+bx.toFixed(3), s.y, +bz.toFixed(3)], r: best };
  }
  const F6 = foramenR('C6'), F5 = foramenR('C5'), F4 = foramenR('C4');
  const midP = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const LV3 = VV.vertebralAR.pts[3];
  const vertR = VV.vertebralAR.pts.slice(0, 4).concat([
    [C.lerp(LV3[0], F6.p[0], 0.62), F6.p[1] - 0.6, C.lerp(LV3[2], F6.p[2], 0.75)], // sob o processo transverso de C6, já atrás do tubérculo anterior
    F6.p, midP(F6.p, F5.p), F5.p, midP(F5.p, F4.p), F4.p, [F4.p[0] - 0.02, 11.0, F4.p[2] + 0.12]]);
  const vertRr = [0.22, 0.21, 0.205, 0.2, 0.198, 0.195, 0.193, 0.19, 0.19, 0.19, 0.188];
  build({
    kind: 'A', pts: vertR, r: vertRr, radial: 16, density: 8, start: 'round', end: 'cut', bones: true, ostium: { parent: scaR }, mat: MAT.artery,
    pieces: [{ t: 1, info: GA({ id: 'vertebral-a-R', name: 'Artéria vertebral direita', desc: D.vert }) }],
  });
  build({ // E: origem na face posterossuperior da 1ª parte da subclávia E; restante espelhado (esqueleto simétrico)
    kind: 'A', pts: [[-2.85, 1.55, -3.75]].concat(mirP(vertR).slice(1)), r: vertRr, radial: 16, density: 8, start: 'round', end: 'cut', bones: true, ostium: { parent: scaL }, mat: MAT.artery,
    pieces: [{ t: 1, info: GA({ id: 'vertebral-a-L', name: 'Artéria vertebral esquerda', desc: D.vert }) }],
  });

  // ---- Torácicas internas + ramos terminais (6º espaço intercostal): epigástrica superior (continuação) e musculofrênica.
  //      Trajeto superior (pontos intermediários; LM.itaR mantido de y = −2,9 para baixo): desce atrás do ângulo venoso,
  //      na face posterolateral da VBC D (a veia cede: sulco de contato) e à frente da cúpula/lobo superior, passa atrás da
  //      1ª costela e da 1ª cartilagem costal e segue ~1–1,5 cm lateral à borda do esterno.
  const itaPts = [[3.3, 1.05, -3.3], [3.52, 0.45, -2.82], [3.68, -0.2, -2.42], [3.66, -0.85, -1.9], [3.5, -1.55, -1.38], [3.35, -2.2, -1.12], [3.25, -2.9, -0.72]]
    .concat(VV.itaR.pts.slice(3), [[3.0, -15.2, 2.72], [2.86, -17.8, 3.3]]);
  const itaRr = [0.17, 0.168, 0.166, 0.164, 0.162, 0.16, 0.157, 0.155, 0.15, 0.145, 0.12, 0.11];
  const ITA_BIF = 9; // índice de [3.1, −13, 2] (LM): bifurcação em epigástrica superior e musculofrênica
  const mphPts = [[3.1, -12.85, 1.96], [3.65, -13.6, 2.18], [4.55, -14.55, 2.36], [5.75, -15.55, 2.4], [6.6, -16.25, 2.33]];
  const itaSys = {};
  function itaSystem(side) {
    const L = side === 'L', S = L ? mir : (p) => p;
    let pts = itaPts.map(S);
    // E: a 1ª parte da subclávia E é diferente (sobe do arco) → origem própria (face inferior), depois o trajeto espelhado
    // (sem VBC lateral à esquerda: o trajeto pode ser um pouco mais medial e anterior, à frente do lobo superior E)
    if (L) pts = [[-3.2, 1.45, -3.5], [-3.45, 0.62, -2.95], [-3.55, -0.2, -2.35], [-3.44, -0.85, -1.58], [-3.4, -1.55, -1.29], [-3.33, -2.2, -1.05]].concat(pts.slice(6));
    const bif = arcParams(C.curve(pts), pts.length)[ITA_BIF];
    const sfx = '-' + side, lado = L ? 'esquerda' : 'direita';
    const sys = build({
      kind: 'A', pts, r: itaRr, radial: 14, density: 6, start: 'round', end: 'cut', ostium: { parent: L ? scaL : scaR }, mat: MAT.artery,
      pieces: [
        { t: bif, info: GA({ id: 'ita' + sfx, name: 'Artéria torácica interna ' + lado, desc: D.ita }) },
        { t: 1, info: GA({ id: 'superior-epigastric-a' + sfx, name: 'Artéria epigástrica superior ' + lado, desc: D.sep }) },
      ],
    });
    build({
      kind: 'A', pts: mphPts.map(S), r: [0.13, 0.12, 0.115, 0.105, 0.1], radial: 12, density: 6, start: 'round', end: 'cut', ostium: { parent: sys }, mat: MAT.artery,
      pieces: [{ t: 1, info: GA({ id: 'musculophrenic-a' + sfx, name: 'Artéria musculofrênica ' + lado, desc: D.mph }) }],
    });
    itaSys[side] = sys;
  }
  itaSystem('R'); itaSystem('L');

  // ---- Troncos tireocervicais. O tronco continua como artéria tireóidea inferior (ramo terminal principal); a
  //      supraescapular e a cervical transversa nascem em pontos escalonados do tronco, contornam a borda medial do
  //      escaleno anterior e cruzam ANTERIORMENTE o músculo e o frênico, atrás da VJI (que cede).
  //      A tireóidea inferior sobe na borda medial do escaleno e arqueia ATRÁS da bainha carotídea (≈ C7).
  const TCT_R = {
    main: [[3.86, 1.75, -3.15], [3.9, 2.2, -2.92], [3.93, 2.5, -2.66], [3.92, 3.05, -2.78], [3.72, 3.8, -2.98], [3.45, 4.5, -3.12], [3.15, 5.1, -3.3], [2.7, 5.45, -3.4], [2.15, 5.3, -3.35], [1.7, 4.9, -3.1], [1.42, 4.45, -2.85]],
    mainR: [0.23, 0.22, 0.205, 0.165, 0.158, 0.152, 0.146, 0.14, 0.13, 0.12, 0.105],
    split: 2, // fim do tronco (após as origens dos ramos) → tireóidea inferior
    ssa: [[3.9, 2.22, -2.9], [4.0, 2.3, -2.45], [4.09, 2.37, -1.92], [4.33, 2.42, -1.45], [4.95, 2.36, -1.3], [5.6, 2.3, -1.25], [6.2, 2.25, -1.25], [7.6, 1.95, -1.35], [9.0, 1.65, -2.0], [10.2, 1.35, -3.6], [11.1, 1.05, -5.8], [11.6, 0.9, -7.8], [11.8, 0.85, -8.75]],
    // TCA: depois do escaleno anterior aprofunda-se sob o ventre inferior do omo-hióideo, rumo ao levantador da escápula/trapézio
    tca: [[3.93, 2.5, -2.68], [4.0, 2.68, -2.32], [4.03, 2.82, -1.93], [4.34, 2.97, -1.42], [5.0, 3.4, -1.38], [5.8, 3.85, -1.75], [6.45, 3.7, -3.05], [7.4, 3.5, -4.0], [8.5, 3.15, -5.25], [9.3, 2.85, -6.65]],
  };
  // E: o ducto torácico arqueia ANTERIOR ao tronco e aos ramos → tronco e tireóidea inferior mais posteriores; os ramos
  //    passam atrás do ducto (lateralmente) e só então vêm à frente do escaleno anterior.
  const TCT_L = {
    main: [[-3.88, 1.82, -3.3], [-3.94, 2.22, -3.42], [-3.98, 2.55, -3.52], [-3.98, 3.1, -3.7], [-3.78, 3.95, -3.88], [-3.45, 4.6, -3.7], [-3.12, 5.1, -3.42], [-2.68, 5.45, -3.42], [-2.15, 5.3, -3.35], [-1.72, 4.9, -3.12], [-1.45, 4.45, -2.88]],
    mainR: TCT_R.mainR, split: 2,
    // os ramos saem ACIMA da subclávia E (que aqui sobe atrás do escaleno) e vêm à frente entre o ducto (medial) e a borda do escaleno
    ssa: [[-3.95, 2.45, -3.46], [-4.02, 2.52, -2.95], [-4.04, 2.5, -2.4], [-4.07, 2.47, -1.95], [-4.34, 2.45, -1.45], [-4.95, 2.38, -1.3], [-5.6, 2.3, -1.25]].concat(mirP(TCT_R.ssa).slice(6)),
    tca: [[-3.96, 2.62, -3.5], [-4.06, 2.72, -3.05], [-4.03, 2.86, -2.42], [-4.03, 2.98, -1.93], [-4.34, 3.02, -1.42], [-5.0, 3.4, -1.38]].concat(mirP(TCT_R.tca).slice(5)),
  };
  function tctSystem(T, side, parent) {
    const sfx = '-' + side, ad = side === 'R' ? 'direito' : 'esquerdo', af = side === 'R' ? 'direita' : 'esquerda';
    const main = build({
      kind: 'A', pts: T.main, r: T.mainR, radial: 16, density: 10, start: 'round', end: 'round', ostium: { parent }, mat: MAT.artery,
      pieces: [
        { t: arcParams(C.curve(T.main), T.main.length)[T.split], info: GA({ id: 'thyrocervical' + sfx, name: 'Tronco tireocervical ' + ad, desc: D.tct }) },
        { t: 1, info: GA({ id: 'inferior-thyroid-a' + sfx, name: 'Artéria tireóidea inferior ' + af, desc: D.ita3 }) },
      ],
    });
    build({
      kind: 'A', pts: T.ssa, r: T.ssa.map((p, i) => 0.14 - (0.04 * i) / (T.ssa.length - 1)), radial: 12, density: 8, start: 'round', end: 'round', ostium: { parent: main, F: 0.035, reach: 0.12 }, mat: MAT.artery,
      pieces: [{ t: 1, info: GA({ id: 'suprascapular-a' + sfx, name: 'Artéria supraescapular ' + af, desc: D.ssa }) }],
    });
    build({
      kind: 'A', pts: T.tca, r: T.tca.map((p, i) => 0.14 - (0.04 * i) / (T.tca.length - 1)), radial: 12, density: 8, start: 'round', end: 'round', ostium: { parent: main, F: 0.035, reach: 0.12 }, mat: MAT.artery,
      pieces: [{ t: 1, info: GA({ id: 'transverse-cervical-a' + sfx, name: 'Artéria cervical transversa ' + af, desc: D.tca }) }],
    });
  }
  tctSystem(TCT_R, 'R', scaR); tctSystem(TCT_L, 'L', scaL);

  // ---- Tronco toracoacromial (2ª parte da axilar, na borda superior do peitoral menor): sobe ACIMA da veia axilar,
  //      perfura a fáscia clavipeitoral e continua como ramo peitoral (entre os peitorais); os ramos acromial (sobre o
  //      processo coracoide, profundo ao deltoide), clavicular (ao subclávio) e deltóideo (no sulco deltopeitoral,
  //      ANTERIOR e paralelo à cefálica) nascem em pontos escalonados do tronco.
  const TA_R = {
    main: [[11.3, -1.2, -1.85], [11.3, -0.55, -1.6], [11.2, -0.15, -0.85], [11.12, -0.08, -0.1], [11.02, -0.3, 0.38], [10.7, -1.25, 0.52], [10.3, -2.2, 0.55]],
    mainR: [0.19, 0.185, 0.17, 0.15, 0.125, 0.105, 0.085],
    split: 3,
    acro: [[11.18, -0.12, -0.45], [11.7, 0.15, -0.4], [12.4, 0.55, -0.55], [13.1, 0.75, -0.85], [13.6, 0.85, -1.15]],
    clav: [[11.1, -0.06, 0.1], [10.62, 0.1, 0.32], [10.15, 0.18, 0.45]],
    delt: [[11.05, -0.22, 0.32], [11.6, -0.1, 0.5], [12.4, 0.02, 0.8], [13.2, -0.4, 1.3], [13.95, -1.55, 1.55]],
  };
  function taSystem(side) {
    const L = side === 'L', S = L ? mirP : (p) => p, sfx = '-' + side, lado = L ? 'esquerdo' : 'direito';
    const main = build({
      kind: 'A', pts: S(TA_R.main), r: TA_R.mainR, radial: 14, density: 10, start: 'round', end: 'round', ostium: { parent: L ? scaL : scaR }, mat: MAT.artery,
      pieces: [
        { t: arcParams(C.curve(TA_R.main), TA_R.main.length)[TA_R.split], info: GA({ id: 'thoracoacromial' + sfx, name: 'Tronco toracoacromial ' + lado, desc: D.ta }) },
        { t: 1, info: GA({ id: 'thoracoacromial' + sfx, name: 'Tronco toracoacromial ' + lado + ' — ramo peitoral', desc: D.ta }) },
      ],
    });
    [['acro', 'acromial', 0.095], ['clav', 'clavicular', 0.08], ['delt', 'deltóideo', 0.095]].forEach(([k, nm, r0]) => {
      build({
        kind: 'A', pts: S(TA_R[k]), r: TA_R[k].map((p, i) => r0 * (1 - (0.3 * i) / (TA_R[k].length - 1))), radial: 10, density: 8, start: 'round', end: 'round', ostium: { parent: main }, mat: MAT.artery,
        pieces: [{ t: 1, info: GA({ id: 'thoracoacromial' + sfx, name: 'Tronco toracoacromial ' + lado + ' — ramo ' + nm, desc: D.ta }) }],
      });
    });
  }
  taSystem('R'); taSystem('L');

  /* =====================================================================
     VEIAS
     Decomposição das confluências (didática e geometricamente limpa):
       • CANAL direito  = axilar → subclávia → VBC D → VCS (o trajeto do fio-guia), varrido como uma só superfície;
       • CANAL esquerdo = axilar → subclávia → VBC E (longa, oblíqua) → desemboca no canal direito (origem da VCS);
       • as VJI chegam de cima e desembocam na curva do canal, no ângulo venoso (LM.vessels.venousAngleR e espelho).
     No ângulo venoso o eixo do canal corta a quina (arco de raio ≈ 1,2 cm entre os pontos vizinhos de LM), passando
     ≈ 0,3 cm do ponto LM no lado interno da curva — evita dobra da parede; o ponto LM fica no centro da confluência.
     Todas as confluências são uniões recortadas com filete (ver trimAll): a luz é contínua nos cortes.
     ===================================================================== */
  const veinNoise = (seed) => ({ amp: 0.022, freq: 1.25, seed });
  /** Ponto que substitui a quina `c` (entre a e b) por um arco de raio Rb. */
  function roundCorner(a, c, b, Rb) {
    const A = C.V(a), Cc = C.V(c), B = C.V(b);
    const din = Cc.clone().sub(A).normalize(), dout = B.clone().sub(Cc).normalize();
    const th = Math.acos(C.clamp(din.dot(dout), -1, 1));
    const bis = dout.clone().sub(din).normalize();
    return P3(Cc.addScaledVector(bis, Rb * (1 / Math.cos(th / 2) - 1)));
  }
  const axScv = VV.axillaryV.pts.concat(VV.scv.pts.slice(1, -1)); // axilar + subclávia sem o ponto do ângulo
  const axScvR = VV.axillaryV.r.concat(VV.scv.r.slice(1, -1));
  // ---- Canal direito
  const cornerR = roundCorner(VV.scv.pts[3], VV.venousAngleR, VV.rbcv.pts[1], 1.2);
  const chRpts = axScv.concat([cornerR], VV.rbcv.pts.slice(1), VV.svc.pts.slice(1));
  const chRr = axScvR.concat([0.74], VV.rbcv.r.slice(1, 3), [0.93], VV.svc.r.slice(1));
  const chRC = C.curve(chRpts), chRT = arcParams(chRC, chRpts.length), chRlen = chRC.getLength();
  const iAx = VV.axillaryV.pts.length - 1, iCorner = axScv.length, iSvc = iCorner + VV.rbcv.pts.length - 1;
  const tCornerR = chRT[iCorner], tSvc = chRT[iSvc];
  const channelR = build({
    kind: 'V', pts: chRpts, r: chRr, radial: 32, density: 8, start: 'cut', end: 'round', up: 'coronal', bones: true, sternum: true,
    // razão (eixo no plano coronal ⟂ trajeto)/(AP): subclávia achatada entre clavícula e 1ª costela (<1);
    // VBC/VCS quase circulares (eixo coronal = lateral → ligeiramente > 1)
    oval: [[0, 0.95], [chRT[iAx] - 0.04, 0.92], [chRT[iAx] + 0.03, 0.84], [chRT[iCorner] - 0.03, 0.88], [chRT[iCorner] + 0.02, 1.06], [tSvc, 1.1], [1, 1.1]],
    // origem da VCS mais larga, voltada para a VBC E que chega pela esquerda e pela frente; elevações discretas da parede
    // voltadas para a VJE e a cefálica (a confluência sobe ao encontro do afluente, sem "dedo pousado")
    bulges: [{ t: tSvc, w: 0.85, k: 0.18, dir: [-0.93, 0.12, 0.3] }, { t: tAt(chRC, 0, 6.0, 0, 0.6), w: 0.42, k: 0.13, dir: [0.41, 0.91, -0.11] },
      { t: tAt(chRC, 0, 11.4, 0, 0.6), w: 0.45, k: 0.1, dir: [0.62, 0.43, 0.65] }],
    valves: [{ s: tAt(chRC, 0, 6.4) * chRlen, k: 0.035 }], noise: veinNoise(22), mat: MAT.vein,
    pieces: [
      { t: chRT[iAx], info: GV({ id: 'axillary-v-R', name: 'Veia axilar direita', desc: D.axv }) },
      { t: tCornerR, info: GV({ id: 'scv-R', name: 'Veia subclávia direita', desc: D.scv }) },
      { t: tSvc, info: GV({ id: 'bcv-R', name: 'Veia braquiocefálica direita', desc: D.bcvR }) },
      { t: 1, info: GV({ id: 'svc', name: 'Veia cava superior', desc: D.svc }) },
    ],
  });
  // ---- Canal esquerdo (desemboca no canal direito na origem da VCS)
  const angL = mir(VV.venousAngleR);
  const cornerL = roundCorner(mir(VV.scv.pts[3]), angL, VV.lbcv.pts[1], 1.2);
  const chLpts = mirP(axScv).concat([cornerL], VV.lbcv.pts.slice(1));
  const chLr = axScvR.concat([0.72], VV.lbcv.r.slice(1));
  const chLC = C.curve(chLpts), chLT = arcParams(chLC, chLpts.length), chLlen = chLC.getLength();
  const tCornerL = chLT[iCorner];
  const channelL = build({
    kind: 'V', pts: chLpts, r: chLr, radial: 32, density: 8, start: 'cut', end: 'round', up: 'coronal', bones: true, sternum: true,
    // VBC E achatada AP atrás do manúbrio (eixo coronal = vertical)
    oval: [[0, 0.95], [chLT[iAx] - 0.04, 0.92], [chLT[iAx] + 0.03, 0.84], [tCornerL - 0.03, 0.9], [tCornerL + 0.04, 1.3], [0.9, 1.3], [1, 1.1]],
    ostium: { parent: channelR, at: 'end', taper: 0.45, F: 0.2, reach: 0.9 },
    bulges: [{ t: tAt(chLC, 0, -6.0, 0, 0.6), w: 0.42, k: 0.13, dir: [-0.41, 0.91, -0.11] }, { t: tAt(chLC, 0, -11.4, 0, 0.6), w: 0.45, k: 0.1, dir: [-0.62, 0.43, 0.65] }],
    valves: [{ s: tAt(chLC, 0, -6.4) * chLlen, k: 0.035 }], noise: veinNoise(23), mat: MAT.vein,
    pieces: [
      { t: chLT[iAx], info: GV({ id: 'axillary-v-L', name: 'Veia axilar esquerda', desc: D.axv }) },
      { t: tCornerL, info: GV({ id: 'scv-L', name: 'Veia subclávia esquerda', desc: D.scv }) },
      { t: 1, info: GV({ id: 'bcv-L', name: 'Veia braquiocefálica esquerda', desc: D.bcvL }) },
    ],
  });
  // ---- Veias jugulares internas: bulbo inferior com válvula; desembocam de cima no ângulo venoso (a E em geral menor)
  function ijv(side) {
    const L = side === 'L';
    const pts = L ? mirP(VV.ijvR.pts) : VV.ijvR.pts, c = C.curve(pts);
    return build({
      kind: 'V', pts, r: L ? VV.ijvR.r.map((v) => v * 0.9) : VV.ijvR.r, radial: 30, density: 8, start: 'cut', end: 'round', up: 'coronal', bones: true,
      oval: [[0, 1.28], [0.55, 1.22], [0.85, 1.12], [1, 1.06]],
      ostium: { parent: L ? channelL : channelR, at: 'end', taper: 0.4, F: 0.36 },
      valves: [{ s: tAt(c, 1, 3.35) * c.getLength(), k: 0.03 }], noise: veinNoise(L ? 25 : 24), mat: MAT.vein,
      pieces: [{ t: 1, info: GV({ id: 'ijv-' + side, name: 'Veia jugular interna ' + (L ? 'esquerda' : 'direita'), desc: D.ijv }) }],
    });
  }
  ijv('R'); ijv('L');
  // ---- Jugulares externas (válvulas: terminal e ~4 cm acima da clavícula)
  ['R', 'L'].forEach((side) => {
    const L = side === 'L';
    const pts = L ? mirP(VV.ejvR.pts) : VV.ejvR.pts, c = C.curve(pts), len = c.getLength();
    build({
      kind: 'V', pts, r: VV.ejvR.r, radial: 20, density: 9, start: 'cut', end: 'round', ostium: { parent: L ? channelL : channelR, at: 'end', F: 0.17, reach: 0.55 },
      valves: [{ s: tAt(c, 1, 4.9) * len, k: 0.04 }, { s: tAt(c, 1, 1.75) * len, k: 0.04 }], noise: veinNoise(L ? 27 : 26), mat: MAT.vein,
      pieces: [{ t: 1, info: GV({ id: 'ejv-' + side, name: 'Veia jugular externa ' + (L ? 'esquerda' : 'direita'), desc: D.ejv }) }],
    });
  });
  // ---- Cefálicas: sulco deltopeitoral (LM até y = −2) → trígono deltopeitoral, ANTERIOR e MEDIAL à ponta do coracoide →
  //      perfura a fáscia clavipeitoral acima do peitoral menor → face anterossuperior da veia axilar, à qual se une
  //      obliquamente, no sentido do fluxo (pontos próprios
  //      abaixo de y = −2: o trajeto de LM passava pela ponta do coracoide; ver `requests`).
  const cephR = VV.cephalicR.pts.slice(0, 3).concat([[13.35, -0.75, 0.85], [12.55, -0.3, 0.55], [12.0, -0.5, 0.0], [11.62, -0.72, -0.42], [11.25, -0.98, -0.8]]);
  const cephRr = [0.25, 0.27, 0.28, 0.28, 0.29, 0.3, 0.31, 0.32];
  ['R', 'L'].forEach((side) => {
    const L = side === 'L';
    build({
      kind: 'V', pts: L ? mirP(cephR) : cephR, r: cephRr, radial: 20, density: 8, start: 'cut', end: 'round', bones: true,
      ostium: { parent: L ? channelL : channelR, at: 'end', F: 0.18, reach: 0.6 }, noise: veinNoise(L ? 29 : 28), mat: MAT.vein,
      pieces: [{ t: 1, info: GV({ id: 'cephalic-v-' + side, name: 'Veia cefálica ' + (L ? 'esquerda' : 'direita'), desc: D.ceph }) }],
    });
  });
  // ---- Ázigo: sobe à direita dos corpos vertebrais (z ≈ −7,4), arqueia sobre o brônquio principal D (T4) e desemboca
  //      na face posterior da VCS (y ≈ −4,6). Eixo próprio (não há em LM); recorte no hiato aórtico.
  const azyPts = [[1.5, -23.0, -6.75], [1.45, -19.5, -7.15], [1.4, -15.5, -7.35], [1.35, -11.5, -7.4], [1.4, -8.0, -7.42], [1.6, -5.6, -7.35], [1.92, -4.0, -6.6], [2.2, -3.45, -5.45], [2.42, -3.75, -4.35], [2.5, -4.35, -3.55], [2.5, -4.75, -2.75]];
  build({
    kind: 'V', pts: azyPts, r: [0.36, 0.38, 0.4, 0.41, 0.42, 0.44, 0.46, 0.47, 0.48, 0.5, 0.48], radial: 20, density: 6, start: 'cut', end: 'round',
    ostium: { parent: channelR, at: 'end', F: 0.24 }, noise: veinNoise(30), mat: MAT.veinDeep,
    pieces: [{ t: 1, info: GV({ id: 'azygos', name: 'Veia ázigo (e arco da ázigo)', desc: D.azy }) }],
  });
  // ---- Torácicas internas (mediais às artérias, atrás das cartilagens) → VBC do mesmo lado.
  //      D: sobe na face anterior da VCS/VBC D e afunda-se nela obliquamente (confluência alongada), atrás da borda
  //      lateral do manúbrio.
  const itvRpts = [[2.6, -13.3, 1.8], [2.58, -9.0, 0.62], [2.58, -5.6, -0.3], [2.62, -3.9, -0.68], [2.7, -3.0, -1.05], [2.72, -2.4, -1.4], [2.68, -1.9, -1.75], [2.62, -1.5, -2.05]];
  const itvLpts = mirP(itvRpts.slice(0, 4)).concat([[-2.6, -2.85, -1.05], [-2.58, -2.0, -1.5], [-2.53, -1.2, -1.8], [-2.45, -0.5, -1.95], [-2.42, -0.12, -1.98]]);
  build({
    kind: 'V', pts: itvRpts, r: [0.16, 0.17, 0.175, 0.18, 0.18, 0.19, 0.2, 0.18], radial: 14, density: 7, start: 'cut', end: 'round', sternum: true,
    ostium: { parent: channelR, at: 'end', F: 0.1 }, noise: veinNoise(31), mat: MAT.veinDeep,
    pieces: [{ t: 1, info: GV({ id: 'itv-R', name: 'Veia torácica interna direita', desc: D.itv }) }],
  });
  build({
    kind: 'V', pts: itvLpts, r: [0.16, 0.17, 0.175, 0.18, 0.18, 0.185, 0.19, 0.2, 0.18], radial: 14, density: 7, start: 'cut', end: 'round', sternum: true,
    ostium: { parent: channelL, at: 'end', F: 0.1 }, noise: veinNoise(32), mat: MAT.veinDeep,
    pieces: [{ t: 1, info: GV({ id: 'itv-L', name: 'Veia torácica interna esquerda', desc: D.itv }) }],
  });

  // ---- União das confluências (recorte das partes internas; ver trimAll)
  const tTrim0 = performance.now();
  trimAll();
  if (typeof location !== 'undefined' && /[?&]vxdbg=1/.test(location.search)) window.__vx = { SYS, sdfOf, AXES, trimMs: performance.now() - tTrim0, T0: T_START };

  /* =====================================================================
     SÓLIDOS DE REFERÊNCIA (somente no harness de verificação: ?solids=…)
     Ossos, vísceras e estruturas de outros módulos aproximados por eixos de LM.
     ===================================================================== */
  try {
    if (typeof location !== 'undefined' && /[?&]solids=/.test(location.search) && !ATLAS.solids.some((s) => s.id.startsWith('ref:'))) {
      const K = LM.clavicle;
      const avg = (t) => (C.profile(K.ry)(t) + C.profile(K.rh)(t)) / 2;
      C.solid('ref:clavicle-R', K.pts, avg); C.solid('ref:clavicle-L', mirP(K.pts), avg);
      C.solid('ref:rib1-R', LM.ribs[0].pts, 0.3); C.solid('ref:rib1-L', mirP(LM.ribs[0].pts), 0.3);
      C.solid('ref:cart1-R', LM.ribs[0].cartilage, 0.42); C.solid('ref:cart1-L', mirP(LM.ribs[0].cartilage), 0.42);
      [1, 2].forEach((i) => { const cg = LM.ribs[i].cartilage; C.solid('ref:cart' + (i + 1) + '-R', cg, 0.36); C.solid('ref:cart' + (i + 1) + '-L', mirP(cg), 0.36); });
      // manúbrio: placa (espessura 1,25) aproximada por cápsulas verticais na sua linha média de espessura
      [0, 1.1, 2.0].forEach((x) => [x, -x].forEach((xx, j) => {
        if (j && !x) return;
        const pts = []; for (let y = 0.2; y >= -4.3; y -= 0.5) { const m = manubriumAt(xx, y, -0.3); if (m) pts.push([xx, y, (m.back + m.front) / 2]); }
        if (pts.length > 1) C.solid('ref:manubrium' + (xx ? (xx > 0 ? '-R' : '-L') + x : ''), pts, 0.6);
      }));
      const CO = LM.scapula.coracoid;
      C.solid('ref:coracoid-R', [CO.knee, CO.tip], [0.5, 0.42]); C.solid('ref:coracoid-L', mirP([CO.knee, CO.tip]), [0.5, 0.42]);
      C.solid('ref:trachea', LM.trachea.pts, LM.trachea.r); C.solid('ref:esophagus', LM.esophagus.pts, LM.esophagus.r);
      C.solid('ref:spine', LM.spine.map((s) => [0, s.y, s.zf - s.d / 2]), (t) => C.lerp(0.95, 1.5, t));
      C.solid('ref:thoracic-duct', LM.lymph.thoracicDuct, 0.15);
      C.solid('ref:scalene-ant-R', LM.muscles.scaleneAnt.pts, LM.muscles.scaleneAnt.t);
      ATLAS.solids.push({ id: 'ref:cupula-R', pts: [LM.pleura.cupulaCenter, LM.pleura.cupulaCenter], r: () => LM.pleura.cupulaR });
    }
  } catch (e) { /* só diagnóstico */ }

  /* =====================================================================
     ÂNCORAS (coordenadas anatômicas; pontos no eixo ou junto à face anterior)
     ===================================================================== */
  const onCurve = (c, ax, v, from, to) => P3(c.getPointAt(tAt(c, ax, v, from, to)));
  const front = (p, d) => [p[0], p[1], +(p[2] + d).toFixed(3)];
  const scvRc = channelR.curve;
  const anchors = {
    scvR: onCurve(scvRc, 0, 5.3, 0, tCornerR),
    scvLateralR: VV.scv.pts[0].slice(),
    axillaryVR: onCurve(scvRc, 0, 11.4, 0, tCornerR),
    ijvR: onCurve(C.curve(VV.ijvR.pts), 1, 5.0),
    venousAngleR: VV.venousAngleR.slice(),
    bcvR: onCurve(chRC, 1, -1.2, tCornerR, tSvc),
    lbcv: front(onCurve(chLC, 0, -0.4, tCornerL, 1), 0.35),
    svc: front(onCurve(chRC, 1, -5.6, tSvc, 1), 0.55),
    cavoatrial: VV.cavoatrialJunction.slice(),
    scaR: onCurve(scaRc, 0, 5.0),
    scaR1: onCurve(scaRc, 0, 3.6),
    axillaryAR: onCurve(scaRc, 0, 11.6),
    bct: onCurve(bctC, 0, 0.75, 0, 0.5),
    ccaR: onCurve(bctC, 1, 5.0),
    aorticArch: [-1.25, -2.25, -2.65],
    itaR: onCurve(itaSys.R.curve, 1, -5.0),
    vertebralAR: VV.vertebralAR.pts[2].slice(),
    ejvR: VV.ejvR.pts[2].slice(),
    cephalicR: VV.cephalicR.pts[2].slice(),
    scvL: onCurve(channelL.curve, 0, -5.3, 0, tCornerL),
    thoracicInletL: onCurve(scaLc, 0, -3.3, 0, 0.5),
    // extras (úteis para rótulos)
    ijvL: onCurve(C.curve(mirP(VV.ijvR.pts)), 1, 5.0),
    venousAngleL: mir(VV.venousAngleR),
    ccaL: onCurve(C.curve(VV.ccaL.pts), 1, 5.0),
    scaL: onCurve(scaLc, 0, -5.0, 0.3, 1),
    azygosArch: [2.2, -3.45, -5.45],
    thyrocervicalR: TCT_R.main[1].slice(),
    suprascapularR: TCT_R.ssa[6].slice(),
    transverseCervicalR: TCT_R.tca[4].slice(),
    inferiorThyroidR: TCT_R.main[6].slice(),
    itvR: [2.58, -5.0, -0.38],
    aortaDesc: [-2.6, -12.0, -6.6],
    ascAorta: front(P3(aorta.curve.getPointAt(0.12)), 0.9),
    vertebralC6R: F6.p.slice(),
  };

  return {
    anchors,
    api: {
      /** Eixo amostrado (coords anatômicas) de um vaso registrado por este módulo. */
      axis: (id) => (AXES[id] ? AXES[id].map((p) => p.slice()) : null),
      ids: () => Object.keys(AXES),
    },
  };
});
