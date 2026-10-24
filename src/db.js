// Datos en Supabase: la tabla `entries` y las imágenes en el bucket `images`.
// En las entradas, cada imagen es una URL pública (string). Mientras se edita,
// una imagen nueva es un Blob/File que se sube al guardar.
import { supabase } from './supabase.js'

const BUCKET = 'images'
const PUBLIC_MARK = `/storage/v1/object/public/${BUCKET}/`

export const newId = () =>
  crypto.randomUUID?.() ??
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })

const fromRow = (r) => ({
  id: r.id,
  userId: r.user_id,
  title: r.title,
  category: r.category,
  date: r.date,
  tags: r.tags || [],
  cover: r.cover,
  blocks: r.blocks || [],
  createdAt: new Date(r.created_at).getTime(),
  updatedAt: new Date(r.updated_at).getTime(),
})

const check = ({ data, error }) => {
  if (error) throw error
  return data
}

export async function getAllEntries() {
  const rows = check(await supabase.from('entries').select('*').order('updated_at', { ascending: false }))
  return rows.map(fromRow)
}

// ---------- Perfil y favoritos ----------

export async function getProfile(userId) {
  return check(await supabase.from('profiles').select('*').eq('id', userId).maybeSingle())
}

// Las reglas de la base de datos ya limitan estas consultas a los favoritos del usuario actual.
export async function getMyFavorites() {
  const rows = check(await supabase.from('favorites').select('entry_id'))
  return new Set(rows.map((r) => r.entry_id))
}

export async function setFavorite(entryId, on) {
  if (on) check(await supabase.from('favorites').insert({ entry_id: entryId }))
  else check(await supabase.from('favorites').delete().eq('entry_id', entryId))
}

export async function getFavoriteCounts() {
  const rows = check(await supabase.rpc('favorite_counts'))
  return Object.fromEntries(rows.map((r) => [r.entry_id, Number(r.total)]))
}

// ---------- Imágenes ----------

async function uploadImage(blob) {
  const { data: { user } } = await supabase.auth.getUser()
  const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg').replace('svg+xml', 'svg')
  const path = `${user.id}/${newId()}.${ext}`
  check(await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type }))
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

const pathFromUrl = (url) =>
  typeof url === 'string' && url.includes(PUBLIC_MARK) ? decodeURIComponent(url.split(PUBLIC_MARK)[1]) : null

const imageUrls = (entry) =>
  [entry?.cover, ...(entry?.blocks || []).map((b) => b.image)].filter((x) => typeof x === 'string')

async function removeImages(urls) {
  const paths = urls.map(pathFromUrl).filter(Boolean)
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths)
}

async function mapImages(entry, fn) {
  const out = { ...entry }
  if (entry.cover) out.cover = await fn(entry.cover)
  out.blocks = await Promise.all(
    (entry.blocks || []).map(async (b) => (b.type === 'image' && b.image ? { ...b, image: await fn(b.image) } : b))
  )
  return out
}

// ---------- Guardar / borrar ----------

// `previous` es la versión anterior de la entrada (si existe), para borrar imágenes que ya no se usan.
export async function saveEntry(entry, previous) {
  const withUrls = await mapImages(entry, (img) => (img instanceof Blob ? uploadImage(img) : img))
  const row = {
    id: withUrls.id,
    title: withUrls.title,
    category: withUrls.category,
    date: withUrls.date,
    tags: withUrls.tags,
    cover: withUrls.cover || null,
    blocks: withUrls.blocks,
    updated_at: new Date().toISOString(),
  }
  if (withUrls.createdAt) row.created_at = new Date(withUrls.createdAt).toISOString()
  check(await supabase.from('entries').upsert(row))

  const kept = new Set(imageUrls(withUrls))
  await removeImages(imageUrls(previous).filter((u) => !kept.has(u)))
  return withUrls
}

export async function deleteEntry(entry) {
  check(await supabase.from('entries').delete().eq('id', entry.id))
  await removeImages(imageUrls(entry))
}

// ---------- Exportar / importar (respaldo en JSON) ----------

const blobToDataURL = (blob) =>
  new Promise((resolve) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.readAsDataURL(blob)
  })

const toBlob = async (src) => (src instanceof Blob ? src : (await fetch(src)).blob())

export async function exportAll() {
  const entries = await getAllEntries()
  const serial = await Promise.all(
    entries.map(({ userId, ...e }) => mapImages(e, async (img) => blobToDataURL(await toBlob(img))))
  )
  return new Blob([JSON.stringify({ version: 1, entries: serial })], { type: 'application/json' })
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Sube entradas que traen imágenes como dataURL o Blob (respaldo JSON o datos locales).
export async function uploadEntries(entries, onProgress) {
  const existing = new Set((await getAllEntries()).map((e) => e.id))
  let n = 0
  for (const e of entries) {
    const id = existing.has(e.id) || !UUID.test(e.id) ? newId() : e.id
    const withBlobs = await mapImages(e, (img) => (typeof img === 'string' && !img.startsWith('data:') ? img : toBlob(img)))
    await saveEntry({ ...withBlobs, id })
    onProgress?.(++n, entries.length)
  }
  return n
}

export async function importAll(file) {
  const data = JSON.parse(await file.text())
  return uploadEntries(data.entries || [])
}
