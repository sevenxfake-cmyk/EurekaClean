(() => {
  const THEME_KEY = "eurekaclean_theme";
  const ADMIN_EMAIL = String(window.EUREKA_ADMIN_EMAIL || "").trim().toLowerCase();
  const ADMIN_CLASS = "auth-is-admin";
  const PRELOAD_CLASS = "auth-preload";
  const authStore = window.EUREKA_AUTH || null;
  const previewStore = window.EUREKA_PREVIEW || null;

  function normalizeTheme(theme) {
    return String(theme || "").trim().toLowerCase() === "dark" ? "dark" : "light";
  }

  function getTheme() {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      if (stored) return normalizeTheme(stored);
    } catch (error) {
      // ignore storage errors
    }
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function isPreviewAdminSession() {
    const session = authStore && typeof authStore.getSession === "function"
      ? authStore.getSession()
      : null;
    const resolvedSession = session || (previewStore && typeof previewStore.getSession === "function"
      ? previewStore.getSession()
      : null);
    const isPreviewSession = Boolean(
      previewStore
      && typeof previewStore.isPreviewSession === "function"
      && previewStore.isPreviewSession(resolvedSession)
    );
    const email = resolvedSession && resolvedSession.email ? String(resolvedSession.email).trim().toLowerCase() : "";
    const role = resolvedSession && resolvedSession.role ? String(resolvedSession.role).trim().toLowerCase() : "";
    return (isPreviewSession && role === "admin") || role === "admin" || (!!ADMIN_EMAIL && email === ADMIN_EMAIL);
  }

  function hasValidSession() {
    const session = authStore && typeof authStore.getSession === "function"
      ? authStore.getSession()
      : null;
    const resolvedSession = session || (previewStore && typeof previewStore.getSession === "function"
      ? previewStore.getSession()
      : null);
    const email = resolvedSession && resolvedSession.email ? String(resolvedSession.email).trim().toLowerCase() : "";
    const token = resolvedSession && resolvedSession.token ? String(resolvedSession.token).trim() : "";
    return Boolean(email && token);
  }

  function applyThemePreload(theme) {
    const normalized = normalizeTheme(theme);
    const isDark = normalized === "dark";
    document.documentElement.style.colorScheme = normalized;
    document.documentElement.setAttribute("data-theme", normalized);
    document.documentElement.classList.toggle("theme-dark", isDark);
    document.documentElement.classList.toggle("theme-light", !isDark);
    if (document.body) {
      document.body.classList.toggle("theme-dark", isDark);
      document.body.classList.toggle("theme-light", !isDark);
    }
  }

  function applyAdminClass(enabled) {
    if (!enabled) return;
    document.documentElement.classList.add(ADMIN_CLASS);
    if (document.body) {
      document.body.classList.add(ADMIN_CLASS);
    }
  }

  document.documentElement.classList.add(PRELOAD_CLASS);
  if (document.body) document.body.classList.add(PRELOAD_CLASS);

  applyThemePreload(getTheme());

  if (hasValidSession()) {
    document.documentElement.classList.add("auth-has-session");
    if (document.body) document.body.classList.add("auth-has-session");
  }

  const isAdmin = isPreviewAdminSession();
  applyAdminClass(isAdmin);
  document.addEventListener("DOMContentLoaded", () => {
    applyAdminClass(isAdmin);
    applyThemePreload(getTheme());
  }, { once: true });

  function releasePreload() {
    document.documentElement.classList.remove("page-data-pending", PRELOAD_CLASS);
    if (document.body) document.body.classList.remove(PRELOAD_CLASS);
  }

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(releasePreload);
  });

  window.setTimeout(releasePreload, 1600);
})();
