import { useEffect, useRef, useState } from 'react'
import { supabase, isConfigured } from './supabase.js'
import {
  getAllEntries, saveEntry, deleteEntry, exportAll, importAll, uploadEntries,
  getProfile, getMyFavorites, setFavorite, getFavoriteCounts, setEntryStatus, probeContributors,
} from './db.js'
import { getLocalEntries, clearLocalEntries } from './localDb.js'
import Home, { EMPTY_FILTERS } from './components/Home.jsx'
import EntryEditor from './components/EntryEditor.jsx'
import EntryView from './components/EntryView.jsx'
import Login from './components/Login.jsx'
import Navbar from './components/Navbar.jsx'
import MyStories from './components/MyStories.jsx'
import ReviewQueue from './components/ReviewQueue.jsx'
import { transition } from './transitions.js'

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

const entryPath = (id) => `/historia/${encodeURIComponent(id)}`
const viewFromPath = () => {
  if (location.pathname === '/mis-historias') return { mode: 'mine' }
  if (location.pathname === '/pendientes') return { mode: 'review' }
  const m = location.pathname.match(/^\/historia\/([^/]+)/)
  return m ? { mode: 'view', id: decodeURIComponent(m[1]) } : { mode: 'list' }
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
  const [authReady, setAuthReady] = useState(false)
  const [contributors, setContributors] = useState(false) // ¿ya se ejecutó 07_historias_de_usuarios.sql?
  const [notice, setNotice] = useState('')
  // Búsqueda y filtros del inicio: viven aquí para no perderse al abrir una historia y volver.
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [busyMsg, setBusyMsg] = useState('')
  // view: { mode: 'list' } | { mode: 'view', id } | { mode: 'edit', id? }
  // La entrada abierta va en la dirección (/historia/<id>) para poder compartirla y volver con «atrás».
  const [view, setViewState] = useState(viewFromPath)
  // `hero`: la imagen pulsada (viaja hasta la portada). `also`: algo más que cambiar en la misma transición.
  const setView = (v, hero, also) => {
    transition(() => {
      setViewState(v)
      also?.()
      const path = { view: v.id && entryPath(v.id), list: '/', mine: '/mis-historias', review: '/pendientes' }[v.mode] ?? null
      if (path && location.pathname !== path) history.pushState(null, '', path)
      window.scrollTo(0, 0)
    }, hero)
  }
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
    const onPop = () => transition(() => { setViewState(viewFromPath()); window.scrollTo(0, 0) })
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    reload()
    probeContributors().then(setContributors).catch(() => {})
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true) })
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

  const published = entries.filter((e) => e.status === 'published') // lo que ve todo el mundo
  const mine = user ? entries.filter((e) => e.userId === user.id) : []
  const pending = entries.filter((e) => e.status === 'pending')
  const canCreate = isAdmin || Boolean(user && contributors)
  const canEditEntry = (e) => isAdmin || Boolean(user && e && e.userId === user.id && e.status !== 'published')
  const notify = (msg) => { setNotice(msg); setTimeout(() => setNotice(''), 4200) }
  // Al salir de una historia sin publicar se vuelve a la lista de donde se vino
  const backFor = (e) => (e && e.status !== 'published' ? { mode: isAdmin ? 'review' : 'mine' } : { mode: 'list' })

  // La pestaña lleva el título de la historia.
  useEffect(() => {
    document.title = view.mode === 'view' && current?.title ? `${current.title} · Mi Archivo` : 'Mi Archivo'
  }, [view.mode, current?.title])

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

  // intent: 'save' | 'submit' (enviar a revisión) | 'publish' (el administrador aprueba y publica)
  const handleSave = (entry, intent = 'save') =>
    run(intent === 'submit' ? 'Enviando a revisión…' : 'Guardando…', async () => {
      const status = isAdmin
        ? (intent === 'publish' ? 'published' : current?.status || 'published')
        : (intent === 'submit' ? 'pending' : 'draft')
      await saveEntry({ ...entry, status }, current)
      await reload()
      if (isAdmin) return setView({ mode: 'view', id: entry.id })
      setView({ mode: 'mine' })
      notify(intent === 'submit' ? 'Tu historia se envió a revisión. Aquí verás el resultado.' : 'Borrador guardado.')
    })

  const changeStatus = (entry, status, note, message) =>
    run('Un momento…', async () => {
      await setEntryStatus(entry.id, status, note)
      await reload()
      notify(message)
    })
  const approve = (entry) => changeStatus(entry, 'published', null, 'Historia publicada.')
  const reject = (entry, note) => changeStatus(entry, 'rejected', note, 'Historia rechazada.')
  const submitStory = (entry) => changeStatus(entry, 'pending', undefined, 'Historia enviada a revisión.')
  const withdraw = (entry) => changeStatus(entry, 'draft', undefined, 'La historia volvió a borrador.')

  const handleDelete = (entry) => {
    if (!confirm('¿Eliminar esta entrada? No se puede deshacer.')) return
    run('Eliminando…', async () => {
      await deleteEntry(entry)
      await reload()
      setView(backFor(entry))
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

  const loadingBox = <div className="empty"><p>Cargando…</p></div>
  const needLogin = (
    <div className="empty">
      <h2>Inicia sesión para continuar</h2>
      <p>Esta página es para cuentas con la sesión iniciada.</p>
      <button onClick={() => setShowLogin(true)}>Iniciar sesión</button>
    </div>
  )

  return (
    <>
      <Navbar
        user={user}
        profile={profile}
        isAdmin={isAdmin}
        canWrite={canCreate}
        showMine={Boolean(user) && !isAdmin && contributors}
        pendingCount={isAdmin ? pending.length : 0}
        onHome={() => setView({ mode: 'list' }, null, () => setFilters(EMPTY_FILTERS))}
        onNew={() => setView({ mode: 'edit' })}
        onMine={() => setView({ mode: 'mine' })}
        onReview={() => setView({ mode: 'review' })}
        onLogin={() => setShowLogin(true)}
        onLogout={() => supabase.auth.signOut()}
        onExport={handleExport}
        onImport={() => importRef.current.click()}
      />
      <div className="app">
      <input ref={importRef} type="file" accept="application/json" hidden onChange={handleImport} />

      {localCount > 0 && (
        <div className="banner">
          Tienes {localCount} {localCount === 1 ? 'entrada guardada' : 'entradas guardadas'} solo en este navegador.
          <button onClick={handleMigrate}>Subir a la nube</button>
        </div>
      )}
      {error && <div className="banner error">{error}</div>}

      <main key={`${view.mode}:${view.id || ''}`} className="view-enter">
        {view.mode === 'list' && (
          loading ? <div className="empty"><p>Cargando…</p></div> :
          <Home
            entries={published}
            filters={filters}
            setFilters={setFilters}
            isAdmin={isAdmin}
            loggedIn={Boolean(user)}
            favs={favs}
            counts={counts}
            onToggleFav={toggleFav}
            onOpen={(id, hero) => setView({ mode: 'view', id }, hero)}
          />
        )}
        {view.mode === 'view' && !current && (
          loading
            ? <div className="empty"><p>Cargando…</p></div>
            : (
              <div className="empty">
                <h2>No encontramos esta historia</h2>
                <p>Puede que se haya eliminado o que el enlace esté incompleto.</p>
                <button onClick={() => setView({ mode: 'list' })}>Ir al inicio</button>
              </div>
            )
        )}
        {view.mode === 'view' && current && (
          <EntryView
            entry={current}
            canEdit={canEditEntry(current)}
            isAdmin={isAdmin}
            user={user}
            profile={profile}
            onLogin={() => setShowLogin(true)}
            isFav={favs.has(current.id)}
            favCount={counts[current.id]}
            onToggleFav={() => toggleFav(current.id)}
            onBack={() => setView(backFor(current))}
            onEdit={() => setView({ mode: 'edit', id: current.id })}
            onDelete={() => handleDelete(current)}
            review={{
              onApprove: () => approve(current),
              onReject: (note) => reject(current, note),
              onSubmit: () => submitStory(current),
              onWithdraw: () => withdraw(current),
            }}
          />
        )}
        {view.mode === 'edit' && (current ? canEditEntry(current) : canCreate) && (
          <EntryEditor
            key={view.id || 'new'}
            role={isAdmin ? 'admin' : 'member'}
            entry={current}
            saving={Boolean(busyMsg)}
            categories={[...new Set(entries.map((e) => e.category).filter(Boolean))]}
            onSave={handleSave}
            onCancel={() => setView(current ? { mode: 'view', id: current.id } : { mode: isAdmin ? 'list' : 'mine' })}
          />
        )}
        {view.mode === 'mine' && (
          !authReady ? loadingBox : !user ? needLogin : (
            <MyStories
              entries={mine}
              busy={Boolean(busyMsg)}
              onOpen={(id) => setView({ mode: 'view', id })}
              onEdit={(id) => setView({ mode: 'edit', id })}
              onSubmit={submitStory}
              onWithdraw={withdraw}
              onDelete={handleDelete}
              onNew={() => setView({ mode: 'edit' })}
            />
          )
        )}
        {view.mode === 'review' && (
          !authReady || (user && !profile) ? loadingBox : !user ? needLogin : isAdmin ? (
            <ReviewQueue
              entries={pending}
              busy={Boolean(busyMsg)}
              onOpen={(id) => setView({ mode: 'view', id })}
              onApprove={approve}
              onReject={reject}
            />
          ) : (
            <div className="empty">
              <h2>Esta página es solo para el administrador</h2>
              <button onClick={() => setView({ mode: 'list' })}>Ir al inicio</button>
            </div>
          )
        )}
      </main>

      {showLogin && <Login onClose={() => setShowLogin(false)} />}
      {busyMsg && <div className="toast">{busyMsg}</div>}
      {!busyMsg && notice && <div className="toast ok" role="status">{notice}</div>}
      </div>
    </>
  )
}
