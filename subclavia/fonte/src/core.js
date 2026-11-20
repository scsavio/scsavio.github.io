/* ==========================================================================
   core.js — utilitários compartilhados do Atlas da subclávia
   Convenção espacial: x = DIREITA do paciente (+), y = cranial (+), z = anterior (+)
   Unidade nominal: centímetro (modelo didático, não calibrado para paciente).
   Origem: incisura jugular (borda superior do manúbrio, linha média, face anterior).
   ========================================================================== */
(function () {
  'use strict';
  const ATLAS = (window.ATLAS = window.ATLAS || {});
  ATLAS.modules = ATLAS.modules || {};
  ATLAS.order = ATLAS.order || [];
  /** Registra um módulo de construção. fn(ctx) → {anchors?, update?(state), api?} */
  ATLAS.define = function (name, fn) {
    ATLAS.modules[name] = fn;
    if (!ATLAS.order.includes(name)) ATLAS.order.push(name);
  };

  ATLAS.makeCore = function (THREE, quality = 1) {
    const C = { THREE, quality };
    const V = (C.V = (p) => (p && p.isVector3 ? p.clone() : new THREE.Vector3(p[0], p[1], p[2])));
    C.mirror = (pts) => pts.map((p) => [-p[0], p[1], p[2]]);
    C.mirrorPt = (p) => [-p[0], p[1], p[2]];
    C.lerp = (a, b, t) => a + (b - a) * t;
    C.clamp = (x, a, b) => Math.max(a, Math.min(b, x));
    C.smooth = (a, b, x) => { const t = C.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    C.lerp3 = (a, b, t) => [C.lerp(a[0], b[0], t), C.lerp(a[1], b[1], t), C.lerp(a[2], b[2], t)];

    /* ---------- RNG e ruído determinísticos ---------- */
    C.rng = function (seed = 1) {
      let s = seed >>> 0 || 1;
      return () => ((s = (1664525 * s + 1013904223) >>> 0) / 4294967296);
    };
    const hash3 = (x, y, z, seed) => {
      let h = (x * 374761393 + y * 668265263 + z * 1274126177 + seed * 974634541) | 0;
      h = (h ^ (h >>> 13)) * 1274126177;
      h = h ^ (h >>> 16);
      return (h & 0xffffff) / 0xffffff;
    };
    /** Ruído de valor 3D suave em [0,1]. */
    C.noise3 = function (x, y, z, seed = 0) {
      const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
      const xf = x - xi, yf = y - yi, zf = z - zi;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
      let r = 0;
      for (let dz = 0; dz < 2; dz++) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const h = hash3(xi + dx, yi + dy, zi + dz, seed);
        r += h * (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w);
      }
      return r;
    };
    C.fbm3 = function (x, y, z, oct = 4, seed = 0) {
      let a = 0.5, f = 1, s = 0, n = 0;
      for (let i = 0; i < oct; i++) { s += a * C.noise3(x * f, y * f, z * f, seed + i * 17); n += a; a *= 0.5; f *= 2.03; }
      return s / n;
    };

    /* ---------- perfis escalares ---------- */
    /** Converte número | array | [[t,v],...] | função em função t∈[0,1] → valor (Catmull-Rom). */
    C.profile = function (spec) {
      if (typeof spec === 'function') return spec;
      if (typeof spec === 'number') return () => spec;
      if (!Array.isArray(spec) || !spec.length) return () => 1;
      let keys;
      if (Array.isArray(spec[0])) keys = spec.map((k) => [k[0], k[1]]);
      else keys = spec.map((v, i) => [spec.length === 1 ? 0 : i / (spec.length - 1), v]);
      if (keys.length === 1) return () => keys[0][1];
      return function (t) {
        t = C.clamp(t, 0, 1);
        let i = 0;
        while (i < keys.length - 2 && keys[i + 1][0] < t) i++;
        const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(keys.length - 1, i + 2)];
        const span = k2[0] - k1[0] || 1e-6;
        const s = (t - k1[0]) / span;
        const m1 = (k2[1] - k0[1]) / ((k2[0] - k0[0]) || 1e-6) * span;
        const m2 = (k3[1] - k1[1]) / ((k3[0] - k1[0]) || 1e-6) * span;
        const s2 = s * s, s3 = s2 * s;
        return (2 * s3 - 3 * s2 + 1) * k1[1] + (s3 - 2 * s2 + s) * m1 + (-2 * s3 + 3 * s2) * k2[1] + (s3 - s2) * m2;
      };
    };

    /* ---------- curvas ---------- */
    C.curve = (pts, closed = false, tension = 0.5) =>
      pts && pts.isCurve ? pts : new THREE.CatmullRomCurve3(pts.map(V), closed, 'centripetal', tension);

    /** Amostra uma curva (arco-comprimento) → array de [x,y,z]. */
    C.sample = (pts, n = 32) => { const c = C.curve(pts); const out = []; for (let i = 0; i <= n; i++) out.push(c.getPointAt(i / n).toArray()); return out; };

    /* ---------- varredura (tubo generalizado) ----------
       C.sweepGeometry(path, opts)
         path: array de pontos ou THREE.Curve
         opts.r | opts.rx/opts.ry : número | array | [[t,v]] | fn(t)  (rx no eixo N, ry no eixo B)
         opts.up : [x,y,z] | Vector3 | fn(t,p,T)→Vector3 — orienta o eixo N (ex.: borda superior de costela)
                   (sem up: quadros de rotação mínima)
         opts.segments, opts.radial, opts.caps ('round'|'flat'|'none'), opts.capStart, opts.capEnd
         opts.exp : expoente de superelipse (2 = elipse; >2 = mais "quadrado")
         opts.radial_fn(t,a)→ multiplicador radial (sulcos, achatamentos)
         opts.noise {amp, freq, seed} : rugosidade orgânica radial
         opts.vScale : comprimento (cm) por repetição de textura no eixo v
    */
    C.sweepGeometry = function (path, o = {}) {
      const curve = C.curve(path, false, o.tension ?? 0.5);
      const len = curve.getLength();
      const Q = C.quality || 1;
      const N = o.segments ? Math.max(4, Math.round(o.segments * (Q < 1 ? Math.max(0.6, Q) : 1))) : Math.max(12, Math.min(420, Math.round(len * (o.density || 7) * Q)));
      const R = Math.max(8, Math.round((o.radial || 24) * (Q < 1 ? Math.max(0.6, Q) : 1)));
      const rx = C.profile(o.rx ?? o.r ?? 0.5), ry = C.profile(o.ry ?? o.rx ?? o.r ?? 0.5);
      const exp = o.exp || 2;
      const radialFn = o.radial_fn || null;
      const noise = o.noise || null;
      const capStart = (o.capStart ?? true) && (o.caps ?? 'round') !== 'none';
      const capEnd = (o.capEnd ?? true) && (o.caps ?? 'round') !== 'none';
      const capType = o.caps || 'round';
      const vScale = o.vScale || 4;
      // amostras e quadros
      const P = [], T = [], Nn = [], Bn = [], U = [];
      for (let j = 0; j <= N; j++) { const t = j / N; P.push(curve.getPointAt(t)); T.push(curve.getTangentAt(t).normalize()); U.push(t); }
      if (o.up) {
        for (let j = 0; j <= N; j++) {
          let up = typeof o.up === 'function' ? o.up(U[j], P[j], T[j]) : V(o.up);
          up = V(up);
          let n = up.sub(T[j].clone().multiplyScalar(up.dot(T[j])));
          if (n.lengthSq() < 1e-8) n = Math.abs(T[j].y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0), n.sub(T[j].clone().multiplyScalar(n.dot(T[j])));
          n.normalize();
          // evita inversões bruscas
          if (j > 0 && n.dot(Nn[j - 1]) < -0.2 && typeof o.up !== 'function') n.negate();
          Nn.push(n); Bn.push(new THREE.Vector3().crossVectors(T[j], n).normalize());
        }
      } else {
        // quadros de rotação mínima (dupla reflexão)
        let ref = Math.abs(T[0].y) < 0.95 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
        if (o.up0) ref = V(o.up0);
        let n0 = ref.sub(T[0].clone().multiplyScalar(ref.dot(T[0]))).normalize();
        Nn.push(n0); Bn.push(new THREE.Vector3().crossVectors(T[0], n0).normalize());
        for (let j = 0; j < N; j++) {
          const v1 = P[j + 1].clone().sub(P[j]); const c1 = v1.dot(v1) || 1e-9;
          const rL = Nn[j].clone().sub(v1.clone().multiplyScalar((2 / c1) * v1.dot(Nn[j])));
          const tL = T[j].clone().sub(v1.clone().multiplyScalar((2 / c1) * v1.dot(T[j])));
          const v2 = T[j + 1].clone().sub(tL); const c2 = v2.dot(v2) || 1e-9;
          const n = rL.sub(v2.clone().multiplyScalar((2 / c2) * v2.dot(rL))).normalize();
          Nn.push(n); Bn.push(new THREE.Vector3().crossVectors(T[j + 1], n).normalize());
        }
      }
      // anéis (cap início → corpo → cap fim)
      const rings = []; // {c, n, b, sx, sy, v, t}
      const arcAt = (t) => t * len;
      const K = capType === 'round' ? 6 : 1;
      if (capStart) {
        const a0 = rx(0), b0 = ry(0), m = Math.min(a0, b0);
        for (let k = K; k >= 1; k--) {
          const phi = capType === 'round' ? (k / K) * Math.PI / 2 : Math.PI / 2;
          const sc = capType === 'round' ? Math.max(0.02, Math.cos(phi)) : 0.001;
          const off = capType === 'round' ? m * Math.sin(phi) * 0.9 : 0;
          rings.push({ c: P[0].clone().addScaledVector(T[0], -off), n: Nn[0], b: Bn[0], sx: a0 * sc, sy: b0 * sc, v: -off / vScale, t: 0, cap: true });
        }
      }
      for (let j = 0; j <= N; j++) rings.push({ c: P[j], n: Nn[j], b: Bn[j], sx: rx(U[j]), sy: ry(U[j]), v: arcAt(U[j]) / vScale, t: U[j] });
      if (capEnd) {
        const a1 = rx(1), b1 = ry(1), m = Math.min(a1, b1);
        for (let k = 1; k <= K; k++) {
          const phi = capType === 'round' ? (k / K) * Math.PI / 2 : Math.PI / 2;
          const sc = capType === 'round' ? Math.max(0.02, Math.cos(phi)) : 0.001;
          const off = capType === 'round' ? m * Math.sin(phi) * 0.9 : 0;
          rings.push({ c: P[N].clone().addScaledVector(T[N], off), n: Nn[N], b: Bn[N], sx: a1 * sc, sy: b1 * sc, v: (len + off) / vScale, t: 1, cap: true });
        }
      }
      const pos = [], uv = [], idx = [];
      const se = (c, s) => Math.sign(c) * Math.pow(Math.abs(c), 2 / exp);
      for (let i = 0; i < rings.length; i++) {
        const rg = rings[i];
        for (let k = 0; k <= R; k++) {
          const a = (k / R) * Math.PI * 2;
          let ca = Math.cos(a), sa = Math.sin(a);
          if (exp !== 2) { ca = se(ca, exp); sa = se(sa, exp); }
          let m = 1;
          if (radialFn) m *= radialFn(rg.t, a);
          if (noise) m *= 1 + noise.amp * (C.fbm3(rg.c.x * noise.freq + ca, rg.c.y * noise.freq + sa, rg.c.z * noise.freq, 3, noise.seed || 0) - 0.5) * 2;
          const p = rg.c.clone().addScaledVector(rg.n, rg.sx * ca * m).addScaledVector(rg.b, rg.sy * sa * m);
          pos.push(p.x, p.y, p.z); uv.push(k / R, rg.v);
          if (i < rings.length - 1 && k < R) { const q = i * (R + 1) + k; idx.push(q, q + 1, q + R + 1, q + 1, q + R + 2, q + R + 1); }
        }
      }
      // fecha os polos dos caps com leque central
      const addPole = (ringIndex, center, reverse) => {
        const ci = pos.length / 3; pos.push(center.x, center.y, center.z); uv.push(0.5, rings[ringIndex].v);
        for (let k = 0; k < R; k++) { const q = ringIndex * (R + 1) + k; if (reverse) idx.push(ci, q + 1, q); else idx.push(ci, q, q + 1); }
      };
      if (capStart) addPole(0, rings[0].c.clone().addScaledVector(rings[0].n, 0), true);
      if (capEnd) addPole(rings.length - 1, rings[rings.length - 1].c, false);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      C.fixSeam(g, rings.length, R);
      g.userData.curve = curve; g.userData.length = len;
      return g;
    };
    /** Média das normais na costura u=0/u=1 de malhas em grade. */
    C.fixSeam = function (g, rows, R) {
      const n = g.attributes.normal;
      for (let i = 0; i < rows; i++) {
        const a = i * (R + 1), b = a + R;
        const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b);
        const l = Math.hypot(x, y, z) || 1;
        n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l);
      }
      n.needsUpdate = true;
    };

    /** Superfície em grade fechada em u (anéis) a partir de função f(u,v)→[x,y,z]. u∈[0,1) ao redor, v∈[0,1] ao longo. */
    C.gridGeometry = function (f, nu = 64, nv = 64, o = {}) {
      const pos = [], uv = [], idx = [];
      for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
        const p = f(i / nu, j / nv); pos.push(p[0], p[1], p[2]); uv.push(i / nu * (o.uRepeat || 1), j / nv * (o.vRepeat || 1));
        if (i < nu && j < nv) { const q = j * (nu + 1) + i; if (o.flip) idx.push(q, q + nu + 1, q + 1, q + 1, q + nu + 1, q + nu + 2); else idx.push(q, q + 1, q + nu + 1, q + 1, q + nu + 2, q + nu + 1); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      if (o.closedU !== false) C.fixSeam(g, nv + 1, nu);
      return g;
    };

    /** Deforma posições de uma geometria: fn(Vector3)→void (in place). */
    C.deform = function (g, fn) {
      const p = g.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); fn(v, i); p.setXYZ(i, v.x, v.y, v.z); }
      p.needsUpdate = true; g.computeVertexNormals(); return g;
    };

    /** Espelha uma geometria em x (lado esquerdo) preservando faces voltadas para fora. */
    C.mirrorGeometry = function (g0) {
      const g = g0.clone(); g.scale(-1, 1, 1);
      if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } g.index.needsUpdate = true; }
      else { const p = g.attributes.position; for (let i = 0; i < p.count; i += 3) for (const key of Object.keys(g.attributes)) { const at = g.attributes[key], s = at.itemSize; for (let c = 0; c < s; c++) { const t = at.array[(i + 1) * s + c]; at.array[(i + 1) * s + c] = at.array[(i + 2) * s + c]; at.array[(i + 2) * s + c] = t; } } }
      return g;
    };
    /** Malha espelhada (mesmo material), adicionada ao pai, com info opcional. */
    C.mirrorMesh = function (m, parent, info) {
      const n = C.mesh(C.mirrorGeometry(m.geometry), m.material, parent || m.parent, info || null);
      n.position.set(-m.position.x, m.position.y, m.position.z);
      n.rotation.set(m.rotation.x, -m.rotation.y, -m.rotation.z); n.scale.copy(m.scale);
      return n;
    };
    /** Superfície paramétrica aberta (u,v ∈ [0,1]) → geometria; útil para lâminas (escápula, músculos planos). */
    C.patchGeometry = function (f, nu = 32, nv = 32) {
      const pos = [], uv = [], idx = [];
      for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
        const p = f(i / nu, j / nv); pos.push(p[0], p[1], p[2]); uv.push(i / nu, j / nv);
        if (i < nu && j < nv) { const q = j * (nu + 1) + i; idx.push(q, q + 1, q + nu + 1, q + 1, q + nu + 2, q + nu + 1); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
    };
    /** Lâmina fechada com espessura a partir de superfície média f(u,v) e espessura th(u,v); sentido "externo" = outward(p)→Vector3. */
    C.slabGeometry = function (f, th, nu = 40, nv = 40, outward) {
      const P = [], Nrm = [];
      const h = 1e-3;
      let votes = 0;
      for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
        const u = i / nu, v = j / nv, p = V(f(u, v));
        const du = V(f(Math.min(1, u + h), v)).sub(V(f(Math.max(0, u - h), v)));
        const dv = V(f(u, Math.min(1, v + h))).sub(V(f(u, Math.max(0, v - h))));
        const n = new THREE.Vector3().crossVectors(du, dv).normalize();
        if (outward) votes += n.dot(V(outward(p))) >= 0 ? 1 : -1;
        P.push(p); Nrm.push(n);
      }
      const flipped = outward && votes < 0;
      if (flipped) Nrm.forEach((n) => n.negate());
      const pos = [], uv = [], idx = [];
      const W = nu + 1, layer = (s) => { const base = pos.length / 3; for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const k = j * W + i, t = th(i / nu, j / nv) / 2 * s; const p = P[k].clone().addScaledVector(Nrm[k], t); pos.push(p.x, p.y, p.z); uv.push(i / nu, j / nv); } return base; };
      const top = layer(1), bot = layer(-1);
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
        const q = j * W + i;
        if (!flipped) {
          idx.push(top + q, top + q + 1, top + q + W, top + q + 1, top + q + W + 1, top + q + W);
          idx.push(bot + q, bot + q + W, bot + q + 1, bot + q + 1, bot + q + W, bot + q + W + 1);
        } else {
          idx.push(top + q, top + q + W, top + q + 1, top + q + 1, top + q + W, top + q + W + 1);
          idx.push(bot + q, bot + q + 1, bot + q + W, bot + q + 1, bot + q + W + 1, bot + q + W);
        }
      }
      // bordas
      const cen = new THREE.Vector3(); P.forEach((p) => cen.add(p)); cen.multiplyScalar(1 / P.length);
      const vp = (i) => new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      const edge = (list) => { for (let k = 0; k < list.length - 1; k++) { const a = list[k], b = list[k + 1];
        const A = vp(top + a), B = vp(bot + a), Cc = vp(top + b); const n = new THREE.Vector3().crossVectors(B.clone().sub(A), Cc.clone().sub(A));
        const mid = P[a].clone().add(P[b]).multiplyScalar(0.5).sub(cen);
        if (n.dot(mid) >= 0) idx.push(top + a, bot + a, top + b, top + b, bot + a, bot + b); else idx.push(top + a, top + b, bot + a, top + b, bot + b, bot + a); } };
      const e1 = [], e2 = [], e3 = [], e4 = [];
      for (let i = 0; i <= nu; i++) { e1.push(i); e3.push(nv * W + (nu - i)); }
      for (let j = 0; j <= nv; j++) { e2.push(j * W + nu); e4.push((nv - j) * W); }
      [e1, e2, e3, e4].forEach(edge);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      return g;
    };

    C.ellipsoidGeometry = (radii = [1, 1, 1], ws = 40, hs = 28) => { const g = new THREE.SphereGeometry(1, ws, hs); g.scale(radii[0], radii[1], radii[2]); return g; };

    /** Cilindro/cone entre dois pontos. */
    C.segmentGeometry = function (a, b, r1, r2 = r1, sides = 24, open = false) {
      const A = V(a), B = V(b), d = B.clone().sub(A);
      const g = new THREE.CylinderGeometry(r2, r1, d.length(), sides, 1, open);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
      g.applyQuaternion(q); g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
      return g;
    };

    /* ---------- texturas procedurais (canvas) ---------- */
    const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    const toTex = (cv, o = {}) => {
      const t = new THREE.CanvasTexture(cv);
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
      if (o.srgb) t.colorSpace = THREE.SRGBColorSpace;
      if (o.repeat) t.repeat.set(o.repeat[0], o.repeat[1]);
      return t;
    };
    /** Campo de altura tileável h(x,y)∈[0,1] para tamanho s. */
    const tileNoise = (x, y, s, f, seed, oct = 4) => {
      // ruído periódico: média ponderada de 4 amostras (truque de tile por blending)
      const a = C.fbm3(x * f, y * f, 0.37, oct, seed), b = C.fbm3((x - s) * f, y * f, 0.37, oct, seed);
      const c = C.fbm3(x * f, (y - s) * f, 0.37, oct, seed), d = C.fbm3((x - s) * f, (y - s) * f, 0.37, oct, seed);
      const u = x / s, v = y / s;
      return (a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v);
    };
    const heightToNormal = (H, s, strength = 2) => {
      const cv = canvas(s), ctx = cv.getContext('2d'), img = ctx.createImageData(s, s);
      for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
        const hL = H[y * s + ((x - 1 + s) % s)], hR = H[y * s + ((x + 1) % s)];
        const hU = H[((y - 1 + s) % s) * s + x], hD = H[((y + 1) % s) * s + x];
        let nx = (hL - hR) * strength, ny = (hU - hD) * strength, nz = 1;
        const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
        const i = (y * s + x) * 4;
        img.data[i] = (nx * 0.5 + 0.5) * 255; img.data[i + 1] = (ny * 0.5 + 0.5) * 255; img.data[i + 2] = (nz * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0); return cv;
    };
    const texCache = {};
    C.tex = {
      /** Normal map de ruído orgânico. */
      noiseNormal(key = 'n', o = {}) {
        if (texCache[key]) return texCache[key];
        const s = o.size || 256, H = new Float32Array(s * s);
        for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) H[y * s + x] = tileNoise(x, y, s, o.freq || 0.06, o.seed || 3, o.oct || 4);
        return (texCache[key] = toTex(heightToNormal(H, s, o.strength || 3), o));
      },
      /** Normal map de fibras musculares ao longo de v (direção do comprimento). */
      fibers(key = 'fib', o = {}) {
        if (texCache[key]) return texCache[key];
        const s = o.size || 256, H = new Float32Array(s * s), cycles = o.cycles || 22;
        for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
          const wob = tileNoise(x, y, s, 0.03, 11, 2) * 1.6;
          const base = 0.5 + 0.5 * Math.sin(((x / s) * cycles + wob) * Math.PI * 2);
          const grain = tileNoise(x, y, s, 0.12, 5, 2);
          H[y * s + x] = base * 0.75 + grain * 0.25;
        }
        return (texCache[key] = toTex(heightToNormal(H, s, o.strength || 4), o));
      },
      /** Padrão lobular poligonal (Voronoi) para superfície pulmonar: {map, normal}. */
      lobules(key = 'lob', o = {}) {
        if (texCache[key]) return texCache[key];
        const s = o.size || 512, cells = o.cells || 70, r = C.rng(o.seed || 9);
        const pts = []; for (let i = 0; i < cells; i++) pts.push([r() * s, r() * s]);
        const H = new Float32Array(s * s);
        const cv = canvas(s), ctx = cv.getContext('2d'), img = ctx.createImageData(s, s);
        const base = o.base || [214, 150, 150], line = o.line || [150, 92, 100];
        for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
          let d1 = 1e9, d2 = 1e9;
          for (const p of pts) for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
            const dx = x - p[0] - ox * s, dy = y - p[1] - oy * s, d = dx * dx + dy * dy;
            if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
          }
          const edge = Math.sqrt(d2) - Math.sqrt(d1);
          const e = C.smooth(0, 3.2, edge);
          const n = tileNoise(x, y, s, 0.05, 7, 3);
          H[y * s + x] = e * 0.8 + n * 0.2;
          const i = (y * s + x) * 4, k = 0.88 + 0.12 * n;
          for (let c = 0; c < 3; c++) img.data[i + c] = (line[c] + (base[c] - line[c]) * e) * k;
          img.data[i + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
        const res = { map: toTex(cv, { srgb: true }), normal: toTex(heightToNormal(H, s, 3)) };
        return (texCache[key] = res);
      },
      /** Mapa de cor com variação sutil (mosqueado) a partir de cor base. */
      mottle(key, hex, o = {}) {
        if (texCache[key]) return texCache[key];
        const s = o.size || 256, cv = canvas(s), ctx = cv.getContext('2d'), img = ctx.createImageData(s, s);
        const c = new THREE.Color(hex), amp = o.amp ?? 0.08;
        for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
          const n = tileNoise(x, y, s, o.freq || 0.04, o.seed || 2, 4) - 0.5;
          const i = (y * s + x) * 4, k = 1 + n * amp * 2;
          img.data[i] = Math.min(255, c.r * 255 * k); img.data[i + 1] = Math.min(255, c.g * 255 * k); img.data[i + 2] = Math.min(255, c.b * 255 * k); img.data[i + 3] = 255;
        }
        ctx.putImageData(img, 0, 0); return (texCache[key] = toTex(cv, { srgb: true, ...o }));
      },
    };

    /* ---------- materiais ---------- */
    C.clipPlanes = []; // compartilhado; o app insere/remove planos de corte
    const toSRGB = (hex) => { const c = new THREE.Color(hex); return new THREE.Vector3(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255); };
    /** Instala "cor de corte": faces traseiras (vistas através do plano de corte) recebem cor de secção chapada. */
    C.withCut = function (m, cutHex) {
      m.side = THREE.DoubleSide;
      m.userData.cutColor = toSRGB(cutHex);
      const prev = m.onBeforeCompile;
      m.onBeforeCompile = (sh, r) => {
        if (prev) prev(sh, r);
        sh.uniforms.cutColor = { value: m.userData.cutColor };
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform vec3 cutColor;')
          .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n if(!gl_FrontFacing){ gl_FragColor = vec4(cutColor, 1.0); }');
      };
      m.customProgramCacheKey = () => 'cut' + cutHex;
      return m;
    };
    C.mat = function (o = {}) {
      const p = Object.assign({ color: '#cccccc', roughness: 0.5, metalness: 0 }, o);
      const cut = p.cut; delete p.cut;
      const m = new THREE.MeshPhysicalMaterial(p);
      m.clippingPlanes = C.clipPlanes;
      if (cut !== undefined && cut !== false) C.withCut(m, cut);
      return m;
    };
    const fib = () => C.tex.fibers('fib', { cycles: 26 });
    const nz = () => C.tex.noiseNormal('nz', { freq: 0.05, strength: 2.5 });
    const fine = () => C.tex.noiseNormal('fine', { freq: 0.16, strength: 1.6, seed: 8 });
    C.mats = {};
    C.initMaterials = function () {
      const M = C.mats;
      M.bone = C.mat({ color: '#e2d3b1', roughness: 0.6, sheen: 0.25, sheenColor: '#fff6df', normalMap: nz(), normalScale: new THREE.Vector2(0.35, 0.35), cut: 0xd9b98a });
      M.boneDark = C.mat({ color: '#ddcfae', roughness: 0.66, normalMap: nz(), normalScale: new THREE.Vector2(0.4, 0.4), cut: 0xd2ae7e });
      M.cartilage = C.mat({ color: '#cdd7d6', roughness: 0.32, clearcoat: 0.35, clearcoatRoughness: 0.35, sheen: 0.3, sheenColor: '#eaf6ff', cut: 0xb8c9cc });
      M.disc = C.mat({ color: '#d5dccf', roughness: 0.45, clearcoat: 0.2, cut: 0xc4cbb8 });
      M.vein = C.mat({ color: '#2d5e9c', roughness: 0.28, clearcoat: 0.7, clearcoatRoughness: 0.25, normalMap: fine(), normalScale: new THREE.Vector2(0.15, 0.15), cut: 0x4a1f2a });
      M.artery = C.mat({ color: '#c0392f', roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.25, normalMap: fine(), normalScale: new THREE.Vector2(0.15, 0.15), cut: 0x7a1d1a });
      M.muscle = C.mat({ color: '#a8463d', roughness: 0.55, sheen: 0.6, sheenRoughness: 0.5, sheenColor: '#f2a493', normalMap: fib(), normalScale: new THREE.Vector2(0.55, 0.55), cut: 0x8e3a33 });
      M.muscleDeep = C.mat({ color: '#92413a', roughness: 0.58, sheen: 0.5, sheenColor: '#e79a8a', normalMap: fib(), normalScale: new THREE.Vector2(0.5, 0.5), cut: 0x7d342e });
      M.tendon = C.mat({ color: '#e7dcc8', roughness: 0.3, clearcoat: 0.4, sheen: 0.5, sheenColor: '#ffffff', normalMap: fib(), normalScale: new THREE.Vector2(0.3, 0.3), cut: 0xd8cbb2 });
      M.ligament = C.mat({ color: '#d8cdb5', roughness: 0.35, clearcoat: 0.3, normalMap: fib(), normalScale: new THREE.Vector2(0.35, 0.35), cut: 0xc9bc9f });
      M.nerve = C.mat({ color: '#f0cf5f', roughness: 0.45, sheen: 0.5, sheenColor: '#fff3b8', normalMap: fib(), normalScale: new THREE.Vector2(0.25, 0.25), cut: 0xd9b84c });
      M.lymph = C.mat({ color: '#8fbf63', roughness: 0.35, clearcoat: 0.5, cut: 0x6f9a48 });
      M.lung = C.mat({ color: '#e0a3a3', roughness: 0.62, sheen: 0.6, sheenColor: '#ffd6d6', cut: 0xc98a8f });
      M.pleura = C.mat({ color: '#bfe3ea', roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.1, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
      M.heart = C.mat({ color: '#a94b42', roughness: 0.5, sheen: 0.5, sheenColor: '#f0a090', normalMap: fib(), normalScale: new THREE.Vector2(0.3, 0.3), cut: 0x7e2f2a });
      M.pericardium = C.mat({ color: '#efe2cf', roughness: 0.3, clearcoat: 0.6, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
      M.fat = C.mat({ color: '#efd38a', roughness: 0.55, sheen: 0.3, cut: 0xe7c46d });
      M.thymus = C.mat({ color: '#e6c79b', roughness: 0.6, cut: 0xd9b27c });
      M.trachea = C.mat({ color: '#d7d8cf', roughness: 0.4, clearcoat: 0.25, cut: 0xc6c4b5 });
      M.esophagus = C.mat({ color: '#c98073', roughness: 0.5, sheen: 0.4, cut: 0xb06a5e });
      M.diaphragm = C.mat({ color: '#b65b4d', roughness: 0.5, sheen: 0.5, sheenColor: '#f2b0a0', normalMap: fib(), normalScale: new THREE.Vector2(0.4, 0.4), cut: 0x9a4a3f });
      M.fascia = C.mat({ color: '#f1ebdf', roughness: 0.25, clearcoat: 0.6, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide });
      M.skin = C.mat({ color: '#c99172', roughness: 0.52, sheen: 0.35, sheenRoughness: 0.6, sheenColor: '#ffd9c4', clearcoat: 0.08, clearcoatRoughness: 0.6, normalMap: fine(), normalScale: new THREE.Vector2(0.18, 0.18), cut: 0xefd08a });
      M.steel = new THREE.MeshPhysicalMaterial({ color: '#d4dbe2', metalness: 1, roughness: 0.16 });
      M.glove = new THREE.MeshPhysicalMaterial({ color: '#eadfc8', roughness: 0.42, sheen: 0.6, sheenColor: '#fffaf0', clearcoat: 0.25, clearcoatRoughness: 0.4 });
      M.plasticClear = new THREE.MeshPhysicalMaterial({ color: '#eef8fa', roughness: 0.08, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, clearcoat: 1 });
      M.plasticWhite = new THREE.MeshPhysicalMaterial({ color: '#f1f3f2', roughness: 0.35, clearcoat: 0.4 });
      M.drape = new THREE.MeshPhysicalMaterial({ color: '#4f86b8', roughness: 0.85, sheen: 0.6, sheenColor: '#bcd8f2', side: THREE.DoubleSide });
      M.marker = new THREE.MeshBasicMaterial({ color: '#c99a3e', transparent: true, opacity: 0.9, depthTest: true });
      return M;
    };

    /* ---------- registro de estruturas (seleção, glossário) ---------- */
    ATLAS.registry = ATLAS.registry || new Map();
    /** C.reg(obj, {id, name, group, desc, tip}) — associa metadados didáticos a uma malha/grupo. */
    C.reg = function (obj, info) {
      if (!info || !info.id) return obj;
      obj.userData.info = info;
      let e = ATLAS.registry.get(info.id);
      if (!e) { e = { info, objects: [] }; ATLAS.registry.set(info.id, e); }
      else if (info.desc && !e.info.desc) e.info = Object.assign({}, e.info, info);
      e.objects.push(obj);
      obj.traverse && obj.traverse((c) => { if (c !== obj && c.isMesh && !c.userData.info) c.userData.info = info; });
      return obj;
    };
    /** Cria malha, aplica sombras e adiciona ao pai; info opcional registra. */
    C.mesh = function (geo, mat, parent, info, o = {}) {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = o.cast ?? true; m.receiveShadow = o.receive ?? true;
      if (info) { m.name = info.name || info.id || ''; C.reg(m, info); }
      if (parent) parent.add(m);
      return m;
    };
    C.tube = (pts, opts, mat, parent, info) => C.mesh(C.sweepGeometry(pts, opts), mat, parent, info);
    C.ellipsoid = (center, radii, mat, parent, info, rot) => {
      const m = C.mesh(C.ellipsoidGeometry(radii), mat, parent, info);
      m.position.copy(V(center)); if (rot) m.rotation.set(rot[0], rot[1], rot[2]); return m;
    };

    /* ---------- registro de sólidos para checagem de colisão ---------- */
    ATLAS.solids = ATLAS.solids || [];
    /** C.solid(id, pts, radii) — eixo + raio (para verificação automática de interpenetração). */
    C.solid = function (id, pts, r) { ATLAS.solids.push({ id, pts: C.sample(pts, 40), r: C.profile(r) }); };

    /* ---------- ambiente (IBL procedural) ---------- */
    C.makeEnvironment = function (renderer) {
      const sc = new THREE.Scene();
      const room = new THREE.SphereGeometry(50, 48, 24);
      const cols = [];
      const pa = room.attributes.position;
      for (let i = 0; i < pa.count; i++) {
        const y = pa.getY(i) / 50; const top = new THREE.Color('#f6f1e6'), mid = new THREE.Color('#c9d3cf'), bot = new THREE.Color('#5f6c68');
        const c = y > 0 ? mid.clone().lerp(top, y) : mid.clone().lerp(bot, -y);
        cols.push(c.r, c.g, c.b);
      }
      room.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      sc.add(new THREE.Mesh(room, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
      const panel = (w, h, pos, look, intensity, color = '#ffffff') => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
        m.material.color.multiplyScalar(intensity); m.position.set(...pos); m.lookAt(...look); sc.add(m);
      };
      panel(30, 18, [18, 36, 26], [0, 0, 0], 6);
      panel(22, 14, [-34, 14, 18], [0, 0, 0], 2.4, '#e8f0ff');
      panel(26, 10, [0, 10, -40], [0, 0, 0], 3.2, '#fff1dc');
      panel(40, 6, [0, -30, 10], [0, 0, 0], 0.8);
      const pm = new THREE.PMREMGenerator(renderer);
      const rt = pm.fromScene(sc, 0.03);
      pm.dispose();
      return rt.texture;
    };

    return C;
  };
})();
