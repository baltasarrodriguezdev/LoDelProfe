# Acceso por email: contrato y transición

## Alcance

El acceso de clientes usa email y contraseña. El teléfono queda como dato de contacto y no prueba identidad. Los clientes anteriores actualizan el acceso sobre el mismo `User.id`, con su teléfono y contraseña existentes, y luego confirman un email.

La migración de Prisma es aditiva: conserva hashes, roles, bloqueos, reservas, turnos fijos, pagos, historial, campos telefónicos históricos y reservas de invitados sin `userId`.

## API de autenticación

Todas las respuestas de error tienen `{ "message": "...", "code": "..." }`, salvo errores de validación de Zod, que además pueden incluir `errors` por campo.

### Registro

```http
POST /api/auth/register
Content-Type: application/json
```

```json
{
  "firstName": "Ana",
  "lastName": "Pérez",
  "email": "ana@example.com",
  "phone": "3515551234",
  "password": "una-frase-larga"
}
```

Respuesta `201`: usuario público y cookie HttpOnly con alcance limitado a verificación. Esa sesión no puede consultar datos privados ni reservar. Errores relevantes: `EMAIL_ALREADY_REGISTERED`, `LEGACY_ACCOUNT_EXISTS`, `EMAIL_NOT_CONFIGURED`, `EMAIL_DELIVERY_FAILED`.

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "ana@example.com",
  "password": "una-frase-larga"
}
```

Requiere cuenta activa, no bloqueada y `emailVerifiedAt` definido. Devuelve cookie HttpOnly y cookie CSRF. Códigos: `INVALID_CREDENTIALS`, `CUSTOMER_INACTIVE`, `CUSTOMER_BLOCKED`, `EMAIL_NOT_VERIFIED`.

### Actualizar acceso de un cliente existente

```http
POST /api/auth/legacy-access
Content-Type: application/json

{
  "phone": "3515551234",
  "password": "contraseña-anterior",
  "email": "ana@example.com"
}
```

Respuesta genérica `202`. No crea ni fusiona usuarios: escribe el email en la misma cuenta solo después de comprobar el teléfono y el hash de contraseña anteriores. Mantiene ID, rol, bloqueo, estado activo, reservas e historial. Códigos: `INVALID_LEGACY_CREDENTIALS`, `EMAIL_ALREADY_REGISTERED`, `ACCESS_ALREADY_MIGRATED`.

### Reenviar confirmación

```http
POST /api/auth/email-verification/resend
Content-Type: application/json

{ "email": "ana@example.com" }
```

Respuesta `202` genérica. El reenvío invalida enlaces anteriores y tiene una espera configurada por `EMAIL_RESEND_COOLDOWN_SECONDS`.

### Confirmar email

El enlace abre `/confirmar-email#token=<token>`. La visita GET no consume el token; el frontend borra el fragmento del historial y pide una acción explícita.

```http
POST /api/auth/email-verification/confirm
Content-Type: application/json

{ "token": "<token>" }
```

El token aleatorio se guarda únicamente como SHA-256, está ligado al usuario, email, propósito y vencimiento, y se consume atómicamente. La confirmación incrementa `securityVersion`, por lo que invalida la sesión limitada iniciada antes de probar el email. Código de fallo: `INVALID_OR_EXPIRED_TOKEN`.

### Recuperación de contraseña

```http
POST /api/auth/password-reset-requests
Content-Type: application/json

{ "email": "ana@example.com" }
```

Siempre responde `202` con el mismo mensaje exista o no la cuenta. La espera de reenvío tampoco revela existencia.

```http
POST /api/auth/password-reset
Content-Type: application/json

{
  "token": "<token>",
  "password": "una-frase-nueva"
}
```

Consume el token una vez, reemplaza el hash e incrementa `securityVersion` para revocar sesiones. El aviso posterior por email es de mejor esfuerzo y no revierte una contraseña ya cambiada.

## Reglas para reservar

Las nuevas reservas de autoservicio, tanto web como bot, exigen cuenta activa, sin bloqueo y email confirmado. La web crea `CONFIRMED` directamente. No se crean nuevas retenciones por falta de verificación telefónica ni se exige WhatsApp para reservar en la web.

Los `PENDING` anteriores conservan su vencimiento y las reservas ya confirmadas siguen válidas. Las reservas de invitados se conservan sin reasignación automática.

Los límites de 2 reservas futuras y 4 creaciones diarias siguen siendo exclusivos del bot. No se aplican a la web ni a turnos fijos.

## Adaptador de correo

En desarrollo, `EMAIL_PROVIDER=local` guarda los mensajes solo en memoria para pruebas automatizadas. No imprime tokens y está deshabilitado cuando `NODE_ENV=production`.

En producción se usa `EMAIL_PROVIDER=http`. El backend hace:

```http
POST <EMAIL_API_URL>
Authorization: Bearer <EMAIL_API_KEY>
Content-Type: application/json
```

```json
{
  "from": "Lo del Profe <no-responder@dominio-verificado>",
  "to": "destinatario@example.com",
  "subject": "Asunto",
  "text": "Versión texto",
  "html": "<p>Versión HTML</p>"
}
```

El endpoint debe responder con HTTP 2xx. Si la configuración falta o el proveedor falla, producción devuelve un error y nunca confirma cuentas ni simula un envío exitoso. Antes de desplegar hay que elegir un proveedor cuyo endpoint acepte este contrato o implementar su adaptador específico.

## Variables de entorno

Obligatorias o recomendadas para este cambio:

- `PUBLIC_APP_URL`: origen HTTPS del frontend usado en enlaces.
- `EMAIL_PROVIDER=http` en producción.
- `EMAIL_API_URL`: endpoint del proveedor.
- `EMAIL_API_KEY`: secreto del proveedor; no registrar ni incluir en reportes.
- `EMAIL_FROM`: remitente de un dominio validado.
- `EMAIL_VERIFICATION_TTL_MINUTES` (predeterminado: 30).
- `PASSWORD_RESET_TTL_MINUTES` (predeterminado: 15).
- `EMAIL_RESEND_COOLDOWN_SECONDS` (predeterminado: 60).
- `WHATSAPP_LINK_TTL_MINUTES` (predeterminado: 10).
- `BOT_API_KEY`: credencial exclusiva de n8n.
- `APP_TIMEZONE` (predeterminado: `America/Argentina/Buenos_Aires`).
- Las variables existentes `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, cookies, Redis y Web Push se conservan.

Generación de secretos sin mostrarlos en un reporte:

```bash
openssl rand -base64 48
```

Guardar la salida directamente en el gestor de secretos del servidor; no pegarla en commits, tickets o chats.

## Despliegue propuesto (no ejecutado)

1. Adaptar n8n al contrato de [bot-api.md](bot-api.md), validar el webhook del proveedor y probarlo en staging.
2. Configurar y verificar dominio/remitente del proveedor de correo en staging.
3. Ensayar la migración con una copia anonimizada y comprobar cantidades de usuarios, reservas, relaciones, roles y bloqueos.
4. Programar una ventana corta. Pausar nuevas altas y reservas mientras se toma el backup consistente.
5. Hacer backup de MySQL y verificar que puede restaurarse en una base separada.
6. Desplegar primero la migración aditiva `20261016000000_add_email_auth_and_whatsapp_links` con `prisma migrate deploy`.
7. Cargar las variables secretas y levantar la versión nueva en un slot privado, todavía sin dirigirle el tráfico público.
8. Desde ese slot, cada `SUPERADMIN`/`ADMIN` usa “Ya era cliente”, confirma su email y comprueba el panel. No cargar emails administrativamente ni cambiar sus IDs, roles o hashes.
9. Ejecutar smoke tests: registro, email, login, recuperación, reserva web, vinculación, reserva/cancelación bot, panel y disponibilidad.
10. Cambiar el tráfico de backend y frontend en conjunto. El corte invalida los JWT emitidos por el login telefónico anterior.
11. Reabrir operaciones y vigilar errores de correo, autenticación, reservas e idempotencia.

No ejecutar el seed en producción como parte de este cambio.

## Reversión sin perder reservas

La migración no borra columnas ni datos, por lo que el binario anterior puede volver a ejecutarse ignorando las tablas nuevas.

1. Pausar altas y operaciones de autoservicio, pero conservar consulta administrativa si es segura.
2. Volver a la imagen anterior de backend/frontend.
3. No restaurar el backup sobre la base activa: eso borraría reservas creadas después del backup.
4. Mantener las columnas/tablas aditivas. Revertirlas solo en una migración posterior y después de comprobar que no contienen datos necesarios.
5. Si hay que recuperar una base dañada, restaurar primero en una instancia separada y reconciliar las reservas posteriores antes de cualquier sustitución.
6. Corregir y reintentar el despliegue; no habilitar usuarios sin verificación como atajo.

## Pendientes externos

- Identificar el proveedor y workflow real de n8n y configurar la verificación de su webhook.
- Elegir el servicio de correo y confirmar que su API acepta el contrato del adaptador HTTP, además de validar el dominio remitente.
- Ejecutar una migración controlada de administradores durante el corte.
