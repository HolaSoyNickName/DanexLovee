import { Router } from "express";

const allowedSorts = new Set(["newest", "price-asc", "price-desc", "popular"]);
const allowedPrices = new Set(["free", "premium"]);

function queryError(response, message) {
  return response.status(400).json({
    error: {
      code: "INVALID_QUERY",
      message,
    },
  });
}

export function createTemplateRouter(templateRepository) {
  const router = Router();

  router.get("/", async (request, response, next) => {
    if (!templateRepository) {
      return response.status(503).json({
        error: {
          code: "CATALOG_UNAVAILABLE",
          message: "El catálogo requiere una conexión a PostgreSQL.",
        },
      });
    }

    const { category, search = "", price, sort = "newest" } = request.query;
    const page = Number(request.query.page ?? 1);
    const pageSize = Number(request.query.pageSize ?? 12);

    if (category !== undefined && (typeof category !== "string" || category.length > 60)) {
      return queryError(response, "La categoría no es válida.");
    }
    if (typeof search !== "string" || search.length > 100) {
      return queryError(response, "La búsqueda debe tener como máximo 100 caracteres.");
    }
    if (price !== undefined && (typeof price !== "string" || !allowedPrices.has(price))) {
      return queryError(response, "El filtro de precio no es válido.");
    }
    if (typeof sort !== "string" || !allowedSorts.has(sort)) {
      return queryError(response, "El orden solicitado no está disponible.");
    }
    if (!Number.isInteger(page) || page < 1) {
      return queryError(response, "La página debe ser un entero positivo.");
    }
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) {
      return queryError(response, "El tamaño de página debe estar entre 1 y 50.");
    }

    try {
      const result = await templateRepository.list({
        category,
        search: search.trim(),
        price,
        sort,
        page,
        pageSize,
      });
      return response.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/:slug", async (request, response, next) => {
    if (!templateRepository) {
      return response.status(503).json({
        error: {
          code: "CATALOG_UNAVAILABLE",
          message: "El catálogo requiere una conexión a PostgreSQL.",
        },
      });
    }

    try {
      const template = await templateRepository.findPublishedBySlug(request.params.slug);
      if (!template) {
        return response.status(404).json({
          error: {
            code: "TEMPLATE_NOT_FOUND",
            message: "No encontramos esa plantilla.",
          },
        });
      }
      return response.status(200).json({ template });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
