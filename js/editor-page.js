(() => {
  const ADMIN_EMAIL = String(window.EUREKA_ADMIN_EMAIL || "").trim().toLowerCase();
  const authStore = window.EUREKA_AUTH || null;
  const previewStore = window.EUREKA_PREVIEW || null;
  const pageSize = 12;
  const LIVE_PREVIEW_TIMEOUT_MS = 10000;
  const EXCEL_IMPORT_CHUNK_SIZE = 100;
  let accessRenderSequence = 0;

  function normalizeApiBase(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    return raw.endsWith("/") ? raw.slice(0, -1) : raw;
  }

  function isDesignPreview() {
    return !!(previewStore && previewStore.enabled);
  }

  const API_BASE = normalizeApiBase(window.EUREKA_API_BASE);

  const catalogApi = window.EUREKA_CATALOG;
  if (!catalogApi) return;

  const editorAccessAlert = document.getElementById("editorAccessAlert");
  const editorPanel = document.getElementById("editorPanel");
  const editorStatusAlert = document.getElementById("editorStatusAlert");
  const editorSearchInput = document.getElementById("editorSearchInput");
  const editorSearchClearBtn = document.getElementById("editorSearchClearBtn");
  const editorLivePreview = document.getElementById("editorLivePreview");
  const editorPreviewImageBox = document.getElementById("editorPreviewImageBox");
  const editorPreviewCategory = document.getElementById("editorPreviewCategory");
  const editorPreviewName = document.getElementById("editorPreviewName");
  const editorPreviewCode = document.getElementById("editorPreviewCode");
  const editorPreviewPromoStatus = document.getElementById("editorPreviewPromoStatus");
  const editorPreviewState = document.getElementById("editorPreviewState");
  const editorPreviewFinalPrice = document.getElementById("editorPreviewFinalPrice");
  const editorPreviewBasePrice = document.getElementById("editorPreviewBasePrice");
  const editorPreviewDescription = document.getElementById("editorPreviewDescription");
  const editorTableBody = document.getElementById("editorTableBody");
  const editorPagination = document.getElementById("editorPagination");
  const editorAddPanel = document.getElementById("editorAddPanel");
  const editorAddForm = document.getElementById("editorAddForm");
  const editorAddCancelBtn = document.getElementById("editorAddCancelBtn");
  const editorNewCategory = document.getElementById("editorNewCategory");
  const editorNewSourceCategory = document.getElementById("editorNewSourceCategory");
  const editorNewSourceSubcategory = document.getElementById("editorNewSourceSubcategory");
  const editorNewUnit = document.getElementById("editorNewUnit");
  const editorNewCode = document.getElementById("editorNewCode");
  const editorNewName = document.getElementById("editorNewName");
  const editorNewPrice = document.getElementById("editorNewPrice");
  const editorNewDiscount = document.getElementById("editorNewDiscount");
  const editorNewPromoStatus = document.getElementById("editorNewPromoStatus");
  const editorNewFinalPrice = document.getElementById("editorNewFinalPrice");
  const editorNewImage = document.getElementById("editorNewImage");
  const editorNewImageFile = document.getElementById("editorNewImageFile");
  const editorNewImagePreview = document.getElementById("editorNewImagePreview");
  const editorNewActive = document.getElementById("editorNewActive");
  const editorExcelDropZone = document.getElementById("editorExcelDropZone");
  const editorExcelInput = document.getElementById("editorExcelInput");
  const editorExcelPickBtn = document.getElementById("editorExcelPickBtn");
  const editorExcelFileName = document.getElementById("editorExcelFileName");
  const editorExcelAlert = document.getElementById("editorExcelAlert");
  const editorConfirmModal = document.getElementById("editorConfirmModal");
  const editorConfirmTitle = document.getElementById("editorConfirmTitle");
  const editorConfirmMessage = document.getElementById("editorConfirmMessage");
  const editorConfirmStepLabel = document.getElementById("editorConfirmStepLabel");
  const editorConfirmStepOne = document.getElementById("editorConfirmStepOne");
  const editorConfirmStepTwo = document.getElementById("editorConfirmStepTwo");
  const editorConfirmKeywordView = document.getElementById("editorConfirmKeywordView");
  const editorConfirmKeywordInput = document.getElementById("editorConfirmKeywordInput");
  const editorConfirmError = document.getElementById("editorConfirmError");
  const editorConfirmCancelBtn = document.getElementById("editorConfirmCancelBtn");
  const editorConfirmNextBtn = document.getElementById("editorConfirmNextBtn");
  const editorConfirmAcceptBtn = document.getElementById("editorConfirmAcceptBtn");
  const editorProductPreviewModalEl = document.getElementById("editorProductPreviewModal");
  const editorProductPreviewImage = document.getElementById("editorProductPreviewImage");
  const editorProductPreviewCategory = document.getElementById("editorProductPreviewCategory");
  const editorProductPreviewName = document.getElementById("editorProductPreviewName");
  const editorProductPreviewCode = document.getElementById("editorProductPreviewCode");
  const editorProductPreviewDescription = document.getElementById("editorProductPreviewDescription");
  const editorProductPreviewState = document.getElementById("editorProductPreviewState");
  const editorProductPreviewPrice = document.getElementById("editorProductPreviewPrice");
  const editorProductPreviewOldPrice = document.getElementById("editorProductPreviewOldPrice");
  const editorModalCodeInput = document.getElementById("editorModalCodeInput");
  const editorModalNameInput = document.getElementById("editorModalNameInput");
  const editorModalPriceInput = document.getElementById("editorModalPriceInput");
  const editorModalDiscountInput = document.getElementById("editorModalDiscountInput");
  const editorModalSourceCategoryInput = document.getElementById("editorModalSourceCategoryInput");
  const editorModalSourceSubcategoryInput = document.getElementById("editorModalSourceSubcategoryInput");
  const editorModalUnitInput = document.getElementById("editorModalUnitInput");
  const editorModalImageInput = document.getElementById("editorModalImageInput");
  const editorModalImageUploadInput = document.getElementById("editorModalImageUploadInput");
  const editorModalImageFileInput = document.getElementById("editorModalImageFileInput");
  const editorOpenCropModalBtn = document.getElementById("editorOpenCropModalBtn");
  const editorImageCropModalEl = document.getElementById("editorImageCropModal");
  const editorModalCropPanel = document.getElementById("editorModalCropPanel");
  const editorModalCropViewport = document.getElementById("editorModalCropViewport");
  const editorModalCropTarget = document.getElementById("editorModalCropTarget");
  const editorModalCropZoomInput = document.getElementById("editorModalCropZoomInput");
  const editorModalCropResetBtn = document.getElementById("editorModalCropResetBtn");
  const editorModalCropApplyBtn = document.getElementById("editorModalCropApplyBtn");
  const editorModalDescriptionInput = document.getElementById("editorModalDescriptionInput");
  const editorModalActiveInput = document.getElementById("editorModalActiveInput");
  const editorModalSaveBtn = document.getElementById("editorModalSaveBtn");

  let searchQuery = "";
  let currentPage = 1;
  let selectedRowBaseCode = "";
  let livePreviewHideTimer = null;
  let editorProductPreviewModalInstance = null;
  let editorImageCropModalInstance = null;
  let editorModalEditingRow = null;
  let editorModalEditingBaseCode = "";
  let excelImportInProgress = false;
  const modalCropState = {
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    dragging: false,
    pointerId: null,
    dragStartX: 0,
    dragStartY: 0,
    dragOriginX: 0,
    dragOriginY: 0
  };

  const EDITOR_FALLBACK_IMAGE = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420"><rect width="640" height="420" fill="#eef5f0"/><rect x="42" y="42" width="556" height="336" rx="22" fill="#f8fbf9" stroke="#c3d7cb" stroke-width="3"/><text x="320" y="220" text-anchor="middle" font-size="28" font-family="Arial, sans-serif" fill="#4b6758">Sin imagen</text></svg>'
  )}`;
  const SKU_EUREKA_REGEX = /^UNI\d{5}$/;

  const EXCEL_IMPORT_COLUMNS = [
    { key: "code", label: "SKU EUREKA", aliases: ["skueureka", "codigo"], required: true },
    { key: "name", label: "PRODUCTO", aliases: ["producto", "nombre"], required: true },
    { key: "unit", label: "UM", aliases: ["um", "unidadmedida"], required: false },
    { key: "status", label: "ESTADO", aliases: ["estado"], required: false },
    { key: "category", label: "CATEGORIA", aliases: ["categoria"], required: false },
    { key: "subcategory", label: "SUBCATEGORIA", aliases: ["subcategoria"], required: false },
    { key: "price", label: "P VENTA", aliases: ["pventa", "precioventa", "precios", "precio"], required: true },
    { key: "discount", label: "PROMO %", aliases: ["promo", "promopct", "promo%"], required: false },
    { key: "image", label: "IMAGEN (URL/RUTA)", aliases: ["imagenurlruta", "imagen", "urlimagen"], required: false }
  ];

  function normalizeSearchText(text) {
    return String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function toMoney(value) {
    return Number(value || 0).toFixed(2);
  }

  function normalizeCode(value) {
    return String(value || "").trim().toUpperCase();
  }

  function sanitizeDescription(value) {
    return String(value || "").trim().slice(0, 600);
  }

  function sanitizeMetaText(value, maxLen = 120) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLen);
  }

  function parseProductMetaDescription(value) {
    const parts = String(value || "")
      .split("|")
      .map((part) => String(part || "").replace(/\s+/g, " ").trim())
      .filter(Boolean);

    const meta = {
      unit: "",
      sourceCategory: "",
      sourceSubcategory: "",
      extraParts: []
    };

    parts.forEach((part) => {
      const match = part.match(/^([^:]+):\s*(.+)$/);
      if (!match) {
        meta.extraParts.push(part);
        return;
      }

      const rawKey = sanitizeMetaText(match[1], 80);
      const rawValue = sanitizeMetaText(match[2], 180);
      if (!rawValue) return;

      const normalizedKey = normalizeSearchText(rawKey);
      if (normalizedKey === "um") {
        meta.unit = rawValue;
        return;
      }
      if (normalizedKey === "categoria origen" || normalizedKey === "categoria") {
        meta.sourceCategory = rawValue;
        return;
      }
      if (normalizedKey === "subcategoria origen" || normalizedKey === "subcategoria") {
        meta.sourceSubcategory = rawValue;
        return;
      }

      meta.extraParts.push(`${rawKey}: ${rawValue}`);
    });

    return meta;
  }

  function buildProductMetaDescription(meta = {}) {
    const parts = [];
    const unit = sanitizeMetaText(meta.unit, 40);
    const sourceCategory = sanitizeMetaText(meta.sourceCategory, 120);
    const sourceSubcategory = sanitizeMetaText(meta.sourceSubcategory, 120);
    const extraParts = Array.isArray(meta.extraParts)
      ? meta.extraParts.map((part) => sanitizeDescription(part)).filter(Boolean)
      : [];

    if (unit) parts.push(`UM: ${unit}`);
    if (sourceCategory) parts.push(`Categoria origen: ${sourceCategory}`);
    if (sourceSubcategory) parts.push(`Subcategoria origen: ${sourceSubcategory}`);
    extraParts.forEach((part) => parts.push(part));

    return sanitizeDescription(parts.join(" | "));
  }

  function buildVisibleCategoryLabel(sourceCategory, sourceSubcategory, fallbackLabel = "") {
    const safeCategory = sanitizeMetaText(sourceCategory, 120);
    const safeSubcategory = sanitizeMetaText(sourceSubcategory, 120);
    const safeFallback = sanitizeMetaText(fallbackLabel, 120);

    if (safeCategory && safeSubcategory && normalizeSearchText(safeCategory) !== normalizeSearchText(safeSubcategory)) {
      return `${safeCategory} / ${safeSubcategory}`;
    }

    return safeSubcategory || safeCategory || safeFallback || "Sin categoria";
  }

  function getSelectedCategoryOptionLabel(selectEl) {
    if (!selectEl || !(selectEl instanceof HTMLSelectElement)) return "";
    const selectedOption = selectEl.options && selectEl.selectedIndex >= 0
      ? selectEl.options[selectEl.selectedIndex]
      : null;
    return selectedOption ? sanitizeMetaText(selectedOption.textContent, 120) : "";
  }

  function syncNewTaxonomyPlaceholders() {
    const baseLabel = getSelectedCategoryOptionLabel(editorNewCategory);
    if (editorNewSourceCategory && !editorNewSourceCategory.value) {
      editorNewSourceCategory.placeholder = baseLabel || "Ej. Limpieza y desinfeccion";
    }
    if (editorNewSourceSubcategory && !editorNewSourceSubcategory.value) {
      editorNewSourceSubcategory.placeholder = baseLabel || "Ej. Desinfectantes";
    }
  }

  function isValidCode(value) {
    return SKU_EUREKA_REGEX.test(normalizeCode(value));
  }

  function extractSkuNumber(value) {
    const match = normalizeCode(value).match(/^UNI(\d{5})$/);
    if (!match) return null;
    const num = Number(match[1]);
    return Number.isInteger(num) ? num : null;
  }

  function buildSkuCode(value) {
    const safeNumber = Math.max(1, Number(value) || 1);
    return `UNI${String(safeNumber).padStart(5, "0")}`;
  }

  function getNextAvailableSku() {
    const rows = getRows();
    let maxSku = 0;

    rows.forEach((row) => {
      const currentCode = extractSkuNumber(row && row.code ? row.code : "");
      const baseCode = extractSkuNumber(row && row.baseCode ? row.baseCode : "");
      if (Number.isInteger(currentCode)) maxSku = Math.max(maxSku, currentCode);
      if (Number.isInteger(baseCode)) maxSku = Math.max(maxSku, baseCode);
    });

    return buildSkuCode(maxSku + 1);
  }

  function assignNextSkuToNewProductField(force = false) {
    if (!editorNewCode) return;
    const current = normalizeCode(editorNewCode.value);
    if (!force && current) return;
    editorNewCode.value = getNextAvailableSku();
    editorNewCode.readOnly = true;
    editorNewCode.title = "SKU EUREKA generado automaticamente";
  }

  function clampDiscount(value) {
    return catalogApi.clampDiscount(value);
  }

  function calculateFinalPrice(basePrice, discountPct) {
    const safeBase = Number.isFinite(Number(basePrice)) ? Math.max(0, Number(basePrice)) : 0;
    const safeDiscount = clampDiscount(discountPct);
    const discountedPrice = safeBase * (1 - safeDiscount / 100);
    return Number(Math.max(0, discountedPrice).toFixed(2));
  }

  function getPromoState(discountPct) {
    const safeDiscount = clampDiscount(discountPct);
    return {
      active: safeDiscount > 0,
      text: safeDiscount > 0 ? "Activa" : "Inactiva"
    };
  }

  function paintPromoStatus(el, discountPct) {
    if (!el) return;
    const promo = getPromoState(discountPct);
    el.textContent = `Promo ${promo.text.toLowerCase()}`;
    el.classList.remove("editor-promo-active", "editor-promo-inactive");
    el.classList.add(promo.active ? "editor-promo-active" : "editor-promo-inactive");
  }

  function getSession() {
    const session = authStore && typeof authStore.getSession === "function"
      ? authStore.getSession()
      : null;
    if (session) return session;
    if (isDesignPreview() && previewStore && typeof previewStore.getSession === "function") {
      return previewStore.getSession();
    }
    return null;
  }

  function getSessionToken() {
    if (authStore && typeof authStore.getToken === "function") {
      return String(authStore.getToken() || "").trim();
    }
    const session = getSession();
    return session && session.token ? String(session.token).trim() : "";
  }

  function toApiUrl(path) {
    const rawPath = String(path || "").trim();
    if (!rawPath) return API_BASE;
    if (/^https?:\/\//i.test(rawPath)) return rawPath;
    const normalizedPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
    return `${API_BASE}${normalizedPath}`;
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

  function showAccessAlert(type, message) {
    if (!editorAccessAlert) return;
    editorAccessAlert.className = `alert alert-${type}`;
    editorAccessAlert.textContent = message;
    editorAccessAlert.classList.remove("d-none");
  }

  function hideAccessAlert() {
    if (!editorAccessAlert) return;
    editorAccessAlert.classList.add("d-none");
    editorAccessAlert.textContent = "";
  }

  function showStatus(type, message) {
    if (!editorStatusAlert) return;
    editorStatusAlert.className = `alert alert-${type} mt-3`;
    editorStatusAlert.textContent = message;
    editorStatusAlert.classList.remove("d-none");
  }

  function hideStatus() {
    if (!editorStatusAlert) return;
    editorStatusAlert.classList.add("d-none");
    editorStatusAlert.textContent = "";
  }

  function showExcelAlert(type, message) {
    if (!editorExcelAlert) return;
    editorExcelAlert.className = `alert alert-${type} mt-3 mb-0`;
    editorExcelAlert.textContent = message;
    editorExcelAlert.classList.remove("d-none");
  }

  function hideExcelAlert() {
    if (!editorExcelAlert) return;
    editorExcelAlert.classList.add("d-none");
    editorExcelAlert.textContent = "";
  }

  function setExcelFileName(name) {
    if (!editorExcelFileName) return;
    const safeName = String(name || "").trim();
    editorExcelFileName.textContent = safeName || "Sin archivo cargado.";
  }

  function setExcelImportBusy(isBusy) {
    const busy = Boolean(isBusy);
    excelImportInProgress = busy;
    if (editorExcelPickBtn) editorExcelPickBtn.disabled = busy;
    if (editorExcelInput) editorExcelInput.disabled = busy;
    if (editorExcelDropZone) {
      editorExcelDropZone.setAttribute("aria-busy", busy ? "true" : "false");
      editorExcelDropZone.classList.toggle("disabled", busy);
      editorExcelDropZone.tabIndex = busy ? -1 : 0;
    }
  }

  function yieldToBrowser() {
    return new Promise((resolve) => {
      window.setTimeout(resolve, 0);
    });
  }

  function buildExcelProgressMessage(stage, processed, total) {
    const safeStage = String(stage || "Procesando Excel").trim() || "Procesando Excel";
    const safeTotal = Math.max(0, Number(total) || 0);
    const safeProcessed = Math.min(safeTotal, Math.max(0, Number(processed) || 0));
    if (!safeTotal) return `${safeStage}...`;
    const percent = Math.min(100, Math.round((safeProcessed / safeTotal) * 100));
    return `${safeStage}... ${safeProcessed}/${safeTotal} (${percent}%)`;
  }

  function normalizeHeaderKey(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .trim();
  }

  function parseNumberValue(value) {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }
    const text = String(value || "").trim();
    if (!text) return null;
    const normalized = text
      .replace(/\s+/g, "")
      .replace(/s\/?\.?/gi, "")
      .replace(/[^\d,.-]/g, "");
    if (!normalized) return null;

    const commaCount = (normalized.match(/,/g) || []).length;
    const dotCount = (normalized.match(/\./g) || []).length;
    let candidate = normalized;

    if (commaCount && dotCount) {
      const lastComma = normalized.lastIndexOf(",");
      const lastDot = normalized.lastIndexOf(".");
      if (lastComma > lastDot) {
        candidate = normalized.replace(/\./g, "").replace(",", ".");
      } else {
        candidate = normalized.replace(/,/g, "");
      }
    } else if (commaCount > 1) {
      candidate = normalized.replace(/,/g, "");
    } else if (dotCount > 1) {
      candidate = normalized.replace(/\./g, "");
    } else if (commaCount === 1 && dotCount === 0) {
      candidate = normalized.replace(",", ".");
    }

    const num = Number(candidate);
    return Number.isFinite(num) ? num : null;
  }

  function normalizeExcelStatus(value) {
    const normalized = normalizeSearchText(value);
    if (!normalized) {
      return { active: null, raw: "" };
    }
    if (
      normalized.includes("inactivo")
      || normalized.includes("descontinuado")
      || normalized.includes("baja")
      || normalized.includes("anulado")
    ) {
      return { active: false, raw: normalized };
    }
    if (
      normalized.includes("activo")
      || normalized.includes("crear")
      || normalized.includes("nuevo")
      || normalized.includes("alta")
    ) {
      return { active: true, raw: normalized };
    }
    return { active: null, raw: normalized };
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

  function isValidImagePath(value) {
    const image = normalizeImagePath(value);
    if (!image) return true;
    return /^(https?:\/\/|data:image\/|img\/|\/img\/|\.\/img\/|\.\.\/img\/)/i.test(image);
  }

  function hasModalCropper() {
    return Boolean(
      editorModalCropPanel
      && editorModalCropViewport
      && editorModalCropTarget
      && editorModalCropZoomInput
      && editorModalCropApplyBtn
    );
  }

  function setModalCropPanelReady(ready) {
    if (!editorModalCropPanel) return;
    const isReady = Boolean(ready);
    editorModalCropPanel.dataset.ready = isReady ? "1" : "0";
  }

  function resetModalCropper(options = {}) {
    const keepFile = Boolean(options.keepFile);
    modalCropState.zoom = 1;
    modalCropState.offsetX = 0;
    modalCropState.offsetY = 0;
    modalCropState.dragging = false;
    modalCropState.pointerId = null;

    if (editorModalCropZoomInput) {
      editorModalCropZoomInput.value = "1";
      editorModalCropZoomInput.disabled = true;
    }
    if (editorModalCropApplyBtn) {
      editorModalCropApplyBtn.disabled = true;
    }
    if (editorModalCropViewport) {
      editorModalCropViewport.classList.remove("is-dragging");
    }
    if (editorModalCropTarget) {
      editorModalCropTarget.removeAttribute("src");
      editorModalCropTarget.style.width = "";
      editorModalCropTarget.style.height = "";
      editorModalCropTarget.style.left = "";
      editorModalCropTarget.style.top = "";
    }
    if (editorModalCropPanel) {
      editorModalCropPanel.dataset.ready = "0";
    }
    if (editorModalImageFileInput && !keepFile) {
      editorModalImageFileInput.value = "";
    }
    setModalCropPanelReady(false);
  }

  function getModalCropMetrics() {
    if (!editorModalCropViewport || !editorModalCropTarget || !editorModalCropTarget.naturalWidth || !editorModalCropTarget.naturalHeight) {
      return null;
    }

    const viewportWidth = editorModalCropViewport.clientWidth;
    const viewportHeight = editorModalCropViewport.clientHeight;
    const naturalWidth = editorModalCropTarget.naturalWidth;
    const naturalHeight = editorModalCropTarget.naturalHeight;
    if (!viewportWidth || !viewportHeight || !naturalWidth || !naturalHeight) return null;

    const baseScale = Math.max(viewportWidth / naturalWidth, viewportHeight / naturalHeight);
    const zoom = Math.max(1, Number(modalCropState.zoom) || 1);
    const drawWidth = naturalWidth * baseScale * zoom;
    const drawHeight = naturalHeight * baseScale * zoom;
    return {
      viewportWidth,
      viewportHeight,
      naturalWidth,
      naturalHeight,
      drawWidth,
      drawHeight
    };
  }

  function clampModalCropOffsets(metrics) {
    const resolved = metrics || getModalCropMetrics();
    if (!resolved) return;

    const maxOffsetX = Math.max(0, (resolved.drawWidth - resolved.viewportWidth) / 2);
    const maxOffsetY = Math.max(0, (resolved.drawHeight - resolved.viewportHeight) / 2);
    modalCropState.offsetX = Math.min(maxOffsetX, Math.max(-maxOffsetX, Number(modalCropState.offsetX) || 0));
    modalCropState.offsetY = Math.min(maxOffsetY, Math.max(-maxOffsetY, Number(modalCropState.offsetY) || 0));
  }

  function renderModalCropImage() {
    if (!hasModalCropper()) return;
    const metrics = getModalCropMetrics();
    if (!metrics) return;

    clampModalCropOffsets(metrics);

    const left = (metrics.viewportWidth - metrics.drawWidth) / 2 + modalCropState.offsetX;
    const top = (metrics.viewportHeight - metrics.drawHeight) / 2 + modalCropState.offsetY;
    editorModalCropTarget.style.width = `${metrics.drawWidth}px`;
    editorModalCropTarget.style.height = `${metrics.drawHeight}px`;
    editorModalCropTarget.style.left = `${left}px`;
    editorModalCropTarget.style.top = `${top}px`;
  }

  function finalizeLoadedModalCropSource() {
    modalCropState.zoom = 1;
    modalCropState.offsetX = 0;
    modalCropState.offsetY = 0;
    modalCropState.dragging = false;
    modalCropState.pointerId = null;

    if (editorModalCropZoomInput) {
      editorModalCropZoomInput.disabled = false;
      editorModalCropZoomInput.value = "1";
    }
    if (editorModalCropApplyBtn) {
      editorModalCropApplyBtn.disabled = false;
    }
    setModalCropPanelReady(true);
    renderModalCropImage();
  }

  function resolveCropImageSource(imageValue) {
    const image = normalizeImagePath(imageValue);
    if (!image) return "";
    if (/^data:image\//i.test(image) || /^https?:\/\//i.test(image)) return image;

    try {
      return new URL(image, window.location.href).href;
    } catch (error) {
      return image;
    }
  }

  async function setModalCropTargetSource(source) {
    const safeSource = String(source || "").trim();
    if (!safeSource || !editorModalCropTarget) {
      throw new Error("No se encontro la imagen para recortar.");
    }

    await new Promise((resolve, reject) => {
      editorModalCropTarget.onload = () => resolve();
      editorModalCropTarget.onerror = () => reject(new Error("No se pudo abrir la imagen para recorte."));
      editorModalCropTarget.src = safeSource;
    });
  }

  async function loadModalCropSourceFromFile(file) {
    if (!file || !hasModalCropper()) return;
    const dataUrl = await readFileAsDataUrl(file);
    await setModalCropTargetSource(dataUrl);
    finalizeLoadedModalCropSource();
  }

  async function loadModalCropSourceFromImageValue(imageValue) {
    if (!hasModalCropper()) return;
    const source = resolveCropImageSource(imageValue);
    if (!source) {
      throw new Error("Esta fila no tiene una imagen valida para recortar.");
    }

    const isDataUrl = /^data:image\//i.test(source);
    if (isDataUrl) {
      await setModalCropTargetSource(source);
      finalizeLoadedModalCropSource();
      return;
    }

    let finalSource = source;
    let sourceUrl = null;
    try {
      sourceUrl = new URL(source, window.location.href);
    } catch (error) {
      sourceUrl = null;
    }

    if (sourceUrl && /^https?:$/i.test(sourceUrl.protocol) && sourceUrl.origin !== window.location.origin) {
      try {
        const localPath = await importRemoteImageUrlToServer(sourceUrl.href, buildCropUploadFilename());
        finalSource = resolveCropImageSource(localPath);
        if (editorModalImageInput) {
          editorModalImageInput.value = normalizeImagePath(localPath);
        }
      } catch (error) {
        finalSource = source;
        showStatus(
          "warning",
          error && error.message
            ? `${error.message} Se intentara abrir recorte directo con la URL actual.`
            : "No se pudo preparar la imagen remota en backend. Se intentara recorte directo."
        );
      }
    }

    await setModalCropTargetSource(finalSource);
    finalizeLoadedModalCropSource();
  }

  function beginModalCropDrag(event) {
    if (!hasModalCropper() || !editorModalCropTarget || !editorModalCropTarget.naturalWidth) return;
    event.preventDefault();
    modalCropState.dragging = true;
    modalCropState.pointerId = event.pointerId;
    modalCropState.dragStartX = event.clientX;
    modalCropState.dragStartY = event.clientY;
    modalCropState.dragOriginX = Number(modalCropState.offsetX) || 0;
    modalCropState.dragOriginY = Number(modalCropState.offsetY) || 0;
    if (editorModalCropViewport) {
      editorModalCropViewport.classList.add("is-dragging");
      if (typeof editorModalCropViewport.setPointerCapture === "function") {
        editorModalCropViewport.setPointerCapture(event.pointerId);
      }
    }
  }

  function moveModalCropDrag(event) {
    if (!modalCropState.dragging) return;
    if (modalCropState.pointerId !== null && event.pointerId !== modalCropState.pointerId) return;
    const deltaX = event.clientX - modalCropState.dragStartX;
    const deltaY = event.clientY - modalCropState.dragStartY;
    modalCropState.offsetX = modalCropState.dragOriginX + deltaX;
    modalCropState.offsetY = modalCropState.dragOriginY + deltaY;
    renderModalCropImage();
  }

  function endModalCropDrag(event) {
    if (!modalCropState.dragging) return;
    if (modalCropState.pointerId !== null && event.pointerId !== modalCropState.pointerId) return;
    modalCropState.dragging = false;
    modalCropState.pointerId = null;
    if (editorModalCropViewport) {
      editorModalCropViewport.classList.remove("is-dragging");
      if (typeof editorModalCropViewport.releasePointerCapture === "function") {
        try {
          editorModalCropViewport.releasePointerCapture(event.pointerId);
        } catch (error) {
          // Ignore pointer capture release errors.
        }
      }
    }
  }

  function buildModalCropDataUrl() {
    const metrics = getModalCropMetrics();
    if (!metrics || !editorModalCropTarget) {
      throw new Error("Selecciona primero una imagen para recortar.");
    }

    clampModalCropOffsets(metrics);
    const left = (metrics.viewportWidth - metrics.drawWidth) / 2 + modalCropState.offsetX;
    const top = (metrics.viewportHeight - metrics.drawHeight) / 2 + modalCropState.offsetY;
    const sourceScale = metrics.drawWidth / metrics.naturalWidth;
    const sourceWidth = metrics.viewportWidth / sourceScale;
    const sourceHeight = metrics.viewportHeight / sourceScale;
    const sourceX = Math.min(
      Math.max(0, (0 - left) / sourceScale),
      Math.max(0, metrics.naturalWidth - sourceWidth)
    );
    const sourceY = Math.min(
      Math.max(0, (0 - top) / sourceScale),
      Math.max(0, metrics.naturalHeight - sourceHeight)
    );

    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 720;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("No se pudo preparar el recorte de imagen.");
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      editorModalCropTarget,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      canvas.width,
      canvas.height
    );
    try {
      return canvas.toDataURL("image/jpeg", 0.92);
    } catch (error) {
      if (error && error.name === "SecurityError") {
        throw new Error("No se pudo recortar esta URL por permisos del servidor (CORS). Descarga la imagen y subela como archivo para recortarla.");
      }
      throw error;
    }
  }

  function buildCropUploadFilename() {
    const code = normalizeCode(editorModalCodeInput ? editorModalCodeInput.value : "");
    const fallback = code || "producto";
    const safe = fallback.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    return `${safe || "producto"}-recorte.jpg`;
  }

  function resolveExcelColumnMap(headerRow) {
    const byHeader = new Map();
    (Array.isArray(headerRow) ? headerRow : []).forEach((headerValue, index) => {
      const normalized = normalizeHeaderKey(headerValue);
      if (!normalized || byHeader.has(normalized)) return;
      byHeader.set(normalized, index);
    });

    const columnIndexByKey = {};
    const missing = [];

    EXCEL_IMPORT_COLUMNS.forEach((column) => {
      const index = column.aliases
        .map((alias) => byHeader.get(alias))
        .find((value) => Number.isInteger(value));

      if (!Number.isInteger(index)) {
        if (column.required) missing.push(column.label);
        return;
      }
      columnIndexByKey[column.key] = index;
    });

    return { columnIndexByKey, missing };
  }

  function buildCatalogRowMap() {
    const map = new Map();
    getRows().forEach((row) => {
      const displayCode = normalizeCode(row.code);
      const baseCode = normalizeCode(row.baseCode);
      if (displayCode && !map.has(displayCode)) map.set(displayCode, row);
      if (baseCode && !map.has(baseCode)) map.set(baseCode, row);
    });
    return map;
  }

  async function parseExcelRows(file, onProgress) {
    if (!file) {
      throw new Error("Selecciona un archivo Excel.");
    }

    if (!window.XLSX || typeof window.XLSX.read !== "function" || !window.XLSX.utils) {
      throw new Error("No se pudo cargar el lector Excel. Recarga la pagina e intenta otra vez.");
    }

    const buffer = await file.arrayBuffer();
    const workbook = window.XLSX.read(buffer, { type: "array" });
    const sheetName = workbook && Array.isArray(workbook.SheetNames) ? workbook.SheetNames[0] : "";
    if (!sheetName) {
      throw new Error("El archivo no contiene hojas de calculo.");
    }

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      throw new Error("No se pudo leer la primera hoja del Excel.");
    }

    const matrix = window.XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      blankrows: false,
      raw: true
    });

    if (!Array.isArray(matrix) || matrix.length < 2) {
      throw new Error("El Excel no tiene filas de datos para importar.");
    }

    const headerRow = Array.isArray(matrix[0]) ? matrix[0] : [];
    const { columnIndexByKey, missing } = resolveExcelColumnMap(headerRow);
    if (missing.length) {
      throw new Error(`Faltan columnas obligatorias: ${missing.join(", ")}.`);
    }

    const rows = [];
    const reportProgress = typeof onProgress === "function" ? onProgress : null;
    const totalRows = Math.max(0, matrix.length - 1);
    for (let rowIndex = 1; rowIndex < matrix.length; rowIndex += 1) {
      const cells = Array.isArray(matrix[rowIndex]) ? matrix[rowIndex] : [];
      const isBlank = cells.every((value) => String(value || "").trim() === "");
      if (isBlank) continue;

      rows.push({
        excelRow: rowIndex + 1,
        category: String(cells[columnIndexByKey.category] || "").replace(/\s+/g, " ").trim(),
        subcategory: String(cells[columnIndexByKey.subcategory] || "").replace(/\s+/g, " ").trim(),
        unit: String(cells[columnIndexByKey.unit] || "").replace(/\s+/g, " ").trim(),
        status: String(cells[columnIndexByKey.status] || "").replace(/\s+/g, " ").trim(),
        code: normalizeCode(cells[columnIndexByKey.code]),
        name: String(cells[columnIndexByKey.name] || "").replace(/\s+/g, " ").trim(),
        price: parseNumberValue(cells[columnIndexByKey.price]),
        discount: parseNumberValue(cells[columnIndexByKey.discount]),
        image: normalizeImagePath(cells[columnIndexByKey.image])
      });

      if (reportProgress && ((rowIndex % EXCEL_IMPORT_CHUNK_SIZE === 0) || rowIndex === matrix.length - 1)) {
        reportProgress(rowIndex, totalRows);
        await yieldToBrowser();
      }
    }

    if (!rows.length) {
      throw new Error("El Excel no contiene filas validas para procesar.");
    }

    return rows;
  }

  function inferBagCategoryKey(text) {
    const normalized = normalizeSearchText(text);
    if (!normalized) return "bolsa-negra";
    if (normalized.includes("roj")) return "bolsa-roja";
    if (normalized.includes("azul")) return "bolsa-azul";
    if (normalized.includes("verde")) return "bolsa-verde";
    if (normalized.includes("negr")) return "bolsa-negra";
    return "bolsa-negra";
  }

  function inferTachoCategoryKey(text) {
    const normalized = normalizeSearchText(text);
    if (!normalized) return "";
    if (/\b120\b/.test(normalized) || normalized.includes("120l")) return "tachos-120l";
    if (/\b75\b/.test(normalized) || normalized.includes("75l")) return "tachos-75l";
    if (/\b50\b/.test(normalized) || normalized.includes("50l")) return "tachos-50l";
    return "";
  }

  function inferPerfumadorCategoryKey(text) {
    const normalized = normalizeSearchText(text);
    if (!normalized) return "";
    if (
      normalized.includes("galon")
      || normalized.includes("gln")
      || /\b4l\b/.test(normalized)
      || /\b5l\b/.test(normalized)
      || /\blt\b/.test(normalized)
    ) {
      return "perfumadores-galon";
    }
    if (normalized.includes("spray") || normalized.includes("aerosol")) {
      return "perfumadores-spray";
    }
    return "perfumadores-spray";
  }

  function buildImportDescription(entry) {
    return buildProductMetaDescription({
      unit: entry.unit,
      sourceCategory: entry.category,
      sourceSubcategory: entry.subcategory
    });
  }

  function buildCatalogCategoryLookup() {
    const liveCatalog = catalogApi.getCatalogData();
    const normalizedLookup = new Map();

    Object.entries(liveCatalog).forEach(([categoryKey, categoryData]) => {
      const label = String(categoryData && categoryData.label ? categoryData.label : "").trim();
      const normalizedKey = normalizeSearchText(categoryKey);
      const normalizedLabel = normalizeSearchText(label);
      if (normalizedKey && !normalizedLookup.has(normalizedKey)) {
        normalizedLookup.set(normalizedKey, categoryKey);
      }
      if (normalizedLabel && !normalizedLookup.has(normalizedLabel)) {
        normalizedLookup.set(normalizedLabel, categoryKey);
      }
    });

    return normalizedLookup;
  }

  function resolveCatalogCategoryForExcelEntry(entry, normalizedLookup) {
    const categoryLookup = normalizedLookup instanceof Map ? normalizedLookup : buildCatalogCategoryLookup();
    const normalizedCategory = normalizeSearchText(entry.category);
    const normalizedSubcategory = normalizeSearchText(entry.subcategory);

    const candidates = [
      entry.subcategory,
      entry.category
    ]
      .map((value) => normalizeSearchText(value))
      .filter(Boolean);

    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      if (categoryLookup.has(candidate)) {
        return categoryLookup.get(candidate) || "";
      }
    }

    const combined = normalizeSearchText([
      entry.subcategory,
      entry.category,
      entry.name
    ].filter(Boolean).join(" "));

    if (!combined) return "";

    if (normalizedCategory.includes("control de plagas")) {
      if (normalizedSubcategory.includes("insectic")) return "insecticidas";
      if (normalizedSubcategory.includes("ratic")) return "raticidas";
      if (normalizedSubcategory.includes("fungic")) return "fungicida";
    }

    if (combined.includes("escoba") || combined.includes("baldeador") || combined.includes("escobillon")) {
      return "escobas";
    }
    if (combined.includes("perfumador") || combined.includes("ambientador")) {
      return inferPerfumadorCategoryKey(combined);
    }
    if (
      combined.includes("tacho")
      || combined.includes("papelera")
      || combined.includes("buzon")
      || combined.includes("contenedor")
    ) {
      return inferTachoCategoryKey(combined);
    }
    if (combined.includes("bolsa")) {
      return inferBagCategoryKey(combined);
    }
    if (combined.includes("insectic") || combined.includes("fumig")) {
      return "insecticidas";
    }
    if (combined.includes("ratic")) {
      return "raticidas";
    }
    if (combined.includes("fungic")) {
      return "fungicida";
    }
    if (
      combined.includes("sapolio")
      || combined.includes("lejia")
      || combined.includes("sacagrasa")
      || combined.includes("limpiador")
      || combined.includes("lavavajilla")
      || combined.includes("detergente")
      || combined.includes("jabon")
      || combined.includes("insecticida")
      || combined.includes("desinfectante")
    ) {
      return "sapolio";
    }

    return "";
  }

  function slugifyCategoryKey(value, fallback = "catalogo-general") {
    const normalized = normalizeSearchText(value)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    return normalized || fallback;
  }

  function buildExcelFallbackCategory(entry) {
    const preferredLabel = String(entry && (entry.subcategory || entry.category) ? (entry.subcategory || entry.category) : "").replace(/\s+/g, " ").trim();
    const baseLabel = preferredLabel || "Catalogo General";
    const baseKey = slugifyCategoryKey(baseLabel);
    return {
      key: baseKey,
      label: baseLabel
    };
  }

  async function validateExcelRows(importRows, rowMap, onProgress) {
    const errors = [];
    const warnings = [];
    const validRows = [];
    const categoryLookup = buildCatalogCategoryLookup();
    const dedupedRows = new Map();
    const reportProgress = typeof onProgress === "function" ? onProgress : null;

    for (let index = 0; index < importRows.length; index += 1) {
      const entry = importRows[index];
      const rowTag = `Fila ${entry.excelRow}`;
      const code = normalizeCode(entry.code);

      if (!code) {
        warnings.push(`${rowTag}: falta codigo. Se omitio.`);
        if (reportProgress && (((index + 1) % EXCEL_IMPORT_CHUNK_SIZE === 0) || index === importRows.length - 1)) {
          reportProgress(index + 1, importRows.length);
          await yieldToBrowser();
        }
        continue;
      }
      if (!isValidCode(code)) {
        warnings.push(`${rowTag}: SKU EUREKA invalido "${entry.code || "-"}". Se omitio.`);
        if (reportProgress && (((index + 1) % EXCEL_IMPORT_CHUNK_SIZE === 0) || index === importRows.length - 1)) {
          reportProgress(index + 1, importRows.length);
          await yieldToBrowser();
        }
        continue;
      }
      if (!entry.name) {
        warnings.push(`${rowTag}: nombre vacio para ${code}. Se omitio.`);
        if (reportProgress && (((index + 1) % EXCEL_IMPORT_CHUNK_SIZE === 0) || index === importRows.length - 1)) {
          reportProgress(index + 1, importRows.length);
          await yieldToBrowser();
        }
        continue;
      }

      const previous = dedupedRows.get(code);
      if (previous) {
        warnings.push(`${rowTag}: codigo duplicado ${code}. Se descarto la fila ${previous.excelRow} y prevalece esta.`);
        dedupedRows.delete(code);
      }

      dedupedRows.set(code, {
        ...entry,
        code
      });
      if (reportProgress && (((index + 1) % EXCEL_IMPORT_CHUNK_SIZE === 0) || index === importRows.length - 1)) {
        reportProgress(index + 1, importRows.length);
        await yieldToBrowser();
      }
    }

    const dedupedEntries = Array.from(dedupedRows.values());
    for (let index = 0; index < dedupedEntries.length; index += 1) {
      const entry = dedupedEntries[index];
      const rowTag = `Fila ${entry.excelRow}`;
      const code = normalizeCode(entry.code);
      const catalogRow = rowMap.get(code);

      let price = entry.price;
      let forceInactiveByPrice = false;
      if (!Number.isFinite(price) || price < 0) {
        warnings.push(`${rowTag}: precio vacio o invalido para ${code}. Se asigno 1.00 y quedara inactivo.`);
        price = 1;
        forceInactiveByPrice = true;
      }

      let discount = entry.discount;
      if (discount === null) discount = 0;
      if (!Number.isFinite(discount) || discount < 0 || discount > 90) {
        warnings.push(`${rowTag}: promo % invalida para ${code}. Se reemplazo por 0%.`);
        discount = 0;
      }

      let image = entry.image;
      if (!isValidImagePath(image)) {
        warnings.push(`${rowTag}: imagen invalida para ${code}. Se importo sin imagen.`);
        image = "";
      }

      const statusInfo = normalizeExcelStatus(entry.status);
      const baseActive = typeof statusInfo.active === "boolean"
        ? statusInfo.active
        : Boolean(catalogRow ? catalogRow.active : true);
      const active = forceInactiveByPrice ? false : baseActive;
      const resolvedCategoryKey = catalogRow ? catalogRow.categoryKey : resolveCatalogCategoryForExcelEntry(entry, categoryLookup);
      const fallbackCategory = !catalogRow && !resolvedCategoryKey && API_BASE ? buildExcelFallbackCategory(entry) : null;
      const importCategoryLabel = entry.subcategory || entry.category;
      const finalCategoryKey = catalogRow
        ? catalogRow.categoryKey
        : (resolvedCategoryKey || (fallbackCategory ? fallbackCategory.key : ""));
      const finalCategoryLabel = catalogRow
        ? (catalogRow.internalCategoryLabel || catalogRow.categoryLabel)
        : (fallbackCategory ? fallbackCategory.label : importCategoryLabel);

      if (catalogRow && importCategoryLabel) {
        const excelCategory = normalizeSearchText(importCategoryLabel);
        const catalogCandidates = [
          catalogRow.sourceSubcategory,
          catalogRow.sourceCategory,
          catalogRow.categoryLabel
        ]
          .map((value) => normalizeSearchText(value))
          .filter(Boolean);
        if (excelCategory && catalogCandidates.length && !catalogCandidates.includes(excelCategory)) {
          warnings.push(`${rowTag}: categoria "${importCategoryLabel}" no coincide con la taxonomia actual de ${code}.`);
        }
      }

      if (!catalogRow && !finalCategoryKey) {
        warnings.push(`${rowTag}: codigo ${code} no existe y no se pudo inferir una categoria valida desde "${importCategoryLabel || entry.category || "-"}". Se omitio.`);
        if (reportProgress && (((index + 1) % EXCEL_IMPORT_CHUNK_SIZE === 0) || index === dedupedEntries.length - 1)) {
          reportProgress(index + 1, dedupedEntries.length);
          await yieldToBrowser();
        }
        continue;
      }

      validRows.push({
        excelRow: entry.excelRow,
        catalogRow,
        categoryKey: finalCategoryKey,
        categoryLabel: finalCategoryLabel,
        code,
        name: entry.name,
        price: Number(price.toFixed(2)),
        discount: clampDiscount(discount),
        image,
        active,
        isCustom: Boolean(catalogRow ? catalogRow.isCustom : true),
        description: buildImportDescription(entry)
      });
      if (reportProgress && (((index + 1) % EXCEL_IMPORT_CHUNK_SIZE === 0) || index === dedupedEntries.length - 1)) {
        reportProgress(index + 1, dedupedEntries.length);
        await yieldToBrowser();
      }
    }

    return { validRows, errors, warnings };
  }

  function summarizeMessages(list, maxItems = 4) {
    const items = Array.isArray(list) ? list.filter(Boolean) : [];
    if (!items.length) return "";
    const visible = items.slice(0, maxItems).join(" ");
    const remaining = items.length - Math.min(items.length, maxItems);
    if (remaining <= 0) return visible;
    return `${visible} (+${remaining} mas)`;
  }

  async function applyExcelRows(validRows, onProgress) {
    let updated = 0;
    let created = 0;
    const reportProgress = typeof onProgress === "function" ? onProgress : null;

    for (let index = 0; index < validRows.length; index += 1) {
      const entry = validRows[index];
      const row = entry.catalogRow;
      if (!row) {
        const createCustom = await catalogApi.upsertCustomProduct({
          categoryKey: entry.categoryKey,
          code: entry.code,
          name: entry.name,
          price: entry.price,
          image: entry.image
        });
        if (!createCustom || !createCustom.ok) {
          return {
            ok: false,
            error: createCustom && createCustom.error
              ? createCustom.error
              : `No se pudo crear el producto ${entry.code}.`
          };
        }

        const createConfig = await catalogApi.setProductConfig(entry.code, {
          code: entry.code,
          name: entry.name,
          description: entry.description,
          price: entry.price,
          discountPct: entry.discount,
          active: entry.active,
          image: entry.image,
          isCustom: true,
          categoryKey: entry.categoryKey
        });
        if (!createConfig || !createConfig.ok) {
          return {
            ok: false,
            error: createConfig && createConfig.error
              ? createConfig.error
              : `No se pudo guardar la configuracion inicial de ${entry.code}.`
          };
        }
        created += 1;
        if (reportProgress && (((index + 1) % EXCEL_IMPORT_CHUNK_SIZE === 0) || index === validRows.length - 1)) {
          reportProgress(index + 1, validRows.length);
          await yieldToBrowser();
        }
        continue;
      }

      if (row.isCustom) {
        const updateCustom = await catalogApi.upsertCustomProduct({
          categoryKey: row.categoryKey,
          code: entry.code,
          name: entry.name,
          description: entry.description,
          price: entry.price,
          image: entry.image
        });

        if (!updateCustom || !updateCustom.ok) {
          return {
            ok: false,
            error: updateCustom && updateCustom.error
              ? updateCustom.error
              : `No se pudo actualizar el producto personalizado ${entry.code}.`
          };
        }
      }

      const configCode = row.isCustom
        ? entry.code
        : normalizeCode(row.baseCode || row.code || entry.code);

      const configResult = await catalogApi.setProductConfig(configCode, {
        code: entry.code,
        name: entry.name,
        description: entry.description,
        price: entry.price,
        discountPct: entry.discount,
        active: entry.active,
        image: entry.image
      });
      if (!configResult || !configResult.ok) {
        return {
          ok: false,
          error: configResult && configResult.error
            ? configResult.error
            : `No se pudo actualizar el producto ${entry.code}.`
        };
      }

      updated += 1;

      if (reportProgress && (((index + 1) % EXCEL_IMPORT_CHUNK_SIZE === 0) || index === validRows.length - 1)) {
        reportProgress(index + 1, validRows.length);
        await yieldToBrowser();
      }
    }

    return { ok: true, updated, created };
  }

  async function applyExcelRowsWithBackendImport(validRows, onProgress) {
    const token = getSessionToken();
    if (!token) {
      throw new Error("Sesion invalida. Inicia sesion como administrador.");
    }

    const reportProgress = typeof onProgress === "function" ? onProgress : null;
    let updated = 0;
    let created = 0;
    const warnings = [];

    async function requestBackendImportChunk(payloadRows) {
      let response;
      try {
        response = await fetch(toApiUrl("/api/catalog/import"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ rows: payloadRows })
        });
      } catch (error) {
        const connectionError = new Error("No se pudo conectar con el backend para importar el Excel.");
        connectionError.backendErrors = [];
        throw connectionError;
      }

      let payload = null;
      try {
        payload = await response.json();
      } catch (error) {
        payload = null;
      }

      if (!response.ok || !payload || payload.ok === false) {
        const requestError = new Error(
          payload && payload.error
            ? payload.error
            : "No se pudo importar el bloque actual del Excel."
        );
        requestError.backendErrors = payload && Array.isArray(payload.errors) ? payload.errors : [];
        throw requestError;
      }

      return payload;
    }

    for (let start = 0; start < validRows.length; start += EXCEL_IMPORT_CHUNK_SIZE) {
      const chunk = validRows.slice(start, start + EXCEL_IMPORT_CHUNK_SIZE);
      const payloadRows = chunk.map((entry) => ({
        categoryKey: entry.categoryKey,
        categoryLabel: entry.categoryLabel,
        code: entry.code,
        name: entry.name,
        description: entry.description,
        price: entry.price,
        discountPct: entry.discount,
        image: entry.image,
        active: entry.active,
        isCustom: entry.isCustom
      }));

      try {
        await requestBackendImportChunk(payloadRows);
        chunk.forEach((entry) => {
          if (entry.catalogRow) {
            updated += 1;
          } else {
            created += 1;
          }
        });
      } catch (error) {
        const backendErrors = Array.isArray(error && error.backendErrors) ? error.backendErrors : [];
        if (chunk.length === 1) {
          const entry = chunk[0];
          const errorText = backendErrors.length
            ? summarizeMessages(backendErrors, 1)
            : (error && error.message ? error.message : "Error de backend.");
          warnings.push(`Fila ${entry.excelRow || "?"}: ${errorText}`);
        } else {
          for (let index = 0; index < chunk.length; index += 1) {
            const entry = chunk[index];
            const singlePayload = [{
              categoryKey: entry.categoryKey,
              categoryLabel: entry.categoryLabel,
              code: entry.code,
              name: entry.name,
              description: entry.description,
              price: entry.price,
              discountPct: entry.discount,
              image: entry.image,
              active: entry.active,
              isCustom: entry.isCustom
            }];

            try {
              await requestBackendImportChunk(singlePayload);
              if (entry.catalogRow) {
                updated += 1;
              } else {
                created += 1;
              }
            } catch (singleError) {
              const singleBackendErrors = Array.isArray(singleError && singleError.backendErrors) ? singleError.backendErrors : [];
              const singleErrorText = singleBackendErrors.length
                ? summarizeMessages(singleBackendErrors, 1)
                : (singleError && singleError.message ? singleError.message : "Error de backend.");
              warnings.push(`Fila ${entry.excelRow || "?"}: ${singleErrorText}`);
            }

            if (reportProgress) {
              reportProgress(Math.min(validRows.length, start + index + 1), validRows.length);
            }
            await yieldToBrowser();
          }
          continue;
        }
      }

      if (reportProgress) {
        reportProgress(Math.min(validRows.length, start + chunk.length), validRows.length);
      }
      await yieldToBrowser();
    }

    if (catalogApi && typeof catalogApi.refreshBackendCatalog === "function") {
      await catalogApi.refreshBackendCatalog();
    }

    return { ok: true, updated, created, warnings };
  }

  async function processExcelFile(file) {
    if (!file) return;
    if (excelImportInProgress) {
      showExcelAlert("secondary", "Ya hay una importacion Excel en curso. Espera a que termine.");
      return;
    }
    const fileName = String(file.name || "");
    setExcelFileName(fileName);
    if (!/\.(xlsx|xls)$/i.test(fileName)) {
      showExcelAlert("warning", "Archivo no valido. Usa un Excel con extension .xlsx o .xls.");
      return;
    }
    hideStatus();
    setExcelImportBusy(true);
    showExcelAlert("secondary", "Preparando archivo Excel...");

    try {
      const importRows = await parseExcelRows(file, (processed, total) => {
        showExcelAlert("secondary", buildExcelProgressMessage("Leyendo filas del Excel", processed, total));
      });
      const rowMap = buildCatalogRowMap();
      const validation = await validateExcelRows(importRows, rowMap, (processed, total) => {
        showExcelAlert("secondary", buildExcelProgressMessage("Validando filas", processed, total));
      });

      if (validation.errors.length) {
        showExcelAlert("warning", `Importacion cancelada. ${summarizeMessages(validation.errors, 5)}`);
        return;
      }

      if (!validation.validRows.length) {
        showExcelAlert(
          "warning",
          validation.warnings.length
            ? `No hubo filas importables. ${summarizeMessages(validation.warnings, 5)}`
            : "No hubo filas importables en el Excel."
        );
        return;
      }

      const importProgress = (processed, total) => {
        showExcelAlert("secondary", buildExcelProgressMessage("Importando productos", processed, total));
      };
      const canUseBackendBulkImport = Boolean(API_BASE && getSessionToken());
      const result = canUseBackendBulkImport
        ? await applyExcelRowsWithBackendImport(validation.validRows, importProgress)
        : await applyExcelRows(validation.validRows, importProgress);
      if (!result || !result.ok) {
        showExcelAlert("warning", result && result.error ? result.error : "No se pudieron aplicar los cambios del Excel.");
        return;
      }

      renderTable();
      assignNextSkuToNewProductField(true);

      const importWarnings = result && Array.isArray(result.warnings) ? result.warnings : [];
      const combinedWarnings = validation.warnings.concat(importWarnings);
      const warningText = combinedWarnings.length
        ? ` Advertencias: ${summarizeMessages(combinedWarnings, 2)}`
        : "";
      showExcelAlert("success", `Importacion correcta. ${result.updated} actualizado(s), ${result.created || 0} creado(s).${warningText}`);
    } catch (error) {
      showExcelAlert("warning", error && error.message ? error.message : "No se pudo procesar el Excel.");
    } finally {
      setExcelImportBusy(false);
    }
  }

  function requestTwoStepConfirmation(options) {
    const settings = options && typeof options === "object" ? options : {};
    const title = String(settings.title || "Confirmar accion");
    const message = String(settings.message || "Estas por aplicar cambios importantes.");
    const keyword = String(settings.keyword || "CONFIRMAR").trim().toUpperCase();
    const confirmLabel = String(settings.confirmLabel || "Confirmar");
    const danger = Boolean(settings.danger);

    if (
      !editorConfirmModal
      || !editorConfirmTitle
      || !editorConfirmMessage
      || !editorConfirmStepLabel
      || !editorConfirmStepOne
      || !editorConfirmStepTwo
      || !editorConfirmKeywordView
      || !editorConfirmKeywordInput
      || !editorConfirmError
      || !editorConfirmCancelBtn
      || !editorConfirmNextBtn
      || !editorConfirmAcceptBtn
    ) {
      const firstOk = window.confirm(message);
      if (!firstOk) return Promise.resolve(false);
      const token = window.prompt(`Escribe ${keyword} para confirmar.`);
      return Promise.resolve(String(token || "").trim().toUpperCase() === keyword);
    }

    return new Promise((resolve) => {
      let currentStep = 1;
      const cleanups = [];

      function bind(target, eventName, handler) {
        if (!target) return;
        target.addEventListener(eventName, handler);
        cleanups.push(() => target.removeEventListener(eventName, handler));
      }

      function close(result) {
        editorConfirmModal.classList.add("d-none");
        editorConfirmModal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("editor-confirm-open");
        editorConfirmKeywordInput.value = "";
        editorConfirmError.classList.add("d-none");
        cleanups.forEach((fn) => fn());
        resolve(Boolean(result));
      }

      function openStep(step) {
        currentStep = step;
        const isStepTwo = step === 2;
        editorConfirmStepLabel.textContent = isStepTwo ? "PASO 2 DE 2" : "PASO 1 DE 2";
        editorConfirmStepOne.classList.toggle("d-none", isStepTwo);
        editorConfirmStepTwo.classList.toggle("d-none", !isStepTwo);
        editorConfirmNextBtn.classList.toggle("d-none", isStepTwo);
        editorConfirmAcceptBtn.classList.toggle("d-none", !isStepTwo);
        editorConfirmError.classList.add("d-none");
        if (isStepTwo) {
          editorConfirmKeywordInput.focus();
          editorConfirmKeywordInput.select();
        }
      }

      editorConfirmTitle.textContent = title;
      editorConfirmMessage.textContent = message;
      editorConfirmKeywordView.textContent = keyword;
      editorConfirmAcceptBtn.textContent = confirmLabel;
      editorConfirmAcceptBtn.className = `btn btn-sm ${danger ? "btn-danger" : "btn-success"}`;
      editorConfirmKeywordInput.value = "";
      openStep(1);

      const closeButtons = editorConfirmModal.querySelectorAll("[data-confirm-close]");
      closeButtons.forEach((button) => {
        bind(button, "click", () => close(false));
      });

      bind(editorConfirmCancelBtn, "click", () => close(false));
      bind(editorConfirmNextBtn, "click", () => openStep(2));
      bind(editorConfirmAcceptBtn, "click", () => {
        const typed = String(editorConfirmKeywordInput.value || "").trim().toUpperCase();
        if (typed !== keyword) {
          editorConfirmError.classList.remove("d-none");
          editorConfirmKeywordInput.focus();
          editorConfirmKeywordInput.select();
          return;
        }
        close(true);
      });

      bind(editorConfirmModal, "keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          close(false);
          return;
        }
        if (event.key !== "Enter") return;
        event.preventDefault();
        if (currentStep === 1) {
          openStep(2);
        } else {
          editorConfirmAcceptBtn.click();
        }
      });

      editorConfirmModal.classList.remove("d-none");
      editorConfirmModal.setAttribute("aria-hidden", "false");
      document.body.classList.add("editor-confirm-open");
      editorConfirmNextBtn.focus();
    });
  }

  function getRows() {
    const liveCatalog = catalogApi.getCatalogData();
    const configMap = catalogApi.getCatalogConfigMap();
    const defaultPromoMap = catalogApi.buildDefaultPromoMap(liveCatalog);
    const rows = [];

    Object.entries(liveCatalog).forEach(([categoryKey, categoryData]) => {
      categoryData.items.forEach((baseItem) => {
        const item = catalogApi.applyConfigToItem(baseItem, configMap, defaultPromoMap);
        const description = String(item.description || baseItem.description || "").trim();
        const meta = parseProductMetaDescription(description);
        rows.push({
          categoryKey,
          internalCategoryLabel: categoryData.label,
          categoryLabel: buildVisibleCategoryLabel(meta.sourceCategory, meta.sourceSubcategory, categoryData.label),
          sourceCategory: meta.sourceCategory,
          sourceSubcategory: meta.sourceSubcategory,
          unit: meta.unit,
          baseCode: normalizeCode(item.sourceCode || baseItem.code || item.code),
          baseName: String(baseItem && baseItem.name ? baseItem.name : item.name || "").trim(),
          code: item.code,
          name: item.name,
          description,
          image: item.image || "",
          basePrice: Number(item.originalPrice || baseItem.price || 0),
          finalPrice: Number(item.price || 0),
          discountPct: Number(item.discountPct || 0),
          active: Boolean(item.active),
          isCustom: Boolean(item.isCustom)
        });
      });
    });

    return rows;
  }

  function getFilteredRows() {
    const query = normalizeSearchText(searchQuery);
    if (!query) return getRows();

    return getRows().filter((row) => {
      const searchable = normalizeSearchText([
        row.categoryLabel,
        row.internalCategoryLabel,
        row.sourceCategory,
        row.sourceSubcategory,
        row.unit,
        row.code,
        row.name,
        row.description || ""
      ].join(" "));
      return searchable.includes(query);
    });
  }

  function getRowName(rowEl) {
    const inputName = rowEl ? rowEl.querySelector('[data-field="name"]') : null;
    const typedName = String(inputName && inputName.value ? inputName.value : "").replace(/\s+/g, " ").trim();
    if (typedName) return typedName;
    return String((rowEl && rowEl.dataset ? rowEl.dataset.name : "") || (rowEl && rowEl.dataset ? rowEl.dataset.code : "") || "producto").trim();
  }

  function updateRowFileInputLabel(fileInput, fileName = "") {
    if (!(fileInput instanceof HTMLElement)) return;
    const rowEl = fileInput.closest("tr[data-code]");
    if (!rowEl) return;
    const fileNameEl = rowEl.querySelector('[data-role="image-file-name"]');
    if (!fileNameEl) return;
    const safeName = String(fileName || "").replace(/\s+/g, " ").trim();
    fileNameEl.textContent = safeName || "Ningun archivo";
  }

  function isCodeAlreadyUsed(nextCode, currentBaseCode) {
    const safeNextCode = normalizeCode(nextCode);
    const safeCurrentBaseCode = normalizeCode(currentBaseCode);
    if (!safeNextCode) return false;

    return getRows().some((row) =>
      normalizeCode(row.code) === safeNextCode
      && normalizeCode(row.baseCode) !== safeCurrentBaseCode
    );
  }

  function buildImageMarkup(image, name) {
    if (!image) {
      return '<span class="editor-image-empty">Sin imagen</span>';
    }
    return `<img src="${escapeHtml(image)}" alt="${escapeHtml(name)}" loading="lazy" onerror="this.parentElement.classList.add('is-broken');this.remove();">`;
  }

  function setImagePreview(boxEl, image, name) {
    if (!boxEl) return;
    boxEl.classList.remove("is-broken");
    boxEl.innerHTML = buildImageMarkup(image, name);
  }

  function updateRowTaxonomyPresentation(rowEl) {
    if (!rowEl) return;
    const internalCategoryLabel = sanitizeMetaText(rowEl.dataset.internalCategoryLabel || "", 120) || "Sin categoria";
    const sourceCategory = sanitizeMetaText(rowEl.dataset.sourceCategory || "", 120);
    const sourceSubcategory = sanitizeMetaText(rowEl.dataset.sourceSubcategory || "", 120);
    const displayLabel = buildVisibleCategoryLabel(sourceCategory, sourceSubcategory, internalCategoryLabel);

    const displayInput = rowEl.querySelector('[data-role="category-display"]');
    const sourceCategoryEl = rowEl.querySelector('[data-role="source-category"]');
    const sourceSubcategoryEl = rowEl.querySelector('[data-role="source-subcategory"]');
    const internalCategoryEl = rowEl.querySelector('[data-role="internal-category"]');

    if (displayInput) displayInput.value = displayLabel;
    if (sourceCategoryEl) {
      sourceCategoryEl.textContent = `Categoria: ${sourceCategory || internalCategoryLabel}`;
    }
    if (sourceSubcategoryEl) {
      sourceSubcategoryEl.textContent = `Subcategoria: ${sourceSubcategory || sourceCategory || internalCategoryLabel}`;
    }
    if (internalCategoryEl) {
      internalCategoryEl.textContent = `Base interna: ${internalCategoryLabel}`;
    }
  }

  function collectRowDraft(rowEl) {
    if (!rowEl) return null;
    const codeInput = rowEl.querySelector('[data-field="code"]');
    const nameInput = rowEl.querySelector('[data-field="name"]');
    const priceInput = rowEl.querySelector('[data-field="price"]');
    const discountInput = rowEl.querySelector('[data-field="discount"]');
    const imageInput = rowEl.querySelector('[data-field="image"]');
    const categoryInput = rowEl.querySelector('[data-role="category-display"]');
    const internalCategoryLabel = sanitizeMetaText(rowEl.dataset.internalCategoryLabel || "", 120);
    const sourceCategory = sanitizeMetaText(rowEl.dataset.sourceCategory || "", 120);
    const sourceSubcategory = sanitizeMetaText(rowEl.dataset.sourceSubcategory || "", 120);
    const unit = sanitizeMetaText(rowEl.dataset.unit || "", 40);
    const categoryLabel = buildVisibleCategoryLabel(
      sourceCategory,
      sourceSubcategory,
      String(categoryInput && categoryInput.value ? categoryInput.value : "").trim() || internalCategoryLabel
    );
    const code = normalizeCode(codeInput && codeInput.value ? codeInput.value : rowEl.dataset.code);
    const name = String(nameInput && nameInput.value ? nameInput.value : rowEl.dataset.name || "").replace(/\s+/g, " ").trim() || code || "Producto";
    const basePrice = Number(priceInput && priceInput.value ? priceInput.value : 0);
    const discountPct = clampDiscount(discountInput && discountInput.value ? discountInput.value : 0);
    const finalPrice = calculateFinalPrice(basePrice, discountPct);
    const image = normalizeImagePath(imageInput && imageInput.value ? imageInput.value : "");
    const description = buildProductMetaDescription({
      unit,
      sourceCategory,
      sourceSubcategory,
      extraParts: parseProductMetaDescription(rowEl.dataset.description || "").extraParts
    });
    const active = String(rowEl.dataset.active || "0") === "1";
    const isCustom = String(rowEl.dataset.isCustom || "0") === "1";

    return {
      categoryLabel,
      internalCategoryLabel,
      sourceCategory,
      sourceSubcategory,
      unit,
      code,
      name,
      basePrice: Number.isFinite(basePrice) ? Math.max(0, basePrice) : 0,
      finalPrice,
      discountPct,
      image,
      description,
      active,
      isCustom
    };
  }

  function buildPreviewDescription(data) {
    if (!data) return "Selecciona un producto de la tabla para ver su vista previa antes de guardar.";
    const parsedDescription = parseProductMetaDescription(data.description || "");
    const taxonomyNotes = [];
    if (data.sourceCategory || parsedDescription.sourceCategory) {
      taxonomyNotes.push(`Categoria: ${data.sourceCategory || parsedDescription.sourceCategory}.`);
    }
    if (data.sourceSubcategory || parsedDescription.sourceSubcategory) {
      taxonomyNotes.push(`Subcategoria: ${data.sourceSubcategory || parsedDescription.sourceSubcategory}.`);
    }
    if (data.unit || parsedDescription.unit) {
      taxonomyNotes.push(`UM: ${data.unit || parsedDescription.unit}.`);
    }
    if (parsedDescription.extraParts.length) {
      taxonomyNotes.push(parsedDescription.extraParts.join(" | "));
    }

    const promoText = data.discountPct > 0
      ? `Promocion activa del ${Math.round(data.discountPct)}% aplicada sobre el precio base.`
      : "Sin promocion activa en este momento.";
    const stateText = data.active
      ? "Actualmente visible para clientes en el catalogo."
      : "Actualmente retirado del catalogo y oculto para clientes.";
    return [...taxonomyNotes, promoText, stateText].filter(Boolean).join(" ");
  }

  function getEditorProductPreviewModal() {
    if (!editorProductPreviewModalEl || !window.bootstrap || !window.bootstrap.Modal) return null;
    if (!editorProductPreviewModalInstance) {
      editorProductPreviewModalInstance = new window.bootstrap.Modal(editorProductPreviewModalEl);
    }
    return editorProductPreviewModalInstance;
  }

  function getEditorImageCropModal() {
    if (!editorImageCropModalEl || !window.bootstrap || !window.bootstrap.Modal) return null;
    if (!editorImageCropModalInstance) {
      editorImageCropModalInstance = new window.bootstrap.Modal(editorImageCropModalEl);
    }
    return editorImageCropModalInstance;
  }

  function paintEditorModalPreview(categoryLabel = "") {
    const rowDraft = collectRowDraft(editorModalEditingRow);
    const modalSourceCategory = sanitizeMetaText(editorModalSourceCategoryInput ? editorModalSourceCategoryInput.value : "", 120);
    const modalSourceSubcategory = sanitizeMetaText(editorModalSourceSubcategoryInput ? editorModalSourceSubcategoryInput.value : "", 120);
    const modalUnit = sanitizeMetaText(editorModalUnitInput ? editorModalUnitInput.value : "", 40);
    const resolvedCategory = buildVisibleCategoryLabel(
      modalSourceCategory || (rowDraft && rowDraft.sourceCategory) || "",
      modalSourceSubcategory || (rowDraft && rowDraft.sourceSubcategory) || "",
      String(categoryLabel || (rowDraft && rowDraft.internalCategoryLabel) || "Catalogo").trim() || "Catalogo"
    );
    const fallbackCode = rowDraft && rowDraft.code ? rowDraft.code : "";
    const fallbackName = rowDraft && rowDraft.name ? rowDraft.name : "Producto";
    const fallbackImage = rowDraft && rowDraft.image ? rowDraft.image : "";
    const fallbackDescription = rowDraft && rowDraft.description ? rowDraft.description : "";
    const fallbackNotes = parseProductMetaDescription(fallbackDescription).extraParts.join(" | ");

    const code = normalizeCode(editorModalCodeInput ? editorModalCodeInput.value : fallbackCode);
    const name = String(editorModalNameInput ? editorModalNameInput.value : fallbackName).replace(/\s+/g, " ").trim() || fallbackName || "Producto";
    const basePrice = Number(editorModalPriceInput ? editorModalPriceInput.value : (rowDraft ? rowDraft.basePrice : 0));
    const discountPct = clampDiscount(editorModalDiscountInput ? editorModalDiscountInput.value : (rowDraft ? rowDraft.discountPct : 0));
    const finalPrice = calculateFinalPrice(basePrice, discountPct);
    const image = normalizeImagePath(editorModalImageInput ? editorModalImageInput.value : fallbackImage);
    const description = buildProductMetaDescription({
      unit: modalUnit || (rowDraft && rowDraft.unit) || "",
      sourceCategory: modalSourceCategory || (rowDraft && rowDraft.sourceCategory) || "",
      sourceSubcategory: modalSourceSubcategory || (rowDraft && rowDraft.sourceSubcategory) || "",
      extraParts: [sanitizeDescription(editorModalDescriptionInput ? editorModalDescriptionInput.value : fallbackNotes)].filter(Boolean)
    });
    const active = Boolean(editorModalActiveInput && editorModalActiveInput.checked);

    if (editorProductPreviewCategory) {
      editorProductPreviewCategory.textContent = resolvedCategory;
    }
    if (editorProductPreviewName) {
      editorProductPreviewName.textContent = name;
    }
    if (editorProductPreviewCode) {
      editorProductPreviewCode.textContent = code ? `SKU EUREKA: ${code}` : "SKU EUREKA no disponible";
    }
    if (editorProductPreviewDescription) {
      editorProductPreviewDescription.textContent = buildPreviewDescription({
        description,
        sourceCategory: modalSourceCategory || (rowDraft && rowDraft.sourceCategory) || "",
        sourceSubcategory: modalSourceSubcategory || (rowDraft && rowDraft.sourceSubcategory) || "",
        unit: modalUnit || (rowDraft && rowDraft.unit) || "",
        discountPct,
        active
      });
    }
    if (editorProductPreviewState) {
      const isCustom = rowDraft ? rowDraft.isCustom : false;
      editorProductPreviewState.textContent = active
        ? (isCustom ? "Activo (nuevo)" : "Activo")
        : "Retirado";
      editorProductPreviewState.classList.toggle("product-preview-stock-retired", !active);
    }
    if (editorProductPreviewPrice) {
      editorProductPreviewPrice.textContent = `S/. ${toMoney(finalPrice)}`;
    }
    if (editorProductPreviewOldPrice) {
      const safeBase = Number.isFinite(basePrice) ? Math.max(0, basePrice) : 0;
      if (discountPct > 0 && finalPrice < safeBase) {
        editorProductPreviewOldPrice.textContent = `Antes: S/. ${toMoney(safeBase)}`;
        editorProductPreviewOldPrice.classList.remove("d-none");
      } else {
        editorProductPreviewOldPrice.textContent = "";
        editorProductPreviewOldPrice.classList.add("d-none");
      }
    }
    if (editorProductPreviewImage) {
      editorProductPreviewImage.src = image || EDITOR_FALLBACK_IMAGE;
      editorProductPreviewImage.alt = name || "Producto";
      editorProductPreviewImage.onerror = () => {
        if (!editorProductPreviewImage) return;
        editorProductPreviewImage.onerror = null;
        editorProductPreviewImage.src = EDITOR_FALLBACK_IMAGE;
      };
    }
  }

  function pushModalValuesToRow(rowEl) {
    if (!rowEl) return;
    const rowDraft = collectRowDraft(rowEl);
    const codeInput = rowEl.querySelector('[data-field="code"]');
    const nameInput = rowEl.querySelector('[data-field="name"]');
    const priceInput = rowEl.querySelector('[data-field="price"]');
    const discountInput = rowEl.querySelector('[data-field="discount"]');
    const imageInput = rowEl.querySelector('[data-field="image"]');
    const previewBox = rowEl.querySelector('[data-role="image-preview"]');

    const nextCode = normalizeCode(editorModalCodeInput ? editorModalCodeInput.value : rowDraft && rowDraft.code);
    const nextName = String(editorModalNameInput ? editorModalNameInput.value : rowDraft && rowDraft.name).replace(/\s+/g, " ").trim();
    const nextPrice = Number(editorModalPriceInput ? editorModalPriceInput.value : rowDraft && rowDraft.basePrice);
    const nextDiscount = clampDiscount(editorModalDiscountInput ? editorModalDiscountInput.value : rowDraft && rowDraft.discountPct);
    const nextImage = normalizeImagePath(editorModalImageInput ? editorModalImageInput.value : rowDraft && rowDraft.image);
    const nextSourceCategory = sanitizeMetaText(editorModalSourceCategoryInput ? editorModalSourceCategoryInput.value : rowDraft && rowDraft.sourceCategory, 120);
    const nextSourceSubcategory = sanitizeMetaText(editorModalSourceSubcategoryInput ? editorModalSourceSubcategoryInput.value : rowDraft && rowDraft.sourceSubcategory, 120);
    const nextUnit = sanitizeMetaText(editorModalUnitInput ? editorModalUnitInput.value : rowDraft && rowDraft.unit, 40);
    const nextNotes = sanitizeDescription(editorModalDescriptionInput ? editorModalDescriptionInput.value : "");
    const nextDescription = buildProductMetaDescription({
      unit: nextUnit,
      sourceCategory: nextSourceCategory,
      sourceSubcategory: nextSourceSubcategory,
      extraParts: nextNotes ? [nextNotes] : []
    });
    const nextActive = Boolean(editorModalActiveInput && editorModalActiveInput.checked);

    if (codeInput && !codeInput.readOnly) codeInput.value = nextCode;
    if (nameInput) nameInput.value = nextName;
    if (priceInput && Number.isFinite(nextPrice) && nextPrice >= 0) priceInput.value = toMoney(nextPrice);
    if (discountInput) discountInput.value = String(Math.round(nextDiscount));
    if (imageInput) imageInput.value = nextImage;

    rowEl.dataset.name = nextName || rowEl.dataset.name || "";
    rowEl.dataset.description = nextDescription;
    rowEl.dataset.sourceCategory = nextSourceCategory;
    rowEl.dataset.sourceSubcategory = nextSourceSubcategory;
    rowEl.dataset.unit = nextUnit;
    rowEl.dataset.active = nextActive ? "1" : "0";

    updateFinalPricePreview(rowEl);
    updateRowTaxonomyPresentation(rowEl);
    setImagePreview(previewBox, nextImage, nextName || getRowName(rowEl));
    if (isPreviewSelectedRow(rowEl)) {
      paintLivePreview(collectRowDraft(rowEl));
    }
  }

  async function saveEditorModalChanges() {
    let rowEl = editorModalEditingRow;
    if ((!rowEl || !rowEl.isConnected) && editorTableBody && editorModalEditingBaseCode) {
      rowEl = editorTableBody.querySelector(`tr[data-base-code="${editorModalEditingBaseCode}"]`);
    }
    if (!rowEl) return;
    pushModalValuesToRow(rowEl);
    const result = await saveRow(rowEl, {
      skipConfirm: true,
      successMessage: "Cambios guardados desde la ventana emergente."
    });
    if (!result || !result.ok) return;
    const modal = getEditorProductPreviewModal();
    if (modal) modal.hide();
    editorModalEditingRow = null;
    editorModalEditingBaseCode = "";
  }

  function openEditorProductPreview(rowEl) {
    if (!rowEl || !editorProductPreviewModalEl) return;
    const data = collectRowDraft(rowEl);
    if (!data) return;
    editorModalEditingRow = rowEl;
    editorModalEditingBaseCode = normalizeCode(rowEl.dataset.baseCode || rowEl.dataset.code);

    if (editorModalCodeInput) {
      editorModalCodeInput.value = data.code || "";
      editorModalCodeInput.readOnly = !data.isCustom;
      editorModalCodeInput.title = data.isCustom ? "" : "SKU EUREKA base bloqueado";
    }
    if (editorModalNameInput) editorModalNameInput.value = data.name || "";
    if (editorModalPriceInput) editorModalPriceInput.value = toMoney(data.basePrice);
    if (editorModalDiscountInput) editorModalDiscountInput.value = String(Math.round(data.discountPct));
    if (editorModalSourceCategoryInput) editorModalSourceCategoryInput.value = data.sourceCategory || "";
    if (editorModalSourceSubcategoryInput) editorModalSourceSubcategoryInput.value = data.sourceSubcategory || "";
    if (editorModalUnitInput) editorModalUnitInput.value = data.unit || "";
    if (editorModalImageInput) editorModalImageInput.value = data.image || "";
    if (editorModalImageUploadInput) editorModalImageUploadInput.value = "";
    if (editorModalDescriptionInput) {
      editorModalDescriptionInput.value = parseProductMetaDescription(data.description || "").extraParts.join(" | ");
    }
    if (editorModalActiveInput) editorModalActiveInput.checked = Boolean(data.active);
    resetModalCropper();
    paintEditorModalPreview(data.internalCategoryLabel || "Catalogo");

    const modal = getEditorProductPreviewModal();
    if (modal) modal.show();
  }

  function clearLivePreviewHideTimer() {
    if (!livePreviewHideTimer) return;
    clearTimeout(livePreviewHideTimer);
    livePreviewHideTimer = null;
  }

  function showLivePreviewPanel() {
    if (!editorLivePreview) return;
    editorLivePreview.classList.remove("editor-live-preview-hidden");
  }

  function hideLivePreviewPanel() {
    if (!editorLivePreview) return;
    editorLivePreview.classList.add("editor-live-preview-hidden");
  }

  function scheduleLivePreviewHide() {
    if (!editorLivePreview || !selectedRowBaseCode) return;
    clearLivePreviewHideTimer();
    livePreviewHideTimer = setTimeout(() => {
      hideLivePreviewPanel();
    }, LIVE_PREVIEW_TIMEOUT_MS);
  }

  function paintLivePreview(data) {
    if (
      !editorLivePreview
      || !editorPreviewImageBox
      || !editorPreviewCategory
      || !editorPreviewName
      || !editorPreviewCode
      || !editorPreviewPromoStatus
      || !editorPreviewState
      || !editorPreviewFinalPrice
      || !editorPreviewBasePrice
      || !editorPreviewDescription
    ) {
      return;
    }

    if (!data) {
      clearLivePreviewHideTimer();
      showLivePreviewPanel();
      editorPreviewCategory.textContent = "Sin categoria";
      editorPreviewName.textContent = "Selecciona una fila para ver la vista previa";
      editorPreviewCode.textContent = "SKU EUREKA: -";
      paintPromoStatus(editorPreviewPromoStatus, 0);
      editorPreviewState.textContent = "Sin seleccionar";
      editorPreviewState.classList.remove("badge-active");
      editorPreviewState.classList.add("badge-retired");
      editorPreviewFinalPrice.textContent = "S/. 0.00";
      editorPreviewBasePrice.classList.add("d-none");
      editorPreviewBasePrice.textContent = "";
      editorPreviewDescription.textContent = buildPreviewDescription(null);
      setImagePreview(editorPreviewImageBox, "", "Producto");
      return;
    }

    editorPreviewCategory.textContent = data.categoryLabel || "Sin categoria";
    editorPreviewName.textContent = data.name || "Producto";
    editorPreviewCode.textContent = `SKU EUREKA: ${data.code || "-"}`;
    paintPromoStatus(editorPreviewPromoStatus, data.discountPct);

    if (data.active) {
      editorPreviewState.textContent = data.isCustom ? "Activo (nuevo)" : "Activo";
      editorPreviewState.classList.remove("badge-retired");
      editorPreviewState.classList.add("badge-active");
    } else {
      editorPreviewState.textContent = "Retirado";
      editorPreviewState.classList.remove("badge-active");
      editorPreviewState.classList.add("badge-retired");
    }

    editorPreviewFinalPrice.textContent = `S/. ${toMoney(data.finalPrice)}`;
    if (data.discountPct > 0 && data.finalPrice < data.basePrice) {
      editorPreviewBasePrice.textContent = `Antes: S/. ${toMoney(data.basePrice)}`;
      editorPreviewBasePrice.classList.remove("d-none");
    } else {
      editorPreviewBasePrice.textContent = "";
      editorPreviewBasePrice.classList.add("d-none");
    }

    editorPreviewDescription.textContent = buildPreviewDescription(data);
    setImagePreview(editorPreviewImageBox, data.image, data.name);
    showLivePreviewPanel();
    scheduleLivePreviewHide();
  }

  function refreshSelectedRowStyles() {
    if (!editorTableBody) return;
    const rows = editorTableBody.querySelectorAll("tr[data-base-code]");
    rows.forEach((row) => {
      const baseCode = normalizeCode(row.dataset.baseCode || row.dataset.code);
      row.classList.toggle("editor-row-selected", Boolean(baseCode) && baseCode === selectedRowBaseCode);
    });
  }

  function selectRowForPreview(rowEl) {
    if (!rowEl) return;
    selectedRowBaseCode = normalizeCode(rowEl.dataset.baseCode || rowEl.dataset.code);
    refreshSelectedRowStyles();
    paintLivePreview(collectRowDraft(rowEl));
  }

  function isPreviewSelectedRow(rowEl) {
    if (!rowEl) return false;
    const baseCode = normalizeCode(rowEl.dataset.baseCode || rowEl.dataset.code);
    return Boolean(baseCode) && baseCode === selectedRowBaseCode;
  }

  function syncPreviewSelectionAfterRender(paginatedRows) {
    if (!editorTableBody) return;
    const renderedRows = Array.from(editorTableBody.querySelectorAll("tr[data-base-code]"));
    if (!renderedRows.length) {
      paintLivePreview(null);
      return;
    }

    let selectedRowEl = renderedRows.find((row) => normalizeCode(row.dataset.baseCode || row.dataset.code) === selectedRowBaseCode);
    if (!selectedRowEl) {
      const firstRow = Array.isArray(paginatedRows) && paginatedRows.length ? paginatedRows[0] : null;
      const fallbackBaseCode = normalizeCode(firstRow && firstRow.baseCode ? firstRow.baseCode : renderedRows[0].dataset.baseCode || renderedRows[0].dataset.code);
      selectedRowBaseCode = fallbackBaseCode;
      selectedRowEl = renderedRows.find((row) => normalizeCode(row.dataset.baseCode || row.dataset.code) === selectedRowBaseCode) || renderedRows[0];
    }

    refreshSelectedRowStyles();
    paintLivePreview(collectRowDraft(selectedRowEl));
  }

  function updateFinalPricePreview(rowEl) {
    if (!rowEl) return;
    const priceInput = rowEl.querySelector('[data-field="price"]');
    const discountInput = rowEl.querySelector('[data-field="discount"]');
    const finalPriceEl = rowEl.querySelector('[data-role="final-price"]');
    if (!finalPriceEl) return;

    const price = Number(priceInput ? priceInput.value : NaN);
    const discount = clampDiscount(discountInput ? discountInput.value : 0);
    const finalPrice = calculateFinalPrice(price, discount);
    if (finalPriceEl instanceof HTMLInputElement) {
      finalPriceEl.value = toMoney(finalPrice);
    } else {
      finalPriceEl.textContent = `S/. ${toMoney(finalPrice)}`;
    }
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error("Archivo no valido."));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
      reader.readAsDataURL(file);
    });
  }

  async function uploadImageFileToServer(file) {
    if (!file) {
      throw new Error("Selecciona una imagen valida.");
    }

    if (isDesignPreview()) {
      throw new Error("Vista local de diseno: la subida de imagenes requiere backend. Usa una URL o ruta `img/...` para maquetar.");
    }

    const token = getSessionToken();
    if (!token) {
      throw new Error("Sesion invalida. Inicia sesion como administrador.");
    }

    const dataUrl = await readFileAsDataUrl(file);
    let response;
    try {
      response = await fetch(toApiUrl("/api/catalog/images"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          filename: file.name || "imagen",
          dataUrl
        })
      });
    } catch (error) {
      throw new Error("No se pudo conectar con el backend para subir la imagen.");
    }

    let payload = null;
    try {
      payload = await response.json();
    } catch (error) {
      payload = null;
    }

    if (!response.ok || !payload || payload.ok === false) {
      throw new Error(payload && payload.error ? payload.error : "No se pudo guardar la imagen en el servidor.");
    }

    const imagePath = payload.imagePath ? String(payload.imagePath).trim() : "";
    if (!imagePath) {
      throw new Error("El servidor no devolvio la ruta de la imagen.");
    }
    return imagePath;
  }

  async function uploadImageDataUrlToServer(dataUrl, filename = "imagen-recortada.jpg") {
    const payloadDataUrl = String(dataUrl || "").trim();
    if (!payloadDataUrl || !/^data:image\//i.test(payloadDataUrl)) {
      throw new Error("Recorte invalido. Selecciona y recorta una imagen.");
    }

    if (isDesignPreview()) {
      throw new Error("Vista local de diseno: guardar recortes requiere backend. Para maquetar, usa una imagen ya disponible en `img/`.");
    }

    const token = getSessionToken();
    if (!token) {
      throw new Error("Sesion invalida. Inicia sesion como administrador.");
    }

    let response;
    try {
      response = await fetch(toApiUrl("/api/catalog/images"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          filename: filename || "imagen-recortada.jpg",
          dataUrl: payloadDataUrl
        })
      });
    } catch (error) {
      throw new Error("No se pudo conectar con el backend para subir la imagen recortada.");
    }

    let payload = null;
    try {
      payload = await response.json();
    } catch (error) {
      payload = null;
    }

    if (!response.ok || !payload || payload.ok === false) {
      throw new Error(payload && payload.error ? payload.error : "No se pudo guardar la imagen recortada en el servidor.");
    }

    const imagePath = payload.imagePath ? String(payload.imagePath).trim() : "";
    if (!imagePath) {
      throw new Error("El servidor no devolvio la ruta de la imagen recortada.");
    }
    return imagePath;
  }

  async function importRemoteImageUrlToServer(imageUrl, filename = "imagen-remota") {
    if (isDesignPreview()) {
      throw new Error("Vista local de diseno: importar imagenes remotas al proyecto requiere backend.");
    }

    const token = getSessionToken();
    if (!token) {
      throw new Error("Sesion invalida. Inicia sesion como administrador.");
    }

    const safeUrl = String(imageUrl || "").trim();
    if (!/^https?:\/\//i.test(safeUrl)) {
      throw new Error("La imagen no es una URL remota valida.");
    }

    let response;
    try {
      response = await fetch(toApiUrl("/api/catalog/images"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          imageUrl: safeUrl,
          filename: filename || "imagen-remota"
        })
      });
    } catch (error) {
      throw new Error("No se pudo descargar la imagen remota para recortar.");
    }

    let payload = null;
    try {
      payload = await response.json();
    } catch (error) {
      payload = null;
    }

    if (!response.ok || !payload || payload.ok === false) {
      if (payload && payload.error) {
        throw new Error(payload.error);
      }
      if (response && response.status === 404) {
        throw new Error("Ruta no encontrada en backend para importacion remota. Reinicia el backend.");
      }
      throw new Error(`No se pudo preparar la imagen remota para recorte (HTTP ${response ? response.status : "?"}).`);
    }

    const imagePath = payload.imagePath ? String(payload.imagePath).trim() : "";
    if (!imagePath) {
      throw new Error("El servidor no devolvio la ruta temporal para recorte.");
    }
    return imagePath;
  }

  async function openEditorCropModal(options = {}) {
    const preferFile = Boolean(options.preferFile);
    const selectedFile = editorModalImageFileInput && editorModalImageFileInput.files && editorModalImageFileInput.files[0]
      ? editorModalImageFileInput.files[0]
      : null;
    const imageValue = normalizeImagePath(editorModalImageInput ? editorModalImageInput.value : "");

    if (preferFile && selectedFile) {
      await loadModalCropSourceFromFile(selectedFile);
    } else if (imageValue) {
      await loadModalCropSourceFromImageValue(imageValue);
    } else if (selectedFile) {
      await loadModalCropSourceFromFile(selectedFile);
    } else {
      throw new Error("No hay imagen para recortar. Carga una imagen o escribe una URL valida.");
    }

    const cropModal = getEditorImageCropModal();
    if (cropModal) cropModal.show();
  }

  function isCrossOriginHttpUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return false;
    try {
      const url = new URL(raw, window.location.href);
      return /^https?:$/i.test(url.protocol) && url.origin !== window.location.origin;
    } catch (error) {
      return false;
    }
  }

  async function ensureModalCropSourceIsLocal() {
    const inputValue = normalizeImagePath(editorModalImageInput ? editorModalImageInput.value : "");
    const currentCropSource = editorModalCropTarget ? String(editorModalCropTarget.src || "").trim() : "";
    const candidateSource = resolveCropImageSource(inputValue || currentCropSource);
    if (!candidateSource || !isCrossOriginHttpUrl(candidateSource)) {
      return "";
    }

    const localPath = await importRemoteImageUrlToServer(candidateSource, buildCropUploadFilename());
    if (!localPath) {
      throw new Error("No se pudo preparar una imagen local para aplicar recorte.");
    }
    if (editorModalImageInput) {
      editorModalImageInput.value = normalizeImagePath(localPath);
    }
    await loadModalCropSourceFromImageValue(localPath);
    return localPath;
  }

  function renderPagination(totalPages) {
    if (!editorPagination) return;

    if (totalPages <= 1) {
      editorPagination.innerHTML = "";
      return;
    }

    const pages = new Set([1, totalPages]);
    for (let page = currentPage - 2; page <= currentPage + 2; page += 1) {
      if (page > 1 && page < totalPages) {
        pages.add(page);
      }
    }

    const orderedPages = Array.from(pages).sort((a, b) => a - b);
    const items = [];
    let lastPage = 0;

    orderedPages.forEach((page) => {
      if (lastPage && page - lastPage > 1) {
        items.push(`
          <li class="page-item disabled editor-pagination-gap" aria-hidden="true">
            <span class="page-link">...</span>
          </li>
        `);
      }

      items.push(`
        <li class="page-item ${currentPage === page ? "active" : ""}">
          <button class="page-link" type="button" data-page="${page}" aria-label="Pagina ${page}">${page}</button>
        </li>
      `);
      lastPage = page;
    });

    let html = `
      <li class="page-item ${currentPage === 1 ? "disabled" : ""}">
        <button class="page-link" type="button" data-page="${currentPage - 1}" aria-label="Anterior">&lt;</button>
      </li>
    `;

    html += items.join("");

    html += `
      <li class="page-item ${currentPage === totalPages ? "disabled" : ""}">
        <button class="page-link" type="button" data-page="${currentPage + 1}" aria-label="Siguiente">&gt;</button>
      </li>
    `;

    editorPagination.innerHTML = html;
  }

  function renderTable() {
    if (!editorTableBody) return;
    const rows = getFilteredRows();
    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * pageSize;
    const paginatedRows = rows.slice(start, start + pageSize);

    if (!rows.length) {
      editorTableBody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center py-4 text-muted">No hay productos para mostrar.</td>
        </tr>
      `;
      if (editorPagination) editorPagination.innerHTML = "";
      selectedRowBaseCode = "";
      paintLivePreview(null);
      return;
    }

    editorTableBody.innerHTML = paginatedRows
      .map((row) => `
        <tr
          class="editor-table-card-row"
          data-code="${escapeHtml(row.code)}"
          data-base-code="${escapeHtml(row.baseCode)}"
          data-name="${escapeHtml(row.name)}"
          data-description="${escapeHtml(row.description || "")}"
          data-category-key="${escapeHtml(row.categoryKey)}"
          data-internal-category-label="${escapeHtml(row.internalCategoryLabel || row.categoryLabel)}"
          data-source-category="${escapeHtml(row.sourceCategory || "")}"
          data-source-subcategory="${escapeHtml(row.sourceSubcategory || "")}"
          data-unit="${escapeHtml(row.unit || "")}"
          data-active="${row.active ? "1" : "0"}"
          data-is-custom="${row.isCustom ? "1" : "0"}"
        >
          <td colspan="9" class="editor-row-cell">
            <div class="editor-row-card">
              <section class="editor-row-panel editor-row-panel-taxonomy editor-category-cell">
                <input
                  type="text"
                  class="form-control form-control-sm editor-static-input editor-taxonomy-display"
                  data-role="category-display"
                  value="${escapeHtml(row.categoryLabel)}"
                  readonly
                  tabindex="-1"
                >
                <div class="editor-taxonomy-meta">
                  <small class="editor-base-hint" data-role="source-category">Categoria: ${escapeHtml(row.sourceCategory || row.internalCategoryLabel || row.categoryLabel)}</small>
                  <small class="editor-base-hint" data-role="source-subcategory">Subcategoria: ${escapeHtml(row.sourceSubcategory || row.sourceCategory || row.internalCategoryLabel || row.categoryLabel)}</small>
                  <small class="editor-base-hint" data-role="internal-category">Base interna: ${escapeHtml(row.internalCategoryLabel || row.categoryLabel)}</small>
                </div>
                ${row.isCustom ? '<span class="badge badge-custom mt-1">NUEVO</span>' : ""}
              </section>

              <section class="editor-row-panel">
                <input
                  type="text"
                  class="form-control form-control-sm editor-code-input"
                  data-field="code"
                  value="${escapeHtml(row.code)}"
                  maxlength="40"
                  ${row.isCustom ? "" : 'readonly title="SKU EUREKA base bloqueado"'}
                >
                <small class="editor-base-hint editor-base-caption">SKU base: ${escapeHtml(row.baseCode)}${row.isCustom ? "" : " (fijo)"}</small>
              </section>

              <section class="editor-row-panel">
                <input
                  type="text"
                  class="form-control form-control-sm editor-name-input"
                  data-field="name"
                  value="${escapeHtml(row.name)}"
                  maxlength="120"
                >
                <small class="editor-base-hint editor-base-caption">Base: ${escapeHtml(row.baseName || row.name)}</small>
              </section>

              <section class="editor-row-panel text-end">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  class="form-control form-control-sm text-end editor-price-input"
                  data-field="price"
                  value="${toMoney(row.basePrice)}"
                >
              </section>

              <section class="editor-row-panel text-end">
                <input
                  type="number"
                  min="0"
                  max="90"
                  step="1"
                  class="form-control form-control-sm text-end editor-discount-input"
                  data-field="discount"
                  value="${Math.round(row.discountPct)}"
                >
              </section>

              <section class="editor-row-panel text-end">
                <input
                  type="text"
                  class="form-control form-control-sm text-end editor-final-input"
                  data-role="final-price"
                  value="${toMoney(row.finalPrice)}"
                  readonly
                  tabindex="-1"
                >
              </section>

              <section class="editor-row-panel">
                <div class="editor-image-stack">
                  <input
                    type="text"
                    class="form-control form-control-sm editor-image-input"
                    data-field="image"
                    value="${escapeHtml(row.image)}"
                    placeholder="https://... o img/productos/archivo.jpg"
                  >
                  <label class="editor-image-file-shell">
                    <span class="editor-image-file-button">Seleccionar archivo</span>
                    <span class="editor-image-file-name" data-role="image-file-name">Ningun archivo</span>
                    <input
                      type="file"
                      accept="image/*"
                      class="editor-image-file-input"
                      data-field="image-file"
                    >
                  </label>
                </div>
              </section>

              <section class="editor-row-panel text-center">
                <div class="editor-view-box" data-role="image-preview">
                  ${buildImageMarkup(row.image, row.name)}
                </div>
              </section>

              <section class="editor-row-panel text-center">
                <div class="editor-actions">
                  <button type="button" class="btn btn-light btn-sm editor-save-btn" data-action="save">Guardar</button>
                  <button type="button" class="btn btn-sm editor-toggle-btn ${row.active ? "btn-outline-danger" : "btn-outline-success"}" data-action="toggle-active">
                    ${row.active ? "Retirar" : "Reactivar"}
                  </button>
                  ${row.isCustom ? '<button type="button" class="btn btn-outline-secondary btn-sm editor-delete-btn" data-action="delete-custom">Eliminar</button>' : ""}
                </div>
              </section>
            </div>
          </td>
        </tr>
      `)
      .join("");

    renderPagination(totalPages);
    syncPreviewSelectionAfterRender(paginatedRows);
  }

  async function saveRow(rowEl, options = {}) {
    const skipConfirm = Boolean(options && options.skipConfirm);
    const forcedSuccessMessage = options && options.successMessage ? String(options.successMessage).trim() : "";
    const baseCode = normalizeCode(rowEl.dataset.baseCode || rowEl.dataset.code);
    const categoryKey = String(rowEl.dataset.categoryKey || "").trim();
    const active = String(rowEl.dataset.active || "0") === "1";
    const isCustom = String(rowEl.dataset.isCustom || "0") === "1";

    const codeInput = rowEl.querySelector('[data-field="code"]');
    const nameInput = rowEl.querySelector('[data-field="name"]');
    const imageInput = rowEl.querySelector('[data-field="image"]');
    const priceInput = rowEl.querySelector('[data-field="price"]');
    const discountInput = rowEl.querySelector('[data-field="discount"]');

    const nextCode = normalizeCode(codeInput ? codeInput.value : baseCode);
    if (!isValidCode(nextCode)) {
      showStatus("warning", "SKU EUREKA invalido. Usa el formato UNI00001.");
      return;
    }

    const nextPrice = Number(priceInput ? priceInput.value : NaN);
    if (!Number.isFinite(nextPrice) || nextPrice < 0) {
      showStatus("warning", "Ingresa un precio valido (0 o mayor).");
      return;
    }

    const nextImage = normalizeImagePath(imageInput ? imageInput.value : "");
    if (imageInput && imageInput.value !== nextImage) imageInput.value = nextImage;
    if (!isValidImagePath(nextImage)) {
      showStatus("warning", "Ruta de imagen invalida. Usa URL, data:image o ruta tipo img/productos/archivo.jpg.");
      return;
    }
    const nextDiscount = clampDiscount(discountInput ? discountInput.value : 0);
    const nextName = String(nameInput ? nameInput.value : "").replace(/\s+/g, " ").trim();
    const nextDescription = sanitizeDescription(rowEl.dataset.description || "");
    if (!nextName) {
      showStatus("warning", "Ingresa un nombre valido para el producto.");
      return;
    }

    if (!skipConfirm) {
      const confirmed = await requestTwoStepConfirmation({
        title: "Guardar cambios",
        message: `Vas a guardar cambios de "${nextName}" (${nextCode}).`,
        keyword: "GUARDAR",
        confirmLabel: "Guardar cambios",
        danger: false
      });
      if (!confirmed) {
        showStatus("secondary", "Guardado cancelado. No se realizaron cambios.");
        return { ok: false, cancelled: true };
      }
    }

    let targetCode = baseCode;
    let baseCodeChangeBlocked = false;
    if (nextCode !== baseCode) {
      if (isCustom) {
        if (isCodeAlreadyUsed(nextCode, baseCode)) {
          showStatus("warning", `El SKU EUREKA ${nextCode} ya esta en uso. Elige otro.`);
          return;
        }
        if (typeof catalogApi.renameCustomProductCode !== "function") {
          showStatus("warning", "No se pudo cambiar el SKU EUREKA por una limitacion del catalogo.");
          return;
        }
        const renameResult = await catalogApi.renameCustomProductCode(baseCode, nextCode);
        if (!renameResult || !renameResult.ok) {
          showStatus("warning", renameResult && renameResult.error ? renameResult.error : "No se pudo actualizar el SKU EUREKA.");
          return;
        }
        targetCode = normalizeCode(renameResult.code || nextCode);
      } else {
        baseCodeChangeBlocked = true;
        targetCode = baseCode;
        if (codeInput) codeInput.value = baseCode;
      }
    }

    if (isCustom) {
      const result = await catalogApi.upsertCustomProduct({
        categoryKey,
        code: targetCode,
        name: nextName,
        description: nextDescription,
        price: Number(nextPrice.toFixed(2)),
        image: nextImage
      });
      if (!result || !result.ok) {
        showStatus("warning", result && result.error ? result.error : "No se pudo actualizar el producto.");
        return;
      }
    }

    const configCode = isCustom ? targetCode : baseCode;
    const saveResult = await catalogApi.setProductConfig(configCode, {
      code: targetCode,
      price: Number(nextPrice.toFixed(2)),
      discountPct: nextDiscount,
      active,
      name: nextName,
      image: nextImage,
      description: nextDescription
    });
    if (!saveResult || !saveResult.ok) {
      showStatus("warning", saveResult && saveResult.error ? saveResult.error : "No se pudieron guardar los cambios.");
      return;
    }

    if (targetCode !== baseCode) {
      catalogApi.clearProductConfig(baseCode);
    }

    renderTable();
    if (targetCode === baseCode) {
      const defaultMessage = baseCodeChangeBlocked
        ? `Cambios guardados para ${targetCode}. El SKU EUREKA base es fijo y no se modifico.`
        : `Cambios guardados para ${targetCode}.`;
      showStatus("success", forcedSuccessMessage || defaultMessage);
    } else {
      showStatus("success", forcedSuccessMessage || `Cambios guardados. SKU EUREKA actualizado: ${baseCode} -> ${targetCode}.`);
    }
    return { ok: true, code: targetCode };
  }

  async function retireRow(rowEl) {
    const code = normalizeCode(rowEl.dataset.baseCode || rowEl.dataset.code);
    const name = getRowName(rowEl) || code;

    const confirmed = await requestTwoStepConfirmation({
      title: "Retirar producto",
      message: `Vas a retirar "${name}" del catalogo.`,
      keyword: "RETIRAR",
      confirmLabel: "Retirar producto",
      danger: true
    });
    if (!confirmed) {
      showStatus("secondary", "Retiro cancelado. No se realizaron cambios.");
      return;
    }

    const retireResult = await catalogApi.setProductConfig(code, { active: false });
    if (!retireResult || !retireResult.ok) {
      showStatus("warning", retireResult && retireResult.error ? retireResult.error : "No se pudo retirar el producto.");
      return;
    }
    renderTable();
    showStatus("warning", `${name} fue retirado del catalogo.`);
  }

  async function reactivateRow(rowEl) {
    const code = normalizeCode(rowEl.dataset.baseCode || rowEl.dataset.code);
    const name = getRowName(rowEl) || code;
    const ok = window.confirm(`Deseas reactivar "${name}" en el catalogo?`);
    if (!ok) return;
    const reactivateResult = await catalogApi.setProductConfig(code, { active: true });
    if (!reactivateResult || !reactivateResult.ok) {
      showStatus("warning", reactivateResult && reactivateResult.error ? reactivateResult.error : "No se pudo reactivar el producto.");
      return;
    }
    renderTable();
    showStatus("success", `${name} fue reactivado.`);
  }

  async function deleteCustomRow(rowEl) {
    const code = normalizeCode(rowEl.dataset.baseCode || rowEl.dataset.code);
    const name = getRowName(rowEl) || code;

    const ok = window.confirm(`Vas a eliminar el producto personalizado "${name}" (${code}). Continuar?`);
    if (!ok) return;

    const removed = await catalogApi.deleteCustomProduct(code);
    if (!removed) {
      showStatus("warning", "No se pudo eliminar el producto personalizado.");
      return;
    }

    catalogApi.clearProductConfig(code);
    renderTable();
    showStatus("secondary", `${name} fue eliminado del catalogo.`);
  }

  function fillCategorySelect() {
    if (!editorNewCategory) return;
    const catalog = catalogApi.getCatalogData();
    const options = Object.entries(catalog)
      .sort(([, left], [, right]) => String(left.label || "").localeCompare(String(right.label || ""), "es", { sensitivity: "base" }))
      .map(([key, value]) => `<option value="${escapeHtml(key)}">${escapeHtml(value.label)}</option>`)
      .join("");
    editorNewCategory.innerHTML = options;
    syncNewTaxonomyPlaceholders();
  }

  function updateNewImagePreview() {
    if (!editorNewImagePreview) return;
    const image = normalizeImagePath(editorNewImage ? editorNewImage.value : "");
    if (editorNewImage && editorNewImage.value !== image) editorNewImage.value = image;
    const name = String(editorNewName ? editorNewName.value : "Producto nuevo").trim() || "Producto nuevo";
    setImagePreview(editorNewImagePreview, image, name);
  }

  function updateNewPromoStatus() {
    if (!editorNewPromoStatus) return;
    paintPromoStatus(editorNewPromoStatus, editorNewDiscount ? editorNewDiscount.value : 0);
  }

  function updateNewPriceSummary() {
    if (!editorNewFinalPrice) return;
    const basePrice = Number(editorNewPrice ? editorNewPrice.value : NaN);
    const discountPct = editorNewDiscount ? editorNewDiscount.value : 0;
    const finalPrice = calculateFinalPrice(basePrice, discountPct);
    editorNewFinalPrice.textContent = `S/. ${toMoney(finalPrice)}`;
  }

  function resetAddForm() {
    if (!editorAddForm) return;
    editorAddForm.reset();
    assignNextSkuToNewProductField(true);
    if (editorNewPrice) editorNewPrice.value = "0.00";
    if (editorNewDiscount) editorNewDiscount.value = "0";
    if (editorNewActive) editorNewActive.checked = true;
    if (editorNewImageFile) editorNewImageFile.value = "";
    if (editorNewSourceCategory) editorNewSourceCategory.value = "";
    if (editorNewSourceSubcategory) editorNewSourceSubcategory.value = "";
    if (editorNewUnit) editorNewUnit.value = "";
    syncNewTaxonomyPlaceholders();
    updateNewImagePreview();
    updateNewPromoStatus();
    updateNewPriceSummary();
  }

  async function addNewProduct(event) {
    event.preventDefault();

    const categoryKey = String(editorNewCategory ? editorNewCategory.value : "").trim();
    const internalCategoryLabel = getSelectedCategoryOptionLabel(editorNewCategory);
    const sourceCategory = sanitizeMetaText(editorNewSourceCategory ? editorNewSourceCategory.value : "", 120) || internalCategoryLabel;
    const sourceSubcategory = sanitizeMetaText(editorNewSourceSubcategory ? editorNewSourceSubcategory.value : "", 120) || sourceCategory || internalCategoryLabel;
    const unit = sanitizeMetaText(editorNewUnit ? editorNewUnit.value : "", 40);
    const code = normalizeCode(editorNewCode ? editorNewCode.value : "");
    const name = String(editorNewName ? editorNewName.value : "").replace(/\s+/g, " ").trim();
    const price = Number(editorNewPrice ? editorNewPrice.value : NaN);
    const discount = clampDiscount(editorNewDiscount ? editorNewDiscount.value : 0);
    const image = normalizeImagePath(editorNewImage ? editorNewImage.value : "");
    const description = buildProductMetaDescription({
      unit,
      sourceCategory,
      sourceSubcategory
    });
    if (editorNewImage && editorNewImage.value !== image) editorNewImage.value = image;
    const active = Boolean(editorNewActive && editorNewActive.checked);

    if (!categoryKey) {
      showStatus("warning", "Selecciona una categoria.");
      return;
    }
    if (!isValidCode(code)) {
      showStatus("warning", "SKU EUREKA invalido. Usa el formato UNI00001.");
      return;
    }
    if (!name) {
      showStatus("warning", "Ingresa el nombre del producto.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      showStatus("warning", "Ingresa un precio valido (0 o mayor).");
      return;
    }
    if (!isValidImagePath(image)) {
      showStatus("warning", "Ruta de imagen invalida. Usa URL, data:image o ruta tipo img/productos/archivo.jpg.");
      return;
    }

    const result = await catalogApi.upsertCustomProduct({
      categoryKey,
      code,
      name,
      description,
      price: Number(price.toFixed(2)),
      image
    });

    if (!result || !result.ok) {
      showStatus("warning", result && result.error ? result.error : "No se pudo crear el producto.");
      return;
    }

    const configResult = await catalogApi.setProductConfig(code, {
      name,
      image,
      price: Number(price.toFixed(2)),
      discountPct: discount,
      active,
      description
    });
    if (!configResult || !configResult.ok) {
      showStatus("warning", configResult && configResult.error ? configResult.error : "No se pudo aplicar la configuracion inicial.");
      return;
    }

    renderTable();
    resetAddForm();
    showStatus("success", `Producto ${code} agregado correctamente.`);
  }

  function bindEvents() {
    setModalCropPanelReady(false);

    if (editorExcelPickBtn && editorExcelInput) {
      editorExcelPickBtn.addEventListener("click", () => {
        if (excelImportInProgress) return;
        editorExcelInput.click();
      });
    }

    if (editorExcelDropZone && editorExcelInput) {
      editorExcelDropZone.addEventListener("click", () => {
        if (excelImportInProgress) return;
        editorExcelInput.click();
      });

      editorExcelDropZone.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        if (excelImportInProgress) return;
        editorExcelInput.click();
      });

      editorExcelDropZone.addEventListener("dragenter", (event) => {
        event.preventDefault();
        editorExcelDropZone.classList.add("is-dragover");
      });

      editorExcelDropZone.addEventListener("dragover", (event) => {
        event.preventDefault();
        editorExcelDropZone.classList.add("is-dragover");
      });

      editorExcelDropZone.addEventListener("dragleave", (event) => {
        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof Node && editorExcelDropZone.contains(nextTarget)) return;
        editorExcelDropZone.classList.remove("is-dragover");
      });

      editorExcelDropZone.addEventListener("drop", (event) => {
        event.preventDefault();
        editorExcelDropZone.classList.remove("is-dragover");
        if (excelImportInProgress) return;
        const droppedFile = event.dataTransfer && event.dataTransfer.files
          ? event.dataTransfer.files[0]
          : null;
        if (!droppedFile) return;
        processExcelFile(droppedFile);
      });
    }

    if (editorExcelInput) {
      editorExcelInput.addEventListener("change", () => {
        const selectedFile = editorExcelInput.files && editorExcelInput.files[0]
          ? editorExcelInput.files[0]
          : null;
        if (!selectedFile) {
          setExcelFileName("");
          return;
        }
        processExcelFile(selectedFile);
        editorExcelInput.value = "";
      });
    }

    if (editorSearchInput) {
      editorSearchInput.addEventListener("input", () => {
        searchQuery = editorSearchInput.value.trim();
        currentPage = 1;
        renderTable();
      });
    }

    if (editorSearchClearBtn) {
      editorSearchClearBtn.addEventListener("click", () => {
        if (!editorSearchInput) return;
        editorSearchInput.value = "";
        searchQuery = "";
        currentPage = 1;
        renderTable();
        editorSearchInput.focus();
      });
    }

    if (editorAddCancelBtn && editorAddPanel) {
      editorAddCancelBtn.addEventListener("click", () => {
        resetAddForm();
        if (editorNewCode) editorNewCode.focus();
      });
    }

    if (editorNewImage) {
      editorNewImage.addEventListener("input", updateNewImagePreview);
    }

    if (editorNewName) {
      editorNewName.addEventListener("input", updateNewImagePreview);
    }

    if (editorNewCategory) {
      editorNewCategory.addEventListener("change", () => {
        syncNewTaxonomyPlaceholders();
      });
    }

    if (editorNewDiscount) {
      editorNewDiscount.addEventListener("input", () => {
        updateNewPromoStatus();
        updateNewPriceSummary();
      });
    }

    if (editorNewPrice) {
      editorNewPrice.addEventListener("input", updateNewPriceSummary);
    }

    if (editorNewImageFile) {
      editorNewImageFile.addEventListener("change", async () => {
        const file = editorNewImageFile.files && editorNewImageFile.files[0] ? editorNewImageFile.files[0] : null;
        if (!file) return;
        try {
          showStatus("info", "Subiendo imagen al servidor...");
          const imagePath = await uploadImageFileToServer(file);
          if (editorNewImage) editorNewImage.value = imagePath;
          updateNewImagePreview();
          showStatus("success", `Imagen guardada en ${imagePath}. Guarda o crea el producto para aplicar cambios.`);
        } catch (error) {
          showStatus("warning", error && error.message ? error.message : "No se pudo cargar la imagen seleccionada.");
        } finally {
          editorNewImageFile.value = "";
        }
      });
    }

    if (editorAddForm) {
      editorAddForm.addEventListener("submit", addNewProduct);
    }

    if (editorModalSaveBtn) {
      editorModalSaveBtn.addEventListener("click", () => {
        saveEditorModalChanges();
      });
    }

    if (editorProductPreviewModalEl) {
      const syncModalPreview = () => {
        paintEditorModalPreview("");
      };
      if (editorModalCodeInput) editorModalCodeInput.addEventListener("input", syncModalPreview);
      if (editorModalNameInput) editorModalNameInput.addEventListener("input", syncModalPreview);
      if (editorModalPriceInput) editorModalPriceInput.addEventListener("input", syncModalPreview);
      if (editorModalDiscountInput) editorModalDiscountInput.addEventListener("input", syncModalPreview);
      if (editorModalSourceCategoryInput) editorModalSourceCategoryInput.addEventListener("input", syncModalPreview);
      if (editorModalSourceSubcategoryInput) editorModalSourceSubcategoryInput.addEventListener("input", syncModalPreview);
      if (editorModalUnitInput) editorModalUnitInput.addEventListener("input", syncModalPreview);
      if (editorModalImageInput) editorModalImageInput.addEventListener("input", syncModalPreview);
      if (editorModalImageUploadInput) {
        editorModalImageUploadInput.addEventListener("change", async () => {
          const file = editorModalImageUploadInput.files && editorModalImageUploadInput.files[0]
            ? editorModalImageUploadInput.files[0]
            : null;
          if (!file) return;

          try {
            showStatus("info", "Subiendo imagen al servidor...");
            const imagePath = await uploadImageFileToServer(file);
            if (editorModalImageInput) {
              editorModalImageInput.value = imagePath;
            }
            paintEditorModalPreview("");
            showStatus("success", `Imagen cargada en ${imagePath}. Guarda cambios para aplicarla al producto.`);
          } catch (error) {
            showStatus("warning", error && error.message ? error.message : "No se pudo cargar la imagen seleccionada.");
          } finally {
            editorModalImageUploadInput.value = "";
          }
        });
      }
      if (editorModalDescriptionInput) editorModalDescriptionInput.addEventListener("input", syncModalPreview);
      if (editorModalActiveInput) editorModalActiveInput.addEventListener("change", syncModalPreview);
      if (editorModalImageFileInput) {
        editorModalImageFileInput.addEventListener("change", async () => {
          const file = editorModalImageFileInput.files && editorModalImageFileInput.files[0]
            ? editorModalImageFileInput.files[0]
            : null;
          if (!file) {
            resetModalCropper({ keepFile: true });
            return;
          }

          try {
            await openEditorCropModal({ preferFile: true });
          } catch (error) {
            resetModalCropper();
            showStatus("warning", error && error.message ? error.message : "No se pudo abrir la imagen para recortar.");
          }
        });
      }
      if (editorOpenCropModalBtn) {
        editorOpenCropModalBtn.addEventListener("click", async () => {
          try {
            await openEditorCropModal({ preferFile: false });
          } catch (error) {
            showStatus("warning", error && error.message ? error.message : "No se pudo abrir la imagen para recortar.");
          }
        });
      }
      if (editorModalCropZoomInput) {
        editorModalCropZoomInput.addEventListener("input", () => {
          const nextZoom = Number(editorModalCropZoomInput.value);
          modalCropState.zoom = Number.isFinite(nextZoom) ? Math.min(3, Math.max(1, nextZoom)) : 1;
          renderModalCropImage();
        });
      }
      if (editorModalCropResetBtn) {
        editorModalCropResetBtn.addEventListener("click", () => {
          if (!editorModalCropTarget || !editorModalCropTarget.naturalWidth) return;
          modalCropState.zoom = 1;
          modalCropState.offsetX = 0;
          modalCropState.offsetY = 0;
          if (editorModalCropZoomInput) editorModalCropZoomInput.value = "1";
          renderModalCropImage();
        });
      }
      if (editorModalCropApplyBtn) {
        editorModalCropApplyBtn.addEventListener("click", async () => {
          try {
            let croppedDataUrl = "";
            try {
              croppedDataUrl = buildModalCropDataUrl();
            } catch (error) {
              const message = error && error.message ? error.message : "";
              const maybeCorsIssue = /CORS|No se pudo recortar esta URL/i.test(message);
              if (!maybeCorsIssue) throw error;

              showStatus("info", "Preparando imagen remota para aplicar recorte...");
              const localizedPath = await ensureModalCropSourceIsLocal();
              if (!localizedPath) {
                throw new Error("No se pudo preparar la imagen para recortar. Intenta reiniciar backend o usar archivo local.");
              }
              croppedDataUrl = buildModalCropDataUrl();
            }

            showStatus("info", "Subiendo imagen recortada al servidor...");
            const imagePath = await uploadImageDataUrlToServer(croppedDataUrl, buildCropUploadFilename());
            if (editorModalImageInput) {
              editorModalImageInput.value = imagePath;
            }
            paintEditorModalPreview("");
            showStatus("success", `Imagen recortada guardada en ${imagePath}. Ahora puedes guardar cambios del producto.`);
            const cropModal = getEditorImageCropModal();
            if (cropModal) cropModal.hide();
          } catch (error) {
            showStatus("warning", error && error.message ? error.message : "No se pudo aplicar el recorte.");
          }
        });
      }
      if (editorModalCropViewport) {
        editorModalCropViewport.addEventListener("pointerdown", beginModalCropDrag);
        editorModalCropViewport.addEventListener("pointermove", moveModalCropDrag);
        editorModalCropViewport.addEventListener("pointerup", endModalCropDrag);
        editorModalCropViewport.addEventListener("pointercancel", endModalCropDrag);
      }
      editorProductPreviewModalEl.addEventListener("shown.bs.modal", () => {
        renderModalCropImage();
      });
      editorProductPreviewModalEl.addEventListener("hidden.bs.modal", () => {
        const cropModal = getEditorImageCropModal();
        if (cropModal) cropModal.hide();
        editorModalEditingRow = null;
        editorModalEditingBaseCode = "";
        if (editorModalImageUploadInput) editorModalImageUploadInput.value = "";
        resetModalCropper();
      });
    }

    if (editorImageCropModalEl) {
      editorImageCropModalEl.addEventListener("shown.bs.modal", () => {
        renderModalCropImage();
      });
      editorImageCropModalEl.addEventListener("hidden.bs.modal", () => {
        modalCropState.dragging = false;
        modalCropState.pointerId = null;
        if (editorModalCropViewport) {
          editorModalCropViewport.classList.remove("is-dragging");
        }
      });
    }

    if (editorPagination) {
      editorPagination.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-page]");
        if (!button) return;

        const rows = getFilteredRows();
        const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
        const nextPage = Number(button.dataset.page);
        if (!Number.isFinite(nextPage) || nextPage < 1 || nextPage > totalPages) return;

        currentPage = nextPage;
        renderTable();
      });
    }

    if (editorTableBody) {
      editorTableBody.addEventListener("input", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const rowEl = target.closest("tr[data-code]");
        if (!rowEl) return;

        if (target.matches('[data-field="price"], [data-field="discount"]')) {
          updateFinalPricePreview(rowEl);
          if (isPreviewSelectedRow(rowEl)) {
            paintLivePreview(collectRowDraft(rowEl));
          }
          return;
        }

        if (target.matches('[data-field="name"]')) {
          const nextName = String(target.value || "").replace(/\s+/g, " ").trim();
          if (nextName) rowEl.dataset.name = nextName;
          const previewBox = rowEl.querySelector('[data-role="image-preview"]');
          const imageInput = rowEl.querySelector('[data-field="image"]');
          const nextImage = normalizeImagePath(imageInput && imageInput.value ? imageInput.value : "");
          if (imageInput && imageInput.value !== nextImage) imageInput.value = nextImage;
          setImagePreview(previewBox, nextImage, getRowName(rowEl));
          if (isPreviewSelectedRow(rowEl)) {
            paintLivePreview(collectRowDraft(rowEl));
          }
          return;
        }

        if (target.matches('[data-field="code"]')) {
          if (isPreviewSelectedRow(rowEl)) {
            paintLivePreview(collectRowDraft(rowEl));
          }
          return;
        }

        if (target.matches('[data-field="image"]')) {
          const previewBox = rowEl.querySelector('[data-role="image-preview"]');
          const nextImage = normalizeImagePath(target.value);
          if (target.value !== nextImage) target.value = nextImage;
          setImagePreview(previewBox, nextImage, getRowName(rowEl));
          if (isPreviewSelectedRow(rowEl)) {
            paintLivePreview(collectRowDraft(rowEl));
          }
        }
      });

      editorTableBody.addEventListener("focusin", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const rowEl = target.closest("tr[data-code]");
        if (!rowEl) return;
        selectRowForPreview(rowEl);
      });

      editorTableBody.addEventListener("change", async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (!target.matches('[data-field="image-file"]')) return;

        const rowEl = target.closest("tr[data-code]");
        if (!rowEl) return;

        const fileInput = target;
        const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
        updateRowFileInputLabel(fileInput, file ? file.name : "");
        if (!file) return;

        try {
          showStatus("info", "Subiendo imagen al servidor...");
          const imagePath = await uploadImageFileToServer(file);
          const imageInput = rowEl.querySelector('[data-field="image"]');
          if (imageInput) imageInput.value = imagePath;
          const previewBox = rowEl.querySelector('[data-role="image-preview"]');
          setImagePreview(previewBox, imagePath, getRowName(rowEl));
          if (isPreviewSelectedRow(rowEl)) {
            paintLivePreview(collectRowDraft(rowEl));
          }
          await saveRow(rowEl, {
            skipConfirm: true,
            successMessage: "Imagen guardada y aplicada correctamente."
          });
        } catch (error) {
          showStatus("warning", error && error.message ? error.message : "No se pudo cargar la imagen seleccionada.");
        } finally {
          fileInput.value = "";
          updateRowFileInputLabel(fileInput, "");
        }
      });

      editorTableBody.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const rowEl = target.closest("tr[data-code]");
        if (!rowEl) return;
        selectRowForPreview(rowEl);

        const actionButton = target.closest("[data-action]");
        if (actionButton) {
          if (actionButton.dataset.action === "save") {
            saveRow(rowEl);
            return;
          }

          if (actionButton.dataset.action === "toggle-active") {
            const isActive = String(rowEl.dataset.active || "0") === "1";
            if (isActive) {
              retireRow(rowEl);
            } else {
              reactivateRow(rowEl);
            }
            return;
          }

          if (actionButton.dataset.action === "delete-custom") {
            deleteCustomRow(rowEl);
          }
          return;
        }
      });

      editorTableBody.addEventListener("dblclick", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const rowEl = target.closest("tr[data-code]");
        if (!rowEl) return;
        selectRowForPreview(rowEl);

        const actionTarget = target.closest("[data-action], button, a, label");
        if (actionTarget) return;

        const formControl = target.closest("input, textarea, select");
        if (formControl instanceof HTMLInputElement) {
          const isFileInput = formControl.type === "file";
          const isEditable = !formControl.readOnly && !formControl.disabled;
          if (isFileInput || isEditable) return;
        } else if (formControl instanceof HTMLTextAreaElement || formControl instanceof HTMLSelectElement) {
          if (!formControl.disabled) return;
        }

        openEditorProductPreview(rowEl);
      });
    }

    window.addEventListener("storage", (event) => {
      if (
        event.key !== catalogApi.CATALOG_EDITOR_KEY
        && event.key !== catalogApi.CATALOG_CUSTOM_PRODUCTS_KEY
        && event.key !== catalogApi.CATALOG_SYNC_KEY
      ) return;
      renderTable();
    });

    window.addEventListener("catalog:changed", () => {
      renderTable();
      fillCategorySelect();
    });

    window.addEventListener("resize", () => {
      if (!editorModalCropPanel || editorModalCropPanel.dataset.ready !== "1") return;
      renderModalCropImage();
    });

    window.addEventListener("auth:logout", () => {
      window.location.href = "login.html";
    });

    window.addEventListener("auth:session-changed", () => {
      renderAccess();
    });
  }

  async function verifyAdminAccess(session) {
    if (!session || !session.email || !session.token) {
      return { ok: false, reason: "missing-session" };
    }

    const isPreviewSession = Boolean(
      previewStore
      && typeof previewStore.isPreviewSession === "function"
      && previewStore.isPreviewSession(session)
    );
    if (isPreviewSession) {
      return { ok: isAdminSession(session), session, preview: true };
    }

    if (!authStore || typeof authStore.syncSessionWithBackend !== "function") {
      return { ok: isAdminSession(session), session };
    }

    const synced = await authStore.syncSessionWithBackend({ clearOnUnauthorized: true });
    const refreshed = getSession();
    if (!synced.ok || !refreshed || !isAdminSession(refreshed)) {
      return { ok: false, reason: "forbidden" };
    }

    return { ok: true, session: refreshed };
  }

  async function renderAccess() {
    const renderId = ++accessRenderSequence;
    const session = getSession();
    hideExcelAlert();
    setExcelFileName("");

    if (!session || !session.email) {
      if (editorPanel) editorPanel.classList.add("d-none");
      paintLivePreview(null);
      showAccessAlert("warning", "Debes iniciar sesion como administrador para usar Editor.");
      return;
    }

    if (isDesignPreview()) {
      if (!isAdminSession(session)) {
        if (editorPanel) editorPanel.classList.add("d-none");
        paintLivePreview(null);
        showAccessAlert("secondary", "Solo cuentas administrador pueden acceder a Editor.");
        return;
      }
      showAccessAlert("info", "Vista local de diseno: puedes revisar y maquetar el editor sin backend. Las cargas de imagen al servidor siguen deshabilitadas.");
      hideStatus();
      fillCategorySelect();
      if (editorPanel) editorPanel.classList.remove("d-none");
      renderTable();
      assignNextSkuToNewProductField(true);
      updateNewImagePreview();
      updateNewPromoStatus();
      updateNewPriceSummary();
      return;
    }

    if (editorPanel) editorPanel.classList.add("d-none");
    paintLivePreview(null);
    showAccessAlert("secondary", "Validando permisos de administrador...");

    const verified = await verifyAdminAccess(session);
    if (renderId !== accessRenderSequence) return;

    if (!verified.ok) {
      if (editorPanel) editorPanel.classList.add("d-none");
      paintLivePreview(null);
      showAccessAlert("danger", "No se pudo validar una sesion de administrador para usar Editor.");
      return;
    }

    hideAccessAlert();
    hideStatus();
    fillCategorySelect();
    if (editorPanel) editorPanel.classList.remove("d-none");
    renderTable();
    assignNextSkuToNewProductField(true);
    updateNewImagePreview();
    updateNewPromoStatus();
    updateNewPriceSummary();
  }

  bindEvents();
  catalogApi.refreshBackendCatalog(true)
    .catch(() => null)
    .finally(() => {
      renderAccess().finally(() => {
        document.documentElement.classList.remove("page-data-pending", "auth-preload");
        document.body.classList.remove("auth-preload");
      });
    });
})();
