# Atlas 3D — Punção da subclávia direita (v2) — ESPECIFICAÇÃO PARA MÓDULOS

Projeto: `/tmp/claude-0/-home-user-scsavio-github-io/d7fa0a92-2934-561a-a969-4f9f9aa0c9a0/scratchpad/atlas2` (chamado aqui de `$P`).
Objetivo: reconstruir um atlas educacional 3D (three.js r160, arquivo HTML único offline) da punção infraclavicular da veia
subclávia direita por marcos anatômicos, com **realismo anatômico, proporções corretas, didatismo e acabamento visual
profissional**. Público: médicos/residentes/internos (pt-BR). Uso exclusivamente educacional, sem função assistencial.
Versão original (para referência de conteúdo/limites): `$P/../orig/atlas.html` (não copie a geometria: ela tem erros,
p.ex. carótida LATERAL à jugular, ausência de tronco braquiocefálico/arco aórtico, costelas em aros horizontais, sem coluna).

## 1. Convenções (OBRIGATÓRIAS)
- Coordenadas **anatômicas**: `x` = DIREITA do paciente (+), `y` = cranial (+), `z` = anterior (+). Unidade: **cm** nominais.
- Origem (0,0,0) = incisura jugular (borda superior do manúbrio, linha média, face anterior). Paciente supino, braços aduzidos.
- O motor espelha o mundo (`world.scale.x = -1`) para que, na vista frontal, a direita do paciente apareça à esquerda da tela.
  Você trabalha SEMPRE em coordenadas anatômicas; não espelhe nada por conta própria para "corrigir" a tela.
- Estruturas bilaterais: construa o lado direito e gere o esquerdo com `C.mirrorGeometry`/`C.mirrorMesh` (mantêm faces
  para fora). Assimetrias reais (arco aórtico, tronco braquiocefálico só à direita, VBC esquerda longa e oblíqua, ducto
  torácico à esquerda, recorrente esquerdo sob o arco, coração/entalhe cardíaco à esquerda, pulmão D 3 lobos / E 2 lobos)
  DEVEM ser respeitadas.
- `src/landmarks.js` (`window.LM`) é a **fonte única de verdade** espacial: coluna, esterno (`LM.sternum.zAnt(y)`, `zMid`,
  `thick`, `halfWidth`), costelas (`LM.ribs[i].pts`), clavícula, escápula, úmero, eixos dos vasos principais
  (`LM.vessels.*` com `pts` e `r`), escalenos, cúpula pleural, traqueia, esôfago, coração, diafragma, nervos de referência,
  linfáticos, marcos de superfície e a trajetória da agulha (`LM.needle`). **Use esses números**; eles já foram checados
  quanto a colisões entre si. **Não edite** `landmarks.js`, `core.js`, `engine.js`, `skeleton.js` — se algo precisar
  mudar, descreva no seu relatório final (campo `requests`).

## 2. Arquitetura
- `vendor/three.js` (UMD r160, global `THREE`), `vendor/gltf.js` (`window.GLTFLoader`), `data/hand.js` (`window.HAND_GLB`, base64 do GLB da mão esquerda, MIT, WebXR generic-hand), `data/prancha.js` (`window.PRANCHA_JPG`, base64 de foto sintética).
- `src/core.js` → `ATLAS.makeCore(THREE)` retorna `C` (utilitários e materiais). `src/landmarks.js` → `window.LM`.
- `src/engine.js` → `ATLAS.createEngine(container, opts)` cria o visor e constrói os módulos na ordem de `tools/modules.txt`:
  `skeleton, vessels, muscles, nerves, viscera, skin, instruments`.
- Cada módulo é um arquivo `src/modules/<nome>.js` com:
  ```js
  ATLAS.define('<nome>', function (ctx) {           // pode ser async (ex.: instruments carrega o GLB)
    const { THREE, C, LM, layers } = ctx;           // layers.<camada> são THREE.Group
    ...
    return { anchors: { chave: [x,y,z], ... },      // pontos anatômicos para rótulos (coords anatômicas)
             update(state, dt) { ... },             // opcional: animações dependentes de estado
             api: { ... } };                        // opcional
  });
  ```
- Camadas (`layers`): `skin, bones, muscle, vein, artery, nerve, lymph, lung, pleura, mediastinum, hand, instrument, drape, aids`.
- `state` (lido em `update`): `{ breath: 0..1 (0 expiração, 1 inspiração), handPose: 0..1 (0 aproximando/aberta, 1 apoio final),
  phase: 0..6 (0 sem agulha; 1 aproximação; 2 ponta sob a pele; 3 ponta sob a clavícula; 4 ponta na luz venosa (aspiração);
  5 fio-guia avançado; 6 cateter posicionado), wireMal: bool (mostrar trajeto anômalo do fio para a VJI), rollMode:
  'none'|'interscapular'|'ipsilateral', showPlanes: bool (auxílios de plano/ângulo), time (s), chapter (índice) }`.

## 3. Utilitários de `C` (veja `src/core.js`)
- `C.V(p)`, `C.mirror(pts)`, `C.lerp`, `C.smooth`, `C.clamp`, `C.rng(seed)`, `C.noise3`, `C.fbm3`, `C.profile(spec)`.
- `C.curve(pts)` (Catmull-Rom centrípeta), `C.sample(pts,n)`.
- **`C.sweepGeometry(path, opts)`** — tubo generalizado: `r` ou `rx`/`ry` (número | array | `[[t,v],...]` | fn(t)), `up`
  (vetor ou fn(t,p,T) que orienta o eixo N da secção elíptica; sem `up` usa quadros de rotação mínima), `exp` (superelipse),
  `radial_fn(t,a)` (multiplicador radial p/ sulcos/achatamentos), `noise:{amp,freq,seed}`, `caps:'round'|'flat'|'none'`,
  `capStart/capEnd`, `segments` ou `density` (segmentos/cm), `radial`, `vScale` (cm por repetição de textura em v; v corre ao longo).
- `C.gridGeometry(f(u,v), nu, nv, {flip})` (superfície fechada em u; use `flip:true` se as faces ficarem para dentro),
  `C.patchGeometry(f,nu,nv)` (superfície aberta), `C.slabGeometry(f, th(u,v), nu, nv, outwardFn)` (lâmina fechada com espessura —
  ótima p/ músculos planos, fáscias, cortinas), `C.ellipsoidGeometry`, `C.segmentGeometry(a,b,r1,r2)`, `C.deform(g, fn(v))`,
  `C.mirrorGeometry(g)`, `C.mirrorMesh(mesh, parent, info)`.
- `C.mesh(geo, mat, parent, info)`, `C.tube(pts, opts, mat, parent, info)`, `C.ellipsoid(center, radii, mat, parent, info, rot)`.
- `C.reg(obj, info)` — registra estrutura para seleção/glossário. `info = { id, name, group, desc? }` (pt-BR).
- `C.solid(id, pts, r)` — registra eixo+raio para a checagem automática de interpenetração.
- Texturas procedurais: `C.tex.fibers(key,{cycles})` (normal map de fibras ao longo de v), `C.tex.noiseNormal`, `C.tex.lobules`
  (Voronoi p/ pulmão: `{map, normal}`), `C.tex.mottle(key, hex)`.
- Materiais prontos `C.mats`: `bone, boneDark, cartilage, disc, vein, artery, muscle, muscleDeep, tendon, ligament, nerve,
  lymph, lung, pleura, heart, pericardium, fat, thymus, trachea, esophagus, diaphragm, fascia, skin, steel, glove,
  plasticClear, plasticWhite, drape, marker`. Crie variantes com `C.mat({... , cut: 0xRRGGBB})` — `cut` define a cor de
  secção (faces internas vistas através do plano de corte ficam com essa cor chapada). **Malhas sólidas devem ser fechadas**
  (tampas) e com faces para fora; caso contrário aparecem com a cor de corte. Verifique com `debug=faces` (vermelho = face traseira).
  Materiais transparentes (pleura, pericárdio, fáscia) não usam `cut`.
- Todos os materiais de `C.mat` já recebem os planos de corte compartilhados (`C.clipPlanes`).

## 4. IDs canônicos (registro) e âncoras obrigatórias
Use exatamente estes `id` para as estruturas listadas (outras estruturas: crie ids no mesmo estilo kebab-case, sufixo `-R`/`-L`).
`group` (rótulo de categoria) em pt-BR: Ossos, Veias, Artérias, Músculos, Nervos, Linfáticos, Pulmões e pleura, Mediastino, Pele e superfície, Instrumentos.

| módulo | ids obrigatórios | âncoras obrigatórias (nomes de chave) |
|---|---|---|
| skeleton (pronto) | clavicle-R/L, manubrium, sternum-body, sternal-angle, xiphoid, rib-N-R/L, costal-cartilage-N-R/L, vertebra-XX, scapula-R/L, acromion-R/L, coracoid-R/L, humerus-R/L, sc-joint-R/L | notch, sternalAngle, clavicleR, clavicleMidR, firstRibR, scaleneTubercleR, coracoidR, acromionR, humeralHeadR, scJointR |
| vessels | scv-R, scv-L, axillary-v-R/L, ijv-R/L, ejv-R/L, cephalic-v-R/L, bcv-R, bcv-L, svc, azygos, itv-R/L, aorta, bct, cca-R, cca-L, sca-R, sca-L, axillary-a-R/L, vertebral-a-R/L, ita-R/L, thyrocervical-R/L | scvR (veia sob o terço medial da clavícula), scvLateralR (borda lateral da 1ª costela), axillaryVR, ijvR, venousAngleR, bcvR, lbcv, svc, cavoatrial, scaR (2ª parte, atrás do escaleno), scaR1 (1ª parte), axillaryAR, bct, ccaR, aorticArch, itaR, vertebralAR, ejvR, cephalicR, scvL, thoracicInletL |
| muscles | scm-R/L (cabeças esternal e clavicular), scalene-ant-R/L, scalene-mid-R/L, subclavius-R/L, pec-major-R/L, pec-minor-R/L, deltoid-R/L, trapezius-R/L, omohyoid-R/L, costoclavicular-lig-R/L, clavipectoral-fascia-R/L, intercostal-R/L | scmSternalR, scmClavicularR, scaleneAntR, scaleneMidR, subclaviusR, pecMajorClavR, pecMajorSternR, pecMinorR, deltoidR, costoclavLigR, clavipectoralR, intercostal1R, trapeziusR, omohyoidR |
| nerves | brachial-plexus-R/L, phrenic-R/L, vagus-R/L, recurrent-laryngeal-R/L, sympathetic-trunk-R/L, stellate-R/L, thoracic-duct, right-lymphatic-duct | plexusR, plexusRootsR, phrenicR, vagusR, recurrentR, stellateR, thoracicDuct, thoracicDuctTerminal, rightLymphDuct |
| viscera | lung-R-upper, lung-R-middle, lung-R-lower, lung-L-upper, lung-L-lower, pleura-R, pleura-L, trachea, bronchus-R, bronchus-L, esophagus, heart, pericardium, diaphragm, thymus | cupulaR, lungApexR, lungR, lungBaseR, costophrenicR, horizontalFissureR, obliqueFissureR, lungL, cardiacNotch, trachea, carina, esophagus, heart, diaphragmR, pericardium |
| skin | skin, subcutaneous, drape, skin-prep | notchSkin, sternalAngleSkin, clavicleSkinR, infraclavicularFossaR, deltopectoralR, lesserSupraclavFossaR, entrySkin, coracoidSkinR, rollInterscapular, rollShoulderR |
| instruments | operator-hand, needle, syringe, guidewire, catheter | indexTip, thumbTip, palm, needleTip, needleHub, wireTip, wireIJV, catheterTip, entry, thumbVector |

`desc` (opcional no módulo): 1–2 frases pt-BR com a relevância para a punção (o glossário central do módulo de conteúdo pode
sobrescrever). Toda malha visível deve ter `info` (diretamente ou herdado do grupo registrado).

## 5. Ferramentas de verificação (use-as!)
```
cd $P
python3 tools/gendev.py                         # regenera dev.html com os módulos existentes
node tools/shot.js "<query>" shots/<seu-modulo>_<nome>.png 1100 900   # SEMPRE prefixe com o nome do seu módulo
```
Parâmetros de `<query>` (dev.html): `mods=skeleton,vessels` (subconjunto) · `layers=bones,vein,artery` (camadas visíveis) ·
`hide=skin` · `view=front|oblique|side|hand|close|top|back` · `cam=tx,ty,tz,raio,az,el` (alvo ANATÔMICO; az<0 olha do lado
direito do paciente; el>0 de cima) · `clip=nx,ny,nz,px,py,pz` (mantém o lado para onde a normal aponta; ex.: corte
parassagital pelo trajeto da agulha visto da direita: `clip=-1,0,0,6,0,0&cam=6,0,-1,30,-1.57,0.05`) · `debug=faces` ·
`solids=0.1` (lista interpenetrações > 0.1 cm entre sólidos registrados com `C.solid`) · `breath=1` · `hand=0.5` · `phase=4` ·
`wireMal=1` · `labels=1` (desenha as âncoras) · `only=a,b` (âncoras específicas) · `pick=x,y` (imprime a estrutura sob o pixel).
A saída JSON mostra erros, tempo de construção por módulo, malhas, triângulos e tamanho do registro. Leia os PNG gerados com a
ferramenta Read e itere até ficar anatomicamente correto e bonito. Renderização usa SwiftShader (lenta: ~5–20 s por imagem).

## 6. Barra de qualidade
- **Anatomia correta e proporcional** (adulto médio; ver números de LM). Relações-chave a preservar: veia subclávia anterior ao
  escaleno anterior; artéria e plexo posteriores a ele; veia sobre a 1ª costela, imediatamente posterior/inferior ao terço
  medial da clavícula, com o subclávio acima/anterior; junção com a VJI atrás da articulação esternoclavicular; VJI LATERAL à
  carótida comum na bainha carotídea, vago posterior entre ambas; cúpula pleural ~2–3 cm acima do terço medial da clavícula
  em projeção anterior, posterior aos vasos subclávios; frênico na face anterior do escaleno anterior passando entre artéria
  e veia; ducto torácico no ângulo venoso ESQUERDO; artéria torácica interna descendo ~1–1,5 cm lateral à borda esternal.
- **Realismo visual**: formas orgânicas (afilamentos, curvaturas, achatamentos, inserções que se fundem), sem "salsichas"
  uniformes; use secções elípticas, ruído sutil, texturas de fibras nas direções corretas, ligamentos/tendões onde houver.
- **Sem interpenetrações visíveis** entre estruturas que não se conectam (registre seus eixos principais com `C.solid` e rode `solids=0.1`).
- **Desempenho**: orçamento de triângulos do seu módulo (ver seu briefing). Use `density`/`radial` moderados.
- **Registro**: toda malha com `info` (id/name/group); nomes em pt-BR corretos (Terminologia Anatômica).
- Não use rede/CDN; tudo procedural/local. Não altere arquivos de outros módulos.
- Código legível, comentado em pt-BR nos pontos não óbvios; sem `console.log` residual.

## 7. Entrega (relatório final do agente)
Retorne: arquivos criados; ids registrados; âncoras exportadas; triângulos; capturas que você verificou (caminhos);
pendências/limitações; `requests` para o integrador (ajustes em LM/core/engine/outros módulos), com justificativa.
