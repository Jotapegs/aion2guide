import { globalShortcut } from 'electron'
import type { HotkeyAction } from '../src/core/bridge'
import { HOTKEYS } from '../src/core/hotkeys'

/**
 * Registra tudo e devolve as ações que falharam — outro programa pode já
 * ter tomado a combinação, e fingir que deu certo esconderia o problema
 * num lugar onde ele é difícil de diagnosticar: o atalho simplesmente
 * não responde.
 */
export function registerHotkeys(handle: (action: HotkeyAction) => void): HotkeyAction[] {
  const failed: HotkeyAction[] = []
  for (const [action, accelerator] of Object.entries(HOTKEYS) as [HotkeyAction, string][]) {
    const ok = globalShortcut.register(accelerator, () => handle(action))
    if (!ok) failed.push(action)
  }
  return failed
}

export function unregisterHotkeys(): void {
  globalShortcut.unregisterAll()
}
