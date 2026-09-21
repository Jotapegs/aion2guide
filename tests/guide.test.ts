import { describe, it, expect } from 'vitest'
import { parseGuide, flattenParts, findPart, GuideError } from '../src/core/guide'
import { makeGuide } from './fixtures/guide'

/** Clona o fixture e aplica uma mutação, para testar rejeições. */
function broken(mutate: (g: any) => void): unknown {
  const g = JSON.parse(JSON.stringify(makeGuide()))
  mutate(g)
  return g
}

describe('parseGuide', () => {
  it('aceita um guia válido e devolve a mesma estrutura', () => {
    const guide = parseGuide(JSON.parse(JSON.stringify(makeGuide())))
    expect(guide.phases).toHaveLength(2)
    expect(guide.phases[1].parts[0].actions[1].sub[0].id).toBe('p2-1-a2-s1')
    expect(guide.phases[1].parts[0].note).toBe('You get your first lvl8 skills here!')
  })

  it('rejeita id de part duplicado', () => {
    const raw = broken((g) => { g.phases[1].parts[1].id = 'p2-1' })
    expect(() => parseGuide(raw)).toThrow(/id de part duplicado: p2-1/)
  })

  it('rejeita id de ação duplicado, inclusive em sub-ações', () => {
    const raw = broken((g) => { g.phases[1].parts[0].actions[1].sub[0].id = 'p1-1-a1' })
    expect(() => parseGuide(raw)).toThrow(/id de ação duplicado: p1-1-a1/)
  })

  it('rejeita tag desconhecido', () => {
    const raw = broken((g) => { g.phases[0].parts[0].actions[0].tag = 'boss' })
    expect(() => parseGuide(raw)).toThrow(GuideError)
  })

  it('aceita tag null', () => {
    const raw = broken((g) => { g.phases[0].parts[0].actions[0].tag = null })
    expect(() => parseGuide(raw)).not.toThrow()
  })

  it('rejeita fase que não começa no nível 1', () => {
    const raw = broken((g) => { g.phases[0].levelFrom = 2 })
    expect(() => parseGuide(raw)).toThrow(/primeira fase deve começar no nível 1/)
  })

  it('rejeita buraco entre as faixas de nível', () => {
    const raw = broken((g) => { g.phases[1].levelFrom = 11 })
    expect(() => parseGuide(raw)).toThrow(/phase-2 deveria começar no nível 10/)
  })

  it('rejeita guia que não termina no nível 45', () => {
    const raw = broken((g) => { g.phases[1].levelTo = 44 })
    expect(() => parseGuide(raw)).toThrow(/última fase deve terminar no nível 45/)
  })

  it('rejeita fase sem parts', () => {
    const raw = broken((g) => { g.phases[0].parts = [] })
    expect(() => parseGuide(raw)).toThrow(/phase-1 não tem nenhuma part/)
  })

  it('rejeita legenda que não cobre os quatro tags', () => {
    const raw = broken((g) => { g.legend.pop() })
    expect(() => parseGuide(raw)).toThrow(/legenda deve cobrir os quatro tags/)
  })

  it('rejeita legenda com tag repetido, mesmo cobrindo os quatro', () => {
    // Os quatro tags aparecem, mas 'msq' aparece duas vezes: cobrir não
    // basta, tem que ser exatamente uma vez cada.
    const raw = broken((g) => { g.legend.push({ ...g.legend[0] }) })
    expect(() => parseGuide(raw)).toThrow(/legenda deve cobrir os quatro tags/)
  })

  it('rejeita map.src que começa com barra', () => {
    const raw = broken((g) => { g.phases[1].parts[0].map.src = '/maps/image3.webp' })
    expect(() => parseGuide(raw)).toThrow(/não deve começar com barra/)
  })

  it('rejeita entrada que não é objeto', () => {
    expect(() => parseGuide(null)).toThrow(GuideError)
    expect(() => parseGuide('guia')).toThrow(GuideError)
  })
})

describe('flattenParts', () => {
  it('achata na ordem do documento com índice sequencial', () => {
    const flat = flattenParts(makeGuide())
    expect(flat.map((f) => f.part.id)).toEqual(['p1-1', 'p2-1', 'p2-2'])
    expect(flat.map((f) => f.index)).toEqual([0, 1, 2])
    expect(flat[2].phase.id).toBe('phase-2')
  })
})

describe('findPart', () => {
  it('acha uma part existente', () => {
    expect(findPart(makeGuide(), 'p2-2')?.index).toBe(2)
  })

  it('devolve null para part inexistente', () => {
    expect(findPart(makeGuide(), 'p9-9')).toBeNull()
  })
})
