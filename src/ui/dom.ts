type Attrs = Record<string, string | number | boolean | null | undefined | ((e: Event) => void)>
type Child = string | Node

/**
 * Cria um elemento. Strings viram texto, nunca HTML — o conteúdo do guia
 * tem parênteses, aspas e '&', e nada disso deve ser interpretado.
 */
export function el(tag: string, attrs: Attrs = {}, children: Child[] = []): HTMLElement {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue
    if (key === 'onclick' && typeof value === 'function') {
      node.addEventListener('click', value)
    } else if (key === 'disabled') {
      ;(node as HTMLButtonElement).disabled = Boolean(value)
    } else {
      node.setAttribute(key, String(value))
    }
  }
  for (const child of children) {
    node.append(typeof child === 'string' ? document.createTextNode(child) : child)
  }
  return node
}

/** Esvazia um elemento. */
export function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild)
}
