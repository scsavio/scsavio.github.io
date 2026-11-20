/* ==========================================================================
   skin.js — pele, tela subcutânea, campo estéril fenestrado, antissepsia e coxins.
   Camadas: skin (pele + subcutâneo + papilas), drape (campo + antissepsia), aids (coxins).

   Método
   1) Campo de distância com sinal (SDF) "anatômico" em coordenadas de LM:
      tronco (loft lateral/dorsal ∩ face anterior moldada sobre o gradil costal),
      placa anterior do ombro (mesma face anterior, até a borda do peitoral maior =
      prega axilar anterior), pescoço, trapézio, clavículas, ECM, cúpula do ombro,
      deltoide (convexo, afilando em "V" até a tuberosidade), braços, prega axilar
      posterior, eretores, escápulas + relevos aditivos (fossas supraesternal e
      infraclavicular, ângulo esternal, sulcos, C7/T1 ancorados na pele dorsal real…).
      A face anterior = envelope dos ossos de LM (dilatação parabólica) + partes moles;
      com o módulo muscles, segue a superfície real de peitoral/deltoide/ECM, e vasos e
      nervos superficiais entram como "piso" com a folga exigida.
   2) Um pino faz a pele passar pela entrada da agulha (LM); um "empurrão" local
      garante folga mínima residual sobre as malhas já construídas (ossos, músculos,
      vasos, nervos, vísceras).
   3) Poligonização "surface nets" em grade hierárquica (1,6 → 0,8 → 0,4 cm) só na
      banda da superfície, com simetria bilateral; projeção na isossuperfície e
      normais pelo gradiente do campo.
   4) Três cascas aninhadas (pele → limite derme/hipoderme → fáscia profunda): no
      corte didático vê-se pele (derme) → gordura (amarelo) → plano profundo; na face
      anterior a gordura nunca invade o músculo (limite pele−músculo−derme). Grade fina
      (0,4 cm) em torno do plano da agulha; poros com normal map triplanar.
      Os recortes (pescoço oblíquo, braços, abdome) ficam ABERTOS: a borda mostra a
      secção em anéis, como numa peça dissecada, e não uma "tampa" de manequim.
   5) Desempenho: cascas internas completas (só visíveis com plano de corte), campo estéril +
      antissepsia e coxins são construídos sob demanda em update(); os "aros" internos junto aos
      recortes e a pele externa são construídos na carga.
   Coordenadas anatômicas: x = direita do paciente (+), y cranial, z anterior (cm).
   ========================================================================== */
ATLAS.define('skin', function (ctx) {
  const { THREE, C, LM, layers } = ctx;
  const V3 = THREE.Vector3;
  const TT = {}; let tLast = performance.now();
  const mark = (k) => { const t = performance.now(); TT[k] = Math.round(t - tLast); tLast = t; };
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  // mínimo/máximo suaves polinomiais (k = largura da concordância, cm)
  const smin = (a, b, k) => { const m = a < b ? a : b; const h = k - Math.abs(a - b); return h <= 0 ? m : m - h * h * 0.25 / k; };
  const smax = (a, b, k) => -smin(-a, -b, k);
  const BIG = 1e3;

  /* ======================================================================
     1. PRIMITIVAS DO CAMPO (funções escalares rápidas, sem alocação)
     ====================================================================== */
  /** Loft de secções superelípticas (expoente inteiro 2|3|4) ao longo de y; frente e dorso
      com expoentes próprios. keys: [y, A (meia-largura), F (z anterior, x=0), B (z posterior, x=0)]. */
  function makeLoft(keys, nF, nB, dy) {
    const y0 = keys[0][0], y1 = keys[keys.length - 1][0], n = Math.round((y1 - y0) / dy) + 1;
    const pr = [1, 2, 3].map((c) => C.profile(keys.map((k) => [(k[0] - y0) / (y1 - y0), k[c]])));
    const Tb = new Float64Array(n * 6); // A, F, B, dA/dy, dF/dy, dB/dy
    for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) Tb[i * 6 + c] = pr[c](i / (n - 1));
    for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) { const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1); Tb[i * 6 + 3 + c] = (Tb[b * 6 + c] - Tb[a * 6 + c]) / ((b - a) * dy); }
    const root = (s, e) => (e === 2 ? Math.sqrt(s) : e === 3 ? Math.cbrt(s) : Math.sqrt(Math.sqrt(s)));
    const ipow = (u, e) => (e === 2 ? u * u : e === 3 ? u * u * u : u * u * u * u);
    return function (ax, y, z) {
      let fy = (y - y0) / dy; if (fy < 0) fy = 0; else if (fy > n - 1.0001) fy = n - 1.0001;
      const i = fy | 0, w = fy - i, a = i * 6, b = a + 6;
      const A = Tb[a] + (Tb[b] - Tb[a]) * w, F = Tb[a + 1] + (Tb[b + 1] - Tb[a + 1]) * w, Bk = Tb[a + 2] + (Tb[b + 2] - Tb[a + 2]) * w;
      const dA = Tb[a + 3] + (Tb[b + 3] - Tb[a + 3]) * w, dF = Tb[a + 4] + (Tb[b + 4] - Tb[a + 4]) * w, dB = Tb[a + 5] + (Tb[b + 5] - Tb[a + 5]) * w;
      const zc = (F + Bk) * 0.5, front = z >= zc, e = front ? nF : nB, bz = front ? F - zc : zc - Bk;
      const sg = front ? 1 : -1, u = ax / A, v = ((z - zc) * sg) / bz;
      const pu = ipow(u, e), pv = ipow(v, e), Gv = root(pu + pv, e);
      if (Gv < 0.1) return -6;
      const Gn = e === 2 ? 1 / Gv : e === 3 ? 1 / (Gv * Gv) : 1 / (Gv * Gv * Gv), gu = (u > 1e-9 ? pu / u : 0) * Gn, gv = (v > 1e-9 ? pv / v : 0) * Gn; // ∂G/∂u, ∂G/∂v
      const dzc = (dF + dB) * 0.5, dbz = (dF - dB) * 0.5;
      const gx = gu / A, gz = (gv * sg) / bz, gy = gu * (-u / A) * dA + gv * ((-sg * dzc) / bz - (v / bz) * dbz);
      return (Gv - 1) / Math.sqrt(gx * gx + gy * gy + gz * gz + 1e-12);
    };
  }

  /** Varredura de secção elíptica ao longo de uma curva (Catmull-Rom), extremidades planas.
      o.a: semi-eixo ao longo de "up"; o.b: semi-eixo transverso; o.up: vetor | fn(t,p). */
  function makeSweep(pts, o) {
    const curve = C.curve(pts);
    const M = o.segs || 10;
    const pa = C.profile(o.a), pb = C.profile(o.b ?? o.a);
    const P = [], U = [], W = [], A = [], B = [];
    for (let i = 0; i <= M; i++) {
      const t = i / M, p = curve.getPointAt(t), T = curve.getTangentAt(t).normalize();
      const up = C.V(typeof o.up === 'function' ? o.up(t, p) : o.up || [0, 1, 0]);
      up.addScaledVector(T, -up.dot(T)).normalize();
      P.push(p); U.push(up); W.push(new V3().crossVectors(T, up)); A.push(pa(t)); B.push(pb(t));
    }
    const K = 28, D = new Float64Array(M * K);
    const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (let i = 0; i < M; i++) {
      const p0 = P[i], p1 = P[i + 1], dx = p1.x - p0.x, dy = p1.y - p0.y, dz = p1.z - p0.z, L = Math.hypot(dx, dy, dz);
      const r = Math.max(A[i], B[i], A[i + 1], B[i + 1]);
      D.set([p0.x, p0.y, p0.z, dx, dy, dz, L * L, L, (p0.x + p1.x) / 2, (p0.y + p1.y) / 2, (p0.z + p1.z) / 2, L / 2 + r,
        U[i].x, U[i].y, U[i].z, U[i + 1].x - U[i].x, U[i + 1].y - U[i].y, U[i + 1].z - U[i].z,
        W[i].x, W[i].y, W[i].z, W[i + 1].x - W[i].x, W[i + 1].y - W[i].y, W[i + 1].z - W[i].z, A[i], A[i + 1], B[i], B[i + 1]], i * K);
      for (const p of [p0, p1]) { lo[0] = Math.min(lo[0], p.x - r); lo[1] = Math.min(lo[1], p.y - r); lo[2] = Math.min(lo[2], p.z - r); hi[0] = Math.max(hi[0], p.x + r); hi[1] = Math.max(hi[1], p.y + r); hi[2] = Math.max(hi[2], p.z + r); }
    }
    const TS = new Float64Array(M);
    const f = function (ax, y, z) {
      for (let s = 0, o2 = 0; s < M; s++, o2 += K) TS[s] = ((ax - D[o2]) * D[o2 + 3] + (y - D[o2 + 1]) * D[o2 + 4] + (z - D[o2 + 2]) * D[o2 + 5]) / D[o2 + 6];
      let best = 1e9;
      for (let s = 0, o2 = 0; s < M; s++, o2 += K) {
        // Junções: um ponto além do fim do segmento s é coberto pelo segmento s+1 se projetar nele;
        // se cair na "cunha" do lado convexo (além de s e aquém de s+1), avalia-se no plano da junção.
        // A ultrapassagem axial (tampa plana) só vale nas extremidades verdadeiras da curva.
        let t = TS[s], axial = 0;
        if (t > 1) { if (s === M - 1) { axial = (t - 1) * D[o2 + 7]; t = 1; } else if (TS[s + 1] < 0) t = 1; else continue; }
        else if (t < 0) { if (s === 0) { axial = -t * D[o2 + 7]; t = 0; } else continue; }
        const ex = ax - D[o2 + 8], ey = y - D[o2 + 9], ez = z - D[o2 + 10], lim = best + D[o2 + 11];
        if (lim > 0 && ex * ex + ey * ey + ez * ez > lim * lim) continue;
        const dx = D[o2 + 3], dy = D[o2 + 4], dz = D[o2 + 5];
        const qx = ax - D[o2] - t * dx, qy = y - D[o2 + 1] - t * dy, qz = z - D[o2 + 2] - t * dz;
        const ux = D[o2 + 12] + t * D[o2 + 15], uy = D[o2 + 13] + t * D[o2 + 16], uz = D[o2 + 14] + t * D[o2 + 17];
        const wx = D[o2 + 18] + t * D[o2 + 21], wy = D[o2 + 19] + t * D[o2 + 22], wz = D[o2 + 20] + t * D[o2 + 23];
        const a = D[o2 + 24] + t * (D[o2 + 25] - D[o2 + 24]), b = D[o2 + 26] + t * (D[o2 + 27] - D[o2 + 26]);
        const s1 = qx * ux + qy * uy + qz * uz, s2 = qx * wx + qy * wy + qz * wz;
        const ia = 1 / a, ib = 1 / b, k0 = Math.sqrt(s1 * s1 * ia * ia + s2 * s2 * ib * ib), k1 = Math.sqrt(s1 * s1 * ia * ia * ia * ia + s2 * s2 * ib * ib * ib * ib);
        let e = k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -(a < b ? a : b);
        if (axial > 0) e = e > 0 ? Math.sqrt(e * e + axial * axial) : e > axial ? e : axial;
        if (e < best) best = e;
      }
      return best;
    };
    f.box = [lo, hi]; f.curve = curve;
    return f;
  }

  /** Elipsoide com eixos locais opcionais ([ex, ey, ez]). */
  function makeEllipsoid(c, r, axes) {
    const E = (axes || [[1, 0, 0], [0, 1, 0], [0, 0, 1]]).map((a) => C.V(a).normalize());
    const e = E.map((v) => [v.x, v.y, v.z]), m = Math.max(r[0], r[1], r[2]);
    const f = function (ax, y, z) {
      const qx = ax - c[0], qy = y - c[1], qz = z - c[2];
      const lx = (qx * e[0][0] + qy * e[0][1] + qz * e[0][2]) / r[0], ly = (qx * e[1][0] + qy * e[1][1] + qz * e[1][2]) / r[1], lz = (qx * e[2][0] + qy * e[2][1] + qz * e[2][2]) / r[2];
      const k0 = Math.sqrt(lx * lx + ly * ly + lz * lz), k1 = Math.sqrt((lx / r[0]) ** 2 + (ly / r[1]) ** 2 + (lz / r[2]) ** 2);
      return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(r[0], r[1], r[2]);
    };
    f.box = [[c[0] - m, c[1] - m, c[2] - m], [c[0] + m, c[1] + m, c[2] + m]];
    return f;
  }
  /** Fora da caixa expandida → valor grande (sem custo). */
  const boxed = (f, margin) => {
    const [lo, hi] = f.box; const a0 = lo[0] - margin, a1 = lo[1] - margin, a2 = lo[2] - margin, b0 = hi[0] + margin, b1 = hi[1] + margin, b2 = hi[2] + margin;
    const g = (ax, y, z) => (ax < a0 || ax > b0 || y < a1 || y > b1 || z < a2 || z > b2 ? BIG : f(ax, y, z));
    g.raw = f; return g;
  };

  /* ---------- núcleos aditivos (relevos): amp > 0 aprofunda (sulco/fossa); amp < 0 eleva ---------- */
  const kernels = [];
  function kPoint(c, s, amp, axes) {
    const sg = Array.isArray(s) ? s : [s, s, s];
    const E = (axes || [[1, 0, 0], [0, 1, 0], [0, 0, 1]]).map((a) => C.V(a).normalize());
    const e = E.map((v) => [v.x, v.y, v.z]), m = 3 * Math.max(...sg);
    kernels.push({ lo: [c[0] - m, c[1] - m, c[2] - m], hi: [c[0] + m, c[1] + m, c[2] + m], f(ax, y, z) {
      const qx = ax - c[0], qy = y - c[1], qz = z - c[2];
      const lx = (qx * e[0][0] + qy * e[0][1] + qz * e[0][2]) / sg[0], ly = (qx * e[1][0] + qy * e[1][1] + qz * e[1][2]) / sg[1], lz = (qx * e[2][0] + qy * e[2][1] + qz * e[2][2]) / sg[2];
      const r2 = lx * lx + ly * ly + lz * lz; return r2 > 9 ? 0 : amp * Math.exp(-0.5 * r2);
    } });
  }
  /** Sulco/crista ao longo de polilinha (amp e sigma por vértice). */
  function kCurve(pts, sigma, amp) {
    const n = pts.length, sg = Array.isArray(sigma) ? sigma : pts.map(() => sigma), am = Array.isArray(amp) ? amp : pts.map(() => amp);
    const m = 3 * Math.max(...sg); const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    pts.forEach((p) => { for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], p[c] - m); hi[c] = Math.max(hi[c], p[c] + m); } });
    kernels.push({ lo, hi, f(ax, y, z) {
      let best = 1e9, bs = 1, ba = 0;
      for (let i = 0; i < n - 1; i++) {
        const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], l2 = dx * dx + dy * dy + dz * dz;
        let t = l2 > 1e-12 ? ((ax - a[0]) * dx + (y - a[1]) * dy + (z - a[2]) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = ax - a[0] - t * dx, qy = y - a[1] - t * dy, qz = z - a[2] - t * dz, d2 = qx * qx + qy * qy + qz * qz;
        if (d2 < best) { best = d2; bs = sg[i] + (sg[i + 1] - sg[i]) * t; ba = am[i] + (am[i + 1] - am[i]) * t; }
      }
      const r2 = best / (bs * bs); return r2 > 9 ? 0 : ba * Math.exp(-0.5 * r2);
    } });
  }

  /* ======================================================================
     2. DESENHO ANATÔMICO
     ====================================================================== */
  const S = LM.sternum;

  // ---- 2a. Face anterior: envelope dos ossos + partes moles, numa grade 2D (x,y), passo 0,25 ----
  const FH = { x0: -3, x1: 17, y0: -31, y1: 4.5, d: 0.25 };
  FH.nx = Math.round((FH.x1 - FH.x0) / FH.d) + 1; FH.ny = Math.round((FH.y1 - FH.y0) / FH.d) + 1;
  const NF = FH.nx * FH.ny;
  const bone = new Float64Array(NF).fill(-BIG);
  const rasterDisc = (cx, cy, cz, rx, ry, rz) => { // elipsoide projetado de frente: z = cz + rz·√(1−q)
    for (const sx of cx < 3 ? [1, -1] : [1]) {
      const x = cx * sx;
      const i0 = Math.max(0, Math.floor((x - rx - FH.x0) / FH.d)), i1 = Math.min(FH.nx - 1, Math.ceil((x + rx - FH.x0) / FH.d));
      const j0 = Math.max(0, Math.floor((cy - ry - FH.y0) / FH.d)), j1 = Math.min(FH.ny - 1, Math.ceil((cy + ry - FH.y0) / FH.d));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const qx = (FH.x0 + i * FH.d - x) / rx, qy = (FH.y0 + j * FH.d - cy) / ry, q = qx * qx + qy * qy;
        if (q > 1) continue; const z = cz + rz * Math.sqrt(1 - q), k = j * FH.nx + i; if (z > bone[k]) bone[k] = z;
      }
    }
  };
  for (let y = 0.05; y >= S.xiphoidTipY; y -= 0.2) { // esterno (face anterior, com o arqueamento transversal do esqueleto)
    const hw = S.halfWidth(y) * (y < S.xiphisternalY ? 0.85 : 1);
    for (let x = 0; x <= hw; x += 0.2) rasterDisc(x, y, S.zAnt(y) - 0.035 * x * x - 0.3, 0.25, 0.25, 0.3);
  }
  LM.ribs.forEach((R) => {
    C.sample(R.pts, 60).forEach((p) => rasterDisc(p[0], p[1], p[2], Math.max(0.35, R.t / 2), R.h / 2 + 0.05, R.t / 2));
    if (R.cartilage) C.sample(R.cartilage, 30).forEach((p) => rasterDisc(p[0], p[1], p[2], 0.45, R.i === 1 ? 0.45 : R.h / 2, R.i === 1 ? 0.45 : 0.42));
  });
  const clavCurve = C.curve(LM.clavicle.pts), clavRy = C.profile(LM.clavicle.ry), clavRh = C.profile(LM.clavicle.rh);
  {
    for (let i = 0; i <= 80; i++) { const t = i / 80, p = clavCurve.getPointAt(t); rasterDisc(p.x, p.y, p.z, 0.35, clavRy(t), clavRh(t)); }
    rasterDisc(2.75, 0.62, -0.4, 0.62, 1.0, 0.92);
    const co = LM.scapula.coracoid; C.sample([co.knee, co.tip], 10).forEach((p) => rasterDisc(p[0], p[1], p[2], 0.45, 0.4, 0.4));
    const H = LM.humerus; rasterDisc(H.headCenter[0], H.headCenter[1], H.headCenter[2], H.headR, H.headR, H.headR);
    rasterDisc(H.lesserTubercle[0], H.lesserTubercle[1], H.lesserTubercle[2], 0.75, 1.0, 0.75);
    rasterDisc(H.greaterTubercle[0], H.greaterTubercle[1], H.greaterTubercle[2], 1.15, 1.5, 1.35);
  }
  // dilatação parabólica separável: z(p) = max_q [z(q) − |p−q|²/(2Rc)] (lençol de rigidez Rc sobre os ossos)
  const dilate2D = (src, nx, ny, d, Rc, reach) => {
    const K = Math.ceil(reach / d), tmp = new Float64Array(nx * ny), out = new Float64Array(nx * ny), c = (d * d) / (2 * Rc);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      let m = -BIG; const o0 = Math.max(-K, -i), o1 = Math.min(K, nx - 1 - i);
      for (let o = o0; o <= o1; o++) { const v = src[j * nx + i + o] - o * o * c; if (v > m) m = v; }
      tmp[j * nx + i] = m;
    }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      let m = -BIG; const o0 = Math.max(-K, -j), o1 = Math.min(K, ny - 1 - j);
      for (let o = o0; o <= o1; o++) { const v = tmp[(j + o) * nx + i] - o * o * c; if (v > m) m = v; }
      out[j * nx + i] = m;
    }
    return out;
  };
  const blur2D = (src, nx, ny, r) => { // caixa separável (2 passes ≈ gaussiana); ignora células vazias
    let a = Float64Array.from(src);
    for (let pass = 0; pass < 2; pass++) {
      const b = new Float64Array(nx * ny), c2 = new Float64Array(nx * ny);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { let s = 0, c = 0; for (let o = -r; o <= r; o++) { const ii = i + o; if (ii < 0 || ii >= nx) continue; const v = a[j * nx + ii]; if (v > -BIG / 2) { s += v; c++; } } b[j * nx + i] = c ? s / c : -BIG; }
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { let s = 0, c = 0; for (let o = -r; o <= r; o++) { const jj = j + o; if (jj < 0 || jj >= ny) continue; const v = b[jj * nx + i]; if (v > -BIG / 2) { s += v; c++; } } c2[j * nx + i] = c ? s / c : -BIG; }
      a = c2;
    }
    return a;
  };
  const clavBot = []; for (let i = 0; i <= 60; i++) { const t = i / 60; clavBot.push(clavCurve.getPointAt(t).y - clavRy(t)); }
  const clavBottom = (x) => { const f = clamp((x - 2.55) / (15.9 - 2.55), 0, 1) * 60, i = Math.min(59, f | 0); return clavBot[i] + (clavBot[i + 1] - clavBot[i]) * (f - i); };
  const hullSoft0 = dilate2D(bone, FH.nx, FH.ny, FH.d, 3, 5);
  const hullSoftB = blur2D(hullSoft0, FH.nx, FH.ny, 3);
  const hullStiff = dilate2D(bone, FH.nx, FH.ny, FH.d, 12, 8);
  const hull = new Float64Array(NF);
  for (let j = 0; j < FH.ny; j++) for (let i = 0; i < FH.nx; i++) {
    const k = j * FH.nx + i, x = Math.abs(FH.x0 + i * FH.d), y = FH.y0 + j * FH.d;
    const soft = Math.max(hullSoftB[k], hullSoft0[k] - 0.1);
    // região infraclavicular: peitoral/subclávio preenchem o vão clavícula–2ª/3ª costelas → envelope rígido
    const w = sstep(1.8, 3.6, x) * (1 - sstep(13.5, 15.5, x)) * (1 - sstep(-6.0, -11.5, y));
    hull[k] = lerp(soft, Math.max(soft, hullStiff[k]), w);
  }

  // Contorno do peitoral maior (lado D) no plano frontal — borda inferolateral livre e espessa.
  const pecPoly = [[1.9, 1.3], [1.75, -3], [1.9, -8], [2.2, -12.4], [3.0, -14.5], [5.2, -15.3], [8.2, -15.15], [10.7, -14.0], [12.5, -12.0], [13.7, -9.6], [14.6, -7.6], [15.9, -5.5], [17.2, -3.6], [15.7, -1.7], [14.0, -0.2], [12.8, 0.9], [11.0, 1.35], [8.0, 1.5], [5.0, 1.45]];
  const polyDist = (poly, x, y) => { // distância com sinal ao polígono (negativa dentro)
    let d = 1e9, inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [ax, ay] = poly[j], [bx, by] = poly[i], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      const t = l2 > 0 ? clamp(((x - ax) * dx + (y - ay) * dy) / l2, 0, 1) : 0, qx = x - ax - t * dx, qy = y - ay - t * dy;
      d = Math.min(d, qx * qx + qy * qy);
      if ((ay > y) !== (by > y) && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
    }
    return (inside ? -1 : 1) * Math.sqrt(d);
  };
  // espessura muscular do peitoral maior (sem pele/gordura)
  const pecThick = (x, y) => {
    const dp = polyDist(pecPoly, x, y);
    if (dp > 0) return 0;
    const med = 0.15 + 0.85 * sstep(1.4, 6.5, x);                  // fino junto à borda esternal
    const yc = clavBottom(x), cla = sstep(yc + 0.35, yc - 2.2, y);    // origem clavicular (fina junto ao osso)
    const lat = 1 - 0.25 * sstep(13.5, 17, x);                       // converge ao tendão
    const bulk = 1.0 + 0.12 * Math.exp(-(((x - 8.0) / 3.5) ** 2) - (((y + 7.0) / 4.5) ** 2));
    const low = 1 - 0.35 * sstep(-9, -14.5, y);                      // afina em direção à borda inferior (homem magro)
    const edge = Math.sqrt(clamp(-dp / 1.7, 0, 1));                  // borda livre arredondada, discreta
    return 1.2 * med * (0.12 + 0.88 * cla) * lat * bulk * low * edge;
  };
  const softT = (x, y) => 0.6 + 0.14 * (1 - sstep(1.8, 3.2, x)) * sstep(1.2, -1.5, y) + 0.3 * sstep(-14, -22, y);
  // abdome superior (sem osso): parede anterior sustentada pelas vísceras; só abaixo da margem costal
  const abdZ = (x, y) => {
    const z0 = lerp(4.55, 3.7, sstep(-17, -29, y)), w = lerp(10.5, 11.5, sstep(-17, -29, y));
    return z0 - 0.0095 * x * x + 0.25 * Math.exp(-(((x - 4.4) / 2.6) ** 2)) * sstep(-17, -20, y) - 30 * sstep(-15.5, -12.5, y);
  };
  // Músculos já construídos (módulo muscles, se presente): a face anterior "abraça" a superfície real do
  // peitoral maior/deltoide/ECM (+ gordura e pele). Sem o módulo, usa-se o peitoral analítico acima.
  const musF = new Float64Array(NF).fill(-BIG); let hasPec = false;
  const wroot = ctx.world || layers.skin.parent; if (wroot) wroot.updateMatrixWorld(true);
  const invWorld = wroot ? new THREE.Matrix4().copy(wroot.matrixWorld).invert() : new THREE.Matrix4(), I4 = new THREE.Matrix4();
  if (layers.muscle) {
    const v = new V3();
    layers.muscle.traverse((o) => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position || (o.material && o.material.transparent)) return;
      if (o.userData.info && /^pec-major/.test(o.userData.info.id)) hasPec = true;
      const pa = o.geometry.attributes.position, M = invWorld.clone().multiply(o.matrixWorld), ident = M.equals(I4);
      for (let i = 0; i < pa.count; i += 2) {
        v.fromBufferAttribute(pa, i); if (!ident) v.applyMatrix4(M);
        if (v.y > FH.y1 || v.y < FH.y0) continue;
        const ax = Math.abs(v.x); if (ax > FH.x1) continue;
        const ci = Math.round((ax - FH.x0) / FH.d), cj = Math.round((v.y - FH.y0) / FH.d), k = cj * FH.nx + ci;
        if (v.z > musF[k]) musF[k] = v.z;
        if (ax < 3) { const k2 = cj * FH.nx + Math.round((-ax - FH.x0) / FH.d); if (v.z > musF[k2]) musF[k2] = v.z; }
      }
    });
  }
  const musD = hasPec ? dilate2D(musF, FH.nx, FH.ny, FH.d, 1.2, 0.75) : null; // fecha lacunas entre vértices
  const FHt = new Float64Array(NF);
  for (let j = 0; j < FH.ny; j++) for (let i = 0; i < FH.nx; i++) {
    const x = Math.abs(FH.x0 + i * FH.d), y = FH.y0 + j * FH.d, k = j * FH.nx + i;
    let z = Math.max(hull[k] + softT(x, y) + (hasPec ? 0 : pecThick(x, y)), abdZ(x, y));
    if (hasPec && musD[k] > -BIG / 2) z = Math.max(z, musD[k] + softT(x, y) - 0.08);
    FHt[k] = z;
  }
  {
    // suavização: forte no tórax; leve no trígono clavideltopeitoral e no sulco deltopeitoral (preserva a fossa e o sulco
    // que a superfície real dos músculos já desenha)
    const bS = blur2D(FHt, FH.nx, FH.ny, 3), bF = blur2D(FHt, FH.nx, FH.ny, 1);
    for (let j = 0; j < FH.ny; j++) for (let i = 0; i < FH.nx; i++) {
      const x = Math.abs(FH.x0 + i * FH.d), y = FH.y0 + j * FH.d, k = j * FH.nx + i;
      const m = hasPec ? sstep(10.8, 12.3, x) * sstep(-10.5, -8.5, y) * (1 - sstep(1.4, 2.4, y)) : 0;
      FHt[k] = lerp(bS[k], bF[k], m);
    }
  }
  // piso de folga: vasos e nervos superficiais (p.ex. veia cefálica no sulco deltopeitoral) entram no mapa da face
  // anterior com a folga exigida, para que o desenho já os respeite (sem "empurrões" largos que apagam fossas e sulcos)
  {
    // veias: perfil estreito (a veia cefálica pode marcar o fundo do sulco); artérias/nervos: perfil largo e suave
    // (um ramo arterial superficial não deve aparecer como um "cordão" sob a pele)
    const need = { vein: [0.36, 0.7], artery: [0.6, 1.8], nerve: [0.55, 1.8] }, v = new V3(), floD = new Float64Array(NF).fill(-BIG);
    for (const [ln, [nd, rc]] of Object.entries(need)) {
      const flo = new Float64Array(NF).fill(-BIG); let any = false;
      if (!layers[ln]) continue;
      layers[ln].traverse((o) => {
        if (!o.isMesh || !o.geometry || !o.geometry.attributes.position || (o.material && o.material.transparent)) return;
        const pa = o.geometry.attributes.position, M = invWorld.clone().multiply(o.matrixWorld), ident = M.equals(I4);
        for (let i = 0; i < pa.count; i++) {
          v.fromBufferAttribute(pa, i); if (!ident) v.applyMatrix4(M);
          if (v.y > 1.6 || v.y < FH.y0) continue;
          const ax = Math.abs(v.x); if (ax > FH.x1) continue;
          const ci = Math.round((ax - FH.x0) / FH.d), cj = Math.round((v.y - FH.y0) / FH.d), k = cj * FH.nx + ci, zf = v.z + nd;
          if (zf > flo[k]) { flo[k] = zf; any = true; }
          if (ax < 3) { const k2 = cj * FH.nx + Math.round((-ax - FH.x0) / FH.d); if (zf > flo[k2]) flo[k2] = zf; }
        }
      });
      if (!any) continue;
      const fd = dilate2D(flo, FH.nx, FH.ny, FH.d, rc, rc * 1.5); // perfil arredondado sobre o vaso/nervo
      for (let k = 0; k < NF; k++) if (fd[k] > floD[k]) floD[k] = fd[k];
    }
    for (let k = 0; k < NF; k++) if (floD[k] > FHt[k]) FHt[k] = floD[k];
  }
  const FHx = new Float64Array(NF), FHy = new Float64Array(NF); // gradientes pré-calculados
  for (let j = 0; j < FH.ny; j++) for (let i = 0; i < FH.nx; i++) {
    const k = j * FH.nx + i, i0 = Math.max(0, i - 1), i1 = Math.min(FH.nx - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(FH.ny - 1, j + 1);
    FHx[k] = (FHt[j * FH.nx + i1] - FHt[j * FH.nx + i0]) / ((i1 - i0) * FH.d); FHy[k] = (FHt[j1 * FH.nx + i] - FHt[j0 * FH.nx + i]) / ((j1 - j0) * FH.d);
  }
  const bil = (T, fx, fy) => { const i = fx | 0, j = fy | 0, u = fx - i, v = fy - j, k = j * FH.nx + i; return (T[k] * (1 - u) + T[k + 1] * u) * (1 - v) + (T[k + FH.nx] * (1 - u) + T[k + FH.nx + 1] * u) * v; };
  const frontH = (ax, y) => bil(FHt, clamp((ax - FH.x0) / FH.d, 0, FH.nx - 1.001), clamp((y - FH.y0) / FH.d, 0, FH.ny - 1.001));
  const frontCap = (ax, y, z) => {
    const fx = clamp((ax - FH.x0) / FH.d, 0, FH.nx - 1.001), fy = clamp((y - FH.y0) / FH.d, 0, FH.ny - 1.001);
    const hh = bil(FHt, fx, fy), hx = bil(FHx, fx, fy), hy = bil(FHy, fx, fy);
    return (z - hh) / Math.sqrt(1 + hx * hx + hy * hy);
  };

  // ---- 2b. Tronco: loft lateral/dorsal (frente superdimensionada, recortada pela face anterior) ----
  const trunkLoft = makeLoft([
    [-31, 13.9, 8.6, -16.6], [-27, 14.2, 8.9, -16.9], [-23, 14.9, 9.4, -17.3], [-19, 15.5, 9.8, -17.6],
    [-15.5, 15.25, 9.6, -17.8], [-12, 15.05, 9.2, -17.9], [-9, 14.85, 8.6, -17.9], [-6, 14.6, 7.8, -17.7],
    [-3, 14.5, 7.0, -17.45], [0, 14.6, 6.3, -17.05], [2, 13.5, 5.8, -16.2], [4, 11.0, 5.3, -14.8],
  ], 4, 3, 0.2);
  // topo do tronco: margem superior do manúbrio na linha média, clavículas lateralmente, mais alto atrás
  const trunkTop = (ax, z) => lerp(0.3 + 0.92 * sstep(1.4, 3.4, ax), 3.6, sstep(-0.8, -4.5, z));

  // ---- 2c. Pescoço ----
  // dorso do pescoço segue a pele dorsal mediana de LM (LM.skinBackZ), como o trapézio do módulo muscles
  const nb = (y) => LM.skinBackZ(y) + 0.2;
  // face anterior mediana: rasa entre as cabeças esternais do ECM logo acima da incisura, plana sobre a traqueia
  // (sem "canal" vertical); meia-largura reduzida no pescoço médio (homem magro: circunferência ~38–40 cm se LM.skinBackZ permitir)
  const neckLoft = makeLoft([
    [-1.0, 8.2, 0.4, nb(-1)], [1.5, 7.8, 0.3, nb(1.5)], [3.5, 7.1, 0.6, nb(3.5)], [5.5, 6.6, 0.75, nb(5.5)],
    [8.0, 6.2, 0.95, nb(8)], [10.5, 5.95, 1.35, nb(10.5)], [13.0, 5.8, 1.7, nb(13)], [15.5, 5.75, 2.0, nb(15.5)],
  ], 4, 2, 0.2);

  // ---- 2d. Trapézio / "canga" pescoço-ombro (crista do contorno do ombro) ----
  const yokeUp = new V3(0, 1, 0.12).normalize();
  // começa além da linha média (x<0): com a avaliação simétrica (|x|) não há tampa visível na nuca
  // a face anterior da canga desce até a clavícula (assoalho da região supraclavicular); a fossa é esculpida à parte
  const yokeRidge = [[-0.6, 14.6, -9.7, 3.0, 2.9], [2.2, 13.2, -9.45, 3.2, 3.4], [4.5, 10.7, -9.0, 4.2, 5.4], [6.6, 8.55, -8.4, 5.0, 7.3], [8.7, 7.35, -7.75, 5.2, 8.1],
    [11.1, 6.45, -6.95, 5.1, 8.0], [13.6, 5.4, -5.95, 4.5, 6.9], [15.6, 3.45, -4.85, 3.0, 5.0], [17.25, 2.15, -4.0, 2.0, 3.4]]; // acrômio subcutâneo: canga baixa
  const yoke = boxed(makeSweep(yokeRidge.map((r) => [r[0] - yokeUp.x * r[3], r[1] - yokeUp.y * r[3], r[2] - yokeUp.z * r[3]]), {
    a: yokeRidge.map((r) => r[3]), b: yokeRidge.map((r) => r[4]), up: [0, 1, 0.12], segs: 22,
  }), 4);

  // ---- 2e. Clavícula (pele ~0,5 cm sobre a face anterossuperior) e extremidade esternal ----
  const clavSk = boxed(makeSweep(LM.clavicle.pts, {
    a: LM.clavicle.ry.map(([t, v]) => [t, v + 0.48]), b: LM.clavicle.rh.map(([t, v]) => [t, v + 0.46]), up: [0, 1, 0], segs: 16,
  }), 3);
  const scEnd = boxed(makeEllipsoid([2.72, 0.62, -0.42], [0.62 + 0.42, 1.0 + 0.42, 0.92 + 0.45]), 3);
  // tecido entre as cabeças do ECM (VJI, gordura): a fossa supraclavicular menor é rasa, não um orifício
  const lsfFill = boxed(makeEllipsoid([2.85, 2.6, -0.35], [1.35, 1.6, 1.05]), 3);

  // ---- 2f. Esternocleidomastóideo: cabeça esternal (tendínea, estreita), cabeça clavicular (larga) ----
  // trajeto sobre o tendão real (muscles: borda medial x≈0,9–1,0 na incisura) — bordas mediais em ±0,9–1,0 cm,
  // divergindo para cima: a fossa supraesternal fica em "U" entre os dois tendões, logo acima do manúbrio
  const scmStern = boxed(makeSweep([[1.3, -0.7, 0.45], [1.42, 0.6, 0.85], [1.65, 2.1, 0.82], [2.3, 3.8, 0.48], [3.4, 5.7, -0.15], [4.4, 8.4, -0.72], [5.3, 11.0, -1.3], [6.0, 13.6, -1.85], [6.5, 16.0, -2.3]], {
    a: [[0, 0.5], [0.12, 0.55], [0.25, 0.62], [0.4, 0.78], [0.55, 0.9], [0.75, 0.95], [1, 0.9]],
    b: [[0, 0.48], [0.12, 0.55], [0.25, 0.68], [0.4, 1.1], [0.55, 1.45], [0.75, 1.55], [1, 1.5]], up: [0.55, 0.05, 0.83], segs: 16,
  }), 3);
  const scmClav = boxed(makeSweep([[5.1, 1.75, 0.8], [4.65, 3.4, 0.5], [4.1, 5.4, 0.0], [3.7, 6.8, -0.3]], {
    a: [0.45, 0.55, 0.65, 0.7], b: [1.35, 1.3, 1.15, 1.0], up: [0.45, 0.3, 0.84], segs: 4,
  }), 3);

  // veia jugular externa: superficial (logo abaixo da pele) — relevo venoso discreto no pescoço
  const ejvR = LM.vessels.ejvR;
  const ejvSk = boxed(makeSweep(ejvR.pts, { a: ejvR.r.map((r) => r + 0.42), b: ejvR.r.map((r) => r + 0.42), up: [1, 0, 0], segs: 8 }), 3);
  // ---- 2g. Ombro (deltoide sobre a cabeça do úmero), braço e pregas axilares ----
  // cúpula do ombro (cabeça do úmero + deltoide) — o contorno lateral fica a cargo do deltoide abaixo
  const shoulder = boxed(makeEllipsoid([17.3, -1.95, -4.45], [4.3, 4.2, 6.4], [[1, 0.12, 0], [-0.12, 1, 0], [0, 0, 1]]), 4);
  // deltoide: massa convexa do acrômio à tuberosidade deltóidea (~y −10), afilando em "V" — máximo lateral em y −2…−5
  const deltoid = boxed(makeSweep([[17.2, 1.5, -4.0], [17.6, 0.6, -4.0], [18.75, -1.9, -4.0], [19.2, -4.7, -3.9], [19.05, -7.5, -3.8], [18.75, -10.0, -3.7]], {
    a: [1.3, 2.6, 3.85, 3.5, 2.95, 1.3], b: [2.4, 4.9, 5.85, 5.2, 3.5, 1.4], up: [1, 0, 0], segs: 10,
  }), 4);
  // braço (secção ~7,5 × 8,8 cm, razão AP/LM ≈ 1,15): termina no recorte (y≈−15,5), sem prolongar-se sobre o tórax
  const armSweep = makeSweep([[18.2, -3.0, -3.95], [18.45, -5.5, -4.0], [18.55, -8.5, -4.05], [18.7, -11.5, -4.1], [19.15, -14.3, -4.1], [19.3, -15.8, -4.12]], {
    a: [3.4, 3.35, 3.35, 3.65, 3.42, 3.36], b: [4.7, 4.6, 4.45, 4.4, 4.3, 4.25], up: [1, 0, 0], segs: 8,
  });
  const arm = boxed(armSweep, 4);
  // o braço encosta no tórax abaixo da axila (prega de contato suave); junto ao recorte afasta-se ~0,6 cm (abdução mínima):
  // os anéis do corte ficam completos e a grade de 0,4 cm resolve a fenda sem fundir braço e tórax
  const kArm = (y) => (y < -12 ? lerp(0.15, 0.6, sstep(-14.6, -12.5, y)) : lerp(0.6, 2.2, sstep(-12.0, -8.0, y)));
  // gordura axilar com o feixe neurovascular (entre as pregas axilares)
  const axFill = boxed(makeEllipsoid([15.0, -7.4, -4.0], [1.9, 2.5, 3.1]), 3);
  // (a prega axilar anterior é a borda arredondada da placa anterior do ombro, sobre a borda real do peitoral maior)
  // prega axilar posterior (latíssimo do dorso + redondo maior): começa afilada e afundada no tronco, perto do ângulo
  // inferior da escápula, e engrossa até o braço — sem tampa plana (antes gerava um vinco em "V" no dorso)
  const foldP = boxed(makeSweep([[9.6, -13.0, -13.6], [11.4, -10.9, -13.5], [13.3, -8.4, -12.1], [15.6, -5.8, -8.7], [17.0, -4.2, -6.4]], {
    a: [[0, 0.3], [0.25, 1.6], [0.5, 2.0], [0.8, 2.0], [1, 1.9]], b: [[0, 0.5], [0.25, 2.0], [0.5, 2.4], [0.8, 2.2], [1, 2.0]], up: [0.5, 0.2, -0.84], segs: 6,
  }), 3);

  // ---- 2h. Dorso: eretores da espinha; região escapular (infraespinal/redondo) ----
  const erector = boxed(makeSweep([[2.7, -31, -14.4], [2.75, -24, -15.0], [2.85, -16, -15.5], [2.9, -8, -15.55], [2.85, -2, -15.0], [2.6, 2, -13.3], [2.3, 5.5, -10.7]], {
    a: [2.4, 2.55, 2.6, 2.6, 2.5, 2.3, 2.0], b: [2.4, 2.5, 2.4, 2.3, 2.2, 2.0, 1.8], up: [0, 0, -1], segs: 8,
  }), 3);
  const scap = boxed(makeEllipsoid([9.9, -4.6, -15.15], [3.6, 5.6, 1.75], [[0.86, 0.06, 0.5], [-0.05, 1, 0.02], [-0.5, 0, 0.86]]), 3);

  // Placa anterior do ombro: o loft do tronco termina em x≈13–14; entre ele e o elipsoide do ombro havia um vão
  // (trígono clavideltopeitoral e sulco deltopeitoral) que só o "empurrão" preenchia. A placa = face anterior (mapa
  // que segue peitoral/deltoide reais + partes moles) ∩ envelope elipsoidal, logo abaixo da clavícula.
  // Limites: logo abaixo da clavícula (em cima), prega axilar anterior (embaixo), x≈17,8 (lateral, onde o elipsoide
  // do ombro assume) e um plano dorsal profundo; a borda medial fica dentro do tronco (mesma face → união sem costura).
  // borda inferior do peitoral maior (módulo muscles): (13,−13,2) → (16,−8,1) → (17,8,−8,7); > 0 abaixo dela (axila)
  const pecBorder = (ax, y) => Math.min(0.862 * (ax - 13.0) - 0.507 * (y + 13.2), -0.316 * (ax - 16.0) - 0.949 * (y + 8.1));
  const shSlab = (ax, y, z) => {
    let d = frontCap(ax, y, z);
    d = smax(d, y - (clavBottom(ax) + 0.3), 0.9);
    d = smax(d, pecBorder(ax, y) - 0.7, 1.3);            // a borda arredondada da placa forma a prega axilar anterior
    d = smax(d, frontH(ax, y) - 2.7 - z, 1.0);          // placa de ~2,7 cm (peitoral + pele), não um bloco até o dorso
    d = smax(d, ax - 17.8, 1.4);
    return smax(d, 9.6 - ax, 1.0);
  };

  /* ---------- campo-base (sem relevos) ---------- */
  function baseField(x, y, z, noArm) {
    const ax = x < 0 ? -x : x;
    let tr = trunkLoft(ax, y, z);                            // tronco = loft ∩ face anterior ∩ topo
    if (y < 4.6 && z > -9) tr = smax(tr, frontCap(ax, y, z), 1.2);
    tr = smax(tr, y - trunkTop(ax, z), 1.6);
    let d = tr;
    if (ax > 9.4 && ax < 19 && y < 2.8 && y > -15 && z > -6) { const sl = shSlab(ax, y, z); if (sl < d) d = sl; }
    d = smin(d, neckLoft(ax, y, z), 1.3);
    d = smin(d, yoke(ax, y, z), 2.6);
    d = smin(d, clavSk(ax, y, z), 1.2);
    d = smin(d, scEnd(ax, y, z), 0.7);

    d = smin(d, lsfFill(ax, y, z), 1.0);
    d = smin(d, ejvSk(ax, y, z), 1.3);
    // as duas cabeças esternais (D e E) unidas por smin simétrico: sem o vinco de |x| no fundo da fossa supraesternal
    d = smin(d, ax < 3 ? smin(scmStern(ax, y, z), scmStern(-ax, y, z), 0.7) : scmStern(ax, y, z), 1.25);
    d = smin(d, scmClav(ax, y, z), 1.1);
    d = smin(d, shoulder(ax, y, z), 2.0);
    d = smin(d, deltoid(ax, y, z), 1.6);
    d = smin(d, foldP(ax, y, z), 2.6);
    d = smin(d, erector(ax, y, z), 1.6);
    d = smin(d, scap(ax, y, z), 1.6);
    if (ax > 11 && !noArm) { d = smin(d, axFill(ax, y, z), 1.6); d = smin(d, arm(ax, y, z), kArm(y)); }
    return d;
  }

  /* ---------- relevos aditivos ---------- */
  const surfZ = (f, x, y, zHint) => { // marcha de fora (+z) para dentro até cruzar zero
    let z = zHint + 6, v = f(x, y, z);
    for (let i = 0; i < 80 && v > 0.002; i++) { z -= Math.max(0.02, v * 0.9); v = f(x, y, z); if (z < zHint - 12) break; }
    return z;
  };
  const onSkin = (x, y, zh) => [x, y, surfZ(baseField, x, y, zh)];
  const backZ0 = (f, x, y, zHint) => { // marcha de trás (−z) para a frente até cruzar zero
    let z = zHint - 6, v = f(x, y, z);
    for (let i = 0; i < 80 && v > 0.002; i++) { z += Math.max(0.02, v * 0.9); v = f(x, y, z); if (z > zHint + 12) break; }
    return z;
  };
  const onBack = (x, y) => [x, y, backZ0(baseField, x, y, LM.skinBackZ(y) - 1)];
  const onTop = (x, z) => { let y = 9, v = baseField(x, y, z); for (let i = 0; i < 90 && v > 0.002; i++) { y -= Math.max(0.02, v * 0.9); v = baseField(x, y, z); } return [x, y, z]; };
  {
    { const fj = onSkin(0, 0.65, 1); kPoint([0, 0.65, fj[2] - 0.15], [1.4, 0.8, 0.9], 0.22); } // fossa supraesternal (incisura jugular): "U" largo logo acima do manúbrio
    kPoint([2.65, 2.3, 0.45], [0.75, 0.7, 0.8], 0.2);                       // fossa supraclavicular menor
    kPoint([8.3, 3.3, -1.9], [2.2, 1.3, 1.5], 0.45, [[1, 0, 0], [0, 0.8, -0.6], [0, 0.6, 0.8]]); // fossa supraclavicular maior
    const fic = onSkin(13.05, 0.25, 2); kPoint(fic, [1.05, 0.95, 1.0], 0.2);  // fossa infraclavicular (trígono clavideltopeitoral): a placa já segue o vão muscular; aqui só se acentua
    const dp = LM.surface.deltopectoralGroove.map((p) => onSkin(p[0] + 0.1, p[1], 2));
    kCurve([fic, ...dp, onSkin(15.9, -9.0, 1.5)], [0.8, 0.5, 0.48, 0.55, 0.6], [0.2, 0.18, 0.16, 0.1, 0.0]); // sulco deltopeitoral (fundo limitado pela veia cefálica)
    // ângulo esternal (de Louis): crista transversal palpável sobre a articulação manubrioesternal e as 2ªs cartilagens
    kCurve([-3.4, -1.6, 0, 1.6, 3.4].map((x) => onSkin(x, S.angleY - 0.1, 2.2)), 0.75, [-0.03, -0.2, -0.25, -0.2, -0.03]);
    // tela pré-esternal fina sobre o corpo do esterno (homem magro): o corpo fica num sulco raso entre os peitorais
    kPoint(onSkin(0, -9.4, 3.8), [2.4, 2.3, 1.4], 0.24);
    kCurve([onSkin(0, -1.5, 2), onSkin(0, -8, 3), onSkin(0, -14.5, 4.5)], 0.9, 0.08);                 // sulco mediano esternal
    kCurve([onSkin(0, -17.5, 4), onSkin(0, -23, 3.6), onSkin(0, -29, 3.2)], [0.5, 0.55, 0.55], [0.18, 0.22, 0.2]); // linha alba
    kPoint(onSkin(0, -18.6, 4), [1.3, 1.1, 1.0], 0.22);                      // fossa epigástrica
    kPoint([0, 10.6, 1.35], [0.75, 1.1, 0.7], -0.3);                         // proeminência laríngea (discreta)
    // acrômio subcutâneo: tecido mole fino sobre o osso (o ombro não fica "acolchoado"); borda lateral palpável
    { const ac = onTop(16.9, -4.3); kPoint([ac[0], ac[1] - 0.1, ac[2]], [1.7, 0.7, 2.0], 0.32); }
    { const at = LM.scapula.acromion.tip, ap = onTop(at[0] + 0.3, at[2] - 0.2); kPoint([ap[0], ap[1] - 0.15, ap[2]], [0.7, 0.5, 0.9], -0.12); }
    // dorso: núcleos ancorados na superfície real (marcha a partir de −z), 0,25 cm para dentro
    const c7 = onBack(0, 4.0), t1 = onBack(0, 1.7);
    kPoint([0, 4.0, c7[2] + 0.25], [1.0, 0.85, 0.7], -0.6);                // vértebra proeminente (C7)
    kCurve([onBack(0, 10.5), onBack(0, 6.2)], 0.65, [0.16, 0.12]);        // sulco nucal mediano (termina acima de C7)
    kPoint([0, 1.7, t1[2] + 0.25], [0.8, 0.75, 0.7], -0.22);               // processo espinhoso de T1
    kCurve([0.6, -2, -10, -20, -27].map((y) => onBack(0, y)), [0.5, 0.65, 0.7, 0.7, 0.7], [0.0, 0.3, 0.32, 0.3, 0.28]); // sulco mediano do dorso
    kCurve([[5.4, 0.2, -16.9], [5.1, -4.5, -17.4], [6.0, -9.0, -17.4]], 0.8, 0.12); // depressão medial à borda medial da escápula
  }
  const nipple0 = onSkin(10.15, -11.65, 4); // aréola: 4º espaço intercostal, linha hemiclavicular
  kPoint(nipple0, [0.6, 0.6, 0.45], -0.06);
  const kernelSum = (ax, y, z) => {
    let s = 0;
    for (let i = 0; i < kernels.length; i++) { const k = kernels[i]; if (ax < k.lo[0] || ax > k.hi[0] || y < k.lo[1] || y > k.hi[1] || z < k.lo[2] || z > k.hi[2]) continue; s += k.f(ax, y, z); }
    return s;
  };
  const relief = (x, y, z) => baseField(x, y, z) + kernelSum(x < 0 ? -x : x, y, z);

  /* ---------- pinos: a pele passa pelos marcos de LM ---------- */
  // Só o ponto de entrada da agulha é pino. Incisura, ângulo esternal (LM côncavo), polegar e coracoide ficam a cargo
  // do relevo e da folga: pinos ali rasavam a fossa supraesternal, cavavam o ângulo e enchiam a fossa infraclavicular.
  const pins = [{ p: LM.needle.entrySkin, s: 1.5 }];
  {
    const n = pins.length, Mx = [], rhs = [];
    const K = (a, b, s) => Math.exp(-0.5 * ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) / (s * s));
    for (let i = 0; i < n; i++) { rhs.push(-relief(...pins[i].p)); Mx.push(pins.map((q) => K(pins[i].p, q.p, q.s))); }
    for (let c = 0; c < n; c++) { // eliminação gaussiana com pivoteamento
      let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(Mx[r][c]) > Math.abs(Mx[piv][c])) piv = r;
      [Mx[c], Mx[piv]] = [Mx[piv], Mx[c]]; [rhs[c], rhs[piv]] = [rhs[piv], rhs[c]];
      for (let r = 0; r < n; r++) if (r !== c) { const f = Mx[r][c] / Mx[c][c]; for (let k = c; k < n; k++) Mx[r][k] -= f * Mx[c][k]; rhs[r] -= f * rhs[c]; }
    }
    pins.forEach((q, i) => { q.amp = rhs[i] / Mx[i][i]; q.resid = -relief(...q.p); kPoint(q.p, q.s, q.amp); });
  }
  const field0 = (x, y, z) => baseField(x, y, z) + kernelSum(x < 0 ? -x : x, y, z);
  let pushAtRef = null; // definido após a verificação de folga
  const field = (x, y, z) => field0(x, y, z) - (pushAtRef ? pushAtRef(x, y, z) : 0);
  mark('design');

  /* ======================================================================
     3. GRADE HIERÁRQUICA EM BANDA (1,6 → 0,8 → 0,4 cm), meia grade x ≥ 0
     ====================================================================== */
  const h = 0.4, G0 = [0, -28.4, -21.6], G1 = [23.6, 14.0, 8.8];
  const fn = [0, 1, 2].map((a) => Math.round((G1[a] - G0[a]) / h) + 1); // 60 × 107 × 77
  const NYZ = fn[1] * fn[2], fine = new Float32Array(fn[0] * NYZ);
  const at = (i, j, k) => i * NYZ + j * fn[2] + k;
  let exact = 0;
  const ev = (i, j, k) => { exact++; return field0(i * h, G0[1] + j * h, G0[2] + k * h); };
  for (let i = 0; i < fn[0]; i += 4) for (let j = 0; j < fn[1]; j += 4) for (let k = 0; k < fn[2]; k += 4) fine[at(i, j, k)] = ev(i, j, k); // nível grosso
  const interp = (i, j, k, s) => { // trilinear a partir dos nós de passo s (já preenchidos)
    const i0 = i - (i % s), j0 = j - (j % s), k0 = k - (k % s);
    const i1 = Math.min(i0 + s, fn[0] - 1), j1 = Math.min(j0 + s, fn[1] - 1), k1 = Math.min(k0 + s, fn[2] - 1);
    const u = (i - i0) / s, v = (j - j0) / s, w = (k - k0) / s;
    const a0 = i0 * NYZ, a1 = i1 * NYZ, b0 = j0 * fn[2], b1 = j1 * fn[2];
    return ((fine[a0 + b0 + k0] * (1 - w) + fine[a0 + b0 + k1] * w) * (1 - v) + (fine[a0 + b1 + k0] * (1 - w) + fine[a0 + b1 + k1] * w) * v) * (1 - u) +
      ((fine[a1 + b0 + k0] * (1 - w) + fine[a1 + b0 + k1] * w) * (1 - v) + (fine[a1 + b1 + k0] * (1 - w) + fine[a1 + b1 + k1] * w) * v) * u;
  };
  for (let i = 0; i < fn[0]; i += 2) for (let j = 0; j < fn[1]; j += 2) for (let k = 0; k < fn[2]; k += 2) { // nível médio
    if (i % 4 === 0 && j % 4 === 0 && k % 4 === 0) continue;
    const d = interp(i, j, k, 4); fine[at(i, j, k)] = d > -2.9 && d < 1.8 ? ev(i, j, k) : d;
  }
  for (let i = 0; i < fn[0]; i++) for (let j = 0; j < fn[1]; j++) for (let k = 0; k < fn[2]; k++) { // nível fino (só junto à pele/derme)
    if (!(i & 1) && !(j & 1) && !(k & 1)) continue;
    const d = interp(i, j, k, 2); fine[at(i, j, k)] = d > -0.85 && d < 0.6 ? ev(i, j, k) : d;
  }
  mark('grid');
  const triF = (x, y, z) => { // trilinear no campo fino (simétrico em x)
    let fx = (x < 0 ? -x : x) / h, fy = (y - G0[1]) / h, fz = (z - G0[2]) / h;
    fx = clamp(fx, 0, fn[0] - 1.0001); fy = clamp(fy, 0, fn[1] - 1.0001); fz = clamp(fz, 0, fn[2] - 1.0001);
    const i = fx | 0, j = fy | 0, k = fz | 0, u = fx - i, v = fy - j, w = fz - k;
    const a = i * NYZ + j * fn[2] + k, b = a + NYZ, c2 = a + fn[2];
    const c00 = fine[a] * (1 - w) + fine[a + 1] * w, c01 = fine[c2] * (1 - w) + fine[c2 + 1] * w;
    const c10 = fine[b] * (1 - w) + fine[b + 1] * w, c11 = fine[b + fn[2]] * (1 - w) + fine[b + fn[2] + 1] * w;
    return (c00 * (1 - v) + c01 * v) * (1 - u) + (c10 * (1 - v) + c11 * v) * u;
  };
  const gradF = (x, y, z, out) => {
    out.set(triF(x + h, y, z) - triF(x - h, y, z), triF(x, y + h, z) - triF(x, y - h, z), triF(x, y, z + h) - triF(x, y, z - h));
    const l = out.length(); if (l > 1e-9) out.divideScalar(l); else out.set(0, 0, 1); return out;
  };

  /* ---------- recortes didáticos (abertos) ---------- */
  const armCut = { p: [17.84, -15.5, -3.86], n: new V3(0.3, -8, -0.2).normalize() };
  const neckCut = { p: [0, 11.3, 2.0], n: new V3(0, 1, 0.107).normalize() };
  const abdCut = -27;
  const beyondCuts = (x, y, z) => y < abdCut + 0.3 || (y - neckCut.p[1]) * neckCut.n.y + (z - neckCut.p[2]) * neckCut.n.z > -0.3 ||
    (Math.abs(x) > 14 && (Math.abs(x) - armCut.p[0]) * armCut.n.x + (y - armCut.p[1]) * armCut.n.y + (z - armCut.p[2]) * armCut.n.z > -0.3);

  /* ---------- folga mínima sobre as malhas já construídas (empurrão local, simétrico) ---------- */
  const clearance = { bones: 0.42, muscle: 0.3, vein: 0.3, artery: 0.55, nerve: 0.5, lymph: 0.4, lung: 0.8, pleura: 0.8, mediastinum: 0.8 };
  const pushReport = { tested: 0, violations: 0, maxViolation: 0, worst: null };
  // campo de empurrão na grade média (0,8 cm): máximo de gaussianas, interpolado trilinearmente
  const pn = [0, 1, 2].map((a) => Math.floor((fn[a] - 1) / 2) + 1), H2 = 2 * h, PNYZ = pn[1] * pn[2];
  const PM = new Float32Array(pn[0] * PNYZ);
  let pushOn = false;
  const pushAt = (x, y, z) => {
    let fx = (x < 0 ? -x : x) / H2, fy = (y - G0[1]) / H2, fz = (z - G0[2]) / H2;
    fx = clamp(fx, 0, pn[0] - 1.0001); fy = clamp(fy, 0, pn[1] - 1.0001); fz = clamp(fz, 0, pn[2] - 1.0001);
    const i = fx | 0, j = fy | 0, k = fz | 0, u = fx - i, v = fy - j, w = fz - k, a = i * PNYZ + j * pn[2] + k, b = a + PNYZ, c2 = a + pn[2];
    return ((PM[a] * (1 - w) + PM[a + 1] * w) * (1 - v) + (PM[c2] * (1 - w) + PM[c2 + 1] * w) * v) * (1 - u) +
      ((PM[b] * (1 - w) + PM[b + 1] * w) * (1 - v) + (PM[b + pn[2]] * (1 - w) + PM[b + pn[2] + 1] * w) * v) * u;
  };
  {
    const best = new Map(), v = new V3();
    for (const [ln, need] of Object.entries(clearance)) {
      const L = layers[ln]; if (!L) continue;
      L.traverse((o) => {
        if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
        const geo = o.geometry, pa = geo.attributes.position, step = pa.count > 6000 ? 6 : pa.count > 1500 ? 3 : pa.count > 400 ? 2 : 1;
        const M = invWorld.clone().multiply(o.matrixWorld), ident = M.equals(I4);
        // malha inteira profunda (esfera envolvente aproximada bem dentro da pele) → nada a verificar
        let cx = 0, cy = 0, cz = 0, n = 0; const sstr = Math.max(1, (pa.count / 64) | 0);
        for (let i = 0; i < pa.count; i += sstr) { cx += pa.getX(i); cy += pa.getY(i); cz += pa.getZ(i); n++; }
        const bc = new V3(cx / n, cy / n, cz / n); let br = 0;
        for (let i = 0; i < pa.count; i += sstr) br = Math.max(br, Math.hypot(pa.getX(i) - bc.x, pa.getY(i) - bc.y, pa.getZ(i) - bc.z));
        bc.applyMatrix4(M); br = br * M.getMaxScaleOnAxis() + 1.5;
        if (triF(bc.x, bc.y, bc.z) < -(br + need + 0.6)) return;
        for (let i = 0; i < pa.count; i += step) {
          v.fromBufferAttribute(pa, i); if (!ident) v.applyMatrix4(M);
          const d = triF(v.x, v.y, v.z) + need;
          pushReport.tested++;
          if (d <= 0.03 || beyondCuts(v.x, v.y, v.z)) continue;
          const ax = Math.abs(v.x), key = ((Math.round(ax) * 128 + Math.round(v.y) + 64) * 128) + Math.round(v.z) + 64; // células de 1 cm
          const b = best.get(key); if (!b || d > b[3]) best.set(key, [ax, v.y, v.z, d, ln]);
        }
      });
    }
    pushReport.list = [...best.values()].sort((a, b) => b[3] - a[3]).slice(0, 12).map((b) => [b[0], b[1], b[2], b[3], b[4]].map((q) => (typeof q === 'number' ? +q.toFixed(2) : q)));
    for (const b of best.values()) {
      pushReport.violations++;
      if (b[3] > pushReport.maxViolation) { pushReport.maxViolation = +b[3].toFixed(2); pushReport.worst = { at: b.slice(0, 3).map((q) => +q.toFixed(1)), layer: b[4] }; }
      const sg = 0.9 + Math.min(1.0, b[3]), amp = b[3] * 1.25 + 0.05, r = 3 * sg, is2 = 1 / (sg * sg);
      const i0 = Math.max(0, Math.floor((b[0] - r) / H2)), i1 = Math.min(pn[0] - 1, Math.ceil((b[0] + r) / H2));
      const j0 = Math.max(0, Math.floor((b[1] - r - G0[1]) / H2)), j1 = Math.min(pn[1] - 1, Math.ceil((b[1] + r - G0[1]) / H2));
      const k0 = Math.max(0, Math.floor((b[2] - r - G0[2]) / H2)), k1 = Math.min(pn[2] - 1, Math.ceil((b[2] + r - G0[2]) / H2));
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (let q = k0; q <= k1; q++) {
        const r2 = ((i * H2 - b[0]) ** 2 + (G0[1] + j * H2 - b[1]) ** 2 + (G0[2] + q * H2 - b[2]) ** 2) * is2; if (r2 > 9) continue;
        const val = amp * Math.exp(-0.5 * r2), id = i * PNYZ + j * pn[2] + q; if (val > PM[id]) PM[id] = val;
      }
      pushOn = true;
    }
    if (pushOn) { // suaviza o campo de empurrão (filtro 1-2-1 separável, 2 passes): evita facetas da interpolação trilinear
      const tmp = new Float32Array(PM.length), st = [PNYZ, pn[2], 1], nn = [pn[0], pn[1], pn[2]];
      for (let pass = 0; pass < 2; pass++) for (let ax3 = 0; ax3 < 3; ax3++) {
        const sd = st[ax3]; tmp.set(PM);
        for (let i = 0; i < pn[0]; i++) for (let j = 0; j < pn[1]; j++) for (let k = 0; k < pn[2]; k++) {
          const id = i * PNYZ + j * pn[2] + k, c = ax3 === 0 ? i : ax3 === 1 ? j : k;
          const a = c > 0 ? tmp[id - sd] : tmp[id], b2 = c < nn[ax3] - 1 ? tmp[id + sd] : tmp[id];
          PM[id] = (a + 2 * tmp[id] + b2) * 0.25;
        }
      }
    }
    if (pushOn) for (let i = 0; i < fn[0]; i++) for (let j = 0; j < fn[1]; j++) for (let k = 0; k < fn[2]; k++) {
      const id = at(i, j, k), fv = fine[id]; if (fv > 2.2 || fv < -2.8) continue;
      const p = pushAt(i * h, G0[1] + j * h, G0[2] + k * h); if (p > 1e-4) fine[id] = fv - p;
    }
  }
  if (pushOn) pushAtRef = pushAt;
  mark('push');

  // espessura da tela subcutânea (homem magro): fina no esterno/clavícula/pescoço, maior no abdome e dorso
  const fatT = (ax, y, z) => {
    let t = 0.5;
    t = lerp(t, 0.3, sstep(-6, -1, y) * sstep(3.5, 1.5, ax) * sstep(-3, 0, z));      // esterno/incisura
    t = lerp(t, 0.32, sstep(-0.5, 1.2, y) * sstep(3.5, -0.5, z) * sstep(1, 3, ax));   // clavícula / pescoço anterior
    t = lerp(t, 0.62, sstep(-15, -21, y) * sstep(-8, -3, z));                         // epigástrio
    t = lerp(t, 1.0, sstep(-21, -27, y) * sstep(-8, -3, z));                          // abdome
    t = lerp(t, 0.75, sstep(-10, -14, z) * sstep(3, -1, y));                          // dorso
    t = lerp(t, 0.42, sstep(15, 17.5, ax) * sstep(-1, -5, y));                        // braço
    return t;
  };

  // Na face anterior, a tela subcutânea não pode invadir o músculo: espessura ≤ (pele − músculo) − derme − 0,06.
  // Mapa 2D (grade FH) com a pele final (após a folga) e a superfície muscular dilatada (musD); calculado sob demanda.
  let fatLim = null, skinFZ = null;
  const prepFatLim = () => {
    fatLim = new Float32Array(NF).fill(5); skinFZ = new Float32Array(NF).fill(BIG);
    if (!musD) return;
    for (let j = 0; j < FH.ny; j++) for (let i = 0; i < FH.nx; i++) {
      const k = j * FH.nx + i, x = FH.x0 + i * FH.d, y = FH.y0 + j * FH.d;
      if (x < 0 || y < G0[1] + 0.5 || musD[k] < -BIG / 2) continue;
      let zs = FHt[k] + 1.2, v = triF(x, y, zs); // marcha curta de fora para dentro até a pele
      for (let it = 0; it < 40 && v > 0.003; it++) { zs -= Math.max(0.02, v * 0.9); v = triF(x, y, zs); }
      skinFZ[k] = zs;
      if (musD[k] > zs - 3) fatLim[k] = Math.max(0.1, zs - musD[k] - DERM - 0.06);
    }
    for (let j = 0; j < FH.ny; j++) for (let i = 0; i < FH.nx; i++) { // x < 0 da grade: espelho (campo simétrico)
      const x = FH.x0 + i * FH.d; if (x >= 0) continue;
      const i2 = Math.round((-x - FH.x0) / FH.d), k = j * FH.nx + i, k2 = j * FH.nx + i2; fatLim[k] = fatLim[k2]; skinFZ[k] = skinFZ[k2];
    }
  };
  const fatTL = (ax, y, z) => {
    const t = fatT(ax, y, z);
    if (!fatLim || y <= FH.y0 || y >= FH.y1 || ax >= FH.x1) return t;
    const fx = clamp((ax - FH.x0) / FH.d, 0, FH.nx - 1.001), fy = clamp((y - FH.y0) / FH.d, 0, FH.ny - 1.001);
    const zs = bil(skinFZ, fx, fy); if (z < zs - 2.6) return t;   // só junto à face anterior
    const L = bil(fatLim, fx, fy);
    return L < t ? Math.max(0.1, L) : t;
  };

  /* ======================================================================
     4. SURFACE NETS sobre a grade espelhada em x
     ====================================================================== */
  const CO = [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1];
  const ED = [0, 1, 2, 3, 4, 5, 6, 7, 0, 2, 1, 3, 4, 6, 5, 7, 0, 4, 1, 5, 2, 6, 3, 7];
  /** stride: passo em nós finos; off(I,j,k) = deslocamento de isovalor (iso = −off);
      boxes opcional [{x0,x1,y0,y1}] (cm) restringe a região (bordas abertas internas, invisíveis). */
  function surfaceNets(stride, off, boxes) {
    const NI = Math.floor((fn[0] - 1) / stride), NJ = Math.floor((fn[1] - 1) / stride), NK = Math.floor((fn[2] - 1) / stride);
    const nx = 2 * NI + 1, ny = NJ + 1, nz = NK + 1, sh = h * stride, nyz = ny * nz;
    const vals = new Float32Array(nx * nyz);
    // caixas em índices de célula; nós preenchidos só dentro delas
    const BX = (boxes || [{ x0: -1e3, x1: 1e3, y0: -1e3, y1: 1e3 }]).map((b) => [clamp(Math.floor(b.x0 / sh) + NI, 0, nx - 1), clamp(Math.ceil(b.x1 / sh) + NI, 0, nx - 1), clamp(Math.floor((b.y0 - G0[1]) / sh), 0, ny - 1), clamp(Math.ceil((b.y1 - G0[1]) / sh), 0, ny - 1)]);
    const inBox = (a, j) => { for (const b of BX) if (a >= b[0] && a <= b[1] && j >= b[2] && j <= b[3]) return true; return false; };
    let A0 = nx, A1 = 0, J0 = ny, J1 = 0; for (const b of BX) { A0 = Math.min(A0, b[0]); A1 = Math.max(A1, b[1]); J0 = Math.min(J0, b[2]); J1 = Math.max(J1, b[3]); }
    if (stride === 1 && !off && !boxes) for (let a = 0; a < nx; a++) { const I = Math.abs(a - NI); vals.set(fine.subarray(I * NYZ, (I + 1) * NYZ), a * nyz); }
    else for (let a = A0; a <= A1; a++) {
      const I = Math.abs(a - NI) * stride;
      for (let j = J0; j <= J1; j++) {
        if (!inBox(a, j)) continue;
        for (let k = 0; k < nz; k++) { // longe da casca (iso = −off ∈ [−1,4; −0,2]) o deslocamento exato não muda o sinal
          const fv = fine[at(I, j * stride, k * stride)];
          vals[a * nyz + j * nz + k] = fv + (off ? (fv > 1.0 || fv < -2.4 ? 0.6 : off((a - NI) * stride, j * stride, k * stride)) : 0);
        }
      }
    }
    const cellV = new Int32Array(nx * nyz).fill(-1), pos = [], idx = [], g = new Float32Array(8), cof = new Int32Array(8);
    for (let c = 0; c < 8; c++) cof[c] = CO[3 * c] * nyz + CO[3 * c + 1] * nz + CO[3 * c + 2];
    const skip = 1.5; // |valor| no canto 0 acima disso → célula sem cruzamento (campo ~Lipschitz, verificado sem furos)
    for (let a = A0; a < A1; a++) for (let j = J0; j < J1; j++) {
      if (boxes && !(inBox(a, j) && inBox(a + 1, j + 1))) continue;
      for (let k = 0; k < nz - 1; k++) {
      const base = a * nyz + j * nz + k, v0 = vals[base];
      if (v0 > skip || v0 < -skip) continue;
      let mask = 0;
      for (let c = 0; c < 8; c++) { const v = vals[base + cof[c]]; g[c] = v; if (v < 0) mask |= 1 << c; }
      if (mask === 0 || mask === 255) continue;
      let sx = 0, sy = 0, sz = 0, cnt = 0;
      for (let e = 0; e < 24; e += 2) {
        const p = ED[e], q = ED[e + 1], gp = g[p], gq = g[q]; if ((gp < 0) === (gq < 0)) continue;
        const t = gp / (gp - gq);
        sx += CO[3 * p] + (CO[3 * q] - CO[3 * p]) * t; sy += CO[3 * p + 1] + (CO[3 * q + 1] - CO[3 * p + 1]) * t; sz += CO[3 * p + 2] + (CO[3 * q + 2] - CO[3 * p + 2]) * t; cnt++;
      }
      const vid = pos.length / 3; cellV[base] = vid;
      pos.push((a - NI + sx / cnt) * sh, G0[1] + (j + sy / cnt) * sh, G0[2] + (k + sz / cnt) * sh);
      const in0 = (mask & 1) !== 0;
      if (((mask >> 1) & 1) !== (mask & 1) && j > J0 && k > 0) { const A = cellV[base], B = cellV[base - nz], Cc = cellV[base - nz - 1], D = cellV[base - 1]; if (in0) idx.push(A, B, Cc, A, Cc, D); else idx.push(A, D, Cc, A, Cc, B); }
      if (((mask >> 2) & 1) !== (mask & 1) && a > A0 && k > 0) { const A = cellV[base], B = cellV[base - nyz], Cc = cellV[base - nyz - 1], D = cellV[base - 1]; if (in0) idx.push(A, D, Cc, A, Cc, B); else idx.push(A, B, Cc, A, Cc, D); }
      if (((mask >> 4) & 1) !== (mask & 1) && a > A0 && j > J0) { const A = cellV[base], B = cellV[base - nyz], Cc = cellV[base - nyz - nz], D = cellV[base - nz]; if (in0) idx.push(A, B, Cc, A, Cc, D); else idx.push(A, D, Cc, A, Cc, B); }
      }
    }
    const out = [];
    for (let i = 0; i < idx.length; i += 3) if (idx[i] >= 0 && idx[i + 1] >= 0 && idx[i + 2] >= 0) out.push(idx[i], idx[i + 1], idx[i + 2]);
    return { pos, idx: out };
  }
  const tmpN = new V3();
  /** projeta os vértices na isossuperfície (triF + off = 0) e calcula as normais pelo gradiente */
  function finishSurface(sn, off) {
    const { pos } = sn, n = pos.length / 3, nrm = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      let x = pos[3 * i], y = pos[3 * i + 1], z = pos[3 * i + 2];
      const gv = triF(x, y, z) + (off ? off(x, y, z) : 0);
      gradF(x, y, z, tmpN);
      const st = clamp(gv, -0.25, 0.25); x -= tmpN.x * st; y -= tmpN.y * st; z -= tmpN.z * st;
      pos[3 * i] = x; pos[3 * i + 1] = y; pos[3 * i + 2] = z; nrm[3 * i] = tmpN.x; nrm[3 * i + 1] = tmpN.y; nrm[3 * i + 2] = tmpN.z;
    }
    sn.nrm = nrm; return sn;
  }
  const DERM = 0.2;
  const SOUT = finishSurface(surfaceNets(1, null));
  mark('nets');
  prepFatLim();
  mark('fatlim');


  /* ======================================================================
     5. RECORTES ABERTOS + atributos (uv, cor)
     ====================================================================== */
  // pertence ao braço se estiver mais "dentro" (ou mais perto) da varredura do braço do que do loft do tronco
  // (margin > 0: critério mais inclusivo, usado nas cascas internas — na zona de contato braço–tórax a casca interna
  // não pode sobrar como uma "aba" dentro da abertura do recorte)
  const isArm = (ax, y, z, margin = -0.05) => ax > 13.5 && y < -11 && armSweep(ax, y, z) < baseField(ax, y, z, true) + margin;
  const cutVal = (x, y, z, margin) => { // > 0 → remover
    let s = abdCut - y;
    const sn = (y - neckCut.p[1]) * neckCut.n.y + (z - neckCut.p[2]) * neckCut.n.z; if (sn > s) s = sn;
    const ax = Math.abs(x);
    if (ax > 13.5 && y < -11) {
      const sa = (ax - armCut.p[0]) * armCut.n.x + (y - armCut.p[1]) * armCut.n.y + (z - armCut.p[2]) * armCut.n.z;
      // cascas internas (margin definido): todo o tecido além do plano do braço, lateral a x=14,4, é removido — inclusive
      // na zona de contato braço–tórax (onde a pele externa é ambígua); o que sobra fica oculto dentro do tórax
      if (sa > -1.2 && sa > s && (margin !== undefined ? ax > 14.4 : isArm(ax, y, z))) s = sa;
    }
    return s;
  };
  /** Recorta triângulos contra s(v) ≤ 0, interpolando posição, normal e atributos extras (aw por vértice). */
  function clipMesh(P, N, A, aw, idx, sval) {
    const I = [], poly = [0, 0, 0, 0], tv = [0, 0, 0], ts = [0, 0, 0];
    const mix = (a, b, t) => {
      const id = P.length / 3;
      P.push(P[3 * a] + (P[3 * b] - P[3 * a]) * t, P[3 * a + 1] + (P[3 * b + 1] - P[3 * a + 1]) * t, P[3 * a + 2] + (P[3 * b + 2] - P[3 * a + 2]) * t);
      const nx = N[3 * a] + (N[3 * b] - N[3 * a]) * t, ny = N[3 * a + 1] + (N[3 * b + 1] - N[3 * a + 1]) * t, nz = N[3 * a + 2] + (N[3 * b + 2] - N[3 * a + 2]) * t;
      const l = Math.hypot(nx, ny, nz) || 1; N.push(nx / l, ny / l, nz / l);
      for (let c = 0; c < aw; c++) A.push(A[aw * a + c] + (A[aw * b + c] - A[aw * a + c]) * t);
      return id;
    };
    for (let f = 0; f < idx.length; f += 3) {
      const i0 = idx[f], i1 = idx[f + 1], i2 = idx[f + 2], s0 = sval[i0], s1 = sval[i1], s2 = sval[i2];
      if (s0 <= 0 && s1 <= 0 && s2 <= 0) { I.push(i0, i1, i2); continue; }
      if (s0 > 0 && s1 > 0 && s2 > 0) continue;
      let np = 0; tv[0] = i0; tv[1] = i1; tv[2] = i2; ts[0] = s0; ts[1] = s1; ts[2] = s2;
      for (let e = 0; e < 3; e++) {
        const a = tv[e], b = tv[(e + 1) % 3], sa = ts[e], sb = ts[(e + 1) % 3];
        if (sa <= 0) poly[np++] = a;
        if ((sa <= 0) !== (sb <= 0)) poly[np++] = mix(a, b, sa / (sa - sb));
      }
      for (let q = 1; q + 1 < np; q++) I.push(poly[0], poly[q], poly[q + 1]);
    }
    return I;
  }
  // cores por vértice (multiplicadores): aréolas, tom dorsal/ombros, face medial do braço, jugular externa visível
  const ejvPts = C.sample(LM.vessels.ejvR.pts, 30);
  const distPolyline = (pts, x, y, z) => { let best = 1e9; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2]; let t = ((x - a[0]) * dx + (y - a[1]) * dy + (z - a[2]) * dz) / (dx * dx + dy * dy + dz * dz); t = clamp(t, 0, 1); const qx = x - a[0] - t * dx, qy = y - a[1] - t * dy, qz = z - a[2] - t * dz; best = Math.min(best, qx * qx + qy * qy + qz * qz); } return Math.sqrt(best); };
  const skinTint = (x, y, z, out, o) => {
    const ax = Math.abs(x); let r = 1, g = 1, b = 1;
    const da = Math.hypot(ax - nipple0[0], y - nipple0[1], (z - nipple0[2]) * 0.7), ar = 1 - sstep(1.05, 1.45, da); // aréola
    if (ar > 0) { r = lerp(r, 0.66, ar); g = lerp(g, 0.47, ar); b = lerp(b, 0.43, ar); }
    const back = sstep(-9, -14, z) * 0.06 + sstep(2.5, 6, y) * sstep(-3, -7, z) * 0.04; r -= back; g -= back * 1.15; b -= back * 1.2;
    const inner = sstep(15.8, 15.2, ax) * sstep(13, 15, ax) * sstep(-5, -9, y) * 0.04; r += inner; g += inner; b += inner;
    const fl = Math.exp(-((ax / 4) ** 2) - (((y - 2) / 5) ** 2)) * sstep(-2, 0.5, z) * 0.05; g -= fl; b -= fl * 0.8;
    if (ax > 3.5 && ax < 8 && y > 0.3 && y < 11.6 && z > -2) { const de = distPolyline(ejvPts, ax, y, z) - 0.55; const vv = (1 - sstep(0.1, 0.55, de)) * 0.08; r -= vv; g -= vv * 0.6; b += vv * 0.15; }
    out[o] = r; out[o + 1] = g; out[o + 2] = b;
  };
  function buildShell(sn, withColor) {
    const n = sn.pos.length / 3, aw = withColor ? 5 : 2, A = new Array(n * aw), sval = new Float32Array(n), P = sn.pos, N = Array.from(sn.nrm);
    for (let i = 0; i < n; i++) {
      const x = P[3 * i], y = P[3 * i + 1], z = P[3 * i + 2];
      sval[i] = withColor ? cutVal(x, y, z) : cutVal(x, y, z, 0.7);
      // cascas internas (grade de 0,8 cm) podem formar "pontes" em fendas estreitas (braço–tórax): descarta o que sair da pele
      if (!withColor) sval[i] = Math.max(sval[i], triF(x, y, z) + 0.08);
      A[aw * i] = (Math.atan2(x, z + 6.5) * 15) / 6; A[aw * i + 1] = y / 6; // uv cilíndrico (costura na linha média dorsal)
      if (withColor) skinTint(x, y, z, A, aw * i + 2);
    }
    const I = clipMesh(P, N, A, aw, sn.idx, sval);
    const m = P.length / 3, uv = new Float32Array(2 * m), col = withColor ? new Float32Array(3 * m) : null;
    for (let i = 0; i < m; i++) { uv[2 * i] = A[aw * i]; uv[2 * i + 1] = A[aw * i + 1]; if (col) { col[3 * i] = A[aw * i + 2]; col[3 * i + 1] = A[aw * i + 3]; col[3 * i + 2] = A[aw * i + 4]; } }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    if (col) g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(I); g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }

  /* ======================================================================
     6. MATERIAIS E MALHAS DA PELE
     ====================================================================== */
  const pores = C.tex.noiseNormal('fine', { freq: 0.16, strength: 1.6, seed: 8 }); // já em cache (core)
  const matSkin = C.mat({ color: '#c99172', roughness: 0.5, sheen: 0.35, sheenRoughness: 0.6, sheenColor: '#ffd9c4', clearcoat: 0.08, clearcoatRoughness: 0.6,
    normalMap: pores, normalScale: new THREE.Vector2(0.16, 0.16), vertexColors: true, cut: 0xe2b49b });
  const matDerm = C.mat({ color: '#e7bfa6', roughness: 0.6, cut: 0xefd08a });
  const matFat = C.mat({ color: '#efd08a', roughness: 0.55, sheen: 0.3, normalMap: C.tex.noiseNormal('nz', { freq: 0.05, strength: 2.5 }), normalScale: new THREE.Vector2(0.35, 0.35), cut: 0x9b5a4c });
  const G = (k) => ({ group: 'Pele e superfície', ...k });
  const infoSkin = G({ id: 'skin', name: 'Pele', desc: 'Envelope cutâneo do pescoço, tórax e ombros. Marcos palpáveis (incisura jugular, clavícula, fossa infraclavicular, sulco deltopeitoral) orientam a punção por referências de superfície.' });
  const infoSub = G({ id: 'subcutaneous', name: 'Tela subcutânea (hipoderme)', desc: 'Gordura e tecido conjuntivo frouxo entre a derme e a fáscia profunda; sua espessura varia e altera a distância pele–veia.' });
  const infoDerm = G({ id: 'dermis', name: 'Derme', desc: 'Camada conjuntiva densa da pele, logo abaixo da epiderme; é a primeira resistência sentida ao introduzir a agulha.' });
  const infoDeep = G({ id: 'section-deep', name: 'Plano profundo (secção)', desc: 'Superfície de corte didática dos tecidos profundos (músculos, vísceras) no limite inferior do modelo.' });
  /** junta geometrias indexadas com os mesmos atributos */
  const mergeGeos = (gs) => {
    const names = Object.keys(gs[0].attributes), out = new THREE.BufferGeometry(), idx = []; let off = 0;
    for (const nm of names) {
      const it = gs[0].attributes[nm].itemSize, tot = gs.reduce((q, g) => q + g.attributes[nm].array.length, 0), arr = new Float32Array(tot); let o = 0;
      for (const g of gs) { arr.set(g.attributes[nm].array, o); o += g.attributes[nm].array.length; }
      out.setAttribute(nm, new THREE.BufferAttribute(arr, it));
    }
    for (const g of gs) { const ix = g.index.array; for (let i = 0; i < ix.length; i++) idx.push(ix[i] + off); off += g.attributes.position.count; }
    out.setIndex(idx); out.computeBoundingSphere(); out.computeBoundingBox(); return out;
  };
  // poros: normal map triplanar em espaço do objeto (o UV cilíndrico degenerava no topo dos ombros e esticava nos braços)
  {
    const prev = matSkin.onBeforeCompile, prevKey = matSkin.customProgramCacheKey;
    matSkin.onBeforeCompile = (sh, r) => {
      if (prev) prev(sh, r);
      sh.uniforms.triScale = { value: 1 / 6 };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTriP;\nvarying vec3 vTriN;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTriP = position; vTriN = normal;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vTriP;\nvarying vec3 vTriN;\nuniform float triScale;\nuniform mat3 normalMatrix;')
        .replace('#include <normal_fragment_maps>', [
          '#ifdef USE_NORMALMAP_TANGENTSPACE',
          '{ vec3 on = normalize(vTriN); vec3 bw = pow(abs(on), vec3(4.0)); bw /= (bw.x + bw.y + bw.z + 1e-5);',
          '  vec3 tp = vTriP * triScale;',
          '  vec2 tx = (texture2D(normalMap, tp.zy).xy * 2.0 - 1.0) * normalScale;',
          '  vec2 ty = (texture2D(normalMap, tp.xz).xy * 2.0 - 1.0) * normalScale;',
          '  vec2 tz = (texture2D(normalMap, tp.xy).xy * 2.0 - 1.0) * normalScale;',
          '  vec3 dn = bw.x * vec3(0.0, tx.y, tx.x) + bw.y * vec3(ty.x, 0.0, ty.y) + bw.z * vec3(tz.x, tz.y, 0.0);',
          '  normal = normalize(normalMatrix * normalize(on + dn)) * faceDirection; }',
          '#else', '#include <normal_fragment_maps>', '#endif'].join('\n'));
    };
    matSkin.customProgramCacheKey = () => (prevKey ? prevKey.call(matSkin) : '') + '|tri';
  }
  const skinGeo = buildShell(SOUT, true);
  const skin = C.mesh(skinGeo, matSkin, layers.skin, infoSkin);
  // cascas internas (limite derme/hipoderme e fáscia profunda): só aparecem com plano de corte ativo,
  // então são construídas sob demanda no primeiro corte (economiza ~150 ms na carga).
  let derm = null, subq = null;
  const fatOff = (x, y, z) => DERM + fatTL(Math.abs(x), y, z);
  const offD = () => DERM, offF = (I, j, k) => fatOff(I * h, G0[1] + j * h, G0[2] + k * h);
  // grade fina (0,4 cm) numa caixa em torno do plano da agulha/região infraclavicular D; 0,8 cm no restante
  // (as caixas se sobrepõem 0,8 cm: a emenda fica dentro do tecido)
  const FINE_BOX = [{ x0: 2.0, x1: 17.6, y0: -13.0, y1: 9.0 }];
  const COARSE_BOXES = [{ x0: -24, x1: 2.8, y0: -1e3, y1: 1e3 }, { x0: 16.8, x1: 24, y0: -1e3, y1: 1e3 }, { x0: 2.0, x1: 17.6, y0: -1e3, y1: -12.2 }, { x0: 2.0, x1: 17.6, y0: 8.2, y1: 1e3 }];
  const shellGeo = (off, offFn) => {
    const a = buildShell(finishSurface(surfaceNets(1, off, FINE_BOX), offFn), false), b = buildShell(finishSurface(surfaceNets(2, off, COARSE_BOXES), offFn), false);
    const g = mergeGeos([a, b]); a.dispose(); b.dispose(); return g;
  };
  const buildInner = () => {
    derm = C.mesh(shellGeo(offD, offD), matDerm, layers.skin, infoDerm, { cast: false, receive: false });
    subq = C.mesh(shellGeo(offF, fatOff), matFat, layers.skin, infoSub, { cast: false, receive: false });
  };
  // "aros" das cascas internas junto aos recortes abertos (sempre presentes, baratos): a borda do pescoço,
  // dos braços e do abdome mostra pele → gordura → plano profundo, como numa peça seccionada.
  // pescoço: o aro desce até y≈3,5 (a terminação fica escondida atrás das clavículas/trapézio quando se olha pela abertura)
  const rimBoxes = [{ x0: -24, x1: 24, y0: 3.4, y1: 14.4 }, { x0: -24, x1: 24, y0: -28.4, y1: -24.4 }];
  const armBoxes = [{ x0: 12.4, x1: 24, y0: -17.8, y1: -13.0 }, { x0: -24, x1: -12.4, y0: -17.8, y1: -13.0 }]; // braços: grade fina (anéis completos)
  const rimGeo = (off, offFn) => {
    const a = buildShell(finishSurface(surfaceNets(2, off, rimBoxes), offFn), false), b = buildShell(finishSurface(surfaceNets(1, off, armBoxes), offFn), false);
    const g = mergeGeos([a, b]); a.dispose(); b.dispose(); return g;
  };
  const rimD = C.mesh(rimGeo(offD, offD), matDerm, layers.skin, infoDerm, { cast: false, receive: false });
  const rimF = C.mesh(rimGeo(offF, fatOff), matFat, layers.skin, infoSub, { cast: false, receive: false });
  // tampas profundas (plano horizontal y = yc, contorno = limite interno da gordura): (1) no corte abdominal (y = −27),
  // completa os anéis pele → gordura → plano profundo vistos de baixo; (2) no estreito superior do tórax (y ≈ 3,6), logo
  // acima do fim dos aros do pescoço: vista de cima, a abertura do pescoço mostra as estruturas cervicais sobre um
  // "fundo" de tecido profundo, e não o interior oco do tronco (oculta com plano de corte ativo)
  const mCap = new THREE.MeshBasicMaterial({ color: '#8f5246', side: THREE.DoubleSide }); mCap.clippingPlanes = C.clipPlanes;
  const deepCap = (yc, cz) => {
    const pts = [];
    for (let i = 0; i < 96; i++) {
      const th = (i / 96) * Math.PI * 2, dx = Math.sin(th), dz = Math.cos(th);
      let r = 0.5; while (r < 25 && triF(dx * r, yc, cz + dz * r) < -fatOff(dx * r, yc, cz + dz * r) - 0.05) r += 0.1;
      pts.push(new THREE.Vector2(dx * (r - 0.05), cz + dz * (r - 0.05)));
    }
    const g = new THREE.ShapeGeometry(new THREE.Shape(pts));
    g.rotateX(Math.PI / 2); g.translate(0, yc, 0); // forma no plano xz (y fixo)
    return C.mesh(g, mCap, layers.skin, infoDeep, { cast: false, receive: false });
  };
  deepCap(abdCut + 0.03, -6.5);
  const inletCap = deepCap(3.6, -7.6);
  mark('shells');

  /* ---------- papilas mamárias ---------- */
  {
    const prof = [[0, 0.0], [0.34, 0.0], [0.33, 0.12], [0.3, 0.22], [0.22, 0.29], [0.1, 0.32], [0, 0.325]].map((p) => new THREE.Vector2(p[0], p[1] - 0.05));
    const lg = new THREE.LatheGeometry(prof, 20);
    const nrm = gradF(nipple0[0], nipple0[1], nipple0[2], new V3());
    const p0 = new V3(...nipple0); for (let i = 0; i < 3; i++) { const d = triF(p0.x, p0.y, p0.z); p0.addScaledVector(nrm, -d); }
    lg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), nrm)); lg.translate(p0.x, p0.y, p0.z);
    const matN = C.mat({ color: '#9a6252', roughness: 0.55, sheen: 0.3, sheenColor: '#ffc8b4', cut: 0xe2b49b });
    const dsc = 'No homem, situa-se em geral no 4º espaço intercostal, na linha hemiclavicular — referência de superfície variável.';
    const mr = C.mesh(lg, matN, layers.skin, G({ id: 'nipple-R', name: 'Papila mamária direita (mamilo)', desc: dsc }));
    C.mirrorMesh(mr, layers.skin, G({ id: 'nipple-L', name: 'Papila mamária esquerda (mamilo)', desc: dsc }));
  }

  /* ======================================================================
     7. CAMPO ESTÉRIL FENESTRADO + ANTISSEPSIA (camada drape)
     ====================================================================== */
  // construído sob demanda quando a camada 'drape' fica visível pela primeira vez (grupos já registrados)
  const infoDrape = G({ id: 'drape', name: 'Campo estéril fenestrado', desc: 'Barreira estéril máxima com janela sobre a incisura jugular, o terço medial da clavícula direita e a região infraclavicular direita.' });
  const infoPrep = G({ id: 'skin-prep', name: 'Área de antissepsia (clorexidina)', desc: 'Antissepsia ampla da pele antes da colocação do campo: do pescoço ao tórax anterior e ombro direito.' });
  const drapeGrp = new THREE.Group(), prepGrp = new THREE.Group(); drapeGrp.name = 'Campo estéril'; prepGrp.name = 'Antissepsia';
  layers.drape.add(drapeGrp, prepGrp); C.reg(drapeGrp, infoDrape); C.reg(prepGrp, infoPrep);
  let drapeBuilt = false;
  function buildDrape() {
    drapeBuilt = true;
    // altura da pele vista de frente (z máximo) numa grade 2D, a partir dos vértices da pele
    const DG = { x0: -27, x1: 27, y0: -26.6, y1: 10.6, d: 0.45 };
    DG.nx = Math.round((DG.x1 - DG.x0) / DG.d) + 1; DG.ny = Math.round((DG.y1 - DG.y0) / DG.d) + 1;
    const skinZ = new Float64Array(DG.nx * DG.ny).fill(-BIG);
    {
      const pa = skinGeo.attributes.position, na = skinGeo.attributes.normal;
      for (let i = 0; i < pa.count; i++) {
        if (na.getZ(i) < -0.35) continue;
        const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
        const ci = Math.round((x - DG.x0) / DG.d), cj = Math.round((y - DG.y0) / DG.d);
        if (ci < 0 || cj < 0 || ci >= DG.nx || cj >= DG.ny) continue;
        const k = cj * DG.nx + ci; if (z > skinZ[k]) skinZ[k] = z;
      }
    }
    const win = { cx: 4.9, cy: -0.3, hx: 7.0, hy: 4.3, r: 2.0 }; // janela ~14 × 9,4 cm: incisura (com margem), ⅓ medial da clavícula D e região infraclavicular D
    const winD = (x, y) => { const qx = Math.abs(x - win.cx) - (win.hx - win.r), qy = Math.abs(y - win.cy) - (win.hy - win.r); return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - win.r; };
    // os braços estão seccionados em y≈−15,5: para o pano, prolonga-se cada coluna do braço para baixo
    // (o campo real cobre o braço inteiro; evita um "degrau" artificial na altura do corte)
    const jArm = Math.round((-14.6 - DG.y0) / DG.d);
    for (let i = 0; i < DG.nx; i++) { const x = DG.x0 + i * DG.d; if (Math.abs(x) < 15.6) continue; const zt = skinZ[jArm * DG.nx + i]; if (zt < -BIG / 2) continue; for (let j = 0; j < jArm; j++) skinZ[j * DG.nx + i] = Math.max(skinZ[j * DG.nx + i], zt); }
    // pano relativamente rígido apoiado sobre a pele (dilatação parabólica: atravessa depressões e cai nas bordas)
    const drapeFloor = -9.5;
    const near = dilate2D(skinZ.map((z) => (z > -BIG / 2 ? z + 0.25 : -BIG)), DG.nx, DG.ny, DG.d, 1.6, 3); // junto à janela: segue a pele, mas transpõe fossas estreitas
    let sheet = dilate2D(skinZ.map((z) => (z > -BIG / 2 ? z + 0.3 : -BIG)), DG.nx, DG.ny, DG.d, 7, 10);
    for (let k = 0; k < sheet.length; k++) sheet[k] = Math.max(sheet[k], drapeFloor - 2.5);
    sheet = blur2D(sheet, DG.nx, DG.ny, 2);
    for (let j = 0; j < DG.ny; j++) for (let i = 0; i < DG.nx; i++) {
      const k = j * DG.nx + i, x = DG.x0 + i * DG.d, y = DG.y0 + j * DG.d;
      if (skinZ[k] < -BIG / 2) continue;
      // junto à janela o campo adere à pele (borda adesiva) e nunca a atravessa
      const w = 1 - sstep(0.6, 2.2, winD(x, y));
      sheet[k] = Math.max(lerp(sheet[k], near[k], w), skinZ[k] + 0.22);
    }
    {
      const P = [], I = [], COL = [], UV = [], vid = new Int32Array(DG.nx * DG.ny).fill(-1), sval = [];
      const nz = C.noise3;
      for (let j = 0; j < DG.ny; j++) for (let i = 0; i < DG.nx; i++) {
        const k = j * DG.nx + i; const x = DG.x0 + i * DG.d, y = DG.y0 + j * DG.d; let z = sheet[k];
        const drop = skinZ[k] > -BIG / 2 ? Math.max(0, skinZ[k] + 0.3 - z) : 3;
        const free = sstep(0.2, 3, drop + (skinZ[k] < -BIG / 2 ? 2 : 0));
        // pregas: suaves sobre o corpo, mais marcadas onde o pano cai (lateral/cranial)
        const fold = 0.12 * (nz(x * 0.32, y * 0.32, 1.7, 3) - 0.5) + free * 0.7 * Math.sin(y * 0.9 + 2.4 * nz(x * 0.12, y * 0.2, 3.1, 9)) * (Math.abs(x) > 12 ? 1 : 0.3);
        z += fold * sstep(0.3, 2.5, winD(x, y));
        vid[k] = P.length / 3; P.push(x, y, z); UV.push(x / 3, y / 3);
        // borda adesiva clara ao redor da fenestra
        const wd = winD(x, y), ring = 1 - sstep(0.75, 1.5, wd);
        COL.push(lerp(1, 1.9, ring), lerp(1, 1.55, ring), lerp(1, 1.25, ring));
        sval.push(Math.max(-wd, drapeFloor - z));
      }
      for (let j = 0; j < DG.ny - 1; j++) for (let i = 0; i < DG.nx - 1; i++) {
        const a = vid[j * DG.nx + i], b = vid[j * DG.nx + i + 1], c = vid[(j + 1) * DG.nx + i + 1], d = vid[(j + 1) * DG.nx + i];
        if (a < 0 || b < 0 || c < 0 || d < 0) continue;
        I.push(a, b, c, a, c, d);
      }
      // normais provisórias para o recorte
      const g0 = new THREE.BufferGeometry(); g0.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g0.setIndex(I); g0.computeVertexNormals();
      const N = Array.from(g0.attributes.normal.array);
      const A = []; for (let i = 0; i < P.length / 3; i++) A.push(UV[2 * i], UV[2 * i + 1], COL[3 * i], COL[3 * i + 1], COL[3 * i + 2]);
      const Ix = clipMesh(P, N, A, 5, I, sval);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      const m = P.length / 3, uv = new Float32Array(2 * m), col = new Float32Array(3 * m);
      for (let i = 0; i < m; i++) { uv[2 * i] = A[5 * i]; uv[2 * i + 1] = A[5 * i + 1]; col[3 * i] = A[5 * i + 2]; col[3 * i + 1] = A[5 * i + 3]; col[3 * i + 2] = A[5 * i + 4]; }
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.setIndex(Ix); g.computeVertexNormals();
      const matDrape = C.mat({ color: '#3d77ad', roughness: 0.86, sheen: 0.7, sheenRoughness: 0.5, sheenColor: '#bcd8f2', side: THREE.DoubleSide, vertexColors: true,
        normalMap: pores, normalScale: new THREE.Vector2(0.3, 0.3) });
      C.mesh(g, matDrape, drapeGrp, infoDrape);
    }
    // antissepsia (clorexidina alcoólica tingida): decalque translúcido levemente acima da pele
    {
      const reg = { x0: -4.5, x1: 17.5, y0: -12.5, y1: 9.5 };
      const blob = (x, y) => { // distância (negativa dentro) de uma área ampla com borda irregular
        const cx = 6.2, cy = -1.2, rx = 10.2, ry = 9.6;
        const q = Math.hypot((x - cx) / rx, (y - cy) / ry) - 1;
        return q * 9 + 2.2 * (C.noise3(x * 0.35, y * 0.35, 0.5, 77) - 0.5) + 0.9 * (C.noise3(x * 0.9, y * 0.9, 1.5, 78) - 0.5);
      };
      const pa = skinGeo.attributes.position, na = skinGeo.attributes.normal, ix = skinGeo.index.array;
      const P = [], UV = [], I = [], map = new Map();
      const add = (i) => { if (map.has(i)) return map.get(i); const id = P.length / 3; const o = 0.04; P.push(pa.getX(i) + na.getX(i) * o, pa.getY(i) + na.getY(i) * o, pa.getZ(i) + na.getZ(i) * o); UV.push((pa.getX(i) - reg.x0) / (reg.x1 - reg.x0), (pa.getY(i) - reg.y0) / (reg.y1 - reg.y0)); map.set(i, id); return id; };
      const inReg = new Int8Array(pa.count); // 1 dentro, −1 fora (calculado uma vez por vértice)
      for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i); inReg[i] = x < reg.x0 || x > reg.x1 || y < reg.y0 || y > reg.y1 || na.getZ(i) < -0.2 || blob(x, y) > 1.5 ? -1 : 1; }
      for (let f = 0; f < ix.length; f += 3) {
        const ok = inReg[ix[f]] > 0 && inReg[ix[f + 1]] > 0 && inReg[ix[f + 2]] > 0;
        if (ok) I.push(add(ix[f]), add(ix[f + 1]), add(ix[f + 2]));
      }
      // textura: alfa com borda irregular e estrias concêntricas de aplicação
      const S2 = 128, cv = document.createElement('canvas'); cv.width = cv.height = S2;
      const c2 = cv.getContext('2d'), img = c2.createImageData(S2, S2);
      for (let py = 0; py < S2; py++) for (let px = 0; px < S2; px++) {
        const x = reg.x0 + (px / (S2 - 1)) * (reg.x1 - reg.x0), y = reg.y0 + (1 - py / (S2 - 1)) * (reg.y1 - reg.y0);
        const b = blob(x, y), a0 = 1 - sstep(-0.6, 0.6, b);
        const rr = Math.hypot(x - 6.2, y + 1.2), streak = 0.82 + 0.18 * Math.sin(rr * 4.2 + 3 * C.noise3(x * 0.4, y * 0.4, 2, 5));
        const edge = Math.exp(-((b + 0.25) ** 2) / 0.12) * 0.35; // borda seca mais pigmentada
        const k = (py * S2 + px) * 4;
        img.data[k] = 255; img.data[k + 1] = 255; img.data[k + 2] = 255; img.data[k + 3] = Math.round(255 * clamp(a0 * streak + edge * a0, 0, 1));
      }
      c2.putImageData(img, 0, 0);
      const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I); g.computeVertexNormals();
      const matPrep = C.mat({ color: '#b86a48', roughness: 0.22, clearcoat: 0.8, clearcoatRoughness: 0.15, transparent: true, opacity: 0.36, alphaMap: tex, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const m = C.mesh(g, matPrep, prepGrp, infoPrep, { cast: false });
      m.renderOrder = 2;
    }

  }
  /* ======================================================================
     8. COXINS (camada aids): rolo interescapular e rolo sob o ombro direito
     ====================================================================== */
  const backZ = (x, y) => { // z da pele dorsal (mais posterior) em (x,y)
    let z = -22, v = triF(x, y, z);
    for (let i = 0; i < 80 && v > 0.003; i++) { z += Math.max(0.02, v * 0.9); v = triF(x, y, z); }
    return z;
  };
  function towelRoll(R, len, turns) {
    const sh = new THREE.Shape(), r0 = R * 0.16, pitch = (R - r0) / turns, th = pitch * 0.86, N = Math.round(turns * 30);
    const outer = [], inner = [];
    for (let i = 0; i <= N; i++) { const a = (i / N) * turns * Math.PI * 2, r = r0 + pitch * (a / (Math.PI * 2)); outer.push([Math.cos(a) * (r + th / 2), Math.sin(a) * (r + th / 2)]); inner.push([Math.cos(a) * (r - th / 2), Math.sin(a) * (r - th / 2)]); }
    sh.moveTo(...outer[0]); outer.forEach((p) => sh.lineTo(...p)); for (let i = inner.length - 1; i >= 0; i--) sh.lineTo(...inner[i]); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: true, bevelThickness: 0.18, bevelSize: 0.12, bevelSegments: 2, curveSegments: 1, steps: 1 });
    g.translate(0, 0, -len / 2);
    const pa = g.attributes.position, col = new Float32Array(pa.count * 3);
    for (let i = 0; i < pa.count; i++) { // listras azuis de toalha hospitalar perto de uma extremidade
      const t = (pa.getZ(i) + len / 2) / len, st = (Math.abs(t - 0.14) < 0.012 || Math.abs(t - 0.175) < 0.012) ? 1 : 0;
      col[3 * i] = lerp(1, 0.42, st); col[3 * i + 1] = lerp(1, 0.6, st); col[3 * i + 2] = lerp(1, 0.86, st);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }
  const matTowel = C.mat({ color: '#ebe7dc', roughness: 0.96, sheen: 0.8, sheenRoughness: 0.8, sheenColor: '#ffffff', vertexColors: true,
    normalMap: pores, normalScale: new THREE.Vector2(0.9, 0.9), cut: 0xd9d3c4 });
  /** posiciona o rolo (eixo ∥ y) tocando a pele dorsal por baixo, inclinado conforme o perfil do dorso */
  function placeRoll(x, xs, y0, y1, R, flatten) {
    const ys = [], bs = [];
    for (let i = 0; i <= 14; i++) { const y = y0 + ((y1 - y0) * i) / 14; let m = 0; for (const dx of xs) m = Math.min(m, backZ(x + dx, y)); ys.push(y); bs.push(m); }
    // reta de apoio por baixo do perfil dorsal (z = a + s·y), escolhida para ficar o mais próxima possível do dorso
    let best = null;
    for (let s = -0.2; s <= 0.2001; s += 0.005) { let a = 1e9; ys.forEach((y, i) => (a = Math.min(a, bs[i] - s * y))); const score = ys.reduce((q, y, i) => q + (bs[i] - (a + s * y)), 0); if (!best || score < best.score) best = { s, a, score }; }
    const zTop = (y) => best.a + best.s * y + 0.12; // leve compressão contra a pele
    const ym = (y0 + y1) / 2;
    const geo = () => {
      const g = towelRoll(R, y1 - y0, R > 3 ? 3.4 : 2.6);
      g.scale(1, flatten, 1);              // achatamento sob o peso do tórax (vira z)
      g.rotateX(-Math.PI / 2);             // eixo local z → y
      g.rotateX(Math.atan(best.s));        // acompanha a inclinação do dorso
      g.translate(x, ym, zTop(ym) - R * flatten);
      return g;
    };
    return { geo, top: [x, +ym.toFixed(2), +zTop(ym).toFixed(2)], axis: [[x, y0, zTop(y0) - R * flatten], [x, y1, zTop(y1) - R * flatten]] };
  }
  const rollI = placeRoll(0, [-2.6, -1.3, 0, 1.3, 2.6], -15, 3, 3.6, 0.86);
  const rollS = placeRoll(11.6, [-1.6, 0, 1.6], -10, 2, 2.3, 0.85);
  const infoRollI = { id: 'roll-interscapular', name: 'Coxim interescapular (toalha enrolada)', group: 'Instrumentos', desc: 'Rolo longitudinal sob a coluna torácica, entre as escápulas: permite a queda posterior dos ombros. Efeito variável; não garante espaço.' };
  const infoRollS = { id: 'roll-shoulder-R', name: 'Coxim sob o ombro direito', group: 'Instrumentos', desc: 'Rolo pequeno sob o ombro ipsilateral; posição diferente do rolo interescapular e não equivalente a ele.' };
  const rollInter = new THREE.Group(), rollShoulder = new THREE.Group();
  layers.aids.add(rollInter, rollShoulder); C.reg(rollInter, infoRollI); C.reg(rollShoulder, infoRollS);
  let rollsBuilt = false;
  const buildRolls = () => { rollsBuilt = true; C.mesh(rollI.geo(), matTowel, rollInter, infoRollI); C.mesh(rollS.geo(), matTowel, rollShoulder, infoRollS); };
  C.solid('roll-interscapular', rollI.axis, 3.6 * 0.86);
  C.solid('roll-shoulder-R', rollS.axis, 2.3 * 0.85);
  rollInter.visible = rollShoulder.visible = false;

  mark('rolls');
  /* ======================================================================
     9. ÂNCORAS, API e atualização
     ====================================================================== */
  /** ponto da pele ao longo de um raio (de fora para dentro): origem p, direção d (unitária, aponta para dentro) */
  const rayToSkin = (p, d) => {
    let t = 0, x = p[0], y = p[1], z = p[2], v = field(x, y, z);
    for (let i = 0; i < 200 && Math.abs(v) > 0.002; i++) { t += clamp(v, -0.5, 0.5) * 0.9; x = p[0] + d[0] * t; y = p[1] + d[1] * t; z = p[2] + d[2] * t; v = field(x, y, z); }
    return [+x.toFixed(3), +y.toFixed(3), +z.toFixed(3)];
  };
  const fromFront = (x, y) => rayToSkin([x, y, 9], [0, 0, -1]);
  const clavMid = LM.clavicle.junctionMedialMiddle, clavDir = new V3(0, 0.62, 0.78).normalize();
  const anchors = {
    notchSkin: fromFront(0, LM.surface.notchSkin[1]),
    sternalAngleSkin: fromFront(0, S.angleY),
    clavicleSkinR: rayToSkin([clavMid[0], clavMid[1] + clavDir.y * 4, clavMid[2] + clavDir.z * 4], [0, -clavDir.y, -clavDir.z]),
    infraclavicularFossaR: fromFront(13.05, 0.25),
    deltopectoralR: (() => { let b = null; for (let x = 13.6; x <= 16.4; x += 0.1) { const p = fromFront(x, -3.6); if (!b || p[2] < b[2]) b = p; } return b; })(),
    lesserSupraclavFossaR: fromFront(2.6, 2.4),
    entrySkin: fromFront(LM.needle.entrySkin[0], LM.needle.entrySkin[1]),
    coracoidSkinR: fromFront(LM.surface.coracoidSkin[0], LM.surface.coracoidSkin[1]),
    thumbSkin: fromFront(LM.needle.thumbSkin[0], LM.needle.thumbSkin[1]),
    nippleR: fromFront(nipple0[0], nipple0[1]),
    rollInterscapular: rollI.top, rollShoulderR: rollS.top,
  };
  mark('anchors');
  const isGhost = (m) => m.material !== matSkin;
  return {
    anchors,
    api: {
      sdf: field, rayToSkin, skinMesh: skin,
      stats: { TT, exactEvals: exact, verts: SOUT.pos.length / 3, pins: pins.map((q) => ({ p: q.p, resid: +q.resid.toFixed(3) })), push: pushReport },
    },
    update(state) {
      const mode = state.rollMode || 'none';
      if (mode !== 'none' && !rollsBuilt) buildRolls();
      rollInter.visible = mode === 'interscapular'; rollShoulder.visible = mode === 'ipsilateral';
      if (!drapeBuilt && layers.drape.visible) buildDrape();
      // cascas internas só quando há plano de corte ativo e a pele não está "fantasma"
      const cut = C.clipPlanes.length > 0 && !isGhost(skin);
      if (cut && !derm) buildInner();
      if (derm) derm.visible = subq.visible = cut;
      rimD.visible = rimF.visible = inletCap.visible = !cut && !isGhost(skin);
    },
  };
});
