import { Op } from "sequelize";

const sortOptions = {
  newest: [["publishedAt", "DESC"], ["title", "ASC"]],
  "price-asc": [["isPremium", "ASC"], ["title", "ASC"]],
  "price-desc": [["isPremium", "DESC"], ["title", "ASC"]],
  popular: [["purchaseCount", "DESC"], ["publishedAt", "DESC"]],
};

export function createTemplateRepository(Template) {
  return {
    async list({ category, search, price, sort, page, pageSize }) {
      const where = { isPublished: true };

      if (category) where.category = category;
      if (price === "free") where.isPremium = false;
      if (price === "premium") where.isPremium = true;
      if (search) {
        where[Op.or] = [
          { title: { [Op.iLike]: `%${search}%` } },
          { description: { [Op.iLike]: `%${search}%` } },
          { category: { [Op.iLike]: `%${search}%` } },
        ];
      }

      const { count, rows } = await Template.findAndCountAll({
        where,
        order: sortOptions[sort],
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });

      return {
        items: rows,
        pagination: {
          page,
          pageSize,
          totalItems: count,
          totalPages: Math.ceil(count / pageSize),
        },
      };
    },

    async findPublishedBySlug(slug) {
      return Template.findOne({
        where: { slug, isPublished: true },
      });
    },
  };
}
