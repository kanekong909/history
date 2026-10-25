import { firstImage, excerpt } from './EntryCard.jsx'
import { cdn } from '../cloudinary.js'
import { STATUS, MAX_PENDING } from '../status.js'

const when = (iso) => new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })

// «Mis historias»: lo que escribió esta persona, con su estado y lo que puede hacer con cada una.
export default function MyStories({ entries, busy, onOpen, onEdit, onSubmit, onWithdraw, onDelete, onNew }) {
  const pending = entries.filter((e) => e.status === 'pending').length

  return (
    <section className="mine">
      <div className="page-head">
        <div>
          <h1>Mis historias</h1>
          <p className="page-sub">Lo que escribas lo revisa el administrador antes de publicarse. Puedes tener hasta {MAX_PENDING} en revisión a la vez
            {pending > 0 && <> (ahora: {pending})</>}.</p>
        </div>
        <button type="button" onClick={onNew}>Escribir historia</button>
      </div>

      {entries.length === 0 ? (
        <div className="empty">
          <p>Todavía no has escrito ninguna historia.</p>
          <p>Cuéntanos algo: un recuerdo, un viaje, un relato.</p>
          <button type="button" onClick={onNew}>Escribir mi primera historia</button>
        </div>
      ) : (
        <ul className="my-list">
          {entries.map((e) => {
            const img = firstImage(e)
            return (
              <li key={e.id} className="my-item">
                <button type="button" className="my-thumb" onClick={() => onOpen(e.id)} aria-label={`Abrir «${e.title || 'Sin título'}»`}>
                  {typeof img === 'string' ? <img src={cdn(img, 240)} alt="" loading="lazy" /> : <span>📝</span>}
                </button>
                <div className="my-body">
                  <div className="my-top">
                    <span className={`status-chip ${e.status}`}>{STATUS[e.status].label}</span>
                    <span className="my-date">{when(e.updatedAt)}</span>
                  </div>
                  <h3><button type="button" className="link-plain" onClick={() => onOpen(e.id)}>{e.title || 'Sin título'}</button></h3>
                  {excerpt(e, 110) && <p className="my-excerpt">{excerpt(e, 110)}</p>}
                  {e.status === 'rejected' && e.reviewNote && <p className="status-note"><strong>Motivo:</strong> {e.reviewNote}</p>}
                  {e.status === 'published' && <p className="my-excerpt muted">Ya está publicada. Para cambiar algo, escríbele al administrador.</p>}

                  <div className="my-actions">
                    <button type="button" className="ghost small" onClick={() => onOpen(e.id)}>Ver</button>
                    {e.status !== 'published' && <button type="button" className="ghost small" onClick={() => onEdit(e.id)}>Editar</button>}
                    {(e.status === 'draft' || e.status === 'rejected') && (
                      <button type="button" className="small" disabled={busy} onClick={() => onSubmit(e)}>{e.status === 'rejected' ? 'Enviar de nuevo' : 'Enviar a revisión'}</button>
                    )}
                    {e.status === 'pending' && <button type="button" className="ghost small" disabled={busy} onClick={() => onWithdraw(e)}>Retirar de revisión</button>}
                    {e.status !== 'published' && <button type="button" className="ghost small danger-text" onClick={() => onDelete(e)}>Eliminar</button>}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
