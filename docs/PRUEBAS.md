# Pruebas y calidad

## Comprobaciones disponibles

- `npm test`: pruebas HTTP de salud, cabeceras, rutas desconocidas y contratos del catálogo (filtros, validación, ficha y falta de persistencia configurada).
- Pruebas unitarias/HTTP de cuentas: hash scrypt, verificación de correo, respuestas anti-enumeración, restablecimiento, cookies de sesión y validación de origen.
- `npm run build`: compilación de producción de la web con Vite.

Las pruebas de API inyectan repositorios/servicios; no sustituyen pruebas de integración contra PostgreSQL ni entrega real de correo. Tampoco cubren seguridad completa, accesibilidad automatizada ni recorridos E2E.

## Cobertura a incorporar por módulo

- Unitarias para reglas de negocio, validación y transiciones de estado.
- Integración con PostgreSQL aislado para restricciones, transacciones y migraciones.
- API y autorización para propiedad, roles y respuestas de error.
- E2E para registro/login, catálogo, edición, publicación, revocación y compras.
- Pruebas de repetición y falsificación de webhooks.
- Pruebas de aislamiento de contenido activo, accesibilidad y restauración de copias.

Una funcionalidad se marcará probada solo con evidencia de sus pruebas y criterios de aceptación.
