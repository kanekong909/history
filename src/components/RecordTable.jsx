import { useState } from 'react'
import { useKnowledge } from '../knowledge.jsx'
import { asIds, isEmpty, formatNumber, sortRecords } from '../recordUtils.js'
import { cdn } from '../cloudinary.js'
import Icon from './Icon.jsx'

// Etiqueta de una ficha mencionada (como la mención con «@»): lleva a su página.
export function RecordChip({ record }) {
  const k = useKnowledge()
  return (
    <button type="button" className="mention chip-link" onClick={() => k?.openRecord(record.id)}>{record.title}</button>
  )
}

function Cell({ field, value }) {
  const k = useKnowledge()
  if (isEmpty(value)) return <span className="muted">—</span>
  switch (field.type) {
    case 'number': return formatNumber(value, field.unit)
    case 'url': {
      let host = String(value)
      try { host = new URL(value).hostname.replace(/^www\./, '') } catch { /* se muestra tal cual */ }
      return <a href={value} target="_blank" rel="noopener noreferrer">{host}</a>
    }
    case 'relation': {
      const found = asIds(value).map((id) => k?.recordById.get(id)).filter(Boolean)
      return found.length
        ? <span className="chips">{found.map((r) => <RecordChip key={r.id} record={r} />)}</span>
        : <span className="muted">—</span>
    }
    default: return String(value)
  }
}

// Tabla de fichas. En el celular cada fila se vuelve una tarjeta (cada celda con su nombre de campo).
export default function RecordTable({ collection, rows, columns, showImage = false, sortable = true, initialSort }) {
  const k = useKnowledge()
  const [sort, setSort] = useState(initialSort || null) // { by, dir }
  const fields = columns.map((id) => collection.fields.find((f) => f.id === id)).filter(Boolean)
  const shown = sort?.by ? sortRecords(rows, collection, sort.by, sort.dir, k?.recordById) : rows

  const toggle = (by) => setSort((s) => (s?.by === by ? (s.dir === 'asc' ? { by, dir: 'desc' } : null) : { by, dir: 'asc' }))
  const Head = ({ by, children }) => (
    <th aria-sort={sort?.by === by ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      {sortable ? (
        <button type="button" className="rt-sort" onClick={() => toggle(by)}>
          {children}
          <span className="rt-arrow" aria-hidden="true">{sort?.by === by ? (sort.dir === 'asc' ? '↑' : '↓') : ''}</span>
        </button>
      ) : children}
    </th>
  )

  return (
    <div className="rt-wrap">
      <table className="rt">
        <thead>
          <tr>
            <Head by="title">Nombre</Head>
            {fields.map((f) => <Head key={f.id} by={f.id}>{f.label}{f.unit ? ` (${f.unit})` : ''}</Head>)}
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.id}>
              <td data-label="Nombre">
                <button type="button" className="rt-name" onClick={() => k?.openRecord(r.id)}>
                  {showImage && (r.image ? <img src={cdn(r.image, 120)} alt="" loading="lazy" /> : <span className="rt-ph"><Icon name="database" size={14} /></span>)}
                  <span>{r.title}</span>
                </button>
              </td>
              {fields.map((f) => <td key={f.id} data-label={f.label}><Cell field={f} value={r.data?.[f.id]} /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
