export async function up({ context: queryInterface }) {
  const { DataTypes } = await import("sequelize");
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.createTable("experiences", {
      id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
      ownerId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
      },
      templateId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "templates", key: "id" },
        onDelete: "RESTRICT",
      },
      templateSnapshot: { type: DataTypes.JSONB, allowNull: false },
      content: { type: DataTypes.JSONB, allowNull: false },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "draft" },
      publishedAt: { type: DataTypes.DATE, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });
    await queryInterface.addIndex("experiences", ["ownerId", "updatedAt"], { transaction });
    await queryInterface.addIndex("experiences", ["status", "publishedAt"], { transaction });

    await queryInterface.createTable("public_experience_links", {
      id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
      experienceId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "experiences", key: "id" },
        onDelete: "CASCADE",
      },
      tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      expiresAt: { type: DataTypes.DATE, allowNull: true },
      revokedAt: { type: DataTypes.DATE, allowNull: true },
      lastAccessedAt: { type: DataTypes.DATE, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });
    await queryInterface.addIndex(
      "public_experience_links",
      ["experienceId", "revokedAt"],
      { transaction },
    );
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.dropTable("public_experience_links", { transaction });
    await queryInterface.dropTable("experiences", { transaction });
  });
}
