import type { MapRef } from '../core/guide'
import { MAP_SPLIT_MIN, MAP_SPLIT_MAX } from '../core/settings'
import { el, clear } from './dom'

const ZOOM_MIN = 1
const ZOOM_MAX = 4
const ZOOM_STEP = 0.25

export type MapHandlers = {
  /** Avisa que abriu ou fechou, para a casca crescer e voltar. */
  onOpenChange(open: boolean): void
  /** A proporção nova depois de arrastar a alça, para ser persistida. */
  onSplitChange(split: number): void
}

let host: HTMLElement | null = null
let handlers: MapHandlers = { onOpenChange: () => {}, onSplitChange: () => {} }
let split = 0.6

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

/** Liga o painel ao seu nó no documento. Chamado uma vez na abertura. */
export function initMap(element: HTMLElement, initialSplit: number, h: MapHandlers): void {
  host = element
  split = clamp(initialSplit, MAP_SPLIT_MIN, MAP_SPLIT_MAX)
  handlers = h
  applySplit()
}

function applySplit(): void {
  document.documentElement.style.setProperty('--map-split', `${split * 100}%`)
}

export function isMapOpen(): boolean {
  return host !== null && !host.hidden
}

export function closeMap(): void {
  if (!host || host.hidden) return
  clear(host)
  host.hidden = true
  document.body.classList.remove('com-mapa')
  handlers.onOpenChange(false)
}

/**
 * Abre o mapa ao lado do card. O palco carrega a proporção real da
 * imagem — as oito variam de 922×928 a 1258×882 depois do recorte, então
 * não dá para assumir nada.
 */
export function openMap(map: MapRef, caption: string): void {
  if (!host) return

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

  stage.addEventListener('wheel', (e) => {
    e.preventDefault()
    const next = zoom + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)
    zoom = clamp(next, ZOOM_MIN, ZOOM_MAX)
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

  const zoomOut = (): void => {
    zoom = clamp(zoom - ZOOM_STEP, ZOOM_MIN, ZOOM_MAX)
    if (zoom === 1) { panX = 0; panY = 0 }
    apply()
  }
  const zoomIn = (): void => {
    zoom = clamp(zoom + ZOOM_STEP, ZOOM_MIN, ZOOM_MAX)
    apply()
  }
  const reset = (): void => {
    zoom = 1; panX = 0; panY = 0
    apply()
  }

  const barra = el('div', { class: 'map__bar' }, [
    el('span', { class: 'map__caption' }, [caption]),
    el('button', { class: 'map__btn', title: 'Diminuir', 'aria-label': 'Diminuir o zoom', onclick: zoomOut }, ['−']),
    el('button', { class: 'map__btn', title: 'Tamanho original', 'aria-label': 'Voltar ao tamanho original', onclick: reset }, ['⟲']),
    el('button', { class: 'map__btn', title: 'Aumentar', 'aria-label': 'Aumentar o zoom', onclick: zoomIn }, ['+']),
    el('button', { class: 'map__btn', title: 'Fechar o mapa', 'aria-label': 'Fechar o mapa', onclick: closeMap }, ['✕']),
  ])

  clear(host)
  host.append(barra, stage, criarAlca())
  host.hidden = false
  document.body.classList.add('com-mapa')
  apply()
  handlers.onOpenChange(true)
}

/** A alça entre o mapa e o card, que decide quanto cada um ocupa. */
function criarAlca(): HTMLElement {
  const alca = el('div', {
    class: 'map__alca',
    role: 'separator',
    'aria-label': 'Ajustar a largura do mapa',
    'aria-orientation': 'vertical',
    tabindex: '0',
  })

  const arrastar = (e: PointerEvent): void => {
    e.preventDefault()
    const mover = (ev: PointerEvent): void => {
      // A fração é medida contra a janela inteira, não contra o painel:
      // é ela que divide os dois lados.
      const largura = document.documentElement.clientWidth
      if (largura === 0) return
      split = clamp(ev.clientX / largura, MAP_SPLIT_MIN, MAP_SPLIT_MAX)
      applySplit()
    }
    const soltar = (): void => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
      handlers.onSplitChange(split)
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
  }

  alca.addEventListener('pointerdown', arrastar)

  // Teclado: quem não usa mouse também precisa ajustar.
  alca.addEventListener('keydown', (e) => {
    const passo = 0.02
    if (e.key === 'ArrowLeft') split = clamp(split - passo, MAP_SPLIT_MIN, MAP_SPLIT_MAX)
    else if (e.key === 'ArrowRight') split = clamp(split + passo, MAP_SPLIT_MIN, MAP_SPLIT_MAX)
    else return
    e.preventDefault()
    applySplit()
    handlers.onSplitChange(split)
  })

  return alca
}

/** Abre, ou fecha se já aberto. Parts sem mapa simplesmente não respondem. */
export function toggleMap(map: MapRef | null, caption: string): void {
  if (isMapOpen()) {
    closeMap()
    return
  }
  if (map) openMap(map, caption)
}
