import { useEffect, useRef, useState } from 'react'
import { getComments, addComment, updateComment, deleteComment } from '../db.js'

const MAX = 1000
const COOLDOWN_MS = 15000 // espera mínima entre comentarios desde el mismo navegador
const NAME_KEY = 'mi-archivo:nombre'
const LAST_KEY = 'mi-archivo:ultimo-comentario'
const TOKENS_KEY = 'mi-archivo:claves'

const store = {
  get: (k) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k, v) => { try { localStorage.setItem(k, v) } catch { /* sin almacenamiento */ } },
}

// Claves de los comentarios escritos como invitado: son la prueba de que el comentario es tuyo.
const keys = {
  all: () => { try { return JSON.parse(store.get(TOKENS_KEY) || '{}') } catch { return {} } },
  get: (id) => keys.all()[id],
  set: (id, t) => store.set(TOKENS_KEY, JSON.stringify({ ...keys.all(), [id]: t })),
  remove: (id) => { const a = keys.all(); delete a[id]; store.set(TOKENS_KEY, JSON.stringify(a)) },
}
const newKey = () => [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, '0')).join('')

const rtf = typeof Intl !== 'undefined' ? new Intl.RelativeTimeFormat('es', { numeric: 'auto' }) : null
function timeAgo(iso) {
  const s = Math.round((new Date(iso).getTime() - Date.now()) / 1000)
  const steps = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]]
  for (const [unit, secs] of steps) if (Math.abs(s) >= secs) return rtf.format(Math.round(s / secs), unit)
  return 'justo ahora'
}

const initial = (name) => (name || '?').trim().charAt(0).toUpperCase()

// `api` permite probar el componente sin Supabase.
export default function Comments({ entryId, user, profile, isAdmin, onLogin, api = { getComments, addComment, updateComment, deleteComment } }) {
  const [items, setItems] = useState(null) // null = cargando
  const [unavailable, setUnavailable] = useState(false)
  const [name, setName] = useState(() => store.get(NAME_KEY) || '')
  const [body, setBody] = useState('')
  const [trap, setTrap] = useState('') // campo invisible: solo lo rellenan los robots
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [editing, setEditing] = useState(null) // { id, text, error, saving }
  const [, refresh] = useState(0) // para releer las claves guardadas tras comentar o borrar

  useEffect(() => {
    let alive = true
    setItems(null)
    api.getComments(entryId)
      .then((rows) => { if (alive) setItems(rows) })
      .catch(() => { if (alive) { setUnavailable(true); setItems([]) } })
    return () => { alive = false }
  }, [entryId])

  // La tabla aún no existe (falta ejecutar el SQL): a los visitantes no se les muestra nada.
  if (unavailable) {
    return isAdmin ? <p className="comments-note">Los comentarios no están activados: ejecuta <code>supabase/05_comentarios.sql</code> en Supabase.</p> : null
  }

  // ¿Es tuyo? Con sesión, por tu cuenta; como invitado, si este navegador guarda la clave de ese comentario.
  const isMine = (c) => (c.userId ? Boolean(user && c.userId === user.id) : Boolean(keys.get(c.id)))
  const keyFor = (c) => (c.userId ? undefined : keys.get(c.id))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    const text = body.trim()
    if (!text) return setError('Escribe algo antes de enviar.')
    if (trap) return // robot: se ignora en silencio
    const wait = COOLDOWN_MS - (Date.now() - Number(store.get(LAST_KEY) || 0))
    if (wait > 0) return setError(`Espera ${Math.ceil(wait / 1000)} segundos antes de comentar de nuevo.`)

    setSending(true)
    try {
      const authorName = user ? (profile?.display_name || user.email?.split('@')[0] || 'Usuario') : name.trim() || 'Anónimo'
      const token = user ? undefined : newKey()
      const row = await api.addComment({ entryId, name: authorName, body: text, token })
      if (token && !row.userId) keys.set(row.id, token)
      setItems((list) => [...(list || []), row])
      setBody('')
      store.set(LAST_KEY, String(Date.now()))
      if (!user && name.trim()) store.set(NAME_KEY, name.trim())
      refresh((n) => n + 1)
    } catch (err) {
      setError(err?.message?.includes('muchos comentarios') ? err.message : 'No se pudo enviar el comentario. Inténtalo de nuevo.')
    } finally {
      setSending(false)
    }
  }

  const saveEdit = async (c) => {
    const text = editing.text.trim()
    if (!text) return setEditing({ ...editing, error: 'El comentario no puede quedar vacío.' })
    if (text === c.body) return setEditing(null)
    setEditing({ ...editing, saving: true, error: '' })
    try {
      const upd = await api.updateComment({ id: c.id, body: text, token: keyFor(c) })
      setItems((list) => list.map((x) => (x.id === c.id ? { ...x, body: upd.body ?? text, editedAt: upd.editedAt ?? new Date().toISOString() } : x)))
      setEditing(null)
    } catch {
      setEditing({ ...editing, saving: false, error: 'No se pudo guardar el cambio. Inténtalo de nuevo.' })
    }
  }

  const remove = async (c) => {
    if (!confirm('¿Eliminar este comentario?')) return
    try {
      await api.deleteComment({ id: c.id, token: keyFor(c) })
      keys.remove(c.id)
      setItems((list) => list.filter((x) => x.id !== c.id))
      if (editing?.id === c.id) setEditing(null)
    } catch {
      alert('No se pudo eliminar el comentario.')
    }
  }

  const count = items?.length ?? 0

  return (
    <section className="comments" aria-labelledby="comments-title">
      <h2 id="comments-title">Comentarios {items && <span>{count}</span>}</h2>

      <form className="comment-form" onSubmit={submit}>
        <div className="comment-who">
          <span className={`avatar-sm ${user ? '' : 'guest'}`} aria-hidden="true">{user ? initial(profile?.display_name || user.email) : '?'}</span>
          {user ? (
            <span className="comment-as">Comentando como <strong>{profile?.display_name || user.email}</strong></span>
          ) : (
            <>
              <input
                className="comment-name" placeholder="Tu nombre (opcional)" maxLength={60} value={name}
                onChange={(e) => setName(e.target.value)} aria-label="Tu nombre"
              />
              <span className="comment-as">o <button type="button" className="link" onClick={onLogin}>inicia sesión</button></span>
            </>
          )}
        </div>

        <textarea
          rows={3} maxLength={MAX} value={body} placeholder="Escribe un comentario…" aria-label="Comentario"
          onChange={(e) => { setBody(e.target.value); setError('') }}
        />
        {/* Trampa para robots: está fuera de pantalla y las personas no la ven */}
        <input className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={trap} onChange={(e) => setTrap(e.target.value)} name="website" />

        <div className="comment-bar">
          <span className={`comment-count ${body.length > MAX - 100 ? 'warn' : ''}`}>{body.length > 0 && `${body.length}/${MAX}`}</span>
          {!user && <span className="comment-guest">Comentarás como invitado</span>}
          <button type="submit" disabled={sending}>{sending ? 'Enviando…' : 'Comentar'}</button>
        </div>
        {error && <p className="error comment-error" role="alert">{error}</p>}
      </form>

      {items === null && <p className="comments-note">Cargando comentarios…</p>}
      {items && items.length === 0 && <p className="comments-note">Todavía no hay comentarios. ¡Sé la primera persona en comentar!</p>}

      <ul className="comment-list">
        {(items || []).map((c) => {
          const mine = isMine(c)
          const isEditing = editing?.id === c.id
          return (
            <li key={c.id} className="comment">
              <span className={`avatar-sm ${c.userId ? '' : 'guest'}`} aria-hidden="true">{c.userId ? initial(c.authorName) : '?'}</span>
              <div className="comment-main">
                <div className="comment-head">
                  <strong>{c.authorName}</strong>
                  {!c.userId && <span className="guest-tag">invitado</span>}
                  <time dateTime={c.createdAt} title={new Date(c.createdAt).toLocaleString('es')}>{timeAgo(c.createdAt)}</time>
                  {c.editedAt && <span className="edited" title={`Editado el ${new Date(c.editedAt).toLocaleString('es')}`}>(editado)</span>}
                  {!isEditing && (mine || isAdmin) && (
                    <span className="comment-actions">
                      {mine && <button type="button" onClick={() => setEditing({ id: c.id, text: c.body })}>Editar</button>}
                      <button type="button" className="del" onClick={() => remove(c)}>Eliminar</button>
                    </span>
                  )}
                </div>

                {isEditing ? (
                  <div className="comment-edit">
                    <textarea
                      autoFocus rows={3} maxLength={MAX} value={editing.text} aria-label="Editar comentario"
                      onChange={(e) => setEditing({ ...editing, text: e.target.value, error: '' })}
                    />
                    <div className="comment-edit-bar">
                      <span className={`comment-count ${editing.text.length > MAX - 100 ? 'warn' : ''}`}>{editing.text.length}/{MAX}</span>
                      <button type="button" className="ghost small" onClick={() => setEditing(null)}>Cancelar</button>
                      <button type="button" className="small" disabled={editing.saving} onClick={() => saveEdit(c)}>{editing.saving ? 'Guardando…' : 'Guardar'}</button>
                    </div>
                    {editing.error && <p className="error comment-error" role="alert">{editing.error}</p>}
                  </div>
                ) : (
                  <p>{c.body}</p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
