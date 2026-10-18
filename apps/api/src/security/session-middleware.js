const cookieName = "danexlove_session";
const defaultWebOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
];

export function normalizeAllowedOrigins(webOrigin) {
  const candidates = Array.isArray(webOrigin)
    ? webOrigin
    : typeof webOrigin === "string"
      ? webOrigin.split(/[\s,]+/).filter(Boolean)
      : [];

  const origins = [...candidates]
    .filter(Boolean)
    .map((origin) => {
      const raw = origin.trim();
      if (!raw) return null;
      try {
        return new URL(raw).origin;
      } catch {
        return raw.replace(/\/+$/, "");
      }
    })
    .filter(Boolean);

  return [...new Set(origins)];
}

function isPrivateIpv4(hostname) {
  const octets = hostname.split(".");
  if (
    octets.length !== 4
    || octets.some((octet) => !/^\d{1,3}$/.test(octet) || Number(octet) > 255)
  ) {
    return false;
  }

  const [first, second] = octets.map(Number);
  return first === 10
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168);
}

function isDevelopmentOrigin(origin) {
  try {
    const url = new URL(origin);
    const port = Number(url.port);
    if (url.protocol !== "http:" || port < 5173 || port > 5199) {
      return false;
    }

    return url.hostname === "localhost"
      || url.hostname === "127.0.0.1"
      || url.hostname === "[::1]"
      || isPrivateIpv4(url.hostname);
  } catch {
    return false;
  }
}

export function createOriginValidator(
  webOrigin,
  allowDevelopmentOrigins = process.env.NODE_ENV !== "production",
) {
  const allowedOrigins = new Set([
    ...normalizeAllowedOrigins(webOrigin),
    ...(allowDevelopmentOrigins ? defaultWebOrigins : []),
  ]);

  return (origin) => allowedOrigins.has(origin)
    || (allowDevelopmentOrigins && isDevelopmentOrigin(origin));
}

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
  const isAllowedOrigin = createOriginValidator(webOrigin);

  return (request, response, next) => {
    const origin = request.get("origin");
    if (origin && !isAllowedOrigin(origin)) {
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
