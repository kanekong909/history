import { useRef, useState } from 'react'
import { useObjectURL } from '../useObjectURL.js'
import { sanitize } from '../richText.js'
import { fadeStyle, styleInfo } from '../imageStyles.js'
import { useLightbox } from './Lightbox.jsx'

function ImageBlock({ block }) {
  const url = useObjectURL(block.image)
  const lb = useLightbox()
  if (!url) return <div className="image-missing">Imagen sin elegir</div>
  return (
    <figure className={`figure-${block.size || 'normal'} style-${styleInfo(block).value}`}>
      <img
        src={url} alt={block.caption || ''} loading="lazy" style={fadeStyle(block)}
        className={lb ? 'zoomable' : undefined} onClick={() => lb?.open(url)}
      />
      {block.caption && <figcaption>{block.caption}</figcaption>}
    </figure>
  )
}

function Slide({ slide }) {
  const url = useObjectURL(slide.image)
  const lb = useLightbox()
  return (
    <figure className="carousel-slide">
      {url && <img src={url} alt={slide.caption || ''} loading="lazy" draggable={false} className={lb ? 'zoomable' : undefined} onClick={() => lb?.open(url)} />}
      {slide.caption && <figcaption>{slide.caption}</figcaption>}
    </figure>
  )
}

// Varias fotos en un solo bloque: se desliza con el dedo o con las flechas.
function Carousel({ block }) {
  const slides = (block.slides || []).filter((s) => s.image)
  const track = useRef(null)
  const [i, setI] = useState(0)
  if (!slides.length) return <div className="image-missing">Carrusel sin fotos</div>

  const goTo = (n) => {
    const el = track.current
    const k = Math.max(0, Math.min(slides.length - 1, n))
    el.scrollTo({ left: k * el.clientWidth, behavior: 'smooth' })
  }
  const onScroll = (e) => setI(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))
  const onKey = (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(i - 1) }
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(i + 1) }
  }

  return (
    <div
      className={`carousel size-${block.size || 'normal'} ratio-${(block.ratio || '16/9').replace('/', '-')}`}
      role="region" aria-roledescription="carrusel" aria-label="Carrusel de fotos"
      tabIndex={0} onKeyDown={onKey}
    >
      <div className="carousel-track" ref={track} onScroll={onScroll}>
        {slides.map((s) => <Slide key={s.id} slide={s} />)}
      </div>
      {slides.length > 1 && (
        <>
          <button type="button" className="carousel-nav prev" aria-label="Foto anterior" disabled={i === 0} onClick={() => goTo(i - 1)}>‹</button>
          <button type="button" className="carousel-nav next" aria-label="Foto siguiente" disabled={i === slides.length - 1} onClick={() => goTo(i + 1)}>›</button>
          <div className="carousel-dots">
            {slides.map((s, n) => (
              <button type="button" key={s.id} aria-label={`Ir a la foto ${n + 1}`} aria-current={n === i} className={n === i ? 'on' : ''} onClick={() => goTo(n)} />
            ))}
          </div>
          <span className="carousel-count">{i + 1} / {slides.length}</span>
        </>
      )}
    </div>
  )
}

// Un bloque tal como lo ve el lector. Lo usan la vista de lectura y la vista previa del editor.
export default function Block({ block }) {
  switch (block.type) {
    case 'heading':
      return <h2>{block.text}</h2>
    case 'quote':
      return (
        <blockquote className="pull-quote">
          <p>{block.text || '…'}</p>
          {block.caption && <cite>— {block.caption}</cite>}
        </blockquote>
      )
    case 'image':
      return <ImageBlock block={block} />
    case 'carousel':
      return <Carousel block={block} />
    default:
      return block.html
        ? <div className={`prose ${block.dropCap ? 'dropcap' : ''}`} dangerouslySetInnerHTML={{ __html: sanitize(block.html) }} />
        : <div className={`prose ${block.dropCap ? 'dropcap' : ''}`}><p className="text">{block.text}</p></div>
  }
}
