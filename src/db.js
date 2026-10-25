// Datos en Supabase: la tabla `entries` y las imágenes en el bucket `images`.
// En las entradas, cada imagen es una URL pública (string). Mientras se edita,
// una imagen nueva es un Blob/File que se sube al guardar.
import { supabase } from './supabase.js'
import { uploadToCloudinary, deleteFromCloudinary, isCloudinaryUrl } from './cloudinary.js'

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
  coverStyle: r.cover_style || null,
  featured: Boolean(r.featured),
  status: r.status || 'published',
  authorName: r.author_name || null,
  reviewNote: r.review_note || null,
  submittedAt: r.submitted_at || null,
  publishedAt: r.published_at || null,
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

// ---------- Comentarios ----------
// Las columnas se piden una a una: la huella de la clave de invitado no se puede leer desde la web.
// Si aún no se ha ejecutado 06_editar_comentarios.sql, se usa la lista corta (sin «editado»).
const COMMENT_COLS = 'id,entry_id,user_id,author_name,body,created_at,edited_at'
const COMMENT_COLS_BASE = 'id,entry_id,user_id,author_name,body,created_at'

const fromComment = (r) => ({
  id: r.id, entryId: r.entry_id, userId: r.user_id, authorName: r.author_name, body: r.body,
  createdAt: r.created_at, editedAt: r.edited_at || null,
})

export async function getComments(entryId) {
  const query = (cols) => supabase.from('comments').select(cols).eq('entry_id', entryId).order('created_at', { ascending: true })
  let res = await query(COMMENT_COLS)
  if (res.error) res = await query(COMMENT_COLS_BASE)
  return check(res).map(fromComment)
}

// Con sesión, la base de datos pone sola el usuario. Sin sesión queda como invitado y, si se pasa `token`
// (clave secreta que guarda su navegador), podrá editar o borrar su comentario más adelante.
export async function addComment({ entryId, name, body, token }) {
  const row = { entry_id: entryId, author_name: name, body }
  let res = await supabase.from('comments').insert(token ? { ...row, guest_token: token } : row).select(COMMENT_COLS).single()
  if (res.error && token) res = await supabase.from('comments').insert(row).select(COMMENT_COLS_BASE).single()
  return fromComment(check(res))
}

// `token`: clave del invitado. Con sesión no hace falta: la base de datos comprueba que el comentario sea tuyo.
export async function updateComment({ id, body, token }) {
  if (token) {
    const ok = check(await supabase.rpc('edit_guest_comment', { p_id: id, p_token: token, p_body: body }))
    if (!ok) throw new Error('No tienes permiso para editar este comentario')
    return { body: body.trim(), editedAt: new Date().toISOString() }
  }
  const row = check(await supabase.from('comments').update({ body }).eq('id', id).select(COMMENT_COLS).single())
  return fromComment(row)
}

export async function deleteComment({ id, token }) {
  if (token) {
    check(await supabase.rpc('delete_guest_comment', { p_id: id, p_token: token }))
    return
  }
  check(await supabase.from('comments').delete().eq('id', id))
}

// ---------- Imágenes ----------

// Las imágenes nuevas van a Cloudinary. Las que ya estaban en el almacenamiento de Supabase siguen
// funcionando (son solo direcciones) y se borran de allí si se quitan.
const uploadImage = (blob) => uploadToCloudinary(blob)

const pathFromUrl = (url) =>
  typeof url === 'string' && url.includes(PUBLIC_MARK) ? decodeURIComponent(url.split(PUBLIC_MARK)[1]) : null

const imageUrls = (entry) =>
  [entry?.cover, ...(entry?.blocks || []).flatMap((b) => [b.image, ...(b.slides || []).map((s) => s.image)])].filter((x) => typeof x === 'string')

async function removeImages(urls) {
  const paths = urls.map(pathFromUrl).filter(Boolean)
  const cloud = urls.filter(isCloudinaryUrl)
  // Borrar imágenes es «lo de menos»: si algo falla, la entrada ya se guardó y no se interrumpe
  await Promise.allSettled([
    paths.length ? supabase.storage.from(BUCKET).remove(paths) : null,
    cloud.length ? deleteFromCloudinary(cloud) : null,
  ])
}

// En orden (no en paralelo): así el cupo de imágenes se comprueba bien y no se satura el servicio.
async function mapImages(entry, fn) {
  const out = { ...entry }
  if (entry.cover) out.cover = await fn(entry.cover)
  out.blocks = []
  for (const b of entry.blocks || []) {
    if (b.type === 'image' && b.image) {
      out.blocks.push({ ...b, image: await fn(b.image) })
    } else if (b.type === 'carousel') {
      const slides = []
      for (const sl of b.slides || []) slides.push(sl.image ? { ...sl, image: await fn(sl.image) } : sl)
      out.blocks.push({ ...b, slides })
    } else {
      out.blocks.push(b)
    }
  }
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
  if (withUrls.coverStyle || previous?.coverStyle) row.cover_style = withUrls.coverStyle || null
  // Solo se envía si hay (o había) una destacada: así no falla mientras no exista la columna en Supabase
  if (withUrls.featured || previous?.featured) row.featured = Boolean(withUrls.featured)
  if (withUrls.createdAt) row.created_at = new Date(withUrls.createdAt).toISOString()
  // El estado solo se envía cuando hace falta: así todo sigue funcionando mientras no exista la columna en Supabase.
  const status = withUrls.status || 'published'
  if (status !== 'published' || (previous?.status && previous.status !== 'published')) row.status = status
  check(await supabase.from('entries').upsert(row))

  const kept = new Set(imageUrls(withUrls))
  await removeImages(imageUrls(previous).filter((u) => !kept.has(u)))
  return withUrls
}

export async function deleteEntry(entry) {
  check(await supabase.from('entries').delete().eq('id', entry.id))
  await removeImages(imageUrls(entry))
}

// ---------- Moderación y envío de historias ----------

// Cambia el estado de una historia. El administrador publica o rechaza; quien la escribió solo puede
// enviarla a revisión o volverla a borrador (la base de datos lo hace cumplir). `note` es el motivo del rechazo.
export async function setEntryStatus(id, status, note) {
  const patch = { status }
  if (note !== undefined) patch.review_note = note || null
  check(await supabase.from('entries').update(patch).eq('id', id))
}

// ¿Está activado el sistema de historias de usuarios en Supabase (07_historias_de_usuarios.sql)?
export async function probeContributors() {
  const { error } = await supabase.from('entries').select('status').limit(1)
  return !error
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
