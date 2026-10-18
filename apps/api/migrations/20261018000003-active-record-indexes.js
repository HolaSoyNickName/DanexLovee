export async function up({ context: queryInterface }) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.addIndex("sessions", [
      "userId",
      { name: "createdAt", order: "DESC" },
    ], {
      name: "sessions_active_user_recent_idx",
      where: { revokedAt: null },
      transaction,
    });

    await queryInterface.addIndex("email_tokens", ["userId", "purpose"], {
      name: "email_tokens_pending_user_purpose_idx",
      where: { usedAt: null },
      transaction,
    });

    await queryInterface.addIndex("public_experience_links", ["experienceId"], {
      name: "public_links_one_active_per_experience_idx",
      unique: true,
      where: { revokedAt: null },
      transaction,
    });
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.removeIndex(
      "public_experience_links",
      "public_links_one_active_per_experience_idx",
      { transaction },
    );
    await queryInterface.removeIndex(
      "email_tokens",
      "email_tokens_pending_user_purpose_idx",
      { transaction },
    );
    await queryInterface.removeIndex(
      "sessions",
      "sessions_active_user_recent_idx",
      { transaction },
    );
  });
}
