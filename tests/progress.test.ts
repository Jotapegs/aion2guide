import { describe, it, expect } from 'vitest'
import {
  type Progress,
  initialProgress, normalizeProgress, goToPart, nextPart, previousPart,
  toggleAction, completeCurrent, resetProgress, progressStats, currentFlatPart,
} from '../src/core/progress'
import { makeGuide } from './fixtures/guide'

const guide = makeGuide()

describe('initialProgress', () => {
  it('começa na primeira part, sem nada marcado', () => {
    expect(initialProgress(guide)).toEqual({
      schemaVersion: 1,
      currentPartId: 'p1-1',
      completedParts: [],
      checkedActions: [],
    })
  })
})

describe('navegação', () => {
  it('nextPart avança uma part', () => {
    expect(nextPart(guide, initialProgress(guide)).currentPartId).toBe('p2-1')
  })

  it('nextPart na última part não sai do lugar', () => {
    const at2 = goToPart(guide, initialProgress(guide), 'p2-2')
    expect(nextPart(guide, at2).currentPartId).toBe('p2-2')
  })

  it('previousPart volta uma part', () => {
    const at2 = goToPart(guide, initialProgress(guide), 'p2-1')
    expect(previousPart(guide, at2).currentPartId).toBe('p1-1')
  })

  it('previousPart na primeira part não sai do lugar', () => {
    expect(previousPart(guide, initialProgress(guide)).currentPartId).toBe('p1-1')
  })

  it('goToPart ignora part inexistente', () => {
    const p = initialProgress(guide)
    expect(goToPart(guide, p, 'p9-9').currentPartId).toBe('p1-1')
  })

  // A regra central do app.
  it('navegar para frente e para trás não marca nada', () => {
    let p = initialProgress(guide)
    p = nextPart(guide, p)
    p = nextPart(guide, p)
    p = previousPart(guide, p)
    p = goToPart(guide, p, 'p2-2')
    p = previousPart(guide, p)
    expect(p.completedParts).toEqual([])
    expect(p.checkedActions).toEqual([])
  })

  it('não muta o progresso recebido', () => {
    const p = initialProgress(guide)
    const frozen = JSON.stringify(p)
    nextPart(guide, p)
    completeCurrent(guide, p)
    toggleAction(guide, p, 'p1-1-a1')
    expect(JSON.stringify(p)).toBe(frozen)
  })
})

describe('completeCurrent', () => {
  it('marca a part atual e avança', () => {
    const p = completeCurrent(guide, initialProgress(guide))
    expect(p.completedParts).toEqual(['p1-1'])
    expect(p.currentPartId).toBe('p2-1')
  })

  it('não duplica quando a part já estava concluída', () => {
    let p = completeCurrent(guide, initialProgress(guide))
    p = goToPart(guide, p, 'p1-1')
    p = completeCurrent(guide, p)
    expect(p.completedParts).toEqual(['p1-1'])
  })

  it('na última part marca mas não sai do lugar', () => {
    let p = goToPart(guide, initialProgress(guide), 'p2-2')
    p = completeCurrent(guide, p)
    expect(p.completedParts).toEqual(['p2-2'])
    expect(p.currentPartId).toBe('p2-2')
  })
})

describe('toggleAction', () => {
  it('marca e desmarca', () => {
    let p = toggleAction(guide, initialProgress(guide), 'p1-1-a1')
    expect(p.checkedActions).toEqual(['p1-1-a1'])
    p = toggleAction(guide, p, 'p1-1-a1')
    expect(p.checkedActions).toEqual([])
  })

  it('marca sub-ação', () => {
    const p = toggleAction(guide, initialProgress(guide), 'p2-1-a2-s1')
    expect(p.checkedActions).toEqual(['p2-1-a2-s1'])
  })

  it('ignora id inexistente', () => {
    expect(toggleAction(guide, initialProgress(guide), 'nada').checkedActions).toEqual([])
  })

  it('não avança nem marca a part', () => {
    const p = toggleAction(guide, initialProgress(guide), 'p1-1-a1')
    expect(p.currentPartId).toBe('p1-1')
    expect(p.completedParts).toEqual([])
  })
})

describe('normalizeProgress', () => {
  it('aceita um progresso válido', () => {
    const saved = { schemaVersion: 1, currentPartId: 'p2-1', completedParts: ['p1-1'], checkedActions: ['p1-1-a1'] }
    expect(normalizeProgress(guide, saved)).toEqual(saved)
  })

  it('currentPartId desconhecido cai na primeira part não concluída', () => {
    const saved = { schemaVersion: 1, currentPartId: 'p9-9', completedParts: ['p1-1'], checkedActions: [] }
    expect(normalizeProgress(guide, saved).currentPartId).toBe('p2-1')
  })

  it('currentPartId desconhecido com tudo concluído cai na primeira part', () => {
    const saved = {
      schemaVersion: 1,
      currentPartId: 'p9-9',
      completedParts: ['p1-1', 'p2-1', 'p2-2'],
      checkedActions: [],
    }
    expect(normalizeProgress(guide, saved).currentPartId).toBe('p1-1')
  })

  it('descarta ids que não existem mais', () => {
    const saved = {
      schemaVersion: 1,
      currentPartId: 'p1-1',
      completedParts: ['p1-1', 'removida'],
      checkedActions: ['p1-1-a1', 'sumiu'],
    }
    const p = normalizeProgress(guide, saved)
    expect(p.completedParts).toEqual(['p1-1'])
    expect(p.checkedActions).toEqual(['p1-1-a1'])
  })

  it('descarta ids repetidos', () => {
    // Um arquivo corrompido ou editado à mão pode trazer o mesmo id duas
    // vezes. Passando, progressStats contaria a part duplicada.
    const saved = {
      schemaVersion: 1,
      currentPartId: 'p1-1',
      completedParts: ['p1-1', 'p1-1', 'p2-1'],
      checkedActions: ['p1-1-a1', 'p1-1-a1'],
    }
    const p = normalizeProgress(guide, saved)
    expect(p.completedParts).toEqual(['p1-1', 'p2-1'])
    expect(p.checkedActions).toEqual(['p1-1-a1'])
    expect(progressStats(guide, p).completed).toBe(2)
  })

  it('schemaVersion diferente recomeça do zero', () => {
    const saved = { schemaVersion: 99, currentPartId: 'p2-1', completedParts: ['p1-1'], checkedActions: [] }
    expect(normalizeProgress(guide, saved)).toEqual(initialProgress(guide))
  })

  it('lixo recomeça do zero', () => {
    expect(normalizeProgress(guide, null)).toEqual(initialProgress(guide))
    expect(normalizeProgress(guide, 'nada')).toEqual(initialProgress(guide))
    expect(normalizeProgress(guide, { currentPartId: 5 })).toEqual(initialProgress(guide))
    expect(normalizeProgress(guide, { schemaVersion: 1, currentPartId: 'p1-1', completedParts: 'x', checkedActions: [] }))
      .toEqual(initialProgress(guide))
  })
})

describe('resetProgress', () => {
  it('volta ao estado inicial', () => {
    expect(resetProgress(guide)).toEqual(initialProgress(guide))
  })
})

describe('progressStats', () => {
  it('conta parts concluídas, total e a posição atual', () => {
    let p = completeCurrent(guide, initialProgress(guide))
    expect(progressStats(guide, p)).toEqual({ completed: 1, total: 3, index: 1 })
  })

  it('ignora parts concluídas que não existem mais', () => {
    // Monta o Progress à mão, sem passar por normalizeProgress: é o filtro
    // do próprio progressStats que está sob teste aqui. Normalizando antes,
    // o id fantasma já teria sumido e o teste passaria mesmo com o filtro
    // apagado.
    const p: Progress = {
      schemaVersion: 1,
      currentPartId: 'p1-1',
      completedParts: ['p1-1', 'fantasma'],
      checkedActions: [],
    }
    expect(progressStats(guide, p).completed).toBe(1)
  })
})

describe('currentFlatPart', () => {
  it('devolve a part atual com sua fase', () => {
    const flat = currentFlatPart(guide, goToPart(guide, initialProgress(guide), 'p2-2'))
    expect(flat.part.id).toBe('p2-2')
    expect(flat.phase.id).toBe('phase-2')
    expect(flat.index).toBe(2)
  })
})
