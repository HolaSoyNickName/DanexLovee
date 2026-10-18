import { randomUUID } from "node:crypto";

const publishedAt = new Date("2026-10-18T00:00:00.000Z");

export async function up({ context: queryInterface }) {
  await queryInterface.bulkInsert("templates", [{
    id: randomUUID(),
    slug: "adivina",
    title: "Adivina qué es",
    description: "Un acertijo coqueto con una sorpresa al descubrir la respuesta.",
    author: "DanexLove",
    category: "Sorpresa",
    style: "surprise",
    symbol: "🐱",
    label: "Un reto bonito",
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
  await queryInterface.bulkDelete("templates", { slug: "adivina" });
}
