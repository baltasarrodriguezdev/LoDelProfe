# Corrección de consumo persistente en Vercel

Base: `e9e5e8e28aeae1719fd10504fa0afe7d87c2edcf`.
Rama: `fix/screen-polling-no-websocket`.
No se hizo deploy, push ni modificación de la base de datos.

## Implementación

1. Se retiró el transporte WebSocket del frontend y del HTTP server backend.
2. Se retiraron heartbeat, reconexión y el refresco global de 60 segundos.
3. Redis ya no se importa ni conecta desde el publicador de eventos. Los eventos
   internos y sus efectos de negocio mantienen las interfaces existentes.
4. Cada pantalla dinámica posee una suscripción de polling de 60 segundos.
   Ocultarla o quedar offline elimina su timer; destruirla elimina timer y listeners.
   Al volver, refresca una vez si transcurrió el intervalo. No superpone ciclos.
5. El coordinador espera que terminen las consultas REST registradas por `Api`
   antes de iniciar el ciclo y antes de programar el siguiente intervalo.
6. GET simultáneos con el mismo endpoint y parámetros comparten la consulta.
   Los stores y las vistas de horarios también reutilizan solicitudes idénticas.
7. Los stores globales se activan/desactivan por consumidor; el caché puede
   permanecer después de salir de la pantalla, pero no continúa su refresco.
8. Precios y canchas tienen caché en memoria de cinco minutos, invalidada después
   de una mutación exitosa. El polling de reservas consulta sólo disponibilidad.
9. Mis turnos carga ambas secciones al entrar; después consulta únicamente
   `/bookings/my` o `/bookings/my/history`, según la sección visible.
10. La autenticación se restaura al iniciar y se revalida por demanda. Las pantallas
    con polling comprueban una sesión autenticada como máximo cada 15 minutos.
    La verificación pendiente conserva comprobaciones de sesión cada 60 segundos
    únicamente en las pantallas donde esa comprobación es funcionalmente necesaria.
11. Se conservaron countdowns y `nextChangeAt`; se impiden consultas por vencimientos
    en background y se evita reiniciar una consulta idéntica que está en curso.
12. Web Push sigue enviándose desde backend al crear/cancelar reservas y registrar
    usuarios pendientes. No requiere panel, pestaña ni socket administrativo abierto.

No se cambiaron plantillas HTML, CSS, esquema, migraciones, Dockerfile ni vercel.json.
No se migró el runtime container ni se agregaron dependencias.

## Archivos de producción y herramientas modificados

| Archivo | Cambio |
|---|---|
| `.gitignore` | Ignorar metadata local `.vercel/`. |
| `backend/src/server.ts` | Desconectar servidor WebSocket y shutdown Redis. |
| `backend/src/realtime/server.ts` | Eliminado: upgrade, sockets y heartbeat. |
| `backend/src/realtime/events.ts` | Retirar Redis; conservar eventos internos y Web Push. |
| `backend/src/app.ts` | Retirar ruta que anunciaba upgrade; ahora `/api/realtime` devuelve 404. |
| `backend/scripts/smoke-api.mjs` | Comprobar 404 y retirar shutdown del broker eliminado. |
| `backend/scripts/smoke-entrypoint.mjs` | Comprobar 404 durante startup real del container. |
| `frontend/src/app/app.component.ts` | Retirar inicio global y refresco global de auth. |
| `frontend/src/app/core/realtime.ts` | Adaptador compatible de eventos locales y polling por suscripción; sin socket. |
| `frontend/src/app/core/screen-polling.ts` | Nuevo scheduler por pantalla, visible/online, sin ciclos superpuestos. |
| `frontend/src/app/core/api.ts` | Coordinar solicitudes, caché pública, cambios locales y auth espaciada. |
| `frontend/src/app/features/admin/admin-agenda-store.ts` | Activación por consumidor y deduplicación forzada. |
| `frontend/src/app/features/admin/admin-agenda-page.ts` | Activar store y polling de la agenda mostrada; detener al salir. |
| `frontend/src/app/features/admin/admin-dashboard-page.ts` | Activar store; polling operativo; guardas de consultas y vencimientos. |
| `frontend/src/app/features/admin/admin-booking-form-page.ts` | Polling de disponibilidad sin recargar referencias; deduplicación. |
| `frontend/src/app/features/admin/admin-clients-page.ts` | Polling sólo mientras está montada y visible. |
| `frontend/src/app/features/admin/admin-security-page.ts` | Polling visible de pendientes/recuperaciones/auditoría y limpieza de HTTP reads. |
| `frontend/src/app/features/admin/admin-settings-page.ts` | Quitar polling de configuración; conservar actualización después de cambios locales. |
| `frontend/src/app/features/admin/admin-stats-page.ts` | Polling de información mostrada y deduplicación por selección. |
| `frontend/src/app/features/admin/instagram-stories-page.ts` | Polling de disponibilidad mostrada sin recargar cancha; deduplicación. |
| `frontend/src/app/features/client/availability-page.ts` | Polling de horarios, coordinación de vencimientos, sin descarga periódica de referencias. |
| `frontend/src/app/features/client/bookings-page.ts` | Activación del store y refresco de sección visible; guardas de background. |
| `frontend/src/app/features/client/my-bookings-store.ts` | Activación por consumidor, deduplicación, refresco parcial y protección de cambio de sesión. |
| `frontend/src/app/features/client/phone-verification-page.ts` | Usar auth compartida; polling visible y protección al destruir pantalla. |
| `frontend/src/app/features/league/league-page.ts` | Polling de Liga pública sólo mientras está visible y montada. |
| `frontend/src/app/features/league/admin-league-page.ts` | Polling de temporada seleccionada sólo en esa pantalla. |
| `frontend/src/app/features/league/instagram-content-page.ts` | Retirar polling de la pantalla de exportación; conservar cambios locales. |
| `frontend/scripts/realtime-browser-audit.mjs` | Ampliar espera a 80 s para cambios entre dispositivos por polling. Su WebSocket es CDP de auditoría, no `/api/realtime`. |

## Pruebas modificadas o agregadas

| Archivo | Cobertura |
|---|---|
| `backend/test/auth-security.test.ts` | Expectativa 404 del transporte retirado. |
| `backend/test/realtime.test.ts` | Ausencia de upgrade y publicación local sin Redis disponible. |
| `backend/test/push-notifications.test.ts` | Creación, cancelación y registro envían Web Push sin panel conectado. |
| `frontend/src/app/core/realtime.spec.ts` | Sin socket/timer global; visibilidad, offline, destrucción, no superposición y espera posterior. |
| `frontend/src/app/core/api.spec.ts` | GET compartidos, caché/invalidación y auth cada 15 min, sin consulta por minuto. |
| `frontend/src/app/core/active-stores.spec.ts` | Stores inactivos, reutilización de requests y sección visible de Mis turnos. |
| `frontend/src/app/features/client/availability-page.spec.ts` | Horarios sin prices/courts; destrucción, background y nextChangeAt coincidente. |
| `frontend/src/app/features/admin/admin-async-state.spec.ts` | Adaptar mock al refresco por pantalla. |
| `frontend/src/app/features/admin/admin-booking-form-page.spec.ts` | Adaptar mock al refresco por pantalla. |
| `frontend/src/app/features/admin/admin-clients-page.spec.ts` | Adaptar mock al refresco por pantalla. |
| `frontend/src/app/features/admin/admin-security-page.spec.ts` | Adaptar mock al refresco por pantalla. |
| `frontend/src/app/features/league/instagram-content-page.spec.ts` | Retirar interfaz del polling global del mock. |

## Polling que permanece

Todos esperan 60 segundos después de terminar sus consultas y se detienen al
ocultar/destruir la pantalla o quedar offline:

- Dashboard: bookings, availability, reservations pendientes y usuarios pendientes.
- Agenda diaria/semanal: bookings de la fecha/rango mostrado.
- Formulario administrativo: disponibilidad de su selección.
- Clientes: listado mostrado.
- Seguridad: pendientes, recuperaciones y auditoría mostrada.
- Estadísticas: resumen y disponibilidad mostrada.
- Historias de horarios: disponibilidad mostrada; el dibujo ocurre en navegador.
- Reservas: disponibilidad; sesión pendiente sólo si requiere verificar aprobación.
- Mis turnos: sección visible (próximos o historial), no ambas periódicamente.
- Verificación: sesión de la cuenta pendiente.
- Liga pública y administrativa: Liga/temporada mostrada.

Inicio, login/registro, configuración y exportación de contenido de Liga no tienen
polling propio. Quedan timers de UI breves y countdowns locales de un segundo;
no mantienen requests de Vercel abiertas ni hacen requests cada segundo.
Los nombres `realtime` conservados identifican interfaces internas, no conexiones.
La configuración Redis/heartbeat y dependencias declaradas se dejaron por compatibilidad;
no hay código de producción que las use para abrir ese transporte.

## Comportamiento y límites

- Los cambios desde otro dispositivo aparecen normalmente en hasta 60 segundos,
  más duración de consulta. Una consulta lenta posterga el siguiente ciclo.
- Las acciones locales conservan sus actualizaciones/invalidation y avisos.
- La autorización y validación final de disponibilidad siguen en backend.
- Al volver de un background breve, el polling puede esperar el siguiente intervalo.
- Configuración y contenido de exportación se recargan al entrar y por acciones locales,
  sin sincronización periódica externa. Las referencias cacheadas pueden tardar hasta
  cinco minutos en renovarse cuando se solicita otra carga.
- Las pruebas de concurrencia/vencimientos existentes usan una base simulada.
  No se ejecutaron migraciones ni pruebas contra TiDB/producción.
- La prueba de Web Push intercepta el envío HTTP al proveedor; verifica invocación y
  payload, no entrega real a un dispositivo ni la configuración VAPID de producción.
- El audit de navegador requiere backend/base de prueba y no se ejecutó contra producción.

## Estimación por pestaña visible, sin acciones ni vencimientos adicionales

| Escenario | Antes REST/h | Después REST/h | WebSockets antes/después |
|---|---:|---:|---:|
| Dashboard | ~360 | <=244 | ~12/h → 0 |
| Dashboard con stores históricos ya inicializados | ~504 | <=244 | ~12/h → 0 |
| Reservas de cliente verificado | ~288 | <=64 | ~12/h → 0 |
| Reservas de visitante | ~216 | <=60 | ~12/h → 0 |
| Mis turnos (sección visible) | ~216 | <=64 | ~12/h → 0 |

El cálculo posterior incluye hasta cuatro comprobaciones de sesión por hora; no
incluye cargas iniciales ni vencimientos, operaciones, navegación o push.
Para una sesión continuamente visible de 24 h: dashboard <=5.856 REST y reservas
verificadas <=1.536 REST, frente a ~8.640 y ~6.912 respectivamente.
En background: cero consultas periódicas nuevas, con posibles solicitudes ya en curso.
La mayor mejora de memoria viene de retirar requests abiertas durante cinco minutos;
no es posible prometer un porcentaje de CPU/GB-h sin medir el siguiente deployment.

## Resultados de verificación

- Build frontend: correcto; bundle inicial ~909 kB, warning del presupuesto de 750 kB.
- Build backend: correcto.
- Frontend: 39 pruebas aprobadas en 11 archivos.
- Backend: se ejecutó la suite completa de 103 casos. La primera ejecución aprobó
  98 y detectó dos expectativas/mocks que se corrigieron, además de tres casos de
  Instagram que no pueden ejecutarse sin `DATABASE_URL` y una Liga de prueba.
  La reejecución enfocada de auth, Web Push y transporte retirado aprobó sus 18 casos.
  En conjunto quedaron 100 casos backend verificados con éxito y tres integraciones
  pendientes por configuración local. No se afirma que `npm test` completo esté verde.
- La prueba existente de dos reservas simultáneas acepta sólo una; vencimientos,
  disponibilidad, permisos, CSRF y reglas de Liga aprobaron.
- `verify:runtime`: 13 dependencias, app y cinco routers lazy cargados correctamente.
- `smoke:entrypoint`: arranque real, health 200, auth sin sesión 401 y realtime 404.
- Comparación de plantillas: sin cambios de HTML inline en los archivos modificados;
  tampoco cambios de CSS, esquema ni configuración del container.
- Búsqueda en fuentes de producción: sin `new WebSocket`, `/api/realtime`,
  reconexión, heartbeat WebSocket, `resync$` ni timer global de fallback.
- `git diff --check`: correcto.

## Comandos de revisión y despliegue (PowerShell, desde la raíz)

```powershell
git branch --show-current
git diff --check
git diff --stat e9e5e8e
git diff e9e5e8e -- frontend/src/app/core backend/src/realtime
git diff e9e5e8e
npm.cmd run build --workspace frontend
npm.cmd run build --workspace backend
npm.cmd test --workspace frontend -- --watch=false
npm.cmd test --workspace backend
npm.cmd run verify:runtime --workspace backend
npm.cmd run smoke:entrypoint --workspace backend
```

La suite backend completa requiere `DATABASE_URL` de una base LOCAL de pruebas
con Liga cargada para tres casos de `instagram-endpoints.test.ts`.

Sólo cuando decidas publicar el árbol de trabajo revisado:

```powershell
npx.cmd --yes vercel@latest --prod --yes --scope baltasarrodriguezdev-7050s-projects
```

Ese comando no se ejecutó. Un deploy desde `main` sin incorporar esta rama publicaría
otra versión; usar este árbol basado en `e9e5e8e` conserva la UI restaurada.
Si Vercel sigue pausado por cuota, el cambio no restablece la cuota consumida.
