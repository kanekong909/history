import { useState } from 'react'
import { newId } from '../db.js'
import EntryPreview from './EntryPreview.jsx'
import BlockEditor, { BLOCK_TYPES, ImagePicker } from './BlockEditor.jsx'
import CoverOptions from './CoverOptions.jsx'

const makeBlock = (type) => ({
  id: newId(), type, text: '', html: '', caption: '', image: null,
  ...(type === 'image' && { size: 'normal' }),
  ...(type === 'carousel' && { slides: [], size: 'normal', ratio: '16/9' }),
})

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
          onChangeBlock={(nb) => setBlocks((bs) => bs.map((x) => (x.id === nb.id ? nb : x)))}
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
      {draft.cover && <CoverOptions value={draft.coverStyle} onChange={(coverStyle) => set({ coverStyle })} />}
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
