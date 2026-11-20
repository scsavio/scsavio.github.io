# Contrato — Fixação do cateter pelo "ponto em bailarina" (sandália romana / "finger trap")

Pedido do autor: incluir a fixação do cateter pelo método da bailarina, realista e detalhada no passo a passo, com
todos os cuidados na distribuição do fio, os movimentos a realizar e tudo o que for relevante para a execução adequada.
Tom do atlas: educacional, técnico, NÃO prescritivo (descreve técnica de ensino; cita fontes verificadas; aponta
limites/alternativas). Idioma pt-BR.

## Peças e donos
| Peça | Arquivo (dono) | Observação |
|---|---|---|
| Geometria/animação 3D da fixação | `src/modules/fixation.js` (NOVO; módulo `fixation`) | construído depois de `instruments` |
| Conteúdo (capítulo, passos, cuidados, glossário, fontes, checklist) | `src/data.fixacao.js` (NOVO) | carregado DEPOIS de `src/data.js`; acrescenta ao `window.ATLAS_DATA` |
| Controles e inset na interface | `index.html`, `src/app.css`, `src/app.js` (UI) | stepper "Fixação", inset `fixation`, anim `fix` |
| Estado/param de dev | `src/engine.js` (`E.state.fixStep = 0`), `src/devboot.js` (`fix=N`) | já feito pelo integrador |

## Estado
`E.state.fixStep` ∈ {0..9} (inteiro; a UI pode animar valores fracionários entre etapas: `fixStep = k + t`, t∈[0,1)
= progresso do movimento da etapa k+1). Só tem efeito com o cateter posicionado (`E.state.phase === 6`); com fase < 6 o
módulo esconde tudo. A UI, ao entrar no capítulo da fixação, usa `phase: 6`.

## Etapas (índices FIXOS; textos podem ser refinados pelo conteúdo)
0. Sem fixação — cateter posicionado (fase 6), canhão apoiado, trecho externo livre.
1. Preparo — campo estéril mantido; porta-agulha com fio montado (agulha curva presa no terço posterior); conferir a
   marca em cm do cateter na pele e o trecho externo sem tensão/dobras.
2. Ponto de ancoragem na pele — agulha curva entra e sai da pele em arco, junto ao sítio de saída (≈0,5–1 cm), sem tocar
   o cateter; pegada dérmica adequada (nem superficial demais, que rasga; nem profunda).
3. Nó de ancoragem — nó cirúrgico (dupla volta) + seminós, assentado sobre a pele SEM estrangular (pele não isquêmica);
   as DUAS pontas ficam longas e de comprimento semelhante (são elas que farão as "fitas da sapatilha").
4. 1º cruzamento — as pontas passam por BAIXO do cateter (lado da pele), cruzam por CIMA e dá-se um nó sobre o cateter:
   firme para não deslizar, sem marcar/achatar/dobrar o cateter.
5. 2º cruzamento — alternando (por baixo → cruza por cima), ~0,4–0,6 cm adiante no cateter, novo nó.
6. 3º cruzamento + nó final — terceiro entrelaçamento e nó de segurança (vários seminós alternados).
7. Corte e conferência — pontas cortadas deixando ~0,5–1 cm; tração suave não desloca o cateter; aspirar e lavar todas as
   vias (refluxo e infusão livres = sem oclusão pela fixação); sem dobra na saída.
8. Pontos nas asas do canhão — um ponto por orifício da asa (dois), ancorando o canhão na pele com o cateter em curva suave.
9. Curativo — antissepsia ao redor, (esponja/gel de clorexidina no sítio, se usado) e curativo transparente semipermeável
   cobrindo saída, bailarina e asas; identificação/data.

## API do módulo 3D (`E.results.fixation.api`)
- `steps`: array de 10 `{ n, short }` (rótulos curtos para o stepper; o texto longo vem de `ATLAS_DATA.fixation.steps`).
- `focusView`: vista recomendada `{ target, radius, az, el }` (close-up do sítio de saída), coords anatômicas.
- `anchors` (para rótulos; todos coords anatômicas): `fixExit` (saída do cateter na pele), `fixAnchorStitch`,
  `fixAnchorKnot`, `fixTails`, `fixCross1`, `fixCross2`, `fixCross3`, `fixFinalKnot`, `fixWingStitchA`,
  `fixWingStitchB`, `fixDressing`, `needleHolder`, `sutureNeedle`.
- Registry ids (glossário): `suture-ballerina` (fio e nós da bailarina), `suture-anchor` (ponto de ancoragem),
  `suture-wing` (pontos das asas), `needle-holder` (porta-agulha), `suture-needle` (agulha curva),
  `dressing-transparent` (curativo transparente), `chg-pad` (esponja/gel de clorexidina, se modelado).
- Camada: `instrument` (curativo pode ir em `instrument` também).
- Fonte da geometria: `E.results.instruments.api.external()` → `{ path (canhão→saída→…), nExternal, entry, exitDir, hub,
  hubX, hubY, hubN, hubNose, wingHoles[2], rCath, surface }`; `api.surfaceZ(x,y)`, `api.skinZ(x,y)`;
  `api.onExternal(fn)` (reassentamento quando o campo estéril liga/desliga).

## Dados (`src/data.fixacao.js`)
Acrescenta a `window.ATLAS_DATA` (sem editar `src/data.js`):
- `chapters`: insere o capítulo `{ id: 'fixacao', short: 'Fixação', ... }` LOGO APÓS o capítulo `id: 'cateter'` e
  renumera `n` de todos ('01'…'15').
- `fixation`: `{ title, intro, material: [...], steps: [{ k: 1..9, title, text, movement, cautions: [...], why }],
  errors: [...], alternatives: [...], afterCare: [...] }` — consumido pelo inset `fixation` da UI.
- `glossary`: entradas para os ids acima.
- `sources`: novas fontes ACRESCENTADAS com número = (maior n existente + 1…), e o capítulo novo referencia esses
  números calculados em tempo de carga (não fixe números à mão).
- `checklist`: itens adicionais da fixação (acrescentar ao fim).
- Cena do capítulo: `state: { phase: 6, fixStep: 9, ... }`, `anim: 'fix'` (a UI anima 0→9 com pausas), vista
  `api.focusView` (ou equivalente numérico), camadas `skin, instrument, aids` (e `drape` se o realismo pedir).

## Estado final do contrato (após a onda 6)
- `api.steps` (10), `api.stepMs` = [0, 3000, 12000, 8000, 8500, 9000, 9000, 8500, 10000, 3500] ms (soma 71,5 s; com as
  pausas da UI a animação completa dura ≈79 s), `api.stepViews` (10 vistas, uma por etapa; a UI as segue até o
  leitor mexer na câmera), `api.anchorSteps` (faixa [primeira, última] etapa em que cada âncora vale como rótulo).
- `api.focusView` = `api.finalView` = `api.stepViews[9]` (mesmo objeto): alvo no filme, raio 16 — filme inteiro no
  visor em 1440×900, 1280×720 e 390×844.
- `api.settle(state)` salta ao estado final da etapa (capturas e impressão); `api.available`, `api.debug()`,
  `api.scene()` (inclui `nHold`/`fNeedle`), `api.strands()`, `api.clearance()`.
- Coreografia: a agulha só muda de pose presa a um instrumento (porta-agulha ou pinça no corpo exteriorizado, nunca
  na ponta); repega assistida pela pinça no ponto de ancoragem e nas asas; mandíbula do porta-agulha articulada;
  pontas em repouso deitadas do lado da âncora; curativo, gel e etiqueta só na etapa 9.

