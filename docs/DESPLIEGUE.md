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



## Antes de producción

Decidir proveedor y dominio; configurar TLS y secretos; verificar respaldo y restauración de PostgreSQL; establecer origen aislado para experiencias; definir CSP basada en permisos reales; configurar logs, alertas, retención y objetivos RPO/RTO. No se afirma que estos elementos estén desplegados.
