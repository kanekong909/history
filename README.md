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

### Estilo de la portada (opcional, una sola vez)

Para poder elegir el diseño de la portada de cada entrada, ejecuta [`supabase/03_estilo_portada.sql`](supabase/03_estilo_portada.sql) en el **SQL Editor**.
Solo agrega una columna y no toca tus datos. Hazlo **antes** de publicar la versión que usa esta opción.

### Historias destacadas (opcional, una sola vez)

El inicio muestra un banner que rota entre las historias marcadas como **destacadas**. Para poder marcarlas, ejecuta
[`supabase/04_destacadas.sql`](supabase/04_destacadas.sql) en el **SQL Editor** (solo agrega una columna).
Si no marcas ninguna, el banner usa las más queridas que tengan portada.

### Comentarios

Cualquiera puede comentar en una historia, con sesión o como invitado (anónimo). Para activarlo, ejecuta
[`supabase/05_comentarios.sql`](supabase/05_comentarios.sql) en el **SQL Editor** (después del 02). Crea la tabla, sus reglas y un freno
contra avalanchas (máximo 20 comentarios por minuto en todo el sitio). Tú, como administrador, puedes eliminar cualquier comentario;
quien comenta con sesión puede eliminar los suyos. Los invitados no pueden borrar los suyos.

Para que quien comentó pueda **editar o eliminar** su comentario (con sesión o como invitado), ejecuta también
[`supabase/06_editar_comentarios.sql`](supabase/06_editar_comentarios.sql). Los invitados lo logran con una clave secreta que su navegador guarda:
si borran los datos del navegador o cambian de dispositivo, ya no podrán editar ese comentario.

### Imágenes en Cloudinary

Las imágenes se guardan en **Cloudinary** (las que ya estaban en Supabase siguen funcionando). Para que el navegador nunca vea tu API secret,
las subidas pasan por dos funciones del servidor de la carpeta `api/`, que Vercel ejecuta solas:

1. En tu cuenta de Cloudinary copia **Cloud name**, **API key** y **API secret** (Settings → API Keys).
2. En **Vercel → tu proyecto → Settings → Environment Variables** crea estas tres (sin el prefijo `VITE_`) y haz **Redeploy**:
   `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
3. Para pruebas locales, las mismas tres van en tu `.env` (que git ignora). **Nunca** pongas el secret en un archivo que se suba a GitHub.

Las funciones comprueban la sesión y el correo confirmado, dejan subir solo imágenes (jpg, png, webp, gif, avif) a la carpeta de cada persona,
y limitan a quienes no son administradoras a 30 imágenes (`MEMBER_IMAGE_LIMIT` en Vercel lo cambia).

### Historias de otras personas (con tu aprobación)

Para que cualquier persona con cuenta pueda escribir historias que **tú apruebas** antes de publicarse, ejecuta
[`supabase/07_historias_de_usuarios.sql`](supabase/07_historias_de_usuarios.sql) en el **SQL Editor** (después del 02).

- Deja activado **Confirm email** (Authentication → Sign In / Providers → Email): solo cuentas con el correo confirmado pueden escribir.
- Quien escribe guarda borradores y los envía a revisión (máximo 3 a la vez y 20 sin publicar). Tú las ves en **Pendientes de revisión** (menú de tu avatar)
  y las apruebas o rechazas con una nota. Hasta entonces solo las ven su autora o autor y tú.
- Nadie puede publicar por su cuenta, destacar historias ni cambiar una historia ya publicada.

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
supabase/03_estilo_portada.sql       columna con el diseño de la portada
supabase/04_destacadas.sql           columna para marcar historias destacadas
supabase/05_comentarios.sql          tabla de comentarios (con sesión o anónimos)
supabase/06_editar_comentarios.sql   editar y borrar comentarios propios
supabase/07_historias_de_usuarios.sql  historias de otras personas con aprobación
src/supabase.js          cliente de Supabase (lee el .env)
src/db.js                leer/guardar/borrar entradas, subir imágenes, exportar/importar
src/localDb.js           lee las entradas antiguas del navegador para migrarlas
src/components/          lista, vista, editor por bloques, login/registro, botón de favorito
```
