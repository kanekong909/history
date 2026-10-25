import { useMemo } from 'react'
import EntryCard, { firstImage } from './EntryCard.jsx'
import HomeBanner from './HomeBanner.jsx'
import Icon, { categoryIcon } from './Icon.jsx'
import { blockText } from '../richText.js'
import { collectImages } from './Lightbox.jsx'
import { transition } from '../transitions.js'
import { cdn } from '../cloudinary.js'

export const EMPTY_FILTERS = { q: '', cat: '', onlyFavs: false, showAll: false }

// Fondos de las categorías que no tienen foto
const TINTS = [
  ['#7b1e3a', '#3a0d1a'], ['#0F6E56', '#04342C'], ['#534AB7', '#26215C'],
  ['#BA7517', '#633806'], ['#185FA5', '#042C53'], ['#993C1D', '#4A1B0C'],
]
const tintOf = (name) => TINTS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % TINTS.length]

function filterEntries(entries, { q, cat, onlyFavs }, favs) {
  const s = q.trim().toLowerCase()
  return entries.filter((e) => {
    if (cat && e.category !== cat) return false
    if (onlyFavs && !favs.has(e.id)) return false
    if (!s) return true
    const hay = [e.title, e.category, e.date, ...(e.tags || []), ...(e.blocks || []).map((b) => `${blockText(b)} ${b.caption || ''}`)]
      .join(' ').toLowerCase()
    return hay.includes(s)
  })
}

function categoriesOf(entries) {
  const map = new Map()
  for (const e of entries) { // llegan de la más reciente a la más antigua: la primera foto es la más nueva
    if (!e.category) continue
    const g = map.get(e.category) || { name: e.category, count: 0, cover: null }
    g.count++
    if (!g.cover) { const img = firstImage(e); if (typeof img === 'string') g.cover = img }
    map.set(e.category, g)
  }
  return [...map.values()].sort((a, b) => b.count - a.count)
}

function tagsOf(entries) {
  const c = {}
  for (const e of entries) for (const t of e.tags || []) c[t] = (c[t] || 0) + 1
  return Object.entries(c).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 12).map(([t]) => t)
}

function CategoryTile({ cat, onClick }) {
  const [a, b] = tintOf(cat.name)
  return (
    <button type="button" className="cat-tile" onClick={onClick} style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
      {cat.cover && <img src={cdn(cat.cover, 640)} alt="" loading="lazy" />}
      <span className="cat-shade" />
      <span className="cat-ico"><Icon name={categoryIcon(cat.name)} size={20} /></span>
      <span className="cat-text">
        <span className="cat-name">{cat.name}</span>
        <span className="cat-count">{cat.count} {cat.count === 1 ? 'historia' : 'historias'}</span>
      </span>
    </button>
  )
}

function Section({ title, action, onAction, children }) {
  return (
    <section className="home-sec">
      <div className="home-sec-head">
        <h2>{title}</h2>
        {action && <button type="button" className="link" onClick={onAction}>{action}</button>}
      </div>
      {children}
    </section>
  )
}

export default function Home({ entries, filters, setFilters, isAdmin, loggedIn, favs, counts, onToggleFav, onOpen }) {
  const { q, cat, onlyFavs, showAll } = filters
  const set = (patch) => setFilters({ ...filters, ...patch }) // sin transición (al escribir en el buscador)
  // Cambios de pantalla (categoría, ver todas, etiqueta…): con transición y volviendo arriba
  const go = (patch) => transition(() => { setFilters({ ...filters, ...patch }); window.scrollTo(0, 0) })
  const filtering = Boolean(q.trim() || cat || onlyFavs || showAll)

  const categories = useMemo(() => categoriesOf(entries), [entries])
  const tags = useMemo(() => tagsOf(entries), [entries])
  const results = useMemo(() => filterEntries(entries, filters, favs), [entries, filters, favs])

  // Banner: las marcadas como destacadas; si no hay, las más queridas (y más nuevas) que tengan portada.
  const banner = useMemo(() => {
    const withCover = entries.filter((e) => typeof e.cover === 'string')
    const picked = withCover.filter((e) => e.featured).slice(0, 5)
    if (picked.length) return picked
    return [...withCover].sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0) || b.updatedAt - a.updatedAt).slice(0, 3)
  }, [entries, counts])

  const loved = useMemo(
    () => entries.filter((e) => counts[e.id] > 0).sort((a, b) => counts[b.id] - counts[a.id]).slice(0, 3),
    [entries, counts],
  )
  const stats = useMemo(() => ({
    stories: entries.length,
    photos: entries.reduce((n, e) => n + collectImages(e).length, 0),
    favorites: Object.values(counts).reduce((n, c) => n + c, 0),
  }), [entries, counts])

  const card = (e) => (
    <EntryCard key={e.id} entry={e} isFav={favs.has(e.id)} favCount={counts[e.id]} onToggleFav={() => onToggleFav(e.id)} onOpen={(hero) => onOpen(e.id, hero)} />
  )

  const searchBar = (
    <div className="home-search">
      <label className="search-box">
        <Icon name="search" size={18} />
        <input
          type="search" value={q} placeholder="Buscar historias, lugares, épocas…" aria-label="Buscar"
          onChange={(e) => set({ q: e.target.value })}
        />
        {q && <button type="button" className="clear" aria-label="Borrar búsqueda" onClick={() => set({ q: '' })}><Icon name="x" size={16} /></button>}
      </label>
      {loggedIn && (
        <button type="button" className={`fav-filter ${onlyFavs ? 'on' : ''}`} aria-pressed={onlyFavs} onClick={() => go({ onlyFavs: !onlyFavs })}>
          <Icon name="heart" size={16} /> Mis favoritos
        </button>
      )}
    </div>
  )

  if (!entries.length) {
    return (
      <div className="empty">
        <p>Aún no hay entradas.</p>
        {isAdmin ? <p>Pulsa <b>+ Nueva entrada</b> para guardar tu primera historia, nota o recuerdo.</p> : <p>Pronto habrá contenido aquí.</p>}
      </div>
    )
  }

  // ----- Resultados: búsqueda, categoría, favoritos o «ver todas» -----
  if (filtering) {
    const title = q.trim() ? `Resultados para «${q.trim()}»` : onlyFavs ? 'Mis favoritos' : cat || 'Todas las historias'
    return (
      <div className="home">
        {searchBar}
        <div className="results-head">
          <button type="button" className="ghost" onClick={() => transition(() => { setFilters(EMPTY_FILTERS); window.scrollTo(0, 0) })}>← Inicio</button>
          <h2>{title}</h2>
          <span>{results.length} {results.length === 1 ? 'historia' : 'historias'}</span>
        </div>
        {categories.length > 0 && (
          <nav className="categories" aria-label="Categorías">
            <button type="button" className={!cat ? 'active' : ''} onClick={() => go({ cat: '' })}>Todas</button>
            {categories.map((c) => (
              <button type="button" key={c.name} className={cat === c.name ? 'active' : ''} onClick={() => go({ cat: c.name })}>{c.name}</button>
            ))}
          </nav>
        )}
        {results.length
          ? <div className="grid">{results.map(card)}</div>
          : <div className="empty"><p>{onlyFavs && !q ? 'Todavía no tienes favoritos.' : 'No encontramos nada con eso.'}</p></div>}
      </div>
    )
  }

  // ----- Panel principal -----
  return (
    <div className="home">
      {searchBar}
      <HomeBanner items={banner} favs={favs} counts={counts} onOpen={onOpen} onToggleFav={onToggleFav} />

      {categories.length > 0 && (
        <Section title="Explora por categoría">
          <div className="cat-grid">
            {categories.map((c) => <CategoryTile key={c.name} cat={c} onClick={() => go({ cat: c.name })} />)}
          </div>
        </Section>
      )}

      <Section title="Recién publicadas" action={entries.length > 6 ? 'Ver todas' : null} onAction={() => go({ showAll: true })}>
        <div className="grid">{entries.slice(0, 6).map(card)}</div>
      </Section>

      {loved.length > 0 && (
        <Section title="Las más queridas">
          <ol className="loved">
            {loved.map((e, k) => (
              <li key={e.id}>
                <button type="button" onClick={() => onOpen(e.id)}>
                  <span className="rank">{k + 1}</span>
                  <span className="loved-text">
                    <strong>{e.title || 'Sin título'}</strong>
                    <span>{e.category}</span>
                  </span>
                  <span className="loved-count"><Icon name="heart" size={15} /> {counts[e.id]}</span>
                </button>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {tags.length > 0 && (
        <Section title="Etiquetas populares">
          <div className="tag-cloud">
            {tags.map((t) => <button type="button" key={t} onClick={() => go({ q: t })}>#{t}</button>)}
          </div>
        </Section>
      )}

      <div className="stats">
        <div><span>Historias</span><strong>{stats.stories}</strong></div>
        <div><span>Fotos</span><strong>{stats.photos}</strong></div>
        <div><span>Favoritos</span><strong>{stats.favorites}</strong></div>
      </div>
    </div>
  )
}
