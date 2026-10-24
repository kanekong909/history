import { useEffect, useState } from 'react'

// Devuelve una URL para <img>: si es un string (URL de Supabase) se usa tal cual;
// si es un Blob/File (imagen recién elegida) se crea una URL temporal y se libera al desmontar.
export function useObjectURL(src) {
  const [url, setUrl] = useState(typeof src === 'string' ? src : null)
  useEffect(() => {
    if (!src) return setUrl(null)
    if (typeof src === 'string') return setUrl(src)
    const u = URL.createObjectURL(src)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [src])
  return url
}
