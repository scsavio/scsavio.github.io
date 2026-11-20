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

  /* ---------------- Vértebras ---------------- */
  const spineGroup = new THREE.Group(); spineGroup.name = 'Coluna'; L.add(spineGroup);
  LM.spine.forEach((s, i) => {
    const cz = s.zf - s.d / 2, hw = s.w / 2, hd = s.d / 2, hh = s.h / 2;
    const thoracic = s.n[0] === 'T';
    // corpo: secção em "rim" (posterior achatada), cintura côncava
    const body = C.gridGeometry((u, v) => {
      const a = u * Math.PI * 2;
      let x = Math.cos(a) * hw, z = Math.sin(a) * hd;
      if (z < 0) z *= thoracic ? 0.62 : 0.55; // face posterior plana (canal)
      const waist = 1 - 0.09 * Math.sin(v * Math.PI);
      const rim = v < 0.06 ? C.smooth(0, 0.06, v) : v > 0.94 ? C.smooth(1, 0.94, v) : 1;
      const k = waist * (0.86 + 0.14 * rim);
      return [x * k, s.y - hh + v * s.h, cz + (z * k) + 0.1];
    }, 40, 10, { flip: true });
    // tampas
    const capGeo = (y, flip) => { const g = new THREE.CircleGeometry(1, 40); g.rotateX(flip ? Math.PI / 2 : -Math.PI / 2); g.scale(hw * 0.86, 1, hd * 0.86); g.translate(0, y, cz + 0.1); return g; };
    const grp = new THREE.Group(); grp.name = s.n; spineGroup.add(grp);
    const info = G({ id: 'vertebra-' + s.n, name: 'Vértebra ' + s.n });
    C.mesh(body, M.bone, grp, info);
    C.mesh(capGeo(s.y + hh, false), M.bone, grp, info);
    C.mesh(capGeo(s.y - hh, true), M.bone, grp, info);
    // disco abaixo
    const nx = LM.spine[i + 1];
    if (nx) {
      const gapTop = s.y - hh, gapBot = nx.y + nx.h / 2;
      if (gapTop - gapBot > 0.05) {
        const dg = new THREE.CylinderGeometry(1, 1, gapTop - gapBot, 36); dg.scale((hw + nx.w / 2) / 2 * 0.9, 1, (hd + nx.d / 2) / 2 * 0.85);
        dg.translate(0, (gapTop + gapBot) / 2, (cz + nx.zf - nx.d / 2) / 2 + 0.05);
        C.mesh(dg, M.disc, grp, G({ id: 'disc', name: 'Disco intervertebral' }));
      }
    }
    // elementos posteriores
    const back = cz - hd * (thoracic ? 0.62 : 0.55) + 0.1;
    const pedR = [hw * 0.62, s.y + 0.1, back + 0.1], pedEnd = [hw * 0.72, s.y + 0.12, back - (thoracic ? 1.0 : 0.8)];
    const lamMid = [0, s.y - 0.05, back - (thoracic ? 1.75 : 1.45)];
    const sp = s.n === 'C7' ? [0, s.y - 0.9, back - 3.6] : thoracic ? [0, s.y - (['T5', 'T6', 'T7', 'T8'].includes(s.n) ? 2.4 : 1.6), LM.spinousTipZ(s.y) + 0.6] : [0, s.y - 0.4, back - 2.6];
    const pinfo = G({ id: 'vertebra-' + s.n, name: 'Vértebra ' + s.n + ' (arco posterior)' });
    for (const sg of [1, -1]) {
      const p0 = [pedR[0] * sg, pedR[1], pedR[2]], p1 = [pedEnd[0] * sg, pedEnd[1], pedEnd[2]];
      C.tube([p0, p1], { r: thoracic ? 0.36 : 0.3, radial: 12, segments: 6 }, M.bone, grp, pinfo);
      C.tube([p1, [hw * 0.4 * sg, s.y, (p1[2] + lamMid[2]) / 2 - 0.15], lamMid], { rx: thoracic ? 0.55 : 0.45, ry: 0.22, up: [0, 1, 0], radial: 12, segments: 10 }, M.bone, grp, pinfo);
      // processo transverso
      let tip;
      if (thoracic) {
        const ri = LM.ribs[parseInt(s.n.slice(1), 10) - 1];
        tip = ri ? [ri.pts[1][0] + 0.25, ri.pts[1][1] + 0.15, ri.pts[1][2] - 0.5] : [3.4, s.y, back - 1.6];
        tip = [tip[0] * sg, tip[1], tip[2]];
        C.tube([p1, [(hw * 0.9 + 0.4) * sg, s.y + 0.1, p1[2] - 0.45], tip], { r: [0.38, 0.34, 0.42], radial: 12, segments: 10 }, M.bone, grp, pinfo);
      } else {
        // cervical: tubérculos anterior e posterior (origem dos escalenos)
        const at = [(hw + 0.55) * sg, s.y - 0.05, cz + hd * 0.2], pt = [(hw + 0.85) * sg, s.y - 0.1, cz - hd - 0.45];
        C.tube([[hw * 0.8 * sg, s.y, cz], at], { r: [0.3, 0.26], radial: 10, segments: 6 }, M.bone, grp, pinfo);
        C.tube([p1, pt, at], { r: [0.28, 0.3, 0.26], radial: 10, segments: 10 }, M.bone, grp, pinfo);
      }
      // processos articulares (facetas) — pequenas massas
      C.ellipsoid([hw * 0.62 * sg, s.y + hh * 0.75, p1[2] - 0.2], [0.32, 0.38, 0.32], M.bone, grp, pinfo);
    }
    // processo espinhoso
    const bifid = ['C4', 'C5', 'C6'].includes(s.n);
    if (bifid) {
      for (const sg of [1, -1]) C.tube([lamMid, [0.25 * sg, sp[1] + 0.1, (lamMid[2] + sp[2]) / 2], [0.38 * sg, sp[1], sp[2]]], { rx: 0.32, ry: 0.18, up: [0, 1, 0], radial: 10, segments: 10 }, M.bone, grp, pinfo);
    } else {
      C.tube([lamMid, [0, (lamMid[1] + sp[1]) / 2 + 0.15, (lamMid[2] + sp[2]) / 2], sp], { rx: [0.55, 0.42, 0.42], ry: [0.25, 0.2, 0.28], up: [0, 1, 0], radial: 12, segments: 14 }, M.bone, grp, pinfo);
    }
  });

  /* ---------------- Costelas e cartilagens ---------------- */
  const ribGroup = new THREE.Group(); ribGroup.name = 'Costelas'; L.add(ribGroup);
  const chestCenterZ = (y) => -6.2;
  LM.ribs.forEach((R) => {
    const ord = R.i === 1 ? '1ª' : R.i + 'ª';
    const infoR = G({ id: 'rib-' + R.i + '-R', name: ord + ' costela direita' });
    const infoL = G({ id: 'rib-' + R.i + '-L', name: ord + ' costela esquerda' });
    let geo;
    if (R.flat) {
      // 1ª costela: largura horizontal (eixo N = para fora), espessura vertical
      geo = C.sweepGeometry(R.pts, {
        up: (t, p, T) => { const o = new THREE.Vector3(p.x - 3.9, 0, p.z + 3.9).normalize(); return o; },
        rx: [[0, 0.5], [0.12, 0.42], [0.3, 0.62], [0.55, R.t / 2], [0.85, R.t / 2 * 0.95], [1, 0.62]],
        ry: [[0, 0.42], [0.12, 0.3], [0.3, R.h / 2], [1, R.h / 2 * 1.15]],
        radial: 28, density: 9, exp: 2.3,
      });
    } else {
      geo = C.sweepGeometry(R.pts, {
        up: (t, p, T) => { const o = new THREE.Vector3(p.x, 0, p.z - chestCenterZ(p.y)).normalize(); const n = new THREE.Vector3().crossVectors(T, o); if (n.y < 0) n.negate(); return n; },
        rx: [[0, 0.46], [0.06, 0.34], [0.12, 0.5], [0.25, R.h / 2], [0.9, R.h / 2], [1, R.h / 2 * 0.98]],
        ry: [[0, 0.44], [0.06, 0.3], [0.12, 0.42], [0.25, R.t / 2], [0.9, R.t / 2 * 1.05], [1, R.t / 2 * 1.25]],
        radial: 22, density: 6, exp: 2.25,
        capEnd: true,
      });
    }
    const m = C.mesh(geo, M.bone, ribGroup, infoR);
    C.mirrorMesh(m, ribGroup, infoL);
    if (R.cartilage) {
      const cinfoR = G({ id: 'costal-cartilage-' + R.i + '-R', name: 'Cartilagem costal ' + R.i + ' (direita)' });
      const cinfoL = G({ id: 'costal-cartilage-' + R.i + '-L', name: 'Cartilagem costal ' + R.i + ' (esquerda)' });
      const end = R.i >= 8 ? 0.22 : R.i === 1 ? 0.55 : 0.36;
      const cg = C.sweepGeometry(R.cartilage, {
        up: (t, p, T) => { const o = new THREE.Vector3(p.x, 0, p.z - chestCenterZ(p.y)).normalize(); const n = new THREE.Vector3().crossVectors(T, o); if (n.y < 0) n.negate(); return n; },
        rx: R.i === 1 ? [0.55, 0.6] : [R.h / 2 * 0.95, Math.max(end, 0.3)], ry: R.i === 1 ? [0.4, 0.42] : [R.t / 2 * 1.2, end * 0.75],
        radial: 18, density: 8,
      });
      const cm = C.mesh(cg, M.cartilage, ribGroup, cinfoR);
      C.mirrorMesh(cm, ribGroup, cinfoL);
    }
  });
  // tubérculo do escaleno (1ª costela) — pequena saliência na borda interna
  {
    const t = LM.ribs[0].scaleneTubercle;
    const m = C.ellipsoid(t, [0.36, 0.22, 0.3], M.bone, ribGroup, G({ id: 'rib-1-R', name: '1ª costela direita — tubérculo do escaleno' }));
    C.mirrorMesh(m, ribGroup, G({ id: 'rib-1-L', name: '1ª costela esquerda' }));
  }

  /* ---------------- Esterno ---------------- */
  const sternumGroup = new THREE.Group(); sternumGroup.name = 'Esterno'; L.add(sternumGroup);
  const S = LM.sternum;
  const bend = (g, depth) => C.deform(g, (v) => { const y = v.y; v.z = v.z - depth / 2 + S.zMid(y) - 0.035 * v.x * v.x; });
  const extr = (shape, depth, bevel) => {
    const g = new THREE.ExtrudeGeometry(shape, { depth: depth - bevel * 2, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 4, steps: 1, curveSegments: 18 });
    g.translate(0, 0, bevel);
    return g;
  };
  // Manúbrio: incisura jugular, incisuras claviculares, 1ª incisura costal
  {
    const sh = new THREE.Shape();
    const pts = [
      [0, -0.02], [0.55, 0.06], [1.05, 0.3], [1.45, 0.52], // incisura jugular (côncava)
      [1.75, 0.5], [2.15, 0.25], [2.5, -0.15], [2.72, -0.55], // incisura clavicular (faceta oblíqua)
      [2.82, -1.05], [2.98, -1.35], [3.0, -1.9], [2.85, -2.2], // 1ª incisura costal
      [2.45, -3.0], [2.05, -3.85], [1.85, -4.35], [1.85, -4.55], // borda lateral até o ângulo
    ];
    sh.moveTo(-pts[pts.length - 1][0], pts[pts.length - 1][1]);
    for (let i = pts.length - 1; i >= 0; i--) sh.lineTo(-pts[i][0], pts[i][1]);
    for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]);
    sh.closePath();
    const depth = 1.25;
    const g = bend(extr(sh, depth, 0.16), depth);
    C.mesh(g, M.bone, sternumGroup, G({ id: 'manubrium', name: 'Manúbrio do esterno' }));
  }
  // Disco manubrioesternal
  {
    const g = new THREE.BoxGeometry(3.5, 0.12, 0.95, 8, 1, 2); g.translate(0, S.angleY - 0.08, 0); C.deform(g, (v) => { v.z += S.zMid(S.angleY); });
    C.mesh(g, M.disc, sternumGroup, G({ id: 'sternal-angle', name: 'Ângulo esternal (articulação manubrioesternal)' }));
  }
  // Corpo do esterno com incisuras costais 2–7
  {
    const yTop = S.angleY - 0.15, yBot = S.xiphisternalY;
    const right = [];
    const N = 60;
    for (let k = 0; k <= N; k++) {
      const y = yTop + (yBot - yTop) * (k / N);
      let w = S.halfWidth(y);
      for (const yc of LM.sternocostalY.slice(1)) w -= 0.12 * Math.exp(-(((y - yc) / 0.38) ** 2));
      if (y < yBot + 0.6) w *= C.lerp(1, 0.72, C.smooth(yBot + 0.6, yBot, y));
      right.push([w, y]);
    }
    const sh = new THREE.Shape();
    sh.moveTo(-right[0][0], right[0][1]);
    right.forEach((p) => sh.lineTo(p[0], p[1]));
    for (let k = right.length - 1; k >= 0; k--) sh.lineTo(-right[k][0], right[k][1]);
    sh.closePath();
    const depth = 1.0;
    const g = bend(extr(sh, depth, 0.14), depth);
    // cristas transversais discretas (fusão das esternébras)
    C.deform(g, (v) => { for (const yc of [-7.0, -9.25, -11.35]) if (v.z > S.zMid(v.y)) v.z += 0.05 * Math.exp(-(((v.y - yc) / 0.2) ** 2)); });
    C.mesh(g, M.bone, sternumGroup, G({ id: 'sternum-body', name: 'Corpo do esterno' }));
  }
  // Processo xifoide (parcialmente cartilaginoso)
  {
    const sh = new THREE.Shape();
    sh.moveTo(-1.05, S.xiphisternalY - 0.12); sh.lineTo(1.05, S.xiphisternalY - 0.12); sh.quadraticCurveTo(0.9, -16.2, 0.32, -17.8); sh.quadraticCurveTo(0, -18.15, -0.32, -17.8); sh.quadraticCurveTo(-0.9, -16.2, -1.05, S.xiphisternalY - 0.12);
    const depth = 0.45;
    const g = bend(extr(sh, depth, 0.1), depth);
    C.mesh(g, M.boneDark, sternumGroup, G({ id: 'xiphoid', name: 'Processo xifoide' }));
  }

  /* ---------------- Clavículas ---------------- */
  {
    const K = LM.clavicle;
    const geo = C.sweepGeometry(K.pts, {
      up: [0, 1, 0], rx: K.ry, ry: K.rh, radial: 30, density: 9, exp: 2.15,
      radial_fn: (t, a) => { // sulco do subclávio (face inferior, terço médio)
        const inf = Math.max(0, -Math.cos(a)); return 1 - 0.13 * inf * inf * C.smooth(0.22, 0.38, t) * C.smooth(0.72, 0.56, t);
      },
    });
    const info = G({ id: 'clavicle-R', name: 'Clavícula direita' });
    const m = C.mesh(geo, M.bone, L, info);
    const cn = C.ellipsoid(K.conoidTubercle, [0.45, 0.3, 0.4], M.bone, L, info);
    // extremidade esternal alargada (faceta)
    const se = C.ellipsoid([2.75, 0.62, -0.4], [0.62, 1.0, 0.92], M.bone, L, info);
    C.mirrorMesh(m, L, G({ id: 'clavicle-L', name: 'Clavícula esquerda' }));
    C.mirrorMesh(cn, L, G({ id: 'clavicle-L', name: 'Clavícula esquerda' }));
    C.mirrorMesh(se, L, G({ id: 'clavicle-L', name: 'Clavícula esquerda' }));
    // disco articular esternoclavicular
    const d = C.ellipsoid([2.38, 0.2, -0.48], [0.14, 0.75, 0.7], M.cartilage, L, G({ id: 'sc-joint-R', name: 'Articulação esternoclavicular direita' }));
    C.mirrorMesh(d, L, G({ id: 'sc-joint-L', name: 'Articulação esternoclavicular esquerda' }));
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
    C.mesh(geo, M.bone, grp, info);
    // espinha da escápula
    C.tube(SG.spinePts, { rx: [0.42, 0.75, 0.85, 0.7, 0.55], ry: [0.25, 0.32, 0.36, 0.4, 0.45], up: (t, p, T) => new THREE.Vector3(0, 0.6, -0.8), radial: 16, density: 6 }, M.bone, grp, info);
    // acrômio
    C.tube([Sc.acromion.base, Sc.acromion.mid, Sc.acromion.tip], { rx: [0.42, 0.36, 0.3], ry: [0.85, 1.25, 0.95], up: [0, 1, 0], radial: 20, density: 7, exp: 2.4 }, M.bone, grp, G({ id: 'acromion-R', name: 'Acrômio (direito)' }));
    // processo coracoide (ponta palpável no sulco deltopeitoral)
    C.tube([Sc.coracoid.base, [13.5, -0.35, -4.0], Sc.coracoid.knee, [13.25, -0.3, -1.5], Sc.coracoid.tip], { rx: [0.72, 0.6, 0.5, 0.45, 0.42], ry: [0.55, 0.5, 0.42, 0.36, 0.34], radial: 18, density: 8 }, M.bone, grp, G({ id: 'coracoid-R', name: 'Processo coracoide (direito)' }));
    // colo + cavidade glenoidal
    const gc = V(Sc.glenoidCenter), gn = V(Sc.glenoidNormal).normalize();
    C.tube([Sc.neck, gc.clone().addScaledVector(gn, -0.35).toArray()], { rx: [1.0, 1.25], ry: [0.7, 0.85], up: [0, 1, 0], radial: 20, segments: 8 }, M.bone, grp, info);
    const rim = C.mesh(C.ellipsoidGeometry([0.42, 1.95, 1.25]), M.bone, grp, info);
    rim.position.copy(gc.clone().addScaledVector(gn, -0.2)); rim.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), gn);
    const glc = C.mesh(C.ellipsoidGeometry([0.18, 1.75, 1.08]), M.cartilage, grp, G({ id: 'glenoid-R', name: 'Cavidade glenoidal (direita)' }));
    glc.position.copy(gc.clone().addScaledVector(gn, 0.08)); glc.quaternion.copy(rim.quaternion);
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
    C.ellipsoid(Hm.headCenter, [Hm.headR, Hm.headR * 1.02, Hm.headR], M.bone, grp, info);
    // cartilagem articular voltada à glenoide
    const toG = V(LM.scapula.glenoidCenter).sub(hc).normalize();
    const cap = C.mesh(new THREE.SphereGeometry(Hm.headR + 0.06, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.42), M.cartilage, grp, G({ id: 'humerus-R', name: 'Cabeça do úmero (cartilagem articular)' }));
    cap.position.copy(hc); cap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), toG);
    C.ellipsoid(Hm.greaterTubercle, [1.15, 1.5, 1.35], M.bone, grp, info);
    C.ellipsoid(Hm.lesserTubercle, [0.75, 1.0, 0.75], M.bone, grp, info);
    C.tube([[17.0, -2.6, -3.7], Hm.surgicalNeck, [17.6, -9.0, -3.7], Hm.shaftEnd], { r: [1.75, 1.3, 1.12, 1.05], radial: 24, density: 4, caps: 'flat' }, M.bone, grp, info);
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
      scJointR: [2.4, 0.3, -0.1],
    },
  };
});
