# Gestor AFA — primera versión

Aplicación web privada para gestionar socios y enviar manualmente carnets digitales PDF por email.

## Incluye
- Acceso privado con email y contraseña.
- Alta y edición de socios.
- Búsqueda y filtro por estado.
- Número de socio automático.
- Carnet PDF con código QR.
- Descarga manual del PDF.
- Envío manual del carnet por correo.
- Base de datos con políticas RLS para limitar el acceso a administradores.

## Antes de empezar
Necesitarás:
1. Una cuenta de Supabase.
2. Una cuenta de Resend para el envío de emails.
3. Una cuenta de Netlify (o un alojamiento web estático equivalente).
4. Un ordenador para realizar la configuración inicial.

La aplicación no incluye todavía gestión de cuotas, pagos, renovaciones automáticas ni lectura/validación del QR.

## Paso 1 — Crear el proyecto Supabase
1. Entra en https://supabase.com/ y crea un proyecto.
2. Guarda la contraseña de la base de datos en un lugar seguro.
3. Abre **SQL Editor** en el panel de Supabase.
4. Copia y ejecuta el contenido de `supabase/schema.sql`.
5. Ve a **Project Settings > API** y copia la URL del proyecto y la clave `anon`/`publishable`.
6. Abre `config.js` y sustituye:
   - `https://TU-PROYECTO.supabase.co` por la URL real.
   - `TU_CLAVE_ANON_O_PUBLISHABLE` por la clave pública/anon.
   - Personaliza `AFA_NAME`, `SCHOOL_NAME` y `SCHOOL_YEAR`.

**Nunca pegues la clave `service_role` en `config.js` ni en ningún archivo que se publique en Internet.**

## Paso 2 — Crear la cuenta administradora
1. En Supabase abre **Authentication > Users**.
2. Pulsa **Add user** y crea el email y contraseña de administración.
3. Abre el usuario creado y copia su UUID.
4. En SQL Editor ejecuta, sustituyendo el UUID:

```sql
insert into public.afa_admins (user_id)
values ('PEGA-AQUI-EL-UUID');
```

Solo los usuarios cuyo UUID esté en `afa_admins` podrán consultar y gestionar socios. No habilites el registro público.

## Paso 3 — Configurar el envío de email
1. Crea una cuenta en https://resend.com/.
2. Verifica un dominio propio siguiendo las instrucciones de Resend. Para uso real, conviene enviar desde una dirección del AFA en ese dominio.
3. Copia la API Key de Resend.
4. Instala Supabase CLI siguiendo https://supabase.com/docs/guides/cli.
5. Inicia sesión y vincula este proyecto:

```bash
supabase login
supabase link --project-ref TU_PROJECT_REF
```

6. Configura los secretos (no los pongas en el HTML):

```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxxx
supabase secrets set FROM_EMAIL="AFA Colegio <carnets@tu-dominio.org>"
supabase secrets set AFA_NAME="AFA del Colegio"
```

7. Despliega la función desde la carpeta del proyecto:

```bash
supabase functions deploy send-card
```

La función comprueba la sesión y verifica que el usuario esté en `afa_admins` antes de enviar el correo.

## Paso 4 — Publicar la web en Netlify
1. Entra en https://www.netlify.com/.
2. Crea un sitio nuevo arrastrando la carpeta `gestor_afa` al área de despliegue manual de Netlify, o conecta un repositorio Git.
3. Comprueba que `index.html`, `styles.css`, `app.js` y `config.js` quedan en la raíz publicada.
4. Abre la URL de Netlify y prueba el inicio de sesión.

También puedes probarlo localmente abriendo `index.html`, aunque para un uso real se recomienda publicarlo bajo HTTPS.

## Paso 5 — Prueba antes de usarlo con familias
1. Inicia sesión con la cuenta administradora.
2. Añade un socio de prueba con un email que controles.
3. Abre su ficha y descarga el carnet PDF.
4. Comprueba que el QR aparece en el PDF.
5. Pulsa **Enviar carnet por email** y confirma la recepción.
6. Verifica que un usuario no autorizado no puede iniciar sesión ni acceder a la tabla.

## Protección de datos y uso responsable
- El AFA debe determinar la base jurídica, informar a las familias y definir los plazos de conservación conforme al RGPD y la LOPDGDD.
- No recojas el DNI salvo que exista una necesidad real y justificada.
- Limita el acceso a personas autorizadas y utiliza contraseñas únicas y robustas.
- Activa MFA para la cuenta administradora cuando sea posible.
- Revisa las condiciones de Supabase, Resend y el alojamiento respecto a ubicación de datos, encargados del tratamiento y transferencias internacionales.
- Configura copias de seguridad y prueba periódicamente la restauración.
- El QR incluido contiene un identificador interno y el número de socio; no incluye email, DNI, teléfono ni dirección.
- El carnet es identificativo, pero esta primera versión no valida el QR ni acredita por sí solo que una cuota esté pagada.

## Estructura
```text
gestor_afa/
├── index.html
├── styles.css
├── app.js
├── config.js
├── netlify.toml
├── README.md
└── supabase/
    ├── config.toml
    ├── schema.sql
    └── functions/
        └── send-card/
            └── index.ts
```
