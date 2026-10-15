import "dotenv/config";
import { createApp } from "./app.js";
import { connectDatabase } from "./database.js";
import { emailService } from "./services/email-service.js";
import { createAuthService } from "./services/auth-service.js";
import { createExperienceService } from "./services/experience-service.js";

const port = Number(process.env.PORT ?? 3000);

try {
  const { templateRepository, authRepository, experienceRepository } = await connectDatabase();
  const authService = createAuthService({
    repository: authRepository,
    mailer: emailService,
  });
  const experienceService = createExperienceService(experienceRepository);
  const app = createApp({ templateRepository, authService, experienceService });
  app.listen(port, () => {
    console.info(`DanexLove API escuchando en el puerto ${port}`);
  });
} catch (error) {
  console.error(`No se pudo iniciar la API: ${error.message}`);
  process.exitCode = 1;
}
