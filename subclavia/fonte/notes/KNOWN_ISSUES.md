# Pendências conhecidas (atualizado pelo integrador antes da onda 2 de correção)

## Já resolvidas pelo integrador
- Escápula fora do gradil: `LM.scapulaGeom()` (superfície compartilhada skeleton/muscles), afastada ~1,05 cm das costelas 2–9.
- engine.js: estado de material por malha (destaque × fantasma), clones preservam onBeforeCompile E compartilham
  `clippingPlanes` (o corte não congela mais em camadas fantasma/destacadas); `E.state.fixStep`.
- LM v2 (src/landmarks.js): esterno com ângulo de Louis convexo + cartilagens migradas; clavícula com S lateral e conoide
  posterior; escápula mais baixa/longa; agulha mais alta (através do subclávio); cúpula pleural mais alta; arco da subclávia
  mais alto (D/E); vertebral pelos forames; ITA nova; cefálica nova; aorta (fim); VBC E; frênico (topo); ducto torácico
  (cruza em T5–T4); escaleno médio (fim); LM.surface/needle (z da pele).
- tools/shot.js com timeout longo; tools/build.py roda `node --check`.

## Pendentes por dono (além dos achados da onda 2)
- vessels: seguir LM v2 (ramos do tronco tireocervical/supraescapular/cervical transversa com origens fixas no código
  devem acompanhar o arco elevado; ITA/ITV, cefálica, vertebral, VBC E); ramo deltóideo da toracoacromial ≥1 cm mais
  profundo; supraescapular/cervical transversa E espelhando a D.
- viscera: cúpula/ápice pelo LM v2 com sulcos da subclávia e do tronco inferior; átrio direito × junção cavoatrial
  (y=−8,6); bordas anteriores dos pulmões; domo apical sem englobar alça subclávia/ducto/recorrente/estrelado; hiato
  esofágico para os vagos; gotas do lobo superior D.
- nerves: plexo E sobre a borda lateral da 1ª costela E; re-assentar pelo LM v2 (cúpula, troncos, frênico, ducto).
- skeleton: tubérculos cervicais (escalenos), espinhoso de C7 (proeminente).
- skin/muscles: pescoço AP (~13 cm), ECM visível, fossa supraesternal mais larga; âncora clavicleSkinR na face anterior
  da clavícula na junção dos terços.
- instruments: inclinação da agulha (~32°); o texto do cap. 07 declara a limitação.
- data: cap. 04 enquadrar itaR; cap. 09 enquadrar svc; glossário de novos ids (supraspinatus, infraspinatus,
  teres-minor, dermis, section-deep, nipple-R/L e TODOS os ids registrados sem entrada).
- ui: inset 'planes' 2º painel → "PLANO AXIAL (vista pela cabeceira) · inclinação"; integrar a fixação em bailarina
  (notes/FIXACAO_CONTRACT.md).
