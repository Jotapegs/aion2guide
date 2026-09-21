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

  it('marca quais parts têm mapa', () => {
    toggleNavPanel(guide, initialProgress(guide), noop)
    const comMapa = [...document.querySelectorAll('.panel__part')]
      .filter((p) => p.querySelector('.panel__part-map'))
      .map((p) => p.getAttribute('data-id'))
    expect(comMapa).toEqual(['p2-1'])
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
    expect(kisk.style.background).not.toBe('')
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

  it('abrir o de navegação fecha o de referência', () => {
    toggleRefPanel(guide)
    toggleNavPanel(guide, initialProgress(guide), noop)
    expect(document.querySelectorAll('.panel')).toHaveLength(1)
    expect(document.querySelector('.panel__swatch')).toBeNull()
  })

  it('o botão de fechar do painel tem nome acessível', () => {
    toggleRefPanel(guide)
    const fechar = document.querySelector<HTMLElement>('.panel__close')!
    expect(fechar.getAttribute('aria-label')).toBe('Fechar')
  })

  it('fechar sem ter aberto não quebra', () => {
    expect(() => closePanel()).not.toThrow()
  })
})
