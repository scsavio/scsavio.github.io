# CONTENT_SPEC — `src/data.js` (`window.ATLAS_DATA`)

Fonte do conteúdo original: `$P/../orig/data_orig.json` (10 capítulos + 8 fontes) e `$P/../orig/sections_orig.html`
(seções complementares: prancha, planos, "o que foi revisto", fontes/limites, licença). O documento-base do autor foi um
DOCX "Punção da subclávia direita — guia técnico" (não disponível). O conteúdo original é cuidadoso e **deliberadamente
não prescritivo** (evita "X cm e depois virar", trata contato ósseo como achado que exige reavaliação, enfatiza que
marcos externos não localizam a ponta, que respiração não abre margem pleural segura, que refluxo isolado não confirma
posição venosa). **Preserve esse rigor** e aumente: densidade técnica, detalhamento anatômico com números verificáveis,
didatismo (pontos-chave, armadilhas, autoteste), e cobertura (marcos de superfície, relações neurovasculares, assimetria D×E,
complicações por estrutura, ultrassom). Público: médicos e residentes (Clínica, Emergência, Terapia Intensiva) e internos.
Idioma: **português do Brasil**, terminologia anatômica oficial, tom técnico, frases claras. Data editorial: 19/11/2026.
Uso exclusivamente educacional/simulação supervisionada — sem recomendações assistenciais individualizadas.

## Verificação de fontes (OBRIGATÓRIO)
Toda afirmação numérica ou de evidência deve ter fonte **verificada nesta sessão** (PubMed via ferramentas MCP — carregue
com `ToolSearch` `"+PubMed search"` / `select:mcp__PubMed__search_articles,mcp__PubMed__get_article_metadata` — ou leitura
direta da página via agente `web-fetch`/WebFetch se disponível). Não invente PMIDs/DOIs/números. Se não conseguir verificar,
remova o número ou formule qualitativamente. Candidatas (verifique!): McGee & Gould, NEJM 2003 (complicações de CVC);
Parienti et al., NEJM 2015 (3SITES: subclávia × jugular × femoral — infecção, trombose, pneumotórax); Fragou et al., Crit Care
Med 2011 (USG na subclávia, ECR); Brass et al., Cochrane 2015 (USG em acesso subclávio/femoral); Kitagawa et al., Am J Surg
2004 (posição do ombro; distâncias clavícula–veia — já no original); Lim et al., Anesth Analg 2013 (expiração completa — já no
original); Fortune & Feustel, Arch Surg 2003 (posição do paciente × veia subclávia por RM); Rodriguez et al., J Trauma 2006
(posição ótima); Tan et al., J Trauma 2000 (bases anatômicas da cateterização segura); Braner et al., NEJM 2007 (vídeo/técnica —
já no original); Land 1971 (relações da subclávia D); diretrizes ASA 2020 de acesso venoso central; Lalu et al., Crit Care Med
2015 (meta-análise de USG). As fontes do original (MSD Manuals 2026, StatPearls, PMC3270925 etc.) podem permanecer se
mantidas verificáveis.

## Esquema
```js
window.ATLAS_DATA = {
  meta: { title, subtitle, version: '2.0', reviewDate: '19/11/2026', disclaimer, basedOn, modelNote },
  chapters: [{
    id: 'marcos', n: '01', short: 'Marcos',             // short ≤ 14 caracteres (botão de navegação)
    title: '...', focus: '...',                         // focus = 1 frase-chave (destaque)
    body: ['...', '...'],                               // 2–4 parágrafos densos (HTML simples permitido: <strong>, <em>)
    keyPoints: ['...'],                                 // 3–5 itens objetivos
    pitfalls: ['...'],                                  // 0–3 armadilhas/erros frequentes
    detail: '...',                                      // limites do modelo/observação
    sources: [1, 3],                                    // números de `sources`
    quiz: { q: '...', options: ['...','...','...','...'], answer: 0, explain: '...' },
    scene: {
      view: 'front' | { target: [x,y,z], radius, az, el },   // LM.views: front, oblique, side, hand, close, top, back
      layers: ['skin','bones','muscle','vein','artery','nerve','lymph','lung','pleura','mediastinum','hand','instrument','drape','aids'],
      ghost: { muscle: 0.25 },                          // camadas translúcidas (opcional)
      state: { phase: 0, handPose: 1, breath: 0, rollMode: 'none', wireMal: false, showPlanes: false },
      clip: null | { normal: [nx,ny,nz], point: [x,y,z], label: 'Corte parassagital no trajeto da agulha' },
      labels: [['anchorKey', 'Texto curto do rótulo'], ...],  // 3–7; SOMENTE chaves de âncora canônicas (SPEC.md §4)
      highlight: 'scv-R' | null,                        // id canônico (SPEC.md §4)
      anim: null | 'hand' | 'breath' | 'needle' | 'wire'
    },
    inset: null | 'planes' | 'layers' | 'distances' | 'complications' | 'usg' | 'checklist' | 'asymmetry'
  }],
  glossary: { '<id canônico>': { name, group, desc, relevance } },   // cubra TODOS os ids canônicos de SPEC.md §4
  sources: [{ n: 1, title, detail /* autores, periódico, ano, PMID/DOI */, url }],
  measurements: [{ label, value, note, source }],       // tabela "medidas publicadas" (com ressalvas)
  complications: [{ name, structure /* id */, mechanism, recognition, prevention, incidence?, source }],
  layersTable: [{ depth: 1, tissue: 'Pele', note }],    // tecidos atravessados no trajeto infraclavicular, superficial→profundo
  checklist: ['...'],                                   // treino supervisionado (o que o preceptor avalia)
  usg: { caption, labels: [{ key, text }] },            // legenda do esquema de USG (infraclavicular, eixo curto da veia axilar)
  prancha: { title, caption, notes: ['...'], annotations: [{ n: 1, text: '...' }] },
  asymmetry: [{ topic, right, left }],                  // tabela D × E (por que a direita é comum; ducto torácico à E etc.)
  glossaryGroups: ['Ossos','Veias','Artérias','Músculos','Nervos','Linfáticos','Pulmões e pleura','Mediastino','Pele e superfície','Instrumentos']
};
```

## Capítulos sugeridos (12–13; ajuste com critério)
1. **Marcos de superfície** (pele; incisura, clavícula e sua curvatura, junção dos terços, ângulo esternal, fossa
   infraclavicular, sulco deltopeitoral/coracoide, ECM e fossa supraclavicular menor). Orientação: direita do paciente à
   esquerda da tela.
2. **O espaço costoclavicular em camadas** (clavícula/subclávio acima-anterior, 1ª costela abaixo, escaleno anterior entre
   veia e artéria, plexo posterossuperior, cúpula pleural posterior; costela não é escudo contínuo).
3. **Vasos: trajeto, confluência e assimetria D×E** (axilar→subclávia na borda lateral da 1ª costela; ângulo venoso atrás da
   esternoclavicular; VBC D curta × E longa; VCS; TBC só à direita; subclávia E do arco; ducto torácico à E).
4. **O que fica atrás e acima da veia** (frênico na face anterior do escaleno, vago e recorrente D sob a subclávia, plexo,
   gânglio estrelado, cúpula/ápice, artéria torácica interna medialmente).
5. **Mão esquerda: dois marcos, funções distintas** (conteúdo original revisado).
6. **Ponto de entrada: referência ≠ coordenada** (original revisado; variações entre fontes).
7. **Direção × inclinação** (planos; frontal × sagital; ângulos publicados dependem do plano; com corte).
8. **Sob a clavícula: tecidos atravessados e contato ósseo** (pele→subcutâneo→peitoral maior→fáscia clavipeitoral/
   subclávio→parede venosa; artéria/pleura posteriores; recuar antes de redirecionar; `layersTable`).
9. **Refluxo, fio-guia e cateter** (confirmação venosa antes de dilatar; fio sem força, arritmia; desvio para VJI à direita;
   ponta do cateter na VCS distal/junção cavoatrial; confirmação de posição).
10. **Pulmão e respiração** (ápice quase imóvel; expansão basal; Lim 2013; espaço pleural potencial).
11. **Distâncias e posição** (três medidas distintas; Kitagawa; coxim/rolo — interpretação provisória do termo "tarô" do
    documento-base como coxim/rolo; retração do ombro pode estreitar o espaço costoclavicular; Trendelenburg).
12. **Complicações por estrutura** (pneumotórax, punção arterial — compressão difícil sob a clavícula, hemotórax, lesão do
    plexo/frênico, quilotórax (E), embolia gasosa, arritmia, malposição, infecção/trombose: comparação com outros sítios).
13. **Ultrassom e treino supervisionado** (abordagem infraclavicular da veia axilar com USG, sombra da clavícula, ponta sempre
    visível; checklist do preceptor).

## Cenas (orientações)
- Rótulos SOMENTE com as âncoras canônicas da tabela de SPEC.md §4 (o integrador garante que existam).
- Corte parassagital no trajeto da agulha visto da direita: `clip: { normal: [-1,0,0], point: [7,0,0] }` com
  `view: { target: [7,0,-1], radius: 30, az: -1.57, el: 0.05 }` (normal mantém o lado medial; câmera lateral).
- Vista de "mão": `view: 'hand'`; agulha: fases 1–4; fio: fase 5 (+ `wireMal` no capítulo de malposição); cateter: 6.
- Respiração: `anim: 'breath'`; mão: `anim: 'hand'`.
- Você pode renderizar o estado atual com `node tools/shot.js "view=..&layers=..&phase=.." shots/x.png` (módulos ainda em
  construção por outros agentes — use apenas para checar enquadramento aproximado).

## Entrega
`src/data.js` sintaticamente válido (`node --check`), conteúdo completo, e um relatório listando: fontes verificadas (com como
verificou: PMID consultado), afirmações removidas por falta de verificação, e quaisquer âncoras/ids extras que você precisou.
