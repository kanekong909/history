import { useObjectURL } from '../useObjectURL.js'
import { coverOf, fadeMask } from '../imageStyles.js'
import { useLightbox } from './Lightbox.jsx'

// Cabecera de la entrada: categoría, título, fecha y portada, según el diseño elegido.
// La usan la lectura y la vista previa del editor.
export default function EntryHeader({ entry, minutes }) {
  const url = useObjectURL(entry.cover)
  const cs = coverOf(entry)
  const lb = useLightbox()

  const text = (
    <header className="entry-header">
      {entry.category && <p className="kicker">{entry.category}</p>}
      <h1>{entry.title || 'Sin título'}</h1>
      <p className="byline">
        {entry.date && <span>{entry.date}</span>}
        {minutes && <span>{minutes} min de lectura</span>}
      </p>
    </header>
  )

  if (!url) return text

  const img = (
    <img
      className={`cover-img ${lb ? 'zoomable' : ''}`}
      src={url}
      alt=""
      onClick={() => lb?.open(url)}
      style={{ objectPosition: cs.position, ...fadeMask(cs.fade, cs.fadeSize) }}
    />
  )

  switch (cs.layout) {
    case 'first':
      return <>{<div className={`cover-wrap h-${cs.height}`}>{img}</div>}{text}</>
    case 'full':
      return <>{text}<div className={`cover-wrap full h-${cs.height}`}>{img}</div></>
    case 'hero':
      return (
        <div className={`cover-hero h-${cs.height}`}>
          {img}
          <div className="shade" />
          {text}
        </div>
      )
    case 'split':
      return <div className={`cover-split h-${cs.height}`}>{img}{text}</div>
    default:
      return <>{text}<div className={`cover-wrap h-${cs.height}`}>{img}</div></>
  }
}
