export const MAX_TERMS_CHARS = 1600

const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;' }
const aliases = { b: 'strong', i: 'em' }

// Only these attribute-free inline tags may reach the HTML renderer.
export function cleanTerm(value) {
  const open = []
  const html = value.trim().replace(/<(\/?)(strong|em|u|b|i)>|&(?:amp|lt|gt|nbsp);|[&<>]/gi, (token, closing, name) => {
    if (!name) return entities[token] ?? token.toLowerCase()
    const lower = name.toLowerCase()
    const tag = aliases[lower] ?? lower
    if (closing) {
      if (open.at(-1) !== tag) return ''
      open.pop()
      return `</${tag}>`
    }
    open.push(tag)
    return `<${tag}>`
  })
  return html + open.reverse().map((tag) => `</${tag}>`).join('')
}

export function termsLength(clauses) {
  if (!Array.isArray(clauses)) return 0
  return clauses.join('').replace(/<\/?(?:strong|em|u)>/g, '').replace(/&(?:amp|lt|gt|nbsp);/g, ' ').length
}
