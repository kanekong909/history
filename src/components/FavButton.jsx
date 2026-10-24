export default function FavButton({ active, count = 0, onToggle }) {
  return (
    <button
      type="button"
      className={`fav ${active ? 'on' : ''}`}
      title={active ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      aria-pressed={active}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
    >
      {active ? '♥' : '♡'} {count > 0 && <span>{count}</span>}
    </button>
  )
}
