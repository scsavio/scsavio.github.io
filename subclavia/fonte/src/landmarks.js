/* ==========================================================================
   landmarks.js — planta anatômica compartilhada (FONTE ÚNICA DE VERDADE)
   x = direita do paciente (+) · y = cranial (+) · z = anterior (+) · cm nominais
   Origem (0,0,0): incisura jugular — borda superior do manúbrio, linha média, face anterior.
   Proporções de adulto masculino médio (~175 cm), postura supina neutra, braços aduzidos.
   Estruturas bilaterais são dadas para o lado DIREITO; o esquerdo é espelho (x → −x),
   exceto onde indicado (vasos assimétricos, ducto torácico).
   NÃO EDITAR durante a fase de módulos — solicitar mudanças ao integrador.
   ========================================================================== */
(function () {
  'use strict';
  const LM = {};
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  /* ---------------- Coluna vertebral ----------------
     y = centro do corpo vertebral; zf = face anterior do corpo; d = profundidade AP do corpo; w = largura do corpo.
     Nível de referência: disco T2/T3 em y = 0 (incisura jugular); ângulo esternal ≈ disco T4/T5. */
  LM.spine = [
    { n: 'C4', y: 10.3, zf: -4.3, d: 1.5, w: 2.0, h: 1.3 },
    { n: 'C5', y: 8.55, zf: -4.6, d: 1.55, w: 2.1, h: 1.35 },
    { n: 'C6', y: 6.8, zf: -5.0, d: 1.6, w: 2.2, h: 1.4 },
    { n: 'C7', y: 5.0, zf: -5.5, d: 1.7, w: 2.4, h: 1.45 },
    { n: 'T1', y: 3.1, zf: -6.0, d: 1.8, w: 2.7, h: 1.55 },
    { n: 'T2', y: 1.05, zf: -6.4, d: 2.0, w: 2.8, h: 1.65 },
    { n: 'T3', y: -1.1, zf: -6.8, d: 2.15, w: 2.9, h: 1.75 },
    { n: 'T4', y: -3.3, zf: -7.2, d: 2.3, w: 3.0, h: 1.8 },
    { n: 'T5', y: -5.55, zf: -7.5, d: 2.45, w: 3.1, h: 1.85 },
    { n: 'T6', y: -7.9, zf: -7.7, d: 2.6, w: 3.2, h: 1.95 },
    { n: 'T7', y: -10.3, zf: -7.8, d: 2.7, w: 3.3, h: 2.0 },
    { n: 'T8', y: -12.75, zf: -7.8, d: 2.8, w: 3.4, h: 2.05 },
    { n: 'T9', y: -15.3, zf: -7.7, d: 2.85, w: 3.5, h: 2.1 },
    { n: 'T10', y: -17.9, zf: -7.5, d: 2.9, w: 3.6, h: 2.15 },
    { n: 'T11', y: -20.55, zf: -7.2, d: 3.0, w: 3.8, h: 2.25 },
    { n: 'T12', y: -23.3, zf: -6.9, d: 3.1, w: 4.0, h: 2.35 },
  ];
  LM.vert = (n) => LM.spine.find((v) => v.n === n);
  /** Face anterior da coluna em função de y (interpolada). */
  LM.spineFront = function (y) {
    const s = LM.spine; if (y >= s[0].y) return s[0].zf; if (y <= s[s.length - 1].y) return s[s.length - 1].zf;
    for (let i = 0; i < s.length - 1; i++) if (y <= s[i].y && y >= s[i + 1].y) { const t = (s[i].y - y) / (s[i].y - s[i + 1].y); return lerp(s[i].zf, s[i + 1].zf, t); }
  };
  LM.spinousTipZ = (y) => LM.spineFront(y) - 8.4; // ponta dos processos espinhosos (aprox.)
  LM.skinBackZ = (y) => LM.spineFront(y) - 10.0;  // pele dorsal na linha média (aprox.)

  /* ---------------- Esterno ---------------- */
  LM.sternum = {
    notchY: 0,            // incisura jugular
    angleY: -4.6,         // ângulo esternal (Louis) — articulação manubrioesternal, nível T4/T5
    xiphisternalY: -14.4, // articulação xifoesternal (~T9)
    xiphoidTipY: -18.0,
    clavNotch: [2.35, 0.05, -0.55], // centro da incisura clavicular (face articular, direita)
  };
  /** Face anterior do esterno z(y). Manúbrio quase vertical; corpo inclinado ~20° (extremidade inferior anterior). */
  LM.sternum.zAnt = function (y) {
    const S = LM.sternum;
    // manúbrio mais inclinado que o corpo → crista anterior no ângulo de Louis (~170°, convexa) + discreto lábio
    const lip = 0.12 * Math.exp(-(((y - S.angleY) / 0.3) ** 2));
    if (y >= S.angleY) return lerp(0, 1.95, (0 - y) / (0 - S.angleY)) + lip;
    if (y >= S.xiphisternalY) return lerp(1.95, 4.3, (S.angleY - y) / (S.angleY - S.xiphisternalY)) + lip;
    return lerp(4.3, 3.9, clamp((S.xiphisternalY - y) / (S.xiphisternalY - S.xiphoidTipY), 0, 1));
  };
  LM.sternum.zAntV1 = function (y) { // perfil da versão 1 (só para migrar as cartilagens)
    const S = LM.sternum;
    if (y >= S.angleY) return lerp(0, 1.0, (0 - y) / (0 - S.angleY));
    if (y >= S.xiphisternalY) return lerp(1.0, 4.3, (S.angleY - y) / (S.angleY - S.xiphisternalY));
    return lerp(4.3, 3.9, clamp((S.xiphisternalY - y) / (S.xiphisternalY - S.xiphoidTipY), 0, 1));
  };
  /** Espessura AP do esterno. */
  LM.sternum.thick = (y) => (y >= LM.sternum.angleY ? lerp(1.35, 1.1, -y / 4.6) : y >= LM.sternum.xiphisternalY ? 1.0 : 0.45);
  LM.sternum.zMid = (y) => LM.sternum.zAnt(y) - LM.sternum.thick(y) / 2;
  /** Meia-largura do esterno (sem as incisuras). */
  LM.sternum.halfWidth = function (y) {
    const S = LM.sternum;
    if (y >= S.angleY) { const t = (0 - y) / (0 - S.angleY); return y > -0.4 ? 2.65 : lerp(2.95, 1.75, C01(t)); }
    if (y >= S.xiphisternalY) { const t = (S.angleY - y) / (S.angleY - S.xiphisternalY); return lerp(1.55, 1.95, Math.sin(t * Math.PI * 0.8)); }
    const t = (S.xiphisternalY - y) / (S.xiphisternalY - S.xiphoidTipY); return lerp(1.1, 0.35, t);
  };
  function C01(t) { return clamp(t, 0, 1); }
  /** Junções esternocostais (lado direito): y de inserção das cartilagens 1–7. */
  LM.sternocostalY = [-1.75, -4.6, -7.0, -9.25, -11.35, -13.15, -14.3];

  /* ---------------- Costelas (lado direito) ----------------
     Cada costela: pontos do eixo (cabeça → tubérculo → ângulo → lateral → junção costocondral)
     e cartilagem costal (junção costocondral → esterno ou cartilagem superior).
     h = altura da secção (borda sup–inf), t = espessura (face interna–externa) no meio da diáfise. */
  function rib(i, head, tub, ang, pl, lat, al, cc, cart, h, t) {
    return { i, pts: [head, tub, ang, pl, lat, al, cc], cartilage: cart, h, t };
  }
  LM.ribs = [
    // 1ª costela: curta, larga, achatada (faces sup./inf.), muito curva; desce para frente.
    { i: 1, pts: [[1.6, 3.4, -7.3], [3.0, 3.55, -8.45], [4.9, 3.15, -8.05], [6.25, 2.35, -6.3], [6.65, 1.55, -4.35], [6.2, 0.6, -2.5], [5.45, -0.35, -1.25], [4.35, -1.0, -0.6], [3.45, -1.45, -0.45]],
      cartilage: [[3.45, -1.45, -0.45], [3.0, -1.65, -0.42], [2.62, -1.78, -0.42]], h: 0.42, t: 1.55, flat: true,
      scaleneTubercle: [5.15, 0.0, -1.75], grooveVein: [4.9, -0.45, -0.8], grooveArtery: [5.95, 0.85, -2.6] },
    rib(2, [1.75, 1.6, -8.0], [3.35, 1.75, -9.6], [5.0, 1.35, -11.6], [8.0, 0.2, -10.6], [9.65, -1.6, -6.4], [8.6, -3.6, -2.0], [5.65, -5.35, 0.25],
      [[5.65, -5.35, 0.25], [4.0, -5.0, 0.45], [2.75, -4.7, 0.42], [1.85, -4.6, 0.4]], 1.05, 0.5),
    rib(3, [1.85, -0.55, -8.5], [3.5, -0.35, -10.2], [5.8, -0.9, -13.2], [9.6, -2.6, -11.6], [11.35, -4.9, -6.4], [10.1, -7.0, -1.2], [6.95, -8.4, 1.1],
      [[6.95, -8.4, 1.1], [5.0, -7.8, 1.35], [3.3, -7.2, 1.35], [1.75, -7.0, 1.3]], 1.15, 0.52),
    rib(4, [1.9, -2.75, -8.9], [3.6, -2.55, -10.6], [6.3, -3.2, -14.0], [10.6, -5.2, -12.0], [12.45, -7.6, -6.4], [11.1, -9.8, -0.6], [7.75, -11.1, 1.85],
      [[7.75, -11.1, 1.85], [5.5, -10.2, 2.1], [3.5, -9.5, 2.05], [1.85, -9.25, 2.0]], 1.2, 0.54),
    rib(5, [1.95, -5.0, -9.2], [3.7, -4.8, -10.95], [6.6, -5.5, -14.4], [11.3, -7.7, -12.2], [13.2, -10.2, -6.4], [11.8, -12.4, -0.1], [8.3, -13.7, 2.45],
      [[8.3, -13.7, 2.45], [5.9, -12.5, 2.75], [3.8, -11.6, 2.75], [1.95, -11.35, 2.7]], 1.22, 0.55),
    rib(6, [2.0, -7.35, -9.4], [3.8, -7.15, -11.2], [6.8, -7.9, -14.6], [11.8, -10.3, -12.3], [13.7, -12.9, -6.4], [12.3, -15.1, 0.2], [8.8, -16.4, 2.85],
      [[8.8, -16.4, 2.85], [6.4, -15.2, 3.25], [4.0, -13.8, 3.3], [1.95, -13.15, 3.3]], 1.25, 0.55),
    rib(7, [2.05, -9.75, -9.5], [3.9, -9.55, -11.35], [7.0, -10.4, -14.7], [12.1, -12.9, -12.3], [14.0, -15.6, -6.3], [12.7, -17.9, 0.0], [9.4, -19.2, 2.85],
      [[9.4, -19.2, 2.85], [7.2, -18.0, 3.4], [4.6, -15.9, 3.75], [2.6, -14.7, 3.75], [1.55, -14.35, 3.7]], 1.25, 0.55),
    rib(8, [2.1, -12.2, -9.5], [4.0, -12.0, -11.4], [7.2, -12.9, -14.7], [12.3, -15.4, -12.2], [14.1, -18.1, -6.2], [13.2, -20.3, -1.2], [10.6, -21.6, 2.2],
      [[10.6, -21.6, 2.2], [9.2, -20.6, 3.0], [7.3, -18.4, 3.45]], 1.2, 0.54),
    rib(9, [2.15, -14.75, -9.4], [4.1, -14.55, -11.3], [7.3, -15.4, -14.5], [12.2, -17.9, -12.0], [13.9, -20.4, -6.0], [13.4, -22.4, -1.9], [11.6, -23.6, 1.1],
      [[11.6, -23.6, 1.1], [10.6, -22.8, 2.2], [9.3, -20.75, 2.95]], 1.1, 0.52),
    rib(10, [2.2, -17.35, -9.2], [4.2, -17.15, -11.0], [7.3, -18.0, -14.1], [11.9, -20.3, -11.6], [13.4, -22.6, -5.6], [13.1, -24.4, -2.2], [12.2, -25.3, -0.2],
      [[12.2, -25.3, -0.2], [11.5, -24.6, 1.0], [10.7, -22.95, 2.1]], 1.0, 0.5),
    // costelas flutuantes
    { i: 11, pts: [[2.3, -20.0, -8.9], [4.3, -19.8, -10.6], [7.0, -20.6, -13.4], [10.8, -22.6, -10.9], [12.2, -24.4, -6.6], [12.0, -25.4, -4.0]], cartilage: null, h: 0.85, t: 0.45, floating: true },
    { i: 12, pts: [[2.4, -22.75, -8.6], [4.3, -22.6, -10.1], [6.4, -23.5, -12.2], [8.6, -25.1, -11.4], [9.6, -26.0, -9.6]], cartilage: null, h: 0.75, t: 0.42, floating: true },
  ];

  // migração v2: as extremidades esternais das cartilagens acompanham o novo perfil do esterno
  LM.ribs.forEach((rb) => {
    const c = rb.cartilage; if (!c || c.length < 2) return;
    const n = c.length - 1;
    c.forEach((q, j) => { const w = Math.pow(j / n, 1.3); const d = LM.sternum.zAnt(q[1]) - LM.sternum.zAntV1(q[1]); q[2] = +(q[2] + w * d).toFixed(3); });
    // primeiro ponto da cartilagem = último ponto do corpo da costela (mantém continuidade)
    if (rb.pts && rb.pts.length) { const last = rb.pts[rb.pts.length - 1]; if (Math.hypot(last[0] - c[0][0], last[1] - c[0][1]) < 0.05) last[2] = c[0][2]; }
  });

  /* ---------------- Clavícula (direita) ----------------
     Em "S": 2/3 mediais convexos anteriormente; 1/3 lateral côncavo anteriormente e achatado.
     ry = semi-eixo vertical, rh = semi-eixo horizontal (AP) ao longo de t∈[0,1] (medial→lateral). */
  LM.clavicle = {
    pts: [[2.55, 0.62, -0.42], [3.4, 0.95, 0.05], [5.2, 1.3, 0.62], [7.2, 1.42, 0.88], [9.3, 1.48, 0.62], [11.0, 1.55, -0.2], [12.6, 1.70, -1.55], [14.2, 1.92, -2.55], [15.9, 2.08, -2.7]],
    ry: [[0, 1.05], [0.08, 0.9], [0.25, 0.72], [0.5, 0.62], [0.7, 0.48], [0.88, 0.38], [1, 0.42]],
    rh: [[0, 0.95], [0.08, 0.85], [0.25, 0.72], [0.5, 0.66], [0.7, 0.85], [0.88, 1.15], [1, 1.0]],
    sternalFacet: [2.45, 0.45, -0.45],
    acromialFacet: [16.05, 2.1, -2.75],
    conoidTubercle: [12.9, 1.3, -2.5],
    junctionMedialMiddle: [7.3, 1.42, 0.86], // junção terço medial / terço médio (≈ "curvatura")
  };

  /* ---------------- Escápula, úmero (direitos) ---------------- */
  LM.scapula = {
    superiorAngle: [6.6, 0.6, -15.0],
    inferiorAngle: [8.6, -13.4, -13.9],
    medialSpineRoot: [6.1, -2.6, -15.5],
    glenoidCenter: [14.35, -1.9, -5.55],
    glenoidNormal: [0.84, 0.05, 0.54],
    neck: [13.4, -1.8, -6.6],
    acromion: { base: [14.6, 0.6, -8.0], mid: [16.6, 1.5, -5.6], tip: [17.4, 1.75, -3.6], facet: [16.15, 1.95, -2.95] },
    coracoid: { base: [13.3, -0.7, -5.0], knee: [13.6, 0.0, -2.9], tip: [12.65, -1.0, -0.15] }, // ponta palpável ~2–2,5 cm abaixo da clavícula
    suprascapularNotch: [11.6, 0.25, -9.0],
  };
  /* ---------------- Escápula: superfície média compartilhada (skeleton + muscles) ----------------
     Patch de Coons das bordas (pré-ajuste) + "warp" radial que afasta a lâmina do envoltório costal
     (costelas 2–9) por GAP cm — espaço do subescapular e do serrátil anterior. O warp é um campo
     δ(θ, y) em torno do eixo (x=0, z=ZC), ~0 junto ao colo/acrômio/coracoide (ligados a LM).
     Uso: const SG = LM.scapulaGeom(); SG.mid(u,v) → [x,y,z]; SG.warp([x,y,z]) → [x,y,z]; SG.th(u,v). */
  LM.scapulaGeom = (function () {
    let G = null;
    return function () {
      if (G) return G;
      const T = window.THREE, Sc = LM.scapula;
      const ZC = -5.8, GAP = 1.05;
      const V = (a) => new T.Vector3(a[0], a[1], a[2]);
      const crv = (pts) => new T.CatmullRomCurve3(pts.map(V), false, 'centripetal');
      const cl = (x) => Math.min(1, Math.max(0, x));
      const medial = crv([Sc.superiorAngle, [6.1, -2.6, -15.6], [5.95, -6.4, -15.9], [6.8, -10.4, -15.2], Sc.inferiorAngle]);
      const lateral = crv([Sc.inferiorAngle, [10.4, -9.8, -12.0], [11.95, -6.2, -9.4], [13.0, -3.0, -7.2]]);
      const superior = crv([Sc.superiorAngle, [8.6, 0.55, -13.4], [10.6, 0.35, -10.6], [12.4, -0.15, -8.0]]);
      const neck = crv([[12.4, -0.15, -8.0], [12.9, -1.5, -7.5], [13.0, -3.0, -7.2]]);
      const IA = V(Sc.inferiorAngle), SA = V(Sc.superiorAngle);
      const Pm = (v) => medial.getPointAt(cl(1 - v));
      const Pl = (v) => (v < 0.82 ? lateral.getPointAt(cl(v / 0.82)) : neck.getPointAt(cl(1 - (v - 0.82) / 0.18)));
      const L0 = Pl(0), L1 = Pl(1);
      const coons = (u, v) => {
        const p = Pm(v).multiplyScalar(1 - u).add(Pl(v).multiplyScalar(u)).addScaledVector(IA, 1 - v).add(superior.getPointAt(cl(u)).multiplyScalar(v))
          .addScaledVector(IA, -(1 - u) * (1 - v)).addScaledVector(L0, -u * (1 - v)).addScaledVector(SA, -(1 - u) * v).addScaledVector(L1, -u * v);
        const b = Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.55; p.x -= b * 0.3; p.z -= b; // fossa subescapular
        return p;
      };
      const th = (u, v) => 0.2 + 0.55 * Math.pow(Math.max(0, u - 0.75) / 0.25, 1.5) + 0.25 * Math.exp(-((u / 0.08) ** 2)) + 0.2 * Math.exp(-(((1 - v) / 0.08) ** 2));
      // --- envoltório costal posterior em grade polar (θ, y) ---
      const Y0 = -17, Y1 = 4, DY = 0.25, NY = Math.round((Y1 - Y0) / DY) + 1;
      const NT = 360, DT = (2 * Math.PI) / NT;
      const ti = (th_) => ((Math.round((th_ + Math.PI) / DT) % NT) + NT) % NT;
      const yi = (y) => Math.round((y - Y0) / DY);
      const R = new Float32Array(NT * NY);
      LM.ribs.forEach((rb) => {
        if (rb.i < 2 || rb.i > 9) return;
        const c = crv(rb.pts), n = 260, hh = (rb.h || 1.1) / 2, tt = (rb.t || 0.5) / 2;
        for (let k = 0; k <= n; k++) {
          const q = c.getPointAt(k / n); if (q.x < 0) continue;
          const r = Math.hypot(q.x, q.z - ZC) + tt, t0 = ti(Math.atan2(q.z - ZC, q.x));
          for (let j = yi(q.y - hh); j <= yi(q.y + hh); j++) { if (j < 0 || j >= NY) continue;
            for (let dt = -1; dt <= 1; dt++) { const id = ((t0 + dt + NT) % NT) + NT * j; if (r > R[id]) R[id] = r; } }
        }
      });
      const filt = (src, rt, ry, op) => { const out = new Float32Array(src.length);
        for (let j = 0; j < NY; j++) for (let t = 0; t < NT; t++) { let acc = op === 'max' ? 0 : 0, w = 0;
          for (let dj = -ry; dj <= ry; dj++) { const jj = j + dj; if (jj < 0 || jj >= NY) continue;
            for (let d = -rt; d <= rt; d++) { const v = src[((t + d + NT) % NT) + NT * jj]; if (op === 'max') { if (v > acc) acc = v; } else { acc += v; w++; } } }
          out[t + NT * j] = op === 'max' ? acc : acc / w; }
        return out; };
      const env = filt(filt(R, 1, 6, 'max'), 2, 2, 'avg'); // ponte sobre os espaços intercostais (±1,5 cm)
      const at = (A, th_, y) => { const ft = (th_ + Math.PI) / DT, fy = (y - Y0) / DY; if (fy < 0 || fy > NY - 1) return 0;
        const t0 = Math.floor(ft), j0 = Math.min(NY - 2, Math.floor(fy)), a = ft - t0, b = fy - j0, T0 = ((t0 % NT) + NT) % NT, T1 = (T0 + 1) % NT;
        return (A[T0 + NT * j0] * (1 - a) + A[T1 + NT * j0] * a) * (1 - b) + (A[T0 + NT * (j0 + 1)] * (1 - a) + A[T1 + NT * (j0 + 1)] * a) * b; };
      // --- campo de afastamento δ(θ, y) a partir da lâmina ---
      const D = new Float32Array(NT * NY), n = 48;
      for (let jv = 0; jv <= n; jv++) for (let iu = 0; iu <= n; iu++) {
        const u = iu / n, v = jv / n, p = coons(u, v), r = Math.hypot(p.x, p.z - ZC), a = Math.atan2(p.z - ZC, p.x);
        const e = at(env, a, p.y); if (!e) continue;
        const need = e + GAP + th(u, v) / 2 - r; if (need <= 0) continue;
        const id = ti(a) + NT * Math.max(0, Math.min(NY - 1, yi(p.y))); if (need > D[id]) D[id] = need;
      }
      const Dm = filt(filt(D, 3, 5, 'max'), 4, 6, 'avg');
      const envS = filt(env, 6, 4, 'avg'); // envoltório suavizado: só para a direção (normal da parede)
      const warpV = (p) => { const r = Math.hypot(p.x, p.z - ZC); if (r < 1e-6) return p; const a = Math.atan2(p.z - ZC, p.x), d = at(Dm, a, p.y); if (d <= 0) return p;
        // desloca ao longo da normal da parede costal: e_r − (E'/r)·e_θ (componente radial = d)
        const dE = (at(envS, a + 4 * DT, p.y) - at(envS, a - 4 * DT, p.y)) / (8 * DT), g = Math.max(-1.2, Math.min(1.2, dE / Math.max(4, r)));
        const ca = Math.cos(a), sa = Math.sin(a);
        p.x += d * (ca + g * sa); p.z += d * (sa - g * ca); return p; };
      G = {
        ZC, GAP, th,
        coons: (u, v) => coons(u, v).toArray(),
        mid: (u, v) => warpV(coons(u, v)).toArray(),
        midV: (u, v) => warpV(coons(u, v)),
        warp: (a) => warpV(V(a)).toArray(),
        delta: (a) => { const r = Math.hypot(a[0], a[2] - ZC); return at(Dm, Math.atan2(a[2] - ZC, a[0]), a[1]); },
        cageR: (a) => at(env, Math.atan2(a[2] - ZC, a[0]), a[1]),
      };
      // pontos derivados (já ajustados) para uso pelos módulos
      G.superiorAngle = G.warp(Sc.superiorAngle); G.inferiorAngle = G.warp(Sc.inferiorAngle); G.medialSpineRoot = G.warp(Sc.medialSpineRoot);
      G.spinePts = [[6.2, -2.45, -15.9], [8.6, -1.6, -14.9], [11.2, -0.55, -12.4], [13.4, 0.3, -9.6], Sc.acromion.base].map(G.warp);
      G.suprascapularNotch = G.warp(Sc.suprascapularNotch);
      return G;
    };
  })();
  LM.humerus = {
    headCenter: [16.45, -1.75, -3.95], headR: 2.3,
    greaterTubercle: [18.5, -1.8, -3.2], lesserTubercle: [17.6, -2.4, -1.6],
    surgicalNeck: [17.4, -5.0, -3.6],
    shaftEnd: [17.9, -17.0, -3.9], // corte didático no terço médio do braço
  };

  /* ---------------- Vasos principais (centros e raios) ----------------
     Veias: anteriores; artérias: posteriores ao escaleno anterior. Raios em cm. */
  LM.vessels = {
    // Veia axilar → subclávia direita → ângulo venoso (atrás da articulação esternoclavicular)
    // (onda 3: trecho distal ~0,3–0,45 cm medial — veia MEDIAL/anterior à 3ª parte da artéria, com espaço para a raiz
    //  medial do mediano cruzar a face anterior da artéria entre as duas; onda 4: na janela infraclavicular x 9,5–13 a veia
    //  fica caudal à artéria — artéria ~0,45 cm cranial perto do meio da clavícula e >1 cm em x≈13: a sobreposição na
    //  projeção anterior diminui lateralmente, como no ultrassom (Galloway & Bodenham))
    axillaryV: { pts: [[14.2, -7.3, -2.6], [13.0, -4.65, -2.0], [11.8, -2.95, -1.3], [10.2, -1.32, -0.68], [8.2, -0.05, -0.55], [6.6, 0.32, -0.5]], r: [0.55, 0.6, 0.62, 0.64, 0.65, 0.66] },
    scv: { pts: [[6.6, 0.32, -0.5], [5.6, 0.45, -0.62], [4.6, 0.45, -0.95], [3.65, 0.38, -1.55], [2.95, 0.3, -2.15]], r: [0.66, 0.67, 0.68, 0.7, 0.72],
      note: 'Começa na borda lateral da 1ª costela (x≈6.6); termina atrás da articulação esternoclavicular unindo-se à VJI.' },
    venousAngleR: [2.95, 0.3, -2.15],
    ijvR: { pts: [[3.4, 11.0, -2.6], [3.45, 8.0, -2.1], [3.35, 5.0, -1.8], [3.2, 2.6, -1.85], [3.05, 1.1, -2.05], [2.95, 0.3, -2.15]], r: [0.62, 0.7, 0.78, 0.85, 0.82, 0.75] }, // bulbo inferior dilatado
    rbcv: { pts: [[2.95, 0.3, -2.15], [2.75, -0.6, -2.2], [2.55, -1.5, -2.25], [2.45, -2.3, -2.3]], r: [0.75, 0.8, 0.85, 0.9] },
    lbcv: { pts: [[-2.95, 0.3, -2.15], [-2.1, -0.35, -2.15], [-0.8, -1.0, -1.95], [0.6, -1.65, -1.75], [1.65, -2.1, -1.95], [2.45, -2.3, -2.3]], r: [0.7, 0.66, 0.62, 0.62, 0.66, 0.8] },
    svc: { pts: [[2.45, -2.3, -2.3], [2.5, -4.4, -2.4], [2.5, -6.6, -2.6], [2.35, -8.6, -2.9]], r: [0.95, 0.98, 1.0, 1.02], note: 'Formada atrás da 1ª cartilagem costal direita; entra no átrio direito ~3ª cartilagem.' },
    cavoatrialJunction: [2.35, -8.6, -2.9],
    // Artérias
    aorta: { pts: [[-0.2, -9.2, -3.3], [0.0, -6.8, -2.6], [-0.15, -4.6, -2.3], [-0.9, -3.25, -2.3], [-2.0, -3.05, -3.7], [-2.5, -3.75, -5.3], [-2.65, -5.2, -6.7], [-2.7, -7.5, -7.4], [-2.6, -12.0, -7.4], [-2.2, -17.0, -7.0], [-0.85, -22.3, -6.02]],
      r: [1.35, 1.38, 1.32, 1.25, 1.18, 1.12, 1.08, 1.05, 1.0, 0.95, 0.9] },
    bct: { pts: [[-0.5, -3.15, -2.3], [0.75, -2.0, -2.7], [1.55, -0.85, -2.95], [2.15, 0.1, -3.4]], r: [0.62, 0.6, 0.58, 0.56], note: 'Tronco braquiocefálico: bifurca atrás da articulação esternoclavicular direita.' },
    bctBifurcation: [2.15, 0.1, -3.4],
    scaR: { pts: [[2.15, 0.1, -3.4], [3.1, 1.5, -3.5], [4.1, 2.6, -3.15], [5.0, 2.8, -2.8], [5.9, 1.95, -2.6], [6.6, 1.25, -2.3], [8.0, 0.55, -1.9], [9.8, -0.4, -1.6]],
      r: [0.48, 0.46, 0.45, 0.44, 0.43, 0.42, 0.41, 0.4],
      note: '1ª parte medial ao escaleno anterior; 2ª parte posterior a ele (ponto mais alto, sobre a cúpula); 3ª parte até a borda lateral da 1ª costela.' },
    axillaryA: { pts: [[9.8, -0.4, -1.55], [11.6, -1.4, -1.9], [13.2, -3.0, -2.6], [14.4, -5.6, -3.4], [15.0, -7.6, -3.9]], r: [0.4, 0.39, 0.38, 0.37, 0.36] },
    ccaR: { pts: [[2.15, 0.1, -3.4], [2.25, 2.5, -2.9], [2.25, 6.0, -2.3], [2.2, 11.0, -2.3]], r: [0.45, 0.44, 0.43, 0.42] },
    ccaL: { pts: [[-1.25, -2.45, -2.6], [-1.55, -0.8, -3.1], [-1.85, 2.5, -2.9], [-2.15, 6.0, -2.3], [-2.2, 11.0, -2.3]], r: [0.45, 0.44, 0.43, 0.43, 0.42] },
    scaL: { pts: [[-2.1, -2.4, -4.2], [-2.35, -0.8, -4.3], [-2.45, 0.9, -3.95], [-3.3, 2.3, -3.5], [-4.1, 2.6, -3.15], [-5.0, 2.8, -2.8], [-5.9, 1.95, -2.6], [-6.6, 1.25, -2.3], [-8.0, 0.55, -1.9], [-9.8, -0.4, -1.6]],
      r: [0.5, 0.48, 0.47, 0.46, 0.45, 0.44, 0.43, 0.42, 0.41, 0.4] },
    // Jugular externa direita: superficial ao ECM, cruza-o obliquamente; drena na veia subclávia lateral ao escaleno anterior.
    ejvR: { pts: [[5.0, 11.0, -0.45], [5.35, 7.5, -0.7], [5.95, 4.5, -0.6], [6.35, 2.6, -0.65], [6.25, 1.3, -0.62], [6.0, 0.75, -0.55]], r: [0.22, 0.24, 0.26, 0.27, 0.28, 0.28] },
    // Cefálica direita: sulco deltopeitoral → perfura a fáscia clavipeitoral → veia axilar logo abaixo da clavícula.
    cephalicR: { pts: [[16.6, -9.0, 0.55], [15.3, -5.0, 0.85], [14.3, -2.2, 0.7], [13.4, -0.85, 0.55], [12.4, -0.2, 0.35], [11.8, -1.15, -0.32], [11.25, -1.85, -0.78]], r: [0.25, 0.27, 0.28, 0.28, 0.29, 0.3, 0.32] }, // (onda 4: termina na veia axilar rebaixada)
    // Vertebral direita: da face superior da 1ª parte da subclávia ao forame transverso de C6
    vertebralAR: { pts: [[3.2, 1.75, -3.5], [3.0, 2.9, -4.3], [2.35, 4.5, -5.35], [1.7, 6.0, -6.15], [1.32, 6.8, -6.46], [1.36, 9.6, -5.8], [1.34, 11.0, -5.5]], r: 0.2 },
    // Torácica interna direita: da face inferior da 1ª parte, desce atrás das cartilagens, ~1–1,5 cm da borda esternal
    itaR: { pts: [[3.3, 1.05, -3.3], [3.52, 0.45, -2.82], [3.68, -0.2, -2.42], [3.66, -0.85, -1.9], [3.5, -1.55, -1.38], [3.35, -2.2, -1.12], [3.25, -2.9, -0.72], [3.1, -5.0, 0.2], [3.05, -7.2, 0.95], [3.05, -9.5, 1.5], [3.1, -11.6, 2.0], [3.15, -13.0, 2.25]], r: 0.15 },
  };

  /* ---------------- Músculos-chave para relações ---------------- */
  LM.muscles = {
    // Escaleno anterior direito: tubérculos anteriores C3–C6 → tubérculo escalênico da 1ª costela.
    scaleneAnt: { pts: [[3.0, 10.4, -4.4], [3.55, 7.6, -3.55], [4.3, 4.6, -2.55], [4.85, 2.0, -1.95], [5.15, 0.25, -1.75]], w: [0.45, 0.62, 0.72, 0.62, 0.5], t: [0.3, 0.42, 0.5, 0.48, 0.32],
      note: 'Separa veia subclávia (anterior) da artéria subclávia e do plexo (posteriores). Nervo frênico desce sobre sua face anterior.' },
    // Escaleno médio: tubérculos posteriores C2–C7 → face superior da 1ª costela, atrás do sulco arterial.
    scaleneMid: { pts: [[3.6, 10.6, -5.6], [4.4, 7.6, -5.4], [5.4, 4.4, -4.6], [6.0, 2.0, -3.9], [6.45, 1.55, -3.9]], w: [0.6, 0.8, 0.9, 0.85, 0.7], t: [0.4, 0.5, 0.55, 0.5, 0.4] },
  };

  // Esternocleidomastóideo direito (referência p/ músculos, VJE e pele): cabeça esternal (face anterior do manúbrio),
  // cabeça clavicular (face superior do terço medial da clavícula); ventre sobe em direção ao processo mastoide (fora do recorte, y>11).
  LM.muscles.scm = {
    sternalOrigin: [0.95, -0.55, 0.45], clavicularOrigin: [[3.2, 1.75, 0.55], [5.6, 2.05, 0.55]],
    belly: [[2.1, 2.6, 0.2], [3.4, 5.5, -0.35], [4.6, 8.5, -1.0], [5.6, 11.0, -1.6]],
    note: 'Entre as cabeças esternal e clavicular: fossa supraclavicular menor (sobre a VJI). Borda posterior ~x 5–6 na base do pescoço.',
  };

  /* ---------------- Pleura e pulmões ----------------
     Cúpula pleural: sobe ~2,5 cm acima do terço medial da clavícula em projeção anterior
     (na verdade é posterior — no nível do colo da 1ª costela). */
  LM.pleura = {
    cupulaApex: [4.4, 3.65, -6.0],
    cupulaCenter: [4.4, 1.65, -6.0], cupulaR: 2.0, // esfera de exclusão aproximada; o ápice real é achatado medialmente (sulcos da subclávia)
    // limites parietais (linhas de reflexão) — lado direito: [y na LHC, y na LAM, y paravertebral]
    reflection: { midclavicularRib: 8, midaxillaryRib: 10, paravertebralRib: 12 },
    lungLower: { midclavicularRib: 6, midaxillaryRib: 8, paravertebralRib: 10 },
  };
  LM.trachea = { pts: [[0, 11.0, -1.0], [0, 7.0, -1.35], [0, 3.0, -2.3], [0.05, 0.0, -3.3], [0.15, -2.4, -4.3], [0.3, -4.6, -5.25]], r: 0.95, carina: [0.3, -4.75, -5.35] };
  LM.esophagus = { pts: [[0.1, 11.0, -3.2], [0.15, 7.0, -3.7], [-0.25, 3.0, -4.6], [-0.45, 0.0, -5.45], [-0.7, -4.0, -6.5], [-0.6, -10.0, -6.6], [-1.0, -16.0, -5.8], [-1.8, -20.0, -4.8]], r: 0.75 };
  LM.heart = { center: [-0.9, -12.6, -3.4], apex: [-7.6, -15.6, 0.6], base: [0.6, -9.2, -5.6] };
  LM.diaphragm = { domeR: [6.0, -14.2, -4.0], domeL: [-6.0, -15.6, -4.5], centralTendon: [0, -16.0, -1.5] };

  /* ---------------- Nervos e linfáticos (referências) ---------------- */
  LM.nerves = {
    // Troncos do plexo braquial: entre escalenos anterior e médio, posterossuperiores à artéria.
    plexusTrunks: [
      { n: 'Tronco superior (C5–C6)', pts: [[3.9, 8.2, -4.7], [4.9, 5.4, -3.9], [6.0, 3.0, -3.1], [7.4, 1.5, -2.55], [9.4, 0.4, -2.2], [11.2, -0.7, -2.4]] },
      { n: 'Tronco médio (C7)', pts: [[4.0, 6.0, -5.0], [5.0, 3.9, -3.95], [6.2, 2.4, -3.3], [7.6, 1.35, -2.85], [9.6, 0.15, -2.5], [11.4, -1.1, -2.65]] },
      { n: 'Tronco inferior (C8–T1)', pts: [[3.3, 4.1, -6.2], [4.45, 3.6, -4.85], [5.65, 2.4, -3.7], [6.7, 1.95, -3.1], [8.0, 1.1, -2.8], [9.6, -0.05, -2.65], [11.3, -1.45, -2.85]] },
    ],
    // Frênico: face anterior do escaleno anterior (de lateral para medial), passa entre artéria e veia.
    phrenicR: [[3.75, 8.6, -3.32], [4.35, 5.5, -2.26], [4.3, 3.4, -1.75], [3.85, 1.6, -2.1], [3.5, 0.35, -2.8], [3.5, -1.2, -2.85], [3.6, -4.4, -2.75], [4.4, -8.5, -3.0], [4.9, -13.0, -3.2]],
    // Vago direito: entre VJI e ACC (posterior); cruza anteriormente a 1ª parte da subclávia.
    vagusR: [[2.75, 11.0, -3.3], [2.8, 6.0, -3.05], [2.8, 2.0, -2.95], [2.6, 0.75, -2.9], [2.7, -0.3, -3.3], [2.25, -1.3, -4.0], [1.5, -3.0, -5.0], [1.2, -4.8, -6.0]],
    recurrentR: [[2.6, 0.75, -2.9], [2.75, -0.05, -3.3], [2.65, 0.2, -4.05], [2.2, 1.2, -4.15], [1.1, 3.0, -3.35], [0.85, 6.0, -2.55]],
  };
  LM.lymph = {
    // Ducto torácico (ESQUERDO): sobe à esquerda do esôfago, arqueia no nível de C7 e drena no ângulo venoso ESQUERDO.
    thoracicDuct: [[0.6, -21.0, -6.95], [0.8, -14.0, -7.5], [0.65, -10.0, -7.6], [0.2, -6.8, -7.45], [-0.8, -4.6, -7.1], [-1.6, -2.5, -6.75], [-1.95, 1.5, -5.6], [-2.35, 2.6, -4.5], [-2.6, 3.4, -3.85], [-3.3, 3.9, -3.4], [-3.85, 3.2, -3.0], [-3.85, 1.8, -2.85], [-3.1, 0.6, -2.4]],
    rightLymphDuct: [[4.1, 1.6, -2.7], [3.55, 0.95, -2.5], [3.05, 0.45, -2.3]],
  };

  /* ---------------- Superfície / pele (referências) ----------------
     Espessuras médias de partes moles (didáticas) e marcos palpáveis. */
  LM.surface = {
    notchSkin: [0, 0.35, 0.75],              // pele sobre a incisura jugular (depressão)
    sternalAngleSkin: [0, -4.6, 3.0],
    clavicleSkinOffset: 0.55,               // pele sobre a face anterior/superior da clavícula
    infraclavicularFatPec: 2.3,             // subcutâneo + peitoral maior abaixo da clavícula (aprox.)
    deltopectoralGroove: [[13.8, 1.0, 0.6], [14.4, -2.5, 1.3], [15.4, -7.0, 1.6]],
    coracoidSkin: [12.7, -1.0, 2.0],
  };

  /* ---------------- Trajetória didática da agulha (técnica por marcos, infraclavicular) ----------------
     entrySkin: ~2 cm caudal e ~1–2 cm lateral à junção dos terços medial/médio da clavícula.
     veinTarget: luz da veia subclávia sob o terço medial da clavícula.
     Direção-guia: medial e discretamente cranial, rumo à incisura jugular; trajeto rente à face posterior da clavícula. */
  LM.needle = {
    entrySkin: [10.0, 0.0, 2.15],   // ~1 cm abaixo da borda inferior da clávicula, lateral à junção dos terços medial/médio
    veinTarget: [5.0, 0.5, -0.75],     // luz da veia; a agulha cruza a parede anteroinferior por volta de x≈6,3
    notchAim: [0, 0.6, 0.2],
    thumbSkin: [7.4, 0.35, 2.3],      // polegar logo abaixo da clavícula (junção dos terços)
    indexSkin: [0, 0.35, 0.75],        // polpa do indicador na incisura jugular
    skinAngleDeg: 30,   // inclinação inicial para cruzar a pele (descrição de Braner et al.)
  };

  /* ---------------- Vistas de câmera sugeridas (alvo, raio, azimute, elevação) ---------------- */
  LM.views = {
    front: { target: [0, -6, -3], radius: 74, az: 0, el: 0.06 },
    oblique: { target: [5.5, -0.5, -1.5], radius: 36, az: -0.62, el: 0.28 },
    side: { target: [6.5, -0.5, -2], radius: 34, az: -1.45, el: 0.08 },
    hand: { target: [5, 0.5, 1.5], radius: 34, az: -0.08, el: 0.3 },
    close: { target: [5.0, 0.6, -1.2], radius: 19, az: -0.38, el: 0.22 },
    top: { target: [5, 0, -3], radius: 40, az: -0.2, el: 1.25 },
    back: { target: [0, -6, -8], radius: 74, az: Math.PI, el: 0.08 },
  };

  window.LM = LM;
})();
