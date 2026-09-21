// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { el } from '../src/ui/dom'

describe('el', () => {
  it('cria elemento com classe e texto', () => {
    const node = el('span', { class: 'titulo' }, ['Part 1'])
    expect(node.tagName).toBe('SPAN')
    expect(node.className).toBe('titulo')
    expect(node.textContent).toBe('Part 1')
  })

  it('trata string como texto, nunca como HTML', () => {
    const node = el('div', {}, ['<b>MSQ</b> & Seal'])
    expect(node.querySelector('b')).toBeNull()
    expect(node.textContent).toBe('<b>MSQ</b> & Seal')
  })

  it('aninha elementos', () => {
    const node = el('div', {}, [el('span', {}, ['a']), el('span', {}, ['b'])])
    expect(node.children).toHaveLength(2)
  })

  it('liga o onclick', () => {
    const spy = vi.fn()
    const node = el('button', { onclick: spy })
    node.click()
    expect(spy).toHaveBeenCalledOnce()
  })

  it('aplica disabled e atributos data', () => {
    const node = el('button', { disabled: true, 'data-id': 'p4-1' })
    expect((node as HTMLButtonElement).disabled).toBe(true)
    expect(node.dataset.id).toBe('p4-1')
  })

  it('ignora atributo com valor false ou null', () => {
    const node = el('button', { disabled: false, title: null })
    expect((node as HTMLButtonElement).disabled).toBe(false)
    expect(node.hasAttribute('title')).toBe(false)
  })
})
