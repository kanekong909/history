import { useEffect, useRef, useState } from 'react'
import FavButton from './FavButton.jsx'
import Icon from './Icon.jsx'
import { coverOf } from '../imageStyles.js'
import { cdn } from '../cloudinary.js'
import { excerpt, readingMinutes } from './EntryCard.jsx'

const INTERVAL = 6500 // ms que dura cada historia en el banner

// Banner del inicio: las historias destacadas rotan solas, con flechas, puntos y deslizando el dedo.
export default function HomeBanner({ items, favs, counts, onOpen, onToggleFav }) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const reduce = useRef(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches).current
  const drag = useRef({ x: 0, y: 0, moved: false })
  const n = items.length
  const idx = Math.min(i, n - 1)

  const go = (k) => setI(((k % n) + n) % n)

  // Rotación automática: se detiene al pasar el ratón, al enfocar o con «reducir animaciones».
  useEffect(() => {
    if (n < 2 || paused || reduce) return
    const t = setTimeout(() => setI((x) => (x + 1) % n), INTERVAL)
    return () => clearTimeout(t)
  }, [i, n, paused, reduce])

  if (!n) return null

  const onPointerDown = (e) => { drag.current = { x: e.clientX, y: e.clientY, moved: false } }
  const onPointerUp = (e) => {
    const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      drag.current.moved = true
      go(idx + (dx < 0 ? 1 : -1))
    }
  }
  const onKeyDown = (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1) }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1) }
  }

  return (
    <section
      className="hb"
      role="region" aria-roledescription="carrusel" aria-label="Historias destacadas"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
      onPointerDown={onPointerDown} onPointerUp={onPointerUp}
    >
      {items.map((e, k) => {
        const active = k === idx
        const pos = coverOf(e).position
        return (
          <article
            key={e.id}
            className={`hb-slide ${active ? 'active' : ''}`}
            aria-hidden={!active}
            {...(!active && { inert: '' })}
            onClick={(ev) => { if (!drag.current.moved) onOpen(e.id, ev.currentTarget.querySelector('.hb-img')); drag.current.moved = false }}
          >
            {typeof e.cover === 'string'
              ? <img className="hb-img" src={cdn(e.cover, 1600)} alt="" style={{ objectPosition: pos }} />
              : <div className="hb-img hb-fallback" />}
            <div className="hb-shade" />
            <div className="hb-body">
              <p className="hb-kicker">
                {e.category || 'Historia'}{e.date ? ` · ${e.date}` : ''}
              </p>
              <h2>{e.title || 'Sin título'}</h2>
              {excerpt(e, 130) && <p className="hb-excerpt">{excerpt(e, 130)}</p>}
              <div className="hb-actions">
                <button type="button" className="hb-cta" onClick={(ev) => { ev.stopPropagation(); onOpen(e.id, ev.currentTarget.closest('.hb-slide').querySelector('.hb-img')) }}>
                  Leer historia <Icon name="arrow" size={16} />
                </button>
                <span className="on-dark" onClick={(ev) => ev.stopPropagation()}>
                  <FavButton active={favs.has(e.id)} count={counts[e.id]} onToggle={() => onToggleFav(e.id)} />
                </span>
                <span className="hb-time"><Icon name="clock" size={15} /> {readingMinutes(e)} min</span>
              </div>
            </div>
          </article>
        )
      })}

      {n > 1 && (
        <>
          <button type="button" className="hb-arrow prev" aria-label="Historia anterior" onClick={() => go(idx - 1)}><Icon name="left" size={22} /></button>
          <button type="button" className="hb-arrow next" aria-label="Historia siguiente" onClick={() => go(idx + 1)}><Icon name="right" size={22} /></button>
          <div className="hb-dots">
            {items.map((e, k) => (
              <button
                type="button" key={e.id} aria-label={`Ir a «${e.title}»`} aria-current={k === idx}
                className={`hb-dot ${k === idx ? 'on' : ''}`} onClick={() => go(k)}
              >
                {/* se reinicia al cambiar de historia o al reanudar tras una pausa */}
                {k === idx && <span key={`${idx}-${paused}`} className={`fill ${paused || reduce ? 'still' : ''}`} style={{ animationDuration: `${INTERVAL}ms` }} />}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
