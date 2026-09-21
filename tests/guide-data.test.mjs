import { describe, it, expect } from 'vitest'
import { readFile, access } from 'node:fs/promises'
import { join } from 'node:path'
import { parseGuide, flattenParts } from '../src/core/guide'

const guide = parseGuide(JSON.parse(await readFile('data/guide.json', 'utf8')))

describe('data/guide.json', () => {
  it('tem as cinco fases cobrindo 1 a 45', () => {
    expect(guide.phases.map((p) => [p.levelFrom, p.levelTo])).toEqual([
      [1, 9],
      [10, 16],
      [17, 21],
      [22, 32],
      [33, 45],
    ])
  })

  it('tem 11 parts na ordem do documento', () => {
    expect(flattenParts(guide).map((f) => f.part.id)).toEqual([
      'p1-1',
      'p2-1', 'p2-2',
      'p3-1', 'p3-2', 'p3-3',
      'p4-1', 'p4-2', 'p4-3', 'p4-4',
      'p5-1',
    ])
  })

  it('liga os oito mapas às parts certas', () => {
    const byPart = Object.fromEntries(
      flattenParts(guide).map((f) => [f.part.id, f.part.map?.src ?? null]),
    )
    expect(byPart['p2-1']).toBe('maps/image3.webp')
    expect(byPart['p2-2']).toBe('maps/image7.webp')
    expect(byPart['p3-1']).toBe('maps/image1.webp')
    expect(byPart['p3-2']).toBe('maps/image4.webp')
    expect(byPart['p3-3']).toBe('maps/image5.webp')
    expect(byPart['p4-1']).toBe('maps/image6.webp')
    expect(byPart['p4-2']).toBe('maps/image8.webp')
    expect(byPart['p4-3']).toBe('maps/image2.webp')
    expect(byPart['p1-1']).toBeNull()
    expect(byPart['p4-4']).toBeNull()
    expect(byPart['p5-1']).toBeNull()
  })

  it('todo mapa referenciado existe em public/', async () => {
    const referenced = flattenParts(guide)
      .map((f) => f.part.map?.src)
      .filter((src) => src !== undefined)

    const missing = []
    for (const src of referenced) {
      try {
        await access(join('public', src))
      } catch {
        missing.push(src)
      }
    }

    expect(referenced).toHaveLength(8)
    expect(missing).toEqual([])
  })

  it('as cinco notas de kisk da fase 5 viraram ações', () => {
    const phase5 = guide.phases[4].parts[0]
    const texts = phase5.actions.flatMap((a) => [a.text, ...a.sub.map((s) => s.text)])
    expect(texts.some((t) => /Powder of Death/.test(t))).toBe(true)
    expect(texts.some((t) => /Lake of Confrontation/.test(t))).toBe(true)
    expect(texts.some((t) => /Ill Fate/.test(t))).toBe(true)
    expect(texts.some((t) => /Daybreak Society/.test(t))).toBe(true)
    expect(texts.some((t) => /Impetusium Lower Path/.test(t))).toBe(true)
  })

  it('os avisos do documento viraram note, não ação', () => {
    const p22 = flattenParts(guide).find((f) => f.part.id === 'p2-2').part
    expect(p22.note).toMatch(/first lvl8 skills/)
    const p44 = flattenParts(guide).find((f) => f.part.id === 'p4-4').part
    expect(p44.note).toMatch(/Wings from Urugugu/)
  })

  it('tem a lista de downtime com os sete itens', () => {
    expect(guide.downtime).toHaveLength(7)
    expect(guide.downtime[0]).toMatch(/Weapons/)
  })

  it('nenhuma ação está vazia ou é um cabeçalho solto', () => {
    for (const { part } of flattenParts(guide)) {
      for (const action of part.actions) {
        expect(action.text.trim()).not.toBe('')
        expect(action.text.trim().endsWith(':')).toBe(false)
      }
    }
  })
})
