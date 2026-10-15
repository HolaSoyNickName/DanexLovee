import { fileURLToPath } from "node:url";
import { Sequelize } from "sequelize";
import { SequelizeStorage, Umzug } from "umzug";
import { createTemplateRepository } from "./repositories/template-repository.js";
import { createAuthRepository } from "./repositories/auth-repository.js";
import { createExperienceRepository } from "./repositories/experience-repository.js";
import { defineAuthModels } from "./models/auth.js";
import { defineTemplate } from "./models/template.js";

const apiDirectory = fileURLToPath(new URL("..", import.meta.url));

export async function connectDatabase(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error(
      "Falta DATABASE_URL. Copia apps/api/.env.example a apps/api/.env y configura PostgreSQL.",
    );
  }

  const sequelize = new Sequelize(databaseUrl, {
    dialect: "postgres",
    logging: false,
  });

  try {
    await sequelize.authenticate();
  } catch (error) {
    await sequelize.close();
    throw new Error(
      "No se pudo conectar a PostgreSQL. Comprueba el servicio y las credenciales de DATABASE_URL.",
      { cause: error },
    );
  }

  const queryInterface = sequelize.getQueryInterface();
  const migrations = new Umzug({
    migrations: { glob: "migrations/*.js", cwd: apiDirectory },
    context: queryInterface,
    storage: new SequelizeStorage({ sequelize }),
    logger: console,
  });

  try {
    await migrations.up();
  } catch (error) {
    await sequelize.close();
    throw new Error("No se pudieron aplicar las migraciones de la API.", { cause: error });
  }

  const Template = defineTemplate(sequelize);
  const authModels = defineAuthModels(sequelize);
  const experienceRepository = createExperienceRepository({
    ...authModels,
    Template,
    sequelize,
  });
  return {
    sequelize,
    templateRepository: createTemplateRepository(Template),
    authRepository: createAuthRepository({ ...authModels, sequelize }),
    experienceRepository,
  };
}
