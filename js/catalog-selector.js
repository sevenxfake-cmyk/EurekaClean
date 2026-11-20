(() => {
  const catalogApi = window.EUREKA_CATALOG;
  if (!catalogApi) return;

  const grid = document.getElementById("categorySelectorGrid");
  const searchInput = document.getElementById("categorySelectorSearch");
  const stats = document.getElementById("selectorStats");
  let groups = [];

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function slug(value, fallback = "catalogo") {
    return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || fallback;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function parseMeta(item, fallbackLabel) {
    let parent = "";
    let child = "";
    String(item && item.description ? item.description : "")
      .split("|")
      .forEach((part) => {
        const match = String(part || "").trim().match(/^([^:]+):\s*(.+)$/);
        if (!match) return;
        const key = normalize(match[1]);
        const value = String(match[2] || "").trim();
        if (key === "categoria origen" || key === "categoria") parent = value;
        if (key === "subcategoria origen" || key === "subcategoria") child = value;
      });
    return {
      parent: parent || fallbackLabel || "Catalogo",
      child: child || fallbackLabel || parent || "Catalogo"
    };
  }

  function buildGroups() {
    const grouped = new Map();
    const catalog = catalogApi.getCatalogWithConfig();
    Object.entries(catalog).forEach(([categoryKey, category]) => {
      const items = Array.isArray(category.items) ? category.items.filter((item) => item.active) : [];
      items.forEach((item) => {
        const meta = parseMeta(item, category.label || categoryKey);
        const parentKey = slug(meta.parent, categoryKey);
        let group = grouped.get(parentKey);
        if (!group) {
          group = { key: parentKey, label: meta.parent, count: 0, children: new Map() };
          grouped.set(parentKey, group);
        }
        const childKey = slug(meta.child, categoryKey);
        const child = group.children.get(childKey) || { key: childKey, label: meta.child, count: 0 };
        child.count += 1;
        group.count += 1;
        group.children.set(childKey, child);
      });
    });
    return Array.from(grouped.values())
      .map((group) => ({
        ...group,
        children: Array.from(group.children.values()).sort((a, b) => a.label.localeCompare(b.label, "es"))
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "es"));
  }

  function categoryUrl(groupKey, childKey = "") {
    const params = new URLSearchParams({ categoria: groupKey });
    if (childKey) params.set("subcategoria", childKey);
    return `categoria.html?${params.toString()}`;
  }

  function render() {
    const query = normalize(searchInput ? searchInput.value : "");
    const visible = groups.filter((group) => {
      if (!query) return true;
      return normalize(`${group.label} ${group.children.map((child) => child.label).join(" ")}`).includes(query);
    });

    if (stats) {
      const totalProducts = groups.reduce((total, group) => total + group.count, 0);
      const totalSubcategories = groups.reduce((total, group) => total + group.children.length, 0);
      stats.innerHTML = `<span class="store-hero-stat-pill">${groups.length} categorias</span><span class="store-hero-stat-pill">${totalSubcategories} subcategorias</span><span class="store-hero-stat-pill">${totalProducts} productos</span>`;
    }

    if (!grid) return;
    grid.innerHTML = visible.length
      ? visible.map((group) => `
          <article class="category-selector-card" data-category-card>
            <button class="category-selector-toggle" type="button" aria-expanded="false">
              <span>
                <strong>${escapeHtml(group.label)}</strong>
                <small>${group.children.length} subcategorias · ${group.count} productos</small>
              </span>
              <span class="category-selector-arrow" aria-hidden="true">&#8964;</span>
            </button>
            <div class="category-selector-drawer">
              <a class="category-selector-all" href="${categoryUrl(group.key)}">Ver toda la categoria</a>
              <div class="category-selector-links">
                ${group.children.map((child) => `<a href="${categoryUrl(group.key, child.key)}"><span>${escapeHtml(child.label)}</span><b>${child.count}</b></a>`).join("")}
              </div>
            </div>
          </article>
        `).join("")
      : '<div class="catalog-selector-empty">No encontramos categorias con ese nombre.</div>';
  }

  if (grid) {
    grid.addEventListener("click", (event) => {
      const toggle = event.target.closest(".category-selector-toggle");
      if (!toggle) return;
      const card = toggle.closest("[data-category-card]");
      const willOpen = !card.classList.contains("is-open");
      document.querySelectorAll("[data-category-card].is-open").forEach((entry) => {
        entry.classList.remove("is-open");
        const button = entry.querySelector(".category-selector-toggle");
        if (button) button.setAttribute("aria-expanded", "false");
      });
      card.classList.toggle("is-open", willOpen);
      toggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
    });
  }

  if (searchInput) searchInput.addEventListener("input", render);

  async function initialize() {
    try {
      await catalogApi.refreshBackendCatalog(true);
    } catch (error) {
      // The cached catalog remains available if the backend is temporarily unavailable.
    }
    groups = buildGroups();
    render();
    document.documentElement.classList.remove("page-data-pending", "auth-preload");
    document.body.classList.remove("auth-preload");
  }

  initialize();
})();
