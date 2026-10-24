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
  const sides = block.fade || []
  if (!sides.length || !styleInfo(block).fade) return undefined
  const pct = (FADE_SIZES.find((f) => f.value === block.fadeSize) || FADE_SIZES[1]).pct
  const layers = sides.map((s) => `linear-gradient(${DIRECTION[s]}, transparent 0%, #000 ${pct}%)`).join(', ')
  return {
    WebkitMaskImage: layers,
    maskImage: layers,
    WebkitMaskComposite: 'source-in', // varias capas: se multiplican, así las esquinas se funden bien
    maskComposite: 'intersect',
  }
}
