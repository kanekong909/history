import { useLayoutEffect, useRef, useState } from 'react'
import { newId } from '../db.js'
import EntryPreview from './EntryPreview.jsx'
import BlockEditor, { BLOCK_TYPES, ImagePicker } from './BlockEditor.jsx'
import CoverOptions from './CoverOptions.jsx'

// Al pasar de «Editar» a «Vista previa» (y al revés) se recuerda qué bloque se estaba viendo,
// para volver a ese mismo lugar y no al principio. Se mide en una línea al 35% de la pantalla.
const ANCHOR_LINE = 0.35
function captureAnchor() {
  const line = window.innerHeight * ANCHOR_LINE
  const els = [...document.querySelectorAll('.editor [data-block-id]')]
  const above = els.filter((el) => el.getBoundingClientRect().top <= line)
  if (!above.length) return { scrollY: window.scrollY } // todavía arriba (título, datos…)
  const el = above[above.length - 1]
  const r = el.getBoundingClientRect()
  return { id: el.dataset.blockId, f: Math.min(1, (line - r.top) / Math.max(r.height, 1)) }
}
function restoreAnchor(a) {
  if (!a.id) return window.scrollTo(0, a.scrollY)
  const el = document.querySelector(`.editor [data-block-id="${a.id}"]`)
  if (!el) return
  const r = el.getBoundingClientRect()
  window.scrollTo(0, window.scrollY + r.top + a.f * r.height - window.innerHeight * ANCHOR_LINE)
}

const makeBlock = (type) => ({
  id: newId(), type, text: '', html: '', caption: '', image: null,
  ...(type === 'image' && { size: 'normal' }),
  ...(type === 'carousel' && { slides: [], size: 'normal', ratio: '16/9' }),
})

// `role`: 'admin' guarda o publica directamente; 'member' guarda borradores y envía a revisión.
export default function EntryEditor({ entry, categories, saving, role = 'admin', onSave, onCancel }) {
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
  const anchor = useRef(null)
  const switchTab = (next) => {
    if (next === tab) return
    anchor.current = captureAnchor()
    setTab(next)
  }
  // Tras cambiar de pestaña se vuelve al bloque anotado; se repite un par de veces
  // porque las alturas cambian mientras cargan las imágenes y el editor de texto.
  useLayoutEffect(() => {
    const a = anchor.current
    if (!a) return
    anchor.current = null
    restoreAnchor(a)
    const timers = [160, 500].map((ms) => setTimeout(() => restoreAnchor(a), ms))
    return () => timers.forEach(clearTimeout)
  }, [tab])

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))
  const setBlocks = (fn) => setDraft((d) => ({ ...d, blocks: fn(d.blocks) }))

  const moveBlock = (i, dir) => setBlocks((bs) => {
    const next = [...bs]
    ;[next[i], next[i + dir]] = [next[i + dir], next[i]]
    return next
  })

  const isMember = role === 'member'
  const [rights, setRights] = useState(false)
  const [formError, setFormError] = useState('')

  // intent: 'save' (guardar), 'submit' (enviar a revisión, para quien escribe) o 'publish' (aprobar y publicar, administrador)
  const finish = (intent) => {
    setFormError('')
    if (intent !== 'save' && !draft.title.trim()) return setFormError('Ponle un título a la historia antes de continuar.')
    if (isMember && intent === 'submit' && !rights) return setFormError('Marca la casilla de confirmación para poder enviarla a revisión.')
    const tags = tagInput.split(',').map((t) => t.trim()).filter(Boolean)
    onSave({ ...draft, tags }, intent)
  }
  const submit = (e) => {
    e.preventDefault()
    finish('save')
  }

  return (
    <form className="editor" onSubmit={submit}>
      <div className="toolbar editor-bar">
        <button type="button" className="ghost" onClick={onCancel}>Cancelar</button>
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'edit'} className={tab === 'edit' ? 'active' : ''} onClick={() => switchTab('edit')}>Editar</button>
          <button type="button" role="tab" aria-selected={tab === 'preview'} className={tab === 'preview' ? 'active' : ''} onClick={() => switchTab('preview')}>Vista previa</button>
        </div>
        <div className="editor-actions">
          {isMember ? (
            <>
              <button type="button" className="ghost" disabled={saving} onClick={() => finish('save')}>Guardar borrador</button>
              <button type="button" disabled={saving} onClick={() => finish('submit')}>{saving ? 'Enviando…' : 'Enviar a revisión'}</button>
            </>
          ) : (
            <>
              {entry?.status === 'pending' && <button type="button" className="ghost" disabled={saving} onClick={() => finish('publish')}>Aprobar y publicar</button>}
              <button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
            </>
          )}
        </div>
      </div>
      {isMember && (
        <p className="member-note">Tu historia solo se publicará cuando el administrador la apruebe. Puedes guardarla como borrador y seguir después.</p>
      )}

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

      {!isMember && (
        <>
          <label className="check">
            <input type="checkbox" checked={Boolean(draft.featured)} onChange={(e) => set({ featured: e.target.checked })} />
            Destacar en el banner del inicio
          </label>
          <p className="hint inline-hint">Necesita una imagen de portada para verse en el banner.</p>
        </>
      )}

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

      {isMember && (
        <div className="rights">
          <label className="check">
            <input type="checkbox" checked={rights} onChange={(e) => { setRights(e.target.checked); setFormError('') }} />
            Confirmo que los textos y las imágenes son míos o tengo permiso para usarlos, y entiendo que el administrador los revisará antes de publicarlos.
          </label>
        </div>
      )}
      {formError && <p className="error form-error" role="alert">{formError}</p>}
    </form>
  )
}
