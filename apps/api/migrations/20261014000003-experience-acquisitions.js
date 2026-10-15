export async function up({ context: queryInterface }) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.addColumn("experiences", "acquiredAt", {
      type: (await import("sequelize")).DataTypes.DATE,
      allowNull: true,
    }, { transaction });
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.removeColumn("experiences", "acquiredAt", { transaction });
  });
}