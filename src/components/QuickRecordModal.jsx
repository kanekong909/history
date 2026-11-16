import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useKnowledge } from '../knowledge.jsx'

// Crear una ficha al vuelo (desde el «@» del editor o desde una tabla): solo el nombre y la colección.
// Sus demás datos se completan después en su página.
export default function QuickRecordModal({ initialTitle = '', defaultCollectionId = '', onCancel, onCreated }) {
  const k = useKnowledge()
  const [title, setTitle] = useState(initialTitle)
  const [collectionId, setCollectionId] = useState(defaultCollectionId || k.collections[0]?.id || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    e.stopPropagation() // el editor de la historia es otro formulario: no debe enviarse
    if (!title.trim() || !collectionId) return setError('Escribe un nombre y elige la colección.')
    setBusy(true)
    try {
      onCreated(await k.createRecord({ title: title.trim(), collectionId }))
    } catch {
      setError('No se pudo crear la ficha. Inténtalo de nuevo.')
      setBusy(false)
    }
  }

  return createPortal(
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Crear ficha">
        <h2>Crear ficha</h2>
        <p className="hint">Solo el nombre: sus datos los completas después desde su página.</p>
        <label>Nombre
          <input value={title} onChange={(e) => { setTitle(e.target.value); setError('') }} autoFocus maxLength={160}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(e) }} />
        </label>
        <label>Colección
          <select value={collectionId} onChange={(e) => setCollectionId(e.target.value)}>
            {k.collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        {error && <p className="error">{error}</p>}
        <div className="toolbar end">
          <button type="button" className="ghost" onClick={onCancel}>Cancelar</button>
          <button type="button" disabled={busy} onClick={submit}>{busy ? 'Creando…' : 'Crear ficha'}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
