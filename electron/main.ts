import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'

import { createFileStore } from './store'
import { createOverlayWindow, sanitizeBounds, type WindowBounds } from './window'

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
  ipcMain.on('aion:minimize', () => win?.minimize())
  ipcMain.on('aion:close', () => win?.close())
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
    void createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) void createWindow()
    })
  })

  app.on('window-all-closed', () => app.quit())
}
