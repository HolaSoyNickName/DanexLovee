# Despliegue y operación

No se ha elegido hosting, dominio, proveedor de PostgreSQL, correo, almacenamiento, pagos ni pipeline de CI/CD. No hay despliegue configurado.

## Ejecución local

Requisitos: Node.js 20.19+ y npm. Desde la raíz:

```powershell
npm install
npm run dev
```

Variables de la API (ver `apps/api/.env.example`; copiar a `apps/api/.env`):

- `PORT`: puerto de escucha; por defecto `3000`.
- `WEB_ORIGIN`: origen permitido por CORS; por defecto `http://localhost:5173`. En desarrollo también se permiten hosts privados de la red local por los puertos `5173` a `5199`; en producción configura el dominio público con `https://` (por ejemplo, `https://danexlove.com`). Los enlaces compartidos usan HTTPS para dominios públicos; localhost conserva HTTP para desarrollo local.
- `DATABASE_URL`: URI de conexión PostgreSQL. Es obligatoria para iniciar la API; no guardar credenciales en Git.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`: servidor remitente requerido para verificar cuentas y enviar enlaces de recuperación. Los secretos van únicamente en `.env` o el gestor de secretos.
- `FIREBASE_PROJECT_ID`: ID del proyecto Firebase usado para verificar tokens de acceso con Google.
- `GOOGLE_APPLICATION_CREDENTIALS`: ruta al JSON de cuenta de servicio de Firebase Admin, guardado fuera del repositorio. Por ejemplo, en Windows puedes usar `C:/Users/tu-usuario/keys/danexlove-service-account.json`. La API usa `applicationDefault()` del SDK de Firebase Admin para cargar estas credenciales. En producción, prefiere las credenciales administradas por el proveedor de hosting si están disponibles. Nunca subas el JSON ni sus secretos a Git.

Variables de la web (ver `apps/web/.env.example`; copiar a `apps/web/.env`):

- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID` y `VITE_FIREBASE_APP_ID`: configuración web pública del proyecto, disponible en la consola de Firebase. Habilita el proveedor Google en Authentication y autoriza los dominios de desarrollo y producción en los dominios autorizados de Firebase.

Firebase se usa únicamente para el inicio de sesión con Google. La API verifica el ID token con Firebase Admin y después mantiene las sesiones y los datos de usuarios en PostgreSQL; Firestore no se utiliza.

Al iniciar, la API valida la conexión y aplica las migraciones pendientes con Umzug. Las migraciones crean usuarios, sesiones, plantillas y tokens de verificación/recuperación; la migración de Google añade el identificador de proveedor y permite cuentas sin contraseña local. Configura PostgreSQL y, si usarás el alta tradicional o recuperación, SMTP.

## Antes de producción

Decidir proveedor y dominio; configurar TLS y secretos; verificar respaldo y restauración de PostgreSQL; establecer origen aislado para experiencias; definir CSP basada en permisos reales; configurar logs, alertas, retención y objetivos RPO/RTO. No se afirma que estos elementos estén desplegados.
