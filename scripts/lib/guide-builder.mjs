// Semântica: transforma os blocos do .docx na estrutura do guia.
// As regras seguem a forma que o próprio documento usa, sem lista de exceções.

/** Cores da legenda do documento, ajustadas para ler sobre vidro escuro. */
const UI_COLORS = {
  msq: '#f0c040',
  side: '#5cc46a',
  seal: '#ff8a3d',
  // O documento usa setas pretas para kisks. Preto some no overlay escuro,
  // então a interface usa um neutro claro.
  kisk: '#c8d0e0',
}

const LEGEND_ORDER = ['msq', 'side', 'seal', 'kisk']

const TAG_BY_LABEL = [
  [/main story|\bmsq\b/i, 'msq'],
  [/side quest/i, 'side'],
  [/seal dungeon/i, 'seal'],
  [/kisk/i, 'kisk'],
]

// Um en-dash ou um hífen comum separam a faixa. O título pode ter espaço
// sobrando na frente e sufixo atrás, como 'Phase 5: Levels 33–45 (2nd Rune)'.
const PHASE_RE = /Phase\s+(\d+)\s*:\s*Levels?\s+(\d+)\s*[–—-]\s*(\d+)/i

// 'Rótulo curto: conteúdo'. O rótulo não tem dois-pontos dentro, tem no
// máximo 60 caracteres, e precisa haver conteúdo depois.
const ACTION_LINE_RE = /^[^:]{1,60}:\s+\S/

/** Uma linha solta é ação quando tem a forma 'Rótulo: conteúdo'. */
export function isActionLine(line) {
  return ACTION_LINE_RE.test(line.trim())
}

function isHeaderLine(line) {
  return line.trim().endsWith(':')
}

/** Infere a categoria pelo texto. Conveniência de importação, não regra de runtime. */
function inferTag(text) {
  if (/\bkisk/i.test(text)) return 'kisk'
  if (/\bseal\b/i.test(text)) return 'seal'
  if (/\bmsq\b|main story/i.test(text)) return 'msq'
  if (/green quest|side quest/i.test(text)) return 'side'
  return null
}

function buildLegend(table) {
  if (!table) throw new Error('não encontrei a tabela da legenda antes da primeira fase')
  const entries = []
  for (const row of table.rows) {
    if (row.length < 2) continue
    const marker = row[0].text.trim()
    const label = row[1].text.trim()
    const match = TAG_BY_LABEL.find(([re]) => re.test(label))
    if (!match) continue
    const id = match[1]
    // A primeira cor da célula do marcador é a cor que o documento usa.
    // A célula dos kisks não tem cor porque preto é a cor padrão do Word.
    const color = row[0].colors.length > 0 ? `#${row[0].colors[0]}` : '#000000'
    entries.push({ id, label, marker, color, uiColor: UI_COLORS[id] })
  }
  const found = new Set(entries.map((e) => e.id))
  const missing = LEGEND_ORDER.filter((t) => !found.has(t))
  if (missing.length > 0) throw new Error(`legenda incompleta, faltam: ${missing.join(', ')}`)
  return LEGEND_ORDER.map((id) => entries.find((e) => e.id === id))
}

/** Acumula ações numa part, aplicando as regras de ação versus contexto. */
function makePartBuilder(partId) {
  const actions = []
  const noteLines = []
  let counter = 0

  const addAction = (text) => {
    counter += 1
    const action = { id: `${partId}-a${counter}`, text, tag: inferTag(text), sub: [] }
    actions.push(action)
    return action
  }

  const addSub = (text) => {
    const parent = actions[actions.length - 1]
    if (!parent) {
      noteLines.push(text)
      return
    }
    parent.sub.push({
      id: `${parent.id}-s${parent.sub.length + 1}`,
      text,
      tag: inferTag(text),
      sub: [],
    })
  }

  return {
    /** Item de lista: a primeira linha é ação, o resto é sub. */
    addListItem(lines, ilvl) {
      lines.forEach((line, i) => {
        if (i > 0 || ilvl >= 1) addSub(line)
        else addAction(line)
      })
    },
    /** Parágrafo solto: depende da forma de cada linha. */
    addLooseLines(lines) {
      for (const line of lines) {
        if (isHeaderLine(line)) continue
        if (isActionLine(line)) addAction(line)
        else addSub(line)
      }
    },
    build(title, map) {
      return {
        id: partId,
        title,
        note: noteLines.length > 0 ? noteLines.join(' ') : null,
        map,
        actions,
      }
    },
  }
}

/**
 * Monta o guia a partir dos blocos.
 * options: { version, source, maps } onde maps liga 'media/imageN.png' a um MapRef.
 */
export function buildGuide(blocks, options) {
  const { version, source, maps } = options
  const phases = []
  const downtime = []
  let legendTable = null

  let phase = null
  let partBuilder = null
  let partTitle = null
  let partMap = null
  let partNumber = 0

  const closePart = () => {
    if (!phase || !partBuilder) return
    phase.parts.push(partBuilder.build(partTitle, partMap))
    partBuilder = null
    partTitle = null
    partMap = null
  }

  const openPart = (title) => {
    closePart()
    partNumber += 1
    partBuilder = makePartBuilder(`p${phase.number}-${partNumber}`)
    partTitle = title
    partMap = null
  }

  /** A part implícita das fases que não têm Heading3. */
  const ensurePart = () => {
    if (!partBuilder) openPart(`Levels ${phase.levelFrom}–${phase.levelTo}`)
  }

  for (const block of blocks) {
    if (block.kind === 'tbl') {
      if (!phase && !legendTable) legendTable = block
      continue
    }

    if (block.style === 'Heading2') {
      const title = block.lines.join(' ').trim()
      const m = PHASE_RE.exec(title)
      if (!m) throw new Error(`não consegui ler a faixa de nível em: "${title}"`)
      closePart()
      phase = {
        number: Number(m[1]),
        id: `phase-${m[1]}`,
        title: `Phase ${m[1]}`,
        levelFrom: Number(m[2]),
        levelTo: Number(m[3]),
        parts: [],
      }
      partNumber = 0
      phases.push(phase)
      continue
    }

    if (block.style === 'Heading3') {
      const title = block.lines.join(' ').trim()
      // Antes da primeira fase, 'Downtime Priority' é só um rótulo de seção.
      if (!phase) continue
      openPart(title)
      continue
    }

    // Tudo antes da primeira fase alimenta a lista de downtime.
    if (!phase) {
      for (const line of block.lines) {
        if (!isHeaderLine(line)) downtime.push(line)
      }
      continue
    }

    ensurePart()

    if (block.images.length > 0 && partMap === null) {
      partMap = maps[block.images[0]] ?? null
    }
    if (block.numId !== null) partBuilder.addListItem(block.lines, block.ilvl ?? 0)
    else partBuilder.addLooseLines(block.lines)
  }

  closePart()

  return {
    version,
    source,
    legend: buildLegend(legendTable),
    downtime,
    phases: phases.map(({ number, ...rest }) => rest),
  }
}
