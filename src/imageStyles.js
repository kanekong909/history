// Opciones de presentación de las imágenes. Se guardan dentro del bloque:
// { style, size, fade: ['top', ...], fadeSize }
export const IMAGE_STYLES = [
  { value: 'simple', label: 'Simple', fade: true },
  { value: 'shadow', label: 'Con sombra' },
  { value: 'polaroid', label: 'Polaroid' },
  { value: 'frame', label: 'Marco clásico' },
  { value: 'circle', label: 'Circular' },
  { value: 'overlay', label: 'Pie superpuesto', fade: true },
  { value: 'float-left', label: 'Flotante a la izquierda', fade: true, float: true },
  { value: 'float-right', label: 'Flotante a la derecha', fade: true, float: true },
]

export const IMAGE_SIZES = [
  { value: 'small', label: 'Pequeña' },
  { value: 'normal', label: 'Normal' },
  { value: 'wide', label: 'Ancha' },
  { value: 'full', label: 'Todo el ancho' },
]

export const FADE_SIDES = [
  { value: 'top', label: 'Arriba' },
  { value: 'right', label: 'Derecha' },
  { value: 'bottom', label: 'Abajo' },
  { value: 'left', label: 'Izquierda' },
]

export const FADE_SIZES = [
  { value: 'soft', label: 'Suave', pct: 22 },
  { value: 'medium', label: 'Media', pct: 38 },
  { value: 'strong', label: 'Fuerte', pct: 55 },
]

export const styleInfo = (block) => IMAGE_STYLES.find((s) => s.value === block.style) || IMAGE_STYLES[0]

const DIRECTION = { top: 'to bottom', bottom: 'to top', left: 'to right', right: 'to left' }

// Degradado: la imagen se vuelve transparente hacia los lados elegidos y se funde con el fondo de la página.
export function fadeStyle(block) {
  if (!styleInfo(block).fade) return undefined
  return fadeMask(block.fade, block.fadeSize)
}

export function fadeMask(sides = [], sizeKey) {
  if (!sides.length) return undefined
  const pct = (FADE_SIZES.find((f) => f.value === sizeKey) || FADE_SIZES[1]).pct
  const layers = sides.map((s) => `linear-gradient(${DIRECTION[s]}, transparent 0%, #000 ${pct}%)`).join(', ')
  return {
    WebkitMaskImage: layers,
    maskImage: layers,
    WebkitMaskComposite: 'source-in', // varias capas: se multiplican, así las esquinas se funden bien
    maskComposite: 'intersect',
  }
}

// ---------- Portada ----------
export const COVER_LAYOUTS = [
  { value: 'classic', label: 'Clásica: título arriba, imagen abajo' },
  { value: 'first', label: 'Imagen arriba, título abajo' },
  { value: 'full', label: 'Todo el ancho' },
  { value: 'hero', label: 'Título sobre la imagen' },
  { value: 'split', label: 'Imagen y título lado a lado' },
]

export const COVER_HEIGHTS = [
  { value: 'auto', label: 'Natural' },
  { value: 'short', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'tall', label: 'Alta' },
]

export const COVER_POSITIONS = [
  { value: 'center', label: 'Centro' },
  { value: 'top', label: 'Parte de arriba' },
  { value: 'bottom', label: 'Parte de abajo' },
  { value: 'left', label: 'Parte izquierda' },
  { value: 'right', label: 'Parte derecha' },
]

export const DEFAULT_COVER = { layout: 'classic', height: 'auto', position: 'center', fade: [], fadeSize: 'medium' }

export const coverOf = (entry) => ({ ...DEFAULT_COVER, ...(entry?.coverStyle || {}) })
