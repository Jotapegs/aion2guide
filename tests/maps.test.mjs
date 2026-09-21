import { describe, it, expect } from 'vitest'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { findContentBox, processMap } from '../scripts/lib/maps.mjs'

/**
 * Gera um PNG com conteúdo colorido no meio e borda preta em volta,
 * nas espessuras pedidas.
 */
async function letterboxed({ width, height, top, bottom, left, right }) {
  const content = await sharp({
    create: {
      width: width - left - right,
      height: height - top - bottom,
      channels: 3,
      background: { r: 120, g: 160, b: 90 },
    },
  })
    .png()
    .toBuffer()

  return sharp({ create: { width, height, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .composite([{ input: content, left, top }])
    .png()
    .toBuffer()
}

describe('findContentBox', () => {
  it('acha a caixa de conteúdo de uma imagem com moldura uniforme', async () => {
    const png = await letterboxed({ width: 200, height: 100, top: 16, bottom: 16, left: 16, right: 16 })
    expect(await findContentBox(png)).toEqual({ left: 16, top: 16, width: 168, height: 68 })
  })

  it('acha a caixa com barras assimétricas', async () => {
    const png = await letterboxed({ width: 300, height: 200, top: 4, bottom: 60, left: 8, right: 100 })
    expect(await findContentBox(png)).toEqual({ left: 8, top: 4, width: 192, height: 136 })
  })

  it('devolve a imagem inteira quando não há borda', async () => {
    const png = await letterboxed({ width: 120, height: 80, top: 0, bottom: 0, left: 0, right: 0 })
    expect(await findContentBox(png)).toEqual({ left: 0, top: 0, width: 120, height: 80 })
  })

  it('não recorta cinza escuro acima do limiar', async () => {
    const png = await sharp({
      create: { width: 50, height: 50, channels: 3, background: { r: 40, g: 40, b: 40 } },
    })
      .png()
      .toBuffer()
    expect(await findContentBox(png)).toEqual({ left: 0, top: 0, width: 50, height: 50 })
  })

  it('não devolve caixa vazia para imagem toda preta', async () => {
    const png = await sharp({
      create: { width: 40, height: 40, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .png()
      .toBuffer()
    const box = await findContentBox(png)
    expect(box.width).toBeGreaterThan(0)
    expect(box.height).toBeGreaterThan(0)
  })
})

describe('processMap', () => {
  it('grava um WebP recortado e devolve as dimensões finais', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'aion2-maps-'))
    const out = join(dir, 'image1.webp')
    const png = await letterboxed({ width: 400, height: 300, top: 16, bottom: 50, left: 16, right: 120 })

    const result = await processMap(png, out)

    expect(result).toMatchObject({ width: 264, height: 234 })
    expect(result.bytes).toBeGreaterThan(0)
    const meta = await sharp(await readFile(out)).metadata()
    expect(meta.format).toBe('webp')
    expect(meta.width).toBe(264)
    expect(meta.height).toBe(234)
  })

  it('não reescala: a largura de saída é a do conteúdo recortado', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'aion2-maps-'))
    const out = join(dir, 'wide.webp')
    const png = await letterboxed({ width: 1280, height: 960, top: 16, bottom: 192, left: 16, right: 214 })
    const result = await processMap(png, out)
    expect(result.width).toBe(1050)
    expect(result.height).toBe(752)
  })
})
