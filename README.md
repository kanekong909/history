# Mi Archivo

App para guardar historias, notas y recuerdos con imágenes.
Frontend en React + Vite; base de datos, imágenes y login en **Supabase** (plan gratuito).

- Cualquiera con el enlace puede **leer** las entradas.
- Cualquiera puede **registrarse** para marcar **favoritos** (♥). Cada entrada muestra cuántos favoritos tiene.
- Solo el **administrador** (tú) puede **crear, editar, borrar e importar**.

---

## 1. Crear el proyecto en Supabase

1. Entra a <https://supabase.com>, crea una cuenta y luego **New project** (elige la región más cercana y guarda la contraseña de la base de datos).
2. Cuando termine de crearse, ve a **SQL Editor → New query**, pega todo el contenido de [`supabase/schema.sql`](supabase/schema.sql) y pulsa **Run**.
   Esto crea la tabla `entries`, el bucket público `images` y las reglas de seguridad.

## 2. Crear tu usuario y hacerte administrador

1. **Authentication → Users → Add user → Create new user**: tu correo y una contraseña, con **Auto Confirm User** marcado.
2. Abre [`supabase/02_usuarios_favoritos.sql`](supabase/02_usuarios_favoritos.sql), cambia `TU_CORREO@ejemplo.com` (última línea) por tu correo, y ejecútalo en el **SQL Editor**.
   Crea los perfiles, los favoritos y te marca como administrador.
3. Deja **activado** *Allow new users to sign up* (Authentication → Sign In / Providers) para que otros puedan registrarse.
4. **Authentication → URL Configuration → Site URL**: pon la URL de tu app (al principio `http://localhost:5173`, después la de Vercel).
   Es a donde lleva el enlace del correo de confirmación.

> **Correos de confirmación:** el envío de correo gratuito de Supabase es muy limitado (unos pocos por hora).
> Para pruebas puedes desactivar *Confirm email* en Authentication → Sign In / Providers → Email.
> Para producción conviene conectar un SMTP propio (por ejemplo Resend, que tiene plan gratis) en Authentication → Emails → SMTP Settings.

Para hacer administrador a otra persona más adelante:

```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'su@correo.com');
```

## 3. Conectar la app

1. En Supabase, abre **Project Settings → API** (o el botón **Connect**) y copia:
   - **Project URL**
   - **anon / publishable key** (la pública; *nunca* uses la `service_role` / secret key en el frontend)
2. Copia `.env.example` como `.env` y pega los valores:

   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

3. Arranca la app:

   ```bash
   npm install
   npm run dev
   ```

   Pulsa **Iniciar sesión** con el usuario del paso 2.
   Si tenías entradas de la versión anterior (guardadas en el navegador), aparecerá un aviso para **subirlas a la nube**.

## 4. Publicarla gratis en Vercel

1. Sube este proyecto a un repositorio de GitHub (el `.env` está en `.gitignore`, no se sube).
2. En <https://vercel.com> → **Add New → Project** → importa el repositorio. Vercel detecta Vite solo.
3. En **Environment Variables** agrega `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con los mismos valores.
4. **Deploy**. Te dará una URL tipo `https://mi-archivo.vercel.app`.

(Netlify o Cloudflare Pages funcionan igual: comando `npm run build`, carpeta `dist`.)

---

## Notas

- **Límites gratuitos de Supabase** (aprox.): 500 MB de base de datos y 1 GB de imágenes. Si el proyecto no recibe visitas en 7 días se pausa; se reactiva desde el panel sin perder datos.
- **Respaldo**: el botón **Exportar** descarga un `.json` con todas las entradas e imágenes. **Importar** las vuelve a subir.
- **¿Archivo privado?** En `schema.sql`, cambia la política `lectura publica` por `using (auth.uid() = user_id)`. Ten en cuenta que las imágenes siguen siendo accesibles para quien tenga su URL, porque el bucket es público.

## Estructura

```
supabase/schema.sql      tabla de entradas, bucket de imágenes
supabase/02_usuarios_favoritos.sql   perfiles, rol admin, favoritos
src/supabase.js          cliente de Supabase (lee el .env)
src/db.js                leer/guardar/borrar entradas, subir imágenes, exportar/importar
src/localDb.js           lee las entradas antiguas del navegador para migrarlas
src/components/          lista, vista, editor por bloques, login/registro, botón de favorito
```
