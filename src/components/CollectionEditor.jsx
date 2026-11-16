import { useState } from 'react'
import { newId } from '../db.js'
import { FIELD_TYPES } from '../knowledge.js'

const blank = () => ({ id: newId(), label: '', type: 'text', unit: '', optionsText: '', collection: '' })

// Crear o editar una colección: su nombre y los campos que tendrá cada ficha.
export default function CollectionEditor({ collection, collections, saving, onSave, onCancel }) {
  const [name, setName] = useState(collection?.name || '')
  const [description, setDescription] = useState(collection?.description || '')
  const [fields, setFields] = useState(() => (collection?.fields || []).map((f) => ({ ...blank(), ...f, optionsText: (f.options || []).join(', ') })))
  const [error, setError] = useState('')

  const update = (id, patch) => setFields((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  const move = (i, d) => setFields((fs) => {
    const next = [...fs]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    return next
  })

  const submit = (e) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) return setError('Ponle un nombre a la colección.')
    const labels = fields.map((f) => f.label.trim().toLowerCase())
    if (labels.some((l) => !l)) return setError('Todos los campos necesitan un nombre.')
    if (new Set(labels).size !== labels.length) return setError('Hay dos campos con el mismo nombre.')
    for (const f of fields) {
      if (f.type === 'select' && !f.optionsText.split(',').some((o) => o.trim())) return setError(`El campo «${f.label}» necesita al menos una opción.`)
      if (f.type === 'relation' && !f.collection) return setError(`Elige a qué colección enlaza el campo «${f.label}».`)
    }
    const clean = fields.map(({ optionsText, unit, collection: target, ...f }) => ({
      ...f,
      label: f.label.trim(),
      ...(f.type === 'number' && unit.trim() && { unit: unit.trim() }),
      ...(f.type === 'select' && { options: optionsText.split(',').map((o) => o.trim()).filter(Boolean) }),
      ...(f.type === 'relation' && { collection: target }),
    }))
    onSave({ ...(collection || {}), id: collection?.id || newId(), name: name.trim(), description: description.trim(), fields: clean })
  }

  return (
    <form className="editor collection-editor" onSubmit={submit}>
      <div className="toolbar editor-bar">
        <button type="button" className="ghost" onClick={onCancel}>Cancelar</button>
        <span className="editor-bar-title">{collection ? 'Editar colección' : 'Nueva colección'}</span>
        <button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
      </div>

      <div className="panel">
        <label>Nombre de la colección
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Motores de avión" maxLength={80} autoFocus />
        </label>
        <label>Descripción (opcional)
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Qué reúne esta colección" />
        </label>
      </div>

      <h3 className="section-title">Campos de cada ficha</h3>
      <p className="hint">Cada ficha tiene siempre un <b>nombre</b>, una imagen y un resumen. Aquí añades los demás datos: fabricante, año, potencia…</p>

      {fields.map((f, i) => (
        <div className="field-row" key={f.id}>
          <div className="field-main">
            <input placeholder="Nombre del campo (ej: Fabricante)" value={f.label} onChange={(e) => update(f.id, { label: e.target.value })} aria-label="Nombre del campo" />
            <select value={f.type} onChange={(e) => update(f.id, { type: e.target.value })} aria-label="Tipo de campo">
              {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {f.type === 'number' && <input placeholder="Unidad (opcional, ej: kN, kg)" value={f.unit} onChange={(e) => update(f.id, { unit: e.target.value })} aria-label="Unidad" />}
          {f.type === 'select' && <input placeholder="Opciones separadas por coma (ej: Turbofán, Turbohélice)" value={f.optionsText} onChange={(e) => update(f.id, { optionsText: e.target.value })} aria-label="Opciones" />}
          {f.type === 'relation' && (
            <select value={f.collection} onChange={(e) => update(f.id, { collection: e.target.value })} aria-label="Colección enlazada">
              <option value="">Enlaza a fichas de…</option>
              {[...collections.filter((c) => c.id !== collection?.id), ...(collection ? [{ id: collection.id, name: `${name || collection.name} (esta misma)` }] : [])]
                .map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <div className="field-tools">
            <button type="button" className="ghost small" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir">↑</button>
            <button type="button" className="ghost small" disabled={i === fields.length - 1} onClick={() => move(i, 1)} aria-label="Bajar">↓</button>
            <button type="button" className="ghost small danger-text" onClick={() => setFields((fs) => fs.filter((x) => x.id !== f.id))}>Quitar</button>
          </div>
        </div>
      ))}

      <button type="button" className="ghost" onClick={() => setFields((fs) => [...fs, blank()])}>+ Añadir campo</button>
      {error && <p className="error form-error" role="alert">{error}</p>}
    </form>
  )
}
