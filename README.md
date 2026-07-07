# La Cancha del Profe

MVP de gestión de turnos para una cancha de pádel. Incluye portal de clientes, ubicación en Google Maps, agenda administrativa, dashboard de estadísticas, turnos fijos, caja básica y configuración.

## Stack

- Angular standalone y CSS mobile first.
- Node.js, Express y TypeScript.
- MySQL 8, Prisma ORM.
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

También se crean `Cancha 1`, precios iniciales para 60/90/120 minutos y horarios de lunes a viernes de 12:00 a 00:00, y fines de semana de 09:00 a 00:00. Los importes del seed son ejemplos editables desde el panel.

## Comandos útiles

Backend:

```powershell
npm run dev
npm run build
npm run prisma:migrate -- --name nombre_del_cambio
npm run prisma:deploy
npm run prisma:seed
```

Frontend:

```powershell
npm start
npm run build
```

## Reglas importantes

- Las fechas se interpretan en `APP_TIMEZONE` y se guardan como `DateTime` en MySQL.
- La validación de solapamiento usa `newStart < existingEnd && newEnd > existingStart` dentro de una transacción serializable.
- Un turno cancelado conserva su registro con estado `CANCELLED`.
- La disponibilidad pública expone solamente horario y estado disponible/ocupado.
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

Configurar HTTPS, una clave JWT larga, credenciales MySQL exclusivas, backups automáticos y el origen CORS real. El número destino de WhatsApp puede incorporarse cuando el negocio lo defina; actualmente el botón abre el selector de contacto con el mensaje ya preparado.

El frontend usa `/api` como ruta relativa. En Vercel Services, `vercel.json` envía `/api/*` al servicio Express conservando la ruta original, y el backend acepta tanto ese prefijo como las rutas sin prefijo usadas localmente. Configurá `FRONTEND_URL=https://lodelprofe.com.ar` en el backend. Esta topología mantiene la cookie HttpOnly como first-party y es compatible con `SameSite=Lax`; no se debe reemplazar `/api` por una URL de otro sitio registrable.

### Vercel Services

En la configuración del proyecto de Vercel, seleccioná **Services** como framework y cargá estas variables para Production:

- `NODE_ENV=production`
- `DATABASE_URL`: conexión MySQL remota, preferentemente mediante un endpoint con pooling compatible con funciones serverless.
- `JWT_SECRET`: valor largo, aleatorio y exclusivo de producción.
- `FRONTEND_URL=https://lodelprofe.com.ar` (o el dominio final asignado al proyecto).
- `AUTH_COOKIE_NAME=padel_session`
- `AUTH_COOKIE_MAX_AGE_MS=604800000`
- `JWT_EXPIRES_IN=7d`
- `APP_TIMEZONE=America/Argentina/Buenos_Aires`
- `TWILIO_ACCOUNT_SID`: identificador de la cuenta de Twilio.
- `TWILIO_AUTH_TOKEN`: secreto de Twilio; cargar únicamente como variable protegida.
- `TWILIO_VERIFY_SERVICE_SID`: servicio de Verify usado para enviar códigos SMS.

`VERCEL_URL` es provista automáticamente por Vercel y se agrega a los orígenes permitidos para que funcionen los previews. `PORT`, `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `SUPERADMIN_PHONE` y `SUPERADMIN_PASSWORD` no son variables de runtime requeridas en Vercel. Las dos últimas solo hacen falta al ejecutar el seed de forma controlada.

El build del servicio backend ejecuta `prisma migrate deploy` antes de compilar, por lo que el primer deploy con verificación SMS crea `pending_registrations` automáticamente. El registro solicita un número internacional en formato E.164, envía el código con Twilio Verify y crea la cuenta únicamente después de que Twilio lo aprueba.
