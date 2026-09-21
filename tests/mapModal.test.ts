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

  it('o caminho da imagem é relativo, nunca absoluto', () => {
    // Uma barra inicial quebraria o Electron carregando por file://.
    openMap(MAP, 'x')
    const img = document.querySelector('img.map__img') as HTMLImageElement
    expect(img.getAttribute('src')?.startsWith('/')).toBe(false)
  })
})
