import DOMPurify from 'dompurify'

// Los enlaces del contenido se abren en otra pestaña de forma segura.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

export const sanitize = (html) => DOMPurify.sanitize(html || '', { ADD_ATTR: ['target'] })

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Texto plano de la versión anterior → párrafos HTML.
export const textToHtml = (text) =>
  (text || '')
    .split(/\n{2,}/)
    .map((p) => `<p>${escape(p).replace(/\n/g, '<br>')}</p>`)
    .join('')

export function htmlToText(html) {
  const div = document.createElement('div')
  div.innerHTML = sanitize(html)
  return div.textContent || ''
}

// Texto de un bloque, sea enriquecido (html) o antiguo (text).
export const blockText = (b) => (b.html ? htmlToText(b.html) : b.text || '')
