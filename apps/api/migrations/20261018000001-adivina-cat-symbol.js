export async function up({ context: queryInterface }) {
  await queryInterface.bulkUpdate("templates", { symbol: "🐱" }, { slug: "adivina" });
}

export async function down({ context: queryInterface }) {
  await queryInterface.bulkUpdate("templates", { symbol: "🍉" }, { slug: "adivina" });
}
