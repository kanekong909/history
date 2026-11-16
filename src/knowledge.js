// Colecciones y fichas: una base de datos propia (motores, aviones, personajes…) que se usa en las historias.
import { supabase } from './supabase.js'
import { newId, uploadImage, removeImages } from './db.js'

const ck = ({ data, error }) => {
  if (error) throw error
  return data
}

export const FIELD_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'year', label: 'Año' },
  { value: 'select', label: 'Selección' },
  { value: 'url', label: 'Enlace web' },
  { value: 'relation', label: 'Enlace a otras fichas' },
]

export const slugify = (s) =>
  String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'coleccion'

export function uniqueSlug(name, taken) {
  const base = slugify(name)
  let slug = base
  for (let i = 2; taken.includes(slug); i++) slug = `${base}-${i}`
  return slug
}

const fromCollection = (r) => ({
  id: r.id, name: r.name, slug: r.slug, description: r.description || '', fields: r.fields || [],
  createdAt: r.created_at, updatedAt: r.updated_at,
})
const fromRecord = (r) => ({
  id: r.id, collectionId: r.collection_id, title: r.title, image: r.image || null, summary: r.summary || '',
  data: r.data || {}, createdAt: r.created_at, updatedAt: r.updated_at,
})

// Si todavía no se ejecutó 08_colecciones.sql, las tablas no existen y esto devuelve null (la función queda apagada).
export async function getKnowledge() {
  const [c, r] = await Promise.all([
    supabase.from('collections').select('*').order('name'),
    supabase.from('records').select('*').order('title'),
  ])
  if (c.error || r.error) return null
  return { collections: ck(c).map(fromCollection), records: ck(r).map(fromRecord) }
}

export async function saveCollection(col, existing = []) {
  const taken = existing.filter((c) => c.id !== col.id).map((c) => c.slug)
  const slug = col.slug || uniqueSlug(col.name, taken)
  const row = { id: col.id, name: col.name.trim(), slug, description: col.description || '', fields: col.fields, updated_at: new Date().toISOString() }
  return fromCollection(ck(await supabase.from('collections').upsert(row).select().single()))
}

export async function deleteCollection(col, records = []) {
  ck(await supabase.from('collections').delete().eq('id', col.id))
  await removeImages(records.filter((r) => r.collectionId === col.id).map((r) => r.image).filter(Boolean))
}

export async function saveRecord(rec, previous) {
  const image = rec.image instanceof Blob ? await uploadImage(rec.image) : rec.image || null
  const row = {
    id: rec.id, collection_id: rec.collectionId, title: rec.title.trim(), image, summary: rec.summary || '',
    data: rec.data || {}, updated_at: new Date().toISOString(),
  }
  const saved = fromRecord(ck(await supabase.from('records').upsert(row).select().single()))
  if (previous?.image && previous.image !== image) await removeImages([previous.image])
  return saved
}

export async function deleteRecord(rec) {
  ck(await supabase.from('records').delete().eq('id', rec.id))
  if (rec.image) await removeImages([rec.image])
}

// Crea una ficha vacía solo con el nombre (desde el «@» del editor); sus datos se completan después.
export const createRecordQuick = ({ title, collectionId }) =>
  saveRecord({ id: newId(), collectionId, title, image: null, summary: '', data: {} })
