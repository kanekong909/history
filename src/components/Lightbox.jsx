import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const Ctx = createContext(null)
// Devuelve { open(src) } dentro de una entrada; fuera de ella (p. ej. en la vista previa) devuelve null.
export const useLightbox = () => useContext(Ctx)

// Todas las fotos de una entrada, en orden: portada, imágenes y fotos de carruseles.
export function collectImages(entry) {
  const out = []
  if (typeof entry.cover === 'string') out.push({ src: entry.cover, caption: '' })
  for (const b of entry.blocks || []) {
    if (b.type === 'image' && typeof b.image === 'string') out.push({ src: b.image, caption: b.caption || '' })
    if (b.type === 'carousel') {
      for (const s of b.slides || []) if (typeof s.image === 'string') out.push({ src: s.image, caption: s.caption || '' })
    }
  }
  return out
}

export function LightboxProvider({ items, children }) {
  const [index, setIndex] = useState(null)
  const open = useCallback((src) => {
    const i = items.findIndex((it) => it.src === src)
    if (i >= 0) setIndex(i)
  }, [items])
  const value = useMemo(() => ({ open }), [open])

  return (
    <Ctx.Provider value={value}>
      {children}
      {index !== null && createPortal(
        <Viewer items={items} index={index} setIndex={setIndex} onClose={() => setIndex(null)} />,
        document.body,
      )}
    </Ctx.Provider>
  )
}

const MAX_ZOOM = 6
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

function Viewer({ items, index, setIndex, onClose }) {
  const [t, setT] = useState({ s: 1, x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const stage = useRef(null)
  const imgRef = useRef(null)
  const pointers = useRef(new Map())
  const gesture = useRef(null)
  const lastTap = useRef({ time: 0, x: 0, y: 0 })
  const item = items[index]

  const reset = () => setT({ s: 1, x: 0, y: 0 })
  const go = (d) => {
    const n = index + d
    if (n >= 0 && n < items.length) { setIndex(n); reset() }
  }

  // Zoom alrededor de un punto (px, py medidos desde el centro de la pantalla).
  const zoomAt = (factor, px = 0, py = 0) =>
    setT(({ s, x, y }) => {
      const ns = clamp(s * factor, 1, MAX_ZOOM)
      if (ns === 1) return { s: 1, x: 0, y: 0 }
      const k = ns / s
      return { s: ns, x: px - (px - x) * k, y: py - (py - y) * k }
    })

  const center = () => {
    const r = stage.current.getBoundingClientRect()
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 }
  }

  // Siempre la versión más reciente para los listeners nativos
  const live = useRef({})
  live.current = { go, zoomAt, onClose, center }

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      const { go, zoomAt, onClose } = live.current
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === '+' || e.key === '=') zoomAt(1.5)
      else if (e.key === '-') zoomAt(1 / 1.5)
      else if (e.key === '0') setT({ s: 1, x: 0, y: 0 })
    }
    const onWheel = (e) => {
      e.preventDefault()
      const { zoomAt, center } = live.current
      const { cx, cy } = center()
      zoomAt(Math.exp(-e.deltaY * 0.0018), e.clientX - cx, e.clientY - cy)
    }
    window.addEventListener('keydown', onKey)
    const el = stage.current
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
      el.removeEventListener('wheel', onWheel)
    }
  }, [])

  const onPointerDown = (e) => {
    try { stage.current.setPointerCapture(e.pointerId) } catch { /* puntero ya liberado */ }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    setDragging(true)
    if (pointers.current.size === 1) {
      gesture.current = { type: 'pan', sx: e.clientX, sy: e.clientY, ox: t.x, oy: t.y, moved: false }
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      gesture.current = { type: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), s0: t.s, moved: true }
    }
  }

  const onPointerMove = (e) => {
    const g = gesture.current
    if (!g || !pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (g.type === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      const { cx, cy } = center()
      const ns = clamp(g.s0 * (d / g.d0), 1, MAX_ZOOM)
      const mx = (a.x + b.x) / 2 - cx, my = (a.y + b.y) / 2 - cy
      setT((cur) => {
        if (ns === 1) return { s: 1, x: 0, y: 0 }
        const k = ns / cur.s
        return { s: ns, x: mx - (mx - cur.x) * k, y: my - (my - cur.y) * k }
      })
    } else if (g.type === 'pan') {
      const dx = e.clientX - g.sx, dy = e.clientY - g.sy
      if (Math.hypot(dx, dy) > 6) g.moved = true
      if (t.s > 1) setT({ s: t.s, x: g.ox + dx, y: g.oy + dy })
    }
  }

  const onPointerUp = (e) => {
    const g = gesture.current
    pointers.current.delete(e.pointerId)
    if (pointers.current.size > 0) return
    setDragging(false)
    gesture.current = null
    if (!g || g.type !== 'pan') return

    const dx = e.clientX - g.sx, dy = e.clientY - g.sy
    if (g.moved) {
      // Con la foto sin ampliar, arrastrar hacia un lado pasa a la anterior o a la siguiente.
      if (t.s === 1 && Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1)
      return
    }
    // Toque o clic sin arrastrar
    const r = imgRef.current.getBoundingClientRect()
    const onImage = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
    if (!onImage) return onClose()
    const now = Date.now(), prev = lastTap.current
    if (now - prev.time < 320 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 30) {
      const { cx, cy } = center()
      t.s > 1 ? reset() : zoomAt(2.5, e.clientX - cx, e.clientY - cy) // doble clic / doble toque
      lastTap.current = { time: 0, x: 0, y: 0 }
    } else {
      lastTap.current = { time: now, x: e.clientX, y: e.clientY }
    }
  }

  if (!item) return null
  const zoomed = t.s > 1

  return (
    <div className="lb" role="dialog" aria-modal="true" aria-label="Visor de fotos">
      <div
        ref={stage}
        className={`lb-stage ${zoomed ? 'zoomed' : ''} ${dragging ? 'dragging' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img
          ref={imgRef}
          key={item.src}
          className="lb-img"
          src={item.src}
          alt={item.caption || ''}
          draggable={false}
          style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.s})`, transition: dragging ? 'none' : 'transform .18s ease' }}
        />
      </div>

      <div className="lb-top">
        {items.length > 1 && <span className="lb-count">{index + 1} / {items.length}</span>}
        <span className="lb-spacer" />
        <button type="button" aria-label="Alejar" onClick={() => zoomAt(1 / 1.5)} disabled={!zoomed}>−</button>
        <button type="button" aria-label="Restablecer zoom" onClick={reset} disabled={!zoomed}>{Math.round(t.s * 100)}%</button>
        <button type="button" aria-label="Acercar" onClick={() => zoomAt(1.5)} disabled={t.s >= MAX_ZOOM}>+</button>
        <button type="button" aria-label="Cerrar" onClick={onClose}>✕</button>
      </div>

      {items.length > 1 && index > 0 && <button type="button" className="lb-nav prev" aria-label="Anterior" onClick={() => go(-1)}>‹</button>}
      {items.length > 1 && index < items.length - 1 && <button type="button" className="lb-nav next" aria-label="Siguiente" onClick={() => go(1)}>›</button>}
      {item.caption && !zoomed && <p className="lb-caption">{item.caption}</p>}
    </div>
  )
}
