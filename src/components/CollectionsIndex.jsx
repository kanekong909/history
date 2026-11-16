import { useMemo } from 'react'
import Icon from './Icon.jsx'
import { cdn } from '../cloudinary.js'

const TINTS = [
  ['#7b1e3a', '#3a0d1a'], ['#0F6E56', '#04342C'], ['#534AB7', '#26215C'],
  ['#BA7517', '#633806'], ['#185FA5', '#042C53'], ['#993C1D', '#4A1B0C'],
]
const tintOf = (name) => TINTS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % TINTS.length]

// Tarjeta de una colección: la foto de su primera ficha con imagen, su nombre y cuántas fichas tiene.
export function CollectionTile({ collection, count, cover, onClick }) {
  const [a, b] = tintOf(collection.name)
  return (
    <button type="button" className="cat-tile" onClick={onClick} style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
      {cover && <img src={cdn(cover, 640)} alt="" loading="lazy" />}
      <span className="cat-shade" />
      <span className="cat-ico"><Icon name="database" size={20} /></span>
      <span className="cat-text">
        <span className="cat-name">{collection.name}</span>
        <span className="cat-count">{count} {count === 1 ? 'ficha' : 'fichas'}</span>
      </span>
    </button>
  )
}

export function collectionStats(collections, records) {
  return collections.map((c) => {
    const mine = records.filter((r) => r.collectionId === c.id)
    return { collection: c, count: mine.length, cover: mine.find((r) => r.image)?.image || null }
  })
}

export default function CollectionsIndex({ collections, records, isAdmin, onOpen, onNew }) {
  const stats = useMemo(() => collectionStats(collections, records), [collections, records])
  return (
    <section className="mine">
      <div className="page-head">
        <div>
          <h1>Colecciones</h1>
          <p className="page-sub">Fichas con información organizada (motores, aviones, personajes…). Las historias las mencionan con «@» o las muestran en tablas.</p>
        </div>
        {isAdmin && <button type="button" onClick={onNew}>Nueva colección</button>}
      </div>

      {stats.length === 0 ? (
        <div className="empty">
          <p>Todavía no hay colecciones.</p>
          {isAdmin && <><p>Crea la primera: por ejemplo «Motores de avión», con los campos que necesites.</p><button type="button" onClick={onNew}>Crear una colección</button></>}
        </div>
      ) : (
        <div className="cat-grid">
          {stats.map(({ collection, count, cover }) => (
            <CollectionTile key={collection.id} collection={collection} count={count} cover={cover} onClick={() => onOpen(collection.slug)} />
          ))}
        </div>
      )}
    </section>
  )
}
