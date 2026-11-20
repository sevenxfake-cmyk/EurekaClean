(() => {
  const CATALOG_EDITOR_KEY = "eurekaclean_catalog_editor_v2";
  const CATALOG_CUSTOM_PRODUCTS_KEY = "eurekaclean_catalog_custom_products_v2";
  const CATALOG_BACKEND_CACHE_KEY = "eurekaclean_catalog_backend_cache_v2";
  const CATALOG_SYNC_KEY = "eurekaclean_catalog_sync_v2";
  const authStore = window.EUREKA_AUTH || null;

  function normalizeApiBase(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    return raw.endsWith("/") ? raw.slice(0, -1) : raw;
  }

  const API_BASE = normalizeApiBase(window.EUREKA_API_BASE);

  let backendEnabled = false;
  let backendCatalogCache = null;
  let backendRefreshPromise = null;
  let staticCatalogCache = null;
  let staticCatalogPromise = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getFallbackBaseCatalogData() {
    return staticCatalogCache ? clone(staticCatalogCache) : {};
  }

  function sanitizeText(value, maxLen) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLen);
  }

  function sanitizeCode(value) {
    const code = sanitizeText(value, 40).toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9-]{2,39}$/.test(code)) return "";
    return code;
  }

  function normalizeImagePath(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";

    let image = raw.replace(/\\/g, "/");
    const lower = image.toLowerCase();

    if (/^[a-z]:\//i.test(image)) {
      const imgIndex = lower.indexOf("/img/");
      if (imgIndex >= 0) {
        image = image.slice(imgIndex + 1);
      }
    } else if (lower.startsWith("/img/")) {
      image = image.slice(1);
    }

    return image.trim();
  }

  function sanitizeImageUrl(value, allowEmpty = true) {
    const image = normalizeImagePath(value);
    if (!image) return allowEmpty ? "" : "";
    if (image.length > 600) return "";
    if (/^(https?:\/\/|data:image\/|img\/|\/img\/|\.\/img\/|\.\.\/img\/)/i.test(image)) return image;
    return "";
  }

  function parseNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function clampDiscount(value) {
    const num = parseNumber(value);
    if (num === null) return 0;
    return Math.max(0, Math.min(90, Number(num.toFixed(2))));
  }

  function buildDefaultPromoMap(catalogData) {
    const promoPlan = [
      { categoryKey: "escobas", index: 0, discountPct: 18 },
      { categoryKey: "escobas", index: 4, discountPct: 12 },
      { categoryKey: "perfumadores-spray", index: 2, discountPct: 20 },
      { categoryKey: "perfumadores-galon", index: 5, discountPct: 15 },
      { categoryKey: "tachos-50l", index: 1, discountPct: 10 },
      { categoryKey: "bolsa-negra", index: 3, discountPct: 18 },
      { categoryKey: "bolsa-roja", index: 4, discountPct: 18 }
    ];

    const map = {};
    promoPlan.forEach((entry) => {
      const category = catalogData[entry.categoryKey];
      const item = category && Array.isArray(category.items) ? category.items[entry.index] : null;
      if (!item || !item.code) return;
      map[String(item.code).trim()] = clampDiscount(entry.discountPct);
    });
    return map;
  }

  function sanitizeConfigEntry(entry) {
    if (!entry || typeof entry !== "object") return null;
    const safe = {};

    const price = parseNumber(entry.price);
    if (price !== null && price >= 0) safe.price = Number(price.toFixed(2));

    const discountPct = parseNumber(entry.discountPct);
    if (discountPct !== null) safe.discountPct = clampDiscount(discountPct);

    if (typeof entry.active === "boolean") safe.active = entry.active;

    if (typeof entry.name === "string") {
      const name = sanitizeText(entry.name, 120);
      if (name) safe.name = name;
    }

    if (Object.prototype.hasOwnProperty.call(entry, "description") && typeof entry.description === "string") {
      safe.description = sanitizeText(entry.description, 600);
    }

    if (typeof entry.code === "string") {
      const code = sanitizeCode(entry.code);
      if (code) safe.code = code;
    }

    if (Object.prototype.hasOwnProperty.call(entry, "image") && typeof entry.image === "string") {
      safe.image = sanitizeImageUrl(entry.image, true);
    }

    return Object.keys(safe).length ? safe : null;
  }

  function getSessionToken() {
    if (!authStore || typeof authStore.getToken !== "function") return "";
    return String(authStore.getToken() || "").trim();
  }

  function emitCatalogChange() {
    try {
      localStorage.setItem(CATALOG_SYNC_KEY, JSON.stringify({ syncAt: Date.now() }));
    } catch (error) {
      // no-op
    }
    window.dispatchEvent(new CustomEvent("catalog:changed"));
  }

  function readStoredBackendCatalog() {
    try {
      const raw = JSON.parse(localStorage.getItem(CATALOG_BACKEND_CACHE_KEY) || "null");
      const sourceCatalog = raw && typeof raw === "object" && !Array.isArray(raw) && raw.catalog
        ? raw.catalog
        : raw;
      const normalized = normalizeBackendCatalog(sourceCatalog);
      return Object.keys(normalized).length ? normalized : null;
    } catch (error) {
      return null;
    }
  }

  function saveStoredBackendCatalog(catalog) {
    try {
      localStorage.setItem(
        CATALOG_BACKEND_CACHE_KEY,
        JSON.stringify({
          syncAt: Date.now(),
          catalog
        })
      );
    } catch (error) {
      // no-op
    }
  }

  async function apiRequest(method, path, body, requiresAuth = false) {
    const requestPath = String(path || "").trim();
    if (!requestPath) {
      return { ok: false, status: 0, error: "Ruta API invalida." };
    }

    const headers = {};
    if (body !== null && body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    if (requiresAuth) {
      const token = getSessionToken();
      if (!token) {
        return { ok: false, status: 401, error: "Sesion invalida. Inicia sesion como administrador." };
      }
      headers.Authorization = `Bearer ${token}`;
    }

    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 12000) : null;

    try {
      const response = await fetch(`${API_BASE}${requestPath}`, {
        method,
        headers,
        signal: controller ? controller.signal : undefined,
        body: body === null || body === undefined ? undefined : JSON.stringify(body)
      });

      if (timer) clearTimeout(timer);

      let payload = null;
      try {
        payload = await response.json();
      } catch (error) {
        payload = null;
      }

      if (response.status >= 200 && response.status < 300) {
        if (payload && payload.ok === false) {
          return { ok: false, status: response.status, payload, error: payload.error || "Respuesta invalida del servidor." };
        }
        return { ok: true, status: response.status, payload };
      }

      return {
        ok: false,
        status: response.status,
        payload,
        error: (payload && payload.error) || `Error ${response.status || "de conexion"} al comunicarse con backend.`
      };
    } catch (error) {
      if (timer) clearTimeout(timer);
      const aborted = String(error && error.name ? error.name : "").toLowerCase() === "aborterror";
      return {
        ok: false,
        status: 0,
        error: aborted ? "El backend esta demorando demasiado en responder." : "No se pudo conectar con el backend."
      };
    }
  }

  function normalizeBackendCatalog(rawCatalog) {
    const source = rawCatalog && typeof rawCatalog === "object" ? rawCatalog : {};
    const normalized = {};

    Object.entries(source).forEach(([categoryKey, categoryData]) => {
      const safeCategoryKey = sanitizeText(categoryKey, 60);
      if (!safeCategoryKey) return;
      const label = sanitizeText(categoryData && categoryData.label, 80) || safeCategoryKey;
      const sourceItems = categoryData && Array.isArray(categoryData.items) ? categoryData.items : [];

      const items = sourceItems
        .map((item) => {
          const code = sanitizeCode(item && item.code);
          if (!code) return null;
          const name = sanitizeText(item && item.name, 120);
          if (!name) return null;
          const priceNum = parseNumber(item && item.price);
          if (priceNum === null || priceNum < 0) return null;
          return {
            code,
            name,
            description: sanitizeText(item && item.description, 600),
            price: Number(priceNum.toFixed(2)).toFixed(2),
            image: sanitizeImageUrl(item && item.image, true),
            discountPct: clampDiscount(item && item.discountPct),
            active: item && typeof item.active === "boolean" ? item.active : true,
            isCustom: Boolean(item && item.isCustom)
          };
        })
        .filter(Boolean);

      normalized[safeCategoryKey] = { label, items };
    });

    return normalized;
  }

  function catalogsEqual(left, right) {
    if (!left || !right) return false;
    try {
      return JSON.stringify(left) === JSON.stringify(right);
    } catch (error) {
      return false;
    }
  }

  async function refreshBackendCatalog(silent = false) {
    if (backendRefreshPromise) return backendRefreshPromise;

    backendRefreshPromise = (async () => {
      const hadStaticCatalog = Boolean(staticCatalogCache);
      await loadStaticCatalog();
      const response = await apiRequest("GET", "/api/catalog", null, false);
      if (!response.ok || !response.payload || typeof response.payload.catalog !== "object") {
        backendEnabled = false;
        return !hadStaticCatalog && Boolean(staticCatalogCache);
      }

      const nextCatalog = normalizeBackendCatalog(response.payload.catalog);
      const currentCatalog = backendCatalogCache || readStoredBackendCatalog();
      const changed = !catalogsEqual(currentCatalog, nextCatalog);

      backendCatalogCache = nextCatalog;
      backendEnabled = true;
      if (changed) {
        saveStoredBackendCatalog(backendCatalogCache);
        if (!silent) emitCatalogChange();
      }
      return changed;
    })().finally(() => {
      backendRefreshPromise = null;
    });

    return backendRefreshPromise;
  }

  function getOfflineBaseCatalogData() {
    if (staticCatalogCache) return clone(staticCatalogCache);
    const storedCatalog = readStoredBackendCatalog();
    if (storedCatalog) {
      return clone(storedCatalog);
    }
    return getFallbackBaseCatalogData();
  }

  async function loadStaticCatalog() {
    if (staticCatalogPromise) return staticCatalogPromise;

    staticCatalogPromise = (async () => {
      try {
        const response = await fetch("/catalogo_exportado.json", { cache: "no-cache" });
        if (!response.ok) return false;
        const payload = await response.json();
        const normalized = normalizeBackendCatalog(payload);
        if (!Object.keys(normalized).length) return false;

        const changed = !catalogsEqual(staticCatalogCache, normalized);
        staticCatalogCache = normalized;
        if (changed) emitCatalogChange();
        return changed;
      } catch (error) {
        console.warn("No se pudo cargar el catalogo publico de respaldo.", error);
        return false;
      }
    })();

    return staticCatalogPromise;
  }

  function getCatalogConfigMap() {
    if (backendEnabled) return {};
    try {
      const raw = JSON.parse(localStorage.getItem(CATALOG_EDITOR_KEY));
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
      const normalized = {};

      Object.entries(raw).forEach(([code, value]) => {
        const normalizedCode = sanitizeCode(code);
        if (!normalizedCode) return;
        const safeEntry = sanitizeConfigEntry(value);
        if (safeEntry) normalized[normalizedCode] = safeEntry;
      });

      return normalized;
    } catch (error) {
      return {};
    }
  }

  function saveCatalogConfigMap(configMap) {
    if (backendEnabled) return;
    const safeMap = {};
    if (configMap && typeof configMap === "object") {
      Object.entries(configMap).forEach(([code, value]) => {
        const normalizedCode = sanitizeCode(code);
        if (!normalizedCode) return;
        const safeEntry = sanitizeConfigEntry(value);
        if (safeEntry) safeMap[normalizedCode] = safeEntry;
      });
    }
    localStorage.setItem(CATALOG_EDITOR_KEY, JSON.stringify(safeMap));
  }

  async function setProductConfig(code, patch) {
    const safeCode = sanitizeCode(code);
    if (!safeCode) return { ok: false, error: "Codigo invalido." };
    const targetIsCustom = isCustomProductCode(safeCode);

    if (backendEnabled) {
      const patchObject = patch && typeof patch === "object" ? patch : {};
      const payload = {};

      if (typeof patchObject.code === "string") {
        const nextCode = sanitizeCode(patchObject.code);
        if (!nextCode) return { ok: false, error: "Codigo invalido." };
        if (nextCode !== safeCode && !targetIsCustom) {
          return { ok: false, error: "No se permite cambiar el codigo de productos base." };
        }
        payload.code = nextCode;
      }
      if (typeof patchObject.name === "string") {
        const name = sanitizeText(patchObject.name, 120);
        if (name) payload.name = name;
      }
      if (Object.prototype.hasOwnProperty.call(patchObject, "description") && typeof patchObject.description === "string") {
        payload.description = sanitizeText(patchObject.description, 600);
      }
      if (Object.prototype.hasOwnProperty.call(patchObject, "price")) {
        const price = parseNumber(patchObject.price);
        if (price === null || price < 0) return { ok: false, error: "Precio invalido." };
        payload.price = Number(price.toFixed(2));
      }
      if (Object.prototype.hasOwnProperty.call(patchObject, "discountPct")) {
        payload.discountPct = clampDiscount(patchObject.discountPct);
      }
      if (typeof patchObject.active === "boolean") {
        payload.active = patchObject.active;
      }
      if (Object.prototype.hasOwnProperty.call(patchObject, "image")) {
        payload.image = sanitizeImageUrl(patchObject.image, true);
      }
      if (typeof patchObject.isCustom === "boolean") {
        payload.isCustom = patchObject.isCustom;
      }
      if (typeof patchObject.categoryKey === "string") {
        const categoryKey = sanitizeText(patchObject.categoryKey, 60);
        if (categoryKey) payload.categoryKey = categoryKey;
      }

      const response = await apiRequest("PATCH", `/api/catalog/products/${encodeURIComponent(safeCode)}`, payload, true);
      if (!response.ok) return { ok: false, error: response.error || "No se pudo actualizar el producto." };
      await refreshBackendCatalog();
      return { ok: true };
    }

    const currentMap = getCatalogConfigMap();
    const currentEntry = currentMap[safeCode] || {};
    const patchObject = patch && typeof patch === "object" ? patch : {};

    const merged = { ...currentEntry, ...patchObject };
    if (Object.prototype.hasOwnProperty.call(merged, "code") && !targetIsCustom) {
      delete merged.code;
    }
    const safeEntry = sanitizeConfigEntry(merged);

    if (!safeEntry) {
      delete currentMap[safeCode];
    } else {
      currentMap[safeCode] = safeEntry;
    }

    saveCatalogConfigMap(currentMap);
    return { ok: true };
  }

  function clearProductConfig(code) {
    const safeCode = sanitizeCode(code);
    if (!safeCode) return;
    if (backendEnabled) return;
    const currentMap = getCatalogConfigMap();
    if (!Object.prototype.hasOwnProperty.call(currentMap, safeCode)) return;
    delete currentMap[safeCode];
    saveCatalogConfigMap(currentMap);
  }

  function clearCatalogConfig() {
    if (backendEnabled) return;
    localStorage.removeItem(CATALOG_EDITOR_KEY);
  }

  function sanitizeCustomProduct(product, validCategories) {
    if (!product || typeof product !== "object") return null;

    const categoryKey = sanitizeText(product.categoryKey, 60);
    if (!validCategories.includes(categoryKey)) return null;

    const code = sanitizeCode(product.code);
    if (!code) return null;

    const name = sanitizeText(product.name, 120);
    if (!name) return null;
    const description = sanitizeText(product.description, 600);

    const price = parseNumber(product.price);
    if (price === null || price < 0) return null;

    const image = sanitizeImageUrl(product.image, true);

    return {
      categoryKey,
      code,
      name,
      description,
      price: Number(price.toFixed(2)),
      image
    };
  }

  function getCustomProducts() {
    if (backendEnabled) {
      const catalog = getCatalogData();
      const custom = [];
      Object.entries(catalog).forEach(([categoryKey, category]) => {
        const items = Array.isArray(category.items) ? category.items : [];
        items.forEach((item) => {
          if (!item || !item.isCustom) return;
          const code = sanitizeCode(item.code);
          if (!code) return;
          custom.push({
            categoryKey,
            code,
            name: sanitizeText(item.name, 120),
            description: sanitizeText(item.description, 600),
            price: Number(parseNumber(item.price) || 0),
            image: sanitizeImageUrl(item.image, true),
            isCustom: true
          });
        });
      });
      return custom;
    }

    try {
      const raw = JSON.parse(localStorage.getItem(CATALOG_CUSTOM_PRODUCTS_KEY));
      if (!Array.isArray(raw)) return [];

      const validCategories = Object.keys(getOfflineBaseCatalogData());
      const byCode = new Map();

      raw.forEach((item) => {
        const safeItem = sanitizeCustomProduct(item, validCategories);
        if (!safeItem) return;
        byCode.set(safeItem.code, { ...safeItem, isCustom: true });
      });

      return Array.from(byCode.values());
    } catch (error) {
      return [];
    }
  }

  function saveCustomProducts(products) {
    if (backendEnabled) return;
    const validCategories = Object.keys(getOfflineBaseCatalogData());
    const list = Array.isArray(products) ? products : [];
    const byCode = new Map();

    list.forEach((item) => {
      const safeItem = sanitizeCustomProduct(item, validCategories);
      if (!safeItem) return;
      byCode.set(safeItem.code, safeItem);
    });

    localStorage.setItem(CATALOG_CUSTOM_PRODUCTS_KEY, JSON.stringify(Array.from(byCode.values())));
  }

  function codeExistsInBaseCatalog(code) {
    const safeCode = sanitizeCode(code);
    if (!safeCode) return false;

    if (backendEnabled) {
      if (!backendCatalogCache) return false;
      return Object.values(backendCatalogCache).some((category) =>
        Array.isArray(category.items) && category.items.some((item) => sanitizeCode(item.code) === safeCode && !item.isCustom)
      );
    }

    const catalog = getOfflineBaseCatalogData();
    return Object.values(catalog).some((category) =>
      category.items.some((item) => sanitizeCode(item.code) === safeCode)
    );
  }

  function isCustomProductCode(code) {
    const safeCode = sanitizeCode(code);
    if (!safeCode) return false;
    const catalog = getCatalogData();
    return Object.values(catalog).some((category) =>
      Array.isArray(category.items)
      && category.items.some((item) => sanitizeCode(item.code) === safeCode && Boolean(item.isCustom))
    );
  }

  async function upsertCustomProduct(product) {
    const validCategories = Object.keys(getCatalogData());
    const safeProduct = sanitizeCustomProduct(product, validCategories);
    if (!safeProduct) {
      return { ok: false, error: "Datos del nuevo producto no son validos." };
    }

    if (backendEnabled) {
      const response = await apiRequest(
        "POST",
        "/api/catalog/products",
        {
          categoryKey: safeProduct.categoryKey,
          code: safeProduct.code,
          name: safeProduct.name,
          description: safeProduct.description,
          price: safeProduct.price,
          discountPct: 0,
          image: safeProduct.image,
          active: true,
          isCustom: true
        },
        true
      );
      if (!response.ok) {
        return { ok: false, error: response.error || "No se pudo guardar el producto personalizado." };
      }
      await refreshBackendCatalog();
      return { ok: true, item: safeProduct };
    }

    const current = getCustomProducts();
    const index = current.findIndex((item) => item.code === safeProduct.code);
    const existsInBase = codeExistsInBaseCatalog(safeProduct.code);

    if (existsInBase && index < 0) {
      return { ok: false, error: `El codigo ${safeProduct.code} ya existe en el catalogo base.` };
    }

    if (index >= 0) {
      current[index] = { ...current[index], ...safeProduct, isCustom: true };
    } else {
      current.push({ ...safeProduct, isCustom: true });
    }

    saveCustomProducts(current);
    return { ok: true, item: safeProduct };
  }

  async function renameCustomProductCode(oldCode, newCode) {
    const safeOldCode = sanitizeCode(oldCode);
    const safeNewCode = sanitizeCode(newCode);
    if (!safeOldCode || !safeNewCode) {
      return { ok: false, error: "Codigo invalido." };
    }
    if (safeOldCode === safeNewCode) {
      return { ok: true, code: safeOldCode };
    }

    if (backendEnabled) {
      const response = await apiRequest(
        "PATCH",
        `/api/catalog/products/${encodeURIComponent(safeOldCode)}`,
        { code: safeNewCode, isCustom: true },
        true
      );
      if (!response.ok) {
        return { ok: false, error: response.error || "No se pudo actualizar el codigo." };
      }
      await refreshBackendCatalog();
      return { ok: true, code: safeNewCode };
    }

    const current = getCustomProducts();
    const index = current.findIndex((item) => item.code === safeOldCode);
    if (index < 0) {
      return { ok: false, error: `No se encontro el producto ${safeOldCode}.` };
    }

    if (codeExistsInBaseCatalog(safeNewCode)) {
      return { ok: false, error: `El codigo ${safeNewCode} ya existe en el catalogo base.` };
    }

    const existsInCustom = current.some((item, itemIndex) => itemIndex !== index && item.code === safeNewCode);
    if (existsInCustom) {
      return { ok: false, error: `El codigo ${safeNewCode} ya existe en productos personalizados.` };
    }

    current[index] = { ...current[index], code: safeNewCode, isCustom: true };
    saveCustomProducts(current);

    const configMap = getCatalogConfigMap();
    if (Object.prototype.hasOwnProperty.call(configMap, safeOldCode)) {
      const oldEntry = configMap[safeOldCode];
      const merged = { ...(configMap[safeNewCode] || {}), ...oldEntry };
      delete configMap[safeOldCode];
      configMap[safeNewCode] = merged;
      saveCatalogConfigMap(configMap);
    }

    return { ok: true, code: safeNewCode };
  }

  async function deleteCustomProduct(code) {
    const safeCode = sanitizeCode(code);
    if (!safeCode) return false;

    if (backendEnabled) {
      const response = await apiRequest(
        "DELETE",
        `/api/catalog/products/${encodeURIComponent(safeCode)}`,
        null,
        true
      );
      if (!response.ok) return false;
      await refreshBackendCatalog();
      return true;
    }

    const current = getCustomProducts();
    const next = current.filter((item) => item.code !== safeCode);
    if (next.length === current.length) return false;
    saveCustomProducts(next);
    return true;
  }

  function getCatalogData() {
    if (backendEnabled && backendCatalogCache) {
      return clone(backendCatalogCache);
    }

    const catalog = getOfflineBaseCatalogData();
    const customProducts = getCustomProducts();

    customProducts.forEach((item) => {
      const category = catalog[item.categoryKey];
      if (!category) return;
      const exists = category.items.some((baseItem) => sanitizeCode(baseItem.code) === item.code);
      if (exists) return;

      category.items.push({
        code: item.code,
        name: item.name,
        description: sanitizeText(item.description, 600),
        price: Number(item.price).toFixed(2),
        image: item.image || "",
        isCustom: true
      });
    });

    return catalog;
  }

  function applyConfigToItem(item, configMap, defaultPromoMap) {
    const source = item && typeof item === "object" ? item : {};
    const sourceCode = sanitizeCode(source.code);
    const basePrice = Math.max(0, Number(source.price || source.basePrice || 0));
    const entry = sourceCode ? (configMap[sourceCode] || {}) : {};
    const sourceDiscount = parseNumber(source.discountPct);
    const defaultDiscount = sourceDiscount !== null
      ? clampDiscount(sourceDiscount)
      : (sourceCode && defaultPromoMap[sourceCode] ? defaultPromoMap[sourceCode] : 0);
    const safeEntryCode = typeof entry.code === "string" ? sanitizeCode(entry.code) : "";
    const code = safeEntryCode || sourceCode;

    const effectiveBasePrice = Number.isFinite(entry.price) ? Math.max(0, Number(entry.price)) : basePrice;
    const discountPct = Number.isFinite(entry.discountPct) ? clampDiscount(entry.discountPct) : clampDiscount(defaultDiscount);
    const sourceActive = typeof source.active === "boolean" ? source.active : true;
    const active = typeof entry.active === "boolean" ? entry.active : sourceActive;
    const name = typeof entry.name === "string" && entry.name.trim()
      ? sanitizeText(entry.name, 120)
      : sanitizeText(source.name, 120);
    const description = Object.prototype.hasOwnProperty.call(entry, "description")
      ? sanitizeText(entry.description, 600)
      : sanitizeText(source.description, 600);
    const image = Object.prototype.hasOwnProperty.call(entry, "image")
      ? sanitizeImageUrl(entry.image, true)
      : sanitizeImageUrl(source.image, true);

    const discountedPrice = Number((effectiveBasePrice * (1 - discountPct / 100)).toFixed(2));
    const finalPrice = Number(Math.max(0, discountedPrice).toFixed(2));

    return {
      ...source,
      sourceCode,
      code,
      name,
      description,
      image,
      basePrice: Number(effectiveBasePrice.toFixed(2)),
      price: finalPrice.toFixed(2),
      originalPrice: Number(effectiveBasePrice.toFixed(2)).toFixed(2),
      discountPct,
      isPromotion: discountPct > 0,
      active,
      isCustom: Boolean(source.isCustom)
    };
  }

  function getCatalogWithConfig() {
    const catalog = getCatalogData();
    const configMap = getCatalogConfigMap();
    const defaultPromoMap = buildDefaultPromoMap(catalog);
    const withConfig = {};

    Object.entries(catalog).forEach(([categoryKey, categoryData]) => {
      withConfig[categoryKey] = {
        ...categoryData,
        items: categoryData.items.map((item) => applyConfigToItem(item, configMap, defaultPromoMap))
      };
    });

    return withConfig;
  }

  window.EUREKA_CATALOG = {
    CATALOG_EDITOR_KEY,
    CATALOG_CUSTOM_PRODUCTS_KEY,
    CATALOG_SYNC_KEY,
    getCatalogData,
    getCatalogWithConfig,
    refreshBackendCatalog,
    getCatalogConfigMap,
    saveCatalogConfigMap,
    setProductConfig,
    clearProductConfig,
    clearCatalogConfig,
    applyConfigToItem,
    buildDefaultPromoMap,
    clampDiscount,
    getCustomProducts,
    upsertCustomProduct,
    renameCustomProductCode,
    deleteCustomProduct
  };

  // El frontend muestra el catálogo exportado incluso sin una API Python activa.
  loadStaticCatalog();
})();
