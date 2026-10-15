import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { AuthError } from "../services/auth-service.js";
import { EmailDeliveryUnavailableError } from "../services/email-service.js";
import {
  createOriginGuard,
  createRequireAuth,
  readSessionToken,
  sessionCookieOptions,
} from "../security/session-middleware.js";

const maxPasswordLength = 128;

function errorResponse(response, status, code, message) {
  return response.status(status).json({ error: { code, message } });
}

function rateLimitHandler(message) {
  return (_request, response) => errorResponse(response, 429, "RATE_LIMITED", message);
}

function validEmail(email) {
  return typeof email === "string"
    && email.length <= 320
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validPassword(password) {
  return typeof password === "string"
    && password.length >= 8
    && password.length <= maxPasswordLength;
}

function validToken(token) {
  return typeof token === "string"
    && token.length >= 40
    && token.length <= 128
    && /^[A-Za-z0-9_-]+$/.test(token);
}

export function createAuthRouter({
  authService,
  webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5173",
  secureCookies = process.env.NODE_ENV === "production",
}) {
  const router = Router();
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: rateLimitHandler("Hiciste demasiadas solicitudes. Espera un momento e inténtalo de nuevo."),
  });
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 8,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: rateLimitHandler("Demasiados intentos de inicio de sesión. Espera 15 minutos antes de volver a intentar."),
  });
  router.use(generalLimiter);

  router.use(createOriginGuard(webOrigin));
  const requireAuth = createRequireAuth(authService, secureCookies);

  router.post("/register", async (request, response, next) => {
    const { name, email, password } = request.body ?? {};
    if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 120) {
      return errorResponse(response, 400, "INVALID_NAME", "El nombre debe tener entre 2 y 120 caracteres.");
    }
    if (!validEmail(email)) {
      return errorResponse(response, 400, "INVALID_EMAIL", "Escribe un correo válido.");
    }
    if (!validPassword(password)) {
      return errorResponse(response, 400, "INVALID_PASSWORD", "La contraseña debe tener entre 8 y 128 caracteres.");
    }

    try {
      await authService.register({ name, email, password });
      return response.status(202).json({
        message: "Si la cuenta puede registrarse, enviaremos las instrucciones al correo indicado.",
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/verification/resend", async (request, response, next) => {
    const { email } = request.body ?? {};
    if (!validEmail(email)) {
      return errorResponse(response, 400, "INVALID_EMAIL", "Escribe un correo válido.");
    }
    try {
      await authService.resendVerification(email);
      return response.status(202).json({
        message: "Si la cuenta está pendiente de verificación, enviaremos un enlace.",
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/verification/confirm", async (request, response, next) => {
    const { token } = request.body ?? {};
    if (!validToken(token)) {
      return errorResponse(response, 400, "INVALID_TOKEN", "El enlace no es válido o ya venció.");
    }
    try {
      const result = await authService.verifyEmail(token);
      return response.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/login", loginLimiter, async (request, response, next) => {
    const { email, password } = request.body ?? {};
    if (!validEmail(email) || typeof password !== "string" || password.length > maxPasswordLength) {
      return errorResponse(response, 400, "INVALID_CREDENTIALS", "Escribe un correo y contraseña válidos.");
    }
    try {
      const { token, expiresAt, user } = await authService.login({ email, password });
      response.cookie("danexlove_session", token, {
        ...sessionCookieOptions(secureCookies),
        expires: expiresAt,
      });
      return response.status(200).json({ user });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/logout", async (request, response, next) => {
    try {
      await authService.logout(readSessionToken(request));
      response.clearCookie("danexlove_session", sessionCookieOptions(secureCookies));
      return response.status(204).end();
    } catch (error) {
      return next(error);
    }
  });

  router.get("/me", requireAuth, async (request, response) => {
    return response.status(200).json({ user: request.auth.user });
  });

  router.patch("/me", requireAuth, async (request, response, next) => {
    const { name } = request.body ?? {};
    if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 120) {
      return errorResponse(response, 400, "INVALID_NAME", "El nombre debe tener entre 2 y 120 caracteres.");
    }
    try {
      return response.status(200).json(await authService.updateProfile(request.auth.user.id, { name }));
    } catch (error) {
      return next(error);
    }
  });

  router.post("/password/reset", async (request, response, next) => {
    const { email } = request.body ?? {};
    if (!validEmail(email)) {
      return errorResponse(response, 400, "INVALID_EMAIL", "Escribe un correo válido.");
    }
    try {
      await authService.requestPasswordReset(email);
      return response.status(202).json({
        message: "Si existe una cuenta verificada con ese correo, enviaremos las instrucciones.",
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/password/reset/confirm", async (request, response, next) => {
    const { token, password } = request.body ?? {};
    if (!validToken(token) || !validPassword(password)) {
      return errorResponse(response, 400, "INVALID_RESET", "El enlace o la contraseña de 8 a 128 caracteres no son válidos.");
    }
    try {
      await authService.resetPassword({ token, password });
      return response.status(200).json({ message: "La contraseña se actualizó. Inicia sesión nuevamente." });
    } catch (error) {
      return next(error);
    }
  });

  router.put("/password", requireAuth, async (request, response, next) => {
    const { currentPassword, newPassword } = request.body ?? {};
    if (
      typeof currentPassword !== "string"
      || currentPassword.length > maxPasswordLength
      || !validPassword(newPassword)
    ) {
      return errorResponse(response, 400, "INVALID_PASSWORD", "La nueva contraseña debe tener entre 8 y 128 caracteres.");
    }
    try {
      const { token, expiresAt, user } = await authService.changePassword({
        userId: request.auth.user.id,
        sessionId: request.auth.sessionId,
        currentPassword,
        newPassword,
      });
      response.cookie("danexlove_session", token, {
        ...sessionCookieOptions(secureCookies),
        expires: expiresAt,
      });
      return response.status(200).json({ user });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/sessions", requireAuth, async (request, response, next) => {
    try {
      const sessions = await authService.listSessions(request.auth.user.id);
      return response.status(200).json({
        sessions: sessions.map((session) => ({
          ...session,
          current: session.id === request.auth.sessionId,
        })),
      });
    } catch (error) {
      return next(error);
    }
  });

  router.delete("/sessions/:sessionId", requireAuth, async (request, response, next) => {
    if (!/^[0-9a-f-]{36}$/i.test(request.params.sessionId)) {
      return errorResponse(response, 400, "INVALID_SESSION", "La sesión solicitada no es válida.");
    }
    try {
      const revoked = await authService.revokeOwnedSession(
        request.auth.user.id,
        request.params.sessionId,
      );
      if (!revoked) {
        return errorResponse(response, 404, "SESSION_NOT_FOUND", "No encontramos esa sesión activa.");
      }
      if (request.params.sessionId === request.auth.sessionId) {
        response.clearCookie("danexlove_session", sessionCookieOptions(secureCookies));
      }
      return response.status(204).end();
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

export function authErrorHandler(error, request, response, next) {
  if (error instanceof AuthError) {
    return errorResponse(response, error.status, error.code, error.message);
  }
  if (error instanceof EmailDeliveryUnavailableError) {
    return errorResponse(response, 503, "EMAIL_UNAVAILABLE", error.message);
  }
  if (
    error?.name === "SequelizeUniqueConstraintError"
    && request.path.endsWith("/auth/register")
  ) {
    return errorResponse(
      response,
      202,
      "REGISTRATION_ACCEPTED",
      "Si la cuenta puede registrarse, enviaremos las instrucciones al correo indicado.",
    );
  }
  return next(error);
}
