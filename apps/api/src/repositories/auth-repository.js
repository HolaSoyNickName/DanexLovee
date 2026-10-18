import { Op } from "sequelize";

export function createAuthRepository({ User, Session, EmailToken, sequelize }) {
  return {
    findUserByEmail(email) {
      return User.findOne({ where: { email } });
    },

    createUser(user) {
      return User.create(user);
    },

    updateUser(userId, attributes) {
      return User.update(attributes, { where: { id: userId }, returning: true })
        .then(([, [user]]) => user);
    },

    findUserById(userId) {
      return User.findByPk(userId);
    },

    async createOneTimeToken(token) {
      await sequelize.transaction(async (transaction) => {
        await EmailToken.update(
          { usedAt: new Date() },
          {
            where: {
              userId: token.userId,
              purpose: token.purpose,
              usedAt: null,
            },
            transaction,
          },
        );
        await EmailToken.create(token, { transaction });
      });
    },

    async consumeOneTimeToken(purpose, tokenHash) {
      return sequelize.transaction(async (transaction) => {
        const now = new Date();
        const token = await EmailToken.findOne({
          where: {
            purpose,
            tokenHash,
            usedAt: null,
            expiresAt: { [Op.gt]: now },
          },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!token) return null;

        await token.update({ usedAt: now }, { transaction });
        return User.findByPk(token.userId, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
      });
    },

    async createSession(session) {
      return Session.create(session);
    },

    findValidSession(tokenHash, now = new Date()) {
      return Session.findOne({
        where: {
          tokenHash,
          revokedAt: null,
          expiresAt: { [Op.gt]: now },
        },
        include: [{ model: User, as: "user" }],
      });
    },

    async extendSession(sessionId, expiresAt) {
      await Session.update({ expiresAt }, { where: { id: sessionId, revokedAt: null } });
    },

    async revokeSession(tokenHash, now = new Date()) {
      await Session.update(
        { revokedAt: now },
        { where: { tokenHash, revokedAt: null } },
      );
    },

    async listSessions(userId) {
      const sessions = await Session.findAll({
        where: {
          userId,
          revokedAt: null,
          expiresAt: { [Op.gt]: new Date() },
        },
        order: [["createdAt", "DESC"]],
      });
      return sessions.map((session) => ({
        id: session.id,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        revokedAt: session.revokedAt,
      }));
    },

    async revokeOwnedSession(userId, sessionId, now = new Date()) {
      const [count] = await Session.update(
        { revokedAt: now },
        { where: { userId, id: sessionId, revokedAt: null } },
      );
      return count > 0;
    },

    async revokeAllSessions(userId, exceptId, now = new Date()) {
      await Session.update(
        { revokedAt: now },
        {
          where: {
            userId,
            revokedAt: null,
            ...(exceptId ? { id: { [Op.ne]: exceptId } } : {}),
          },
        },
      );
    },
  };
}
