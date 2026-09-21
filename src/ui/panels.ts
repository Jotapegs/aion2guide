import { type Guide, flattenParts } from '../core/guide'
import type { Progress } from '../core/progress'
import { el } from './dom'
import { type Settings, OPACITY_MIN, OPACITY_MAX } from '../core/settings'
import { HOTKEYS, HOTKEY_LABELS, formatAccelerator } from '../core/hotkeys'
import type { HotkeyAction } from '../core/bridge'

type PanelKind = 'nav' | 'ref' | 'settings'

let panel: HTMLElement | null = null
let openKind: PanelKind | null = null

export function isPanelOpen(): boolean {
  return panel !== null
}

export function closePanel(): void {
  panel?.remove()
  panel = null
  openKind = null
}

function mount(kind: PanelKind, title: string, content: HTMLElement[]): void {
  closePanel()
  openKind = kind
  panel = el('div', { class: 'panel' }, [
    el('header', { class: 'panel__head' }, [
      el('span', {}, [title]),
      el('button', { class: 'panel__close', title: 'Fechar', 'aria-label': 'Fechar', onclick: closePanel }, ['✕']),
    ]),
    el('div', { class: 'panel__body' }, content),
  ])
  document.body.append(panel)
}

/** Abre ou fecha, conforme o que já estiver aberto. */
function toggle(kind: PanelKind, build: () => void): void {
  if (openKind === kind) {
    closePanel()
    return
  }
  build()
}

export function toggleNavPanel(
  guide: Guide,
  progress: Progress,
  onPick: (partId: string) => void,
): void {
  toggle('nav', () => {
    const groups = guide.phases.map((phase) =>
      el('section', { class: 'panel__phase' }, [
        el('div', { class: 'panel__phase-head' }, [
          el('span', { class: 'panel__phase-title' }, [phase.title]),
          el('span', { class: 'panel__phase-levels' }, [`${phase.levelFrom}–${phase.levelTo}`]),
        ]),
        ...phase.parts.map((part) => {
          const classes = ['panel__part']
          if (part.id === progress.currentPartId) classes.push('panel__part--current')
          if (progress.completedParts.includes(part.id)) classes.push('panel__part--done')
          return el('button', {
            class: classes.join(' '),
            'data-id': part.id,
            onclick: () => {
              closePanel()
              onPick(part.id)
            },
          }, [
            el('span', { class: 'panel__part-mark', 'aria-hidden': 'true' }, [
              progress.completedParts.includes(part.id) ? '✓' : '·',
            ]),
            el('span', {}, [part.title]),
            ...(part.map ? [el('span', { class: 'panel__part-map', title: 'tem mapa' }, ['🗺'])] : []),
          ])
        }),
      ]),
    )
    mount('nav', `Navegar · ${flattenParts(guide).length} parts`, groups)
  })
}

export function toggleRefPanel(guide: Guide): void {
  toggle('ref', () => {
    const legend = el('div', { class: 'panel__group' }, [
      el('h3', { class: 'panel__group-title' }, ['Legenda dos mapas']),
      ...guide.legend.map((entry) => {
        const swatch = el('span', { class: 'panel__swatch', 'data-tag': entry.id })
        // uiColor, não color: o documento pinta os kisks de preto, que
        // desapareceria sobre o vidro escuro do overlay.
        swatch.style.background = entry.uiColor
        return el('div', { class: 'panel__legend-row' }, [
          swatch,
          el('span', { class: 'panel__legend-marker' }, [entry.marker]),
          el('span', { class: 'panel__legend-label' }, [entry.label]),
        ])
      }),
    ])

    const downtime = el('div', { class: 'panel__group' }, [
      el('h3', { class: 'panel__group-title' }, ['Prioridade no downtime']),
      el('ol', { class: 'panel__downtime' }, guide.downtime.map((item) => el('li', {}, [item]))),
    ])

    mount('ref', 'Referência', [legend, downtime])
  })
}

export type SettingsHandlers = {
  onOpacity(value: number): void
  onClickThrough(enabled: boolean): void
  onReset(): void
}

export function toggleSettingsPanel(settings: Settings, handlers: SettingsHandlers): void {
  toggle('settings', () => {
    const slider = el('input', {
      class: 'panel__slider',
      type: 'range',
      min: String(OPACITY_MIN),
      max: String(OPACITY_MAX),
      step: '0.01',
      value: String(settings.opacity),
      'aria-label': 'Opacidade da janela',
    }) as HTMLInputElement
    slider.addEventListener('input', () => handlers.onOpacity(Number(slider.value)))

    const check = el('input', { class: 'panel__check', type: 'checkbox' }) as HTMLInputElement
    check.checked = settings.clickThrough
    check.addEventListener('change', () => handlers.onClickThrough(check.checked))

    mount('settings', 'Ajustes', [
      el('div', { class: 'panel__group' }, [
        el('h3', { class: 'panel__group-title' }, ['Opacidade']),
        el('div', { class: 'panel__row' }, [slider]),
      ]),
      el('div', { class: 'panel__group' }, [
        el('h3', { class: 'panel__group-title' }, ['Janela']),
        el('label', { class: 'panel__row' }, [
          check,
          el('span', {}, ['Cliques atravessam o overlay']),
        ]),
      ]),
      el('div', { class: 'panel__group' }, [
        el('h3', { class: 'panel__group-title' }, ['Atalhos globais']),
        ...(Object.entries(HOTKEYS) as [HotkeyAction, string][]).map(([action, accelerator]) =>
          el('div', { class: 'panel__hotkey' }, [
            el('kbd', {}, [formatAccelerator(accelerator)]),
            el('span', {}, [HOTKEY_LABELS[action]]),
          ]),
        ),
      ]),
      el('div', { class: 'panel__group' }, [
        el('button', {
          class: 'panel__danger',
          onclick: () => {
            if (confirm('Apagar todo o progresso e recomeçar do nível 1?')) handlers.onReset()
          },
        }, ['Resetar o progresso']),
      ]),
    ])
  })
}
