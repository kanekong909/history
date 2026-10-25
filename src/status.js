// Estados de una historia: borrador → en revisión → publicada (o rechazada, que vuelve a borrador al corregirla).
export const STATUS = {
  draft: { label: 'Borrador', hint: 'Solo la ve su autor' },
  pending: { label: 'En revisión', hint: 'Esperando la decisión del administrador' },
  published: { label: 'Publicada', hint: 'Visible para todos' },
  rejected: { label: 'Rechazada', hint: 'Necesita cambios' },
}

export const MAX_PENDING = 3 // las mismas cifras que impone la base de datos (07_historias_de_usuarios.sql)
export const MAX_UNPUBLISHED = 20
