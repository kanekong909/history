import { useState } from 'react'
import { supabase } from '../supabase.js'

const ERRORS = {
  'Invalid login credentials': 'Correo o contraseña incorrectos.',
  'Email not confirmed': 'Primero confirma tu correo con el enlace que te enviamos.',
  'User already registered': 'Ya existe una cuenta con ese correo.',
}

export default function Login({ onClose }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const isSignup = mode === 'signup'

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { data, error } = isSignup
      ? await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name.trim() }, emailRedirectTo: window.location.origin },
        })
      : await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) return setError(ERRORS[error.message] || error.message)
    // Si Supabase pide confirmar el correo, no hay sesión todavía.
    if (isSignup && !data.session) return setNotice('Te enviamos un correo para confirmar tu cuenta. Ábrelo y luego inicia sesión.')
    onClose()
  }

  const switchMode = () => {
    setMode(isSignup ? 'login' : 'signup')
    setError('')
    setNotice('')
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{isSignup ? 'Crear cuenta' : 'Iniciar sesión'}</h2>
        {notice ? (
          <p>{notice}</p>
        ) : (
          <>
            {isSignup && (
              <label>
                Nombre
                <input required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
              </label>
            )}
            <label>
              Correo
              <input type="email" required autoFocus={!isSignup} value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label>
              Contraseña
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            {error && <p className="error">{error}</p>}
          </>
        )}
        <div className="toolbar end">
          <button type="button" className="ghost" onClick={onClose}>{notice ? 'Cerrar' : 'Cancelar'}</button>
          {!notice && (
            <button type="submit" disabled={busy}>
              {busy ? 'Un momento…' : isSignup ? 'Registrarme' : 'Entrar'}
            </button>
          )}
        </div>
        <p className="switch">
          {isSignup ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}{' '}
          <button type="button" className="link" onClick={switchMode}>
            {isSignup ? 'Inicia sesión' : 'Regístrate'}
          </button>
        </p>
      </form>
    </div>
  )
}
