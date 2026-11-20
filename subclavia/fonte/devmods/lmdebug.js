ATLAS.define('lmdebug', function (ctx) {
  const { THREE, C, LM, layers } = ctx; const M = C.mats;
  const T = (pts, r, mat, layer, id) => { C.tube(pts, { r, radial: 14, density: 4 }, mat, layers[layer], { id, name: id }); C.solid(id, pts, r); };
  const Vv = LM.vessels;
  T(Vv.axillaryV.pts, Vv.axillaryV.r, M.vein, 'vein', 'axV'); T(Vv.scv.pts, Vv.scv.r, M.vein, 'vein', 'scv'); T(Vv.ijvR.pts, Vv.ijvR.r, M.vein, 'vein', 'ijv');
  T(Vv.rbcv.pts, Vv.rbcv.r, M.vein, 'vein', 'rbcv'); T(Vv.lbcv.pts, Vv.lbcv.r, M.vein, 'vein', 'lbcv'); T(Vv.svc.pts, Vv.svc.r, M.vein, 'vein', 'svc');
  T(C.mirror(Vv.scv.pts), Vv.scv.r, M.vein, 'vein', 'scvL'); T(C.mirror(Vv.ijvR.pts), Vv.ijvR.r, M.vein, 'vein', 'ijvL');
  for (const k of ['aorta','bct','scaR','axillaryA','ccaR','ccaL','scaL']) T(Vv[k].pts, Vv[k].r, M.artery, 'artery', k);
  const sa = LM.muscles.scaleneAnt; T(sa.pts, sa.w.map((w,i)=>Math.min(w, sa.t[i])+0.05), M.muscle, 'muscle', 'scaleneAnt');
  const sm = LM.muscles.scaleneMid; T(sm.pts, sm.t, M.muscle, 'muscle', 'scaleneMid');
  T(LM.trachea.pts, LM.trachea.r, M.trachea, 'mediastinum', 'trachea'); T(LM.esophagus.pts, LM.esophagus.r, M.esophagus, 'mediastinum', 'esophagus');
  LM.nerves.plexusTrunks.forEach((t,i)=>T(t.pts, 0.2, M.nerve, 'nerve', 'trunk'+i));
  T(LM.nerves.phrenicR, 0.08, M.nerve, 'nerve', 'phrenic'); T(LM.nerves.vagusR, 0.12, M.nerve, 'nerve', 'vagus'); T(LM.nerves.recurrentR, 0.06, M.nerve, 'nerve', 'recurrent');
  T(LM.lymph.thoracicDuct, 0.15, M.lymph, 'lymph', 'thoracicDuct');
  const cu = C.ellipsoid(LM.pleura.cupulaCenter, [LM.pleura.cupulaR, LM.pleura.cupulaR, LM.pleura.cupulaR], M.pleura, layers.pleura, { id: 'cupula', name: 'cupula' });
  ATLAS.solids.push({ id: 'cupula', pts: [LM.pleura.cupulaCenter, LM.pleura.cupulaCenter], r: () => LM.pleura.cupulaR });
  // ossos-chave como sólidos
  C.solid('clavicleBone', LM.clavicle.pts, (t) => (C.profile(LM.clavicle.ry)(t) + C.profile(LM.clavicle.rh)(t)) / 2);
  C.solid('rib1Bone', LM.ribs[0].pts, 0.35);
  // agulha (linha)
  const N = LM.needle; T([N.entrySkin, N.veinTarget], 0.06, M.steel, 'instrument', 'needleLine');
  C.ellipsoid(N.entrySkin, [0.25,0.25,0.25], M.marker, layers.aids, {id:'entry',name:'entry'});
  return { anchors: { entry: N.entrySkin, target: N.veinTarget } };
});
