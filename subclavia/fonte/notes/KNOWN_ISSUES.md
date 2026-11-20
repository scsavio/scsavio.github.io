# Pendências e limitações conhecidas (atualizado pelo integrador após a onda 6)

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

## Resolvidas na onda 4 (revisão final do arquivo único)
- Fixação: curativo, gel e etiqueta só na etapa 9 (inclusive em saltos de etapa); enquadramento final no filme; marca
  "16 cm" derivada do cateter; agulha ≈60° com a pele (texto e 3D); tesoura, espiras, "vela" do filme corrigidas;
  campo estéril retirado para o curativo (sem piscar na animação) e religado ao voltar a etapas anteriores.
- Esquema SVG da fixação com o mesmo lado da âncora que o 3D (lateral-cranial); capturas/impressão com os mesmos
  filtros de rótulo do visor; IntersectionObserver não congela mais o visor.
- Seta de pressão do polegar legível como seta (ponta achatada, 60°); sítio de punção/saída na pele (agulha,
  dilatador, cateter), fora do destaque/fantasma do motor.
- Confluência VBC E → VCS em Y (sem "dedo pousado"), sem atravessar a pleura D; arco terminal da cefálica com raio
  ≈0,9 cm até a axilar; cabeça clavicular do ECM e ligamento costoclavicular fora do osso.
- Texto descritivo/atribuído (sem tom prescritivo) em todo o conteúdo; cabeçalho "Prevenção descrita" na tabela.

## Resolvidas nas ondas 5–6
- Fixação: a agulha só se move presa (repega assistida pela pinça, que prende o corpo exteriorizado); pontas em repouso
  sem dobra em "V"; pegada dérmica real nos pontos das asas; enquadramento das etapas 3 e 9; fio B não atravessa A
  ao deitar as pontas; instrumentos não se atravessam (mandíbula articulada); folha impressa com evidência e
  alternativas à sutura; ajuste de fonte das folhas em décimos exatos.
- Músculos: intercostais (6 espaços, 3 camadas) fora das costelas — secção da 1ª costela limpa no corte do cap. 08;
  origem clavicular do deltoide e inserção do trapézio encostadas no osso; esterno-hióideo × esternotireóideo sem
  sobreposição e fora da traqueia.

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
- Cap. 08: os rótulos "Músculo subclávio (em corte)" e "Clavícula (em corte)" usam as âncoras canônicas da parte
  lateral (removida pelo corte em x = 5,5); coincidem com a secção na câmera do capítulo, mas se afastam ao girar
  (declarado no texto da cena).
- Confluência VBC E → VCS: leve dobra de sombra no ângulo côncavo do Y em vistas oblíquas pela esquerda/baixo
  (nenhum capítulo usa).
- Seta do polegar: em vistas laterais livres fica oculta pelo próprio polegar.
- Fixação 3D (resíduos menores): na recarga entre as asas (etapa 8) o cabo da pinça atravessa por ~0,8 s o conector
  Luer/tampa da via distal; ao deitar as pontas (fim da etapa 3) o fio B encosta em si mesmo por instantes; só com
  a camada opcional do campo estéril ligada, a agulha gira ~26° nas mandíbulas durante a recarga e a pinça fica
  0,03 cm dentro do decalque de antissepsia na asa 1; abre-se uma só mandíbula do porta-agulha (simplificação); o
  porta-agulha sai e volta por esmaecimento na recarga; em 1280×720 o coto do nó final sai do quadro na etapa 8.
- Folha impressa da fixação: miniaturas com ≈30 mm de altura (rótulos ≈4 pt no papel); legíveis na tela.
- Músculos (resíduos ocultos): triângulos invertidos minúsculos nos vincos de contato (ligamento costoclavicular,
  cabeça clavicular do ECM, trapézio junto à acromioclavicular); esternotireóideo D ~0,3 cm atrás do manúbrio onde
  passa sob o esterno-hióideo (assimetria D/E discreta); intercostal E × plexo E acusa falso positivo de paridade nas
  varreduras automáticas (malha do plexo E possivelmente sem tampa).
- Óstio VCS → AD: nos cortes coronal/sagital que passam exatamente pela junção resta um septo fino com cintilação no
  plano da tampa plana da VCS (luz contínua; nenhum capítulo usa esse corte).

## Pendência editorial (para o autor)
- Cap. 13: o documento-base usa o termo “tarô”; o texto o interpreta como coxim/rolo de apoio sob o dorso. Confirmar o
  significado pretendido pelo autor.
