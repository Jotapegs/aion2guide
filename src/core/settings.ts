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
