import Mention from '@tiptap/extension-mention'
import { mergeAttributes } from '@tiptap/core'
import { initials } from './recordUtils.js'

// Mención con «@»: al escribir @ aparece un buscador de fichas; la elegida queda como una etiqueta en el texto.
// `ref.current` trae lo más reciente del contexto de colecciones (fichas, si se puede crear, función para crear).
export function createMention(ref) {
  return Mention.extend({
    renderHTML({ node, HTMLAttributes }) {
      return ['span', mergeAttributes({ 'data-type': this.name }, this.options.HTMLAttributes, HTMLAttributes), node.attrs.label ?? node.attrs.id]
    },
    renderText({ node }) {
      return node.attrs.label ?? node.attrs.id
    },
  }).configure({
    HTMLAttributes: { class: 'mention' },
    suggestion: {
      char: '@',
      allowSpaces: true, // los nombres llevan espacios («Trent XWB»)

      items: ({ query }) => {
        const k = ref.current
        if (!k?.enabled) return []
        const s = query.trim().toLowerCase()
        const all = k.records.map((r) => ({ id: r.id, label: r.title, sub: k.collectionById.get(r.collectionId)?.name || '', image: r.image }))
        const found = (s ? all.filter((x) => x.label.toLowerCase().includes(s)) : all)
          .sort((a, b) => Number(b.label.toLowerCase().startsWith(s)) - Number(a.label.toLowerCase().startsWith(s)) || a.label.localeCompare(b.label, 'es'))
          .slice(0, 6)
        if (k.canCreate && s) found.push({ create: true, label: query.trim() })
        return found
      },

      command: ({ editor, range, props }) => {
        if (props.create) {
          editor.chain().focus().deleteRange(range).run()
          ref.current.onCreate?.({ title: props.label, pos: range.from })
          return
        }
        editor.chain().focus().insertContentAt(range, [{ type: 'mention', attrs: { id: props.id, label: props.label } }, { type: 'text', text: ' ' }]).run()
      },

      render: () => {
        let root = null
        let items = []
        let index = 0
        let current = null

        const mk = (tag, cls, text) => {
          const e = document.createElement(tag)
          if (cls) e.className = cls
          if (text !== undefined) e.textContent = text
          return e
        }

        const draw = () => {
          root.replaceChildren()
          if (!items.length) {
            root.append(mk('div', 'mention-empty', 'No hay fichas con ese nombre.'))
            return
          }
          items.forEach((it, i) => {
            const row = mk('div', `mention-item${i === index ? ' on' : ''}${it.create ? ' create' : ''}`)
            if (it.create) {
              row.append(mk('span', 'mi-plus', '+'), mk('span', 'mi-text', `Crear ficha «${it.label}»`))
            } else {
              const sq = mk('span', 'mi-sq')
              if (it.image) { const img = document.createElement('img'); img.src = it.image; img.alt = ''; sq.append(img) } else sq.textContent = initials(it.label)
              const text = mk('span', 'mi-text')
              text.append(mk('span', 'mi-title', it.label), mk('span', 'mi-sub', it.sub))
              row.append(sq, text)
            }
            row.addEventListener('mousedown', (e) => { e.preventDefault(); current.command(it) }) // sin quitar el foco al editor
            row.addEventListener('mouseenter', () => { index = i; draw() })
            root.append(row)
          })
        }

        const place = () => {
          const r = current?.clientRect?.()
          if (!r || !root) return
          root.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - 310))}px`
          const below = r.bottom + 8
          root.style.top = `${below + root.offsetHeight > window.innerHeight ? Math.max(8, r.top - root.offsetHeight - 8) : below}px`
        }

        return {
          onStart: (props) => {
            if (!ref.current?.enabled) return
            current = props
            items = props.items
            index = 0
            root = mk('div', 'mention-pop')
            root.setAttribute('role', 'listbox')
            document.body.append(root)
            draw()
            place()
          },
          onUpdate: (props) => {
            if (!root) return
            current = props
            items = props.items
            index = Math.min(index, Math.max(items.length - 1, 0))
            draw()
            place()
          },
          onKeyDown: ({ event }) => {
            if (!root) return false
            if (event.key === 'Escape') return true
            if (!items.length) return false
            if (event.key === 'ArrowDown') { index = (index + 1) % items.length; draw(); return true }
            if (event.key === 'ArrowUp') { index = (index - 1 + items.length) % items.length; draw(); return true }
            if (event.key === 'Enter' || event.key === 'Tab') { current.command(items[index]); return true }
            return false
          },
          onExit: () => { root?.remove(); root = null },
        }
      },
    },
  })
}
