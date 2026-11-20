(() => {
  const SESSION_KEY = "eurekaclean_session";
  const SESSION_SYNC_KEY = "eurekaclean_session_sync";
  const DESIGN_PREVIEW_KEY = "eurekaclean_design_preview";
  const DESIGN_PREVIEW_MODE_KEY = "eurekaclean_design_preview_mode";
  let sessionSyncPromise = null;

  function normalizeApiBase(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    return raw.endsWith("/") ? raw.slice(0, -1) : raw;
  }

  function safeGetLocalStorage(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function readMetaContent(name) {
    const el = document.querySelector(`meta[name="${name}"]`);
    return el ? String(el.getAttribute("content") || "").trim() : "";
  }

  function parseBooleanFlag(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw) return null;
    if (["1", "true", "yes", "on", "si"].includes(raw)) return true;
    if (["0", "false", "no", "off"].includes(raw)) return false;
    return null;
  }

  function normalizePreviewMode(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "admin") return "admin";
    if (raw === "customer" || raw === "cliente") return "customer";
    if (raw === "guest" || raw === "invitado" || raw === "anon") return "guest";
    return "";
  }

  function safeSetStorage(storage, key, value) {
    try {
      storage.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  }

  function safeRemoveStorage(storage, key) {
    try {
      storage.removeItem(key);
      return true;
    } catch (error) {
      return false;
    }
  }

  function normalizeSession(session) {
    if (!session || typeof session !== "object" || Array.isArray(session)) return null;
    const email = session.email ? String(session.email).trim().toLowerCase() : "";
    const token = session.token ? String(session.token).trim() : "";
    if (email && !token) return null;
    if (!email || !token) return null;
    return {
      name: session.name ? String(session.name).trim() : "",
      email,
      role: session.role ? String(session.role).trim().toLowerCase() : "",
      token,
      loggedAt: session.loggedAt ? String(session.loggedAt).trim() : ""
    };
  }

  function sessionsEqual(left, right) {
    if (!left && !right) return true;
    if (!left || !right) return false;
    return (
      String(left.name || "") === String(right.name || "")
      && String(left.email || "") === String(right.email || "")
      && String(left.role || "") === String(right.role || "")
      && String(left.token || "") === String(right.token || "")
      && String(left.loggedAt || "") === String(right.loggedAt || "")
    );
  }

  function readStoredSession(storage) {
    if (!storage) return null;
    try {
      const raw = storage.getItem(SESSION_KEY);
      if (!raw) return null;
      return normalizeSession(JSON.parse(raw));
    } catch (error) {
      return null;
    }
  }

  function emitSessionSync(reason) {
    safeSetStorage(localStorage, SESSION_SYNC_KEY, JSON.stringify({
      reason: String(reason || "update"),
      at: Date.now()
    }));
    window.dispatchEvent(new CustomEvent("auth:session-changed", {
      detail: { reason: String(reason || "update") }
    }));
  }

  function getSession() {
    const session = readStoredSession(sessionStorage);
    if (session) return session;

    const persistedSession = readStoredSession(localStorage);
    if (!persistedSession) return null;

    safeSetStorage(sessionStorage, SESSION_KEY, JSON.stringify(persistedSession));
    return persistedSession;
  }

  function setSession(session, options = {}) {
    const normalized = normalizeSession(session);
    if (!normalized) {
      clearSession(options.reason || "invalid");
      return null;
    }

    const current = getSession();
    const serialized = JSON.stringify(normalized);
    safeSetStorage(sessionStorage, SESSION_KEY, serialized);
    safeSetStorage(localStorage, SESSION_KEY, serialized);
    if (
      options.emitEvent !== false
      && (!sessionsEqual(current, normalized) || options.forceSyncEvent === true)
    ) {
      emitSessionSync(options.reason || "login");
    }
    return normalized;
  }

  function clearSession(reason = "logout") {
    safeRemoveStorage(sessionStorage, SESSION_KEY);
    safeRemoveStorage(localStorage, SESSION_KEY);
    emitSessionSync(reason);
  }

  const protocol = String(window.location && window.location.protocol ? window.location.protocol : "").toLowerCase();
  const isFile = protocol === "file:";
  const hostname = String(window.location && window.location.hostname ? window.location.hostname : "").toLowerCase();
  const port = String(window.location && window.location.port ? window.location.port : "").trim();
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";
  const previewFromMeta = parseBooleanFlag(readMetaContent("eureka-design-preview"));
  const previewFromStorage = parseBooleanFlag(safeGetLocalStorage(DESIGN_PREVIEW_KEY));
  const previewStorageAllowed = isFile || isLocalHost;
  const designPreviewEnabled = previewFromMeta !== null
    ? previewFromMeta
    : (previewStorageAllowed && previewFromStorage !== null ? previewFromStorage : isFile);
  const previewModeFromMeta = normalizePreviewMode(readMetaContent("eureka-design-preview-mode"));
  const previewModeFromStorage = previewStorageAllowed
    ? normalizePreviewMode(safeGetLocalStorage(DESIGN_PREVIEW_MODE_KEY))
    : "";
  let currentPreviewMode = designPreviewEnabled
    ? (previewModeFromStorage || previewModeFromMeta || "guest")
    : "";

  function buildApiCandidates() {
    const explicitApiBase = normalizeApiBase(window.EUREKA_API_BASE);
    if (explicitApiBase) return [explicitApiBase];

    const candidates = [];
    const origin = normalizeApiBase(window.location && window.location.origin ? window.location.origin : "");
    if (!isFile && origin && origin !== "null") {
      candidates.push(origin);
    }
    if (isFile || isLocalHost) {
      candidates.push("http://127.0.0.1:8000");
    }
    return Array.from(new Set(candidates.filter(Boolean)));
  }

  function buildApiUrl(base, path) {
    const safeBase = normalizeApiBase(base);
    const safePath = String(path || "").startsWith("/") ? String(path || "") : `/${String(path || "")}`;
    return `${safeBase}${safePath}`;
  }

  async function syncSessionWithBackend(options = {}) {
    if (sessionSyncPromise) return sessionSyncPromise;

    sessionSyncPromise = syncSessionWithBackendRequest(options).finally(() => {
      sessionSyncPromise = null;
    });
    return sessionSyncPromise;
  }

  async function syncSessionWithBackendRequest(options = {}) {
    const clearOnUnauthorized = options.clearOnUnauthorized !== false;
    const session = getSession();
    const previewApi = window.EUREKA_PREVIEW || null;
    if (!session || !session.email || !session.token) {
      return { ok: false, status: 0, error: "missing-session" };
    }
    if (previewApi && typeof previewApi.isPreviewSession === "function" && previewApi.isPreviewSession(session)) {
      return {
        ok: true,
        preview: true,
        user: {
          name: String(session.name || "").trim(),
          email: String(session.email || "").trim().toLowerCase(),
          role: String(session.role || "").trim().toLowerCase() || "user"
        }
      };
    }

    const apiCandidates = buildApiCandidates();
    if (!apiCandidates.length) {
      return { ok: false, status: 0, error: "missing-api-base" };
    }

    let lastError = { ok: false, status: 0, error: "No se pudo validar la sesion con el backend." };
    for (let i = 0; i < apiCandidates.length; i += 1) {
      const apiBase = apiCandidates[i];
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = controller ? window.setTimeout(() => controller.abort(), 9000) : null;

      try {
        const response = await fetch(buildApiUrl(apiBase, "/api/auth/me"), {
          method: "GET",
          headers: {
            Authorization: `Bearer ${String(session.token || "").trim()}`
          },
          signal: controller ? controller.signal : undefined
        });
        if (timer) window.clearTimeout(timer);

        let payload = null;
        try {
          payload = await response.json();
        } catch (error) {
          payload = null;
        }

        if (response.ok && payload && payload.ok !== false && payload.user) {
          const serverUser = payload.user || {};
          const synchronized = setSession({
            name: serverUser.name ? String(serverUser.name).trim() : "",
            email: serverUser.email ? String(serverUser.email).trim().toLowerCase() : "",
            role: serverUser.role ? String(serverUser.role).trim().toLowerCase() : "",
            token: String(session.token || "").trim(),
            loggedAt: String(session.loggedAt || "").trim() || new Date().toISOString()
          }, { reason: "session-verified", emitEvent: false });

          return {
            ok: true,
            status: response.status,
            user: synchronized || {
              name: serverUser.name ? String(serverUser.name).trim() : "",
              email: serverUser.email ? String(serverUser.email).trim().toLowerCase() : "",
              role: serverUser.role ? String(serverUser.role).trim().toLowerCase() : ""
            }
          };
        }

        const errorMessage = payload && payload.error
          ? String(payload.error)
          : "No se pudo validar la sesion con el backend.";
        lastError = { ok: false, status: response.status, error: errorMessage };

        if (response.status === 401 || response.status === 403) {
          if (clearOnUnauthorized) {
            clearSession("expired");
          }
          return lastError;
        }
      } catch (error) {
        if (timer) window.clearTimeout(timer);
        const isAbort = String(error && error.name ? error.name : "").toLowerCase() === "aborterror";
        lastError = {
          ok: false,
          status: 0,
          error: isAbort
            ? "El backend demoro demasiado en validar la sesion."
            : "No se pudo conectar con el backend para validar la sesion."
        };
      }
    }

    return lastError;
  }

  function buildPreviewSession(role = "customer") {
    const safeRole = String(role || "").trim().toLowerCase() === "admin" ? "admin" : "customer";
    const email = safeRole === "admin"
      ? "admin.preview@eurekaclean.local"
      : "cliente.preview@eurekaclean.local";
    const name = safeRole === "admin"
      ? "Administrador Vista"
      : "Cliente Vista";
    return {
      name,
      email,
      role: safeRole,
      token: `preview-${safeRole}`,
      loggedAt: "",
      preview: true
    };
  }

  const explicitApiBase = normalizeApiBase(window.EUREKA_API_BASE);
  if (!explicitApiBase) {
    const fromMeta = normalizeApiBase(readMetaContent("eureka-api-base"));

    if (fromMeta) {
      window.EUREKA_API_BASE = fromMeta;
    } else if (isFile) {
      window.EUREKA_API_BASE = "http://127.0.0.1:8000";
    } else if (isLocalHost && port && port !== "8000") {
      window.EUREKA_API_BASE = "http://127.0.0.1:8000";
    } else {
      window.EUREKA_API_BASE = "";
    }
  } else {
    window.EUREKA_API_BASE = explicitApiBase;
  }

  const explicitAdminEmail = String(window.EUREKA_ADMIN_EMAIL || "").trim();
  if (!explicitAdminEmail) {
    const fromMeta = String(readMetaContent("eureka-admin-email") || "").trim();
    window.EUREKA_ADMIN_EMAIL = fromMeta;
  }

  window.EUREKA_CONFIG = window.EUREKA_CONFIG || {};
  window.EUREKA_CONFIG.apiBase = String(window.EUREKA_API_BASE || "").trim();
  window.EUREKA_CONFIG.adminEmail = String(window.EUREKA_ADMIN_EMAIL || "").trim();
  window.EUREKA_CONFIG.designPreview = designPreviewEnabled;
  window.EUREKA_CONFIG.designPreviewMode = currentPreviewMode;
  window.EUREKA_CONFIG.sessionKey = SESSION_KEY;
  window.EUREKA_CONFIG.sessionSyncKey = SESSION_SYNC_KEY;
  window.EUREKA_CONFIG.designPreviewKey = DESIGN_PREVIEW_KEY;
  window.EUREKA_CONFIG.designPreviewModeKey = DESIGN_PREVIEW_MODE_KEY;

  window.EUREKA_PREVIEW = window.EUREKA_PREVIEW || {
    enabled: designPreviewEnabled,
    getMode() {
      return currentPreviewMode || "guest";
    },
    setMode(mode) {
      if (!designPreviewEnabled) return "";
      const safeMode = normalizePreviewMode(mode) || "guest";
      currentPreviewMode = safeMode;
      safeSetStorage(localStorage, DESIGN_PREVIEW_MODE_KEY, safeMode);
      window.EUREKA_CONFIG.designPreviewMode = safeMode;
      window.dispatchEvent(new CustomEvent("preview:mode-changed", {
        detail: { mode: safeMode }
      }));
      return safeMode;
    },
    clearMode() {
      currentPreviewMode = designPreviewEnabled ? "guest" : "";
      safeRemoveStorage(localStorage, DESIGN_PREVIEW_MODE_KEY);
      window.EUREKA_CONFIG.designPreviewMode = currentPreviewMode;
      window.dispatchEvent(new CustomEvent("preview:mode-changed", {
        detail: { mode: currentPreviewMode || "guest" }
      }));
      return currentPreviewMode;
    },
    getSession() {
      if (!designPreviewEnabled) return null;
      const mode = currentPreviewMode || "guest";
      if (mode === "admin") return buildPreviewSession("admin");
      if (mode === "customer") return buildPreviewSession("customer");
      return null;
    },
    getMockSession(role = "customer") {
      return buildPreviewSession(role);
    },
    isPreviewSession(session) {
      return Boolean(session && session.preview);
    },
    getAvailableModes() {
      return ["guest", "customer", "admin"];
    }
  };

  if (window.EUREKA_PREVIEW.enabled && !window.EUREKA_PREVIEW.getMode()) {
    window.EUREKA_PREVIEW.setMode("guest");
  }

  window.EUREKA_AUTH = window.EUREKA_AUTH || {
    clearSession,
    getSession,
    getToken() {
      const session = getSession();
      return session ? session.token : "";
    },
    setSession,
    syncSessionWithBackend
  };
})();
