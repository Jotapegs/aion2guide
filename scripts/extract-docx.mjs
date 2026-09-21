#!/usr/bin/env node
// Importa o guia do .docx. Roda uma vez; depois disso data/guide.json é a
// fonte da verdade e é editado à mão. Reimportar sobrescreve essas edições.
//
// Uso: npm run extract
import { writeFile, mkdir } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { openDocx, parseRels, parseDocument } from './lib/docx.mjs'
import { buildGuide } from './lib/guide-builder.mjs'
import { processMap } from './lib/maps.mjs'

const DOCX = 'Aion 2 Level 1-45 Speedrun Guide - appJotapegs.docx'
const OUT_JSON = 'data/guide.json'
const OUT_MAPS = 'public/maps'
const SOURCE = 'Aion 2 Level 1–45 Ultimate Speedrun Guide'
const VERSION = '1.0.0'

async function main() {
  const docx = await openDocx(DOCX)
  const rels = parseRels(await docx.text('word/_rels/document.xml.rels'))
  const blocks = parseDocument(await docx.text('word/document.xml'), rels)

  // Só processa as imagens que algum bloco realmente usa.
  const used = [...new Set(blocks.flatMap((b) => b.images ?? []))].sort()
  await mkdir(OUT_MAPS, { recursive: true })

  const maps = {}
  let totalBefore = 0
  let totalAfter = 0
  for (const entry of used) {
    const name = `${basename(entry, extname(entry))}.webp`
    const buffer = await docx.buffer(`word/${entry}`)
    const result = await processMap(buffer, join(OUT_MAPS, name))
    maps[entry] = { src: `maps/${name}`, width: result.width, height: result.height }
    totalBefore += buffer.length
    totalAfter += result.bytes
    console.log(`  ${entry} -> maps/${name}  ${result.width}x${result.height}  ${(result.bytes / 1024).toFixed(0)} KB`)
  }

  const guide = buildGuide(blocks, { version: VERSION, source: SOURCE, maps })
  await mkdir('data', { recursive: true })
  await writeFile(OUT_JSON, `${JSON.stringify(guide, null, 2)}\n`, 'utf8')

  const parts = guide.phases.reduce((n, p) => n + p.parts.length, 0)
  const actions = guide.phases.reduce(
    (n, p) => n + p.parts.reduce((m, pt) => m + pt.actions.length, 0),
    0,
  )
  console.log(`\n${guide.phases.length} fases, ${parts} parts, ${actions} ações`)
  console.log(`mapas: ${(totalBefore / 1024 / 1024).toFixed(1)} MB -> ${(totalAfter / 1024 / 1024).toFixed(1)} MB`)
  console.log(`escrito: ${OUT_JSON}`)
}

main().catch((err) => {
  console.error(`falhou: ${err.message}`)
  process.exit(1)
})
