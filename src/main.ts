import './styles/base.css'
import './styles/card.css'
import './styles/map.css'
import './styles/panels.css'
import rawGuide from '../data/guide.json'
import { parseGuide } from './core/guide'
import {
  type Progress,
  normalizeProgress, nextPart, previousPart, toggleAction, completeCurrent, currentFlatPart, goToPart, resetProgress,
} from './core/progress'
import { createStore } from './core/storage'
import { getBridge } from './core/bridge'
import type { HotkeyAction } from './core/bridge'
import { type Settings, DEFAULT_SETTINGS, normalizeSettings } from './core/settings'
import { renderCard, type CardHandlers } from './ui/card'
import { toggleMap, closeMap, isMapOpen } from './ui/mapModal'
import { toggleNavPanel, toggleRefPanel, toggleSettingsPanel, closePanel, isPanelOpen } from './ui/panels'

const guide = parseGuide(rawGuide)
const store = createStore()
const root = document.querySelector<HTMLElement>('#overlay')!

let progress: Progress = normalizeProgress(guide, null)
let settings: Settings = { ...DEFAULT_SETTINGS }

/** Aplica os ajustes na janela e persiste. */
function applySettings(next: Settings): void {
  settings = next
  const bridge = getBridge()
  bridge?.setOpacity(settings.opacity)
  bridge?.setClickThrough(settings.clickThrough)
  void store.saveSettings(settings)
}

/** Aplica uma transição, redesenha e persiste. */
function update(next: Progress): void {
  // Antes de `progress = next`: depois, a comparação seria do valor com
  // ele mesmo e o mapa nunca fecharia, continuando a mostrar a zona
  // anterior enquanto o texto já fala de outra.
  if (next.currentPartId !== progress.currentPartId) closeMap()
  progress = next
  render()
  void store.saveProgress(progress)
}

const handlers: CardHandlers = {
  onPrev: () => update(previousPart(guide, progress)),
  onNext: () => update(nextPart(guide, progress)),
  onComplete: () => update(completeCurrent(guide, progress)),
  onToggleAction: (id) => update(toggleAction(guide, progress, id)),
  onToggleMap: () => {
    const { part, phase } = currentFlatPart(guide, progress)
    toggleMap(part.map, `${phase.title} · ${part.title}`)
  },
  onToggleNav: () => toggleNavPanel(guide, progress, (id) => update(goToPart(guide, progress, id))),
  onToggleRef: () => toggleRefPanel(guide),
  onToggleSettings: () =>
    toggleSettingsPanel(settings, {
      onOpacity: (value) => applySettings({ ...settings, opacity: value }),
      onClickThrough: (enabled) => applySettings({ ...settings, clickThrough: enabled }),
      onReset: () => {
        closePanel()
        update(resetProgress(guide))
      },
    }),
  onClose: () => getBridge()?.close(),
}

function render(): void {
  renderCard(root, guide, progress, handlers)
}

/** As cores da interface vêm da legenda do guia, não de constantes no CSS. */
function applyLegendColors(): void {
  for (const entry of guide.legend) {
    document.documentElement.style.setProperty(`--tag-${entry.id}`, entry.uiColor)
  }
}

async function start(): Promise<void> {
  applyLegendColors()
  const [progressoSalvo, ajustesSalvos] = await Promise.all([
    store.loadProgress(),
    store.loadSettings(),
  ])
  progress = normalizeProgress(guide, progressoSalvo)
  applySettings(normalizeSettings(ajustesSalvos))
  render()
}

window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return
  // O mapa fica por cima dos painéis, então fecha primeiro.
  if (isMapOpen()) closeMap()
  else if (isPanelOpen()) closePanel()
})

getBridge()?.onHotkey((action: HotkeyAction) => {
  if (action === 'next') update(nextPart(guide, progress))
  else if (action === 'prev') update(previousPart(guide, progress))
  else if (action === 'complete') update(completeCurrent(guide, progress))
  else if (action === 'map') handlers.onToggleMap()
  else if (action === 'clickthrough') {
    applySettings({ ...settings, clickThrough: !settings.clickThrough })
  }
  // 'hide' é tratado no processo principal: com a janela escondida, o
  // renderer não poderia responder para trazê-la de volta.
})

void start()
