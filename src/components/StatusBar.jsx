import { useState } from 'react'
import { STATUS } from '../status.js'

const day = (iso) => (iso ? new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'long' }) : '')

// Franja que aparece arriba de una historia que todavía no está publicada:
// al administrador le deja aprobar o rechazar; a quien la escribió, ver el estado y qué hacer.
export default function StatusBar({ entry, isAdmin, onEdit, onApprove, onReject, onSubmit, onWithdraw }) {
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')
  const s = entry.status
  const by = entry.authorName ? ` de ${entry.authorName}` : ''

  const text = isAdmin
    ? {
        pending: `Historia${by} enviada el ${day(entry.submittedAt)}. Revísala y decide si se publica.`,
        draft: `Borrador${by}: todavía no la ha enviado a revisión.`,
        rejected: `Historia${by} rechazada.`,
      }[s]
    : {
        draft: 'Es un borrador: solo tú puedes verlo. Cuando esté lista, envíala a revisión.',
        pending: 'Está en revisión. Cuando se decida, aquí verás el resultado.',
        rejected: 'Necesita cambios antes de poder publicarse.',
      }[s]

  return (
    <div className={`status-bar ${s}`} role="status">
      <div className="status-main">
        <span className={`status-chip ${s}`}>{STATUS[s].label}</span>
        <span className="status-text">{text}</span>
      </div>
      {s === 'rejected' && entry.reviewNote && (
        <p className="status-note"><strong>Motivo:</strong> {entry.reviewNote}</p>
      )}

      {!rejecting ? (
        <div className="status-actions">
          {isAdmin && s === 'pending' && (
            <>
              <button type="button" onClick={onApprove}>Aprobar y publicar</button>
              <button type="button" className="ghost" onClick={() => setRejecting(true)}>Rechazar…</button>
            </>
          )}
          {!isAdmin && s === 'pending' && <button type="button" className="ghost" onClick={onWithdraw}>Retirar de revisión</button>}
          {!isAdmin && (s === 'draft' || s === 'rejected') && (
            <button type="button" onClick={onSubmit}>{s === 'rejected' ? 'Enviar de nuevo' : 'Enviar a revisión'}</button>
          )}
          <button type="button" className="ghost" onClick={onEdit}>{!isAdmin && s === 'rejected' ? 'Editar y corregir' : 'Editar'}</button>
        </div>
      ) : (
        <div className="reject-form">
          <textarea
            rows={3} maxLength={500} autoFocus value={note} aria-label="Motivo del rechazo"
            placeholder="Motivo (opcional): qué debería cambiar para poder publicarla"
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="status-actions">
            <button type="button" className="ghost" onClick={() => setRejecting(false)}>Cancelar</button>
            <button type="button" className="danger-solid" onClick={() => onReject(note.trim())}>Confirmar rechazo</button>
          </div>
        </div>
      )}
    </div>
  )
}
