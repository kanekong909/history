import { flushSync } from 'react-dom'

// Transición entre pantallas con la API nativa de «View Transitions» (Chrome, Edge, Safari reciente).
// En navegadores que no la tienen se usa una animación de entrada con CSS (clase `no-vt` en <html>).
const supported = typeof document !== 'undefined' && 'startViewTransition' in document
if (typeof document !== 'undefined' && !supported) document.documentElement.classList.add('no-vt')

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

// Si la transición no llega a arrancar (pestaña en segundo plano, por ejemplo), el cambio se aplica igual.
const FALLBACK_MS = 700

// `update` cambia el estado de React. `hero` (opcional) es la imagen pulsada: viaja hasta la portada de la historia.
export function transition(update, hero) {
  if (!supported || reduced()) {
    update()
    return
  }
  let applied = false
  const apply = () => {
    if (applied) return
    applied = true
    flushSync(update)
  }
  const clearHero = () => { if (hero) hero.style.viewTransitionName = '' }

  if (hero) hero.style.viewTransitionName = 'story-hero'
  try {
    const t = document.startViewTransition(apply)
    t.ready.catch(() => {})
    t.updateCallbackDone.catch(() => {})
    t.finished.catch(() => {}).finally(clearHero)
    setTimeout(() => { apply(); clearHero() }, FALLBACK_MS)
  } catch {
    clearHero()
    apply()
  }
}
