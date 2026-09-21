import type { Progress } from './progress'
import type { Settings } from './settings'

export type HotkeyAction = 'next' | 'prev' | 'complete' | 'map' | 'hide' | 'clickthrough'

/**
 * O contrato entre o núcleo web e a casca Electron.
 * `electron/preload.ts` implementa exatamente isto; não mude um lado só.
 */
export type AionBridge = {
  loadProgress(): Promise<unknown>
  saveProgress(progress: Progress): Promise<void>
  loadSettings(): Promise<unknown>
  saveSettings(settings: Settings): Promise<void>
  setOpacity(value: number): void
  setClickThrough(enabled: boolean): void
  minimize(): void
  close(): void
  onHotkey(callback: (action: HotkeyAction) => void): void
}

declare global {
  interface Window {
    aion?: AionBridge
  }
}

/** A ponte, ou null quando rodando no navegador. */
export function getBridge(): AionBridge | null {
  return typeof window !== 'undefined' && window.aion ? window.aion : null
}
