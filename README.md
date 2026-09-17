# La Cancha del Profe

MVP de gestión de turnos para una cancha de pádel. Incluye portal de clientes, ubicación en Google Maps, agenda administrativa, dashboard de estadísticas, turnos fijos, caja básica y configuración.

## Stack

- Angular standalone y Tailwind CSS 4 para toda la interfaz.
- Node.js, Express, TypeScript y WebSocket (`ws`).
- MySQL 8, Prisma ORM.
- Redis Pub/Sub para distribuir invalidaciones en tiempo real entre instancias.
- JWT, bcrypt y roles `CLIENT`, `ADMIN`, `SUPERADMIN`.

## Requisitos

- Node.js 20 o superior.
- npm 10 o superior.
- MySQL 8 o Docker Desktop.

## Puesta en marcha

1. Preparar las variables locales e iniciar MySQL:

   ```powershell
   Copy-Item .env.example .env
   docker compose up -d
   ```

2. Preparar y ejecutar el backend:

   ```powershell
   cd backend
   Copy-Item .env.example .env
   npm install
   npm run prisma:generate
   npm run prisma:deploy
   npm run prisma:seed
   npm run dev
   ```

3. En otra terminal, iniciar el frontend:

   ```powershell
   cd frontend
   npm install
   npm start
   ```

4. Abrir `http://localhost:4200`. En desarrollo, Angular redirige `/api` a la API local mediante `frontend/proxy.conf.json`; su estado directo se comprueba en `http://localhost:3000/health`.

## Acceso inicial

El seed crea un `SUPERADMIN` con los valores de `SUPERADMIN_PHONE` y `SUPERADMIN_PASSWORD` del archivo `.env`. Definí valores locales propios y una clave `JWT_SECRET` larga y aleatoria; no publiques esos datos en el repositorio ni en la documentación.

También se crea la única cancha activa, precios iniciales para 60/90/120 minutos, horarios editables y una política inicial de cancelación online de 120 minutos. Los importes y reglas del seed son ejemplos editables desde el panel.

## La Liga

La ruta pública `/la-liga` muestra la Liga Suma 12 2026, su fixture, posiciones calculadas, eliminatorias y reglamento. La administración protegida está en `/admin/la-liga`. Los cambios se notifican por la misma conexión WebSocket del sistema y cada cliente vuelve a consultar la API para mantener la base de datos como fuente de verdad.

La migración crea el modelo de competencia y el seed idempotente carga las 16 parejas, las siete fechas de cada zona y el cuadro eliminatorio descriptos en `laliga.pdf`. Para volver a cargar solamente esos datos, sin tocar la configuración general de reservas, ejecutá:

```powershell
cd backend
npm run prisma:deploy
npm run prisma:seed:league
```

La temporada guarda `America/Argentina/Cordoba` como zona horaria. El puntaje de una derrota 0–2 y las reglas ambiguas permanecen sin definir hasta que un administrador las configure.

## Comandos útiles

Backend:

```powershell
npm run dev
npm run build
npm run prisma:migrate -- --name nombre_del_cambio
npm run prisma:deploy
npm run prisma:seed
npm run prisma:seed:league
```

Frontend:

```powershell
npm start
npm run build
```

## Reglas importantes

- Las fechas se interpretan en `APP_TIMEZONE` y se guardan como `DateTime` en MySQL.
- La validación de solapamiento usa `newStart < existingEnd && newEnd > existingStart` dentro de una transacción `REPEATABLE READ`, compatible con TiDB, y bloqueos `FOR UPDATE`.
- WebSocket funciona como aviso de invalidación; cada pantalla vuelve a consultar REST y la base de datos continúa siendo la fuente de verdad.
- Toda reserva debe comenzar en la grilla de 30 minutos calculada desde la apertura configurada.
- El sistema permite una sola cancha activa; las pantallas consultan su identificador y no dependen de que sea `1`.
- Un turno cancelado conserva su registro con estado `CANCELLED`.
- Los descansos de una jornada se configuran en los horarios, sin reglas ocultas por día.
- `phoneVerified` es la fuente de verdad para la identidad telefónica.
- Desactivar un cliente conserva su número e historial; liberar el número es una acción separada, irreversible y auditada.
- Una seña siempre incluye el importe cobrado y genera el movimiento de caja correspondiente.
- Los clientes pueden cancelar hasta el límite configurado por `SUPERADMIN`; inicialmente son 120 minutos.
- `GET /admin/dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD` concentra métricas de ocupación, reservas, clientes y caja.
- Desactivar un turno fijo cancela únicamente sus reservas futuras pendientes o confirmadas.
- `DELETE /admin/bookings/:id` es una cancelación lógica por compatibilidad con el endpoint solicitado.

## Estructura

```text
backend/
  prisma/          esquema, migraciones y seed
  src/
    middlewares/   autenticación, autorización y errores
    routes/        API pública, cliente y administración
    services/      autenticación y reglas de reservas
    utils/         fechas y errores HTTP
frontend/
  src/app/
    core/          API, sesión, interceptor y guards
    features/      pantallas públicas, cliente y admin
    shared/        componentes compartidos futuros
```

## Producción

Configurar HTTPS, una clave JWT larga, credenciales MySQL exclusivas, backups automáticos y el origen CORS real. `BUSINESS_WHATSAPP_PHONE` define el número de la cancha para los enlaces administrativos; el frontend conserva el contacto público en su configuración del establecimiento.

El frontend usa `/api` como ruta relativa. En Vercel Services, `vercel.json` envía `/api/*` al servicio Express conservando la ruta original, y el backend acepta tanto ese prefijo como las rutas sin prefijo usadas localmente. Configurá `FRONTEND_URL=https://lodelprofe.com.ar` en el backend. Esta topología mantiene la cookie HttpOnly como first-party y es compatible con `SameSite=Lax`; no se debe reemplazar `/api` por una URL de otro sitio registrable.

### Vercel Services

Cada servicio instala con `npm ci --workspaces=false --include=dev --include=optional`, usando su propio `package-lock.json`. El build verifica las dependencias locales mediante `npm run verify:runtime -- --service-local`. Vercel Services reubica `src/app.js` en la raíz de la función: tanto la raíz del repositorio como el backend declaran `type: module`, y `prepare:vercel` copia las dependencias del backend a `node_modules` en la raíz. La función incluye explícitamente ese directorio para que las importaciones sigan funcionando después del empaquetado.

Para conexiones a `*.tidbcloud.com`, el runtime y las migraciones agregan `sslaccept=strict` y `connect_timeout=20` si esas opciones no están configuradas. `prisma:deploy` reintenta hasta tres veces únicamente ante `P1001`; otros errores de migración detienen el build inmediatamente.

En la configuración del proyecto de Vercel, seleccioná **Services** como framework y cargá estas variables para Production:

- `NODE_ENV=production`
- `DATABASE_URL`: conexión MySQL remota, preferentemente mediante un endpoint con pooling compatible con funciones serverless.
- `JWT_SECRET`: valor largo, aleatorio y exclusivo de producción.
- `FRONTEND_URL=https://lodelprofe.com.ar` (o el dominio final asignado al proyecto).
- `PUBLIC_APP_URL=https://lodelprofe.com.ar`: origen fijo usado para construir los enlaces descartables de recuperación.
- `AUTH_COOKIE_NAME=padel_session`
- `AUTH_COOKIE_MAX_AGE_MS=604800000`
- `JWT_EXPIRES_IN=7d`
- `APP_TIMEZONE=America/Argentina/Buenos_Aires`
- `PASSWORD_RESET_TTL_MINUTES=15`
- `BUSINESS_WHATSAPP_PHONE`: número de WhatsApp de la cancha en formato internacional, sin espacios.
- `REALTIME_REDIS_URL`: URL TLS de Redis compartido (por ejemplo, la integración de Redis del marketplace de Vercel). Es necesaria para que los eventos crucen instancias.
- `REALTIME_REDIS_CHANNEL=lo-del-profe:realtime:v1`: canal Pub/Sub; puede conservarse el valor predeterminado.
- `REALTIME_HEARTBEAT_MS=30000`: intervalo de control de conexiones inactivas.

`VERCEL_URL` es provista automáticamente por Vercel y se agrega a los orígenes permitidos para que funcionen los previews. `PORT`, `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `SUPERADMIN_PHONE` y `SUPERADMIN_PASSWORD` no son variables de runtime requeridas en Vercel. Las dos últimas solo hacen falta al ejecutar el seed de forma controlada.

El build del backend ejecuta `prisma migrate deploy` antes de compilar. El registro crea una cuenta pendiente con un código aleatorio. Un SUPERADMIN debe comparar el código y el número remitente de WhatsApp, o registrar una comprobación por llamada/presencial. La recuperación de contraseña genera una solicitud administrativa; al autorizarla se abre WhatsApp hacia el teléfono guardado con un enlace de un solo uso y vencimiento corto.

Vercel admite WebSocket en Functions mediante soporte actualmente en beta. Las conexiones quedan fijadas a una instancia y terminan al alcanzar la duración máxima de esa Function; el cliente se reconecta con backoff y resincroniza por REST. Por eso producción debe habilitar Fluid compute y configurar `REALTIME_REDIS_URL`: sin un broker compartido, una sola instancia funciona, pero dos instancias no pueden difundir eventos entre sí.

El estado detallado de las funciones, decisiones tomadas y evolución propuesta se mantiene en [AUDITORIA_FUNCIONAL.md](AUDITORIA_FUNCIONAL.md).
