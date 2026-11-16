import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { sanitize } from '../richText.js'
import { useKnowledge } from '../knowledge.jsx'
import { cdn } from '../cloudinary.js'
import { asIds, isEmpty, formatNumber } from '../recordUtils.js'

// Texto corto de un valor de ficha para la tarjeta.
function brief(field, value, k) {
  if (field.type === 'number') return formatNumber(value, field.unit)
  if (field.type === 'relation') return asIds(value).map((id) => k.recordById.get(id)?.title).filter(Boolean).join(', ')
  if (field.type === 'url') { try { return new URL(value).hostname.replace(/^www\./, '') } catch { return String(value) } }
  return String(value)
}

// Tarjeta que aparece al pasar el cursor (o tocar) una mención.
function MentionCard({ record, rect, onEnter, onLeave, onOpen }) {
  const k = useKnowledge()
  const col = k.collectionById.get(record.collectionId)
  const facts = (col?.fields || []).filter((f) => !isEmpty(record.data?.[f.id])).slice(0, 3)
    .map((f) => ({ label: f.label, value: brief(f, record.data[f.id], k) })).filter((x) => x.value)
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - 328))
  const style = rect.bottom + 250 > window.innerHeight && rect.top > 260
    ? { left, bottom: window.innerHeight - rect.top + 8 }
    : { left, top: rect.bottom + 8 }

  return createPortal(
    <div className="mention-card" style={style} onMouseEnter={onEnter} onMouseLeave={onLeave} role="dialog" aria-label={record.title}>
      {record.image && <img src={cdn(record.image, 640)} alt="" />}
      <div className="mc-body">
        <span className="kicker">{col?.name}</span>
        <strong>{record.title}</strong>
        {record.summary && <p>{record.summary.length > 120 ? `${record.summary.slice(0, 120).replace(/\s\S*$/, '')}…` : record.summary}</p>}
        {facts.length > 0 && (
          <dl>{facts.map((f) => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>
        )}
        <button type="button" className="link" onClick={onOpen}>Ver ficha completa →</button>
      </div>
    </div>,
    document.body,
  )
}

// Texto enriquecido de una historia, con sus menciones «@» convertidas en etiquetas que abren una tarjeta
// (con el cursor) o llevan a la ficha (al hacer clic o tocar).
export default function RichProse({ html, dropCap }) {
  const k = useKnowledge()
  const ref = useRef(null)
  const timer = useRef(null)
  const [card, setCard] = useState(null) // { record, rect }
  const hover = useRef(typeof matchMedia === 'function' && matchMedia('(hover: hover)').matches).current

  // Pone al día el nombre de cada mención con el de la ficha actual, y marca las fichas que ya no existen.
  useEffect(() => {
    if (!k?.loaded || !ref.current) return
    ref.current.querySelectorAll('span[data-type="mention"]').forEach((el) => {
      const rec = k.recordById.get(el.dataset.id)
      if (rec) { el.textContent = rec.title; el.classList.remove('missing') } else el.classList.add('missing')
    })
  }, [k?.loaded, k?.records, html])

  useEffect(() => () => clearTimeout(timer.current), [])

  const mention = (e) => e.target.closest?.('span[data-type="mention"]')
  const recordOf = (el) => k?.recordById.get(el?.dataset.id)
  const later = (fn, ms) => { clearTimeout(timer.current); timer.current = setTimeout(fn, ms) }

  const onOver = (e) => {
    const el = hover && mention(e)
    const rec = el && recordOf(el)
    if (rec) later(() => setCard({ record: rec, rect: el.getBoundingClientRect() }), 140)
  }
  const onOut = (e) => { if (hover && mention(e)) later(() => setCard(null), 260) }
  const onClick = (e) => {
    const el = mention(e)
    const rec = el && recordOf(el)
    if (!rec) return
    if (hover) k.openRecord(rec.id)
    else setCard((c) => (c?.record.id === rec.id ? null : { record: rec, rect: el.getBoundingClientRect() }))
  }

  return (
    <>
      <div
        ref={ref}
        className={`prose ${dropCap ? 'dropcap' : ''}`}
        dangerouslySetInnerHTML={{ __html: sanitize(html) }}
        onMouseOver={onOver} onMouseOut={onOut} onClick={onClick}
      />
      {card && (
        <MentionCard
          record={card.record} rect={card.rect}
          onEnter={() => clearTimeout(timer.current)} onLeave={() => later(() => setCard(null), 260)}
          onOpen={() => { setCard(null); k.openRecord(card.record.id) }}
        />
      )}
    </>
  )
}
