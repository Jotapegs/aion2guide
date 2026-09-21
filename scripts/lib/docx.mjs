// Leitura mecânica do .docx. Este módulo não interpreta nada: converte o XML
// do Word numa lista de blocos. A semântica fica em guide-builder.mjs.
import { readFile } from 'node:fs/promises'
import JSZip from 'jszip'
import { DOMParser } from '@xmldom/xmldom'

const NS = {
  w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
}

/** Abre o .docx (que é um zip) e devolve um leitor das suas entradas. */
export async function openDocx(docxPath) {
  const zip = await JSZip.loadAsync(await readFile(docxPath))
  return {
    entries: () => Object.keys(zip.files),
    async text(entry) {
      const file = zip.file(entry)
      if (!file) throw new Error(`entrada ausente no .docx: ${entry}`)
      return file.async('string')
    },
    async buffer(entry) {
      const file = zip.file(entry)
      if (!file) throw new Error(`entrada ausente no .docx: ${entry}`)
      return file.async('nodebuffer')
    },
  }
}

function parse(xml) {
  return new DOMParser().parseFromString(xml, 'text/xml')
}

/** Mapeia cada rId para o caminho do arquivo que ele aponta. */
export function parseRels(relsXml) {
  const rels = {}
  for (const el of parse(relsXml).getElementsByTagName('Relationship')) {
    const id = el.getAttribute('Id')
    const target = el.getAttribute('Target')
    if (id && target) rels[id] = target
  }
  return rels
}

function attr(el, name) {
  return el.getAttributeNS(NS.w, name) ?? el.getAttribute(`w:${name}`)
}

/** Percorre um nó e monta as linhas, quebrando nos <w:br/>. */
function linesOf(node) {
  const lines = []
  let current = ''
  const walk = (n) => {
    if (n.namespaceURI === NS.w && n.localName === 'br') {
      lines.push(current)
      current = ''
      return
    }
    if (n.namespaceURI === NS.w && n.localName === 't') {
      current += n.textContent ?? ''
      return
    }
    if (n.namespaceURI === NS.w && n.localName === 'tab') {
      current += ' '
      return
    }
    for (let c = n.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 1) walk(c)
    }
  }
  walk(node)
  lines.push(current)
  return lines.map((l) => l.trim()).filter((l) => l !== '')
}

function first(el, ns, name) {
  const found = el.getElementsByTagNameNS(ns, name)
  return found.length > 0 ? found[0] : null
}

function parseParagraph(p, rels) {
  const pPr = first(p, NS.w, 'pPr')
  let style = null
  let numId = null
  let ilvl = null
  if (pPr) {
    const pStyle = first(pPr, NS.w, 'pStyle')
    if (pStyle) style = attr(pStyle, 'val')
    const numPr = first(pPr, NS.w, 'numPr')
    if (numPr) {
      const n = first(numPr, NS.w, 'numId')
      const l = first(numPr, NS.w, 'ilvl')
      if (n) numId = attr(n, 'val')
      if (l) ilvl = Number(attr(l, 'val'))
    }
  }
  const images = []
  for (const blip of p.getElementsByTagNameNS(NS.a, 'blip')) {
    const embed = blip.getAttributeNS(NS.r, 'embed') ?? blip.getAttribute('r:embed')
    if (embed && rels[embed]) images.push(rels[embed])
  }
  return { kind: 'p', style, numId, ilvl, lines: linesOf(p), images }
}

/** Cores de um parágrafo, descartando 'auto' e preto — não distinguem nada. */
function colorsOf(node) {
  const colors = []
  for (const c of node.getElementsByTagNameNS(NS.w, 'color')) {
    const val = attr(c, 'val')
    if (val && val !== 'auto' && val.toLowerCase() !== '000000' && !colors.includes(val)) {
      colors.push(val)
    }
  }
  return colors
}

function parseTable(tbl) {
  const rows = []
  for (const tr of tbl.getElementsByTagNameNS(NS.w, 'tr')) {
    const cells = []
    for (const tc of tr.getElementsByTagNameNS(NS.w, 'tc')) {
      cells.push({ text: linesOf(tc).join(' '), colors: colorsOf(tc) })
    }
    rows.push(cells)
  }
  return { kind: 'tbl', rows }
}

/** Converte o document.xml numa lista de blocos, preservando a ordem. */
export function parseDocument(documentXml, rels) {
  const body = first(parse(documentXml), NS.w, 'body')
  if (!body) throw new Error('document.xml não tem <w:body>')
  const blocks = []
  for (let el = body.firstChild; el; el = el.nextSibling) {
    if (el.nodeType !== 1 || el.namespaceURI !== NS.w) continue
    if (el.localName === 'p') blocks.push(parseParagraph(el, rels))
    else if (el.localName === 'tbl') blocks.push(parseTable(el))
  }
  return blocks
}
