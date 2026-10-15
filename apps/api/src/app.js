import cors from "cors";
import express from "express";
import helmet from "helmet";
import { createAuthRouter, authErrorHandler } from "./routes/auth.js";
import {
  createExperienceRouter,
  createPublicExperienceRouter,
  experienceErrorHandler,
} from "./routes/experiences.js";
import { createTemplateRouter } from "./routes/templates.js";

export function createApp({
  templateRepository,
  authService,
  experienceService,
  webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5173",
  secureCookies = process.env.NODE_ENV === "production",
} = {}) {
  const app = express();

  if (process.env.NODE_ENV !== "production") {
    app.set("trust proxy", "loopback");
  }
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: webOrigin, credentials: true }));
  app.use(express.json({ limit: "100kb" }));

  app.get("/api/v1/health", (_request, response) => {
    response.status(200).json({
      status: "ok",
      service: "danexlove-api",
    });
  });

  app.use("/api/v1/templates", createTemplateRouter(templateRepository));

  if (experienceService) {
    app.use("/api/v1/public/experiences", createPublicExperienceRouter(experienceService));
  }

  if (authService) {
    app.use(
      "/api/v1/auth",
      createAuthRouter({ authService, webOrigin, secureCookies }),
    );
  }

  if (authService && experienceService) {
    app.use(
      "/api/v1/experiences",
      createExperienceRouter({ experienceService, authService, webOrigin, secureCookies }),
    );
  }

  app.use(authErrorHandler);
  app.use(experienceErrorHandler);

  app.use((error, _request, response, _next) => {
    console.error("Error interno al procesar una solicitud de la API.");
    response.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Ocurrió un error inesperado.",
      },
    });
  });

  app.use((_request, response) => {
    response.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Ruta no encontrada",
      },
    });
  });

  return app;
}
