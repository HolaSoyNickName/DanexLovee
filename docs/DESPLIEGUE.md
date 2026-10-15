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
- `WEB_ORIGIN`: origen permitido por CORS; por defecto `http://localhost:5173`.
- `DATABASE_URL`: URI de conexión PostgreSQL. Es obligatoria para iniciar la API; no guardar credenciales en Git.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`: servidor remitente requerido para verificar cuentas y enviar enlaces de recuperación. Los secretos van únicamente en `.env` o el gestor de secretos.

Al iniciar, la API valida la conexión y aplica las migraciones pendientes con Umzug. La migración inicial crea usuarios, sesiones y plantillas, e inserta seis plantillas de muestra; la siguiente migración añade tokens de verificación y recuperación. Configura PostgreSQL y SMTP para probar el ciclo real de alta y acceso.

## Antes de producción

Decidir proveedor y dominio; configurar TLS y secretos; verificar respaldo y restauración de PostgreSQL; establecer origen aislado para experiencias; definir CSP basada en permisos reales; configurar logs, alertas, retención y objetivos RPO/RTO. No se afirma que estos elementos estén desplegados.
