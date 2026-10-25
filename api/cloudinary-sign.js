import { randomUUID } from 'node:crypto'
import {
  FOLDER_ROOT, MEMBER_IMAGE_LIMIT, HttpError, json, handleError,
  cloudinaryConfig, sign, authenticate, countImages,
} from './_lib/shared.js'

// POST /api/cloudinary-sign
// Devuelve los datos firmados para que el navegador suba UNA imagen directamente a Cloudinary.
// Solo con sesión y correo confirmado. Cada persona sube a su propia carpeta y las que no son
// administradoras tienen un cupo de imágenes.
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' })
  try {
    const who = await authenticate(req)
    const cfg = cloudinaryConfig()

    if (!who.isAdmin && MEMBER_IMAGE_LIMIT >= 0) {
      const used = await countImages(cfg, `${FOLDER_ROOT}/${who.id}/`)
      if (used >= MEMBER_IMAGE_LIMIT) throw new HttpError(429, `Llegaste al límite de ${MEMBER_IMAGE_LIMIT} imágenes. Elimina alguna para subir otra.`)
    }

    // Todo lo que se firma aquí lo obliga Cloudinary a respetar: formato permitido y ubicación.
    const params = {
      allowed_formats: 'jpg,jpeg,png,webp,gif,avif',
      public_id: `${FOLDER_ROOT}/${who.id}/${randomUUID().replace(/-/g, '')}`,
      timestamp: Math.floor(Date.now() / 1000),
    }
    return json(res, 200, { cloudName: cfg.cloud, apiKey: cfg.key, ...params, signature: sign(params, cfg.secret) })
  } catch (e) {
    return handleError(res, e)
  }
}
