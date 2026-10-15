const cookieName = "danexlove_session";

export function readSessionToken(request) {
  const cookies = request.headers.cookie?.split(";") ?? [];
  const cookie = cookies.find((part) => part.trim().startsWith(`${cookieName}=`));
  return cookie?.trim().slice(cookieName.length + 1) ?? null;
}

export function sessionCookieOptions(secureCookies) {
  return {
    httpOnly: true,
    secure: secureCookies,
    sameSite: "strict",
    path: "/api/v1",
  };
}

export function createOriginGuard(webOrigin) {
  return (request, response, next) => {
    const origin = request.get("origin");
    if (origin && origin !== webOrigin) {
      return response.status(403).json({
        error: {
          code: "INVALID_ORIGIN",
          message: "Origen de solicitud no permitido.",
        },
      });
    }
    return next();
  };
}

export function createRequireAuth(authService, secureCookies) {
  return async (request, response, next) => {
    try {
      request.auth = await authService.authenticate(readSessionToken(request));
      if (!request.auth) {
        return response.status(401).json({
          error: {
            code: "UNAUTHENTICATED",
            message: "Inicia sesión para continuar.",
          },
        });
      }
      response.cookie(cookieName, readSessionToken(request), {
        ...sessionCookieOptions(secureCookies),
        expires: request.auth.expiresAt,
      });
      return next();
    } catch (error) {
      return next(error);
    }
  };
}
