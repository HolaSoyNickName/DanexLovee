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
import { createOriginValidator } from "./security/session-middleware.js";

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
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        scriptSrc: ["'self'"],
        frameSrc: ["'self'"],
        connectSrc: ["'self'"],
      },
    },
  }));
  const isAllowedOrigin = createOriginValidator(webOrigin);
  app.use(cors({
    origin(origin, callback) {
      callback(null, !origin || isAllowedOrigin(origin));
    },
    credentials: true,
  }));
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
    const diagnostic = process.env.NODE_ENV === "production"
      ? undefined
      : {
        name: error?.name ?? "Error",
        code: error?.code,
        causeCode: error?.original?.code ?? error?.cause?.code,
        location: error?.stack?.split("\n").slice(1, 4).map((line) => line.trim()),
      };
    console.error("Error interno al procesar una solicitud de la API.", {
      ...diagnostic,
    });
    response.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Ocurrió un error inesperado.",
        ...(diagnostic ? { diagnostic } : {}),
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
