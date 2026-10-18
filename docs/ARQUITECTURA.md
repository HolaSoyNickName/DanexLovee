# Arquitectura inicial

## Objetivo

Mantener un monolito modular con límites claros entre web, API, dominio e infraestructura, priorizando el núcleo alojado de experiencias y evitando complejidad prematura.

## Estructura actual

```text
apps/
  api/    Express; API REST bajo /api/v1, Sequelize y migraciones Umzug
  web/    React + Vite; cliente web
docs/     Estado, producto y decisiones del proyecto
```

La web y la API están en desarrollo. El catálogo, las cuentas y el primer flujo de experiencias están organizados por rutas, servicios y repositorios; PostgreSQL sigue siendo necesario para ejecutar la persistencia real.

## Tecnologías objetivo

| Área | Objetivo documentado | Estado |
|---|---|---|
| Web | React + JavaScript + Vite | Base creada |
| API | Node.js + Express + JavaScript, REST `/api/v1` | Base creada |
| Persistencia | PostgreSQL | Esquema inicial migrable; falta configurar `DATABASE_URL` |
| ORM | Sequelize | Usado por el primer módulo; sigue sujeto a evaluación según la especificación |
| Estilo | Monolito modular, por capas y dominios | Estructura por desarrollar |
| Sesiones | Cookie `HttpOnly`, `SameSite=Strict`, `Secure` en producción y validación de `Origin` | Implementado; falta probar integración de base y SMTP |
| Experiencias | Borradores, snapshot de plantilla y enlaces públicos mediante token hasheado | API y flujo web inicial implementados; falta definir aislamiento de origen/CSP |
| Pruebas | Unitarias, integración y E2E críticos | Pruebas de contrato/unitarias y build; integración PostgreSQL y E2E pendientes |

No existe aquí una aplicación NestJS/TypeORM ni datos que migrar. Por lo tanto, no se afirma haber comparado ni migrado esos componentes; la evaluación de Sequelize continúa abierta.

## Límites y seguridad de diseño

- Los precios, permisos y transiciones de estado se deciden en el backend.
- Validación de entradas, autenticación y autorización preceden a las operaciones privadas.
- Integraciones de pagos, correo y archivos se encapsulan en adaptadores cuando se implementen.
- La versión actual solo renderiza texto escapado por React. Si se agregan plantillas ejecutables, no compartirán origen ni privilegios con el panel; el sandbox/CSP requiere definir capacidades y dominio público.
- PostgreSQL será fuente de verdad relacional y transaccional cuando se configure.

## Registro inicial de decisiones

| Decisión | Estado | Nota |
|---|---|---|
| React + JavaScript + Vite | Objetivo aceptado para el arranque | Alineado con la arquitectura oficial |
| Node.js + Express + JavaScript | Objetivo aceptado para el arranque | API REST versionada |
| PostgreSQL | Objetivo aceptado; no configurado | Faltan esquema y entorno |
| Sequelize | Provisional | No se da por definitivo ni migrado |
| Monolito modular | Objetivo aceptado | No se justifica microservicios para el MVP |
| Cookie de sesión segura | Opción inicial documentada | Falta definir detalles y controles CSRF |
| Aislamiento de experiencias | Requisito arquitectónico | Origen y política aún pendientes |

Las decisiones con cambios de alcance deberán ampliarse como ADR con contexto, opciones, decisión, consecuencias, riesgos, fecha y estado. No se eliminará el historial de decisiones sustituidas.
