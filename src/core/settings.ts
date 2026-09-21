/** Abaixo de 0.3 o overlay vira um fantasma inútil. */
export const OPACITY_MIN = 0.3
export const OPACITY_MAX = 1

/**
 * Fração da janela expandida que fica com o mapa. Os limites existem
 * para que nenhum dos dois lados vire uma tira: abaixo de 0.3 o mapa não
 * mostra nada útil, acima de 0.75 a checklist fica estreita demais para
 * o texto do guia, que tem linhas longas.
 */
export const MAP_SPLIT_MIN = 0.3
export const MAP_SPLIT_MAX = 0.75

export type Settings = {
  schemaVersion: 1
  opacity: number
  clickThrough: boolean
  mapSplit: number
}

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: 1,
  opacity: 0.92,
  clickThrough: false,
  mapSplit: 0.6,
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
    mapSplit:
      typeof r.mapSplit === 'number' && Number.isFinite(r.mapSplit)
        ? clamp(r.mapSplit, MAP_SPLIT_MIN, MAP_SPLIT_MAX)
        : DEFAULT_SETTINGS.mapSplit,
  }
}
