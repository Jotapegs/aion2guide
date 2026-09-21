// Recorte do letterbox e conversão para WebP.
// O recorte é calculado varrendo os pixels das bordas: nenhuma dimensão
// é codificada por arquivo, então reimportar mapas novos continua funcionando.
//
// sharp().trim() não serve aqui porque usa a cor do pixel superior esquerdo
// como referência, e nessas imagens esse pixel já é conteúdo do mapa.
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import sharp from 'sharp'

const DEFAULT_THRESHOLD = 24
const DEFAULT_QUALITY = 90

/** Amostra a cada 4 pixels: o suficiente para detectar barra sólida, 4x mais rápido. */
const SAMPLE_STEP = 4

/** Luminância média do pixel em (x, y). */
function luma(data, channels, width, x, y) {
  const i = (y * width + x) * channels
  return (data[i] + data[i + 1] + data[i + 2]) / 3
}

/**
 * A caixa de conteúdo da imagem, descontadas as bordas escuras.
 * Devolve a imagem inteira se ela for escura por completo — melhor entregar
 * um mapa inútil do que uma caixa de largura zero que quebra o sharp.
 */
export async function findContentBox(buffer, threshold = DEFAULT_THRESHOLD) {
  const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info

  const darkRow = (y) => {
    for (let x = 0; x < width; x += SAMPLE_STEP) {
      if (luma(data, channels, width, x, y) > threshold) return false
    }
    return true
  }
  const darkCol = (x) => {
    for (let y = 0; y < height; y += SAMPLE_STEP) {
      if (luma(data, channels, width, x, y) > threshold) return false
    }
    return true
  }

  let top = 0
  while (top < height - 1 && darkRow(top)) top++
  let bottom = height - 1
  while (bottom > top && darkRow(bottom)) bottom--
  let left = 0
  while (left < width - 1 && darkCol(left)) left++
  let right = width - 1
  while (right > left && darkCol(right)) right--

  return { left, top, width: right - left + 1, height: bottom - top + 1 }
}

/**
 * Recorta o letterbox, converte para WebP e grava em outPath.
 * Nunca reescala: os números das setas são pequenos e precisam
 * continuar legíveis.
 */
export async function processMap(buffer, outPath, options = {}) {
  const { threshold = DEFAULT_THRESHOLD, quality = DEFAULT_QUALITY } = options
  const box = await findContentBox(buffer, threshold)
  const webp = await sharp(buffer).extract(box).webp({ quality }).toBuffer()
  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, webp)
  return { width: box.width, height: box.height, bytes: webp.length }
}
