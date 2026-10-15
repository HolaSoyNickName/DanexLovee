import nodemailer from "nodemailer";

export class EmailDeliveryUnavailableError extends Error {
  constructor(message = "El servicio de correo no está configurado. Revisa las variables SMTP en apps/api/.env.") {
    super(message);
    this.name = "EmailDeliveryUnavailableError";
  }
}

let transport;

function createTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD) {
    throw new EmailDeliveryUnavailableError();
  }

  transport ??= nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    connectionTimeout: 10_000,
    socketTimeout: 10_000,
  });
  return transport;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

async function sendLink({ email, name, token, webOrigin, subject, path, purpose }) {
  const { SMTP_FROM } = process.env;
  if (!SMTP_FROM) throw new EmailDeliveryUnavailableError();

  const link = new URL(path, webOrigin);
  link.searchParams.set("token", token);
  const safeName = escapeHtml(name);
  const safeLink = escapeHtml(link.toString());
  try {
    await createTransport().sendMail({
      from: SMTP_FROM,
      to: email,
      subject,
      text: `${purpose}\n\n${link.toString()}\n\nSi no solicitaste este correo, puedes ignorarlo.`,
      html: `<p>Hola ${safeName}:</p><p>${purpose}</p><p><a href="${safeLink}">Continuar en DanexLove</a></p><p>Si no solicitaste este correo, puedes ignorarlo.</p>`,
    });
  } catch {
    throw new EmailDeliveryUnavailableError(
      "No se pudo enviar el correo. Comprueba la configuración SMTP e inténtalo de nuevo.",
    );
  }
}

export const emailService = {
  sendVerification(details) {
    return sendLink({
      ...details,
      subject: "Verifica tu correo de DanexLove",
      path: "/?action=verify-email",
      purpose: "Confirma tu dirección de correo para activar tu cuenta.",
    });
  },

  sendPasswordReset(details) {
    return sendLink({
      ...details,
      subject: "Restablece tu contraseña de DanexLove",
      path: "/?action=reset-password",
      purpose: "Usa este enlace para elegir una contraseña nueva.",
    });
  },
};
