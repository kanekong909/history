import { useState } from 'react'
import { firstImage, excerpt, readingMinutes } from './EntryCard.jsx'
import { cdn } from '../cloudinary.js'

const when = (iso) => (iso ? new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'long' }) : '')

function Item({ entry, busy, onOpen, onApprove, onReject }) {
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')
  const img = firstImage(entry)

  return (
    <li className="my-item review-item">
      <button type="button" className="my-thumb" onClick={onOpen} aria-label={`Revisar «${entry.title || 'Sin título'}»`}>
        {typeof img === 'string' ? <img src={cdn(img, 240)} alt="" loading="lazy" /> : <span>📝</span>}
      </button>
      <div className="my-body">
        <div className="my-top">
          <span className="review-by">Por <strong>{entry.authorName || 'Alguien'}</strong></span>
          <span className="my-date">Enviada el {when(entry.submittedAt || entry.updatedAt)} · {readingMinutes(entry)} min de lectura</span>
        </div>
        <h3><button type="button" className="link-plain" onClick={onOpen}>{entry.title || 'Sin título'}</button></h3>
        {excerpt(entry, 150) && <p className="my-excerpt">{excerpt(entry, 150)}</p>}

        {!rejecting ? (
          <div className="my-actions">
            <button type="button" className="ghost small" onClick={onOpen}>Revisar completa</button>
            <button type="button" className="small" disabled={busy} onClick={onApprove}>Aprobar y publicar</button>
            <button type="button" className="ghost small danger-text" onClick={() => setRejecting(true)}>Rechazar…</button>
          </div>
        ) : (
          <div className="reject-form">
            <textarea
              rows={2} maxLength={500} autoFocus value={note} aria-label="Motivo del rechazo"
              placeholder="Motivo (opcional): qué debería cambiar para poder publicarla"
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="my-actions">
              <button type="button" className="ghost small" onClick={() => setRejecting(false)}>Cancelar</button>
              <button type="button" className="small danger-solid" disabled={busy} onClick={() => onReject(note.trim())}>Confirmar rechazo</button>
            </div>
          </div>
        )}
      </div>
    </li>
  )
}

// Cola de revisión del administrador: lo que otras personas enviaron para publicar.
export default function ReviewQueue({ entries, busy, onOpen, onApprove, onReject }) {
  return (
    <section className="mine">
      <div className="page-head">
        <div>
          <h1>Pendientes de revisión</h1>
          <p className="page-sub">Historias que otras personas enviaron. Nada se publica hasta que tú lo apruebes.</p>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="empty">
          <p>No hay historias pendientes.</p>
          <p>Cuando alguien envíe una, aparecerá aquí.</p>
        </div>
      ) : (
        <ul className="my-list">
          {entries.map((e) => (
            <Item
              key={e.id} entry={e} busy={busy}
              onOpen={() => onOpen(e.id)} onApprove={() => onApprove(e)} onReject={(note) => onReject(e, note)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
