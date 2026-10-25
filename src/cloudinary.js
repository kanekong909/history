// Imágenes en Cloudinary. El navegador nunca ve el API secret: pide una firma a /api/cloudinary-sign
// (que comprueba la sesión y el cupo) y sube la foto directamente a Cloudinary.
import { supabase } from './supabase.js'

const MAX_SIDE = 1800 // lado máximo en píxeles: más grande no se nota y pesa mucho más
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024

export const isCloudinaryUrl = (u) => typeof u === 'string' && /^https:\/\/res\.cloudinary\.com\//.test(u)

// Pide a Cloudinary el formato y la calidad óptimos para cada navegador (f_auto, q_auto) y, si se indica,
// un ancho máximo. Solo toca direcciones de Cloudinary; las demás se devuelven tal cual.
export function cdn(url, width) {
  if (!isCloudinaryUrl(url)) return url
  const t = ['f_auto', 'q_auto', width && `w_${width}`, width && 'c_limit'].filter(Boolean).join(',')
  return url.replace(/\/upload\/(?:[^/]*[,_][^/]*\/)?(?=v\d+\/)/, `/upload/${t}/`)
}

// Reduce la foto antes de subirla (ahorra datos del usuario y espacio de tu cuenta).
async function shrink(file) {
  if (file.type === 'image/gif') return file // para no perder la animación
  let bmp
  try { bmp = await createImageBitmap(file) } catch { return file }
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height))
  if (scale === 1 && file.size < 1.5 * 1024 * 1024) { bmp.close?.(); return file }
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close?.()
  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, 0.86))
  return blob && blob.size < file.size ? blob : file
}

async function authHeader() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Inicia sesión para subir imágenes')
  return { Authorization: `Bearer ${session.access_token}` }
}

async function readError(res, fallback) {
  const data = await res.json().catch(() => ({}))
  return data?.error?.message || data?.error || fallback
}

export async function uploadToCloudinary(file) {
  if (file.size > MAX_UPLOAD_BYTES * 4) throw new Error('La imagen es demasiado grande')
  const blob = await shrink(file)
  if (blob.size > MAX_UPLOAD_BYTES) throw new Error('La imagen pesa demasiado, incluso reducida. Prueba con otra.')

  const signRes = await fetch('/api/cloudinary-sign', { method: 'POST', headers: await authHeader() })
  if (!signRes.ok) throw new Error(await readError(signRes, 'No se pudo preparar la subida de la imagen'))
  const sig = await signRes.json()

  const form = new FormData()
  form.append('file', blob)
  for (const k of ['api_key', 'timestamp', 'signature', 'public_id', 'allowed_formats']) {
    form.append(k, k === 'api_key' ? sig.apiKey : sig[k])
  }
  const up = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, { method: 'POST', body: form })
  if (!up.ok) throw new Error(await readError(up, 'No se pudo subir la imagen'))
  return cdn((await up.json()).secure_url)
}

// Borra imágenes de Cloudinary (el servidor comprueba que sean tuyas).
export async function deleteFromCloudinary(urls) {
  const list = urls.filter(isCloudinaryUrl)
  if (!list.length) return
  await fetch('/api/cloudinary-delete', {
    method: 'POST',
    headers: { ...(await authHeader()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls: list }),
  })
}
