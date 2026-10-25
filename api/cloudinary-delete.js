import {
  FOLDER_ROOT, json, handleError, readJson, cloudinaryConfig, sign, authenticate, publicIdFromUrl,
} from './_lib/shared.js'

// POST /api/cloudinary-delete  { urls: [...] }
// Borra imágenes de Cloudinary. Cada persona solo puede borrar las de su propia carpeta;
// la administradora puede borrar cualquiera de la app.
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' })
  try {
    const who = await authenticate(req)
    const cfg = cloudinaryConfig()
    const body = await readJson(req)
    const urls = Array.isArray(body.urls) ? body.urls.slice(0, 60) : []

    const mine = `${FOLDER_ROOT}/${who.id}/`
    const ids = [...new Set(urls.map((u) => publicIdFromUrl(u, cfg.cloud)).filter(Boolean))]
      .filter((id) => id.startsWith(who.isAdmin ? `${FOLDER_ROOT}/` : mine))

    let deleted = 0
    for (const id of ids) {
      const params = { invalidate: 'true', public_id: id, timestamp: Math.floor(Date.now() / 1000) }
      const form = new URLSearchParams({ ...params, api_key: cfg.key, signature: sign(params, cfg.secret) })
      const r = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloud}/image/destroy`, { method: 'POST', body: form })
      if (r.ok && (await r.json()).result === 'ok') deleted++
    }
    return json(res, 200, { deleted, requested: urls.length })
  } catch (e) {
    return handleError(res, e)
  }
}
