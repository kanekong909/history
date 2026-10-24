import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'

function Btn({ editor, action, isActive, title, children, disabled }) {
  return (
    <button
      type="button"
      title={title}
      className={`tb ${isActive ? 'active' : ''}`}
      disabled={disabled}
      // mousedown evita que el editor pierda el foco/selección
      onMouseDown={(e) => {
        e.preventDefault()
        action(editor.chain().focus()).run()
      }}
    >
      {children}
    </button>
  )
}

function Toolbar({ editor }) {
  if (!editor) return null
  const is = (name, attrs) => editor.isActive(name, attrs)

  const setLink = () => {
    const prev = editor.getAttributes('link').href || ''
    const url = window.prompt('Dirección del enlace (déjalo vacío para quitarlo):', prev)
    if (url === null) return
    const chain = editor.chain().focus().extendMarkRange('link')
    if (!url.trim()) chain.unsetLink().run()
    else chain.setLink({ href: /^https?:\/\//i.test(url) ? url : `https://${url}` }).run()
  }

  const level = is('heading', { level: 2 }) ? '2' : is('heading', { level: 3 }) ? '3' : 'p'

  return (
    <div className="rte-toolbar">
      <select
        className="tb-select"
        value={level}
        title="Estilo de párrafo"
        onChange={(e) => {
          const v = e.target.value
          const c = editor.chain().focus()
          v === 'p' ? c.setParagraph().run() : c.setHeading({ level: Number(v) }).run()
        }}
      >
        <option value="p">Párrafo</option>
        <option value="2">Título</option>
        <option value="3">Subtítulo</option>
      </select>
      <span className="tb-sep" />
      <Btn editor={editor} title="Negrita (Ctrl+B)" isActive={is('bold')} action={(c) => c.toggleBold()}><b>B</b></Btn>
      <Btn editor={editor} title="Cursiva (Ctrl+I)" isActive={is('italic')} action={(c) => c.toggleItalic()}><i>I</i></Btn>
      <Btn editor={editor} title="Subrayado (Ctrl+U)" isActive={is('underline')} action={(c) => c.toggleUnderline()}><u>U</u></Btn>
      <Btn editor={editor} title="Tachado" isActive={is('strike')} action={(c) => c.toggleStrike()}><s>S</s></Btn>
      <Btn editor={editor} title="Resaltar" isActive={is('highlight')} action={(c) => c.toggleHighlight()}><mark>A</mark></Btn>
      <button type="button" className={`tb ${is('link') ? 'active' : ''}`} title="Enlace" onMouseDown={(e) => { e.preventDefault(); setLink() }}>🔗</button>
      <span className="tb-sep" />
      <Btn editor={editor} title="Lista con viñetas" isActive={is('bulletList')} action={(c) => c.toggleBulletList()}>• Lista</Btn>
      <Btn editor={editor} title="Lista numerada" isActive={is('orderedList')} action={(c) => c.toggleOrderedList()}>1. Lista</Btn>
      <Btn editor={editor} title="Cita" isActive={is('blockquote')} action={(c) => c.toggleBlockquote()}>❝</Btn>
      <Btn editor={editor} title="Línea separadora" action={(c) => c.setHorizontalRule()}>―</Btn>
      <span className="tb-sep" />
      <Btn editor={editor} title="Alinear a la izquierda" isActive={is({ textAlign: 'left' })} action={(c) => c.setTextAlign('left')}>⯇</Btn>
      <Btn editor={editor} title="Centrar" isActive={is({ textAlign: 'center' })} action={(c) => c.setTextAlign('center')}>≡</Btn>
      <Btn editor={editor} title="Justificar" isActive={is({ textAlign: 'justify' })} action={(c) => c.setTextAlign('justify')}>☰</Btn>
      <span className="tb-sep" />
      <Btn editor={editor} title="Deshacer (Ctrl+Z)" disabled={!editor.can().undo()} action={(c) => c.undo()}>↶</Btn>
      <Btn editor={editor} title="Rehacer (Ctrl+Y)" disabled={!editor.can().redo()} action={(c) => c.redo()}>↷</Btn>
    </div>
  )
}

export default function RichTextEditor({ value, onChange, placeholder = 'Escribe aquí…' }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Highlight,
      Link.configure({ openOnClick: false, autolink: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? '' : editor.getHTML()),
  })

  return (
    <div className="rte">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} className="prose rte-content" />
    </div>
  )
}
