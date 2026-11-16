// Utilidades para mostrar y ordenar fichas.

// Los campos «enlace a otras fichas» guardan una lista de identificadores.
export const asIds = (v) => (Array.isArray(v) ? v : v ? [v] : [])

export const isEmpty = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)

export function formatNumber(v, unit) {
  const n = Number(v)
  if (Number.isNaN(n)) return String(v)
  return `${n.toLocaleString('es', { maximumFractionDigits: 6 })}${unit ? ` ${unit}` : ''}`
}

// Texto simple de un valor (para ordenar y buscar).
export function plainValue(field, value, byId) {
  if (isEmpty(value)) return ''
  if (field.type === 'relation') return asIds(value).map((id) => byId?.get(id)?.title || '').join(', ')
  return String(value)
}

export function compareValues(field, a, b, byId) {
  const ea = isEmpty(a), eb = isEmpty(b)
  if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1 // los vacíos al final
  if (field.type === 'number' || field.type === 'year') return Number(a) - Number(b)
  return plainValue(field, a, byId).localeCompare(plainValue(field, b, byId), 'es', { numeric: true, sensitivity: 'base' })
}

// Ordena fichas por el nombre (by = 'title') o por un campo.
export function sortRecords(records, collection, by, dir = 'asc', byId) {
  if (!by) return records
  const field = by === 'title' ? { type: 'text' } : collection.fields.find((f) => f.id === by)
  if (!field) return records
  const get = (r) => (by === 'title' ? r.title : r.data?.[by])
  const sorted = [...records].sort((x, y) => compareValues(field, get(x), get(y), byId))
  if (dir !== 'desc') return sorted
  // de mayor a menor: se invierten las que tienen dato, y las vacías siguen al final
  const filled = sorted.filter((r) => !isEmpty(get(r)))
  return [...filled.reverse(), ...sorted.filter((r) => isEmpty(get(r)))]
}

// Fichas que muestra un bloque «Tabla»: las elegidas (en ese orden) o todas las de la colección.
export function tableRows(block, k) {
  const col = k?.collectionById.get(block.collectionId)
  if (!col) return null
  let rows = block.recordIds?.length
    ? block.recordIds.map((id) => k.recordById.get(id)).filter(Boolean)
    : k.records.filter((r) => r.collectionId === col.id)
  if (block.sort?.by) rows = sortRecords(rows, col, block.sort.by, block.sort.dir, k.recordById)
  return { collection: col, rows }
}

// Historias (publicadas) que mencionan una ficha con «@» o la muestran en una tabla.
export function mentionedIn(entries, record) {
  return entries.filter((e) =>
    (e.blocks || []).some((b) =>
      (b.html && b.html.includes(`data-id="${record.id}"`)) ||
      (b.type === 'table' && b.collectionId === record.collectionId && (!b.recordIds?.length || b.recordIds.includes(record.id))),
    ),
  )
}

export const initials = (s) => String(s || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
