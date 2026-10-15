import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { Op } from "sequelize";
import { createApp } from "../src/app.js";
import { createTemplateRepository } from "../src/repositories/template-repository.js";

describe("Catálogo de plantillas", () => {
  let server;
  let baseUrl;
  let query;
  let templateRepository;

  before(async () => {
    templateRepository = {
      async list(filters) {
        query = filters;
        return {
          items: [{ slug: "carta-infinita", title: "Una carta infinita" }],
          pagination: { page: filters.page, pageSize: filters.pageSize, totalItems: 1, totalPages: 1 },
        };
      },
      async findPublishedBySlug(slug) {
        return slug === "carta-infinita" ? { slug, title: "Una carta infinita" } : null;
      },
    };

    server = createApp({ templateRepository }).listen(0);
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

  it("filtra el catálogo y devuelve datos de paginación", async () => {
    const response = await fetch(
      `${baseUrl}/api/v1/templates?category=Aniversario&search=carta&price=free&sort=popular&page=2&pageSize=5`,
    );

    assert.equal(response.status, 200);
    assert.deepEqual(query, {
      category: "Aniversario",
      search: "carta",
      price: "free",
      sort: "popular",
      page: 2,
      pageSize: 5,
    });
    assert.deepEqual(await response.json(), {
      items: [{ slug: "carta-infinita", title: "Una carta infinita" }],
      pagination: { page: 2, pageSize: 5, totalItems: 1, totalPages: 1 },
    });
  });

  it("rechaza parámetros fuera de los límites admitidos", async () => {
    const response = await fetch(`${baseUrl}/api/v1/templates?pageSize=100`);

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: {
        code: "INVALID_QUERY",
        message: "El tamaño de página debe estar entre 1 y 50.",
      },
    });
  });

  it("expone fichas por slug solo si están publicadas", async () => {
    const found = await fetch(`${baseUrl}/api/v1/templates/carta-infinita`);
    const missing = await fetch(`${baseUrl}/api/v1/templates/no-publicada`);

    assert.equal(found.status, 200);
    assert.deepEqual(await found.json(), {
      template: { slug: "carta-infinita", title: "Una carta infinita" },
    });
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).error.code, "TEMPLATE_NOT_FOUND");
  });

  it("explica cuando la base de datos del catálogo no está disponible", async () => {
    const unavailableApp = createApp();
    const unavailableServer = unavailableApp.listen(0);
    await new Promise((resolve, reject) => {
      unavailableServer.once("listening", resolve);
      unavailableServer.once("error", reject);
    });
    try {
      const response = await fetch(
        `http://127.0.0.1:${unavailableServer.address().port}/api/v1/templates`,
      );
      assert.equal(response.status, 503);
      assert.equal((await response.json()).error.code, "CATALOG_UNAVAILABLE");
    } finally {
      await new Promise((resolve, reject) => {
        unavailableServer.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("traduce filtros aprobados a una consulta segura de Sequelize", async () => {
    let options;
    const repository = createTemplateRepository({
      async findAndCountAll(input) {
        options = input;
        return { count: 0, rows: [] };
      },
    });

    await repository.list({
      category: "Amistad",
      search: "música",
      price: "premium",
      sort: "price-desc",
      page: 1,
      pageSize: 12,
    });

    assert.equal(options.where.isPublished, true);
    assert.equal(options.where.category, "Amistad");
    assert.equal(options.where.isPremium, true);
    assert.equal(options.where[Op.or].length, 3);
    assert.deepEqual(options.order, [["isPremium", "DESC"], ["title", "ASC"]]);
    assert.equal(options.limit, 12);
    assert.equal(options.offset, 0);
  });
});
