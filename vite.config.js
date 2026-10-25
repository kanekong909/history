import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// En producción, la carpeta api/ la ejecuta Vercel. En desarrollo la sirve este plugin con el mismo código,
// leyendo .env (incluido el secret de Cloudinary, que solo usa el servidor y jamás se envía al navegador).
function apiDev() {
  return {
    name: 'api-dev',
    configureServer(server) {
      Object.assign(process.env, loadEnv('development', process.cwd(), ''))
      server.middlewares.use(async (req, res, next) => {
        const m = req.url?.match(/^\/api\/([\w-]+)/)
        if (!m) return next()
        const file = path.join(process.cwd(), 'api', `${m[1]}.js`)
        if (!fs.existsSync(file)) {
          res.statusCode = 404
          return res.end(JSON.stringify({ error: 'No existe' }))
        }
        try {
          const mod = await server.ssrLoadModule(`/api/${m[1]}.js`)
          await mod.default(req, res)
        } catch (e) {
          console.error(e)
          res.statusCode = 500
          res.end(JSON.stringify({ error: 'Error del servidor' }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), apiDev()],
})
