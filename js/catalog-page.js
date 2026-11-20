(() => {
  window.EUREKA_CATALOG_PAGE_BUILD = "20260604drawer2";
  const DEFAULT_PAGE_SIZE = 12;
  const SEARCH_PAGE_SIZE = 12;
  const SESSION_SYNC_KEY = window.EUREKA_CONFIG && window.EUREKA_CONFIG.sessionSyncKey
    ? String(window.EUREKA_CONFIG.sessionSyncKey)
    : "eurekaclean_session_sync";
  const authStore = window.EUREKA_AUTH || null;
  const PROFORMA_KEY_PREFIX = "eurekaclean_proforma_";
  const CATALOG_VIEW_KEY = "eurekaclean_catalog_view";
  const DRAWER_TIP_KEY_PREFIX = "eurekaclean_catalog_tip_seen_";
  const MOBILE_PROMO_BREAKPOINT = "(max-width: 767.98px)";
  const ALL_PRODUCTS_CATEGORY = "all-products";
  const MERGED_CATEGORY_PREFIX = "merged-category::";
  const ADMIN_EMAIL = String(window.EUREKA_ADMIN_EMAIL || "").trim().toLowerCase();
  const MARKET_PRIORITY_SOURCE = window.EUREKA_MARKET_PRIORITY && typeof window.EUREKA_MARKET_PRIORITY === "object"
    ? window.EUREKA_MARKET_PRIORITY
    : {};
  const previewStore = window.EUREKA_PREVIEW || null;
  const catalogUrlParams = new URLSearchParams(window.location.search || "");
  const requestedParentCategory = String(catalogUrlParams.get("categoria") || "").trim();
  const requestedSubcategory = String(catalogUrlParams.get("subcategoria") || "").trim();
  const requestedPage = Math.max(1, Number.parseInt(String(catalogUrlParams.get("page") || "1"), 10) || 1);

  const catalogApi = window.EUREKA_CATALOG;
  if (!catalogApi) return;

  let catalogData = {};
  let defaultPromoMap = {};

  function getInitialSearchQuery() {
    try {
      return String(new URLSearchParams(window.location.search || "").get("q") || "").trim();
    } catch (error) {
      return "";
    }
  }

  let currentCategory = ALL_PRODUCTS_CATEGORY;
  let currentPage = requestedPage;
  let currentSearch = getInitialSearchQuery();
  let currentCategoryFilter = "";
  let searchRenderTimer = null;
  let viewResizeTimer = null;
  let drawerTipTimer = null;
  let bottomNoticeTimer = null;
  let lockedBodyScrollY = 0;
  let isRedirectingToLogin = false;
  let catalogReady = false;
  let lastCatalogLayoutSignature = "";
  let lastProformaUiSignature = "";
  let lastProformaDrawerSignature = "";
  let lastSidebarSignature = "";
  let catalogGridReleaseTimer = null;
  const catalogImageLoadCache = new Set();
  const catalogImagePreloadCache = new Map();
  const catalogProductNodeCache = new Map();
  let requestedParentCategoryApplied = false;
  let requestedSubcategoryApplied = false;
  let requestedPageApplied = false;

  const titleEl = document.getElementById("catalogTitle");
  const subtitleEl = document.getElementById("catalogSubtitle");
  const gridEl = document.getElementById("catalogGrid");
  const paginationEl = document.getElementById("catalogPagination");
  const paginationTopEl = document.getElementById("catalogPaginationTop");
  const catalogSidebarGroupsEl = document.getElementById("catalogSidebarGroups");
  const catalogSidebarEl = document.querySelector(".catalog-sidebar");
  const allProductsButton = document.getElementById("catalogAllProductsBtn");
  const storeHeroStatsEl = document.getElementById("storeHeroStats");
  const catalogSearchHintEl = document.getElementById("catalogSearchHint");
  const catalogSearchStatsEl = document.getElementById("catalogSearchStats");
  const catalogCategoryFilterInput = document.getElementById("catalogCategoryFilterInput");
  const bottomNoticeEl = document.getElementById("bottomNotice");
  const proformaLinkBtn = document.getElementById("proformaLinkBtn");
  const proformaCountBadge = document.getElementById("proformaCountBadge");
  const catalogSearchInput = document.getElementById("catalogSearchInput");
  const catalogSearchClearBtn = document.getElementById("catalogSearchClearBtn");
  const catalogLayoutEl = document.querySelector(".catalog-layout");
  const catalogSidebarColEl = document.querySelector(".catalog-sidebar-col");
  const catalogMobileToggleBtn = document.getElementById("catalogMobileToggleBtn");
  const catalogMobileFilterChipBtn = document.getElementById("catalogMobileFilterChipBtn");
  const catalogMobileCloseBtn = document.getElementById("catalogMobileCloseBtn");
  const catalogMobileBackdrop = document.getElementById("catalogMobileBackdrop");
  const catalogMobileActiveLabel = document.getElementById("catalogMobileActiveLabel");
  const catalogMobileRangeLabel = document.getElementById("catalogMobileRangeLabel");
  const catalogViewGridBtn = document.getElementById("catalogViewGridBtn");
  const catalogViewListBtn = document.getElementById("catalogViewListBtn");
  const promoCountBadge = document.getElementById("promoCountBadge");
  const promoIndicators = document.getElementById("promoIndicators");
  const promoInner = document.getElementById("promoInner");
  const promoCarouselEl = document.getElementById("promoCarousel");
  const promoPrevControl = promoCarouselEl ? promoCarouselEl.querySelector(".carousel-control-prev") : null;
  const promoNextControl = promoCarouselEl ? promoCarouselEl.querySelector(".carousel-control-next") : null;
  const productPreviewModalEl = document.getElementById("productPreviewModal");
  const productPreviewImageEl = document.getElementById("productPreviewImage");
  const productPreviewCategoryEl = document.getElementById("productPreviewCategory");
  const productPreviewNameEl = document.getElementById("productPreviewName");
  const productPreviewCodeEl = document.getElementById("productPreviewCode");
  const productPreviewDescriptionEl = document.getElementById("productPreviewDescription");
  const productPreviewPriceEl = document.getElementById("productPreviewPrice");
  const productPreviewOldPriceEl = document.getElementById("productPreviewOldPrice");
  const productPreviewAddBtn = document.getElementById("productPreviewAddBtn");
  const productPreviewQtyValueEl = document.getElementById("productPreviewQtyValue");
  const mobileProformaBar = document.getElementById("mobileProformaBar");
  const mobileProformaBarCount = document.getElementById("mobileProformaBarCount");
  const mobileProformaSummary = document.getElementById("mobileProformaSummary");
  const proformaDrawer = document.getElementById("proformaDrawer");
  const proformaDrawerBackdrop = document.getElementById("proformaDrawerBackdrop");
  const proformaDrawerCloseBtn = document.getElementById("proformaDrawerCloseBtn");
  const proformaDrawerKeepShoppingBtn = document.getElementById("proformaDrawerKeepShoppingBtn");
  const proformaDrawerItems = document.getElementById("proformaDrawerItems");
  const proformaDrawerSubtotal = document.getElementById("proformaDrawerSubtotal");
  const navCartLinks = Array.from(document.querySelectorAll(".nav-cart-link"));
  const storeHeroEl = document.querySelector(".store-hero");
  let currentView = localStorage.getItem(CATALOG_VIEW_KEY) === "list" ? "list" : "grid";
  let productPreviewModalInstance = null;
  let promoCarouselInstance = null;
  let lastPromoItemsPerSlide = window.matchMedia(MOBILE_PROMO_BREAKPOINT).matches ? 1 : 3;
  const CATALOG_FALLBACK_IMAGE = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="#eef5f0"/><stop offset="100%" stop-color="#dceadf"/></linearGradient></defs><rect width="600" height="400" fill="url(#g)"/><rect x="40" y="40" width="520" height="320" rx="22" fill="#f7fbf8" stroke="#bdd8c7" stroke-width="3"/><circle cx="210" cy="170" r="42" fill="#cfe5d7"/><path d="M108 292l110-98 78 70 68-60 128 88H108z" fill="#b6d7c3"/><text x="300" y="340" text-anchor="middle" font-size="24" font-family="Arial, sans-serif" fill="#4f7060">Imagen no disponible</text></svg>'
  )}`;
  const marketPriorityIndexMap = buildMarketPriorityIndexMap(MARKET_PRIORITY_SOURCE);

  function isCatalogDrawerViewport() {
    return window.matchMedia("(max-width: 991.98px)").matches;
  }

  function bindCatalogNavObserver() {
    document.body.classList.remove("catalog-nav-compact");
    if (!storeHeroEl || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      const compact = Boolean(entry && !entry.isIntersecting);
      document.body.classList.toggle("catalog-nav-compact", compact);
    }, {
      root: null,
      threshold: 0,
      rootMargin: "-86px 0px 0px 0px"
    });

    observer.observe(storeHeroEl);
  }

  function isCompactCatalogViewport() {
    return window.matchMedia("(max-width: 767.98px)").matches;
  }

  function isNarrowCatalogViewport() {
    return window.matchMedia("(max-width: 420px)").matches;
  }

  function getCatalogLayoutSignature() {
    return [
      isCompactCatalogViewport() ? "compact" : "wide",
      isNarrowCatalogViewport() ? "narrow" : "regular",
      getResolvedCatalogView()
    ].join("|");
  }

  function getResolvedCatalogView() {
    return isCompactCatalogViewport() ? "grid" : currentView;
  }

  function lockCatalogBodyScroll() {
    if (document.body.classList.contains("catalog-body-locked")) return;
    lockedBodyScrollY = window.scrollY || window.pageYOffset || 0;
    document.body.style.top = `-${lockedBodyScrollY}px`;
    document.body.style.width = "100%";
    document.body.classList.add("catalog-body-locked");
  }

  function unlockCatalogBodyScroll() {
    if (!document.body.classList.contains("catalog-body-locked")) return;
    const restoreY = lockedBodyScrollY;
    const root = document.documentElement;
    const previousRootScrollBehavior = root.style.scrollBehavior;
    const previousBodyScrollBehavior = document.body.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    document.body.style.scrollBehavior = "auto";
    document.body.classList.remove("catalog-body-locked");
    document.body.style.top = "";
    document.body.style.width = "";
    window.scrollTo(0, restoreY);
    root.style.scrollBehavior = previousRootScrollBehavior;
    document.body.style.scrollBehavior = previousBodyScrollBehavior;
  }

  function setMobileCatalogDrawer(open) {
    const shouldOpen = isCatalogDrawerViewport() && Boolean(open);
    document.body.classList.toggle("catalog-mobile-open", shouldOpen);
    if (shouldOpen) {
      lockCatalogBodyScroll();
    } else {
      unlockCatalogBodyScroll();
    }

    if (catalogMobileToggleBtn) {
      catalogMobileToggleBtn.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
      catalogMobileToggleBtn.setAttribute("aria-label", shouldOpen ? "Ocultar categorias" : "Mostrar categorias");
    }

    if (catalogMobileFilterChipBtn) {
      catalogMobileFilterChipBtn.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
      catalogMobileFilterChipBtn.setAttribute("aria-label", shouldOpen ? "Cerrar categorias" : "Abrir categorias");
    }

    if (catalogMobileBackdrop) {
      catalogMobileBackdrop.setAttribute("aria-hidden", shouldOpen ? "false" : "true");
    }

    if (shouldOpen && catalogMobileCloseBtn) {
      window.setTimeout(() => {
        catalogMobileCloseBtn.focus({ preventScroll: true });
      }, 120);
    }
  }

  function closeMobileCatalogDrawer() {
    setMobileCatalogDrawer(false);
    const returnTarget = catalogMobileFilterChipBtn || catalogMobileToggleBtn;
    if (returnTarget) {
      window.setTimeout(() => {
        returnTarget.focus({ preventScroll: true });
      }, 80);
    }
  }

  function setProformaDrawer(open) {
    if (!proformaDrawer) return;
    const shouldOpen = Boolean(open);
    if (shouldOpen) closeMobileCatalogDrawer();
    document.body.classList.toggle("proforma-drawer-open", shouldOpen);
    proformaDrawer.classList.toggle("is-open", shouldOpen);
    proformaDrawer.setAttribute("aria-hidden", shouldOpen ? "false" : "true");
    if (proformaDrawerBackdrop) {
      proformaDrawerBackdrop.setAttribute("aria-hidden", shouldOpen ? "false" : "true");
    }
    if (shouldOpen) {
      lockCatalogBodyScroll();
      renderProformaDrawer(true);
      window.setTimeout(() => {
        if (proformaDrawerCloseBtn) proformaDrawerCloseBtn.focus({ preventScroll: true });
      }, 120);
      return;
    }
    unlockCatalogBodyScroll();
  }

  function openProformaDrawer() {
    const session = getSession();
    if (!session || !session.email) {
      showBottomNotice("Necesitas iniciar sesion para ver tu proforma.");
      return;
    }
    if (!isCustomerSession(session)) {
      showBottomNotice("La proforma esta disponible solo para clientes.");
      return;
    }
    setProformaDrawer(true);
  }

  function closeProformaDrawer() {
    setProformaDrawer(false);
  }

  function toggleMobileCatalogDrawer() {
    const isOpen = document.body.classList.contains("catalog-mobile-open");
    setMobileCatalogDrawer(!isOpen);
  }

  function clearDrawerTipTimer() {
    if (!drawerTipTimer) return;
    clearTimeout(drawerTipTimer);
    drawerTipTimer = null;
  }

  function getDrawerTipStateKey() {
    const session = getSession();
    return session && session.email ? "auth" : "guest";
  }

  function getDrawerTipStorageKey() {
    return `${DRAWER_TIP_KEY_PREFIX}${getDrawerTipStateKey()}`;
  }

  function markDrawerTipSeen() {
    clearDrawerTipTimer();
    try {
      localStorage.setItem(getDrawerTipStorageKey(), "1");
    } catch (error) {
      // Ignore storage errors and just hide the hint.
    }
    document.body.classList.remove("catalog-tip-visible");
  }

  function maybeShowDrawerTip() {
    clearDrawerTipTimer();

    if (!isCatalogDrawerViewport() || document.body.classList.contains("catalog-search-mode")) {
      document.body.classList.remove("catalog-tip-visible");
      return;
    }

    let alreadySeen = false;
    try {
      alreadySeen = localStorage.getItem(getDrawerTipStorageKey()) === "1";
    } catch (error) {
      alreadySeen = false;
    }

    if (alreadySeen) {
      document.body.classList.remove("catalog-tip-visible");
      return;
    }

    document.body.classList.add("catalog-tip-visible");
    drawerTipTimer = setTimeout(() => {
      markDrawerTipSeen();
    }, 5200);
  }

  function refreshCatalogSnapshot() {
    catalogData = catalogApi.getCatalogData();
    defaultPromoMap = catalogApi.buildDefaultPromoMap(catalogData);
  }

  function applyCatalogView() {
    if (!gridEl) return;
    const resolvedView = getResolvedCatalogView();
    const mobileView = isCompactCatalogViewport();

    gridEl.classList.toggle("catalog-grid-list", resolvedView === "list");
    if (catalogViewGridBtn) {
      catalogViewGridBtn.classList.toggle("active", resolvedView === "grid");
      catalogViewGridBtn.classList.toggle("w-100", mobileView);
    }
    if (catalogViewListBtn) {
      catalogViewListBtn.classList.toggle("active", resolvedView === "list");
      catalogViewListBtn.classList.toggle("d-none", mobileView);
    }
  }

  function setCatalogView(nextView) {
    if (isCompactCatalogViewport()) {
      currentView = "grid";
      applyCatalogView();
      renderCatalog();
      return;
    }

    const safeView = nextView === "list" ? "list" : "grid";
    if (currentView === safeView) return;
    currentView = safeView;
    localStorage.setItem(CATALOG_VIEW_KEY, currentView);
    applyCatalogView();
    renderCatalog();
  }

  function normalizeSearchText(text) {
    return String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeCatalogCode(value) {
    return String(value || "").trim().toUpperCase();
  }

  function buildMarketPriorityIndexMap(source) {
    const entries = source && typeof source === "object" ? Object.entries(source) : [];
    return entries.reduce((acc, [categoryKey, codes]) => {
      if (!Array.isArray(codes) || !codes.length) return acc;
      const bucket = {};
      codes.forEach((code, index) => {
        const safeCode = normalizeCatalogCode(code);
        if (!safeCode || Object.prototype.hasOwnProperty.call(bucket, safeCode)) return;
        bucket[safeCode] = index;
      });
      if (Object.keys(bucket).length) acc[String(categoryKey || "").trim()] = bucket;
      return acc;
    }, {});
  }

  function dedupeCatalogItems(items) {
    const seenCodes = new Set();
    return (Array.isArray(items) ? items : []).filter((item) => {
      const safeCode = normalizeCatalogCode(item && item.code);
      if (!safeCode || seenCodes.has(safeCode)) return false;
      seenCodes.add(safeCode);
      return true;
    });
  }

  function getItemMarketPriorityIndex(item) {
    const categoryKey = String(item && item.categoryKey ? item.categoryKey : "").trim();
    const safeCode = normalizeCatalogCode(item && item.code);
    const categoryMap = categoryKey ? marketPriorityIndexMap[categoryKey] : null;
    if (!categoryMap || !safeCode || !Object.prototype.hasOwnProperty.call(categoryMap, safeCode)) {
      return Number.POSITIVE_INFINITY;
    }
    return categoryMap[safeCode];
  }

  function sortCatalogItemsByMarketPriority(items) {
    return dedupeCatalogItems(items)
      .map((item, index) => ({
        item,
        index,
        priorityIndex: getItemMarketPriorityIndex(item)
      }))
      .sort((a, b) => {
        if (a.priorityIndex !== b.priorityIndex) return a.priorityIndex - b.priorityIndex;
        return a.index - b.index;
      })
      .map((entry) => entry.item);
  }

  function slugifyCatalogLabel(value, fallback = "catalogo-general") {
    const normalized = normalizeSearchText(value)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    return normalized || fallback;
  }

  function buildMergedCategorySelectionKey(parentKey, childLabel) {
    return `${MERGED_CATEGORY_PREFIX}${parentKey}::${slugifyCatalogLabel(childLabel, "grupo")}`;
  }

  function buildParentCategorySelectionKey(parentKey) {
    return `parent-category::${parentKey}`;
  }

  function getCategoryButtons() {
    return Array.from(document.querySelectorAll(".catalog-btn"));
  }

  function getCatalogGroupToggles() {
    return Array.from(document.querySelectorAll("[data-group-toggle]"));
  }

  function parseCatalogSourceMeta(item, categoryLabel) {
    const description = String(item && item.description ? item.description : "").trim();
    const fallbackLabel = String(categoryLabel || "").trim();
    const metadata = {
      unit: "",
      sourceCategory: "",
      sourceSubcategory: "",
      extraParts: []
    };

    description
      .split("|")
      .map((part) => String(part || "").replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .forEach((part) => {
        const match = part.match(/^([^:]+):\s*(.+)$/);
        if (!match) {
          metadata.extraParts.push(part);
          return;
        }

        const rawKey = normalizeSearchText(match[1]);
        const rawValue = String(match[2] || "").replace(/\s+/g, " ").trim();
        if (!rawValue) return;

        if (rawKey === "um") {
          metadata.unit = rawValue;
          return;
        }
        if (rawKey === "categoria origen" || rawKey === "categoria") {
          metadata.sourceCategory = rawValue;
          return;
        }
        if (rawKey === "subcategoria origen" || rawKey === "subcategoria") {
          metadata.sourceSubcategory = rawValue;
          return;
        }

        metadata.extraParts.push(`${String(match[1]).trim()}: ${rawValue}`);
      });

    return {
      parentLabel: metadata.sourceCategory || fallbackLabel || "Catalogo",
      childLabel: metadata.sourceSubcategory || fallbackLabel || metadata.sourceCategory || "Catalogo",
      unit: metadata.unit,
      extraParts: metadata.extraParts
    };
  }

  function buildCatalogDisplayCategoryLabel(sourceMeta, fallbackLabel = "") {
    const parentLabel = String(sourceMeta && sourceMeta.parentLabel ? sourceMeta.parentLabel : "").trim();
    const childLabel = String(sourceMeta && sourceMeta.childLabel ? sourceMeta.childLabel : "").trim();
    const baseLabel = String(fallbackLabel || "").trim();

    if (parentLabel && childLabel && normalizeSearchText(parentLabel) !== normalizeSearchText(childLabel)) {
      return `${parentLabel} / ${childLabel}`;
    }

    return childLabel || parentLabel || baseLabel || "Catalogo";
  }

  function getCatalogSummary() {
    const activeItems = getGlobalCatalogItems();
    const sidebarGroups = buildCatalogSidebarGroups({ applyFilter: false });

    return {
      totalItems: activeItems.length,
      totalGroups: sidebarGroups.length,
      totalSubcategories: sidebarGroups.reduce((acc, group) => acc + group.children.length, 0)
    };
  }

  function renderCatalogHeroStats() {
    if (!storeHeroStatsEl) return;
    const summary = getCatalogSummary();
    storeHeroStatsEl.innerHTML = `
      <span class="store-hero-stat-pill">${summary.totalItems} productos activos</span>
      <span class="store-hero-stat-pill">${summary.totalGroups} categorias base</span>
      <span class="store-hero-stat-pill">${summary.totalSubcategories} subcategorias visibles</span>
    `;
  }

  function buildCatalogSidebarGroups(options = {}) {
    const groups = new Map();
    const applyFilter = options && Object.prototype.hasOwnProperty.call(options, "applyFilter")
      ? Boolean(options.applyFilter)
      : true;
    const normalizedFilter = normalizeSearchText(currentCategoryFilter);

    getGlobalCatalogItems().forEach((item) => {
      const sourceMeta = parseCatalogSourceMeta(item, item.categoryLabel);
      const parentLabel = sourceMeta.parentLabel || item.categoryLabel || "Catalogo";
      const childLabel = sourceMeta.childLabel || item.categoryLabel || parentLabel;
      const parentKey = slugifyCatalogLabel(parentLabel, item.categoryKey || "catalogo");
      const normalizedChildLabel = normalizeSearchText(childLabel);

      let group = groups.get(parentKey);
      if (!group) {
        group = {
          key: parentKey,
          selectionKey: buildParentCategorySelectionKey(parentKey),
          label: parentLabel,
          itemCodes: [],
          categoryKeys: [],
          children: [],
          childMap: new Map()
        };
        groups.set(parentKey, group);
      }

      let child = group.childMap.get(normalizedChildLabel);
      if (!child) {
        child = {
          selectionKey: buildMergedCategorySelectionKey(parentKey, childLabel),
          label: childLabel,
          count: 0,
          itemCodes: [],
          categoryKeys: []
        };
        group.childMap.set(normalizedChildLabel, child);
        group.children.push(child);
      }

      child.count += 1;
      if (item.code && !child.itemCodes.includes(item.code)) {
        child.itemCodes.push(item.code);
      }
      if (item.categoryKey && !child.categoryKeys.includes(item.categoryKey)) {
        child.categoryKeys.push(item.categoryKey);
      }
      if (item.code && !group.itemCodes.includes(item.code)) {
        group.itemCodes.push(item.code);
      }
      if (item.categoryKey && !group.categoryKeys.includes(item.categoryKey)) {
        group.categoryKeys.push(item.categoryKey);
      }
    });

    return Array.from(groups.values())
      .map((group) => ({
        key: group.key,
        selectionKey: group.selectionKey,
        label: group.label,
        itemCodes: group.itemCodes.slice(),
        categoryKeys: group.categoryKeys.slice(),
        children: group.children
          .sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }))
          .filter((child) => {
            if (!applyFilter) return true;
            if (!normalizedFilter) return true;
            const searchable = normalizeSearchText(`${group.label} ${child.label}`);
            return searchable.includes(normalizedFilter);
          })
      }))
      .filter((group) => {
        if (!applyFilter) return true;
        if (!normalizedFilter) return true;
        if (group.children.length) return true;
        return normalizeSearchText(group.label).includes(normalizedFilter);
      })
      .sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }));
  }

  function getCatalogSelection(groups, selectionKey) {
    const sourceGroups = Array.isArray(groups) ? groups : buildCatalogSidebarGroups({ applyFilter: false });
    for (let index = 0; index < sourceGroups.length; index += 1) {
      const group = sourceGroups[index];
      if (group.selectionKey === selectionKey) {
        return {
          key: group.selectionKey,
          label: group.label,
          parentLabel: group.label,
          itemCodes: Array.isArray(group.itemCodes) ? group.itemCodes.slice() : [],
          categoryKeys: Array.isArray(group.categoryKeys) ? group.categoryKeys.slice() : []
        };
      }
      const child = Array.isArray(group.children)
        ? group.children.find((entry) => entry.selectionKey === selectionKey)
        : null;
      if (child) {
        return {
          key: child.selectionKey,
          label: child.label,
          parentLabel: group.label,
          itemCodes: Array.isArray(child.itemCodes) ? child.itemCodes.slice() : [],
          categoryKeys: Array.isArray(child.categoryKeys) ? child.categoryKeys.slice() : []
        };
      }
    }
    return null;
  }

  function getConfiguredItemsForSelection(selection) {
    if (!selection) return [];
    const itemCodes = Array.isArray(selection.itemCodes) ? selection.itemCodes.filter(Boolean) : [];
    if (!itemCodes.length) return [];
    const codeSet = new Set(itemCodes);
    return sortCatalogItemsByMarketPriority(
      getGlobalCatalogItems().filter((item) => codeSet.has(item.code))
    );
  }

  function getConfiguredItemsForCategoryKeys(categoryKeys, configMap) {
    const keys = Array.isArray(categoryKeys) ? categoryKeys : [];
    const map = configMap || getConfigMap();
    return sortCatalogItemsByMarketPriority(
      keys.flatMap((categoryKey) => getConfiguredCategoryItems(categoryKey, map))
    );
  }

  function renderCatalogSidebar(prebuiltGroups = null) {
    if (allProductsButton) {
      allProductsButton.textContent = `Todos los productos (${getGlobalCatalogItems().length})`;
      allProductsButton.classList.toggle("active", currentCategory === ALL_PRODUCTS_CATEGORY);
    }
    if (!catalogSidebarGroupsEl) return;

    const groups = Array.isArray(prebuiltGroups) ? prebuiltGroups : buildCatalogSidebarGroups();
    const sidebarSignature = JSON.stringify(groups.map((group) => [
      group.key,
      group.label,
      group.children.map((child) => [child.selectionKey, child.label, child.count])
    ]));
    if (lastSidebarSignature === sidebarSignature && catalogSidebarGroupsEl.children.length) {
      syncCatalogSidebarState(groups);
      return;
    }

    catalogSidebarGroupsEl.innerHTML = groups
      .map((group) => {
        const hasActiveChild = group.children.some((child) => child.selectionKey === currentCategory);
        const shouldOpen = currentCategory === group.selectionKey || hasActiveChild;
        return `
          <section class="catalog-group ${shouldOpen ? "is-open" : ""}" data-group="${escapeHtml(group.key)}">
            <button type="button" class="catalog-group-toggle${currentCategory === group.selectionKey ? " active" : ""}" data-group-toggle data-category="${escapeHtml(group.selectionKey)}" aria-expanded="${shouldOpen ? "true" : "false"}">
              <span class="catalog-parent">${escapeHtml(group.label)}</span>
              <span class="catalog-group-caret" aria-hidden="true"></span>
            </button>
            <div class="catalog-group-content">
              ${group.children
                .map((child) => {
                  const isActive = currentCategory === child.selectionKey;
                  const childClass = normalizeSearchText(child.label) !== normalizeSearchText(group.label) ? " child-btn" : "";
                  return `
                    <button class="btn btn-outline-secondary w-100 catalog-btn${childClass}${isActive ? " active" : ""}" data-category="${escapeHtml(child.selectionKey)}">
                      ${escapeHtml(child.label)} (${child.count})
                    </button>
                  `;
                })
                .join("")}
            </div>
          </section>
        `;
      })
      .join("");

    if (!groups.length) {
      catalogSidebarGroupsEl.innerHTML = `
        <div class="catalog-sidebar-empty">
          <strong>Sin coincidencias</strong>
          <span>Prueba con otro nombre de categoria o subcategoria.</span>
        </div>
      `;
      lastSidebarSignature = sidebarSignature;
      return;
    }

    lastSidebarSignature = sidebarSignature;
    syncCatalogSidebarState(groups);
  }

  function syncCatalogSidebarState(prebuiltGroups = null) {
    if (allProductsButton) {
      allProductsButton.textContent = `Todos los productos (${getGlobalCatalogItems().length})`;
      allProductsButton.classList.toggle("active", currentCategory === ALL_PRODUCTS_CATEGORY);
    }
    if (!catalogSidebarGroupsEl) return;
    const groups = Array.isArray(prebuiltGroups) ? prebuiltGroups : buildCatalogSidebarGroups({ applyFilter: false });
    const groupMap = new Map(groups.map((group) => [group.key, group]));
    catalogSidebarGroupsEl.querySelectorAll(".catalog-group").forEach((groupEl) => {
      const group = groupMap.get(String(groupEl.dataset.group || ""));
      if (!group) return;
      const hasActiveChild = group.children.some((child) => child.selectionKey === currentCategory);
      const shouldOpen = currentCategory === group.selectionKey || hasActiveChild;
      groupEl.classList.toggle("is-open", shouldOpen);
      const toggle = groupEl.querySelector("[data-group-toggle]");
      if (toggle) {
        toggle.classList.toggle("active", currentCategory === group.selectionKey);
        toggle.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
      }
      groupEl.querySelectorAll(".catalog-btn").forEach((button) => {
        button.classList.toggle("active", String(button.dataset.category || "") === currentCategory);
      });
    });
  }

  function beginCatalogGridUpdate() {
    if (!gridEl) return;
    const currentHeight = gridEl.offsetHeight;
    if (currentHeight > 80) {
      gridEl.style.minHeight = `${currentHeight}px`;
    }
    gridEl.classList.add("catalog-grid-updating");
    if (catalogGridReleaseTimer) {
      clearTimeout(catalogGridReleaseTimer);
      catalogGridReleaseTimer = null;
    }
  }

  function endCatalogGridUpdate() {
    if (!gridEl) return;
    window.requestAnimationFrame(() => {
      gridEl.classList.remove("catalog-grid-updating");
      catalogGridReleaseTimer = window.setTimeout(() => {
        gridEl.style.minHeight = "";
        catalogGridReleaseTimer = null;
      }, 220);
    });
  }

  function formatPriceValue(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) return "0.00";
    return num.toFixed(2);
  }

  function buildProductDescription(item, fallbackCategoryLabel) {
    const categoryLabel = String(item && item.categoryLabel ? item.categoryLabel : fallbackCategoryLabel || "").trim();
    const sourceMeta = parseCatalogSourceMeta(item, categoryLabel);
    const visibleCategory = buildCatalogDisplayCategoryLabel(sourceMeta, categoryLabel);
    const extraDescription = Array.isArray(sourceMeta.extraParts) ? sourceMeta.extraParts.join(" ") : "";
    if (extraDescription) return extraDescription;

    const categoryText = visibleCategory ? `Categoria: ${visibleCategory}. ` : "";
    const unitText = sourceMeta.unit ? `UM: ${sourceMeta.unit}. ` : "";
    const promoText = item && item.isPromotion
      ? "Cuenta con precio promocional vigente, sujeto a disponibilidad."
      : "Disponible para compra inmediata, sujeto a stock.";
    return `${categoryText}${unitText}Producto recomendado para limpieza en hogar, oficina y negocio. ${promoText}`;
  }

  function renderCatalogImage(image, name) {
    const src = String(image || "").trim();
    const altText = escapeHtml(name || "Producto");
    const resolvedSrc = src || CATALOG_FALLBACK_IMAGE;
    const isKnownLoaded = catalogImageLoadCache.has(resolvedSrc);
    const loadedClass = isKnownLoaded ? " class=\"is-loaded\"" : "";
    const loadHandler = "this.classList.add('is-loaded');if(window.EUREKA_CATALOG_IMAGE_CACHE){window.EUREKA_CATALOG_IMAGE_CACHE.add(this.getAttribute('src')||'');window.EUREKA_CATALOG_IMAGE_CACHE.add(this.currentSrc||this.src)}";
    if (!src) {
      return `<img${loadedClass} src="${CATALOG_FALLBACK_IMAGE}" alt="${altText}" loading="lazy" decoding="async" width="320" height="320" onload="${loadHandler}">`;
    }
    return `<img${loadedClass} src="${escapeHtml(src)}" alt="${altText}" loading="lazy" decoding="async" width="320" height="320" referrerpolicy="no-referrer" onload="${loadHandler}" onerror="this.onerror=null;this.src='${CATALOG_FALLBACK_IMAGE}'">`;
  }

  window.EUREKA_CATALOG_IMAGE_CACHE = catalogImageLoadCache;

  function warmCatalogImages(items) {
    if (!Array.isArray(items) || typeof Image === "undefined") return;
    items.slice(0, 24).forEach((item) => {
      const src = String(item && item.image ? item.image : "").trim();
      if (!src || src.startsWith("data:image/") || catalogImagePreloadCache.has(src)) return;
      const img = new Image();
      img.decoding = "async";
      img.loading = "lazy";
      img.onload = () => catalogImageLoadCache.add(src);
      img.onerror = () => catalogImagePreloadCache.delete(src);
      catalogImagePreloadCache.set(src, img);
      img.src = src;
    });
  }

  function createCatalogNodeFromHtml(html) {
    const template = document.createElement("template");
    template.innerHTML = String(html || "").trim();
    return template.content.firstElementChild;
  }

  function setCatalogGridEntries(entries) {
    if (!gridEl) return;
    const fragment = document.createDocumentFragment();
    (Array.isArray(entries) ? entries : []).forEach((entry) => {
      const key = String(entry && entry.key ? entry.key : "");
      const html = String(entry && entry.html ? entry.html : "");
      if (!key || !html) return;
      let cached = catalogProductNodeCache.get(key);
      if (!cached || cached.html !== html || !cached.node) {
        cached = { html, node: createCatalogNodeFromHtml(html) };
        catalogProductNodeCache.set(key, cached);
      }
      if (cached.node) fragment.appendChild(cached.node);
    });
    gridEl.replaceChildren(fragment);
  }

  function buildPreviewDataAttrs(item, fallbackCategoryLabel) {
    const priceValue = formatPriceValue(item && item.price);
    const originalPriceValue = formatPriceValue(item && item.originalPrice ? item.originalPrice : item && item.price);
    const discountValue = Math.max(0, Number(item && item.discountPct ? item.discountPct : 0) || 0);
    const isPromotion = Boolean(item && item.isPromotion)
      || discountValue > 0
      || Number(originalPriceValue) > Number(priceValue);
    const fallbackLabel = String(item && item.categoryLabel ? item.categoryLabel : fallbackCategoryLabel || "").trim();
    const sourceMeta = parseCatalogSourceMeta(item, fallbackLabel);
    const categoryLabel = buildCatalogDisplayCategoryLabel(sourceMeta, fallbackLabel);
    const description = buildProductDescription(item, fallbackLabel);

    return [
      `data-preview-name="${escapeHtml(item && item.name ? item.name : "")}"`,
      `data-preview-code="${escapeHtml(item && item.code ? item.code : "")}"`,
      `data-preview-image="${escapeHtml(item && item.image ? item.image : "")}"`,
      `data-preview-price="${escapeHtml(priceValue)}"`,
      `data-preview-original-price="${escapeHtml(originalPriceValue)}"`,
      `data-preview-discount-pct="${escapeHtml(discountValue)}"`,
      `data-preview-promo="${isPromotion ? "1" : "0"}"`,
      `data-preview-category="${escapeHtml(categoryLabel)}"`,
      `data-preview-description="${escapeHtml(description)}"`
    ].join(" ");
  }

  function getProductPreviewModal() {
    if (!productPreviewModalEl || !window.bootstrap || !window.bootstrap.Modal) return null;
    if (!productPreviewModalInstance) {
      productPreviewModalInstance = new window.bootstrap.Modal(productPreviewModalEl);
    }
    return productPreviewModalInstance;
  }

  function openProductPreviewFromTrigger(triggerEl) {
    if (!triggerEl || !productPreviewModalEl || !productPreviewAddBtn) return;

    const name = String(triggerEl.dataset.previewName || "").trim();
    const code = String(triggerEl.dataset.previewCode || "").trim();
    const image = String(triggerEl.dataset.previewImage || "").trim();
    const category = String(triggerEl.dataset.previewCategory || "").trim();
    const description = String(triggerEl.dataset.previewDescription || "").trim();
    const price = formatPriceValue(triggerEl.dataset.previewPrice || 0);
    const originalPrice = formatPriceValue(triggerEl.dataset.previewOriginalPrice || price);
    const discountPct = Math.max(0, Number(triggerEl.dataset.previewDiscountPct || 0) || 0);
    const isPromotion = String(triggerEl.dataset.previewPromo || "") === "1"
      || discountPct > 0
      || Number(originalPrice) > Number(price);

    if (productPreviewImageEl) {
      productPreviewImageEl.src = image || CATALOG_FALLBACK_IMAGE;
      productPreviewImageEl.alt = name || "Producto";
      productPreviewImageEl.onerror = () => {
        productPreviewImageEl.onerror = null;
        productPreviewImageEl.src = CATALOG_FALLBACK_IMAGE;
      };
    }

    if (productPreviewCategoryEl) {
      productPreviewCategoryEl.textContent = category || "Catalogo";
    }
    if (productPreviewNameEl) {
      productPreviewNameEl.textContent = name || "Producto";
    }
    if (productPreviewCodeEl) {
      productPreviewCodeEl.textContent = code ? `Codigo: ${code}` : "Codigo no disponible";
    }
    if (productPreviewDescriptionEl) {
      productPreviewDescriptionEl.textContent = description || "Producto disponible para compra inmediata.";
    }
    if (productPreviewPriceEl) {
      productPreviewPriceEl.textContent = `S/. ${price}`;
    }
    if (productPreviewOldPriceEl) {
      if (isPromotion && Number(originalPrice) > Number(price)) {
        productPreviewOldPriceEl.textContent = `Antes: S/. ${originalPrice}`;
        productPreviewOldPriceEl.classList.remove("d-none");
      } else {
        productPreviewOldPriceEl.textContent = "";
        productPreviewOldPriceEl.classList.add("d-none");
      }
    }

    if (productPreviewQtyValueEl) {
      productPreviewQtyValueEl.textContent = "1";
    }

    productPreviewAddBtn.dataset.product = name || "producto";
    productPreviewAddBtn.dataset.code = code || name || "producto";
    productPreviewAddBtn.dataset.price = price;
    productPreviewAddBtn.dataset.image = image;
    productPreviewAddBtn.dataset.originalPrice = originalPrice;
    productPreviewAddBtn.dataset.discountPct = String(discountPct);
    productPreviewAddBtn.dataset.promo = isPromotion ? "1" : "0";

    const modal = getProductPreviewModal();
    if (modal) modal.show();
  }

  function getActivePageSize(searchValue) {
    const isSearch = Boolean(normalizeSearchText(searchValue).length);
    if (isNarrowCatalogViewport()) return isSearch ? 6 : 6;
    if (isCompactCatalogViewport()) return isSearch ? 6 : 6;
    if (getResolvedCatalogView() === "list") return isSearch ? 12 : 12;
    return isSearch ? SEARCH_PAGE_SIZE : DEFAULT_PAGE_SIZE;
  }

  function getSelectionUrlParts() {
    const groups = buildCatalogSidebarGroups({ applyFilter: false });
    for (let index = 0; index < groups.length; index += 1) {
      const group = groups[index];
      if (group.selectionKey === currentCategory) {
        return { categoria: group.key, subcategoria: "" };
      }
      const child = Array.isArray(group.children)
        ? group.children.find((entry) => entry.selectionKey === currentCategory)
        : null;
      if (child) {
        const childSlug = String(child.selectionKey || "").split("::").pop() || "";
        return { categoria: group.key, subcategoria: childSlug };
      }
    }
    return { categoria: "", subcategoria: "" };
  }

  function syncCatalogPageUrl() {
    try {
      const url = new URL(window.location.href);
      const selection = getSelectionUrlParts();
      if (selection.categoria) {
        url.searchParams.set("categoria", selection.categoria);
      } else {
        url.searchParams.delete("categoria");
      }
      if (selection.subcategoria) {
        url.searchParams.set("subcategoria", selection.subcategoria);
      } else {
        url.searchParams.delete("subcategoria");
      }
      if (currentPage > 1) {
        url.searchParams.set("page", String(currentPage));
      } else {
        url.searchParams.delete("page");
      }
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    } catch (error) {
      // URL sync is an enhancement only.
    }
  }

  function updateCatalogSearchMeta(options = {}) {
    const settings = options && typeof options === "object" ? options : {};
    const totalItems = Number(settings.totalItems || 0);
    const visibleStart = Number(settings.visibleStart || 0);
    const visibleEnd = Number(settings.visibleEnd || 0);
    const searchValue = String(settings.searchValue || "").trim();
    const activeLabel = String(settings.activeLabel || "Todo el catalogo").trim() || "Todo el catalogo";

    if (catalogSearchHintEl) {
      catalogSearchHintEl.textContent = searchValue
        ? `Buscando "${searchValue}" dentro de ${activeLabel}.`
        : "";
    }

    if (catalogSearchStatsEl) {
      catalogSearchStatsEl.textContent = totalItems
        ? `Mostrando ${visibleStart}-${visibleEnd} de ${totalItems}`
        : "0 productos visibles";
    }
  }

  function scrollCatalogToTop() {
    const anchorEl = document.querySelector(".catalog-products-col");
    if (!anchorEl) return;

    const navbarEl = document.querySelector(".custom-navbar");
    const navbarHeight = navbarEl ? navbarEl.offsetHeight : 56;
    const y = window.pageYOffset + anchorEl.getBoundingClientRect().top - navbarHeight - 10;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    window.scrollTo({
      top: Math.max(0, y),
      behavior: prefersReducedMotion ? "auto" : "smooth"
    });
  }

  function setCatalogGroupOpen(groupEl, open) {
    if (!groupEl) return;
    const shouldOpen = Boolean(open);
    groupEl.classList.toggle("is-open", shouldOpen);
    const toggle = groupEl.querySelector("[data-group-toggle]");
    if (toggle) toggle.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
  }

  function syncCatalogSearchMode(isActive) {
    const searchMode = Boolean(isActive);
    if (catalogLayoutEl) {
      catalogLayoutEl.classList.toggle("search-mode", searchMode);
    }
    document.body.classList.toggle("catalog-search-mode", searchMode);
    if (searchMode) {
      closeMobileCatalogDrawer();
      markDrawerTipSeen();
    } else {
      maybeShowDrawerTip();
    }

    if (catalogSidebarColEl) {
      catalogSidebarColEl.setAttribute("aria-hidden", searchMode ? "true" : "false");
    }

    getCategoryButtons().forEach((button) => {
      button.disabled = searchMode;
      button.tabIndex = searchMode ? -1 : 0;
    });

    getCatalogGroupToggles().forEach((toggle) => {
      toggle.disabled = searchMode;
      toggle.tabIndex = searchMode ? -1 : 0;
    });
  }

  function getSession() {
    const session = authStore && typeof authStore.getSession === "function"
      ? authStore.getSession()
      : null;
    if (session) return session;
    if (previewStore && previewStore.enabled && typeof previewStore.getSession === "function") {
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

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function getProformaKey(email) {
    return `${PROFORMA_KEY_PREFIX}${normalizeEmail(email)}`;
  }

  function getProformaItems(session) {
    if (!isCustomerSession(session)) return [];

    try {
      const raw = JSON.parse(localStorage.getItem(getProformaKey(session.email)));
      if (!Array.isArray(raw)) return [];

      return raw
        .map((item) => ({
          id: String(item.id || item.code || item.name || "").trim(),
          code: String(item.code || "").trim(),
          name: String(item.name || "").trim(),
          price: Number(item.price || 0),
          qty: Math.max(1, Number(item.qty || 1)),
          image: String(item.image || ""),
          originalPrice: Number(item.originalPrice || 0),
          discountPct: Math.max(0, Number(item.discountPct || 0)),
          isPromotion:
            Boolean(item.isPromotion)
            || Number(item.discountPct || 0) > 0
            || Number(item.originalPrice || 0) > Number(item.price || 0)
        }))
        .filter((item) => item.id && item.name);
    } catch (error) {
      return [];
    }
  }

  function saveProformaItems(session, items) {
    if (!isCustomerSession(session)) return;
    localStorage.setItem(getProformaKey(session.email), JSON.stringify(Array.isArray(items) ? items : []));
    window.dispatchEvent(new CustomEvent("proforma:changed"));
  }

  function formatMoneyLabel(value) {
    return `S/ ${formatPriceValue(value)}`;
  }

  function getProformaSubtotal(items) {
    return (Array.isArray(items) ? items : []).reduce((acc, item) => {
      return acc + (Number(item.price || 0) * Math.max(1, Number(item.qty || 1) || 1));
    }, 0);
  }

  function renderProformaDrawer(force = false) {
    if (!proformaDrawerItems || !proformaDrawerSubtotal) return;
    const session = getSession();
    const isCustomer = isCustomerSession(session);
    const items = isCustomer ? getProformaItems(session) : [];
    const subtotal = getProformaSubtotal(items);
    const drawerSignature = JSON.stringify([
      isCustomer,
      items.map((item) => [
        item.id,
        item.code,
        item.name,
        item.price,
        item.qty,
        item.image,
        item.isPromotion,
        item.originalPrice,
        item.discountPct
      ]),
      subtotal
    ]);

    if (!force && drawerSignature === lastProformaDrawerSignature) return;
    lastProformaDrawerSignature = drawerSignature;
    proformaDrawerSubtotal.textContent = formatMoneyLabel(subtotal);

    if (!isCustomer) {
      proformaDrawerItems.innerHTML = `
        <div class="proforma-drawer-empty">
          <strong>Inicia sesion</strong>
          <span>Tu proforma se guarda por cliente.</span>
        </div>
      `;
      return;
    }

    if (!items.length) {
      proformaDrawerItems.innerHTML = `
        <div class="proforma-drawer-empty">
          <strong>Tu carrito esta vacio</strong>
          <span>Agrega productos del catalogo para armar tu proforma.</span>
        </div>
      `;
      return;
    }

    proformaDrawerItems.innerHTML = items
      .map((item) => {
        const itemId = escapeHtml(item.id || item.code || item.name);
        const image = String(item.image || "").trim();
        const imageSrc = image ? escapeHtml(image) : CATALOG_FALLBACK_IMAGE;
        const qty = Math.max(1, Number(item.qty || 1) || 1);
        const itemTotal = Number(item.price || 0) * qty;
        return `
          <article class="proforma-drawer-item">
            <div class="proforma-drawer-thumb">
              <img src="${imageSrc}" alt="${escapeHtml(item.name)}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${CATALOG_FALLBACK_IMAGE}'">
            </div>
            <div class="proforma-drawer-info">
              <h3>${escapeHtml(item.name)}</h3>
              <span>Precio unidad</span>
              <strong>${formatMoneyLabel(item.price)}</strong>
              ${item.isPromotion && Number(item.originalPrice || 0) > Number(item.price || 0) ? `<small>Antes ${formatMoneyLabel(item.originalPrice)}</small>` : ""}
              <div class="proforma-drawer-qty" aria-label="Cantidad">
                <button type="button" data-drawer-action="decrease" data-id="${itemId}" aria-label="Disminuir cantidad">-</button>
                <span>${qty}</span>
                <button type="button" data-drawer-action="increase" data-id="${itemId}" aria-label="Aumentar cantidad">+</button>
              </div>
            </div>
            <div class="proforma-drawer-side">
              <strong>${formatMoneyLabel(itemTotal)}</strong>
              <button type="button" class="proforma-drawer-remove" data-drawer-action="remove" data-id="${itemId}" aria-label="Eliminar ${escapeHtml(item.name)}">&#128465;</button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function updateProformaDrawerItem(itemId, action) {
    const session = getSession();
    if (!isCustomerSession(session)) return;
    const safeId = String(itemId || "").trim();
    if (!safeId) return;
    const items = getProformaItems(session);
    const nextItems = items
      .map((item) => {
        if (String(item.id || "") !== safeId) return item;
        if (action === "remove") return null;
        const qty = Math.max(1, Number(item.qty || 1) || 1);
        const nextQty = action === "increase" ? Math.min(99, qty + 1) : Math.max(0, qty - 1);
        return nextQty > 0 ? { ...item, qty: nextQty } : null;
      })
      .filter(Boolean);
    saveProformaItems(session, nextItems);
    lastProformaUiSignature = "";
    updateProformaButton();
    renderProformaDrawer(true);
  }

  function updateProformaButton() {
    const session = getSession();
    const isCustomer = isCustomerSession(session);
    const proformaItems = isCustomer ? getProformaItems(session) : [];
    const itemCount = proformaItems.reduce((acc, item) => acc + Number(item.qty || 0), 0);
    const shouldShowMobileBar = isCustomer && isCompactCatalogViewport() && itemCount > 0;
    const uiSignature = JSON.stringify([isCustomer, itemCount, shouldShowMobileBar]);
    renderProformaDrawer();
    if (uiSignature === lastProformaUiSignature) return;
    lastProformaUiSignature = uiSignature;

    if (proformaLinkBtn) proformaLinkBtn.classList.toggle("d-none", !isCustomer);

    if (!isCustomer) {
      if (proformaCountBadge) proformaCountBadge.textContent = "0";
      if (mobileProformaBarCount) mobileProformaBarCount.textContent = "0";
      if (mobileProformaSummary) mobileProformaSummary.textContent = "0 productos agregados";
      if (mobileProformaBar) mobileProformaBar.classList.add("d-none");
      document.body.classList.remove("catalog-has-mobile-proforma");
      return;
    }

    if (proformaCountBadge) proformaCountBadge.textContent = String(itemCount);
    if (mobileProformaBarCount) mobileProformaBarCount.textContent = String(itemCount);
    if (mobileProformaSummary) {
      mobileProformaSummary.textContent = itemCount > 0
        ? `${formatItemLabel(itemCount)} agregados`
        : "Agrega productos para cotizar rapido";
    }

    if (mobileProformaBar) mobileProformaBar.classList.toggle("d-none", !shouldShowMobileBar);
    document.body.classList.toggle("catalog-has-mobile-proforma", shouldShowMobileBar);
  }

  function replayAnimationClass(element, className) {
    if (!element || !className) return;
    element.classList.remove(className);
    // Force reflow so repeated clicks replay the animation.
    void element.offsetWidth;
    element.classList.add(className);
  }

  function animateAddButton(button) {
    replayAnimationClass(button, "is-adding");
  }

  function animateProformaBadge() {
    if (!proformaCountBadge) return;
    if (proformaLinkBtn && proformaLinkBtn.classList.contains("d-none")) return;
    replayAnimationClass(proformaCountBadge, "is-bump");
  }

  function showBottomNotice(message) {
    if (!bottomNoticeEl) return;
    if (bottomNoticeTimer) clearTimeout(bottomNoticeTimer);
    bottomNoticeEl.textContent = message;
    bottomNoticeEl.classList.add("show");
    bottomNoticeTimer = setTimeout(() => {
      bottomNoticeEl.classList.remove("show");
      bottomNoticeTimer = null;
    }, 1400);
  }

  function formatItemLabel(count) {
    const safeCount = Math.max(0, Number(count || 0) || 0);
    return `${safeCount} ${safeCount === 1 ? "producto" : "productos"}`;
  }

  function updateMobileCatalogSummary(activeLabel, summaryLabel) {
    if (catalogMobileActiveLabel) {
      catalogMobileActiveLabel.textContent = String(activeLabel || "Catalogo");
    }
    if (catalogMobileRangeLabel) {
      catalogMobileRangeLabel.textContent = String(summaryLabel || "0 productos");
    }
  }

  function getConfigMap() {
    return catalogApi.getCatalogConfigMap();
  }

  function getConfiguredCategoryItems(categoryKey, configMap) {
    const category = catalogData[categoryKey];
    if (!category) return [];
    const map = configMap || getConfigMap();
    return sortCatalogItemsByMarketPriority(
      category.items
        .map((item) => catalogApi.applyConfigToItem(item, map, defaultPromoMap))
        .filter((item) => item.active)
        .map((item) => ({
          ...item,
          categoryKey
        }))
    );
  }

  function getGlobalCatalogItems() {
    const map = getConfigMap();
    const allItems = [];

    Object.entries(catalogData).forEach(([categoryKey, categoryData]) => {
      categoryData.items.forEach((item) => {
        const configured = catalogApi.applyConfigToItem(item, map, defaultPromoMap);
        if (!configured.active) return;
        const sourceMeta = parseCatalogSourceMeta(configured, categoryData.label);
        if (requestedParentCategory && slugifyCatalogLabel(sourceMeta.parentLabel, categoryKey) !== requestedParentCategory) return;
        allItems.push({
          ...configured,
          categoryKey,
          categoryLabel: categoryData.label
        });
      });
    });

    return allItems;
  }

  function getFilteredItems(items, query) {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return items;

    return items.filter((item) => {
      const sourceMeta = parseCatalogSourceMeta(item, item.categoryLabel);
      const searchable = normalizeSearchText([
        item.name,
        item.code,
        item.categoryLabel,
        sourceMeta.parentLabel,
        sourceMeta.childLabel,
        item.description
      ].join(" "));
      return searchable.includes(normalizedQuery);
    });
  }

  function buildPromoItems() {
    return getGlobalCatalogItems()
      .filter((item) => item.isPromotion)
      .sort((a, b) => Number(b.discountPct || 0) - Number(a.discountPct || 0))
      .slice(0, 12);
  }

  function chunkItems(items, chunkSize) {
    const chunks = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
  }

  function getPromoItemsPerSlide() {
    return window.matchMedia(MOBILE_PROMO_BREAKPOINT).matches ? 1 : 3;
  }

  function syncPromoCarouselInstance() {
    if (!promoCarouselEl || !window.bootstrap || !window.bootstrap.Carousel) return;
    promoCarouselInstance = window.bootstrap.Carousel.getOrCreateInstance(promoCarouselEl, {
      interval: false,
      touch: true,
      wrap: true
    });
    promoCarouselInstance.pause();
  }

  function togglePromoControls(show) {
    if (promoPrevControl) promoPrevControl.classList.toggle("d-none", !show);
    if (promoNextControl) promoNextControl.classList.toggle("d-none", !show);
  }

  function renderPromoCarousel() {
    if (!promoCountBadge || !promoInner || !promoIndicators) return;
    refreshCatalogSnapshot();

    const promoItems = buildPromoItems();
    promoCountBadge.textContent = `${promoItems.length} items`;

    if (!promoItems.length) {
      promoIndicators.innerHTML = "";
      promoInner.innerHTML = `
        <div class="carousel-item active">
          <div class="catalog-empty">No hay promociones activas por ahora.</div>
        </div>
      `;
      togglePromoControls(false);
      return;
    }

    const slides = chunkItems(promoItems, getPromoItemsPerSlide());
    togglePromoControls(slides.length > 1);

    promoIndicators.innerHTML = slides
      .map((_, index) => `
        <button
          type="button"
          data-bs-target="#promoCarousel"
          data-bs-slide-to="${index}"
          class="${index === 0 ? "active" : ""}"
          ${index === 0 ? 'aria-current="true"' : ""}
          aria-label="Promocion ${index + 1}"
        ></button>
      `)
      .join("");

    promoInner.innerHTML = slides
      .map((slideItems, slideIndex) => `
        <div class="carousel-item ${slideIndex === 0 ? "active" : ""}">
          <div class="row g-3">
            ${slideItems
              .map((item) => `
                <div class="col-md-4">
                  <article class="promo-card h-100 product-preview-trigger" ${buildPreviewDataAttrs(item, item.categoryLabel)}>
                    <div class="promo-thumb${item.image ? "" : " placeholder"}">
                      ${renderCatalogImage(item.image, item.name)}
                    </div>
                    <div class="promo-body">
                      <h5 class="promo-name">${escapeHtml(item.name)}</h5>
                      <p class="promo-description">${escapeHtml(buildProductDescription(item, item.categoryLabel))}</p>
                      <div class="promo-meta-row">
                        <p class="promo-category">${escapeHtml(buildCatalogDisplayCategoryLabel(parseCatalogSourceMeta(item, item.categoryLabel), item.categoryLabel))}</p>
                        <span class="promo-discount">-${item.discountPct}%</span>
                      </div>
                      <p class="promo-code">${escapeHtml(item.code)}</p>
                      <p class="promo-price-row">
                        <strong class="promo-new-price">S/. ${item.price}</strong>
                        <span class="promo-old-price">Antes: S/. ${item.originalPrice}</span>
                      </p>
                    </div>
                    <div class="add-proforma-actions">
                      <div class="add-qty-picker" aria-label="Cantidad a agregar">
                        <button type="button" class="add-qty-btn" data-action="dec-add-qty" aria-label="Disminuir cantidad">-</button>
                        <span class="add-qty-value" aria-live="polite">1</span>
                        <button type="button" class="add-qty-btn" data-action="inc-add-qty" aria-label="Aumentar cantidad">+</button>
                      </div>
                      <button
                        class="btn btn-sm w-100 add-proforma-btn"
                        data-product="${escapeHtml(item.name)}"
                        data-code="${escapeHtml(item.code)}"
                        data-price="${item.price}"
                        data-image="${escapeHtml(item.image || "")}"
                        data-original-price="${item.originalPrice || item.price}"
                        data-discount-pct="${item.discountPct || 0}"
                        data-promo="1"
                      >
                        Agregar
                      </button>
                    </div>
                  </article>
                </div>
              `)
              .join("")}
          </div>
        </div>
      `)
      .join("");

    syncPromoCarouselInstance();
  }

  function renderPagination(totalPages) {
    if (!paginationEl && !paginationTopEl) return;

    if (totalPages <= 1) {
      if (paginationEl) paginationEl.innerHTML = "";
      if (paginationTopEl) paginationTopEl.innerHTML = "";
      return;
    }

    let html = `
      <li class="page-item ${currentPage === 1 ? "disabled" : ""}">
        <button class="page-link" data-page="${currentPage - 1}" aria-label="Anterior">&lt;</button>
      </li>
    `;

    const pages = [];
    if (totalPages <= 7) {
      for (let page = 1; page <= totalPages; page += 1) pages.push(page);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      const startPage = Math.max(2, currentPage - 1);
      const endPage = Math.min(totalPages - 1, currentPage + 1);
      for (let page = startPage; page <= endPage; page += 1) pages.push(page);
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }

    pages.forEach((page) => {
      if (page === "...") {
        html += `
          <li class="page-item disabled">
            <span class="page-link">...</span>
          </li>
        `;
        return;
      }
      html += `
        <li class="page-item ${currentPage === page ? "active" : ""}">
          <button class="page-link" data-page="${page}">${page}</button>
        </li>
      `;
    });

    html += `
      <li class="page-item ${currentPage === totalPages ? "disabled" : ""}">
        <button class="page-link" data-page="${currentPage + 1}" aria-label="Siguiente">&gt;</button>
      </li>
    `;

    if (paginationEl) paginationEl.innerHTML = html;
    if (paginationTopEl) paginationTopEl.innerHTML = html;
  }

  function renderCatalog() {
    if (!titleEl || !subtitleEl || !gridEl) return;
    refreshCatalogSnapshot();
    renderCatalogHeroStats();
    const allSidebarGroups = buildCatalogSidebarGroups({ applyFilter: false });
    if (requestedParentCategory && !requestedSubcategory && !requestedParentCategoryApplied) {
      const requestedGroup = allSidebarGroups.find((group) => group.key === requestedParentCategory);
      if (requestedGroup && requestedGroup.selectionKey) {
        currentCategory = requestedGroup.selectionKey;
        requestedParentCategoryApplied = true;
      }
    }
    if (requestedSubcategory && !requestedSubcategoryApplied) {
      const requestedSelection = allSidebarGroups
        .flatMap((group) => group.children)
        .find((child) => child.selectionKey.endsWith(`::${requestedSubcategory}`));
      if (requestedSelection) {
        currentCategory = requestedSelection.selectionKey;
        requestedSubcategoryApplied = true;
      }
    }
    const currentSelection = currentCategory === ALL_PRODUCTS_CATEGORY
      ? null
      : getCatalogSelection(allSidebarGroups, currentCategory);
    if (currentCategory !== ALL_PRODUCTS_CATEGORY && !currentSelection) {
      currentCategory = ALL_PRODUCTS_CATEGORY;
    }
    renderCatalogSidebar(buildCatalogSidebarGroups());

    const isAllProductsCategory = currentCategory === ALL_PRODUCTS_CATEGORY;
    const resolvedSelection = currentCategory === ALL_PRODUCTS_CATEGORY
      ? null
      : getCatalogSelection(allSidebarGroups, currentCategory);
    const resolvedSelectionLabel = resolvedSelection
      ? buildCatalogDisplayCategoryLabel({
        parentLabel: resolvedSelection.parentLabel,
        childLabel: resolvedSelection.label
      }, resolvedSelection.label)
      : "";
    const categoryData = resolvedSelection
      ? { label: resolvedSelectionLabel, items: [] }
      : (catalogData[currentCategory] || { label: "Catalogo", items: [] });
    const showCodes = isAdminSession(getSession());
    const normalizedSearch = normalizeSearchText(currentSearch);
    const isGlobalSearch = Boolean(normalizedSearch);
    const activePageSize = getActivePageSize(currentSearch);
    syncCatalogSearchMode(isGlobalSearch);
    const categoryItems = isAllProductsCategory
      ? getGlobalCatalogItems()
      : getConfiguredItemsForSelection(resolvedSelection);
    const sourceItems = isGlobalSearch
      ? getGlobalCatalogItems()
      : categoryItems;
    const filteredItems = getFilteredItems(sourceItems, currentSearch);
    const totalPages = Math.max(1, Math.ceil(filteredItems.length / activePageSize));
    if (!requestedPageApplied && filteredItems.length) {
      currentPage = Math.min(Math.max(1, requestedPage), totalPages);
      requestedPageApplied = true;
    }
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * activePageSize;
    const paginatedItems = filteredItems.slice(start, start + activePageSize);
    const warmStart = Math.max(0, start - activePageSize);
    const warmEnd = Math.min(filteredItems.length, start + activePageSize * 2);
    warmCatalogImages(filteredItems.slice(warmStart, warmEnd));
    const visibleStart = filteredItems.length ? start + 1 : 0;
    const visibleEnd = filteredItems.length ? Math.min(start + activePageSize, filteredItems.length) : 0;

    titleEl.textContent = isGlobalSearch
      ? "Resultados globales"
      : (isAllProductsCategory ? "Todos los productos" : categoryData.label);

    const selectedParent = allSidebarGroups[0];
    if (requestedParentCategory && selectedParent && storeHeroEl) {
      const heroTitle = storeHeroEl.querySelector(".store-hero-title");
      const heroText = storeHeroEl.querySelector(".store-hero-text");
      if (heroTitle) heroTitle.textContent = selectedParent.label;
      if (heroText) heroText.textContent = `Explora las subcategorias y productos disponibles en ${selectedParent.label}.`;
    }

    const mobileActiveLabel = isGlobalSearch
      ? `Busqueda: ${currentSearch}`
      : (isAllProductsCategory ? "Todo el catalogo" : categoryData.label);
    const mobileRangeCopy = filteredItems.length
      ? `Mostrando ${visibleStart}-${visibleEnd} de ${filteredItems.length}`
      : "0 productos disponibles";
    updateMobileCatalogSummary(mobileActiveLabel, mobileRangeCopy);
    updateCatalogSearchMeta({
      totalItems: filteredItems.length,
      visibleStart,
      visibleEnd,
      searchValue: currentSearch,
      activeLabel: isAllProductsCategory ? "Todo el catalogo" : categoryData.label
    });

    beginCatalogGridUpdate();

    if (!filteredItems.length) {
      subtitleEl.textContent = isGlobalSearch
        ? `0 items encontrados para "${currentSearch}" en todo el catalogo`
        : `0 items encontrados para "${currentSearch}"`;
      updateMobileCatalogSummary(mobileActiveLabel, "Sin resultados por ahora");
      gridEl.innerHTML = `
        <div class="col-12">
          <div class="catalog-empty">
            <strong>No encontramos coincidencias</strong>
            <span>Prueba con otro nombre, codigo o vuelve a una categoria distinta.</span>
          </div>
        </div>
      `;
      if (paginationEl) paginationEl.innerHTML = "";
      if (paginationTopEl) paginationTopEl.innerHTML = "";
      endCatalogGridUpdate();
      return;
    }

    if (isGlobalSearch) {
      const categoriesCount = new Set(filteredItems.map((item) => item.categoryKey)).size;
      subtitleEl.textContent = `${filteredItems.length} resultados en ${categoriesCount} categorias - Mostrando ${visibleStart}-${visibleEnd} - Pagina ${currentPage} de ${totalPages}`;
    } else {
      subtitleEl.textContent = `Mostrando ${visibleStart}-${visibleEnd} de ${categoryItems.length} - Pagina ${currentPage} de ${totalPages}`;
    }

    const resolvedView = getResolvedCatalogView();

    if (resolvedView === "list") {
      setCatalogGridEntries(paginatedItems
        .map((item, index) => {
          const html = `
          <div class="col-12 ${isGlobalSearch ? "catalog-search-item" : ""}">
            <article class="product-box product-box-list border rounded shadow-sm h-100 product-preview-trigger" ${buildPreviewDataAttrs(item, isGlobalSearch ? item.categoryLabel : categoryData.label)}>
              <div class="product-list-media">
                <div class="product-thumb product-thumb-list${item.image ? "" : " placeholder"}">
                  ${renderCatalogImage(item.image, item.name)}
                  ${item.isPromotion ? `<span class="product-promo-corner">-${item.discountPct}%</span>` : ""}
                </div>
              </div>
              <div class="product-list-body">
                ${isGlobalSearch ? `<p class="product-category-pill mb-2">${escapeHtml(buildCatalogDisplayCategoryLabel(parseCatalogSourceMeta(item, item.categoryLabel), item.categoryLabel))}</p>` : ""}
                <h5>${escapeHtml(item.name)}</h5>
                ${showCodes ? `<p class="small text-muted mb-2" data-admin-only>Codigo: ${escapeHtml(item.code)}</p>` : ""}
                <p class="product-list-meta mb-0">Producto disponible para compra inmediata.</p>
              </div>
              <div class="product-list-side">
                ${item.isPromotion
                  ? `
                    <p class="product-price-wrap product-price-wrap-list">
                      <span class="product-current-price">S/. ${item.price}</span>
                      <span class="product-old-price">Antes: S/. ${item.originalPrice}</span>
                    </p>
                  `
                  : `<p class="fw-bold text-success product-list-single-price">S/. ${item.price}</p>`
                }
                <div class="add-proforma-actions">
                  <div class="add-qty-picker" aria-label="Cantidad a agregar">
                    <button type="button" class="add-qty-btn" data-action="dec-add-qty" aria-label="Disminuir cantidad">-</button>
                    <span class="add-qty-value" aria-live="polite">1</span>
                    <button type="button" class="add-qty-btn" data-action="inc-add-qty" aria-label="Aumentar cantidad">+</button>
                  </div>
                  <button
                    class="btn btn-sm w-100 add-proforma-btn"
                    data-product="${escapeHtml(item.name)}"
                    data-code="${escapeHtml(item.code)}"
                    data-price="${item.price}"
                    data-image="${escapeHtml(item.image || "")}"
                    data-original-price="${item.originalPrice || item.price}"
                    data-discount-pct="${item.discountPct || 0}"
                    data-promo="${item.isPromotion ? "1" : "0"}"
                  >
                    Agregar
                  </button>
                </div>
              </div>
            </article>
          </div>`;
          return {
            key: [
              "list",
              isGlobalSearch ? "search" : "category",
              showCodes ? "admin" : "public",
              item.code,
              item.price,
              item.originalPrice,
              item.discountPct,
              item.image,
              isGlobalSearch ? item.categoryLabel : categoryData.label
            ].join("|"),
            html
          };
        }));
    } else {
      const productColumnClass = isNarrowCatalogViewport()
        ? "col-12"
        : (isGlobalSearch
          ? "col-xl-3 col-lg-4 col-md-4 col-sm-6 col-6"
          : "col-lg-3 col-md-4 col-sm-6 col-6");
      setCatalogGridEntries(paginatedItems
        .map((item, index) => {
          const html = `
          <div class="${productColumnClass} ${isGlobalSearch ? "catalog-search-item" : ""}">
            <div class="product-box text-center p-3 border rounded shadow-sm h-100 product-preview-trigger" ${buildPreviewDataAttrs(item, isGlobalSearch ? item.categoryLabel : categoryData.label)}>
              <div class="product-thumb${item.image ? "" : " placeholder"}">
                ${renderCatalogImage(item.image, item.name)}
                ${item.isPromotion ? `<span class="product-promo-corner">-${item.discountPct}%</span>` : ""}
              </div>
              ${isGlobalSearch ? `<p class="product-category-pill mb-2">${escapeHtml(buildCatalogDisplayCategoryLabel(parseCatalogSourceMeta(item, item.categoryLabel), item.categoryLabel))}</p>` : ""}
              <h5>${escapeHtml(item.name)}</h5>
              ${showCodes ? `<p class="small text-muted mb-1" data-admin-only>Codigo: ${escapeHtml(item.code)}</p>` : ""}
              ${item.isPromotion
                ? `
                  <p class="product-price-wrap">
                    <span class="product-current-price">S/. ${item.price}</span>
                    <span class="product-old-price">Antes: S/. ${item.originalPrice}</span>
                  </p>
                `
                : `<p class="fw-bold text-success">S/. ${item.price}</p>`
              }
              <div class="add-proforma-actions">
                <div class="add-qty-picker" aria-label="Cantidad a agregar">
                  <button type="button" class="add-qty-btn" data-action="dec-add-qty" aria-label="Disminuir cantidad">-</button>
                  <span class="add-qty-value" aria-live="polite">1</span>
                  <button type="button" class="add-qty-btn" data-action="inc-add-qty" aria-label="Aumentar cantidad">+</button>
                </div>
                <button
                  class="btn btn-sm w-100 add-proforma-btn"
                  data-product="${escapeHtml(item.name)}"
                  data-code="${escapeHtml(item.code)}"
                  data-price="${item.price}"
                  data-image="${escapeHtml(item.image || "")}"
                  data-original-price="${item.originalPrice || item.price}"
                  data-discount-pct="${item.discountPct || 0}"
                  data-promo="${item.isPromotion ? "1" : "0"}"
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>`;
          return {
            key: [
              "grid",
              productColumnClass,
              isGlobalSearch ? "search" : "category",
              showCodes ? "admin" : "public",
              item.code,
              item.price,
              item.originalPrice,
              item.discountPct,
              item.image,
              isGlobalSearch ? item.categoryLabel : categoryData.label
            ].join("|"),
            html
          };
        }));
    }

    renderPagination(totalPages);
    endCatalogGridUpdate();
  }

  function addItemToProforma(button, options = {}) {
    const settings = options && typeof options === "object" ? options : {};
    const shouldOpenDrawer = settings.openDrawer !== false;
    const session = getSession();
    if (!session || !session.email) {
      if (isRedirectingToLogin) return false;
      isRedirectingToLogin = true;
      showBottomNotice("Necesitas iniciar sesion para crear tu proforma.");
      setTimeout(() => {
        window.location.href = "login.html";
      }, 1500);
      return false;
    }

    if (!isCustomerSession(session)) {
      showBottomNotice("La proforma esta disponible solo para clientes.");
      return false;
    }

    const productName = button.dataset.product || "producto";
    const productCode = button.dataset.code || productName;
    const productPrice = Number(button.dataset.price || 0);
    const productImage = button.dataset.image || "";
    const productOriginalPrice = Number(button.dataset.originalPrice || 0);
    const productDiscountPct = Math.max(0, Number(button.dataset.discountPct || 0));
    const qtyValueEl = button.closest(".add-proforma-actions")
      ? button.closest(".add-proforma-actions").querySelector(".add-qty-value")
      : null;
    const qtyToAdd = Math.max(1, Math.min(99, Number(qtyValueEl ? qtyValueEl.textContent : 1) || 1));
    const isPromotion = String(button.dataset.promo || "") === "1"
      || productDiscountPct > 0
      || (productOriginalPrice > 0 && productOriginalPrice > productPrice);

    const items = getProformaItems(session);
    const existingIndex = items.findIndex((item) => item.id === productCode);

    if (existingIndex >= 0) {
      items[existingIndex].qty += qtyToAdd;
      if (isPromotion) {
        items[existingIndex].price = productPrice;
        items[existingIndex].originalPrice = productOriginalPrice > 0 ? productOriginalPrice : productPrice;
        items[existingIndex].discountPct = productDiscountPct;
        items[existingIndex].isPromotion = true;
      }
    } else {
      items.push({
        id: productCode,
        code: productCode,
        name: productName,
        price: productPrice,
        qty: qtyToAdd,
        image: productImage,
        originalPrice: isPromotion ? (productOriginalPrice > 0 ? productOriginalPrice : productPrice) : 0,
        discountPct: isPromotion ? productDiscountPct : 0,
        isPromotion
      });
    }

    saveProformaItems(session, items);
    updateProformaButton();
    renderProformaDrawer(true);
    animateAddButton(button);
    animateProformaBadge();
    showBottomNotice(`${productName} x${qtyToAdd} agregado a la proforma.`);
    if (shouldOpenDrawer) {
      window.setTimeout(() => openProformaDrawer(), 90);
    }
    return true;
  }

  function adjustAddQty(qtyButton) {
    const picker = qtyButton.closest(".add-qty-picker");
    if (!picker) return;
    const valueEl = picker.querySelector(".add-qty-value");
    if (!valueEl) return;

    const currentQty = Math.max(1, Math.min(99, Number(valueEl.textContent || 1) || 1));
    const action = String(qtyButton.dataset.action || "");
    const nextQty = action === "inc-add-qty"
      ? Math.min(99, currentQty + 1)
      : Math.max(1, currentQty - 1);

    valueEl.textContent = String(nextQty);
  }

  if (catalogSidebarEl) {
    catalogSidebarEl.addEventListener("click", (event) => {
      const toggle = event.target.closest("[data-group-toggle]");
      if (toggle) {
        const groupEl = toggle.closest(".catalog-group");
        if (!groupEl) return;
        const isOpen = groupEl.classList.contains("is-open");
        currentCategory = String(toggle.dataset.category || ALL_PRODUCTS_CATEGORY).trim() || ALL_PRODUCTS_CATEGORY;
        currentPage = 1;
        requestedPageApplied = true;
        syncCatalogPageUrl();
        getCatalogGroupToggles().forEach((entry) => {
          setCatalogGroupOpen(entry.closest(".catalog-group"), false);
        });
        setCatalogGroupOpen(groupEl, !isOpen);
        renderCatalog();
        return;
      }

      const button = event.target.closest(".catalog-btn");
      if (!button) return;
      currentCategory = String(button.dataset.category || ALL_PRODUCTS_CATEGORY).trim() || ALL_PRODUCTS_CATEGORY;
      currentPage = 1;
      requestedPageApplied = true;
      syncCatalogPageUrl();
      getCatalogGroupToggles().forEach((entry) => {
        setCatalogGroupOpen(entry.closest(".catalog-group"), false);
      });
      setCatalogGroupOpen(button.closest(".catalog-group"), true);
      closeMobileCatalogDrawer();
      markDrawerTipSeen();
      renderCatalog();
    });
  }

  function bindProformaDrawerTrigger(trigger) {
    if (!trigger) return;
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      openProformaDrawer();
    });
  }

  bindProformaDrawerTrigger(proformaLinkBtn);
  bindProformaDrawerTrigger(mobileProformaBar);
  navCartLinks.forEach((link) => bindProformaDrawerTrigger(link));

  if (proformaDrawerCloseBtn) {
    proformaDrawerCloseBtn.addEventListener("click", closeProformaDrawer);
  }

  if (proformaDrawerKeepShoppingBtn) {
    proformaDrawerKeepShoppingBtn.addEventListener("click", closeProformaDrawer);
  }

  if (proformaDrawerBackdrop) {
    proformaDrawerBackdrop.addEventListener("click", closeProformaDrawer);
  }

  if (proformaDrawerItems) {
    proformaDrawerItems.addEventListener("click", (event) => {
      const actionButton = event.target.closest("[data-drawer-action]");
      if (!actionButton) return;
      updateProformaDrawerItem(actionButton.dataset.id, actionButton.dataset.drawerAction);
    });
  }

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.classList.contains("proforma-drawer-open")) {
      closeProformaDrawer();
    }
  });

  if (catalogSearchInput) {
    catalogSearchInput.addEventListener("input", () => {
      currentSearch = catalogSearchInput.value.trim();
      currentPage = 1;
      if (searchRenderTimer) clearTimeout(searchRenderTimer);
      searchRenderTimer = setTimeout(() => {
        searchRenderTimer = null;
        renderCatalog();
      }, 130);
    });
  }

  if (catalogSearchClearBtn) {
    catalogSearchClearBtn.addEventListener("click", () => {
      if (!catalogSearchInput || !catalogSearchInput.value) return;
      if (searchRenderTimer) {
        clearTimeout(searchRenderTimer);
        searchRenderTimer = null;
      }
      catalogSearchInput.value = "";
      currentSearch = "";
      currentPage = 1;
      renderCatalog();
      catalogSearchInput.focus();
    });
  }

  if (catalogCategoryFilterInput) {
    catalogCategoryFilterInput.addEventListener("input", () => {
      currentCategoryFilter = catalogCategoryFilterInput.value.trim();
      renderCatalogSidebar();
      syncCatalogSearchMode(Boolean(normalizeSearchText(currentSearch)));
    });
  }

  if (catalogViewGridBtn) {
    catalogViewGridBtn.addEventListener("click", () => setCatalogView("grid"));
  }

  if (catalogViewListBtn) {
    catalogViewListBtn.addEventListener("click", () => setCatalogView("list"));
  }

  if (catalogMobileToggleBtn) {
    catalogMobileToggleBtn.addEventListener("click", () => {
      if (document.body.classList.contains("catalog-search-mode")) return;
      markDrawerTipSeen();
      toggleMobileCatalogDrawer();
    });
  }

  if (catalogMobileFilterChipBtn) {
    catalogMobileFilterChipBtn.addEventListener("click", () => {
      if (document.body.classList.contains("catalog-search-mode")) return;
      markDrawerTipSeen();
      toggleMobileCatalogDrawer();
    });
  }

  if (catalogMobileCloseBtn) {
    catalogMobileCloseBtn.addEventListener("click", () => {
      closeMobileCatalogDrawer();
      markDrawerTipSeen();
    });
  }

  if (catalogMobileBackdrop) {
    catalogMobileBackdrop.addEventListener("click", () => {
      closeMobileCatalogDrawer();
      markDrawerTipSeen();
    });
  }

  function bindPaginationClick(paginationNode, options) {
    if (!paginationNode) return;
    const shouldScrollTop = Boolean(options && options.scrollTopOnChange);
    paginationNode.addEventListener("click", (event) => {
      const target = event.target;
      if (!target.matches("button[data-page]")) return;

      const normalizedSearch = normalizeSearchText(currentSearch);
      const selection = currentCategory === ALL_PRODUCTS_CATEGORY
        ? null
        : getCatalogSelection(buildCatalogSidebarGroups({ applyFilter: false }), currentCategory);
      const sourceItems = normalizedSearch
        ? getGlobalCatalogItems()
        : (currentCategory === ALL_PRODUCTS_CATEGORY
          ? getGlobalCatalogItems()
          : getConfiguredItemsForSelection(selection));
      const filteredItems = getFilteredItems(sourceItems, currentSearch);
      const totalPages = Math.max(1, Math.ceil(filteredItems.length / getActivePageSize(currentSearch)));
      const nextPage = Number(target.dataset.page);

      if (nextPage < 1 || nextPage > totalPages) return;
      currentPage = nextPage;
      requestedPageApplied = true;
      syncCatalogPageUrl();
      renderCatalog();
      if (shouldScrollTop) scrollCatalogToTop();
    });
  }

  bindPaginationClick(paginationEl, { scrollTopOnChange: true });
  bindPaginationClick(paginationTopEl);

  if (gridEl) {
    gridEl.addEventListener("click", (event) => {
      const qtyButton = event.target.closest(".add-qty-btn");
      if (qtyButton) {
        adjustAddQty(qtyButton);
        return;
      }
      const button = event.target.closest(".add-proforma-btn");
      if (button) {
        addItemToProforma(button);
        return;
      }
      if (event.target.closest(".add-proforma-actions")) return;
      const previewTrigger = event.target.closest(".product-preview-trigger");
      if (!previewTrigger) return;
      openProductPreviewFromTrigger(previewTrigger);
    });
  }

  if (promoInner) {
    promoInner.addEventListener("click", (event) => {
      const qtyButton = event.target.closest(".add-qty-btn");
      if (qtyButton) {
        adjustAddQty(qtyButton);
        return;
      }
      const button = event.target.closest(".add-proforma-btn");
      if (button) {
        addItemToProforma(button);
        return;
      }
      if (event.target.closest(".add-proforma-actions")) return;
      const previewTrigger = event.target.closest(".product-preview-trigger");
      if (!previewTrigger) return;
      openProductPreviewFromTrigger(previewTrigger);
    });
  }

  if (productPreviewModalEl) {
    productPreviewModalEl.addEventListener("show.bs.modal", () => {
      document.body.classList.add("catalog-preview-open");
      closeMobileCatalogDrawer();
    });

    productPreviewModalEl.addEventListener("hidden.bs.modal", () => {
      document.body.classList.remove("catalog-preview-open");
    });

    productPreviewModalEl.addEventListener("click", (event) => {
      const qtyButton = event.target.closest(".add-qty-btn");
      if (qtyButton) {
        adjustAddQty(qtyButton);
        return;
      }
      const addButton = event.target.closest("#productPreviewAddBtn");
      if (!addButton) return;
      const added = addItemToProforma(addButton, { openDrawer: false });
      if (!added) return;
      const modal = getProductPreviewModal();
      if (modal) {
        window.setTimeout(() => {
          modal.hide();
          window.setTimeout(() => openProformaDrawer(), 180);
        }, 180);
      } else {
        openProformaDrawer();
      }
    });
  }

  window.addEventListener("auth:logout", () => {
    updateProformaButton();
    maybeShowDrawerTip();
  });

  window.addEventListener("auth:session-changed", () => {
    maybeShowDrawerTip();
    updateProformaButton();
  });

  window.addEventListener("storage", (event) => {
    if (event.key === SESSION_SYNC_KEY) {
      maybeShowDrawerTip();
      updateProformaButton();
      return;
    }
    if (event.key && event.key.startsWith(PROFORMA_KEY_PREFIX)) {
      lastProformaUiSignature = "";
      lastProformaDrawerSignature = "";
      updateProformaButton();
      return;
    }
    if (
      event.key !== catalogApi.CATALOG_EDITOR_KEY
      && event.key !== catalogApi.CATALOG_CUSTOM_PRODUCTS_KEY
      && event.key !== catalogApi.CATALOG_SYNC_KEY
    ) return;
    if (!catalogReady) return;
    renderPromoCarousel();
    renderCatalog();
  });

  window.addEventListener("catalog:changed", () => {
    if (!catalogReady) return;
    renderPromoCarousel();
    renderCatalog();
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMobileCatalogDrawer();
  });

  window.addEventListener("resize", () => {
    if (viewResizeTimer) clearTimeout(viewResizeTimer);
    viewResizeTimer = setTimeout(() => {
      viewResizeTimer = null;
      if (!isCatalogDrawerViewport()) {
        closeMobileCatalogDrawer();
        document.body.classList.remove("catalog-tip-visible");
        clearDrawerTipTimer();
        if (!document.body.classList.contains("proforma-drawer-open")) {
          unlockCatalogBodyScroll();
        }
      } else {
        maybeShowDrawerTip();
      }

      const nextPromoItemsPerSlide = getPromoItemsPerSlide();
      if (nextPromoItemsPerSlide !== lastPromoItemsPerSlide) {
        lastPromoItemsPerSlide = nextPromoItemsPerSlide;
        if (catalogReady) renderPromoCarousel();
      }

      if (!catalogReady) return;
      const nextLayoutSignature = getCatalogLayoutSignature();
      if (nextLayoutSignature === lastCatalogLayoutSignature) {
        updateProformaButton();
        return;
      }
      lastCatalogLayoutSignature = nextLayoutSignature;
      applyCatalogView();
      renderCatalog();
      updateProformaButton();
    }, 110);
  });

  window.addEventListener("load", () => {
    syncPromoCarouselInstance();
  });

  if (catalogSearchInput && currentSearch) {
    catalogSearchInput.value = currentSearch;
  }

  bindCatalogNavObserver();
  closeMobileCatalogDrawer();
  maybeShowDrawerTip();
  updateProformaButton();

  async function initializeCatalog() {
    refreshCatalogSnapshot();
    lastCatalogLayoutSignature = getCatalogLayoutSignature();
    applyCatalogView();
    renderPromoCarousel();
    renderCatalog();
    catalogReady = true;

    try {
      const changed = await catalogApi.refreshBackendCatalog(true);
      if (!changed) return;
      refreshCatalogSnapshot();
      renderPromoCarousel();
      renderCatalog();
    } catch (error) {
      // Use the locally cached catalog when the backend is unavailable.
    } finally {
      document.documentElement.classList.remove("page-data-pending", "auth-preload");
      document.body.classList.remove("auth-preload");
    }
  }

  initializeCatalog();
})();
