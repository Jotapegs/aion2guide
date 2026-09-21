import { describe, it, expect } from 'vitest'
import { buildGuide, isActionLine } from '../scripts/lib/guide-builder.mjs'
import { parseGuide } from '../src/core/guide'

const p = (lines, extra = {}) => ({ kind: 'p', style: null, numId: null, ilvl: null, lines, images: [], ...extra })
const heading = (style, text) => p([text], { style })
const li = (lines, numId = '1', ilvl = 0) => p(lines, { numId, ilvl })

const LEGEND_TABLE = {
  kind: 'tbl',
  rows: [
    [{ text: 'Color / Symbol', colors: ['1a237e'] }, { text: 'Route Classification', colors: ['1a237e'] }],
    [{ text: 'Yellow Arrows', colors: ['d4a000'] }, { text: 'Main Story Quest (MSQ)', colors: [] }],
    [{ text: 'Green Arrows', colors: ['2e7d32'] }, { text: 'Side Quests', colors: [] }],
    [{ text: 'Orange Arrows', colors: ['e65100'] }, { text: 'Seal Dungeons', colors: [] }],
    [{ text: 'Black Arrows', colors: [] }, { text: 'Kisks', colors: [] }],
  ],
}

/** Blocos mínimos que produzem um guia válido de 1 a 45. */
function baseBlocks(extra = []) {
  return [
    heading('Heading3', 'Downtime Priority'),
    p(['Whenever you have downtime:']),
    li(['Weapons (+5 max).']),
    LEGEND_TABLE,
    heading('Heading2', 'Phase 1: Levels 1–9'),
    li(['Follow core MSQ']),
    heading('Heading2', 'Phase 2: Levels 10–45'),
    ...extra,
  ]
}

const OPTS = { version: '1.0.0', source: 'teste', maps: {} }

describe('isActionLine', () => {
  it('reconhece a forma rótulo-dois-pontos-conteúdo', () => {
    expect(isActionLine('Zone Entry: All we doing is MSQ')).toBe(true)
    expect(isActionLine('MSQ (Powder of Death): take kisk')).toBe(true)
    expect(isActionLine('Gear Check: Equip all newly acquired Accessories')).toBe(true)
  })

  it('rejeita cabeçalho terminado em dois-pontos', () => {
    expect(isActionLine('Whenever you have downtime:')).toBe(false)
    expect(isActionLine('Additional written notes during phase 5:')).toBe(false)
  })

  it('rejeita frase comum sem rótulo', () => {
    expect(isActionLine('After getting the Wings from Urugugu')).toBe(false)
    expect(isActionLine('You get your first lvl8 skills here!')).toBe(false)
  })
})

describe('buildGuide', () => {
  it('produz um guia que passa no parseGuide', () => {
    const guide = buildGuide(baseBlocks([li(['MSQ Push'])]), OPTS)
    expect(() => parseGuide(JSON.parse(JSON.stringify(guide)))).not.toThrow()
  })

  it('lê a faixa de nível do título da fase, com espaço sobrando', () => {
    const blocks = baseBlocks([li(['MSQ Push'])])
    blocks[4] = heading('Heading2', ' Phase 1: Levels 1–9 ')
    const guide = buildGuide(blocks, OPTS)
    expect(guide.phases[0]).toMatchObject({ id: 'phase-1', levelFrom: 1, levelTo: 9 })
  })

  it('lê a faixa mesmo com sufixo no título', () => {
    const blocks = baseBlocks([li(['Pure MSQ'])])
    blocks[6] = heading('Heading2', 'Phase 2: Levels 10–45 (2nd Rune)')
    const guide = buildGuide(blocks, OPTS)
    expect(guide.phases[1]).toMatchObject({ levelFrom: 10, levelTo: 45 })
  })

  it('cria part implícita quando a fase não tem Heading3', () => {
    const guide = buildGuide(baseBlocks([li(['Pure MSQ'])]), OPTS)
    expect(guide.phases[0].parts).toHaveLength(1)
    expect(guide.phases[0].parts[0]).toMatchObject({ id: 'p1-1', title: 'Levels 1–9' })
  })

  it('numera parts e ações por fase', () => {
    const guide = buildGuide(
      baseBlocks([
        heading('Heading3', 'Part 1'),
        li(['MSQ Push']),
        li(['Seal DG Detour']),
        heading('Heading3', 'Part 2'),
        li(['Take the Kisks']),
      ]),
      OPTS,
    )
    const parts = guide.phases[1].parts
    expect(parts.map((x) => x.id)).toEqual(['p2-1', 'p2-2'])
    expect(parts[0].actions.map((a) => a.id)).toEqual(['p2-1-a1', 'p2-1-a2'])
    expect(parts[1].actions[0].id).toBe('p2-2-a1')
  })

  it('a segunda linha de um item de lista vira sub-ação', () => {
    const guide = buildGuide(
      baseBlocks([li(['Zone Entry: MSQ only', 'After arrow 15 you get Ascension quest'])]),
      OPTS,
    )
    const action = guide.phases[1].parts[0].actions[0]
    expect(action.text).toBe('Zone Entry: MSQ only')
    expect(action.sub).toHaveLength(1)
    expect(action.sub[0]).toMatchObject({ id: 'p2-1-a1-s1', text: 'After arrow 15 you get Ascension quest' })
  })

  it('item com ilvl 1 vira sub-ação do item de nível 0 anterior', () => {
    const guide = buildGuide(
      baseBlocks([li(['Recall: Teleport back'], '7', 0), li(['Gear Check: Equip accessories'], '8', 1)]),
      OPTS,
    )
    const actions = guide.phases[1].parts[0].actions
    expect(actions).toHaveLength(1)
    expect(actions[0].sub[0].text).toBe('Gear Check: Equip accessories')
  })

  it('parágrafo solto sem ação anterior vira note da part', () => {
    const guide = buildGuide(
      baseBlocks([
        heading('Heading3', 'Part 2'),
        p(['You get your first lvl8 skills here!']),
        li(['MSQ']),
      ]),
      OPTS,
    )
    const part = guide.phases[1].parts[0]
    expect(part.note).toBe('You get your first lvl8 skills here!')
    expect(part.actions).toHaveLength(1)
  })

  it('linha rotulada em parágrafo solto vira ação', () => {
    const guide = buildGuide(
      baseBlocks([
        li(['Pure MSQ: focus 100% on Main Story Quests']),
        p([
          'Additional written notes during phase 5:',
          'MSQ (Powder of Death): take kisk at Amunta Hideout',
          'MSQ (Lake of Confrontation): fly EAST and take kisk',
        ]),
      ]),
      OPTS,
    )
    const actions = guide.phases[1].parts[0].actions
    expect(actions.map((a) => a.text)).toEqual([
      'Pure MSQ: focus 100% on Main Story Quests',
      'MSQ (Powder of Death): take kisk at Amunta Hideout',
      'MSQ (Lake of Confrontation): fly EAST and take kisk',
    ])
  })

  it('linha não rotulada depois de uma ação vira sub-ação dela', () => {
    const guide = buildGuide(
      baseBlocks([
        li(['Pure MSQ: focus on Main Story Quests']),
        p(['MSQ (Daybreak): take kisk', 'In addition take kisk SOUTH']),
      ]),
      OPTS,
    )
    const actions = guide.phases[1].parts[0].actions
    expect(actions[1].text).toBe('MSQ (Daybreak): take kisk')
    expect(actions[1].sub[0].text).toBe('In addition take kisk SOUTH')
  })

  it('liga o mapa à part e deixa null quando não há mapa processado', () => {
    const guide = buildGuide(
      baseBlocks([
        heading('Heading3', 'Part 1'),
        p([], { images: ['media/image6.png'] }),
        li(['MSQ']),
        heading('Heading3', 'Part 2'),
        p([], { images: ['media/image9.png'] }),
        li(['MSQ']),
      ]),
      { ...OPTS, maps: { 'media/image6.png': { src: 'maps/image6.webp', width: 1050, height: 752 } } },
    )
    expect(guide.phases[1].parts[0].map).toEqual({ src: 'maps/image6.webp', width: 1050, height: 752 })
    expect(guide.phases[1].parts[1].map).toBeNull()
  })

  it('extrai a legenda com as cores do documento e cores de interface legíveis', () => {
    const guide = buildGuide(baseBlocks([li(['MSQ'])]), OPTS)
    expect(guide.legend.map((l) => l.id)).toEqual(['msq', 'side', 'seal', 'kisk'])
    const msq = guide.legend.find((l) => l.id === 'msq')
    expect(msq).toMatchObject({ label: 'Main Story Quest (MSQ)', marker: 'Yellow Arrows', color: '#d4a000' })
    const kisk = guide.legend.find((l) => l.id === 'kisk')
    expect(kisk.color).toBe('#000000')
    expect(kisk.uiColor).not.toBe('#000000')
  })

  it('extrai a lista de downtime sem o cabeçalho', () => {
    const guide = buildGuide(baseBlocks([li(['MSQ'])]), OPTS)
    expect(guide.downtime).toEqual(['Weapons (+5 max).'])
  })

  it('infere o tag pelo texto da ação', () => {
    const guide = buildGuide(
      baseBlocks([
        li(['MSQ Push']),
        li(['Seal DG Detour']),
        li(['Take all the Green Quests']),
        li(['Take the Kisks it will save time']),
        li(['Equip the smite Title']),
      ]),
      OPTS,
    )
    expect(guide.phases[1].parts[0].actions.map((a) => a.tag)).toEqual(['msq', 'seal', 'side', 'kisk', null])
  })

  it('rejeita Heading2 sem faixa de nível reconhecível', () => {
    const blocks = baseBlocks([li(['MSQ'])])
    blocks[6] = heading('Heading2', 'Phase 2: the rest')
    expect(() => buildGuide(blocks, OPTS)).toThrow(/faixa de nível/)
  })
})
