import { useMemo, useState } from 'react'
import { useKnowledge } from '../knowledge.jsx'
import { plainValue } from '../recordUtils.js'
import RecordTable from './RecordTable.jsx'
import Icon from './Icon.jsx'

// Página de una colección: todas sus fichas en una tabla que se busca y se ordena.
export default function CollectionPage({ collection, records, isAdmin, onBack, onEditCollection, onNewRecord, onDeleteCollection }) {
  const k = useKnowledge()
  const [q, setQ] = useState('')
  const mine = useMemo(() => records.filter((r) => r.collectionId === collection.id), [records, collection.id])

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return mine
    return mine.filter((r) =>
      [r.title, r.summary, ...collection.fields.map((f) => plainValue(f, r.data?.[f.id], k?.recordById))].join(' ').toLowerCase().includes(s))
  }, [mine, q, collection.fields, k?.recordById])

  return (
    <section className="collection-page">
      <div className="toolbar">
        <button type="button" className="ghost" onClick={onBack}>← Colecciones</button>
        {isAdmin && (
          <div className="actions">
            <button type="button" className="ghost" onClick={onEditCollection}>Editar campos</button>
            <button type="button" className="danger" onClick={onDeleteCollection}>Eliminar</button>
            <button type="button" onClick={onNewRecord}>+ Nueva ficha</button>
          </div>
        )}
      </div>

      <header className="collection-head">
        <p className="kicker">Colección</p>
        <h1>{collection.name}</h1>
        {collection.description && <p className="page-sub">{collection.description}</p>}
        <p className="collection-count">{mine.length} {mine.length === 1 ? 'ficha' : 'fichas'}</p>
      </header>

      {mine.length > 6 && (
        <label className="search-box collection-search">
          <Icon name="search" size={18} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Buscar en ${collection.name}…`} aria-label="Buscar fichas" />
        </label>
      )}

      {mine.length === 0 ? (
        <div className="empty">
          <p>Esta colección todavía no tiene fichas.</p>
          {isAdmin && <button type="button" onClick={onNewRecord}>Crear la primera ficha</button>}
        </div>
      ) : rows.length === 0 ? (
        <div className="empty"><p>No encontramos nada con eso.</p></div>
      ) : (
        <RecordTable collection={collection} rows={rows} columns={collection.fields.map((f) => f.id)} showImage />
      )}
    </section>
  )
}
