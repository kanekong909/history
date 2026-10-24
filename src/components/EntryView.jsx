import { useMemo } from 'react'
import { blockText } from '../richText.js'
import FavButton from './FavButton.jsx'
import Block from './EntryBlocks.jsx'
import EntryHeader from './EntryHeader.jsx'

const readingMinutes = (entry) => {
  const words = (entry.blocks || []).map(blockText).join(' ').split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

export default function EntryView({ entry, canEdit, isFav, favCount, onToggleFav, onBack, onEdit, onDelete }) {
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

      <EntryHeader entry={entry} minutes={minutes} />

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
