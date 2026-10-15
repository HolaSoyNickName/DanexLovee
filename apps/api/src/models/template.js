import { DataTypes } from "sequelize";

export function defineTemplate(sequelize) {
  return sequelize.define(
    "Template",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      slug: {
        type: DataTypes.STRING(120),
        allowNull: false,
        unique: true,
      },
      title: {
        type: DataTypes.STRING(160),
        allowNull: false,
      },
      description: {
        type: DataTypes.STRING(500),
        allowNull: false,
      },
      author: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      category: {
        type: DataTypes.STRING(60),
        allowNull: false,
      },
      style: {
        type: DataTypes.STRING(40),
        allowNull: false,
      },
      symbol: {
        type: DataTypes.STRING(12),
        allowNull: false,
      },
      label: {
        type: DataTypes.STRING(80),
        allowNull: false,
      },
      priceLabel: {
        type: DataTypes.STRING(80),
        allowNull: false,
      },
      isPremium: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      isPublished: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      purchaseCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      publishedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "templates",
      indexes: [
        { fields: ["isPublished", "publishedAt"] },
        { fields: ["category", "isPublished"] },
        { fields: ["isPremium", "isPublished"] },
      ],
    },
  );
}
