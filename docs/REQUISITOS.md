# Producto y trazabilidad de requisitos

DanexLove permite descubrir, adquirir, personalizar, publicar y compartir experiencias digitales basadas en plantillas. La frase de marca es **«Código que late, momentos que inspiran»**. La documentación integral entregada por el propietario conserva el inventario funcional DL-001 a DL-114 y es la fuente oficial para sus definiciones.

## Módulos

| Módulo oficial | Prioridad orientativa | Estado en esta base |
|---|---:|---|
| Inicio y navegación pública | P0 | Parcial; portada y catálogo conectados, con datos demostrativos |
| Cuentas y autenticación | P0 | Parcial: registro, verificación, login/logout, perfil, recuperación/cambio de contraseña y gestión de sesiones; Google se autentica con Firebase, y PostgreSQL/SMTP requieren configuración |
| Catálogo y fichas de plantillas | P0 | Parcial; API de listado/ficha, búsqueda, filtros y paginación; datos reales y páginas de detalle pendientes |
| Editor visual | P0 | Parcial; editor dedicado con vista previa y marca de agua, campos de texto y tono; sin imágenes, bloques ni versiones |
| Experiencias y enlaces públicos | P0 | Parcial; borrador, adquisición gratis persistida, publicación, caducidad, revocación y página pública; checkout premium pendiente |
| Plantillas gratuitas y premium | P1 | Pendiente |
| Compras y pagos | P1 | Pendiente |
| Reseñas y descubrimiento | P2 | Pendiente |
| Administración | P1 | Pendiente |
| Seguridad, calidad y operación | Transversal | Esqueleto mínimo; controles de producto pendientes |

Las prioridades son las de la guía del proyecto, no una reasignación de los identificadores DL. No se infiere qué ID pertenece a cada módulo ni se declara ningún requisito funcional como terminado.

## Registro de trazabilidad

Para cada requisito DL se registrarán: identificador y texto oficial, prioridad, criterio de aceptación, módulo/capa afectada, estado (`pendiente`, `en desarrollo`, `implementado`, `probado` o `bloqueado`), enlaces a archivos/cambios y pruebas que aportan evidencia. La matriz detallada se completará desde el inventario oficial al iniciar cada módulo; no se reconstruyen textos ni rangos por suposición.

## Fuera del MVP inicial

Marketplace de terceros, descarga completa del código, microservicios, analítica avanzada y recomendaciones avanzadas quedan fuera de la primera etapa salvo decisión registrada.
