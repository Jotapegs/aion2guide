# Aion 2 Speedrun Overlay — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir um overlay translúcido e fixo na tela que mostra uma part por vez do guia de speedrun 1–45 de Aion 2, guarda o progresso e permite navegar livremente sem marcar nada.

**Architecture:** Três camadas independentes. `data/guide.json` é o conteúdo, gerado uma vez a partir do `.docx` e depois editado à mão. `src/` é o núcleo web, que roda em qualquer navegador e não sabe que o Electron existe. `electron/` é a casca, que hospeda o núcleo e expõe janela, hotkeys e disco por `contextBridge`.

**Tech Stack:** Vite, TypeScript, Vitest, Electron, electron-builder. Sem framework de UI. Scripts de importação em Node puro com `jszip`, `@xmldom/xmldom` e `sharp`.

**Spec:** [`docs/superpowers/specs/2026-09-21-aion2-overlay-design.md`](../specs/2026-09-21-aion2-overlay-design.md)

## Global Constraints

- Node 22 (a máquina tem v22.14.0). Windows 11. Git Bash ou PowerShell.
- **Sem framework de UI.** Nada de React, Vue, Svelte ou similar em `src/`. A renderização é DOM direto.
- **Idioma:** identificadores e nomes de arquivo em inglês. Comentários, mensagens de erro e textos de interface em português. **O conteúdo do guia permanece em inglês**, exatamente como no documento — "Seal DG", "Safe Haven" e "Kisk" são como aparecem no jogo e traduzir atrapalharia.
- **Mensagens de commit em português**, terminando com a linha:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- O `.docx` fonte está na raiz do repositório: `Aion 2 Level 1-45 Speedrun Guide - appJotapegs.docx`
- `public/maps/` está no `.gitignore`: é saída regenerável do importador. `data/guide.json` **é** versionado.
- Os mapas nunca são reescalados. Os números das setas são pequenos e precisam continuar legíveis.
- Níveis cobertos: 1 a 45, sem buraco e sem sobreposição entre fases.
- Todas as funções de `core/progress.ts` são puras e retornam objetos novos. Nenhuma muta seu argumento.

## Desvios da spec

Um só, deliberado. A spec lista `ui/jumpList.ts` e `ui/settingsPanel.ts` como arquivos
separados. O plano junta os dois, mais o painel de referência, em `ui/panels.ts`: os três
são a mesma sobreposição com conteúdo diferente, só um fica aberto por vez, e separá-los
significaria triplicar a casca e a lógica de "fecha o outro ao abrir este". A spec ganhou
também o campo `Part.note`, já registrado lá.

---

### Task 1: Projeto, tipos do guia e validador

Monta o projeto e entrega o primeiro módulo real: os tipos do guia e um validador que falha com mensagem específica. Tudo o que vem depois depende desses tipos, então eles vêm primeiro.

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `src/core/guide.ts`
- Create: `tests/fixtures/guide.ts`
- Test: `tests/guide.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: os tipos `Tag`, `LegendEntry`, `Action`, `MapRef`, `Part`, `Phase`, `Guide`, `FlatPart`; a constante `TAGS`; a classe `GuideError`; as funções `parseGuide(raw: unknown): Guide`, `flattenParts(guide: Guide): FlatPart[]`, `findPart(guide: Guide, partId: string): FlatPart | null`. O helper de teste `makeGuide(): Guide` em `tests/fixtures/guide.ts`.

- [ ] **Step 1: Iniciar o projeto e instalar as dependências**

```bash
cd "C:/Users/joaop/Documents/aion2guide"
npm init -y
npm i -D vite typescript vitest @types/node
```

- [ ] **Step 2: Escrever o `package.json`**

Substitua o conteúdo gerado pelo `npm init` por este, preservando o bloco `devDependencies` que o npm escreveu:

```json
{
  "name": "aion2guide",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "extract": "node scripts/extract-docx.mjs"
  }
}
```

- [ ] **Step 3: Escrever o `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "types": ["vite/client", "node"]
  },
  "include": ["src", "tests", "electron", "vite.config.ts"]
}
```

- [ ] **Step 4: Escrever o `vite.config.ts`**

`base: './'` não é opcional — sem ele o Electron carregando por `file://` não acha os assets.

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,mjs}'],
  },
})
```

- [ ] **Step 5: Escrever o fixture de guia usado pelos testes**

Um guia mínimo mas válido: duas fases, três parts, cobrindo os níveis 1 a 45. `tests/fixtures/guide.ts`:

```ts
import type { Guide } from '../../src/core/guide'

/** Guia válido mínimo. Duas fases, três parts, níveis 1–45. */
export function makeGuide(): Guide {
  return {
    version: '1.0.0',
    source: 'fixture',
    legend: [
      { id: 'msq', label: 'Main Story Quest (MSQ)', marker: 'Yellow Arrows', color: '#d4a000', uiColor: '#f0c040' },
      { id: 'side', label: 'Side Quests', marker: 'Green Arrows', color: '#2e7d32', uiColor: '#5cc46a' },
      { id: 'seal', label: 'Seal Dungeons', marker: 'Orange Arrows', color: '#e65100', uiColor: '#ff8a3d' },
      { id: 'kisk', label: 'Kisks', marker: 'Black Arrows', color: '#000000', uiColor: '#c8d0e0' },
    ],
    downtime: ['Weapons (+5 max).', 'Accessories (+5 max).'],
    phases: [
      {
        id: 'phase-1',
        title: 'Phase 1',
        levelFrom: 1,
        levelTo: 9,
        parts: [
          {
            id: 'p1-1',
            title: 'Levels 1–9',
            note: null,
            map: null,
            actions: [{ id: 'p1-1-a1', text: 'Follow core MSQ', tag: 'msq', sub: [] }],
          },
        ],
      },
      {
        id: 'phase-2',
        title: 'Phase 2',
        levelFrom: 10,
        levelTo: 45,
        parts: [
          {
            id: 'p2-1',
            title: 'Part 1',
            note: 'You get your first lvl8 skills here!',
            map: { src: 'maps/image3.webp', width: 1258, height: 882 },
            actions: [
              { id: 'p2-1-a1', text: 'MSQ Push', tag: 'msq', sub: [] },
              {
                id: 'p2-1-a2',
                text: 'Seal DG Detour',
                tag: 'seal',
                sub: [{ id: 'p2-1-a2-s1', text: 'Do the 4 Seal dgs on the way', tag: null, sub: [] }],
              },
            ],
          },
          {
            id: 'p2-2',
            title: 'Part 2',
            note: null,
            map: null,
            actions: [{ id: 'p2-2-a1', text: 'Take the Kisks', tag: 'kisk', sub: [] }],
          },
        ],
      },
    ],
  }
}
```

- [ ] **Step 6: Escrever os testes que falham**

`tests/guide.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseGuide, flattenParts, findPart, GuideError } from '../src/core/guide'
import { makeGuide } from './fixtures/guide'

/** Clona o fixture e aplica uma mutação, para testar rejeições. */
function broken(mutate: (g: any) => void): unknown {
  const g = JSON.parse(JSON.stringify(makeGuide()))
  mutate(g)
  return g
}

describe('parseGuide', () => {
  it('aceita um guia válido e devolve a mesma estrutura', () => {
    const guide = parseGuide(JSON.parse(JSON.stringify(makeGuide())))
    expect(guide.phases).toHaveLength(2)
    expect(guide.phases[1].parts[0].actions[1].sub[0].id).toBe('p2-1-a2-s1')
    expect(guide.phases[1].parts[0].note).toBe('You get your first lvl8 skills here!')
  })

  it('rejeita id de part duplicado', () => {
    const raw = broken((g) => { g.phases[1].parts[1].id = 'p2-1' })
    expect(() => parseGuide(raw)).toThrow(/id de part duplicado: p2-1/)
  })

  it('rejeita id de ação duplicado, inclusive em sub-ações', () => {
    const raw = broken((g) => { g.phases[1].parts[0].actions[1].sub[0].id = 'p1-1-a1' })
    expect(() => parseGuide(raw)).toThrow(/id de ação duplicado: p1-1-a1/)
  })

  it('rejeita tag desconhecido', () => {
    const raw = broken((g) => { g.phases[0].parts[0].actions[0].tag = 'boss' })
    expect(() => parseGuide(raw)).toThrow(GuideError)
  })

  it('aceita tag null', () => {
    const raw = broken((g) => { g.phases[0].parts[0].actions[0].tag = null })
    expect(() => parseGuide(raw)).not.toThrow()
  })

  it('rejeita fase que não começa no nível 1', () => {
    const raw = broken((g) => { g.phases[0].levelFrom = 2 })
    expect(() => parseGuide(raw)).toThrow(/primeira fase deve começar no nível 1/)
  })

  it('rejeita buraco entre as faixas de nível', () => {
    const raw = broken((g) => { g.phases[1].levelFrom = 11 })
    expect(() => parseGuide(raw)).toThrow(/phase-2 deveria começar no nível 10/)
  })

  it('rejeita guia que não termina no nível 45', () => {
    const raw = broken((g) => { g.phases[1].levelTo = 44 })
    expect(() => parseGuide(raw)).toThrow(/última fase deve terminar no nível 45/)
  })

  it('rejeita fase sem parts', () => {
    const raw = broken((g) => { g.phases[0].parts = [] })
    expect(() => parseGuide(raw)).toThrow(/phase-1 não tem nenhuma part/)
  })

  it('rejeita legenda que não cobre os quatro tags', () => {
    const raw = broken((g) => { g.legend.pop() })
    expect(() => parseGuide(raw)).toThrow(/legenda deve cobrir os quatro tags/)
  })

  it('rejeita entrada que não é objeto', () => {
    expect(() => parseGuide(null)).toThrow(GuideError)
    expect(() => parseGuide('guia')).toThrow(GuideError)
  })
})

describe('flattenParts', () => {
  it('achata na ordem do documento com índice sequencial', () => {
    const flat = flattenParts(makeGuide())
    expect(flat.map((f) => f.part.id)).toEqual(['p1-1', 'p2-1', 'p2-2'])
    expect(flat.map((f) => f.index)).toEqual([0, 1, 2])
    expect(flat[2].phase.id).toBe('phase-2')
  })
})

describe('findPart', () => {
  it('acha uma part existente', () => {
    expect(findPart(makeGuide(), 'p2-2')?.index).toBe(2)
  })

  it('devolve null para part inexistente', () => {
    expect(findPart(makeGuide(), 'p9-9')).toBeNull()
  })
})
```

- [ ] **Step 7: Rodar os testes e confirmar que falham**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "../src/core/guide"`.

- [ ] **Step 8: Escrever o `src/core/guide.ts`**

```ts
export type Tag = 'msq' | 'side' | 'seal' | 'kisk'

export const TAGS: readonly Tag[] = ['msq', 'side', 'seal', 'kisk']

export type LegendEntry = {
  id: Tag
  /** Como a legenda do documento nomeia a categoria. */
  label: string
  /** Como o mapa desenha: 'Yellow Arrows'. */
  marker: string
  /** A cor do documento. Serve para descrever o mapa, não para pintar a interface. */
  color: string
  /** A cor que de fato pinta a interface, legível sobre vidro escuro. */
  uiColor: string
}

export type Action = {
  id: string
  text: string
  tag: Tag | null
  sub: Action[]
}

export type MapRef = {
  /** Caminho relativo sem barra inicial: 'maps/image6.webp'. */
  src: string
  width: number
  height: number
}

export type Part = {
  id: string
  title: string
  /** Contexto que não se marca. Null quando a part não tem nenhum. */
  note: string | null
  map: MapRef | null
  actions: Action[]
}

export type Phase = {
  id: string
  title: string
  levelFrom: number
  levelTo: number
  parts: Part[]
}

export type Guide = {
  version: string
  source: string
  legend: LegendEntry[]
  downtime: string[]
  phases: Phase[]
}

/** Uma part com sua fase e sua posição na sequência linear do guia. */
export type FlatPart = {
  part: Part
  phase: Phase
  index: number
}

export class GuideError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GuideError'
  }
}

const FIRST_LEVEL = 1
const LAST_LEVEL = 45

function fail(message: string): never {
  throw new GuideError(message)
}

function obj(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(`${where} deve ser um objeto`)
  }
  return value as Record<string, unknown>
}

function str(value: unknown, where: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${where} deve ser uma string não vazia`)
  }
  return value
}

function int(value: unknown, where: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    fail(`${where} deve ser um número inteiro`)
  }
  return value
}

function list(value: unknown, where: string): unknown[] {
  if (!Array.isArray(value)) fail(`${where} deve ser uma lista`)
  return value
}

function parseTag(value: unknown, where: string): Tag | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string' || !TAGS.includes(value as Tag)) {
    fail(`${where} deve ser um tag conhecido (${TAGS.join(', ')}) ou null`)
  }
  return value as Tag
}

function parseAction(raw: unknown, where: string, seenIds: Set<string>): Action {
  const r = obj(raw, where)
  const id = str(r.id, `${where}.id`)
  if (seenIds.has(id)) fail(`id de ação duplicado: ${id}`)
  seenIds.add(id)
  return {
    id,
    text: str(r.text, `${where}.text`),
    tag: parseTag(r.tag, `${where}.tag`),
    sub: list(r.sub ?? [], `${where}.sub`).map((s, i) =>
      parseAction(s, `${where}.sub[${i}]`, seenIds),
    ),
  }
}

function parseMap(raw: unknown, where: string): MapRef | null {
  if (raw === null || raw === undefined) return null
  const r = obj(raw, where)
  const src = str(r.src, `${where}.src`)
  if (src.startsWith('/')) fail(`${where}.src não deve começar com barra: ${src}`)
  return { src, width: int(r.width, `${where}.width`), height: int(r.height, `${where}.height`) }
}

function parsePart(raw: unknown, where: string, partIds: Set<string>, actionIds: Set<string>): Part {
  const r = obj(raw, where)
  const id = str(r.id, `${where}.id`)
  if (partIds.has(id)) fail(`id de part duplicado: ${id}`)
  partIds.add(id)
  const note = r.note === null || r.note === undefined ? null : str(r.note, `${where}.note`)
  const actions = list(r.actions, `${where}.actions`).map((a, i) =>
    parseAction(a, `${where}.actions[${i}]`, actionIds),
  )
  return { id, title: str(r.title, `${where}.title`), note, map: parseMap(r.map, `${where}.map`), actions }
}

function parseLegend(raw: unknown): LegendEntry[] {
  const entries = list(raw, 'legend').map((e, i) => {
    const r = obj(e, `legend[${i}]`)
    const id = parseTag(r.id, `legend[${i}].id`)
    if (id === null) fail(`legend[${i}].id não pode ser null`)
    return {
      id,
      label: str(r.label, `legend[${i}].label`),
      marker: str(r.marker, `legend[${i}].marker`),
      color: str(r.color, `legend[${i}].color`),
      uiColor: str(r.uiColor, `legend[${i}].uiColor`),
    }
  })
  const ids = new Set(entries.map((e) => e.id))
  if (ids.size !== TAGS.length || !TAGS.every((t) => ids.has(t))) {
    fail(`a legenda deve cobrir os quatro tags exatamente uma vez (${TAGS.join(', ')})`)
  }
  return entries
}

/**
 * Valida dados crus vindos do disco e devolve um Guide.
 * Lança GuideError com uma mensagem que aponta o caminho exato do problema.
 */
export function parseGuide(raw: unknown): Guide {
  const r = obj(raw, 'guide')
  const partIds = new Set<string>()
  const actionIds = new Set<string>()

  const phases = list(r.phases, 'phases').map((p, i) => {
    const pr = obj(p, `phases[${i}]`)
    const id = str(pr.id, `phases[${i}].id`)
    const levelFrom = int(pr.levelFrom, `phases[${i}].levelFrom`)
    const levelTo = int(pr.levelTo, `phases[${i}].levelTo`)
    if (levelFrom > levelTo) fail(`${id} tem levelFrom maior que levelTo`)
    const parts = list(pr.parts, `phases[${i}].parts`).map((pt, j) =>
      parsePart(pt, `phases[${i}].parts[${j}]`, partIds, actionIds),
    )
    if (parts.length === 0) fail(`${id} não tem nenhuma part`)
    return { id, title: str(pr.title, `phases[${i}].title`), levelFrom, levelTo, parts }
  })

  if (phases.length === 0) fail('o guia não tem nenhuma fase')
  const first = phases[0]
  const last = phases[phases.length - 1]
  if (first.levelFrom !== FIRST_LEVEL) {
    fail(`a primeira fase deve começar no nível ${FIRST_LEVEL}, e começa no ${first.levelFrom}`)
  }
  if (last.levelTo !== LAST_LEVEL) {
    fail(`a última fase deve terminar no nível ${LAST_LEVEL}, e termina no ${last.levelTo}`)
  }
  for (let i = 1; i < phases.length; i++) {
    const expected = phases[i - 1].levelTo + 1
    if (phases[i].levelFrom !== expected) {
      fail(`${phases[i].id} deveria começar no nível ${expected}, e começa no ${phases[i].levelFrom}`)
    }
  }

  return {
    version: str(r.version, 'guide.version'),
    source: str(r.source, 'guide.source'),
    legend: parseLegend(r.legend),
    downtime: list(r.downtime, 'guide.downtime').map((d, i) => str(d, `downtime[${i}]`)),
    phases,
  }
}

/** Todas as parts na ordem do documento, cada uma com sua fase e seu índice. */
export function flattenParts(guide: Guide): FlatPart[] {
  const flat: FlatPart[] = []
  for (const phase of guide.phases) {
    for (const part of phase.parts) {
      flat.push({ part, phase, index: flat.length })
    }
  }
  return flat
}

export function findPart(guide: Guide, partId: string): FlatPart | null {
  return flattenParts(guide).find((f) => f.part.id === partId) ?? null
}
```

- [ ] **Step 9: Rodar os testes e confirmar que passam**

Run: `npm test`
Expected: PASS — 14 testes em `tests/guide.test.ts`.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts src tests
git commit -m "Adiciona tipos do guia e validador

Monta o projeto com Vite, TypeScript e Vitest, e entrega o primeiro
modulo: os tipos do guia e parseGuide, que valida ids unicos, tags
conhecidos e faixas de nivel contiguas de 1 a 45.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Leitura mecânica do `.docx`

Transforma o XML do Word numa lista de blocos, sem nenhuma interpretação do que significam. Separar isto da semântica deixa os testes rápidos: são strings de XML, não arquivos zip.

**Files:**
- Create: `scripts/lib/docx.mjs`
- Test: `tests/docx.test.mjs`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `openDocx(docxPath): Promise<DocxArchive>` — `DocxArchive` tem `text(entry: string): Promise<string>`, `buffer(entry: string): Promise<Buffer>` e `entries(): string[]`.
  - `parseRels(relsXml: string): Record<string, string>` — mapeia `rId` para o alvo, por exemplo `{ rId7: 'media/image3.png' }`.
  - `parseDocument(documentXml: string, rels: Record<string, string>): Block[]`
  - Um `Block` é `{ kind: 'p', style: string|null, numId: string|null, ilvl: number|null, lines: string[], images: string[] }` ou `{ kind: 'tbl', rows: Cell[][] }`, onde `Cell` é `{ text: string, colors: string[] }`. `lines` já vem dividido pelos `<w:br/>` e sem linhas vazias nas pontas. `images` traz caminhos como `media/image3.png`.

- [ ] **Step 1: Instalar as dependências de leitura**

```bash
npm i -D jszip @xmldom/xmldom
```

- [ ] **Step 2: Escrever os testes que falham**

`tests/docx.test.mjs`:

```js
import { describe, it, expect } from 'vitest'
import { parseRels, parseDocument } from '../scripts/lib/docx.mjs'

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
const R = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
const A = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'

/** Embrulha parágrafos num document.xml completo. */
function doc(inner) {
  return `<w:document ${W} ${R} ${A}><w:body>${inner}</w:body></w:document>`
}

describe('parseRels', () => {
  it('mapeia rId para o arquivo de mídia', () => {
    const xml = `<?xml version="1.0"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId7" Type="../image" Target="media/image3.png"/>
        <Relationship Id="rId8" Type="../styles" Target="styles.xml"/>
      </Relationships>`
    expect(parseRels(xml)).toEqual({ rId7: 'media/image3.png', rId8: 'styles.xml' })
  })
})

describe('parseDocument', () => {
  it('lê estilo de heading e texto', () => {
    const blocks = parseDocument(
      doc('<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Phase 2: Levels 10–16</w:t></w:r></w:p>'),
      {},
    )
    expect(blocks).toEqual([
      { kind: 'p', style: 'Heading2', numId: null, ilvl: null, lines: ['Phase 2: Levels 10–16'], images: [] },
    ])
  })

  it('divide o parágrafo em linhas nos w:br', () => {
    const blocks = parseDocument(
      doc('<w:p><w:r><w:t>Zone Entry: MSQ only</w:t><w:br/><w:t>After arrow 15 take Ascension</w:t></w:r></w:p>'),
      {},
    )
    expect(blocks[0].lines).toEqual(['Zone Entry: MSQ only', 'After arrow 15 take Ascension'])
  })

  it('junta runs vizinhos na mesma linha', () => {
    const blocks = parseDocument(
      doc('<w:p><w:r><w:t>Safe </w:t></w:r><w:r><w:t>Haven</w:t></w:r></w:p>'),
      {},
    )
    expect(blocks[0].lines).toEqual(['Safe Haven'])
  })

  it('descarta linhas vazias e espaço nas pontas', () => {
    const blocks = parseDocument(
      doc('<w:p><w:r><w:t xml:space="preserve">  </w:t><w:br/><w:t xml:space="preserve"> MSQ Push  </w:t></w:r></w:p>'),
      {},
    )
    expect(blocks[0].lines).toEqual(['MSQ Push'])
  })

  it('lê numId e ilvl de item de lista', () => {
    const blocks = parseDocument(
      doc('<w:p><w:pPr><w:numPr><w:ilvl w:val="1"/><w:numId w:val="8"/></w:numPr></w:pPr><w:r><w:t>Gear Check: equip</w:t></w:r></w:p>'),
      {},
    )
    expect(blocks[0].numId).toBe('8')
    expect(blocks[0].ilvl).toBe(1)
  })

  it('resolve imagem pelo r:embed', () => {
    const blocks = parseDocument(
      doc('<w:p><w:r><w:drawing><a:blip r:embed="rId7"/></w:drawing></w:r></w:p>'),
      { rId7: 'media/image6.png' },
    )
    expect(blocks[0].images).toEqual(['media/image6.png'])
    expect(blocks[0].lines).toEqual([])
  })

  it('ignora r:embed que não está nos rels', () => {
    const blocks = parseDocument(doc('<w:p><w:r><w:drawing><a:blip r:embed="rIdX"/></w:drawing></w:r></w:p>'), {})
    expect(blocks[0].images).toEqual([])
  })

  it('lê a tabela com o texto e as cores de cada célula', () => {
    const tbl = `<w:tbl><w:tr>
      <w:tc><w:p><w:r><w:rPr><w:color w:val="d4a000"/></w:rPr><w:t>Yellow Arrows</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>Main Story Quest (MSQ)</w:t></w:r></w:p></w:tc>
    </w:tr></w:tbl>`
    const blocks = parseDocument(doc(tbl), {})
    expect(blocks[0].kind).toBe('tbl')
    expect(blocks[0].rows[0][0]).toEqual({ text: 'Yellow Arrows', colors: ['d4a000'] })
    expect(blocks[0].rows[0][1]).toEqual({ text: 'Main Story Quest (MSQ)', colors: [] })
  })

  it('ignora cor automática e preta na lista de cores', () => {
    const tbl = `<w:tbl><w:tr><w:tc><w:p>
      <w:r><w:rPr><w:color w:val="auto"/></w:rPr><w:t>Black Arrows</w:t></w:r>
    </w:p></w:tc></w:tr></w:tbl>`
    const blocks = parseDocument(doc(tbl), {})
    expect(blocks[0].rows[0][0].colors).toEqual([])
  })

  it('preserva a ordem dos blocos', () => {
    const blocks = parseDocument(
      doc(
        '<w:p><w:pPr><w:pStyle w:val="Heading3"/></w:pPr><w:r><w:t>Part 1</w:t></w:r></w:p>' +
          '<w:p><w:r><w:t>nota</w:t></w:r></w:p>',
      ),
      {},
    )
    expect(blocks.map((b) => b.style)).toEqual(['Heading3', null])
  })
})
```

- [ ] **Step 3: Rodar os testes e confirmar que falham**

Run: `npx vitest run tests/docx.test.mjs`
Expected: FAIL — `Failed to resolve import "../scripts/lib/docx.mjs"`.

- [ ] **Step 4: Escrever o `scripts/lib/docx.mjs`**

```js
// Leitura mecânica do .docx. Este módulo não interpreta nada: converte o XML
// do Word numa lista de blocos. A semântica fica em guide-builder.mjs.
import { readFile } from 'node:fs/promises'
import JSZip from 'jszip'
import { DOMParser } from '@xmldom/xmldom'

const NS = {
  w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
}

/** Abre o .docx (que é um zip) e devolve um leitor das suas entradas. */
export async function openDocx(docxPath) {
  const zip = await JSZip.loadAsync(await readFile(docxPath))
  return {
    entries: () => Object.keys(zip.files),
    async text(entry) {
      const file = zip.file(entry)
      if (!file) throw new Error(`entrada ausente no .docx: ${entry}`)
      return file.async('string')
    },
    async buffer(entry) {
      const file = zip.file(entry)
      if (!file) throw new Error(`entrada ausente no .docx: ${entry}`)
      return file.async('nodebuffer')
    },
  }
}

function parse(xml) {
  return new DOMParser().parseFromString(xml, 'text/xml')
}

/** Mapeia cada rId para o caminho do arquivo que ele aponta. */
export function parseRels(relsXml) {
  const rels = {}
  for (const el of parse(relsXml).getElementsByTagName('Relationship')) {
    const id = el.getAttribute('Id')
    const target = el.getAttribute('Target')
    if (id && target) rels[id] = target
  }
  return rels
}

function attr(el, name) {
  return el.getAttributeNS(NS.w, name) ?? el.getAttribute(`w:${name}`)
}

/** Percorre um nó e monta as linhas, quebrando nos <w:br/>. */
function linesOf(node) {
  const lines = []
  let current = ''
  const walk = (n) => {
    if (n.namespaceURI === NS.w && n.localName === 'br') {
      lines.push(current)
      current = ''
      return
    }
    if (n.namespaceURI === NS.w && n.localName === 't') {
      current += n.textContent ?? ''
      return
    }
    if (n.namespaceURI === NS.w && n.localName === 'tab') {
      current += ' '
      return
    }
    for (let c = n.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 1) walk(c)
    }
  }
  walk(node)
  lines.push(current)
  return lines.map((l) => l.trim()).filter((l) => l !== '')
}

function first(el, ns, name) {
  const found = el.getElementsByTagNameNS(ns, name)
  return found.length > 0 ? found[0] : null
}

function parseParagraph(p, rels) {
  const pPr = first(p, NS.w, 'pPr')
  let style = null
  let numId = null
  let ilvl = null
  if (pPr) {
    const pStyle = first(pPr, NS.w, 'pStyle')
    if (pStyle) style = attr(pStyle, 'val')
    const numPr = first(pPr, NS.w, 'numPr')
    if (numPr) {
      const n = first(numPr, NS.w, 'numId')
      const l = first(numPr, NS.w, 'ilvl')
      if (n) numId = attr(n, 'val')
      if (l) ilvl = Number(attr(l, 'val'))
    }
  }
  const images = []
  for (const blip of p.getElementsByTagNameNS(NS.a, 'blip')) {
    const embed = blip.getAttributeNS(NS.r, 'embed') ?? blip.getAttribute('r:embed')
    if (embed && rels[embed]) images.push(rels[embed])
  }
  return { kind: 'p', style, numId, ilvl, lines: linesOf(p), images }
}

/** Cores de um parágrafo, descartando 'auto' e preto — não distinguem nada. */
function colorsOf(node) {
  const colors = []
  for (const c of node.getElementsByTagNameNS(NS.w, 'color')) {
    const val = attr(c, 'val')
    if (val && val !== 'auto' && val.toLowerCase() !== '000000' && !colors.includes(val)) {
      colors.push(val)
    }
  }
  return colors
}

function parseTable(tbl) {
  const rows = []
  for (const tr of tbl.getElementsByTagNameNS(NS.w, 'tr')) {
    const cells = []
    for (const tc of tr.getElementsByTagNameNS(NS.w, 'tc')) {
      cells.push({ text: linesOf(tc).join(' '), colors: colorsOf(tc) })
    }
    rows.push(cells)
  }
  return { kind: 'tbl', rows }
}

/** Converte o document.xml numa lista de blocos, preservando a ordem. */
export function parseDocument(documentXml, rels) {
  const body = first(parse(documentXml), NS.w, 'body')
  if (!body) throw new Error('document.xml não tem <w:body>')
  const blocks = []
  for (let el = body.firstChild; el; el = el.nextSibling) {
    if (el.nodeType !== 1 || el.namespaceURI !== NS.w) continue
    if (el.localName === 'p') blocks.push(parseParagraph(el, rels))
    else if (el.localName === 'tbl') blocks.push(parseTable(el))
  }
  return blocks
}
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `npx vitest run tests/docx.test.mjs`
Expected: PASS — 11 testes.

- [ ] **Step 6: Conferir contra o documento real**

Run:
```bash
node -e "
import('./scripts/lib/docx.mjs').then(async (m) => {
  const d = await m.openDocx('Aion 2 Level 1-45 Speedrun Guide - appJotapegs.docx')
  const rels = m.parseRels(await d.text('word/_rels/document.xml.rels'))
  const blocks = m.parseDocument(await d.text('word/document.xml'), rels)
  console.log('blocos:', blocks.length)
  console.log('com imagem:', blocks.filter(b => b.images?.length).length)
  console.log('tabelas:', blocks.filter(b => b.kind === 'tbl').length)
  console.log('headings:', blocks.filter(b => b.style?.startsWith('Heading')).length)
})
"
```
Expected: `blocos: 62`, `com imagem: 8`, `tabelas: 1`, `headings: 17`.

Se algum número divergir, o parser está errado — não siga em frente.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json scripts tests
git commit -m "Le o .docx e converte em blocos

Descompacta o .docx e converte o document.xml numa lista de blocos,
sem interpretar o significado deles. Trata quebras de linha, resolve
imagens pelo r:embed e le as cores da tabela da legenda.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Blocos viram guia

A semântica. Recebe os blocos da Task 2 e monta a estrutura de fases, parts e ações. É aqui que mora a regra que separa ação de contexto.

**Files:**
- Create: `scripts/lib/guide-builder.mjs`
- Test: `tests/guide-builder.test.mjs`

**Interfaces:**
- Consumes: o tipo `Block` de `scripts/lib/docx.mjs`.
- Produces: `buildGuide(blocks, options): Guide` onde `options` é `{ version, source, maps }`. `maps` mapeia o caminho original da imagem para um `MapRef` já processado, por exemplo `{ 'media/image6.png': { src: 'maps/image6.webp', width: 1050, height: 752 } }`. Uma imagem ausente de `maps` vira `map: null`. O retorno satisfaz `parseGuide` da Task 1.

As regras, todas derivadas da forma que o documento já usa:

| Entrada | Vira |
|---|---|
| `Heading2` com `Phase N: Levels A–B` | uma fase |
| `Heading3` dentro de uma fase | uma part |
| fase sem nenhum `Heading3` | uma part implícita, titulada `Levels A–B` |
| item de lista, primeira linha | ação |
| item de lista, linhas seguintes | sub-ações dela |
| item de lista com `ilvl` ≥ 1 | sub-ação da última ação de nível 0 |
| linha solta `Rótulo curto: conteúdo` | ação |
| linha solta terminada em `:` | descartada, é cabeçalho |
| outra linha solta, havendo ação anterior | sub-ação dela |
| outra linha solta, sem ação anterior | o `note` da part |
| blocos antes da primeira fase | `downtime` e `legend` |

- [ ] **Step 1: Escrever os testes que falham**

`tests/guide-builder.test.mjs`:

```js
import { describe, it, expect } from 'vitest'
import { buildGuide, isActionLine } from '../scripts/lib/guide-builder.mjs'
import { parseGuide } from '../src/core/guide'

const p = (lines, extra = {}) => ({ kind: 'p', style: null, numId: null, ilvl: null, lines, images: [], ...extra })
const heading = (style, text) => p([text], { style })
const li = (lines, numId = '1', ilvl = 0) => p(lines, { numId, ilvl })

const LEGEND_TABLE = {
  kind: 'tbl',
  rows: [
    [{ text: 'Color / Symbol', colors: ['1a237e'] }, { text: 'Route Classification', colors: ['1a237e'] }],
    [{ text: 'Yellow Arrows', colors: ['d4a000'] }, { text: 'Main Story Quest (MSQ)', colors: [] }],
    [{ text: 'Green Arrows', colors: ['2e7d32'] }, { text: 'Side Quests', colors: [] }],
    [{ text: 'Orange Arrows', colors: ['e65100'] }, { text: 'Seal Dungeons', colors: [] }],
    [{ text: 'Black Arrows', colors: [] }, { text: 'Kisks', colors: [] }],
  ],
}

/** Blocos mínimos que produzem um guia válido de 1 a 45. */
function baseBlocks(extra = []) {
  return [
    heading('Heading3', 'Downtime Priority'),
    p(['Whenever you have downtime:']),
    li(['Weapons (+5 max).']),
    LEGEND_TABLE,
    heading('Heading2', 'Phase 1: Levels 1–9'),
    li(['Follow core MSQ']),
    heading('Heading2', 'Phase 2: Levels 10–45'),
    ...extra,
  ]
}

const OPTS = { version: '1.0.0', source: 'teste', maps: {} }

describe('isActionLine', () => {
  it('reconhece a forma rótulo-dois-pontos-conteúdo', () => {
    expect(isActionLine('Zone Entry: All we doing is MSQ')).toBe(true)
    expect(isActionLine('MSQ (Powder of Death): take kisk')).toBe(true)
    expect(isActionLine('Gear Check: Equip all newly acquired Accessories')).toBe(true)
  })

  it('rejeita cabeçalho terminado em dois-pontos', () => {
    expect(isActionLine('Whenever you have downtime:')).toBe(false)
    expect(isActionLine('Additional written notes during phase 5:')).toBe(false)
  })

  it('rejeita frase comum sem rótulo', () => {
    expect(isActionLine('After getting the Wings from Urugugu')).toBe(false)
    expect(isActionLine('You get your first lvl8 skills here!')).toBe(false)
  })
})

describe('buildGuide', () => {
  it('produz um guia que passa no parseGuide', () => {
    const guide = buildGuide(baseBlocks([li(['MSQ Push'])]), OPTS)
    expect(() => parseGuide(JSON.parse(JSON.stringify(guide)))).not.toThrow()
  })

  it('lê a faixa de nível do título da fase, com espaço sobrando', () => {
    const blocks = baseBlocks([li(['MSQ Push'])])
    blocks[4] = heading('Heading2', ' Phase 1: Levels 1–9 ')
    const guide = buildGuide(blocks, OPTS)
    expect(guide.phases[0]).toMatchObject({ id: 'phase-1', levelFrom: 1, levelTo: 9 })
  })

  it('lê a faixa mesmo com sufixo no título', () => {
    const blocks = baseBlocks([li(['Pure MSQ'])])
    blocks[6] = heading('Heading2', 'Phase 2: Levels 10–45 (2nd Rune)')
    const guide = buildGuide(blocks, OPTS)
    expect(guide.phases[1]).toMatchObject({ levelFrom: 10, levelTo: 45 })
  })

  it('cria part implícita quando a fase não tem Heading3', () => {
    const guide = buildGuide(baseBlocks([li(['Pure MSQ'])]), OPTS)
    expect(guide.phases[0].parts).toHaveLength(1)
    expect(guide.phases[0].parts[0]).toMatchObject({ id: 'p1-1', title: 'Levels 1–9' })
  })

  it('numera parts e ações por fase', () => {
    const guide = buildGuide(
      baseBlocks([
        heading('Heading3', 'Part 1'),
        li(['MSQ Push']),
        li(['Seal DG Detour']),
        heading('Heading3', 'Part 2'),
        li(['Take the Kisks']),
      ]),
      OPTS,
    )
    const parts = guide.phases[1].parts
    expect(parts.map((x) => x.id)).toEqual(['p2-1', 'p2-2'])
    expect(parts[0].actions.map((a) => a.id)).toEqual(['p2-1-a1', 'p2-1-a2'])
    expect(parts[1].actions[0].id).toBe('p2-2-a1')
  })

  it('a segunda linha de um item de lista vira sub-ação', () => {
    const guide = buildGuide(
      baseBlocks([li(['Zone Entry: MSQ only', 'After arrow 15 you get Ascension quest'])]),
      OPTS,
    )
    const action = guide.phases[1].parts[0].actions[0]
    expect(action.text).toBe('Zone Entry: MSQ only')
    expect(action.sub).toHaveLength(1)
    expect(action.sub[0]).toMatchObject({ id: 'p2-1-a1-s1', text: 'After arrow 15 you get Ascension quest' })
  })

  it('item com ilvl 1 vira sub-ação do item de nível 0 anterior', () => {
    const guide = buildGuide(
      baseBlocks([li(['Recall: Teleport back'], '7', 0), li(['Gear Check: Equip accessories'], '8', 1)]),
      OPTS,
    )
    const actions = guide.phases[1].parts[0].actions
    expect(actions).toHaveLength(1)
    expect(actions[0].sub[0].text).toBe('Gear Check: Equip accessories')
  })

  it('parágrafo solto sem ação anterior vira note da part', () => {
    const guide = buildGuide(
      baseBlocks([
        heading('Heading3', 'Part 2'),
        p(['You get your first lvl8 skills here!']),
        li(['MSQ']),
      ]),
      OPTS,
    )
    const part = guide.phases[1].parts[0]
    expect(part.note).toBe('You get your first lvl8 skills here!')
    expect(part.actions).toHaveLength(1)
  })

  it('linha rotulada em parágrafo solto vira ação', () => {
    const guide = buildGuide(
      baseBlocks([
        li(['Pure MSQ: focus 100% on Main Story Quests']),
        p([
          'Additional written notes during phase 5:',
          'MSQ (Powder of Death): take kisk at Amunta Hideout',
          'MSQ (Lake of Confrontation): fly EAST and take kisk',
        ]),
      ]),
      OPTS,
    )
    const actions = guide.phases[1].parts[0].actions
    expect(actions.map((a) => a.text)).toEqual([
      'Pure MSQ: focus 100% on Main Story Quests',
      'MSQ (Powder of Death): take kisk at Amunta Hideout',
      'MSQ (Lake of Confrontation): fly EAST and take kisk',
    ])
  })

  it('linha não rotulada depois de uma ação vira sub-ação dela', () => {
    const guide = buildGuide(
      baseBlocks([
        li(['Pure MSQ: focus on Main Story Quests']),
        p(['MSQ (Daybreak): take kisk', 'In addition take kisk SOUTH']),
      ]),
      OPTS,
    )
    const actions = guide.phases[1].parts[0].actions
    expect(actions[1].text).toBe('MSQ (Daybreak): take kisk')
    expect(actions[1].sub[0].text).toBe('In addition take kisk SOUTH')
  })

  it('liga o mapa à part e deixa null quando não há mapa processado', () => {
    const guide = buildGuide(
      baseBlocks([
        heading('Heading3', 'Part 1'),
        p([], { images: ['media/image6.png'] }),
        li(['MSQ']),
        heading('Heading3', 'Part 2'),
        p([], { images: ['media/image9.png'] }),
        li(['MSQ']),
      ]),
      { ...OPTS, maps: { 'media/image6.png': { src: 'maps/image6.webp', width: 1050, height: 752 } } },
    )
    expect(guide.phases[1].parts[0].map).toEqual({ src: 'maps/image6.webp', width: 1050, height: 752 })
    expect(guide.phases[1].parts[1].map).toBeNull()
  })

  it('extrai a legenda com as cores do documento e cores de interface legíveis', () => {
    const guide = buildGuide(baseBlocks([li(['MSQ'])]), OPTS)
    expect(guide.legend.map((l) => l.id)).toEqual(['msq', 'side', 'seal', 'kisk'])
    const msq = guide.legend.find((l) => l.id === 'msq')
    expect(msq).toMatchObject({ label: 'Main Story Quest (MSQ)', marker: 'Yellow Arrows', color: '#d4a000' })
    const kisk = guide.legend.find((l) => l.id === 'kisk')
    expect(kisk.color).toBe('#000000')
    expect(kisk.uiColor).not.toBe('#000000')
  })

  it('extrai a lista de downtime sem o cabeçalho', () => {
    const guide = buildGuide(baseBlocks([li(['MSQ'])]), OPTS)
    expect(guide.downtime).toEqual(['Weapons (+5 max).'])
  })

  it('infere o tag pelo texto da ação', () => {
    const guide = buildGuide(
      baseBlocks([
        li(['MSQ Push']),
        li(['Seal DG Detour']),
        li(['Take all the Green Quests']),
        li(['Take the Kisks it will save time']),
        li(['Equip the smite Title']),
      ]),
      OPTS,
    )
    expect(guide.phases[1].parts[0].actions.map((a) => a.tag)).toEqual(['msq', 'seal', 'side', 'kisk', null])
  })

  it('rejeita Heading2 sem faixa de nível reconhecível', () => {
    const blocks = baseBlocks([li(['MSQ'])])
    blocks[6] = heading('Heading2', 'Phase 2: the rest')
    expect(() => buildGuide(blocks, OPTS)).toThrow(/faixa de nível/)
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run tests/guide-builder.test.mjs`
Expected: FAIL — `Failed to resolve import "../scripts/lib/guide-builder.mjs"`.

- [ ] **Step 3: Escrever o `scripts/lib/guide-builder.mjs`**

```js
// Semântica: transforma os blocos do .docx na estrutura do guia.
// As regras seguem a forma que o próprio documento usa, sem lista de exceções.

/** Cores da legenda do documento, ajustadas para ler sobre vidro escuro. */
const UI_COLORS = {
  msq: '#f0c040',
  side: '#5cc46a',
  seal: '#ff8a3d',
  // O documento usa setas pretas para kisks. Preto some no overlay escuro,
  // então a interface usa um neutro claro.
  kisk: '#c8d0e0',
}

const LEGEND_ORDER = ['msq', 'side', 'seal', 'kisk']

const TAG_BY_LABEL = [
  [/main story|\bmsq\b/i, 'msq'],
  [/side quest/i, 'side'],
  [/seal dungeon/i, 'seal'],
  [/kisk/i, 'kisk'],
]

// Um en-dash ou um hífen comum separam a faixa. O título pode ter espaço
// sobrando na frente e sufixo atrás, como 'Phase 5: Levels 33–45 (2nd Rune)'.
const PHASE_RE = /Phase\s+(\d+)\s*:\s*Levels?\s+(\d+)\s*[–—-]\s*(\d+)/i

// 'Rótulo curto: conteúdo'. O rótulo não tem dois-pontos dentro, tem no
// máximo 60 caracteres, e precisa haver conteúdo depois.
const ACTION_LINE_RE = /^[^:]{1,60}:\s+\S/

/** Uma linha solta é ação quando tem a forma 'Rótulo: conteúdo'. */
export function isActionLine(line) {
  return ACTION_LINE_RE.test(line.trim())
}

function isHeaderLine(line) {
  return line.trim().endsWith(':')
}

/** Infere a categoria pelo texto. Conveniência de importação, não regra de runtime. */
function inferTag(text) {
  if (/\bkisk/i.test(text)) return 'kisk'
  if (/\bseal\b/i.test(text)) return 'seal'
  if (/\bmsq\b|main story/i.test(text)) return 'msq'
  if (/green quest|side quest/i.test(text)) return 'side'
  return null
}

function buildLegend(table) {
  if (!table) throw new Error('não encontrei a tabela da legenda antes da primeira fase')
  const entries = []
  for (const row of table.rows) {
    if (row.length < 2) continue
    const marker = row[0].text.trim()
    const label = row[1].text.trim()
    const match = TAG_BY_LABEL.find(([re]) => re.test(label))
    if (!match) continue
    const id = match[1]
    // A primeira cor da célula do marcador é a cor que o documento usa.
    // A célula dos kisks não tem cor porque preto é a cor padrão do Word.
    const color = row[0].colors.length > 0 ? `#${row[0].colors[0]}` : '#000000'
    entries.push({ id, label, marker, color, uiColor: UI_COLORS[id] })
  }
  const found = new Set(entries.map((e) => e.id))
  const missing = LEGEND_ORDER.filter((t) => !found.has(t))
  if (missing.length > 0) throw new Error(`legenda incompleta, faltam: ${missing.join(', ')}`)
  return LEGEND_ORDER.map((id) => entries.find((e) => e.id === id))
}

/** Acumula ações numa part, aplicando as regras de ação versus contexto. */
function makePartBuilder(partId) {
  const actions = []
  const noteLines = []
  let counter = 0

  const addAction = (text) => {
    counter += 1
    const action = { id: `${partId}-a${counter}`, text, tag: inferTag(text), sub: [] }
    actions.push(action)
    return action
  }

  const addSub = (text) => {
    const parent = actions[actions.length - 1]
    if (!parent) {
      noteLines.push(text)
      return
    }
    parent.sub.push({
      id: `${parent.id}-s${parent.sub.length + 1}`,
      text,
      tag: inferTag(text),
      sub: [],
    })
  }

  return {
    /** Item de lista: a primeira linha é ação, o resto é sub. */
    addListItem(lines, ilvl) {
      lines.forEach((line, i) => {
        if (i > 0 || ilvl >= 1) addSub(line)
        else addAction(line)
      })
    },
    /** Parágrafo solto: depende da forma de cada linha. */
    addLooseLines(lines) {
      for (const line of lines) {
        if (isHeaderLine(line)) continue
        if (isActionLine(line)) addAction(line)
        else addSub(line)
      }
    },
    build(title, map) {
      return {
        id: partId,
        title,
        note: noteLines.length > 0 ? noteLines.join(' ') : null,
        map,
        actions,
      }
    },
  }
}

/**
 * Monta o guia a partir dos blocos.
 * options: { version, source, maps } onde maps liga 'media/imageN.png' a um MapRef.
 */
export function buildGuide(blocks, options) {
  const { version, source, maps } = options
  const phases = []
  const downtime = []
  let legendTable = null

  let phase = null
  let partBuilder = null
  let partTitle = null
  let partMap = null
  let partNumber = 0

  const closePart = () => {
    if (!phase || !partBuilder) return
    phase.parts.push(partBuilder.build(partTitle, partMap))
    partBuilder = null
    partTitle = null
    partMap = null
  }

  const openPart = (title) => {
    closePart()
    partNumber += 1
    partBuilder = makePartBuilder(`p${phase.number}-${partNumber}`)
    partTitle = title
    partMap = null
  }

  /** A part implícita das fases que não têm Heading3. */
  const ensurePart = () => {
    if (!partBuilder) openPart(`Levels ${phase.levelFrom}–${phase.levelTo}`)
  }

  for (const block of blocks) {
    if (block.kind === 'tbl') {
      if (!phase && !legendTable) legendTable = block
      continue
    }

    if (block.style === 'Heading2') {
      const title = block.lines.join(' ').trim()
      const m = PHASE_RE.exec(title)
      if (!m) throw new Error(`não consegui ler a faixa de nível em: "${title}"`)
      closePart()
      phase = {
        number: Number(m[1]),
        id: `phase-${m[1]}`,
        title: `Phase ${m[1]}`,
        levelFrom: Number(m[2]),
        levelTo: Number(m[3]),
        parts: [],
      }
      partNumber = 0
      phases.push(phase)
      continue
    }

    if (block.style === 'Heading3') {
      const title = block.lines.join(' ').trim()
      // Antes da primeira fase, 'Downtime Priority' é só um rótulo de seção.
      if (!phase) continue
      openPart(title)
      continue
    }

    // Tudo antes da primeira fase alimenta a lista de downtime.
    if (!phase) {
      for (const line of block.lines) {
        if (!isHeaderLine(line)) downtime.push(line)
      }
      continue
    }

    ensurePart()

    if (block.images.length > 0 && partMap === null) {
      partMap = maps[block.images[0]] ?? null
    }
    if (block.numId !== null) partBuilder.addListItem(block.lines, block.ilvl ?? 0)
    else partBuilder.addLooseLines(block.lines)
  }

  closePart()

  return {
    version,
    source,
    legend: buildLegend(legendTable),
    downtime,
    phases: phases.map(({ number, ...rest }) => rest),
  }
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run tests/guide-builder.test.mjs`
Expected: PASS — 18 testes.

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS — `tests/guide.test.ts`, `tests/docx.test.mjs` e `tests/guide-builder.test.mjs`.

- [ ] **Step 6: Commit**

```bash
git add scripts tests
git commit -m "Converte os blocos do documento em guia

Aplica a semantica: Heading2 vira fase com faixa de nivel, Heading3
vira part, itens de lista viram acoes. Separa acao de contexto pela
forma da linha, sem lista de excecoes, e infere a categoria pelo texto.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Recorte e conversão dos mapas

As 8 imagens têm letterbox preto — no mínimo uma moldura de 16 px, e até 342 px de barra. São 20,8% dos pixels. O recorte é calculado, nunca codificado por arquivo, para que uma reimportação com mapas novos continue funcionando.

**Files:**
- Create: `scripts/lib/maps.mjs`
- Test: `tests/maps.test.mjs`

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces:
  - `findContentBox(buffer, threshold?): Promise<{ left, top, width, height }>` — a caixa de conteúdo, descontadas as bordas escuras. `threshold` é a luminância média máxima para considerar um pixel escuro; padrão 24.
  - `processMap(buffer, outPath, options?): Promise<{ width, height, bytes }>` — recorta, converte para WebP e grava. `options` é `{ threshold, quality }`, com qualidade padrão 90.

- [ ] **Step 1: Instalar o `sharp`**

```bash
npm i -D sharp
```

- [ ] **Step 2: Escrever os testes que falham**

`tests/maps.test.mjs`:

```js
import { describe, it, expect } from 'vitest'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { findContentBox, processMap } from '../scripts/lib/maps.mjs'

/**
 * Gera um PNG com conteúdo colorido no meio e borda preta em volta,
 * nas espessuras pedidas.
 */
async function letterboxed({ width, height, top, bottom, left, right }) {
  const content = await sharp({
    create: {
      width: width - left - right,
      height: height - top - bottom,
      channels: 3,
      background: { r: 120, g: 160, b: 90 },
    },
  })
    .png()
    .toBuffer()

  return sharp({ create: { width, height, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .composite([{ input: content, left, top }])
    .png()
    .toBuffer()
}

describe('findContentBox', () => {
  it('acha a caixa de conteúdo de uma imagem com moldura uniforme', async () => {
    const png = await letterboxed({ width: 200, height: 100, top: 16, bottom: 16, left: 16, right: 16 })
    expect(await findContentBox(png)).toEqual({ left: 16, top: 16, width: 168, height: 68 })
  })

  it('acha a caixa com barras assimétricas', async () => {
    const png = await letterboxed({ width: 300, height: 200, top: 4, bottom: 60, left: 8, right: 100 })
    expect(await findContentBox(png)).toEqual({ left: 8, top: 4, width: 192, height: 136 })
  })

  it('devolve a imagem inteira quando não há borda', async () => {
    const png = await letterboxed({ width: 120, height: 80, top: 0, bottom: 0, left: 0, right: 0 })
    expect(await findContentBox(png)).toEqual({ left: 0, top: 0, width: 120, height: 80 })
  })

  it('não recorta cinza escuro acima do limiar', async () => {
    const png = await sharp({
      create: { width: 50, height: 50, channels: 3, background: { r: 40, g: 40, b: 40 } },
    })
      .png()
      .toBuffer()
    expect(await findContentBox(png)).toEqual({ left: 0, top: 0, width: 50, height: 50 })
  })

  it('não devolve caixa vazia para imagem toda preta', async () => {
    const png = await sharp({
      create: { width: 40, height: 40, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .png()
      .toBuffer()
    const box = await findContentBox(png)
    expect(box.width).toBeGreaterThan(0)
    expect(box.height).toBeGreaterThan(0)
  })
})

describe('processMap', () => {
  it('grava um WebP recortado e devolve as dimensões finais', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'aion2-maps-'))
    const out = join(dir, 'image1.webp')
    const png = await letterboxed({ width: 400, height: 300, top: 16, bottom: 50, left: 16, right: 120 })

    const result = await processMap(png, out)

    expect(result).toMatchObject({ width: 264, height: 234 })
    expect(result.bytes).toBeGreaterThan(0)
    const meta = await sharp(await readFile(out)).metadata()
    expect(meta.format).toBe('webp')
    expect(meta.width).toBe(264)
    expect(meta.height).toBe(234)
  })

  it('não reescala: a largura de saída é a do conteúdo recortado', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'aion2-maps-'))
    const out = join(dir, 'wide.webp')
    const png = await letterboxed({ width: 1280, height: 960, top: 16, bottom: 192, left: 16, right: 214 })
    const result = await processMap(png, out)
    expect(result.width).toBe(1050)
    expect(result.height).toBe(752)
  })
})
```

- [ ] **Step 3: Rodar os testes e confirmar que falham**

Run: `npx vitest run tests/maps.test.mjs`
Expected: FAIL — `Failed to resolve import "../scripts/lib/maps.mjs"`.

- [ ] **Step 4: Escrever o `scripts/lib/maps.mjs`**

```js
// Recorte do letterbox e conversão para WebP.
// O recorte é calculado varrendo os pixels das bordas: nenhuma dimensão
// é codificada por arquivo, então reimportar mapas novos continua funcionando.
//
// sharp().trim() não serve aqui porque usa a cor do pixel superior esquerdo
// como referência, e nessas imagens esse pixel já é conteúdo do mapa.
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import sharp from 'sharp'

const DEFAULT_THRESHOLD = 24
const DEFAULT_QUALITY = 90

/** Amostra a cada 4 pixels: o suficiente para detectar barra sólida, 4x mais rápido. */
const SAMPLE_STEP = 4

/** Luminância média do pixel em (x, y). */
function luma(data, channels, width, x, y) {
  const i = (y * width + x) * channels
  return (data[i] + data[i + 1] + data[i + 2]) / 3
}

/**
 * A caixa de conteúdo da imagem, descontadas as bordas escuras.
 * Devolve a imagem inteira se ela for escura por completo — melhor entregar
 * um mapa inútil do que uma caixa de largura zero que quebra o sharp.
 */
export async function findContentBox(buffer, threshold = DEFAULT_THRESHOLD) {
  const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info

  const darkRow = (y) => {
    for (let x = 0; x < width; x += SAMPLE_STEP) {
      if (luma(data, channels, width, x, y) > threshold) return false
    }
    return true
  }
  const darkCol = (x) => {
    for (let y = 0; y < height; y += SAMPLE_STEP) {
      if (luma(data, channels, width, x, y) > threshold) return false
    }
    return true
  }

  let top = 0
  while (top < height - 1 && darkRow(top)) top++
  let bottom = height - 1
  while (bottom > top && darkRow(bottom)) bottom--
  let left = 0
  while (left < width - 1 && darkCol(left)) left++
  let right = width - 1
  while (right > left && darkCol(right)) right--

  return { left, top, width: right - left + 1, height: bottom - top + 1 }
}

/**
 * Recorta o letterbox, converte para WebP e grava em outPath.
 * Nunca reescala: os números das setas são pequenos e precisam
 * continuar legíveis.
 */
export async function processMap(buffer, outPath, options = {}) {
  const { threshold = DEFAULT_THRESHOLD, quality = DEFAULT_QUALITY } = options
  const box = await findContentBox(buffer, threshold)
  const webp = await sharp(buffer).extract(box).webp({ quality }).toBuffer()
  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, webp)
  return { width: box.width, height: box.height, bytes: webp.length }
}
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `npx vitest run tests/maps.test.mjs`
Expected: PASS — 7 testes.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json scripts tests
git commit -m "Recorta o letterbox dos mapas e converte para WebP

As 8 imagens tem borda preta, de 16px de moldura ate 342px de barra,
somando 20,8% dos pixels. O recorte e calculado varrendo as bordas,
nunca codificado por arquivo. Sem reescalar: os numeros das setas
precisam continuar legiveis.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Importador e o `guide.json` real

Junta as três peças anteriores e produz os dados de verdade. Termina com o `data/guide.json` versionado e um teste que trava a estrutura do conteúdo real.

**Files:**
- Create: `scripts/extract-docx.mjs`
- Create: `data/guide.json` (gerado)
- Test: `tests/guide-data.test.mjs`

**Interfaces:**
- Consumes: `openDocx`, `parseRels`, `parseDocument` da Task 2; `buildGuide` da Task 3; `processMap` da Task 4; `parseGuide` da Task 1.
- Produces: `data/guide.json` e `public/maps/*.webp`. Nenhuma API nova.

- [ ] **Step 1: Escrever o `scripts/extract-docx.mjs`**

```js
#!/usr/bin/env node
// Importa o guia do .docx. Roda uma vez; depois disso data/guide.json é a
// fonte da verdade e é editado à mão. Reimportar sobrescreve essas edições.
//
// Uso: npm run extract
import { writeFile, mkdir } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { openDocx, parseRels, parseDocument } from './lib/docx.mjs'
import { buildGuide } from './lib/guide-builder.mjs'
import { processMap } from './lib/maps.mjs'

const DOCX = 'Aion 2 Level 1-45 Speedrun Guide - appJotapegs.docx'
const OUT_JSON = 'data/guide.json'
const OUT_MAPS = 'public/maps'
const SOURCE = 'Aion 2 Level 1–45 Ultimate Speedrun Guide'
const VERSION = '1.0.0'

async function main() {
  const docx = await openDocx(DOCX)
  const rels = parseRels(await docx.text('word/_rels/document.xml.rels'))
  const blocks = parseDocument(await docx.text('word/document.xml'), rels)

  // Só processa as imagens que algum bloco realmente usa.
  const used = [...new Set(blocks.flatMap((b) => b.images ?? []))].sort()
  await mkdir(OUT_MAPS, { recursive: true })

  const maps = {}
  let totalBefore = 0
  let totalAfter = 0
  for (const entry of used) {
    const name = `${basename(entry, extname(entry))}.webp`
    const buffer = await docx.buffer(`word/${entry}`)
    const result = await processMap(buffer, join(OUT_MAPS, name))
    maps[entry] = { src: `maps/${name}`, width: result.width, height: result.height }
    totalBefore += buffer.length
    totalAfter += result.bytes
    console.log(`  ${entry} -> maps/${name}  ${result.width}x${result.height}  ${(result.bytes / 1024).toFixed(0)} KB`)
  }

  const guide = buildGuide(blocks, { version: VERSION, source: SOURCE, maps })
  await mkdir('data', { recursive: true })
  await writeFile(OUT_JSON, `${JSON.stringify(guide, null, 2)}\n`, 'utf8')

  const parts = guide.phases.reduce((n, p) => n + p.parts.length, 0)
  const actions = guide.phases.reduce(
    (n, p) => n + p.parts.reduce((m, pt) => m + pt.actions.length, 0),
    0,
  )
  console.log(`\n${guide.phases.length} fases, ${parts} parts, ${actions} ações`)
  console.log(`mapas: ${(totalBefore / 1024 / 1024).toFixed(1)} MB -> ${(totalAfter / 1024 / 1024).toFixed(1)} MB`)
  console.log(`escrito: ${OUT_JSON}`)
}

main().catch((err) => {
  console.error(`falhou: ${err.message}`)
  process.exit(1)
})
```

- [ ] **Step 2: Rodar o importador**

Run: `npm run extract`
Expected: lista as 8 imagens com as dimensões recortadas (`image1` 1248x912, `image2` 1064x928, `image3` 1258x882, `image4` 1071x928, `image5` 922x928, `image6` 1050x752, `image7` 1172x928, `image8` 1205x681), depois `5 fases, 11 parts, ...` e a redução dos mapas de ~19 MB para algo em torno de 2–3 MB.

Se o número de parts não for 11, pare: a Task 3 tem um erro contra o documento real.

- [ ] **Step 3: Escrever o teste que trava o conteúdo real**

`tests/guide-data.test.mjs`:

```js
import { describe, it, expect } from 'vitest'
import { readFile, access } from 'node:fs/promises'
import { join } from 'node:path'
import { parseGuide, flattenParts } from '../src/core/guide'

const guide = parseGuide(JSON.parse(await readFile('data/guide.json', 'utf8')))

describe('data/guide.json', () => {
  it('tem as cinco fases cobrindo 1 a 45', () => {
    expect(guide.phases.map((p) => [p.levelFrom, p.levelTo])).toEqual([
      [1, 9],
      [10, 16],
      [17, 21],
      [22, 32],
      [33, 45],
    ])
  })

  it('tem 11 parts na ordem do documento', () => {
    expect(flattenParts(guide).map((f) => f.part.id)).toEqual([
      'p1-1',
      'p2-1', 'p2-2',
      'p3-1', 'p3-2', 'p3-3',
      'p4-1', 'p4-2', 'p4-3', 'p4-4',
      'p5-1',
    ])
  })

  it('liga os oito mapas às parts certas', () => {
    const byPart = Object.fromEntries(
      flattenParts(guide).map((f) => [f.part.id, f.part.map?.src ?? null]),
    )
    expect(byPart['p2-1']).toBe('maps/image3.webp')
    expect(byPart['p2-2']).toBe('maps/image7.webp')
    expect(byPart['p3-1']).toBe('maps/image1.webp')
    expect(byPart['p3-2']).toBe('maps/image4.webp')
    expect(byPart['p3-3']).toBe('maps/image5.webp')
    expect(byPart['p4-1']).toBe('maps/image6.webp')
    expect(byPart['p4-2']).toBe('maps/image8.webp')
    expect(byPart['p4-3']).toBe('maps/image2.webp')
    expect(byPart['p1-1']).toBeNull()
    expect(byPart['p4-4']).toBeNull()
    expect(byPart['p5-1']).toBeNull()
  })

  it('todo mapa referenciado existe em public/', async () => {
    for (const { part } of flattenParts(guide)) {
      if (part.map) await access(join('public', part.map.src))
    }
  })

  it('as cinco notas de kisk da fase 5 viraram ações', () => {
    const phase5 = guide.phases[4].parts[0]
    const texts = phase5.actions.flatMap((a) => [a.text, ...a.sub.map((s) => s.text)])
    expect(texts.some((t) => /Powder of Death/.test(t))).toBe(true)
    expect(texts.some((t) => /Lake of Confrontation/.test(t))).toBe(true)
    expect(texts.some((t) => /Ill Fate/.test(t))).toBe(true)
    expect(texts.some((t) => /Daybreak Society/.test(t))).toBe(true)
    expect(texts.some((t) => /Impetusium Lower Path/.test(t))).toBe(true)
  })

  it('os avisos do documento viraram note, não ação', () => {
    const p22 = flattenParts(guide).find((f) => f.part.id === 'p2-2').part
    expect(p22.note).toMatch(/first lvl8 skills/)
    const p44 = flattenParts(guide).find((f) => f.part.id === 'p4-4').part
    expect(p44.note).toMatch(/Wings from Urugugu/)
  })

  it('tem a lista de downtime com os sete itens', () => {
    expect(guide.downtime).toHaveLength(7)
    expect(guide.downtime[0]).toMatch(/Weapons/)
  })

  it('nenhuma ação está vazia ou é um cabeçalho solto', () => {
    for (const { part } of flattenParts(guide)) {
      for (const action of part.actions) {
        expect(action.text.trim()).not.toBe('')
        expect(action.text.trim().endsWith(':')).toBe(false)
      }
    }
  })
})
```

- [ ] **Step 4: Rodar o teste**

Run: `npx vitest run tests/guide-data.test.mjs`
Expected: PASS — 8 testes.

Se algum falhar, a correção vai em `scripts/lib/guide-builder.mjs` e o importador roda de novo. **Não edite o `data/guide.json` à mão para fazer o teste passar** — a esta altura ele ainda é saída de script, e uma regra errada no builder reapareceria na próxima importação.

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS — todos os arquivos de teste.

- [ ] **Step 6: Commit**

```bash
git add scripts data tests
git commit -m "Importa o guia real do .docx

Junta leitura, semantica e processamento de imagem num script so, e
versiona o data/guide.json resultante: 5 fases, 11 parts, 8 mapas.
O teste de dados trava a estrutura do conteudo real, inclusive as
notas de kisk da fase 5 que viraram acoes e os avisos que viraram note.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---
### Task 6: Lógica de progresso

O coração do app e o módulo mais importante de testar. Lógica pura: sem DOM, sem I/O, todas as funções devolvem objetos novos. É aqui que mora a regra central — **navegar nunca escreve progresso**.

**Files:**
- Create: `src/core/progress.ts`
- Test: `tests/progress.test.ts`

**Interfaces:**
- Consumes: `Guide`, `FlatPart`, `flattenParts`, `findPart` de `src/core/guide.ts`.
- Produces:
  - `type Progress = { schemaVersion: 1; currentPartId: string; completedParts: string[]; checkedActions: string[] }`
  - `initialProgress(guide: Guide): Progress`
  - `normalizeProgress(guide: Guide, raw: unknown): Progress`
  - `goToPart(guide: Guide, progress: Progress, partId: string): Progress`
  - `nextPart(guide: Guide, progress: Progress): Progress`
  - `previousPart(guide: Guide, progress: Progress): Progress`
  - `toggleAction(guide: Guide, progress: Progress, actionId: string): Progress`
  - `completeCurrent(guide: Guide, progress: Progress): Progress`
  - `resetProgress(guide: Guide): Progress`
  - `progressStats(guide: Guide, progress: Progress): { completed: number; total: number; index: number }`
  - `currentFlatPart(guide: Guide, progress: Progress): FlatPart`

- [ ] **Step 1: Escrever os testes que falham**

`tests/progress.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  initialProgress, normalizeProgress, goToPart, nextPart, previousPart,
  toggleAction, completeCurrent, resetProgress, progressStats, currentFlatPart,
} from '../src/core/progress'
import { makeGuide } from './fixtures/guide'

const guide = makeGuide()

describe('initialProgress', () => {
  it('começa na primeira part, sem nada marcado', () => {
    expect(initialProgress(guide)).toEqual({
      schemaVersion: 1,
      currentPartId: 'p1-1',
      completedParts: [],
      checkedActions: [],
    })
  })
})

describe('navegação', () => {
  it('nextPart avança uma part', () => {
    expect(nextPart(guide, initialProgress(guide)).currentPartId).toBe('p2-1')
  })

  it('nextPart na última part não sai do lugar', () => {
    const at2 = goToPart(guide, initialProgress(guide), 'p2-2')
    expect(nextPart(guide, at2).currentPartId).toBe('p2-2')
  })

  it('previousPart volta uma part', () => {
    const at2 = goToPart(guide, initialProgress(guide), 'p2-1')
    expect(previousPart(guide, at2).currentPartId).toBe('p1-1')
  })

  it('previousPart na primeira part não sai do lugar', () => {
    expect(previousPart(guide, initialProgress(guide)).currentPartId).toBe('p1-1')
  })

  it('goToPart ignora part inexistente', () => {
    const p = initialProgress(guide)
    expect(goToPart(guide, p, 'p9-9').currentPartId).toBe('p1-1')
  })

  // A regra central do app.
  it('navegar para frente e para trás não marca nada', () => {
    let p = initialProgress(guide)
    p = nextPart(guide, p)
    p = nextPart(guide, p)
    p = previousPart(guide, p)
    p = goToPart(guide, p, 'p2-2')
    p = previousPart(guide, p)
    expect(p.completedParts).toEqual([])
    expect(p.checkedActions).toEqual([])
  })

  it('não muta o progresso recebido', () => {
    const p = initialProgress(guide)
    const frozen = JSON.stringify(p)
    nextPart(guide, p)
    completeCurrent(guide, p)
    toggleAction(guide, p, 'p1-1-a1')
    expect(JSON.stringify(p)).toBe(frozen)
  })
})

describe('completeCurrent', () => {
  it('marca a part atual e avança', () => {
    const p = completeCurrent(guide, initialProgress(guide))
    expect(p.completedParts).toEqual(['p1-1'])
    expect(p.currentPartId).toBe('p2-1')
  })

  it('não duplica quando a part já estava concluída', () => {
    let p = completeCurrent(guide, initialProgress(guide))
    p = goToPart(guide, p, 'p1-1')
    p = completeCurrent(guide, p)
    expect(p.completedParts).toEqual(['p1-1'])
  })

  it('na última part marca mas não sai do lugar', () => {
    let p = goToPart(guide, initialProgress(guide), 'p2-2')
    p = completeCurrent(guide, p)
    expect(p.completedParts).toEqual(['p2-2'])
    expect(p.currentPartId).toBe('p2-2')
  })
})

describe('toggleAction', () => {
  it('marca e desmarca', () => {
    let p = toggleAction(guide, initialProgress(guide), 'p1-1-a1')
    expect(p.checkedActions).toEqual(['p1-1-a1'])
    p = toggleAction(guide, p, 'p1-1-a1')
    expect(p.checkedActions).toEqual([])
  })

  it('marca sub-ação', () => {
    const p = toggleAction(guide, initialProgress(guide), 'p2-1-a2-s1')
    expect(p.checkedActions).toEqual(['p2-1-a2-s1'])
  })

  it('ignora id inexistente', () => {
    expect(toggleAction(guide, initialProgress(guide), 'nada').checkedActions).toEqual([])
  })

  it('não avança nem marca a part', () => {
    const p = toggleAction(guide, initialProgress(guide), 'p1-1-a1')
    expect(p.currentPartId).toBe('p1-1')
    expect(p.completedParts).toEqual([])
  })
})

describe('normalizeProgress', () => {
  it('aceita um progresso válido', () => {
    const saved = { schemaVersion: 1, currentPartId: 'p2-1', completedParts: ['p1-1'], checkedActions: ['p1-1-a1'] }
    expect(normalizeProgress(guide, saved)).toEqual(saved)
  })

  it('currentPartId desconhecido cai na primeira part não concluída', () => {
    const saved = { schemaVersion: 1, currentPartId: 'p9-9', completedParts: ['p1-1'], checkedActions: [] }
    expect(normalizeProgress(guide, saved).currentPartId).toBe('p2-1')
  })

  it('currentPartId desconhecido com tudo concluído cai na primeira part', () => {
    const saved = {
      schemaVersion: 1,
      currentPartId: 'p9-9',
      completedParts: ['p1-1', 'p2-1', 'p2-2'],
      checkedActions: [],
    }
    expect(normalizeProgress(guide, saved).currentPartId).toBe('p1-1')
  })

  it('descarta ids que não existem mais', () => {
    const saved = {
      schemaVersion: 1,
      currentPartId: 'p1-1',
      completedParts: ['p1-1', 'removida'],
      checkedActions: ['p1-1-a1', 'sumiu'],
    }
    const p = normalizeProgress(guide, saved)
    expect(p.completedParts).toEqual(['p1-1'])
    expect(p.checkedActions).toEqual(['p1-1-a1'])
  })

  it('schemaVersion diferente recomeça do zero', () => {
    const saved = { schemaVersion: 99, currentPartId: 'p2-1', completedParts: ['p1-1'], checkedActions: [] }
    expect(normalizeProgress(guide, saved)).toEqual(initialProgress(guide))
  })

  it('lixo recomeça do zero', () => {
    expect(normalizeProgress(guide, null)).toEqual(initialProgress(guide))
    expect(normalizeProgress(guide, 'nada')).toEqual(initialProgress(guide))
    expect(normalizeProgress(guide, { currentPartId: 5 })).toEqual(initialProgress(guide))
    expect(normalizeProgress(guide, { schemaVersion: 1, currentPartId: 'p1-1', completedParts: 'x', checkedActions: [] }))
      .toEqual(initialProgress(guide))
  })
})

describe('resetProgress', () => {
  it('volta ao estado inicial', () => {
    expect(resetProgress(guide)).toEqual(initialProgress(guide))
  })
})

describe('progressStats', () => {
  it('conta parts concluídas, total e a posição atual', () => {
    let p = completeCurrent(guide, initialProgress(guide))
    expect(progressStats(guide, p)).toEqual({ completed: 1, total: 3, index: 1 })
  })

  it('ignora parts concluídas que não existem mais', () => {
    const saved = { schemaVersion: 1, currentPartId: 'p1-1', completedParts: ['p1-1', 'fantasma'], checkedActions: [] }
    const p = normalizeProgress(guide, saved)
    expect(progressStats(guide, p).completed).toBe(1)
  })
})

describe('currentFlatPart', () => {
  it('devolve a part atual com sua fase', () => {
    const flat = currentFlatPart(guide, goToPart(guide, initialProgress(guide), 'p2-2'))
    expect(flat.part.id).toBe('p2-2')
    expect(flat.phase.id).toBe('phase-2')
    expect(flat.index).toBe(2)
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run tests/progress.test.ts`
Expected: FAIL — `Failed to resolve import "../src/core/progress"`.

- [ ] **Step 3: Escrever o `src/core/progress.ts`**

```ts
import { type Guide, type FlatPart, flattenParts, findPart } from './guide'

export type Progress = {
  schemaVersion: 1
  currentPartId: string
  completedParts: string[]
  checkedActions: string[]
}

const SCHEMA_VERSION = 1

/** Todos os ids de ação do guia, incluindo sub-ações. */
function allActionIds(guide: Guide): Set<string> {
  const ids = new Set<string>()
  const walk = (actions: { id: string; sub: { id: string; sub: unknown[] }[] }[]): void => {
    for (const a of actions) {
      ids.add(a.id)
      walk(a.sub as never)
    }
  }
  for (const { part } of flattenParts(guide)) walk(part.actions as never)
  return ids
}

export function initialProgress(guide: Guide): Progress {
  const flat = flattenParts(guide)
  return {
    schemaVersion: SCHEMA_VERSION,
    currentPartId: flat[0].part.id,
    completedParts: [],
    checkedActions: [],
  }
}

/**
 * Converte dados vindos do disco num Progress confiável.
 * Qualquer inconsistência é resolvida silenciosamente: progresso perdido é
 * chato, mas travar o app por causa de um id órfão é pior.
 */
export function normalizeProgress(guide: Guide, raw: unknown): Progress {
  if (typeof raw !== 'object' || raw === null) return initialProgress(guide)
  const r = raw as Record<string, unknown>
  if (r.schemaVersion !== SCHEMA_VERSION) return initialProgress(guide)
  if (typeof r.currentPartId !== 'string') return initialProgress(guide)
  if (!Array.isArray(r.completedParts) || !Array.isArray(r.checkedActions)) {
    return initialProgress(guide)
  }

  const flat = flattenParts(guide)
  const partIds = new Set(flat.map((f) => f.part.id))
  const actionIds = allActionIds(guide)

  const completedParts = r.completedParts.filter(
    (id): id is string => typeof id === 'string' && partIds.has(id),
  )
  const checkedActions = r.checkedActions.filter(
    (id): id is string => typeof id === 'string' && actionIds.has(id),
  )

  let currentPartId = r.currentPartId
  if (!partIds.has(currentPartId)) {
    const pending = flat.find((f) => !completedParts.includes(f.part.id))
    currentPartId = (pending ?? flat[0]).part.id
  }

  return { schemaVersion: SCHEMA_VERSION, currentPartId, completedParts, checkedActions }
}

export function currentFlatPart(guide: Guide, progress: Progress): FlatPart {
  return findPart(guide, progress.currentPartId) ?? flattenParts(guide)[0]
}

/** Move para uma part. Não toca em nada além da posição. */
export function goToPart(guide: Guide, progress: Progress, partId: string): Progress {
  if (!findPart(guide, partId)) return progress
  return { ...progress, currentPartId: partId }
}

function step(guide: Guide, progress: Progress, delta: number): Progress {
  const flat = flattenParts(guide)
  const here = currentFlatPart(guide, progress)
  const target = flat[here.index + delta]
  if (!target) return progress
  return { ...progress, currentPartId: target.part.id }
}

export function nextPart(guide: Guide, progress: Progress): Progress {
  return step(guide, progress, 1)
}

export function previousPart(guide: Guide, progress: Progress): Progress {
  return step(guide, progress, -1)
}

/** Marca ou desmarca uma ação. Não avança e não conclui a part. */
export function toggleAction(guide: Guide, progress: Progress, actionId: string): Progress {
  if (!allActionIds(guide).has(actionId)) return progress
  const checked = progress.checkedActions.includes(actionId)
  return {
    ...progress,
    checkedActions: checked
      ? progress.checkedActions.filter((id) => id !== actionId)
      : [...progress.checkedActions, actionId],
  }
}

/** Conclui a part atual e avança. Na última part, marca e fica. */
export function completeCurrent(guide: Guide, progress: Progress): Progress {
  const id = currentFlatPart(guide, progress).part.id
  const completedParts = progress.completedParts.includes(id)
    ? progress.completedParts
    : [...progress.completedParts, id]
  return { ...step(guide, progress, 1), completedParts }
}

export function resetProgress(guide: Guide): Progress {
  return initialProgress(guide)
}

export function progressStats(
  guide: Guide,
  progress: Progress,
): { completed: number; total: number; index: number } {
  const flat = flattenParts(guide)
  const partIds = new Set(flat.map((f) => f.part.id))
  return {
    completed: progress.completedParts.filter((id) => partIds.has(id)).length,
    total: flat.length,
    index: currentFlatPart(guide, progress).index,
  }
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run tests/progress.test.ts`
Expected: PASS — 24 testes.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "Adiciona a logica de progresso

Funcoes puras sobre o guia: navegar, marcar acao, concluir part,
resetar. Navegar nunca escreve progresso, so concluir escreve, e
normalizeProgress recupera silenciosamente de ids orfaos em vez de
travar o app.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Persistência e ajustes

O núcleo precisa salvar sem saber onde. Define o contrato da ponte com o Electron e duas implementações: uma que fala com `window.aion`, outra que usa `localStorage`. A ponte ainda não existe do lado do Electron — a Task 11 a implementa contra este mesmo tipo.

**Files:**
- Create: `src/core/bridge.ts`
- Create: `src/core/settings.ts`
- Create: `src/core/storage.ts`
- Test: `tests/storage.test.ts`
- Test: `tests/settings.test.ts`

**Interfaces:**
- Consumes: `Progress` de `src/core/progress.ts`.
- Produces:
  - `type HotkeyAction = 'next' | 'prev' | 'complete' | 'map' | 'hide' | 'clickthrough'`
  - `type AionBridge` — o contrato de `window.aion`, com `loadProgress()`, `saveProgress(p)`, `loadSettings()`, `saveSettings(s)`, `setOpacity(v)`, `setClickThrough(on)`, `minimize()`, `close()`, `onHotkey(cb)`.
  - `getBridge(): AionBridge | null`
  - `type Settings = { schemaVersion: 1; opacity: number; clickThrough: boolean }`, `DEFAULT_SETTINGS`, `normalizeSettings(raw)`, `OPACITY_MIN`, `OPACITY_MAX`
  - `type Store` com `loadProgress()`, `saveProgress(p)`, `loadSettings()`, `saveSettings(s)` — todos assíncronos — e `createStore(): Store`

- [ ] **Step 1: Escrever o `src/core/bridge.ts`**

Sem teste próprio: é só declaração de tipos e uma leitura de `window`. Quem exercita isso são os testes de `storage.ts`.

```ts
import type { Progress } from './progress'
import type { Settings } from './settings'

export type HotkeyAction = 'next' | 'prev' | 'complete' | 'map' | 'hide' | 'clickthrough'

/**
 * O contrato entre o núcleo web e a casca Electron.
 * `electron/preload.ts` implementa exatamente isto; não mude um lado só.
 */
export type AionBridge = {
  loadProgress(): Promise<unknown>
  saveProgress(progress: Progress): Promise<void>
  loadSettings(): Promise<unknown>
  saveSettings(settings: Settings): Promise<void>
  setOpacity(value: number): void
  setClickThrough(enabled: boolean): void
  minimize(): void
  close(): void
  onHotkey(callback: (action: HotkeyAction) => void): void
}

declare global {
  interface Window {
    aion?: AionBridge
  }
}

/** A ponte, ou null quando rodando no navegador. */
export function getBridge(): AionBridge | null {
  return typeof window !== 'undefined' && window.aion ? window.aion : null
}
```

- [ ] **Step 2: Escrever os testes de ajustes que falham**

`tests/settings.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { normalizeSettings, DEFAULT_SETTINGS, OPACITY_MIN, OPACITY_MAX } from '../src/core/settings'

describe('normalizeSettings', () => {
  it('aceita ajustes válidos', () => {
    const s = { schemaVersion: 1, opacity: 0.7, clickThrough: true }
    expect(normalizeSettings(s)).toEqual(s)
  })

  it('usa o padrão para lixo', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings('x')).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings({ schemaVersion: 2, opacity: 0.5, clickThrough: false })).toEqual(DEFAULT_SETTINGS)
  })

  it('limita a opacidade à faixa utilizável', () => {
    expect(normalizeSettings({ schemaVersion: 1, opacity: 0, clickThrough: false }).opacity).toBe(OPACITY_MIN)
    expect(normalizeSettings({ schemaVersion: 1, opacity: 5, clickThrough: false }).opacity).toBe(OPACITY_MAX)
  })

  it('opacidade não numérica volta ao padrão', () => {
    expect(normalizeSettings({ schemaVersion: 1, opacity: 'meia', clickThrough: false }).opacity)
      .toBe(DEFAULT_SETTINGS.opacity)
  })

  it('clickThrough não booleano volta ao padrão', () => {
    expect(normalizeSettings({ schemaVersion: 1, opacity: 0.8, clickThrough: 'sim' }).clickThrough).toBe(false)
  })

  it('o padrão nunca é invisível', () => {
    expect(DEFAULT_SETTINGS.opacity).toBeGreaterThanOrEqual(OPACITY_MIN)
    expect(DEFAULT_SETTINGS.clickThrough).toBe(false)
  })
})
```

- [ ] **Step 3: Escrever o `src/core/settings.ts`**

```ts
/** Abaixo de 0.3 o overlay vira um fantasma inútil. */
export const OPACITY_MIN = 0.3
export const OPACITY_MAX = 1

export type Settings = {
  schemaVersion: 1
  opacity: number
  clickThrough: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: 1,
  opacity: 0.92,
  clickThrough: false,
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function normalizeSettings(raw: unknown): Settings {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_SETTINGS }
  const r = raw as Record<string, unknown>
  if (r.schemaVersion !== 1) return { ...DEFAULT_SETTINGS }
  return {
    schemaVersion: 1,
    opacity:
      typeof r.opacity === 'number' && Number.isFinite(r.opacity)
        ? clamp(r.opacity, OPACITY_MIN, OPACITY_MAX)
        : DEFAULT_SETTINGS.opacity,
    clickThrough: typeof r.clickThrough === 'boolean' ? r.clickThrough : DEFAULT_SETTINGS.clickThrough,
  }
}
```

- [ ] **Step 4: Escrever os testes de armazenamento que falham**

`tests/storage.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createStore, PROGRESS_KEY, SETTINGS_KEY } from '../src/core/storage'
import { DEFAULT_SETTINGS } from '../src/core/settings'
import { initialProgress } from '../src/core/progress'
import { makeGuide } from './fixtures/guide'

/** localStorage mínimo em memória, mais um interruptor para simular bloqueio. */
function fakeLocalStorage() {
  const data = new Map<string, string>()
  let blocked = false
  return {
    block: () => { blocked = true },
    store: {
      getItem: (k: string) => {
        if (blocked) throw new Error('bloqueado')
        return data.get(k) ?? null
      },
      setItem: (k: string, v: string) => {
        if (blocked) throw new Error('bloqueado')
        data.set(k, v)
      },
      removeItem: (k: string) => { data.delete(k) },
    },
  }
}

const progress = initialProgress(makeGuide())

beforeEach(() => {
  vi.stubGlobal('window', {})
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createStore no navegador', () => {
  it('grava e lê o progresso no localStorage', async () => {
    const fake = fakeLocalStorage()
    vi.stubGlobal('localStorage', fake.store)
    const store = createStore()
    await store.saveProgress(progress)
    expect(await store.loadProgress()).toEqual(progress)
  })

  it('devolve null quando não há nada gravado', async () => {
    vi.stubGlobal('localStorage', fakeLocalStorage().store)
    expect(await createStore().loadProgress()).toBeNull()
  })

  it('devolve null para JSON corrompido em vez de explodir', async () => {
    const fake = fakeLocalStorage()
    fake.store.setItem(PROGRESS_KEY, '{isso não é json')
    vi.stubGlobal('localStorage', fake.store)
    expect(await createStore().loadProgress()).toBeNull()
  })

  it('sobrevive a localStorage bloqueado', async () => {
    const fake = fakeLocalStorage()
    fake.block()
    vi.stubGlobal('localStorage', fake.store)
    const store = createStore()
    await expect(store.saveProgress(progress)).resolves.toBeUndefined()
    expect(await store.loadProgress()).toBeNull()
  })

  it('grava e lê os ajustes', async () => {
    vi.stubGlobal('localStorage', fakeLocalStorage().store)
    const store = createStore()
    await store.saveSettings({ ...DEFAULT_SETTINGS, opacity: 0.5 })
    expect(await store.loadSettings()).toMatchObject({ opacity: 0.5 })
  })

  it('usa chaves distintas para progresso e ajustes', () => {
    expect(PROGRESS_KEY).not.toBe(SETTINGS_KEY)
  })
})

describe('createStore no Electron', () => {
  it('delega para a ponte quando window.aion existe', async () => {
    const bridge = {
      loadProgress: vi.fn().mockResolvedValue(progress),
      saveProgress: vi.fn().mockResolvedValue(undefined),
      loadSettings: vi.fn().mockResolvedValue(DEFAULT_SETTINGS),
      saveSettings: vi.fn().mockResolvedValue(undefined),
      setOpacity: vi.fn(),
      setClickThrough: vi.fn(),
      minimize: vi.fn(),
      close: vi.fn(),
      onHotkey: vi.fn(),
    }
    vi.stubGlobal('window', { aion: bridge })
    vi.stubGlobal('localStorage', fakeLocalStorage().store)

    const store = createStore()
    await store.saveProgress(progress)
    expect(bridge.saveProgress).toHaveBeenCalledWith(progress)
    expect(await store.loadProgress()).toEqual(progress)
    expect(bridge.loadProgress).toHaveBeenCalled()
  })

  it('cai para null se a ponte falhar', async () => {
    const bridge = {
      loadProgress: vi.fn().mockRejectedValue(new Error('disco cheio')),
      saveProgress: vi.fn().mockRejectedValue(new Error('disco cheio')),
      loadSettings: vi.fn().mockRejectedValue(new Error('disco cheio')),
      saveSettings: vi.fn().mockRejectedValue(new Error('disco cheio')),
      setOpacity: vi.fn(),
      setClickThrough: vi.fn(),
      minimize: vi.fn(),
      close: vi.fn(),
      onHotkey: vi.fn(),
    }
    vi.stubGlobal('window', { aion: bridge })
    const store = createStore()
    expect(await store.loadProgress()).toBeNull()
    await expect(store.saveProgress(progress)).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 5: Escrever o `src/core/storage.ts`**

```ts
import { getBridge } from './bridge'
import type { Progress } from './progress'
import type { Settings } from './settings'

export const PROGRESS_KEY = 'aion2guide.progress'
export const SETTINGS_KEY = 'aion2guide.settings'

export type Store = {
  loadProgress(): Promise<unknown>
  saveProgress(progress: Progress): Promise<void>
  loadSettings(): Promise<unknown>
  saveSettings(settings: Settings): Promise<void>
}

/**
 * Persistir é melhor-esforço. Uma falha de disco ou um localStorage bloqueado
 * não podem derrubar o overlay no meio de um run: o pior caso é perder
 * progresso, e para isso normalizeProgress já tem resposta.
 */
async function attempt<T>(fn: () => Promise<T> | T, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch {
    return fallback
  }
}

function webStore(): Store {
  const read = (key: string): unknown =>
    attemptSync(() => {
      const raw = localStorage.getItem(key)
      return raw === null ? null : JSON.parse(raw)
    })

  function attemptSync(fn: () => unknown): unknown {
    try {
      return fn()
    } catch {
      return null
    }
  }

  const write = (key: string, value: unknown): void => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Janela anônima, dados bloqueados: seguir sem persistir.
    }
  }

  return {
    async loadProgress() { return read(PROGRESS_KEY) },
    async saveProgress(progress) { write(PROGRESS_KEY, progress) },
    async loadSettings() { return read(SETTINGS_KEY) },
    async saveSettings(settings) { write(SETTINGS_KEY, settings) },
  }
}

function electronStore(): Store {
  const bridge = getBridge()!
  return {
    loadProgress: () => attempt(() => bridge.loadProgress(), null),
    saveProgress: (p) => attempt(async () => { await bridge.saveProgress(p) }, undefined),
    loadSettings: () => attempt(() => bridge.loadSettings(), null),
    saveSettings: (s) => attempt(async () => { await bridge.saveSettings(s) }, undefined),
  }
}

/** Escolhe a implementação pela presença da ponte do Electron. */
export function createStore(): Store {
  return getBridge() ? electronStore() : webStore()
}
```

- [ ] **Step 6: Rodar os testes e confirmar que passam**

Run: `npx vitest run tests/settings.test.ts tests/storage.test.ts`
Expected: PASS — 14 testes.

- [ ] **Step 7: Rodar a suíte inteira e checar os tipos**

Run: `npm test && npx tsc --noEmit`
Expected: PASS nos testes e nenhum erro de tipo.

- [ ] **Step 8: Commit**

```bash
git add src tests
git commit -m "Adiciona persistencia e ajustes

Define o contrato da ponte com o Electron e duas implementacoes de
armazenamento: window.aion quando existe, localStorage no navegador.
Persistir e melhor-esforco: disco cheio ou dados bloqueados nao podem
derrubar o overlay no meio de um run.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---
### Task 8: O card compacto

O primeiro momento em que isto vira um app. Ao fim desta task, `npm run dev` abre o guia real no navegador e a navegação funciona.

O card desta task tem cabeçalho, corpo e rodapé. Os botões de mapa, painéis e ajustes chegam nas tasks 9, 10 e 12 — cada uma acrescenta o seu.

**Files:**
- Create: `index.html`
- Create: `src/styles/base.css`
- Create: `src/styles/card.css`
- Create: `src/ui/dom.ts`
- Create: `src/ui/card.ts`
- Create: `src/main.ts`
- Test: `tests/dom.test.ts`

**Interfaces:**
- Consumes: tudo de `src/core/`.
- Produces:
  - `el(tag, attrs?, children?): HTMLElement` em `src/ui/dom.ts` — `attrs` aceita `class`, `title`, `disabled`, `data-*` e `onclick`; `children` aceita strings e elementos. Strings viram `textContent`, nunca HTML.
  - `type CardHandlers = { onPrev(): void; onNext(): void; onComplete(): void; onToggleAction(actionId: string): void; onClose(): void }`
  - `renderCard(root: HTMLElement, guide: Guide, progress: Progress, handlers: CardHandlers): void` — esvazia `root` e redesenha. Com onze parts e uma dezena de ações, redesenhar inteiro é mais simples e mais barato do que reconciliar.

- [ ] **Step 1: Escrever o teste do helper de DOM que falha**

O único pedaço da interface que vale testar sozinho: é ele que garante que texto de guia com `<` ou `&` não vire HTML.

`tests/dom.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { el } from '../src/ui/dom'

describe('el', () => {
  it('cria elemento com classe e texto', () => {
    const node = el('span', { class: 'titulo' }, ['Part 1'])
    expect(node.tagName).toBe('SPAN')
    expect(node.className).toBe('titulo')
    expect(node.textContent).toBe('Part 1')
  })

  it('trata string como texto, nunca como HTML', () => {
    const node = el('div', {}, ['<b>MSQ</b> & Seal'])
    expect(node.querySelector('b')).toBeNull()
    expect(node.textContent).toBe('<b>MSQ</b> & Seal')
  })

  it('aninha elementos', () => {
    const node = el('div', {}, [el('span', {}, ['a']), el('span', {}, ['b'])])
    expect(node.children).toHaveLength(2)
  })

  it('liga o onclick', () => {
    const spy = vi.fn()
    const node = el('button', { onclick: spy })
    node.click()
    expect(spy).toHaveBeenCalledOnce()
  })

  it('aplica disabled e atributos data', () => {
    const node = el('button', { disabled: true, 'data-id': 'p4-1' })
    expect((node as HTMLButtonElement).disabled).toBe(true)
    expect(node.dataset.id).toBe('p4-1')
  })

  it('ignora atributo com valor false ou null', () => {
    const node = el('button', { disabled: false, title: null })
    expect((node as HTMLButtonElement).disabled).toBe(false)
    expect(node.hasAttribute('title')).toBe(false)
  })
})
```

- [ ] **Step 2: Instalar o jsdom e habilitá-lo por arquivo**

O Vitest está em `environment: 'node'`. O comentário `@vitest-environment jsdom` no topo do arquivo troca só para ele, mantendo os testes de dados rápidos.

```bash
npm i -D jsdom
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `npx vitest run tests/dom.test.ts`
Expected: FAIL — `Failed to resolve import "../src/ui/dom"`.

- [ ] **Step 4: Escrever o `src/ui/dom.ts`**

```ts
type Attrs = Record<string, string | number | boolean | null | undefined | ((e: Event) => void)>
type Child = string | Node

/**
 * Cria um elemento. Strings viram texto, nunca HTML — o conteúdo do guia
 * tem parênteses, aspas e '&', e nada disso deve ser interpretado.
 */
export function el(tag: string, attrs: Attrs = {}, children: Child[] = []): HTMLElement {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue
    if (key === 'onclick' && typeof value === 'function') {
      node.addEventListener('click', value)
    } else if (key === 'disabled') {
      ;(node as HTMLButtonElement).disabled = Boolean(value)
    } else {
      node.setAttribute(key, String(value))
    }
  }
  for (const child of children) {
    node.append(typeof child === 'string' ? document.createTextNode(child) : child)
  }
  return node
}

/** Esvazia um elemento. */
export function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild)
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npx vitest run tests/dom.test.ts`
Expected: PASS — 6 testes.

- [ ] **Step 6: Escrever o `index.html`**

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Aion 2 Speedrun</title>
  </head>
  <body>
    <div id="overlay"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 7: Escrever o `src/styles/base.css`**

O fundo do `body` é transparente: no Electron é a janela que aparece atrás, e no navegador o card fica sobre o cinza da página.

```css
:root {
  --glass: rgba(13, 16, 23, 0.86);
  --glass-strong: rgba(13, 16, 23, 0.96);
  --stroke: rgba(255, 255, 255, 0.1);
  --stroke-strong: rgba(255, 255, 255, 0.18);
  --text: #e9edf5;
  --text-dim: #9aa4b8;
  --accent: #6fd3ff;
  --done: #5cc46a;
  --radius: 12px;
  --gap: 10px;
  --font: 'Segoe UI', system-ui, -apple-system, sans-serif;

  /* Preenchidas a partir da legenda do guia, em main.ts. */
  --tag-msq: #f0c040;
  --tag-side: #5cc46a;
  --tag-seal: #ff8a3d;
  --tag-kisk: #c8d0e0;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  height: 100%;
  background: transparent;
  font-family: var(--font);
  color: var(--text);
  font-size: 13px;
  /* O fundo é um jogo em movimento: sem isto o texto some em cena clara. */
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.75);
  overflow: hidden;
  user-select: none;
}

button {
  font: inherit;
  color: inherit;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

button:disabled {
  opacity: 0.32;
  cursor: default;
}
```

- [ ] **Step 8: Escrever o `src/styles/card.css`**

```css
.card {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--glass);
  backdrop-filter: blur(20px) saturate(1.25);
  border: 1px solid var(--stroke);
  border-radius: var(--radius);
  overflow: hidden;
}

/* Faixa de arrasto. O -webkit-app-region só faz efeito no Electron. */
.card__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--stroke);
  -webkit-app-region: drag;
}

.card__phase {
  font-weight: 700;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.card__levels {
  color: var(--text-dim);
  font-variant-numeric: tabular-nums;
}

.card__tools {
  margin-left: auto;
  display: flex;
  gap: 2px;
  -webkit-app-region: no-drag;
}

.card__tool {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  color: var(--text-dim);
  font-size: 14px;
  line-height: 1;
}

.card__tool:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text);
}

.card__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card__title {
  font-weight: 600;
  color: var(--accent);
}

.card__note {
  color: var(--text-dim);
  font-style: italic;
  line-height: 1.35;
  padding-left: 8px;
  border-left: 2px solid var(--stroke-strong);
}

.actions {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.actions--sub {
  margin-top: 6px;
  padding-left: 16px;
  gap: 4px;
}

.action {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  text-align: left;
  line-height: 1.35;
  /* Toque confortável mesmo com fonte pequena. */
  min-height: 24px;
  padding: 2px 4px;
  border-radius: 6px;
  border-left: 2px solid transparent;
}

.action:hover {
  background: rgba(255, 255, 255, 0.05);
}

.action--msq { border-left-color: var(--tag-msq); }
.action--side { border-left-color: var(--tag-side); }
.action--seal { border-left-color: var(--tag-seal); }
.action--kisk { border-left-color: var(--tag-kisk); }

.action__box {
  flex: none;
  width: 13px;
  height: 13px;
  margin-top: 2px;
  border: 1.5px solid var(--stroke-strong);
  border-radius: 3px;
  display: grid;
  place-items: center;
  font-size: 10px;
  line-height: 1;
  color: var(--done);
}

.action--checked .action__box {
  border-color: var(--done);
}

.action--checked .action__text {
  color: var(--text-dim);
  text-decoration: line-through;
}

.card__foot {
  border-top: 1px solid var(--stroke);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  -webkit-app-region: no-drag;
}

.nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav__arrow {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  color: var(--text-dim);
}

.nav__arrow:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text);
}

.nav__complete {
  flex: 1;
  height: 28px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 0.04em;
  background: rgba(111, 211, 255, 0.14);
  border: 1px solid rgba(111, 211, 255, 0.3);
  color: var(--accent);
}

.nav__complete:hover {
  background: rgba(111, 211, 255, 0.22);
}

.nav__complete--done {
  background: rgba(92, 196, 106, 0.14);
  border-color: rgba(92, 196, 106, 0.3);
  color: var(--done);
}

.meter {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-dim);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.meter__track {
  flex: 1;
  height: 3px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.1);
  overflow: hidden;
}

.meter__fill {
  height: 100%;
  background: var(--done);
  transition: width 160ms ease-out;
}
```

- [ ] **Step 9: Escrever o `src/ui/card.ts`**

```ts
import type { Action, Guide } from '../core/guide'
import { type Progress, currentFlatPart, progressStats } from '../core/progress'
import { el, clear } from './dom'

export type CardHandlers = {
  onPrev(): void
  onNext(): void
  onComplete(): void
  onToggleAction(actionId: string): void
  onClose(): void
}

function renderAction(action: Action, progress: Progress, handlers: CardHandlers): HTMLElement {
  const checked = progress.checkedActions.includes(action.id)
  const classes = ['action']
  if (action.tag) classes.push(`action--${action.tag}`)
  if (checked) classes.push('action--checked')

  const row = el('button', {
    class: classes.join(' '),
    'data-id': action.id,
    'aria-pressed': String(checked),
    onclick: () => handlers.onToggleAction(action.id),
  }, [
    el('span', { class: 'action__box', 'aria-hidden': 'true' }, [checked ? '✓' : '']),
    el('span', { class: 'action__text' }, [action.text]),
  ])

  if (action.sub.length === 0) return el('li', {}, [row])

  return el('li', {}, [
    row,
    el('ul', { class: 'actions actions--sub' }, action.sub.map((s) => renderAction(s, progress, handlers))),
  ])
}

/** Esvazia root e redesenha o card inteiro. */
export function renderCard(
  root: HTMLElement,
  guide: Guide,
  progress: Progress,
  handlers: CardHandlers,
): void {
  const { part, phase, index } = currentFlatPart(guide, progress)
  const { completed, total } = progressStats(guide, progress)
  const done = progress.completedParts.includes(part.id)

  const head = el('header', { class: 'card__head' }, [
    el('span', { class: 'card__phase' }, [phase.title]),
    el('span', { class: 'card__levels' }, [`${phase.levelFrom}–${phase.levelTo}`]),
    el('div', { class: 'card__tools' }, [
      el('button', { class: 'card__tool', title: 'Fechar', onclick: handlers.onClose }, ['✕']),
    ]),
  ])

  const body = el('div', { class: 'card__body' }, [
    el('div', { class: 'card__title' }, [part.title]),
    ...(part.note ? [el('div', { class: 'card__note' }, [part.note])] : []),
    el('ul', { class: 'actions' }, part.actions.map((a) => renderAction(a, progress, handlers))),
  ])

  const foot = el('footer', { class: 'card__foot' }, [
    el('div', { class: 'nav' }, [
      el('button', {
        class: 'nav__arrow',
        title: 'Part anterior',
        disabled: index === 0,
        onclick: handlers.onPrev,
      }, ['◀']),
      el('button', {
        class: `nav__complete${done ? ' nav__complete--done' : ''}`,
        onclick: handlers.onComplete,
      }, [done ? '✓ CONCLUÍDA' : 'CONCLUIR']),
      el('button', {
        class: 'nav__arrow',
        title: 'Próxima part',
        disabled: index === total - 1,
        onclick: handlers.onNext,
      }, ['▶']),
    ]),
    el('div', { class: 'meter' }, [
      el('span', {}, [`${index + 1}/${total}`]),
      el('div', { class: 'meter__track' }, [
        el('div', { class: 'meter__fill', style: `width: ${(completed / total) * 100}%` }),
      ]),
      el('span', {}, [`${completed} feitas`]),
    ]),
  ])

  clear(root)
  root.append(el('div', { class: 'card' }, [head, body, foot]))
}
```

- [ ] **Step 10: Escrever o `src/main.ts`**

```ts
import './styles/base.css'
import './styles/card.css'
import rawGuide from '../data/guide.json'
import { parseGuide } from './core/guide'
import { type Progress, normalizeProgress, nextPart, previousPart, toggleAction, completeCurrent } from './core/progress'
import { createStore } from './core/storage'
import { getBridge } from './core/bridge'
import { renderCard, type CardHandlers } from './ui/card'

const guide = parseGuide(rawGuide)
const store = createStore()
const root = document.querySelector<HTMLElement>('#overlay')!

let progress: Progress = normalizeProgress(guide, null)

/** Aplica uma transição, redesenha e persiste. */
function update(next: Progress): void {
  progress = next
  render()
  void store.saveProgress(progress)
}

const handlers: CardHandlers = {
  onPrev: () => update(previousPart(guide, progress)),
  onNext: () => update(nextPart(guide, progress)),
  onComplete: () => update(completeCurrent(guide, progress)),
  onToggleAction: (id) => update(toggleAction(guide, progress, id)),
  onClose: () => getBridge()?.close(),
}

function render(): void {
  renderCard(root, guide, progress, handlers)
}

/** As cores da interface vêm da legenda do guia, não de constantes no CSS. */
function applyLegendColors(): void {
  for (const entry of guide.legend) {
    document.documentElement.style.setProperty(`--tag-${entry.id}`, entry.uiColor)
  }
}

async function start(): Promise<void> {
  applyLegendColors()
  progress = normalizeProgress(guide, await store.loadProgress())
  render()
}

void start()
```

- [ ] **Step 11: Rodar no navegador e conferir**

Run: `npm run dev`

Abra o endereço que o Vite imprimir e confirme, um a um:
1. Abre na Fase 1, "Levels 1–9", com a ação "Follow core MSQ".
2. `▶` avança para a Fase 2 Part 1; a barrinha colorida aparece à esquerda das ações.
3. A Part 2 da Fase 2 mostra a nota "You get your first lvl8 skills here!" em itálico, sem checkbox.
4. Clicar numa ação risca o texto; clicar de novo desfaz.
5. `CONCLUIR` marca, vira "✓ CONCLUÍDA" ao voltar, e o contador de feitas sobe.
6. `◀` está desabilitado na primeira part, `▶` na última.
7. Recarregar a página mantém a posição e as marcações.
8. **A prova da regra central:** navegue do começo ao fim com `▶` e volte com `◀` sem clicar em CONCLUIR. O contador precisa continuar em `0 feitas`.

- [ ] **Step 12: Verificar o build e os tipos**

Run: `npm run build`
Expected: `tsc --noEmit` sem erros e o Vite gerando `dist/`.

- [ ] **Step 13: Commit**

```bash
git add package.json package-lock.json index.html src tests
git commit -m "Adiciona o card compacto e liga o app

Primeira versao utilizavel: o guia real abre no navegador, navega entre
as 11 parts, marca acoes e persiste. As cores das barrinhas vem da
legenda do proprio guia, nao de constantes no CSS. Notas aparecem como
contexto, sem checkbox.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: O mapa sob demanda

O mapa é o conteúdo mais importante e o que menos cabe num card de 360 px. Abre sobrepondo o card inteiro, com zoom e arrasto, e fecha com `Esc`.

**Files:**
- Create: `src/ui/mapModal.ts`
- Create: `src/styles/map.css`
- Modify: `src/ui/card.ts` — acrescenta o botão de mapa ao cabeçalho
- Modify: `src/main.ts` — liga o botão e o `Esc`
- Test: `tests/mapModal.test.ts`

**Interfaces:**
- Consumes: `MapRef` de `src/core/guide.ts`; `el`, `clear` de `src/ui/dom.ts`.
- Produces:
  - `openMap(map: MapRef, caption: string): void`
  - `closeMap(): void`
  - `isMapOpen(): boolean`
  - `toggleMap(map: MapRef | null, caption: string): void` — abre, fecha se já aberto, e não faz nada se `map` for `null`.
  - `CardHandlers` ganha `onToggleMap(): void`.

- [ ] **Step 1: Escrever os testes que falham**

`tests/mapModal.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { openMap, closeMap, isMapOpen, toggleMap } from '../src/ui/mapModal'

const MAP = { src: 'maps/image6.webp', width: 1050, height: 752 }

afterEach(() => {
  closeMap()
})

describe('mapModal', () => {
  it('começa fechado', () => {
    expect(isMapOpen()).toBe(false)
  })

  it('abre inserindo a imagem e a legenda no documento', () => {
    openMap(MAP, 'Phase 4 · Part 1')
    expect(isMapOpen()).toBe(true)
    const img = document.querySelector('img.map__img') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('./maps/image6.webp')
    expect(img.getAttribute('alt')).toContain('Phase 4')
    expect(document.body.textContent).toContain('Phase 4 · Part 1')
  })

  it('fecha removendo tudo do documento', () => {
    openMap(MAP, 'x')
    closeMap()
    expect(isMapOpen()).toBe(false)
    expect(document.querySelector('.map')).toBeNull()
  })

  it('abrir duas vezes não empilha dois modais', () => {
    openMap(MAP, 'a')
    openMap(MAP, 'b')
    expect(document.querySelectorAll('.map')).toHaveLength(1)
  })

  it('fechar sem ter aberto não quebra', () => {
    expect(() => closeMap()).not.toThrow()
  })

  it('toggleMap abre e fecha', () => {
    toggleMap(MAP, 'x')
    expect(isMapOpen()).toBe(true)
    toggleMap(MAP, 'x')
    expect(isMapOpen()).toBe(false)
  })

  it('toggleMap com null não abre nada', () => {
    toggleMap(null, 'x')
    expect(isMapOpen()).toBe(false)
  })

  it('clicar no fundo fecha', () => {
    openMap(MAP, 'x')
    const backdrop = document.querySelector('.map') as HTMLElement
    backdrop.click()
    expect(isMapOpen()).toBe(false)
  })

  it('clicar na imagem não fecha', () => {
    openMap(MAP, 'x')
    const img = document.querySelector('.map__img') as HTMLElement
    img.click()
    expect(isMapOpen()).toBe(true)
  })

  it('a proporção do palco vem das dimensões reais do mapa', () => {
    openMap({ src: 'maps/image5.webp', width: 922, height: 928 }, 'x')
    const stage = document.querySelector('.map__stage') as HTMLElement
    expect(stage.style.aspectRatio).toBe('922 / 928')
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run tests/mapModal.test.ts`
Expected: FAIL — `Failed to resolve import "../src/ui/mapModal"`.

- [ ] **Step 3: Escrever o `src/ui/mapModal.ts`**

```ts
import type { MapRef } from '../core/guide'
import { el } from './dom'

const ZOOM_MIN = 1
const ZOOM_MAX = 4
const ZOOM_STEP = 0.25

let overlay: HTMLElement | null = null

export function isMapOpen(): boolean {
  return overlay !== null
}

export function closeMap(): void {
  overlay?.remove()
  overlay = null
}

/**
 * Abre o mapa sobre o card. O palco carrega a proporção real da imagem —
 * as oito variam de 922×928 a 1258×882 depois do recorte, então não dá
 * para assumir nada.
 */
export function openMap(map: MapRef, caption: string): void {
  closeMap()

  let zoom = 1
  let panX = 0
  let panY = 0

  const img = el('img', {
    class: 'map__img',
    // Relativo, sem barra inicial: serve tanto para http quanto para file://
    src: `./${map.src}`,
    alt: `Mapa de ${caption}`,
    // String, não booleano: `el` descarta atributos com valor false.
    draggable: 'false',
  }) as HTMLImageElement

  const apply = (): void => {
    img.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`
    img.style.cursor = zoom > 1 ? 'grab' : 'default'
  }

  const stage = el('div', { class: 'map__stage' }, [img])
  stage.style.aspectRatio = `${map.width} / ${map.height}`
  stage.addEventListener('click', (e) => e.stopPropagation())

  stage.addEventListener('wheel', (e) => {
    e.preventDefault()
    const next = zoom + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)
    zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next))
    if (zoom === 1) {
      panX = 0
      panY = 0
    }
    apply()
  }, { passive: false })

  stage.addEventListener('pointerdown', (e) => {
    if (zoom === 1) return
    const startX = e.clientX - panX
    const startY = e.clientY - panY
    const move = (ev: PointerEvent): void => {
      panX = ev.clientX - startX
      panY = ev.clientY - startY
      apply()
    }
    const up = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  })

  overlay = el('div', { class: 'map', onclick: closeMap }, [
    stage,
    el('div', { class: 'map__caption' }, [
      el('span', {}, [caption]),
      el('span', { class: 'map__hint' }, ['roda: zoom · arrastar: mover · Esc: fechar']),
    ]),
  ])

  apply()
  document.body.append(overlay)
}

/** Abre, ou fecha se já aberto. Parts sem mapa simplesmente não respondem. */
export function toggleMap(map: MapRef | null, caption: string): void {
  if (isMapOpen()) {
    closeMap()
    return
  }
  if (map) openMap(map, caption)
}
```

- [ ] **Step 4: Escrever o `src/styles/map.css`**

```css
.map {
  position: fixed;
  inset: 0;
  z-index: 10;
  background: var(--glass-strong);
  backdrop-filter: blur(8px);
  display: flex;
  flex-direction: column;
  padding: 8px;
  gap: 6px;
}

.map__stage {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid var(--stroke);
  display: grid;
  place-items: center;
  /* aspect-ratio vem das dimensões reais da imagem, definido em JS. */
  margin: 0 auto;
  max-width: 100%;
}

.map__img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transform-origin: center;
  /* Sem suavização: os números das setas são pequenos. */
  image-rendering: -webkit-optimize-contrast;
}

.map__caption {
  display: flex;
  align-items: baseline;
  gap: 8px;
  color: var(--text-dim);
  font-size: 11px;
  padding: 0 2px;
}

.map__hint {
  margin-left: auto;
  opacity: 0.7;
}
```

- [ ] **Step 5: Acrescentar o botão de mapa ao card**

Em `src/ui/card.ts`, adicione `onToggleMap` ao tipo:

```ts
export type CardHandlers = {
  onPrev(): void
  onNext(): void
  onComplete(): void
  onToggleAction(actionId: string): void
  onToggleMap(): void
  onClose(): void
}
```

E, dentro de `renderCard`, substitua o conteúdo de `card__tools` por:

```ts
    el('div', { class: 'card__tools' }, [
      el('button', {
        class: 'card__tool',
        title: part.map ? 'Ver o mapa' : 'Esta part não tem mapa',
        disabled: part.map === null,
        onclick: handlers.onToggleMap,
      }, ['🗺']),
      el('button', { class: 'card__tool', title: 'Fechar', onclick: handlers.onClose }, ['✕']),
    ]),
```

- [ ] **Step 6: Ligar no `src/main.ts`**

Acrescente os imports:

```ts
import './styles/map.css'
import { toggleMap, closeMap, isMapOpen } from './ui/mapModal'
```

E acrescente `currentFlatPart` à lista já importada de `./core/progress`, em vez de abrir uma segunda linha de import do mesmo módulo.

Acrescente `onToggleMap` ao objeto `handlers`:

```ts
  onToggleMap: () => {
    const { part, phase } = currentFlatPart(guide, progress)
    toggleMap(part.map, `${phase.title} · ${part.title}`)
  },
```

E, antes de `void start()`, o `Esc`:

```ts
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isMapOpen()) closeMap()
})
```

Por fim, garanta que o mapa fecha ao trocar de part — ele mostraria a zona errada. Dentro de `update`, antes de `render()`:

```ts
  if (next.currentPartId !== progress.currentPartId) closeMap()
```

Atenção à ordem: essa comparação precisa acontecer **antes** de `progress = next`.

- [ ] **Step 7: Rodar os testes**

Run: `npm test`
Expected: PASS — inclusive os 10 testes novos de `mapModal`.

- [ ] **Step 8: Conferir no navegador**

Run: `npm run dev`

1. Na Fase 1 o botão 🗺 está desabilitado; na Fase 2 Part 1, habilitado.
2. Clicar abre o mapa recortado, sem barra preta em volta.
3. A roda do mouse dá zoom; com zoom acima de 1, arrastar move a imagem.
4. `Esc` e clicar no fundo fecham; clicar na imagem não.
5. Com o mapa aberto, avançar de part fecha o mapa.
6. No mapa da Fase 4 Part 1 (`image6`), os números de 1 a 19 estão legíveis com zoom.

- [ ] **Step 9: Commit**

```bash
git add src tests
git commit -m "Adiciona o mapa sob demanda

O mapa abre sobre o card com zoom pela roda e arrasto, fecha no Esc ou
clicando no fundo, e some ao trocar de part para nao mostrar a zona
errada. O palco usa a proporcao real de cada imagem, que varia depois
do recorte.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---
### Task 10: Painéis de navegação e referência

Dois painéis que deslizam sobre o card. O de navegação atende ao "ver as próximas sem ser obrigado a marcar": lista as cinco fases e suas parts, e pular para qualquer uma não escreve progresso, porque usa o mesmo `goToPart` já testado.

O de referência guarda a legenda das cores e a lista de downtime — informação que se consulta, não que se executa, e que por isso não cabe no fluxo de parts.

**Files:**
- Create: `src/ui/panels.ts`
- Create: `src/styles/panels.css`
- Modify: `src/ui/card.ts` — dois botões novos no cabeçalho
- Modify: `src/main.ts`
- Test: `tests/panels.test.ts`

**Interfaces:**
- Consumes: `Guide`, `flattenParts` de `src/core/guide.ts`; `Progress` de `src/core/progress.ts`; `el`, `clear` de `src/ui/dom.ts`.
- Produces:
  - `toggleNavPanel(guide: Guide, progress: Progress, onPick: (partId: string) => void): void`
  - `toggleRefPanel(guide: Guide): void`
  - `closePanel(): void`
  - `isPanelOpen(): boolean`
  - `CardHandlers` ganha `onToggleNav(): void` e `onToggleRef(): void`.

- [ ] **Step 1: Escrever os testes que falham**

`tests/panels.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { toggleNavPanel, toggleRefPanel, closePanel, isPanelOpen } from '../src/ui/panels'
import { initialProgress, completeCurrent } from '../src/core/progress'
import { makeGuide } from './fixtures/guide'

const guide = makeGuide()
const noop = (): void => {}

afterEach(() => {
  closePanel()
})

describe('painel de navegação', () => {
  it('lista todas as fases e parts', () => {
    toggleNavPanel(guide, initialProgress(guide), noop)
    const items = [...document.querySelectorAll('.panel__part')]
    expect(items.map((i) => i.getAttribute('data-id'))).toEqual(['p1-1', 'p2-1', 'p2-2'])
    expect(document.body.textContent).toContain('Phase 1')
    expect(document.body.textContent).toContain('Phase 2')
  })

  it('marca a part atual', () => {
    toggleNavPanel(guide, initialProgress(guide), noop)
    const current = document.querySelector('.panel__part--current')
    expect(current?.getAttribute('data-id')).toBe('p1-1')
  })

  it('marca as parts concluídas', () => {
    const p = completeCurrent(guide, initialProgress(guide))
    toggleNavPanel(guide, p, noop)
    expect(document.querySelector('.panel__part--done')?.getAttribute('data-id')).toBe('p1-1')
  })

  it('clicar numa part chama onPick com o id e fecha o painel', () => {
    const onPick = vi.fn()
    toggleNavPanel(guide, initialProgress(guide), onPick)
    document.querySelector<HTMLElement>('[data-id="p2-2"]')!.click()
    expect(onPick).toHaveBeenCalledWith('p2-2')
    expect(isPanelOpen()).toBe(false)
  })

  it('chamar de novo fecha', () => {
    toggleNavPanel(guide, initialProgress(guide), noop)
    toggleNavPanel(guide, initialProgress(guide), noop)
    expect(isPanelOpen()).toBe(false)
  })
})

describe('painel de referência', () => {
  it('mostra a legenda com marcador e rótulo', () => {
    toggleRefPanel(guide)
    const text = document.body.textContent ?? ''
    expect(text).toContain('Yellow Arrows')
    expect(text).toContain('Main Story Quest (MSQ)')
    expect(text).toContain('Black Arrows')
  })

  it('pinta o marcador com a cor de interface, não com a do documento', () => {
    toggleRefPanel(guide)
    const kisk = document.querySelector<HTMLElement>('.panel__swatch[data-tag="kisk"]')!
    // O documento diz preto; a interface usa o neutro claro para não sumir.
    expect(kisk.style.background).not.toBe('rgb(0, 0, 0)')
  })

  it('mostra a lista de downtime', () => {
    toggleRefPanel(guide)
    expect(document.body.textContent).toContain('Weapons (+5 max).')
  })
})

describe('um painel por vez', () => {
  it('abrir o de referência fecha o de navegação', () => {
    toggleNavPanel(guide, initialProgress(guide), noop)
    toggleRefPanel(guide)
    expect(document.querySelectorAll('.panel')).toHaveLength(1)
    expect(document.querySelector('.panel__part')).toBeNull()
  })

  it('fechar sem ter aberto não quebra', () => {
    expect(() => closePanel()).not.toThrow()
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run tests/panels.test.ts`
Expected: FAIL — `Failed to resolve import "../src/ui/panels"`.

- [ ] **Step 3: Escrever o `src/ui/panels.ts`**

```ts
import { type Guide, flattenParts } from '../core/guide'
import type { Progress } from '../core/progress'
import { el } from './dom'

type PanelKind = 'nav' | 'ref'

let panel: HTMLElement | null = null
let openKind: PanelKind | null = null

export function isPanelOpen(): boolean {
  return panel !== null
}

export function closePanel(): void {
  panel?.remove()
  panel = null
  openKind = null
}

function mount(kind: PanelKind, title: string, content: HTMLElement[]): void {
  closePanel()
  openKind = kind
  panel = el('div', { class: 'panel' }, [
    el('header', { class: 'panel__head' }, [
      el('span', {}, [title]),
      el('button', { class: 'panel__close', title: 'Fechar', onclick: closePanel }, ['✕']),
    ]),
    el('div', { class: 'panel__body' }, content),
  ])
  document.body.append(panel)
}

/** Abre ou fecha, conforme o que já estiver aberto. */
function toggle(kind: PanelKind, build: () => void): void {
  if (openKind === kind) {
    closePanel()
    return
  }
  build()
}

export function toggleNavPanel(
  guide: Guide,
  progress: Progress,
  onPick: (partId: string) => void,
): void {
  toggle('nav', () => {
    const groups = guide.phases.map((phase) =>
      el('section', { class: 'panel__phase' }, [
        el('div', { class: 'panel__phase-head' }, [
          el('span', { class: 'panel__phase-title' }, [phase.title]),
          el('span', { class: 'panel__phase-levels' }, [`${phase.levelFrom}–${phase.levelTo}`]),
        ]),
        ...phase.parts.map((part) => {
          const classes = ['panel__part']
          if (part.id === progress.currentPartId) classes.push('panel__part--current')
          if (progress.completedParts.includes(part.id)) classes.push('panel__part--done')
          return el('button', {
            class: classes.join(' '),
            'data-id': part.id,
            onclick: () => {
              closePanel()
              onPick(part.id)
            },
          }, [
            el('span', { class: 'panel__part-mark', 'aria-hidden': 'true' }, [
              progress.completedParts.includes(part.id) ? '✓' : '·',
            ]),
            el('span', {}, [part.title]),
            ...(part.map ? [el('span', { class: 'panel__part-map', title: 'tem mapa' }, ['🗺'])] : []),
          ])
        }),
      ]),
    )
    mount('nav', `Navegar · ${flattenParts(guide).length} parts`, groups)
  })
}

export function toggleRefPanel(guide: Guide): void {
  toggle('ref', () => {
    const legend = el('div', { class: 'panel__group' }, [
      el('h3', { class: 'panel__group-title' }, ['Legenda dos mapas']),
      ...guide.legend.map((entry) => {
        const swatch = el('span', { class: 'panel__swatch', 'data-tag': entry.id })
        swatch.style.background = entry.uiColor
        return el('div', { class: 'panel__legend-row' }, [
          swatch,
          el('span', { class: 'panel__legend-marker' }, [entry.marker]),
          el('span', { class: 'panel__legend-label' }, [entry.label]),
        ])
      }),
    ])

    const downtime = el('div', { class: 'panel__group' }, [
      el('h3', { class: 'panel__group-title' }, ['Prioridade no downtime']),
      el('ol', { class: 'panel__downtime' }, guide.downtime.map((item) => el('li', {}, [item]))),
    ])

    mount('ref', 'Referência', [legend, downtime])
  })
}
```

- [ ] **Step 4: Escrever o `src/styles/panels.css`**

```css
.panel {
  position: fixed;
  inset: 0;
  z-index: 9;
  background: var(--glass-strong);
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
}

.panel__head {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  border-bottom: 1px solid var(--stroke);
  font-weight: 600;
  color: var(--accent);
}

.panel__close {
  margin-left: auto;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  color: var(--text-dim);
}

.panel__close:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text);
}

.panel__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 10px 12px;
}

.panel__phase {
  margin-bottom: 10px;
}

.panel__phase-head {
  display: flex;
  gap: 8px;
  align-items: baseline;
  padding: 4px 2px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-dim);
}

.panel__phase-levels {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

.panel__part {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: left;
  min-height: 26px;
  padding: 3px 6px;
  border-radius: 6px;
  border-left: 2px solid transparent;
}

.panel__part:hover {
  background: rgba(255, 255, 255, 0.06);
}

.panel__part-mark {
  width: 12px;
  text-align: center;
  color: var(--text-dim);
}

.panel__part-map {
  margin-left: auto;
  opacity: 0.5;
  font-size: 11px;
}

.panel__part--done .panel__part-mark {
  color: var(--done);
}

.panel__part--current {
  border-left-color: var(--accent);
  background: rgba(111, 211, 255, 0.1);
  color: var(--accent);
}

.panel__group + .panel__group {
  margin-top: 14px;
}

.panel__group-title {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-dim);
}

.panel__legend-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 2px;
  line-height: 1.3;
}

.panel__swatch {
  flex: none;
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.panel__legend-marker {
  min-width: 92px;
  color: var(--text-dim);
}

.panel__downtime {
  margin: 0;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  line-height: 1.35;
}
```

- [ ] **Step 5: Acrescentar os botões ao card**

Em `src/ui/card.ts`, o tipo passa a ser:

```ts
export type CardHandlers = {
  onPrev(): void
  onNext(): void
  onComplete(): void
  onToggleAction(actionId: string): void
  onToggleMap(): void
  onToggleNav(): void
  onToggleRef(): void
  onClose(): void
}
```

E o bloco `card__tools` dentro de `renderCard`:

```ts
    el('div', { class: 'card__tools' }, [
      el('button', {
        class: 'card__tool',
        title: part.map ? 'Ver o mapa' : 'Esta part não tem mapa',
        disabled: part.map === null,
        onclick: handlers.onToggleMap,
      }, ['🗺']),
      el('button', { class: 'card__tool', title: 'Navegar', onclick: handlers.onToggleNav }, ['☰']),
      el('button', { class: 'card__tool', title: 'Referência', onclick: handlers.onToggleRef }, ['?']),
      el('button', { class: 'card__tool', title: 'Fechar', onclick: handlers.onClose }, ['✕']),
    ]),
```

- [ ] **Step 6: Ligar no `src/main.ts`**

Imports novos:

```ts
import './styles/panels.css'
import { toggleNavPanel, toggleRefPanel, closePanel, isPanelOpen } from './ui/panels'
```

E acrescente `goToPart` à lista já importada de `./core/progress`.

Handlers novos:

```ts
  onToggleNav: () => toggleNavPanel(guide, progress, (id) => update(goToPart(guide, progress, id))),
  onToggleRef: () => toggleRefPanel(guide),
```

E o `Esc` passa a fechar os dois:

```ts
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return
  if (isMapOpen()) closeMap()
  else if (isPanelOpen()) closePanel()
})
```

- [ ] **Step 7: Rodar os testes**

Run: `npm test`
Expected: PASS — inclusive os 10 novos de `panels`.

- [ ] **Step 8: Conferir no navegador**

Run: `npm run dev`

1. `☰` lista as cinco fases com as 11 parts; a atual vem destacada.
2. Parts com mapa mostram o 🗺 discreto à direita.
3. Clicar numa part pula para ela e fecha o painel. **O contador de feitas não muda.**
4. Concluir uma part e reabrir `☰` mostra o ✓ verde nela.
5. `?` mostra as quatro cores da legenda e os sete itens de downtime. O marcador de Kisks aparece claro, não preto.
6. `Esc` fecha o painel aberto.

- [ ] **Step 9: Commit**

```bash
git add src tests
git commit -m "Adiciona os paineis de navegacao e referencia

O painel de navegacao lista as cinco fases e as 11 parts e permite
pular para qualquer uma sem escrever progresso. O de referencia guarda
a legenda das cores e a lista de downtime, informacao que se consulta
em vez de executar.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: A casca Electron

A janela: sem moldura, translúcida e fixa acima do jogo. Também a implementação da ponte que a Task 7 já definiu, do outro lado.

Duas decisões que precisam ser respeitadas ao pé da letra:

- **`setAlwaysOnTop(true, 'screen-saver')`.** O `alwaysOnTop: true` comum no construtor perde para jogos no Windows. É esse nível nomeado que segura.
- **`vitest.config.ts` separado.** O `vite.config.ts` passa a carregar o plugin do Electron, que não deve rodar durante os testes. O Vitest prefere o próprio arquivo quando ele existe.

**Files:**
- Create: `vitest.config.ts`
- Modify: `vite.config.ts` — sai o bloco `test`, entra o plugin do Electron
- Modify: `package.json` — campo `main` e script `electron:dev`
- Create: `electron/store.ts`
- Create: `electron/window.ts`
- Create: `electron/main.ts`
- Create: `electron/preload.ts`
- Test: `tests/electron-store.test.ts`

**Interfaces:**
- Consumes: `AionBridge`, `HotkeyAction` de `src/core/bridge.ts`.
- Produces:
  - `createFileStore(dir: string)` em `electron/store.ts` — `{ read(name: string): Promise<unknown>; write(name: string, value: unknown): Promise<void> }`, com escrita atômica.
  - Em `electron/window.ts`: `type WindowBounds = { x: number; y: number; width: number; height: number }`, `sanitizeBounds(raw: unknown): WindowBounds` e `createOverlayWindow(bounds: WindowBounds): BrowserWindow`.
  - Os canais IPC `aion:loadProgress`, `aion:saveProgress`, `aion:loadSettings`, `aion:saveSettings`, `aion:setOpacity`, `aion:setClickThrough`, `aion:minimize`, `aion:close`, e o evento `aion:hotkey` do main para o renderer.

- [ ] **Step 1: Instalar o Electron**

```bash
npm i -D electron vite-plugin-electron
```

- [ ] **Step 2: Separar a configuração de teste**

Crie `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,mjs}'],
  },
})
```

E reescreva `vite.config.ts` sem o bloco `test`:

```ts
import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron/simple'

export default defineConfig({
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
  plugins: [
    electron({
      // Nomes de saída explícitos: o campo "main" do package.json e o
      // caminho do preload em window.ts dependem deles.
      main: {
        entry: 'electron/main.ts',
        vite: { build: { rollupOptions: { output: { entryFileNames: 'main.mjs' } } } },
      },
      // O preload sai em CommonJS de propósito. Preload em ESM só funciona
      // com sandbox desligado, e desligar o sandbox por causa de um nome de
      // arquivo é um mau negócio.
      preload: {
        input: 'electron/preload.ts',
        vite: {
          build: {
            rollupOptions: { output: { format: 'cjs', entryFileNames: 'preload.cjs' } },
          },
        },
      },
    }),
  ],
})
```

- [ ] **Step 3: Confirmar que os testes ainda rodam**

Run: `npm test`
Expected: PASS — os mesmos arquivos de antes, agora pela `vitest.config.ts`.

- [ ] **Step 4: Escrever o teste do armazenamento em disco**

`tests/electron-store.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mkdtemp, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createFileStore } from '../electron/store'

async function dir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'aion2-store-'))
}

describe('createFileStore', () => {
  it('grava e lê um valor', async () => {
    const store = createFileStore(await dir())
    await store.write('progress', { currentPartId: 'p4-1' })
    expect(await store.read('progress')).toEqual({ currentPartId: 'p4-1' })
  })

  it('devolve null quando o arquivo não existe', async () => {
    expect(await createFileStore(await dir()).read('progress')).toBeNull()
  })

  it('devolve null para JSON corrompido em vez de explodir', async () => {
    const d = await dir()
    await writeFile(join(d, 'progress.json'), '{quebrado')
    expect(await createFileStore(d).read('progress')).toBeNull()
  })

  it('cria o diretório se ele não existir', async () => {
    const d = join(await dir(), 'fundo', 'do', 'poco')
    const store = createFileStore(d)
    await store.write('settings', { opacity: 0.5 })
    expect(await store.read('settings')).toEqual({ opacity: 0.5 })
  })

  it('não deixa arquivo temporário para trás', async () => {
    const d = await dir()
    const store = createFileStore(d)
    await store.write('progress', { a: 1 })
    expect(await readdir(d)).toEqual(['progress.json'])
  })

  it('usa arquivos distintos por nome', async () => {
    const store = createFileStore(await dir())
    await store.write('progress', { tipo: 'progresso' })
    await store.write('settings', { tipo: 'ajustes' })
    expect(await store.read('progress')).toEqual({ tipo: 'progresso' })
    expect(await store.read('settings')).toEqual({ tipo: 'ajustes' })
  })

  it('sobrescrever preserva o último valor', async () => {
    const store = createFileStore(await dir())
    await store.write('progress', { v: 1 })
    await store.write('progress', { v: 2 })
    expect(await store.read('progress')).toEqual({ v: 2 })
  })
})
```

- [ ] **Step 5: Escrever o `electron/store.ts`**

```ts
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * JSON em disco com escrita atômica: grava num temporário e renomeia.
 * Sem isso, fechar o jogo no meio de uma gravação deixaria um arquivo
 * pela metade e o progresso seria perdido na próxima abertura.
 */
export function createFileStore(dir: string) {
  const path = (name: string): string => join(dir, `${name}.json`)

  return {
    async read(name: string): Promise<unknown> {
      try {
        return JSON.parse(await readFile(path(name), 'utf8'))
      } catch {
        return null
      }
    },

    async write(name: string, value: unknown): Promise<void> {
      await mkdir(dir, { recursive: true })
      const target = path(name)
      const temp = `${target}.tmp`
      await writeFile(temp, JSON.stringify(value), 'utf8')
      await rename(temp, target)
    },
  }
}
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `npx vitest run tests/electron-store.test.ts`
Expected: PASS — 7 testes.

- [ ] **Step 7: Escrever o `electron/window.ts`**

```ts
import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'

const DEFAULT_WIDTH = 360
const DEFAULT_HEIGHT = 240
const MIN_WIDTH = 280
const MIN_HEIGHT = 160
const MARGIN = 24

export type WindowBounds = { x: number; y: number; width: number; height: number }

/** Canto superior direito da tela principal, com uma margem. */
function defaultBounds(): WindowBounds {
  const { workArea } = screen.getPrimaryDisplay()
  return {
    x: workArea.x + workArea.width - DEFAULT_WIDTH - MARGIN,
    y: workArea.y + MARGIN,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  }
}

/** Descarta posições fora de qualquer tela — um monitor pode ter sido desligado. */
export function sanitizeBounds(raw: unknown): WindowBounds {
  if (typeof raw !== 'object' || raw === null) return defaultBounds()
  const r = raw as Record<string, unknown>
  const nums = ['x', 'y', 'width', 'height'].every(
    (k) => typeof r[k] === 'number' && Number.isFinite(r[k]),
  )
  if (!nums) return defaultBounds()
  const bounds = r as unknown as WindowBounds
  const visible = screen.getAllDisplays().some((d) => {
    const a = d.workArea
    return bounds.x < a.x + a.width && bounds.x + bounds.width > a.x &&
      bounds.y < a.y + a.height && bounds.y + bounds.height > a.y
  })
  if (!visible) return defaultBounds()
  return {
    x: bounds.x,
    y: bounds.y,
    width: Math.max(MIN_WIDTH, bounds.width),
    height: Math.max(MIN_HEIGHT, bounds.height),
  }
}

export function createOverlayWindow(bounds: WindowBounds): BrowserWindow {
  const win = new BrowserWindow({
    ...bounds,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: false,
    show: false,
    webPreferences: {
      preload: join(import.meta.dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // O nível nomeado é o que segura acima de jogos no Windows.
  // alwaysOnTop: true no construtor não basta.
  win.setAlwaysOnTop(true, 'screen-saver')
  // Acompanha o jogo quando ele troca de área de trabalho virtual.
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  return win
}
```

- [ ] **Step 8: Escrever o `electron/preload.ts`**

Este arquivo implementa `AionBridge` do outro lado. Se um nome mudar aqui, mude em `src/core/bridge.ts` junto — são as duas metades do mesmo contrato.

```ts
import { contextBridge, ipcRenderer } from 'electron'
import type { AionBridge, HotkeyAction } from '../src/core/bridge'

const bridge: AionBridge = {
  loadProgress: () => ipcRenderer.invoke('aion:loadProgress'),
  saveProgress: (progress) => ipcRenderer.invoke('aion:saveProgress', progress),
  loadSettings: () => ipcRenderer.invoke('aion:loadSettings'),
  saveSettings: (settings) => ipcRenderer.invoke('aion:saveSettings', settings),
  setOpacity: (value) => ipcRenderer.send('aion:setOpacity', value),
  setClickThrough: (enabled) => ipcRenderer.send('aion:setClickThrough', enabled),
  minimize: () => ipcRenderer.send('aion:minimize'),
  close: () => ipcRenderer.send('aion:close'),
  onHotkey: (callback) => {
    ipcRenderer.on('aion:hotkey', (_event, action: HotkeyAction) => callback(action))
  },
}

contextBridge.exposeInMainWorld('aion', bridge)
```

- [ ] **Step 9: Escrever o `electron/main.ts`**

As hotkeys chegam na Task 12; aqui a janela já sobe e persiste.

```ts
import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { createFileStore } from './store'
import { createOverlayWindow, sanitizeBounds, type WindowBounds } from './window'

const store = createFileStore(app.getPath('userData'))
let win: BrowserWindow | null = null

/** Grava os limites da janela no máximo uma vez por segundo. */
function watchBounds(window: BrowserWindow): void {
  let timer: NodeJS.Timeout | null = null
  const save = (): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      if (!window.isDestroyed()) void store.write('window', window.getBounds() as WindowBounds)
    }, 1000)
  }
  window.on('move', save)
  window.on('resize', save)
}

function registerIpc(): void {
  ipcMain.handle('aion:loadProgress', () => store.read('progress'))
  ipcMain.handle('aion:saveProgress', (_e, progress) => store.write('progress', progress))
  ipcMain.handle('aion:loadSettings', () => store.read('settings'))
  ipcMain.handle('aion:saveSettings', (_e, settings) => store.write('settings', settings))
  ipcMain.on('aion:setOpacity', (_e, value: number) => win?.setOpacity(value))
  ipcMain.on('aion:setClickThrough', (_e, enabled: boolean) => {
    // forward mantém o hover chegando enquanto os cliques atravessam.
    win?.setIgnoreMouseEvents(enabled, { forward: true })
  })
  ipcMain.on('aion:minimize', () => win?.minimize())
  ipcMain.on('aion:close', () => win?.close())
}

async function createWindow(): Promise<void> {
  win = createOverlayWindow(sanitizeBounds(await store.read('window')))
  watchBounds(win)

  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) await win.loadURL(devUrl)
  else await win.loadFile(join(import.meta.dirname, '../dist/index.html'))

  win.once('ready-to-show', () => win?.show())
  win.on('closed', () => {
    win = null
  })
}

// Uma segunda instância só brigaria pelas hotkeys globais com a primeira.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    win?.show()
    win?.focus()
  })

  void app.whenReady().then(() => {
    registerIpc()
    void createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) void createWindow()
    })
  })

  app.on('window-all-closed', () => app.quit())
}
```

- [ ] **Step 10: Apontar o `package.json` para a casca**

Acrescente o campo `main` e o script, mantendo o resto:

```json
  "main": "dist-electron/main.mjs",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "extract": "node scripts/extract-docx.mjs",
    "electron:dev": "vite",
    "electron:build": "npm run build"
  }
```

O `vite-plugin-electron` sobe o Electron junto do servidor de desenvolvimento, então `electron:dev` e `dev` são o mesmo comando.

- [ ] **Step 11: Rodar a casca**

Run: `npm run electron:dev`

Confirme:
1. Abre uma janela pequena no canto superior direito, sem barra de título e com o fundo translúcido — dá para ver a área de trabalho através dela.
2. Arrastar pela faixa do cabeçalho move a janela; arrastar por um botão não.
3. A janela continua visível ao clicar em outra janela qualquer.
4. Navegar, marcar e concluir funcionam como no navegador.
5. Fechar pelo `✕` e reabrir: a posição, o tamanho e o progresso voltam.
6. **O teste que importa:** abra o Aion 2 em *borderless windowed* e confirme que o overlay fica por cima. Em tela cheia exclusiva ele some — isso é esperado e vai no README.

- [ ] **Step 12: Rodar os testes e os tipos**

Run: `npm test && npx tsc --noEmit`
Expected: PASS e nenhum erro de tipo.

- [ ] **Step 13: Commit**

```bash
git add package.json package-lock.json vite.config.ts vitest.config.ts electron tests
git commit -m "Adiciona a casca Electron

Janela sem moldura, translucida e fixa acima do jogo com
setAlwaysOnTop no nivel screen-saver, que e o que segura sobre jogos
no Windows. Implementa a ponte definida em core/bridge e grava
progresso, ajustes e limites da janela em disco de forma atomica.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---
### Task 12: Hotkeys globais, click-through e ajustes

O que faz isto valer como overlay: avançar sem tirar o foco do jogo. As hotkeys são globais, então podem colidir com outro programa — `registerHotkeys` devolve quais falharam em vez de fingir que deu certo, e o painel de ajustes mostra isso.

O painel de ajustes reaproveita a casca de `panels.ts` em vez de abrir um terceiro tipo de sobreposição.

**Files:**
- Create: `electron/hotkeys.ts`
- Modify: `electron/main.ts` — registra as hotkeys e trata `hide`
- Modify: `src/ui/panels.ts` — o painel de ajustes
- Modify: `src/styles/panels.css` — controles
- Modify: `src/ui/card.ts` — botão ⚙
- Modify: `src/main.ts` — ajustes, hotkeys do renderer
- Test: `tests/hotkeys.test.ts`
- Test: `tests/settings-panel.test.ts`

**Interfaces:**
- Consumes: `HotkeyAction` de `src/core/bridge.ts`; `Settings`, `OPACITY_MIN`, `OPACITY_MAX` de `src/core/settings.ts`.
- Produces:
  - `HOTKEYS: Record<HotkeyAction, string>` e `HOTKEY_LABELS: Record<HotkeyAction, string>` em `electron/hotkeys.ts`
  - `registerHotkeys(handle: (action: HotkeyAction) => void): HotkeyAction[]` — devolve as que não puderam ser registradas
  - `unregisterHotkeys(): void`
  - `toggleSettingsPanel(settings: Settings, handlers: SettingsHandlers): void` em `src/ui/panels.ts`, com `SettingsHandlers = { onOpacity(v: number): void; onClickThrough(on: boolean): void; onReset(): void }`
  - `CardHandlers` ganha `onToggleSettings(): void`

- [ ] **Step 1: Escrever o teste das hotkeys que falha**

`tests/hotkeys.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const register = vi.fn()
const unregisterAll = vi.fn()

vi.mock('electron', () => ({
  globalShortcut: {
    register: (...args: unknown[]) => register(...args),
    unregisterAll: () => unregisterAll(),
  },
}))

const { HOTKEYS, HOTKEY_LABELS, registerHotkeys, unregisterHotkeys } = await import('../electron/hotkeys')

beforeEach(() => {
  register.mockReset()
  unregisterAll.mockReset()
})

describe('HOTKEYS', () => {
  it('cobre as seis ações', () => {
    expect(Object.keys(HOTKEYS).sort()).toEqual(
      ['clickthrough', 'complete', 'hide', 'map', 'next', 'prev'].sort(),
    )
  })

  it('usa Control+Alt para não colidir com teclas do jogo', () => {
    for (const accelerator of Object.values(HOTKEYS)) {
      expect(accelerator.startsWith('Control+Alt+')).toBe(true)
    }
  })

  it('não repete combinação', () => {
    const values = Object.values(HOTKEYS)
    expect(new Set(values).size).toBe(values.length)
  })

  it('tem rótulo em português para cada ação', () => {
    for (const action of Object.keys(HOTKEYS)) {
      expect(HOTKEY_LABELS[action as keyof typeof HOTKEY_LABELS]).toBeTruthy()
    }
  })
})

describe('registerHotkeys', () => {
  it('registra todas e devolve lista vazia quando tudo dá certo', () => {
    register.mockReturnValue(true)
    expect(registerHotkeys(vi.fn())).toEqual([])
    expect(register).toHaveBeenCalledTimes(6)
  })

  it('devolve as ações cuja combinação já está tomada', () => {
    register.mockImplementation((accelerator: string) => accelerator !== HOTKEYS.map)
    expect(registerHotkeys(vi.fn())).toEqual(['map'])
  })

  it('chama o handler com a ação certa', () => {
    const handle = vi.fn()
    register.mockImplementation((accelerator: string, cb: () => void) => {
      if (accelerator === HOTKEYS.next) cb()
      return true
    })
    registerHotkeys(handle)
    expect(handle).toHaveBeenCalledWith('next')
  })

  it('unregisterHotkeys libera tudo', () => {
    unregisterHotkeys()
    expect(unregisterAll).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Escrever o `electron/hotkeys.ts`**

```ts
import { globalShortcut } from 'electron'
import type { HotkeyAction } from '../src/core/bridge'

/**
 * Control+Alt evita as teclas que o jogo usa. São globais: valem com o
 * Aion 2 em foco, que é o ponto.
 */
export const HOTKEYS: Record<HotkeyAction, string> = {
  next: 'Control+Alt+Right',
  prev: 'Control+Alt+Left',
  complete: 'Control+Alt+Return',
  map: 'Control+Alt+M',
  hide: 'Control+Alt+H',
  clickthrough: 'Control+Alt+C',
}

export const HOTKEY_LABELS: Record<HotkeyAction, string> = {
  next: 'Próxima part',
  prev: 'Part anterior',
  complete: 'Concluir a part',
  map: 'Abrir o mapa',
  hide: 'Esconder o overlay',
  clickthrough: 'Cliques atravessam',
}

/**
 * Registra tudo e devolve as ações que falharam — outro programa pode já
 * ter tomado a combinação, e fingir que deu certo esconderia o problema.
 */
export function registerHotkeys(handle: (action: HotkeyAction) => void): HotkeyAction[] {
  const failed: HotkeyAction[] = []
  for (const [action, accelerator] of Object.entries(HOTKEYS) as [HotkeyAction, string][]) {
    const ok = globalShortcut.register(accelerator, () => handle(action))
    if (!ok) failed.push(action)
  }
  return failed
}

export function unregisterHotkeys(): void {
  globalShortcut.unregisterAll()
}
```

- [ ] **Step 3: Rodar o teste e confirmar que passa**

Run: `npx vitest run tests/hotkeys.test.ts`
Expected: PASS — 8 testes.

- [ ] **Step 4: Ligar as hotkeys no `electron/main.ts`**

Acrescente o import:

```ts
import { registerHotkeys, unregisterHotkeys } from './hotkeys'
import type { HotkeyAction } from '../src/core/bridge'
```

Acrescente esta função antes de `createWindow`:

```ts
/**
 * 'hide' é tratado aqui, não no renderer: com a janela escondida ele não
 * poderia responder para trazê-la de volta. O resto é repassado.
 */
function handleHotkey(action: HotkeyAction): void {
  if (!win) return
  if (action === 'hide') {
    if (win.isVisible()) win.hide()
    else win.show()
    return
  }
  win.webContents.send('aion:hotkey', action)
}
```

Dentro do bloco `app.whenReady()`, depois de `registerIpc()`:

```ts
    const failed = registerHotkeys(handleHotkey)
    if (failed.length > 0) {
      console.warn(`hotkeys já tomadas por outro programa: ${failed.join(', ')}`)
    }
```

E libere ao sair, junto dos outros handlers de `app`:

```ts
  app.on('will-quit', unregisterHotkeys)
```

- [ ] **Step 5: Escrever o teste do painel de ajustes que falha**

`tests/settings-panel.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { toggleSettingsPanel, closePanel, isPanelOpen } from '../src/ui/panels'
import { DEFAULT_SETTINGS, OPACITY_MIN, OPACITY_MAX } from '../src/core/settings'

const handlers = () => ({ onOpacity: vi.fn(), onClickThrough: vi.fn(), onReset: vi.fn() })

afterEach(() => {
  closePanel()
})

describe('painel de ajustes', () => {
  it('mostra a opacidade atual dentro da faixa utilizável', () => {
    toggleSettingsPanel({ ...DEFAULT_SETTINGS, opacity: 0.7 }, handlers())
    const slider = document.querySelector<HTMLInputElement>('.panel__slider')!
    expect(Number(slider.value)).toBeCloseTo(0.7)
    expect(Number(slider.min)).toBe(OPACITY_MIN)
    expect(Number(slider.max)).toBe(OPACITY_MAX)
  })

  it('mexer no slider chama onOpacity', () => {
    const h = handlers()
    toggleSettingsPanel(DEFAULT_SETTINGS, h)
    const slider = document.querySelector<HTMLInputElement>('.panel__slider')!
    slider.value = '0.55'
    slider.dispatchEvent(new Event('input'))
    expect(h.onOpacity).toHaveBeenCalledWith(0.55)
  })

  it('o interruptor reflete o estado e chama onClickThrough', () => {
    const h = handlers()
    toggleSettingsPanel({ ...DEFAULT_SETTINGS, clickThrough: true }, h)
    const box = document.querySelector<HTMLInputElement>('.panel__check')!
    expect(box.checked).toBe(true)
    box.checked = false
    box.dispatchEvent(new Event('change'))
    expect(h.onClickThrough).toHaveBeenCalledWith(false)
  })

  it('resetar pede confirmação antes de chamar onReset', () => {
    const h = handlers()
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false))
    toggleSettingsPanel(DEFAULT_SETTINGS, h)
    document.querySelector<HTMLElement>('.panel__danger')!.click()
    expect(h.onReset).not.toHaveBeenCalled()

    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
    document.querySelector<HTMLElement>('.panel__danger')!.click()
    expect(h.onReset).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
  })

  it('chamar de novo fecha', () => {
    toggleSettingsPanel(DEFAULT_SETTINGS, handlers())
    toggleSettingsPanel(DEFAULT_SETTINGS, handlers())
    expect(isPanelOpen()).toBe(false)
  })
})
```

- [ ] **Step 6: Acrescentar o painel de ajustes ao `src/ui/panels.ts`**

Mude o tipo de painel para incluir o novo:

```ts
type PanelKind = 'nav' | 'ref' | 'settings'
```

Acrescente o import e a função ao fim do arquivo:

```ts
import { type Settings, OPACITY_MIN, OPACITY_MAX } from '../core/settings'

export type SettingsHandlers = {
  onOpacity(value: number): void
  onClickThrough(enabled: boolean): void
  onReset(): void
}

/** Os atalhos, para exibição. Repetidos aqui porque o renderer não
 *  importa de electron/ — esse módulo depende do próprio Electron. */
const SHOWN_HOTKEYS: [string, string][] = [
  ['Ctrl+Alt+→', 'Próxima part'],
  ['Ctrl+Alt+←', 'Part anterior'],
  ['Ctrl+Alt+Enter', 'Concluir a part'],
  ['Ctrl+Alt+M', 'Abrir o mapa'],
  ['Ctrl+Alt+H', 'Esconder o overlay'],
  ['Ctrl+Alt+C', 'Cliques atravessam'],
]

export function toggleSettingsPanel(settings: Settings, handlers: SettingsHandlers): void {
  toggle('settings', () => {
    const slider = el('input', {
      class: 'panel__slider',
      type: 'range',
      min: String(OPACITY_MIN),
      max: String(OPACITY_MAX),
      step: '0.01',
      value: String(settings.opacity),
    }) as HTMLInputElement
    slider.addEventListener('input', () => handlers.onOpacity(Number(slider.value)))

    const check = el('input', { class: 'panel__check', type: 'checkbox' }) as HTMLInputElement
    check.checked = settings.clickThrough
    check.addEventListener('change', () => handlers.onClickThrough(check.checked))

    mount('settings', 'Ajustes', [
      el('div', { class: 'panel__group' }, [
        el('h3', { class: 'panel__group-title' }, ['Opacidade']),
        el('div', { class: 'panel__row' }, [slider]),
      ]),
      el('div', { class: 'panel__group' }, [
        el('h3', { class: 'panel__group-title' }, ['Janela']),
        el('label', { class: 'panel__row' }, [
          check,
          el('span', {}, ['Cliques atravessam o overlay']),
        ]),
      ]),
      el('div', { class: 'panel__group' }, [
        el('h3', { class: 'panel__group-title' }, ['Atalhos globais']),
        ...SHOWN_HOTKEYS.map(([keys, label]) =>
          el('div', { class: 'panel__hotkey' }, [
            el('kbd', {}, [keys]),
            el('span', {}, [label]),
          ]),
        ),
      ]),
      el('div', { class: 'panel__group' }, [
        el('button', {
          class: 'panel__danger',
          onclick: () => {
            if (confirm('Apagar todo o progresso e recomeçar do nível 1?')) handlers.onReset()
          },
        }, ['Resetar o progresso']),
      ]),
    ])
  })
}
```

- [ ] **Step 7: Acrescentar os estilos dos controles a `src/styles/panels.css`**

```css
.panel__row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 2px;
}

.panel__slider {
  width: 100%;
  accent-color: var(--accent);
}

.panel__check {
  accent-color: var(--accent);
  width: 14px;
  height: 14px;
}

.panel__hotkey {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 2px;
  line-height: 1.4;
}

.panel__hotkey kbd {
  flex: none;
  min-width: 96px;
  font-family: var(--font);
  font-size: 11px;
  text-align: center;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--stroke-strong);
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-dim);
}

.panel__danger {
  width: 100%;
  min-height: 28px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 12px;
  color: #ff8080;
  border: 1px solid rgba(255, 128, 128, 0.3);
  background: rgba(255, 128, 128, 0.1);
}

.panel__danger:hover {
  background: rgba(255, 128, 128, 0.18);
}
```

- [ ] **Step 8: Acrescentar o botão ⚙ ao card**

Em `src/ui/card.ts`, o tipo ganha `onToggleSettings(): void`, e o bloco `card__tools` recebe mais um botão, antes do `✕`:

```ts
      el('button', { class: 'card__tool', title: 'Ajustes', onclick: handlers.onToggleSettings }, ['⚙']),
```

- [ ] **Step 9: Ligar tudo no `src/main.ts`**

Imports novos:

```ts
import { type Settings, DEFAULT_SETTINGS, normalizeSettings } from './core/settings'
import type { HotkeyAction } from './core/bridge'
```

Acrescente `toggleSettingsPanel` à lista já importada de `./ui/panels` e `resetProgress` à de `./core/progress`.

Um estado de ajustes ao lado do de progresso:

```ts
let settings: Settings = { ...DEFAULT_SETTINGS }

function applySettings(next: Settings): void {
  settings = next
  const bridge = getBridge()
  bridge?.setOpacity(settings.opacity)
  bridge?.setClickThrough(settings.clickThrough)
  void store.saveSettings(settings)
}
```

O handler do card:

```ts
  onToggleSettings: () =>
    toggleSettingsPanel(settings, {
      onOpacity: (value) => applySettings({ ...settings, opacity: value }),
      onClickThrough: (enabled) => applySettings({ ...settings, clickThrough: enabled }),
      onReset: () => {
        closePanel()
        update(resetProgress(guide))
      },
    }),
```

As hotkeys vindas da casca, antes de `void start()`:

```ts
getBridge()?.onHotkey((action: HotkeyAction) => {
  if (action === 'next') update(nextPart(guide, progress))
  else if (action === 'prev') update(previousPart(guide, progress))
  else if (action === 'complete') update(completeCurrent(guide, progress))
  else if (action === 'map') handlers.onToggleMap()
  else if (action === 'clickthrough') {
    applySettings({ ...settings, clickThrough: !settings.clickThrough })
  }
  // 'hide' é tratado no processo principal.
})
```

E `start` passa a carregar os ajustes junto:

```ts
async function start(): Promise<void> {
  applyLegendColors()
  const [savedProgress, savedSettings] = await Promise.all([
    store.loadProgress(),
    store.loadSettings(),
  ])
  progress = normalizeProgress(guide, savedProgress)
  applySettings(normalizeSettings(savedSettings))
  render()
}
```

- [ ] **Step 10: Rodar os testes e os tipos**

Run: `npm test && npx tsc --noEmit`
Expected: PASS — inclusive os 13 novos de hotkeys e ajustes.

- [ ] **Step 11: Conferir na casca**

Run: `npm run electron:dev`

1. `⚙` abre os ajustes; o slider muda a opacidade da janela na hora.
2. Ligar "cliques atravessam" faz o clique cair na janela de trás. `Ctrl+Alt+C` desliga de volta — é a única saída, então teste isso antes de qualquer outra coisa.
3. Com o Aion 2 em foco: `Ctrl+Alt+→` avança a part, `Ctrl+Alt+←` volta, `Ctrl+Alt+Enter` conclui, `Ctrl+Alt+M` abre o mapa, `Ctrl+Alt+H` esconde e mostra.
4. "Resetar o progresso" pergunta antes e volta para a Fase 1.
5. Fechar e reabrir: a opacidade escolhida voltou.
6. Se o console avisar que alguma hotkey está tomada, troque a combinação em `electron/hotkeys.ts`.

- [ ] **Step 12: Commit**

```bash
git add src electron tests
git commit -m "Adiciona hotkeys globais, click-through e ajustes

Seis atalhos em Control+Alt que funcionam com o jogo em foco.
registerHotkeys devolve as combinacoes ja tomadas por outro programa
em vez de fingir sucesso. O painel de ajustes controla opacidade,
click-through e reset, reaproveitando a casca dos outros paineis.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Empacotamento e README

Gera o `.exe` e escreve a documentação. O README precisa dizer a coisa que mais vai gerar dúvida: overlay nenhum aparece sobre um jogo em tela cheia exclusiva.

**Files:**
- Modify: `package.json` — bloco `build` e script `dist`
- Create: `electron-builder.yml`
- Create: `README.md`
- Modify: `.gitignore` — saída do empacotador

**Interfaces:**
- Consumes: tudo.
- Produces: `release/Aion 2 Guide Setup <versão>.exe` e um portátil.

- [ ] **Step 1: Instalar o empacotador**

```bash
npm i -D electron-builder
```

- [ ] **Step 2: Escrever o `electron-builder.yml`**

```yaml
appId: com.jotapegs.aion2guide
productName: Aion 2 Guide
directories:
  output: release
  buildResources: build
files:
  - dist/**
  - dist-electron/**
win:
  target:
    - target: nsis
      arch: [x64]
    - target: portable
      arch: [x64]
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
```

Sem `build/icon.ico` o empacotador usa o ícone padrão do Electron e apenas avisa. Para trocar, basta colocar um `.ico` de 256×256 nesse caminho.

- [ ] **Step 3: Acrescentar o script ao `package.json`**

```json
    "dist": "npm run build && electron-builder"
```

- [ ] **Step 4: Ignorar a saída do empacotador**

Acrescente ao `.gitignore`:

```
release/
build/icon.ico
```

- [ ] **Step 5: Gerar o executável**

Run: `npm run dist`
Expected: `release/` com o instalador NSIS e o portátil. A primeira execução baixa os binários do Electron e demora vários minutos.

- [ ] **Step 6: Instalar e testar o executável**

Rode o instalador, abra o app e confirme:
1. Sobe a janela translúcida no canto superior direito.
2. O progresso é salvo entre execuções — agora em `%APPDATA%/Aion 2 Guide/`, não mais na pasta do desenvolvimento.
3. As hotkeys globais funcionam.
4. Com o Aion 2 em *borderless windowed*, o overlay fica por cima.

- [ ] **Step 7: Escrever o `README.md`**

````markdown
# Aion 2 Guide

Overlay de guia de leveling 1–45 para Aion 2. Mostra uma part por vez,
flutua sobre o jogo sem sumir quando o foco vai para outra janela, e
guarda o progresso.

Construído a partir do *Aion 2 Level 1–45 Ultimate Speedrun Guide*.

## O jogo precisa estar em borderless windowed

Esta é a limitação que mais gera dúvida, e não tem como contornar: em
**tela cheia exclusiva o Windows não deixa nenhum overlay aparecer**, nem
este nem qualquer outro. Nas opções gráficas do Aion 2, escolha *janela
sem bordas* ou *borderless windowed*.

## Usar

Baixe o instalador ou o portátil em `release/` e abra. A janela sobe no
canto superior direito.

| Atalho | O que faz |
|---|---|
| `Ctrl+Alt+→` | próxima part |
| `Ctrl+Alt+←` | part anterior |
| `Ctrl+Alt+Enter` | concluir a part atual |
| `Ctrl+Alt+M` | abrir e fechar o mapa |
| `Ctrl+Alt+H` | esconder e mostrar o overlay |
| `Ctrl+Alt+C` | ligar e desligar os cliques atravessando |

Os atalhos são globais: funcionam com o jogo em foco. Se algum não
responder, outro programa já tomou a combinação — troque em
`electron/hotkeys.ts` e recompile. Com "cliques atravessam" ligado,
`Ctrl+Alt+C` é a única forma de voltar.

Nos botões do cabeçalho: 🗺 abre o mapa da part, ☰ lista todas as parts
para pular direto, `?` mostra a legenda das cores e a lista de downtime,
⚙ tem opacidade e reset.

**Navegar nunca marca nada.** Você pode percorrer o guia inteiro para
frente e para trás sem tocar no seu progresso; só o botão CONCLUIR e as
caixinhas das ações escrevem.

O progresso fica em `%APPDATA%/Aion 2 Guide/progress.json`.

## Segunda tela

O núcleo é uma página web comum. Para usar num segundo monitor, num
tablet ou no celular sem o overlay:

```bash
npm install
npm run dev -- --host
```

Abra o endereço de rede que o Vite imprimir. O progresso nesse caso fica
no navegador, separado do progresso do app.

## Desenvolver

```bash
npm install
npm run dev          # servidor de desenvolvimento e a janela Electron
npm test             # a suíte
npm run build        # checa os tipos e empacota o núcleo web
npm run dist         # gera o .exe em release/
```

### Como o conteúdo é montado

`data/guide.json` **é a fonte da verdade** e pode ser editado à mão — é
lá que entra, se alguém escrever, o texto de cada seta numerada dos
mapas.

Ele foi gerado uma vez a partir do `.docx` por `npm run extract`, que
também recorta o letterbox preto dos mapas (20,8% dos pixels de todas as
oito imagens) e converte para WebP em `public/maps/`. **Rodar o extract
de novo sobrescreve edições manuais**; ele existe para reimportar se
sair uma versão nova do guia.

Como `public/maps/` não é versionado, depois de clonar o repositório rode
`npm run extract` uma vez para gerar os mapas.

### Estrutura

```
data/guide.json      conteúdo
scripts/             importador do .docx
src/core/            lógica: guia, progresso, persistência
src/ui/              card, mapa, painéis
electron/            janela, hotkeys, disco
```

As três camadas são independentes: `src/` não sabe que o Electron
existe, e `electron/` não sabe nada sobre o guia.
````

- [ ] **Step 8: Rodar a suíte completa uma última vez**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: todos os testes passando, nenhum erro de tipo, build completo.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json electron-builder.yml README.md .gitignore
git commit -m "Empacota o app e escreve o README

Gera instalador e portatil para Windows com o electron-builder. O README
abre com a limitacao que mais gera duvida: em tela cheia exclusiva o
Windows nao deixa nenhum overlay aparecer, e o jogo precisa estar em
borderless windowed.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 10: Publicar**

```bash
git push
```
