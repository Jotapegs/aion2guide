// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { initMap, openMap, closeMap, isMapOpen, toggleMap } from '../src/ui/mapModal'
import { MAP_SPLIT_MIN, MAP_SPLIT_MAX } from '../src/core/settings'

const MAP = { src: 'maps/image6.webp', width: 1050, height: 752 }

let host: HTMLElement
let onOpenChange: (open: boolean) => void
let onSplitChange: (split: number) => void

/** O split em fração, lido da variável que o CSS consome. */
function splitAtual(): number {
  const v = document.documentElement.style.getPropertyValue('--map-split')
  return Number(v.replace('%', '')) / 100
}

/** Arrasta a alça até uma posição horizontal em pixels. */
function arrastarAlca(paraX: number): void {
  const alca = host.querySelector('.map__alca')!
  alca.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
  window.dispatchEvent(new PointerEvent('pointermove', { clientX: paraX }))
  window.dispatchEvent(new PointerEvent('pointerup'))
}

beforeEach(() => {
  document.body.innerHTML = '<div id="overlay"><aside id="mapside" hidden></aside><div id="card"></div></div>'
  host = document.querySelector<HTMLElement>('#mapside')!
  onOpenChange = vi.fn<(open: boolean) => void>()
  onSplitChange = vi.fn<(split: number) => void>()
  initMap(host, 0.6, { onOpenChange, onSplitChange })
  // jsdom reporta 0 de largura; finge uma janela de 1000px para a alça.
  Object.defineProperty(document.documentElement, 'clientWidth', { value: 1000, configurable: true })
})

afterEach(() => {
  closeMap()
})

describe('painel do mapa', () => {
  it('começa fechado e escondido', () => {
    expect(isMapOpen()).toBe(false)
    expect(host.hidden).toBe(true)
  })

  it('abre ao lado do card, não por cima dele', () => {
    openMap(MAP, 'Phase 4 · Part 1')
    expect(isMapOpen()).toBe(true)
    // O card continua no documento e visível: é esse o ponto da mudança.
    expect(document.querySelector('#card')).not.toBeNull()
    expect(host.hidden).toBe(false)
    // Nada de sobreposição em tela cheia.
    expect(document.querySelector('.map')).toBeNull()
  })

  it('mostra a imagem e a legenda', () => {
    openMap(MAP, 'Phase 4 · Part 1')
    const img = host.querySelector('img.map__img') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('./maps/image6.webp')
    expect(img.getAttribute('alt')).toContain('Phase 4')
    expect(host.textContent).toContain('Phase 4 · Part 1')
  })

  it('o caminho da imagem é relativo, nunca absoluto', () => {
    // Uma barra inicial quebraria o Electron carregando por file://.
    openMap(MAP, 'x')
    const img = host.querySelector('img.map__img') as HTMLImageElement
    expect(img.getAttribute('src')?.startsWith('/')).toBe(false)
  })

  it('avisa quem hospeda que abriu e que fechou', () => {
    // É esse aviso que faz a janela do Electron crescer e voltar.
    openMap(MAP, 'x')
    expect(onOpenChange).toHaveBeenLastCalledWith(true)
    closeMap()
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
  })

  it('fechar sem ter aberto não avisa nem quebra', () => {
    expect(() => closeMap()).not.toThrow()
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('abrir duas vezes não empilha dois mapas', () => {
    openMap(MAP, 'a')
    openMap(MAP, 'b')
    expect(host.querySelectorAll('img.map__img')).toHaveLength(1)
    expect(host.textContent).toContain('b')
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

  it('a proporção do palco vem das dimensões reais do mapa', () => {
    openMap({ src: 'maps/image5.webp', width: 922, height: 928 }, 'x')
    const stage = host.querySelector('.map__stage') as HTMLElement
    expect(stage.style.aspectRatio).toBe('922 / 928')
  })

  it('o botão de fechar fecha', () => {
    openMap(MAP, 'x')
    const fechar = [...host.querySelectorAll('button')].find(
      (b) => b.getAttribute('aria-label') === 'Fechar o mapa',
    )!
    fechar.click()
    expect(isMapOpen()).toBe(false)
  })

  it('todo botão do painel tem nome acessível', () => {
    openMap(MAP, 'x')
    const semNome = [...host.querySelectorAll('button')].filter((b) => !b.getAttribute('aria-label'))
    expect(semNome).toEqual([])
  })
})

describe('zoom', () => {
  it('os botões aumentam e diminuem', () => {
    openMap(MAP, 'x')
    const img = host.querySelector('.map__img') as HTMLElement
    const btn = (rotulo: string): HTMLElement =>
      [...host.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === rotulo)!

    expect(img.style.transform).toContain('scale(1)')
    btn('Aumentar o zoom').click()
    expect(img.style.transform).toContain('scale(1.25)')
    btn('Diminuir o zoom').click()
    expect(img.style.transform).toContain('scale(1)')
  })

  it('não diminui abaixo do tamanho original', () => {
    openMap(MAP, 'x')
    const img = host.querySelector('.map__img') as HTMLElement
    const menos = [...host.querySelectorAll('button')].find(
      (b) => b.getAttribute('aria-label') === 'Diminuir o zoom',
    )!
    for (let i = 0; i < 6; i++) menos.click()
    expect(img.style.transform).toContain('scale(1)')
  })

  it('voltar ao original zera também o deslocamento', () => {
    openMap(MAP, 'x')
    const img = host.querySelector('.map__img') as HTMLElement
    const btn = (rotulo: string): HTMLElement =>
      [...host.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === rotulo)!
    btn('Aumentar o zoom').click()
    btn('Aumentar o zoom').click()
    btn('Voltar ao tamanho original').click()
    expect(img.style.transform).toBe('translate(0px, 0px) scale(1)')
  })
})

describe('alça de ajuste', () => {
  it('arrastar muda a proporção e avisa para persistir', () => {
    openMap(MAP, 'x')
    arrastarAlca(500)
    expect(splitAtual()).toBeCloseTo(0.5)
    expect(onSplitChange).toHaveBeenCalledWith(0.5)
  })

  it('não deixa o mapa engolir a checklist', () => {
    openMap(MAP, 'x')
    arrastarAlca(990)
    expect(splitAtual()).toBeCloseTo(MAP_SPLIT_MAX)
  })

  it('nem a checklist espremer o mapa a nada', () => {
    openMap(MAP, 'x')
    arrastarAlca(10)
    expect(splitAtual()).toBeCloseTo(MAP_SPLIT_MIN)
  })

  it('as setas do teclado também ajustam', () => {
    openMap(MAP, 'x')
    const alca = host.querySelector('.map__alca')!
    const antes = splitAtual()
    alca.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(splitAtual()).toBeGreaterThan(antes)
    alca.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    expect(splitAtual()).toBeCloseTo(antes)
    expect(onSplitChange).toHaveBeenCalled()
  })

  it('a alça é anunciada como separador ajustável', () => {
    openMap(MAP, 'x')
    const alca = host.querySelector('.map__alca')!
    expect(alca.getAttribute('role')).toBe('separator')
    expect(alca.getAttribute('aria-label')).toBeTruthy()
    expect(alca.getAttribute('tabindex')).toBe('0')
  })

  it('a proporção salva é respeitada ao iniciar', () => {
    initMap(host, 0.42, { onOpenChange, onSplitChange })
    expect(splitAtual()).toBeCloseTo(0.42)
  })

  it('uma proporção salva fora dos limites é trazida para dentro', () => {
    initMap(host, 0.95, { onOpenChange, onSplitChange })
    expect(splitAtual()).toBeCloseTo(MAP_SPLIT_MAX)
  })
})
