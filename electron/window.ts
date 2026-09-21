import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'

const DEFAULT_WIDTH = 360
const DEFAULT_HEIGHT = 240
const MIN_WIDTH = 280
const MIN_HEIGHT = 160
const MARGIN = 24

export type WindowBounds = { x: number; y: number; width: number; height: number }

/** Canto superior direito da tela principal, com uma margem. */
function defaultBounds(): WindowBounds {
  const { workArea } = screen.getPrimaryDisplay()
  return {
    x: workArea.x + workArea.width - DEFAULT_WIDTH - MARGIN,
    y: workArea.y + MARGIN,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  }
}

/**
 * Descarta posições fora de qualquer tela. Um monitor desligado desde a
 * última sessão deixaria a janela num lugar invisível, e o usuário acharia
 * que o app não abriu.
 */
export function sanitizeBounds(raw: unknown): WindowBounds {
  if (typeof raw !== 'object' || raw === null) return defaultBounds()
  const r = raw as Record<string, unknown>
  const numeros = (['x', 'y', 'width', 'height'] as const).every(
    (k) => typeof r[k] === 'number' && Number.isFinite(r[k]),
  )
  if (!numeros) return defaultBounds()

  const bounds = r as unknown as WindowBounds
  const visivel = screen.getAllDisplays().some((d) => {
    const a = d.workArea
    return (
      bounds.x < a.x + a.width &&
      bounds.x + bounds.width > a.x &&
      bounds.y < a.y + a.height &&
      bounds.y + bounds.height > a.y
    )
  })
  if (!visivel) return defaultBounds()

  return {
    x: bounds.x,
    y: bounds.y,
    width: Math.max(MIN_WIDTH, bounds.width),
    height: Math.max(MIN_HEIGHT, bounds.height),
  }
}

export function createOverlayWindow(bounds: WindowBounds): BrowserWindow {
  const win = new BrowserWindow({
    ...bounds,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: false,
    show: false,
    webPreferences: {
      preload: join(import.meta.dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // O nível nomeado é o que segura acima de jogos no Windows.
  // alwaysOnTop: true no construtor não basta.
  win.setAlwaysOnTop(true, 'screen-saver')
  // Acompanha o jogo quando ele troca de área de trabalho virtual.
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  return win
}
