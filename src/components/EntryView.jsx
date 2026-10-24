import { useMemo } from 'react'
import { useObjectURL } from '../useObjectURL.js'
import { sanitize, blockText } from '../richText.js'
import FavButton from './FavButton.jsx'

function ImageBlock({ block }) {
  const url = useObjectURL(block.image)
  if (!url) return null
  return (
    <figure className={`figure-${block.size || 'normal'}`}>
      <img src={url} alt={block.caption || ''} loading="lazy" />
      {block.caption && <figcaption>{block.caption}</figcaption>}
    </figure>
  )
}

function Block({ block }) {
  switch (block.type) {
    case 'heading':
      return <h2>{block.text}</h2>
    case 'quote':
      return (
        <blockquote className="pull-quote">
          <p>{block.text}</p>
          {block.caption && <cite>— {block.caption}</cite>}
        </blockquote>
      )
    case 'image':
      return <ImageBlock block={block} />
    default:
      return block.html
        ? <div className="prose" dangerouslySetInnerHTML={{ __html: sanitize(block.html) }} />
        : <div className="prose"><p className="text">{block.text}</p></div>
  }
}

const readingMinutes = (entry) => {
  const words = (entry.blocks || []).map(blockText).join(' ').split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

export default function EntryView({ entry, canEdit, isFav, favCount, onToggleFav, onBack, onEdit, onDelete }) {
  const cover = useObjectURL(entry.cover)
  const minutes = useMemo(() => readingMinutes(entry), [entry])

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

      <header className="entry-header">
        {entry.category && <p className="kicker">{entry.category}</p>}
        <h1>{entry.title || 'Sin título'}</h1>
        <p className="byline">
          {entry.date && <span>{entry.date}</span>}
          <span>{minutes} min de lectura</span>
        </p>
      </header>

      {cover && <img className="cover" src={cover} alt="" />}

      <div className="content">
        {entry.blocks?.map((b) => <Block key={b.id} block={b} />)}
      </div>

      <footer className="entry-footer">
        {entry.tags?.length > 0 && (
          <div className="tags">{entry.tags.map((t) => <span key={t}>#{t}</span>)}</div>
        )}
        <p>Última edición: {new Date(entry.updatedAt).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </footer>
    </article>
  )
}
