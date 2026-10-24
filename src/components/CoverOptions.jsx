import { COVER_LAYOUTS, COVER_HEIGHTS, COVER_POSITIONS, FADE_SIDES, FADE_SIZES, DEFAULT_COVER } from '../imageStyles.js'

// Opciones de diseño de la portada. `value` es el coverStyle de la entrada (puede ser nulo).
export default function CoverOptions({ value, onChange }) {
  const cs = { ...DEFAULT_COVER, ...(value || {}) }
  const set = (patch) => onChange({ ...cs, ...patch })
  const toggleSide = (side) =>
    set({ fade: cs.fade.includes(side) ? cs.fade.filter((x) => x !== side) : [...cs.fade, side] })

  return (
    <div className="cover-options">
      <label>Diseño de la portada
        <select value={cs.layout} onChange={(e) => set({ layout: e.target.value })}>
          {COVER_LAYOUTS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
      </label>
      <div className="image-options">
        <label>Altura
          <select value={cs.height} onChange={(e) => set({ height: e.target.value })}>
            {COVER_HEIGHTS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
          </select>
        </label>
        <label>Enfoque del recorte
          <select value={cs.position} onChange={(e) => set({ position: e.target.value })}>
            {COVER_POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </label>
      </div>
      <div className="fade-options">
        <span>Degradado</span>
        {FADE_SIDES.map((side) => {
          const on = cs.fade.includes(side.value)
          return (
            <button type="button" key={side.value} aria-pressed={on} className={`chip-btn ${on ? 'active' : ''}`} onClick={() => toggleSide(side.value)}>
              {side.label}
            </button>
          )
        })}
        {cs.fade.length > 0 && (
          <select value={cs.fadeSize} onChange={(e) => set({ fadeSize: e.target.value })} title="Intensidad del degradado">
            {FADE_SIZES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        )}
      </div>
      <p className="hint">El resultado se ve en la pestaña «Vista previa». «Enfoque» elige qué parte de la foto se conserva al recortarla.</p>
    </div>
  )
}
