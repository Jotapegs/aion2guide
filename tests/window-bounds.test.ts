import { describe, it, expect } from 'vitest'
import { resizedBounds } from '../electron/window'

// Área útil de uma tela 1920x1080 com barra de tarefas embaixo.
const TELA = { x: 0, y: 0, width: 1920, height: 1040 }

const COMPACTO = { width: 360, height: 240 }
const EXPANDIDO = { width: 920, height: 520 }

describe('resizedBounds', () => {
  it('ao expandir, mantém a borda direita parada', () => {
    // Janela no canto superior direito, como ela nasce.
    const antes = { x: 1536, y: 24, width: 360, height: 240 }
    const depois = resizedBounds(antes, EXPANDIDO, TELA)
    expect(depois.x + depois.width).toBe(antes.x + antes.width)
    expect(depois.width).toBe(920)
    expect(depois.height).toBe(520)
  })

  it('ao encolher, também mantém a borda direita parada', () => {
    const aberto = { x: 976, y: 24, width: 920, height: 520 }
    const depois = resizedBounds(aberto, COMPACTO, TELA)
    expect(depois.x + depois.width).toBe(aberto.x + aberto.width)
    expect(depois.width).toBe(360)
  })

  it('expandir e encolher devolve a janela ao lugar de origem', () => {
    const origem = { x: 1536, y: 24, width: 360, height: 240 }
    const aberto = resizedBounds(origem, EXPANDIDO, TELA)
    expect(resizedBounds(aberto, COMPACTO, TELA)).toEqual(origem)
  })

  it('não deixa a janela sair pela esquerda', () => {
    // Overlay arrastado para perto da borda esquerda: não há espaço
    // para crescer naquela direção.
    const antes = { x: 40, y: 100, width: 360, height: 240 }
    const depois = resizedBounds(antes, EXPANDIDO, TELA)
    expect(depois.x).toBeGreaterThanOrEqual(TELA.x)
    expect(depois.x).toBe(0)
  })

  it('não deixa a janela sair pela direita', () => {
    const antes = { x: 1900, y: 100, width: 360, height: 240 }
    const depois = resizedBounds(antes, EXPANDIDO, TELA)
    expect(depois.x + depois.width).toBeLessThanOrEqual(TELA.x + TELA.width)
  })

  it('não deixa a janela sair por baixo', () => {
    const antes = { x: 1536, y: 900, width: 360, height: 240 }
    const depois = resizedBounds(antes, EXPANDIDO, TELA)
    expect(depois.y + depois.height).toBeLessThanOrEqual(TELA.y + TELA.height)
  })

  it('respeita a origem de telas que não começam em zero', () => {
    // Segundo monitor à direita do principal.
    const segunda = { x: 1920, y: 0, width: 1920, height: 1040 }
    const antes = { x: 1960, y: 24, width: 360, height: 240 }
    const depois = resizedBounds(antes, EXPANDIDO, segunda)
    expect(depois.x).toBeGreaterThanOrEqual(segunda.x)
    expect(depois.x).toBe(1920)
  })

  it('janela maior que a tela encosta no canto em vez de centralizar fora', () => {
    const telinha = { x: 0, y: 0, width: 800, height: 400 }
    const antes = { x: 400, y: 100, width: 360, height: 240 }
    const depois = resizedBounds(antes, EXPANDIDO, telinha)
    expect(depois.x).toBe(0)
    expect(depois.y).toBe(0)
  })

  it('não mexe no tamanho pedido, só na posição', () => {
    const antes = { x: 40, y: 900, width: 360, height: 240 }
    const depois = resizedBounds(antes, EXPANDIDO, TELA)
    expect(depois.width).toBe(EXPANDIDO.width)
    expect(depois.height).toBe(EXPANDIDO.height)
  })
})
