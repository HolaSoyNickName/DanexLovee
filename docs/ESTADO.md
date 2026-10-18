# Estado del proyecto

## Estado observado

La base actual incluye web, API, migraciones y pruebas automatizadas. Esta tabla resume el código presente; no implica que los servicios externos estén configurados ni que los requisitos oficiales DL-001 a DL-114 estén todos cubiertos.

| Área | Estado comprobado | Requisitos relacionados | Riesgo o diferencia | Próxima acción |
|---|---|---|---|---|
| Repositorio | Git local inicializado en `feature/initial-scaffold`; sin commits ni remoto | Gestión del proyecto | No se ha publicado en GitHub/GitLab | Definir proveedor, propietario, visibilidad y remoto |
| Web | Catálogo responsive, ficha por plantilla con acciones separadas, confirmación de acceso antes de iniciar personalización y selección preservada durante login/verificación; editor con vista previa, adquisición y publicación | Inicio, catálogo, cuentas y experiencias | No hay carga de imágenes, bloques visuales ni checkout premium | Definir capacidades avanzadas y versiones del editor |
| API | Salud, catálogo, autenticación, borradores, adquisición gratuita, publicación y lectura pública | Catálogo, cuentas y experiencias | Pruebas HTTP con dobles; migración local aplicada, falta integrar cobertura DB en CI | Añadir pruebas de integración reproducibles |
| PostgreSQL / ORM | Sequelize; migraciones de usuarios, catálogo, tokens, experiencias y adquisición (`acquiredAt`) | Persistencia | La base local está configurada; revisar configuración en cada entorno | Añadir base de prueba automatizada |
| Identidad y acceso | Registro, verificación, login/logout, perfil, contraseñas y sesiones; Google con Firebase Authentication | Cuentas y autenticación | SMTP, PostgreSQL y Firebase deben configurarse | Probar correo, persistencia local y Firebase Authentication |
| Editor y experiencias | Ruta `/editor/:id`; texto, tono, vista previa en vivo, borradores y guía visual de tres pasos | Editor, experiencias y publicación | No hay imágenes, bloques, versiones ni aislamiento en origen separado | Definir capacidades ampliadas y modelo de publicación |
| Publicación y enlaces | Enlaces opacos con hash, caducidad opcional, lectura pública limitada y revocación transaccional | Experiencias y publicación | El contenido no ejecuta HTML/JS; el origen aislado sigue pendiente para futuras plantillas ejecutables | Definir dominio y política de aislamiento antes de permitir contenido ejecutable |
| Órdenes y pagos | No implementados | Compras, pagos y adquisiciones | Proveedor, moneda, webhooks y reglas no definidos | Acordar proveedor y flujo idempotente antes de iniciar comercio |
| Calidad y operación | Pruebas automatizadas, build web y chequeo local de migración | Seguridad, calidad y operación | Sin E2E ni despliegue | Añadir E2E y despliegue |

## Estado de esta entrega

El flujo permite explorar el catálogo, abrir la ficha de una plantilla, elegir personalizar/previsualizar/obtener enlace, confirmar el acceso y volver a la plantilla seleccionada tras login o verificación de correo. Desde el editor se puede personalizar, guardar borrador, obtener una plantilla gratuita y quitar la marca de agua, publicar un enlace con caducidad opcional, copiarlo y revocarlo. Si una experiencia ya publicada se vuelve a abrir y no se conserva el enlace original, puede generarse uno nuevo; esto invalida el enlace anterior. Las plantillas premium siguen sin checkout y no pueden personalizarse. La migración local de adquisición se ejecutó contra PostgreSQL; las pruebas automatizadas siguen usando dobles para no requerir una base en CI. El inventario oficial debe vincular cada identificador DL con su criterio de aceptación y evidencia sin inferir asignaciones.

## Bloqueos y decisiones abiertas

- Plataforma, propietario, nombre, visibilidad y URL del remoto.
- Licencia del repositorio.
- ORM definitivo; Sequelize es el objetivo provisional sujeto a evaluación.
- Proveedor de pagos, almacenamiento y alojamiento; SMTP se conectará mediante variables de entorno.
- Dominio de publicación de experiencias y CSP/permisos del sandbox.
- Esquema relacional, retención de datos, objetivos de disponibilidad, RPO/RTO.
- Criterios detallados y asignación de los requisitos DL-001 a DL-114.
