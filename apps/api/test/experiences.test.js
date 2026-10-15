import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createApp } from "../src/app.js";
import { createExperienceRepository } from "../src/repositories/experience-repository.js";
import { digestToken } from "../src/services/auth-service.js";
import { createExperienceService } from "../src/services/experience-service.js";

const ownerId = "91b58451-64b0-4bc8-b8e2-1f83a160f170";
const experienceId = "7a8195f5-b98c-4d03-8c95-3c5a1d2b6fd4";
const content = {
  title: "Para ti",
  recipientName: "Alex",
  message: "Gracias por estar.",
  accentColor: "rose",
};

describe("Experiencias", () => {
  let server;
  let baseUrl;
  let savedContent;

  before(async () => {
    const experience = {
      id: experienceId,
      ownerId,
      status: "draft",
      acquiredAt: new Date(),
      content,
      templateSnapshot: { title: "Una carta" },
      publishedAt: null,
    };
    const authService = {
      async authenticate(token) {
        return token === "valid-session"
          ? { user: { id: ownerId }, sessionId: "session-id", expiresAt: new Date(Date.now() + 60000) }
          : null;
      },
    };
    const experienceService = createExperienceService({
      async createFromTemplate(userId, slug) {
        return userId === ownerId && slug === "carta-infinita" ? experience : null;
      },
      async listOwned() {
        return [experience];
      },
      async findOwned(userId, id) {
        return userId === ownerId && id === experienceId ? experience : null;
      },
      async saveDraft(userId, id, value) {
        if (userId !== ownerId || id !== experienceId) return null;
        savedContent = value;
        return { ...experience, content: value };
      },
      async resetDraft() {
        return experience;
      },
      async acquireFreeTemplate() {
        return { ...experience, acquiredAt: new Date() };
      },
      async createPublicLink() {
        return { ...experience, status: "published", publishedAt: new Date() };
      },
      async revokePublicLinks() {
        return 1;
      },
      async findPublicByToken(token) {
        return token === digestToken("a".repeat(40)) ? experience : null;
      },
    });

    server = createApp({ authService, experienceService, secureCookies: false }).listen(0);
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

  it("requiere sesión para listar y crear experiencias", async () => {
    const response = await fetch(`${baseUrl}/api/v1/experiences`);

    assert.equal(response.status, 401);
    assert.equal((await response.json()).error.code, "UNAUTHENTICATED");
  });

  it("crea desde una plantilla, guarda el borrador y publica un enlace", async () => {
    const headers = {
      Cookie: "danexlove_session=valid-session",
      "Content-Type": "application/json",
    };
    const created = await fetch(`${baseUrl}/api/v1/experiences`, {
      method: "POST",
      headers,
      body: JSON.stringify({ templateSlug: "carta-infinita" }),
    });
    const saved = await fetch(`${baseUrl}/api/v1/experiences/${experienceId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ content }),
    });
    const published = await fetch(`${baseUrl}/api/v1/experiences/${experienceId}/publish`, {
      method: "POST",
      headers,
      body: JSON.stringify({ expirationDays: 30 }),
    });

    assert.equal(created.status, 201);
    assert.equal(saved.status, 200);
    assert.deepEqual(savedContent, content);
    assert.equal(published.status, 200);
    assert.match((await published.json()).shareUrl, /^http:\/\/localhost:5173\/e\/[A-Za-z0-9_-]+$/);
  });

  it("registra la obtención gratuita antes de quitar la marca de agua", async () => {
    const response = await fetch(`${baseUrl}/api/v1/experiences/${experienceId}/acquire`, {
      method: "POST",
      headers: { Cookie: "danexlove_session=valid-session" },
    });

    assert.equal(response.status, 200);
    assert.ok((await response.json()).experience.acquiredAt);
  });

  it("valida el borrador y oculta los datos de propietario en el enlace público", async () => {
    const headers = {
      Cookie: "danexlove_session=valid-session",
      "Content-Type": "application/json",
    };
    const invalid = await fetch(`${baseUrl}/api/v1/experiences/${experienceId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ content: { ...content, accentColor: "invalid" } }),
    });
    const shared = await fetch(`${baseUrl}/api/v1/public/experiences/${"a".repeat(40)}`);

    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).error.code, "INVALID_STYLE");
    assert.equal(shared.status, 200);
    assert.deepEqual(await shared.json(), {
      experience: { template: { title: "Una carta" }, content },
    });
  });

  it("devuelve a borrador una experiencia cuando se revoca su enlace", async () => {
    let changedStatus;
    let changedLinks;
    const transaction = { LOCK: { UPDATE: "UPDATE" } };
    const repository = createExperienceRepository({
      Experience: {
        async findOne(options) {
          assert.deepEqual(options.where, { id: experienceId, ownerId });
          return {
            async update(values, updateOptions) {
              assert.equal(updateOptions.transaction, transaction);
              changedStatus = values;
            },
          };
        },
      },
      PublicExperienceLink: {
        async update(values, options) {
          assert.ok(values.revokedAt instanceof Date);
          assert.equal(options.transaction, transaction);
          changedLinks = { values, where: options.where };
          return [1];
        },
      },
      sequelize: { transaction: (callback) => callback(transaction) },
    });

    assert.equal(await repository.revokePublicLinks(ownerId, experienceId), 1);
    assert.deepEqual(changedStatus, { status: "draft", publishedAt: null });
    assert.deepEqual(changedLinks.where, { experienceId, revokedAt: null });
    assert.ok(changedLinks.values.revokedAt instanceof Date);
  });

  it("no crea experiencias desde plantillas premium sin compras", async () => {
    let lookup;
    const repository = createExperienceRepository({
      Template: {
        async findOne(options) {
          lookup = options;
          return null;
        },
      },
      sequelize: { transaction: (callback) => callback({}) },
    });

    assert.equal(await repository.createFromTemplate(ownerId, "premium-template"), null);
    assert.deepEqual(lookup.where, {
      slug: "premium-template",
      isPublished: true,
      isPremium: false,
    });
  });

  it("no publica experiencias antes de adquirir la plantilla", async () => {
    const service = createExperienceService({
      async findOwned() {
        return { acquiredAt: null, status: "draft", content };
      },
    });

    await assert.rejects(service.publish(ownerId, experienceId), {
      code: "EXPERIENCE_NOT_ACQUIRED",
      status: 409,
    });
  });
});