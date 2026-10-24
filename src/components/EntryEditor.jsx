import { useEffect, useState } from 'react'
import { newId } from '../db.js'
import { useObjectURL } from '../useObjectURL.js'
import { textToHtml } from '../richText.js'
import RichTextEditor from './RichTextEditor.jsx'
import EntryPreview from './EntryPreview.jsx'

// `hidden`: tipos antiguos que se siguen mostrando pero ya no se ofrecen
// (los títulos ahora se ponen dentro del texto).
const BLOCK_TYPES = [
  { type: 'text', label: 'Texto' },
  { type: 'image', label: 'Imagen' },
  { type: 'quote', label: 'Cita destacada' },
  { type: 'heading', label: 'Subtítulo', hidden: true },
]

const IMAGE_SIZES = [
  { value: 'normal', label: 'Normal' },
  { value: 'wide', label: 'Ancha' },
  { value: 'small', label: 'Pequeña' },
]

const makeBlock = (type) => ({
  id: newId(), type, text: '', html: '', caption: '', image: null,
  ...(type === 'image' && { size: 'normal' }),
})

function ImagePicker({ blob, onChange, label = 'Elegir imagen' }) {
  const url = useObjectURL(blob)
  return (
    <div className="image-picker">
      {url && <img src={url} alt="" />}
      <label className="file-btn">
        {url ? 'Cambiar imagen' : label}
        <input type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && onChange(e.target.files[0])} />
      </label>
      {url && <button type="button" className="ghost small" onClick={() => onChange(null)}>Quitar</button>}
    </div>
  )
}

function BlockEditor({ block, onChange, onRemove, onMove, isFirst, isLast }) {
  const set = (patch) => onChange({ ...block, ...patch })
  return (
    <div id={`block-${block.id}`} className={`block-editor block-${block.type}`}>
      <div className="block-head">
        <span>{BLOCK_TYPES.find((t) => t.type === block.type)?.label}</span>
        {block.type === 'text' && (
          <label className="dropcap-toggle" title="Agranda la primera letra del bloque">
            <input type="checkbox" checked={Boolean(block.dropCap)} onChange={(e) => set({ dropCap: e.target.checked })} />
            Letra capital
          </label>
        )}
        <div>
          <button type="button" className="ghost small" disabled={isFirst} onClick={() => onMove(-1)}>↑</button>
          <button type="button" className="ghost small" disabled={isLast} onClick={() => onMove(1)}>↓</button>
          <button type="button" className="ghost small" onClick={onRemove}>✕</button>
        </div>
      </div>
      {block.type === 'image' ? (
        <>
          <ImagePicker blob={block.image} onChange={(image) => set({ image })} />
          <div className="image-options">
            <input placeholder="Pie de foto (opcional)" value={block.caption} onChange={(e) => set({ caption: e.target.value })} />
            <select value={block.size || 'normal'} onChange={(e) => set({ size: e.target.value })} title="Tamaño">
              {IMAGE_SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </>
      ) : block.type === 'heading' ? (
        <input placeholder="Subtítulo" value={block.text} onChange={(e) => set({ text: e.target.value })} />
      ) : block.type === 'quote' ? (
        <>
          <textarea className="quote-input" rows={2} placeholder="Una frase que quieras destacar…" value={block.text} onChange={(e) => set({ text: e.target.value })} />
          <input placeholder="Autor o fuente (opcional)" value={block.caption || ''} onChange={(e) => set({ caption: e.target.value })} />
        </>
      ) : (
        <RichTextEditor
          value={block.html || textToHtml(block.text)}
          onChange={(html) => set({ html, text: '' })}
        />
      )}
    </div>
  )
}

export default function EntryEditor({ entry, categories, saving, onSave, onCancel }) {
  const [draft, setDraft] = useState(() => entry ?? {
    id: newId(),
    title: '',
    category: '',
    date: '',
    tags: [],
    cover: null,
    blocks: [makeBlock('text')],
  })
  const [tagInput, setTagInput] = useState((entry?.tags || []).join(', '))
  const [tab, setTab] = useState('edit') // 'edit' | 'preview'
  const [focusId, setFocusId] = useState(null)

  // Al volver a «Editar» desde un bloque de la vista previa, llevar la pantalla hasta ese bloque.
  useEffect(() => {
    if (tab !== 'edit' || !focusId) return
    document.getElementById(`block-${focusId}`)?.scrollIntoView({ block: 'center' })
    setFocusId(null)
  }, [tab, focusId])

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))
  const setBlocks = (fn) => setDraft((d) => ({ ...d, blocks: fn(d.blocks) }))

  const moveBlock = (i, dir) => setBlocks((bs) => {
    const next = [...bs]
    ;[next[i], next[i + dir]] = [next[i + dir], next[i]]
    return next
  })

  const submit = (e) => {
    e.preventDefault()
    const tags = tagInput.split(',').map((t) => t.trim()).filter(Boolean)
    onSave({ ...draft, tags })
  }

  return (
    <form className="editor" onSubmit={submit}>
      <div className="toolbar editor-bar">
        <button type="button" className="ghost" onClick={onCancel}>Cancelar</button>
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'edit'} className={tab === 'edit' ? 'active' : ''} onClick={() => setTab('edit')}>Editar</button>
          <button type="button" role="tab" aria-selected={tab === 'preview'} className={tab === 'preview' ? 'active' : ''} onClick={() => setTab('preview')}>Vista previa</button>
        </div>
        <button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
      </div>

      {tab === 'preview' ? (
        <EntryPreview
          draft={draft}
          onReorder={(blocks) => set({ blocks })}
          onRemoveBlock={(id) => setBlocks((bs) => bs.filter((x) => x.id !== id))}
          onEditBlock={(id) => { setFocusId(id); setTab('edit') }}
        />
      ) : (
        <>
      <input className="title-input" placeholder="Título de la entrada" value={draft.title} onChange={(e) => set({ title: e.target.value })} autoFocus />

      <div className="panel">
      <div className="row">
        <label>
          Categoría
          <input list="cats" placeholder="Ej: Historia, Viajes, Recetas" value={draft.category} onChange={(e) => set({ category: e.target.value })} />
          <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
        <label>
          Fecha / época
          <input placeholder="Ej: 1810, Siglo XV, 12/05/2024" value={draft.date} onChange={(e) => set({ date: e.target.value })} />
        </label>
      </div>
      <label>
        Etiquetas (separadas por coma)
        <input placeholder="independencia, colombia" value={tagInput} onChange={(e) => setTagInput(e.target.value)} />
      </label>

      <label>Imagen de portada</label>
      <ImagePicker blob={draft.cover} onChange={(cover) => set({ cover })} label="Elegir portada" />
      </div>

      <h3 className="section-title">Contenido</h3>
      <p className="hint">
        Consejo: también puedes escribir <code>- </code> para empezar una lista, <code>1. </code> para una numerada,
        <code>## </code> para un título, y usar Ctrl+B / Ctrl+I.
      </p>
      {draft.blocks.map((b, i) => (
        <BlockEditor
          key={b.id}
          block={b}
          isFirst={i === 0}
          isLast={i === draft.blocks.length - 1}
          onChange={(nb) => setBlocks((bs) => bs.map((x) => (x.id === nb.id ? nb : x)))}
          onRemove={() => setBlocks((bs) => bs.filter((x) => x.id !== b.id))}
          onMove={(dir) => moveBlock(i, dir)}
        />
      ))}

      <div className="add-blocks">
        <span>Añadir:</span>
        {BLOCK_TYPES.filter((t) => !t.hidden).map((t) => (
          <button type="button" key={t.type} className="ghost" onClick={() => setBlocks((bs) => [...bs, makeBlock(t.type)])}>
            + {t.label}
          </button>
        ))}
      </div>
        </>
      )}
    </form>
  )
}
