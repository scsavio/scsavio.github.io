# Pendências e limitações conhecidas (atualizado pelo integrador após a onda 3)

## Resolvidas nas ondas 2–3 (não reportar de novo sem evidência nova)
- Escápula fora do gradil (`LM.scapulaGeom()`, ~1,05 cm das costelas 2–9); clavícula com S lateral e conoide posterior.
- engine.js: estado de material por malha (destaque × fantasma), clones compartilham `clippingPlanes`; sombras sob demanda
  (janela de 1,5 s), `shadowKey` inclui dilatador/markers; IBL reaplicado.
- LM v2 completa (esterno/Louis, agulha pelo subclávio ≈30°, cúpula, arco da subclávia, vertebral, ITA, cefálica,
  VBC E, ducto torácico, frênico); veia axilar MEDIAL à 3ª parte da artéria (onda 3).
- VCS com tampa plana na junção cavoatrial: o módulo de vísceras abre o óstio do AD (luz contínua nos cortes coronais).
- Artéria pulmonar D fora da parede da aorta ascendente (onda 3).
- Vago D afinado entre a VJI e a bifurcação do TBC (sem invadir subclávia/carótida).
- Fio/cateter com curva suave no ângulo venoso (raio ≥0,9 cm); dilatador (etapa 6 do stepper; cap. 10).
- Rótulos de mão/agulha/fio/dilatador/cateter só aparecem com o objeto em cena; "sob a mão" sem raycasts extras.
- Pescoço AP ≈13,2 cm; nuca e C7; ligamento nucal; cefálica visível no sulco deltopeitoral; escalenos sem ramos
  arteriais atravessando.
- Glossário completo (todo id registrado tem entrada; `check_data --registry` = 0 erros).

## Limitações aceitas (didáticas ou de modelo — já declaradas no texto quando relevantes)
- Agulha ≈30° com o plano coronal (Bannon: "paralela ao chão" no paciente real) — declarado no cap. 07.
- Ápice pulmonar ≈1,5 cm acima da borda superior da clavícula medial; mais lateralmente fica abaixo (a 1ª costela ocupa
  o espaço) — limitação de LM, texto do cap. 04 coerente.
- Raiz medial do mediano encosta ~0,06 cm na veia axilar (oculta pela própria veia).
- Trapézio: borda do losango aponeurótico com degraus discretos na metade superior (visíveis só em close posterior);
  costura mediana leve (metades D/E) — nenhum capítulo usa essa vista.
- Sulco deltopeitoral 0,8–1,3 cm sem a pele (com a pele, invisível).
- Pele: pequenas manchas da casca subcutânea em cortes parassagitais do esterno inferior; casca atrás da clavícula
  visível só em corte axial y≈1,6; S lateral da clavícula pouco marcado na superfície; serrilhado na borda distal do
  campo estéril além do ombro.
- Diafragma: abas pequenas na borda dos hiatos (vistas só de baixo/perto); hiatos esofágico e aórtico confluentes
  atrás e à E do esôfago.
- `lungBaseR` estática (não acompanha a inspiração; o texto descreve o movimento).
- Fontes 3, 4 (MSD) e 25 (ASA 2020) mantidas como leitura complementar, sem citação em capítulo.
- Óstio VCS → AD: nos cortes coronal/sagital que passam exatamente pela junção resta um septo fino com cintilação no
  plano da tampa plana da VCS (luz contínua; nenhum capítulo usa esse corte).

## Pendência editorial (para o autor)
- Cap. 13: o documento-base usa o termo “tarô”; o texto o interpreta como coxim/rolo de apoio sob o dorso. Confirmar o
  significado pretendido pelo autor.
