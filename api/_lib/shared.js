// Utilidades de las funciones del servidor (carpeta api/). Los archivos que empiezan por «_» no son rutas.
// El API secret de Cloudinary SOLO se lee aquí, desde variables de entorno del servidor: nunca llega al navegador.
import { createHash } from 'node:crypto'

export const FOLDER_ROOT = 'mi-archivo'
// Máximo de imágenes por persona que no es administradora (cambiable con la variable MEMBER_IMAGE_LIMIT)
export const MEMBER_IMAGE_LIMIT = Number(process.env.MEMBER_IMAGE_LIMIT || 30)

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export function json(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(data))
}

export function handleError(res, e) {
  if (e instanceof HttpError) return json(res, e.status, { error: e.message })
  console.error(e)
  return json(res, 500, { error: 'Error del servidor' })
}

export async function readJson(req) {
  if (req.body !== undefined && req.body !== null) return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body
  const chunks = []
  for await (const c of req) chunks.push(c)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

export function cloudinaryConfig() {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME
  const key = process.env.CLOUDINARY_API_KEY
  const secret = process.env.CLOUDINARY_API_SECRET
  if (!cloud || !key || !secret) throw new HttpError(500, 'Cloudinary no está configurado en el servidor')
  return { cloud, key, secret, auth: 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64') }
}

// Firma de Cloudinary: parámetros ordenados «a=1&b=2» + secret, en SHA-1.
export function sign(params, secret) {
  const str = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&')
  return createHash('sha1').update(str + secret).digest('hex')
}

// Comprueba la sesión de Supabase del navegador (sin necesitar ninguna clave secreta de Supabase):
// pregunta a Supabase quién es dueño del token y si su correo está confirmado.
export async function authenticate(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) throw new HttpError(401, 'Inicia sesión para subir imágenes')
  const base = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY
  if (!base || !anon) throw new HttpError(500, 'Falta la configuración de Supabase en el servidor')

  const headers = { apikey: anon, Authorization: `Bearer ${token}` }
  const ur = await fetch(`${base}/auth/v1/user`, { headers })
  if (!ur.ok) throw new HttpError(401, 'Tu sesión no es válida. Vuelve a iniciar sesión')
  const user = await ur.json()
  if (!user?.id) throw new HttpError(401, 'Tu sesión no es válida')
  if (!user.email_confirmed_at) throw new HttpError(403, 'Confirma tu correo para poder subir imágenes')

  const pr = await fetch(`${base}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=is_admin`, { headers })
  const profile = pr.ok ? (await pr.json())[0] : null
  return { id: user.id, isAdmin: Boolean(profile?.is_admin) }
}

// Cuántas imágenes tiene ya una persona (Search API de Cloudinary).
export async function countImages(cfg, prefix) {
  const r = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloud}/resources/search`, {
    method: 'POST',
    headers: { Authorization: cfg.auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expression: `public_id:"${prefix}*"`, max_results: 1 }),
  })
  if (!r.ok) throw new HttpError(502, 'No se pudo comprobar tu cupo de imágenes')
  return (await r.json()).total_count ?? 0
}

// Identificador público (public_id) a partir de la dirección de una imagen de Cloudinary.
export function publicIdFromUrl(url, cloud) {
  const m = String(url).match(/^https:\/\/res\.cloudinary\.com\/([^/]+)\/image\/upload\/(.+)$/)
  if (!m || m[1] !== cloud) return null
  const segs = m[2].split('/')
  const v = segs.findIndex((s) => /^v\d+$/.test(s))
  const rest = v >= 0 ? segs.slice(v + 1) : segs.filter((s) => !/[,_]/.test(s) || s.includes('.'))
  if (!rest.length) return null
  rest[rest.length - 1] = rest[rest.length - 1].replace(/\.[^./]+$/, '')
  return decodeURIComponent(rest.join('/'))
}
