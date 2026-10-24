import { useMemo, useState } from 'react'
import { blockText } from '../richText.js'
import FavButton from './FavButton.jsx'
import Block from './EntryBlocks.jsx'
import EntryHeader from './EntryHeader.jsx'
import { LightboxProvider, collectImages } from './Lightbox.jsx'

const readingMinutes = (entry) => {
  const words = (entry.blocks || []).map(blockText).join(' ').split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

export default function EntryView({ entry, canEdit, isFav, favCount, onToggleFav, onBack, onEdit, onDelete }) {
  const minutes = useMemo(() => readingMinutes(entry), [entry])
  const photos = useMemo(() => collectImages(entry), [entry])
  const [copied, setCopied] = useState(false)

  // En el celular abre el menú de compartir; en el computador copia el enlace.
  const share = async () => {
    const url = `${location.origin}/historia/${encodeURIComponent(entry.id)}`
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      try {
        await navigator.share({ title: entry.title || 'Mi Archivo', url })
        return
      } catch (e) {
        if (e.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      window.prompt('Copia este enlace:', url)
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2200)
  }

  return (
    <article className="entry-view">
      <div className="toolbar">
        <button className="ghost" onClick={onBack}>← Volver</button>
        <div className="actions">
          <button type="button" className={`ghost share-btn ${copied ? 'copied' : ''}`} onClick={share} aria-live="polite">
            {copied ? '✓ Enlace copiado' : 'Compartir'}
          </button>
          <FavButton active={isFav} count={favCount} onToggle={onToggleFav} />
          {canEdit && (
            <>
              <button className="ghost" onClick={onEdit}>Editar</button>
              <button className="danger" onClick={onDelete}>Eliminar</button>
            </>
          )}
        </div>
      </div>

      <LightboxProvider items={photos}>
        <EntryHeader entry={entry} minutes={minutes} />

        <div className="content">
          {entry.blocks?.map((b) => <Block key={b.id} block={b} />)}
        </div>
      </LightboxProvider>

      <footer className="entry-footer">
        {entry.tags?.length > 0 && (
          <div className="tags">{entry.tags.map((t) => <span key={t}>#{t}</span>)}</div>
        )}
        <p>Última edición: {new Date(entry.updatedAt).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </footer>
    </article>
  )
}
