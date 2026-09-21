import { describe, it, expect, vi, beforeEach } from 'vitest'

const register = vi.fn()
const unregisterAll = vi.fn()

vi.mock('electron', () => ({
  globalShortcut: {
    register: (...args: unknown[]) => register(...args),
    unregisterAll: () => unregisterAll(),
  },
}))

const { HOTKEYS, HOTKEY_LABELS, formatAccelerator } = await import('../src/core/hotkeys')
const { registerHotkeys, unregisterHotkeys } = await import('../electron/hotkeys')

beforeEach(() => {
  register.mockReset()
  unregisterAll.mockReset()
})

describe('HOTKEYS', () => {
  it('cobre as seis ações', () => {
    expect(Object.keys(HOTKEYS).sort()).toEqual(
      ['clickthrough', 'complete', 'hide', 'map', 'next', 'prev'].sort(),
    )
  })

  it('usa Control+Alt para não colidir com teclas do jogo', () => {
    for (const accelerator of Object.values(HOTKEYS)) {
      expect(accelerator.startsWith('Control+Alt+')).toBe(true)
    }
  })

  it('não repete combinação', () => {
    const values = Object.values(HOTKEYS)
    expect(new Set(values).size).toBe(values.length)
  })

  it('tem rótulo em português para cada ação', () => {
    for (const action of Object.keys(HOTKEYS)) {
      expect(HOTKEY_LABELS[action as keyof typeof HOTKEY_LABELS]).toBeTruthy()
    }
  })

  it('não depende do Electron: é dado puro', async () => {
    // Se este módulo importasse `electron`, o painel de ajustes do
    // renderer não poderia ler dele e as teclas acabariam duplicadas.
    const fonte = await import('node:fs').then((fs) =>
      fs.readFileSync('src/core/hotkeys.ts', 'utf8'),
    )
    expect(fonte).not.toContain("from 'electron'")
  })
})

describe('formatAccelerator', () => {
  it('encurta para a forma que se mostra na tela', () => {
    expect(formatAccelerator('Control+Alt+Right')).toBe('Ctrl+Alt+→')
    expect(formatAccelerator('Control+Alt+Left')).toBe('Ctrl+Alt+←')
    expect(formatAccelerator('Control+Alt+Return')).toBe('Ctrl+Alt+Enter')
    expect(formatAccelerator('Control+Alt+M')).toBe('Ctrl+Alt+M')
  })
})

describe('registerHotkeys', () => {
  it('registra todas e devolve lista vazia quando tudo dá certo', () => {
    register.mockReturnValue(true)
    expect(registerHotkeys(vi.fn())).toEqual([])
    expect(register).toHaveBeenCalledTimes(6)
  })

  it('devolve as ações cuja combinação já está tomada', () => {
    register.mockImplementation((accelerator: string) => accelerator !== HOTKEYS.map)
    expect(registerHotkeys(vi.fn())).toEqual(['map'])
  })

  it('chama o handler com a ação certa', () => {
    const handle = vi.fn()
    register.mockImplementation((accelerator: string, cb: () => void) => {
      if (accelerator === HOTKEYS.next) cb()
      return true
    })
    registerHotkeys(handle)
    expect(handle).toHaveBeenCalledWith('next')
  })

  it('unregisterHotkeys libera tudo', () => {
    unregisterHotkeys()
    expect(unregisterAll).toHaveBeenCalledOnce()
  })
})
