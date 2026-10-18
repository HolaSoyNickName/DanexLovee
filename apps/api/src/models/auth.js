import { DataTypes } from "sequelize";

export function defineAuthModels(sequelize) {
  const User = sequelize.define(
    "User",
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      name: { type: DataTypes.STRING(120), allowNull: false },
      email: { type: DataTypes.STRING(320), allowNull: false, unique: true },
      passwordHash: { type: DataTypes.STRING(255), allowNull: true },
      emailVerifiedAt: { type: DataTypes.DATE, allowNull: true },
      role: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "user" },
    },
    { tableName: "users" },
  );

  const Session = sequelize.define(
    "Session",
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
      },
      tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      revokedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { tableName: "sessions", updatedAt: false },
  );

  const EmailToken = sequelize.define(
    "EmailToken",
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
      },
      purpose: { type: DataTypes.STRING(30), allowNull: false },
      tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      usedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { tableName: "email_tokens", updatedAt: false },
  );

  const Experience = sequelize.define(
    "Experience",
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      ownerId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
      },
      templateId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "templates", key: "id" },
      },
      templateSnapshot: { type: DataTypes.JSONB, allowNull: false },
      content: { type: DataTypes.JSONB, allowNull: false },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "draft" },
      acquiredAt: { type: DataTypes.DATE, allowNull: true },
      publishedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { tableName: "experiences" },
  );

  const PublicExperienceLink = sequelize.define(
    "PublicExperienceLink",
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      experienceId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "experiences", key: "id" },
      },
      tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      expiresAt: { type: DataTypes.DATE, allowNull: true },
      revokedAt: { type: DataTypes.DATE, allowNull: true },
      lastAccessedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { tableName: "public_experience_links", updatedAt: false },
  );

  Session.belongsTo(User, { as: "user", foreignKey: "userId" });
  Experience.belongsTo(User, { as: "owner", foreignKey: "ownerId" });
  Experience.belongsTo(sequelize.models.Template, { as: "template", foreignKey: "templateId" });
  PublicExperienceLink.belongsTo(Experience, { as: "experience", foreignKey: "experienceId" });
  return { User, Session, EmailToken, Experience, PublicExperienceLink };
}
