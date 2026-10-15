import { randomUUID } from "node:crypto";

const sampleTemplates = [
  {
    slug: "carta-infinita",
    title: "Una carta infinita",
    category: "Aniversario",
    description: "Un lugar para guardar todo eso que a veces cuesta decir.",
    priceLabel: "Gratis",
    style: "letter",
    symbol: "✉",
    label: "Un clásico",
    isPremium: false,
  },
  {
    slug: "vueltas-al-sol",
    title: "Vueltas al sol",
    category: "Cumpleaños",
    description: "Celebra su día con recuerdos, fotos y buenos deseos.",
    priceLabel: "Desde $49",
    style: "sun",
    symbol: "☼",
    label: "Para celebrar",
    isPremium: true,
  },
  {
    slug: "nuestro-mapa",
    title: "Nuestro pequeño mapa",
    category: "Aniversario",
    description: "Vuelve a esos lugares que ya son parte de su historia.",
    priceLabel: "Desde $69",
    style: "map",
    symbol: "⌖",
    label: "Favorita",
    isPremium: true,
  },
  {
    slug: "solo-porque-si",
    title: "Solo porque sí",
    category: "Sorpresa",
    description: "A veces no hace falta una fecha para tener un detalle.",
    priceLabel: "Gratis",
    style: "surprise",
    symbol: "✳",
    label: "Un detalle",
    isPremium: false,
  },
  {
    slug: "playlist-nuestra",
    title: "Nuestra banda sonora",
    category: "Amistad",
    description: "Una colección de canciones para todos sus capítulos.",
    priceLabel: "Desde $39",
    style: "music",
    symbol: "♫",
    label: "Para compartir",
    isPremium: true,
  },
  {
    slug: "mil-razones",
    title: "Mil razones para sonreír",
    category: "Sorpresa",
    description: "Pequeñas notas para alegrarle cualquier día.",
    priceLabel: "Gratis",
    style: "notes",
    symbol: "♡",
    label: "Hecha con cariño",
    isPremium: false,
  },
].map((template) => ({
  ...template,
  id: randomUUID(),
  author: "DanexLove",
  isPublished: true,
  purchaseCount: 0,
  publishedAt: new Date("2026-10-14T00:00:00.000Z"),
  createdAt: new Date("2026-10-14T00:00:00.000Z"),
  updatedAt: new Date("2026-10-14T00:00:00.000Z"),
}));

export async function up({ context: queryInterface }) {
  const { DataTypes } = await import("sequelize");
  const sequelize = queryInterface.sequelize;

  await sequelize.transaction(async (transaction) => {
    const options = { transaction };
    await queryInterface.createTable("users", {
      id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
      name: { type: DataTypes.STRING(120), allowNull: false },
      email: { type: DataTypes.STRING(320), allowNull: false, unique: true },
      passwordHash: { type: DataTypes.STRING(255), allowNull: false },
      emailVerifiedAt: { type: DataTypes.DATE, allowNull: true },
      role: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "user" },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    }, options);

    await queryInterface.createTable("sessions", {
      id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
      },
      tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      revokedAt: { type: DataTypes.DATE, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
    }, options);
    await queryInterface.addIndex("sessions", ["userId", "expiresAt"], options);

    await queryInterface.createTable("templates", {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
      },
      slug: { type: DataTypes.STRING(120), allowNull: false, unique: true },
      title: { type: DataTypes.STRING(160), allowNull: false },
      description: { type: DataTypes.STRING(500), allowNull: false },
      author: { type: DataTypes.STRING(120), allowNull: false },
      category: { type: DataTypes.STRING(60), allowNull: false },
      style: { type: DataTypes.STRING(40), allowNull: false },
      symbol: { type: DataTypes.STRING(12), allowNull: false },
      label: { type: DataTypes.STRING(80), allowNull: false },
      priceLabel: { type: DataTypes.STRING(80), allowNull: false },
      isPremium: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      isPublished: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      purchaseCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      publishedAt: { type: DataTypes.DATE, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    }, options);
    await queryInterface.addIndex("templates", ["isPublished", "publishedAt"], options);
    await queryInterface.addIndex("templates", ["category", "isPublished"], options);
    await queryInterface.addIndex("templates", ["isPremium", "isPublished"], options);
    await queryInterface.bulkInsert("templates", sampleTemplates, options);
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.dropTable("templates", { transaction });
    await queryInterface.dropTable("sessions", { transaction });
    await queryInterface.dropTable("users", { transaction });
  });
}
