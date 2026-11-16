import { useMemo } from 'react'
import { useKnowledge } from '../knowledge.jsx'
import { asIds, isEmpty, formatNumber, mentionedIn } from '../recordUtils.js'
import { RecordChip } from './RecordTable.jsx'
import { cdn } from '../cloudinary.js'

function Value({ field, value }) {
  const k = useKnowledge()
  if (field.type === 'number') return formatNumber(value, field.unit)
  if (field.type === 'url') {
    let host = String(value)
    try { host = new URL(value).hostname.replace(/^www\./, '') } catch { /* tal cual */ }
    return <a href={value} target="_blank" rel="noopener noreferrer">{host}</a>
  }
  if (field.type === 'relation') {
    const found = asIds(value).map((id) => k?.recordById.get(id)).filter(Boolean)
    return <span className="chips">{found.map((r) => <RecordChip key={r.id} record={r} />)}</span>
  }
  return String(value)
}

// Página de una ficha: su imagen, sus datos, y las historias donde se la menciona.
export default function RecordPage({ record, collection, entries, isAdmin, onBack, onOpenCollection, onOpenEntry, onEdit, onDelete }) {
  const k = useKnowledge()
  const mentions = useMemo(() => mentionedIn(entries, record), [entries, record])
  const fields = collection.fields.filter((f) => !isEmpty(record.data?.[f.id]) && !(f.type === 'relation' && !asIds(record.data[f.id]).some((id) => k?.recordById.has(id))))
  const siblings = (k?.records || []).filter((r) => r.collectionId === collection.id && r.id !== record.id).slice(0, 6)

  return (
    <article className="record-page">
      <div className="toolbar">
        <button type="button" className="ghost" onClick={onBack}>← {collection.name}</button>
        {isAdmin && (
          <div className="actions">
            <button type="button" className="ghost" onClick={onEdit}>Editar</button>
            <button type="button" className="danger" onClick={onDelete}>Eliminar</button>
          </div>
        )}
      </div>

      <header className="record-head">
        {record.image && <img className="record-img" src={cdn(record.image, 900)} alt="" />}
        <div className="record-title">
          <button type="button" className="kicker kicker-link" onClick={onOpenCollection}>{collection.name}</button>
          <h1>{record.title}</h1>
          {record.summary && <p className="record-summary">{record.summary}</p>}
        </div>
      </header>

      {fields.length > 0 && (
        <dl className="record-fields">
          {fields.map((f) => (
            <div key={f.id}>
              <dt>{f.label}</dt>
              <dd><Value field={f} value={record.data[f.id]} /></dd>
            </div>
          ))}
        </dl>
      )}

      <section className="record-mentions">
        <h2>Mencionada en</h2>
        {mentions.length === 0 ? (
          <p className="muted">Todavía ninguna historia la menciona.</p>
        ) : (
          <ul>
            {mentions.map((e) => (
              <li key={e.id}><button type="button" className="link-plain" onClick={() => onOpenEntry(e.id)}>{e.title || 'Sin título'}</button></li>
            ))}
          </ul>
        )}
      </section>

      {siblings.length > 0 && (
        <section className="record-mentions">
          <h2>Más en {collection.name}</h2>
          <div className="chips">{siblings.map((r) => <RecordChip key={r.id} record={r} />)}</div>
        </section>
      )}
    </article>
  )
}
