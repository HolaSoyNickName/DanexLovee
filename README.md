# DanexLove

**Código que late, momentos que inspiran.**

DanexLove es una plataforma web para descubrir, personalizar, publicar y compartir experiencias digitales creadas a partir de plantillas. Este repositorio contiene la base inicial del producto; no representa una implementación completa de los requisitos funcionales.

## Estado actual

- Repositorio Git local inicializado; todavía no tiene remoto ni historial de commits.
- Interfaz responsive en React y Vite; el catálogo consulta la API y ofrece búsqueda, filtros y paginación.
- API Express versionada bajo `/api/v1`, con catálogo público persistido en PostgreSQL y fichas por slug.
- Sequelize y migraciones Umzug; la migración inicial crea tablas base y carga seis plantillas demostrativas.
- Cuentas con registro, verificación por correo, login/logout, perfil, recuperación de contraseña y gestión de sesiones; requiere SMTP configurado.
- Ruta de salud de API y prueba automatizada.
- Ruta de salud de API y pruebas automatizadas.
- Taller de experiencias: creación desde plantilla, borradores, edición de texto con vista previa, publicación con caducidad opcional, revocación y enlace público.
- El editor inicial no incluye carga de imágenes, bloques visuales ni versiones; compras, pagos y administración aún no están implementados.
La entrada HTML de Vite está en `apps/web/index.html`; la interfaz se encuentra en `apps/web/src/App.jsx` y sus estilos en `apps/web/src/styles.css`. Las experiencias usan PostgreSQL mediante la API; los registros y precios iniciales del catálogo son de muestra. El flujo de cuenta requiere SMTP y no incluye Google OAuth. Para ejecutar migraciones y persistencia local configura `DATABASE_URL` en `apps/api/.env`.
- Las plantillas y precios cargados son demostrativos; todavía no existe administración para mantener el catálogo.

La entrada HTML de Vite está en `apps/web/index.html`; el contenido de la interfaz se encuentra en `apps/web/src/App.jsx` y sus estilos en `apps/web/src/styles.css`. El catálogo está conectado a PostgreSQL mediante la API, pero sus registros y precios iniciales son solo datos de muestra; el flujo de cuenta requiere correo SMTP y no incluye Google OAuth.

La matriz de estado, riesgos y siguientes pasos está en [docs/ESTADO.md](docs/ESTADO.md). Las decisiones y pendientes se detallan en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

## Requisitos previos

- Node.js 20.19 o superior.
- npm incluido con Node.js.
- Git.

## Desarrollo local

Desde la raíz del repositorio:

```powershell
npm install
Copy-Item apps/api/.env.example apps/api/.env
# Edita apps/api/.env y configura DATABASE_URL con tu usuario y base de PostgreSQL.
# Configura SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD y SMTP_FROM para registro y recuperación.
npm run dev
```

La primera ejecución aplica las migraciones pendientes y agrega las plantillas de muestra. Crea previamente en PostgreSQL el usuario y la base de datos indicados en `DATABASE_URL`; sustituye la contraseña de ejemplo y codifica los caracteres reservados de la URL. No compartas ni publiques esa contraseña. La web estará disponible en `http://localhost:5173` y la API en `http://localhost:3000`. La web reenvía las solicitudes `/api` a la API local.

## Verificación

```powershell
npm test
npm run build
```

## Documentación

- [Estado y auditoría inicial](docs/ESTADO.md)
- [Producto y requisitos](docs/REQUISITOS.md)
- [Arquitectura y decisiones](docs/ARQUITECTURA.md)
- [Contrato inicial de API](docs/API.md)
- [Seguridad](docs/SEGURIDAD.md)
- [Pruebas](docs/PRUEBAS.md)
- [Despliegue y decisiones pendientes](docs/DESPLIEGUE.md)
- [Flujo de contribución](CONTRIBUTING.md)

## Fuentes del producto

La documentación de producto y arquitectura entregada por el propietario es la fuente de requisitos. El inventario DL-001 a DL-114 debe conservarse y vincularse con criterios de aceptación, código y pruebas a medida que se implementen los módulos. La existencia de esos requisitos no implica que estén cubiertos por este esqueleto.
