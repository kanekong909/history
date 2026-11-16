import { useMemo, useState } from 'react'
import { useKnowledge } from '../knowledge.jsx'
import QuickRecordModal from './QuickRecordModal.jsx'

// Editor del bloque «Tabla»: qué colección, qué fichas, qué columnas y en qué orden.
export default function TableBlockEditor({ block, set }) {
  const k = useKnowledge()
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const col = k?.collectionById.get(block.collectionId)
  const all = useMemo(() => (col ? k.records.filter((r) => r.collectionId === col.id) : []), [k, col])

  if (!k?.enabled) {
    return <p className="hint">Las colecciones todavía no están activadas: ejecuta <code>supabase/08_colecciones.sql</code> en Supabase.</p>
  }
  if (!k.collections.length) {
    return <p className="hint">Primero crea una colección (menú → Colecciones) y vuelve a esta historia.</p>
  }

  const chosen = block.recordIds || []
  const mode = chosen.length ? 'some' : 'all'
  const columns = Array.isArray(block.columns) ? block.columns : col?.fields.map((f) => f.id) || []
  const toggle = (arr, id) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id])
  const shown = all.filter((r) => r.title.toLowerCase().includes(q.trim().toLowerCase()))

  return (
    <div className="table-editor">
      <label>Colección
        <select value={block.collectionId || ''} onChange={(e) => set({ collectionId: e.target.value, recordIds: [], columns: null, sort: null })}>
          <option value="">Elige una colección…</option>
          {k.collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>

      {col && (
        <>
          <label>Título de la tabla (opcional)
            <input value={block.title || ''} onChange={(e) => set({ title: e.target.value })} placeholder={col.name} />
          </label>

          <fieldset className="te-group">
            <legend>Fichas</legend>
            <label className="check"><input type="radio" checked={mode === 'all'} onChange={() => set({ recordIds: [] })} /> Todas las de la colección ({all.length})</label>
            <label className="check"><input type="radio" checked={mode === 'some'} onChange={() => set({ recordIds: all.slice(0, 1).map((r) => r.id) })} /> Elegir cuáles</label>
            {mode === 'some' && (
              <div className="relation-picker">
                {all.length > 8 && <input placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar fichas" />}
                <div className="relation-list">
                  {shown.map((r) => (
                    <label key={r.id} className="check"><input type="checkbox" checked={chosen.includes(r.id)} onChange={() => set({ recordIds: toggle(chosen, r.id) })} /> {r.title}</label>
                  ))}
                </div>
              </div>
            )}
            {k.canCreate && <button type="button" className="ghost small" onClick={() => setCreating(true)}>+ Crear una ficha nueva</button>}
          </fieldset>

          <fieldset className="te-group">
            <legend>Columnas</legend>
            <div className="te-cols">
              {col.fields.map((f) => (
                <label key={f.id} className="check"><input type="checkbox" checked={columns.includes(f.id)} onChange={() => set({ columns: toggle(columns, f.id) })} /> {f.label}</label>
              ))}
              {col.fields.length === 0 && <span className="hint inline">Esta colección no tiene campos: la tabla solo mostrará el nombre.</span>}
            </div>
          </fieldset>

          <div className="image-options">
            <label>Ordenar por
              <select value={block.sort?.by || ''} onChange={(e) => set({ sort: e.target.value ? { by: e.target.value, dir: block.sort?.dir || 'asc' } : null })}>
                <option value="">Sin ordenar</option>
                <option value="title">Nombre</option>
                {col.fields.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </label>
            {block.sort?.by && (
              <label>Sentido
                <select value={block.sort.dir || 'asc'} onChange={(e) => set({ sort: { ...block.sort, dir: e.target.value } })}>
                  <option value="asc">De menor a mayor (A→Z)</option>
                  <option value="desc">De mayor a menor (Z→A)</option>
                </select>
              </label>
            )}
          </div>
          <label className="check"><input type="checkbox" checked={block.showImage !== false} onChange={(e) => set({ showImage: e.target.checked })} /> Mostrar la imagen de cada ficha</label>
        </>
      )}

      {creating && (
        <QuickRecordModal
          defaultCollectionId={col?.id} onCancel={() => setCreating(false)}
          onCreated={(r) => { setCreating(false); if (mode === 'some' && r.collectionId === col?.id) set({ recordIds: [...new Set([...chosen, r.id])] }) }}
        />
      )}
    </div>
  )
}
