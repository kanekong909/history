import { useEffect, useRef, useState } from 'react'
import Logo from './Logo.jsx'

function UserMenu({ user, profile, isAdmin, onExport, onImport, onLogout }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    const esc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const name = profile?.display_name || user?.email || ''
  const run = (fn) => () => { setOpen(false); fn() }

  return (
    <div className="menu" ref={ref}>
      <button
        type="button"
        className={`avatar ${user ? '' : 'plain'}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menú"
        onClick={() => setOpen((o) => !o)}
      >
        {user ? name.trim().charAt(0).toUpperCase() || '?' : '☰'}
      </button>

      {open && (
        <div className="menu-panel" role="menu">
          {user && (
            <div className="menu-user">
              <strong>{name}</strong>
              <span>{isAdmin ? 'Administrador' : user.email}</span>
            </div>
          )}
          <button type="button" role="menuitem" onClick={run(onExport)}>Exportar respaldo</button>
          {isAdmin && <button type="button" role="menuitem" onClick={run(onImport)}>Importar respaldo</button>}
          {user && <button type="button" role="menuitem" className="out" onClick={run(onLogout)}>Cerrar sesión</button>}
        </div>
      )}
    </div>
  )
}

export default function Navbar({ user, profile, isAdmin, onHome, onNew, onLogin, onLogout, onExport, onImport }) {
  return (
    <header className="topbar">
      <a className="brand" href="/" onClick={(e) => { e.preventDefault(); onHome() }} aria-label="Ir al inicio">
        <Logo />
        <span className="brand-text">
          <span className="brand-name">Mi Archivo</span>
          <span className="brand-tag">Historias y recuerdos</span>
        </span>
      </a>

      <nav className="nav-actions">
        {isAdmin && (
          <button type="button" className="new-btn" onClick={onNew}>
            <span aria-hidden="true">+</span> <span className="new-label">Nueva entrada</span>
          </button>
        )}
        {!user && <button type="button" onClick={onLogin}>Iniciar sesión</button>}
        <UserMenu user={user} profile={profile} isAdmin={isAdmin} onExport={onExport} onImport={onImport} onLogout={onLogout} />
      </nav>
    </header>
  )
}
