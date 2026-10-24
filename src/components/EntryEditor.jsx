import { useState } from 'react'
import { newId } from '../db.js'
import { useObjectURL } from '../useObjectURL.js'

const BLOCK_TYPES = [
  { type: 'text', label: 'Texto' },
  { type: 'heading', label: 'Subtítulo' },
  { type: 'image', label: 'Imagen' },
  { type: 'quote', label: 'Cita' },
]

const makeBlock = (type) => ({ id: newId(), type, text: '', caption: '', image: null })

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
    <div className={`block-editor block-${block.type}`}>
      <div className="block-head">
        <span>{BLOCK_TYPES.find((t) => t.type === block.type)?.label}</span>
        <div>
          <button type="button" className="ghost small" disabled={isFirst} onClick={() => onMove(-1)}>↑</button>
          <button type="button" className="ghost small" disabled={isLast} onClick={() => onMove(1)}>↓</button>
          <button type="button" className="ghost small" onClick={onRemove}>✕</button>
        </div>
      </div>
      {block.type === 'image' ? (
        <>
          <ImagePicker blob={block.image} onChange={(image) => set({ image })} />
          <input placeholder="Pie de foto (opcional)" value={block.caption} onChange={(e) => set({ caption: e.target.value })} />
        </>
      ) : block.type === 'heading' ? (
        <input placeholder="Subtítulo" value={block.text} onChange={(e) => set({ text: e.target.value })} />
      ) : (
        <textarea
          rows={block.type === 'quote' ? 2 : 6}
          placeholder={block.type === 'quote' ? 'Cita…' : 'Escribe aquí…'}
          value={block.text}
          onChange={(e) => set({ text: e.target.value })}
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
      <div className="toolbar">
        <button type="button" className="ghost" onClick={onCancel}>Cancelar</button>
        <button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
      </div>

      <input className="title-input" placeholder="Título" value={draft.title} onChange={(e) => set({ title: e.target.value })} autoFocus />

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

      <h3 className="section-title">Contenido</h3>
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
        {BLOCK_TYPES.map((t) => (
          <button type="button" key={t.type} className="ghost" onClick={() => setBlocks((bs) => [...bs, makeBlock(t.type)])}>
            + {t.label}
          </button>
        ))}
      </div>
    </form>
  )
}
