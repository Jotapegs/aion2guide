import { app, BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'node:path'

import { createFileStore } from './store'
import {
  createOverlayWindow, sanitizeBounds, resizedBounds,
  EXPANDED_WIDTH, EXPANDED_HEIGHT, type WindowBounds,
} from './window'
import { registerHotkeys, unregisterHotkeys } from './hotkeys'
import type { HotkeyAction } from '../src/core/bridge'

const store = createFileStore(app.getPath('userData'))
let win: BrowserWindow | null = null

/** Grava os limites da janela no máximo uma vez por segundo. */
function watchBounds(window: BrowserWindow): void {
  let timer: NodeJS.Timeout | null = null
  const save = (): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      if (!window.isDestroyed()) void store.write('window', window.getBounds() as WindowBounds)
    }, 1000)
  }
  window.on('move', save)
  window.on('resize', save)
}

/**
 * O tamanho compacto de antes de abrir o mapa. Guardado para devolver a
 * janela exatamente ao que o usuário tinha, inclusive se ele a
 * redimensionou.
 */
let compacto: WindowBounds | null = null

function alternarMapa(open: boolean): void {
  if (!win || win.isDestroyed()) return
  const atual = win.getBounds()
  const area = screen.getDisplayMatching(atual).workArea

  if (open) {
    // Reabrir com o mapa já aberto não pode sobrescrever o compacto
    // guardado com o tamanho expandido.
    if (compacto === null) compacto = atual
    win.setBounds(resizedBounds(atual, { width: EXPANDED_WIDTH, height: EXPANDED_HEIGHT }, area))
    return
  }

  const alvo = compacto ?? atual
  compacto = null
  win.setBounds(resizedBounds(atual, { width: alvo.width, height: alvo.height }, area))
}

function registerIpc(): void {
  ipcMain.handle('aion:loadProgress', () => store.read('progress'))
  ipcMain.handle('aion:saveProgress', (_e, progress) => store.write('progress', progress))
  ipcMain.handle('aion:loadSettings', () => store.read('settings'))
  ipcMain.handle('aion:saveSettings', (_e, settings) => store.write('settings', settings))
  ipcMain.on('aion:setOpacity', (_e, value: number) => win?.setOpacity(value))
  ipcMain.on('aion:setClickThrough', (_e, enabled: boolean) => {
    // forward mantém o hover chegando enquanto os cliques atravessam.
    win?.setIgnoreMouseEvents(enabled, { forward: true })
  })
  ipcMain.on('aion:setMapOpen', (_e, open: boolean) => alternarMapa(open))
  ipcMain.on('aion:minimize', () => win?.minimize())
  ipcMain.on('aion:close', () => win?.close())
}

/**
 * 'hide' é tratado aqui, não no renderer: com a janela escondida ele não
 * poderia responder para trazê-la de volta. O resto é repassado.
 */
function handleHotkey(action: HotkeyAction): void {
  if (!win) return
  if (action === 'hide') {
    if (win.isVisible()) win.hide()
    else win.show()
    return
  }
  win.webContents.send('aion:hotkey', action)
}

/** Sem isto, uma falha ao abrir vira rejeição não tratada e o app fica
 *  sem janela e sem explicação. */
async function abrirJanela(): Promise<void> {
  try {
    await createWindow()
  } catch (erro) {
    console.error('nao consegui abrir a janela:', erro)
    app.quit()
  }
}

async function createWindow(): Promise<void> {
  win = createOverlayWindow(sanitizeBounds(await store.read('window')))
  watchBounds(win)

  win.once('ready-to-show', () => win?.show())
  win.on('closed', () => {
    win = null
  })

  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) await win.loadURL(devUrl)
  else await win.loadFile(join(import.meta.dirname, '../dist/index.html'))
}

// Uma segunda instância só brigaria pelas hotkeys globais com a primeira.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    win?.show()
    win?.focus()
  })

  void app.whenReady().then(() => {
    registerIpc()
    const naoRegistradas = registerHotkeys(handleHotkey)
    if (naoRegistradas.length > 0) {
      console.warn(`hotkeys ja tomadas por outro programa: ${naoRegistradas.join(', ')}`)
    }
    void abrirJanela()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) void abrirJanela()
    })
  })

  app.on('will-quit', unregisterHotkeys)
  app.on('window-all-closed', () => app.quit())
}
