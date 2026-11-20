/* ==========================================================================
   viscera.js — pulmões (lobos), pleura parietal, traqueia e brônquios, esôfago,
   coração + pericárdio, tronco/artérias/veias pulmonares, diafragma e timo.
   Camadas: lung, pleura, mediastinum.
   Coordenadas ANATÔMICAS (x = direita do paciente, y cranial, z anterior; cm).
   Para o lado esquerdo usa-se x' = −x (o gradil costal é simétrico em LM).
   Superfícies orgânicas (pulmões, pleura, coração, pericárdio, timo) são extraídas de
   campos implícitos por "surface nets" (malhas fechadas, faces para fora);
   estruturas tubulares usam C.sweepGeometry.
   • Gradil: tabela polar da face interna (costelas como faixas, recuo corrigido pela
     obliquidade) + parede anterior como campo de altura z(x,y) junto ao esterno.
   • Cúpula: domo apoiado no anel interno da 1ª costela, cume em LM.pleura.cupulaApex.
   • Mediastino: campo de distância em grade com "fechamento" morfológico (sem aletas,
     túneis ou furos no hilo); pulmões com "abertura" (sem lâminas/gotas finas).
   • Respiração: UM campo de deformação monotônico em y (descida do diafragma) aplicado
     a todas as malhas → sem dobras; pulmão continua na pleura e coração no pericárdio.
     Posições/normais-alvo pré-calculadas e interpoladas em update(state).
   ========================================================================== */
ATLAS.define('viscera', function (ctx) {
  const { THREE, C, LM } = ctx;
  const __t0 = performance.now(), __T = []; const TM = (k) => __T.push(k + ':' + Math.round(performance.now() - __t0));
  const LY = ctx.layers;
  const M = C.mats;
  const clamp = C.clamp, lerp = C.lerp, sstep = C.smooth;
  const V = C.V;
  // Math.hypot é lento no V8; versões diretas para os laços quentes
  const hyp = (a, b, c = 0) => Math.sqrt(a * a + b * b + c * c);

  /* ======================= utilitários de campo ======================= */
  const smin = (a, b, k) => { const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return b + (a - b) * h - k * h * (1 - h); };
  const smax = (a, b, k) => -smin(-a, -b, k);
  let segT = 0; // parâmetro do último segDist
  function segDist(px, py, pz, ax, ay, az, bx, by, bz) {
    const ux = bx - ax, uy = by - ay, uz = bz - az, wx = px - ax, wy = py - ay, wz = pz - az;
    const L2 = ux * ux + uy * uy + uz * uz || 1e-9;
    let t = (wx * ux + wy * uy + wz * uz) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t; segT = t;
    const dx = wx - ux * t, dy = wy - uy * t, dz = wz - uz * t;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  /** Cadeia de cápsulas (pontos densos + raios) → distância assinada aproximada. */
  function chain(pts, r, n) {
    const P = n ? C.sample(pts, n) : pts.map((p) => p.slice());
    const rf = C.profile(r);
    const R = P.map((_, i) => rf(i / (P.length - 1)));
    const bb = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]; const rmax = Math.max(...R);
    P.forEach((p) => { for (let a = 0; a < 3; a++) { bb[a] = Math.min(bb[a], p[a] - rmax); bb[a + 3] = Math.max(bb[a + 3], p[a] + rmax); } });
    return {
      P, R, bb,
      d(x, y, z) {
        let best = 1e9;
        for (let i = 0; i < P.length - 1; i++) {
          const a = P[i], b = P[i + 1];
          const dd = segDist(x, y, z, a[0], a[1], a[2], b[0], b[1], b[2]) - (R[i] + (R[i + 1] - R[i]) * segT);
          if (dd < best) best = dd;
        }
        return best;
      },
    };
  }

  /** Grade escalar 3D (amostras nos vértices). */
  function Grid(x0, y0, z0, x1, y1, z1, h) {
    const nx = Math.ceil((x1 - x0) / h) + 1, ny = Math.ceil((y1 - y0) / h) + 1, nz = Math.ceil((z1 - z0) / h) + 1;
    const F = new Float32Array(nx * ny * nz);
    const g = { x0, y0, z0, h, nx, ny, nz, F };
    g.fill = (fn) => { let q = 0; for (let k = 0; k < nz; k++) { const z = z0 + k * h; for (let j = 0; j < ny; j++) { const y = y0 + j * h; for (let i = 0; i < nx; i++, q++) F[q] = fn(x0 + i * h, y, z); } } return g; };
    g.at = (x, y, z, out = 3) => {
      const fx = (x - x0) / h, fy = (y - y0) / h, fz = (z - z0) / h;
      if (fx < 0 || fy < 0 || fz < 0 || fx >= nx - 1 || fy >= ny - 1 || fz >= nz - 1) return out;
      const i = fx | 0, j = fy | 0, k = fz | 0, u = fx - i, v = fy - j, w = fz - k;
      const q = i + nx * (j + ny * k), sx = 1, sy = nx, sz = nx * ny;
      const c00 = F[q] + (F[q + sx] - F[q]) * u, c10 = F[q + sy] + (F[q + sy + sx] - F[q + sy]) * u;
      const c01 = F[q + sz] + (F[q + sz + sx] - F[q + sz]) * u, c11 = F[q + sz + sy] + (F[q + sz + sy + sx] - F[q + sz + sy]) * u;
      const c0 = c00 + (c10 - c00) * v, c1 = c01 + (c11 - c01) * v;
      return c0 + (c1 - c0) * w;
    };
    /** Preenchimento em banda estreita: grade grossa (3h) primeiro; células grossas longe da superfície
        (|f| > T em todos os cantos) são interpoladas, as demais avaliadas exatamente. */
    g.fillNarrow = (fn, T = 0.95) => {
      const S = 3, ncx = Math.ceil((nx - 1) / S) + 1, ncy = Math.ceil((ny - 1) / S) + 1, ncz = Math.ceil((nz - 1) / S) + 1, H = h * S;
      const Cg = new Float32Array(ncx * ncy * ncz);
      let q = 0; for (let k = 0; k < ncz; k++) for (let j = 0; j < ncy; j++) for (let i = 0; i < ncx; i++, q++) Cg[q] = fn(x0 + i * H, y0 + j * H, z0 + k * H);
      const done = new Uint8Array(nx * ny * nz), cs = [0, 1, ncx, ncx + 1, ncx * ncy, ncx * ncy + 1, ncx * ncy + ncx, ncx * ncy + ncx + 1];
      for (let k = 0; k < ncz - 1; k++) for (let j = 0; j < ncy - 1; j++) for (let i = 0; i < ncx - 1; i++) {
        const c0 = i + ncx * (j + ncy * k); let mn = 1e9, mx = -1e9;
        for (let c = 0; c < 8; c++) { const v = Cg[c0 + cs[c]]; if (v < mn) mn = v; if (v > mx) mx = v; }
        const far = mn > T || mx < -T;
        for (let kk = 0; kk <= S; kk++) { const fk = k * S + kk; if (fk >= nz) break;
          for (let jj = 0; jj <= S; jj++) { const fj = j * S + jj; if (fj >= ny) break;
            for (let ii = 0; ii <= S; ii++) { const fi = i * S + ii; if (fi >= nx) break;
              const fq = fi + nx * (fj + ny * fk); if (done[fq]) continue; done[fq] = 1;
              if (far) {
                const u = ii / S, v = jj / S, w = kk / S;
                const a = Cg[c0] + (Cg[c0 + 1] - Cg[c0]) * u, b = Cg[c0 + ncx] + (Cg[c0 + ncx + 1] - Cg[c0 + ncx]) * u;
                const c = Cg[c0 + cs[4]] + (Cg[c0 + cs[5]] - Cg[c0 + cs[4]]) * u, d = Cg[c0 + cs[6]] + (Cg[c0 + cs[7]] - Cg[c0 + cs[6]]) * u;
                const e = a + (b - a) * v, f2 = c + (d - c) * v; F[fq] = e + (f2 - e) * w;
              } else F[fq] = fn(x0 + fi * h, y0 + fj * h, z0 + fk * h);
            } } }
      }
      return g;
    };
    /** Filtro binomial separável [1,2,1] (remove lâminas finas/fragmentos e o serrilhado do campo). */
    g.blur = (passes = 1) => {
      const T = new Float32Array(F.length), st = [1, nx, nx * ny], lim = [nx, ny, nz];
      for (let p = 0; p < passes; p++) for (let a = 0; a < 3; a++) {
        T.set(F); const s1 = st[a];
        for (let k = 0, q = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++, q++) {
          const c = a === 0 ? i : a === 1 ? j : k; if (c === 0 || c === lim[a] - 1) continue;
          F[q] = (T[q - s1] + 2 * T[q] + T[q + s1]) * 0.25;
        }
      }
      return g;
    };
    /** "Pinta" uma primitiva (distância assinada) por mínimo, só dentro da caixa envolvente + margem. */
    g.splat = (prim, margin = 2.2, offset = 0) => {
      const bb = prim.bb;
      const i0 = Math.max(0, Math.floor((bb[0] - margin - x0) / h)), i1 = Math.min(nx - 1, Math.ceil((bb[3] + margin - x0) / h));
      const j0 = Math.max(0, Math.floor((bb[1] - margin - y0) / h)), j1 = Math.min(ny - 1, Math.ceil((bb[4] + margin - y0) / h));
      const k0 = Math.max(0, Math.floor((bb[2] - margin - z0) / h)), k1 = Math.min(nz - 1, Math.ceil((bb[5] + margin - z0) / h));
      for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const q = i + nx * (j + ny * k);
        const d = prim.d(x0 + i * h, y0 + j * h, z0 + k * h) - offset;
        if (d < F[q]) F[q] = d;
      }
    };
    /** Cadeia de cápsulas pintada segmento a segmento (cada um com sua caixa) — muito mais barato. */
    g.splatChain = (pts, r, n, margin = 1.0, offset = 0) => {
      const ch = chain(pts, r, n);
      for (let s = 0; s < ch.P.length - 1; s++) {
        const a = ch.P[s], b = ch.P[s + 1], ra = ch.R[s], rb = ch.R[s + 1], rm = Math.max(ra, rb);
        g.splat({ bb: [Math.min(a[0], b[0]) - rm, Math.min(a[1], b[1]) - rm, Math.min(a[2], b[2]) - rm, Math.max(a[0], b[0]) + rm, Math.max(a[1], b[1]) + rm, Math.max(a[2], b[2]) + rm],
          d: (x, y, z) => segDist(x, y, z, a[0], a[1], a[2], b[0], b[1], b[2]) - (ra + (rb - ra) * segT) }, margin, offset);
      }
    };
    return g;
  }

  /** Surface nets: grade (negativo = dentro) → malha fechada, quads orientados para fora.
      Varre só blocos 4×4×4 que contêm mudança de sinal (o resto da grade é descartado com ~2 leituras/célula). */
  function surfaceNets(g) {
    const { nx, ny, nz, F, x0, y0, z0, h } = g;
    const cnx = nx - 1, cny = ny - 1, cnz = nz - 1;
    const vmap = new Int32Array(cnx * cny * cnz).fill(-1);
    const pos = [], idx = [];
    const sy = nx, sz = nx * ny;
    const co = [0, 1, sy, sy + 1, sz, sz + 1, sz + sy, sz + sy + 1];
    const cxyz = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
    const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    const cv = new Float32Array(8);
    const Bk = 4, blocks = [];
    for (let k0 = 0; k0 < cnz; k0 += Bk) for (let j0 = 0; j0 < cny; j0 += Bk) for (let i0 = 0; i0 < cnx; i0 += Bk) {
      const i1 = Math.min(nx - 1, i0 + Bk), j1 = Math.min(ny - 1, j0 + Bk), k1 = Math.min(nz - 1, k0 + Bk);
      let neg = false, ps = false;
      scan: for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) { let q = i0 + sy * j + sz * k; for (let i = i0; i <= i1; i++, q++) { if (F[q] < 0) neg = true; else ps = true; if (neg && ps) break scan; } }
      if (neg && ps) blocks.push(i0, j0, k0);
    }
    const forCells = (fn) => { for (let b = 0; b < blocks.length; b += 3) { const i0 = blocks[b], j0 = blocks[b + 1], k0 = blocks[b + 2]; const i1 = Math.min(cnx, i0 + Bk), j1 = Math.min(cny, j0 + Bk), k1 = Math.min(cnz, k0 + Bk); for (let k = k0; k < k1; k++) for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) fn(i, j, k); } };
    forCells((i, j, k) => {
      const q = i + sy * j + sz * k;
      let mask = 0;
      for (let c = 0; c < 8; c++) { const v = F[q + co[c]]; cv[c] = v; if (v < 0) mask |= 1 << c; }
      if (mask === 0 || mask === 255) return;
      let ax = 0, ay = 0, az = 0, n = 0;
      for (let e = 0; e < 12; e++) {
        const a = E[e][0], b = E[e][1];
        if (((mask >> a) & 1) === ((mask >> b) & 1)) continue;
        const t = cv[a] / (cv[a] - cv[b]), A = cxyz[a], B = cxyz[b];
        ax += A[0] + (B[0] - A[0]) * t; ay += A[1] + (B[1] - A[1]) * t; az += A[2] + (B[2] - A[2]) * t; n++;
      }
      vmap[i + cnx * (j + cny * k)] = pos.length / 3;
      pos.push(x0 + (i + ax / n) * h, y0 + (j + ay / n) * h, z0 + (k + az / n) * h);
    });
    const cell = (i, j, k) => vmap[i + cnx * (j + cny * k)];
    const quad = (a, b, c, d, flip) => {
      if (a < 0 || b < 0 || c < 0 || d < 0) return;
      if (flip) { const t = b; b = d; d = t; }
      const d1 = (pos[a * 3] - pos[c * 3]) ** 2 + (pos[a * 3 + 1] - pos[c * 3 + 1]) ** 2 + (pos[a * 3 + 2] - pos[c * 3 + 2]) ** 2;
      const d2 = (pos[b * 3] - pos[d * 3]) ** 2 + (pos[b * 3 + 1] - pos[d * 3 + 1]) ** 2 + (pos[b * 3 + 2] - pos[d * 3 + 2]) ** 2;
      if (d1 <= d2) idx.push(a, b, c, a, c, d); else idx.push(a, b, d, b, c, d);
    };
    // cada aresta com troca de sinal tem como origem o canto mínimo de uma célula mista → mesmo laço por blocos
    forCells((i, j, k) => {
      const q = i + sy * j + sz * k, in0 = F[q] < 0;
      if (j > 0 && k > 0 && in0 !== (F[q + 1] < 0)) quad(cell(i, j - 1, k - 1), cell(i, j, k - 1), cell(i, j, k), cell(i, j - 1, k), !in0);
      if (i > 0 && k > 0 && in0 !== (F[q + sy] < 0)) quad(cell(i - 1, j, k - 1), cell(i - 1, j, k), cell(i, j, k), cell(i, j, k - 1), !in0);
      if (i > 0 && j > 0 && in0 !== (F[q + sz] < 0)) quad(cell(i - 1, j - 1, k), cell(i, j - 1, k), cell(i, j, k), cell(i - 1, j, k), !in0);
    });
    return { pos: new Float32Array(pos), idx };
  }

  /** Transformada de distância euclidiana 1D (Felzenszwalb–Huttenlocher) sobre distâncias ao quadrado. */
  function edt1d(f, n, d, v, zz) {
    let k = 0; v[0] = 0; zz[0] = -1e20; zz[1] = 1e20;
    for (let q = 1; q < n; q++) {
      let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= zz[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; zz[k] = s; zz[k + 1] = 1e20;
    }
    k = 0;
    for (let q = 0; q < n; q++) { while (zz[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
  }
  /** "Fechamento" morfológico (dilatação + erosão de raio rho) de um campo de distância em grade, dentro da caixa
      `box`: preenche fendas e túneis mais estreitos que ~2·rho entre estruturas do mediastino, de modo que o pulmão
      não forme aletas, furos ou túneis entre elas (hilo, janela aortopulmonar, arco da ázigo). */
  function closeField(g, rho, box, sg = 1) { // sg = −1: opera sobre −F (= abertura do conjunto F < 0)
    const { nx, ny, nz, h, F } = g;
    const i0 = Math.max(0, Math.floor((box[0] - g.x0) / h)), i1 = Math.min(nx - 1, Math.ceil((box[3] - g.x0) / h));
    const j0 = Math.max(0, Math.floor((box[1] - g.y0) / h)), j1 = Math.min(ny - 1, Math.ceil((box[4] - g.y0) / h));
    const k0 = Math.max(0, Math.floor((box[2] - g.z0) / h)), k1 = Math.min(nz - 1, Math.ceil((box[5] - g.z0) / h));
    const sx = i1 - i0 + 1, sy = j1 - j0 + 1, sz = k1 - k0 + 1, D = new Float32Array(sx * sy * sz);
    // faces da caixa contam como "fora": o fechamento enfraquece junto à borda em vez de preencher a mais
    for (let k = 0; k < sz; k++) for (let j = 0; j < sy; j++) for (let i = 0; i < sx; i++) {
      const edge = i === 0 || j === 0 || k === 0 || i === sx - 1 || j === sy - 1 || k === sz - 1;
      D[i + sx * (j + sy * k)] = !edge && sg * F[(i + i0) + nx * ((j + j0) + ny * (k + k0))] < rho ? 1e10 : 0;
    }
    const n = Math.max(sx, sy, sz), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), zz = new Float64Array(n + 1);
    const pass = (len, stride, outer) => { for (const base of outer) { for (let q = 0; q < len; q++) f[q] = D[base + q * stride]; edt1d(f, len, d, v, zz); for (let q = 0; q < len; q++) D[base + q * stride] = d[q]; } };
    const bx = [], by = [], bz = [];
    for (let k = 0; k < sz; k++) for (let j = 0; j < sy; j++) bx.push(sx * (j + sy * k));
    for (let k = 0; k < sz; k++) for (let i = 0; i < sx; i++) by.push(i + sx * sy * k);
    for (let j = 0; j < sy; j++) for (let i = 0; i < sx; i++) bz.push(i + sx * j);
    pass(sx, 1, bx); pass(sy, sx, by); pass(sz, sx * sy, bz);
    for (let k = 0; k < sz; k++) for (let j = 0; j < sy; j++) for (let i = 0; i < sx; i++) {
      const q = (i + i0) + nx * ((j + j0) + ny * (k + k0)); if (sg * F[q] >= rho) continue;
      const c = rho + 0.5 * h - Math.sqrt(D[i + sx * (j + sy * k)]) * h; if (c < sg * F[q]) F[q] = sg * c;
    }
    return g;
  }
  /** Remove componentes conexas pequenas (fragmentos espúrios em fendas estreitas do mediastino). */
  function dropSmall(sn, minTris) {
    const n = sn.pos.length / 3, par = new Int32Array(n); for (let i = 0; i < n; i++) par[i] = i;
    const find = (a) => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
    const I = sn.idx; for (let t = 0; t < I.length; t += 3) { const a = find(I[t]), b = find(I[t + 1]), c = find(I[t + 2]); if (a !== b) par[a] = b; const bb = find(b); if (find(c) !== bb) par[find(c)] = bb; }
    const cnt = new Map(); for (let t = 0; t < I.length; t += 3) { const r = find(I[t]); cnt.set(r, (cnt.get(r) || 0) + 1); }
    const keep = []; for (let t = 0; t < I.length; t += 3) if (cnt.get(find(I[t])) >= minTris) keep.push(I[t], I[t + 1], I[t + 2]);
    sn.idx = keep; return sn;
  }
  /** Suavização de Taubin (λ/μ) — remove o serrilhado da grade sem encolher a forma. */
  function taubin(pos, idx, iters = 2, lam = 0.5, mu = -0.53, pin) {
    const n = pos.length / 3, deg = new Uint16Array(n), acc = new Float32Array(n * 3);
    const step = (f) => {
      acc.fill(0); deg.fill(0);
      for (let t = 0; t < idx.length; t += 3) for (let e = 0; e < 3; e++) {
        const a = idx[t + e], b = idx[t + ((e + 1) % 3)];
        acc[a * 3] += pos[b * 3]; acc[a * 3 + 1] += pos[b * 3 + 1]; acc[a * 3 + 2] += pos[b * 3 + 2]; deg[a]++;
        acc[b * 3] += pos[a * 3]; acc[b * 3 + 1] += pos[a * 3 + 1]; acc[b * 3 + 2] += pos[a * 3 + 2]; deg[b]++;
      }
      for (let i = 0; i < n; i++) { if (!deg[i] || (pin && pin[i])) continue; for (let c = 0; c < 3; c++) pos[i * 3 + c] += f * (acc[i * 3 + c] / deg[i] - pos[i * 3 + c]); }
    };
    for (let it = 0; it < iters; it++) { step(lam); step(mu); }
  }

  /** Normais por vértice (soma das normais de face ponderadas pela área) — equivalente a computeVertexNormals, mais rápido. */
  function fastNormals(geo) {
    const p = geo.attributes.position.array, I = geo.index ? geo.index.array : null, nt = I ? I.length : p.length / 3;
    let na = geo.attributes.normal; if (!na || na.array.length !== p.length) { na = new THREE.BufferAttribute(new Float32Array(p.length), 3); geo.setAttribute('normal', na); }
    const n = na.array; n.fill(0);
    for (let t = 0; t < nt; t += 3) {
      const a = (I ? I[t] : t) * 3, b = (I ? I[t + 1] : t + 1) * 3, c = (I ? I[t + 2] : t + 2) * 3;
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
      const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
      n[a] += cx; n[a + 1] += cy; n[a + 2] += cz; n[b] += cx; n[b + 1] += cy; n[b + 2] += cz; n[c] += cx; n[c + 1] += cy; n[c + 2] += cz;
    }
    for (let i = 0; i < n.length; i += 3) { const l = Math.sqrt(n[i] * n[i] + n[i + 1] * n[i + 1] + n[i + 2] * n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
    na.needsUpdate = true;
  }
  /** BufferGeometry a partir de arrays; uvFn(x,y,z)→[u,v]; colorFn(x,y,z,i)→[r,g,b] (linear). */
  function makeGeo(pos, idx, uvFn, colorFn) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const n = pos.length / 3;
    if (uvFn) { const uv = new Float32Array(n * 2); for (let i = 0; i < n; i++) { const t = uvFn(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); uv[i * 2] = t[0]; uv[i * 2 + 1] = t[1]; } g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); }
    if (colorFn) { const col = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const c = colorFn(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], i); col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; } g.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
    g.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
    fastNormals(g);
    return g;
  }
  /** Superfície implícita completa: amostra → surface nets → Taubin → geometria. */
  function isoMesh(box, h, fn, o = {}) {
    const g = Grid(box[0], box[1], box[2], box[3], box[4], box[5], h);
    if (o.narrow) g.fillNarrow(fn, o.T ?? 0.75); else g.fill(fn);
    if (o.blur) g.blur(o.blur);
    const s = surfaceNets(g);
    if (o.minTris) dropSmall(s, o.minTris);
    taubin(s.pos, s.idx, o.smooth ?? 2);
    return { geo: makeGeo(s.pos, s.idx, o.uv, o.color), grid: g };
  }
  const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; }; // Color já converte sRGB→linear
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const G = (group, k) => Object.assign({ group }, k);
  const GL = (k) => G('Pulmões e pleura', k), GM = (k) => G('Mediastino', k);

  /* ======================= gradil costal: face interna (tabela polar) =======================
     Para cada ângulo φ em torno do centro do hemitórax (CX,CZ) e cada altura y, ρ da face interna
     das costelas/cartilagens (interpolada nos espaços intercostais). Lado esquerdo: x' = −x. */
  const CX = 5.0, CZ = -4.5;
  const NPH = 180, CY0 = -28, CDY = 0.25, NYC = Math.round((5 - CY0) / CDY) + 1;
  const cage = new Float32Array(NPH * NYC);
  const ribPolar = []; // por costela: amostras {phi, rho, y, x, z}
  {
    LM.ribs.forEach((R) => {
      const pts = R.pts.concat(R.cartilage ? R.cartilage.slice(1) : []);
      const S = C.sample(pts, 110);
      let ic = S.length; // início da cartilagem (amostra mais próxima da junção costocondral)
      if (R.cartilage) { let best = 1e9; const cc = R.cartilage[0]; S.forEach((p, i) => { const d = hyp(p[0] - cc[0], p[1] - cc[1], p[2] - cc[2]); if (d < best) { best = d; ic = i; } }); }
      ribPolar.push(S.map((p, i) => {
        // + folga posterior: a secção da costela gira junto ao ângulo (a face interna invade o plano horizontal)
        const off0 = R.flat ? 0.78 : (i > ic ? R.t * 0.62 : R.t * 0.5 + 0.2 * sstep(-3.5, -8.5, p[2])) + 0.04;
        // o recuo da face interna vale off0 ao longo da normal horizontal da costela; onde a costela é oblíqua ao
        // raio polar (colo, ângulo costal) o recuo medido no raio é off0 / cos α — senão o pulmão invade a costela
        const a = S[Math.max(0, i - 1)], b = S[Math.min(S.length - 1, i + 1)];
        let tx = b[0] - a[0], tz = b[2] - a[2]; const tl = hyp(tx, tz) || 1; tx /= tl; tz /= tl;
        const ux = p[0] - CX, uz = p[2] - CZ, ul = hyp(ux, uz) || 1;
        const cosA = Math.abs(-tz * ux + tx * uz) / ul;
        const off = off0 / Math.max(0.45, cosA);
        // meia-altura útil da face interna (secção arredondada): a costela é uma FAIXA em y, não um ponto
        const hh = R.flat ? 0.16 : (i > ic ? 0.3 : R.h * 0.36);
        return { phi: Math.atan2(uz, ux), rho: ul - off, y: p[1], x: p[0], z: p[2], hh };
      }));
    });
    const col = new Float32Array(NYC), raw = new Float32Array(NYC);
    for (let k = 0; k < NPH; k++) {
      const ph = -Math.PI + (k + 0.5) * (2 * Math.PI / NPH);
      const hits = [];
      ribPolar.forEach((S) => {
        for (let s = 0; s < S.length - 1; s++) {
          const a = S[s], b = S[s + 1];
          if (Math.abs(a.phi - b.phi) > Math.PI) continue;
          if ((a.phi - ph) * (b.phi - ph) <= 0 && a.phi !== b.phi) {
            const t = (ph - a.phi) / (b.phi - a.phi), y = lerp(a.y, b.y, t), r = lerp(a.rho, b.rho, t), hh = lerp(a.hh, b.hh, t);
            hits.push([y + hh, r], [y - hh, r]); break;
          }
        }
      });
      hits.sort((a, b) => b[0] - a[0]);
      for (let m = 0; m < NYC; m++) {
        const y = CY0 + m * CDY;
        let r = 40;
        if (hits.length) {
          if (y >= hits[0][0]) r = hits[0][1];
          else if (y <= hits[hits.length - 1][0]) r = hits[hits.length - 1][1];
          else for (let q = 0; q < hits.length - 1; q++) if (y <= hits[q][0] && y >= hits[q + 1][0]) { r = lerp(hits[q][1], hits[q + 1][1], (hits[q][0] - y) / (hits[q][0] - hits[q + 1][0] || 1)); break; }
        }
        col[m] = raw[m] = r;
      }
      // suaviza ao longo de y (núcleo binomial 1-4-6-4-1, 2 passadas) sem nunca ultrapassar a parede bruta
      for (let pass = 0; pass < 2; pass++) {
        for (let m = 0; m < NYC; m++) { const a = col[Math.max(0, m - 2)], b = col[Math.max(0, m - 1)], c = col[Math.min(NYC - 1, m + 1)], d = col[Math.min(NYC - 1, m + 2)]; cage[k * NYC + m] = (a + 4 * b + 6 * col[m] + 4 * c + d) / 16; }
        for (let m = 0; m < NYC; m++) col[m] = cage[k * NYC + m];
      }
      for (let m = 0; m < NYC; m++) cage[k * NYC + m] = Math.min(col[m], raw[m]);
    }
  }
  // goteira paravertebral: ângulos posteromediais sem costela (além das cabeças) herdam a parede da cabeça costal
  {
    let kHead = -1; for (let k = 0; k < NPH; k++) { const ph = -Math.PI + (k + 0.5) * (2 * Math.PI / NPH); if (ph > -Math.PI / 2) break; if (cage[k * NYC + 40] < 39) { kHead = k; break; } }
    if (kHead > 0) for (let k = 0; k < kHead; k++) for (let m = 0; m < NYC; m++) cage[k * NYC + m] = cage[kHead * NYC + m];
  }
  /** ρ da face interna do gradil em (φ, y) — interpolação bilinear com φ periódico. */
  function cageRho(phi, y) {
    let fk = (phi + Math.PI) / (2 * Math.PI) * NPH - 0.5; if (fk < 0) fk += NPH;
    const k0 = fk | 0, k1 = (k0 + 1) % NPH, u = fk - k0;
    let fm = (y - CY0) / CDY; fm = fm < 0 ? 0 : fm > NYC - 1.001 ? NYC - 1.001 : fm;
    const m = fm | 0, v = fm - m;
    const a = cage[k0 * NYC + m] + (cage[k0 * NYC + m + 1] - cage[k0 * NYC + m]) * v;
    const b = cage[k1 * NYC + m] + (cage[k1 * NYC + m + 1] - cage[k1 * NYC + m]) * v;
    return a + (b - a) * u;
  }
  const ST = LM.sternum;
  // face posterior e meia-largura do esterno tabeladas (consultadas em todos os campos)
  const STB = { y0: -28, dy: 0.05, n: 568 }; STB.zb = new Float32Array(STB.n); STB.hw = new Float32Array(STB.n);
  for (let i = 0; i < STB.n; i++) { const y = STB.y0 + i * STB.dy; STB.zb[i] = ST.zAnt(y) - ST.thick(y); STB.hw[i] = ST.halfWidth(y); }
  const stTab = (A, y) => { let f = (y - STB.y0) / STB.dy; f = f < 0 ? 0 : f > STB.n - 1.001 ? STB.n - 1.001 : f; const i = f | 0; return A[i] + (A[i + 1] - A[i]) * (f - i); };
  const zBack = (y) => (y > 0.3 ? -30 : stTab(STB.zb, y));
  const sHW = (y) => (y > 0.3 ? 0 : stTab(STB.hw, y));
  /** Campo "dentro do gradil" (lado-local xs): <0 dentro, com recuo `inset` da face interna. */
  function cageF(xs, y, z, inset) {
    const dx = xs - CX, dz = z - CZ;
    let f = hyp(dx, dz) - (cageRho(Math.atan2(dz, dx), y) - inset);
    // setor anterior paraesternal: a tabela polar é imprecisa junto às extremidades esternais das cartilagens →
    // usa a parede anterior como campo de altura z(x, y)
    if (z > -3.2 && xs < 7 && y < 0.3) { const w = sstep(-3.2, -1.6, z) * (1 - sstep(5.2, 7.0, xs)); if (w > 0) f = f + (z - (zWall(xs, y) - inset) - f) * w; }
    // face posterior do esterno (parede anterior medial)
    const hw = sHW(y);
    if (y < 0.3) f = smax(f, z - (zBack(y) - inset) - 5 * sstep(hw + 0.4, hw + 1.6, xs), 0.3);
    return f;
  }

  /* Face interna da PAREDE ANTERIOR como campo de altura z(xs, y) (esterno + cartilagens/arcos anteriores, faixas por
     costela interpoladas nos espaços intercostais). A tabela polar é imprecisa junto ao esterno (fim das cartilagens) e
     na direção medial; coração e pericárdio usam esta parede para manter a face esternocostal a uma distância fixa. */
  const AW = { dx: 0.1, dy: 0.1, nx: 91, y0: -20, ny: 211 };
  AW.z = new Float32Array(AW.nx * AW.ny);
  {
    const crs = LM.ribs.filter((R) => R.i <= 10).map((R) => {
      const S = C.sample(R.pts.concat(R.cartilage ? R.cartilage.slice(1) : []), 160);
      let ic = S.length; if (R.cartilage) { let best = 1e9; const cc = R.cartilage[0]; S.forEach((p, i) => { const d = hyp(p[0] - cc[0], p[1] - cc[1], p[2] - cc[2]); if (d < best) { best = d; ic = i; } }); }
      return S.map((p, i) => {
        const a = S[Math.max(0, i - 1)], b = S[Math.min(S.length - 1, i + 1)], tl = hyp(b[0] - a[0], b[2] - a[2]) || 1, nz = Math.abs(b[0] - a[0]) / tl;
        const off = (R.flat ? 0.78 : (i > ic ? R.t * 0.62 : R.t * 0.5) + 0.04) / Math.max(0.45, nz);
        return { x: p[0], y: p[1], z: p[2] - off, hh: R.flat ? 0.16 : (i > ic ? 0.3 : R.h * 0.36), ant: p[2] > -3.2 };
      });
    });
    for (let i = 0; i < AW.nx; i++) {
      const xs = i * AW.dx, hits = [];
      crs.forEach((S) => { for (let s = 0; s < S.length - 1; s++) { const a = S[s], b = S[s + 1]; if (!a.ant || !b.ant) continue; if ((a.x - xs) * (b.x - xs) <= 0 && a.x !== b.x) { const t = (xs - a.x) / (b.x - a.x), y = lerp(a.y, b.y, t), z = lerp(a.z, b.z, t), hh = lerp(a.hh, b.hh, t); hits.push([y + hh, z], [y - hh, z]); break; } } });
      hits.sort((a, b) => b[0] - a[0]);
      for (let j = 0; j < AW.ny; j++) {
        const y = AW.y0 + j * AW.dy; let z = 10;
        if (hits.length) {
          if (y >= hits[0][0]) z = hits[0][1]; else if (y <= hits[hits.length - 1][0]) z = hits[hits.length - 1][1];
          else for (let q = 0; q < hits.length - 1; q++) if (y <= hits[q][0] && y >= hits[q + 1][0]) { z = lerp(hits[q][1], hits[q + 1][1], (hits[q][0] - y) / (hits[q][0] - hits[q + 1][0] || 1)); break; }
        }
        // esterno: face posterior (com transição de 0,5 cm até a cartilagem)
        if (y < 0.3) { const hw = ST.halfWidth(y), zs = ST.zAnt(y) - ST.thick(y); z = lerp(zs, Math.min(z, zs + 0.6), sstep(hw - 0.2, hw + 0.4, xs)); }
        AW.z[j * AW.nx + i] = z;
      }
    }
  }
  /** z da face interna da parede anterior em (xs, y). */
  function zWall(xs, y) {
    let fx = clamp(xs / AW.dx, 0, AW.nx - 1.001), fy = clamp((y - AW.y0) / AW.dy, 0, AW.ny - 1.001);
    const i = fx | 0, j = fy | 0, u = fx - i, v = fy - j, Z = AW.z, q = j * AW.nx + i;
    const a = Z[q] + (Z[q + 1] - Z[q]) * u, b = Z[q + AW.nx] + (Z[q + AW.nx + 1] - Z[q + AW.nx]) * u;
    return a + (b - a) * v;
  }
  TM('cage');
  /* ======================= linhas de reflexão / borda pulmonar / inserções do diafragma =======================
     Âncoras por ângulo em torno do centro da cúpula diafragmática (lado-local). Valores derivados das costelas de LM:
     borda pulmonar: 6ª (LHC) · 8ª (LAM) · 10ª (paravertebral); pleura: 8ª · 10ª · 12ª (LM.pleura). */
  const ribYAt = (n, mode) => {
    const S = ribPolar[n - 1]; let best = 1e9, y = S[0].y;
    S.forEach((p) => {
      let d;
      if (mode === 'mcl') d = p.z > -2.5 ? Math.abs(p.x - 9.2) : 1e9;
      else if (mode === 'mal') d = -p.x;
      else if (mode === 'scap') d = p.z < -9 ? Math.abs(p.x - 9.3) : 1e9;
      else d = p.z < -7.5 ? Math.abs(p.x - 3.7) : 1e9; // paravertebral
      if (d < best) { best = d; y = p.y; }
    });
    return y;
  };
  const PLc = LM.pleura;
  const DOME = { R: { x: LM.diaphragm.domeR[0], z: LM.diaphragm.domeR[2], top: LM.diaphragm.domeR[1] }, L: { x: -LM.diaphragm.domeL[0], z: LM.diaphragm.domeL[2], top: LM.diaphragm.domeL[1] } };
  // posições (xs,z) das linhas de referência → ângulo em torno da cúpula
  const LINES = { am: [1.9, 3.4], mcl: [9.2, 2.6], mal: [14.0, -6.0], scap: [9.6, -13.0], pv: [3.7, -11.0], pm: [1.7, -8.6], med: [-0.6, -3.5] };
  function anchorTable(side, vals) {
    const D = DOME[side];
    const list = Object.keys(vals).map((k) => [Math.atan2(LINES[k][1] - D.z, LINES[k][0] - D.x), vals[k]]).sort((a, b) => a[0] - b[0]);
    const T = new Float32Array(NPH);
    for (let k = 0; k < NPH; k++) {
      const ph = -Math.PI + (k + 0.5) * (2 * Math.PI / NPH);
      let i = list.findIndex((a) => a[0] > ph); if (i < 0) i = list.length;
      const a = list[(i - 1 + list.length) % list.length], b = list[i % list.length];
      let span = b[0] - a[0]; if (span <= 0) span += 2 * Math.PI;
      let t = ph - a[0]; if (t < 0) t += 2 * Math.PI;
      const s = t / span, e = s * s * (3 - 2 * s);
      T[k] = lerp(a[1], b[1], e);
    }
    return T;
  }
  const yLB = {}, yRF = {}, yAT = {}, yDE = {};
  {
    const lb6 = ribYAt(6, 'mcl'), lb8 = ribYAt(8, 'mal'), lb9 = ribYAt(9, 'scap'), lb10 = ribYAt(10, 'pv');
    const rf8 = ribYAt(8, 'mcl'), rf10 = ribYAt(10, 'mal'), rf11 = ribYAt(11, 'scap'), rf12 = ribYAt(12, 'pv');
    const am6 = LM.sternocostalY[5], am7 = LM.sternocostalY[6];
    for (const s of ['R', 'L']) {
      const L = s === 'L';
      yLB[s] = anchorTable(s, { am: L ? am6 - 1.6 : am6, mcl: lb6, mal: lb8, scap: lb9 + 0.4, pv: lb10, pm: lb10 - 0.3, med: -17.2 });
      yRF[s] = anchorTable(s, { am: L ? am6 - 0.9 : am7 - 0.3, mcl: rf8, mal: rf10, scap: rf11 + 0.3, pv: rf12, pm: rf12 - 0.4, med: -18.0 });
      // borda superior da zona de aposição do diafragma: = borda pulmonar, exceto junto ao esterno (sem aposição: inserção esternal)
      yDE[s] = anchorTable(s, { am: -17.0, mcl: lb6, mal: lb8, scap: lb9 + 0.4, pv: lb10, pm: lb10 - 0.3, med: -17.2 });
      yAT[s] = anchorTable(s, { am: -17.8, mcl: Math.min(rf8 - 1.3, -21.4), mal: rf10 - 2.0, scap: -25.4, pv: -26.0, pm: -26.6, med: -27.2 });
    }
  }
  const tabAt = (T, phi) => { let fk = (phi + Math.PI) / (2 * Math.PI) * NPH - 0.5; if (fk < 0) fk += NPH; const k0 = fk | 0, u = fk - k0; return T[k0] + (T[(k0 + 1) % NPH] - T[k0]) * u; };
  const domePhi = (side, xs, z) => Math.atan2(z - DOME[side].z, xs - DOME[side].x);

  /* ======================= diafragma: superfície média H(x,z) =======================
     Cada hemicúpula: perfil polar a partir do topo; s = ρ/ρw(φ), onde ρw é a parede (recuo 0,55)
     na altura da borda pulmonar → a cúpula encontra o gradil exatamente na borda inferior do pulmão
     (cunha fina do recesso costodiafragmático). Centro tendíneo: platô sob o coração. */
  const SKIRT_IN = 0.55, DIA_TH = 0.42, TEND_TH = 0.26;
  const rhoW = { R: new Float32Array(NPH), L: new Float32Array(NPH) };
  const vertAt0 = (y) => { const s = LM.spine; if (y >= s[0].y) return s[0]; if (y <= s[s.length - 1].y) return s[s.length - 1]; for (let i = 0; i < s.length - 1; i++) if (y <= s[i].y && y >= s[i + 1].y) { const t = (s[i].y - y) / (s[i].y - s[i + 1].y), a = s[i], b = s[i + 1]; return { zf: lerp(a.zf, b.zf, t), d: lerp(a.d, b.d, t), w: lerp(a.w, b.w, t) }; } };
  const VT = []; for (let i = 0; i <= 400; i++) VT.push(vertAt0(-28 + i * 0.1)); // tabela da coluna (0,1 cm)
  const vertAt = (y) => VT[clamp(Math.round((y + 28) * 10), 0, 400)];
  const inSpine = (x, y, z, m = 0.2) => { const v = vertAt(y), cz = v.zf - v.d / 2; return ((x / (v.w / 2 + m)) ** 2 + ((z - cz) / (v.d / 2 + m)) ** 2) < 1; };
  for (const s of ['R', 'L']) {
    const D = DOME[s];
    for (let k = 0; k < NPH; k++) {
      const ph = -Math.PI + (k + 0.5) * (2 * Math.PI / NPH), c = Math.cos(ph), sn = Math.sin(ph), y = yDE[s][k];
      const out = (r) => { const xs = D.x + c * r, z = D.z + sn * r; return xs < -0.9 || cageF(xs, y, z, SKIRT_IN) >= 0 || inSpine(xs, y, z, 0.35); };
      let r = 0.5;
      for (; r < 16; r += 0.3) if (out(r)) break;
      let lo = Math.max(0.5, r - 0.3), hi = r;
      for (let it = 0; it < 6; it++) { const m = (lo + hi) / 2; if (out(m)) hi = m; else lo = m; }
      rhoW[s][k] = (lo + hi) / 2;
    }
  }
  const P_DOME = 1.9;
  function Hside(s, xs, z) {
    const D = DOME[s], dx = xs - D.x, dz = z - D.z, ph = Math.atan2(dz, dx);
    const sR = hyp(dx, dz) / tabAt(rhoW[s], ph), lb = tabAt(yDE[s], ph);
    return lb + (D.top - lb) * (1 - Math.pow(sR, P_DOME));
  }
  const HG = { x0: -16, z0: -17, h: 0.25, nx: 129, nz: 97 };
  HG.F = new Float32Array(HG.nx * HG.nz);
  for (let k = 0; k < HG.nz; k++) for (let i = 0; i < HG.nx; i++) {
    const x = HG.x0 + i * HG.h, z = HG.z0 + k * HG.h;
    let H = smax(Hside('R', x, z), Hside('L', -x, z), 0.9);
    H = smax(H, -16.15 - 0.075 * (x * x + 1.7 * (z + 1.6) * (z + 1.6)), 0.8); // platô do centro tendíneo
    HG.F[k * HG.nx + i] = H;
  }
  function Hdia(x, z) {
    let fx = (x - HG.x0) / HG.h, fz = (z - HG.z0) / HG.h;
    fx = clamp(fx, 0, HG.nx - 1.001); fz = clamp(fz, 0, HG.nz - 1.001);
    const i = fx | 0, k = fz | 0, u = fx - i, v = fz - k, F = HG.F, q = k * HG.nx + i;
    const a = F[q] + (F[q + 1] - F[q]) * u, b = F[q + HG.nx] + (F[q + HG.nx + 1] - F[q + HG.nx]) * u;
    return a + (b - a) * v;
  }
  /** Altura da face TORÁCICA do diafragma na coluna (x,z): meia-espessura medida na vertical (÷ cos da inclinação). */
  const HT = new Float32Array(HG.nx * HG.nz);
  for (let k = 0; k < HG.nz; k++) for (let i = 0; i < HG.nx; i++) {
    const q = k * HG.nx + i, F = HG.F;
    const gx = (F[k * HG.nx + Math.min(HG.nx - 1, i + 1)] - F[k * HG.nx + Math.max(0, i - 1)]) / (2 * HG.h), gz = (F[Math.min(HG.nz - 1, k + 1) * HG.nx + i] - F[Math.max(0, k - 1) * HG.nx + i]) / (2 * HG.h);
    HT[q] = F[q] + (DIA_TH / 2) * Math.min(2.5, Math.sqrt(1 + gx * gx + gz * gz));
  }
  function HdiaTop(x, z) {
    let fx = (x - HG.x0) / HG.h, fz = (z - HG.z0) / HG.h;
    fx = clamp(fx, 0, HG.nx - 1.001); fz = clamp(fz, 0, HG.nz - 1.001);
    const i = fx | 0, k = fz | 0, u = fx - i, v = fz - k, q = k * HG.nx + i;
    const a = HT[q] + (HT[q + 1] - HT[q]) * u, b = HT[q + HG.nx] + (HT[q + HG.nx + 1] - HT[q + HG.nx]) * u;
    return a + (b - a) * v;
  }
  const sideOf = (x) => (x >= 0 ? 'R' : 'L');
  const yLBat = (x, z) => { const s = sideOf(x), xs = Math.abs(x); return tabAt(yLB[s], domePhi(s, xs, z)); };
  const yRFat = (x, z) => { const s = sideOf(x), xs = Math.abs(x); return tabAt(yRF[s], domePhi(s, xs, z)); };
  const yDEat = (x, z) => { const s = sideOf(x), xs = Math.abs(x); return tabAt(yDE[s], domePhi(s, xs, z)); };
  const yATat = (x, z) => { const s = sideOf(x), xs = Math.abs(x); return tabAt(yAT[s], domePhi(s, xs, z)); };
  /** Centro tendíneo (trevo: folíolos anterior, direito e esquerdo), borda nítida — cor e espessura da lâmina. */
  const tendonEdge = (x, z) => {
    const e = (cx, cz, a, b) => 1 - sstep(0.93, 1.03, hyp((x - cx) / a, (z - cz) / b));
    return Math.max(e(0, -1.6, 3.6, 2.6), e(3.3, -5.4, 2.0, 3.0), e(-3.3, -5.4, 2.0, 3.0));
  };

  /* ---- linha de inserção e borda da zona de aposição do diafragma, numa grade polar GLOBAL (centro x=0, z=GZ) ----
     RB/YB: raio e altura da borda superior da aposição (= borda inferior do pulmão junto à parede);
     YA: altura da inserção (margem costal, xifoide, ligamento arqueado mediano, pilares); RS: raios da saia. */
  const DG = { NU: 156, NS: 6, GZ: -3.5 };
  const AOD = chain(LM.vessels.aorta.pts.slice(6), LM.vessels.aorta.r.slice(6), 16);
  const diaOut = (x, y, z) => cageF(Math.abs(x), y, z, SKIRT_IN) >= 0 || inSpine(x, y, z, 0.3) || (y < -13 && x < 1.2 && x > -4.6 && z < -4 && AOD.d(x, y, z) < 0.35);
  const rayR = (c, sn, y, r0) => {
    let r = r0 || 0.3; for (; r < 17; r += 0.5) if (diaOut(c * r, y, DG.GZ + sn * r)) break;
    let lo = Math.max(0.3, r - 0.5), hi = r; for (let i = 0; i < 8; i++) { const m = (lo + hi) / 2; if (diaOut(c * m, y, DG.GZ + sn * m)) hi = m; else lo = m; } return lo;
  };
  const smoothC = (A, n, passes) => { const T = new Float32Array(n); for (let p = 0; p < passes; p++) { for (let i = 0; i < n; i++) T[i] = (A[(i + n - 2) % n] + 2 * A[(i + n - 1) % n] + 3 * A[i] + 2 * A[(i + 1) % n] + A[(i + 2) % n]) / 9; A.set(T); } };
  const angU = (th) => { let f = th / (2 * Math.PI) * DG.NU; f = ((f % DG.NU) + DG.NU) % DG.NU; const i0 = Math.floor(f) % DG.NU; return [i0, (i0 + 1) % DG.NU, f - Math.floor(f)]; };
  const tabU = (A, th) => { const [a, b, u] = angU(th); return A[a] + (A[b] - A[a]) * u; };
  {
    const { NU, NS, GZ } = DG;
    const RB = DG.RB = new Float32Array(NU), YB = DG.YB = new Float32Array(NU), YA = DG.YA = new Float32Array(NU), RS = DG.RS = new Float32Array(NU * (NS + 1));
    // direção da aorta no hiato (T12): ligamento arqueado mediano à frente dela; pilares D e E de cada lado
    const thAo = Math.atan2(-6.35 - GZ, -1.0) + 2 * Math.PI, dAng = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
    for (let i = 0; i < NU; i++) {
      const th = (i / NU) * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th);
      let y = -18, r = 0;
      for (let it = 0; it < 3; it++) { r = rayR(c, sn, y); y = yDEat(c * r, GZ + sn * r); }
      RB[i] = r; YB[i] = y; YA[i] = Math.min(yATat(c * r, GZ + sn * r), y - 1.2);
      const da = Math.abs(dAng(th, thAo));
      YA[i] = lerp(YA[i], Math.max(YA[i], -22.4), 1 - sstep(0.3, 0.46, da)); // arco do ligamento arqueado mediano (T12)
    }
    smoothC(RB, NU, 3); smoothC(YB, NU, 3); smoothC(YA, NU, 2);
    for (let i = 0; i < NU; i++) { const th = (i / NU) * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th); for (let j = 0; j < NS; j++) RS[i * (NS + 1) + j] = rayR(c, sn, lerp(YA[i], YB[i], j / NS), Math.max(0.3, RB[i] - 4)); RS[i * (NS + 1) + NS] = RB[i]; }
    for (let j = 0; j < NS; j++) { const A = new Float32Array(NU); for (let i = 0; i < NU; i++) A[i] = RS[i * (NS + 1) + j]; smoothC(A, NU, 3); for (let i = 0; i < NU; i++) RS[i * (NS + 1) + j] = Math.min(A[i], RB[i] + 0.3); }
    // espessamento dos pilares (faixas musculotendíneas de cada lado do hiato aórtico)
    DG.crus = new Float32Array(NU);
    for (let i = 0; i < NU; i++) { const da = dAng((i / NU) * Math.PI * 2, thAo); DG.crus[i] = 0.42 * Math.exp(-(((da - 0.55) / 0.16) ** 2)) + 0.32 * Math.exp(-(((da + 0.6) / 0.16) ** 2)); }
  }

  /* ---- respiração: UM campo de deformação Φ(x,y,z) = (x, y + D(x,z)·F(y), z) aplicado a todas as malhas das vísceras ----
     D(x,z) = descida da coluna do diafragma (cúpulas até ~2,5 cm; centro tendíneo ~30%), limitada junto à borda
     para que a zona de aposição só encurte (≤ 60% da sua altura). F = 1 na superfície do diafragma, cai a 0 em
     direção ao ápice (lateral) ou à base do coração (medial) e, abaixo da cúpula, até a linha de inserção.
     Como Φ só altera y e é monotônica em y em cada coluna, não há dobras nem triângulos invertidos, e o que está
     dentro (pulmão na pleura, coração no pericárdio) continua dentro. */
  function dRawS(s, xs, z, H) {
    const top = DOME[s].top, at = tabAt(yAT[s], domePhi(s, xs, z));
    return -2.5 * Math.pow(clamp((H - at) / (top - at), 0, 1), 0.7);
  }
  const tendonWide = (x, z) => { const e = (cx, cz, a, b) => 1 - sstep(0.55, 1.45, hyp((x - cx) / a, (z - cz) / b)); return Math.max(e(0, -1.6, 3.6, 2.6), e(3.3, -5.4, 2.0, 3.0), e(-3.3, -5.4, 2.0, 3.0)); };
  const dRaw = (x, z, H) => lerp(dRawS('L', -x, z, H), dRawS('R', x, z, H), sstep(-1.5, 1.5, x)) * (1 - 0.68 * tendonWide(x, z));
  const DD = new Float32Array(HG.nx * HG.nz);
  {
    const { NU, GZ, RB, YB, YA } = DG, DRIM = new Float32Array(NU), ARIM = new Float32Array(NU);
    for (let i = 0; i < NU; i++) {
      const th = (i / NU) * Math.PI * 2, xb = Math.cos(th) * RB[i], zb = GZ + Math.sin(th) * RB[i];
      const raw = dRaw(xb, zb, YB[i]); ARIM[i] = Math.min(1, 0.6 * (YB[i] - YA[i]) / Math.max(1e-3, -raw)); DRIM[i] = raw * ARIM[i];
    }
    smoothC(DRIM, NU, 2); smoothC(ARIM, NU, 2);
    for (let k = 0; k < HG.nz; k++) for (let i = 0; i < HG.nx; i++) {
      const x = HG.x0 + i * HG.h, z = HG.z0 + k * HG.h, th = Math.atan2(z - GZ, x), rn = hyp(x, z - GZ) / tabU(RB, th);
      DD[k * HG.nx + i] = rn >= 1 ? tabU(DRIM, th) : dRaw(x, z, Hdia(x, z)) * (1 - (1 - tabU(ARIM, th)) * sstep(0.3, 1, rn));
    }
  }
  { // suaviza D (σ ≈ 0,6 cm): sem rugas na cúpula anterior durante a inspiração
    const T = new Float32Array(DD.length), nx = HG.nx, nz = HG.nz;
    for (let p = 0; p < 12; p++) {
      T.set(DD); for (let k = 0; k < nz; k++) for (let i = 1; i < nx - 1; i++) { const q = k * nx + i; DD[q] = (T[q - 1] + 2 * T[q] + T[q + 1]) * 0.25; }
      T.set(DD); for (let k = 1; k < nz - 1; k++) for (let i = 0; i < nx; i++) { const q = k * nx + i; DD[q] = (T[q - nx] + 2 * T[q] + T[q + nx]) * 0.25; }
    }
  }
  function Dat(x, z) {
    let fx = (x - HG.x0) / HG.h, fz = (z - HG.z0) / HG.h;
    fx = clamp(fx, 0, HG.nx - 1.001); fz = clamp(fz, 0, HG.nz - 1.001);
    const i = fx | 0, k = fz | 0, u = fx - i, v = fz - k, q = k * HG.nx + i;
    const a = DD[q] + (DD[q + 1] - DD[q]) * u, b = DD[q + HG.nx] + (DD[q + HG.nx + 1] - DD[q + HG.nx]) * u;
    return a + (b - a) * v;
  }
  const PHI_TOP = LM.pleura.cupulaApex[1] + 1.8;
  function phiY(x, y, z) {
    const d = Dat(x, z); if (d > -1e-4) return y;
    // fora da borda (colunas da saia/recesso, onde a cúpula já desceu abaixo da borda) a referência é a borda YB
    const th = Math.atan2(z - DG.GZ, x), rn = hyp(x, z - DG.GZ) / tabU(DG.RB, th), H0 = Hdia(x, z);
    const H = rn < 0.9 ? H0 : lerp(H0, Math.max(H0, tabU(DG.YB, th)), sstep(0.9, 1.05, rn));
    if (y >= H) {
      const top = lerp(-8.0, PHI_TOP, sstep(2.2, 6.5, Math.abs(x)));
      return y >= top ? y : y + d * Math.pow(1 - sstep(H, top, y), 1.15);
    }
    const at = Math.min(tabU(DG.YA, th), H - 0.6);
    return y + d * clamp((y - at) / (H - at), 0, 1);
  }

  TM('dia');
  /* ======================= coração (campo implícito) =======================
     Câmaras como primitivas suaves unidas (smin): VE cônico com ápice em LM.heart.apex; VD anterior
     com infundíbulo até a valva pulmonar; AD recebendo VCS (LM.vessels.cavoatrialJunction) e VCI;
     AE posterior (face anterior do esôfago); aurículas; raiz da aorta (até LM.vessels.aorta.pts[0]). */
  const HA = LM.heart.apex, AO = LM.vessels.aorta, CAJ = LM.vessels.cavoatrialJunction;
  function egg(B, A, R, ex = 0.62) {
    const b = V(B), a = V(A), ax = a.clone().sub(b), L = ax.length(); ax.normalize();
    const pr = (t) => R * Math.pow(Math.max(0, 4 * t * (1 - t)), ex);
    return {
      bb: [Math.min(B[0], A[0]) - R, Math.min(B[1], A[1]) - R, Math.min(B[2], A[2]) - R, Math.max(B[0], A[0]) + R, Math.max(B[1], A[1]) + R, Math.max(B[2], A[2]) + R],
      d(x, y, z) {
        const px = x - b.x, py = y - b.y, pz = z - b.z, s = px * ax.x + py * ax.y + pz * ax.z;
        const rho = Math.sqrt(Math.max(0, px * px + py * py + pz * pz - s * s));
        const t = 0.1 + 0.9 * s / L; // t'=0.1 na base (base larga), 1 no ápice
        if (t >= 1) return hyp(rho, s - L);
        if (s <= 0) return hyp(Math.max(0, rho - pr(0.1)), s); // base plana (coberta pelos átrios)
        return (rho - pr(t)) * 0.85;
      },
    };
  }
  function ell(c, radii, u1, u2) { // elipsoide orientado (u1,u2 ⟂; u3 = u1×u2)
    const e1 = V(u1).normalize(), e2 = V(u2).sub(e1.clone().multiplyScalar(V(u2).dot(e1))).normalize(), e3 = new THREE.Vector3().crossVectors(e1, e2);
    const [a, b2, c2] = radii, m = Math.min(a, b2, c2), R = Math.max(a, b2, c2);
    return {
      bb: [c[0] - R, c[1] - R, c[2] - R, c[0] + R, c[1] + R, c[2] + R],
      d(x, y, z) { const px = x - c[0], py = y - c[1], pz = z - c[2]; const p1 = (px * e1.x + py * e1.y + pz * e1.z) / a, p2 = (px * e2.x + py * e2.y + pz * e2.z) / b2, p3 = (px * e3.x + py * e3.y + pz * e3.z) / c2; return (Math.sqrt(p1 * p1 + p2 * p2 + p3 * p3) - 1) * m; },
    };
  }
  const PATH = {
    // tronco pulmonar: valva (anterior-esquerda à raiz aórtica) → bifurcação na concavidade do arco
    pt: [[-1.4, -8.6, -0.65], [-2.4, -7.5, -1.45], [-2.65, -6.6, -2.3], [-2.5, -6.1, -3.0]], ptR: [1.22, 1.2, 1.12, 1.05],
    rpa: [[-2.5, -6.1, -3.0], [-1.55, -7.25, -4.3], [0.0, -6.98, -4.95], [1.6, -7.3, -4.8], [2.6, -7.45, -4.78], [3.65, -7.55, -4.95]], rpaR: [0.95, 0.76, 0.76, 0.75, 0.73, 0.68],
    lpa: [[-2.5, -6.1, -3.0], [-3.3, -5.55, -3.9], [-4.0, -5.6, -4.5], [-4.75, -5.85, -4.85]], lpaR: [0.95, 0.8, 0.76, 0.7],
    rspv: [[1.3, -9.45, -4.75], [2.6, -9.1, -4.68], [3.65, -8.9, -4.6]], rspvR: 0.58,
    ripv: [[1.3, -10.5, -5.0], [2.6, -10.8, -5.15], [3.55, -11.0, -5.3]], ripvR: 0.56,
    lspv: [[-2.1, -9.55, -4.7], [-3.3, -9.15, -4.6], [-4.35, -8.7, -4.5]], lspvR: 0.56,
    lipv: [[-2.0, -10.45, -5.0], [-3.2, -10.75, -5.25], [-4.15, -10.95, -5.45]], lipvR: 0.53,
    ivc: [[2.2, -14.4, -3.45], [2.2, -16.6, -4.0], [2.15, -19.8, -4.6]], ivcR: 1.08,
    // brônquios principais: D mais curto, largo e vertical (~40° da vertical); E mais longo e oblíquo (~51°), sob o
    // arco aórtico — ângulo carinal ≈ 88° (antes 106°)
    rmb: [LM.trachea.carina, [1.1, -5.95, -5.95], [2.0, -7.05, -6.25]], rmbR: [0.78, 0.75, 0.72],
    lmb: [LM.trachea.carina, [-0.6, -5.5, -5.35], [-1.55, -6.2, -5.45], [-2.65, -7.1, -5.2], [-3.6, -7.9, -5.15]], lmbR: [0.7, 0.64, 0.62, 0.6, 0.57],
  };
  // brônquios lobares iniciais (o segmento proximal fica no hilo; o distal, dentro do parênquima do lobo)
  const lobar = [
    ['bronchus-RUL', 'Brônquio lobar superior direito (eparterial)', [[1.5, -6.4, -6.08], [2.5, -5.9, -6.3], [3.5, -5.4, -6.4], [4.5, -4.75, -6.5]], [0.45, 0.42, 0.38, 0.34]],
    ['bronchus-RI', 'Brônquio intermédio (direito)', [PATH.rmb[2], [2.6, -8.2, -6.4], [3.0, -9.3, -6.5]], [0.62, 0.58, 0.56]],
    ['bronchus-RML', 'Brônquio lobar médio', [[3.0, -9.3, -6.4], [3.8, -10.2, -5.4], [4.6, -11.0, -4.4]], [0.4, 0.36, 0.32]],
    ['bronchus-RLL', 'Brônquio lobar inferior direito', [[3.0, -9.3, -6.5], [3.35, -10.8, -7.2], [3.85, -12.4, -7.95]], [0.5, 0.46, 0.4]],
    ['bronchus-LUL', 'Brônquio lobar superior esquerdo', [PATH.lmb[4], [-4.6, -7.3, -5.5], [-5.6, -6.7, -5.85]], [0.46, 0.42, 0.38]],
    ['bronchus-LLL', 'Brônquio lobar inferior esquerdo', [PATH.lmb[4], [-4.2, -9.2, -6.0], [-4.8, -10.8, -7.0]], [0.5, 0.46, 0.4]],
  ];
  const LOBAR_HILUM = { 'bronchus-RUL': 0.45, 'bronchus-RI': 1, 'bronchus-RML': 0.3, 'bronchus-RLL': 0.3, 'bronchus-LUL': 0.4, 'bronchus-LLL': 0.35 };
  // ázigo (eixo coerente com o módulo de vasos) — só para a impressão no pulmão D
  const AZY = [[1.5, -23.0, -6.75], [1.45, -19.5, -7.15], [1.4, -15.5, -7.35], [1.35, -11.5, -7.4], [1.4, -8.0, -7.4], [1.55, -5.6, -7.2], [1.9, -4.0, -6.55], [2.2, -3.45, -5.45], [2.42, -3.75, -4.35], [2.5, -4.35, -3.55], [2.5, -4.65, -2.85]];
  const HP = {
    lv: egg([-1.3, -10.9, -3.7], HA, 2.85),
    rv: ell([-0.9, -13.1, 0.0], [3.9, 2.3, 1.75], [-1, -0.25, 0.18], [0.1, 1, 0.25]),
    rvApex: ell([-3.6, -14.3, 0.75], [2.0, 1.45, 1.25], [-1, -0.45, 0.3], [0, 1, 0.3]),
    conus: chain([[-0.5, -11.9, 0.1], [-1.0, -10.2, -0.15], [-1.4, -8.75, -0.6]], [1.35, 1.25, 1.18], 4),
    ra: ell([2.55, -11.7, -2.6], [1.6, 2.9, 2.1], [1, 0, 0.12], [0, 1, 0.05]),
    svcIn: chain([CAJ, [2.45, -10.3, -2.75]], 1.02, 1),
    ivcIn: chain([PATH.ivc[0], [2.2, -14.9, -3.65]], 1.08, 1),
    rau: ell([1.75, -9.05, -0.45], [1.55, 0.78, 0.42], [-1.0, 0.22, 0.62], [0.1, 1, 0.05]),
    la: ell([-0.4, -9.95, -4.45], [2.35, 1.35, 1.2], [1, 0, 0], [0, 1, 0]),
    lau: ell([-3.05, -8.85, -2.45], [1.45, 0.66, 0.4], [-0.55, 0.28, 1.0], [0, 1, 0]),
    aoRoot: chain([[-1.0, -10.7, -3.0], AO.pts[0]], [1.2, AO.r[0]], 1),
    pv: ['rspv', 'ripv', 'lspv', 'lipv'].map((k) => chain([PATH[k][0], PATH[k][1]], PATH[k + 'R'], 1)),
  };
  const PERI_TH = 0.42; // distância coração → face externa do pericárdio
  /** Recuo do pericárdio em relação à face interna da parede anterior: 0,8 cm (lâminas pulmonares e pleura passam
      à frente) → 0,3 cm na área nua (à E da linha média, abaixo da 4ª cartilagem). */
  const periInset = (x, y) => lerp(1.0, 0.3, sstep(0.2, -1.2, x) * (1 - sstep(-3.2, -4.4, x)) * sstep(-9.4, -10.6, y));
  /** Vasos torácicos internos ESQUERDOS na altura da área nua: passam à frente do pericárdio (sulco raso). */
  const ITL = [chain(C.mirror(LM.vessels.itaR.pts.slice(3)), 0.17, 6), chain([[-2.58, -9.0, 0.62], [-2.6, -13.3, 1.8]], 0.18, 4)];
  const itlD = (x, y, z) => (x > -1.6 || y > -7.5 ? 9 : Math.min(ITL[0].d(x, y, z), ITL[1].d(x, y, z)));
  /** Campo do coração. */
  function heartF(x, y, z) {
    const vent = smin(HP.lv.d(x, y, z), smin(HP.rv.d(x, y, z), HP.rvApex.d(x, y, z), 0.8), 0.7);
    const ventC = smin(vent, HP.conus.d(x, y, z), 1.0);
    let atr = smin(HP.ra.d(x, y, z), smin(HP.svcIn.d(x, y, z), HP.ivcIn.d(x, y, z), 0.4), 0.5);
    atr = smin(atr, HP.rau.d(x, y, z), 0.35);
    let la = smin(HP.la.d(x, y, z), HP.lau.d(x, y, z), 0.35);
    for (const p of HP.pv) la = smin(la, p.d(x, y, z), 0.3);
    let f = smin(ventC, atr, 0.32);
    f = smin(f, la, 0.32);
    f = smin(f, HP.aoRoot.d(x, y, z), 0.3);
    // face diafragmática plana sobre o centro tendíneo (espaço para o pericárdio fibroso)
    f = smax(f, HdiaTop(x, z) + 0.5 - y, 0.5);
    // face esternocostal afastada da parede: deixa passar as bordas anteriores dos pulmões/recessos costomediastinais
    // (exceto na "área nua", à E da linha média abaixo da 4ª cartilagem, onde o pericárdio toca a parede)
    f = smax(f, PERI_TH + 0.14 - itlD(x, y, z), 0.3);
    return smax(f, z - (zWall(Math.abs(x), y) - PERI_TH - periInset(x, y)), 0.6);
  }
  const HEART_BOX = [-8.9, -16.7, -6.7, 5.0, -7.2, 3.0];

  TM('heartdef');
  /* ======================= mediastino (distância assinada em grade) ======================= */
  const VS = LM.vessels;
  // grade do coração (também usada para pericárdio e mediastino)
  TM('hd0');
  const HGd = Grid(HEART_BOX[0], HEART_BOX[1], HEART_BOX[2], HEART_BOX[3], HEART_BOX[4], HEART_BOX[5], 0.24).fillNarrow(heartF, 0.62);
  const heartAt = (x, y, z) => HGd.at(x, y, z, 3);
  TM('hgrid');
  const MED = Grid(-9.5, -27.5, -14, 9.5, 6, 6, 0.3);
  MED.F.fill(3);
  const medChains = [
    [LM.trachea.pts, LM.trachea.r, 16, 0.04], [PATH.rmb, PATH.rmbR, 4, 0.03], [PATH.lmb, PATH.lmbR, 6, 0.03],
    [LM.esophagus.pts, LM.esophagus.r, 26, 0.06], [AO.pts, AO.r, 30, 0.04],
    [VS.svc.pts, VS.svc.r, 6, 0.03], [VS.rbcv.pts, VS.rbcv.r, 3, 0.03], [VS.lbcv.pts, VS.lbcv.r, 7, 0.03],
    [VS.bct.pts, VS.bct.r, 4, 0.03], [VS.ccaL.pts.slice(0, 3), VS.ccaL.r.slice(0, 3), 6, 0.03], [VS.ccaR.pts.slice(0, 2), 0.45, 3, 0.03],
    [VS.scaL.pts.slice(0, 8), VS.scaL.r.slice(0, 8), 12, 0.16], [VS.scaR.pts.slice(0, 6), VS.scaR.r.slice(0, 6), 9, 0.16], // sulcos da subclávia no ápice
    [AZY, 0.45, 20, 0.04],
    [PATH.pt, PATH.ptR, 4, 0.03], [PATH.rpa, PATH.rpaR, 8, 0.03], [PATH.lpa, PATH.lpaR, 5, 0.03],
    ...['rspv', 'ripv', 'lspv', 'lipv'].map((k) => [PATH[k], PATH[k + 'R'], 3, 0.03]),
    [PATH.ivc, PATH.ivcR, 4, 0.03],
  ];
  // vasos torácicos internos: só o próprio vaso (+ folga) — pulmão e pleura passam ATRÁS deles (vistos sobre o pulmão)
  {
    const ita = VS.itaR.pts.slice(1), itvR = [[2.6, -13.3, 1.8], [2.58, -9.0, 0.62], [2.58, -5.6, -0.3], [2.6, -3.9, -0.62], [2.62, -3.0, -0.95], [2.62, -2.45, -1.3], [2.58, -1.95, -1.85]];
    const itvL = C.mirror(itvR.slice(0, 4)).concat([[-2.6, -2.85, -1.05], [-2.58, -2.0, -1.5], [-2.53, -1.2, -1.8]]);
    for (const pts of [ita, C.mirror(ita), itvR, itvL]) medChains.push([pts, 0.18, 12, -0.05]);
  }
  // ápice: veia subclávia (anterior), escaleno anterior, tronco inferior do plexo, VJI e artéria vertebral — a cúpula
  // fica posterior/inferior a eles (sulcos rasos), nunca atravessada
  {
    const SA = LM.muscles.scaleneAnt, saR = SA.pts.map((_, i) => 0.5 * (SA.w[i] + SA.t[i]) * 0.85);
    const T1 = LM.nerves.plexusTrunks[2].pts.slice(0, 5);
    for (const L of [false, true]) {
      const m = (P) => (L ? C.mirror(P) : P);
      medChains.push([m(VS.scv.pts), VS.scv.r, 6, 0.18], [m(SA.pts), saR, 6, 0.1], [m(T1), 0.28, 6, 0.08],
        [m(VS.ijvR.pts.slice(3)), VS.ijvR.r.slice(3), 3, 0.1], [m(VS.vertebralAR.pts.slice(0, 3)), 0.22, 4, 0.08]);
    }
  }
  // preenchimentos (tecido conjuntivo/gordura/linfonodos do mediastino) onde o pulmão não deve entrar:
  // entre o arco da ázigo e a traqueia; atrás/abaixo do coração (entre esôfago, VCI e pericárdio)
  // raiz do pulmão: segmentos proximais dos brônquios lobares (o pulmão não os envolve no hilo)
  lobar.forEach(([id, , pts, r]) => { const S = C.sample(pts, 16), rf = C.profile(r), k = Math.max(2, Math.round(16 * LOBAR_HILUM[id])); medChains.push([S.slice(0, k), S.slice(0, k).map((_, i) => rf(i / 15)), 0, 0.05]); });
  // raízes pulmonares (tecido conjuntivo, linfonodos broncopulmonares e o manguito pleural em torno do pedículo)
  medChains.push([[[1.6, -7.3, -5.3], [2.9, -8.0, -5.4]], 1.15, 2, 0], [[[-1.9, -7.1, -4.9], [-3.1, -7.5, -5.0]], 1.15, 2, 0]);
  medChains.push([[[2.3, -3.55, -5.4], [1.0, -3.9, -4.9], [1.35, -4.65, -4.95]], 0.75, 3, 0], [[[0.3, -11, -5.6], [0.0, -14, -5.0], [-0.4, -17, -4.6]], 1.55, 5, 0]);
  TM('m0');
  medChains.forEach(([pts, r, n, off]) => MED.splatChain(pts, r, n, 0.8, off));
  // coluna (corpos vertebrais elípticos)
  MED.splat({ bb: [-2.4, -27.5, -11.5, 2.4, 11, -3.5], d: (x, y, z) => { const v = vertAt(y), cz = v.zf - v.d / 2, a = v.w / 2 + 0.15, b = v.d / 2 + 0.1; return (hyp(x / a, (z - cz) / b) - 1) * Math.min(a, b); } }, 1.0);
  // mediastino anterior (gordura, ligamentos esternopericárdicos): cunha estreita atrás do esterno entre as bordas
  // pleurais anteriores — faz as bordas anteriores dos pulmões afilarem em gume (recessos costomediastinais)
  MED.splat({ bb: [-4, -17, -4, 4, 0.6, 4], d: (x, y, z) => {
    const zs = zBack(Math.min(y, 0.2)), depth = zs - z, w0 = 0.12 + 2.1 * sstep(-4.6, 0.4, y);
    let d = Math.max((Math.abs(x) - (w0 + Math.max(0, depth) * 0.35)) * 0.85, depth - 3.2);
    return Math.max(d, y - 0.4, -16.8 - y);
  } }, 0.6);
  /* timo remanescente (adulto): dois lobos adiposos achatados, triangulares (estreitos em cima, largos embaixo) e
     lobulados, atrás do manúbrio e da parte superior do corpo do esterno, ABAIXO da VBC esquerda e à frente da aorta
     ascendente/arco e do pericárdio superior; abaixo do ângulo do esterno ficam atrás das reflexões pleurais. */
  const thyZf = (y) => zBack(Math.min(y, 0.2)) - 0.08 - 0.55 * sstep(-3.6, -5.0, y);
  const THY_LOBES = [{ xc: 0.5, y0: -2.5, y1: -5.3, w0: 0.42, w1: 0.74, t: 0.19 }, { xc: -0.6, y0: -2.2, y1: -5.75, w0: 0.46, w1: 0.86, t: 0.21 }];
  function thymusF(x, y, z) {
    let f = 3;
    for (const L of THY_LOBES) {
      const hl = (L.y0 - L.y1) / 2, v = (y - (L.y0 + L.y1) / 2) / hl, s = clamp((1 - v) / 2, 0, 1);
      const w = lerp(L.w0, L.w1, s * s * (3 - 2 * s)) * (1 - 0.25 * Math.max(0, v) ** 2), zc = thyZf(y) - L.t;
      const xc = L.xc + 0.08 * (1 - s) * Math.sign(L.xc); // polos superiores ligeiramente divergentes
      const t = L.t * (1 - 0.3 * s * s), q = ((x - xc) / w) ** 2 + ((z - (zc + L.t - t)) / t) ** 2 + v ** 4;
      f = Math.min(f, (Math.sqrt(q) - 1) * t * 1.2);
    }
    return f;
  }
  const THY_BB = [-2.0, -7.3, -2.2, 1.9, -1.6, 0.9];
  MED.splat({ bb: THY_BB, d: thymusF }, 0.4, 0.04);
  // pericárdio fibroso: coração + bainhas das grandes artérias/veias, base fundida ao centro tendíneo
  const periSleeves = [chain([AO.pts[0], AO.pts[1], [-0.1, -5.6, -2.42]], [1.36, 1.38, 1.34], 4), chain([[2.5, -5.7, -2.5], CAJ], 1.02, 2), chain(PATH.pt, PATH.ptR, 4)];
  function periF(x, y, z, off = PERI_TH) {
    let f = Math.min(heartAt(x, y, z), heartAt(x, y + 0.8, z)) - off;
    for (const s of periSleeves) f = smin(f, s.d(x, y, z) - 0.24, 0.5); // pericárdio justo sobre as raízes dos grandes vasos
    f = smax(f, z - (zWall(Math.abs(x), y) - periInset(x, y)), 0.4);
    f = smax(f, 0.12 - itlD(x, y, z), 0.25);
    return smax(f, HdiaTop(x, z) + 0.01 - y, 0.25);
  }
  TM('mchains');
  {
    const sb = periSleeves.map((c) => c.bb);
    const inSB = (x, y, z) => sb.some((b) => x > b[0] - 1.2 && x < b[3] + 1.2 && y > b[1] - 1.2 && y < b[4] + 1.2 && z > b[2] - 1.2 && z < b[5] + 1.2);
    MED.splat({ bb: [-9.2, -17.4, -7.4, 5.5, -3.2, 3.6], d: (x, y, z) => { const h0 = heartAt(x, y, z); if (h0 > 2.2 && heartAt(x, y + 0.8, z) > 2.2 && !inSB(x, y, z)) return 3; return periF(x, y, z); } }, 0.4);
  }
  TM('medsplat');
  // só no mediastino médio/posterior e hilos (z < −2,2): à frente, as bordas anteriores finas dos pulmões precisam
  // passar entre a parede e o pericárdio/timo/vasos torácicos internos
  closeField(MED, 0.8, [-7.5, -21, -11.5, 7.5, 5.5, -2.2]);

  TM('med');

  /* ======================= pulmões e pleura (campos) ======================= */
  const APEX = LM.pleura.cupulaApex;
  /* Cúpula pleural = domo apoiado no ANEL INTERNO DA 1ª COSTELA (abertura superior do tórax), com cume em
     LM.pleura.cupulaApex. Abaixo do anel só o gradil governa (o pulmão preenche todo o hemitórax junto às
     costelas 2–4); acima dele, em cada direção ψ em torno do eixo do cume, o perfil é um quarto de elipse do
     anel (r1, y1) até o cume. Medialmente o anel é fechado atrás do manúbrio/mediastino (o MED esculpe a face
     mediastinal). Posteriormente o colo da 1ª costela fica ~no nível do cume: y1 é limitado a cume − 0,35. */
  const DM = { x: APEX[0], z: APEX[2], y: APEX[1], N: 120 };
  {
    const R1 = ribPolar[0].map((s) => [CX + Math.cos(s.phi) * s.rho, s.y, CZ + Math.sin(s.phi) * s.rho]);
    const a = R1[R1.length - 1], b = R1[0];
    // fechamento medial baixo: a face medial do ápice desce em direção à traqueia/esôfago (sem "bossa" medial)
    const poly = R1.concat([[0.7, a[1] + 0.4, -1.5], [0.45, 0.1, -3.9], [0.7, 1.5, -6.1]]);
    DM.r1 = new Float32Array(DM.N); DM.y1 = new Float32Array(DM.N);
    for (let k = 0; k < DM.N; k++) {
      const ps = -Math.PI + (k / DM.N) * 2 * Math.PI, ux = Math.cos(ps), uz = Math.sin(ps);
      let best = 1e9, by = 0;
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i], q = poly[(i + 1) % poly.length];
        // interseção raio (A + t·u) × segmento p→q no plano xz
        const ex = q[0] - p[0], ez = q[2] - p[2], den = ux * ez - uz * ex; if (Math.abs(den) < 1e-9) continue;
        const wx = p[0] - DM.x, wz = p[2] - DM.z, t = (wx * ez - wz * ex) / den, s = (wx * uz - wz * ux) / den;
        if (t > 0 && s >= 0 && s <= 1 && t < best) { best = t; by = lerp(p[1], q[1], s); }
      }
      DM.r1[k] = best < 1e8 ? best : 3; DM.y1[k] = by;
    }
    const T = new Float32Array(DM.N);
    for (const A of [DM.r1, DM.y1]) for (let p = 0; p < 3; p++) { for (let k = 0; k < DM.N; k++) T[k] = (A[(k + DM.N - 1) % DM.N] + 2 * A[k] + A[(k + 1) % DM.N]) / 4; A.set(T); }
  }
  /** Campo do domo apical (lado-local), recuado `inset` (pulmão 0,12; pleura 0). */
  function domeF(xs, y, z, inset) {
    const dx = xs - DM.x, dz = z - DM.z, r = Math.sqrt(dx * dx + dz * dz);
    let fk = (Math.atan2(dz, dx) + Math.PI) / (2 * Math.PI) * DM.N; const k0 = Math.floor(fk) % DM.N, u = fk - Math.floor(fk), k1 = (k0 + 1) % DM.N;
    const R1 = DM.r1[k0] + (DM.r1[k1] - DM.r1[k0]) * u - inset, y1 = Math.min(DM.y1[k0] + (DM.y1[k1] - DM.y1[k0]) * u, DM.y - 0.35);
    const Ht = DM.y - inset - y1, h = (y - y1) / Ht;
    if (h <= 0) return r - R1 - 4 * (y1 - y);
    const a = r / R1, q = Math.sqrt(a * a + h * h), g = Math.sqrt((a / R1) * (a / R1) + (h / Ht) * (h / Ht)) / (q || 1e-6);
    return (q - 1) / Math.max(g, 1e-3);
  }
  /** Incisura cardíaca do pulmão E (desvio lateral da borda anterior entre a 4ª e a 6ª cartilagem) e língula. */
  const yrev = (pts) => C.profile(pts.map(([y, v]) => [(4 - y) / 22, v])); // perfil em y (de +4 a −18)
  const XA = {
    // acima do ângulo do esterno a borda anterior fica lateral à VCS/VTI (que mergulham para as braquiocefálicas)
    R: yrev([[4, 2.4], [0, 2.2], [-2.3, 2.0], [-3.4, 1.4], [-4.6, 0.55], [-6, 0.3], [-18, 0.3]]),
    // incisura cardíaca do pulmão E: começa na 4ª cartilagem (y −9,25) e chega a ~4,2 cm da linha média na 5ª–6ª;
    // abaixo dela a língula volta a avançar medialmente
    L: yrev([[4, 2.4], [0, 2.2], [-2.3, 2.0], [-3.4, 1.4], [-4.6, 0.55], [-8.6, 0.45], [-9.7, 1.5], [-10.9, 3.3], [-12.2, 4.1], [-13.4, 4.2], [-14.6, 3.4], [-15.8, 2.6], [-18, 2.5]]),
    pR: yrev([[4, 2.3], [0, 2.0], [-2.3, 0.9], [-4.6, 0.12], [-13.5, 0.15], [-15, 0.6], [-18, 1.0]]),
    pL: yrev([[4, 2.3], [0, 2.0], [-2.3, 0.9], [-4.6, 0.12], [-8.8, 0.3], [-10.0, 1.3], [-11.3, 2.3], [-14.2, 2.7], [-16, 2.6], [-18, 2.6]]),
  };
  const XAt = {}; for (const k in XA) { const T = new Float32Array(221); for (let i = 0; i <= 220; i++) T[i] = XA[k](i / 220); XAt[k] = T; }
  const xaAt = (k, y) => { const f = clamp((4 - y) / 22, 0, 1) * 220, i = Math.min(219, f | 0); return XAt[k][i] + (XAt[k][i + 1] - XAt[k][i]) * (f - i); };
  const FAR = 1.0; // retorno antecipado: longe da superfície o valor exato é irrelevante
  function lungF(side, x, y, z) {
    const L = side === 'L', xs = L ? -x : x;
    let f = cageF(xs, y, z, 0.13); if (f > FAR) return f;
    let t = domeF(xs, y, z, 0.12); if (t > FAR) return t; f = smax(f, t, 0.35);
    t = 0.15 - xs; if (t > FAR) return t; f = smax(f, t, 0.5);
    t = HdiaTop(x, z) + 0.1 - y; if (t > FAR) return t; f = smax(f, t, 0.3);
    const wall = cageF(xs, y, z, 0);
    t = yLBat(x, z) - y - 4 * sstep(0.9, 2.2, -wall); if (t > FAR) return t; f = smax(f, t, 0.3); // borda inferior: só junto à parede
    t = 0.2 - MED.at(x, y, z); if (t > FAR) return t; f = smax(f, t, 0.25);
    // incisura cardíaca (E) e divergência das bordas acima do ângulo do esterno
    return smax(f, -Math.max(xs - xaAt(side, y), -1.6 - z), 0.35);
  }
  function pleuraF(side, x, y, z) {
    const L = side === 'L', xs = L ? -x : x;
    const w = cageF(xs, y, z, 0.05); if (w > FAR) return w;
    let t = domeF(xs, y, z, 0); if (t > FAR) return t;
    let main = smax(w, t, 0.35);
    main = smax(main, 0.12 - xs, 0.25);
    const ph = domePhi(side, xs, z), rf = tabAt(yRF[side], ph);
    if (rf - y > FAR) return rf - y;
    main = smax(main, HdiaTop(x, z) + 0.06 - y, 0.25);
    t = 0.07 - MED.at(x, y, z); if (t > FAR) return t; main = smax(main, t, 0.2);
    main = smax(main, -Math.max(xs - xaAt(L ? 'pL' : 'pR', y), -1.4 - z), 0.3);
    if (w < -1.2) return main; // longe da parede: o recesso não contribui
    // recesso costodiafragmático: faixa junto à parede até a linha de reflexão (LM.pleura.reflection)
    // limite interno ≈ 0,31 cm: a pleura do recesso fica entre a parede e a face torácica da zona de aposição
    let band = smax(w, -(w + (SKIRT_IN - DIA_TH / 2 - 0.03)), 0.08);
    band = smax(band, rf - y, 0.2);
    band = smax(band, y - tabAt(yLB[side], ph) - 1.2, 0.3);
    return smin(main, band, 0.2);
  }
  // fissuras: oblíqua (y em função de z; desce de posterior-superior para anterior-inferior) e horizontal (D)
  const fissTab = {};
  for (const sd of ['R', 'L']) {
    const P = sd === 'R' ? C.profile([[0, -4.6], [0.4, -10.0], [0.8, -14.4], [1, -16.8]]) : C.profile([[0, -4.0], [0.4, -10.3], [0.8, -14.6], [1, -16.8]]);
    const T = new Float32Array(101 * 2);
    for (let i = 0; i <= 100; i++) { const u = i / 100, sl = (P(Math.min(1, u + 0.02)) - P(Math.max(0, u - 0.02))) / (0.04 * 16.2); T[i * 2] = P(u); T[i * 2 + 1] = 1 / Math.sqrt(1 + sl * sl); }
    fissTab[sd] = T;
  }
  // à E a fissura oblíqua sobe na face mediastinal até o hilo (separa os brônquios lobares superior e inferior)
  const oblLift = (side, xs, z) => (side === 'L' ? 2.6 * Math.exp(-(((xs - 3.6) / 2.3) ** 2) - ((z + 5.6) / 2.8) ** 2) : 0);
  function gObl(side, x, y, z) { const T = fissTab[side], f = clamp((z + 13) / 16.2, 0, 1) * 100, i = Math.min(99, f | 0), u = f - i; return (y - (T[i * 2] + (T[i * 2 + 2] - T[i * 2]) * u) - oblLift(side, Math.abs(x), z)) * T[i * 2 + 1]; }
  // fissura horizontal: segue a 4ª cartilagem na face anterior (desce lateralmente) e sobe em direção ao hilo,
  // passando ACIMA do brônquio lobar médio; encontra a oblíqua na linha axilar média
  const yHor = (x, z) => -9.0 - 0.19 * (x - 2) - 0.12 * (z - 1.5);
  const gHor = (x, y, z) => y - yHor(x, z);

  const breathers = []; // {geo, base, tgt, nBase, nTarget}
  /** Registra uma malha para a respiração: alvo de inspiração = Φ(posição). `inset` ≥ 0 (pulmão 0,1; pleura 0,02)
      mantém os vértices dentro da face interna do gradil, que é fixo. */
  function addBreath(geo, inset = -1, dyOf = null) {
    if (geo.userData.breath) return; geo.userData.breath = true;
    const p = geo.attributes.position, n = geo.attributes.normal;
    const base = Float32Array.from(p.array), nBase = Float32Array.from(n.array), tgt = Float32Array.from(base);
    let moved = false;
    for (let i = 0; i < p.count; i++) {
      const x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2], ny = dyOf ? y + dyOf(i) : phiY(x, y, z);
      if (ny === y) continue;
      moved = true; tgt[i * 3 + 1] = ny;
      if (inset >= 0) {
        const xs = Math.abs(x), over = cageF(xs, ny, z, inset);
        if (over > 0) { const dx = xs - CX, dz = z - CZ, r = hyp(dx, dz) || 1; tgt[i * 3] = x - (x < 0 ? -1 : 1) * dx / r * over; tgt[i * 3 + 2] = z - dz / r * over; }
      }
    }
    if (!moved) return;
    p.array.set(tgt); fastNormals(geo);
    const nTarget = Float32Array.from(n.array);
    p.array.set(base); n.array.set(nBase); p.needsUpdate = n.needsUpdate = true;
    breathers.push({ geo, base, tgt, nBase, nTarget });
  }

  TM('fields');
  /* ---------- materiais das vísceras ---------- */
  /** Textura lobular (lóbulos secundários ~1–2 cm, septos interlobulares discretos) — Voronoi em grade
      com jitter (rápido) → {map, normal}, ladrilhável. */
  function lobuleTex(S = 192, G = 7, seed = 21) {
    const r = C.rng(seed), cell = S / G, P = [];
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) P.push([(i + 0.15 + 0.7 * r()) * cell, (j + 0.15 + 0.7 * r()) * cell]);
    const Hh = new Float32Array(S * S), cv = document.createElement('canvas'); cv.width = cv.height = S;
    const cx = cv.getContext('2d'), img = cx.createImageData(S, S);
    const base = [228, 160, 150], line = [150, 112, 122], warm = [212, 142, 140];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const gi = Math.floor(x / cell), gj = Math.floor(y / cell); let d1 = 1e9, d2 = 1e9;
      for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
        const ii = (gi + a + G) % G, jj = (gj + b + G) % G, p = P[jj * G + ii];
        const px = p[0] + (gi + a - ii) * cell, py = p[1] + (gj + b - jj) * cell, d = (x - px) ** 2 + (y - py) ** 2;
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
      }
      const e = sstep(0, 1.7, Math.sqrt(d2) - Math.sqrt(d1));
      const n = C.noise3(x * 0.066, y * 0.066, 0.3, seed), n2 = C.noise3(x * 0.2, y * 0.2, 1.7, seed + 5);
      Hh[y * S + x] = e * 0.55 + n2 * 0.45;
      const q = (y * S + x) * 4, k = 0.9 + 0.2 * n;
      // pontos antracóticos discretos ao longo dos septos interlobulares
      const dot = e < 0.6 ? (1 - e) * sstep(0.72, 0.8, C.noise3(x * 0.56, y * 0.56, 5.1, seed + 9)) : 0;
      for (let c = 0; c < 3; c++) img.data[q + c] = Math.min(255, lerp((line[c] + (lerp(base[c], warm[c], n2) - line[c]) * (0.25 + 0.75 * e)) * k, 74, dot * 0.7));
      img.data[q + 3] = 255;
    }
    cx.putImageData(img, 0, 0);
    // altura (septos baixos, lóbulos abaulados) → textura de relevo para o bump triplanar
    const hv = document.createElement('canvas'); hv.width = hv.height = S; const hx = hv.getContext('2d'), hi = hx.createImageData(S, S);
    for (let q = 0; q < S * S; q++) { const v = Hh[q] * 255; hi.data[q * 4] = hi.data[q * 4 + 1] = hi.data[q * 4 + 2] = v; hi.data[q * 4 + 3] = 255; }
    hx.putImageData(hi, 0, 0);
    const mk = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
    return { map: mk(cv, true), height: mk(hv, false) };
  }
  /** Mapeamento triplanar (cor + relevo por derivadas) — sem polos nem costuras de UV nos pulmões. */
  function triplanar(mat, tex, scale, bump) {
    mat.map = tex.map;
    const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey() : '';
    mat.onBeforeCompile = (sh, r) => {
      if (prev) prev(sh, r);
      sh.uniforms.triBump = { value: tex.height }; sh.uniforms.triScale = { value: scale }; sh.uniforms.triK = { value: bump };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 rest;\nvarying vec3 vTriPos;\nvarying vec3 vTriNrm;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTriPos = rest;\nvTriNrm = normal;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform sampler2D triBump; uniform float triScale; uniform float triK; varying vec3 vTriPos; varying vec3 vTriNrm;
vec3 triW(vec3 n) { vec3 w = pow(abs(n), vec3(4.0)); return w / (w.x + w.y + w.z); }`)
        .replace('#include <map_fragment>', `vec3 tw = triW(normalize(vTriNrm)); vec3 tp = vTriPos * triScale;
vec4 triT = texture2D(map, tp.yz) * tw.x + texture2D(map, tp.zx) * tw.y + texture2D(map, tp.xy) * tw.z;
float triH = texture2D(triBump, tp.yz).r * tw.x + texture2D(triBump, tp.zx).r * tw.y + texture2D(triBump, tp.xy).r * tw.z;
diffuseColor.rgb *= triT.rgb;`)
        .replace('#include <normal_fragment_maps>', `{ vec2 dH = vec2(dFdx(triH), dFdy(triH)) * triK; vec3 sx = dFdx(-vViewPosition), sy2 = dFdy(-vViewPosition);
  vec3 R1 = cross(sy2, normal), R2 = cross(normal, sx); float fd = dot(sx, R1) * faceDirection;
  normal = normalize(abs(fd) * normal - sign(fd) * (dH.x * R1 + dH.y * R2)); }`);
    };
    mat.customProgramCacheKey = () => 'tri' + prevKey;
    return mat;
  }
  const lobTex = lobuleTex();
  const lungMat = triplanar(C.mat({ color: '#ffffff', vertexColors: true, roughness: 0.56, sheen: 0.6, sheenRoughness: 0.45, sheenColor: '#ffd2cc', clearcoat: 0.3, clearcoatRoughness: 0.3, cut: 0xc98a8f }), lobTex, 0.145, 0.07);
  const pleuraMat = M.pleura;
  const lungColor = (side) => {
    const dep = lin('#b98c96'), soot = lin('#6f6a74');
    return (x, y, z) => {
      const xs = side === 'L' ? -x : x;
      const d = sstep(-5, -12, z) * 0.42 + sstep(-1, 3, y) * 0.1;              // posterior (pendente) mais congesta; ápice mais pálido-acinzentado
      const n = C.fbm3(x * 1.3, y * 1.3, z * 1.3, 3, side === 'L' ? 77 : 71);
      const a = sstep(0.66, 0.74, n) * 0.28 * (0.6 + 0.4 * sstep(-14, 2, y));      // pontilhado antracótico (subpleural), mais nos lobos superiores
      let c = mixc([1, 1, 1], dep, d); c = mixc(c, soot, a);
      return c;
    };
  };
  const lungUV = (side) => (x, y, z) => { const xs = side === 'L' ? -x : x; return [Math.atan2(z - CZ, xs - CX) / (2 * Math.PI) * 5.2, y / 8.5]; };

  TM('mats');
  /* ---------- pulmões: grade única por lado, lobos por interseção com as fissuras ---------- */
  const LUNG_H = 0.3, GAP = 0.08;
  const lobeDefs = {
    R: [
      { id: 'lung-R-upper', name: 'Lobo superior do pulmão direito', sel: (o, hz) => Math.max(-o, -hz) },
      { id: 'lung-R-middle', name: 'Lobo médio do pulmão direito', sel: (o, hz) => Math.max(-o, hz) },
      { id: 'lung-R-lower', name: 'Lobo inferior do pulmão direito', sel: (o) => o },
    ],
    L: [
      { id: 'lung-L-upper', name: 'Lobo superior do pulmão esquerdo (com língula)', sel: (o) => -o },
      { id: 'lung-L-lower', name: 'Lobo inferior do pulmão esquerdo', sel: (o) => o },
    ],
  };
  const lungDesc = {
    'lung-R-upper': 'Seu ápice ocupa a cúpula pleural, logo posterior e inferior à veia subclávia — o pneumotórax é a complicação mecânica típica da punção.',
    'lung-L-upper': 'Inclui a língula; a incisura cardíaca deixa o pericárdio em contato direto com a parede anterior.',
  };
  const lungMeshes = { R: [], L: [] };
  for (const side of ['R', 'L']) {
    const sg = side === 'R' ? 1 : -1;
    const box = side === 'R' ? [-0.2, -21.2, -15.4, 14.9, 3.4, 4.4] : [-14.9, -21.2, -15.4, 0.2, 3.4, 4.4];
    const g = Grid(box[0], box[1], box[2], box[3], box[4], box[5], LUNG_H).fillNarrow((x, y, z) => lungF(side, x, y, z), 0.75).blur(1);
    // "abertura" morfológica (anterior e face mediastinal): elimina lâminas < ~0,3 cm, gotas e aletas (bordas anteriores
    // espremidas entre parede, vasos torácicos internos e pericárdio; recessos do hilo) sem mexer no resto do pulmão
    closeField(g, 0.15, side === 'R' ? [box[0], -20, box[2], 6.5, 3.4, box[5]] : [-6.5, -20, box[2], box[3], 3.4, box[5]], -1);
    TM('fill'+side);
    const base = Float32Array.from(g.F);
    // amostras internas/próximas (as únicas que as fissuras podem alterar) e seus valores de fissura
    const near = [], gO = [], gH = [];
    for (let k = 0, q = 0; k < g.nz; k++) { const z = g.z0 + k * g.h; for (let j = 0; j < g.ny; j++) { const y = g.y0 + j * g.h; for (let i = 0; i < g.nx; i++, q++) {
      if (base[q] > 0.3) continue; const x = g.x0 + i * g.h; near.push(q); gO.push(gObl(side, x, y, z)); gH.push(side === 'R' ? gHor(sg * x, y, z) : 0);
    } } }
    lobeDefs[side].forEach((lb) => {
      g.F.set(base);
      for (let n = 0; n < near.length; n++) { const q = near[n]; g.F[q] = smax(base[q], lb.sel(gO[n], gH[n]) + GAP, 0.12); }
      TM('lobe');
      const s = dropSmall(surfaceNets(g), 400);
      if (!s.idx.length) return;
      TM('sn');
      taubin(s.pos, s.idx, 2);
      const geo = makeGeo(s.pos, s.idx, lungUV(side), lungColor(side));
      geo.setAttribute('rest', new THREE.BufferAttribute(Float32Array.from(s.pos), 3)); // posição de repouso → textura presa ao tecido
      TM('geo');
      const m = C.mesh(geo, lungMat, LY.lung, GL({ id: lb.id, name: lb.name, desc: lungDesc[lb.id] }));
      addBreath(geo, 0.1);
      TM('br');
      lungMeshes[side].push(m);
    });
  }
  TM('lungs');
  /* ---------- pleura parietal (cúpula, costal, diafragmática, mediastinal) ---------- */
  for (const side of ['R', 'L']) {
    const box = side === 'R' ? [-0.6, -25.6, -15.8, 15.2, 4.0, 4.8] : [-15.2, -25.6, -15.8, 0.6, 4.0, 4.8];
    const { geo } = isoMesh(box, 0.33, (x, y, z) => pleuraF(side, x, y, z), { smooth: 2, narrow: true, T: 0.6, blur: 1, minTris: 300 });
    const m = C.mesh(geo, pleuraMat, LY.pleura, GL({ id: 'pleura-' + side, name: 'Pleura parietal ' + (side === 'R' ? 'direita' : 'esquerda') + ' (cúpula, costal, diafragmática e mediastinal)',
      desc: side === 'R' ? 'A cúpula pleural sobe acima da 1ª costela, posterior e inferior aos vasos subclávios: agulha profunda ou angulada demais produz pneumotórax.' : undefined }), { cast: false, receive: false });
    m.renderOrder = 2;
    addBreath(geo, 0.02);
  }

  TM('pleura');
  /* ======================= coração: malha, cores (sulcos com gordura), coronárias ======================= */
  const heartGroup = new THREE.Group(); heartGroup.name = 'Coração'; LY.mediastinum.add(heartGroup);
  /** Peso de "vinco" (sulcos coronário e interventriculares) e de átrio para colorir por vértice. */
  function heartParts(x, y, z) {
    const lv = HP.lv.d(x, y, z), rv = smin(smin(HP.rv.d(x, y, z), HP.rvApex.d(x, y, z), 0.8), HP.conus.d(x, y, z), 1.0);
    const ven = smin(lv, rv, 0.7);
    const ra = smin(smin(HP.ra.d(x, y, z), smin(HP.svcIn.d(x, y, z), HP.ivcIn.d(x, y, z), 0.4), 0.5), HP.rau.d(x, y, z), 0.35);
    let la = smin(HP.la.d(x, y, z), HP.lau.d(x, y, z), 0.35); for (const p of HP.pv) la = smin(la, p.d(x, y, z), 0.3);
    const atr = Math.min(ra, la), ao = HP.aoRoot.d(x, y, z);
    const iv = Math.min(lv, rv) - ven;                       // sulcos interventriculares
    const av = Math.min(ven, atr) - smin(ven, atr, 0.32);    // sulco coronário (atrioventricular)
    const hard = Math.min(ven, atr, ao);
    return { crease: Math.max(iv * 0.9, av), atrial: atr <= hard + 0.02 ? 1 : 0, ao: ao <= hard + 0.02 ? 1 : 0 };
  }
  {
    const s = surfaceNets(HGd); taubin(s.pos, s.idx, 2);
    const myo = lin('#7c2e29'), atr = lin('#69262d'), fat = lin('#dcb55a'), aoC = lin('#c8988a');
    const geo = makeGeo(s.pos, s.idx, (x, y, z) => [Math.atan2(z + 2, x + 2) / (2 * Math.PI) * 4, y / 5], (x, y, z) => {
      const p = heartParts(x, y, z), n = C.fbm3(x * 0.9, y * 0.9, z * 0.9, 2, 13);
      let c = p.atrial ? atr : myo; if (p.ao) c = aoC;
      c = mixc(c, fat, clamp(sstep(0.03, 0.14, p.crease) * (0.75 + 0.5 * n), 0, 1));
      return mixc(c, [c[0] * 0.85, c[1] * 0.8, c[2] * 0.82], n * 0.5);
    });
    const heartMat = C.mat({ color: '#ffffff', vertexColors: true, roughness: 0.45, sheen: 0.2, sheenColor: '#d07868', clearcoat: 0.28, clearcoatRoughness: 0.3, normalMap: C.tex.noiseNormal('fine'), normalScale: new THREE.Vector2(0.22, 0.22), cut: 0x7e2f2a });
    C.mesh(geo, heartMat, heartGroup, GM({ id: 'heart', name: 'Coração (átrios, ventrículos e aurículas)', desc: 'O átrio direito recebe a VCS na junção cavoatrial — referência para a posição da ponta do cateter venoso central.' }));
  }
  /** Projeta um ponto na superfície do coração (Newton no campo da grade) e o afasta `lift` cm. */
  function snapHeart(p, lift) {
    const q = V(p), e = 0.12;
    for (let it = 0; it < 8; it++) {
      const f = heartAt(q.x, q.y, q.z), gx = (heartAt(q.x + e, q.y, q.z) - heartAt(q.x - e, q.y, q.z)) / (2 * e), gy = (heartAt(q.x, q.y + e, q.z) - heartAt(q.x, q.y - e, q.z)) / (2 * e), gz = (heartAt(q.x, q.y, q.z + e) - heartAt(q.x, q.y, q.z - e)) / (2 * e);
      const g2 = gx * gx + gy * gy + gz * gz || 1, k = (f - lift) / g2; q.x -= gx * k; q.y -= gy * k; q.z -= gz * k;
    }
    return q.toArray();
  }
  const fatMat = C.mat({ color: '#e9c870', roughness: 0.5, sheen: 0.4, sheenColor: '#fff2c0', clearcoat: 0.3, normalMap: C.tex.noiseNormal('nz'), normalScale: new THREE.Vector2(0.6, 0.6), cut: 0xe0b860 });
  const coron = {
    rca: { n: 'Artéria coronária direita (no sulco coronário)', g: [[0.5, -9.7, -1.95], [1.8, -10.4, -0.75], [2.85, -11.6, -0.55], [3.35, -13.1, -1.3], [3.0, -14.6, -2.6], [1.8, -15.3, -3.9]] },
    lad: { n: 'Ramo interventricular anterior (descendente anterior)', g: [[-1.75, -9.5, -2.2], [-2.5, -10.4, -0.55], [-3.5, -11.7, 0.75], [-4.9, -13.3, 1.3], [-6.4, -14.7, 1.15], [-7.3, -15.45, 0.75]] },
    lcx: { n: 'Ramo circunflexo (sulco coronário esquerdo)', g: [[-1.9, -9.8, -2.6], [-3.3, -10.3, -2.6], [-4.4, -11.2, -3.2], [-4.8, -12.5, -4.2]] },
  };
  for (const k in coron) {
    const pts = coron[k].g.map((p) => snapHeart(p, 0.06));
    const info = G('Artérias', { id: 'coronary-' + k, name: coron[k].n });
    C.tube(pts, { rx: 0.42, ry: 0.22, up: (t, p) => { const e = 0.15; return new THREE.Vector3(heartAt(p.x + e, p.y, p.z) - heartAt(p.x - e, p.y, p.z), heartAt(p.x, p.y + e, p.z) - heartAt(p.x, p.y - e, p.z), heartAt(p.x, p.y, p.z + e) - heartAt(p.x, p.y, p.z - e)); }, radial: 12, density: 4, noise: { amp: 0.12, freq: 1.4, seed: 3 } }, fatMat, heartGroup, info);
    C.tube(pts.map((p) => snapHeart(p, 0.22)), { r: [0.19, 0.17, 0.15, 0.12], radial: 10, density: 5 }, M.artery, heartGroup, info);
  }

  /* ---------- grandes vasos do pericárdio: tronco e artérias pulmonares, veias pulmonares, VCI ---------- */
  const paMat = C.mat({ color: '#4d5f9e', roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.25, normalMap: C.tex.noiseNormal('fine'), normalScale: new THREE.Vector2(0.15, 0.15), cut: 0x3a2b4a });
  const pvMat = C.mat({ color: '#c0463c', roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.25, cut: 0x7a1d1a });
  const GA = (k) => G('Artérias', k), GV = (k) => G('Veias', k);
  C.tube(PATH.pt, { r: PATH.ptR, radial: 28, density: 6, capStart: false }, paMat, LY.mediastinum, GA({ id: 'pulmonary-trunk', name: 'Tronco pulmonar', desc: 'Sai do infundíbulo do ventrículo direito, à esquerda e à frente da aorta ascendente; bifurca-se na concavidade do arco aórtico.' }));
  C.tube(PATH.rpa, { r: PATH.rpaR, radial: 22, density: 6, caps: 'flat' }, paMat, LY.mediastinum, GA({ id: 'pulmonary-a-R', name: 'Artéria pulmonar direita', desc: 'Passa atrás da aorta ascendente e da VCS, à frente do brônquio principal direito.' }));
  C.tube(PATH.lpa, { r: PATH.lpaR, radial: 22, density: 6, caps: 'flat' }, paMat, LY.mediastinum, GA({ id: 'pulmonary-a-L', name: 'Artéria pulmonar esquerda', desc: 'Cruza acima do brônquio principal esquerdo; unida à face inferior do arco pelo ligamento arterial.' }));
  // ligamento arterial (resquício do ducto arterioso): da origem da APE à face inferior do arco
  C.tube([[-2.75, -5.75, -3.45], [-2.45, -4.85, -3.75], [-2.2, -4.15, -3.95]], { r: 0.16, radial: 10, segments: 8 }, M.ligament, LY.mediastinum, GA({ id: 'ligamentum-arteriosum', name: 'Ligamento arterial' }));
  const PVID = { rspv: 'RS', ripv: 'RI', lspv: 'LS', lipv: 'LI' };
  [['rspv', 'superior direita'], ['ripv', 'inferior direita'], ['lspv', 'superior esquerda'], ['lipv', 'inferior esquerda']].forEach(([k, n]) =>
    C.tube(PATH[k], { r: PATH[k + 'R'], radial: 18, density: 6, capStart: false, caps: 'flat' }, pvMat, LY.mediastinum, GV({ id: 'pulmonary-v-' + PVID[k], name: 'Veia pulmonar ' + n, desc: 'Leva sangue oxigenado ao átrio esquerdo (convenção de cores: vermelho).' })));
  C.tube(PATH.ivc, { r: [1.05, 1.08, 1.1], radial: 26, density: 5, capStart: false, caps: 'flat' }, M.vein, LY.mediastinum, GV({ id: 'ivc', name: 'Veia cava inferior (segmento terminal)', desc: 'Atravessa o centro tendíneo do diafragma (forame da veia cava, ~T8) e desemboca no átrio direito.' }));
  C.solid('pulmonary-trunk', PATH.pt.slice(0, 3), PATH.ptR.slice(0, 3)); C.solid('pulmonary-a-R', PATH.rpa.slice(1), PATH.rpaR.slice(1)); C.solid('pulmonary-a-L', PATH.lpa.slice(1), PATH.lpaR.slice(1));
  ['rspv', 'ripv', 'lspv', 'lipv'].forEach((k) => C.solid('pulmonary-v-' + PVID[k], PATH[k].slice(1), PATH[k + 'R']));
  C.solid('ivc', PATH.ivc.slice(1), PATH.ivcR);

  /* ---------- pericárdio fibroso/seroso parietal (translúcido) ---------- */
  {
    const { geo } = isoMesh([-9.6, -17.6, -7.9, 6.0, -2.6, 4.0], 0.3, (x, y, z) => periF(x, y, z), { smooth: 2, narrow: true });
    const m = C.mesh(geo, M.pericardium, LY.mediastinum, GM({ id: 'pericardium', name: 'Pericárdio (saco fibrosseroso)', desc: 'Envolve o coração e a origem dos grandes vasos; sua base funde-se ao centro tendíneo do diafragma.' }), { cast: false, receive: false });
    m.renderOrder = 3;
  }
  TM('heart');

  /* ======================= traqueia, brônquios (anéis em C), esôfago, timo ======================= */
  const TR = LM.trachea;
  const wallMat = C.mat({ color: '#d8b4a8', roughness: 0.5, sheen: 0.4, sheenColor: '#ffe0d6', clearcoat: 0.2, normalMap: C.tex.noiseNormal('fine'), normalScale: new THREE.Vector2(0.2, 0.2), cut: 0xb98f84 });
  const ringMat = M.cartilage;
  /** Tubo com parede posterior membranosa achatada + anéis cartilagíneos em C (abertos posteriormente). */
  function airway(pts, r, info, o = {}) {
    const grp = new THREE.Group(); grp.name = info.name; LY.mediastinum.add(grp);
    const rf = C.profile(r);
    const geo = C.sweepGeometry(pts, { r, up: [0, 0, 1], radial: 26, density: 6, caps: o.caps || 'flat', capStart: o.capStart ?? true, radial_fn: (t, a) => 1 - 0.16 * Math.pow(Math.max(0, -Math.cos(a)), 2) });
    C.mesh(geo, wallMat, grp, info);
    const curve = geo.userData.curve, L = geo.userData.length, step = o.step || 0.62;
    // anéis em C fundidos numa única malha (toro parcial: K passos no arco × M na secção)
    const K = 18, Mr = 8, rpos = [], ridx = [], rx = 0.13 * (o.ringK || 1), ry = 0.055, gap = o.gap || 0.62;
    for (let s = o.skip || 0.35; s < L - (o.endSkip || 0.25); s += step) {
      const t = s / L, P = curve.getPointAt(t), T = curve.getTangentAt(t).normalize();
      const N = new THREE.Vector3(0, 0, 1).sub(T.clone().multiplyScalar(T.z)).normalize(), B = new THREE.Vector3().crossVectors(T, N);
      const R = rf(t) * 1.015 + 0.03, base = rpos.length / 3;
      for (let k = 0; k <= K; k++) {
        const a = -Math.PI + gap + (k / K) * (2 * Math.PI - 2 * gap), ca = Math.cos(a), sa = Math.sin(a);
        const taper = 0.55 + 0.45 * Math.sin(Math.PI * k / K); // extremidades afiladas
        for (let m = 0; m < Mr; m++) {
          const b = (m / Mr) * Math.PI * 2, rr = R + ry * taper * Math.cos(b), ax = rx * taper * Math.sin(b);
          rpos.push(P.x + (N.x * ca + B.x * sa) * rr + T.x * ax, P.y + (N.y * ca + B.y * sa) * rr + T.y * ax, P.z + (N.z * ca + B.z * sa) * rr + T.z * ax);
        }
      }
      for (let k = 0; k < K; k++) for (let m = 0; m < Mr; m++) {
        const a = base + k * Mr + m, b = base + k * Mr + (m + 1) % Mr, c = a + Mr, d = b + Mr;
        ridx.push(a, c, b, b, c, d);
      }
      // tampas nas pontas do C
      const c0 = rpos.length / 3; rpos.push(...[0, K].map((k) => { const a = -Math.PI + gap + (k / K) * (2 * Math.PI - 2 * gap); return P.clone().addScaledVector(N, Math.cos(a) * R).addScaledVector(B, Math.sin(a) * R).toArray(); }).flat());
      for (let m = 0; m < Mr; m++) { ridx.push(c0, base + (m + 1) % Mr, base + m); ridx.push(c0 + 1, base + K * Mr + m, base + K * Mr + (m + 1) % Mr); }
    }
    if (rpos.length) {
      const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rpos, 3)); rg.setIndex(ridx); rg.computeVertexNormals();
      C.mesh(rg, ringMat, grp, info);
    }
    return grp;
  }
  const trInfo = GM({ id: 'trachea', name: 'Traqueia', desc: 'Anéis cartilagíneos em C abertos posteriormente (parede membranosa, músculo traqueal), em contato com o esôfago.' });
  const trPts = TR.pts.slice(0, -1).concat([TR.carina]);
  airway(trPts, [TR.r, TR.r, TR.r * 0.98, TR.r * 0.97, TR.r * 0.98, TR.r * 1.02], trInfo, { capStart: false, endSkip: 0.6 });
  // carina: esporão sagital na bifurcação
  C.ellipsoid([TR.carina[0], TR.carina[1] - 0.05, TR.carina[2]], [0.28, 0.5, 0.75], wallMat, LY.mediastinum, GM({ id: 'carina', name: 'Carina da traqueia (bifurcação, ~T4–T5)' }));
  airway(PATH.rmb, PATH.rmbR, GM({ id: 'bronchus-R', name: 'Brônquio principal direito', desc: 'Mais curto, largo e vertical que o esquerdo; o arco da ázigo cruza acima dele.' }), { skip: 0.7, step: 0.55, ringK: 0.85 });
  airway(PATH.lmb, PATH.lmbR, GM({ id: 'bronchus-L', name: 'Brônquio principal esquerdo', desc: 'Mais longo e horizontal; passa sob o arco aórtico e à frente do esôfago e da aorta descendente.' }), { skip: 0.7, step: 0.55, ringK: 0.85 });
  C.solid('bronchus-R', C.sample(PATH.rmb, 12).slice(5), 0.74); C.solid('bronchus-L', C.sample(PATH.lmb, 16).slice(4), 0.6);
  // brônquios lobares iniciais (dentro do hilo; visíveis com o pulmão oculto/cortado)
  lobar.forEach(([id, name, pts, r]) => airway(pts, r, GM({ id, name }), { skip: 0.5, step: 0.6, ringK: 0.7, caps: 'round', gap: 0.9 }));

  // esôfago: achatado no sentido anteroposterior; camada longitudinal externa (fibras ao longo do eixo)
  const esoMat = C.mat({ color: '#c47b6e', roughness: 0.5, sheen: 0.45, sheenColor: '#f6b9aa', normalMap: C.tex.fibers('fib', { cycles: 26 }), normalScale: new THREE.Vector2(0.35, 0.35), cut: 0xa8645a });
  C.tube(LM.esophagus.pts, { rx: 0.6, ry: 0.8, up: [0, 0, 1], radial: 24, density: 5, caps: 'flat', vScale: 3, noise: { amp: 0.04, freq: 0.8, seed: 9 } }, esoMat, LY.mediastinum,
    GM({ id: 'esophagus', name: 'Esôfago', desc: 'Posterior à traqueia e ao átrio esquerdo, à direita da aorta descendente; atravessa o hiato esofágico (~T10).' }));

  // timo remanescente: malha implícita do mesmo campo usado no mediastino (lobos adiposos lobulados)
  {
    const thyMat = C.mat({ color: '#ffffff', vertexColors: true, roughness: 0.62, sheen: 0.35, sheenColor: '#fff0d0', normalMap: C.tex.noiseNormal('nz'), normalScale: new THREE.Vector2(0.7, 0.7), cut: 0xcfae78 });
    const fatC = lin('#e6c98c'), glC = lin('#c99f80');
    const { geo } = isoMesh(THY_BB, 0.11, (x, y, z) => { const f = thymusF(x, y, z); return f > 0.35 ? f : f + 0.09 * (C.noise3(x * 2.6, y * 2.6, z * 2.6, 41) - 0.5) + 0.04 * (C.noise3(x * 5.5, y * 5.5, z * 5.5, 43) - 0.5); }, { smooth: 2, narrow: true, T: 0.45,
      color: (x, y, z) => mixc(fatC, glC, clamp(0.45 + 1.8 * (C.noise3(x * 1.7, y * 1.7, z * 1.7, 44) - 0.5), 0, 1)) });
    C.mesh(geo, thyMat, LY.mediastinum, GM({ id: 'thymus', name: 'Timo (remanescente adiposo)', desc: 'Remanescente adiposo bilobado no mediastino anterossuperior: atrás do manúbrio, logo abaixo da VBC esquerda e à frente da aorta ascendente/arco e do pericárdio superior.' }));
  }
  TM('airways');

  /* ======================= diafragma (lâmina com espessura) =======================
     Grade polar global DG (centro x=0, z=GZ): da linha de inserção (margem costal, xifoide, pilares, ligamento
     arqueado mediano à frente da aorta) sobe pela zona de aposição até a borda pulmonar, contorna a borda com
     transição suave (C1) e cruza a cúpula até um pequeno disco central (sem polo degenerado). */
  const diaInfo = G('Músculos', { id: 'diaphragm', name: 'Diafragma (cúpulas, centro tendíneo e pilares)', desc: 'Cúpula direita mais alta (fígado); desce ~2–3 cm na inspiração profunda, aprofundando os recessos costodiafragmáticos.' });
  {
    const { NU, NS, GZ, RB, YB, YA, RS } = DG, ND = 38, rows = NS + ND;
    const P = new Float32Array((NU + 1) * rows * 3), pAt = (i, j) => ((i % NU) * rows + j) * 3;
    for (let i = 0; i < NU; i++) {
      const th = (i / NU) * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th);
      const rb = RB[i], yb = YB[i], Hb = Hdia(c * rb, GZ + sn * rb);
      for (let j = 0; j < rows; j++) {
        let px, py, pz;
        if (j <= NS) { py = lerp(YA[i], yb, j / NS); const rr = RS[i * (NS + 1) + j]; px = c * rr; pz = GZ + sn * rr; }
        else { const w = (j - NS) / ND, rr = rb * (1 - w); px = c * rr; pz = GZ + sn * rr; py = Hdia(px, pz) + (yb - Hb) * Math.pow(1 - w, 3); }
        const q = pAt(i, j); P[q] = px; P[q + 1] = py; P[q + 2] = pz;
      }
      // borda saia→cúpula arredondada (Bézier quadrática entre as fileiras NS−2 e NS+2, controle na borda)
      const A = P.slice(pAt(i, NS - 2), pAt(i, NS - 2) + 3), B = P.slice(pAt(i, NS), pAt(i, NS) + 3), Cc = P.slice(pAt(i, NS + 2), pAt(i, NS + 2) + 3);
      for (let j = NS - 1; j <= NS + 1; j++) { const t = (j - NS + 2) / 4, q = pAt(i, j); for (let a = 0; a < 3; a++) P[q + a] = (1 - t) * (1 - t) * A[a] + 2 * t * (1 - t) * B[a] + t * t * Cc[a]; }
    }
    // hiatos (elipses no plano xz, centradas onde o eixo cruza a cúpula): esofágico (~T10, à E e posterior) e da VCI
    const crossAt = (pts) => { const S = C.sample(pts, 80); let best = S[0], bd = 1e9; S.forEach((p) => { const d = Math.abs(p[1] - Hdia(p[0], p[2])); if (d < bd) { bd = d; best = p; } }); return best; };
    const eC = crossAt(LM.esophagus.pts), vC = crossAt(PATH.ivc);
    const holes = [{ x: eC[0], z: eC[2], a: 0.8 + 0.27, b: 0.6 + 0.27 }, { x: vC[0], z: vC[2], a: PATH.ivcR - 0.02, b: PATH.ivcR - 0.02 }];
    const hRho = (h, x, z) => hyp((x - h.x) / h.a, (z - h.z) / h.b);
    const cut = new Uint8Array(NU * rows); // células removidas (i, j) → (i+1, j+1)
    for (let i = 0; i < NU; i++) for (let j = 0; j < rows - 1; j++) {
      const a = pAt(i, j), b = pAt(i + 1, j), c2 = pAt(i + 1, j + 1), d = pAt(i, j + 1);
      const x = (P[a] + P[b] + P[c2] + P[d]) / 4, z = (P[a + 2] + P[b + 2] + P[c2 + 2] + P[d + 2]) / 4;
      if (holes.some((h) => hRho(h, x, z) < 1)) cut[i * rows + j] = 1;
    }
    for (let j = 0; j < rows; j++) { const q0 = pAt(0, j), q1 = (NU * rows + j) * 3; P[q1] = P[q0]; P[q1 + 1] = P[q0 + 1]; P[q1 + 2] = P[q0 + 2]; }
    // normais da superfície média e espessura (tendão mais fino; pilares espessados junto ao hiato aórtico)
    const at = (i, j) => { i = (i + NU) % NU; j = clamp(j, 0, rows - 1); const q = pAt(i, j); return new THREE.Vector3(P[q], P[q + 1], P[q + 2]); };
    const pos = [], col = [], uv = [], idx = [];
    const mus = lin('#9e463b'), musD = lin('#86362f'), ten = lin('#e3dacb'), tenD = lin('#cfc4b0');
    const off = [];
    for (let i = 0; i <= NU; i++) for (let j = 0; j < rows; j++) {
      const du = at(i + 1, j).sub(at(i - 1, j)), dv = at(i, j + 1).sub(at(i, j - 1));
      const n = new THREE.Vector3().crossVectors(dv, du); n.normalize(); if (!(n.lengthSq() > 0.5)) n.set(0, 1, 0);
      const p = at(i, j), tm = j > NS ? tendonEdge(p.x, p.z) : 0;
      const crus = j <= NS ? DG.crus[i % NU] * Math.pow(1 - j / NS, 0.6) : 0;
      off.push([p, n, lerp(DIA_TH, TEND_TH, tm) + crus, tm]);
    }
    const probe = off[Math.floor(NU / 4) * rows + NS + 10][1]; const sgn = probe.y >= 0 ? 1 : -1;
    const NV = (NU + 1) * rows, vid = (f, i, j) => f * NV + i * rows + j;
    for (const face of [1, -1]) for (let i = 0; i <= NU; i++) for (let j = 0; j < rows; j++) {
      const [p, n, th, tm] = off[i * rows + j], q = p.clone().addScaledVector(n, sgn * face * th / 2);
      pos.push(q.x, q.y, q.z);
      // tendão: fibras colágenas brancas, nacaradas; músculo: tom mais escuro nos pilares e na saia
      const nz = C.noise3(q.x * 1.6, q.y * 1.6, q.z * 1.6, 61);
      const c = mixc(mixc(mus, musD, clamp((NS + 2 - j) / (NS + 2), 0, 1) * 0.7 + 0.3 * nz), mixc(ten, tenD, nz), tm);
      col.push(c[0], c[1], c[2]); uv.push(i / NU * 6, j / rows * 1.6);
    }
    // centro: um vértice por face (fecha a grade polar sem leque degenerado)
    const yc = Hdia(0, GZ), cIdx = [pos.length / 3, pos.length / 3 + 1];
    pos.push(0, yc + sgn * TEND_TH / 2, GZ, 0, yc - sgn * TEND_TH / 2, GZ); col.push(...ten, ...ten); uv.push(0, 1.6, 0, 1.6);
    const testA = at(5, NS + 10), testB = at(6, NS + 10), testC = at(6, NS + 11);
    const fn = new THREE.Vector3().crossVectors(testB.clone().sub(testA), testC.clone().sub(testA));
    const wind = !(fn.y * sgn > 0);
    const tri = (a, b, c2, flip) => { if (flip) idx.push(a, c2, b); else idx.push(a, b, c2); };
    for (let i = 0; i < NU; i++) for (let j = 0; j < rows - 1; j++) {
      if (cut[i * rows + j]) continue;
      for (const f of [0, 1]) { const a = vid(f, i, j), b = vid(f, i + 1, j), c2 = vid(f, i + 1, j + 1), d = vid(f, i, j + 1), fl = f === 0 ? wind : !wind; tri(a, b, c2, fl); tri(a, c2, d, fl); }
    }
    for (let i = 0; i < NU; i++) for (const f of [0, 1]) tri(vid(f, i, rows - 1), vid(f, i + 1, rows - 1), cIdx[f], f === 0 ? wind : !wind);
    // borda livre inferior (linha de inserção): une as duas faces
    for (let i = 0; i < NU; i++) { const a = vid(0, i, 0), b = vid(0, i + 1, 0), c2 = vid(1, i + 1, 0), d = vid(1, i, 0); idx.push(...(wind ? [a, b, c2, a, c2, d] : [a, c2, b, a, d, c2])); }
    // paredes dos hiatos: cada aresta entre célula removida e célula mantida vira um quadrilátero face0↔face1
    const V3 = (k) => new THREE.Vector3(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
    const wall = (e0, e1, kept, gone) => {
      const a = vid(0, e0[0], e0[1]), b = vid(0, e1[0], e1[1]), c2 = vid(1, e1[0], e1[1]), d = vid(1, e0[0], e0[1]);
      const nrm = new THREE.Vector3().crossVectors(V3(b).sub(V3(a)), V3(d).sub(V3(a))), dir = gone.clone().sub(kept);
      if (nrm.dot(dir) >= 0) idx.push(a, b, c2, a, c2, d); else idx.push(a, c2, b, a, d, c2);
    };
    const cellC = (i, j) => at(i, j).add(at(i + 1, j)).add(at(i + 1, j + 1)).add(at(i, j + 1)).multiplyScalar(0.25);
    for (let i = 0; i < NU; i++) for (let j = 0; j < rows - 1; j++) {
      if (!cut[i * rows + j]) continue;
      const nb = [[i, j - 1, [i, j], [i + 1, j]], [i, j + 1, [i, j + 1], [i + 1, j + 1]], [i - 1, j, [i, j], [i, j + 1]], [i + 1, j, [i + 1, j], [i + 1, j + 1]]];
      for (const [ni, nj, e0, e1] of nb) {
        if (nj < 0 || nj >= rows - 1) continue; const nn = (ni + NU) % NU; if (cut[nn * rows + nj]) continue;
        wall(e0, e1, cellC(nn, nj), cellC(i, j));
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); fastNormals(g);
    const diaMat = C.mat({ color: '#ffffff', vertexColors: true, roughness: 0.5, sheen: 0.4, sheenColor: '#f2b0a0', clearcoat: 0.15, normalMap: C.tex.fibers('fib', { cycles: 26 }), normalScale: new THREE.Vector2(0.05, 0.05), cut: 0x9a4a3f });
    C.mesh(g, diaMat, LY.mediastinum, diaInfo);
    DG.mesh = g;
    addBreath(g);
  }
  TM('diaphragm');
  // respiração de todas as malhas do mediastino (coração, pericárdio, vasos, brônquios, esôfago, diafragma…)
  LY.mediastinum.traverse((o) => { if (o.isMesh) addBreath(o.geometry); });

  /* ======================= âncoras (pontos na superfície, coords anatômicas) ======================= */
  /** Marcha de `from` na direção `dir` até o campo ficar negativo (entrada na superfície). */
  function hit(fn, from, dir, max = 25) {
    const p = V(from), d = V(dir).normalize(); let prev = fn(p.x, p.y, p.z);
    for (let s = 0; s < max; s += 0.08) { p.addScaledVector(d, 0.08); const f = fn(p.x, p.y, p.z); if (f < 0 && prev >= 0) return p.toArray().map((v) => +v.toFixed(2)); prev = f; }
    return from;
  }
  const lungR = (x, y, z) => lungF('R', x, y, z), lungLf = (x, y, z) => lungF('L', x, y, z);
  const yO = (side, z) => { const T = fissTab[side], f = clamp((z + 13) / 16.2, 0, 1) * 100, i = Math.min(99, f | 0); return T[i * 2] + (T[i * 2 + 2] - T[i * 2]) * (f - i); };
  const malZ = -6.0, lbMal = yLBat(13.5, malZ), rfMal = yRFat(13.5, malZ);
  const anchors = {
    cupulaR: LM.pleura.cupulaApex.slice(),
    lungApexR: hit(lungR, [4.4, 6, -5.7], [0, -1, 0]),
    lungR: hit(lungR, [8.6, -6.5, 8], [0, 0, -1]),
    lungBaseR: hit(lungR, [7.0, -22, -4.5], [0, 1, 0]),
    costophrenicR: hit((x, y, z) => pleuraF('R', x, y, z), [17, (lbMal + rfMal) / 2, malZ], [-1, 0, 0]),
    horizontalFissureR: hit(lungR, [10.4, yHor(10.4, -0.3), 8], [0, 0, -1]),
    obliqueFissureR: hit(lungR, [17, yO('R', malZ), malZ], [-1, 0, 0]),
    lungL: hit(lungLf, [-8.6, -6.5, 8], [0, 0, -1]),
    cardiacNotch: hit((x, y, z) => periF(x, y, z), [-3.2, -12.2, 8], [0, 0, -1]),
    trachea: [TR.pts[2][0], TR.pts[2][1], TR.pts[2][2] + TR.r],
    carina: TR.carina.slice(),
    esophagus: [LM.esophagus.pts[3][0] - 0.75, LM.esophagus.pts[3][1], LM.esophagus.pts[3][2]],
    heart: hit((x, y, z) => heartAt(x, y, z), [-1.4, -12.4, 8], [0, 0, -1]),
    diaphragmR: [DOME.R.x, Hdia(DOME.R.x, DOME.R.z) + DIA_TH / 2, DOME.R.z],
    pericardium: hit((x, y, z) => periF(x, y, z), [-0.8, -11.4, 8], [0, 0, -1]),
    // extras úteis aos rótulos
    hilumR: [3.6, -7.9, -5.3], hilumL: [-4.3, -7.6, -5.3], pulmonaryTrunk: PATH.pt[1].slice(), thymus: hit(thymusF, [-0.62, -4.4, 3], [0, 0, -1]),
    costophrenicL: hit((x, y, z) => pleuraF('L', x, y, z), [-17, (lbMal + rfMal) / 2, malZ], [1, 0, 0]), lingula: hit(lungLf, [-6.6, -15.2, 8], [0, 0, -1]),
  };

  /* ======================= respiração ======================= */
  let cur = -1;
  function applyBreath(b) {
    for (const B of breathers) {
      const p = B.geo.attributes.position, n = B.geo.attributes.normal, pa = p.array, na = n.array;
      for (let i = 0; i < pa.length; i++) { pa[i] = B.base[i] + (B.tgt[i] - B.base[i]) * b; na[i] = B.nBase[i] + (B.nTarget[i] - B.nBase[i]) * b; }
      p.needsUpdate = n.needsUpdate = true; B.geo.boundingSphere = null;
    }
  }
  TM('end');
  return {
    anchors,
    update(state, dt) {
      const target = clamp(state.breath || 0, 0, 1);
      const b = cur < 0 || !dt ? target : cur + (target - cur) * Math.min(1, dt * 6);
      if (Math.abs(b - cur) < 2e-3) return;
      cur = b; applyBreath(b);
    },
    api: { breathers: () => breathers.length, timing: () => __T.slice() },
  };
});
