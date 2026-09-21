// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { toggleSettingsPanel, toggleRefPanel, closePanel, isPanelOpen } from '../src/ui/panels'
import { DEFAULT_SETTINGS, OPACITY_MIN, OPACITY_MAX } from '../src/core/settings'
import { HOTKEYS } from '../src/core/hotkeys'
import { makeGuide } from './fixtures/guide'

const handlers = () => ({ onOpacity: vi.fn(), onClickThrough: vi.fn(), onReset: vi.fn() })

afterEach(() => {
  closePanel()
  vi.unstubAllGlobals()
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
  })

  it('lista os atalhos a partir da mesma fonte que a casca registra', () => {
    toggleSettingsPanel(DEFAULT_SETTINGS, handlers())
    const teclas = [...document.querySelectorAll('.panel__hotkey kbd')].map((k) => k.textContent)
    expect(teclas).toHaveLength(Object.keys(HOTKEYS).length)
    expect(teclas).toContain('Ctrl+Alt+→')
    expect(teclas).toContain('Ctrl+Alt+M')
  })

  it('chamar de novo fecha', () => {
    toggleSettingsPanel(DEFAULT_SETTINGS, handlers())
    toggleSettingsPanel(DEFAULT_SETTINGS, handlers())
    expect(isPanelOpen()).toBe(false)
  })

  it('continua valendo um painel por vez', () => {
    toggleSettingsPanel(DEFAULT_SETTINGS, handlers())
    toggleRefPanel(makeGuide())
    expect(document.querySelectorAll('.panel')).toHaveLength(1)
    expect(document.querySelector('.panel__slider')).toBeNull()
  })
})
