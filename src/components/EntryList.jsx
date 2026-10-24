import { useMemo, useState } from 'react'
import { useObjectURL } from '../useObjectURL.js'
import FavButton from './FavButton.jsx'
import { blockText } from '../richText.js'
import { coverOf } from '../imageStyles.js'

function firstImage(entry) {
  return entry.cover || entry.blocks?.find((b) => b.type === 'image' && b.image)?.image
}

function excerpt(entry) {
  const block = entry.blocks?.find((b) => b.type === 'text' && blockText(b).trim())
  const text = block ? blockText(block).replace(/\s+/g, ' ').trim() : ''
  return text.length > 160 ? text.slice(0, 160).replace(/\s\S*$/, '') + '…' : text
}

function Card({ entry, featured, isFav, favCount, onToggleFav, onOpen }) {
  const img = useObjectURL(firstImage(entry))
  return (
    <article className={`card ${featured ? 'featured' : ''}`} onClick={onOpen}>
      <div className="card-media">
        {img ? <img src={img} alt="" style={entry.cover ? { objectPosition: coverOf(entry).position } : undefined} /> : <div className="card-placeholder">📝</div>}
        <FavButton active={isFav} count={favCount} onToggle={onToggleFav} />
      </div>
      <div className="card-body">
        <div className="meta">
          {entry.category && <span className="kicker">{entry.category}</span>}
          {entry.date && <span>{entry.date}</span>}
        </div>
        <h3>{entry.title || 'Sin título'}</h3>
        <p>{excerpt(entry)}</p>
        {entry.tags?.length > 0 && (
          <div className="tags">{entry.tags.slice(0, 4).map((t) => <span key={t}>#{t}</span>)}</div>
        )}
      </div>
    </article>
  )
}

export default function EntryList({ entries, canCreate, loggedIn, favs, counts, onToggleFav, onOpen }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [onlyFavs, setOnlyFavs] = useState(false)

  const categories = [...new Set(entries.map((e) => e.category).filter(Boolean))]

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return entries.filter((e) => {
      if (cat && e.category !== cat) return false
      if (onlyFavs && !favs.has(e.id)) return false
      if (!s) return true
      const hay = [e.title, e.category, e.date, ...(e.tags || []),
        ...(e.blocks || []).map((b) => `${blockText(b)} ${b.caption || ''}`)]
        .join(' ').toLowerCase()
      return hay.includes(s)
    })
  }, [entries, q, cat, onlyFavs, favs])

  return (
    <section>
      <div className="filters">
        <input placeholder="Buscar por título, texto, etiquetas…" value={q} onChange={(e) => setQ(e.target.value)} />
        {loggedIn && (
          <button type="button" className={onlyFavs ? '' : 'ghost'} onClick={() => setOnlyFavs((v) => !v)}>
            ♥ Mis favoritos
          </button>
        )}
      </div>
      {categories.length > 0 && (
        <nav className="categories">
          <button type="button" className={!cat ? 'active' : ''} onClick={() => setCat('')}>Todas</button>
          {categories.map((c) => (
            <button type="button" key={c} className={cat === c ? 'active' : ''} onClick={() => setCat(c)}>{c}</button>
          ))}
        </nav>
      )}

      {entries.length === 0 ? (
        <div className="empty">
          <p>Aún no hay entradas.</p>
          {canCreate
            ? <p>Pulsa <b>+ Nueva entrada</b> para guardar tu primera historia, nota o recuerdo.</p>
            : <p>Pronto habrá contenido aquí.</p>}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty"><p>{onlyFavs ? 'Todavía no tienes favoritos.' : 'No hay resultados.'}</p></div>
      ) : (
        <div className="grid">
          {filtered.map((e, i) => (
            <Card
              key={e.id}
              entry={e}
              featured={i === 0 && !q && !cat && !onlyFavs && filtered.length > 2}
              isFav={favs.has(e.id)}
              favCount={counts[e.id]}
              onToggleFav={() => onToggleFav(e.id)}
              onOpen={() => onOpen(e.id)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
