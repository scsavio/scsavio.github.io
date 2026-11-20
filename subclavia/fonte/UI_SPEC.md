# UI_SPEC — `index.html`, `src/app.css`, `src/app.js` (+ `tools/uishot.js`)

Construa a interface do atlas sobre o motor (`ATLAS.createEngine`, ver `src/engine.js`) e os dados (`window.ATLAS_DATA`,
esquema em `CONTENT_SPEC.md`; o arquivo `src/data.js` está sendo escrito em paralelo por outro agente — para testar antes
disso, crie `src/data.sample.js` com 2–3 capítulos no mesmo esquema; o `index.html` final carrega **somente** `src/data.js`).
Referência visual/funcional do original: `$P/../orig/head_orig.html`, `$P/../orig/sections_orig.html`, `$P/../orig/css.css`,
`$P/../orig/app_tail.js` e as capturas `$P/../shots/o01.png … o10.png`, `o_full.png`. Mantenha a identidade (papel/tinta,
verde-petróleo `#176d66`, dourado `#c1954c`, títulos serifados) e **eleve** para um acabamento editorial profissional.

## index.html (dev; o build embute tudo)
Ordem dos scripts: `vendor/three.js`, `vendor/gltf.js`, `data/hand.js`, `data/prancha.js`, `src/core.js`, `src/landmarks.js`,
`src/engine.js`, módulos em `src/modules/` na ordem de `tools/modules.txt` (skeleton, vessels, muscles, nerves, viscera, skin,
instruments — inclua os 7 sempre; **NÃO crie stubs** nem arquivos em `src/modules/` — eles pertencem a outros agentes que
estão escrevendo agora; no dev um arquivo ausente só gera 404 e o motor o ignora; o `tools/build.py` também pula arquivos
ausentes com aviso), `src/data.js`, `src/app.js`.
CSS em `<link rel="stylesheet" href="src/app.css">`. Sem recursos externos (fontes de sistema; offline). `tools/build.py`
gera `dist/atlas.html` (arquivo único) — rode e teste o build também.

## Layout e componentes
- **Cabeçalho**: sobretítulo, título "Punção da subclávia direita", subtítulo, selo de aviso ("Modelo 3D didático…"),
  botões: tema claro/escuro, imprimir/PDF, tela cheia.
- **Navegação de capítulos**: pílulas numeradas roláveis + barra de progresso; teclado ←/→; deep-link `#cap-03`.
- **Área principal** (desktop: grid visor 1.6fr | painel 1fr; ≤ 980 px: visor 62vh e painel abaixo):
  - **Visor 3D** com sobreposições: nota de orientação ("Direita do paciente = esquerda da tela"); **gizmo de orientação**
    (SVG pequeno com eixos Cranial / Direita do paciente / Anterior, atualizado a partir da câmera); **legenda** de cores;
    **rótulos** com linhas-guia (use `E.project`, esmaeça quando `E.occluded` — throttle ~6 Hz; evite sobreposição);
    **tooltip** ao passar o mouse (nome + grupo, via `E.pick`); **cartão de estrutura** ao clicar (glossário: nome, grupo,
    descrição, relevância; botões "Focar" (`E.focus`) e "Destacar" (`E.highlight`); Esc fecha); indicador de corte ativo;
    botões de vista (Anterior, Oblíqua, Perfil, Mão, Profunda, Superior, Posterior), zoom +/−, restaurar cena.
  - **Controles** sob o visor (agrupados, compactos, colapsáveis em mobile): camadas (chips com cor + rótulo pt-BR:
    Pele, Ossos, Músculos, Veias, Artérias, Nervos, Linfáticos, Pulmões, Pleura, Mediastino, Mão, Instrumentos, Campo estéril,
    Auxílios); "Músculos translúcidos" (ghost); sliders **Mão** (Preparar–Apoiar, `state.handPose`), **Respiração**
    (Expiração–Inspiração, `state.breath`) com botões animar/pausar; **Etapas da agulha** (stepper 0–6 com nomes:
    Sem agulha, Aproximação, Pele, Sob a clavícula, Luz venosa, Fio-guia, Cateter) + "reproduzir sequência"; alternar
    "Trajeto anômalo do fio (VJI)" (`wireMal`) e "Planos/ângulos" (`showPlanes`); **Corte** (liga/desliga + slider de
    posição ao longo da normal ±4 cm); coxim (nenhum/interescapular/ipsilateral); rótulos on/off; captura PNG (`E.snapshot`).
  - **Painel de texto**: "Cena NN / total", título, foco (destaque com filete dourado), corpo, **Pontos-chave**,
    **Armadilhas**, detalhe/limites, fontes do capítulo (links para a bibliografia), **Autoteste** (quiz com feedback e
    explicação; marca capítulos respondidos), anterior/próxima. Painel com rolagem própria no desktop.
- **Seções abaixo**: (1) **Prancha** (`data/prancha.js` → `<img src="data:image/jpeg;base64,...">`) com **anotações SVG
  numeradas** sobre a foto (posições em % — abra `data/prancha.jpg` com Read para posicionar: polpa do indicador na incisura,
  polpa do polegar infraclavicular, traçado da clavícula, região ilustrativa de entrada) + legenda e alternância
  "mostrar marcações"; (2) **Planos da agulha** (SVG didático em 2 painéis: frontal — clavícula, incisura, entrada, direção;
  sagital — pele, subcutâneo, peitoral maior, clavícula em corte, subclávio, veia, 1ª costela, pleura, agulha com arco de
  ângulo); (3) **Tecidos atravessados** (`layersTable`), **Medidas publicadas** (`measurements`), **Assimetria D×E**
  (`asymmetry`), **Complicações por estrutura** (`complications`; clicar destaca a estrutura no 3D), **Ultrassom
  esquemático** (SVG/canvas da janela infraclavicular em eixo curto: pele, peitorais, veia axilar compressível, artéria,
  pleura/linha pleural, costela com sombra — rótulos de `usg.labels`), **Checklist** do treino; (4) **Glossário** (busca +
  filtros por grupo; clicar → foca/destaca no 3D e rola até o visor); (5) **Fontes e limites do modelo**; (6) **Licenças**
  (three.js MIT; mão WebXR generic-hand MIT © 2019 Amazon — copie o texto do original); rodapé com aviso educacional.
  Os insets citados em `chapter.inset` devem aparecer também no painel do capítulo (versão compacta) ou com link âncora.
- **Carregamento**: sobreposição com progresso (use `opts.onProgress(nome, i, n)` do motor) e mensagem amigável; fallback
  sem WebGL (mensagem + conteúdo textual continua acessível).
- **Impressão/PDF**: botão gera `#printRoot` com capa + 1 folha A4 por capítulo (snapshot do visor via `E.snapshot(1600,1000)`
  aplicando a cena do capítulo, título, foco, corpo, pontos-chave, fontes) e chama `window.print()`; CSS `@media print`.

## Comportamento
- `applyScene(chapter.scene, animate)`: camadas (`E.showOnly`), ghost (`E.clearGhosts` + `E.setGhost`), estado
  (`Object.assign(E.state, …)`), corte (`E.setClip`), vista (`E.setView(view, 900)`), destaque (`E.highlight`), rótulos,
  animação sugerida (`anim`). Sincroniza todos os controles da UI. Trocar de capítulo nunca deixa estado "vazado".
- Animações: mão (0→1 em ~1,6 s, easing), respiração (ciclo contínuo ~4 s), sequência da agulha (fases 1→4 com pausas),
  fio (5, alterna wireMal). Respeite `prefers-reduced-motion`.
- Qualidade automática: mobile/touch ou `deviceMemory ≤ 4` → `quality: 0.6`, `shadowSize: 1024`, `maxDPR: 1.5`.
- Acessibilidade: botões com `aria-label`/`aria-pressed`, foco visível, contraste AA, navegação por teclado, `lang=pt-BR`.
- **Tema escuro** (prefers-color-scheme + alternância, persistido em localStorage com try/catch): tokens CSS em `:root`;
  fundo do visor muda (gradiente escuro azul-petróleo) — o `renderer` é transparente (alpha).
- Sem bibliotecas externas. JS organizado em funções; sem variáveis globais soltas além de `window.APP` (debug) e `window.__ready`
  (defina `true` quando o primeiro capítulo estiver aplicado).

## Verificação
Crie `tools/uishot.js` (Playwright; mesmos flags SwiftShader de `tools/shot.js`) que abre `index.html` (ou `dist/atlas.html`
com `--dist`), espera `window.__ready`, e salva capturas: página inteira 1440×900, visor de cada capítulo (ou de uma lista),
mobile 390×844 (iPhone), tema escuro, cartão de estrutura aberto, impressão (`page.emulateMedia({media:'print'})` + PDF
opcional). Leia as capturas e itere até não haver: sobreposição de textos, cortes de layout, rótulos ilegíveis, scroll
horizontal no mobile, controles quebrados, erros no console. Teste também `python3 tools/build.py` + `uishot --dist`.
