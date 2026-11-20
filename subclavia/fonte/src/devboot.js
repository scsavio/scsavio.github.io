/* devboot.js — harness de desenvolvimento: dev.html?mods=..&layers=..&view=..&cam=..&clip=..&debug=faces&labels=1
   extras: quality=0.6 · hl=<id> (destaque) · theme=dark · stats=1 (programas, chamadas, triângulos desenhados, ms/quadro) */
(async function(){
  const q = new URLSearchParams(location.search);
  const list = (k) => q.get(k) ? q.get(k).split(',').filter(Boolean) : null;
  const status = document.getElementById('status');
  try {
    if (q.get('theme')) document.documentElement.setAttribute('data-theme', q.get('theme'));
    const t0 = performance.now();
    const E = await ATLAS.createEngine(document.getElementById('view'), { modules: list('mods'), preserve: true, maxDPR: 1, quality: +(q.get('quality') || 1), shadowSize: q.get('shadow') ? +q.get('shadow') : undefined, precompile: q.get('precompile') !== '0' });
    const buildMs = Math.round(performance.now() - t0);
    window.E = E;
    const layers = list('layers');
    if (layers) E.showOnly(layers); else { E.setLayer('drape', false); E.setLayer('aids', q.get('aids')==='1'); }
    if (q.get('hide')) list('hide').forEach(n=>E.setLayer(n,false));
    if (q.get('view')) E.setView(q.get('view'));
    if (q.get('cam')) { const c = q.get('cam').split(',').map(Number); E.setView({target:[c[0],c[1],c[2]], radius:c[3], az:c[4], el:c[5]}); }
    if (q.get('clip')) { const c = q.get('clip').split(',').map(Number); E.setClip({normal:[c[0],c[1],c[2]], point:[c[3],c[4],c[5]]}); }
    if (q.get('breath')) E.state.breath = +q.get('breath');
    if (q.get('hand')) E.state.handPose = +q.get('hand');
    if (q.get('phase')) E.state.phase = +q.get('phase');
    if (q.get('fix')) E.state.fixStep = +q.get('fix');
    if (q.get('chapter')) E.state.chapter = +q.get('chapter');
    if (q.get('wireMal')) E.state.wireMal = q.get('wireMal') === '1';
    if (q.get('rollMode')) E.state.rollMode = q.get('rollMode');
    if (q.get('showPlanes')) E.state.showPlanes = q.get('showPlanes') === '1';
    if (q.get('ghost')) q.get('ghost').split(',').forEach(g => { const [n,o] = g.split(':'); E.setGhost(n, +o); });
    if (q.get('hl')) E.highlight(q.get('hl'));
    if (q.get('debug') === 'faces') {
      const dbg = new E.THREE.MeshBasicMaterial({ side: E.THREE.DoubleSide });
      dbg.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n gl_FragColor = gl_FrontFacing ? vec4(0.55,0.8,0.55,1.0) : vec4(0.9,0.1,0.1,1.0);'); };
      E.world.traverse(o => { if (o.isMesh) o.material = dbg; });
    }
    for (const r of Object.values(E.results)) if (r && r.update) try { r.update(E.state, 0); } catch(e){}
    if (q.get('labels') === '1') {
      const box = document.getElementById('labels');
      const keys = q.get('only') ? list('only') : Object.keys(E.anchors);
      E.frameHooks.push(() => { box.innerHTML = ''; for (const k of keys) { const a = E.anchors[k]; if (!a) continue; const p = E.project(a); if (!p.inFront) continue; const d = document.createElement('div'); d.className='lb'; d.style.left = p.x+'px'; d.style.top = p.y+'px'; d.textContent = k; box.appendChild(d); } });
    }
    if (q.get('pick')) { /* info sob um ponto da tela: pick=x,y */ const [x,y] = q.get('pick').split(',').map(Number); E.renderOnce(); const r = E.pick(x, y); console.log('PICK', JSON.stringify(r && {id:r.info.id, name:r.info.name, point:r.point})); }
    const gl = E.renderer.getContext(), px = new Uint8Array(4);
    const tR = performance.now();
    if (q.get('loop') === '1') E.start(); else { E.renderOnce(); for (const f of E.frameHooks) f(performance.now(), 0); }
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); // força o término do quadro
    const firstFrameMs = Math.round(performance.now() - tR);
    const ms = Object.fromEntries(Object.entries(E.results).map(([k,v])=>[k,v.__ms]));
    let meshes = 0, tris = 0; E.world.traverse(o => { if (o.isMesh && !o.userData.__helper) { meshes++; const g=o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count)/3; } });
    const info = { errors: E.errors, ms, meshes, tris: Math.round(tris), registry: ATLAS.registry.size };
    if (q.get('stats') === '1') {
      const ri = E.renderer.info; info.stats = { buildMs, compileMs: E.compileMs, firstFrameMs, programs: (ri.programs || []).length, calls: ri.render.calls, drawnTris: ri.render.triangles };
      // quadro "quente" (sem sombras: o mapa só é refeito quando o estado muda) e quadro com sombras forçadas
      let t = performance.now(); E.renderOnce(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); info.stats.frameMs = Math.round(performance.now() - t);
      E.markShadowDirty(); t = performance.now(); E.renderOnce(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); info.stats.frameShadowMs = Math.round(performance.now() - t);
      let casters = 0; E.world.traverse(o => { if (o.isMesh && o.castShadow && !o.userData.__helper) casters++; }); info.stats.shadowCasters = casters;
    }
    if (q.get('center')) info.center = list('center').map((id) => ({ id, c: E.centerOf(id) }));
    if (q.get('solids')) info.collisions = ATLAS.checkSolids(+q.get('solids') || 0.05).slice(0, 40);
    status.textContent = JSON.stringify(info);
    window.__info = info;
    setTimeout(() => { window.__ready = true; }, 250);
  } catch (e) { status.textContent = 'FATAL ' + e.message + '\n' + e.stack; console.error(e); window.__ready = true; window.__fatal = e.message; }
})();
