// @vitest-environment jsdom
//
// Os oito itens da conferência do card, contra o guia real em vez do
// fixture. O plano previa conferir isso a olho no navegador; automatizar
// pega o mesmo e não depende de ninguém lembrar de olhar.
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseGuide, flattenParts } from '../src/core/guide'
import {
  type Progress,
  initialProgress, goToPart, nextPart, previousPart,
  toggleAction, completeCurrent,
} from '../src/core/progress'
import { renderCard, type CardHandlers } from '../src/ui/card'

const guide = parseGuide(JSON.parse(readFileSync('data/guide.json', 'utf8')))

let root: HTMLElement
let progress: Progress

/** Handlers que aplicam a transição de verdade e redesenham, como o app faz. */
const handlers: CardHandlers = {
  onPrev: () => draw(previousPart(guide, progress)),
  onNext: () => draw(nextPart(guide, progress)),
  onComplete: () => draw(completeCurrent(guide, progress)),
  onToggleAction: (id) => draw(toggleAction(guide, progress, id)),
  onToggleMap: () => {},
  onToggleNav: () => {},
  onToggleRef: () => {},
  onToggleSettings: () => {},
  onClose: () => {},
}

function draw(next: Progress): void {
  progress = next
  renderCard(root, guide, progress, handlers)
}

const q = (sel: string): HTMLElement | null => root.querySelector(sel)
const all = (sel: string): HTMLElement[] => [...root.querySelectorAll<HTMLElement>(sel)]
const text = (sel: string): string => q(sel)?.textContent?.trim() ?? ''

/** Acha um botão pelo texto que ele mostra. */
function button(label: string): HTMLElement {
  const found = all('button').find((b) => (b.textContent ?? '').includes(label))
  if (!found) throw new Error(`não achei botão com "${label}"`)
  return found
}

beforeEach(() => {
  document.body.innerHTML = '<div id="overlay"></div>'
  root = document.querySelector<HTMLElement>('#overlay')!
  draw(initialProgress(guide))
})

describe('card contra o guia real', () => {
  it('1. abre na Fase 1 com a primeira ação do documento', () => {
    expect(text('.card__phase')).toBe('Phase 1')
    expect(text('.card__levels')).toBe('1–9')
    expect(text('.card__title')).toBe('Levels 1–9')
    expect(all('.action__text').map((a) => a.textContent)).toEqual(['Follow core MSQ'])
  })

  it('2. avançar chega na Fase 2 e as ações trazem a cor da categoria', () => {
    button('▶').click()
    expect(text('.card__phase')).toBe('Phase 2')
    expect(text('.card__title')).toBe('Part 1')
    // Toda ação da Part 1 da Fase 2 tem categoria, logo barrinha colorida.
    const tagged = all('.action').filter((a) => /action--(msq|side|seal|kisk)/.test(a.className))
    expect(tagged.length).toBe(all('.action').length)
    expect(tagged.length).toBeGreaterThan(0)
  })

  it('3. a nota da part aparece como contexto, sem checkbox', () => {
    draw(goToPart(guide, progress, 'p2-2'))
    expect(text('.card__note')).toBe('You get your first lvl8 skills here!')
    // A nota não é botão nem tem caixa de marcar.
    expect(q('.card__note')?.tagName).not.toBe('BUTTON')
    expect(q('.card__note')?.querySelector('.action__box')).toBeNull()
  })

  it('4. clicar numa ação marca, clicar de novo desmarca', () => {
    const first = () => all('.action')[0]
    expect(first().className).not.toContain('action--checked')
    first().click()
    expect(first().className).toContain('action--checked')
    expect(first().getAttribute('aria-pressed')).toBe('true')
    first().click()
    expect(first().className).not.toContain('action--checked')
  })

  it('5. concluir marca a part, avança, e o contador sobe', () => {
    expect(text('.meter')).toContain('0 feitas')
    button('CONCLUIR').click()
    expect(text('.card__title')).toBe('Part 1')
    expect(text('.meter')).toContain('1 feitas')
    // Voltando, a part aparece como concluída.
    button('◀').click()
    expect(text('.nav__complete')).toContain('CONCLUÍDA')
  })

  it('6. as setas desabilitam nas pontas', () => {
    expect((button('◀') as HTMLButtonElement).disabled).toBe(true)
    expect((button('▶') as HTMLButtonElement).disabled).toBe(false)

    const last = flattenParts(guide).at(-1)!.part.id
    draw(goToPart(guide, progress, last))
    expect((button('◀') as HTMLButtonElement).disabled).toBe(false)
    expect((button('▶') as HTMLButtonElement).disabled).toBe(true)
  })

  it('7. o contador reflete o total real de parts do guia', () => {
    const total = flattenParts(guide).length
    expect(total).toBe(11)
    expect(text('.meter')).toContain(`1/${total}`)
  })

  it('o botão do mapa só habilita nas parts que têm mapa', () => {
    // A Fase 1 não tem mapa no documento; a Part 1 da Fase 2 tem.
    expect((button('🗺') as HTMLButtonElement).disabled).toBe(true)
    draw(goToPart(guide, progress, 'p2-1'))
    expect((button('🗺') as HTMLButtonElement).disabled).toBe(false)
  })

  it('todo botão de ícone tem nome acessível', () => {
    // O nome acessível sai do conteúdo do botão, então um botão que só
    // mostra um glifo seria anunciado como "✕" sem um aria-label.
    const semNome = all('button').filter((b) => {
      const texto = (b.textContent ?? '').trim()
      const soGlifo = texto.length <= 2 && !/[a-zA-Z]/.test(texto)
      return soGlifo && !b.getAttribute('aria-label')
    })
    expect(semNome.map((b) => b.textContent)).toEqual([])
  })

  // A regra central do app.
  it('8. percorrer o guia inteiro ida e volta não marca nada', () => {
    const total = flattenParts(guide).length
    for (let i = 0; i < total - 1; i++) button('▶').click()
    expect(text('.card__title')).toBeTruthy()
    for (let i = 0; i < total - 1; i++) button('◀').click()

    expect(progress.completedParts).toEqual([])
    expect(progress.checkedActions).toEqual([])
    expect(text('.meter')).toContain('0 feitas')
    expect(text('.card__title')).toBe('Levels 1–9')
  })
})
