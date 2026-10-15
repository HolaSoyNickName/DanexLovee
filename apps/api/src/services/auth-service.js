import { createHash, randomBytes, randomUUID } from "node:crypto";
import { hashPassword, verifyPassword } from "../security/passwords.js";

export const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000;
const verificationLifetimeMs = 24 * 60 * 60 * 1000;
const resetLifetimeMs = 60 * 60 * 1000;

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
  webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5173",
  password = { hash: hashPassword, verify: verifyPassword },
  now = () => new Date(),
}) {
  let dummyPasswordHash;

  async function verifyCredentials(user, rawPassword) {
    if (!user) {
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
      if (!user || !(await password.verify(currentPassword, user.passwordHash))) {
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
