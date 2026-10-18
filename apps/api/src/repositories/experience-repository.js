import { Op } from "sequelize";
import { randomUUID } from "node:crypto";

const snapshotFields = [
  "slug",
  "title",
  "description",
  "category",
  "style",
  "symbol",
  "label",
];

function getInitialContent(templateSnapshot) {
  return {
    title: templateSnapshot.title,
    recipientName: "",
    message: templateSnapshot.slug === "adivina"
      ? "¡Sabía que lo acertarías! Me debes unos besotes 💋"
      : templateSnapshot.slug === "galaxia-de-amor"
        ? "Te amo con todo mi corazón y alma para siempre, mi amor eterno."
        : "",
    accentColor: "rose",
  };
}

export function createExperienceRepository({
  Experience,
  PublicExperienceLink,
  Template,
  sequelize,
}) {
  return {
    async createFromTemplate(ownerId, slug) {
      return sequelize.transaction(async (transaction) => {
        const template = await Template.findOne({
          where: { slug, isPublished: true, isPremium: false },
          transaction,
        });
        if (!template) return null;

        const templateData = template.get({ plain: true });
        return Experience.create(
          {
            id: randomUUID(),
            ownerId,
            templateId: templateData.id,
            templateSnapshot: Object.fromEntries(
              snapshotFields.map((field) => [field, templateData[field]]),
            ),
            content: getInitialContent(templateData),
            status: "draft",
            acquiredAt: null,
            publishedAt: null,
          },
          { transaction },
        );
      });
    },

    findOwned(ownerId, experienceId) {
      return Experience.findOne({ where: { id: experienceId, ownerId } });
    },

    listOwned(ownerId) {
      return Experience.findAll({
        where: { ownerId },
        order: [["updatedAt", "DESC"]],
      });
    },

    async saveDraft(ownerId, experienceId, content) {
      return sequelize.transaction(async (transaction) => {
        const experience = await Experience.findOne({
          where: { id: experienceId, ownerId },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!experience || experience.status !== "draft") return null;
        await experience.update({ content }, { transaction });
        return experience;
      });
    },

    async resetDraft(ownerId, experienceId) {
      return sequelize.transaction(async (transaction) => {
        const experience = await Experience.findOne({
          where: { id: experienceId, ownerId },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!experience || experience.status !== "draft") return null;
        await experience.update({
          content: getInitialContent(experience.templateSnapshot),
        }, { transaction });
        return experience;
      });
    },

    async acquireFreeTemplate(ownerId, experienceId) {
      return sequelize.transaction(async (transaction) => {
        const experience = await Experience.findOne({
          where: { id: experienceId, ownerId },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!experience) return null;
        if (experience.acquiredAt) return experience;

        const template = await Template.findByPk(experience.templateId, { transaction });
        if (!template || template.isPremium) return null;

        await experience.update({ acquiredAt: new Date() }, { transaction });
        return experience;
      });
    },

    async createPublicLink(ownerId, experienceId, tokenHash, expiresAt) {
      return sequelize.transaction(async (transaction) => {
        const experience = await Experience.findOne({
          where: { id: experienceId, ownerId },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!experience || !experience.acquiredAt) return null;

        const now = new Date();
        await PublicExperienceLink.update(
          { revokedAt: now },
          {
            where: { experienceId, revokedAt: null },
            transaction,
          },
        );
        await PublicExperienceLink.create({
          id: randomUUID(),
          experienceId,
          tokenHash,
          expiresAt,
          revokedAt: null,
          lastAccessedAt: null,
          createdAt: now,
        }, { transaction });
        if (experience.status === "draft") {
          await experience.update({ status: "published", publishedAt: now }, { transaction });
        }
        return experience;
      });
    },

    async revokePublicLinks(ownerId, experienceId) {
      return sequelize.transaction(async (transaction) => {
        const experience = await Experience.findOne({
          where: { id: experienceId, ownerId },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!experience) return null;
        const [count] = await PublicExperienceLink.update(
          { revokedAt: new Date() },
          { where: { experienceId, revokedAt: null }, transaction },
        );
        await experience.update({ status: "draft", publishedAt: null }, { transaction });
        return count;
      });
    },

    async findPublicByToken(tokenHash, now = new Date()) {
      const link = await PublicExperienceLink.findOne({
        where: {
          tokenHash,
          revokedAt: null,
          [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: now } }],
        },
        include: [{ model: Experience, as: "experience" }],
      });
      if (!link) return null;
      await link.update({ lastAccessedAt: now });
      return link.experience;
    },
  };
}
