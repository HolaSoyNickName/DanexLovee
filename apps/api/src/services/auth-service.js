import { createHash, randomBytes, randomUUID } from "node:crypto";
import { hashPassword, verifyPassword } from "../security/passwords.js";

export const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000;
const verificationLifetimeMs = 24 * 60 * 60 * 1000;
const resetLifetimeMs = 60 * 60 * 1000;
const invalidFirebaseTokenCodes = new Set([
  "auth/argument-error",
  "auth/id-token-expired",
  "auth/id-token-revoked",
  "auth/invalid-id-token",
  "auth/user-disabled",
  "auth/user-not-found",
]);

export class AuthError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.status = status;
  }
}

export function digestToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function issueToken() {
  return randomBytes(32).toString("base64url");
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: Boolean(user.emailVerifiedAt),
    createdAt: user.createdAt,
  };
}

export function createAuthService({
  repository,
  mailer,
  firebaseTokenVerifier,
  webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5173",
  password = { hash: hashPassword, verify: verifyPassword },
  now = () => new Date(),
}) {
  let dummyPasswordHash;

  async function verifyCredentials(user, rawPassword) {
    if (!user?.passwordHash) {
      dummyPasswordHash ??= password.hash(randomBytes(32).toString("hex"));
      await password.verify(rawPassword, await dummyPasswordHash);
      return false;
    }
    return password.verify(rawPassword, user.passwordHash);
  }

  async function createSession(userId) {
    const token = issueToken();
    const expiresAt = new Date(now().getTime() + sessionLifetimeMs);
    const session = await repository.createSession({
      id: randomUUID(),
      userId,
      tokenHash: digestToken(token),
      expiresAt,
      createdAt: now(),
    });
    return { token, expiresAt, session };
  }

  async function sendOneTimeToken(user, purpose, lifetime, deliver) {
    const token = issueToken();
    await repository.createOneTimeToken({
      id: randomUUID(),
      userId: user.id,
      purpose,
      tokenHash: digestToken(token),
      expiresAt: new Date(now().getTime() + lifetime),
      usedAt: null,
      createdAt: now(),
    });
    await deliver({
      name: user.name,
      email: user.email,
      token,
      webOrigin,
    });
  }

  return {
    async register({ name, email, password: rawPassword }) {
      const normalizedEmail = email.trim().toLowerCase();
      const existing = await repository.findUserByEmail(normalizedEmail);
      if (existing) {
        await password.hash(rawPassword);
        if (!existing.emailVerifiedAt) {
          await sendOneTimeToken(
            existing,
            "email-verification",
            verificationLifetimeMs,
            mailer.sendVerification,
          );
        }
        return { accepted: true };
      }

      const user = await repository.createUser({
        id: randomUUID(),
        name: name.trim(),
        email: normalizedEmail,
        passwordHash: await password.hash(rawPassword),
        emailVerifiedAt: null,
        role: "user",
      });

      await sendOneTimeToken(
        user,
        "email-verification",
        verificationLifetimeMs,
        mailer.sendVerification,
      );
      return { accepted: true };
    },

    async resendVerification(email) {
      const user = await repository.findUserByEmail(email.trim().toLowerCase());
      if (user && !user.emailVerifiedAt) {
        await sendOneTimeToken(
          user,
          "email-verification",
          verificationLifetimeMs,
          mailer.sendVerification,
        );
      }
      return { accepted: true };
    },

    async verifyEmail(token) {
      const user = await repository.consumeOneTimeToken(
        "email-verification",
        digestToken(token),
      );
      if (!user) {
        throw new AuthError("INVALID_TOKEN", "El enlace no es válido o ya venció.", 400);
      }
      if (!user.emailVerifiedAt) {
        user.emailVerifiedAt = now();
        await user.save();
      }
      return { user: publicUser(user) };
    },

    async login({ email, password: rawPassword }) {
      const user = await repository.findUserByEmail(email.trim().toLowerCase());
      if (!(await verifyCredentials(user, rawPassword))) {
        throw new AuthError("INVALID_CREDENTIALS", "Correo o contraseña incorrectos.", 401);
      }
      if (!user.emailVerifiedAt) {
        throw new AuthError(
          "INVALID_CREDENTIALS",
          "Correo o contraseña incorrectos.",
          401,
        );
      }

      const session = await createSession(user.id);
      return { ...session, user: publicUser(user) };
    },

    async loginWithGoogle(idToken) {
      if (!firebaseTokenVerifier) {
        throw new AuthError(
          "FIREBASE_AUTH_UNAVAILABLE",
          "El inicio de sesión con Google todavía no está configurado en Firebase.",
          503,
        );
      }

      let profile;
      try {
        profile = await firebaseTokenVerifier(idToken);
      } catch (error) {
        const invalidToken = invalidFirebaseTokenCodes.has(error?.code);
        throw new AuthError(
          invalidToken ? "INVALID_GOOGLE_CREDENTIAL" : "FIREBASE_AUTH_UNAVAILABLE",
          invalidToken
            ? "No se pudo validar la cuenta de Google. Inténtalo de nuevo."
            : "No se pudo validar la cuenta con Firebase. Inténtalo más tarde.",
          invalidToken ? 401 : 503,
        );
      }

      if (
        typeof profile?.sub !== "string"
        || !profile.sub
        || typeof profile.email !== "string"
        || !profile.email_verified
        || profile.sign_in_provider !== "google.com"
      ) {
        throw new AuthError(
          "INVALID_GOOGLE_CREDENTIAL",
          "Google debe proporcionar un correo verificado para continuar.",
          401,
        );
      }

      const email = profile.email.trim().toLowerCase();
      if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new AuthError(
          "INVALID_GOOGLE_CREDENTIAL",
          "La cuenta de Google no proporcionó un correo válido.",
          401,
        );
      }

      let user = await repository.findUserByGoogleSubject(profile.sub);
      if (user && user.email !== email) {
        throw new AuthError(
          "GOOGLE_ACCOUNT_MISMATCH",
          "La cuenta de Google no coincide con la cuenta vinculada.",
          409,
        );
      }

      if (!user) {
        const existing = await repository.findUserByEmail(email);
        if (existing) {
          if (existing.googleSubject && existing.googleSubject !== profile.sub) {
            throw new AuthError(
              "GOOGLE_ACCOUNT_MISMATCH",
              "Este correo ya está vinculado a otra cuenta de Google.",
              409,
            );
          }
          user = await repository.updateUser(existing.id, {
            googleSubject: profile.sub,
            emailVerifiedAt: existing.emailVerifiedAt ?? now(),
          });
        } else {
          try {
            user = await repository.createUser({
              id: randomUUID(),
              name: typeof profile.name === "string" && profile.name.trim()
                ? profile.name.trim().slice(0, 120)
                : email.split("@")[0].slice(0, 120),
              email,
              passwordHash: null,
              emailVerifiedAt: now(),
              googleSubject: profile.sub,
              role: "user",
            });
          } catch (error) {
            if (error?.name !== "SequelizeUniqueConstraintError") throw error;
            user = await repository.findUserByGoogleSubject(profile.sub);
            if (!user) {
              const racedUser = await repository.findUserByEmail(email);
              if (!racedUser) throw error;
              if (racedUser.googleSubject && racedUser.googleSubject !== profile.sub) {
                throw new AuthError(
                  "GOOGLE_ACCOUNT_MISMATCH",
                  "Este correo ya está vinculado a otra cuenta de Google.",
                  409,
                );
              }
              user = racedUser.googleSubject
                ? racedUser
                : await repository.updateUser(racedUser.id, {
                  googleSubject: profile.sub,
                  emailVerifiedAt: racedUser.emailVerifiedAt ?? now(),
                });
            }
            if (user.email !== email) throw error;
          }
        }
      }

      const session = await createSession(user.id);
      return { ...session, user: publicUser(user) };
    },

    async authenticate(token) {
      if (!token || token.length > 128) return null;
      const session = await repository.findValidSession(digestToken(token), now());
      if (!session?.user || !session.user.emailVerifiedAt) return null;

      const expiresAt = new Date(now().getTime() + sessionLifetimeMs);
      await repository.extendSession(session.id, expiresAt);
      return {
        sessionId: session.id,
        expiresAt,
        user: publicUser(session.user),
      };
    },

    async logout(token) {
      if (token) await repository.revokeSession(digestToken(token), now());
    },

    async updateProfile(userId, { name }) {
      const user = await repository.updateUser(userId, { name: name.trim() });
      return { user: publicUser(user) };
    },

    async requestPasswordReset(email) {
      const user = await repository.findUserByEmail(email.trim().toLowerCase());
      if (user && user.emailVerifiedAt) {
        await sendOneTimeToken(
          user,
          "password-reset",
          resetLifetimeMs,
          mailer.sendPasswordReset,
        );
      }
      return { accepted: true };
    },

    async resetPassword({ token, password: rawPassword }) {
      const user = await repository.consumeOneTimeToken("password-reset", digestToken(token));
      if (!user) {
        throw new AuthError("INVALID_TOKEN", "El enlace no es válido o ya venció.", 400);
      }
      await user.update({ passwordHash: await password.hash(rawPassword) });
      await repository.revokeAllSessions(user.id);
      return { accepted: true };
    },

    async changePassword({ userId, sessionId, currentPassword, newPassword }) {
      const user = await repository.findUserById(userId);
      if (!user?.passwordHash || !(await password.verify(currentPassword, user.passwordHash))) {
        throw new AuthError("INVALID_CREDENTIALS", "La contraseña actual es incorrecta.", 401);
      }
      await user.update({ passwordHash: await password.hash(newPassword) });
      await repository.revokeAllSessions(user.id, sessionId, now());
      const renewedSession = await createSession(user.id);
      return { ...renewedSession, user: publicUser(user) };
    },

    listSessions(userId) {
      return repository.listSessions(userId);
    },

    revokeOwnedSession(userId, sessionId) {
      return repository.revokeOwnedSession(userId, sessionId, now());
    },
  };
}
