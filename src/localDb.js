// Datos de la versión anterior, guardados solo en este navegador (IndexedDB).
// Se usan únicamente para migrarlos a Supabase.
const DB_NAME = 'mi-archivo'
const STORE = 'entries'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id' }).createIndex('updatedAt', 'updatedAt')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx(mode, fn) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const result = fn(t.objectStore(STORE))
    t.oncomplete = () => resolve(result?.result ?? result)
    t.onerror = () => reject(t.error)
  })
}

export const getLocalEntries = async () => {
  try {
    return await tx('readonly', (s) => s.getAll())
  } catch {
    return []
  }
}

export const clearLocalEntries = () => tx('readwrite', (s) => s.clear())
