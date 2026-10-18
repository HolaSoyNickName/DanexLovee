import { randomBytes } from "node:crypto";
import { digestToken } from "./auth-service.js";

const accents = new Set(["rose", "violet", "blue", "sunshine"]);

export class ExperienceError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = "ExperienceError";
    this.code = code;
    this.status = status;
  }
}

export function validateExperienceContent(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ExperienceError("INVALID_CONTENT", "El contenido de la experiencia no es válido.", 400);
  }

  const { title, recipientName, message, accentColor } = value;
  if (typeof title !== "string" || !title.trim() || title.trim().length > 120) {
    throw new ExperienceError("INVALID_TITLE", "El título debe tener entre 1 y 120 caracteres.", 400);
  }
  if (typeof recipientName !== "string" || !recipientName.trim() || recipientName.trim().length > 100) {
    throw new ExperienceError("INVALID_RECIPIENT", "El nombre del destinatario es obligatorio (máximo 100 caracteres).", 400);
  }
  if (typeof message !== "string" || !message.trim() || message.trim().length > 3000) {
    throw new ExperienceError("INVALID_MESSAGE", "El mensaje es obligatorio y admite hasta 3000 caracteres.", 400);
  }
  if (!accents.has(accentColor)) {
    throw new ExperienceError("INVALID_STYLE", "Elige uno de los estilos disponibles.", 400);
  }

  return {
    title: title.trim(),
    recipientName: recipientName.trim(),
    message: message.trim(),
    accentColor,
  };
}

function getShareOrigin(webOrigin) {
  const origin = new URL(webOrigin);
  const octets = origin.hostname.split(".").map(Number);
  const isPrivateIpv4 = octets.length === 4 && (
    octets[0] === 10
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168)
  );
  const isLocalOrigin = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
    || isPrivateIpv4;

  if (!isLocalOrigin) origin.protocol = "https:";
  return origin.origin;
}

export function createExperienceService(
  repository,
  webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5173",
) {
  const shareOrigin = getShareOrigin(webOrigin);
  return {
    create(ownerId, templateSlug) {
      return repository.createFromTemplate(ownerId, templateSlug);
    },

    list(ownerId) {
      return repository.listOwned(ownerId);
    },

    findOwned(ownerId, experienceId) {
      return repository.findOwned(ownerId, experienceId);
    },

    async saveDraft(ownerId, experienceId, content) {
      const cleanContent = validateExperienceContent(content);
      return repository.saveDraft(ownerId, experienceId, cleanContent);
    },

    resetDraft(ownerId, experienceId) {
      return repository.resetDraft(ownerId, experienceId);
    },

    async acquireFree(ownerId, experienceId) {
      const experience = await repository.findOwned(ownerId, experienceId);
      if (!experience) return null;
      validateExperienceContent(experience.content);
      return repository.acquireFreeTemplate(ownerId, experienceId);
    },

    async publish(ownerId, experienceId, expirationDays) {
      if (
        expirationDays !== undefined
        && expirationDays !== null
        && (!Number.isInteger(expirationDays) || expirationDays < 1 || expirationDays > 365)
      ) {
        throw new ExperienceError(
          "INVALID_EXPIRATION",
          "El enlace puede durar de 1 a 365 días, o no tener caducidad.",
          400,
        );
      }

      const experience = await repository.findOwned(ownerId, experienceId);
      if (!experience) return null;
      if (!experience.acquiredAt) {
        throw new ExperienceError("EXPERIENCE_NOT_ACQUIRED", "Obtén la plantilla antes de publicar.", 409);
      }
      if (experience.status === "draft") {
        validateExperienceContent(experience.content);
      }

      const token = randomBytes(32).toString("base64url");
      const expiresAt = expirationDays
        ? new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000)
        : null;
      const published = await repository.createPublicLink(
        ownerId,
        experienceId,
        digestToken(token),
        expiresAt,
      );
      if (!published) return null;

      return {
        experience: published,
        shareUrl: new URL(`/e/${token}`, shareOrigin).toString(),
        expiresAt,
      };
    },

    revokeLinks(ownerId, experienceId) {
      return repository.revokePublicLinks(ownerId, experienceId);
    },

    getPublicExperience(token) {
      return repository.findPublicByToken(digestToken(token));
    },
  };
}
