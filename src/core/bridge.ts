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
  /**
   * Avisa a casca que o mapa abriu ou fechou, para ela crescer e voltar
   * ao tamanho compacto. O núcleo não sabe de pixels de janela: só diz
   * o que aconteceu, e quem decide geometria é o processo principal.
   */
  setMapOpen(open: boolean): void
  minimize(): void
  close(): void
  /**
   * Registra o ouvinte das hotkeys globais. Não devolve como cancelar, e
   * isso é deliberado: há uma janela só, um renderer só, e o ouvinte é
   * registrado uma vez na abertura e vive o quanto o app viver. Não existe
   * caminho de re-registro nem de desmontagem. Um disposer aqui seria API
   * para um caso que não acontece.
   */
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
