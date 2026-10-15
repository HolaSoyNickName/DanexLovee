# Seguridad

La seguridad del producto no está completa. El código inicial aplica cabeceras HTTP de Helmet, desactiva `X-Powered-By`, limita el tamaño de JSON y restringe CORS a un origen configurable. Estos controles son una base, no una certificación ni una frontera de autorización.

## Controles implementados para cuentas

- Contraseñas derivadas con `scrypt` y parámetros explícitos; comparación con `timingSafeEqual`.
- Tokens de sesión opacos; PostgreSQL almacena únicamente SHA-256, y permite revocación por usuario.
- Cookie `HttpOnly`, `SameSite=Strict`, `Secure` en producción y limitada a `/api/v1/auth`.
- Tokens de verificación y recuperación de un solo uso, guardados como hash y con expiración.
- Respuestas genéricas para registro duplicado, reenvío, recuperación y credenciales fallidas.
- Límite por IP para rutas de autenticación, con límite más estricto para login.
- Validación del encabezado `Origin` en la API de autenticación y CORS con credenciales.

Estos controles aún requieren validación mediante integración con PostgreSQL y revisión de despliegue; no constituyen una certificación de seguridad.

## Requisitos para los siguientes módulos

- Evaluar controles CSRF adicionales y probar despliegues con dominios/orígenes definitivos.
- Autorización backend por rol, propietario y recurso; pruebas contra IDOR.
- Validación explícita de entradas y errores sin trazas internas en producción.
- Secretos solo en variables de entorno o gestor de secretos; nunca en Git.
- Registro de auditoría para acciones administrativas y financieras.
- Verificación de firma e idempotencia de webhooks antes de conceder adquisiciones.
- Origen separado, `iframe sandbox` con permisos mínimos y CSP probada para las experiencias activas.
- Límites y validación de archivos si se incorpora carga de recursos.

No hay autorización por roles, carga de archivos, ejecución aislada de plantillas ni procesamiento de pagos implementados en esta base. La verificación y recuperación de cuenta envían correo mediante SMTP que debe configurar el entorno.
