import { useMemo, useState } from 'react'
import { newId } from '../db.js'
import { asIds } from '../recordUtils.js'
import { ImagePicker } from './BlockEditor.jsx'

// Elegir varias fichas de otra colección (campo «enlace a otras fichas»).
function RelationPicker({ options, value, onChange }) {
  const [q, setQ] = useState('')
  const ids = asIds(value)
  const shown = options.filter((r) => r.title.toLowerCase().includes(q.trim().toLowerCase()))
  const toggle = (id) => onChange(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])
  if (!options.length) return <p className="hint inline">Todavía no hay fichas en esa colección.</p>
  return (
    <div className="relation-picker">
      {options.length > 8 && <input placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar fichas" />}
      <div className="relation-list">
        {shown.map((r) => (
          <label key={r.id} className="check">
            <input type="checkbox" checked={ids.includes(r.id)} onChange={() => toggle(r.id)} /> {r.title}
          </label>
        ))}
      </div>
    </div>
  )
}

// Crear o editar una ficha de una colección.
export default function RecordEditor({ record, collection, records, saving, onSave, onCancel }) {
  const [title, setTitle] = useState(record?.title || '')
  const [image, setImage] = useState(record?.image || null)
  const [summary, setSummary] = useState(record?.summary || '')
  const [data, setData] = useState(record?.data || {})
  const [error, setError] = useState('')
  const id = useMemo(() => record?.id || newId(), [record?.id])

  const setField = (fid, v) => setData((d) => ({ ...d, [fid]: v }))

  const submit = (e) => {
    e.preventDefault()
    if (!title.trim()) return setError('La ficha necesita un nombre.')
    // se guardan solo los campos con valor
    const clean = Object.fromEntries(
      collection.fields.map((f) => [f.id, data[f.id]]).filter(([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)),
    )
    onSave({ ...(record || {}), id, collectionId: collection.id, title: title.trim(), image, summary: summary.trim(), data: clean })
  }

  return (
    <form className="editor record-editor" onSubmit={submit}>
      <div className="toolbar editor-bar">
        <button type="button" className="ghost" onClick={onCancel}>Cancelar</button>
        <span className="editor-bar-title">{record ? 'Editar ficha' : 'Nueva ficha'} · {collection.name}</span>
        <button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
      </div>

      <input className="title-input" placeholder="Nombre de la ficha" value={title} onChange={(e) => { setTitle(e.target.value); setError('') }} autoFocus maxLength={160} />

      <div className="panel">
        <label>Imagen (opcional)</label>
        <ImagePicker blob={image} onChange={setImage} label="Elegir imagen" />
        <label>Resumen (opcional)
          <textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Una o dos frases sobre esta ficha" />
        </label>

        {collection.fields.map((f) => (
          <label key={f.id}>{f.label}{f.unit ? ` (${f.unit})` : ''}
            {f.type === 'select' ? (
              <select value={data[f.id] || ''} onChange={(e) => setField(f.id, e.target.value)}>
                <option value="">—</option>
                {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : f.type === 'relation' ? (
              <RelationPicker
                options={records.filter((r) => r.collectionId === f.collection && r.id !== id)}
                value={data[f.id]} onChange={(v) => setField(f.id, v)}
              />
            ) : (
              <input
                type={f.type === 'number' || f.type === 'year' ? 'number' : f.type === 'url' ? 'url' : 'text'}
                step={f.type === 'number' ? 'any' : undefined}
                placeholder={f.type === 'url' ? 'https://…' : f.type === 'year' ? 'Ej: 1995' : ''}
                value={data[f.id] ?? ''}
                onChange={(e) => setField(f.id, f.type === 'number' || f.type === 'year' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
              />
            )}
          </label>
        ))}
        {collection.fields.length === 0 && <p className="hint">Esta colección no tiene campos todavía. Puedes añadirlos con «Editar campos».</p>}
      </div>
      {error && <p className="error form-error" role="alert">{error}</p>}
    </form>
  )
}
