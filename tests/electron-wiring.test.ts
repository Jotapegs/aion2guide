import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// A casca é feita de nomes que precisam concordar entre quatro arquivos.
// Um desalinhamento aqui não quebra a compilação nem nenhum outro teste:
// o app abre e simplesmente não tem ponte, ou não abre e não diz por quê.
const read = (p: string): string => readFileSync(p, 'utf8')

const pkg = JSON.parse(read('package.json')) as { main: string; type: string }
const viteConfig = read('vite.config.ts')
const windowTs = read('electron/window.ts')
const mainTs = read('electron/main.ts')
const preloadTs = read('electron/preload.ts')
const bridgeTs = read('src/core/bridge.ts')

describe('fiação da casca Electron', () => {
  it('o campo main aponta para dentro de dist-electron', () => {
    expect(pkg.main).toBe('dist-electron/main.js')
  })

  it('o núcleo web é ESM; a casca é a exceção, e por isso sai em .cjs', () => {
    expect(pkg.type).toBe('module')
  })

  it('o preload é construído em CommonJS com o nome que a janela procura', () => {
    // ESM no preload exigiria desligar o sandbox; por isso CJS.
    expect(viteConfig).toContain("format: 'cjs'")
    expect(viteConfig).toContain("entryFileNames: 'preload.cjs'")
    expect(windowTs).toContain("'preload.cjs'")
  })

  it('a janela usa o nível nomeado de always-on-top', () => {
    // alwaysOnTop: true no construtor perde para jogos no Windows.
    expect(windowTs).toContain("setAlwaysOnTop(true, 'screen-saver')")
  })

  it('a janela é sem moldura e translúcida', () => {
    expect(windowTs).toContain('frame: false')
    expect(windowTs).toContain('transparent: true')
  })

  it('o renderer fica isolado, sem Node', () => {
    expect(windowTs).toContain('contextIsolation: true')
    expect(windowTs).toContain('nodeIntegration: false')
  })

  it('todo método da ponte tem um canal atendido no processo principal', () => {
    // Extrai os nomes de canal que o preload invoca ou envia.
    const canais = [...preloadTs.matchAll(/ipcRenderer\.(?:invoke|send)\('([^']+)'/g)].map((m) => m[1])
    expect(canais.length).toBeGreaterThan(0)
    const semAtendimento = canais.filter(
      (c) => !mainTs.includes(`ipcMain.handle('${c}'`) && !mainTs.includes(`ipcMain.on('${c}'`),
    )
    expect(semAtendimento).toEqual([])
  })

  it('o preload implementa todos os métodos declarados no contrato', () => {
    const corpo = bridgeTs.slice(bridgeTs.indexOf('export type AionBridge'))
    const metodos = [...corpo.matchAll(/^\s{2}(\w+)\(/gm)].map((m) => m[1])
    expect(metodos).toContain('onHotkey')
    expect(metodos.length).toBe(9)
    const faltando = metodos.filter((m) => !preloadTs.includes(`${m}:`))
    expect(faltando).toEqual([])
  })

  it('o preload já escuta o canal de hotkey', () => {
    // Quem envia é o processo principal, e isso chega junto com o
    // registro das hotkeys globais. O ouvinte precisa existir antes.
    expect(preloadTs).toContain("on('aion:hotkey'")
  })
})
