import type { MapRef } from '../core/guide'
import { el } from './dom'

const ZOOM_MIN = 1
const ZOOM_MAX = 4
const ZOOM_STEP = 0.25

let overlay: HTMLElement | null = null

export function isMapOpen(): boolean {
  return overlay !== null
}

export function closeMap(): void {
  overlay?.remove()
  overlay = null
}

/**
 * Abre o mapa sobre o card. O palco carrega a proporção real da imagem —
 * as oito variam de 922×928 a 1258×882 depois do recorte, então não dá
 * para assumir nada.
 */
export function openMap(map: MapRef, caption: string): void {
  closeMap()

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
  stage.addEventListener('click', (e) => e.stopPropagation())

  stage.addEventListener('wheel', (e) => {
    e.preventDefault()
    const next = zoom + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)
    zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next))
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

  overlay = el('div', { class: 'map', onclick: closeMap }, [
    stage,
    el('div', { class: 'map__caption' }, [
      el('span', {}, [caption]),
      el('span', { class: 'map__hint' }, ['roda: zoom · arrastar: mover · Esc: fechar']),
    ]),
  ])

  apply()
  document.body.append(overlay)
}

/** Abre, ou fecha se já aberto. Parts sem mapa simplesmente não respondem. */
export function toggleMap(map: MapRef | null, caption: string): void {
  if (isMapOpen()) {
    closeMap()
    return
  }
  if (map) openMap(map, caption)
}
