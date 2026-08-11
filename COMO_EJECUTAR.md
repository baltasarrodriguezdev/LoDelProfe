# Cómo ejecutar el proyecto

Esta guía explica cómo preparar y levantar localmente la base de datos, el backend y el frontend de **La Cancha del Profe** desde PowerShell.

## Requisitos

- Docker Desktop en ejecución.
- Node.js 20 o superior.
- npm 10 o superior.

Podés comprobar las versiones instaladas con:

```powershell
docker --version
node --version
npm --version
```

## Primera instalación

Todos los comandos parten desde la carpeta raíz del proyecto.

### 1. Levantar MySQL con Docker

```powershell
docker compose up -d
docker compose ps
```

El contenedor utiliza MySQL 8.4 y expone el puerto `3306`.

### 2. Preparar el backend

```powershell
cd backend
Copy-Item .env.example .env
npm install
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
+
```

Qué hace cada comando:

- `npm install`: instala las dependencias.
- `npm run prisma:generate`: genera el cliente de Prisma.
- `npm run prisma:deploy`: aplica a MySQL las migraciones existentes. No es `npm deploy`.
- `npm run prisma:seed`: carga los datos iniciales, incluido el usuario administrador configurado en `.env`.
- `npm run dev`: inicia la API en modo desarrollo y la reinicia al detectar cambios.

Antes de publicar el sistema, reemplazá `JWT_SECRET`, `SUPERADMIN_PHONE` y `SUPERADMIN_PASSWORD` en `backend/.env` por valores seguros.

### 3. Preparar el frontend

Abrí otra terminal en la raíz del proyecto y ejecutá:

```powershell
cd frontend
npm install
npm start
```

### 4. Comprobar el sistema

- Frontend: `http://localhost:4200`
- Backend: `http://localhost:3000`
- Estado de la API: `http://localhost:3000/health`

El frontend siempre llama a la ruta relativa `/api`. Durante `npm start`, Angular usa `frontend/proxy.conf.json` para reenviar esas solicitudes a `http://localhost:3000` y quitar el prefijo `/api`.

En Vercel Services, `/api/*` se entrega al backend conservando el prefijo y Express lo acepta directamente. En otros proveedores, el reverse proxy puede eliminar `/api` antes de reenviar porque el backend también conserva las rutas locales sin prefijo.

## Arranque diario

Después de completar la primera instalación, no hace falta reinstalar dependencias ni ejecutar el seed cada vez.

### Terminal 1: base de datos

Desde la raíz:

```powershell
docker compose up -d
```

### Terminal 2: backend

```powershell
cd backend
npm run dev
```

### Terminal 3: frontend

```powershell
cd frontend
npm start
```

## Comandos de Docker

Ejecutar desde la raíz del proyecto:

```powershell
# Ver el estado del contenedor
docker compose ps

# Ver los registros de MySQL
docker compose logs mysql

# Detener los servicios sin eliminarlos
docker compose stop

# Detener y eliminar los contenedores; conserva los datos de MySQL
docker compose down
```

El volumen `mysql_data` conserva la base de datos al ejecutar `docker compose down`. No agregues `-v` salvo que quieras borrar también todos los datos locales.

## Comandos del backend

Ejecutar dentro de `backend`:

```powershell
# Desarrollo
npm run dev

# Comprobar y compilar TypeScript
npm run build

# Ejecutar el backend previamente compilado
npm start

# Regenerar el cliente de Prisma
npm run prisma:generate

# Aplicar migraciones existentes
npm run prisma:deploy

# Crear y aplicar una migración durante el desarrollo
npm run prisma:migrate -- --name nombre_del_cambio

# Volver a cargar los datos iniciales
npm run prisma:seed
```

Usá `prisma:migrate` cuando modifiques el esquema de Prisma durante el desarrollo. Usá `prisma:deploy` para aplicar migraciones ya creadas, sin generar una migración nueva.

## Comandos del frontend

Ejecutar dentro de `frontend`:

```powershell
# Servidor de desarrollo
npm start

# Compilación de producción
npm run build

# Pruebas
npm test
```

## Detener el proyecto

Detené el backend y el frontend con `Ctrl+C` en sus respectivas terminales. Después, desde la raíz, detené MySQL:

```powershell
docker compose stop
```
