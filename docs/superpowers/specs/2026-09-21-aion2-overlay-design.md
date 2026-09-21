# Aion 2 Speedrun Overlay — Design

Data: 2026-09-21
Fonte de conteúdo: `Aion 2 Level 1-45 Speedrun Guide - appJotapegs.docx`

## Problema

O guia de speedrun 1–45 existe como um `.docx` de 19 MB: texto corrido em cinco fases
mais oito mapas anotados. Consultar isso enquanto se joga significa sair do jogo, achar
o parágrafo certo e lembrar de cabeça onde se parou.

O app é um overlay que mostra **uma part de cada vez**, flutua sobre o jogo sem sumir
quando o foco vai para outra janela, e guarda o progresso.

## Requisitos

1. Mostra a part atual do guia: fase, faixa de nível, ações e o mapa correspondente.
2. Concluir uma part avança para a próxima e grava o progresso.
3. Navegar livremente para trás e para frente **sem** marcar nada. Navegação nunca
   escreve progresso; só o botão de concluir escreve.
4. Marcar ações individuais é opcional.
5. Fica por cima do jogo e não perde a visibilidade ao clicar em outra janela.
6. Fundo translúcido, com opacidade ajustável.
7. Minimalista, mas com identidade visual.
8. Também precisa servir numa segunda tela.

## Arquitetura

Três camadas, cada uma testável isoladamente:

```
data/guide.json  ──>  núcleo web (src/)  ──>  casca Electron (electron/)
   conteúdo            UI + progresso          janela, hotkeys, disco
```

- A **casca** não conhece o guia. Hospeda o núcleo e expõe uma API de janela e de disco
  via `contextBridge`.
- O **núcleo** não sabe se roda no Electron ou no Chrome. Detecta `window.aion` e escolhe
  a implementação de storage. É isso que faz a segunda tela sair de graça.
- O **conteúdo** é um JSON estático. Trocar de guia ou corrigir um texto não toca em código.

## Pipeline do documento

`scripts/extract-docx.mjs` roda **uma única vez** e produz `data/guide.json` e
`public/maps/*.webp`. A partir daí o `guide.json` é a fonte da verdade, editada à mão —
é lá que entra, se um dia for escrito, o texto de cada seta numerada. O script permanece
no repositório para reimportar caso saia uma v2 do guia; reimportar sobrescreve, então
edições manuais devem ser feitas depois da última importação.

O `.docx` é um zip. O que interessa:

| Caminho | Uso |
|---|---|
| `word/document.xml` | texto, estilos (`Heading2` = fase, `Heading3` = part), listas, tabela da legenda |
| `word/_rels/document.xml.rels` | resolve `r:embed` do `<a:blip>` para o arquivo em `word/media/` |
| `word/media/image*.png` | os 8 mapas, todos 1280×960 |

A ligação mapa↔part vem da ordem dos parágrafos: o `<w:p>` que contém o `<a:blip>` vem
logo após o `Heading3` da part.

**Cores da legenda:** lidas de `<w:color w:val>` nos runs da tabela — `#d4a000` (MSQ),
`#2e7d32` (side quests), `#e65100` (Seal Dungeons), preto (Kisks). As três primeiras
descrevem o que está desenhado no mapa **e** servem na interface. A de Kisks não: uma
barrinha preta é invisível sobre vidro escuro. Daí o par `color` / `uiColor` no modelo —
ver a seção Visual.

**Quebras de linha:** `<w:br/>` dentro de um parágrafo separa ações distintas coladas no
mesmo bullet, por exemplo a Fase 4 Part 1. O parser precisa tratá-las, senão duas ações
viram uma.

**Mapas:** todas as 8 imagens têm letterbox preto — no mínimo uma moldura de 16 px, e
em alguns casos barras grandes. Medido com limiar de luminância 24:

| arquivo | topo | base | esquerda | direita | recortado |
|---|---|---|---|---|---|
| `image1` | 16 | 32 | 16 | 16 | 1248×912 |
| `image2` | 16 | 16 | 16 | 200 | 1064×928 |
| `image3` | 12 | 66 | 11 | 11 | 1258×882 |
| `image4` | 16 | 16 | 16 | 193 | 1071×928 |
| `image5` | 16 | 16 | 16 | 342 | 922×928 |
| `image6` | 16 | 192 | 16 | 214 | 1050×752 |
| `image7` | 16 | 16 | 16 | 92 | 1172×928 |
| `image8` | 16 | 263 | 16 | 59 | 1205×681 |

São 20,8% dos pixels. O recorte é **calculado em tempo de build**, não codificado por
imagem: varre os pixels das bordas com `sharp().raw()` e descarta linhas e colunas cujos
pixels estejam todos abaixo do limiar. Assim uma reimportação com mapas novos continua
funcionando. `sharp().trim()` não serve aqui porque usa a cor do pixel superior esquerdo
como referência, e nessas imagens esse pixel já é conteúdo do mapa em vários casos.

Depois converte para WebP com qualidade alta, sem reescalar — os números das setas são
pequenos e precisam continuar legíveis. Esperado: 19 MB para algo em torno de 2–3 MB.

Como as dimensões finais variam de 922×928 a 1258×882, `MapRef` carrega largura e altura
próprias; a UI não pode assumir proporção fixa.

## Modelo de dados

```ts
type Guide = {
  version: string
  source: string
  legend: LegendEntry[]
  downtime: string[]
  phases: Phase[]
}

type LegendEntry = {
  id: Tag
  label: string     // 'Main Story Quest (MSQ)'
  marker: string    // 'Yellow Arrows' — como o mapa desenha
  color: string     // a cor do documento, para descrever o mapa
  uiColor: string   // a cor usada na interface
}
type Tag = 'msq' | 'side' | 'seal' | 'kisk'

type Phase = {
  id: string            // 'phase-4'
  title: string
  levelFrom: number
  levelTo: number
  parts: Part[]
}

type Part = {
  id: string            // 'p4-1'
  title: string
  map: MapRef | null
  actions: Action[]
}

type MapRef = { src: string; width: number; height: number }

type Action = {
  id: string            // 'p4-1-a2'
  text: string
  tag: Tag | null       // colore a barrinha à esquerda
  sub: Action[]
}
```

Resultado da extração: **11 parts** e cerca de 20 ações.

| Fase | Níveis | Parts | Mapas |
|---|---|---|---|
| 1 | 1–9 | 1 | — |
| 2 | 10–16 | 2 | `image3`, `image7` |
| 3 | 17–21 | 3 | `image1`, `image4`, `image5` |
| 4 | 22–32 | 4 | `image6`, `image8`, `image2`, — |
| 5 | 33–45 | 1 | — |

A Fase 5 tem só dois bullets cobrindo doze níveis. As cinco notas soltas de kisk que o
documento lista em seguida (Powder of Death, Lake of Confrontation, An Ill Fate's
Resolution, Daybreak Society Rescue Operation e a continuação dela) viram ações de
verdade dentro dessa fase. É o trecho mais magro do guia e é o que mais ganha com isso.

O campo `tag` é inferido na importação por heurística sobre o texto (menciona "MSQ" →
`msq`, "Seal" → `seal`, "green quest" → `side`, "kisk" → `kisk`) e corrigido à mão
depois. A heurística é conveniência de importação, não lógica de runtime.

### Progresso

```ts
type Progress = {
  schemaVersion: 1
  currentPartId: string
  completedParts: string[]
  checkedActions: string[]
}
```

Referencia ids, nunca índices — assim editar o `guide.json` não corrompe um progresso
salvo. Um `currentPartId` desconhecido (part removida numa reimportação) cai para a
primeira part não concluída.

## Núcleo web

Vite + TypeScript, sem framework. O app tem onze telas de conteúdo e um punhado de
estados; uma função de render e um store pequeno resolvem, o bundle fica em dezenas de
KB e o Electron abre instantaneamente.

Módulos:

| Arquivo | Responsabilidade | Depende de |
|---|---|---|
| `core/guide.ts` | carrega e valida o `guide.json`, achata as parts numa sequência navegável | — |
| `core/progress.ts` | estado do progresso e transições (avançar, voltar, marcar, concluir, resetar) | `guide.ts` |
| `core/storage.ts` | `load()` / `save()`, escolhendo Electron ou `localStorage` | — |
| `core/settings.ts` | opacidade, posição, click-through | `storage.ts` |
| `ui/card.ts` | o card compacto | `progress.ts` |
| `ui/mapModal.ts` | mapa em sobreposição, com zoom e arrasto | — |
| `ui/jumpList.ts` | lista de fases e parts para pular direto | `guide.ts` |
| `ui/settingsPanel.ts` | opacidade, hotkeys, resetar progresso | `settings.ts` |

`progress.ts` é lógica pura sobre dados — sem DOM, sem I/O. É onde mora a regra de que
navegar não marca nada, e é o que os testes atacam primeiro.

### Estados da interface

- **Card compacto** (padrão, ~360×210): fase, faixa de nível, título da part, ações com
  caixa de marcar, setas de navegação, contador e barra de progresso.
- **Mapa** (sob demanda): sobrepõe o card inteiro, fecha com a mesma tecla ou `Esc`.
- **Jump list**: as cinco fases, expansíveis nas parts, com a atual destacada.
- **Ajustes**: opacidade, hotkeys, resetar progresso (com confirmação).

## Casca Electron

`BrowserWindow` com `frame: false`, `transparent: true` e `backgroundColor`
totalmente transparente. A fixação usa `setAlwaysOnTop(true, 'screen-saver')` — esse
nível específico é o que mantém a janela acima de jogos no Windows; o `alwaysOnTop`
comum perde. Arrasto por uma faixa no topo com `-webkit-app-region: drag`.

`preload.ts` expõe por `contextBridge` apenas:

```ts
window.aion = {
  loadProgress, saveProgress,
  loadSettings, saveSettings,
  setOpacity, setClickThrough,
  minimize, close,
  onHotkey
}
```

Sem `nodeIntegration`, com `contextIsolation`.

Hotkeys globais via `globalShortcut`, funcionando sem tirar o foco do jogo. Combinações
com `Ctrl+Alt` para não colidir com teclas do jogo:

| Atalho | Ação |
|---|---|
| `Ctrl+Alt+→` | próxima part |
| `Ctrl+Alt+←` | part anterior |
| `Ctrl+Alt+Enter` | concluir a part atual |
| `Ctrl+Alt+M` | abrir/fechar o mapa |
| `Ctrl+Alt+H` | esconder/mostrar o overlay |
| `Ctrl+Alt+C` | alternar click-through |

Progresso e ajustes em JSON dentro de `app.getPath('userData')`, com escrita atômica
(arquivo temporário e rename) para não corromper em caso de queda.

### Limitações conhecidas

- **Tela cheia exclusiva bloqueia qualquer overlay.** O jogo precisa estar em
  *borderless windowed*. Isso vai no README, não é contornável.
- Janela transparente no Windows perde as bordas nativas de redimensionar. Solução: uma
  alça própria no canto inferior direito chamando `setSize`.
- `setIgnoreMouseEvents(true, { forward: true })` faz os cliques atravessarem, mas
  enquanto ativo a janela não recebe nem hover — por isso o modo tem hotkey própria de
  saída.

## Visual

Escuro, vidro fosco, uma cor de acento só. A paleta sai da legenda do próprio guia, que
já é um sistema de cores: cada ação carrega uma barrinha à esquerda na cor do seu `tag`.
Tipografia pequena, peso alto e um leve contorno no texto — o fundo é um jogo em
movimento, e contraste é o que decide se o overlay serve ou atrapalha.

As cores do documento foram escolhidas para papel branco e não sobrevivem inteiras num
fundo escuro. Por isso cada `LegendEntry` tem dois valores: `color`, que é o que o
documento diz e só aparece quando a interface **descreve** o mapa ("setas pretas =
kisks"), e `uiColor`, que é o que realmente pinta a barrinha da ação. Amarelo, verde e
laranja passam quase direto, com um ajuste de luminosidade; o preto dos kisks vira um
neutro claro, que é o que lê sobre vidro escuro. Uma ação sem `tag` não ganha barrinha.

Alvos de acessibilidade: contraste mínimo de 4.5:1 do texto contra o vidro na opacidade
padrão, e alvos de clique de pelo menos 24 px.

## Testes

Vitest. O que é testado, em ordem de importância:

1. `progress.ts` — avançar, voltar, marcar, desmarcar, concluir, resetar. O caso central:
   navegar para trás e para frente não altera `completedParts`. Mais a recuperação de um
   `currentPartId` órfão.
2. `guide.ts` — o `data/guide.json` real passa na validação: ids únicos, todo `map.src`
   existe em disco, as faixas de nível cobrem 1 a 45 sem buraco nem sobreposição.
3. `extract-docx.mjs` — sobre um `.docx` de fixture reduzido: separa ações nas quebras de
   linha, liga mapa à part correta, lê as cores da legenda, recorta o letterbox.
4. `storage.ts` — cada implementação sobrevive a dado ausente, corrompido e de schema
   antigo.

Sem testes de UI automatizados nesta versão; a verificação do card é visual.

## Estrutura

```
aion2guide/
├─ data/guide.json
├─ public/maps/*.webp
├─ scripts/extract-docx.mjs
├─ src/
│  ├─ core/{guide,progress,storage,settings}.ts
│  ├─ ui/{card,mapModal,jumpList,settingsPanel}.ts
│  ├─ styles/
│  └─ main.ts
├─ electron/{main,preload,window,hotkeys,store}.ts
├─ tests/
└─ docs/superpowers/specs/
```

## Fora de escopo

Sem login, sem sincronização em nuvem, sem múltiplos perfis de personagem, sem leitura
de memória do jogo, sem detecção automática de nível, sem timer de speedrun, sem suporte
a outros guias além deste. Progresso é um só, com botão de resetar.
