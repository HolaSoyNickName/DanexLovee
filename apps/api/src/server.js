import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { createApp } from "./app.js";
import { connectDatabase } from "./database.js";
import { emailService } from "./services/email-service.js";
import { createAuthService } from "./services/auth-service.js";
import { createExperienceService } from "./services/experience-service.js";

dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

const port = Number(process.env.PORT ?? 3000);
const firebaseProjectId = process.env.FIREBASE_PROJECT_ID?.trim();
const firebaseApp = firebaseProjectId
  ? initializeApp({
    credential: applicationDefault(),
    projectId: firebaseProjectId,
  })
  : null;
const firebaseTokenVerifier = firebaseApp
  ? async (idToken) => {
    const decodedToken = await getAuth(firebaseApp).verifyIdToken(idToken, true);
    return {
      sub: decodedToken.uid,
      email: decodedToken.email,
      email_verified: decodedToken.email_verified,
      name: decodedToken.name,
      sign_in_provider: decodedToken.firebase?.sign_in_provider,
    };
  }
  : undefined;

try {
  const { templateRepository, authRepository, experienceRepository } = await connectDatabase();
  const authService = createAuthService({
    repository: authRepository,
    mailer: emailService,
    firebaseTokenVerifier,
  });
  const experienceService = createExperienceService(
    experienceRepository,
    process.env.WEB_ORIGIN ?? "http://localhost:5173",
  );
  const app = createApp({ templateRepository, authService, experienceService });
  app.listen(port, () => {
    console.info(`DanexLove API escuchando en el puerto ${port}`);
  });
} catch (error) {
  console.error(`No se pudo iniciar la API: ${error.message}`);
  process.exitCode = 1;
}
