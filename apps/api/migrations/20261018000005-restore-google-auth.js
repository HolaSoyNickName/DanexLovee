export async function up({ context: queryInterface }) {
  const { DataTypes } = await import("sequelize");
  const columns = await queryInterface.describeTable("users");
  const indexes = await queryInterface.showIndex("users");
  if (!columns.googleSubject) {
    await queryInterface.addColumn("users", "googleSubject", {
      type: DataTypes.STRING(255),
      allowNull: true,
    });
  }
  if (!indexes.some((index) => index.name === "users_google_subject_unique")) {
    await queryInterface.addIndex("users", ["googleSubject"], {
      unique: true,
      name: "users_google_subject_unique",
    });
  }
}

export async function down({ context: queryInterface }) {
  const indexes = await queryInterface.showIndex("users");
  const columns = await queryInterface.describeTable("users");
  if (indexes.some((index) => index.name === "users_google_subject_unique")) {
    await queryInterface.removeIndex("users", "users_google_subject_unique");
  }
  if (columns.googleSubject) await queryInterface.removeColumn("users", "googleSubject");
}
