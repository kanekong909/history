import { useKnowledge } from '../knowledge.jsx'
import { tableRows } from '../recordUtils.js'
import RecordTable from './RecordTable.jsx'

// Bloque «Tabla» dentro de una historia: muestra fichas de una colección.
export default function RecordTableBlock({ block }) {
  const k = useKnowledge()
  if (!k) return null
  if (!k.loaded) return <div className="rt-note">Cargando tabla…</div>
  if (!block.collectionId) return <div className="rt-note">Elige una colección para esta tabla.</div>

  const t = tableRows(block, k)
  if (!t) return <div className="rt-note">Esta tabla ya no está disponible.</div>
  const { collection, rows } = t
  const columns = Array.isArray(block.columns) ? block.columns : collection.fields.map((f) => f.id)

  return (
    <div className="rt-block">
      <div className="rt-head">
        <strong>{block.title || collection.name}</strong>
        <span>{rows.length} {rows.length === 1 ? 'ficha' : 'fichas'}</span>
        <button type="button" className="link" onClick={() => k.openCollection(collection.slug)}>Ver colección →</button>
      </div>
      {rows.length
        ? <RecordTable collection={collection} rows={rows} columns={columns} showImage={block.showImage !== false} initialSort={block.sort?.by ? block.sort : null} />
        : <div className="rt-note">Esta colección todavía no tiene fichas.</div>}
    </div>
  )
}
