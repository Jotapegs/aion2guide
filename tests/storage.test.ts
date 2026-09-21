import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createStore, PROGRESS_KEY, SETTINGS_KEY } from '../src/core/storage'
import { DEFAULT_SETTINGS } from '../src/core/settings'
import { initialProgress } from '../src/core/progress'
import { makeGuide } from './fixtures/guide'

/** localStorage mínimo em memória, mais um interruptor para simular bloqueio. */
function fakeLocalStorage() {
  const data = new Map<string, string>()
  let blocked = false
  return {
    block: () => { blocked = true },
    store: {
      getItem: (k: string) => {
        if (blocked) throw new Error('bloqueado')
        return data.get(k) ?? null
      },
      setItem: (k: string, v: string) => {
        if (blocked) throw new Error('bloqueado')
        data.set(k, v)
      },
      removeItem: (k: string) => { data.delete(k) },
    },
  }
}

const progress = initialProgress(makeGuide())

beforeEach(() => {
  vi.stubGlobal('window', {})
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createStore no navegador', () => {
  it('grava e lê o progresso no localStorage', async () => {
    const fake = fakeLocalStorage()
    vi.stubGlobal('localStorage', fake.store)
    const store = createStore()
    await store.saveProgress(progress)
    expect(await store.loadProgress()).toEqual(progress)
  })

  it('devolve null quando não há nada gravado', async () => {
    vi.stubGlobal('localStorage', fakeLocalStorage().store)
    expect(await createStore().loadProgress()).toBeNull()
  })

  it('devolve null para JSON corrompido em vez de explodir', async () => {
    const fake = fakeLocalStorage()
    fake.store.setItem(PROGRESS_KEY, '{isso não é json')
    vi.stubGlobal('localStorage', fake.store)
    expect(await createStore().loadProgress()).toBeNull()
  })

  it('sobrevive a localStorage bloqueado', async () => {
    const fake = fakeLocalStorage()
    fake.block()
    vi.stubGlobal('localStorage', fake.store)
    const store = createStore()
    await expect(store.saveProgress(progress)).resolves.toBeUndefined()
    expect(await store.loadProgress()).toBeNull()
  })

  it('grava e lê os ajustes', async () => {
    vi.stubGlobal('localStorage', fakeLocalStorage().store)
    const store = createStore()
    await store.saveSettings({ ...DEFAULT_SETTINGS, opacity: 0.5 })
    expect(await store.loadSettings()).toMatchObject({ opacity: 0.5 })
  })

  it('usa chaves distintas para progresso e ajustes', () => {
    expect(PROGRESS_KEY).not.toBe(SETTINGS_KEY)
  })
})

describe('createStore no Electron', () => {
  it('delega para a ponte quando window.aion existe', async () => {
    const bridge = {
      loadProgress: vi.fn().mockResolvedValue(progress),
      saveProgress: vi.fn().mockResolvedValue(undefined),
      loadSettings: vi.fn().mockResolvedValue(DEFAULT_SETTINGS),
      saveSettings: vi.fn().mockResolvedValue(undefined),
      setOpacity: vi.fn(),
      setClickThrough: vi.fn(),
      minimize: vi.fn(),
      close: vi.fn(),
      onHotkey: vi.fn(),
    }
    vi.stubGlobal('window', { aion: bridge })
    vi.stubGlobal('localStorage', fakeLocalStorage().store)

    const store = createStore()
    await store.saveProgress(progress)
    expect(bridge.saveProgress).toHaveBeenCalledWith(progress)
    expect(await store.loadProgress()).toEqual(progress)
    expect(bridge.loadProgress).toHaveBeenCalled()
  })

  it('delega os ajustes para a ponte, não para o localStorage', async () => {
    const bridge = {
      loadProgress: vi.fn().mockResolvedValue(null),
      saveProgress: vi.fn().mockResolvedValue(undefined),
      loadSettings: vi.fn().mockResolvedValue(DEFAULT_SETTINGS),
      saveSettings: vi.fn().mockResolvedValue(undefined),
      setOpacity: vi.fn(),
      setClickThrough: vi.fn(),
      minimize: vi.fn(),
      close: vi.fn(),
      onHotkey: vi.fn(),
    }
    const fake = fakeLocalStorage()
    vi.stubGlobal('window', { aion: bridge })
    vi.stubGlobal('localStorage', fake.store)

    const store = createStore()
    const settings = { ...DEFAULT_SETTINGS, opacity: 0.44 }
    await store.saveSettings(settings)
    expect(bridge.saveSettings).toHaveBeenCalledWith(settings)
    expect(await store.loadSettings()).toEqual(DEFAULT_SETTINGS)
    expect(bridge.loadSettings).toHaveBeenCalled()
    // Havendo ponte, o localStorage não pode ser tocado: no Electron os
    // ajustes moram em disco, e gravar nos dois lugares criaria duas
    // verdades que divergem na primeira vez que uma falha.
    expect(fake.store.getItem(SETTINGS_KEY)).toBeNull()
  })

  it('cai para null se a ponte falhar', async () => {
    const bridge = {
      loadProgress: vi.fn().mockRejectedValue(new Error('disco cheio')),
      saveProgress: vi.fn().mockRejectedValue(new Error('disco cheio')),
      loadSettings: vi.fn().mockRejectedValue(new Error('disco cheio')),
      saveSettings: vi.fn().mockRejectedValue(new Error('disco cheio')),
      setOpacity: vi.fn(),
      setClickThrough: vi.fn(),
      minimize: vi.fn(),
      close: vi.fn(),
      onHotkey: vi.fn(),
    }
    vi.stubGlobal('window', { aion: bridge })
    const store = createStore()
    expect(await store.loadProgress()).toBeNull()
    await expect(store.saveProgress(progress)).resolves.toBeUndefined()
    expect(await store.loadSettings()).toBeNull()
    await expect(store.saveSettings(DEFAULT_SETTINGS)).resolves.toBeUndefined()
  })
})
