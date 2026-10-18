# API

La API usa el prefijo `/api/v1`.

| Método | Ruta | Respuesta | Estado |
|---|---|---|---|
| `GET` | `/api/v1/health` | `{"status":"ok","service":"danexlove-api"}` | Implementada y probada |
| `GET` | `/api/v1/templates` | `{ "items": [...], "pagination": {...} }` | Catálogo publicado, búsqueda, filtros y paginación |
| `GET` | `/api/v1/templates/:slug` | `{ "template": {...} }` | Ficha de plantilla publicada |
| `POST` | `/api/v1/auth/register` | `202` genérico | Crear cuenta y enviar verificación |
| `POST` | `/api/v1/auth/verification/resend` | `202` genérico | Reenviar verificación |
| `POST` | `/api/v1/auth/verification/confirm` | Usuario público | Confirmar correo con token de un solo uso |
| `POST` | `/api/v1/auth/login` | Usuario público y cookie | Iniciar sesión |
| `POST` | `/api/v1/auth/logout` | `204` | Revocar la sesión actual |
| `GET` | `/api/v1/auth/me` | Usuario público | Consultar cuenta autenticada |
| `PATCH` | `/api/v1/auth/me` | Usuario público | Cambiar nombre |
| `GET` | `/api/v1/auth/sessions` | Sesiones activas | Consultar dispositivos/sesiones |
| `DELETE` | `/api/v1/auth/sessions/:sessionId` | `204` | Revocar una sesión propia |
| `PUT` | `/api/v1/auth/password` | Usuario público y cookie renovada | Cambiar contraseña y cerrar otras sesiones |
| `POST` | `/api/v1/auth/password/reset` | `202` genérico | Solicitar restablecimiento |
| `POST` | `/api/v1/auth/password/reset/confirm` | Mensaje | Restablecer contraseña con token de un solo uso |
| `GET` | `/api/v1/experiences` | `{ "experiences": [...] }` | Listar experiencias propias; requiere sesión |
| `POST` | `/api/v1/experiences` | `{ "experience": {...} }` | Crear borrador desde `templateSlug`; requiere sesión |
| `GET` | `/api/v1/experiences/:experienceId` | `{ "experience": {...} }` | Leer experiencia propia; requiere sesión |
| `PATCH` | `/api/v1/experiences/:experienceId` | `{ "experience": {...} }` | Guardar contenido del borrador; requiere sesión |
| `POST` | `/api/v1/experiences/:experienceId/reset` | `{ "experience": {...} }` | Restaurar contenido inicial; requiere sesión |
| `POST` | `/api/v1/experiences/:experienceId/acquire` | `{ "experience": {...} }` | Registrar obtención de una plantilla gratuita después de validar el contenido; requiere sesión |
| `POST` | `/api/v1/experiences/:experienceId/publish` | Experiencia y `shareUrl` | Publicar; acepta `expirationDays` de 1 a 365 o `null`; requiere sesión |
| `DELETE` | `/api/v1/experiences/:experienceId/link` | `204` | Revocar enlace y volver a borrador; requiere sesión |
| `GET` | `/api/v1/public/experiences/:token` | `{ "experience": {"template":..., "content":...} }` | Lectura pública sin autenticación ni datos del propietario |

`GET /api/v1/templates` acepta `category`, `search` (máximo 100 caracteres), `price` (`free` o `premium`), `sort` (`newest`, `price-asc`, `price-desc` o `popular`), `page` y `pageSize` (de 1 a 50). La respuesta incluye `totalItems` y `totalPages`. Los filtros se aplican en PostgreSQL y solo incluyen plantillas publicadas. Parámetros inválidos responden `400 INVALID_QUERY`; si falta conexión a la base, el catálogo responde `503 CATALOG_UNAVAILABLE`.

La migración inicial carga seis plantillas y etiquetas de precio demostrativas. No son precios comerciales ni representan compras o popularidad reales. Las experiencias permiten editar `title`, `recipientName`, `message` y `accentColor` (`rose`, `violet`, `blue`, `sunshine`); los máximos son 120, 100 y 3000 caracteres para título, destinatario y mensaje. Guardar un borrador no lo adquiere: las plantillas gratuitas requieren `POST .../:experienceId/acquire`, que persiste `acquiredAt`; publicar antes de adquirir responde `409 EXPERIENCE_NOT_ACQUIRED`. El editor está en `/editor/:experienceId` y mantiene marca de agua hasta adquirir. No hay checkout premium implementado. El frontend presenta el enlace en `/e/:token`. Las rutas desconocidas responden `404 NOT_FOUND`. Pagos, reseñas y administración siguen pendientes.

## Cuentas

El registro requiere `name`, `email` y una contraseña de 8 a 128 caracteres. Se normaliza el correo a minúsculas; las contraseñas se derivan con scrypt y nunca se devuelven. La cuenta no puede iniciar sesión hasta verificar el correo. Registro, reenvío de verificación y recuperación responden de forma genérica para no revelar si existe una cuenta. Si se repite el registro de una cuenta aún pendiente, se reenvía el enlace de verificación. Los enlaces de verificación vencen en 24 horas y los de recuperación en una hora; son de un solo uso.


La sesion de DanexLove usa un token aleatorio opaco cuyo hash SHA-256 se almacena en PostgreSQL. El cliente recibe una cookie `HttpOnly`, `SameSite=Strict`, `Secure` en produccion, con duracion de 30 dias y alcance `/api/v1/auth`. Las mutaciones rechazan un encabezado `Origin` ajeno a la politica configurada. El login tiene limite de intentos por IP. Cambiar la contrasena renueva la sesion actual y revoca las demas.

Las rutas que necesitan usuario responden `401 UNAUTHENTICATED`; credenciales inválidas responden el mismo error sin distinguir cuentas o correos no verificados. Los tokens de correo nunca se devuelven en la API. Las operaciones de correo requieren SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`); sin este servicio responden `503 EMAIL_UNAVAILABLE`. Aún falta ejecutar pruebas de integración de migraciones y transacciones contra la base PostgreSQL configurada.
