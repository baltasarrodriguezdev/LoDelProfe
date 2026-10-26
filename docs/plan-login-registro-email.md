# Plan: ingreso por email y primera reserva por WhatsApp

**Actualización:** la confirmación del email y la recuperación de contraseña usan un código de 6 dígitos, válido 10 minutos y con cinco intentos. Los enlaces anteriores siguen aceptándose hasta vencer.

Estado: propuesta de implementación. Basada en el código local revisado el 25/10/2026. Este documento no aplica cambios a las cuentas ni a la base de datos.

## 1. Resultado esperado

- Registro nuevo con nombre, apellido, email y contraseña de la página.
- Ingreso habitual con email y contraseña. Se admite cualquier proveedor de correo, incluido Gmail; no implica integrar el botón de Google.
- Email confirmado mediante un enlace para evitar errores de escritura y permitir recuperar la contraseña.
- Teléfono solicitado al intentar reservar por primera vez.
- Cliente nuevo: solicitud por WhatsApp y aprobación de la cancha una sola vez para ese teléfono.
- Solicitud sin retención de horario y sin cuenta regresiva de diez minutos.
- Cliente existente con teléfono: agrega y confirma su email, conserva su contraseña y queda habilitado para reservar sin repetir WhatsApp.
- Las cuentas bloqueadas o inactivas conservan esas restricciones.

La validación del email, la comprobación del teléfono y la autorización para reservar serán datos separados. Un email confirmado no aprueba al cliente para reservar.

## 2. Clientes que ya existen

### Acceso y actualización de la cuenta

1. El login principal muestra email y contraseña, más el enlace **“Ya tenía cuenta con mi teléfono”**.
2. Ese acceso alternativo pide el teléfono y la contraseña actuales. Solo está disponible para cuentas anteriores al cambio que todavía no completaron la migración.
3. Una sesión ya abierta también detecta que falta el email y muestra **“Agregá tu email para continuar. Desde ahora vas a ingresar con ese correo y tu contraseña de siempre.”**
4. Se solicita el correo y se envía un enlace de confirmación. Para vincularlo se exige una autenticación reciente; si la sesión es antigua, se vuelve a pedir la contraseña.
5. Al confirmar, se actualiza el mismo usuario y se continúa a la pantalla que estaba intentando abrir.
6. Desde entonces ese usuario entra con email y contraseña; el acceso de migración por teléfono deja de servir para esa cuenta.

No se crea otra cuenta ni se trasladan reservas entre usuarios. Se conservan el ID, la contraseña, el teléfono, los turnos, pagos, historial y roles.

### Quién queda habilitado

Se toma una lista fija de las cuentas existentes en el momento de activar el cambio. Los clientes activos, no bloqueados y con teléfono válido reciben autorización para reservar por **migración de cliente existente**, aunque antes figuraran pendientes de validación. Esta es la interpretación de la instrucción de conservar a los clientes actuales y permitirles reservar.

Esto no registra una comprobación de WhatsApp que nunca ocurrió. La autorización tendrá su propio motivo y fecha. Una cuenta creada después de ese corte no recibe el beneficio por el simple hecho de cargar un teléfono.

Si una cuenta ya bloqueada o inactiva se reactiva más adelante, el administrador deberá revisar su habilitación; el cambio no la aprueba automáticamente.

### Casos especiales

- Email ya asociado a otra cuenta: mostrar el problema sin fusionar usuarios. Ofrecer ingreso o recuperación de la cuenta correspondiente y asistencia de la cancha.
- Teléfono existente ingresado desde una cuenta nueva: no transferir la identidad ni la autorización. Ofrecer recuperar/migrar la cuenta original.
- Contraseña olvidada y todavía sin email: mantener una recuperación asistida por la cancha, comprobando identidad antes de habilitar el cambio. No alcanza con escribir un teléfono conocido.
- Sin acceso al correo elegido: permitir corregirlo dentro del flujo autenticado e invalidar la confirmación anterior.
- Enlace abierto en otro dispositivo: confirmar el correo, pero pedir ingreso para acceder a la cuenta; no convertir el enlace de confirmación en una sesión general.
- Administradores: migrar sus emails primero en el despliegue, preservando roles y comprobando que puedan volver a entrar al panel.

## 3. Registro e ingreso de clientes nuevos

1. Registro: nombre, apellido, email, contraseña y confirmación de contraseña.
2. Mostrar **“Revisá tu correo”**, con opciones para reenviar el enlace y corregir el email.
3. Tras confirmar el correo, permitir continuar a la selección de turno. El teléfono todavía puede estar vacío.
4. Al reservar por primera vez, pedir teléfono argentino y explicar: **“La cancha revisa tu primera solicitud por WhatsApp. Después vas a poder reservar directamente.”**
5. Guardar el teléfono y preparar la solicitud vinculada a esa cuenta.

Los formularios tendrán opción de mostrar contraseña, autocompletado apropiado, errores por campo y estados de envío claros. Se conservará el turno elegido al pasar por login, registro o confirmación de email, pero se volverá a consultar su disponibilidad antes de continuar.

Solo las cuentas con email confirmado podrán crear solicitudes o reservas. Esta restricción se controlará en el servidor, además de la pantalla. La sesión incompleta permitirá completar/verificar el correo, corregirlo de forma autenticada y cerrar sesión.

## 4. Primera solicitud por WhatsApp

1. El usuario selecciona día, horario y duración y completa su teléfono.
2. El servidor crea una **solicitud**, con identificador y código aleatorio ligados al usuario y al teléfono.
3. El botón **“Enviar solicitud por WhatsApp”** abre el chat de la cancha con nombre, teléfono, datos del turno, identificador y código.
4. La persona debe enviar el mensaje. Abrir WhatsApp no demuestra que el mensaje fue enviado ni verifica el teléfono.
5. La web muestra **“Solicitud pendiente. El horario se confirma cuando la cancha la aprueba.”** Permite volver a abrir WhatsApp o cancelar la solicitud.
6. En el panel, el administrador ingresa el número remitente que ve en WhatsApp y el código recibido. El servidor comprueba que coincidan con la solicitud vigente.
7. Al aprobar, se valida el teléfono y se habilita al cliente para futuras reservas. El administrador puede además confirmar el turno solicitado si continúa disponible.

La web no lee ni envía mensajes de WhatsApp automáticamente. Este alcance utiliza enlaces al chat y revisión humana, sin contratar la API de WhatsApp.

### Si el horario ya se ocupó

Como una solicitud no ocupa cancha, puede ocurrir que otro cliente confirme ese horario antes. Al aprobar, el servidor debe volver a validar disponibilidad, fecha, reglas y precio vigente.

Si el horario ya está ocupado, la cuenta puede quedar aprobada y el panel muestra **“Cliente habilitado; este horario ya no está disponible”**. La solicitud pasa a necesitar otro horario y el cliente elige uno nuevo. Nunca se genera una reserva superpuesta.

El precio mostrado en la solicitud es informativo; si cambió, se comunica el precio actual antes de confirmar. La validación del cliente no obliga a confirmar un turno con condiciones distintas a las solicitadas.

### Reglas de solicitudes

- Una solicitud activa por cliente; repetir el envío no crea duplicados.
- No aparecen como ocupación, reserva confirmada ni ingreso en estadísticas/caja.
- El cliente puede cancelarla y elegir otro horario.
- La solicitud de turno vence cuando comienza el horario solicitado. No hay retención de diez minutos.
- El código de comprobación vence por separado, con una duración configurable; propuesta inicial: 24 horas. Regenerarlo invalida el anterior.
- Límites de solicitudes, reenvíos e intentos por usuario e IP.
- Un cambio de teléfono invalida la comprobación y las solicitudes previas de ese número. Se requiere validar el nuevo número para nuevas reservas; se conservan las reservas ya confirmadas.
- La aprobación sigue restringida a SUPERADMIN, como en el sistema actual. No se amplían permisos de otros administradores por este cambio.

## 5. Cambios de datos y servidor

### Usuarios

- Agregar email único normalizado y fecha de confirmación. Durante la transición puede estar vacío para cuentas antiguas.
- Permitir teléfono vacío para cuentas nuevas; mantener unicidad cuando esté presente.
- Normalizar email de forma consistente, sin eliminar puntos ni sufijos “+”, ni asumir equivalencias específicas de Gmail.
- Registrar qué usuarios pertenecen al corte de migración y si completaron su actualización.
- Agregar autorización de reserva con fecha, motivo (`LEGACY_MIGRATION` o `MANUAL_APPROVAL`) y administrador cuando corresponda.
- Mantener la información real de comprobación del teléfono separada de esa autorización.
- Centralizar la regla para reservar: cuenta activa, sin bloqueo, email confirmado, teléfono presente y autorización vigente para ese teléfono.
- Revisar respuestas públicas de usuario: hoy `status` se calcula solo desde `phoneVerified`; deberá representar los nuevos estados sin confundir autorización y teléfono comprobado.

### Confirmación y recuperación por email

- Incorporar un servicio de correo transaccional con remitente y credenciales configurables. El proyecto no tiene uno implementado actualmente.
- Crear tokens de confirmación y recuperación con propósito, usuario, email destinatario, vencimiento y consumo único; guardar sus hashes.
- Vincular el email definitivamente al consumir su confirmación, controlando unicidad también ante solicitudes simultáneas.
- El reenvío y la corrección de email invalidan tokens anteriores según el propósito correspondiente.
- El endpoint de recuperación da una respuesta genérica, exista o no la cuenta.
- Después de restablecer contraseña, invalidar sesiones anteriores mediante `securityVersion`, como ya hace el sistema.
- Un fallo al enviar el correo deja un estado recuperable con reintento; no marca el correo como confirmado ni pierde la cuenta creada.
- Mantener cookies HttpOnly, protección CSRF, límites de intentos y comprobación de bloqueos.
- Los destinos de retorno después del login deben ser rutas internas permitidas y conservarse entre ingreso, registro y migración.

### Solicitudes independientes

Crear una entidad `BookingRequest` vinculada al usuario y con teléfono, horario, duración, cantidad de jugadores, notas, precio de referencia, código de comprobación, estado y reserva resultante cuando corresponda.

Estados propuestos: `PENDING`, `CONFIRMED`, `NEEDS_NEW_SLOT`, `CANCELLED`, `EXPIRED`. Agregar un vínculo único a la reserva resultante para garantizar que una solicitud no pueda producir dos reservas.

La confirmación utilizará el servicio de creación de reservas y sus bloqueos/transacciones de disponibilidad. No se reutilizará directamente el endpoint actual que convierte una reserva retenida en confirmada: ese endpoint parte de que el espacio ya estaba ocupado.

La aprobación de la identidad se registra aunque el horario resulte ocupado; la operación de crear la reserva y consumir la solicitud debe ser atómica e idempotente. Resolver explícitamente doble clic, dos administradores actuando juntos y una reserva directa simultánea.

La ruta de reservas directas dejará de crear retenciones para cuentas no habilitadas. Las rutas antiguas tampoco deben permitir saltarse las nuevas condiciones.

## 6. Cambios en las pantallas

| Pantalla | Cambio |
| --- | --- |
| Ingresar | Email y contraseña; enlace de migración para cuentas antiguas |
| Crear cuenta | Nombre, apellido, email y contraseña; sin teléfono |
| Completar cuenta | Agregar y confirmar email de un usuario existente |
| Confirmar email | Enlace vigente, vencido o usado; reenvío y continuación |
| Recuperar contraseña | Recuperación por email; asistencia para cuentas antiguas sin migrar |
| Reservar | Pedir teléfono en la primera solicitud; reserva directa para habilitados |
| Mis turnos | Diferenciar solicitudes pendientes de reservas confirmadas |
| Clientes | Mostrar email, teléfono, estado de migración y autorización para reservar |
| Seguridad / solicitudes | Validar remitente y código, aprobar cliente y confirmar turno disponible |

Retirar del flujo nuevo la pantalla de retención, temporizador y textos “Guardamos tu horario”. La ruta anterior de validación de teléfono dirigirá al estado de cuenta/solicitud correspondiente.

Reutilizar las notificaciones Web Push del panel para avisar una solicitud nueva, si están configuradas. Adaptar actualizaciones locales y consultas de estado existentes; no reintroducir una conexión permanente ni consultas globales frecuentes. Al aprobarse, el cliente verá el resultado al actualizarse la pantalla.

## 7. Archivos y áreas involucradas

- Datos: `backend/prisma/schema.prisma`, migraciones nuevas y datos de prueba/seed.
- Sesiones: `backend/src/services/auth.service.ts`, `backend/src/routes/auth.routes.ts`, `backend/src/middlewares/auth.ts` y validaciones/límites de seguridad.
- Correo: servicio nuevo, configuración en `backend/src/config.ts`, ejemplos de entorno y documentación de despliegue.
- Recuperación: `backend/src/services/password-reset.service.ts` y rutas relacionadas.
- Reservas: `backend/src/routes/booking.routes.ts`, `backend/src/services/booking.service.ts` y nuevo servicio/rutas de solicitudes.
- Administración: `backend/src/routes/admin.routes.ts`, eventos y notificaciones Web Push.
- Login: `frontend/src/app/features/client/auth-page.ts`, nuevas pantallas de email/migración y `password-recovery-page.ts`.
- Navegación y sesión: `frontend/src/app/core/api.ts`, `app.routes.ts` y `app.component.ts`.
- Reservas cliente: `availability-page.ts`, `phone-verification-page.ts`, `bookings-page.ts`, `my-bookings-store.ts` y `shared/whatsapp-booking.ts`.
- Panel: clientes, seguridad, agenda y almacenes de datos afectados por la diferencia entre solicitud y reserva.
- Estilos: `frontend/src/tailwind.css` y `frontend/src/app/shared/tailwind-classes.ts`.
- Pruebas: autenticación, recuperación, permisos, reserva, solicitudes, migración y recorridos de navegador.

## 8. Orden de implementación y despliegue

1. **Preparar datos y compatibilidad.** Crear campos/tablas aditivos, reglas de autorización y pruebas. El código de transición debe tolerar teléfono vacío y cuentas sin email antes de permitir nuevos registros.
2. **Correo y migración.** Implementar confirmación, recuperación y vinculación de email a cuentas existentes. Configurar y comprobar entrega real de correos antes de exigir la migración.
3. **Login y registro.** Cambiar formularios, rutas y control del estado incompleto. Migrar primero las cuentas administrativas.
4. **Primera solicitud.** Incorporar la entidad independiente, mensaje de WhatsApp, aprobación y confirmación con nueva comprobación de disponibilidad.
5. **Activar el cambio.** Respaldar la base, guardar el corte fijo de clientes existentes, registrar sus autorizaciones y activar el nuevo flujo de forma coordinada. Los scripts serán repetibles sin duplicar autorizaciones ni solicitudes.
6. **Resolver pendientes anteriores.** Las reservas confirmadas se conservan. Las retenciones pendientes aún vigentes se convierten en solicitudes sin ocupación, conservando un vínculo de auditoría; la fila anterior se cierra con motivo de migración. Los pendientes ya vencidos se cierran como vencidos. No confirmar automáticamente turnos solo por la migración del usuario.
7. **Verificar producción.** Comprobar un cliente antiguo, uno nuevo, recuperación y una aprobación. Mantener el acceso de migración solo para los usuarios que todavía lo necesiten; retirarlo cuando se complete la transición.

El corte debe impedir que un registro concurrente obtenga por error autorización de cliente antiguo. Durante el cambio se coordinará una pausa breve de altas/operaciones afectadas o una compuerta de servidor equivalente.

La reversión debe usar una versión compatible con el nuevo esquema y con teléfonos vacíos. Una vez que existan cuentas nuevas sin teléfono, volver directamente al servidor anterior no es seguro. Se conservarán respaldo, datos y registros de migración para corregir o desactivar funciones sin borrar cuentas nuevas.

## 9. Criterios de aceptación y pruebas

- Un cliente existente ingresa con sus credenciales anteriores, confirma un email y vuelve a ingresar con ese email y la misma contraseña.
- Conserva ID, roles, reservas, pagos e historial; no repite WhatsApp para reservar si recibió autorización de migración.
- El acceso por teléfono deja de funcionar para ese usuario una vez completada su migración.
- Un cliente existente bloqueado/inactivo no obtiene acceso ni reservas por el cambio.
- Una sesión abierta sin email recibe el mismo requisito y el servidor impide saltárselo por API.
- Un cliente nuevo se registra sin teléfono y no reserva directamente por confirmar el email.
- Escribir el teléfono de un cliente antiguo no concede acceso a su cuenta ni a su autorización.
- El correo duplicado, el teléfono duplicado y una vinculación simultánea se resuelven sin cuentas fusionadas ni autorizaciones indebidas.
- Los enlaces vencidos/usados, el fallo de correo y el reenvío tienen un recorrido recuperable.
- La solicitud nueva no ocupa disponibilidad y no aparece como reserva ni venta.
- Abrir WhatsApp no verifica al cliente; remitente o código incorrectos impiden la aprobación.
- Una aprobación habilita futuras reservas del cliente con ese teléfono.
- Si el horario se ocupó, se habilita al cliente y se solicita otro horario sin solapamientos.
- Dos confirmaciones simultáneas crean como máximo una reserva; probar esto contra una base MySQL de pruebas, además de pruebas unitarias.
- Cambiar el teléfono obliga a comprobar el nuevo y no altera los datos históricos de turnos ya creados.
- La transición de retenciones antiguas no produce solicitudes/reservas duplicadas.
- Recuperar contraseña invalida las sesiones previas y los enlaces se consumen una vez.
- Validar los recorridos de móvil y escritorio, regreso desde WhatsApp, conservación del turno elegido y actualización de estados.

Ejecutar las suites de backend/frontend, compilaciones de ambos proyectos y verificaciones de arranque/runtime existentes, ajustadas al nuevo contrato. La migración se ensayará sobre una copia de datos antes de producción, comparando cantidades y relaciones de usuarios/reservas.

## 10. Dependencia pendiente para implementar

Hace falta elegir/configurar el servicio de envío de correo y su remitente, y disponer de sus credenciales de despliegue. La implementación puede comenzar con un transporte de correo de pruebas; exigir email confirmado en producción requiere comprobar primero la entrega real.

La propuesta cubre email y contraseña propios de la página. El inicio con Google y los códigos automáticos por SMS/WhatsApp quedan como posibles ampliaciones.
