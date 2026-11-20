/* data.sample.js — AMOSTRA para testar a interface antes de src/data.js existir.
   NÃO é carregado pelo index.html (somente tools/uishot.js --sample o injeta).
   Conteúdo resumido a partir do original; não usar como fonte. */
window.ATLAS_DATA = {
  meta: {
    title: 'Punção da subclávia direita',
    subtitle: 'Anatomia em camadas · marcos de superfície · mão esquerda · planos da agulha · pleura e respiração',
    version: '2.0',
    reviewDate: '19/11/2026',
    disclaimer: 'Modelo 3D didático e sintético. Sem escala clínica e sem medidas de um paciente.',
    basedOn: 'Adaptado do documento-base “Punção da subclávia direita — guia técnico”.',
    modelNote: 'Geometria procedural criada para este atlas, sem segmentação de exames. Algumas espessuras foram ampliadas para leitura.'
  },
  chapters: [
    {
      id: 'marcos', n: '01', short: 'Marcos',
      title: 'Marcos de superfície: o que se palpa e o que não se vê',
      focus: 'Marcos externos orientam a direção; não localizam a ponta da agulha nem a veia.',
      body: [
        'Na vista anterior, o lado <strong>direito do paciente</strong> aparece à esquerda da tela. A incisura jugular, a clavícula e sua curvatura em “S” e a junção dos terços medial e médio são as referências mais usadas na abordagem infraclavicular.',
        'Lateralmente, o sulco deltopeitoral leva ao processo coracoide, palpável sob a borda do deltoide. Medialmente, o ângulo esternal marca o nível da segunda cartilagem costal.',
        'Todas essas referências são <em>superficiais</em>: a profundidade e a relação da veia com a pleura variam entre pacientes e com a posição do ombro.'
      ],
      keyPoints: [
        'Incisura jugular: referência mediana para a direção no plano frontal.',
        'Junção dos terços medial e médio da clavícula: região de referência, não coordenada exata.',
        'Sulco deltopeitoral e coracoide delimitam o limite lateral habitual.'
      ],
      pitfalls: [
        'Confundir a curvatura lateral da clavícula com a junção dos terços.',
        'Tomar a pele deprimida pelo polegar como medida de profundidade.'
      ],
      detail: 'Pele, subcutâneo e músculos estão representados com espessuras ilustrativas. Use “Músculos translúcidos” para ver a relação com a clavícula.',
      sources: [1, 3],
      quiz: {
        q: 'Qual afirmação descreve melhor o papel da incisura jugular na abordagem infraclavicular por marcos?',
        options: ['Indica a profundidade da veia', 'Serve de referência de direção no plano frontal', 'Marca o ponto de entrada na pele', 'Garante que a ponta permaneça anterior à pleura'],
        answer: 1,
        explain: 'A incisura é um marco externo de direção. Ela não mede profundidade nem protege a pleura.'
      },
      scene: {
        view: 'front',
        layers: ['skin', 'bones', 'muscle', 'vein', 'artery', 'aids'],
        ghost: { skin: 0.35 },
        state: { phase: 0, handPose: 1, breath: 0, rollMode: 'none', wireMal: false, showPlanes: false },
        clip: null,
        labels: [['notch', 'Incisura jugular'], ['clavicleMidR', 'Junção dos terços'], ['sternalAngle', 'Ângulo esternal'], ['coracoidR', 'Processo coracoide'], ['scJointR', 'Art. esternoclavicular']],
        highlight: null,
        anim: null
      },
      inset: 'planes'
    },
    {
      id: 'espaco', n: '02', short: 'Espaço costoclav.',
      title: 'O espaço costoclavicular em camadas',
      focus: 'A veia está próxima da pleura — não existe um túnel vazio e uniforme sob a clavícula.',
      body: [
        'A veia axilar torna-se subclávia na borda lateral da primeira costela; segue profunda à clavícula e anterior ao escaleno anterior. A artéria passa posterior a esse músculo, com o plexo braquial posterossuperior.',
        'O músculo subclávio ocupa parte do espaço sob a clavícula. A primeira costela pode estar interposta entre o trajeto e a pleura em determinados pontos; ela não constitui uma barreira contínua.',
        'A veia se une à jugular interna atrás da articulação esternoclavicular. A cúpula pleural alcança a raiz do pescoço: “abaixo da clavícula” não significa “fora do pulmão”.'
      ],
      keyPoints: [
        'Veia anterior ao escaleno anterior; artéria e plexo posteriores a ele.',
        'Subclávio acima e anterior à veia; primeira costela abaixo.',
        'Cúpula pleural posterior aos vasos subclávios.',
        'Confluência com a VJI atrás da articulação esternoclavicular.'
      ],
      pitfalls: ['Imaginar a primeira costela como escudo contínuo contra a pleura.'],
      detail: 'O corte parassagital mostra as relações no plano da agulha. Ajuste a posição do corte para ver como a costela deixa de se interpor medialmente.',
      sources: [1, 2],
      quiz: {
        q: 'Qual estrutura separa a veia subclávia da artéria subclávia?',
        options: ['Músculo subclávio', 'Escaleno anterior', 'Primeira costela', 'Ligamento costoclavicular'],
        answer: 1,
        explain: 'O escaleno anterior passa entre os dois vasos: a veia anterior a ele, a artéria e o plexo posteriores.'
      },
      scene: {
        view: { target: [7, 0, -1], radius: 30, az: -1.57, el: 0.05 },
        layers: ['bones', 'muscle', 'vein', 'artery', 'nerve', 'lung', 'pleura'],
        ghost: null,
        state: { phase: 0, handPose: 1, breath: 0, rollMode: 'none', wireMal: false, showPlanes: false },
        clip: { normal: [-1, 0, 0], point: [7, 0, 0], label: 'Corte parassagital no trajeto da agulha' },
        labels: [['clavicleR', 'Clavícula'], ['firstRibR', '1ª costela'], ['scvR', 'Veia subclávia'], ['scaR', 'Artéria subclávia'], ['cupulaR', 'Cúpula pleural'], ['subclaviusR', 'M. subclávio']],
        highlight: 'scv-R',
        anim: null
      },
      inset: 'layers'
    },
    {
      id: 'mao', n: '03', short: 'Mão esquerda',
      title: 'Mão esquerda: dois marcos, funções distintas',
      focus: 'O indicador marca a referência esternal; o polegar apoia a pele infraclavicular — nenhum dos dois localiza a ponta.',
      body: [
        'O indicador repousa na incisura jugular como referência de direção. O polegar apoia a pele logo abaixo da clavícula, perto da junção dos terços, e os demais dedos ficam flexionados, fora da trajetória.',
        'O apoio do polegar deprime a pele, mas não mede a distância até a veia. A animação mostra a preparação e o apoio final; ela não representa força nem profundidade.'
      ],
      keyPoints: ['Indicador: referência externa (incisura).', 'Polegar: apoio infraclavicular, sem alavanca.', 'Demais dedos fora do trajeto.'],
      pitfalls: [],
      detail: 'A mão é uma malha articulada (generic-hand, MIT). Pose e contatos foram ajustados para este atlas.',
      sources: [3, 5],
      quiz: {
        q: 'Qual a função do polegar esquerdo na técnica por marcos?',
        options: ['Medir a profundidade da veia', 'Apoiar a pele infraclavicular', 'Empurrar a agulha sob a clavícula', 'Comprimir a artéria'],
        answer: 1,
        explain: 'O polegar apoia a pele e ajuda a manter a referência; não deve servir de alavanca nem de medida de profundidade.'
      },
      scene: {
        view: 'hand',
        layers: ['skin', 'bones', 'hand', 'instrument', 'drape', 'aids'],
        ghost: null,
        state: { phase: 1, handPose: 0, breath: 0, rollMode: 'none', wireMal: false, showPlanes: true },
        clip: null,
        labels: [['indexTip', 'Indicador'], ['thumbTip', 'Polegar'], ['notch', 'Incisura jugular'], ['entry', 'Entrada (ilustrativa)']],
        highlight: null,
        anim: 'hand'
      },
      inset: 'usg'
    }
  ],
  glossary: {
    'clavicle-R': { name: 'Clavícula direita', group: 'Ossos', desc: 'Osso em “S” entre o manúbrio e o acrômio.', relevance: 'A veia passa sob o terço medial; a clavícula produz sombra acústica no ultrassom.' },
    'manubrium': { name: 'Manúbrio do esterno', group: 'Ossos', desc: 'Parte superior do esterno; sua borda superior forma a incisura jugular.', relevance: 'Referência mediana para a direção.' },
    'rib-1-R': { name: '1ª costela direita', group: 'Ossos', desc: 'Costela curta e larga; a veia cruza sua face superior.', relevance: 'Interpõe-se apenas em parte do trajeto; não é escudo contínuo.' },
    'scv-R': { name: 'Veia subclávia direita', group: 'Veias', desc: 'Continua a veia axilar a partir da borda lateral da 1ª costela.', relevance: 'Alvo da punção; anterior ao escaleno anterior.' },
    'sca-R': { name: 'Artéria subclávia direita', group: 'Artérias', desc: 'Origina-se do tronco braquiocefálico.', relevance: 'Posterior ao escaleno; punção arterial é difícil de comprimir sob a clavícula.' },
    'pleura-R': { name: 'Pleura direita (cúpula)', group: 'Pulmões e pleura', desc: 'A cúpula alcança a raiz do pescoço.', relevance: 'Pneumotórax é a complicação mecânica típica do acesso subclávio.' }
  },
  sources: [
    { n: 1, title: 'Anatomia da veia subclávia', detail: 'NCBI Bookshelf / StatPearls', url: 'https://www.ncbi.nlm.nih.gov/books/NBK532885/' },
    { n: 2, title: 'Anatomic considerations for central venous cannulation', detail: 'Revisão anatômica (PMC3270925)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3270925/' },
    { n: 3, title: 'How to do infraclavicular subclavian vein cannulation — landmark-guided', detail: 'MSD Manual Professional', url: 'https://www.msdmanuals.com/professional/critical-care-medicine/how-to-do-central-vascular-procedures/how-to-do-infraclavicular-subclavian-vein-cannulation-landmark-guided' },
    { n: 4, title: 'The effect of full expiration on the position and size of the subclavian vein', detail: 'Lim et al., Anesth Analg, 2013. PMID 22763901', url: 'https://pubmed.ncbi.nlm.nih.gov/22763901/' },
    { n: 5, title: 'Central venous catheterization — subclavian vein', detail: 'Braner et al., NEJM, 2007. DOI 10.1056/NEJMvcm074357', url: 'https://doi.org/10.1056/NEJMvcm074357' }
  ],
  measurements: [
    { label: 'Distância clavícula–veia (exemplo)', value: 'varia com a posição do ombro', note: 'Medida em estudo de imagem; não é profundidade de agulha.', source: 4 },
    { label: 'Diâmetro da veia na expiração completa (exemplo)', value: 'maior que na inspiração', note: 'Efeito modesto; não abre margem pleural segura.', source: [4] }
  ],
  complications: [
    { name: 'Pneumotórax', structure: 'pleura-R', mechanism: 'Ponta ultrapassa o plano venoso e atinge a cúpula pleural.', recognition: 'Ar aspirado, dispneia, dor torácica; confirmar por imagem.', prevention: 'Não aprofundar sem refluxo; recuar antes de redirecionar.', source: 3 },
    { name: 'Punção arterial', structure: 'sca-R', mechanism: 'Trajeto posterior/cranial ao alvo, atrás do escaleno.', recognition: 'Sangue pulsátil e vermelho-vivo (não confiável isoladamente).', prevention: 'Confirmar posição venosa antes de dilatar.', source: [2, 3] },
    { name: 'Fio-guia para a jugular interna', structure: 'ijv-R', mechanism: 'Fio segue cranialmente na confluência.', recognition: 'Imagem de controle.', prevention: 'Avançar sem força; checar posição.', source: 5 }
  ],
  layersTable: [
    { depth: 1, tissue: 'Pele', note: 'Derme espessa na região infraclavicular.' },
    { depth: 2, tissue: 'Tecido subcutâneo', note: 'Espessura muito variável.' },
    { depth: 3, tissue: 'Músculo peitoral maior (parte clavicular)', note: 'Fibras oblíquas.' },
    { depth: 4, tissue: 'Fáscia clavipeitoral e músculo subclávio', note: 'Logo abaixo da clavícula.' },
    { depth: 5, tissue: 'Parede da veia subclávia', note: 'Posterior ao subclávio, sobre a 1ª costela.' }
  ],
  checklist: [
    'Identifica incisura jugular, clavícula e junção dos terços.',
    'Distingue direção (plano frontal) de inclinação (plano sagital).',
    'Descreve a conduta diante de contato ósseo: recuar antes de redirecionar.',
    'Confirma posição venosa antes de dilatar.',
    'Reconhece sinais de complicação e interrompe o procedimento.'
  ],
  usg: {
    caption: 'Janela infraclavicular, eixo curto: a veia axilar é compressível; a artéria, pulsátil e menos compressível. A pleura aparece como linha hiperecoica profunda.',
    labels: [
      { key: 'skin', text: 'Pele e subcutâneo' }, { key: 'pecMajor', text: 'Peitoral maior' }, { key: 'pecMinor', text: 'Peitoral menor' },
      { key: 'vein', text: 'Veia axilar' }, { key: 'artery', text: 'Artéria axilar' }, { key: 'pleura', text: 'Linha pleural' }, { key: 'rib', text: 'Costela com sombra' }
    ]
  },
  prancha: {
    title: 'Mão esquerda: anatomia e apoio',
    caption: 'Indicador na incisura jugular; polegar em apoio infraclavicular; demais dedos flexionados.',
    notes: ['Ilustração sintética; não mede força nem profundidade clínica.'],
    annotations: [
      { n: 1, text: 'Polpa do indicador na incisura jugular (referência de direção).' },
      { n: 2, text: 'Polpa do polegar em apoio infraclavicular.' },
      { n: 3, text: 'Traçado aproximado da clavícula direita.' },
      { n: 4, text: 'Região ilustrativa de entrada — não é coordenada.' }
    ]
  },
  asymmetry: [
    { topic: 'Ducto linfático', right: 'Ducto linfático direito, curto', left: 'Ducto torácico no ângulo venoso esquerdo (risco de quilotórax)' },
    { topic: 'Veia braquiocefálica', right: 'Curta e quase vertical', left: 'Longa e oblíqua, cruza a linha média' },
    { topic: 'Cúpula pleural', right: 'Presente', left: 'Presente; por vezes mais alta' }
  ],
  glossaryGroups: ['Ossos', 'Veias', 'Artérias', 'Músculos', 'Nervos', 'Linfáticos', 'Pulmões e pleura', 'Mediastino', 'Pele e superfície', 'Instrumentos']
};
