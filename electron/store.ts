import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * JSON em disco com escrita atômica: grava num temporário e renomeia.
 * Sem isso, fechar o jogo no meio de uma gravação deixaria um arquivo
 * pela metade e o progresso seria perdido na próxima abertura.
 */
export function createFileStore(dir: string) {
  const path = (name: string): string => join(dir, `${name}.json`)

  // O renderer chama saveProgress sem esperar a anterior, então navegar
  // rápido dispara várias gravações da mesma chave ao mesmo tempo. Sem
  // uma fila por chave, uma renomeia o temporário que a outra ainda está
  // escrevendo: sobra JSON truncado, ou um rename em cima do nada.
  const fila = new Map<string, Promise<void>>()
  let contador = 0

  async function gravar(name: string, value: unknown): Promise<void> {
    await mkdir(dir, { recursive: true })
    const target = path(name)
    // Nome único mesmo dentro da fila: se uma gravação falhar no meio,
    // o lixo que ela deixar não atrapalha a próxima.
    contador += 1
    const temp = `${target}.${process.pid}.${contador}.tmp`
    await writeFile(temp, JSON.stringify(value), 'utf8')
    await rename(temp, target)
  }

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

    /**
     * Enfileira por chave, de modo que a última chamada é a que fica.
     * Chaves diferentes continuam gravando em paralelo.
     */
    write(name: string, value: unknown): Promise<void> {
      const anterior = fila.get(name) ?? Promise.resolve()
      // O catch mantém a fila viva: uma gravação que falhou não pode
      // impedir a próxima de tentar.
      const proxima = anterior.catch(() => {}).then(() => gravar(name, value))
      fila.set(name, proxima.catch(() => {}))
      return proxima
    },
  }
}
