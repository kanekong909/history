import { createContext, useContext } from 'react'

// Las colecciones y fichas cargadas, disponibles para cualquier parte de la app (tablas, menciones con «@», páginas).
// Fuera del proveedor devuelve null: los componentes deben funcionar igual sin él.
const Ctx = createContext(null)
export const KnowledgeProvider = Ctx.Provider
export const useKnowledge = () => useContext(Ctx)
