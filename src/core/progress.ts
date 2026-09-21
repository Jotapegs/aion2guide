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
