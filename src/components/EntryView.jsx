import { useObjectURL } from '../useObjectURL.js'
import FavButton from './FavButton.jsx'

function ImageBlock({ block }) {
  const url = useObjectURL(block.image)
  if (!url) return null
  return (
    <figure>
      <img src={url} alt={block.caption || ''} />
      {block.caption && <figcaption>{block.caption}</figcaption>}
    </figure>
  )
}

function Block({ block }) {
  switch (block.type) {
    case 'heading': return <h2>{block.text}</h2>
    case 'quote': return <blockquote>{block.text}</blockquote>
    case 'image': return <ImageBlock block={block} />
    default: return <p className="text">{block.text}</p>
  }
}

export default function EntryView({ entry, canEdit, isFav, favCount, onToggleFav, onBack, onEdit, onDelete }) {
  const cover = useObjectURL(entry.cover)
  return (
    <article className="entry-view">
      <div className="toolbar">
        <button className="ghost" onClick={onBack}>← Volver</button>
        <div className="actions">
          <FavButton active={isFav} count={favCount} onToggle={onToggleFav} />
          {canEdit && (
            <>
              <button className="ghost" onClick={onEdit}>Editar</button>
              <button className="danger" onClick={onDelete}>Eliminar</button>
            </>
          )}
        </div>
      </div>

      {cover && <img className="cover" src={cover} alt="" />}
      <div className="meta">
        {entry.category && <span className="chip">{entry.category}</span>}
        {entry.date && <span>{entry.date}</span>}
      </div>
      <h1>{entry.title || 'Sin título'}</h1>
      {entry.tags?.length > 0 && (
        <div className="tags">{entry.tags.map((t) => <span key={t}>#{t}</span>)}</div>
      )}

      <div className="content">
        {entry.blocks?.map((b) => <Block key={b.id} block={b} />)}
      </div>

      <footer className="updated">
        Última edición: {new Date(entry.updatedAt).toLocaleString('es')}
      </footer>
    </article>
  )
}
