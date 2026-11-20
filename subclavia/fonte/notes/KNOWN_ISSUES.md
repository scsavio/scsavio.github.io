# Pendências conhecidas após a onda 1 (consolidadas pelo integrador)

Estas pendências JÁ estão na fila de correção da onda 2. Revisores: não as repita, a menos que tragam
evidência nova, gravidade diferente ou uma correção mais concreta (diga "reforça KNOWN #n").

## Já resolvidas na integração
- Escápula invadia o gradil costal (até 2,8 cm). Agora `LM.scapulaGeom()` (landmarks.js) é a superfície
  compartilhada por skeleton.js e muscles.js, afastada ~1,05 cm do envoltório das costelas 2–9.
- engine.js: destaque × fantasma com estado por malha (sem vazamento), clone preserva onBeforeCompile/cor de corte.
- tools/shot.js com timeout longo; tools/build.py roda `node --check` em cada script.
- LM.surface/LM.needle: z de notchSkin 0,75; sternalAngleSkin 2,2; coracoidSkin 2,0; thumbSkin 2,3; indexSkin 0,75.

## Pendentes (dono → pedido)
1. landmarks/vessels: LM.vessels.itaR (topo) → trajeto real do vessels.js ([3.3,1.05,−3.3] … [3.25,−2.9,−0.72]);
   viscera pede a ITA/ITV 0,3–0,5 cm mais anterior (perto das cartilagens) da 3ª cartilagem para baixo.
2. landmarks/vessels: LM.vessels.cephalicR — hoje faz alça perto do coracoide e fica anterior ao deltoide;
   deve perfurar a fáscia clavipeitoral MEDIAL ao coracoide e acima do peitoral menor, correr AFUNDADA no sulco
   deltopeitoral (y −2…−9) e, distalmente, na face anterolateral do braço (~[17.3,−9,0.6]).
3. landmarks/vessels: LM.vessels.vertebralAR V2 pelos forames transversários reais (C6 ≈ [1.32,6.8,−6.46]);
   LM.aorta último ponto [−0.85,−22.3,−6.02].
4. landmarks/vessels/muscles: VBC E encosta no manúbrio; recuar ≥0,3–0,4 cm (origem do esterno-hióideo/tireóideo E e timo).
5. vessels: ramo deltóideo da toracoacromial chega a z=1,6 na fossa infraclavicular (deve ficar ≥1 cm mais profundo,
   sob a fáscia clavipeitoral); artérias supraescapular/cervical transversa E devem espelhar as do lado D
   (à frente do frênico e do escaleno, sem alças).
6. viscera/landmarks: cúpula do átrio direito no eixo da VCS está em y=−7,62, mas LM.vessels.cavoatrialJunction
   está em y=−8,6 (a âncora "cavoatrial" cai dentro do coração; a ponta do cateter deve ficar na junção).
   Bordas anteriores dos pulmões: E entre a 2ª–4ª cartilagem a 3,2–3,6 cm da linha média e D no ângulo esternal a
   3,1 cm (meta ~1–1,5). Domo apical do pulmão engloba alça subclávia, ducto torácico, recorrente D e estrelado
   (nerves pede escavar o pulmão ao redor dos sólidos nerve:*/lymph:*). Hiato esofágico estreito para os troncos vagais.
7. nerves: divisões do plexo E atravessam o intercostal externo do 1º espaço E (devem passar sobre a borda lateral da
   1ª costela, como à D); re-assentar contra o escaleno médio novo (com canaletas).
8. skeleton: tubérculos anterior/posterior das vértebras cervicais curtos (pontas devem chegar a x≈2,6–3,0 para as
   origens dos escalenos); processo espinhoso de C7 (vértebra proeminente) longe da pele dorsal (4,9 cm); escápula
   na face costal toca costelas 6–7 (resolvido acima).
9. skin/landmarks/muscles: pescoço com AP ~15,8 cm (meta ~13): LM.skinBackZ cervical e trapézio mais anteriores;
   LM.muscles.scm.sternalOrigin x≈1,4–1,5 (fossa supraesternal mais larga); âncora clavicleSkinR (y=2,16) deve
   ficar sobre a face anterior da clavícula na junção dos terços (y≈1,4–2,0).
10. instruments/landmarks/data: inclinação da agulha ~32° com o plano coronal (Bannon descreve o conjunto "paralelo ao
    chão"). O texto do cap. 07 declara a limitação. Avaliar simular a depressão dos tecidos pelo polegar e/ou mirar a
    parede anterior da veia para reduzir para ~20–25°, mantendo a entrada coerente com o cap. 06.
11. data: cap. 04 deve enquadrar o rótulo itaR; cap. 09 deve enquadrar svc (hoje fora do quadro);
    glossário para novos ids: supraspinatus-R/L, infraspinatus-R/L, teres-minor-R/L, dermis, section-deep,
    nipple-R/L (o id "nipple" deixou de existir).
12. ui: inset 'planes', 2º painel: "CORTE PARASSAGITAL · inclinação" → "PLANO AXIAL (vista pela cabeceira) ·
    inclinação" e legenda "No plano axial, θ é o ângulo com o plano coronal".
