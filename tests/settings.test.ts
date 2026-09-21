import { describe, it, expect } from 'vitest'
import {
  normalizeSettings, DEFAULT_SETTINGS,
  OPACITY_MIN, OPACITY_MAX, MAP_SPLIT_MIN, MAP_SPLIT_MAX,
} from '../src/core/settings'

describe('normalizeSettings', () => {
  it('aceita ajustes válidos', () => {
    const s = { schemaVersion: 1, opacity: 0.7, clickThrough: true, mapSplit: 0.5 }
    expect(normalizeSettings(s)).toEqual(s)
  })

  it('completa um campo que falta com o padrão', () => {
    // Um arquivo gravado por uma versão anterior não tem mapSplit.
    const antigo = { schemaVersion: 1, opacity: 0.7, clickThrough: true }
    expect(normalizeSettings(antigo).mapSplit).toBe(DEFAULT_SETTINGS.mapSplit)
  })

  it('limita a proporção do mapa à faixa utilizável', () => {
    expect(normalizeSettings({ schemaVersion: 1, opacity: 1, clickThrough: false, mapSplit: 0.01 }).mapSplit)
      .toBe(MAP_SPLIT_MIN)
    expect(normalizeSettings({ schemaVersion: 1, opacity: 1, clickThrough: false, mapSplit: 9 }).mapSplit)
      .toBe(MAP_SPLIT_MAX)
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
