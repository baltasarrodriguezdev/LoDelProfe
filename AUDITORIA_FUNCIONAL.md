# Auditoría funcional

Fecha de revisión: 25 de julio de 2026.

## Resultado general

El sistema cubre el circuito principal de una cancha: registro, validación manual, recuperación de contraseña, consulta de disponibilidad, reserva, agenda, clientes, turnos fijos, pagos, caja, estadísticas y piezas para Instagram.

La auditoría encontró reglas que estaban duplicadas o implícitas. Las de severidad crítica y alta quedaron normalizadas en código, base de datos e interfaz.

## Matriz de funciones actuales

| Área | Estado | Control aplicado |
| --- | --- | --- |
| Registro e ingreso | Completo | Teléfonos argentinos normalizados, sesión HttpOnly, CSRF y bloqueo de cuentas |
| Verificación telefónica | Completo | `phoneVerified` es la fuente de verdad; comprobación manual auditada |
| Recuperar contraseña | Completo | Solicitud neutra, autorización administrativa, enlace de un uso y vencimiento |
| Ciclo de clientes | Completo | Desactivar, reactivar, bloquear y liberar número son operaciones diferentes |
| Disponibilidad | Completo | Zona horaria argentina, apertura, descansos, precios, grilla y huecos no vendibles |
| Reserva web | Completo | Revalidación transaccional y prevención de solicitudes pendientes duplicadas |
| Reserva manual | Completo | Sólo ofrece horarios calculados y el backend rechaza horas como `16:02` |
| Estados de turnos | Completo | Máquina de estados explícita; jugados y ausentes son terminales |
| Cancelación cliente | Completo | Límite configurable, inicialmente 120 minutos |
| Agenda diaria/semanal | Completo | Acciones compatibles con el estado actual y restauración validada |
| Turnos fijos | Completo | Creación y regeneración atómicas; una fecha conflictiva revierte toda la operación |
| Señas y pagos | Completo | Importe real, medio de pago, saldo y movimiento de caja sincronizados |
| Caja y estadísticas | Completo | Cobrado y pendiente se calculan con importes, no sólo con etiquetas |
| Horarios | Completo | Días, formato, duplicados y descansos configurables validados |
| Cancha | Completo para alcance actual | Una sola cancha activa, resuelta dinámicamente por todas las pantallas |
| Permisos | Completo | Operación diaria para ADMIN; identidad, clientes, caja y configuración para SUPERADMIN |
| Auditoría administrativa | Completo | Identidad, usuarios, reservas, cobros y configuración dejan trazabilidad |
| Marketing Instagram | Operativo | Consume la misma disponibilidad y cancha activa |

## Riesgos corregidos

- Horarios manuales fuera de la grilla.
- Fuentes de verdad contradictorias para verificación telefónica.
- Confusión entre desactivar una cuenta y liberar su número.
- Señas sin importe y caja desincronizada.
- Cambios arbitrarios entre estados de turnos.
- Reglas horarias ocultas para un día particular.
- Dependencia generalizada de `courtId = 1`.
- Ediciones de fecha sujetas a la zona horaria del servidor.
- Series fijas guardadas parcialmente ante un conflicto.
- Falta de trazabilidad de acciones sensibles.

## Evolución recomendada

### Próxima etapa

- Cierres excepcionales por feriados o mantenimiento.
- Reprogramación de turnos sin cancelar y recrear manualmente.
- Devoluciones y ajustes de caja asociados a pagos.
- Exportación de caja y estadísticas.
- Verificación automática de backups y alertas de salud.
- Recordatorios de turnos y avisos de cancelación.

### Crecimiento

- Pagos online conciliados.
- Lista de espera para horarios ocupados.
- Promociones y fidelización.
- Perfil del cliente y cambio autenticado de teléfono.
- Membresías, torneos y varias canchas sólo si cambia el alcance del negocio.

## Criterio de regresión

Antes de publicar se deben ejecutar migraciones, compilaciones, pruebas del backend y frontend, y recorridos de navegador para visitante, cliente, ADMIN y SUPERADMIN. No se publica con fallas críticas o altas abiertas.
