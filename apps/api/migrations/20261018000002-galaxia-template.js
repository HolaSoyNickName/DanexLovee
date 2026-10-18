import { randomUUID } from "node:crypto";

const publishedAt = new Date("2026-10-18T00:00:00.000Z");

export async function up({ context: queryInterface }) {
  await queryInterface.bulkInsert("templates", [{
    id: randomUUID(),
    slug: "galaxia-de-amor",
    title: "Una galaxia para ti",
    description: "Un pequeño universo para explorar, lleno de mensajes, corazones y recuerdos.",
    author: "DanexLove",
    category: "Sorpresa",
    style: "galaxy",
    symbol: "🪐",
    label: "Una sorpresa cósmica",
    priceLabel: "Gratis",
    isPremium: false,
    isPublished: true,
    purchaseCount: 0,
    publishedAt,
    createdAt: publishedAt,
    updatedAt: publishedAt,
  }]);
}

export async function down({ context: queryInterface }) {
  await queryInterface.bulkDelete("templates", { slug: "galaxia-de-amor" });
}
