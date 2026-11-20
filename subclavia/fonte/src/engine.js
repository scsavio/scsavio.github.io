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
    // qualidade reduzida (celular/pouca memória): sem MSAA — a densidade de pixels (DPR ≥ 1,5) já suaviza as bordas
    const renderer = new THREE.WebGLRenderer({ antialias: (opts.quality || 1) >= 1, alpha: true, preserveDrawingBuffer: !!opts.preserve, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.maxDPR || 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = opts.exposure || 1.0;
    renderer.shadowMap.enabled = opts.shadows !== false;
    // PCFShadowMap respeita shadow.radius (o PCFSoftShadowMap o ignora → bordas duras e serrilhadas)
    renderer.shadowMap.type = THREE.PCFShadowMap;
    // sombras sob demanda: a luz-chave é fixa no mundo; girar a câmera não muda o mapa de sombras.
    // O mapa só é refeito quando o estado/camadas/fantasma/corte mudam (ver shadowKey) ou via E.markShadowDirty().
    renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
    renderer.localClippingEnabled = true;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    container.insertBefore(renderer.domElement, container.firstChild);
    E.renderer = renderer;

    const scene = new THREE.Scene();
    E.scene = scene;
    // IBL procedural: a intensidade é aplicada POR MATERIAL (envMapIntensity, após construir os módulos) —
    // scene.environmentIntensity não existe no three r160 (a IBL ficava a 1,0 e lavava cores e volumes).
    try { scene.environment = C.makeEnvironment(renderer); } catch (e) { E.errors.push('env: ' + e.message); }

    /* ---- luzes (posições em coordenadas de CENA: x de cena = −x anatômico) ----
       razão chave:preenchimento ≈ 3:1; chave vinda de cima/da DIREITA do paciente para modelar a fossa infraclavicular D */
    const hemi = new THREE.HemisphereLight(0xfff6ea, 0x3d4a47, 0.25); scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff4e6, 2.8); key.position.set(-26, 42, 50);
    key.castShadow = renderer.shadowMap.enabled;
    const shadowSize = opts.shadowSize || (C.quality < 1 ? 1024 : 2048);
    key.shadow.mapSize.set(shadowSize, shadowSize);
    Object.assign(key.shadow.camera, { left: -34, right: 34, top: 34, bottom: -40, near: 5, far: 160 });
    key.shadow.bias = -0.00025; key.shadow.normalBias = 0.04; key.shadow.radius = shadowSize < 2048 ? 2 : 2.5;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xe4eeff, 0.5); fill.position.set(38, 10, 28); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 1.6); rim.position.set(8, 30, -55); scene.add(rim);
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

    /* ---- acabamento global dos materiais ----
       IBL por material: metal reflete o ambiente inteiro; superfícies úmidas (clearcoat alto) 0,8; tecido 0,5. */
    const envDone = new WeakSet();
    /** Aplica a intensidade de IBL por material (idempotente; materiais novos — campo sob demanda, fixação,
        clones — são pegos na próxima mudança de estado). */
    E.applyEnvIntensity = function () {
      world.traverse((o) => {
        if (!o.isMesh) return;
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
          if (!m || envDone.has(m) || !m.isMeshStandardMaterial) return; envDone.add(m);
          if (m.userData && m.userData.envIntensity != null) { m.envMapIntensity = m.userData.envIntensity; return; }
          m.envMapIntensity = m.metalness > 0.5 ? 1.0 : (m.clearcoat || 0) >= 0.6 ? 0.8 : 0.5;
        });
      });
    };
    {
      E.applyEnvIntensity();
      try { C.setAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1)); } catch (e) { /* sem anisotropia */ }
      // qualidade reduzida: malhas pequenas (nervos, ramos, processos) deixam de projetar sombra
      if (C.quality < 1) world.traverse((o) => {
        if (!o.isMesh || !o.castShadow || o.isSkinnedMesh || !o.geometry) return;
        const g = o.geometry, t = (g.index ? g.index.count : g.attributes.position.count) / 3;
        if (t < 2000) o.castShadow = false;
      });
    }

    /* ---- câmera ---- */
    const camera = new THREE.PerspectiveCamera(opts.fov || 30, 1, 0.5, 600);
    E.camera = camera;
    /* Enquadramento em telas retrato: as vistas (LM.views) foram ajustadas para aspecto ≈1,45. Abaixo disso o FOV
       vertical cresce para PRESERVAR o FOV horizontal de referência (390×457 → ~49°). Aplicado dentro de
       updateProjectionMatrix: qualquer código que mude camera.aspect (snapshot, rótulos da impressão) fica coerente. */
    const FOV0 = opts.fov || 30, ASPECT_REF = 1.45;
    E.fovFor = (aspect) => (aspect > 0 && aspect < ASPECT_REF
      ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(FOV0) / 2) * ASPECT_REF / aspect)) : FOV0);
    {
      const upm = THREE.PerspectiveCamera.prototype.updateProjectionMatrix;
      camera.updateProjectionMatrix = function () { this.fov = E.fovFor(this.aspect); return upm.call(this); };
    }
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
       Cada malha afetada guarda {base, cast, order, ghost, layer, hl, cur, pre, shell}; o material efetivo é
       sempre derivado de `base` (preserva onBeforeCompile/cacheKey → cor de corte).
       • Fantasma: alfa por Fresnel (centro ≈0,2× a opacidade, silhueta até 0,9) sem sheen/clearcoat/relevo
         (as fibras viravam listras), e PRÉ-PASSAGEM DE PROFUNDIDADE por camada: só a superfície fantasma mais
         próxima é sombreada (sem "névoa" acumulada onde malhas da mesma camada se sobrepõem). As camadas
         fantasma são desenhadas depois dos demais transparentes, da mais profunda para a mais superficial.
       • Destaque: cor do tecido preservada (leve autoiluminação) + CONTORNO (casca invertida inflada ~3 px,
         recortada por estêncil fora da silhueta visível da estrutura) — legível sobre osso, nervo e veia. */
    const mstate = new Map();
    const noRay = () => {};
    const GHOST_RANK = { lung: 0, pleura: 1, mediastinum: 2, lymph: 3, nerve: 4, artery: 5, vein: 6, bones: 7, muscle: 8, skin: 9, drape: 10, aids: 11, hand: 12, instrument: 13 };
    const ghostOrder = (layer) => 20 + 2 * (GHOST_RANK[layer] ?? 6);
    const GHOST_FR = '{ float gfr = pow(1.0 - saturate(abs(dot(nonPerturbedNormal, geometryViewDir))), 2.0); diffuseColor.a = clamp(diffuseColor.a * (0.2 + 1.8 * gfr), 0.0, 0.9); }';
    const PRE = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, transparent: true, clippingPlanes: C.clipPlanes });
    PRE.name = 'ghost-depth-prepass';
    const OUTLINE_PX = 3.2, OUT_K = { value: 0.002 };
    const shellMats = new Map();
    const themeTeal = () => (document.documentElement.getAttribute('data-theme') === 'dark' ? '#6cc6bb' : '#176d66');
    function shellMat(color) {
      const key = color || 'auto';
      let m = shellMats.get(key); if (m) return m;
      m = new THREE.MeshBasicMaterial({ color: key === 'auto' ? themeTeal() : color, side: THREE.BackSide, transparent: true, opacity: 1, depthWrite: false, toneMapped: false,
        clippingPlanes: C.clipPlanes, stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc,
        stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp, stencilZPass: THREE.KeepStencilOp });
      m.name = 'highlight-outline'; m.userData.auto = key === 'auto';
      m.onBeforeCompile = (sh) => {
        sh.uniforms.outlineK = OUT_K;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float outlineK;')
          .replace('#include <project_vertex>', '#include <project_vertex>\n{ vec3 nV = normalize(normalMatrix * normal); mvPosition.xyz += nV * max(0.02, -mvPosition.z * outlineK); gl_Position = projectionMatrix * mvPosition; }');
      };
      m.customProgramCacheKey = () => 'hl-outline';
      shellMats.set(key, m); return m;
    }
    const canHelp = (o) => o.isMesh && !o.isSkinnedMesh && !o.isInstancedMesh && !Array.isArray(o.material) && o.geometry && o.geometry.attributes.position && o.geometry.attributes.normal;
    function helper(o, mat, order) {
      const h = new THREE.Mesh(o.geometry, mat);
      h.renderOrder = order; h.castShadow = false; h.receiveShadow = false; h.raycast = noRay; h.userData.__helper = true; h.frustumCulled = o.frustumCulled;
      o.add(h); return h;
    }
    function cloneMat(base) {
      const m = base.clone();
      m.onBeforeCompile = base.onBeforeCompile; m.customProgramCacheKey = base.customProgramCacheKey; m.userData = base.userData;
      envDone.add(m); // clones herdam a IBL do material base (não reaplicar a regra padrão)
      // Material.clone() copia os planos de corte por valor (congelaria o corte): compartilhar o array vivo
      m.clippingPlanes = base.clippingPlanes; m.clipShadows = base.clipShadows; m.clipIntersection = base.clipIntersection;
      return m;
    }
    function refreshMat(o) {
      const s = mstate.get(o); if (!s) return;
      if (s.cur && s.cur !== s.base) s.cur.dispose();
      s.cur = null;
      const wantPre = s.ghost != null && !s.hl && canHelp(o), wantShell = !!s.hl && canHelp(o);
      if (!wantPre && s.pre) { o.remove(s.pre); s.pre = null; }
      if (!wantShell && s.shell) { o.remove(s.shell); s.shell = null; }
      if (s.ghost == null && !s.hl) { o.material = s.base; o.castShadow = s.cast; o.renderOrder = s.order; mstate.delete(o); return; }
      const m = cloneMat(s.base);
      if (s.hl) {
        // destaque vence o fantasma: a estrutura destacada fica sólida, com a cor do próprio tecido
        if (m.emissive && s.base.color) { m.emissive = s.base.color.clone(); m.emissiveIntensity = 0.15; }
        if (m.transparent) m.opacity = Math.min(1, (s.base.opacity || 1) * 2.2);
        // marca a silhueta visível no estêncil (o contorno só aparece fora dela)
        Object.assign(m, { stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp, stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp });
        o.castShadow = s.cast; o.renderOrder = s.order;
        if (wantShell) { if (!s.shell) s.shell = helper(o, shellMat(s.hl === 'auto' ? null : s.hl), Math.max(5, s.order + 1)); else s.shell.material = shellMat(s.hl === 'auto' ? null : s.hl); }
      } else {
        m.transparent = true; m.opacity = Math.min(s.base.opacity ?? 1, s.ghost); m.depthWrite = false; m.side = THREE.FrontSide;
        if (m.isMeshStandardMaterial) {
          if ('sheen' in m) m.sheen = 0;
          if ('clearcoat' in m) m.clearcoat = 0;
          if (m.normalScale) m.normalScale.multiplyScalar(0.12);
          m.roughness = Math.max(m.roughness ?? 0.5, 0.6);
          m.envMapIntensity = (s.base.envMapIntensity ?? 1) * 0.8;
          const prev = s.base.onBeforeCompile, key = s.base.customProgramCacheKey ? s.base.customProgramCacheKey() : '';
          m.onBeforeCompile = (sh, r) => {
            if (prev) prev.call(m, sh, r);
            sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', GHOST_FR + '\n#include <opaque_fragment>');
          };
          m.customProgramCacheKey = () => key + '|ghostfx';
        }
        o.castShadow = false;
        const ord = ghostOrder(s.layer);
        o.renderOrder = ord + 1;
        if (wantPre && !s.pre) s.pre = helper(o, PRE, ord); else if (s.pre) s.pre.renderOrder = ord;
      }
      s.cur = m; o.material = m;
    }
    function mstateOf(o) {
      let s = mstate.get(o);
      if (!s) { s = { base: o.material, cast: o.castShadow, order: o.renderOrder, ghost: null, layer: null, hl: null, cur: null, pre: null, shell: null }; mstate.set(o, s); }
      return s;
    }
    /** Antes de cada desenho: largura do contorno em px constantes, cor do tema, geometria dos auxiliares. */
    function syncHelpers() {
      const sz = renderer.getSize(tmp2);
      OUT_K.value = (OUTLINE_PX * 2) / (camera.projectionMatrix.elements[5] * Math.max(1, sz.y));
      const auto = shellMats.get('auto'); if (auto) auto.color.set(themeTeal());
      for (const [o, s] of mstate) {
        if (s.pre && s.pre.geometry !== o.geometry) s.pre.geometry = o.geometry;
        if (s.shell && s.shell.geometry !== o.geometry) s.shell.geometry = o.geometry;
      }
    }
    const tmp2 = new THREE.Vector2();
    let hlId = null; const hlSet = new Set();
    /** E.highlight(id, color?) — sem cor: contorno na cor de destaque da interface (teal; claro no tema escuro). */
    E.highlight = function (id, color) {
      for (const o of hlSet) { const s = mstate.get(o); if (s) { s.hl = null; refreshMat(o); } }
      hlSet.clear(); hlId = null;
      if (!id) return;
      const ent = ATLAS.registry.get(id); if (!ent) return;
      hlId = id;
      for (const root of ent.objects) root.traverse((o) => {
        if (!o.isMesh || o.userData.__helper || hlSet.has(o) || !o.material) return;
        const s = mstateOf(o); s.hl = color || 'auto'; hlSet.add(o); refreshMat(o);
      });
    };
    E.highlighted = () => hlId;
    /** Centro (anatômico) aproximado de uma estrutura registrada (malhas com esqueleto: caixa na pose atual). */
    E.centerOf = function (id) {
      const ent = ATLAS.registry.get(id); if (!ent) return null;
      world.updateMatrixWorld(true);
      const box = new THREE.Box3(), bb = new THREE.Box3();
      for (const root of ent.objects) root.traverse((o) => {
        if (!o.isMesh || o.userData.__helper || !o.geometry) return;
        if (o.isSkinnedMesh) { try { o.computeBoundingBox(); bb.copy(o.boundingBox).applyMatrix4(o.matrixWorld); box.union(bb); } catch (e) { /* ignora */ } return; }
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        bb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); box.union(bb);
      });
      if (box.isEmpty()) return null;
      const c = box.getCenter(new THREE.Vector3()); const s = box.getSize(new THREE.Vector3());
      const out = { center: [-c.x, c.y, c.z], size: Math.max(s.x, s.y, s.z) };
      // salvaguarda: a mão do operador centra na palma (a caixa da pose de ligação do GLB ficava ~30 cm fora da cena)
      if (id === 'operator-hand' && E.anchors.palm && (out.size > 30 || Math.hypot(out.center[0] - E.anchors.palm[0], out.center[1] - E.anchors.palm[1], out.center[2] - E.anchors.palm[2]) > 12)) return { center: E.anchors.palm.slice(), size: 14 };
      return out;
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
      if (spec) {
        const n = new THREE.Vector3(-spec.normal[0], spec.normal[1], spec.normal[2]).normalize();
        clipPlane.setFromNormalAndCoplanarPoint(n, toWorld(spec.point));
        C.clipPlanes.push(clipPlane);
      }
      shadowDirty = true; // a parte cortada deixa de projetar sombra (clipShadows)
    };

    /* ---- camadas ---- */
    E.setLayer = (n, v) => { if (layers[n]) layers[n].visible = !!v; };
    E.showOnly = (list) => ATLAS.LAYERS.forEach((n) => (layers[n].visible = list.includes(n)));
    /** Torna uma camada translúcida ("fantasma") para ver estruturas profundas; opacity null restaura. */
    const ghostLayers = new Map();
    E.setGhost = function (n, opacity) {
      const g = layers[n]; if (!g) return;
      if (opacity == null) ghostLayers.delete(n); else ghostLayers.set(n, opacity);
      const list = []; g.traverse((o) => { if (o.isMesh && o.material && !o.userData.__helper) list.push(o); });
      for (const o of list) {
        if (opacity == null) { const s = mstate.get(o); if (s && s.ghost != null) { s.ghost = null; refreshMat(o); } continue; }
        const s = mstateOf(o); s.ghost = opacity; s.layer = n; refreshMat(o);
      }
    };
    E.ghosts = () => Object.fromEntries(ghostLayers);
    E.clearGhosts = () => ATLAS.LAYERS.forEach((n) => E.setGhost(n, null));

    /* ---- sombras sob demanda ---- */
    let shadowDirty = true, shadowSig = '', shadowUntil = 0;
    E.markShadowDirty = () => { shadowDirty = true; };
    function shadowKey() {
      const st = E.state;
      let k = st.phase + ',' + (+st.handPose || 0).toFixed(4) + ',' + (+st.breath || 0).toFixed(4) + ',' + st.wireMal + ',' + st.rollMode + ',' + st.showPlanes + ',' + st.fixStep + ',' + !!st.dilator + ',' + st.markers + ',' + st.chapter + '|';
      for (const n of ATLAS.LAYERS) k += layers[n].visible ? '1' : '0';
      k += '|' + [...ghostLayers.entries()].join(';') + '|' + hlId;
      for (const p of C.clipPlanes) k += '|' + p.normal.x.toFixed(4) + ',' + p.normal.y.toFixed(4) + ',' + p.normal.z.toFixed(4) + ',' + p.constant.toFixed(4);
      return k;
    }
    function updateShadows() {
      if (!renderer.shadowMap.enabled) return;
      const k = shadowKey();
      const now = performance.now();
      if (shadowDirty || k !== shadowSig) { shadowSig = k; shadowDirty = false; shadowUntil = now + 1500; try { E.applyEnvIntensity(); } catch (e) { /* noop */ } }
      // mantém o mapa atualizado durante a janela das transições animadas dos módulos (poses interpoladas)
      if (now < shadowUntil) renderer.shadowMap.needsUpdate = true;
    }
    /** Preparação comum a todo desenho (laço, renderOnce, snapshot). */
    function prerender() { updateShadows(); syncHelpers(); }

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
    E.renderOnce = function () { applyCam(); prerender(); renderer.render(scene, camera); };
    function loop(now) {
      if (!running) return;
      requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000); last = now; E.state.time += dt;
      stepTween(now);
      for (const r of Object.values(E.results)) if (r && r.update) { try { r.update(E.state, dt); } catch (e) { /* noop */ } }
      prerender();
      renderer.render(scene, camera);
      for (const f of E.frameHooks) f(now, dt);
    }
    E.start = () => { running = true; requestAnimationFrame(loop); };
    E.stop = () => { running = false; };
    /** Captura PNG da vista atual (opcionalmente em outro tamanho). */
    E.snapshot = function (w, h) {
      const size = renderer.getSize(new THREE.Vector2()); const pr = renderer.getPixelRatio();
      if (w && h) { renderer.setPixelRatio(1); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
      prerender(); renderer.render(scene, camera); const url = renderer.domElement.toDataURL('image/png');
      if (w && h) { renderer.setPixelRatio(pr); renderer.setSize(size.x, size.y, false); camera.aspect = size.x / size.y; camera.updateProjectionMatrix(); }
      return url;
    };

    E.setView(opts.view || 'front');
    /* ---- pré-compilação dos programas de sombreamento antes de devolver o motor: sem isso o 1º quadro
       (depois de 'Pronto.') congelava a página por segundos compilando dezenas de programas. ---- */
    if (opts.precompile !== false && renderer.compileAsync) {
      if (opts.onProgress) { try { opts.onProgress('materiais', names.length - 1, names.length); } catch (e) { /* noop */ } await new Promise((r) => setTimeout(r, 0)); }
      const t0 = performance.now();
      try { applyCam(); await renderer.compileAsync(scene, camera); } catch (e) { E.errors.push('compile: ' + (e && e.message)); }
      E.compileMs = Math.round(performance.now() - t0);
      /* Variantes com plano de corte: o compile() do r160 não aplica o estado de corte por material, então elas seriam
         compiladas de uma vez no 1º uso (entrada no cap. 08 ou botão Corte — travada perceptível). Aquecimento: 1 quadro
         num alvo 1×1 com todas as camadas visíveis e um plano distante que mantém tudo (o app usa 1 plano). */
      if (opts.warmClip !== false) {
        const t1 = performance.now(), vis = ATLAS.LAYERS.map((n) => layers[n].visible), prevRT = renderer.getRenderTarget();
        let rt = null;
        try {
          rt = new THREE.WebGLRenderTarget(1, 1);
          ATLAS.LAYERS.forEach((n) => (layers[n].visible = true));
          C.clipPlanes.push(new THREE.Plane(new THREE.Vector3(0, 0, -1), 1e5));
          renderer.setRenderTarget(rt); renderer.render(scene, camera);
        } catch (e) { E.errors.push('warmClip: ' + (e && e.message)); }
        renderer.setRenderTarget(prevRT); C.clipPlanes.length = 0;
        ATLAS.LAYERS.forEach((n, i) => (layers[n].visible = vis[i])); if (rt) rt.dispose();
        shadowDirty = true;
        E.warmClipMs = Math.round(performance.now() - t1);
      }
    }
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
