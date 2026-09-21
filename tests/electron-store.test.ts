import { describe, it, expect } from 'vitest'
import { mkdtemp, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createFileStore } from '../electron/store'

async function dir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'aion2-store-'))
}

describe('createFileStore', () => {
  it('grava e lê um valor', async () => {
    const store = createFileStore(await dir())
    await store.write('progress', { currentPartId: 'p4-1' })
    expect(await store.read('progress')).toEqual({ currentPartId: 'p4-1' })
  })

  it('devolve null quando o arquivo não existe', async () => {
    expect(await createFileStore(await dir()).read('progress')).toBeNull()
  })

  it('devolve null para JSON corrompido em vez de explodir', async () => {
    const d = await dir()
    await writeFile(join(d, 'progress.json'), '{quebrado')
    expect(await createFileStore(d).read('progress')).toBeNull()
  })

  it('cria o diretório se ele não existir', async () => {
    const d = join(await dir(), 'fundo', 'do', 'poco')
    const store = createFileStore(d)
    await store.write('settings', { opacity: 0.5 })
    expect(await store.read('settings')).toEqual({ opacity: 0.5 })
  })

  it('não deixa arquivo temporário para trás', async () => {
    const d = await dir()
    const store = createFileStore(d)
    await store.write('progress', { a: 1 })
    expect(await readdir(d)).toEqual(['progress.json'])
  })

  it('usa arquivos distintos por nome', async () => {
    const store = createFileStore(await dir())
    await store.write('progress', { tipo: 'progresso' })
    await store.write('settings', { tipo: 'ajustes' })
    expect(await store.read('progress')).toEqual({ tipo: 'progresso' })
    expect(await store.read('settings')).toEqual({ tipo: 'ajustes' })
  })

  it('sobrescrever preserva o último valor', async () => {
    const store = createFileStore(await dir())
    await store.write('progress', { v: 1 })
    await store.write('progress', { v: 2 })
    expect(await store.read('progress')).toEqual({ v: 2 })
  })

  it('gravações concorrentes na mesma chave não se corrompem', async () => {
    // O renderer chama saveProgress sem esperar a anterior, então navegar
    // rápido dispara várias gravações da mesma chave ao mesmo tempo. Com
    // um temporário de nome fixo, uma renomeia o arquivo que a outra ainda
    // estava escrevendo, e sobra JSON truncado ou um rename em cima do
    // nada.
    const d = await dir()
    const store = createFileStore(d)
    const grande = (n: number): unknown => ({ v: String(n).repeat(20000), n })

    await Promise.all([1, 2, 3, 4, 5, 6, 7, 8].map((n) => store.write('progress', grande(n))))

    expect((await readdir(d)).filter((f) => f.endsWith('.tmp'))).toEqual([])
    const lido = await store.read('progress')
    // Seja qual for a que venceu, precisa ser um objeto completo.
    expect(lido).not.toBeNull()
    expect(lido).toHaveProperty('n')
    const { n } = lido as { n: number; v: string }
    expect(lido).toEqual(grande(n))
  })

  it('a última gravação é a que fica', async () => {
    const d = await dir()
    const store = createFileStore(d)
    await Promise.all([
      store.write('progress', { ordem: 1 }),
      store.write('progress', { ordem: 2 }),
      store.write('progress', { ordem: 3 }),
    ])
    expect(await store.read('progress')).toEqual({ ordem: 3 })
  })

  it('a gravação é atômica: o alvo nunca fica pela metade', async () => {
    // Se o rename falhasse a meio caminho, o arquivo antigo continuaria
    // íntegro. Aqui basta provar que nenhum .tmp sobrevive e que o
    // conteúdo final é sempre JSON completo e válido.
    const d = await dir()
    const store = createFileStore(d)
    await Promise.all([
      store.write('progress', { v: 'a'.repeat(5000) }),
      store.write('settings', { v: 'b'.repeat(5000) }),
    ])
    const arquivos = await readdir(d)
    expect(arquivos.filter((f) => f.endsWith('.tmp'))).toEqual([])
    expect(await store.read('progress')).toEqual({ v: 'a'.repeat(5000) })
    expect(await store.read('settings')).toEqual({ v: 'b'.repeat(5000) })
  })
})
