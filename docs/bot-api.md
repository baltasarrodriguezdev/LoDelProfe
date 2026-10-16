# API del bot de WhatsApp

Contrato para la integración servidor a servidor entre n8n y Lo del Profe. La API usa la misma base MySQL y el mismo servicio de reservas que la web y el panel.

> Cambio incompatible pendiente de coordinación: el contrato anterior aceptaba `phone`, invitados y reservas `PENDING`. El contrato nuevo requiere una cuenta activa, email confirmado y una vinculación de WhatsApp confirmada. Adaptar y publicar el workflow de n8n antes de activar este backend en producción.

## Conexión y confianza

- URL base prevista: `https://api.lodelprofe.com/api/bot`
- Header obligatorio: `x-api-key: <valor>`
- Variable secreta del backend: `BOT_API_KEY`
- `Content-Type: application/json` para `POST` y `PATCH`
- Zona horaria: `APP_TIMEZONE` (`America/Argentina/Buenos_Aires` por defecto)
- Límite: 120 solicitudes por minuto y por IP, en memoria

La API key autentica a n8n, no al cliente. `senderPhone` debe salir exclusivamente del remitente del webhook autenticado por el proveedor de WhatsApp. Nunca debe salir del texto, un campo escrito por el usuario ni una decisión del modelo. n8n debe validar la autenticidad del webhook antes de llamar a esta API.

No enviar JWT de clientes o administradores. No registrar la API key, tokens, texto de mensajes ni teléfonos completos. La aplicación no guarda el texto de la conversación.

## Requisitos del cliente

Para consultar, crear o cancelar reservas, el remitente debe tener una cuenta activa y no bloqueada, el email confirmado y una vinculación de WhatsApp verificada y confirmada por el usuario en la web.

Una coincidencia con `users.phone` no vincula una cuenta. Las reservas históricas de invitados con `userId = null` se conservan, pero no se reasignan por teléfono.

Se aceptan `549XXXXXXXXXX`, `54XXXXXXXXXX`, sus variantes con `+` y diez dígitos nacionales. El backend normaliza el valor a E.164 para la vinculación y a diez dígitos para los campos históricos de reservas.

## Vinculación segura

### 1. Crear el desafío desde la sesión web

```http
POST /api/auth/whatsapp-link/challenges
Cookie: padel_session=<sesión del usuario>
X-CSRF-Token: <token CSRF>
```

Respuesta `201`:

```json
{
  "challenge": "desafio-aleatorio-de-un-solo-uso",
  "expiresAt": "2026-10-16T18:10:00.000Z"
}
```

El desafío vence según `WHATSAPP_LINK_TTL_MINUTES` y el valor anterior se invalida al generar uno nuevo.

### 2. Reclamar el desafío desde n8n

Solo después de validar el webhook y tomar el remitente real:

```http
POST /api/bot/link/claim
x-api-key: <valor>
Content-Type: application/json
```

```json
{
  "challenge": "desafio-aleatorio-de-un-solo-uso",
  "senderPhone": "5493576000000",
  "provider": "meta",
  "providerEventId": "wamid.identificador-unico"
}
```

Respuesta `200`:

```json
{
  "linked": false,
  "pendingWebConfirmation": true
}
```

El remitente debe coincidir con el teléfono de contacto de la cuenta. El desafío se reclama atómicamente y `providerEventId` se deduplica.

### 3. Confirmar en la sesión web

```http
POST /api/auth/whatsapp-link/confirm
Cookie: padel_session=<sesión del usuario>
X-CSRF-Token: <token CSRF>
```

Respuesta `200`:

```json
{
  "linked": true,
  "phone": "••••••0000"
}
```

La web consulta el estado con `GET /api/auth/whatsapp-link`. El backend nunca simula la recepción del evento de WhatsApp. Falta configurar en n8n el proveedor real y su validación de firma.

## 1. Consultar cliente

```http
GET /api/bot/customer?senderPhone=5493576000000
x-api-key: <valor>
```

Cuenta vinculada y lista:

```json
{
  "exists": true,
  "linked": true,
  "emailVerified": true,
  "firstName": "Ana",
  "action": null
}
```

Sin vinculación:

```json
{
  "exists": false,
  "linked": false,
  "emailVerified": false,
  "firstName": null,
  "action": "COMPLETE_REGISTRATION"
}
```

Vinculada pero sin email confirmado:

```json
{
  "exists": true,
  "linked": true,
  "emailVerified": false,
  "firstName": "Ana",
  "action": "VERIFY_EMAIL"
}
```

No devuelve ID, apellido, rol, email ni teléfono.

## 2. Consultar reservas futuras

```http
GET /api/bot/bookings?senderPhone=5493576000000
x-api-key: <valor>
```

Respuesta `200`:

```json
{
  "bookings": [
    {
      "id": 123,
      "status": "CONFIRMED",
      "date": "2026-10-20",
      "startTime": "18:30",
      "durationMinutes": 90,
      "priceTotal": 20000,
      "pendingApproval": false,
      "holdExpiresAt": null
    }
  ]
}
```

Busca exclusivamente por el `userId` de la vinculación confirmada. Devuelve reservas futuras activas; no incorpora reservas de invitados por coincidencia de teléfono.

## 3. Crear reserva

```http
POST /api/bot/bookings
x-api-key: <valor>
Content-Type: application/json
```

```json
{
  "senderPhone": "5493576000000",
  "date": "2026-10-20",
  "startTime": "18:30",
  "durationMinutes": 90,
  "playersCount": 4,
  "idempotencyKey": "wamid.identificador-unico"
}
```

| Campo | Tipo | Obligatorio | Regla |
|---|---|---:|---|
| `senderPhone` | string | Sí | Remitente del webhook autenticado. |
| `date` | string | Sí | `YYYY-MM-DD` en `APP_TIMEZONE`. |
| `startTime` | string | Sí | `HH:mm`. |
| `durationMinutes` | integer | Sí | Debe tener un precio activo; hoy se configuran 60, 90 y 120. |
| `playersCount` | integer | No | 1 a 12; por defecto 4. |
| `idempotencyKey` | string | Sí | 1 a 200 caracteres, estable y única por operación. Se recomienda el ID del evento más el tipo de operación. |

Primera creación, `201`:

```json
{
  "id": 123,
  "status": "CONFIRMED",
  "date": "2026-10-20",
  "startTime": "18:30",
  "durationMinutes": 90,
  "priceTotal": 20000,
  "pendingApproval": false,
  "holdExpiresAt": null,
  "idempotentReplay": false
}
```

Reintento idéntico, `200`, con los mismos datos e `idempotentReplay: true`.

La reserva queda asociada al usuario, con `origin = WHATSAPP`, `createdBy = null` y estado `CONFIRMED`. Se muestra en el panel, en “Mis turnos” y bloquea inmediatamente la disponibilidad. Se revalidan cancha activa, precio, apertura, grilla de 30 minutos, horario pasado, solapamientos y `DEAD_GAP` dentro de la operación transaccional.

Límites exclusivos del bot, sin extenderlos a web ni turnos fijos:

- máximo 2 reservas futuras activas del usuario, aunque provengan de otros canales;
- máximo 4 creaciones exitosas mediante el bot por día de `APP_TIMEZONE`;
- las canceladas siguen contando en el límite diario;
- un reintento idempotente no vuelve a contar.

## 4. Cancelar reserva

```http
PATCH /api/bot/bookings/123/cancel
x-api-key: <valor>
Content-Type: application/json
```

```json
{
  "senderPhone": "5493576000000"
}
```

Respuesta `200`:

```json
{
  "id": 123,
  "status": "CANCELLED",
  "message": "La reserva fue cancelada."
}
```

Solo encuentra reservas cuyo `userId` coincide con la cuenta vinculada. Una reserva ajena y una inexistente producen el mismo `404`. Las confirmadas respetan `venue_settings.cancellationCutoffMinutes`; las retenciones históricas pendientes conservan su tratamiento actual.

## Disponibilidad pública

```http
GET https://api.lodelprofe.com/api/availability?date=2026-10-20&duration=90&courtId=1
```

Es orientativa. La creación siempre revalida dentro de una transacción. Una cancha inexistente o inactiva devuelve `404 COURT_NOT_FOUND`.

## Errores

Formato general:

```json
{
  "message": "Ese horario ya no está disponible. Elegí otro turno.",
  "code": "SLOT_UNAVAILABLE"
}
```

| HTTP | `code` | Uso |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | Body, query, ID o formato inválido. |
| 400 | `INVALID_PHONE` | `senderPhone` no es un teléfono argentino válido. |
| 400 | `DURATION_NOT_AVAILABLE` | No hay precio activo para la duración. |
| 400 | `COURT_CLOSED` | Día cerrado. |
| 400 | `PAST_START_TIME` | Fecha u hora pasada. |
| 400 | `OUTSIDE_BUSINESS_HOURS` | Fuera del horario de apertura. |
| 400 | `INVALID_START_TIME` | Hora fuera de la grilla. |
| 400 | `INVALID_BUSINESS_HOURS` | Configuración horaria inconsistente. |
| 400 | `INVALID_LINK_CHALLENGE` | Desafío de vinculación inválido o vencido. |
| 401 | `BOT_UNAUTHORIZED` | Falta o no coincide `x-api-key`. |
| 403 | `WHATSAPP_NOT_LINKED` | No hay vinculación confirmada. |
| 403 | `EMAIL_NOT_VERIFIED` | Falta confirmar el email. |
| 403 | `CUSTOMER_BLOCKED` | Cuenta bloqueada. |
| 403 | `CUSTOMER_INACTIVE` | Cuenta inactiva. |
| 403 | `CUSTOMER_NOT_ELIGIBLE` | La cuenta no puede completar la vinculación. |
| 404 | `BOOKING_NOT_FOUND` | Reserva inexistente o ajena. |
| 404 | `COURT_NOT_FOUND` | No existe una cancha activa. |
| 409 | `WHATSAPP_PHONE_MISMATCH` | El remitente no coincide con el contacto. |
| 409 | `WHATSAPP_ALREADY_LINKED` | El número ya está vinculado a otra cuenta. |
| 409 | `LINK_NOT_CLAIMED` | La web confirmó antes del evento autenticado. |
| 409 | `LINK_CHALLENGE_ALREADY_CLAIMED` | Otro evento ya reclamó el desafío. |
| 409 | `PROVIDER_EVENT_REPLAY` | `providerEventId` ya fue procesado. |
| 409 | `SLOT_UNAVAILABLE` | Horario ocupado total o parcialmente. |
| 409 | `DEAD_GAP` | La reserva dejaría un hueco menor al permitido. |
| 409 | `PHONE_ACTIVE_BOOKING_LIMIT` | Ya existen 2 reservas futuras activas. |
| 409 | `IDEMPOTENCY_KEY_REUSED` | Clave usada con otro payload normalizado. |
| 409 | `IDEMPOTENCY_IN_PROGRESS` | La solicitud idéntica todavía se procesa. |
| 409 | `CANCELLATION_NOT_ALLOWED` | Estado o fecha no cancelable. |
| 409 | `CANCELLATION_CUTOFF` | Dentro del plazo de no cancelación. |
| 429 | `PHONE_DAILY_BOOKING_LIMIT` | Ya hubo 4 creaciones exitosas por bot ese día. |
| 429 | `RATE_LIMITED` | Más de 120 solicitudes por minuto desde la IP. |
| 500 | `INTERNAL_ERROR` | Error interno, sin detalles sensibles. |

## Adaptación requerida en n8n

1. Verificar la firma/autenticidad del webhook según el proveedor real.
2. Extraer `senderPhone` del remitente verificado y `providerEventId` del ID del proveedor.
3. Implementar `VINCULAR <challenge>` llamando a `/link/claim`.
4. Ante `COMPLETE_REGISTRATION`, `WHATSAPP_NOT_LINKED` o `EMAIL_NOT_VERIFIED`, enviar un enlace a la web; no crear reservas de invitado.
5. Cambiar `phone` por `senderPhone` y quitar `name`.
6. Conservar la misma `idempotencyKey` al reintentar.
7. No activar este backend en producción hasta publicar y probar el workflow compatible.
