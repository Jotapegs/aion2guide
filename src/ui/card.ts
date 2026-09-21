import type { Action, Guide } from '../core/guide'
import { type Progress, currentFlatPart, progressStats } from '../core/progress'
import { el, clear } from './dom'

export type CardHandlers = {
  onPrev(): void
  onNext(): void
  onComplete(): void
  onToggleAction(actionId: string): void
  onClose(): void
}

function renderAction(action: Action, progress: Progress, handlers: CardHandlers): HTMLElement {
  const checked = progress.checkedActions.includes(action.id)
  const classes = ['action']
  if (action.tag) classes.push(`action--${action.tag}`)
  if (checked) classes.push('action--checked')

  const row = el('button', {
    class: classes.join(' '),
    'data-id': action.id,
    'aria-pressed': String(checked),
    onclick: () => handlers.onToggleAction(action.id),
  }, [
    el('span', { class: 'action__box', 'aria-hidden': 'true' }, [checked ? '✓' : '']),
    el('span', { class: 'action__text' }, [action.text]),
  ])

  if (action.sub.length === 0) return el('li', {}, [row])

  return el('li', {}, [
    row,
    el('ul', { class: 'actions actions--sub' }, action.sub.map((s) => renderAction(s, progress, handlers))),
  ])
}

/** Esvazia root e redesenha o card inteiro. */
export function renderCard(
  root: HTMLElement,
  guide: Guide,
  progress: Progress,
  handlers: CardHandlers,
): void {
  const { part, phase, index } = currentFlatPart(guide, progress)
  const { completed, total } = progressStats(guide, progress)
  const done = progress.completedParts.includes(part.id)

  const head = el('header', { class: 'card__head' }, [
    el('span', { class: 'card__phase' }, [phase.title]),
    el('span', { class: 'card__levels' }, [`${phase.levelFrom}–${phase.levelTo}`]),
    el('div', { class: 'card__tools' }, [
      // Botão de ícone precisa de aria-label: o título é dica visual, e o
      // nome acessível sai do conteúdo — um leitor de tela anunciaria o
      // glifo ✕ em vez de "Fechar".
      el('button', {
        class: 'card__tool',
        title: 'Fechar',
        'aria-label': 'Fechar',
        onclick: handlers.onClose,
      }, ['✕']),
    ]),
  ])

  const body = el('div', { class: 'card__body' }, [
    el('div', { class: 'card__title' }, [part.title]),
    ...(part.note ? [el('div', { class: 'card__note' }, [part.note])] : []),
    el('ul', { class: 'actions' }, part.actions.map((a) => renderAction(a, progress, handlers))),
  ])

  const foot = el('footer', { class: 'card__foot' }, [
    el('div', { class: 'nav' }, [
      el('button', {
        class: 'nav__arrow',
        title: 'Part anterior',
        'aria-label': 'Part anterior',
        disabled: index === 0,
        onclick: handlers.onPrev,
      }, ['◀']),
      el('button', {
        class: `nav__complete${done ? ' nav__complete--done' : ''}`,
        onclick: handlers.onComplete,
      }, [done ? '✓ CONCLUÍDA' : 'CONCLUIR']),
      el('button', {
        class: 'nav__arrow',
        title: 'Próxima part',
        'aria-label': 'Próxima part',
        disabled: index === total - 1,
        onclick: handlers.onNext,
      }, ['▶']),
    ]),
    el('div', { class: 'meter' }, [
      el('span', {}, [`${index + 1}/${total}`]),
      el('div', { class: 'meter__track' }, [
        el('div', { class: 'meter__fill', style: `width: ${(completed / total) * 100}%` }),
      ]),
      el('span', {}, [`${completed} feitas`]),
    ]),
  ])

  clear(root)
  root.append(el('div', { class: 'card' }, [head, body, foot]))
}
