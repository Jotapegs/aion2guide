import { getBridge } from './bridge'
import type { Progress } from './progress'
import type { Settings } from './settings'

export const PROGRESS_KEY = 'aion2guide.progress'
export const SETTINGS_KEY = 'aion2guide.settings'

export type Store = {
  loadProgress(): Promise<unknown>
  saveProgress(progress: Progress): Promise<void>
  loadSettings(): Promise<unknown>
  saveSettings(settings: Settings): Promise<void>
}

/**
 * Persistir é melhor-esforço. Uma falha de disco ou um localStorage bloqueado
 * não podem derrubar o overlay no meio de um run: o pior caso é perder
 * progresso, e para isso normalizeProgress já tem resposta.
 */
async function attempt<T>(fn: () => Promise<T> | T, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch {
    return fallback
  }
}

function webStore(): Store {
  const read = (key: string): unknown =>
    attemptSync(() => {
      const raw = localStorage.getItem(key)
      return raw === null ? null : JSON.parse(raw)
    })

  function attemptSync(fn: () => unknown): unknown {
    try {
      return fn()
    } catch {
      return null
    }
  }

  const write = (key: string, value: unknown): void => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Janela anônima, dados bloqueados: seguir sem persistir.
    }
  }

  return {
    async loadProgress() { return read(PROGRESS_KEY) },
    async saveProgress(progress) { write(PROGRESS_KEY, progress) },
    async loadSettings() { return read(SETTINGS_KEY) },
    async saveSettings(settings) { write(SETTINGS_KEY, settings) },
  }
}

function electronStore(): Store {
  const bridge = getBridge()!
  return {
    loadProgress: () => attempt(() => bridge.loadProgress(), null),
    saveProgress: (p) => attempt(async () => { await bridge.saveProgress(p) }, undefined),
    loadSettings: () => attempt(() => bridge.loadSettings(), null),
    saveSettings: (s) => attempt(async () => { await bridge.saveSettings(s) }, undefined),
  }
}

/** Escolhe a implementação pela presença da ponte do Electron. */
export function createStore(): Store {
  return getBridge() ? electronStore() : webStore()
}
