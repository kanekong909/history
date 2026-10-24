import { useEffect, useRef, useState } from 'react'
import { supabase, isConfigured } from './supabase.js'
import {
  getAllEntries, saveEntry, deleteEntry, exportAll, importAll, uploadEntries,
  getProfile, getMyFavorites, setFavorite, getFavoriteCounts,
} from './db.js'
import { getLocalEntries, clearLocalEntries } from './localDb.js'
import EntryList from './components/EntryList.jsx'
import EntryEditor from './components/EntryEditor.jsx'
import EntryView from './components/EntryView.jsx'
import Login from './components/Login.jsx'

function NotConfigured() {
  return (
    <div className="app">
      <div className="empty">
        <h2>Falta configurar Supabase</h2>
        <p>Crea un archivo <code>.env</code> (copia <code>.env.example</code>) con
          <code> VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code>, y reinicia <code>npm run dev</code>.</p>
        <p>Los pasos completos están en <code>README.md</code>.</p>
      </div>
    </div>
  )
}

export default function App() {
  if (!isConfigured) return <NotConfigured />
  return <Archive />
}

function Archive() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [favs, setFavs] = useState(new Set())
  const [counts, setCounts] = useState({})
  const [showLogin, setShowLogin] = useState(false)
  const [localCount, setLocalCount] = useState(0)
  const [busyMsg, setBusyMsg] = useState('')
  // view: { mode: 'list' } | { mode: 'view', id } | { mode: 'edit', id? }
  const [view, setView] = useState({ mode: 'list' })
  const importRef = useRef(null)

  const user = session?.user
  const isAdmin = Boolean(profile?.is_admin)

  const reload = async () => {
    try {
      setEntries(await getAllEntries())
      setCounts(await getFavoriteCounts().catch(() => ({})))
      setError('')
    } catch (e) {
      setError('No se pudieron cargar las entradas: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  // Al cambiar de usuario: cargar su perfil (¿es admin?) y sus favoritos.
  useEffect(() => {
    if (!user) {
      setProfile(null)
      setFavs(new Set())
      return
    }
    getProfile(user.id).then(setProfile).catch(() => setProfile(null))
    getMyFavorites().then(setFavs).catch(() => {})
  }, [user?.id])

  // Si hay entradas de la versión local anterior, ofrecer al admin subirlas.
  useEffect(() => {
    if (isAdmin) getLocalEntries().then((l) => setLocalCount(l.length))
  }, [isAdmin])

  const toggleFav = async (entryId) => {
    if (!user) return setShowLogin(true)
    const on = !favs.has(entryId)
    const apply = (add) => {
      setFavs((s) => {
        const next = new Set(s)
        add ? next.add(entryId) : next.delete(entryId)
        return next
      })
      setCounts((c) => ({ ...c, [entryId]: Math.max(0, (c[entryId] || 0) + (add ? 1 : -1)) }))
    }
    apply(on) // se ve al instante; si falla, se revierte
    try {
      await setFavorite(entryId, on)
    } catch (e) {
      apply(!on)
      alert('No se pudo guardar el favorito: ' + e.message)
    }
  }

  const current = entries.find((e) => e.id === view.id)

  const run = async (msg, fn) => {
    setBusyMsg(msg)
    try {
      await fn()
    } catch (e) {
      alert('Ocurrió un error: ' + e.message)
    } finally {
      setBusyMsg('')
    }
  }

  const handleSave = (entry) =>
    run('Guardando…', async () => {
      await saveEntry(entry, current)
      await reload()
      setView({ mode: 'view', id: entry.id })
    })

  const handleDelete = (entry) => {
    if (!confirm('¿Eliminar esta entrada? No se puede deshacer.')) return
    run('Eliminando…', async () => {
      await deleteEntry(entry)
      await reload()
      setView({ mode: 'list' })
    })
  }

  const handleExport = () =>
    run('Preparando respaldo…', async () => {
      const blob = await exportAll()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `mi-archivo-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(a.href)
    })

  const handleImport = (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    run('Importando…', async () => {
      const n = await importAll(file)
      await reload()
      alert(`Se importaron ${n} entradas.`)
    })
  }

  const handleMigrate = () =>
    run('Subiendo entradas locales…', async () => {
      const local = await getLocalEntries()
      await uploadEntries(local, (i, total) => setBusyMsg(`Subiendo entradas locales… ${i}/${total}`))
      await clearLocalEntries()
      setLocalCount(0)
      await reload()
    })

  return (
    <div className="app">
      <header className="topbar">
        <h1 onClick={() => setView({ mode: 'list' })}>📚 Mi Archivo</h1>
        <div className="actions">
          <button className="ghost" onClick={handleExport}>Exportar</button>
          {user ? (
            <>
              {isAdmin && (
                <>
                  <button className="ghost" onClick={() => importRef.current.click()}>Importar</button>
                  <input ref={importRef} type="file" accept="application/json" hidden onChange={handleImport} />
                </>
              )}
              <span className="user" title={user.email}>👤 {profile?.display_name || user.email}</span>
              <button className="ghost" onClick={() => supabase.auth.signOut()}>Salir</button>
              {isAdmin && <button onClick={() => setView({ mode: 'edit' })}>+ Nueva entrada</button>}
            </>
          ) : (
            <button onClick={() => setShowLogin(true)}>Iniciar sesión</button>
          )}
        </div>
      </header>

      {localCount > 0 && (
        <div className="banner">
          Tienes {localCount} {localCount === 1 ? 'entrada guardada' : 'entradas guardadas'} solo en este navegador.
          <button onClick={handleMigrate}>Subir a la nube</button>
        </div>
      )}
      {error && <div className="banner error">{error}</div>}

      <main>
        {view.mode === 'list' && (
          loading ? <div className="empty"><p>Cargando…</p></div> :
          <EntryList
            entries={entries}
            canCreate={isAdmin}
            loggedIn={Boolean(user)}
            favs={favs}
            counts={counts}
            onToggleFav={toggleFav}
            onOpen={(id) => setView({ mode: 'view', id })}
          />
        )}
        {view.mode === 'view' && current && (
          <EntryView
            entry={current}
            canEdit={isAdmin}
            isFav={favs.has(current.id)}
            favCount={counts[current.id]}
            onToggleFav={() => toggleFav(current.id)}
            onBack={() => setView({ mode: 'list' })}
            onEdit={() => setView({ mode: 'edit', id: current.id })}
            onDelete={() => handleDelete(current)}
          />
        )}
        {view.mode === 'edit' && isAdmin && (
          <EntryEditor
            key={view.id || 'new'}
            entry={current}
            saving={Boolean(busyMsg)}
            categories={[...new Set(entries.map((e) => e.category).filter(Boolean))]}
            onSave={handleSave}
            onCancel={() => setView(current ? { mode: 'view', id: current.id } : { mode: 'list' })}
          />
        )}
      </main>

      {showLogin && <Login onClose={() => setShowLogin(false)} />}
      {busyMsg && <div className="toast">{busyMsg}</div>}
    </div>
  )
}
