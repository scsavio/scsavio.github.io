# Atlas 3D — punção da veia subclávia direita (v2)

Material **educacional** (simulação supervisionada), sem função assistencial: não fornece trajetória nem profundidade
seguras para uso em pacientes.

- `index.html`: o atlas em arquivo único (≈4 MB, funciona offline; three.js r160 embutido). Abra direto no navegador.
- `fonte/`: código-fonte que gera o `index.html`.

## Conteúdo
- 15 capítulos: marcos de superfície, espaço costoclavicular, vasos D × E, o que fica atrás da veia, mão esquerda,
  entrada, planos da agulha, tecidos em corte, refluxo e fio-guia, cateter (dilatador e posição da ponta),
  **fixação do cateter em “bailarina”** (etapas 0–9 animadas, com esquema 2D, cuidados com a distribuição do fio,
  movimentos, erros e alternativas), respiração, distâncias, complicações e ultrassom.
- Modelo 3D com camadas, cortes, fantasmas e destaques; rótulos com oclusão; glossário (250 verbetes) com cartões;
  impressão/PDF em folhas A4 (17 folhas); modo celular.
- 43 fontes numeradas, incluindo as da fixação.

## Gerar de novo a partir da fonte
```
cd fonte
python3 tools/build.py          # → dist/atlas.html (copie para ../index.html)
node tools/check_data.js --registry   # coerência de dados, glossário e âncoras
node tools/uitest.js --dist     # testes da interface (Playwright + Chromium)
```
Pendências e limitações conhecidas: `fonte/notes/KNOWN_ISSUES.md`. Contrato da fixação: `fonte/notes/FIXACAO_CONTRACT.md`.

> Diferente das demais páginas deste site, esta pasta **não** é protegida por senha.
