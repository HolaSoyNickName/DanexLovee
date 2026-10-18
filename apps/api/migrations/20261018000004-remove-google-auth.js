export async function up({ context: queryInterface }) {
  await queryInterface.removeIndex("users", "users_google_subject_unique");
  await queryInterface.removeColumn("users", "googleSubject");
}

export async function down({ context: queryInterface }) {
  const { DataTypes } = await import("sequelize");
  await queryInterface.addColumn("users", "googleSubject", {
    type: DataTypes.STRING(255),
    allowNull: true,
  });
  await queryInterface.addIndex("users", ["googleSubject"], {
    unique: true,
    name: "users_google_subject_unique",
  });
}
