/* skeleton.js — coluna (C4–T12), costelas 1–12 + cartilagens, esterno, clavículas, escápulas, úmeros proximais.
   Lado direito construído a partir de LM; lado esquerdo por espelhamento. */
ATLAS.define('skeleton', function (ctx) {
  const { THREE, C, LM, layers } = ctx;
  const M = C.mats, L = layers.bones;
  const V = C.V;
  const both = (buildRight, info, infoL) => {
    const m = buildRight();
    const ml = C.mirrorMesh(m, L, infoL || info);
    return [m, ml];
  };
  const G = (k) => ({ group: 'Ossos', ...k });
  /** Geometria com posição/rotação "assadas" (para fundir peças do mesmo osso numa só malha). */
  const baked = (g, pos, quat) => { const m = new THREE.Matrix4().compose(pos ? C.V(pos) : new THREE.Vector3(), quat || new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)); return g.applyMatrix4(m); };

  /* ---------------- Vértebras ----------------
     Cada vértebra = UMA malha de osso (corpo, tampas, pedículos, lâminas, processos fundidos: menos chamadas de
     desenho/sombra) + o disco abaixo. O corpo (com as tampas) é inclinado no plano sagital pela tangente da linha
     dos corpos (LM.spine.zf): a coluna deixa de ser uma pilha de blocos em degrau. Os elementos posteriores ficam
     nas posições de projeto (pontas dos processos transversos nas costelas; espinhosos alinhados com a pele/músculos). */
  const spineGroup = new THREE.Group(); spineGroup.name = 'Coluna'; L.add(spineGroup);
  const SP = LM.spine, discGeos = [];
  const lowEll = (c, r, ws = 14, hs = 10) => { const g = new THREE.SphereGeometry(1, ws, hs); g.scale(r[0], r[1], r[2]); g.translate(c[0], c[1], c[2]); return g; };
  const tilt = SP.map((s, i) => { const a = SP[Math.max(0, i - 1)], b = SP[Math.min(SP.length - 1, i + 1)]; return Math.atan2(a.zf - b.zf, a.y - b.y); });
  /** Centro da placa terminal (superior/inferior) do corpo i, já inclinado. */
  const endPlate = (i, top) => { const s = SP[i], cz = s.zf - s.d / 2 + 0.1, hh = s.h / 2, k = top ? 1 : -1; return new THREE.Vector3(0, s.y + k * hh * Math.cos(tilt[i]), cz + k * hh * Math.sin(tilt[i])); };
  SP.forEach((s, i) => {
    const cz = s.zf - s.d / 2, hw = s.w / 2, hd = s.d / 2, hh = s.h / 2;
    const thoracic = s.n[0] === 'T';
    const parts = [];
    // corpo: secção em "rim" (posterior achatada), cintura côncava
    const body = C.gridGeometry((u, v) => {
      const a = u * Math.PI * 2;
      let x = Math.cos(a) * hw, z = Math.sin(a) * hd;
      if (z < 0) z *= thoracic ? 0.62 : 0.55; // face posterior plana (canal)
      const waist = 1 - 0.09 * Math.sin(v * Math.PI);
      const rim = v < 0.06 ? C.smooth(0, 0.06, v) : v > 0.94 ? C.smooth(1, 0.94, v) : 1;
      const k = waist * (0.86 + 0.14 * rim);
      return [x * k, s.y - hh + v * s.h, cz + (z * k) + 0.1];
    }, 32, 10, { flip: true });
    // tampas
    const capGeo = (y, flip) => { const g = new THREE.CircleGeometry(1, 32); g.rotateX(flip ? Math.PI / 2 : -Math.PI / 2); g.scale(hw * 0.86, 1, hd * 0.86); g.translate(0, y, cz + 0.1); return g; };
    const tiltG = (g) => { g.translate(0, -s.y, -(cz + 0.1)); g.rotateX(tilt[i]); g.translate(0, s.y, cz + 0.1); return g; };
    parts.push(tiltG(body), tiltG(capGeo(s.y + hh, false)), tiltG(capGeo(s.y - hh, true)));
    // disco abaixo: entre as placas terminais inclinadas, 0,03 cm aquém de cada uma (sem faces coplanares → sem z-fighting)
    const nx = SP[i + 1];
    if (nx) {
      const A = endPlate(i + 1, true), B = endPlate(i, false), d = B.clone().sub(A), Ld = d.length() - 0.06;
      if (Ld > 0.04) {
        const dg = new THREE.CylinderGeometry(1, 1, Ld, 28); dg.scale((hw + nx.w / 2) / 2 * 0.9, 1, (hd + nx.d / 2) / 2 * 0.85);
        dg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
        const mid = A.clone().add(B).multiplyScalar(0.5); dg.translate(mid.x, mid.y, mid.z - 0.05);
        discGeos.push(dg);
      }
    }
    // elementos posteriores
    const back = cz - hd * (thoracic ? 0.62 : 0.55) + 0.1;
    const pedR = [hw * 0.62, s.y + 0.1, back + 0.1], pedEnd = [hw * 0.72, s.y + 0.12, back - (thoracic ? 1.0 : 0.8)];
    const lamMid = [0, s.y - 0.05, back - (thoracic ? 1.75 : 1.45)];
    // processo espinhoso: cervicais curtos e bífidos; C7 (vértebra proeminente) longo, quase horizontal, com ponta romba
    const spLen = { C4: 3.0, C5: 3.2, C6: 3.6 };
    const sp = s.n === 'C7' ? [0, s.y - 1.05, back - 5.6] : thoracic ? [0, s.y - (['T5', 'T6', 'T7', 'T8'].includes(s.n) ? 2.4 : 1.6), LM.spinousTipZ(s.y) + 0.6] : [0, s.y - 0.45, back - (spLen[s.n] || 2.6)];
    for (const sg of [1, -1]) {
      const p0 = [pedR[0] * sg, pedR[1], pedR[2]], p1 = [pedEnd[0] * sg, pedEnd[1], pedEnd[2]];
      parts.push(C.sweepGeometry([p0, p1], { r: thoracic ? 0.36 : 0.3, radial: 10, segments: 5, capRings: 3 }));
      parts.push(C.sweepGeometry([p1, [hw * 0.4 * sg, s.y, (p1[2] + lamMid[2]) / 2 - 0.15], lamMid], { rx: thoracic ? 0.55 : 0.45, ry: 0.22, up: [0, 1, 0], radial: 10, segments: 8, capRings: 3 }));
      // processo transverso
      if (thoracic) {
        const ri = LM.ribs[parseInt(s.n.slice(1), 10) - 1];
        let tip = ri ? [ri.pts[1][0] + 0.25, ri.pts[1][1] + 0.15, ri.pts[1][2] - 0.5] : [3.4, s.y, back - 1.6];
        tip = [tip[0] * sg, tip[1], tip[2]];
        parts.push(C.sweepGeometry([p1, [(hw * 0.9 + 0.4) * sg, s.y + 0.1, p1[2] - 0.45], tip], { r: [0.38, 0.34, 0.42], radial: 10, segments: 9, capRings: 3 }));
      } else {
        // cervical: barras anterior e posterior (forame transversário entre elas — artéria vertebral) com os
        // TUBÉRCULOS anterior e posterior nas pontas (origens dos escalenos anterior e médio). As barras seguem as
        // mesmas fórmulas usadas pelo nerves.js para a goteira do nervo espinal.
        const at = [(hw + 0.55) * sg, s.y - 0.05, cz + hd * 0.2], pt = [(hw + 0.85) * sg, s.y - 0.1, cz - hd - 0.45];
        parts.push(C.sweepGeometry([[hw * 0.8 * sg, s.y, cz], at], { r: [0.3, 0.26], radial: 10, segments: 6, capRings: 3 }));
        parts.push(C.sweepGeometry([p1, pt, at], { r: [0.28, 0.3, 0.26], radial: 10, segments: 10, capRings: 3 }));
        const big = s.n === 'C6' ? 1.2 : 1; // C6: tubérculo carotídeo (de Chassaignac), mais saliente
        const A = [(hw + 0.85) * sg, s.y - 0.12, cz + hd * 0.12], P = [(hw + 1.05) * sg, s.y - 0.14, cz - hd - 0.35];
        // (anterior: lateral ao tronco simpático/gânglio estrelado; em C7 é rudimentar → não desenhado)
        if (s.n !== 'C7') parts.push(C.sweepGeometry([at, A], { r: [0.24, 0.26 * big], radial: 10, segments: 4, capRings: 3 }), lowEll(A, [0.3 * big, 0.27 * big, 0.3 * big]));
        parts.push(C.sweepGeometry([pt, P], { r: [0.26, 0.28], radial: 10, segments: 4, capRings: 3 }), lowEll(P, [0.32, 0.29, 0.3]));
      }
      // processos articulares (facetas) — pequenas massas
      parts.push(lowEll([hw * 0.62 * sg, s.y + hh * 0.75, p1[2] - 0.2], [0.32, 0.38, 0.32]));
    }
    // processo espinhoso
    const bifid = ['C4', 'C5', 'C6'].includes(s.n);
    if (bifid) {
      for (const sg of [1, -1]) parts.push(C.sweepGeometry([lamMid, [0.25 * sg, sp[1] + 0.1, (lamMid[2] + sp[2]) / 2], [0.38 * sg, sp[1], sp[2]]], { rx: 0.32, ry: 0.18, up: [0, 1, 0], radial: 10, segments: 10, capRings: 3 }));
    } else if (s.n === 'C7') {
      parts.push(C.sweepGeometry([lamMid, [0, (lamMid[1] + sp[1]) / 2 + 0.1, (lamMid[2] + sp[2]) / 2], sp], { rx: [0.55, 0.45, 0.5], ry: [0.28, 0.24, 0.32], up: [0, 1, 0], radial: 12, segments: 16 }));
      parts.push(lowEll([0, sp[1] - 0.05, sp[2] + 0.15], [0.55, 0.42, 0.45])); // ponta romba palpável
    } else {
      parts.push(C.sweepGeometry([lamMid, [0, (lamMid[1] + sp[1]) / 2 + 0.15, (lamMid[2] + sp[2]) / 2], sp], { rx: [0.55, 0.42, 0.42], ry: [0.25, 0.2, 0.28], up: [0, 1, 0], radial: 12, segments: 14 }));
    }
    const grp = new THREE.Group(); grp.name = s.n; spineGroup.add(grp);
    C.mesh(C.mergeGeometries(parts), M.bone, grp, G({ id: 'vertebra-' + s.n, name: 'Vértebra ' + s.n + (s.n === 'C7' ? ' (vértebra proeminente)' : '') }));
    parts.forEach((g) => g.dispose());
  });
  C.mesh(C.mergeGeometries(discGeos), M.disc, spineGroup, G({ id: 'disc', name: 'Disco intervertebral' }));

  /* ---------------- Costelas e cartilagens ---------------- */
  const ribGroup = new THREE.Group(); ribGroup.name = 'Costelas'; L.add(ribGroup);
  const chestCenterZ = (y) => -6.2;
  LM.ribs.forEach((R) => {
    const ord = R.i === 1 ? '1ª' : R.i + 'ª';
    const infoR = G({ id: 'rib-' + R.i + '-R', name: ord + ' costela direita' });
    const infoL = G({ id: 'rib-' + R.i + '-L', name: ord + ' costela esquerda' });
    let geo;
    if (R.flat) {
      // 1ª costela: largura horizontal (eixo N = para fora), espessura vertical (eixo B ≈ cranial).
      // Face superior com os SULCOS da veia (anterior) e da artéria subclávias (posterior), separados pela crista
      // do TUBÉRCULO DO ESCALENO na borda interna (inserção do escaleno anterior).
      const up1 = (t, p) => new THREE.Vector3(p.x - 3.9, 0, p.z + 3.9).normalize();
      const crv = C.curve(R.pts), tOf = (q) => { let bt = 0, bd = 1e9; const v = C.V(q); for (let k = 0; k <= 600; k++) { const d = crv.getPointAt(k / 600).distanceToSquared(v); if (d < bd) { bd = d; bt = k / 600; } } return bt; };
      // sinal de B (para cima?) no trecho dos sulcos
      const supSign = (t) => { const P = crv.getPointAt(t), T = crv.getTangentAt(t).normalize(), n = up1(t, P); n.addScaledVector(T, -n.dot(T)).normalize(); return new THREE.Vector3().crossVectors(T, n).y >= 0 ? 1 : -1; };
      const tV = tOf(R.grooveVein), tA = tOf(R.grooveArtery), tS = tOf(R.scaleneTubercle), sg1 = supSign(tS);
      const gs = (t, c, w) => Math.exp(-(((t - c) / w) ** 2));
      geo = C.sweepGeometry(R.pts, {
        up: up1,
        rx: [[0, 0.5], [0.12, 0.42], [0.3, 0.62], [0.55, R.t / 2], [0.85, R.t / 2 * 0.95], [1, 0.62]],
        ry: [[0, 0.42], [0.12, 0.3], [0.3, R.h / 2], [1, R.h / 2 * 1.15]],
        radial: 26, density: 8, exp: 2.3,
        disp: (t, a) => {
          const sup = Math.max(0, sg1 * Math.sin(a)), ca = Math.cos(a);
          const groove = (0.1 * gs(t, tV, 0.036) + 0.085 * gs(t, tA, 0.03)) * Math.pow(sup, 1.5);
          // crista do tubérculo: borda interna (−N), voltada para cima
          let da = Math.atan2(sg1 * Math.sin(a), ca) - 2.47; // 2,47 rad ≈ borda interna, 38° acima do plano da costela
          da -= Math.round(da / (2 * Math.PI)) * 2 * Math.PI;
          const wT = gs(t, tS, 0.022) * Math.exp(-((da / 0.6) ** 2));
          return [-0.05 * wT, sg1 * (0.13 * wT - groove)];
        },
      });
    } else {
      const ctx_ = R.i >= 4; // costelas 4–12: contexto (menos polígonos)
      geo = C.sweepGeometry(R.pts, {
        up: (t, p, T) => { const o = new THREE.Vector3(p.x, 0, p.z - chestCenterZ(p.y)).normalize(); const n = new THREE.Vector3().crossVectors(T, o); if (n.y < 0) n.negate(); return n; },
        rx: [[0, 0.46], [0.06, 0.34], [0.12, 0.5], [0.25, R.h / 2], [0.9, R.h / 2], [1, R.h / 2 * 0.98]],
        ry: [[0, 0.44], [0.06, 0.3], [0.12, 0.42], [0.25, R.t / 2], [0.9, R.t / 2 * 1.05], [1, R.t / 2 * 1.25]],
        radial: ctx_ ? 14 : 18, density: ctx_ ? 3.2 : 5, exp: 2.25, capRings: ctx_ ? 3 : 5,
        capEnd: true,
      });
    }
    const m = C.mesh(geo, M.bone, ribGroup, infoR);
    C.mirrorMesh(m, ribGroup, infoL);
    if (R.cartilage) {
      const cinfoR = G({ id: 'costal-cartilage-' + R.i + '-R', name: 'Cartilagem costal ' + R.i + ' (direita)' });
      const cinfoL = G({ id: 'costal-cartilage-' + R.i + '-L', name: 'Cartilagem costal ' + R.i + ' (esquerda)' });
      const end = R.i >= 8 ? 0.22 : R.i === 1 ? 0.55 : 0.36;
      // eixo N ≈ cranial (rx = altura), B ≈ anteroposterior (ry = espessura). A 1ª cartilagem continua a lâmina
      // achatada da 1ª costela (baixa e larga), em vez de um bulbo com o dobro da altura da costela.
      const cg = C.sweepGeometry(R.cartilage, {
        up: (t, p, T) => { const o = new THREE.Vector3(p.x, 0, p.z - chestCenterZ(p.y)).normalize(); const n = new THREE.Vector3().crossVectors(T, o); if (n.y < 0) n.negate(); return n; },
        rx: R.i === 1 ? [0.27, 0.33] : [R.h / 2 * 0.95, Math.max(end, 0.3)], ry: R.i === 1 ? [0.6, 0.52] : [R.t / 2 * 1.2, end * 0.75],
        radial: R.i >= 4 ? 12 : 18, density: R.i >= 4 ? 5 : 8, exp: R.i === 1 ? 2.3 : 2,
      });
      const cm = C.mesh(cg, M.cartilage, ribGroup, cinfoR);
      C.mirrorMesh(cm, ribGroup, cinfoL);
    }
  });

  /* ---------------- Esterno ----------------
     Peças tesseladas e de bordas arredondadas (antes: extrusões poligonais com faces planas trianguladas só pelas
     bordas — aspecto de "papelão"). Envelope MANTIDO para a acomodação das veias em vessels.js (manubriumAt):
     contorno em planta MAN_OUT/MAN_TOP, espessura 1,25 cm centrada em LM.sternum.zMid(y) − 0,035·x². */
  const sternumGroup = new THREE.Group(); sternumGroup.name = 'Esterno'; L.add(sternumGroup);
  const S = LM.sternum;
  const zEnv = (x, y) => S.zMid(y) - 0.035 * x * x; // superfície média do envelope
  // Manúbrio: grade polar (centro → borda) × perfil (face anterior → borda arredondada → face posterior)
  {
    // contorno do lado D (de cima para baixo). Incisura clavicular retificada como faceta levemente CÔNCAVA
    // (antes convexa, +0,12 cm além da corda): deixa espaço para o disco articular esternoclavicular.
    const R_ = [[0, -0.02], [0.55, 0.06], [1.05, 0.3], [1.45, 0.52], [1.75, 0.5], [2.044, 0.123], [2.368, -0.227], [2.72, -0.55], [2.82, -1.05], [2.98, -1.35], [3.0, -1.9], [2.85, -2.2], [2.45, -3.0], [2.05, -3.85], [1.85, -4.35], [1.82, -4.55], [1.1, -4.56]];
    const loop = R_.concat([[0, -4.56]], R_.slice(1).reverse().map((p) => [-p[0], p[1]]));
    loop.pop(); // [0,-0.02] é o primeiro ponto (laço fechado)
    const crv = new THREE.CatmullRomCurve3(loop.map((p) => new THREE.Vector3(p[0], p[1], 0)), true, 'centripetal', 0.5);
    const c0 = new THREE.Vector2(0, -2.1), h = 0.625;
    const facetF = new THREE.Vector2(2.235, -0.025);
    const rhoAt = (P) => { // raio horizontal do arredondamento da borda: menor nas superfícies articulares/sincondrose
      const df = Math.min(P.distanceTo(facetF), P.distanceTo(new THREE.Vector2(-facetF.x, facetF.y)));
      return 0.38 - 0.24 * C.smooth(0.95, 0.6, df) - 0.2 * C.smooth(-4.1, -4.45, P.y);
    };
    const NU = 120, NV = 32, A_ = 0.3;
    const bnd = []; for (let k = 0; k <= NU; k++) { const q = crv.getPointAt((k % NU) / NU); bnd.push(new THREE.Vector2(q.x, q.y)); }
    const geo = C.gridGeometry((u, v) => {
      const B = bnd[Math.round(u * NU)], D = B.distanceTo(c0), rho = Math.min(rhoAt(B), D * 0.4);
      let d, z;
      if (v <= A_) { d = (v / A_) * (D - rho); z = h; }
      else if (v >= 1 - A_) { d = ((1 - v) / A_) * (D - rho); z = -h; }
      else { const ph = Math.PI / 2 - (Math.PI * (v - A_)) / (1 - 2 * A_); d = D - rho + rho * Math.cos(ph); z = h * Math.sin(ph); }
      const X = c0.x + (B.x - c0.x) * (d / D), Y = c0.y + (B.y - c0.y) * (d / D);
      return [X, Y, zEnv(X, Y) + z];
    }, NU, NV, { flip: false });
    // UV planar (≈4 cm por repetição): textura de poros sem pinçamento no polo da grade
    const pa = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pa.count; i++) uv.setXY(i, pa.getX(i) / 4 + 0.5, pa.getY(i) / 4);
    C.mesh(geo, M.bone, sternumGroup, G({ id: 'manubrium', name: 'Manúbrio do esterno' }));
  }
  // Disco manubrioesternal (sincondrose): preenche a fenda entre o manúbrio e o corpo
  {
    const y0 = S.angleY - 0.05, zm = S.zMid(y0);
    const g = C.sweepGeometry([[-1.62, y0, zm - 0.09], [0, y0, zm], [1.62, y0, zm - 0.09]], { up: [0, 1, 0], rx: 0.1, ry: [0.42, 0.5, 0.42], exp: 3, radial: 16, segments: 24 });
    C.mesh(g, M.disc, sternumGroup, G({ id: 'sternal-angle', name: 'Ângulo esternal (articulação manubrioesternal)' }));
  }
  // Corpo do esterno: varredura vertical de secção "retângulo arredondado" (superelipse) com as incisuras costais 2–7
  {
    const yTop = S.angleY - 0.15, yBot = S.xiphisternalY;
    const halfW = (y) => {
      let w = S.halfWidth(y);
      for (const yc of LM.sternocostalY.slice(1)) w -= 0.12 * Math.exp(-(((y - yc) / 0.38) ** 2));
      if (y < yBot + 0.6) w *= C.lerp(1, 0.72, C.smooth(yBot + 0.6, yBot, y));
      return w;
    };
    const path = []; for (let k = 0; k <= 40; k++) { const y = yTop + (yBot - yTop) * (k / 40); path.push(new THREE.Vector3(0, y, S.zMid(y))); }
    const crv = new THREE.CatmullRomCurve3(path, false, 'centripetal', 0.5);
    const g = C.sweepGeometry(crv, { up: [1, 0, 0], rx: (t) => halfW(crv.getPointAt(t).y), ry: 0.5, exp: 5, radial: 40, segments: 110, caps: 'flat' });
    C.deform(g, (v) => {
      v.z -= 0.035 * v.x * v.x; // curvatura transversal (mesma do envelope)
      // cristas transversais discretas na face anterior (fusão das esternébras)
      if (v.z > S.zMid(v.y) - 0.035 * v.x * v.x) for (const yc of [-7.0, -9.25, -11.35]) v.z += 0.05 * Math.exp(-(((v.y - yc) / 0.2) ** 2));
    });
    C.mesh(g, M.bone, sternumGroup, G({ id: 'sternum-body', name: 'Corpo do esterno' }));
  }
  // Processo xifoide (parcialmente cartilaginoso): lâmina fina que afila até a ponta
  {
    const y0 = S.xiphisternalY - 0.12, y1 = -17.95;
    const path = []; for (let k = 0; k <= 12; k++) { const y = y0 + (y1 - y0) * (k / 12); path.push(new THREE.Vector3(0, y, S.zAnt(y) - 0.25)); }
    const crv = new THREE.CatmullRomCurve3(path, false, 'centripetal', 0.5);
    const w = C.profile([[0, 1.05], [0.35, 0.95], [0.62, 0.8], [0.85, 0.5], [1, 0.3]]);
    const g = C.sweepGeometry(crv, { up: [1, 0, 0], rx: w, ry: [[0, 0.22], [1, 0.16]], exp: 3, radial: 24, segments: 30, caps: 'round', capStart: false });
    C.mesh(g, M.boneDark, sternumGroup, G({ id: 'xiphoid', name: 'Processo xifoide' }));
  }

  /* ---------------- Clavículas ----------------
     Articulação esternoclavicular: a extremidade esternal (varredura + bulbo) é aplanada contra um plano paralelo
     à faceta clavicular do manúbrio (normal n, voltada para cima e para fora) a 0,22 cm dela; o disco articular é
     uma LENTE oblíqua nesse espaço (antes: elipsoide vertical enterrado no osso e clavícula ~0,5 cm dentro do manúbrio). */
  {
    const K = LM.clavicle;
    const nF = new THREE.Vector3(0.732, 0.681, 0), F = new THREE.Vector3(2.235, -0.025, 0), GAP = 0.22;
    const flatten = (g) => C.deform(g, (v) => {
      if (v.x > 4.2 || v.y > 2.4) return;
      const sd = nF.x * (v.x - F.x) + nF.y * (v.y - F.y);
      if (sd < GAP) { v.x += nF.x * (GAP - sd); v.y += nF.y * (GAP - sd); }
    });
    const geo = flatten(C.sweepGeometry(K.pts, {
      up: [0, 1, 0], rx: K.ry, ry: K.rh, radial: 30, density: 9, exp: 2.15, caps: 'round', capStartType: 'flat', // esternal plana (faceta), acromial arredondada
      radial_fn: (t, a) => { // sulco do subclávio (face inferior, terço médio)
        const inf = Math.max(0, -Math.cos(a)); return 1 - 0.13 * inf * inf * C.smooth(0.22, 0.38, t) * C.smooth(0.72, 0.56, t);
      },
    }));
    const info = G({ id: 'clavicle-R', name: 'Clavícula direita' });
    const cnG = baked(C.ellipsoidGeometry([0.45, 0.3, 0.4], 24, 16), K.conoidTubercle); // tubérculo conoide
    // extremidade esternal alargada (cabeça), aplanada na face articular
    const seG = C.ellipsoidGeometry([0.62, 1.0, 0.92], 40, 28); seG.translate(2.75, 0.62, -0.4);
    const m = C.mesh(C.mergeGeometries([geo, cnG, flatten(seG)]), M.bone, L, info);
    C.mirrorMesh(m, L, G({ id: 'clavicle-L', name: 'Clavícula esquerda' }));
    // disco articular: lente oblíqua (0,11 ao longo de n · 0,72 ao longo da faceta · 0,62 anteroposterior)
    const dG = C.ellipsoidGeometry([0.11, 0.72, 0.62], 32, 20);
    dG.rotateZ(Math.atan2(nF.y, nF.x));
    dG.translate(F.x + nF.x * GAP / 2, F.y + nF.y * GAP / 2, -0.63);
    const d = C.mesh(dG, M.cartilage, L, G({ id: 'sc-joint-R', name: 'Articulação esternoclavicular direita (disco articular)' }));
    C.mirrorMesh(d, L, G({ id: 'sc-joint-L', name: 'Articulação esternoclavicular esquerda (disco articular)' }));
  }

  /* ---------------- Escápulas ---------------- */
  {
    const Sc = LM.scapula;
    const grp = new THREE.Group(); grp.name = 'Escápula direita'; L.add(grp);
    const info = G({ id: 'scapula-R', name: 'Escápula direita' });
    // superfície média compartilhada com muscles.js (LM.scapulaGeom): Coons das bordas + afastamento do gradil costal
    const SG = LM.scapulaGeom();
    const f = (u, v) => SG.mid(Math.min(1, Math.max(0, u)), Math.min(1, Math.max(0, v)));
    const th = SG.th;
    const geo = C.slabGeometry(f, th, 36, 36, (p) => new THREE.Vector3(p.x * 0.3, 0, p.z + 6).negate().multiplyScalar(-1));
    const scapParts = [geo];
    // espinha da escápula
    scapParts.push(C.sweepGeometry(SG.spinePts, { rx: [0.42, 0.75, 0.85, 0.7, 0.55], ry: [0.25, 0.32, 0.36, 0.4, 0.45], up: (t, p, T) => new THREE.Vector3(0, 0.6, -0.8), radial: 16, density: 6 }));
    // acrômio
    C.tube([Sc.acromion.base, Sc.acromion.mid, Sc.acromion.tip], { rx: [0.42, 0.36, 0.3], ry: [0.85, 1.25, 0.95], up: [0, 1, 0], radial: 20, density: 7, exp: 2.4 }, M.bone, grp, G({ id: 'acromion-R', name: 'Acrômio (direito)' }));
    // processo coracoide (ponta palpável no sulco deltopeitoral)
    C.tube([Sc.coracoid.base, [13.5, -0.35, -4.0], Sc.coracoid.knee, [13.25, -0.3, -1.5], Sc.coracoid.tip], { rx: [0.72, 0.6, 0.5, 0.45, 0.42], ry: [0.55, 0.5, 0.42, 0.36, 0.34], radial: 18, density: 8 }, M.bone, grp, G({ id: 'coracoid-R', name: 'Processo coracoide (direito)' }));
    // colo + cavidade glenoidal
    const gc = V(Sc.glenoidCenter), gn = V(Sc.glenoidNormal).normalize();
    scapParts.push(C.sweepGeometry([Sc.neck, gc.clone().addScaledVector(gn, -0.35).toArray()], { rx: [1.0, 1.25], ry: [0.7, 0.85], up: [0, 1, 0], radial: 20, segments: 8 }));
    const qG = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), gn);
    scapParts.push(baked(C.ellipsoidGeometry([0.42, 1.95, 1.25], 32, 20), gc.clone().addScaledVector(gn, -0.2), qG));
    C.mesh(C.mergeGeometries(scapParts), M.bone, grp, info);
    const glc = C.mesh(C.ellipsoidGeometry([0.18, 1.75, 1.08]), M.cartilage, grp, G({ id: 'glenoid-R', name: 'Cavidade glenoidal (direita)' }));
    glc.position.copy(gc.clone().addScaledVector(gn, 0.08)); glc.quaternion.copy(qG);
    // espelho
    const gl = new THREE.Group(); gl.name = 'Escápula esquerda'; L.add(gl);
    grp.children.slice().forEach((m) => {
      const inf = m.userData.info ? Object.assign({}, m.userData.info, { id: m.userData.info.id.replace(/-R$/, '-L'), name: m.userData.info.name.replace('direita', 'esquerda').replace('(direito)', '(esquerdo)').replace('(direita)', '(esquerda)') }) : null;
      const mm = C.mesh(C.mirrorGeometry(m.geometry), m.material, gl, inf);
      mm.position.set(-m.position.x, m.position.y, m.position.z);
      if (!m.quaternion.equals(new THREE.Quaternion())) { const e = new THREE.Euler().setFromQuaternion(m.quaternion); mm.rotation.set(e.x, -e.y, -e.z); }
    });
  }

  /* ---------------- Úmeros proximais ---------------- */
  {
    const Hm = LM.humerus;
    const grp = new THREE.Group(); grp.name = 'Úmero direito'; L.add(grp);
    const info = G({ id: 'humerus-R', name: 'Úmero direito (proximal)' });
    const hc = V(Hm.headCenter);
    C.mesh(C.mergeGeometries([
      baked(C.ellipsoidGeometry([Hm.headR, Hm.headR * 1.02, Hm.headR]), Hm.headCenter),
      baked(C.ellipsoidGeometry([1.15, 1.5, 1.35], 32, 20), Hm.greaterTubercle),
      baked(C.ellipsoidGeometry([0.75, 1.0, 0.75], 24, 16), Hm.lesserTubercle),
      C.sweepGeometry([[17.0, -2.6, -3.7], Hm.surgicalNeck, [17.6, -9.0, -3.7], Hm.shaftEnd], { r: [1.75, 1.3, 1.12, 1.05], radial: 24, density: 4, caps: 'flat' }),
    ]), M.bone, grp, info);
    // cartilagem articular voltada à glenoide
    const toG = V(LM.scapula.glenoidCenter).sub(hc).normalize();
    const cap = C.mesh(new THREE.SphereGeometry(Hm.headR + 0.06, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.42), M.cartilage, grp, G({ id: 'humerus-R', name: 'Cabeça do úmero (cartilagem articular)' }));
    cap.position.copy(hc); cap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), toG);
    const gl = new THREE.Group(); gl.name = 'Úmero esquerdo'; L.add(gl);
    grp.children.slice().forEach((m) => {
      const mm = C.mesh(C.mirrorGeometry(m.geometry), m.material, gl, G({ id: 'humerus-L', name: 'Úmero esquerdo (proximal)' }));
      mm.position.set(-m.position.x, m.position.y, m.position.z);
      const e = new THREE.Euler().setFromQuaternion(m.quaternion); mm.rotation.set(e.x, -e.y, -e.z);
    });
  }

  return {
    anchors: {
      notch: [0, 0.1, 0.1],
      sternalAngle: [0, LM.sternum.angleY, LM.sternum.zAnt(LM.sternum.angleY)],
      clavicleR: [7.3, 1.45, 1.4],
      clavicleMidR: LM.clavicle.junctionMedialMiddle,
      firstRibR: [5.45, -0.35, -1.25],
      scaleneTubercleR: LM.ribs[0].scaleneTubercle,
      coracoidR: LM.scapula.coracoid.tip,
      acromionR: LM.scapula.acromion.tip,
      humeralHeadR: LM.humerus.headCenter,
      scJointR: [2.35, 0.1, -0.1], // no disco articular, junto à face anterior
    },
  };
});
