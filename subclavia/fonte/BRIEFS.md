# Briefings por módulo (leia também SPEC.md)

Contexto comum: os módulos são construídos em ordem (`skeleton, vessels, muscles, nerves, viscera, skin, instruments`).
Quando o seu roda, `ctx.layers.*` já contém as malhas dos módulos anteriores (se os arquivos existirem) — você pode
consultá-las (ex.: `THREE.Raycaster` contra um subconjunto pequeno de malhas, ou `Box3`) para assentar superfícies, mas
mantenha o tempo de construção do seu módulo ≤ 700 ms no harness (campo `ms`). Outros agentes estão escrevendo os demais
módulos AO MESMO TEMPO: não dependa da existência deles para funcionar (degrade com elegância) e não edite os arquivos deles.
Lembre-se: `tools/gendev.py` inclui automaticamente todos os módulos existentes; use `mods=` para isolar.

---------------------------------------------------------------------------------------------------
## VESSELS — `src/modules/vessels.js` (camadas `vein`, `artery`) — orçamento ≤ 260 mil triângulos
Construa a árvore vascular cervicotorácica com os eixos de `LM.vessels` (não altere os pontos principais; você pode
acrescentar pontos intermediários se mantiver o trajeto):
- Veias: axilar→subclávia D/E (E = espelho), VJI D/E com **dilatação do bulbo inferior** e leve achatamento (veias são
  ovais/colapsáveis — use `rx≠ry`), VBC D (curta, vertical) e VBC E (longa, oblíqua, anterior aos ramos do arco), VCS até a
  junção cavoatrial (tampa arredondada; o coração é de outro módulo), **ázigo** (sobe à direita dos corpos vertebrais em
  z≈−7.4, arqueia sobre o brônquio principal direito em ~T4 e desemboca na face posterior da VCS em y≈−4.6), veias torácicas
  internas (mediais às artérias), VJE D/E (`LM.vessels.ejvR`, superficial), cefálica D/E (`LM.vessels.cephalicR`), jugulares
  anteriores opcionais. Válvulas: sugerir discretamente a válvula da VJI inferior/subclávia (anel sutil) é bem-vindo.
- Artérias: aorta (ascendente/arco/descendente; raio decrescente), tronco braquiocefálico, carótidas comuns D/E (cortes
  planos em y=11), subclávias D (do TBC) e E (do arco) com as **3 partes** em relação ao escaleno anterior, axilares,
  vertebrais (`LM.vessels.vertebralAR` + espelho a partir da subclávia E), torácicas internas (`itaR` + espelho), troncos
  tireocervicais (curtos, da 1ª parte, lateral à vertebral; ramos tireóideo inferior medial-cranial, supraescapular e
  cervical transverso cruzando **anteriormente** ao escaleno anterior e ao frênico), costocervical opcional.
- Ramos fundem-se suavemente ao tronco (sem degraus; o ramo começa dentro do tronco com raio ligeiramente menor).
- Superfícies úmidas: `C.mats.vein`/`artery` já têm clearcoat; crie variantes sutis (aorta um pouco mais clara, veias com
  leve translucidez visual via cor mais clara nos bordos se quiser — sem transparência real).
- Registre `C.solid` para os eixos principais; rode `solids=0.1` com `mods=skeleton,vessels` e elimine interpenetrações
  com ossos (exceto contatos anatômicos) — atenção: clavícula, 1ª costela, manúbrio, vértebras, traqueia/esôfago (estes do
  módulo viscera — use os eixos `LM.trachea`/`LM.esophagus` como sólidos de referência no seu teste).
- Âncoras obrigatórias: ver SPEC §4. Vistas para validar: `view=front&layers=bones,vein,artery`, `view=close`, `view=oblique`,
  `cam=0,-3,-3,40,0,0.9` (de cima), `cam=3,0,-3,26,-1.57,0.1&clip=-1,0,0,6,0,0` (corte parassagital).

---------------------------------------------------------------------------------------------------
## NERVES — `src/modules/nerves.js` (camadas `nerve`, `lymph`) — orçamento ≤ 140 mil triângulos
- **Plexo braquial** D/E: raízes C5–T1 saindo dos forames intervertebrais (entre tubérculos anterior/posterior das
  vértebras cervicais e acima/abaixo da 1ª costela para T1), entre escalenos anterior e médio; troncos superior/médio/inferior
  (eixos em `LM.nerves.plexusTrunks`), divisões anteriores/posteriores atrás da clavícula, fascículos lateral/posterior/medial
  em torno da artéria axilar (nomeados pela relação com a 2ª parte da axilar, atrás do peitoral menor). Calibre decrescente,
  aspecto de feixes (textura de fibras), cor amarela convencional.
- **Frênico** D/E: C3–C5, desce na face anterior do escaleno anterior (lateral→medial), passa entre artéria e veia
  subclávias, depois ao longo da VBC/VCS e do pericárdio até o diafragma (eixo D em `LM.nerves.phrenicR`; o E acompanha a
  VBC E, cruza o arco aórtico anteriormente e desce sobre o pericárdio do VE).
- **Vago** D/E: na bainha carotídea entre VJI e ACC, posterior; o D cruza anteriormente a 1ª parte da subclávia e dá o
  **laríngeo recorrente D** que contorna a subclávia por baixo; o E cruza o arco aórtico e o **recorrente E** contorna o
  arco (lateral ao ligamento arterioso). Depois seguem posteriores aos hilos/esôfago.
- **Tronco simpático cervical/torácico** D/E sobre os colos das costelas/corpos vertebrais, com **gânglio estrelado**
  (cervicotorácico) sobre o colo da 1ª costela, posterior à artéria vertebral, próximo à cúpula.
- **Linfáticos** (camada `lymph`, cor verde convencional): **ducto torácico** (eixo `LM.lymph.thoracicDuct`: sobe à
  esquerda, arqueia em C7 anteriormente à artéria vertebral e posteriormente à bainha carotídea, desemboca no **ângulo venoso
  esquerdo**); ducto linfático direito (curto, `LM.lymph.rightLymphDuct`); opcional: alguns linfonodos supraclaviculares
  (pequenos ovoides). Ducto com aspecto levemente nodoso ("contas" das válvulas).
- Registre `C.solid` e valide contra `mods=skeleton,vessels,nerves` (se vessels existir) ou contra os eixos de LM.
- Âncoras obrigatórias: ver SPEC §4. Vistas: `view=oblique&layers=bones,vein,artery,nerve,lymph`, `cam=4,2,-3,22,-0.35,0.35`,
  vista de cima `cam=0,1,-4,34,0,1.2`, `view=front&layers=nerve,lymph,artery,vein`.

---------------------------------------------------------------------------------------------------
## MUSCLES — `src/modules/muscles.js` (camada `muscle`) — orçamento ≤ 280 mil triângulos
- **Esternocleidomastóideo** D/E com cabeças esternal (tendínea, estreita, da face anterior do manúbrio) e clavicular
  (larga, carnosa, do terço medial da clavícula), unindo-se acima (`LM.muscles.scm`), deixando a **fossa supraclavicular
  menor** entre elas. Corte plano na altura y≈11 (borda do recorte).
- **Escalenos anterior e médio** D/E (eixos/larguras `LM.muscles.scaleneAnt/scaleneMid`), achatados, com origens nos
  tubérculos das vértebras C3–C7 e inserções na 1ª costela (anterior: tubérculo do escaleno; médio: atrás do sulco arterial).
  Escaleno posterior opcional (2ª costela).
- **Subclávio** D/E: ventre fusiforme no sulco inferior do terço médio da clavícula → tendão para a junção da 1ª costela com
  a cartilagem; fica anterossuperior à veia subclávia.
- **Peitoral maior** D/E: porção clavicular (metade medial da face anterior da clavícula) e esternocostal (esterno +
  cartilagens 1–6), em leque convergindo para a crista do tubérculo maior do úmero, com **torção** (fibras inferiores
  inserem-se mais alto e posteriormente). Espessura 1–2,5 cm. Assente sobre a parede torácica (costelas/intercostais) sem
  atravessá-la. Fibras na direção correta (textura `C.tex.fibers`, v ao longo das fibras).
- **Peitoral menor** D/E: costelas 3–5 (perto das cartilagens) → **processo coracoide** (`LM.scapula.coracoid.tip`).
- **Deltoide** D/E (terço lateral da clavícula, acrômio, espinha → tuberosidade deltóidea ~y −11 no úmero), envolvendo
  a cabeça umeral; **sulco deltopeitoral** entre deltoide e peitoral maior (onde passa a cefálica, `LM.vessels.cephalicR`).
- **Trapézio** (fibras superiores e médias, posterior no pescoço/ombro, até terço lateral da clavícula/acrômio/espinha).
- **Omo-hióideo** (ventre inferior: borda superior da escápula perto da incisura → cruza o triângulo posterior superficial
  ao plexo e à artéria subclávia → tendão intermédio sobre a VJI sob o ECM) — fino.
- **Esterno-hióideo/esternotireóideo** (finos, da face posterior do manúbrio/clavícula medial para cima, anteriores à
  traqueia, entre a articulação esternoclavicular e a confluência venosa).
- **Intercostais** externos/internos nos espaços 1–6 ao menos anteriormente (lâminas finas entre costelas; fibras oblíquas
  em direções opostas; podem ser um único "slab" por espaço com textura). **Serrátil anterior** lateral (opcional).
- **Ligamento costoclavicular** D/E (`C.mats.ligament`; da junção 1ª costela/cartilagem à tuberosidade costal da
  clavícula) e **fáscia clavipeitoral** D/E (`C.mats.fascia`, translúcida, envolve o subclávio e desce ao peitoral menor;
  perfurada pela cefálica).
- Formas orgânicas: use `C.slabGeometry` para músculos planos (peitorais, deltoide, trapézio, intercostais), varreduras com
  secção elíptica para fusiformes; bordas afiladas; inserções tendíneas com `C.mats.tendon`.
- Valide: `view=front&layers=bones,muscle`, `view=oblique&layers=bones,muscle,vein,artery`, perfil com corte
  `cam=6,0,-1,30,-1.57,0.05&clip=-1,0,0,7,0,0&layers=bones,muscle,vein,artery`, `debug=faces`.

---------------------------------------------------------------------------------------------------
## SKIN — `src/modules/skin.js` (camadas `skin`, `drape`, `aids`) — orçamento ≤ 220 mil triângulos
- **Envelope de pele** contínuo: pescoço (até y≈11, corte oblíquo limpo), ombros, tórax, braços proximais (corte em
  y≈−14..−16), abdome superior (corte em y≈−27). Proporções de adulto masculino magro/médio. Deve conter TODOS os ossos,
  músculos e vasos superficiais (VJE logo abaixo da pele) sem atravessá-los, com espessura de partes moles realista:
  ~0,5 cm sobre esterno/clavícula, 1–2,5 cm sobre o peitoral, mais no ombro (deltoide) e dorso.
- **Relevos de superfície** didáticos e sutis: depressão da incisura jugular, saliência das clavículas e das articulações
  esternoclaviculares, **fossa infraclavicular** e **sulco deltopeitoral**, relevo do ECM com **fossa supraclavicular
  menor**, ângulo esternal, linha média esternal, contorno do peitoral, mamilos/aréolas masculinos (~4º espaço, linha
  hemiclavicular), proeminência de C7 e escápulas no dorso.
- **Duas camadas** (para o corte didático): pele externa (`C.mats.skin`, cor de corte de gordura) e superfície interna do
  subcutâneo (offset para dentro, `id: subcutaneous`) de modo que, no corte parassagital pelo trajeto da agulha, se veja
  pele → subcutâneo (amarelo) → músculos. Faces corretas (ver SPEC).
- Método sugerido: superfície paramétrica (anéis em y, ângulo θ) com perfis derivados de LM + amostragem por raios contra um
  subconjunto pequeno de malhas (ossos/músculos relevantes) em baixa resolução, offset e suavização Laplaciana; depois
  deformações locais para os relevos. Garanta que a pele passe perto de `LM.needle.entrySkin`, `LM.needle.indexSkin`,
  `LM.needle.thumbSkin` e `LM.surface.notchSkin` (exporte as posições efetivas como âncoras).
- **Campo estéril** (camada `drape`): campo fenestrado azul que acompanha a superfície (offset ~0,3 cm, dobras/ondulações
  sutis) com janela retangular de bordas arredondadas (~12×9 cm) expondo incisura, terço medial da clavícula D e região
  infraclavicular D; e **área de antissepsia** (clorexidina: tom alaranjado/rosado translúcido com borda suave — decalque
  levemente acima da pele, `id: skin-prep`).
- **Coxins** (camada `aids`, conforme `state.rollMode`): 'interscapular' = rolo longitudinal entre as escápulas sob a coluna
  torácica; 'ipsilateral' = rolo pequeno sob o ombro direito. Tecido de toalha (material fosco claro). Âncoras
  `rollInterscapular`, `rollShoulderR`. Mostre/oculte em `update(state)`.
- Valide: `view=front&layers=skin`, `view=hand&layers=skin`, `cam=0,-4,-3,80,-0.6,0.1&layers=skin`, `view=back&layers=skin`,
  `layers=skin,bones&ghost=skin:0.35` (relação com ossos), corte `cam=6,0,-1,30,-1.57,0.05&clip=-1,0,0,9,0,0`,
  `layers=skin,drape&view=hand`, `rollMode=interscapular&view=side`.

---------------------------------------------------------------------------------------------------
## VISCERA — `src/modules/viscera.js` (camadas `lung`, `pleura`, `mediastinum`) — orçamento ≤ 320 mil triângulos
- **Pulmões** que preenchem a cavidade torácica: superfície costal acompanhando a face interna das costelas (gradil
  derivado de `LM.ribs`), face mediastinal côncava com impressões (coração, arco aórtico/aorta descendente à E, VCS/ázigo à D,
  esôfago/traqueia), **ápice** na cúpula (`LM.pleura`) com sulco da subclávia, base côncava sobre o diafragma, bordas
  anterior e inferior afiladas; D com 3 lobos (fissuras oblíqua e horizontal — horizontal ~4ª cartilagem), E com 2 lobos
  (fissura oblíqua), **incisura cardíaca e língula**. Preferência: malhas por lobo (`lung-R-upper` etc.); se inviável,
  `lung-R`/`lung-L` com fissuras como sulcos escuros. Textura lobular (`C.tex.lobules`), cor rosa-acinzentada realista.
- **Pleura parietal** translúcida (`C.mats.pleura`): cúpula, costal, diafragmática, mediastinal; recessos costodiafragmáticos
  ~2 costelas abaixo da borda pulmonar (LM.pleura.reflection vs lungLower). Registre `pleura-R/L`. A cúpula deve ficar
  posterior/inferior às artérias subclávias e ao plexo (esfera de exclusão aproximada em LM.pleura).
- **Traqueia** com anéis em C (cartilagem) e parede posterior membranosa, **carina**, brônquios principais (D mais curto,
  largo e vertical; E mais longo, sob o arco aórtico), brônquios lobares iniciais opcionais. **Esôfago** (`LM.esophagus`).
- **Coração** com forma anatômica (não esfera): AD recebendo a VCS em `LM.vessels.cavoatrialJunction` e VCI, VD anterior,
  VE com ápice em `LM.heart.apex` (~5º EIC LHC E), AE posterior, aurículas, **tronco pulmonar** saindo do VD à esquerda da
  aorta ascendente (início em `LM.vessels.aorta.pts[0]`) e bifurcando sob o arco (artéria pulmonar D passando atrás da aorta
  ascendente e da VCS), veias pulmonares no AE, sulcos coronários com gordura. **Pericárdio** translúcido.
- **Diafragma**: cúpulas D (mais alta) e E, centro tendíneo (material tendão), periferia muscular inserida na margem
  costal/xifoide/costelas inferiores, pilares até a coluna; hiatos sugeridos. **Timo** remanescente (gordura) opcional
  atrás do manúbrio, anterior à VBC E.
- **Respiração** (`update(state)`, `state.breath` 0→1): diafragma desce (~2,5 cm na inspiração máxima didática), pulmões e
  pleura expandem sobretudo nas bases e anterolateralmente; o **ápice/cúpula praticamente não se move** (≤ 1 mm). Pré-calcule
  posições base/alvo por vértice e interpole (barato); atualize normais de forma econômica.
- Valide: `view=front&layers=bones,lung,pleura,mediastinum`, `breath=1` vs `breath=0`, `view=back`, lateral
  `cam=4,-8,-4,70,-1.57,0.05`, ápice `view=close&layers=bones,lung,pleura,artery,vein` (se vessels existir), `debug=faces`.

---------------------------------------------------------------------------------------------------
## INSTRUMENTS — `src/modules/instruments.js` (camadas `hand`, `instrument`, `aids`) — orçamento ≤ 160 mil triângulos (+ mão GLB)
- **Mão esquerda do operador** (async): use o GLB em `window.HAND_GLB` (WebXR generic-hand, esquerda, MIT). Veja como o
  atlas original faz em `$P/../orig/app_tail.js` (`buildHands`: corrige hierarquia de ossos com `attach`, pose por
  quaternions, conversão de eixos). Melhore:
  - Alinhamento por **3 restrições**: polpa do indicador em `LM.needle.indexSkin` (sobre a incisura), polpa do polegar em
    `LM.needle.thumbSkin` (logo abaixo da clavícula, junção dos terços), e **dorso da mão voltado anterior/superolateral com
    punho superolateral** (antebraço vindo de cranial-lateral, como o operador posicionado ao lado direito do paciente — veja a
    foto `data/prancha.jpg`). Se a camada `skin` existir, ajuste as polpas exatamente à superfície (raio contra a pele).
  - Pose anatômica: indicador estendido com leve flexão IFD; polegar abduzido/levemente fletido pressionando a pele; 3º–5º
    dedos fletidos (MCF ~60–70°, IFP ~90°, IFD ~30–40°) sem atravessar a palma; sem dedos atravessando a pele.
  - Antebraço/punho: prolongue com punho de luva e antebraço até sair do enquadramento (sem "cotoco"). Luva estéril de
    látex (`C.mats.glove` ou variante com leve normal map de rugas).
  - `state.handPose` 0→1: 0 = mão ~3 cm afastada da pele e dedos menos fletidos; 1 = apoio final.
- **Agulha e seringa** (camada `instrument`): agulha introdutora 18G de parede fina (DE 1,27 mm, 6,35 cm), **bisel** real
  (corte oblíquo), canhão, seringa de 5 mL (corpo ~1,4 cm DE, ~6 cm), êmbolo e aletas; graduações sem números. Trajeto
  retilíneo `LM.needle.entrySkin` → `LM.needle.veinTarget`. Fases (`state.phase`): 1 ponta 2 cm fora da pele no prolongamento
  do trajeto; 2 ponta ~0,5 cm sob a pele; 3 ponta sob a clavícula (x≈7,5); 4 ponta na luz venosa + **sangue venoso escuro** no
  corpo da seringa; 5 seringa removida, **fio-guia em J** (0,89 mm) atravessando a agulha e seguindo VSC → VBC D → VCS
  (eixos de `LM.vessels`), ponta em J visível; se `state.wireMal`, trajeto alternativo translúcido subindo a VJI (`wireIJV`);
  6 **cateter venoso central** (7 Fr, triplo lúmen, ~2,3 mm) com ponta em `LM.vessels.cavoatrialJunction` (ou VCS distal),
  canhão/asas/extensões fora da pele. Transições suaves (~0,6 s) entre fases em `update`.
- **Auxílios** (camada `aids`): vetor de pressão do polegar (seta dourada para posterior/inferior, curta, sem quantificar
  força); anéis-marcadores na incisura e no ponto de entrada; quando `state.showPlanes`: linha tracejada de direção da
  entrada para `LM.needle.notchAim` (vista frontal) e **plano coronal translúcido** com **arco de ângulo** entre agulha e
  plano coronal (inclinação), com âncoras para rótulos.
- Valide: `view=hand&layers=skin,hand,aids` (se skin existir; senão bones), `hand=0`, `phase=1..6`, `phase=5&wireMal=1&view=front&layers=bones,vein,instrument`,
  `phase=4&view=close&layers=bones,vein,artery,instrument`, `showPlanes=1&phase=3&view=side`.

---------------------------------------------------------------------------------------------------
## CONTENT — `src/data.js` (define `window.ATLAS_DATA`) — sem limite de triângulos ;)
Ver `CONTENT_SPEC.md` (esquema completo, capítulos, regras editoriais, verificação de fontes).

---------------------------------------------------------------------------------------------------
## UI — `index.html`, `src/app.css`, `src/app.js` (+ `tools/uishot.js`)
Ver `UI_SPEC.md`.
