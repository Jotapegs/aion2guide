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
