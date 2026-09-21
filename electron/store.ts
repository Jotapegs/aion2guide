import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * JSON em disco com escrita atômica: grava num temporário e renomeia.
 * Sem isso, fechar o jogo no meio de uma gravação deixaria um arquivo
 * pela metade e o progresso seria perdido na próxima abertura.
 */
export function createFileStore(dir: string) {
  const path = (name: string): string => join(dir, `${name}.json`)

  return {
    async read(name: string): Promise<unknown> {
      try {
        return JSON.parse(await readFile(path(name), 'utf8'))
      } catch {
        // Arquivo ausente na primeira abertura, ou conteúdo corrompido.
        // Nos dois casos o núcleo recomeça do zero, que é melhor que travar.
        return null
      }
    },

    async write(name: string, value: unknown): Promise<void> {
      await mkdir(dir, { recursive: true })
      const target = path(name)
      const temp = `${target}.tmp`
      await writeFile(temp, JSON.stringify(value), 'utf8')
      await rename(temp, target)
    },
  }
}
