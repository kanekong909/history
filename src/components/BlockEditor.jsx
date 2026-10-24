import { useObjectURL } from '../useObjectURL.js'
import { textToHtml } from '../richText.js'
import RichTextEditor from './RichTextEditor.jsx'
import { IMAGE_STYLES, IMAGE_SIZES, FADE_SIDES, FADE_SIZES, styleInfo } from '../imageStyles.js'

// `hidden`: tipos antiguos que se siguen mostrando pero ya no se ofrecen
// (los títulos ahora se ponen dentro del texto).
export const BLOCK_TYPES = [
  { type: 'text', label: 'Texto' },
  { type: 'image', label: 'Imagen' },
  { type: 'quote', label: 'Cita destacada' },
  { type: 'heading', label: 'Subtítulo', hidden: true },
]

export function ImagePicker({ blob, onChange, label = 'Elegir imagen' }) {
  const url = useObjectURL(blob)
  return (
    <div className="image-picker">
      {url && <img src={url} alt="" />}
      <label className="file-btn">
        {url ? 'Cambiar imagen' : label}
        <input type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && onChange(e.target.files[0])} />
      </label>
      {url && <button type="button" className="ghost small" onClick={() => onChange(null)}>Quitar</button>}
    </div>
  )
}

// `onDone`: cuando se edita dentro de la vista previa, muestra el botón «Listo» para volver a la vista.
export default function BlockEditor({ block, onChange, onRemove, onMove, isFirst, isLast, onDone }) {
  const set = (patch) => onChange({ ...block, ...patch })
  return (
    <div id={`block-${block.id}`} className={`block-editor block-${block.type}`}>
      <div className="block-head">
        <span>{BLOCK_TYPES.find((t) => t.type === block.type)?.label}</span>
        {block.type === 'text' && (
          <label className="dropcap-toggle" title="Agranda la primera letra del bloque">
            <input type="checkbox" checked={Boolean(block.dropCap)} onChange={(e) => set({ dropCap: e.target.checked })} />
            Letra capital
          </label>
        )}
        <div>
          {onDone && <button type="button" className="small done-btn" onClick={onDone}>✓ Listo</button>}
          <button type="button" className="ghost small" disabled={isFirst} onClick={() => onMove(-1)}>↑</button>
          <button type="button" className="ghost small" disabled={isLast} onClick={() => onMove(1)}>↓</button>
          <button type="button" className="ghost small" onClick={onRemove}>✕</button>
        </div>
      </div>
      {block.type === 'image' ? (
        <>
          <ImagePicker blob={block.image} onChange={(image) => set({ image })} />
          <input className="caption-input" placeholder="Pie de foto (opcional)" value={block.caption} onChange={(e) => set({ caption: e.target.value })} />
          <div className="image-options">
            <label>Estilo
              <select value={styleInfo(block).value} onChange={(e) => set({ style: e.target.value })}>
                {IMAGE_STYLES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
            {!styleInfo(block).float && (
              <label>Tamaño
                <select value={block.size || 'normal'} onChange={(e) => set({ size: e.target.value })}>
                  {IMAGE_SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </label>
            )}
          </div>
          {styleInfo(block).fade && (
            <div className="fade-options">
              <span>Degradado</span>
              {FADE_SIDES.map((side) => {
                const on = (block.fade || []).includes(side.value)
                return (
                  <button
                    type="button" key={side.value} aria-pressed={on}
                    className={`chip-btn ${on ? 'active' : ''}`}
                    onClick={() => set({ fade: on ? block.fade.filter((x) => x !== side.value) : [...(block.fade || []), side.value] })}
                  >
                    {side.label}
                  </button>
                )
              })}
              {(block.fade || []).length > 0 && (
                <select value={block.fadeSize || 'medium'} onChange={(e) => set({ fadeSize: e.target.value })} title="Intensidad del degradado">
                  {FADE_SIZES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              )}
            </div>
          )}
        </>
      ) : block.type === 'heading' ? (
        <input placeholder="Subtítulo" value={block.text} onChange={(e) => set({ text: e.target.value })} />
      ) : block.type === 'quote' ? (
        <>
          <textarea className="quote-input" rows={2} placeholder="Una frase que quieras destacar…" value={block.text} onChange={(e) => set({ text: e.target.value })} />
          <input placeholder="Autor o fuente (opcional)" value={block.caption || ''} onChange={(e) => set({ caption: e.target.value })} />
        </>
      ) : (
        <RichTextEditor
          value={block.html || textToHtml(block.text)}
          onChange={(html) => set({ html, text: '' })}
        />
      )}
    </div>
  )
}

