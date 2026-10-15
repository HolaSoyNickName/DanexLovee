export async function up({ context: queryInterface }) {
  const { DataTypes } = await import("sequelize");
  await queryInterface.createTable("email_tokens", {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
    },
    purpose: { type: DataTypes.STRING(30), allowNull: false },
    tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    usedAt: { type: DataTypes.DATE, allowNull: true },
    createdAt: { type: DataTypes.DATE, allowNull: false },
  });
  await queryInterface.addIndex("email_tokens", ["userId", "purpose", "expiresAt"]);
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("email_tokens");
}
