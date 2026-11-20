(() => {
  const THEME_KEY = "eurekaclean_theme";
  const PROFORMA_KEY_PREFIX = "eurekaclean_proforma_";
  const NAV_SEARCH_LIMIT = 7;
  const ADMIN_EMAIL = String(window.EUREKA_ADMIN_EMAIL || "").trim().toLowerCase();
  const authStore = window.EUREKA_AUTH || null;
  const previewStore = window.EUREKA_PREVIEW || null;
  let mobileNavbarBound = false;
  let authUiSyncInFlight = null;

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function usernameFromEmail(email) {
    const localPart = String(email || "").split("@")[0].trim();
    return localPart || "usuario";
  }

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function normalizeTheme(theme) {
    return String(theme || "").trim().toLowerCase() === "dark" ? "dark" : "light";
  }

  function normalizeSearchText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function buildApiUrl(base, path) {
    const cleanBase = String(base || "").trim().replace(/\/+$/, "");
    const cleanPath = String(path || "");
    if (!cleanBase) return cleanPath || "/";
    return `${cleanBase}${cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`}`;
  }

  function flattenCatalogProducts(catalog) {
    const items = [];
    if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) return items;

    Object.entries(catalog).forEach(([categoryKey, category]) => {
      const categoryLabel = String(category && category.label ? category.label : categoryKey || "Catalogo").trim();
      const products = category && Array.isArray(category.items) ? category.items : [];
      products.forEach((item) => {
        if (!item || item.active === false) return;
        const name = String(item.name || "").trim();
        const code = String(item.code || "").trim();
        if (!name) return;
        const price = String(item.price || "").trim();
        items.push({
          name,
          code,
          categoryLabel,
          price,
          haystack: normalizeSearchText(`${name} ${code} ${categoryLabel}`)
        });
      });
    });

    return items;
  }

  let navbarCatalogPromise = null;

  async function getNavbarCatalogItems() {
    if (navbarCatalogPromise) return navbarCatalogPromise;

    navbarCatalogPromise = (async () => {
      const catalogApi = window.EUREKA_CATALOG || null;
      if (catalogApi && typeof catalogApi.getCatalogWithConfig === "function") {
        const localItems = flattenCatalogProducts(catalogApi.getCatalogWithConfig());
        if (localItems.length) return localItems;
      }

      const apiBase = String(
        (window.EUREKA_CONFIG && window.EUREKA_CONFIG.apiBase)
        || window.EUREKA_API_BASE
        || ""
      ).trim();

      try {
        const response = await fetch(buildApiUrl(apiBase, "/api/catalog?activeOnly=1"), {
          method: "GET",
          headers: { Accept: "application/json" },
          credentials: "same-origin"
        });
        if (!response.ok) return [];
        const payload = await response.json();
        return flattenCatalogProducts(payload && payload.catalog);
      } catch (error) {
        return [];
      }
    })();

    return navbarCatalogPromise;
  }

  function getNavbarSearchMatches(items, query) {
    const normalized = normalizeSearchText(query);
    if (normalized.length < 2) return [];
    return items
      .filter((item) => item.haystack.includes(normalized))
      .sort((left, right) => {
        const leftName = normalizeSearchText(left.name);
        const rightName = normalizeSearchText(right.name);
        const leftStarts = leftName.startsWith(normalized) ? 0 : 1;
        const rightStarts = rightName.startsWith(normalized) ? 0 : 1;
        if (leftStarts !== rightStarts) return leftStarts - rightStarts;
        return leftName.localeCompare(rightName);
      })
      .slice(0, NAV_SEARCH_LIMIT);
  }

  function goToCatalogSearch(value) {
    const query = String(value || "").trim();
    if (!query) return;
    window.location.href = `categoria.html?q=${encodeURIComponent(query)}`;
  }

  function bindNavbarSearchSuggestions() {
    document.querySelectorAll(".nav-search").forEach((form) => {
      if (form.dataset.suggestionsBound === "1") return;
      form.dataset.suggestionsBound = "1";

      const input = form.querySelector('input[name="q"]');
      if (!input) return;
      input.setAttribute("autocomplete", "off");

      const panel = document.createElement("div");
      panel.className = "nav-search-suggestions";
      panel.hidden = true;
      panel.setAttribute("role", "listbox");
      form.appendChild(panel);

      let activeIndex = -1;
      let currentMatches = [];

      function hidePanel() {
        panel.hidden = true;
        panel.innerHTML = "";
        activeIndex = -1;
        currentMatches = [];
      }

      function setActive(index) {
        activeIndex = index;
        Array.from(panel.querySelectorAll(".nav-search-suggestion")).forEach((button, idx) => {
          button.classList.toggle("is-active", idx === activeIndex);
          button.setAttribute("aria-selected", idx === activeIndex ? "true" : "false");
        });
      }

      function renderMatches(matches, query) {
        currentMatches = matches;
        activeIndex = -1;
        if (!String(query || "").trim() || normalizeSearchText(query).length < 2) {
          hidePanel();
          return;
        }

        if (!matches.length) {
          panel.innerHTML = `<div class="nav-search-empty">Sin productos encontrados</div>`;
          panel.hidden = false;
          return;
        }

        panel.innerHTML = matches.map((item, index) => {
          const price = item.price ? `<span class="nav-search-price">S/. ${escapeHtml(item.price)}</span>` : "";
          const meta = [item.code, item.categoryLabel].filter(Boolean).join(" · ");
          return `
            <button type="button" class="nav-search-suggestion" role="option" data-index="${index}" aria-selected="false">
              <span class="nav-search-main">${escapeHtml(item.name)}</span>
              <span class="nav-search-meta">${escapeHtml(meta)}</span>
              ${price}
            </button>
          `;
        }).join("");
        panel.hidden = false;
      }

      async function updateSuggestions() {
        const query = input.value;
        if (normalizeSearchText(query).length < 2) {
          hidePanel();
          return;
        }
        panel.innerHTML = `<div class="nav-search-empty">Buscando productos...</div>`;
        panel.hidden = false;
        const items = await getNavbarCatalogItems();
        renderMatches(getNavbarSearchMatches(items, query), query);
      }

      input.addEventListener("input", updateSuggestions);
      input.addEventListener("focus", updateSuggestions);

      input.addEventListener("keydown", (event) => {
        if (panel.hidden) return;
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setActive(Math.min(currentMatches.length - 1, activeIndex + 1));
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          setActive(Math.max(0, activeIndex - 1));
        } else if (event.key === "Enter" && activeIndex >= 0 && currentMatches[activeIndex]) {
          event.preventDefault();
          goToCatalogSearch(currentMatches[activeIndex].name);
        } else if (event.key === "Escape") {
          hidePanel();
        }
      });

      panel.addEventListener("mousedown", (event) => {
        const button = event.target.closest(".nav-search-suggestion");
        if (!button) return;
        event.preventDefault();
        const index = Number(button.dataset.index);
        const item = currentMatches[index];
        if (item) goToCatalogSearch(item.name);
      });

      form.addEventListener("submit", (event) => {
        event.preventDefault();
        goToCatalogSearch(input.value);
      });

      document.addEventListener("click", (event) => {
        if (!form.contains(event.target)) hidePanel();
      });
    });
  }

  function getTheme() {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      if (stored) return normalizeTheme(stored);
    } catch (error) {}
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function isDesignPreview() {
    return !!(previewStore && previewStore.enabled);
  }

  function persistTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, normalizeTheme(theme));
    } catch (error) {}
  }

  function applyTheme(theme) {
    const normalized = normalizeTheme(theme);
    const isDark = normalized === "dark";
    document.documentElement.style.colorScheme = normalized;
    document.documentElement.classList.toggle("theme-dark", isDark);
    document.documentElement.classList.toggle("theme-light", !isDark);
    document.body.classList.toggle("theme-dark", isDark);
    document.body.classList.toggle("theme-light", !isDark);
    document.documentElement.setAttribute("data-theme", normalized);
    return normalized;
  }

  function syncThemeButtons() {
    const isDark = document.body.classList.contains("theme-dark");
    const actionLabel = isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
    const currentLabel = isDark ? "Oscuro" : "Claro";
    document.querySelectorAll("[data-auth-action='toggle-theme']").forEach((button) => {
      button.setAttribute("data-theme", isDark ? "dark" : "light");
      button.setAttribute("title", `Tema actual: ${currentLabel}`);
      button.setAttribute("aria-label", actionLabel);
      button.setAttribute("aria-pressed", String(isDark));
      const glyph = button.querySelector(".theme-min-glyph");
      if (glyph) glyph.textContent = isDark ? "\u263E" : "\u2600";
    });
  }

  function toggleTheme() {
    const nextTheme = document.body.classList.contains("theme-dark") ? "light" : "dark";
    applyTheme(nextTheme);
    persistTheme(nextTheme);
    syncThemeButtons();
  }

  function injectStyles() {
    // Shared auth/theme styles are loaded from css/style-auth-admin.css.
  }

  function getSession() {
    const session = authStore && typeof authStore.getSession === "function"
      ? authStore.getSession()
      : null;
    if (session) return session;
    if (previewStore && typeof previewStore.getSession === "function") {
      return previewStore.getSession();
    }
    return null;
  }

  function isAdminSession(session) {
    const isPreviewAdmin = Boolean(
      previewStore
      && typeof previewStore.isPreviewSession === "function"
      && previewStore.isPreviewSession(session)
      && String(session && session.role ? session.role : "").trim().toLowerCase() === "admin"
    );
    if (isPreviewAdmin) return true;
    const email = session && session.email ? String(session.email).trim().toLowerCase() : "";
    const role = session && session.role ? String(session.role).trim().toLowerCase() : "";
    return role === "admin" || (!!ADMIN_EMAIL && email === ADMIN_EMAIL);
  }

  function isCustomerSession(session) {
    return !!(session && session.email) && !isAdminSession(session);
  }

  function updateNavbarCartCount(session) {
    const badge = document.querySelector(".nav-cart-count");
    if (!badge) return;

    let count = 0;
    if (isCustomerSession(session)) {
      try {
        const raw = JSON.parse(localStorage.getItem(`${PROFORMA_KEY_PREFIX}${normalizeEmail(session.email)}`) || "[]");
        count = Array.isArray(raw)
          ? raw.reduce((total, item) => total + Math.max(1, Number(item && item.qty ? item.qty : 1) || 1), 0)
          : 0;
      } catch (error) {
        count = 0;
      }
    }

    badge.textContent = String(Math.min(99, count));
    badge.hidden = count <= 0;
  }

  function applyRoleVisibility(session) {
    const isAdmin = isAdminSession(session);
    const hasSession = Boolean(session && session.email && session.token);
    document.documentElement.classList.toggle("auth-is-admin", isAdmin);
    document.documentElement.classList.toggle("auth-has-session", hasSession);
    document.body.classList.toggle("auth-is-admin", isAdmin);
    document.body.classList.toggle("auth-has-session", hasSession);
    document.querySelectorAll("[data-admin-only]").forEach((el) => {
      el.hidden = !isAdmin;
    });
  }

  function logoutSession() {
    const session = getSession();
    if (authStore && typeof authStore.clearSession === "function") {
      authStore.clearSession("logout");
    }
    if (previewStore && typeof previewStore.isPreviewSession === "function" && previewStore.isPreviewSession(session)) {
      previewStore.setMode("guest");
    }
    applyRoleVisibility(null);
    renderNavbarAuth();
    window.dispatchEvent(new CustomEvent("auth:logout"));
  }

  function bindLogout(slot) {
    const logoutBtn = slot.querySelector("[data-auth-action='logout']");
    if (!logoutBtn) return;

    logoutBtn.addEventListener("click", (event) => {
      event.preventDefault();
      logoutSession();
    });
  }

  function bindThemeToggle(item) {
    const toggleBtn = item.querySelector("[data-auth-action='toggle-theme']");
    if (!toggleBtn || toggleBtn.dataset.bound === "1") return;
    toggleBtn.dataset.bound = "1";
    toggleBtn.addEventListener("click", (event) => {
      event.preventDefault();
      toggleTheme();
    });
  }

  function getNavbarList(slot) {
    return slot.closest("ul.navbar-nav") || document.querySelector("#menu ul.navbar-nav");
  }

  function syncThemeNavbar(slot, session) {
    const navList = getNavbarList(slot);
    if (!navList) return;

    let themeItem = document.getElementById("navThemeItem");
    if (!themeItem) {
      themeItem = document.createElement("li");
      themeItem.id = "navThemeItem";
      themeItem.className = "nav-item nav-theme-item";
      themeItem.innerHTML = `
        <button type="button" class="btn btn-outline-dark rounded-pill shadow-sm theme-min-toggle" data-auth-action="toggle-theme" aria-label="Cambiar tema">
          <span class="theme-min-glyph" aria-hidden="true">&#9728;</span>
        </button>
      `;
    } else {
      themeItem.className = "nav-item nav-theme-item";
    }

    if (!themeItem.isConnected) {
      navList.insertBefore(themeItem, slot.closest("ul.navbar-nav") ? slot : null);
    }
    themeItem.hidden = isAdminSession(session);
    if (themeItem.hidden) return;
    bindThemeToggle(themeItem);
    syncThemeButtons();
  }

  function syncProformaNavbar(slot, session) {
    const navList = getNavbarList(slot);
    if (!navList) return;

    let proformaItem = document.getElementById("navProformaItem");
    if (!proformaItem) {
      const existingLink = navList.querySelector('a.nav-link[href="proforma.html"]');
      proformaItem = existingLink ? existingLink.closest("li") : null;
      if (proformaItem) proformaItem.id = "navProformaItem";
    }

    if (!proformaItem) {
      proformaItem = document.createElement("li");
      proformaItem.id = "navProformaItem";
      proformaItem.className = "nav-item";
      proformaItem.innerHTML = `<a class="nav-link" href="proforma.html">Proforma</a>`;
    } else {
      proformaItem.classList.add("nav-item");
    }

    if (!proformaItem.isConnected) {
      navList.insertBefore(proformaItem, slot.closest("ul.navbar-nav") ? slot : null);
    }
    proformaItem.hidden = !isCustomerSession(session);
    if (proformaItem.hidden) return;

    const currentPage = String(window.location.pathname || "").split("/").pop().toLowerCase();
    const link = proformaItem.querySelector("a.nav-link");
    if (link) {
      link.classList.toggle("active", currentPage === "proforma.html");
    }
  }

  function syncAdminEditorNavbar(slot, session) {
    const navList = getNavbarList(slot);
    if (!navList) return;

    let editorItem = document.getElementById("navEditorItem");
    if (!editorItem) {
      const existingLink = navList.querySelector('a.nav-link[href="editor.html"]');
      editorItem = existingLink ? existingLink.closest("li") : null;
      if (editorItem) editorItem.id = "navEditorItem";
    }

    if (!editorItem) {
      editorItem = document.createElement("li");
      editorItem.id = "navEditorItem";
      editorItem.className = "nav-item";
      editorItem.innerHTML = `<a class="nav-link nav-editor-link" href="editor.html">Editor</a>`;
    } else {
      editorItem.classList.add("nav-item");
    }

    if (!editorItem.isConnected) {
      navList.insertBefore(editorItem, slot.closest("ul.navbar-nav") ? slot : null);
    }
    editorItem.hidden = !isAdminSession(session);
    if (editorItem.hidden) return;

    const currentPage = String(window.location.pathname || "").split("/").pop().toLowerCase();
    const link = editorItem.querySelector("a.nav-link");
    if (link) {
      link.classList.add("nav-editor-link");
      link.classList.toggle("active", currentPage === "editor.html");
    }
  }

  function renderNavbarAuth() {
    const slot = document.getElementById("navAuthSlot");
    const session = getSession();
    applyRoleVisibility(session);
    updateNavbarCartCount(session);
    if (!slot) return;

    const email = session && session.email ? String(session.email).trim().toLowerCase() : "";
    const sessionName = session && session.name ? String(session.name).trim() : "";
    const isAdmin = isAdminSession(session);
    const authSignature = JSON.stringify([email, sessionName, isAdmin]);
    if (slot.dataset.authSignature === authSignature) return;

    syncProformaNavbar(slot, session);
    syncAdminEditorNavbar(slot, session);
    syncThemeNavbar(slot, session);

    if (!email) {
      slot.innerHTML = `<a class="nav-icon-link nav-account-link" href="login.html" aria-label="Iniciar sesion">&#128100;</a>`;
      slot.dataset.authSignature = authSignature;
      updateNavbarCartCount(null);
      return;
    }

    const displayName = sessionName || usernameFromEmail(email);
    const initial = escapeHtml(displayName.charAt(0) || "U");
    const safeDisplayName = escapeHtml(displayName);
    const pillClass = isAdmin ? "auth-user-pill admin" : "auth-user-pill";
    const adminBadge = isAdmin ? `<span class="auth-role-badge" aria-label="Administrador">ADMIN</span>` : "";

    slot.innerHTML = `
      <div class="auth-slot-wrap">
        <a class="${pillClass}" href="login.html" title="Cuenta activa">
          <span class="auth-avatar">${initial}</span>
          <span class="auth-email">${safeDisplayName}</span>
          ${adminBadge}
        </a>
        <button type="button" class="auth-logout-btn" data-auth-action="logout" aria-label="Cerrar sesion">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" />
            <path d="M13 8l5 4-5 4" />
            <path d="M18 12H9" />
          </svg>
          <span class="auth-logout-text">Salir</span>
        </button>
      </div>
    `;
    slot.dataset.authSignature = authSignature;
    bindLogout(slot);
  }

  function markInitialAuthRenderComplete() {
    if (document.documentElement.classList.contains("page-data-pending")) return;
    document.documentElement.classList.remove("auth-preload");
    if (document.body) document.body.classList.remove("auth-preload");
  }

  async function syncSessionBeforeRender() {
    renderNavbarAuth();
    markInitialAuthRenderComplete();

    if (
      !authStore
      || typeof authStore.syncSessionWithBackend !== "function"
      || typeof authStore.getSession !== "function"
    ) {
      return;
    }

    const session = authStore.getSession();
    const isPreviewSession = Boolean(
      previewStore
      && typeof previewStore.isPreviewSession === "function"
      && previewStore.isPreviewSession(session)
    );
    if (!session || !session.token || isPreviewSession) {
      return;
    }

    const sessionBeforeSync = authStore.getSession();
    const sessionSignatureBeforeSync = sessionBeforeSync
      ? JSON.stringify([sessionBeforeSync.name, sessionBeforeSync.email, sessionBeforeSync.role, sessionBeforeSync.token])
      : "";

    if (authUiSyncInFlight) {
      await authUiSyncInFlight;
      const sessionAfterSharedSync = authStore.getSession();
      const sharedSignature = sessionAfterSharedSync
        ? JSON.stringify([sessionAfterSharedSync.name, sessionAfterSharedSync.email, sessionAfterSharedSync.role, sessionAfterSharedSync.token])
        : "";
      if (sharedSignature !== sessionSignatureBeforeSync) renderNavbarAuth();
      return;
    }

    authUiSyncInFlight = authStore.syncSessionWithBackend({ clearOnUnauthorized: true })
      .catch(() => null)
      .finally(() => {
        authUiSyncInFlight = null;
      });

    await authUiSyncInFlight;
    const sessionAfterSync = authStore.getSession();
    const sessionSignatureAfterSync = sessionAfterSync
      ? JSON.stringify([sessionAfterSync.name, sessionAfterSync.email, sessionAfterSync.role, sessionAfterSync.token])
      : "";
    if (sessionSignatureAfterSync !== sessionSignatureBeforeSync) renderNavbarAuth();
  }

  function bindMobileNavbarBehavior() {
    if (mobileNavbarBound) return;

    const navbar = document.querySelector(".navbar");
    if (!navbar) return;

    const toggler = navbar.querySelector(".navbar-toggler");
    const collapse = navbar.querySelector(".navbar-collapse");
    if (!toggler || !collapse) return;

    mobileNavbarBound = true;

    const isMobileViewport = () => window.matchMedia("(max-width: 991.98px)").matches;
    const bootstrapApi = window.bootstrap;
    const collapseApi = bootstrapApi && bootstrapApi.Collapse
      ? bootstrapApi.Collapse.getOrCreateInstance(collapse, { toggle: false })
      : null;

    const applyBodyState = (isOpen) => {
      const open = Boolean(isOpen) && isMobileViewport();
      document.body.classList.toggle("nav-menu-open", open);
      toggler.setAttribute("aria-expanded", open ? "true" : "false");
      toggler.classList.toggle("collapsed", !open);
    };

    const closeMenu = () => {
      if (!collapse.classList.contains("show")) {
        applyBodyState(false);
        return;
      }
      if (collapseApi && isMobileViewport()) {
        collapseApi.hide();
        return;
      }
      collapse.classList.remove("show", "collapsing");
      collapse.style.height = "";
      applyBodyState(false);
    };

    const openMenuFallback = () => {
      collapse.classList.add("show");
      collapse.classList.remove("collapsing");
      collapse.style.height = "";
      applyBodyState(true);
    };

    collapse.addEventListener("show.bs.collapse", () => applyBodyState(true));
    collapse.addEventListener("shown.bs.collapse", () => applyBodyState(true));
    collapse.addEventListener("hide.bs.collapse", () => applyBodyState(false));
    collapse.addEventListener("hidden.bs.collapse", () => applyBodyState(false));

    if (!collapseApi) {
      toggler.addEventListener("click", (event) => {
        if (!isMobileViewport()) return;
        event.preventDefault();
        if (collapse.classList.contains("show")) {
          closeMenu();
        } else {
          openMenuFallback();
        }
      });
    }

    collapse.addEventListener("click", (event) => {
      if (!isMobileViewport()) return;
      const target = event.target.closest("a.nav-link, a.btn, button.auth-logout-btn, button.theme-min-toggle");
      if (!target) return;
      window.setTimeout(() => {
        closeMenu();
      }, 80);
    });

    document.addEventListener("click", (event) => {
      if (!isMobileViewport()) return;
      if (!collapse.classList.contains("show")) return;
      const clickedInsideMenu = collapse.contains(event.target);
      const clickedToggler = toggler.contains(event.target);
      if (!clickedInsideMenu && !clickedToggler) {
        closeMenu();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    });

    window.addEventListener("resize", () => {
      if (isMobileViewport()) {
        applyBodyState(collapse.classList.contains("show"));
        return;
      }
      if (collapse.classList.contains("show") && collapseApi) {
        collapseApi.hide();
      } else {
        collapse.classList.remove("show", "collapsing");
        collapse.style.height = "";
      }
      applyBodyState(false);
    });

    applyBodyState(collapse.classList.contains("show"));
  }

  function bindScrollRevealEffect() {
    // Automatic entrance animations caused visible repainting on every page.
  }

  applyTheme(getTheme());
  injectStyles();
  syncSessionBeforeRender();
  window.addEventListener("auth:session-changed", () => {
    syncSessionBeforeRender();
  });
  window.addEventListener("preview:mode-changed", () => {
    renderNavbarAuth();
  });
  window.addEventListener("proforma:changed", () => {
    updateNavbarCartCount(getSession());
  });
  window.addEventListener("storage", (event) => {
    if (event.key && event.key.startsWith(PROFORMA_KEY_PREFIX)) {
      updateNavbarCartCount(getSession());
    }
  });
  bindMobileNavbarBehavior();
  bindNavbarSearchSuggestions();
  bindScrollRevealEffect();
})();
