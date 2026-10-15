import { Router } from "express";
import {
  createOriginGuard,
  createRequireAuth,
} from "../security/session-middleware.js";
import { ExperienceError } from "../services/experience-service.js";

function errorResponse(response, status, code, message) {
  return response.status(status).json({ error: { code, message } });
}

function validId(value) {
  return /^[0-9a-f-]{36}$/i.test(value);
}

export function createExperienceRouter({
  experienceService,
  authService,
  webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5173",
  secureCookies = process.env.NODE_ENV === "production",
}) {
  const router = Router();
  router.use(createOriginGuard(webOrigin));
  const requireAuth = createRequireAuth(authService, secureCookies);

  router.post("/", requireAuth, async (request, response, next) => {
    const { templateSlug } = request.body ?? {};
    if (typeof templateSlug !== "string" || !/^[a-z0-9-]{1,120}$/.test(templateSlug)) {
      return errorResponse(response, 400, "INVALID_TEMPLATE", "Selecciona una plantilla válida.");
    }
    try {
      const experience = await experienceService.create(request.auth.user.id, templateSlug);
      if (!experience) {
        return errorResponse(response, 404, "TEMPLATE_NOT_FOUND", "No encontramos esa plantilla publicada.");
      }
      return response.status(201).json({ experience });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/", requireAuth, async (request, response, next) => {
    try {
      const experiences = await experienceService.list(request.auth.user.id);
      return response.status(200).json({ experiences });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/:experienceId", requireAuth, async (request, response, next) => {
    if (!validId(request.params.experienceId)) {
      return errorResponse(response, 404, "EXPERIENCE_NOT_FOUND", "No encontramos esa experiencia.");
    }
    try {
      const experience = await experienceService.findOwned(
        request.auth.user.id,
        request.params.experienceId,
      );
      if (!experience) {
        return errorResponse(response, 404, "EXPERIENCE_NOT_FOUND", "No encontramos esa experiencia.");
      }
      return response.status(200).json({ experience });
    } catch (error) {
      return next(error);
    }
  });

  router.patch("/:experienceId", requireAuth, async (request, response, next) => {
    if (!validId(request.params.experienceId)) {
      return errorResponse(response, 404, "EXPERIENCE_NOT_FOUND", "No encontramos esa experiencia.");
    }
    try {
      const experience = await experienceService.saveDraft(
        request.auth.user.id,
        request.params.experienceId,
        request.body?.content,
      );
      if (!experience) {
        return errorResponse(response, 404, "EXPERIENCE_NOT_FOUND", "No encontramos un borrador propio editable.");
      }
      return response.status(200).json({ experience });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/:experienceId/reset", requireAuth, async (request, response, next) => {
    if (!validId(request.params.experienceId)) {
      return errorResponse(response, 404, "EXPERIENCE_NOT_FOUND", "No encontramos esa experiencia.");
    }
    try {
      const experience = await experienceService.resetDraft(
        request.auth.user.id,
        request.params.experienceId,
      );
      if (!experience) {
        return errorResponse(response, 404, "EXPERIENCE_NOT_FOUND", "No encontramos un borrador propio editable.");
      }
      return response.status(200).json({ experience });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/:experienceId/acquire", requireAuth, async (request, response, next) => {
    if (!validId(request.params.experienceId)) {
      return errorResponse(response, 404, "EXPERIENCE_NOT_FOUND", "No encontramos esa experiencia.");
    }
    try {
      const experience = await experienceService.acquireFree(request.auth.user.id, request.params.experienceId);
      if (!experience) {
        return errorResponse(response, 404, "EXPERIENCE_NOT_FOUND", "No encontramos una experiencia gratuita disponible.");
      }
      return response.status(200).json({ experience });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/:experienceId/publish", requireAuth, async (request, response, next) => {
    if (!validId(request.params.experienceId)) {
      return errorResponse(response, 404, "EXPERIENCE_NOT_FOUND", "No encontramos esa experiencia.");
    }
    try {
      const published = await experienceService.publish(
        request.auth.user.id,
        request.params.experienceId,
        request.body?.expirationDays,
      );
      if (!published) {
        return errorResponse(response, 404, "EXPERIENCE_NOT_FOUND", "No encontramos esa experiencia.");
      }
      return response.status(200).json(published);
    } catch (error) {
      return next(error);
    }
  });

  router.delete("/:experienceId/link", requireAuth, async (request, response, next) => {
    if (!validId(request.params.experienceId)) {
      return errorResponse(response, 404, "EXPERIENCE_NOT_FOUND", "No encontramos esa experiencia.");
    }
    try {
      const count = await experienceService.revokeLinks(
        request.auth.user.id,
        request.params.experienceId,
      );
      if (count === null) {
        return errorResponse(response, 404, "EXPERIENCE_NOT_FOUND", "No encontramos esa experiencia.");
      }
      return response.status(204).end();
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

export function createPublicExperienceRouter(experienceService) {
  const router = Router();
  router.get("/:token", async (request, response, next) => {
    const { token } = request.params;
    if (token.length < 40 || token.length > 128 || !/^[A-Za-z0-9_-]+$/.test(token)) {
      return errorResponse(response, 410, "LINK_UNAVAILABLE", "Este enlace expiró o ya no está disponible.");
    }
    try {
      const experience = await experienceService.getPublicExperience(token);
      if (!experience) {
        return errorResponse(response, 410, "LINK_UNAVAILABLE", "Este enlace expiró o ya no está disponible.");
      }
      return response.status(200).json({
        experience: {
          template: experience.templateSnapshot,
          content: experience.content,
        },
      });
    } catch (error) {
      return next(error);
    }
  });
  return router;
}

export function experienceErrorHandler(error, _request, response, next) {
  if (error instanceof ExperienceError) {
    return errorResponse(response, error.status, error.code, error.message);
  }
  return next(error);
}
