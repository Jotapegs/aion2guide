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
