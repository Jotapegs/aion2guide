import './styles/base.css'
import './styles/card.css'
import rawGuide from '../data/guide.json'
import { parseGuide } from './core/guide'
import { type Progress, normalizeProgress, nextPart, previousPart, toggleAction, completeCurrent } from './core/progress'
import { createStore } from './core/storage'
import { getBridge } from './core/bridge'
import { renderCard, type CardHandlers } from './ui/card'

const guide = parseGuide(rawGuide)
const store = createStore()
const root = document.querySelector<HTMLElement>('#overlay')!

let progress: Progress = normalizeProgress(guide, null)

/** Aplica uma transição, redesenha e persiste. */
function update(next: Progress): void {
  progress = next
  render()
  void store.saveProgress(progress)
}

const handlers: CardHandlers = {
  onPrev: () => update(previousPart(guide, progress)),
  onNext: () => update(nextPart(guide, progress)),
  onComplete: () => update(completeCurrent(guide, progress)),
  onToggleAction: (id) => update(toggleAction(guide, progress, id)),
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
  progress = normalizeProgress(guide, await store.loadProgress())
  render()
}

void start()
