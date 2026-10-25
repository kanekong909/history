import { useObjectURL } from '../useObjectURL.js'
import FavButton from './FavButton.jsx'
import { blockText } from '../richText.js'
import { coverOf } from '../imageStyles.js'
import { cdn } from '../cloudinary.js'

// Primera imagen de la entrada: portada, imagen suelta o primera foto de un carrusel.
export function firstImage(entry) {
  return entry.cover
    || entry.blocks?.find((b) => b.type === 'image' && b.image)?.image
    || entry.blocks?.find((b) => b.type === 'carousel' && b.slides?.[0]?.image)?.slides[0].image
}

export function excerpt(entry, max = 160) {
  const block = entry.blocks?.find((b) => b.type === 'text' && blockText(b).trim())
  const text = block ? blockText(block).replace(/\s+/g, ' ').trim() : ''
  return text.length > max ? text.slice(0, max).replace(/\s\S*$/, '') + '…' : text
}

export function readingMinutes(entry) {
  const words = (entry.blocks || []).map(blockText).join(' ').split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

export default function EntryCard({ entry, isFav, favCount, onToggleFav, onOpen }) {
  const img = useObjectURL(firstImage(entry))
  return (
    <article className="card" onClick={(ev) => onOpen(ev.currentTarget.querySelector('.card-media img'))}>
      <div className="card-media">
        {img
          ? <img src={cdn(img, 800)} alt="" loading="lazy" style={entry.cover ? { objectPosition: coverOf(entry).position } : undefined} />
          : <div className="card-placeholder">📝</div>}
        <FavButton active={isFav} count={favCount} onToggle={onToggleFav} />
      </div>
      <div className="card-body">
        <div className="meta">
          {entry.category && <span className="kicker">{entry.category}</span>}
          {entry.date && <span>{entry.date}</span>}
          {entry.authorName && <span>Por {entry.authorName}</span>}
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
