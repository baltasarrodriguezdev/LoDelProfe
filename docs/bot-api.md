# API del bot de WhatsApp

Contrato para la integración servidor a servidor entre n8n y Lo del Profe. Esta API usa la misma base MySQL y el mismo servicio de reservas que la web y el panel administrativo.

## Conexión

- URL base de producción: `https://api.lodelprofe.com/api/bot`
- Header obligatorio: `x-api-key: <valor>`
- Variable de entorno del backend: `BOT_API_KEY`
- Content-Type para `POST` y `PATCH`: `application/json`
- Zona horaria de fechas y horarios: `APP_TIMEZONE` (`America/Argentina/Buenos_Aires` por defecto)

No se debe enviar un JWT de usuario o administrador. La API key no debe incluirse en logs, URLs ni mensajes de WhatsApp.

## Teléfonos

Se aceptan las variantes argentinas `549XXXXXXXXXX`, `54XXXXXXXXXX`, `+549XXXXXXXXXX`, `+54XXXXXXXXXX` y los 10 dígitos nacionales. El backend las normaliza a los 10 dígitos nacionales antes de buscar usuarios y reservas.

Las búsquedas contemplan formatos históricos en `users.phone` y `bookings.clientPhone`.

## 1. Consultar cliente

```http
GET /api/bot/customer?phone=5493576000000
x-api-key: <valor>
```

Cliente registrado:

```json
{
  "exists": true,
  "firstName": "Ana"
}
```

Cliente sin cuenta:

```json
{
  "exists": false,
  "firstName": null
}
```

No devuelve apellido, ID, rol, estado, teléfono ni ningún otro dato del usuario.

## 2. Consultar reservas futuras

```http
GET /api/bot/bookings?phone=5493576000000
x-api-key: <valor>
```

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
    },
    {
      "id": 124,
      "status": "PENDING",
      "date": "2026-10-21",
      "startTime": "20:00",
      "durationMinutes": 60,
      "priceTotal": 16000,
      "pendingApproval": true,
      "holdExpiresAt": "2026-10-21T22:50:00.000Z"
    }
  ]
}
```

Devuelve únicamente reservas futuras que continúan activas: confirmadas, pendientes cuyo hold no venció y estados operativos futuros que todavía bloquean la cancha. No devuelve reservas canceladas ni pendientes vencidas.

Si no hay resultados:

```json
{
  "bookings": []
}
```

## 3. Crear reserva

```http
POST /api/bot/bookings
x-api-key: <valor>
Content-Type: application/json
```

Cliente sin cuenta:

```json
{
  "phone": "5493576000000",
  "name": "Ana",
  "date": "2026-10-20",
  "startTime": "18:30",
  "durationMinutes": 90,
  "playersCount": 4,
  "idempotencyKey": "meta-event-id-unico"
}
```

Cliente registrado, sin volver a pedirle el nombre:

```json
{
  "phone": "5493576000000",
  "date": "2026-10-20",
  "startTime": "18:30",
  "durationMinutes": 90,
  "idempotencyKey": "meta-event-id-unico"
}
```

Campos:

| Campo | Tipo | Obligatorio | Regla |
|---|---|---|---|
| `phone` | string | Sí | Teléfono argentino válido. |
| `name` | string | Sólo sin cuenta | De 1 a 60 caracteres después de `trim`; no admite caracteres de control. Si existe el usuario, se ignora y se usan sus datos guardados. |
| `date` | string | Sí | `YYYY-MM-DD`. |
| `startTime` | string | Sí | `HH:mm`, en `APP_TIMEZONE`. |
| `durationMinutes` | integer | Sí | Entero positivo con precio activo; actualmente 60, 90 o 120. |
| `playersCount` | integer | No | De 1 a 12; por defecto 4. |
| `idempotencyKey` | string | Sí | De 1 a 200 caracteres, única para el evento de Meta/n8n. |

Primera creación (`201 Created`):

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

Reintento con la misma `idempotencyKey` y los mismos datos (`200 OK`):

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
  "idempotentReplay": true
}
```

Reglas del estado inicial:

- Cliente sin cuenta: `CONFIRMED`; WhatsApp se considera verificación del teléfono. No se crea un usuario web.
- Usuario web con `phoneVerified=true`: `CONFIRMED` y vinculado mediante `userId`.
- Usuario web con `phoneVerified=false`: `PENDING`, con un hold de 10 minutos, igual que en la web.
- Usuario bloqueado o inactivo: creación rechazada; no se lo convierte en invitado.
- `origin` siempre queda guardado como `WHATSAPP`.

Límites por teléfono:

- Máximo 2 reservas futuras activas, incluyendo reservas hechas por web, bot o panel que correspondan al teléfono.
- Máximo 4 creaciones exitosas mediante el bot por día calendario de `APP_TIMEZONE`.
- El límite diario cuenta reservas luego canceladas.
- Un reintento idempotente no vuelve a contar.

La creación revalida en el backend cancha activa, precio, día y horario de apertura, grilla de 30 minutos, fecha futura, solapamientos y `DEAD_GAP`.

## 4. Cancelar reserva

```http
PATCH /api/bot/bookings/123/cancel
x-api-key: <valor>
Content-Type: application/json
```

```json
{
  "phone": "5493576000000"
}
```

Respuesta (`200 OK`):

```json
{
  "id": 123,
  "status": "CANCELLED",
  "message": "La reserva fue cancelada."
}
```

La cancelación sólo encuentra la reserva cuando el teléfono coincide con el usuario vinculado o con `bookings.clientPhone`. Para una reserva inexistente y una reserva ajena se devuelve exactamente el mismo `404`.

Reglas:

- Sólo reservas futuras `PENDING` o `CONFIRMED`.
- Una reserva `PENDING` futura puede cancelarse aunque esté dentro del cutoff.
- Una reserva `CONFIRMED` respeta `venue_settings.cancellationCutoffMinutes`, actualmente 120 minutos.

## Disponibilidad pública usada antes de crear

n8n puede consultar:

```http
GET https://api.lodelprofe.com/api/availability?date=2026-10-20&duration=90&courtId=1
```

Este endpoint sigue siendo público. Ahora devuelve `404 COURT_NOT_FOUND` si `courtId` no existe o está inactiva. La respuesta de disponibilidad es orientativa: `POST /api/bot/bookings` siempre vuelve a validar todo dentro de una transacción.

## Formato de errores

Los errores del bot tienen un mensaje legible y un código estable:

```json
{
  "message": "Ese horario ya no está disponible. Elegí otro turno.",
  "code": "SLOT_UNAVAILABLE"
}
```

| HTTP | `code` | Significado |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | Body, query, ID o formato de campo inválido. |
| 400 | `INVALID_PHONE` | El teléfono no pudo normalizarse como teléfono argentino. |
| 400 | `NAME_REQUIRED` | Cliente sin cuenta y sin nombre. |
| 400 | `DURATION_NOT_AVAILABLE` | No existe un precio activo para la duración. |
| 400 | `COURT_CLOSED` | El día no está habilitado. |
| 400 | `PAST_START_TIME` | Fecha u hora pasada. |
| 400 | `OUTSIDE_BUSINESS_HOURS` | El turno no cabe en un intervalo de apertura. |
| 400 | `INVALID_START_TIME` | La hora no respeta la grilla de 30 minutos. |
| 400 | `INVALID_BUSINESS_HOURS` | La configuración de apertura/descanso es inconsistente. |
| 401 | `BOT_UNAUTHORIZED` | Falta `x-api-key` o no coincide con `BOT_API_KEY`. |
| 403 | `CUSTOMER_BLOCKED` | La cuenta encontrada está bloqueada. |
| 403 | `CUSTOMER_INACTIVE` | La cuenta encontrada está inactiva. |
| 404 | `BOOKING_NOT_FOUND` | Reserva inexistente o perteneciente a otro teléfono. |
| 404 | `COURT_NOT_FOUND` | No hay cancha activa disponible para crear o consultar. |
| 409 | `SLOT_UNAVAILABLE` | Otro turno ocupa total o parcialmente el horario. |
| 409 | `DEAD_GAP` | La reserva dejaría un hueco menor de 60 minutos. |
| 409 | `PHONE_ACTIVE_BOOKING_LIMIT` | El teléfono ya tiene 2 reservas futuras activas. |
| 409 | `PENDING_BOOKING_EXISTS` | El usuario no verificado ya tiene una solicitud pendiente activa. |
| 409 | `IDEMPOTENCY_KEY_REUSED` | La clave ya se utilizó con otro payload normalizado. |
| 409 | `IDEMPOTENCY_IN_PROGRESS` | La misma solicitud todavía está terminando de procesarse. |
| 409 | `CANCELLATION_NOT_ALLOWED` | Estado o fecha que ya no admiten cancelación. |
| 409 | `CANCELLATION_CUTOFF` | Reserva confirmada dentro del plazo de no cancelación. |
| 429 | `PHONE_DAILY_BOOKING_LIMIT` | El teléfono ya creó 4 reservas mediante el bot ese día. |
| 429 | `RATE_LIMITED` | Más de 120 solicitudes por minuto desde la misma IP. |
| 500 | `INTERNAL_ERROR` | Error interno sin detalles sensibles. |

Los precios, horarios, cutoff y duraciones activas pueden cambiar desde el panel. n8n no debe hardcodearlos ni interpretar un slot como reservado hasta que `POST /api/bot/bookings` responda exitosamente.
