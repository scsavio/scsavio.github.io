/* ==========================================================================
   engine.js — visor 3D: renderer, luzes/IBL, câmera orbital com transições,
   camadas, construção dos módulos, seleção (picking), destaque, corte, âncoras.
   Coordenadas "anatômicas" (LM) → mundo: world.scale.x = −1 (vista frontal mostra
   a DIREITA do paciente à ESQUERDA da tela, como em exame/atlas).
   ========================================================================== */
(function () {
  'use strict';
  const ATLAS = window.ATLAS;
  ATLAS.LAYERS = ['skin', 'bones', 'muscle', 'vein', 'artery', 'nerve', 'lymph', 'lung', 'pleura', 'mediastinum', 'hand', 'instrument', 'drape', 'aids'];

  ATLAS.createEngine = async function (container, opts = {}) {
    const THREE = window.THREE;
    const LM = window.LM;
    const C = ATLAS.makeCore(THREE, opts.quality || 1);
    C.initMaterials();
    const E = { THREE, C, LM, opts, errors: [], results: {}, anchors: {}, state: { breath: 0, handPose: 1, time: 0, phase: 0, fixStep: 0 } };

    /* ---- renderer ---- */
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: !!opts.preserve, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.maxDPR || 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = opts.exposure || 0.95;
    renderer.shadowMap.enabled = opts.shadows !== false;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.localClippingEnabled = true;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    container.insertBefore(renderer.domElement, container.firstChild);
    E.renderer = renderer;

    const scene = new THREE.Scene();
    E.scene = scene;
    try { scene.environment = C.makeEnvironment(renderer); } catch (e) { E.errors.push('env: ' + e.message); }
    scene.environmentIntensity = 0.75; // r160+: ignorado se não suportado

    /* ---- luzes ---- */
    const hemi = new THREE.HemisphereLight(0xfffaf0, 0x51605b, 0.45); scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff4e6, 2.3); key.position.set(28, 46, 52);
    key.castShadow = renderer.shadowMap.enabled;
    key.shadow.mapSize.set(opts.shadowSize || 2048, opts.shadowSize || 2048);
    Object.assign(key.shadow.camera, { left: -34, right: 34, top: 34, bottom: -40, near: 5, far: 160 });
    key.shadow.bias = -0.00025; key.shadow.normalBias = 0.04; key.shadow.radius = 4;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xe4eeff, 0.75); fill.position.set(-40, 12, 26); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 1.25); rim.position.set(-8, 26, -55); scene.add(rim);
    E.lights = { hemi, key, fill, rim };

    /* ---- mundo e camadas ---- */
    const world = new THREE.Group(); world.name = 'world'; world.scale.x = -1; scene.add(world);
    E.world = world;
    const layers = {};
    ATLAS.LAYERS.forEach((n) => { const g = new THREE.Group(); g.name = 'layer:' + n; world.add(g); layers[n] = g; });
    E.layers = layers;
    const ctx = { THREE, C, LM, layers, world, scene, renderer, engine: E, ATLAS };
    E.ctx = ctx;

    /* ---- módulos ---- */
    const only = opts.modules ? new Set(opts.modules) : null;
    const names = ATLAS.order.filter((n) => !only || only.has(n));
    for (const [i, name] of names.entries()) {
      if (opts.onProgress) { try { opts.onProgress(name, i, names.length); } catch (e) { /* noop */ } await new Promise((r) => setTimeout(r, 0)); }
      const t0 = performance.now();
      try {
        const res = (await ATLAS.modules[name](ctx)) || {};
        E.results[name] = res;
        if (res.anchors) for (const [k, v] of Object.entries(res.anchors)) E.anchors[k] = v;
      } catch (e) {
        console.error('[atlas] módulo ' + name, e);
        E.errors.push(name + ': ' + (e && e.message));
      }
      E.results[name] && (E.results[name].__ms = Math.round(performance.now() - t0));
    }

    /* ---- câmera ---- */
    const camera = new THREE.PerspectiveCamera(opts.fov || 30, 1, 0.5, 600);
    E.camera = camera;
    const orbit = { target: new THREE.Vector3(0, -6, -3), radius: 74, az: 0, el: 0.06 };
    E.orbit = orbit;
    const toWorld = (p) => new THREE.Vector3(-p[0], p[1], p[2]); // anatômico → mundo
    E.toWorld = toWorld;
    E.toWorldV = (v) => new THREE.Vector3(-v.x, v.y, v.z);
    function applyCam() {
      const { target, radius, az, el } = orbit;
      camera.position.set(target.x + radius * Math.sin(az) * Math.cos(el), target.y + radius * Math.sin(el), target.z + radius * Math.cos(az) * Math.cos(el));
      camera.lookAt(target);
    }
    E.applyCam = applyCam;
    let tween = null;
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    /** Define vista: nome (LM.views) ou {target:[anat], radius, az, el}; ms>0 anima. */
    E.setView = function (v, ms = 0) {
      const s = typeof v === 'string' ? (LM.views[v] || LM.views.front) : v;
      const to = { target: toWorld(s.target), radius: s.radius, az: s.az, el: s.el };
      if (!ms || matchMedia('(prefers-reduced-motion: reduce)').matches) { orbit.target.copy(to.target); orbit.radius = to.radius; orbit.az = to.az; orbit.el = to.el; tween = null; applyCam(); return; }
      // menor caminho angular
      let daz = to.az - orbit.az; while (daz > Math.PI) daz -= 2 * Math.PI; while (daz < -Math.PI) daz += 2 * Math.PI;
      tween = { t0: performance.now(), ms, from: { target: orbit.target.clone(), radius: orbit.radius, az: orbit.az, el: orbit.el }, to: { ...to, az: orbit.az + daz } };
    };
    E.getView = () => ({ target: [-orbit.target.x, orbit.target.y, orbit.target.z], radius: +orbit.radius.toFixed(2), az: +orbit.az.toFixed(3), el: +orbit.el.toFixed(3) });
    function stepTween(now) {
      if (!tween) return;
      const k = Math.min(1, (now - tween.t0) / tween.ms), e = ease(k);
      orbit.target.lerpVectors(tween.from.target, tween.to.target, e);
      orbit.radius = THREE.MathUtils.lerp(tween.from.radius, tween.to.radius, e);
      orbit.az = THREE.MathUtils.lerp(tween.from.az, tween.to.az, e);
      orbit.el = THREE.MathUtils.lerp(tween.from.el, tween.to.el, e);
      applyCam(); if (k >= 1) tween = null;
    }

    /* ---- interação: girar, deslocar, zoom (mouse + toque) ---- */
    const dom = renderer.domElement;
    const pointers = new Map(); let lastPinch = 0, moved = 0;
    E.limits = { rMin: 8, rMax: 140 };
    dom.addEventListener('pointerdown', (e) => { dom.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button, shift: e.shiftKey }); moved = 0; tween = null; });
    dom.addEventListener('pointermove', (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) { E._hover && E._hover(e); return; }
      const dx = e.clientX - p.x, dy = e.clientY - p.y; moved += Math.abs(dx) + Math.abs(dy);
      if (pointers.size === 2) {
        const pts = [...pointers.values()]; p.x = e.clientX; p.y = e.clientY;
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (lastPinch) orbit.radius = THREE.MathUtils.clamp(orbit.radius * lastPinch / d, E.limits.rMin, E.limits.rMax);
        lastPinch = d; applyCam(); return;
      }
      p.x = e.clientX; p.y = e.clientY;
      if (p.b === 2 || p.shift || e.shiftKey) {
        const s = orbit.radius * 0.0016;
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0), up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
        orbit.target.addScaledVector(right, -dx * s).addScaledVector(up, dy * s);
      } else {
        orbit.az -= dx * 0.0075; orbit.el = THREE.MathUtils.clamp(orbit.el + dy * 0.0075, -1.35, 1.45);
      }
      applyCam();
    });
    const up = (e) => { const p = pointers.get(e.pointerId); pointers.delete(e.pointerId); lastPinch = 0; if (p && moved < 6 && e.type === 'pointerup' && E._click) E._click(e); };
    dom.addEventListener('pointerup', up); dom.addEventListener('pointercancel', up);
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    dom.addEventListener('wheel', (e) => { e.preventDefault(); tween = null; orbit.radius = THREE.MathUtils.clamp(orbit.radius * Math.exp(e.deltaY * 0.0011), E.limits.rMin, E.limits.rMax); applyCam(); }, { passive: false });
    E.zoom = (f) => { orbit.radius = THREE.MathUtils.clamp(orbit.radius * f, E.limits.rMin, E.limits.rMax); applyCam(); };

    /* ---- seleção / destaque ---- */
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    const visibleDeep = (o) => { while (o) { if (!o.visible) return false; o = o.parent; } return true; };
    /** Retorna {info, point(anat), object} sob coordenadas de tela (clientX/Y) ou null. */
    E.pick = function (cx, cy, filter) {
      const r = dom.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObject(world, true);
      for (const h of hits) {
        const o = h.object;
        if (!o.isMesh || !visibleDeep(o)) continue;
        if (C.clipPlanes.length && C.clipPlanes.some((pl) => pl.distanceToPoint(h.point) < 0)) continue;
        const info = o.userData.info;
        if (!info) { if (o.material && o.material.transparent && o.material.opacity < 0.5) continue; return null; }
        if (filter && !filter(info, o)) continue;
        if (o.material && o.material.transparent && o.material.opacity < 0.3 && !(info && info.pickTransparent)) continue;
        return { info, object: o, point: [-h.point.x, h.point.y, h.point.z], distance: h.distance };
      }
      return null;
    };
    /* ---- estado de material por malha (destaque × fantasma), sem vazamento ----
       Cada malha afetada guarda {base, cast, ghost, hl, cur}; o material efetivo é
       sempre derivado de `base` (preserva onBeforeCompile/cacheKey → cor de corte). */
    const mstate = new Map();
    function cloneMat(base) {
      const m = base.clone();
      m.onBeforeCompile = base.onBeforeCompile; m.customProgramCacheKey = base.customProgramCacheKey; m.userData = base.userData;
      // Material.clone() copia os planos de corte por valor (congelaria o corte): compartilhar o array vivo
      m.clippingPlanes = base.clippingPlanes;
      return m;
    }
    function refreshMat(o) {
      const s = mstate.get(o); if (!s) return;
      if (s.cur && s.cur !== s.base) s.cur.dispose();
      if (s.ghost == null && !s.hl) { o.material = s.base; o.castShadow = s.cast; mstate.delete(o); return; }
      const m = cloneMat(s.base);
      if (s.hl) {
        // destaque vence o fantasma: a estrutura destacada fica sólida e iluminada
        if (m.emissive) { m.emissive = new THREE.Color(s.hl); m.emissiveIntensity = 0.42; }
        if (m.transparent) m.opacity = Math.min(1, (s.base.opacity || 1) * 2.2);
        o.castShadow = s.cast;
      } else {
        m.transparent = true; m.opacity = Math.min(s.base.opacity ?? 1, s.ghost); m.depthWrite = false; m.side = THREE.FrontSide;
        o.castShadow = false;
      }
      s.cur = m; o.material = m;
    }
    function mstateOf(o) {
      let s = mstate.get(o);
      if (!s) { s = { base: o.material, cast: o.castShadow, ghost: null, hl: null, cur: null }; mstate.set(o, s); }
      return s;
    }
    let hlId = null; const hlSet = new Set();
    E.highlight = function (id, color = '#f2b84b') {
      for (const o of hlSet) { const s = mstate.get(o); if (s) { s.hl = null; refreshMat(o); } }
      hlSet.clear(); hlId = null;
      if (!id) return;
      const ent = ATLAS.registry.get(id); if (!ent) return;
      hlId = id;
      for (const root of ent.objects) root.traverse((o) => {
        if (!o.isMesh || hlSet.has(o) || !o.material) return;
        const s = mstateOf(o); s.hl = color; hlSet.add(o); refreshMat(o);
      });
    };
    E.highlighted = () => hlId;
    /** Centro (anatômico) aproximado de uma estrutura registrada. */
    E.centerOf = function (id) {
      const ent = ATLAS.registry.get(id); if (!ent) return null;
      const box = new THREE.Box3(); ent.objects.forEach((o) => box.expandByObject(o));
      if (box.isEmpty()) return null;
      const c = box.getCenter(new THREE.Vector3()); const s = box.getSize(new THREE.Vector3());
      return { center: [-c.x, c.y, c.z], size: Math.max(s.x, s.y, s.z) };
    };
    E.focus = function (id, ms = 900) {
      const c = E.centerOf(id); if (!c) return;
      E.setView({ target: c.center, radius: THREE.MathUtils.clamp(c.size * 2.6, 12, 90), az: orbit.az, el: orbit.el }, ms);
    };

    /* ---- corte (plano) ---- */
    const clipPlane = new THREE.Plane();
    /** setClip({normal:[anat], point:[anat]}) ou null. Mantém o lado para onde a normal aponta. */
    E.setClip = function (spec) {
      C.clipPlanes.length = 0;
      if (!spec) return;
      const n = new THREE.Vector3(-spec.normal[0], spec.normal[1], spec.normal[2]).normalize();
      clipPlane.setFromNormalAndCoplanarPoint(n, toWorld(spec.point));
      C.clipPlanes.push(clipPlane);
    };

    /* ---- camadas ---- */
    E.setLayer = (n, v) => { if (layers[n]) layers[n].visible = !!v; };
    E.showOnly = (list) => ATLAS.LAYERS.forEach((n) => (layers[n].visible = list.includes(n)));
    /** Torna uma camada translúcida ("fantasma") para ver estruturas profundas; opacity null restaura. */
    const ghostLayers = new Map();
    E.setGhost = function (n, opacity) {
      const g = layers[n]; if (!g) return;
      if (opacity == null) ghostLayers.delete(n); else ghostLayers.set(n, opacity);
      g.traverse((o) => {
        if (!o.isMesh || !o.material) return;
        if (opacity == null) { const s = mstate.get(o); if (s && s.ghost != null) { s.ghost = null; refreshMat(o); } return; }
        const s = mstateOf(o); s.ghost = opacity; refreshMat(o);
      });
    };
    E.ghosts = () => Object.fromEntries(ghostLayers);
    E.clearGhosts = () => ATLAS.LAYERS.forEach((n) => E.setGhost(n, null));

    /* ---- projeção / oclusão para rótulos ---- */
    const tmp = new THREE.Vector3();
    E.project = function (p) {
      const r = dom.getBoundingClientRect();
      tmp.set(-p[0], p[1], p[2]).project(camera);
      return { x: (tmp.x * 0.5 + 0.5) * r.width, y: (-tmp.y * 0.5 + 0.5) * r.height, z: tmp.z, inFront: tmp.z < 1 && tmp.z > -1 };
    };
    /** true se algo opaco e visível encobre o ponto anatômico p (tolerância em cm). */
    E.occluded = function (p, tol = 0.8) {
      const w = toWorld(p), dir = w.clone().sub(camera.position); const d = dir.length(); dir.normalize();
      ray.set(camera.position, dir); ray.far = d - tol;
      const hits = ray.intersectObject(world, true);
      for (const h of hits) { const o = h.object; if (!o.isMesh || !visibleDeep(o)) continue; if (o.material && o.material.transparent && o.material.opacity < 0.6) continue; if (C.clipPlanes.length && C.clipPlanes.some((pl) => pl.distanceToPoint(h.point) < 0)) continue; ray.far = Infinity; return true; }
      ray.far = Infinity; return false;
    };

    /* ---- tamanho, laço ---- */
    E.resize = function () {
      const w = container.clientWidth || 800, h = container.clientHeight || 600;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    new ResizeObserver(E.resize).observe(container); E.resize();
    E.frameHooks = [];
    let last = performance.now(), running = true;
    E.renderOnce = function () { applyCam(); renderer.render(scene, camera); };
    function loop(now) {
      if (!running) return;
      requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000); last = now; E.state.time += dt;
      stepTween(now);
      for (const r of Object.values(E.results)) if (r && r.update) { try { r.update(E.state, dt); } catch (e) { /* noop */ } }
      renderer.render(scene, camera);
      for (const f of E.frameHooks) f(now, dt);
    }
    E.start = () => { running = true; requestAnimationFrame(loop); };
    E.stop = () => { running = false; };
    /** Captura PNG da vista atual (opcionalmente em outro tamanho). */
    E.snapshot = function (w, h) {
      const size = renderer.getSize(new THREE.Vector2()); const pr = renderer.getPixelRatio();
      if (w && h) { renderer.setPixelRatio(1); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
      renderer.render(scene, camera); const url = renderer.domElement.toDataURL('image/png');
      if (w && h) { renderer.setPixelRatio(pr); renderer.setSize(size.x, size.y, false); camera.aspect = size.x / size.y; camera.updateProjectionMatrix(); }
      return url;
    };

    E.setView(opts.view || 'front');
    return E;
  };

  /* ---- verificação de interpenetração entre sólidos registrados (dev) ---- */
  ATLAS.checkSolids = function (tol = 0.05, pairs) {
    const S = ATLAS.solids || [], out = [];
    for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
      const a = S[i], b = S[j];
      if (pairs && !pairs.some(([x, y]) => (a.id.includes(x) && b.id.includes(y)) || (a.id.includes(y) && b.id.includes(x)))) continue;
      let worst = 0, where = null;
      a.pts.forEach((p, ia) => b.pts.forEach((q, ib) => {
        const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
        const pen = a.r(ia / (a.pts.length - 1)) + b.r(ib / (b.pts.length - 1)) - d;
        if (pen > worst) { worst = pen; where = p; }
      }));
      if (worst > tol) out.push({ a: a.id, b: b.id, overlap: +worst.toFixed(2), at: where.map((v) => +v.toFixed(2)) });
    }
    return out.sort((x, y) => y.overlap - x.overlap);
  };
})();
