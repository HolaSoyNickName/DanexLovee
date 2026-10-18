import { lazy, Suspense, useEffect, useRef, useState } from "react";

const GalaxyExperience = lazy(() => import("./GalaxyExperience.jsx"));

const catalogCategories = [
  { name: "Aniversario", slug: "aniversario", symbol: "♡", description: "Celebra su historia y todos los momentos que han compartido." },
  { name: "Cumpleaños", slug: "cumpleanos", symbol: "✳", description: "Haz que su día especial se sienta todavía más suyo." },
  { name: "Sorpresa", slug: "sorpresa", symbol: "✦", description: "Prepara un detalle inesperado para sacarle una sonrisa." },
  { name: "Amistad", slug: "amistad", symbol: "☼", description: "Dile a esa persona cuánto valoras tenerla cerca." },
];
const pendingTemplateStorageKey = "danexlove.pending-template";

function MobileMenuToggle({ open, onClick }) {
  return (
    <button
      className="mobile-menu-toggle"
      type="button"
      aria-label={open ? "Cerrar menú" : "Abrir menú"}
      aria-expanded={open}
      aria-controls="primary-navigation"
      onClick={onClick}
    >
      <span /><span /><span />
    </button>
  );
}

function readPendingTemplateSlug() {
  const slug = window.localStorage.getItem(pendingTemplateStorageKey) ?? "";
  return /^[a-z0-9-]{1,120}$/i.test(slug) ? slug : "";
}

function persistPendingTemplateSlug(slug) {
  window.localStorage.setItem(pendingTemplateStorageKey, slug);
}

function clearPendingTemplateSlug() {
  window.localStorage.removeItem(pendingTemplateStorageKey);
}

async function readApiResponse(response, failureMessage) {
  if (response.status === 429) {
    throw new Error("Demasiados intentos. Espera un momento e inténtalo de nuevo.");
  }
  const text = await response.text();
  let result = {};
  if (text) {
    try {
      result = JSON.parse(text);
    } catch {
      if (!response.ok) throw new Error(failureMessage);
      throw new Error("La respuesta del servidor no tiene un formato válido.");
    }
  }
  if (!response.ok) {
    const message = result.error?.message ?? failureMessage;
    const diagnostic = result.error?.diagnostic;
    const diagnosticCode = [diagnostic?.name, diagnostic?.code, diagnostic?.causeCode]
      .filter(Boolean)
      .join(" / ");
    throw new Error(diagnosticCode ? `${message} (${diagnosticCode})` : message);
  }
  return result;
}

async function copyTextToClipboard(value) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {}
  }

  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.append(field);
  field.select();
  const copied = document.execCommand("copy");
  field.remove();
  if (!copied) throw new Error("No se pudo copiar el enlace. Mantén pulsado el campo para copiarlo.");
}

const steps = [
  {
    number: "01",
    title: "Encuentra tu idea",
    description: "Explora las inspiraciones y previsualiza la que más conecte contigo.",
    symbol: "⌕",
  },
  {
    number: "02",
    title: "Hazla tuya",
    description: "Escribe tu mensaje, elige un tono y mira los cambios al instante.",
    symbol: "✎",
  },
  {
    number: "03",
    title: "Publícala y compártela",
    description: "Obtén tu plantilla gratuita y crea un enlace para esa persona especial.",
    symbol: "↗",
  },
];

function Brand({ footer = false }) {
  return (
    <a
      className={`brand${footer ? " brand-footer" : ""}`}
      href="#inicio"
      aria-label="DanexLove, inicio"
    >
      <span className="brand-mark" aria-hidden="true">♥</span>
      <span>Danex<span>Love</span></span>
    </a>
  );
}

function PasswordField({
  name,
  label,
  value,
  autoComplete,
  minLength,
  visible,
  onChange,
  onToggle,
}) {
  return (
    <label className="auth-password-label">{label}
      <span className="password-field-control">
        <input
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          minLength={minLength}
          maxLength="128"
          value={value}
          onChange={onChange}
          required
        />
        <button
          className="password-visibility"
          type="button"
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={visible}
          title={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          onClick={onToggle}
        >
          <span className={`password-eye-icon${visible ? " is-visible" : ""}`} aria-hidden="true" />
        </button>
      </span>
    </label>
  );
}

function AuthDialog({ mode, user, resetToken, onClose, onAuthenticated, onLoggedOut }) {
  const [activeMode, setActiveMode] = useState(mode);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "", currentPassword: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const onAuthenticatedRef = useRef(onAuthenticated);
  const onCloseRef = useRef(onClose);

  onAuthenticatedRef.current = onAuthenticated;
  onCloseRef.current = onClose;

  useEffect(() => {
    setActiveMode(mode);
    setMessage("");
    setError("");
  }, [mode]);

  useEffect(() => {
    if (activeMode !== "account") return;
    fetch("/api/v1/auth/sessions", { credentials: "include" })
      .then((response) => readApiResponse(response, "No pudimos cargar tus sesiones."))
      .then((result) => setSessions(result.sessions))
      .catch((requestError) => setError(requestError.message));
  }, [activeMode]);

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError("");
  };

  const renderPasswordField = (name, label, autoComplete, minLength) => (
    <PasswordField
      name={name}
      label={label}
      value={form[name]}
      autoComplete={autoComplete}
      minLength={minLength}
      visible={Boolean(visiblePasswords[name])}
      onChange={updateField}
      onToggle={() => setVisiblePasswords((current) => ({
        ...current,
        [name]: !current[name],
      }))}
    />
  );

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    let path;
    let payload;
    if (activeMode === "register") {
      path = "/api/v1/auth/register";
      payload = { name: form.name, email: form.email, password: form.password };
    } else if (activeMode === "login") {
      path = "/api/v1/auth/login";
      payload = { email: form.email, password: form.password };
    } else if (activeMode === "forgot") {
      path = "/api/v1/auth/password/reset";
      payload = { email: form.email };
    } else if (activeMode === "reset") {
      if (form.password !== form.confirmPassword) {
        setError("Las contraseñas no coinciden.");
        setBusy(false);
        return;
      }
      path = "/api/v1/auth/password/reset/confirm";
      payload = { token: resetToken, password: form.password };
    } else if (activeMode === "change-password") {
      if (form.password !== form.confirmPassword) {
        setError("Las contraseñas no coinciden.");
        setBusy(false);
        return;
      }
      path = "/api/v1/auth/password";
      payload = { currentPassword: form.currentPassword, newPassword: form.password };
    } else {
      path = "/api/v1/auth/me";
      payload = { name: form.name || user.name };
    }

    try {
      const response = await fetch(path, {
        method: activeMode === "account" ? "PATCH" : activeMode === "change-password" ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = response.status === 204
      ? {}
      : await readApiResponse(response, "No se pudo completar la solicitud.");

      if (activeMode === "login" || activeMode === "change-password" || activeMode === "account") {
        onAuthenticated(result.user);
        if (activeMode === "account") setMessage("Tu perfil se actualizó.");
        else if (activeMode === "login") onClose();
        else setMessage("Tu contraseña se actualizó.");
      } else if (activeMode === "reset") {
        setMessage(result.message);
        setActiveMode("login");
        window.history.replaceState({}, "", window.location.pathname);
      } else {
        setMessage(activeMode === "register"
          ? `${result.message} Revisa también spam; si no llega, puedes reenviar la verificación desde aquí.`
          : result.message);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const resendVerification = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/v1/auth/verification/resend", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });
      const result = await readApiResponse(response, "No se pudo enviar el enlace.");
      setMessage(result.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const revokeSession = async (sessionId) => {
    setError("");
    try {
      const response = await fetch(`/api/v1/auth/sessions/${sessionId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const result = await readApiResponse(response, "No se pudo cerrar esa sesión.");
      }
      if (sessions.find((session) => session.id === sessionId)?.current) {
        onLoggedOut();
        return;
      }
      setSessions((current) => current.filter((session) => session.id !== sessionId));
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const logout = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/v1/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("No se pudo cerrar la sesión.");
      onLoggedOut();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const isAccountMode = activeMode === "account" || activeMode === "change-password";
  const title = {
    login: "Qué bueno tenerte de vuelta",
    register: "Crea tu cuenta",
    forgot: "Recupera tu acceso",
    reset: "Elige una contraseña nueva",
    account: "Tu cuenta",
    "change-password": "Cambiar contraseña",
  }[activeMode];

  return (
    <div className="auth-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="auth-close" type="button" aria-label="Cerrar" onClick={onClose}>×</button>
        <p className="eyebrow">DANEXLOVE</p>
        <h2 id="auth-title">{title}</h2>
        {activeMode === "account" && user ? (
          <form className="auth-form" onSubmit={submit}>
            <label>Nombre
              <input name="name" maxLength="120" defaultValue={user.name} onChange={updateField} required />
            </label>
            <label>Correo electrónico
              <input value={user.email} disabled />
            </label>
            <button className="button button-dark auth-submit" disabled={busy}>Guardar perfil</button>
            <button className="auth-text-button" type="button" onClick={() => setActiveMode("change-password")}>Cambiar contraseña</button>
            <div className="auth-sessions">
              <strong>Sesiones activas</strong>
              {sessions.map((session) => (
                <span className="auth-session-row" key={session.id}>
                  {session.current ? "Este dispositivo" : "Otro dispositivo"} · vence {new Date(session.expiresAt).toLocaleDateString("es-MX")}
                  <button type="button" onClick={() => revokeSession(session.id)}>
                    {session.current ? "Cerrar esta sesión" : "Revocar"}
                  </button>
                </span>
              ))}
            </div>
            <button className="auth-text-button" type="button" onClick={logout} disabled={busy}>Cerrar sesión</button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={submit}>
            {activeMode === "register" && (
              <label>Nombre
                <input name="name" autoComplete="name" minLength="2" maxLength="120" value={form.name} onChange={updateField} required />
              </label>
            )}
            {(activeMode === "login" || activeMode === "register" || activeMode === "forgot") && (
              <label>Correo electrónico
                <input name="email" type="email" autoComplete="email" maxLength="320" value={form.email} onChange={updateField} required />
              </label>
            )}
            {activeMode === "change-password" && (
              renderPasswordField("currentPassword", "Contraseña actual", "current-password")
            )}
            {(activeMode === "login" || activeMode === "register" || activeMode === "reset" || activeMode === "change-password") && (
              renderPasswordField(
                "password",
                activeMode === "login" ? "Contraseña" : "Nueva contraseña",
                activeMode === "login" ? "current-password" : "new-password",
                activeMode === "login" ? undefined : 8,
              )
            )}
            {(activeMode === "reset" || activeMode === "change-password") && (
              renderPasswordField("confirmPassword", "Confirma la contraseña", "new-password", 8)
            )}
            <button className="button button-dark auth-submit" type="submit" disabled={busy}>
              {busy ? "Un momento..." : activeMode === "login" ? "Iniciar sesión" : activeMode === "register" ? "Crear cuenta" : activeMode === "forgot" ? "Enviar instrucciones" : activeMode === "reset" ? "Guardar contraseña" : activeMode === "change-password" ? "Actualizar contraseña" : "Continuar"}
            </button>
            {activeMode === "login" && (
              <button className="auth-text-button" type="button" onClick={() => setActiveMode("forgot")}>Olvidé mi contraseña</button>
            )}
            {activeMode === "login" && form.email && (
              <button className="auth-text-button" type="button" onClick={resendVerification} disabled={busy}>No recibí el correo. Reenviar verificación</button>
            )}
            {activeMode === "register" && form.email && (message || error) && (
              <button className="auth-text-button" type="button" onClick={resendVerification} disabled={busy}>Reenviar correo de verificación</button>
            )}
          </form>
        )}
        {message && <p className="auth-message" role="status">{message}</p>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        {!isAccountMode && activeMode !== "reset" && (
          <div className="auth-switch">
            {activeMode === "register" ? (
              <>¿Ya tienes cuenta? <button type="button" onClick={() => setActiveMode("login")}>Inicia sesión</button></>
            ) : activeMode === "login" ? (
              <>¿Primera vez aquí? <button type="button" onClick={() => setActiveMode("register")}>Crea tu cuenta</button></>
            ) : (
              <button type="button" onClick={() => setActiveMode("login")}>Volver a iniciar sesión</button>
            )}
          </div>
        )}
        {activeMode === "change-password" && (
          <div className="auth-switch"><button type="button" onClick={() => setActiveMode("account")}>Volver a mi cuenta</button></div>
        )}
      </section>
    </div>
  );
}

function ExperienceWorkspace({ initialExperience, onClose, onOpenEditor }) {
  const [experiences, setExperiences] = useState([]);
  const [selected, setSelected] = useState(initialExperience ?? null);
  const [content, setContent] = useState(initialExperience?.content ?? {});
  const [expirationDays, setExpirationDays] = useState("30");
  const [shareUrl, setShareUrl] = useState("");
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/v1/experiences", { credentials: "include" })
      .then((response) => readApiResponse(response, "No pudimos cargar tus experiencias."))
      .then((result) => {
        setExperiences(result.experiences);
        setStatus("ready");
      })
      .catch((requestError) => {
        setError(requestError.message);
        setStatus("error");
      });
  }, []);

  const selectExperience = (experience) => {
    setSelected(experience);
    setContent(experience?.content ?? {});
    setShareUrl("");
    setError("");
    setNotice("");
  };

  const updateField = (event) => {
    setContent((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError("");
    setNotice("");
  };

  const saveDraft = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/v1/experiences/${selected.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const result = await readApiResponse(response, "No se pudo guardar el borrador.");
      setSelected(result.experience);
      setContent(result.experience.content);
      setExperiences((current) => current.map((item) => item.id === result.experience.id ? result.experience : item));
      setNotice("Borrador guardado.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/v1/experiences/${selected.id}/publish`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expirationDays: expirationDays ? Number(expirationDays) : null }),
      });
      const result = await readApiResponse(response, "No se pudo publicar la experiencia.");
      setSelected(result.experience);
      setExperiences((current) => current.map((item) => item.id === result.experience.id ? result.experience : item));
      setShareUrl(result.shareUrl);
      setNotice("Tu enlace está listo para compartir.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const revokeLink = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/v1/experiences/${selected.id}/link`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) await readApiResponse(response, "No se pudo revocar el enlace.");
      setShareUrl("");
      const draft = { ...selected, status: "draft", publishedAt: null };
      setSelected(draft);
      setExperiences((current) => current.map((item) => item.id === draft.id ? draft : item));
      setNotice("El enlace anterior dejó de estar disponible.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="studio-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="studio-dialog" role="dialog" aria-modal="true" aria-labelledby="studio-title">
        <header className="studio-header">
          <div>
            <p className="eyebrow">TU TALLER PERSONAL</p>
            <h2 id="studio-title">{selected ? "Dale forma a tu idea" : "Mis experiencias"}</h2>
          </div>
          <button className="auth-close" type="button" aria-label="Cerrar" onClick={onClose}>×</button>
        </header>

        {!selected ? (
          <div className="experience-list">
            {status === "loading" && <p role="status">Cargando tus borradores...</p>}
            {status === "error" && <p className="catalog-error" role="alert">{error}</p>}
            {status === "ready" && experiences.length === 0 && (
              <div className="experience-empty">
                <span aria-hidden="true">✳</span>
                <h3>Aquí empieza tu primera historia.</h3>
                <p>Elige una inspiración del catálogo para crear una experiencia propia.</p>
                <button className="button button-dark" type="button" onClick={onClose}>Explorar plantillas <span aria-hidden="true">→</span></button>
              </div>
            )}
            {experiences.map((experience) => (
              <button className="experience-row" type="button" key={experience.id} onClick={() => onOpenEditor(experience.id)}>
                <span className={`experience-row-symbol accent-${experience.content.accentColor}`} aria-hidden="true">{experience.templateSnapshot.symbol}</span>
                <span className="experience-row-copy">
                  <strong>{experience.content.title || experience.templateSnapshot.title}</strong>
                  <small>{experience.templateSnapshot.category} · {experience.status === "published" ? "Publicada" : "Borrador"}</small>
                </span>
                <span aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <button className="studio-back" type="button" onClick={() => selectExperience(null)}>← Todas mis experiencias</button>
            <div className="studio-layout">
              <form className="studio-form" onSubmit={(event) => event.preventDefault()}>
                <label>Título de tu experiencia
                  <input name="title" value={content.title ?? ""} maxLength="120" onChange={updateField} disabled={selected.status === "published"} />
                </label>
                <label>¿Para quién es?
                  <input name="recipientName" value={content.recipientName ?? ""} maxLength="100" placeholder="Su nombre" onChange={updateField} disabled={selected.status === "published"} />
                </label>
                <label>Tu mensaje
                  <textarea name="message" value={content.message ?? ""} maxLength="3000" rows="6" placeholder="Escribe algo que quieras que recuerde..." onChange={updateField} disabled={selected.status === "published"} />
                  <span className="studio-count">{(content.message ?? "").length}/3000</span>
                </label>
                <fieldset className="studio-colors" disabled={selected.status === "published"}>
                  <legend>Elige un tono</legend>
                  {[
                    ["rose", "Rosa"],
                    ["violet", "Violeta"],
                    ["blue", "Azul"],
                    ["sunshine", "Sol"],
                  ].map(([color, label]) => (
                    <button
                      className={`color-swatch swatch-${color}${content.accentColor === color ? " selected" : ""}`}
                      type="button"
                      key={color}
                      aria-label={label}
                      aria-pressed={content.accentColor === color}
                      onClick={() => setContent((current) => ({ ...current, accentColor: color }))}
                    />
                  ))}
                </fieldset>
                {error && <p className="catalog-error" role="alert">{error}</p>}
                {notice && <p className="studio-notice" role="status">{notice}</p>}
                {shareUrl && (
                  <div className="share-link-box">
                    <label htmlFor="share-link">Enlace para compartir</label>
                    <div>
                      <input id="share-link" readOnly value={shareUrl} onFocus={(event) => event.target.select()} />
                      <button type="button" className="button button-dark" onClick={async () => {
                        try {
                          await copyTextToClipboard(shareUrl);
                          setNotice("Enlace copiado.");
                        } catch (copyError) {
                          setError(copyError.message);
                        }
                      }}>Copiar</button>
                      <a className="button button-outline" href={shareUrl} target="_blank" rel="noopener noreferrer">Abrir en otra pestaña <span aria-hidden="true">↗</span></a>
                    </div>
                  </div>
                )}
                <div className="studio-actions">
                  {selected.status === "draft" ? (
                    <>
                      <button className="button button-outline" type="button" onClick={saveDraft} disabled={busy}>Guardar borrador</button>
                      <label className="expiration-label">Caduca
                        <select value={expirationDays} onChange={(event) => setExpirationDays(event.target.value)}>
                          <option value="">Nunca</option>
                          <option value="7">En 7 días</option>
                          <option value="30">En 30 días</option>
                          <option value="90">En 90 días</option>
                          <option value="365">En un año</option>
                        </select>
                      </label>
                      <button className="button button-dark" type="button" onClick={publish} disabled={busy}>Publicar <span aria-hidden="true">↗</span></button>
                    </>
                  ) : (
                    <button className="button button-outline" type="button" onClick={revokeLink} disabled={busy}>Revocar enlace</button>
                  )}
                </div>
              </form>
              <aside className={`experience-preview accent-${content.accentColor}`} aria-label="Vista previa">
                <span className="preview-kicker">HECHO SOLO PARA TI</span>
                <span className="experience-preview-symbol" aria-hidden="true">{selected.templateSnapshot.symbol}</span>
                <p className="experience-preview-title">{content.title || "Tu título"}</p>
                <p className="experience-preview-recipient">Para {content.recipientName || "alguien especial"}</p>
                <p className="experience-preview-message">{content.message || "Tu mensaje aparecerá aquí."}</p>
                <span className="experience-preview-signature">con todo mi cariño</span>
              </aside>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function ExperiencePreview({ template, content, watermarked }) {
  if (template.slug === "galaxia-de-amor") {
    return (
      <article className={`experience-preview galaxy-preview accent-${content.accentColor ?? "rose"}${watermarked ? " is-watermarked" : ""}`}>
        <p className="preview-kicker">{template.label || "UNA SORPRESA CÓSMICA"}</p>
        <p className="galaxy-preview-recipient">Para {content.recipientName || "alguien especial"}</p>
        <div className="galaxy-preview-planet" aria-hidden="true"><span /></div>
        <p className="galaxy-preview-title">{content.title || template.title}</p>
        <p className="galaxy-preview-message">{content.message || "Tu mensaje aparecerá alrededor de este pequeño universo."}</p>
        {watermarked && <span className="preview-watermark" aria-label="Vista previa con marca de agua">DANEXLOVE · VISTA PREVIA</span>}
      </article>
    );
  }

  if (template.slug === "adivina") {
    return (
      <article className={`experience-preview guess-preview accent-${content.accentColor ?? "rose"}${watermarked ? " is-watermarked" : ""}`}>
        <span className="preview-kicker">{template.label || "UN RETO BONITO"}</span>
        <p className="experience-preview-title">{content.title || template.title}</p>
        <img src="/templates/adivina-1.png" alt="Un gatito con un ramo de flores" />
        <p className="experience-preview-recipient">Para {content.recipientName || "alguien especial"}</p>
        <p className="guess-preview-riddle">Verde por fuera y roja por dentro, tiene semillas de sandía y sabe a sandía. ¿Qué será?</p>
        <p className="guess-preview-reward">Al acertar: {content.message || "tu sorpresa"}</p>
        {watermarked && <span className="preview-watermark" aria-label="Vista previa con marca de agua">DANEXLOVE · VISTA PREVIA</span>}
      </article>
    );
  }

  return (
    <article className={`experience-preview accent-${content.accentColor ?? "rose"}${watermarked ? " is-watermarked" : ""}`}>
      <span className="preview-kicker">{template.label || "HECHO SOLO PARA TI"}</span>
      <span className="experience-preview-symbol" aria-hidden="true">{template.symbol || "♡"}</span>
      <p className="experience-preview-title">{content.title || template.title || "Tu título"}</p>
      <p className="experience-preview-recipient">Para {content.recipientName || "alguien especial"}</p>
      <p className="experience-preview-message">{content.message || template.description || "Tu mensaje aparecerá aquí."}</p>
      <span className="experience-preview-signature">con todo mi cariño</span>
      {watermarked && <span className="preview-watermark" aria-label="Vista previa con marca de agua">DANEXLOVE · VISTA PREVIA</span>}
    </article>
  );
}

function TemplatePreviewDialog({ template, onClose, onStartExperience }) {
  const content = {
    title: template.title,
    recipientName: "alguien especial",
    message: template.description,
    accentColor: "rose",
  };

  return (
    <div className="studio-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="template-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="template-preview-title">
        <header className="studio-header">
          <div>
            <p className="eyebrow">VISTA PREVIA</p>
            <h2 id="template-preview-title">{template.title}</h2>
          </div>
          <button className="auth-close" type="button" aria-label="Cerrar" onClick={onClose}>×</button>
        </header>
        <ExperiencePreview template={template} content={content} watermarked />
        <p className="preview-watermark-note">La marca se quita al obtener la plantilla gratuita.</p>
        <div className="template-preview-actions">
          <button
            className="button button-dark"
            type="button"
            onClick={() => onStartExperience(template.slug)}
            disabled={template.isPremium}
            title={template.isPremium ? "Las compras aún no están disponibles" : undefined}
          >
            {template.isPremium ? "Premium pronto" : "Ver opciones"}
            {!template.isPremium && <span aria-hidden="true">→</span>}
          </button>
        </div>
      </section>
    </div>
  );
}

function SignInGateDialog({ onCancel, onContinue }) {
  return (
    <div className="studio-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <section className="signin-gate-dialog" role="dialog" aria-modal="true" aria-labelledby="signin-gate-title">
        <button className="auth-close" type="button" aria-label="Cerrar" onClick={onCancel}>×</button>
        <p className="eyebrow">DANEXLOVE</p>
        <h2 id="signin-gate-title">Inicia sesión para continuar</h2>
        <p>Para personalizar esta experiencia, inicia sesión o crea una cuenta. Conservaremos la plantilla que elegiste.</p>
        <div className="signin-gate-actions">
          <button className="button button-dark" type="button" onClick={onContinue}>Iniciar sesión / Registrarse <span aria-hidden="true">→</span></button>
        </div>
      </section>
    </div>
  );
}

function TemplateDetailPage({ slug, navigate }) {
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode] = useState("");
  const [gateOpen, setGateOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pendingTemplateSlug = useRef(readPendingTemplateSlug());

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/v1/templates/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then((response) => readApiResponse(response, "No encontramos esta plantilla."))
      .then((result) => setTemplate(result.template))
      .catch((requestError) => {
        if (requestError.name !== "AbortError") setError(requestError.message);
      })
      .finally(() => setLoading(false));

    fetch("/api/v1/auth/me", { credentials: "include", signal: controller.signal })
      .then((response) => {
        if (response.status === 401) return null;
        return readApiResponse(response, "No se pudo comprobar tu sesión.");
      })
      .then((result) => {
        if (result?.user) setCurrentUser(result.user);
      })
      .catch((requestError) => {
        if (requestError.name !== "AbortError") setError(requestError.message);
      });
    return () => controller.abort();
  }, [slug]);

  const createExperience = async (templateSlug) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/v1/experiences", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateSlug }),
      });
      const result = await readApiResponse(response, "No se pudo iniciar la experiencia.");
      clearPendingTemplateSlug();
      pendingTemplateSlug.current = "";
      navigate(`/editor/${result.experience.id}`);
    } catch (requestError) {
      setError(requestError.message);
      pendingTemplateSlug.current = templateSlug;
      persistPendingTemplateSlug(templateSlug);
    } finally {
      setBusy(false);
    }
  };

  const startExperience = (templateSlug) => {
    setPreviewOpen(false);
    if (template?.isPremium) {
      setError("Las plantillas premium estarán disponibles cuando se habiliten las compras.");
      return;
    }
    if (!currentUser) {
      pendingTemplateSlug.current = templateSlug;
      persistPendingTemplateSlug(templateSlug);
      setGateOpen(true);
      return;
    }
    createExperience(templateSlug);
  };

  if (loading) return <main className="editor-state" role="status">Abriendo la plantilla...</main>;
  if (!template) {
    return (
      <main className="editor-state">
        <p className="eyebrow">DANEXLOVE</p>
        <h1>No encontramos esta plantilla</h1>
        <p>{error || "La plantilla puede haber sido retirada del catálogo."}</p>
        <button className="button button-dark" type="button" onClick={() => navigate("/")}>Volver a las inspiraciones</button>
      </main>
    );
  }

  return (
    <>
      <header className="site-header" id="inicio">
        <div className="header-inner">
          <a className="brand" href="/" aria-label="DanexLove, inicio">
            <span className="brand-mark" aria-hidden="true">♥</span><span>Danex<span>Love</span></span>
          </a>
          <nav className={`main-nav${mobileMenuOpen ? " is-open" : ""}`} id="primary-navigation" aria-label="Navegación principal">
            <a href="/" aria-current={window.location.pathname === "/" ? "page" : undefined} onClick={(event) => { event.preventDefault(); setMobileMenuOpen(false); navigate("/"); }}>Inicio</a>
            <a href="/templates" aria-current={window.location.pathname.startsWith("/templates") ? "page" : undefined} onClick={(event) => { event.preventDefault(); setMobileMenuOpen(false); navigate("/templates"); }}>Plantillas</a>
            <a href="/categorias" aria-current={window.location.pathname.startsWith("/categorias") ? "page" : undefined} onClick={(event) => { event.preventDefault(); setMobileMenuOpen(false); navigate("/categorias"); }}>Categorías</a>
            <button className="account-menu-button" type="button" onClick={() => { setMobileMenuOpen(false); setAuthMode(currentUser ? "account" : "login"); }}>{currentUser ? "Mi cuenta" : "Iniciar sesión"}</button>
          </nav>
          <button
            className="account-button"
            type="button"
            onClick={() => setAuthMode(currentUser ? "account" : "login")}
          >
            {currentUser ? currentUser.name : "Iniciar sesión"}
          </button>
          <MobileMenuToggle open={mobileMenuOpen} onClick={() => setMobileMenuOpen((open) => !open)} />
        </div>
      </header>
      <main className="template-detail-page section-shell">
        <nav className="template-breadcrumb" aria-label="Ruta de navegación">
          <a href="/">Inicio</a><span aria-hidden="true">›</span>
          <a href="/templates" onClick={(event) => { event.preventDefault(); navigate("/templates"); }}>Plantillas</a><span aria-hidden="true">›</span>
          <span aria-current="page">{template.title}</span>
        </nav>
        <section className="template-detail-grid" aria-labelledby="template-detail-title">
          <div className={`template-art template-detail-art art-${template.style}${template.slug === "adivina" ? " art-adivina" : ""}`} aria-label={`Vista de ${template.title}`}>
            {template.slug === "adivina" ? <img className="template-art-cat" src="/templates/adivina-1.png" alt="Un gatito con flores" /> : template.slug === "galaxia-de-amor" ? <span className="template-art-saturn" aria-hidden="true" /> : <>
              <span className="art-label">{template.label}</span>
              <span className="art-symbol" aria-hidden="true">{template.symbol}</span>
              <span className="art-caption">{template.title}</span>
            </>}
          </div>
          <div className="template-detail-copy">
            <p className="eyebrow">{template.category} · {template.isPremium ? "Plantilla premium" : "Plantilla gratis"}</p>
            <h1 id="template-detail-title">{template.title}</h1>
            <p className="template-detail-description">{template.description}</p>
            <p className="template-detail-author">Una inspiración de {template.author}</p>
            <section className="template-detail-actions" aria-labelledby="template-actions-title">
              <h2 id="template-actions-title">Empieza con esta idea</h2>
              <button className="button button-dark" type="button" onClick={() => startExperience(template.slug)} disabled={busy || template.isPremium}>
                {busy ? "Preparando tu experiencia..." : "Personalizar ahora"} <span aria-hidden="true">→</span>
              </button>
              <button className="button button-outline" type="button" onClick={() => setPreviewOpen(true)}>
                Previsualizar
              </button>
              <p>{template.isPremium ? "Esta plantilla aún no está disponible para personalizar." : "Inicia sesión o crea una cuenta; después podrás personalizar, obtener la plantilla gratis y publicar tu enlace."}</p>
            </section>
            {error && <p className="catalog-error" role="alert">{error}</p>}
          </div>
        </section>
      </main>
      {gateOpen && (
        <SignInGateDialog
          onCancel={() => {
            setGateOpen(false);
            pendingTemplateSlug.current = "";
            clearPendingTemplateSlug();
          }}
          onContinue={() => {
            setGateOpen(false);
            setAuthMode("login");
          }}
        />
      )}
      {authMode && (
        <AuthDialog
          key={authMode}
          mode={authMode}
          user={currentUser}
          resetToken=""
          onClose={() => {
            setAuthMode("");
            pendingTemplateSlug.current = "";
            clearPendingTemplateSlug();
          }}
          onAuthenticated={(user) => {
            setCurrentUser(user);
            if (pendingTemplateSlug.current) createExperience(pendingTemplateSlug.current);
          }}
          onLoggedOut={() => {
            setCurrentUser(null);
            setAuthMode("");
          }}
        />
      )}
      {previewOpen && (
        <TemplatePreviewDialog
          template={template}
          onClose={() => setPreviewOpen(false)}
          onStartExperience={startExperience}
        />
      )}
    </>
  );
}

function ExploreHeader({ navigate }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  return (
    <header className="site-header explore-site-header" id="inicio">
      <div className="header-inner">
        <a className="brand" href="/" aria-label="DanexLove, inicio" onClick={(event) => { event.preventDefault(); navigate("/"); }}>
          <span className="brand-mark" aria-hidden="true">♥</span><span>Danex<span>Love</span></span>
        </a>
        <nav className={`main-nav${mobileMenuOpen ? " is-open" : ""}`} id="primary-navigation" aria-label="Navegación principal">
          <a href="/" aria-current={window.location.pathname === "/" ? "page" : undefined} onClick={(event) => { event.preventDefault(); setMobileMenuOpen(false); navigate("/"); }}>Inicio</a>
          <a href="/templates" aria-current={window.location.pathname === "/templates" ? "page" : undefined} onClick={(event) => { event.preventDefault(); setMobileMenuOpen(false); navigate("/templates"); }}>Plantillas</a>
          <a href="/categorias" aria-current={window.location.pathname.startsWith("/categorias") ? "page" : undefined} onClick={(event) => { event.preventDefault(); setMobileMenuOpen(false); navigate("/categorias"); }}>Categorías</a>
        </nav>
        <MobileMenuToggle open={mobileMenuOpen} onClick={() => setMobileMenuOpen((open) => !open)} />
      </div>
    </header>
  );
}

function CatalogPage({ navigate, category = "" }) {
  const [templates, setTemplates] = useState([]);
  const [search, setSearch] = useState("");
  const [price, setPrice] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const selectedCategory = catalogCategories.find((item) => item.slug === category);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setStatus(page === 1 ? "loading" : "loading-more");
      setError("");
      try {
        const params = new URLSearchParams({ page: String(page), pageSize: "12", sort });
        if (selectedCategory) params.set("category", selectedCategory.name);
        if (search.trim()) params.set("search", search.trim());
        if (price !== "all") params.set("price", price);
        const response = await fetch(`/api/v1/templates?${params}`, { signal: controller.signal });
        const result = await readApiResponse(response, "No se pudo cargar el catálogo.");
        setTemplates((current) => page === 1 ? result.items : [...current, ...result.items]);
        setHasMore(page < result.pagination.totalPages);
        setStatus("ready");
      } catch (requestError) {
        if (requestError.name === "AbortError") return;
        setError(requestError.message);
        setStatus("error");
      }
    }, 180);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [category, page, price, search, sort]);

  const changeFilter = (setter, value) => { setPage(1); setter(value); };
  const title = selectedCategory ? `Ideas para ${selectedCategory.name.toLowerCase()}` : "Explora todas las plantillas";

  return (
    <>
      <ExploreHeader navigate={navigate} />
      <main className="explore-page section-shell">
        <nav className="template-breadcrumb" aria-label="Ruta de navegación">
          <a href="/" onClick={(event) => { event.preventDefault(); navigate("/"); }}>Inicio</a><span aria-hidden="true">›</span>
          {selectedCategory ? <><a href="/categorias" onClick={(event) => { event.preventDefault(); navigate("/categorias"); }}>Categorías</a><span aria-hidden="true">›</span><span aria-current="page">{selectedCategory.name}</span></> : <span aria-current="page">Plantillas</span>}
        </nav>
        <div className="section-heading explore-heading">
          <div><p className="eyebrow">ENCUENTRA TU INSPIRACIÓN</p><h1>{title}</h1></div>
          <p className="section-intro">Elige una idea, personalízala a tu manera y conviértela en un momento para compartir.</p>
        </div>
        <div className="catalog-controls explore-controls">
          {!selectedCategory && <div className="category-filters" aria-label="Explorar categorías">
            {catalogCategories.map((item) => <a className="filter-chip" key={item.slug} href={`/categorias/${item.slug}`} onClick={(event) => { event.preventDefault(); navigate(`/categorias/${item.slug}`); }}>{item.name}</a>)}
          </div>}
          <label className="search-box"><span className="search-icon" aria-hidden="true">⌕</span><span className="sr-only">Buscar plantillas</span><input type="search" placeholder="Buscar una idea..." value={search} onChange={(event) => changeFilter(setSearch, event.target.value)} /></label>
          <label className="catalog-select-label"><span className="sr-only">Filtrar por precio</span><select className="catalog-select" value={price} onChange={(event) => changeFilter(setPrice, event.target.value)}><option value="all">Todos los precios</option><option value="free">Gratis</option><option value="premium">Premium</option></select></label>
          <label className="catalog-select-label"><span className="sr-only">Ordenar plantillas</span><select className="catalog-select" value={sort} onChange={(event) => changeFilter(setSort, event.target.value)}><option value="newest">Más recientes</option><option value="price-asc">Gratis primero</option><option value="price-desc">Premium primero</option><option value="popular">Más populares</option></select></label>
        </div>
        <div className="template-grid explore-grid" aria-live="polite">
          {templates.map((template) => <article className="template-card" key={template.id}>
            <div className={`template-art art-${template.style}${template.slug === "adivina" ? " art-adivina" : ""}`} aria-hidden="true">
              {template.slug === "adivina" ? <img className="template-art-cat" src="/templates/adivina-1.png" alt="" /> : template.slug === "galaxia-de-amor" ? <span className="template-art-saturn" aria-hidden="true" /> : <><span className="art-label">{template.label}</span><span className="art-symbol" aria-hidden="true">{template.symbol}</span><span className="art-caption">{template.title}</span></>}
            </div>
            <div className="template-info"><div className="template-meta"><span>{template.category}</span><span className="template-price">{template.priceLabel}</span></div><h3>{template.title}</h3><p>{template.description}</p><div className="template-actions"><button className="button button-dark" type="button" onClick={() => navigate(`/templates/${template.slug}`)}>Ver detalles <span aria-hidden="true">→</span></button><button className="button button-outline" type="button" onClick={() => setPreviewTemplate(template)}>Previsualizar</button></div></div>
          </article>)}
          {status !== "ready" && <p className={`catalog-status${status === "error" ? " catalog-error" : ""}`} role={status === "error" ? "alert" : "status"}>{status === "error" ? error : status === "loading-more" ? "Cargando más plantillas..." : "Cargando plantillas..."}</p>}
          {status === "ready" && templates.length === 0 && <p className="empty-results">No encontramos plantillas con esos filtros. Prueba con otra búsqueda.</p>}
        </div>
        {hasMore && status === "ready" && <button className="load-more-button" type="button" onClick={() => setPage((current) => current + 1)}>Cargar más plantillas</button>}
        {selectedCategory && <a className="template-back-link" href="/categorias" onClick={(event) => { event.preventDefault(); navigate("/categorias"); }}>← Ver todas las categorías</a>}
      </main>
      {previewTemplate && <TemplatePreviewDialog template={previewTemplate} onClose={() => setPreviewTemplate(null)} onStartExperience={(slug) => { setPreviewTemplate(null); navigate(`/templates/${slug}`); }} />}
    </>
  );
}

function CategoriesPage({ navigate }) {
  return <>
    <ExploreHeader navigate={navigate} />
    <main className="explore-page section-shell categories-page">
      <nav className="template-breadcrumb" aria-label="Ruta de navegación"><a href="/" onClick={(event) => { event.preventDefault(); navigate("/"); }}>Inicio</a><span aria-hidden="true">›</span><span aria-current="page">Categorías</span></nav>
      <div className="section-heading explore-heading"><div><p className="eyebrow">UNA IDEA PARA CADA MOMENTO</p><h1>Explora por categoría</h1></div><p className="section-intro">Empieza por la ocasión o el tipo de detalle que quieres crear.</p></div>
      <div className="category-directory">
        {catalogCategories.map((item) => <a className="category-directory-card" href={`/categorias/${item.slug}`} key={item.slug} onClick={(event) => { event.preventDefault(); navigate(`/categorias/${item.slug}`); }}><span className="category-directory-symbol" aria-hidden="true">{item.symbol}</span><span className="eyebrow">DANEXLOVE</span><h2>{item.name}</h2><p>{item.description}</p><span className="text-link">Explorar ideas <span aria-hidden="true">→</span></span></a>)}
      </div>
    </main>
  </>;
}

function ExperienceEditorPage({ experienceId, navigate }) {
  const [experience, setExperience] = useState(null);
  const [content, setContent] = useState({});
  const [expirationDays, setExpirationDays] = useState("30");
  const [shareUrl, setShareUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);
  const [previewDevice, setPreviewDevice] = useState("desktop");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/v1/experiences/${experienceId}`, { credentials: "include", signal: controller.signal })
      .then((response) => readApiResponse(response, "No pudimos abrir esta experiencia."))
      .then((result) => {
        setExperience(result.experience);
        setContent(result.experience.content);
        setDirty(false);
        setLoading(false);
      })
      .catch((requestError) => {
        if (requestError.name !== "AbortError") {
          setError(requestError.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [experienceId]);

  const updateField = (event) => {
    setContent((current) => ({ ...current, [event.target.name]: event.target.value }));
    setDirty(true);
    setError("");
    setNotice("");
  };

  const updateAccentColor = (accentColor) => {
    setContent((current) => ({ ...current, accentColor }));
    setDirty(true);
    setError("");
    setNotice("");
  };

  const saveDraftRequest = async () => {
    const response = await fetch(`/api/v1/experiences/${experienceId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const result = await readApiResponse(response, "No se pudo guardar el borrador.");
    setExperience(result.experience);
    setContent(result.experience.content);
    setDirty(false);
    return result.experience;
  };

  const saveDraft = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await saveDraftRequest();
      setNotice("Borrador guardado. La marca de agua permanece hasta obtener la plantilla.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const saveAndAcquire = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await saveDraftRequest();
      const response = await fetch(`/api/v1/experiences/${experienceId}/acquire`, {
        method: "POST",
        credentials: "include",
      });
      const result = await readApiResponse(response, "No se pudo obtener la plantilla.");
      setExperience(result.experience);
      setContent(result.experience.content);
      setNotice("Plantilla obtenida. La marca de agua se quitó de tu vista previa.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (!locked) await saveDraftRequest();
      const response = await fetch(`/api/v1/experiences/${experienceId}/publish`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expirationDays: expirationDays ? Number(expirationDays) : null }),
      });
      const result = await readApiResponse(response, "No se pudo publicar la experiencia.");
      setExperience(result.experience);
      setShareUrl(result.shareUrl);
      setNotice("Tu enlace está listo para compartir.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      await copyTextToClipboard(shareUrl);
      setNotice("Enlace copiado.");
    } catch (copyError) {
      setError(copyError.message);
    }
  };

  if (loading) return <main className="editor-state" role="status">Abriendo tu editor...</main>;
  if (error && !experience) {
    return (
      <main className="editor-state">
        <p className="eyebrow">DANEXLOVE</p>
        <h1>No pudimos abrir el editor</h1>
        <p>{error}</p>
        <button className="button button-dark" type="button" onClick={() => navigate("/")}>Volver al catálogo</button>
      </main>
    );
  }
  if (!experience) return <main className="editor-state" role="status">Abriendo tu editor...</main>;

  const template = experience.templateSnapshot;
  const acquired = Boolean(experience.acquiredAt);
  const locked = experience.status === "published";
  const workflowStep = shareUrl || locked ? 3 : acquired ? 2 : 1;
  const workflowMessage = workflowStep === 3
    ? shareUrl
      ? "Tu experiencia está lista. Comparte el enlace con esa persona especial."
      : "Ya está publicada. Generar otro enlace dejará de funcionar el enlace anterior."
    : workflowStep === 2
      ? "La plantilla ya es tuya. Publícala para crear un enlace que puedas compartir."
      : "Personaliza tu mensaje y obtén gratis la plantilla para poder publicarla.";

  return (
    <main className="editor-page">
      <header className="editor-topbar">
        <a className="brand" href="/" onClick={(event) => { event.preventDefault(); navigate("/"); }}>
          <span className="brand-mark" aria-hidden="true">♥</span><span>Danex<span>Love</span></span>
        </a>
        <button className="editor-back" type="button" onClick={() => navigate("/")}>← <span>Volver al catálogo</span></button>
        <span className={`editor-status${acquired ? " is-acquired" : ""}`}>{acquired ? "Plantilla obtenida" : "Vista previa"}</span>
      </header>

      <div className="editor-content">
        <section className="editor-fields" aria-labelledby="editor-title">
          <p className="eyebrow">PERSONALIZACIÓN · {template.category?.toUpperCase()}</p>
          <h1 id="editor-title">{template.title}</h1>
          <p className="editor-intro">Hazla tuya con un mensaje, un nombre y un tono especial. Verás cada cambio en la vista previa.</p>
          <nav className="creation-progress" aria-label="Pasos para crear tu experiencia">
            <p>PASO {workflowStep} DE 3</p>
            <ol>
              {["Personaliza", "Obtén gratis", "Publica y comparte"].map((label, index) => {
                const step = index + 1;
                const state = step < workflowStep ? "is-complete" : step === workflowStep ? "is-current" : "";
                return (
                  <li className={state} key={label} aria-current={step === workflowStep ? "step" : undefined}>
                    <span>{step < workflowStep ? "✓" : step}</span>
                    {label}
                  </li>
                );
              })}
            </ol>
            <span>{workflowMessage}</span>
          </nav>
          <form className="studio-form editor-form" onSubmit={(event) => event.preventDefault()}>
            <section className="editor-form-section" aria-labelledby="editor-dedication-heading">
              <div className="editor-form-section-heading">
                <span>01</span>
                <div><h2 id="editor-dedication-heading">La dedicatoria</h2><p>Las palabras que verá esa persona.</p></div>
              </div>
              <label className="editor-field">Título
                <input name="title" value={content.title ?? ""} maxLength="120" onChange={updateField} disabled={locked || busy} placeholder="Ponle un nombre a tu sorpresa" />
                <small>Una frase corta que le dé personalidad.</small>
              </label>
              <label className="editor-field">¿Para quién es?
                <input name="recipientName" value={content.recipientName ?? ""} maxLength="100" placeholder="Su nombre" onChange={updateField} disabled={locked || busy} />
                <small>El nombre aparecerá en la dedicatoria.</small>
              </label>
              <label className="editor-field editor-message-field">Tu mensaje
                <textarea name="message" value={content.message ?? ""} maxLength="3000" rows="6" placeholder="Escribe algo que quieras que recuerde..." onChange={updateField} disabled={locked || busy} />
                <span className="editor-message-meter" role="meter" aria-label="Longitud del mensaje" aria-valuemin="0" aria-valuemax="3000" aria-valuenow={(content.message ?? "").length}>
                  <span style={{ width: `${Math.min(((content.message ?? "").length / 3000) * 100, 100)}%` }} />
                </span>
                <span className="studio-count">{(content.message ?? "").length.toLocaleString("es-MX")} / 3,000 caracteres</span>
              </label>
            </section>
            <fieldset className="editor-form-section editor-tone-section" disabled={locked || busy}>
              <legend><span>02</span> El tono</legend>
              <p id="editor-tone-help">Elige el color de los detalles de tu diseño.</p>
              <div className="editor-tone-options" role="group" aria-describedby="editor-tone-help">
                {[["rose", "Rosa"], ["violet", "Violeta"], ["blue", "Azul"], ["sunshine", "Dorado"]].map(([color, label]) => (
                  <button className={`editor-tone-option${(content.accentColor ?? "rose") === color ? " is-selected" : ""}`} type="button" key={color} aria-label={`Tono ${label}`} aria-pressed={(content.accentColor ?? "rose") === color} onClick={() => updateAccentColor(color)}>
                    <span className={`editor-tone-swatch swatch-${color}`} aria-hidden="true">{(content.accentColor ?? "rose") === color && <span>✓</span>}</span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <div className={`editor-save-state${dirty ? " is-dirty" : ""}`} role="status">
              <span aria-hidden="true">{busy ? "◌" : dirty ? "●" : "✓"}</span>
              {busy ? "Guardando tus cambios…" : dirty ? "Tienes cambios sin guardar" : locked ? "Tu experiencia está guardada" : "Todo listo para guardar"}
            </div>
            {error && <p className="catalog-error" role="alert">{error}</p>}
            {notice && <p className="studio-notice" role="status">{notice}</p>}
            {shareUrl && (
              <div className="share-link-box">
                <label htmlFor="editor-share-link">Enlace para compartir</label>
                <div>
                  <input id="editor-share-link" readOnly value={shareUrl} onFocus={(event) => event.target.select()} />
                  <button type="button" className="button button-dark" onClick={copyLink}>Copiar</button>
                  <a className="button button-outline" href={shareUrl} target="_blank" rel="noopener noreferrer">Abrir en otra pestaña <span aria-hidden="true">↗</span></a>
                </div>
              </div>
            )}
            <div className="editor-actions">
              {!acquired ? (
                <>
                  <button className="button button-outline" type="button" onClick={saveDraft} disabled={busy || locked}>Guardar borrador</button>
                  <button className="button button-dark" type="button" onClick={saveAndAcquire} disabled={busy || locked}>{busy ? "Guardando..." : "Guardar y obtener gratis"}</button>
                </>
              ) : !locked ? (
                <>
                  <button className="button button-outline" type="button" onClick={saveDraft} disabled={busy}>Guardar borrador</button>
                  <label className="expiration-label">Caduca
                    <select value={expirationDays} onChange={(event) => setExpirationDays(event.target.value)}>
                      <option value="">Nunca</option><option value="7">En 7 días</option><option value="30">En 30 días</option><option value="90">En 90 días</option><option value="365">En un año</option>
                    </select>
                  </label>
                  <button className="button button-dark" type="button" onClick={publish} disabled={busy}>Publicar <span aria-hidden="true">↗</span></button>
                </>
              ) : shareUrl ? (
                <span className="editor-status is-acquired">Publicada</span>
              ) : (
                <button className="button button-dark" type="button" onClick={publish} disabled={busy}>
                  {busy ? "Creando enlace..." : "Generar nuevo enlace"}
                </button>
              )}
            </div>
          </form>
        </section>
        <section className={`editor-preview-column is-${previewDevice}`} aria-label="Vista previa en vivo">
          <div className="editor-preview-heading">
            <div><span>Vista previa</span><small>Así se verá al compartirla</small></div>
            <div className="editor-preview-controls" role="group" aria-label="Tamaño de vista previa">
              <button type="button" aria-pressed={previewDevice === "desktop"} onClick={() => setPreviewDevice("desktop")}>
                <span aria-hidden="true">▭</span> Escritorio
              </button>
              <button type="button" aria-pressed={previewDevice === "mobile"} onClick={() => setPreviewDevice("mobile")}>
                <span aria-hidden="true">▯</span> Móvil
              </button>
            </div>
          </div>
          <p className={`editor-preview-watermark${acquired ? " is-clean" : ""}`}>
            <span aria-hidden="true">{acquired ? "✓" : "◉"}</span>
            {acquired ? "Sin marca de agua" : "La marca de agua se quita al obtenerla gratis"}
          </p>
          <ExperiencePreview template={template} content={content} watermarked={!acquired} />
        </section>
      </div>
    </main>
  );
}

function HomePage({ navigate }) {
  const [featuredTemplates, setFeaturedTemplates] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [experienceSeed, setExperienceSeed] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/v1/templates?page=1&pageSize=3&sort=newest", { signal: controller.signal })
      .then((response) => readApiResponse(response, "No se pudieron cargar las plantillas."))
      .then((result) => setFeaturedTemplates(result.items))
      .catch((error) => {
        if (error.name !== "AbortError") setFeaturedTemplates([]);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    fetch("/api/v1/auth/me", { credentials: "include" })
      .then(async (response) => {
        if (response.status === 401) return null;
        if (!response.ok) throw new Error("No se pudo consultar la sesión.");
        return readApiResponse(response, "No se pudo consultar la sesión.");
      })
      .then((result) => {
        if (result?.user) setCurrentUser(result.user);
      })
      .catch(() => setAuthMessage("No se pudo comprobar tu sesión. Intenta recargar la página."));

    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (params.get("action") === "verify-email" && token) {
      fetch("/api/v1/auth/verification/confirm", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
        .then(async (response) => {
          const result = await readApiResponse(response, "No se pudo verificar el correo.");
          setAuthMessage("Correo verificado. Ya puedes iniciar sesión.");
          setAuthMode("login");
        })
        .catch((error) => {
          setAuthMessage(error.message);
          setAuthMode("login");
        })
        .finally(() => window.history.replaceState({}, "", window.location.pathname));
    } else if (params.get("action") === "reset-password" && token) {
      setResetToken(token);
      setAuthMode("reset");
    }
  }, []);


  return (
    <>
      <header className="site-header" id="inicio">
        <div className="header-inner">
          <Brand />
          <nav className={`main-nav${mobileMenuOpen ? " is-open" : ""}`} id="primary-navigation" aria-label="Navegación principal">
            <a href="#inicio" aria-current="page" onClick={() => setMobileMenuOpen(false)}>Inicio</a>
            <a href="/templates" onClick={(event) => { event.preventDefault(); setMobileMenuOpen(false); navigate("/templates"); }}>Plantillas</a>
            <a href="/categorias" onClick={(event) => { event.preventDefault(); setMobileMenuOpen(false); navigate("/categorias"); }}>Categorías</a>
            <button className="account-menu-button" type="button" onClick={() => { setMobileMenuOpen(false); setAuthMode(currentUser ? "account" : "login"); }}>{currentUser ? "Mi cuenta" : "Iniciar sesión"}</button>
            {currentUser && <button type="button" onClick={() => {
              setMobileMenuOpen(false);
              setExperienceSeed(null);
              setWorkspaceOpen(true);
            }}>Mis experiencias</button>}
          </nav>
            <button
              className="account-button"
              type="button"
              onClick={() => setAuthMode(currentUser ? "account" : "login")}
            >
              {currentUser ? currentUser.name : "Iniciar sesión"}
            </button>
          <MobileMenuToggle open={mobileMenuOpen} onClick={() => setMobileMenuOpen((open) => !open)} />
        </div>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow"><span aria-hidden="true">✳</span> Un detalle que se siente</p>
            <h1 id="hero-title">
              Hay momentos
              <br />
              que merecen <span>más.</span>
            </h1>
            <p className="hero-description">
              Crea una experiencia digital para alguien especial. Agrega tus
              palabras, tus fotos, tu historia. Sin código, con todo el corazón.
            </p>
            <div className="hero-actions">
              <a className="button button-dark" href="/templates" onClick={(event) => { event.preventDefault(); navigate("/templates"); }}>
                Encuentra tu inspiración <span aria-hidden="true">→</span>
              </a>
              <span className="hero-reassurance"><span aria-hidden="true">♡</span> Fácil de crear, especial de recibir</span>
            </div>
            <div className="hero-social-proof">
              <span className="avatar-stack" aria-hidden="true">
                <span>J</span><span>M</span><span>A</span><span>+</span>
              </span>
              <span>Pequeños detalles, grandes sonrisas.</span>
            </div>
          </div>

          <div className="hero-visual" aria-label="Vista ilustrativa de una experiencia digital">
            <div className="hero-sunburst" aria-hidden="true" />
            <div className="hero-confetti confetti-one" aria-hidden="true">✳</div>
            <div className="hero-confetti confetti-two" aria-hidden="true">✦</div>
            <div className="hero-confetti confetti-three" aria-hidden="true">♡</div>
            <div className="preview-window">
              <div className="preview-toolbar">
                <span /><span /><span />
                <span className="preview-address">danexlove.com/para-ti</span>
                <span className="preview-share" aria-hidden="true">↗</span>
              </div>
              <div className="preview-content">
                <span className="preview-kicker">HECHO SOLO PARA TI</span>
                <div className="preview-flower" aria-hidden="true">✿</div>
                <p>Hay cosas que<br />siempre quiero<br /><em>recordarte.</em></p>
                <span className="preview-heart" aria-hidden="true">♥</span>
                <span className="preview-signature">con todo mi cariño</span>
              </div>
            </div>
            <div className="floating-note note-top">
              <span className="note-icon" aria-hidden="true">✦</span>
              <span><strong>Hecha por ti</strong><small>y para alguien especial</small></span>
            </div>
            <div className="floating-note note-bottom">
              <span className="note-heart" aria-hidden="true">♥</span>
              <span>Un recuerdo para volver</span>
            </div>
          </div>
        </section>

        <section className="home-discovery-section section-shell" id="plantillas" aria-labelledby="templates-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">UN BUEN LUGAR PARA EMPEZAR</p>
              <h2 id="templates-title">¿Qué te gustaría crear?</h2>
            </div>
            <p className="section-intro">Explora por ocasión o descubre las ideas más recientes.</p>
          </div>
          <div className="home-category-links">
            {catalogCategories.map((item) => (
              <a href={`/categorias/${item.slug}`} key={item.slug} onClick={(event) => { event.preventDefault(); navigate(`/categorias/${item.slug}`); }}>
                <span aria-hidden="true">{item.symbol}</span><strong>{item.name}</strong><span className="home-category-arrow" aria-hidden="true">↗</span>
              </a>
            ))}
          </div>
          {featuredTemplates.length > 0 && (
            <>
              <div className="home-featured-heading"><p className="eyebrow">RECIÉN LLEGADAS</p><h3>Ideas para empezar</h3></div>
              <div className="template-grid home-featured-grid">
                {featuredTemplates.map((template) => (
                  <article className="template-card" key={template.id}>
                    <div className={`template-art art-${template.style}${template.slug === "adivina" ? " art-adivina" : ""}`} aria-hidden="true">
                      {template.slug === "adivina" ? <img className="template-art-cat" src="/templates/adivina-1.png" alt="" /> : template.slug === "galaxia-de-amor" ? <span className="template-art-saturn" aria-hidden="true" /> : <><span className="art-label">{template.label}</span><span className="art-symbol">{template.symbol}</span><span className="art-caption">{template.title}</span></>}
                    </div>
                    <div className="template-info">
                      <div className="template-meta"><span>{template.category}</span><span className="template-price">{template.priceLabel}</span></div>
                      <h3>{template.title}</h3>
                      <p>{template.description}</p>
                      <div className="template-actions home-featured-actions">
                        <button className="button button-dark" type="button" onClick={() => navigate(`/templates/${template.slug}`)}>Ver plantilla <span aria-hidden="true">→</span></button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
          <a className="button button-dark home-explore-button" href="/templates" onClick={(event) => { event.preventDefault(); navigate("/templates"); }}>
            Explorar todas las plantillas <span aria-hidden="true">→</span>
          </a>
        </section>

        <section className="how-section" id="como-funciona" aria-labelledby="how-title">
          <div className="section-shell how-inner">
            <div className="how-heading">
              <p className="eyebrow">ASÍ DE SENCILLO</p>
              <h2 id="how-title">De una idea a un<br /><span>momento inolvidable.</span></h2>
              <p>No necesitas saber de diseño ni de tecnología. Solo pensar en esa persona.</p>
              <a className="text-link" href="/templates" onClick={(event) => { event.preventDefault(); navigate("/templates"); }}>Encuentra tu idea <span aria-hidden="true">→</span></a>
            </div>
            <div className="steps-list">
              {steps.map((step) => (
                <article className="step-item" key={step.number}>
                  <span className="step-symbol" aria-hidden="true">{step.symbol}</span>
                  <div>
                    <span className="step-number">PASO {step.number}</span>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </div>
                  <span className="step-arrow" aria-hidden="true">↗</span>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="closing-section section-shell" id="nosotros" aria-labelledby="closing-title">
          <div className="closing-decoration" aria-hidden="true">♡</div>
          <p className="eyebrow">LAS COSAS BONITAS MERECEN COMPARTIRSE</p>
          <h2 id="closing-title">Tu historia merece<br />un espacio <em>propio.</em></h2>
          <p>Empieza con una idea. Lo demás lo haces tú.</p>
          <a className="button button-light" href="/templates" onClick={(event) => { event.preventDefault(); navigate("/templates"); }}>
            Explora las inspiraciones <span aria-hidden="true">→</span>
          </a>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-main">
          <div className="footer-brand-block">
            <Brand footer />
            <p>Código que late, momentos que inspiran.</p>
          </div>
          <div className="footer-links">
            <div>
              <span className="footer-heading">EXPLORA</span>
              <a href="/templates" onClick={(event) => { event.preventDefault(); navigate("/templates"); }}>Inspiraciones</a>
              <a href="#como-funciona">Cómo funciona</a>
            </div>
            <div>
              <span className="footer-heading">DANEXLOVE</span>
              <a href="#nosotros">Nuestra idea</a>
              <a href="#inicio">Volver al inicio ↑</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} DanexLove</span>
          <span>Hecho con cariño, para compartir cariño.</span>
        </div>
      </footer>
      {authMessage && !authMode && (
        <p className="auth-global-message" role="status">
          {authMessage}
          <button type="button" aria-label="Cerrar aviso" onClick={() => setAuthMessage("")}>×</button>
        </p>
      )}
      {authMode && (
        <AuthDialog
          key={authMode}
          mode={authMode}
          user={currentUser}
          resetToken={resetToken}
          onClose={() => {
            setAuthMode("");
            setResetToken("");
            setAuthMessage("");
          }}
          onAuthenticated={(user) => {
            setCurrentUser(user);
          }}
          onLoggedOut={() => {
            setCurrentUser(null);
            setAuthMode("");
          }}
        />
      )}
      {workspaceOpen && (
        <ExperienceWorkspace
          key="experience-list"
          onClose={() => {
            setWorkspaceOpen(false);
          }}
          onOpenEditor={(experienceId) => {
            setWorkspaceOpen(false);
            navigate(`/editor/${experienceId}`);
          }}
        />
      )}

    </>
  );
}

function PublicExperiencePage({ token }) {
  const [experience, setExperience] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/v1/public/experiences/${token}`, { signal: controller.signal })
      .then((response) => readApiResponse(response, "Este enlace expiró o ya no está disponible."))
      .then((result) => setExperience(result.experience))
      .catch((requestError) => {
        if (requestError.name !== "AbortError") setError(requestError.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [token]);

  if (loading) return <main className="public-state" role="status">Abriendo tu experiencia...</main>;
  if (error || !experience) {
    return <main className="public-state"><p className="eyebrow">DANEXLOVE</p><h1>Este enlace ya no está disponible.</h1><p>{error}</p><a className="button button-dark" href="/">Ir al inicio</a></main>;
  }

  if (experience.template.slug === "adivina") {
    return <GuessExperience experience={experience} />;
  }

  if (experience.template.slug === "galaxia-de-amor") {
    return <Suspense fallback={<main className="galaxy-loading" role="status">Preparando esta galaxia…</main>}><GalaxyExperience experience={experience} /></Suspense>;
  }

  return (
    <main className={`public-experience accent-${experience.content.accentColor}`}>
      <a className="public-brand" href="/">♥ <span>DanexLove</span></a>
      <article className="public-letter">
        <p className="eyebrow">{experience.template.label || "HECHO SOLO PARA TI"}</p>
        <span className="public-symbol" aria-hidden="true">{experience.template.symbol}</span>
        <p className="public-recipient">Para {experience.content.recipientName}</p>
        <h1>{experience.content.title}</h1>
        <p className="public-message">{experience.content.message}</p>
        <span className="public-signature">con todo mi cariño</span>
      </article>
      <p className="public-footer">Una experiencia creada con DanexLove</p>
    </main>
  );
}

function GuessExperience({ experience }) {
  const [answer, setAnswer] = useState("");
  const [solved, setSolved] = useState(false);
  const [feedback, setFeedback] = useState("");
  const { content, template } = experience;

  const checkAnswer = (event) => {
    event.preventDefault();
    const normalizedAnswer = answer.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");
    if (normalizedAnswer === "sandia") {
      setSolved(true);
      setFeedback("");
      return;
    }
    setFeedback("Mmm, esa no era. ¡Intenta otra vez!");
  };

  return (
    <main className={`guess-experience accent-${content.accentColor}`}>
      <a className="public-brand" href="/">♡ <span>DanexLove</span></a>
      <article className="guess-card" aria-labelledby="guess-title">
        <p className="eyebrow">{template.label || "UN RETO BONITO"}</p>
        <p className="public-recipient">Para {content.recipientName}</p>
        <h1 id="guess-title">{content.title}</h1>
        {!solved ? (
          <>
            <img className="guess-art" src="/templates/adivina-1.png" alt="Un gatito con flores" />
            <p className="guess-riddle">Verde por fuera y roja por dentro, tiene semillas de sandía y sabe a sandía. ¿Qué será?</p>
            <form className="guess-form" onSubmit={checkAnswer}>
              <label htmlFor="guess-answer">Escribe tu respuesta</label>
              <div>
                <input id="guess-answer" value={answer} onChange={(event) => { setAnswer(event.target.value); setFeedback(""); }} autoComplete="off" required />
                <button className="button button-dark" type="submit">Enviar respuesta</button>
              </div>
              <p className="guess-feedback" role={feedback ? "alert" : "status"}>{feedback}</p>
            </form>
          </>
        ) : (
          <div className="guess-reveal" role="status">
            <p className="guess-success">¡Correcto!</p>
            <img className="guess-art" src="/templates/adivina-2.jpg" alt="Un gatito para celebrar que acertaste" />
            <p className="guess-prize">{content.message}</p>
          </div>
        )}
      </article>
      <p className="public-footer">Una experiencia creada con DanexLove</p>
    </main>
  );
}

function App() {
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = (path) => {
    window.history.pushState({}, "", path);
    setPathname(path);
    window.scrollTo(0, 0);
  };

  const publicMatch = pathname.match(/^\/e\/([A-Za-z0-9_-]{40,128})\/?$/);
  if (publicMatch) return <PublicExperiencePage token={publicMatch[1]} />;

  const editorMatch = pathname.match(/^\/editor\/([0-9a-f-]{36})\/?$/i);
  if (editorMatch) return <ExperienceEditorPage experienceId={editorMatch[1]} navigate={navigate} />;

  const templateMatch = pathname.match(/^\/templates\/([a-z0-9-]{1,120})\/?$/i);
  if (templateMatch) return <TemplateDetailPage slug={templateMatch[1]} navigate={navigate} />;

  if (/^\/categorias\/?$/i.test(pathname)) return <CategoriesPage navigate={navigate} />;
  const categoryMatch = pathname.match(/^\/categorias\/([a-z0-9-]{1,80})\/?$/i);
  if (categoryMatch && catalogCategories.some((item) => item.slug === categoryMatch[1].toLowerCase())) {
    return <CatalogPage category={categoryMatch[1].toLowerCase()} navigate={navigate} />;
  }
  if (/^\/templates\/?$/i.test(pathname)) return <CatalogPage navigate={navigate} />;

  return <HomePage navigate={navigate} />;
}

export default App;
