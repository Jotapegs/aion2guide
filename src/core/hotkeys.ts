import type { HotkeyAction } from './bridge'

/**
 * Control+Alt evita as teclas que o jogo usa. São globais: valem com o
 * Aion 2 em foco, que é o ponto.
 *
 * Mora em `src/core/` e não em `electron/` porque é dado puro, sem
 * dependência do Electron: tanto a casca, que registra, quanto o painel
 * de ajustes, que exibe, leem daqui. Duplicado, mudar uma tecla deixaria
 * a tela anunciando a antiga.
 */
export const HOTKEYS: Record<HotkeyAction, string> = {
  next: 'Control+Alt+Right',
  prev: 'Control+Alt+Left',
  complete: 'Control+Alt+Return',
  map: 'Control+Alt+M',
  hide: 'Control+Alt+H',
  clickthrough: 'Control+Alt+C',
}

export const HOTKEY_LABELS: Record<HotkeyAction, string> = {
  next: 'Próxima part',
  prev: 'Part anterior',
  complete: 'Concluir a part',
  map: 'Abrir o mapa',
  hide: 'Esconder o overlay',
  clickthrough: 'Cliques atravessam',
}

/** Os nomes que o Electron entende não são os que se mostra na tela. */
const DISPLAY: Record<string, string> = {
  Control: 'Ctrl',
  Right: '→',
  Left: '←',
  Return: 'Enter',
}

export function formatAccelerator(accelerator: string): string {
  return accelerator
    .split('+')
    .map((key) => DISPLAY[key] ?? key)
    .join('+')
}
