import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
import CollectionsIndex from './components/CollectionsIndex.jsx'
import CollectionPage from './components/CollectionPage.jsx'
import RecordPage from './components/RecordPage.jsx'
import CollectionEditor from './components/CollectionEditor.jsx'
import RecordEditor from './components/RecordEditor.jsx'
import { KnowledgeProvider } from './knowledge.jsx'
import { getKnowledge, saveCollection, deleteCollection, saveRecord, deleteRecord, createRecordQuick } from './knowledge.js'
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
  if (location.pathname === '/colecciones') return { mode: 'collections' }
  const col = location.pathname.match(/^\/coleccion\/([^/]+)/)
  if (col) return { mode: 'collection', slug: decodeURIComponent(col[1]) }
  const rec = location.pathname.match(/^\/ficha\/([^/]+)/)
  if (rec) return { mode: 'record', id: decodeURIComponent(rec[1]) }
  if (location.pathname === '/mis-historias') return { mode: 'mine' }
  if (location.pathname === '/pendientes') return { mode: 'review' }
  const m = location.pathname.match(/^\/historia\/([^/]+)/)
  return m ? { mode: 'view', id: decodeURIComponent(m[1]) } : { mode: 'list' }
}

// Vuelve a una posición de la página. Las imágenes y las tablas terminan de cargar después y la página va creciendo,
// así que se reintenta unas veces, salvo que la persona empiece a desplazarse por su cuenta.
function restoreScroll(y) {
  window.scrollTo(0, y)
  if (y < 2) return
  let touched = false
  const stop = () => { touched = true }
  for (const ev of ['wheel', 'touchstart', 'keydown']) window.addEventListener(ev, stop, { once: true, passive: true })
  let tries = 0
  const tick = () => {
    if (touched || tries++ > 10 || Math.abs(window.scrollY - y) <= 2) return
    window.scrollTo(0, y)
    setTimeout(tick, 120)
  }
  setTimeout(tick, 90)
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
  const [knowledge, setKnowledge] = useState(null) // { collections, records }; null = aún no activado (08_colecciones.sql)
  const [kLoaded, setKLoaded] = useState(false)
  // Búsqueda y filtros del inicio: viven aquí para no perderse al abrir una historia y volver.
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [busyMsg, setBusyMsg] = useState('')
  // view: { mode: 'list' } | { mode: 'view', id } | { mode: 'edit', id? }
  // La entrada abierta va en la dirección (/historia/<id>) para poder compartirla y volver con «atrás».
  const [view, setViewState] = useState(viewFromPath)
  const pendingScroll = useRef(null) // posición a la que ir cuando se pinte la nueva pantalla
  // `hero`: la imagen pulsada (viaja hasta la portada). `also`: algo más que cambiar en la misma transición.
  const setView = (v, hero, also) => {
    transition(() => {
      setViewState(v)
      also?.()
      const path = {
        view: v.id && entryPath(v.id), list: '/', mine: '/mis-historias', review: '/pendientes',
        collections: '/colecciones', collection: v.slug && `/coleccion/${encodeURIComponent(v.slug)}`, record: v.id && `/ficha/${encodeURIComponent(v.id)}`,
      }[v.mode] ?? null
      if (path && location.pathname !== path) {
        history.replaceState({ ...history.state, scrollY: window.scrollY }, '') // recuerda dónde estabas
        history.pushState({ idx: (history.state?.idx ?? 0) + 1, scrollY: 0 }, '', path)
      }
      pendingScroll.current = 0 // una pantalla nueva empieza arriba
    }, hero)
  }

  // ¿Hay una pantalla anterior dentro de la app? Entonces «Volver» usa el historial (y recupera la posición).
  const canGoBack = (history.state?.idx ?? 0) > 0
  const goBack = (fallback) => (canGoBack ? history.back() : setView(fallback))
  const importRef = useRef(null)

  const user = session?.user
  const isAdmin = Boolean(profile?.is_admin)

  const loadKnowledge = async () => {
    try { setKnowledge(await getKnowledge()) } catch { setKnowledge(null) } finally { setKLoaded(true) }
  }

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
    history.scrollRestoration = 'manual' // la posición la gestiona la app
    if (history.state?.idx === undefined) history.replaceState({ ...history.state, idx: 0, scrollY: 0 }, '')

    const onPop = (e) => transition(() => {
      setViewState(viewFromPath())
      pendingScroll.current = e.state?.scrollY ?? 0
    })
    // Va anotando el desplazamiento en la entrada actual del historial (con «adelante» también se recupera)
    let t
    const onScroll = () => {
      clearTimeout(t)
      t = setTimeout(() => history.replaceState({ ...history.state, scrollY: window.scrollY }, ''), 150)
    }
    window.addEventListener('popstate', onPop)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      clearTimeout(t)
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  // Cuando la pantalla nueva ya está pintada, se va a la posición pendiente (arriba, o donde se estaba al volver)
  useLayoutEffect(() => {
    const y = pendingScroll.current
    if (y == null) return
    pendingScroll.current = null
    restoreScroll(y)
  }, [view])

  useEffect(() => {
    reload()
    loadKnowledge()
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

  // Colecciones y fichas (para tablas, menciones con «@» y las páginas de colecciones)
  const collections = knowledge?.collections || []
  const records = knowledge?.records || []
  const recordById = useMemo(() => new Map(records.map((r) => [r.id, r])), [records])
  const collectionById = useMemo(() => new Map(collections.map((c) => [c.id, c])), [collections])
  const collectionBySlug = (slug) => collections.find((c) => c.slug === slug)
  const kvalue = {
    enabled: Boolean(knowledge), loaded: kLoaded, collections, records, recordById, collectionById,
    canCreate: isAdmin && Boolean(knowledge),
    openRecord: (id) => setView({ mode: 'record', id }),
    openCollection: (slug) => setView({ mode: 'collection', slug }),
    createRecord: async ({ title, collectionId }) => {
      const r = await createRecordQuick({ title, collectionId })
      setKnowledge((k) => ({ ...k, records: [...k.records, r].sort((a, b) => a.title.localeCompare(b.title, 'es')) }))
      return r
    },
  }
  const mine = user ? entries.filter((e) => e.userId === user.id) : []
  const pending = entries.filter((e) => e.status === 'pending')
  const canCreate = isAdmin || Boolean(user && contributors)
  const canEditEntry = (e) => isAdmin || Boolean(user && e && e.userId === user.id && e.status !== 'published')
  const notify = (msg) => { setNotice(msg); setTimeout(() => setNotice(''), 4200) }
  // Al salir de una historia sin publicar se vuelve a la lista de donde se vino
  const backFor = (e) => (e && e.status !== 'published' ? { mode: isAdmin ? 'review' : 'mine' } : { mode: 'list' })

  // La pestaña lleva el título de la historia.
  useEffect(() => {
    const t = view.mode === 'view' ? current?.title
      : view.mode === 'record' ? recordById.get(view.id)?.title
      : view.mode === 'collection' ? collectionBySlug(view.slug)?.name
      : view.mode === 'collections' ? 'Colecciones' : ''
    document.title = t ? `${t} · Mi Archivo` : 'Mi Archivo'
  }, [view.mode, current?.title, knowledge])

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

  const handleSaveCollection = (col) =>
    run('Guardando colección…', async () => {
      const saved = await saveCollection(col, collections)
      await loadKnowledge()
      setView({ mode: 'collection', slug: saved.slug })
      notify('Colección guardada.')
    })
  const handleDeleteCollection = (col) => {
    if (!confirm(`¿Eliminar la colección «${col.name}» y todas sus fichas? No se puede deshacer.`)) return
    run('Eliminando…', async () => {
      await deleteCollection(col, records)
      await loadKnowledge()
      setView({ mode: 'collections' })
      notify('Colección eliminada.')
    })
  }
  const handleSaveRecord = (rec) =>
    run('Guardando ficha…', async () => {
      const saved = await saveRecord(rec, recordById.get(rec.id))
      await loadKnowledge()
      setView({ mode: 'record', id: saved.id })
      notify('Ficha guardada.')
    })
  const handleDeleteRecord = (rec) => {
    if (!confirm(`¿Eliminar la ficha «${rec.title}»? Las historias que la mencionan mostrarán su nombre sin enlace.`)) return
    run('Eliminando…', async () => {
      await deleteRecord(rec)
      await loadKnowledge()
      setView({ mode: 'collection', slug: collectionById.get(rec.collectionId)?.slug })
      notify('Ficha eliminada.')
    })
  }

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
  const notFound = (
    <div className="empty">
      <h2>No encontramos esta página</h2>
      <p>Puede que se haya eliminado, que el enlace esté incompleto o que esta función aún no esté activada.</p>
      <button onClick={() => setView({ mode: 'list' })}>Ir al inicio</button>
    </div>
  )
  const needLogin = (
    <div className="empty">
      <h2>Inicia sesión para continuar</h2>
      <p>Esta página es para cuentas con la sesión iniciada.</p>
      <button onClick={() => setShowLogin(true)}>Iniciar sesión</button>
    </div>
  )

  return (
    <KnowledgeProvider value={kvalue}>
      <Navbar
        user={user}
        profile={profile}
        isAdmin={isAdmin}
        canWrite={canCreate}
        showMine={Boolean(user) && !isAdmin && contributors}
        showCollections={Boolean(knowledge) && (collections.length > 0 || isAdmin)}
        onCollections={() => setView({ mode: 'collections' })}
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
            collections={collections}
            records={records}
            onOpenCollection={(slug) => setView({ mode: 'collection', slug })}
            onOpenCollections={() => setView({ mode: 'collections' })}
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
            canGoBack={canGoBack}
            onBack={() => goBack(backFor(current))}
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
        {view.mode === 'collections' && (
          !kLoaded ? loadingBox : !knowledge ? notFound : (
            <CollectionsIndex
              collections={collections} records={records} isAdmin={isAdmin}
              onOpen={(slug) => setView({ mode: 'collection', slug })}
              onNew={() => setView({ mode: 'collection-edit' })}
            />
          )
        )}
        {view.mode === 'collection' && (() => {
          const col = collectionBySlug(view.slug)
          return !kLoaded ? loadingBox : !col ? notFound : (
            <CollectionPage
              collection={col} records={records} isAdmin={isAdmin}
              canGoBack={canGoBack}
              onBack={() => goBack({ mode: 'collections' })}
              onParent={() => setView({ mode: 'collections' })}
              onEditCollection={() => setView({ mode: 'collection-edit', slug: col.slug })}
              onNewRecord={() => setView({ mode: 'record-edit', collectionId: col.id })}
              onDeleteCollection={() => handleDeleteCollection(col)}
            />
          )
        })()}
        {view.mode === 'record' && (() => {
          const rec = recordById.get(view.id)
          const col = rec && collectionById.get(rec.collectionId)
          return !kLoaded || (loading && !rec) ? loadingBox : !rec || !col ? notFound : (
            <RecordPage
              record={rec} collection={col} entries={published} isAdmin={isAdmin}
              canGoBack={canGoBack}
              onBack={() => goBack({ mode: 'collection', slug: col.slug })}
              onOpenCollection={() => setView({ mode: 'collection', slug: col.slug })}
              onOpenEntry={(id) => setView({ mode: 'view', id })}
              onEdit={() => setView({ mode: 'record-edit', id: rec.id })}
              onDelete={() => handleDeleteRecord(rec)}
            />
          )
        })()}
        {view.mode === 'collection-edit' && isAdmin && knowledge && (
          <CollectionEditor
            key={view.slug || 'nueva'}
            collection={collectionBySlug(view.slug)}
            collections={collections}
            saving={Boolean(busyMsg)}
            onSave={handleSaveCollection}
            onCancel={() => setView(view.slug ? { mode: 'collection', slug: view.slug } : { mode: 'collections' })}
          />
        )}
        {view.mode === 'record-edit' && isAdmin && knowledge && (() => {
          const rec = recordById.get(view.id)
          const col = collectionById.get(rec?.collectionId || view.collectionId)
          return col && (
            <RecordEditor
              key={view.id || `nueva-${col.id}`}
              record={rec} collection={col} records={records}
              saving={Boolean(busyMsg)}
              onSave={handleSaveRecord}
              onCancel={() => setView(rec ? { mode: 'record', id: rec.id } : { mode: 'collection', slug: col.slug })}
            />
          )
        })()}
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
    </KnowledgeProvider>
  )
}
