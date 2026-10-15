import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createApp } from "../src/app.js";
import { createAuthService } from "../src/services/auth-service.js";
import { verifyPassword, hashPassword } from "../src/security/passwords.js";

function createAuthFixture() {
  const users = new Map();
  const sessions = new Map();
  const tokens = new Map();
  const mail = [];

  const repository = {
    async findUserByEmail(email) {
      return users.get(email) ?? null;
    },
    async findUserById(userId) {
      return [...users.values()].find((user) => user.id === userId) ?? null;
    },
    async createUser(attributes) {
      const user = {
        ...attributes,
        createdAt: new Date(),
        async save() {},
        async update(changes) {
          Object.assign(this, changes);
          return this;
        },
      };
      users.set(user.email, user);
      return user;
    },
    async updateUser(userId, changes) {
      const user = await this.findUserById(userId);
      Object.assign(user, changes);
      return user;
    },
    async createOneTimeToken(token) {
      tokens.set(token.tokenHash, token);
    },
    async consumeOneTimeToken(purpose, tokenHash) {
      const token = tokens.get(tokenHash);
      if (!token || token.purpose !== purpose || token.usedAt || token.expiresAt <= new Date()) {
        return null;
      }
      token.usedAt = new Date();
      return this.findUserById(token.userId);
    },
    async createSession(session) {
      sessions.set(session.id, session);
      return session;
    },
    async findValidSession(tokenHash, now) {
      const session = [...sessions.values()].find(
        (item) => item.tokenHash === tokenHash && !item.revokedAt && item.expiresAt > now,
      );
      return session ? { ...session, user: await this.findUserById(session.userId) } : null;
    },
    async extendSession(sessionId, expiresAt) {
      sessions.get(sessionId).expiresAt = expiresAt;
    },
    async revokeSession(tokenHash, now) {
      const session = [...sessions.values()].find((item) => item.tokenHash === tokenHash);
      if (session) session.revokedAt = now;
    },
    async listSessions(userId) {
      return [...sessions.values()]
        .filter((session) => session.userId === userId && session.expiresAt > new Date())
        .map(({ id, createdAt, expiresAt, revokedAt }) => ({ id, createdAt, expiresAt, revokedAt }));
    },
    async revokeOwnedSession(userId, sessionId, now) {
      const session = sessions.get(sessionId);
      if (!session || session.userId !== userId || session.revokedAt) return false;
      session.revokedAt = now;
      return true;
    },
    async revokeAllSessions(userId, exceptId, now) {
      for (const session of sessions.values()) {
        if (session.userId === userId && session.id !== exceptId && !session.revokedAt) {
          session.revokedAt = now;
        }
      }
    },
  };

  const mailer = {
    async sendVerification(details) {
      mail.push({ purpose: "verification", ...details });
    },
    async sendPasswordReset(details) {
      mail.push({ purpose: "password-reset", ...details });
    },
  };
  const authService = createAuthService({
    repository,
    mailer,
    password: {
      async hash(value) {
        return `hashed:${value}`;
      },
      async verify(value, hash) {
        return hash === `hashed:${value}`;
      },
    },
  });

  return { authService, mail, sessions, tokens, users };
}

describe("Autenticación", () => {
  it("hashes contraseñas con scrypt y compara sin guardar la contraseña original", async () => {
    const hash = await hashPassword("una contraseña larga y segura");
    assert.notEqual(hash, "una contraseña larga y segura");
    assert.equal(await verifyPassword("una contraseña larga y segura", hash), true);
    assert.equal(await verifyPassword("otra contraseña", hash), false);
    assert.equal(await verifyPassword("cualquiera", "sha256$inválido"), false);
  });

  it("registra sin revelar cuentas existentes y requiere verificar el correo para iniciar sesión", async () => {
    const { authService, mail, users } = createAuthFixture();
    const registration = { name: "Ana", email: " ANA@EXAMPLE.COM ", password: "una contraseña segura" };

    assert.deepEqual(await authService.register(registration), { accepted: true });
    assert.equal(users.size, 1);
    assert.equal(users.get("ana@example.com").passwordHash, "hashed:una contraseña segura");
    assert.equal(mail.length, 1);

    await assert.rejects(
      authService.login({ email: "ana@example.com", password: "una contraseña segura" }),
      { code: "INVALID_CREDENTIALS" },
    );
    await authService.verifyEmail(mail[0].token);
    assert.deepEqual((await authService.login({
      email: "ana@example.com",
      password: "una contraseña segura",
    })).user, {
      id: users.get("ana@example.com").id,
      name: "Ana",
      email: "ana@example.com",
      emailVerified: true,
      createdAt: users.get("ana@example.com").createdAt,
    });

    await authService.register(registration);
    assert.equal(users.size, 1);
    assert.equal(mail.length, 1);
  });

  it("reenvía la verificación al repetir el registro de una cuenta pendiente", async () => {
    const { authService, mail } = createAuthFixture();
    const registration = { name: "Ana", email: "ana@example.com", password: "12345678" };

    assert.deepEqual(await authService.register(registration), { accepted: true });
    assert.deepEqual(await authService.register(registration), { accepted: true });
    assert.equal(mail.length, 2);
    assert.equal(mail[0].purpose, "verification");
    assert.equal(mail[1].purpose, "verification");
  });

  it("revoca sesiones al cerrar sesión y no permite usar el token otra vez", async () => {
    const { authService, mail } = createAuthFixture();
    await authService.register({ name: "Ana", email: "ana@example.com", password: "una contraseña segura" });
    await authService.verifyEmail(mail[0].token);
    const { token } = await authService.login({ email: "ana@example.com", password: "una contraseña segura" });

    assert.ok(await authService.authenticate(token));
    await authService.logout(token);
    assert.equal(await authService.authenticate(token), null);
  });

  it("emite instrucciones indistinguibles para correos existentes y desconocidos", async () => {
    const { authService, mail } = createAuthFixture();
    await authService.register({ name: "Ana", email: "ana@example.com", password: "una contraseña segura" });
    await authService.verifyEmail(mail[0].token);

    assert.deepEqual(await authService.requestPasswordReset("ana@example.com"), { accepted: true });
    assert.deepEqual(await authService.requestPasswordReset("nadie@example.com"), { accepted: true });
    assert.equal(mail.length, 2);

    const result = await authService.resetPassword({
      token: mail[1].token,
      password: "otra contraseña segura",
    });
    assert.deepEqual(result, { accepted: true });
    await assert.rejects(
      authService.login({ email: "ana@example.com", password: "una contraseña segura" }),
      { code: "INVALID_CREDENTIALS" },
    );
    assert.equal((await authService.login({
      email: "ana@example.com",
      password: "otra contraseña segura",
    })).user.email, "ana@example.com");
  });
});

describe("Rutas de autenticación", () => {
  let server;
  let baseUrl;
  let fixture;

  before(async () => {
    fixture = createAuthFixture();
    server = createApp({ authService: fixture.authService, secureCookies: false }).listen(0);
    await new Promise((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    if (!server) return;
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("valida registro y protege contra orígenes cruzados", async () => {
    const invalid = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "A", email: "bad", password: "short" }),
    });
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).error.code, "INVALID_NAME");

    const tooShort = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Ana", email: "ana@example.com", password: "1234567" }),
    });
    assert.equal(tooShort.status, 400);
    assert.equal((await tooShort.json()).error.code, "INVALID_PASSWORD");

    const minimumLength = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Ana", email: "ana@example.com", password: "12345678" }),
    });
    assert.equal(minimumLength.status, 202);

    const forbidden = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: "POST",
      headers: { Origin: "https://malicious.example" },
    });
    assert.equal(forbidden.status, 403);
    assert.equal((await forbidden.json()).error.code, "INVALID_ORIGIN");
  });

  it("responde JSON localizado cuando se supera el límite de intentos de inicio de sesión", async () => {
    const isolatedFixture = createAuthFixture();
    const limitedServer = createApp({ authService: isolatedFixture.authService }).listen(0);
    await new Promise((resolve, reject) => {
      limitedServer.once("listening", resolve);
      limitedServer.once("error", reject);
    });

    try {
      const url = `http://127.0.0.1:${limitedServer.address().port}/api/v1/auth/login`;
      let response;
      for (let attempt = 0; attempt < 9; attempt += 1) {
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Forwarded-For": `192.0.2.${attempt + 1}`,
          },
          body: JSON.stringify({ email: "probe@example.invalid", password: "wrong" }),
        });
        assert.equal(response.status, 401);
      }

      for (let attempt = 0; attempt < 9; attempt += 1) {
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Forwarded-For": "192.0.2.50",
          },
          body: JSON.stringify({ email: "probe@example.invalid", password: "wrong" }),
        });
      }

      assert.equal(response.status, 429);
      assert.deepEqual(await response.json(), {
        error: {
          code: "RATE_LIMITED",
          message: "Demasiados intentos de inicio de sesión. Espera 15 minutos antes de volver a intentar.",
        },
      });
    } finally {
      await new Promise((resolve, reject) => {
        limitedServer.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("establece cookies HttpOnly, SameSite estrictas y solo devuelve datos públicos", async () => {
    const headers = { "Content-Type": "application/json", Origin: "http://localhost:5173" };
    const registration = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "Ana",
        email: "ana@example.com",
        password: "12345678",
      }),
    });
    assert.equal(registration.status, 202);
    await fixture.authService.verifyEmail(fixture.mail[0].token);

    const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email: "ana@example.com", password: "12345678" }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie");
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Strict/i);
    assert.doesNotMatch(cookie, /Secure/i);
    const result = await login.json();
    assert.equal(result.user.email, "ana@example.com");
    assert.equal("passwordHash" in result.user, false);

    const me = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Cookie: cookie.split(";")[0] },
    });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).user.email, "ana@example.com");

    const sessions = await fetch(`${baseUrl}/api/v1/auth/sessions`, {
      headers: { Cookie: cookie.split(";")[0] },
    });
    assert.equal(sessions.status, 200);
    assert.equal((await sessions.json()).sessions[0].current, true);

    const logout = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: "POST",
      headers: { ...headers, Cookie: cookie.split(";")[0] },
    });
    assert.equal(logout.status, 204);
    const afterLogout = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Cookie: cookie.split(";")[0] },
    });
    assert.equal(afterLogout.status, 401);
  });
});
