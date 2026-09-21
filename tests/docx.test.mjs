import { describe, it, expect } from 'vitest'
import { parseRels, parseDocument } from '../scripts/lib/docx.mjs'

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
const R = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
const A = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'

/** Embrulha parágrafos num document.xml completo. */
function doc(inner) {
  return `<w:document ${W} ${R} ${A}><w:body>${inner}</w:body></w:document>`
}

describe('parseRels', () => {
  it('mapeia rId para o arquivo de mídia', () => {
    const xml = `<?xml version="1.0"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId7" Type="../image" Target="media/image3.png"/>
        <Relationship Id="rId8" Type="../styles" Target="styles.xml"/>
      </Relationships>`
    expect(parseRels(xml)).toEqual({ rId7: 'media/image3.png', rId8: 'styles.xml' })
  })
})

describe('parseDocument', () => {
  it('lê estilo de heading e texto', () => {
    const blocks = parseDocument(
      doc('<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Phase 2: Levels 10–16</w:t></w:r></w:p>'),
      {},
    )
    expect(blocks).toEqual([
      { kind: 'p', style: 'Heading2', numId: null, ilvl: null, lines: ['Phase 2: Levels 10–16'], images: [] },
    ])
  })

  it('divide o parágrafo em linhas nos w:br', () => {
    const blocks = parseDocument(
      doc('<w:p><w:r><w:t>Zone Entry: MSQ only</w:t><w:br/><w:t>After arrow 15 take Ascension</w:t></w:r></w:p>'),
      {},
    )
    expect(blocks[0].lines).toEqual(['Zone Entry: MSQ only', 'After arrow 15 take Ascension'])
  })

  it('junta runs vizinhos na mesma linha', () => {
    const blocks = parseDocument(
      doc('<w:p><w:r><w:t>Safe </w:t></w:r><w:r><w:t>Haven</w:t></w:r></w:p>'),
      {},
    )
    expect(blocks[0].lines).toEqual(['Safe Haven'])
  })

  it('descarta linhas vazias e espaço nas pontas', () => {
    const blocks = parseDocument(
      doc('<w:p><w:r><w:t xml:space="preserve">  </w:t><w:br/><w:t xml:space="preserve"> MSQ Push  </w:t></w:r></w:p>'),
      {},
    )
    expect(blocks[0].lines).toEqual(['MSQ Push'])
  })

  it('lê numId e ilvl de item de lista', () => {
    const blocks = parseDocument(
      doc('<w:p><w:pPr><w:numPr><w:ilvl w:val="1"/><w:numId w:val="8"/></w:numPr></w:pPr><w:r><w:t>Gear Check: equip</w:t></w:r></w:p>'),
      {},
    )
    expect(blocks[0].numId).toBe('8')
    expect(blocks[0].ilvl).toBe(1)
  })

  it('resolve imagem pelo r:embed', () => {
    const blocks = parseDocument(
      doc('<w:p><w:r><w:drawing><a:blip r:embed="rId7"/></w:drawing></w:r></w:p>'),
      { rId7: 'media/image6.png' },
    )
    expect(blocks[0].images).toEqual(['media/image6.png'])
    expect(blocks[0].lines).toEqual([])
  })

  it('ignora r:embed que não está nos rels', () => {
    const blocks = parseDocument(doc('<w:p><w:r><w:drawing><a:blip r:embed="rIdX"/></w:drawing></w:r></w:p>'), {})
    expect(blocks[0].images).toEqual([])
  })

  it('lê a tabela com o texto e as cores de cada célula', () => {
    const tbl = `<w:tbl><w:tr>
      <w:tc><w:p><w:r><w:rPr><w:color w:val="d4a000"/></w:rPr><w:t>Yellow Arrows</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>Main Story Quest (MSQ)</w:t></w:r></w:p></w:tc>
    </w:tr></w:tbl>`
    const blocks = parseDocument(doc(tbl), {})
    expect(blocks[0].kind).toBe('tbl')
    expect(blocks[0].rows[0][0]).toEqual({ text: 'Yellow Arrows', colors: ['d4a000'] })
    expect(blocks[0].rows[0][1]).toEqual({ text: 'Main Story Quest (MSQ)', colors: [] })
  })

  it('ignora cor automática e preta na lista de cores', () => {
    const tbl = `<w:tbl><w:tr><w:tc><w:p>
      <w:r><w:rPr><w:color w:val="auto"/></w:rPr><w:t>Black Arrows</w:t></w:r>
    </w:p></w:tc></w:tr></w:tbl>`
    const blocks = parseDocument(doc(tbl), {})
    expect(blocks[0].rows[0][0].colors).toEqual([])
  })

  it('preserva a ordem dos blocos', () => {
    const blocks = parseDocument(
      doc(
        '<w:p><w:pPr><w:pStyle w:val="Heading3"/></w:pPr><w:r><w:t>Part 1</w:t></w:r></w:p>' +
          '<w:p><w:r><w:t>nota</w:t></w:r></w:p>',
      ),
      {},
    )
    expect(blocks.map((b) => b.style)).toEqual(['Heading3', null])
  })
})
