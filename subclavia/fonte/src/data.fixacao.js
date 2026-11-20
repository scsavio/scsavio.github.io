/* ==========================================================================
   data.fixacao.js — capítulo “Fixação em bailarina” (pt-BR).
   Carregado DEPOIS de src/data.js; acrescenta a window.ATLAS_DATA (contrato:
   notes/FIXACAO_CONTRACT.md) sem editar data.js:
     · capítulo 'fixacao' logo após 'cateter' (n renumerado em todos);
     · ATLAS_DATA.fixation (passo a passo do inset 'fixation', etapas 1–9);
     · glossário dos ids do módulo 3D 'fixation';
     · fontes novas numeradas em tempo de carga (maior n existente + 1…);
     · itens de checklist ao fim.
   Regras editoriais (CONTENT_SPEC.md): números e afirmações de evidência só com
   fonte verificada no PubMed nesta revisão (20/11/2026); o que não pôde ser
   verificado foi removido ou formulado qualitativamente, sem atribuição.
   Descrição de técnica de ensino, NÃO prescritiva.
   ========================================================================== */
(function () {
  'use strict';
  const D = window.ATLAS_DATA;
  if (!D || !Array.isArray(D.chapters)) return;                 // data.js ausente: nada a acrescentar
  if (D.chapters.some((c) => c && c.id === 'fixacao')) return;  // carga repetida: idempotente

  /* ---------------- Fontes novas (verificação: PubMed, 20/11/2026) ----------------
     Cada uma recebe número = maior n existente + 1, na ordem abaixo; o capítulo e o
     passo a passo referenciam pelo nome-chave (ref.x), resolvido em tempo de carga. */
  const PM = (pmid) => 'https://pubmed.ncbi.nlm.nih.gov/' + pmid + '/';
  const NEW_SOURCES = [
    ['ullman2015', 'Dressings and securement devices for central venous catheters (CVC)',
      'Ullman AJ, Cooke ML, Mitchell M, et al. Cochrane Database Syst Rev. 2015;(9):CD010367. PMID 26358142; PMCID PMC6457749; DOI 10.1002/14651858.CD010367.pub2. Resumo verificado (22 ECR, 7.436 participantes).', PM(26358142)],
    ['xu2024', 'The effectiveness of dressings and securement devices to prevent central venous catheter-associated complications: a systematic review and meta-analysis',
      'Xu H, Hyun A, Mihala G, et al. Int J Nurs Stud. 2024;149:104620. PMID 37879273; DOI 10.1016/j.ijnurstu.2023.104620. Resumo verificado (46 ECR, 10.054 participantes; atualização com métodos Cochrane).', PM(37879273)],
    ['yamamoto2002', 'Sutureless securement device reduces complications of peripherally inserted central venous catheters',
      'Yamamoto AJ, Solomon JA, Soulen MC, et al. J Vasc Interv Radiol. 2002;13(1):77–81. PMID 11788698; DOI 10.1016/s1051-0443(07)60012-8. Resumo verificado (ECR, 170 PICC: sutura × dispositivo adesivo sem sutura).', PM(11788698)],
    ['ogrady2011', 'Guidelines for the prevention of intravascular catheter-related infections (CDC/HICPAC)',
      'O’Grady NP, Alexander M, Burns LA, et al.; Healthcare Infection Control Practices Advisory Committee. Clin Infect Dis. 2011;52(9):e162–93. PMID 21460264; PMCID PMC3106269; DOI 10.1093/cid/cir257. Metadados verificados; o texto integral não pôde ser reacessado nesta revisão — leitura recomendada, sem recomendações extraídas.', PM(21460264)],
    ['whitney2012', 'Pullout-proofing external ventricular drains',
      'Whitney NL, Selden NR. J Neurosurg Pediatr. 2012;10(4):320–3. PMID 22861194; DOI 10.3171/2012.7.PEDS1280. Resumo verificado (sandália romana modificada em derivação ventricular externa; experiência de um cirurgião).', PM(22861194)],
    ['howes2015', 'The end for the “Roman Sandal”: an observational study of methods of securing chest drains in a deployed military setting',
      'Howes RJ, Calder A, Hollingsworth A, Jones A. J R Nav Med Serv. 2015;101(1):42–6. PMID 26292392. Resumo verificado (manequim, dreno de tórax 32F, 26 médicos).', PM(26292392)],
    ['fricke2026', 'Modified Johannesburg technique sets the standard — superior biomechanical stability in chest tube fixation',
      'Fricke JJ, Schöbel T, Meißner R, et al. Eur J Trauma Emerg Surg. 2026;52(1):27. PMID 41572069; PMCID PMC12827373; DOI 10.1007/s00068-025-03071-7. Resumo verificado (parede torácica suína, 360 testes).', PM(41572069)],
    ['wong2026', 'What is the best way to secure a chest drain? A scoping review',
      'Wong C, Wright J, Luke Siena F, et al. J Intensive Care Soc. 2026;27(2):198–212. PMID 41625516; PMCID PMC12854997; DOI 10.1177/17511437251412171. Resumo verificado (63 publicações; nove princípios de fixação).', PM(41625516)],
    ['alsherawi2023', 'A new simple and innovative technique for surgical drains fixation',
      'Alsherawi A, Al-Mohannadi FS, Ahmed MB. J Surg Case Rep. 2023;2023(12):rjad687. PMID 38163060; PMCID PMC10755090; DOI 10.1093/jscr/rjad687. Resumo verificado (nota técnica; cita afrouxamento e problemas de pele entre os limites da sandália romana).', PM(38163060)],
    ['rosin1989', 'Knot security of suture materials',
      'Rosin E, Robinson GM. Vet Surg. 1989;18(4):269–73. PMID 2505438; DOI 10.1111/j.1532-950x.1989.tb01083.x. Resumo verificado (teste in vitro com fios 2-0).', PM(2505438)],
    ['nelson2008', 'Making straight suture needles a little safer: a technique to keep fingers from harm’s way',
      'Nelson BP. J Emerg Med. 2008;34(2):195–7. PMID 18282537; DOI 10.1016/j.jemermed.2007.05.036. Resumo verificado (nota técnica).', PM(18282537)],
    ['kleidon2024', 'Securement to prevent noncuffed central venous catheter dislodgement in pediatrics: the SECURED superiority randomized clinical trial',
      'Kleidon TM, Schults J, Gibson V, et al. JAMA Pediatr. 2024;178(9):861–9. PMID 39008311; PMCID PMC11250368; DOI 10.1001/jamapediatrics.2024.2202. Resumo verificado (ECR pediátrico, 307 pacientes analisados).', PM(39008311)],
    ['tomeo2026', 'Subcutaneous anchored securement of centrally inserted central catheter in intensive care unit: a pilot study',
      'Tomeo F, Calamai I, Luchini M, et al. J Vasc Access. 2026;27(3):949–52. PMID 40963246; DOI 10.1177/11297298251369060. Resumo verificado (estudo observacional, 100 pacientes, 126 cateteres).', PM(40963246)],
    ['vinjirayer2004', 'Securing central venous catheters: a comparison of sutures with staples',
      'Vinjirayer A, Jefferson P, Ball DR. Emerg Med J. 2004;21(5):582–3. PMID 15333537; PMCID PMC1726413; DOI 10.1136/emj.2003.009860. Resumo verificado (ECR, 20 pacientes).', PM(15333537)]
  ];
  if (!Array.isArray(D.sources)) D.sources = [];
  let nMax = D.sources.reduce((m, s) => Math.max(m, +(s && s.n) || 0), 0);
  const ref = {};
  NEW_SOURCES.forEach(([key, title, detail, url]) => {
    const n = ++nMax;
    ref[key] = n;
    D.sources.push({ n, title, detail, url });
  });
  const ALL_REFS = NEW_SOURCES.map(([key]) => ref[key]);

  /* ---------------- Glossário (ids do módulo 3D 'fixation') ---------------- */
  const G = D.glossary || (D.glossary = {});
  const g = (id, name, desc, relevance) => { G[id] = { name, group: 'Instrumentos', desc, relevance }; };
  g('suture-ballerina', 'Fixação em bailarina (fio e nós)',
    'Entrelaçamento em X de um único fio monofilamentar: ponto de ancoragem na pele junto à saída e duas pontas que cruzam alternadamente por baixo e por cima do cateter, com um nó a cada cruzamento. Em inglês, <em>Roman sandal</em> ou <em>Chinese finger trap</em>.',
    'Aperta o cateter quando ele é puxado para fora; deve ficar firme sem deformá-lo. A conferência inclui a marca em cm na pele, refluxo e lavagem de todas as vias e ausência de dobra.');
  g('suture-anchor', 'Ponto de ancoragem na pele',
    'Ponto dérmico ao lado do cateter, a cerca de 0,5–1 cm da saída e fora do trajeto subcutâneo, fechado com nó cirúrgico e seminós; fica no meio do fio.',
    'Transmite à pele toda a força de tração: pegada dérmica firme e nó que aproxima sem isquemiar. Nunca sob o trajeto subcutâneo do cateter — a agulha pode perfurá-lo.');
  g('suture-wing', 'Pontos nas asas do canhão',
    'Um ponto por orifício das asas do canhão, amarrado sobre a asa, com o cateter em curva suave entre a bailarina e o canhão.',
    'Contêm a rotação e o deslizamento para dentro, que a bailarina pouco segura. Não devem afundar a asa rígida na pele (lesão por pressão).');
  g('needle-holder', 'Porta-agulha',
    'Pinça com cremalheira que prende a agulha de sutura e serve para os nós instrumentais.',
    'Agulha presa no terço posterior do corpo, perpendicular às mandíbulas, nunca sobre o engaste. Manipular a agulha só com instrumentos protege o operador.');
  g('suture-needle', 'Agulha curva de sutura (cortante)',
    'Agulha curva de ponta cortante, montada no fio monofilamentar não absorvível.',
    'Entra perpendicular à pele e percorre o arco pela pronossupinação do punho. Agulhas retas são de uso comum na fixação de cateteres, mas foram associadas a mais acidentes do que as curvas ou rombas (Nelson).');
  g('dressing-transparent', 'Curativo transparente semipermeável',
    'Filme estéril de poliuretano que cobre a saída, a bailarina e as asas e deixa o sítio à vista.',
    'Aplicado sobre pele limpa e seca, sem tensão. Troca se estiver úmido, solto ou sujo, e nos intervalos do protocolo do serviço.');
  g('chg-pad', 'Esponja ou gel com clorexidina',
    'Disco de espuma ou almofada de gel impregnados com gliconato de clorexidina, posicionados no sítio de saída, sob o curativo.',
    'Curativos com clorexidina reduziram a infecção de corrente sanguínea relacionada ao cateter por 1.000 pacientes-dia em relação ao poliuretano padrão (Ullman et al.). Uso conforme o protocolo do serviço.');

  /* ---------------- Passo a passo (inset 'fixation'; k = E.state.fixStep) ---------------- */
  D.fixation = {
    title: 'Fixação em “bailarina” — passo a passo',
    intro: '“Bailarina” é o nome usado no ensino brasileiro para o entrelaçamento conhecido em inglês como <em>Roman sandal</em> (sandália romana) ou <em>Chinese finger trap</em>: um ponto de ancoragem na pele junto à saída e as duas pontas longas do mesmo fio cruzando alternadamente por baixo e por cima do cateter, com um nó a cada cruzamento — como as fitas da sapatilha amarradas no tornozelo. As distâncias citadas são valores nominais de ensino, não medidas validadas. É uma descrição de ensino, não uma prescrição: as instruções do fabricante do cateter e o protocolo do serviço prevalecem e podem preferir fixação sem sutura.',
    sources: ALL_REFS,
    step0: {
      title: 'Sem fixação',
      text: 'Cateter posicionado, vias aspiradas, lavadas e fechadas, canhão apoiado e trecho externo livre, sem tensão nem dobra. Neste momento, qualquer tração no canhão se transmite direto à ponta.'
    },
    material: [
      'Campo estéril mantido desde a inserção, com a fenestra expondo a saída <em>e</em> a área das asas; luvas estéreis íntegras (troque-as se contaminadas). Descartador de perfurocortantes ao alcance.',
      'Porta-agulha pequeno, pinça de dissecção com dente e tesoura de fio: a agulha é manipulada só por instrumentos.',
      'Fio monofilamentar não absorvível (náilon/poliamida ou polipropileno). Calibre 2-0 ou 3-0 é o habitual em descrições de ensino; não há calibre validado para esta técnica — use o que o kit e o serviço padronizam. O monofilamento tem “memória” e pouco atrito: em teste in vitro, o náilon 2-0 precisou de quatro laçadas (contando a primeira) para um nó quadrado seguro, uma a mais que o polipropileno (Rosin & Robinson).',
      'Agulha curva cortante. Agulhas retas são de uso comum na fixação de cateteres, mas foram associadas a mais acidentes do que as curvas ou rombas (Nelson).',
      'Anestesia local: a infiltração da punção costuma cobrir a saída; complemente com um pequeno botão nos pontos de ancoragem e das asas se estiverem fora da área anestesiada.',
      'Gaze estéril, clorexidina alcoólica para limpar o sítio ao final, curativo transparente semipermeável e, se padronizado no serviço, esponja ou gel com clorexidina.',
      'Seringas com soro fisiológico para aspirar e lavar cada via; tampas ou clampes fechando as vias fora de uso.'
    ],
    steps: [
      {
        k: 1, title: 'Preparo e distribuição do fio',
        text: 'Com o cateter posicionado e as vias aspiradas, lavadas e fechadas, deixe o canhão apoiado e o trecho externo livre, sem tensão nem dobra. Leia e anote a marca em centímetros do cateter rente à pele: é a referência para reconhecer migração durante e depois da fixação. Monte a agulha e tire o fio da embalagem sem cortá-lo.',
        movement: 'Prenda a agulha com a ponta das mandíbulas do porta-agulha, no terço posterior do corpo (perto da junção com o terço médio), perpendicular às mandíbulas e com a ponta voltada para cima; trave a cremalheira no primeiro dente. A agulha nunca é segura com os dedos — ajuste a posição com a pinça.',
        cautions: [
          'Não corte o fio: todo o comprimento que sobrar após o ponto de ancoragem é o estoque dos três cruzamentos e do nó final.',
          'Nunca prenda a agulha sobre o engaste (ponto fraco: ela entorta ou se solta do fio).',
          'Vias fechadas durante toda a manipulação: sistema aberto ao ar é risco de embolia gasosa.',
          'Se a fenestra do campo não expõe a área das asas, reposicione-a antes de começar — não se sutura através do campo.'
        ],
        why: 'A bailarina consome muito fio e não admite emenda: planejar o comprimento antes do primeiro ponto evita refazer tudo. A marca em centímetros é o controle objetivo, à beira do leito, de que a fixação não deslocou o cateter.'
      },
      {
        k: 2, title: 'Ponto de ancoragem na pele',
        text: 'Escolha o ponto ao lado do cateter, a cerca de 0,5–1 cm da saída, do lado do canhão — fora do trajeto subcutâneo, que segue da saída para dentro. A agulha entra e sai da pele em arco, numa pegada dérmica, sem tocar o cateter. Puxe o fio até que as duas pontas fiquem de comprimento semelhante: o ponto fica no meio do fio.',
        movement: 'Faça contrapressão na pele com a pinça, ao lado do ponto de entrada (com o instrumento, não com o dedo). Apoie a ponta da agulha perpendicular à pele (90°) e avance girando o punho — da pronação para a supinação —, seguindo a curva da agulha, sem empurrá-la em linha reta. Quando a ponta sair, prenda o corpo exteriorizado da agulha (não a ponta) e complete o arco com o mesmo giro. Puxe o fio com tração paralela à pele.',
        cautions: [
          'Pegada nem superficial (a pele rasga quando a malha for tracionada) nem profunda (dor, sangramento e risco de atingir o cateter no subcutâneo).',
          'Nunca passe a agulha por baixo do trajeto subcutâneo do cateter: a ponta pode perfurá-lo.',
          'Perto o bastante da saída para que os cruzamentos comecem junto a ela; longe o bastante para que nó e fio não fiquem sobre o orifício.',
          'Ao soltar a agulha, deixe-a presa no porta-agulha e à vista, com a ponta voltada para longe das mãos.'
        ],
        why: 'O ponto de ancoragem é o único elo entre a malha e a pele: toda a força que tenta arrancar o cateter passa por ele. Uma pegada dérmica firme distribui essa força sem rasgar; o ponto no meio do fio garante duas “fitas” do mesmo comprimento.'
      },
      {
        k: 3, title: 'Nó de ancoragem',
        text: 'Dê um nó cirúrgico instrumental — primeira laçada com duas voltas — e complete com seminós alternados, assentando o nó sobre a pele sem estrangulá-la. As duas pontas continuam longas e de comprimento semelhante: serão as “fitas da sapatilha”.',
        movement: 'Porta-agulha na mão dominante, paralelo à pele, entre as duas pontas. A mão não dominante passa uma das pontas duas vezes ao redor das mandíbulas; o porta-agulha pega a outra ponta perto do ponto e a puxa através das voltas. Tracione as pontas em sentidos opostos, paralelas à pele e na linha do ponto, até o nó assentar. Cada seminó seguinte leva uma volta em sentido contrário à anterior, com as mãos trocando de lado ao tracionar, para formar um nó quadrado (plano), que não desliza.',
        cautions: [
          'Aproximar, não estrangular: a pele sob o nó não pode ficar pálida, enrugada ou repuxada — o sítio edemacia nas horas seguintes.',
          'O primeiro laço tende a afrouxar enquanto se prepara o seguinte: mantenha leve tração até travá-lo.',
          'Conte as laçadas: no teste in vitro com náilon 2-0, quatro (contando a primeira) foram necessárias para o nó não desatar (Rosin & Robinson).',
          'Não corte nenhuma ponta; se ficaram desiguais, a mais curta limitará a malha.'
        ],
        why: 'A dupla volta segura o primeiro laço sozinha enquanto se completa o nó; os seminós alternados travam o conjunto. Nó apertado demais causa isquemia, dor e um ponto que “corta” a pele — afrouxamento e problemas de pele estão entre os limites da sandália romana citados por Alsherawi et al.'
      },
      {
        k: 4, title: '1º cruzamento',
        text: 'Leve as duas pontas por baixo do cateter, rente à pele, cada uma para o lado oposto; traga-as para cima, cruze-as sobre o cateter a poucos milímetros do nó de ancoragem e dê um nó sobre o cateter (dupla volta + seminó).',
        movement: 'Para passar as pontas por baixo, levante o cateter só o necessário (1–2 mm), apoiado na ponta fechada da pinça ou entre os dedos enluvados — nunca o pince com a pinça com dente — e sem tracioná-lo; as pontas trocam de lado por baixo e voltam a cruzar por cima, formando um X. Durante o nó, apoie o dedo anular ou o mínimo da mão não dominante sobre o canhão — ou peça ao auxiliar que o segure — para que a tração não chegue à saída. Aperte puxando as pontas em sentidos opostos, para os lados do cateter e paralelas à pele, com a mesma força dos dois lados: a força resultante sobre o cateter deve ser nula.',
        cautions: [
          'Firme o bastante para que o laço não deslize quando empurrado com a pinça; sem marcar, achatar ou dobrar o cateter — o contorno continua redondo.',
          'Rente ao cateter: o cruzamento passa entre o cateter e a pele, sem laçar a pele junto.',
          'Primeiro laço junto à saída: fio solto entre o nó de ancoragem e o laço deixa o cateter se mover.',
          'Não envolva extensões nem clampes, e mantenha visível a marca em cm usada como referência.'
        ],
        why: 'Cada cruzamento é uma alça helicoidal presa à âncora. Quando o cateter é puxado para fora, as alças se alongam e se estreitam e apertam o cateter — o efeito da “armadilha chinesa de dedos”, que a revisão de escopo de Wong et al. classifica como efeito Poisson. O nó a cada cruzamento impede que uma alça frouxa deslize sobre a seguinte (“telescopagem”), como descrevem Whitney & Selden.'
      },
      {
        k: 5, title: '2º cruzamento',
        text: 'Repita, alternando: as pontas voltam a passar por baixo do cateter, trocando de lado, cruzam por cima cerca de 0,4–0,6 cm adiante, em direção ao canhão, e recebem novo nó.',
        movement: 'Mesma sequência — elevar minimamente, passar por baixo, cruzar por cima, nó instrumental com tração simétrica e paralela à pele, canhão estabilizado. Antes de apertar, ajuste o X para que fique alinhado com o eixo do cateter e com o mesmo espaçamento do anterior.',
        cautions: [
          'Tensão progressiva e uniforme: o 2º laço com a mesma firmeza do 1º — um laço mais frouxo vira o ponto fraco da malha.',
          'Cruzamentos regulares e próximos: muito espaçados, perdem contato com o cateter e deixam a malha deslizar.',
          'Confira o fio: deve sobrar comprimento semelhante nas duas pontas para o 3º cruzamento e o nó final.',
          'Não deixe o cateter girar nem dobrar enquanto aperta.'
        ],
        why: 'A alternância por baixo e por cima transforma voltas isoladas numa malha contínua: a tração passa de um laço ao outro e se distribui ao longo do segmento, em vez de se concentrar num único ponto do cateter.'
      },
      {
        k: 6, title: '3º cruzamento e nó final',
        text: 'Faça o terceiro entrelaçamento, igual aos anteriores, e o nó de segurança sobre o cateter, com vários seminós alternados.',
        movement: 'Após o 3º cruzamento, dê a dupla volta e complete com seminós alternados, invertendo o sentido a cada laçada e assentando cada um com tração simétrica e paralela à pele. Conte as laçadas: o nó final de monofilamento é o que mais tende a desatar.',
        cautions: [
          'Nó final sobre o cateter, antes do canhão — não sobre a transição cateter–canhão, onde a dobra é mais provável.',
          'Três cruzamentos firmes valem mais que muitos frouxos: acrescentar voltas não compensa tensão irregular.',
          'Se o fio acabou antes do nó final, não emende: refaça a fixação.'
        ],
        why: 'Fio íntegro e nós bem assentados sustentam a montagem. Em testes de drenos de tórax em parede torácica suína (três técnicas), a falha mais comum foi a ruptura do fio (78,9%), seguida da ruptura do tubo (11,1%), do afrouxamento do nó (8,1%) e da falha da pele (1,9%) (Fricke et al.).'
      },
      {
        k: 7, title: 'Corte e conferência',
        text: 'Corte as pontas deixando cerca de 0,5–1 cm. Confira: a marca em cm é a mesma anotada; uma tração suave do cateter não o desloca nem faz o laço deslizar; todas as vias aspiram (refluxo) e lavam sem resistência; não há dobra na saída nem entre a bailarina e o canhão.',
        movement: 'Corte sob visão direta, com a ponta da tesoura afastada do cateter e as lâminas paralelas à pele. Para testar, segure o canhão e aplique tração leve e breve no sentido do canhão — é teste de fixação, não de força. Aspire e lave cada via separadamente e feche-as.',
        cautions: [
          'Pontas curtas demais deixam o monofilamento desatar; longas demais irritam a pele e se prendem no curativo.',
          'A tesoura nunca fecha perto do corpo do cateter: cortá-lo acidentalmente é erro grave.',
          'Resistência para lavar uma via, perda de refluxo ou cateter achatado sob o laço indicam fio apertado demais — refaça o laço.',
          'Se a marca em cm mudou, o cateter migrou durante a fixação: a posição da ponta precisa ser reavaliada conforme o protocolo antes do uso.'
        ],
        why: 'A fixação faz parte do procedimento, não é acabamento: um laço que oclui uma via ou desloca o cateter anula a inserção. A conferência imediata separa problema de fixação de problema de posição.'
      },
      {
        k: 8, title: 'Pontos nas asas do canhão',
        text: 'Ancore o canhão com um ponto em cada orifício das asas (dois pontos), com o cateter entre a bailarina e o canhão em curva suave, sem dobra nem tensão.',
        movement: 'Posicione o canhão antes do ponto, de modo que as extensões fiquem orientadas sem tracionar o sítio. Passe a agulha pelo orifício da asa e faça a pegada dérmica logo abaixo dele — entrada perpendicular e arco por pronossupinação, como na ancoragem —; amarre sobre a asa com nó instrumental (dupla volta + seminós alternados).',
        cautions: [
          'O nó aproxima a asa da pele sem afundá-la: asa rígida comprimida contra a pele causa lesão por pressão.',
          'Curva suave entre a bailarina e o canhão: nem esticado (traciona o sítio), nem em alça apertada (dobra).',
          'Clampes e extensões ficam fora dos pontos.',
          'Se o kit trouxer fixador próprio para o corpo do cateter, use-o conforme a instrução do fabricante.'
        ],
        why: 'A bailarina resiste bem à tração para fora; o deslizamento para dentro e a rotação do canhão são contidos pelos pontos das asas e pelo curativo. As duas ancoragens se complementam.'
      },
      {
        k: 9, title: 'Curativo e registro',
        text: 'Limpe sangue e resíduos ao redor com clorexidina alcoólica e deixe secar. Se padronizado, posicione a esponja ou o gel com clorexidina no sítio de saída. Cubra saída, bailarina e asas com curativo transparente semipermeável; identifique a data. Registre no prontuário o tipo de cateter, o comprimento, a marca em cm na pele e o tipo de fixação.',
        movement: 'Aplique o filme sem esticá-lo, do centro para as bordas, moldando-o ao redor do cateter e do canhão; as extensões saem pela borda.',
        cautions: [
          'Antisséptico seco antes do curativo: pele úmida prejudica a aderência.',
          'O curativo deixa o sítio visível e selado, sem dobras que formem canais.',
          'Não envolva o cateter com fita adesiva; fita não estéril não substitui o curativo estéril sobre o sítio.'
        ],
        why: 'Na revisão Cochrane de Ullman et al., curativos impregnados com medicamento (clorexidina ou prata) reduziram a infecção de corrente sanguínea relacionada ao cateter em relação aos demais (RR 0,60; alta qualidade), e os de clorexidina, em relação ao poliuretano padrão, reduziram a frequência por 1.000 pacientes-dia (RR 0,51; moderada); a atualização de Xu et al. (2024) manteve a direção do efeito, com certeza baixa a moderada.'
      }
    ],
    errors: [
      'Cortar ou encurtar as pontas após o nó de ancoragem — falta fio para os cruzamentos e o nó final.',
      'Pontas de comprimentos muito diferentes: a curta limita a malha e obriga a tracionar a longa contra o cateter.',
      'Laços frouxos ou muito espaçados: a malha desliza e o cateter migra. Num manequim com dreno de tórax, 5 das 15 sandálias romanas feitas por médicos ficaram inseguras, enquanto as outras técnicas não falharam (Howes et al.).',
      'Fio apertado demais: achata, oclui ou dobra o cateter e pode lesar a parede.',
      'Nó de ancoragem que estrangula a pele, ou pegada tão superficial que rasga.',
      'Laçar pele, extensões ou clampes junto com o cateter; deixar fio sobre o orifício de saída.',
      'Apertar os nós sem estabilizar o canhão, tracionando o cateter — a marca em cm muda.',
      'Prender a agulha sobre o engaste ou manipulá-la com os dedos; cortar o fio com a tesoura encostada no cateter.'
    ],
    complications: [
      'Deslocamento e migração (parciais ou totais): suspeitar quando a marca em cm muda. A frequência pode ser alta — num ECR pediátrico, houve deslocamento em 22,7% dos cateteres com dispositivo adesivo sem sutura, contra 5,2% com ancoragem subcutânea (Kleidon et al.).',
      'Oclusão ou dobra por fio apertado, ou por ângulo entre a bailarina e o canhão.',
      'Dano ao cateter: estrangulamento pelo fio, corte pela tesoura, perfuração pela agulha de sutura.',
      'Lesão de pele: isquemia e necrose sob o nó, maceração sob o curativo, ponto que “corta” a pele.',
      'Infecção do sítio: o ponto é uma ferida e uma porta de entrada adicional, e o fio dificulta a antissepsia ao redor. Num ECR com PICC, houve menos infecção de corrente sanguínea com dispositivo sem sutura do que com sutura (2 × 10 casos), sem diferença significativa no total de complicações (Yamamoto et al.).',
      'Acidente perfurocortante do operador: no mesmo ECR, houve uma lesão por agulha durante a sutura de um PICC (Yamamoto et al.).'
    ],
    alternatives: [
      '<strong>Dispositivo adesivo sem sutura</strong>: na revisão Cochrane de Ullman et al. (22 ECR, 7.436 participantes), a metanálise em rede classificou-o como provavelmente o mais eficaz para reduzir infecção de corrente sanguínea relacionada ao cateter — evidência de baixa qualidade.',
      '<strong>Ancoragem subcutânea</strong> (âncoras flexíveis sob a pele, sem ponto): num ECR pediátrico com cateteres sem cuff, reduziu o deslocamento em relação ao dispositivo adesivo (5,2% × 22,7%; RR 0,23) (Kleidon et al.); numa série observacional de UTI de adultos, 126 cateteres centrais tiveram 4% de deslocamento (Tomeo et al.; os autores afirmam que suturas devem ser evitadas e apresentam a ancoragem subcutânea como alinhada às diretrizes italianas GAVeCeLT de 2024).',
      '<strong>Adesivo tecidual</strong> (cianoacrilato): prolongou a durabilidade do curativo (cerca de 43 h a mais que curativos integrados ou dispositivos sem sutura), mas, no lugar da sutura, teve mais falha de fixação (RR 9,33; 2 estudos, 103 participantes) e mais irritação de pele do que os dispositivos sem sutura (Xu et al.).',
      '<strong>Grampos de pele</strong>: num ECR com 20 pacientes, a fixação foi mais rápida, mas 3 de 10 cateteres grampeados saíram acidentalmente nos três primeiros dias; os autores não os recomendaram no lugar da sutura (Vinjirayer et al.).',
      '<strong>Só asas e fixador do kit</strong>: prática comum; não localizamos estudo que a compare diretamente com a bailarina em cateter venoso central. A instrução do fabricante e o protocolo local orientam a escolha.',
      '<strong>Diretrizes</strong>: a diretriz CDC/HICPAC de 2011 (O’Grady et al.) trata de curativos e fixação de cateteres intravasculares; seu texto integral não pôde ser reacessado nesta revisão, por isso suas recomendações não são reproduzidas aqui — consulte a versão vigente.',
      '<strong>Sobre a evidência da própria bailarina</strong>: vem de drenos. Em parede torácica suína, a sandália romana foi mais resistente que a sutura em bolsa e menos que a técnica de Johannesburg modificada (Fricke et al.); uma revisão de escopo não identificou padrão-ouro para drenos de tórax (Wong et al.). Não localizamos, no PubMed, ensaio da bailarina em cateter venoso central.'
    ],
    afterCare: [
      'Inspecionar diariamente, através do curativo transparente: sinais flogísticos, secreção, fio frouxo ou cortando a pele, dobra, marca em cm.',
      'Marca em cm diferente da registrada sugere migração: avaliar a posição da ponta conforme o protocolo antes de usar o cateter.',
      'Trocar o curativo se úmido, solto ou sujo e nos intervalos do protocolo, segurando o canhão e removendo o filme das bordas em direção à saída, para não tracionar o cateter.',
      'Fio frouxo ou cortando a pele não se “reaperta” sobre um cateter em uso: refixação, se indicada, com antissepsia e técnica estéril — ou troca da estratégia de fixação.',
      'Na retirada do cateter: cortar os pontos sob visão, longe do corpo do cateter, remover todos os fragmentos de fio e conferir se o cateter saiu íntegro.'
    ]
  };

  /* ---------------- Capítulo ---------------- */
  const chapter = {
    id: 'fixacao', n: '00', short: 'Fixação',
    title: 'Fixação em bailarina: ancorar sem estrangular',
    focus: 'Um ponto de ancoragem no meio do fio e duas pontas longas que cruzam por baixo e por cima do cateter, com um nó a cada cruzamento: firme para não deslizar, sem deformar o cateter.',
    body: [
      '“Bailarina” é a denominação usada no ensino brasileiro para o entrelaçamento conhecido em inglês como <em>Roman sandal</em> (sandália romana) ou <em>Chinese finger trap</em>: um ponto de ancoragem na pele, junto à saída, e as duas pontas do mesmo fio cruzando alternadamente por baixo e por cima do cateter, com um nó a cada cruzamento — como as fitas da sapatilha amarradas no tornozelo. Presa à âncora, a malha se alonga e se estreita quando o cateter é puxado para fora, e o aperta; a revisão de escopo de Wong et al. classifica esse mecanismo como “efeito Poisson”. Pela mesma mecânica, a bailarina pouco resiste ao deslizamento para dentro — papel dos pontos nas asas e do curativo.',
      'A qualidade depende de três coisas. <strong>Distribuição do fio</strong>: o ponto de ancoragem fica no meio do fio, nada se corta até o fim, as pontas têm comprimento semelhante e os cruzamentos são regulares e próximos da saída. <strong>Tensão</strong>: progressiva e uniforme — o laço não desliza quando empurrado, mas o cateter continua redondo, sem marca, achatamento ou dobra; o nó de ancoragem aproxima sem isquemiar a pele. <strong>Movimentos</strong>: agulha presa no terço posterior, entrada perpendicular e arco por pronossupinação; nó instrumental com dupla volta e seminós alternados, apertado em sentidos opostos e paralelo à pele, com o canhão estabilizado para que nada se transmita ao sítio. A marca em centímetros na pele, anotada antes e conferida depois, mostra se a fixação deslocou o cateter.',
      'Evidência: a sandália romana foi estudada sobretudo em drenos. Num manequim com dreno de tórax, 5 das 15 sandálias feitas por médicos ficaram inseguras, enquanto as outras técnicas não falharam (Howes et al.); em parede torácica suína, foi mais resistente que a sutura em bolsa e menos que a técnica de Johannesburg modificada (Fricke et al.); em derivação ventricular externa, Whitney & Selden dão vários nós após cada volta para evitar “telescopagem”, afrouxamento e saída do dreno (série de um cirurgião, sem grupo controle). Não localizamos ensaio da bailarina em cateter venoso central. Em cateteres centrais, a revisão Cochrane de Ullman et al. (22 ECR) classificou os dispositivos sem sutura como provavelmente os mais eficazes contra infecção de corrente sanguínea (evidência de baixa qualidade); num ECR com PICC, houve menos infecção com dispositivo sem sutura do que com sutura (2 × 10 casos; Yamamoto et al.).',
      'O ponto é uma ferida e uma porta de entrada, e suturar expõe o operador a acidente perfurocortante. Por isso há grupos que defendem evitar suturas e usar ancoragem subcutânea (Tomeo et al.), e as instruções do fabricante do cateter e o protocolo do serviço prevalecem sobre a técnica aqui descrita. Quando a bailarina for a opção, ela se faz com o mesmo rigor estéril da inserção e é conferida antes do uso: todas as vias aspiram e lavam, não há dobra e uma tração suave não desloca o cateter.'
    ],
    keyPoints: [
      'Ponto de ancoragem no meio do fio: duas pontas longas e de comprimento semelhante; nada se corta até o nó final.',
      'Cada cruzamento: por baixo do cateter → cruza por cima → nó; regular, próximo da saída, firme sem achatar.',
      'Nó instrumental (dupla volta + seminós alternados), apertado em sentidos opostos e paralelo à pele, com o canhão estabilizado.',
      'Conferir: marca em cm inalterada, todas as vias aspiram e lavam, sem dobra, tração suave não desloca; depois, pontos nas asas e curativo transparente.',
      'A bailarina segura contra a tração para fora; a evidência vem de drenos, e dispositivos sem sutura e ancoragem subcutânea são alternativas estudadas.'
    ],
    pitfalls: [
      'Cortar as pontas após a ancoragem ou deixá-las desiguais — falta fio para a malha.',
      'Laço frouxo (desliza e o cateter migra) ou apertado demais (achata, oclui ou lesa o cateter).',
      'Nó que isquemia a pele, fio sobre o orifício de saída, ou pele, extensões e clampes laçados junto.'
    ],
    detail: 'A sequência 3D é esquemática: o fio está engrossado para leitura, as laçadas de cada nó estão resumidas e não se simulam atrito, tensão nem deformação de pele e cateter; o espaçamento dos cruzamentos é nominal. O trecho externo do cateter é curto e a forma do canhão e das asas varia entre kits. O campo estéril foi omitido para não encobrir as asas — na prática, a fixação é feita com o campo mantido.',
    sources: ALL_REFS.slice(),
    quiz: {
      q: 'Ao conferir uma bailarina recém-feita, qual achado indica fio apertado demais e exige refazer o laço?',
      options: [
        'Refluxo de sangue e lavagem livres em todas as vias',
        'Marca em centímetros na pele igual à anotada antes da fixação',
        'Cateter achatado sob o laço e resistência para lavar uma das vias',
        'Laço que não desliza ao longo do cateter sob tração suave'
      ],
      answer: 2,
      explain: 'Achatamento e resistência à lavagem indicam que o fio estrangula o cateter, com risco de oclusão e de dano à parede. As outras três situações são justamente o que se espera de uma fixação adequada: vias pérvias, marca inalterada e laço que não desliza.'
    },
    scene: {
      // close-up do sítio de saída (~[10.2,−0.35,2.5]) ao canhão (~[12.2,−3.0,3.2]); se o módulo 3D
      // expuser api.focusView, a UI pode preferi-la a estes valores numéricos equivalentes
      view: { target: [11.4, -2.0, 3.0], radius: 12.5, az: -0.3, el: 0.42 },
      layers: ['skin', 'instrument', 'aids'],
      ghost: null,
      state: { phase: 6, handPose: 1, breath: 0, rollMode: 'none', wireMal: false, showPlanes: false, fixStep: 9 },
      clip: null,
      labels: [
        ['fixExit', 'Saída do cateter na pele'],
        ['fixAnchorKnot', 'Nó de ancoragem'],
        ['fixCross1', '1º cruzamento'],
        ['fixFinalKnot', '3º cruzamento e nó final'],
        ['fixWingStitchA', 'Pontos nas asas'],
        ['fixDressing', 'Curativo transparente']
      ],
      highlight: 'suture-ballerina',
      anim: 'fix'
    },
    inset: 'fixation'
  };

  /* Inserção logo após 'cateter' (ou ao fim, se ele não existir) e renumeração 01…NN. */
  const iCat = D.chapters.findIndex((c) => c && c.id === 'cateter');
  D.chapters.splice(iCat >= 0 ? iCat + 1 : D.chapters.length, 0, chapter);
  D.chapters.forEach((c, i) => {
    c.n = String(i + 1).padStart(2, '0');
    // fixStep explícito nos demais capítulos: evita que a bailarina (fixStep 9) "vaze" para outra cena com fase 6
    if (c !== chapter && c.scene) c.scene.state = Object.assign({}, c.scene.state || {}, { fixStep: 0 });
  });

  /* ---------------- Checklist do preceptor (ao fim) ---------------- */
  if (!Array.isArray(D.checklist)) D.checklist = [];
  D.checklist.push(
    'Fixa sem tracionar o cateter: anota a marca em cm antes e confere depois; ancora com ponto dérmico fora do trajeto subcutâneo, sem isquemiar a pele, e mantém as duas pontas longas e de comprimento semelhante.',
    'Executa a bailarina com cruzamentos regulares (por baixo → por cima → nó) próximos à saída, firmes sem deformar o cateter, sem laçar pele, extensões ou clampes; manipula a agulha só com instrumentos e descarta-a com segurança.',
    'Confere a fixação (tração suave, refluxo e lavagem de todas as vias, ausência de dobra), fixa as asas, aplica curativo transparente e registra marca em cm e tipo de fixação.',
    'Discute alternativas à sutura (dispositivo adesivo, ancoragem subcutânea) e segue a instrução do fabricante e o protocolo do serviço.'
  );
})();
