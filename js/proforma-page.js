
    const ADMIN_EMAIL = String(window.EUREKA_ADMIN_EMAIL || "").trim().toLowerCase();
    const authStore = window.EUREKA_AUTH || null;
    const previewStore = window.EUREKA_PREVIEW || null;
    const PROFORMA_KEY_PREFIX = "eurekaclean_proforma_";
    const PROFORMA_META_PREFIX = "eurekaclean_proforma_meta_";
    const PROFORMA_HISTORY_PREFIX = "eurekaclean_proforma_history_";
    const PROFORMA_LAST_KEY_PREFIX = "eurekaclean_proforma_last_";
    const COMPANY_INFO = {  name : "EUREKACLEAN S.A.C.",  ruc : "20614833140",  address : "Lima, Peru",  phone : "+51 999 999 999",  email : "ventas@eurekaclean.com"
    };
    const WHATSAPP_NUMBER = "51981292376";
    const LOGO_PATH = "img/logo_proforma.png";
    const API_BASE_RAW = String(window.EUREKA_API_BASE || "").trim();
    const API_BASE_EXPLICIT = normalizeApiBase(API_BASE_RAW);
    const API_BASE_CANDIDATES = buildApiCandidates();

    const accessAlert = document.getElementById("accessAlert");
    const customerPanel = document.getElementById("customerPanel");
    const proformaItemsEl = document.getElementById("proformaItems");
    const proformaEmptyEl = document.getElementById("proformaEmpty");
    const rucInput = document.getElementById("rucInput");
    const lookupRucBtn = document.getElementById("lookupRucBtn");
    const customerNameInput = document.getElementById("customerNameInput");
    const customerDepartmentInput = document.getElementById("customerDepartmentInput");
    const customerDistrictInput = document.getElementById("customerDistrictInput");
    const customerAddressInput = document.getElementById("customerAddressInput");
    const customerPhoneInput = document.getElementById("customerPhoneInput");
    const customerEmailInput = document.getElementById("customerEmailInput");
    const saveRucBtn = document.getElementById("saveRucBtn");
    const summaryItems = document.getElementById("summaryItems");
    const summaryTotal = document.getElementById("summaryTotal");
    const previewProformaBtn = document.getElementById("previewProformaBtn");
    const downloadCurrentBtn = document.getElementById("downloadCurrentBtn");
    const clearProformaBtn = document.getElementById("clearProformaBtn");
    const proformaPreview = document.getElementById("proformaPreview");
    const proformaPreviewModalEl = document.getElementById("proformaPreviewModal");
    const modalDownloadBtn = document.getElementById("modalDownloadBtn");
    const proformaHistoryEmpty = document.getElementById("proformaHistoryEmpty");
    const proformaHistoryList = document.getElementById("proformaHistoryList");
    const historyCountBadge = document.getElementById("historyCountBadge");
    const proformaWhatsappPrompt = document.getElementById("proformaWhatsappPrompt");
    const proformaWhatsappMessage = document.getElementById("proformaWhatsappMessage");
    const proformaWhatsappPreview = document.getElementById("proformaWhatsappPreview");
    const proformaWhatsappCloseBtn = document.getElementById("proformaWhatsappCloseBtn");
    const proformaWhatsappCancelBtn = document.getElementById("proformaWhatsappCancelBtn");
    const proformaWhatsappDownloadBtn = document.getElementById("proformaWhatsappDownloadBtn");
    const proformaWhatsappSendBtn = document.getElementById("proformaWhatsappSendBtn");

    let currentPreviewRecord = null;
    let currentWhatsappRecord = null;
    let whatsappPromptVisible = false;
    let proformaPreviewModalInstance = null;
    let proformaFallbackBackdrop = null;

    function releaseProformaPreload() {
      document.documentElement.classList.remove("page-data-pending", "auth-preload");
      if (document.body) document.body.classList.remove("auth-preload");
    }

    function normalizeEmail(email) {
      return String(email || "").trim().toLowerCase();
    }

    function normalizeApiBase(value) {
      const raw = String(value || "").trim();
      if (!raw) return "";
      return raw.replace(/\/+$/, "");
    }

    function isDesignPreview() {
      return !!(previewStore && previewStore.enabled);
    }

    function buildApiCandidates() {
      if (API_BASE_EXPLICIT) return [API_BASE_EXPLICIT];

      const candidates = [];
      const protocol = String(window.location.protocol || "").toLowerCase();
      const hostname = String(window.location.hostname || "").toLowerCase();
      const origin = normalizeApiBase(window.location.origin || "");
      const isFileProtocol = protocol === "file:";
      const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";

      if (!isFileProtocol && origin && origin !== "null") {
        candidates.push(origin);
      }
      if (isFileProtocol || isLocalHost) {
        candidates.push("http://127.0.0.1:8000");
      }

      return Array.from(new Set(candidates));
    }

    function buildApiUrl(base, path) {
      const cleanPath = String(path || "").startsWith("/") ? String(path || "") : `/${String(path || "")}`;
      return `${String(base || "").replace(/\/+$/, "")}${cleanPath}`;
    }

    function apiErrorMessage(status, payload, context = "") {
      if (payload && payload.error) {
        const message = String(payload.error);
        if (status === 404 && message.toLowerCase().includes("ruta no encontrada")) {
          if (context === "sunat") {
            return "Tu backend no tiene /api/sunat/ruc activo. Reinicia run_backend.bat con el codigo actualizado.";
          }
          return "Tu backend no tiene este endpoint activo. Reinicia run_backend.bat con el codigo actualizado.";
        }
        return message;
      }
      if (context === "sunat") {
        if (status === 429) return "SUNAT bloqueo temporalmente la consulta por limite. Intenta nuevamente.";
        if (status === 401 || status === 403) return "SUNAT rechazo la consulta en este momento.";
        if (status === 404) return "No se encontro informacion en SUNAT para ese RUC.";
        if (status === 503) return "SUNAT no disponible temporalmente. Intenta nuevamente.";
        return `Error ${status || "de conexion"} al consultar SUNAT.`;
      }
      if (status === 401 || status === 403) return "Tu sesion vencio. Inicia sesion nuevamente.";
      if (status === 404) return "El endpoint solicitado no existe en el backend actual.";
      if (status === 503) return "Servicio no disponible temporalmente.";
      return `Error ${status || "de conexion"} al conectar con el backend.`;
    }

    async function requestJson(method, path, body = null, extraHeaders = {}, context = "") {
      const headers = { ...extraHeaders };
      if (body !== null && body !== undefined) {
        headers["Content-Type"] = "application/json";
      }
      let lastError = { ok: false, error: "No se pudo conectar con el backend.", status: 0 };

      for (let i = 0; i < API_BASE_CANDIDATES.length; i += 1) {
        const base = API_BASE_CANDIDATES[i];
        const hasNext = i < API_BASE_CANDIDATES.length - 1;
        const url = buildApiUrl(base, path);

        const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), 9000) : null;

        try {
          const response = await fetch(url, {
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

          if (response.ok && payload && payload.ok !== false) {
            return { ok: true, payload, status: response.status };
          }

          if (!API_BASE_EXPLICIT && hasNext && (response.status === 404 || response.status === 405 || response.status === 0)) {
            lastError = { ok: false, error: apiErrorMessage(response.status, payload, context), status: response.status };
            continue;
          }

          return { ok: false, error: apiErrorMessage(response.status, payload, context), status: response.status };
        } catch (error) {
          if (timer) clearTimeout(timer);
          if (hasNext) continue;
          const aborted = String(error && error.name ? error.name : "").toLowerCase() === "aborterror";
          lastError = {
            ok: false,
            error: aborted ? "El backend esta demorando demasiado en responder. Verifica que este encendido." : "No se pudo conectar con el backend.",
            status: 0
          };
        }
      }

      return lastError;
    }

    function escapeHtml(text) {
      return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function usernameFromEmail(email) {
      return String(email || "").split("@")[0] || "cliente";
    }

    function formatMoney(value) {
      return `S/. ${Number(value || 0).toFixed(2)}`;
    }

    function sanitizeLabel(text) {
      return String(text || "").replace(/\s+/g, " ").trim();
    }

    function isSuspiciousLabel(text) {
      const value = sanitizeLabel(text).toLowerCase();
      if (!value) return true;
      if (value.length > 120) return true;
      if (value.includes("${") || value.includes("function ") || value.includes("<script")) return true;
      return false;
    }

    function formatDateLabel(isoDate) {
      const date = new Date(isoDate || Date.now());
      return date.toLocaleDateString("es-PE");
    }

    function formatDateTimeLabel(isoDate) {
      const date = new Date(isoDate || Date.now());  return `${date.toLocaleDateString("es-PE")} ${date.toLocaleTimeString("es-PE", { hour : "2-digit", minute: "2-digit" })}`;
    }

    function formatTimeLabel(isoDate) {
      const date = new Date(isoDate || Date.now());  return date.toLocaleTimeString("es-PE", { hour : "2-digit", minute: "2-digit", second: "2-digit" });
    }

    function getSession() {
      const session = authStore && typeof authStore.getSession === "function"
        ? authStore.getSession()
        : null;
      if (session) return session;
      if (isDesignPreview() && previewStore && typeof previewStore.getSession === "function") {
        const demoSession = previewStore.getSession();
        if (demoSession) return demoSession;
      }
      return window.EUREKA_DEMO_ENABLED ? window.EUREKA_DEMO_GUEST_SESSION : null;
    }

    function getSessionToken(session) {
      return String(session && session.token ? session.token : "").trim();
    }

    function isAdminSession(session) {
      const isPreviewAdmin = Boolean(
        previewStore
        && typeof previewStore.isPreviewSession === "function"
        && previewStore.isPreviewSession(session)
        && String(session && session.role ? session.role : "").trim().toLowerCase() === "admin"
      );
      if (isPreviewAdmin) return true;
      const email = normalizeEmail(session && session.email ? session.email : "");
      const role = String(session && session.role ? session.role : "").trim().toLowerCase();
      return role === "admin" || (!!ADMIN_EMAIL && email === ADMIN_EMAIL);
    }

    function isCustomerSession(session) {
      return !!(session && session.email) && !isAdminSession(session);
    }

    function getProformaKey(email) {
      return `${PROFORMA_KEY_PREFIX}${normalizeEmail(email)}`;
    }

    function getMetaKey(email) {
      return `${PROFORMA_META_PREFIX}${normalizeEmail(email)}`;
    }

    function getHistoryKey(email) {
      return `${PROFORMA_HISTORY_PREFIX}${normalizeEmail(email)}`;
    }

    function getLastProformaKey(email) {
      return `${PROFORMA_LAST_KEY_PREFIX}${normalizeEmail(email)}`;
    }

    function openGeneratedProformaPage(session, record) {
      const safeId = String(record && record.id ? record.id : "").trim();
      if (!safeId) {
        setAccessAlert("danger", "La proforma fue creada, pero no se pudo abrir la pagina de envio.");
        return;
      }
      try {
        localStorage.setItem(getLastProformaKey(session.email), safeId);
      } catch (error) {
        // no-op
      }
      window.location.href = `proforma-enviar.html?id=${encodeURIComponent(safeId)}`;
    }

    function getProformaItems(session) {
      if (!isCustomerSession(session)) return [];

      try {
        const raw = JSON.parse(localStorage.getItem(getProformaKey(session.email)));
        if (!Array.isArray(raw)) return [];

        const safeItems = raw.map((item) => ({  id : String(item.id || item.code || item.name || "").trim(),  code : sanitizeLabel(item.code),  name : sanitizeLabel(item.name),  price : Number(item.price || 0),  qty : Math.max(1, Number(item.qty || 1)),  originalPrice : Number(item.originalPrice || 0),  discountPct : Math.max(0, Number(item.discountPct || 0)),  isPromotion : Boolean(item.isPromotion) || Number(item.discountPct || 0) > 0 || Number(item.originalPrice || 0) > Number(item.price || 0)
          }))
          .filter((item) => {
            if (!item.id || !item.name) return false;
            if (!Number.isFinite(item.price) || item.price < 0) return false;
            if (!Number.isFinite(item.qty) || item.qty <= 0) return false;
            if (!Number.isFinite(item.originalPrice) || item.originalPrice < 0) return false;
            if (!Number.isFinite(item.discountPct) || item.discountPct < 0) return false;
            if (isSuspiciousLabel(item.name)) return false;
            return true;
          });

        if (safeItems.length !== raw.length) {
          saveProformaItems(session, safeItems);
        }

        return safeItems;
      } catch (error) {
        return [];
      }
    }

    function saveProformaItems(session, items) {
      if (!isCustomerSession(session)) return;
      localStorage.setItem(getProformaKey(session.email), JSON.stringify(items));
      window.dispatchEvent(new CustomEvent("proforma:changed"));
    }

    function getProformaMeta(session) {
      if (!isCustomerSession(session)) return {};
      try {
        return JSON.parse(localStorage.getItem(getMetaKey(session.email))) || {};
      } catch (error) {
        return {};
      }
    }

    function saveProformaMeta(session, meta) {
      if (!isCustomerSession(session)) return;
      localStorage.setItem(getMetaKey(session.email), JSON.stringify(meta || {}));
    }

    function getProformaHistory(session) {
      if (!isCustomerSession(session)) return [];
      try {
        const raw = JSON.parse(localStorage.getItem(getHistoryKey(session.email)));
        if (!Array.isArray(raw)) return [];
        const safeHistory = raw.map(sanitizeProformaRecord).filter(Boolean);

        if (safeHistory.length !== raw.length) {
          saveProformaHistory(session, safeHistory);
        }

        return sortHistoryRecords(safeHistory);
      } catch (error) {
        return [];
      }
    }

    function saveProformaHistory(session, history) {
      if (!isCustomerSession(session)) return;  const safeHistory = Array.isArray(history) ? sortHistoryRecords(history) : [];
      localStorage.setItem(getHistoryKey(session.email), JSON.stringify(safeHistory));
    }

    function getPreviewSeedItems() {
      return [];
    }

    function buildPreviewSeedRecord(session, items) {
      const issuedAt = new Date(Date.now() - 86400000).toISOString();
      const safeItems = Array.isArray(items) ? items : [];
      const totalItems = safeItems.reduce((acc, item) => acc + Math.max(1, Number(item.qty || 0)), 0);
      const totalAmount = safeItems.reduce((acc, item) => acc + (Math.max(1, Number(item.qty || 0)) * Number(item.price || 0)), 0);
      return {
        id: "preview-proforma-001",
        serial: "PR-2026-0001",
        issuedAt,
        customerName: "Clinica Demo S.A.C.",
        customerEmail: normalizeEmail(session && session.email),
        customerRuc: "20123456789",
        customerDepartment: "Lima",
        customerDistrict: "Miraflores",
        customerAddress: "Av. Demo 123, oficina 201",
        customerPhone: "999999999",
        totalItems,
        totalAmount: Number(totalAmount.toFixed(2)),
        items: safeItems,
        createdAt: issuedAt
      };
    }

    function ensurePreviewProformaSeed(session) {
      if (window.EUREKA_DEMO_ENABLED || !isDesignPreview() || !isCustomerSession(session)) return;

      const currentItems = getProformaItems(session);
      if (!currentItems.length) {
        saveProformaItems(session, getPreviewSeedItems());
      }

      const currentMeta = getProformaMeta(session);
      if (!String(currentMeta.ruc || "").trim() || !String(currentMeta.customerName || "").trim()) {
        saveProformaMeta(session, {
          ...currentMeta,
          ruc: "20123456789",
          customerName: "Clinica Demo S.A.C.",
          customerDepartment: "Lima",
          customerDistrict: "Miraflores",
          customerAddress: "Av. Demo 123, oficina 201",
          customerPhone: "999999999"
        });
      }

      const currentHistory = getProformaHistory(session);
      if (!currentHistory.length) {
        const previewItems = getProformaItems(session);
        saveProformaHistory(session, [buildPreviewSeedRecord(session, previewItems)]);
      }
    }

    function sanitizeProformaRecord(record) {
      if (!record || typeof record !== "object") return null;

      const safeItems = Array.isArray(record.items)
        ? record.items
          .map((item) => ({
            name : sanitizeLabel(item.name),
            code : sanitizeLabel(item.code),
            qty : Math.max(1, Number(item.qty || 1)),
            price : Number(item.price || 0),
            originalPrice : Number(item.originalPrice || 0),
            discountPct : Math.max(0, Number(item.discountPct || 0)),
            isPromotion : Boolean(item.isPromotion) || Number(item.discountPct || 0) > 0 || Number(item.originalPrice || 0) > Number(item.price || 0)
          }))
          .filter((item) => {
            if (!item.name || isSuspiciousLabel(item.name)) return false;
            if (!Number.isFinite(item.qty) || item.qty <= 0) return false;
            if (!Number.isFinite(item.price) || item.price < 0) return false;
            if (!Number.isFinite(item.originalPrice) || item.originalPrice < 0) return false;
            if (!Number.isFinite(item.discountPct) || item.discountPct < 0) return false;
            return true;
          })
        : [];

      const safeRecord = {
        id : String(record.id || "").trim(),
        serial : String(record.serial || "").trim(),
        issuedAt : String(record.issuedAt || ""),
        customerName : sanitizeLabel(record.customerName),
        customerEmail : normalizeEmail(record.customerEmail),
        customerRuc : String(record.customerRuc || "").trim(),
        customerDepartment : sanitizeLabel(record.customerDepartment),
        customerDistrict : sanitizeLabel(record.customerDistrict),
        customerAddress : sanitizeLabel(record.customerAddress),
        customerPhone : sanitizePhone(record.customerPhone),
        totalItems : Number(record.totalItems || 0),
        totalAmount : Number(record.totalAmount || 0),
        items : safeItems,
        createdAt : String(record.createdAt || "").trim()
      };

      if (!safeRecord.id || !safeRecord.serial || !safeRecord.items.length) return null;
      if (!safeRecord.customerName || isSuspiciousLabel(safeRecord.customerName)) return null;
      if (!Number.isFinite(safeRecord.totalItems) || safeRecord.totalItems < 0) return null;
      if (!Number.isFinite(safeRecord.totalAmount) || safeRecord.totalAmount < 0) return null;
      return safeRecord;
    }

    function getRecordSortTime(record) {
      const issuedAt = Date.parse(String(record && record.issuedAt ? record.issuedAt : ""));
      if (Number.isFinite(issuedAt)) return issuedAt;
      const createdAt = Date.parse(String(record && record.createdAt ? record.createdAt : ""));
      if (Number.isFinite(createdAt)) return createdAt;
      return 0;
    }

    function sortHistoryRecords(history) {
      return (Array.isArray(history) ? history.slice() : []).sort((a, b) => getRecordSortTime(b) - getRecordSortTime(a));
    }

    function mergeHistoryRecords(primaryHistory, secondaryHistory) {
      const merged = new Map();

      (Array.isArray(primaryHistory) ? primaryHistory : []).forEach((record) => {
        const safeRecord = sanitizeProformaRecord(record);
        if (!safeRecord) return;
        merged.set(safeRecord.id, safeRecord);
      });

      (Array.isArray(secondaryHistory) ? secondaryHistory : []).forEach((record) => {
        const safeRecord = sanitizeProformaRecord(record);
        if (!safeRecord || merged.has(safeRecord.id)) return;
        merged.set(safeRecord.id, safeRecord);
      });

      return sortHistoryRecords(Array.from(merged.values()));
    }

    function getAuthHeaders(session) {
      const token = getSessionToken(session);
      if (!token) return {};
      return { Authorization: `Bearer ${token}` };
    }

    async function syncProformaHistory(session) {
      const localHistory = getProformaHistory(session);
      if (isDesignPreview()) {
        return { ok: true, history: localHistory };
      }
      if (!isCustomerSession(session)) {
        return { ok: true, history: [] };
      }

      const authHeaders = getAuthHeaders(session);
      if (!authHeaders.Authorization) {
        return { ok: false, history: localHistory, error: "Tu sesion no tiene token activo para sincronizar proformas." };
      }

      const result = await requestJson("GET", "/api/proformas", null, authHeaders, "proformas");
      if (!result.ok || !result.payload) {
        return {
          ok: false,
          history: localHistory,
          error: result.error || "No se pudo cargar el historial desde el backend."
        };
      }

      const remoteHistory = Array.isArray(result.payload.items)
        ? result.payload.items.map(sanitizeProformaRecord).filter(Boolean)
        : [];
      const mergedHistory = mergeHistoryRecords(remoteHistory, localHistory);
      saveProformaHistory(session, mergedHistory);
      return { ok: true, history: mergedHistory };
    }

    async function persistProformaRecord(session, record) {
      const safeRecord = sanitizeProformaRecord(record);
      const localHistory = mergeHistoryRecords(safeRecord ? [safeRecord] : [], getProformaHistory(session));

      if (!safeRecord) {
        return { ok: false, fallback: false, error: "La proforma generada es invalida y no se pudo guardar." };
      }

      saveProformaHistory(session, localHistory);

      if (isDesignPreview()) {
        return { ok: true, localOnly: true, record: safeRecord, history: localHistory };
      }

      const authHeaders = getAuthHeaders(session);
      if (!authHeaders.Authorization) {
        return {
          ok: false,
          fallback: true,
          record: safeRecord,
          error: "Tu sesion no tiene token activo. La proforma se guardo solo en este navegador."
        };
      }

      const result = await requestJson("POST", "/api/proformas", safeRecord, authHeaders, "proformas");
      if (!result.ok || !result.payload) {
        return {
          ok: false,
          fallback: true,
          record: safeRecord,
          error: (result && result.error) || "No se pudo guardar la proforma en el backend."
        };
      }

      const backendRecord = sanitizeProformaRecord(result.payload.record) || safeRecord;
      const mergedHistory = mergeHistoryRecords([backendRecord], getProformaHistory(session));
      saveProformaHistory(session, mergedHistory);
      return { ok: true, record: backendRecord, history: mergedHistory };
    }

    async function deleteProformaRecord(session, record) {
      const safeId = String(record && record.id ? record.id : "").trim();
      if (!safeId) return { ok: false, error: "No se pudo identificar la proforma." };

      const nextHistory = getProformaHistory(session).filter((item) => item.id !== safeId);
      if (isDesignPreview()) {
        saveProformaHistory(session, nextHistory);
        return { ok: true, localOnly: true };
      }

      const authHeaders = getAuthHeaders(session);
      if (!authHeaders.Authorization) {
        saveProformaHistory(session, nextHistory);
        return {
          ok: true,
          localOnly: true,
          warning: "La proforma se elimino solo de este navegador porque la sesion no tiene token activo."
        };
      }

      const result = await requestJson(
        "DELETE",
        `/api/proformas/${encodeURIComponent(safeId)}`,
        null,
        authHeaders,
        "proformas"
      );

      if (!result.ok && Number(result.status || 0) !== 404) {
        return { ok: false, error: result.error || "No se pudo eliminar la proforma." };
      }

      saveProformaHistory(session, nextHistory);
      return { ok: true, staleRemote: Number(result.status || 0) === 404 };
    }

    function setAccessAlert(type, message) {
      accessAlert.className = `alert alert-${type}`;
      accessAlert.textContent = message;
      accessAlert.classList.remove("d-none");
    }

    function hideAccessAlert() {
      accessAlert.classList.add("d-none");
      accessAlert.textContent = "";
    }

    function buildWhatsappMessage(record) {
      return "Buenas, te envío la cotización solicitada. Por favor revisa el documento adjunto. Quedo atento a cualquier consulta. Gracias.";
    }

    function buildWhatsappUrl(record) {
      return `https://web.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(buildWhatsappMessage(record))}`;
    }

    function hideWhatsappPrompt(options = {}) {
      const allowClose = Boolean(options && (options.user === true || options.force === true));
      if (whatsappPromptVisible && !allowClose) return;
      currentWhatsappRecord = null;
      whatsappPromptVisible = false;
      document.body.classList.remove("whatsapp-prompt-open");
      document.body.style.removeProperty("overflow");
      if (!proformaWhatsappPrompt) return;
      if (proformaWhatsappPreview) proformaWhatsappPreview.innerHTML = "";
      proformaWhatsappPrompt.classList.add("d-none");
      proformaWhatsappPrompt.setAttribute("aria-hidden", "true");
    }

    function showWhatsappPrompt(record) {
      if (!proformaWhatsappPrompt || !record) return;
      hidePreviewModal();
      currentWhatsappRecord = record;
      whatsappPromptVisible = true;
      document.body.classList.add("whatsapp-prompt-open");
      document.body.style.overflow = "hidden";
      if (proformaWhatsappMessage) {
        proformaWhatsappMessage.textContent = `La proforma ${record.serial} fue creada y guardada en tu historial. Primero descarga el PDF y luego abre WhatsApp Web para adjuntarlo manualmente.`;
      }
      if (proformaWhatsappPreview) {
        try {
          proformaWhatsappPreview.innerHTML = buildProformaDocumentMarkup(record, "whatsapp");
        } catch (error) {
          proformaWhatsappPreview.innerHTML = `<p class="mb-0">No se pudo mostrar la vista previa, pero la proforma fue creada correctamente.</p>`;
        }
      }
      proformaWhatsappPrompt.classList.remove("d-none");
      proformaWhatsappPrompt.setAttribute("aria-hidden", "false");
      window.setTimeout(() => {
        if (proformaWhatsappSendBtn) proformaWhatsappSendBtn.focus({ preventScroll: true });
      }, 60);
    }

    function sendCurrentProformaToWhatsapp() {
      if (!currentWhatsappRecord) {
        hideWhatsappPrompt({ force: true });
        return;
      }

      const popup = window.open(buildWhatsappUrl(currentWhatsappRecord), "_blank", "noopener,noreferrer");
      if (popup) popup.opener = null;
      if (!popup) {
        setAccessAlert("warning", "Tu navegador bloqueo la ventana de WhatsApp. Permite ventanas emergentes e intenta nuevamente.");
        return;
      }
      setAccessAlert("success", "WhatsApp Web se abrio en una nueva pestana. La vista previa queda abierta por si necesitas revisar o descargar la proforma.");
    }

    function getPreviewModalInstance() {
      if (!proformaPreviewModalEl) return null;
      const bootstrapApi = window.bootstrap;
      if (!bootstrapApi || !bootstrapApi.Modal) return null;
      if (!proformaPreviewModalInstance) {
        proformaPreviewModalInstance = new bootstrapApi.Modal(proformaPreviewModalEl);
      }
      return proformaPreviewModalInstance;
    }

    function showPreviewModal() {
      const modal = getPreviewModalInstance();
      if (modal) {
        modal.show();
        return;
      }
      if (!proformaPreviewModalEl) return;
      proformaPreviewModalEl.style.display = "block";
      proformaPreviewModalEl.classList.add("show");
      proformaPreviewModalEl.removeAttribute("aria-hidden");
      proformaPreviewModalEl.setAttribute("aria-modal", "true");
      document.body.classList.add("modal-open");
      document.body.style.overflow = "hidden";
      if (!proformaFallbackBackdrop) {
        proformaFallbackBackdrop = document.createElement("div");
        proformaFallbackBackdrop.className = "modal-backdrop fade show proforma-fallback-backdrop";
      }
      if (!document.body.contains(proformaFallbackBackdrop)) {
        document.body.appendChild(proformaFallbackBackdrop);
      }
    }

    function hidePreviewModal() {
      const modal = getPreviewModalInstance();
      if (modal) {
        modal.hide();
        return;
      }
      if (!proformaPreviewModalEl) return;
      proformaPreviewModalEl.classList.remove("show");
      proformaPreviewModalEl.style.display = "none";
      proformaPreviewModalEl.setAttribute("aria-hidden", "true");
      proformaPreviewModalEl.removeAttribute("aria-modal");
      document.body.classList.remove("modal-open");
      document.body.style.overflow = "";
      if (proformaFallbackBackdrop && proformaFallbackBackdrop.parentNode) {
        proformaFallbackBackdrop.parentNode.removeChild(proformaFallbackBackdrop);
      }
    }

    function validateRuc(ruc) {
      return /^(10|20)\d{9}$/.test(String(ruc || "").trim());
    }

    function sanitizePhone(value) {
      return String(value || "").replace(/[^\d+]/g, "").slice(0, 15);
    }

    function getCustomerDeliveryData() {
      return {
        customerDepartment: sanitizeLabel(customerDepartmentInput && customerDepartmentInput.value ? customerDepartmentInput.value : ""),
        customerDistrict: sanitizeLabel(customerDistrictInput && customerDistrictInput.value ? customerDistrictInput.value : ""),
        customerAddress: sanitizeLabel(customerAddressInput && customerAddressInput.value ? customerAddressInput.value : ""),
        customerPhone: sanitizePhone(customerPhoneInput && customerPhoneInput.value ? customerPhoneInput.value : ""),
        customerEmail: normalizeEmail(customerEmailInput && customerEmailInput.value ? customerEmailInput.value : "")
      };
    }

    function validateCustomerDeliveryData(data) {
      if (!/^\+?\d{7,15}$/.test(data.customerPhone)) return "Ingresa un número de teléfono válido para coordinar.";
      if (data.customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.customerEmail)) return "Ingresa un correo válido o deja ese campo vacío.";
      if (window.EUREKA_DEMO_ENABLED) return "";
      if (!data.customerDepartment) return "Selecciona el departamento.";
      if (!data.customerDistrict) return "Selecciona el distrito.";
      if (!data.customerAddress || data.customerAddress.length < 6) return "Ingresa una direccion exacta valida.";
      return "";
    }

    function calculateTotals(items) {
      return items.reduce((acc, item) => {
        const qty = Number(item.qty || 0);
        const price = Number(item.price || 0);
        acc.items += qty;
        acc.total += qty * price;
        return acc;  }, { items : 0, total: 0 });
    }

    function calculateTaxBreakdown(totalAmount) {
      const gross = Number(Number(totalAmount || 0).toFixed(2));
      const taxable = Number((gross / 1.18).toFixed(2));
      const igv = Number((gross - taxable).toFixed(2));
      return { taxable, igv, gross };
    }

    function buildProformaSerial(historyLength) {
      const sequence = String(Number(historyLength || 0) + 1).padStart(6, "0");
      return `PF01-${sequence}`;
    }

    function createProformaRecord(session, items, ruc, customerName, deliveryData = {}) {
      const now = new Date();
      const history = getProformaHistory(session);
      const totals = calculateTotals(items);
      const safeName = sanitizeLabel(customerName) || String(session.name || "").trim() || usernameFromEmail(session.email);

      return {  id : `prf_${now.getTime()}_${Math.floor(Math.random() * 1000)}`,  serial : buildProformaSerial(history.length),  issuedAt : now.toISOString(),  customerName : safeName,  customerEmail : normalizeEmail(deliveryData.customerEmail || (String(session.email || "").endsWith(".local") ? "" : session.email)),  customerRuc : String(ruc || "").trim(), customerDepartment : sanitizeLabel(deliveryData.customerDepartment), customerDistrict : sanitizeLabel(deliveryData.customerDistrict), customerAddress : sanitizeLabel(deliveryData.customerAddress), customerPhone : sanitizePhone(deliveryData.customerPhone), totalItems : totals.items,  totalAmount : totals.total,  items : items.map((item) => ({  name : sanitizeLabel(item.name),  code : sanitizeLabel(item.code),  qty : Math.max(1, Number(item.qty || 1)),  price : Number(item.price || 0),  originalPrice : Number(item.originalPrice || 0),  discountPct : Math.max(0, Number(item.discountPct || 0)),  isPromotion : Boolean(item.isPromotion) || Number(item.discountPct || 0) > 0 || Number(item.originalPrice || 0) > Number(item.price || 0)
        }))
      };
    }

    async function fetchSunatCustomerName(ruc) {
      const safeRuc = String(ruc || "").trim();
      const result = await requestJson("GET", `/api/sunat/ruc?numero=${encodeURIComponent(safeRuc)}`);
      if (!result.ok || !result.payload) {
        return { ok: false, error: result.error || "No se pudo consultar SUNAT." };
      }
      const name = sanitizeLabel(result.payload.name);
      if (!name) {
        return { ok: false, error: "SUNAT no devolvio nombre o razon social." };
      }
      return { ok: true, name };
    }

    function buildProformaDocumentMarkup(record, idSuffix = "view") {
      const breakdown = calculateTaxBreakdown(record.totalAmount);
      const safeId = String(idSuffix || "view").replace(/[^A-Za-z0-9_-]/g, "") || "view";
      const rows = record.items.map((item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.code || "-")}</td>
          <td>
            <strong>${escapeHtml(item.name)}</strong>
            ${item.isPromotion ? `<br><small class="doc-row-promo">Promocion -${Math.max(0, Number(item.discountPct || 0))}%</small>` : ""}
            ${item.isPromotion && Number(item.originalPrice || 0) > Number(item.price || 0) ? `<br><small class="doc-row-old-price">Antes : ${formatMoney(item.originalPrice)}</small>` : ""}
          </td>
          <td class="text-end">${item.qty}</td>
          <td class="text-end">${formatMoney(item.price)}</td>
          <td class="text-end">${formatMoney(item.qty * item.price)}</td>
        </tr>
      `).join("");

      return `
        <article class="doc-wrap" id="proformaDocView-${safeId}">
          <header class="doc-header">
            <div class="doc-brand">
              <img src="${escapeHtml(LOGO_PATH)}" alt="Logo proforma" class="doc-logo">
              <div class="doc-company">
                <h3 class="doc-company-name">${escapeHtml(COMPANY_INFO.name)}</h3>  <p>RUC : ${escapeHtml(COMPANY_INFO.ruc)}</p>
                <p>${escapeHtml(COMPANY_INFO.address)}</p>  <p>Tel : ${escapeHtml(COMPANY_INFO.phone)}</p>  <p>Email : ${escapeHtml(COMPANY_INFO.email)}</p>
              </div>
            </div>
            <div class="doc-meta doc-voucher">
              <p class="doc-voucher-title">PROFORMA</p>
              <p class="doc-voucher-number">${escapeHtml(record.serial)}</p>
              <p><span>Fecha:</span><strong>${escapeHtml(formatDateLabel(record.issuedAt))}</strong></p>
              <p><span>Hora:</span><strong>${escapeHtml(formatTimeLabel(record.issuedAt))}</strong></p>
              <p><span>Moneda:</span><strong>PEN</strong></p>
            </div>
          </header>

          <section class="doc-customer doc-customer-grid">
            <p><span>Cliente:</span> <strong>${escapeHtml(record.customerName)}</strong></p>
            <p><span>RUC:</span> <strong>${escapeHtml(record.customerRuc)}</strong></p>
            <p><span>Correo:</span> <strong>${escapeHtml(record.customerEmail)}</strong></p>
            <p><span>Telefono:</span> <strong>${escapeHtml(record.customerPhone || "-")}</strong></p>
            <p><span>Departamento:</span> <strong>${escapeHtml(record.customerDepartment || "-")}</strong></p>
            <p><span>Distrito:</span> <strong>${escapeHtml(record.customerDistrict || "-")}</strong></p>
            <p><span>Direccion:</span> <strong>${escapeHtml(record.customerAddress || "-")}</strong></p>
            <p><span>Condicion:</span> <strong>Contado</strong></p>
          </section>

          <div class="table-responsive">
            <table class="table table-sm doc-table align-middle mb-3">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Codigo</th>
                  <th>Descripcion</th>
                  <th class="text-end">Cant.</th>
                  <th class="text-end">V. Unit.</th>
                  <th class="text-end">Importe</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>

          <section class="doc-total">
            <p><span>Op. gravada:</span><strong>${formatMoney(breakdown.taxable)}</strong></p>
            <p><span>IGV (18%):</span><strong>${formatMoney(breakdown.igv)}</strong></p>
            <p class="doc-total-final"><span>Importe total:</span><strong>${formatMoney(breakdown.gross)}</strong></p>
          </section>
          <p class="doc-note">Esta proforma es referencial y no constituye comprobante de pago.</p>
        </article>
      `;
    }

    function renderProformaDocument(record) {
      if (!record) {
        hidePreviewModal();
        proformaPreview.classList.add("d-none");
        proformaPreview.innerHTML = "";
        downloadCurrentBtn.disabled = true;
        if (modalDownloadBtn) modalDownloadBtn.disabled = true;
        currentPreviewRecord = null;
        return;
      }

      proformaPreview.innerHTML = buildProformaDocumentMarkup(record);
      proformaPreview.classList.remove("d-none");
      downloadCurrentBtn.disabled = false;
      if (modalDownloadBtn) modalDownloadBtn.disabled = false;
      currentPreviewRecord = record;
      showPreviewModal();
    }

    function paintHistory(history) {
      const safeHistory = Array.isArray(history) ? history : [];
      historyCountBadge.textContent = String(safeHistory.length);
      proformaHistoryEmpty.classList.toggle("d-none", safeHistory.length > 0);

      if (!safeHistory.length) {
        proformaHistoryList.innerHTML = "";
        return;
      }

      proformaHistoryList.innerHTML = safeHistory.map((record) => `
        <article class="history-item">
          <div class="history-main">
            <h4>${escapeHtml(record.serial)}</h4>
            <p>${escapeHtml(formatDateTimeLabel(record.issuedAt))}</p>  <p>RUC : ${escapeHtml(record.customerRuc)} | Total: <strong>${formatMoney(record.totalAmount)}</strong></p>
          </div>
          <div class="history-actions">
            <button type="button" class="btn btn-outline-secondary btn-sm" data-history-action="view" data-history-id="${escapeHtml(record.id)}">Ver</button>
            <button type="button" class="btn btn-dark btn-sm" data-history-action="download" data-history-id="${escapeHtml(record.id)}">Descargar</button>
            <button type="button" class="btn btn-outline-danger btn-sm" data-history-action="delete" data-history-id="${escapeHtml(record.id)}">Eliminar</button>
          </div>
        </article>
      `).join("");
    }

    async function renderHistory() {
      const session = getSession();
      if (!isCustomerSession(session)) {
        paintHistory([]);
        return { ok: true, history: [] };
      }

      const localHistory = getProformaHistory(session);
      paintHistory(localHistory);

      const syncState = await syncProformaHistory(session);
      const history = Array.isArray(syncState.history) ? syncState.history : [];
      if (JSON.stringify(history) !== JSON.stringify(localHistory)) {
        paintHistory(history);
      }

      return syncState;
    }

    function getPrintableHtml(record) {
      const breakdown = calculateTaxBreakdown(record.totalAmount);
      const logoAbsolute = new URL(LOGO_PATH, window.location.href).href;
      const issuedDate = formatDateLabel(record.issuedAt);
      const issuedTime = formatTimeLabel(record.issuedAt);
      const rows = record.items.map((item, index) => `
        <tr>
          <td class="center">${index + 1}</td>
          <td>${escapeHtml(item.code || "-")}</td>
          <td>
            ${escapeHtml(item.name)}
            ${item.isPromotion ? `<br><span class="promo-line">PROMOCION -${Math.max(0, Number(item.discountPct || 0))}%</span>` : ""}
            ${item.isPromotion && Number(item.originalPrice || 0) > Number(item.price || 0) ? `<br><span class="old-price-line">Antes : ${formatMoney(item.originalPrice)}</span>` : ""}
          </td>
          <td class="num">${item.qty}</td>
          <td class="num">${formatMoney(item.price)}</td>
          <td class="num">${formatMoney(item.qty * item.price)}</td>
        </tr>
      `).join("");

      return `
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(record.serial)} - Proforma</title>
  <style>
    :root {  --ink : #111;  --muted : #5a5a5a;  --line : #d7d7d7;  --bg-soft : #f5f5f5;
    }  * { box-sizing : border-box; }
    body {  margin : 0;  background : #fff;  color : var(--ink);  font-family : Arial, sans-serif;  font-size : 12px;
    }
    .sheet {  width : 210mm;  min-height : 297mm;  margin : 0 auto;  padding : 12mm;
    }
    .head {  display : flex;  justify-content : space-between;  align-items : flex-start;  gap : 12px;  border-bottom : 2px solid var(--ink);  padding-bottom : 10px;  margin-bottom : 12px;
    }
    .brand {  display : flex;  gap : 10px;  align-items : flex-start;
    }
    .brand img {  width : 120px;  height : auto;  border : 1px solid var(--line);  border-radius : 6px;  padding : 4px;
    }
    .company h1 {  margin : 0 0 4px;  font-size : 20px;  line-height : 1.1;  letter-spacing : .2px;
    }
    .company p {  margin : 2px 0;  color : var(--muted);  font-size : 11.5px;
    }
    .voucher {  min-width : 250px;  border : 2px solid var(--ink);  border-radius : 8px;  padding : 8px 10px;
    }
    .voucher .title {  margin : 0 0 3px;  text-align : center;  font-size : 14px;  font-weight : 800;  letter-spacing : .4px;
    }
    .voucher .number {  margin : 0 0 8px;  text-align : center;  font-size : 14px;  font-weight : 700;
    }
    .voucher-row {  display : flex;  justify-content : space-between;  gap : 10px;  margin : 2px 0;  font-size : 11px;
    }  .voucher-row span { color : var(--muted); }
    .client {  border : 1px solid var(--line);  border-radius : 8px;  padding : 8px 10px;  margin-bottom : 10px;  display : grid;  grid-template-columns : 1fr 1fr;  gap : 6px 18px;  background : #fff;
    }
    .client p {  margin : 0;  font-size : 11.5px;
    }
    .client .label {  color : var(--muted);  font-weight : 700;
    }
    table {  width : 100%;  border-collapse : collapse;  margin-top : 0;  table-layout : fixed;
    }
    .items thead th {  border : 1px solid var(--line);  background : var(--bg-soft);  padding : 7px 6px;  font-size : 11px;  text-transform : uppercase;  letter-spacing : .3px;
    }
    .items td {  border : 1px solid var(--line);  padding : 7px 6px;  font-size : 11.5px;  vertical-align : top;
    }
    .promo-line {  display : inline-block;  margin-top : 2px;  color : #0f7a2d;  font-size : 10px;  font-weight : 700;  letter-spacing : .2px;  text-transform : uppercase;
    }
    .old-price-line {  display : inline-block;  margin-top : 1px;  color : #6a6a6a;  font-size : 10px;  text-decoration : line-through;
    }
    .items th:nth-child(1), .items td:nth-child(1) { width: 7%; }
    .items th:nth-child(2), .items td:nth-child(2) { width: 16%; }
    .items th:nth-child(3), .items td:nth-child(3) { width: 37%; }
    .items th:nth-child(4), .items td:nth-child(4) { width: 10%; }
    .items th:nth-child(5), .items td:nth-child(5) { width: 15%; }
    .items th:nth-child(6), .items td:nth-child(6) { width: 15%; }  .center { text-align : center; }  .num { text-align : right; font-variant-numeric: tabular-nums; }
    .summary-wrap {  margin-top : 10px;  display : flex;  justify-content : flex-end;
    }
    .summary {  width : 340px;  border : 1px solid var(--line);  border-radius : 8px;  overflow : hidden;
    }  .summary table { width : 100%; }
    .summary td {  border-bottom : 1px solid var(--line);  padding : 7px 10px;  font-size : 12px;
    }
    .summary tr:last-child td { border-bottom: 0; }  .summary .label { color : var(--muted); }  .summary .value { text-align : right; font-variant-numeric: tabular-nums; }
    .summary .grand td {  background : var(--bg-soft);  font-size : 14px;  font-weight : 800;
    }
    .note {  margin-top : 10px;  font-size : 10.5px;  color : var(--muted);
    }  @page { size : A4; margin: 10mm; }
    @media print {  body { margin : 0; }
      .sheet {  width : auto;  min-height : auto;  margin : 0;  padding : 0;
      }  .items thead { display : table-header-group; }  .items tr { page-break-inside : avoid; }
    }
  </style>
</head>
<body>
  <main class="sheet">
    <header class="head">
      <div class="brand">
        <img src="${escapeHtml(logoAbsolute)}" alt="Eureka Clean">
        <div class="company">
          <h1>${escapeHtml(COMPANY_INFO.name)}</h1>  <p>RUC : ${escapeHtml(COMPANY_INFO.ruc)}</p>
          <p>${escapeHtml(COMPANY_INFO.address)}</p>  <p>Tel : ${escapeHtml(COMPANY_INFO.phone)}</p>  <p>Email : ${escapeHtml(COMPANY_INFO.email)}</p>
        </div>
      </div>
      <div class="voucher">
        <p class="title">PROFORMA</p>
        <p class="number">${escapeHtml(record.serial)}</p>
        <p class="voucher-row"><span>Fecha:</span><strong>${escapeHtml(issuedDate)}</strong></p>
        <p class="voucher-row"><span>Hora:</span><strong>${escapeHtml(issuedTime)}</strong></p>
        <p class="voucher-row"><span>Moneda:</span><strong>PEN</strong></p>
      </div>
    </header>

    <section class="client">
      <p><span class="label">Cliente:</span> ${escapeHtml(record.customerName)}</p>
      <p><span class="label">RUC:</span> ${escapeHtml(record.customerRuc)}</p>
      <p><span class="label">Correo:</span> ${escapeHtml(record.customerEmail)}</p>
      <p><span class="label">Telefono:</span> ${escapeHtml(record.customerPhone || "-")}</p>
      <p><span class="label">Departamento:</span> ${escapeHtml(record.customerDepartment || "-")}</p>
      <p><span class="label">Distrito:</span> ${escapeHtml(record.customerDistrict || "-")}</p>
      <p><span class="label">Direccion:</span> ${escapeHtml(record.customerAddress || "-")}</p>
      <p><span class="label">Condicion:</span> Contado</p>
    </section>

    <table class="items">
      <thead>
        <tr>
          <th class="center">N°</th>
          <th>Codigo</th>
          <th>Descripcion</th>
          <th class="num">Cant.</th>
          <th class="num">V. Unit.</th>
          <th class="num">Importe</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="summary-wrap">
      <div class="summary">
        <table>
          <tbody>
            <tr>
              <td class="label">Op. gravada</td>
              <td class="value">${formatMoney(breakdown.taxable)}</td>
            </tr>
            <tr>
              <td class="label">IGV (18%)</td>
              <td class="value">${formatMoney(breakdown.igv)}</td>
            </tr>
            <tr class="grand">
              <td>Importe total</td>
              <td class="value">${formatMoney(breakdown.gross)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <p class="note">Esta proforma es referencial y no constituye comprobante de pago.</p>

  </main>
</body>
</html>`;
    }

    function downloadRecord(record) {
      if (!record) {
        setAccessAlert("warning", "Primero genera o selecciona una proforma.");
        return false;
      }

      const printWindow = window.open("", "_blank", "width=980,height=760");
      if (!printWindow) {
        setAccessAlert("warning", "Tu navegador bloqueo la descarga del PDF. Permite ventanas emergentes e intenta nuevamente.");
        return false;
      }

      try {
        printWindow.document.open();
        printWindow.document.write(getPrintableHtml(record));
        printWindow.document.close();
        setTimeout(() => {
          try {
            printWindow.focus();
            printWindow.print();
          } catch (error) {
            setAccessAlert("warning", "No se pudo abrir el dialogo de descarga. Intenta nuevamente desde el boton Descargar PDF.");
          }
        }, 180);
        hideAccessAlert();
        return true;
      } catch (error) {
        try {
          printWindow.close();
        } catch (closeError) {
          // no-op
        }
        setAccessAlert("danger", "No se pudo generar el PDF. Revisa la proforma e intenta nuevamente.");
        return false;
      }
    }

    function resetPreview() {
      hidePreviewModal();
      proformaPreview.classList.add("d-none");
      proformaPreview.innerHTML = "";
      currentPreviewRecord = null;
      downloadCurrentBtn.disabled = true;
      if (modalDownloadBtn) modalDownloadBtn.disabled = true;
    }

    function renderProformaItems() {
      const session = getSession();
      if (!isCustomerSession(session)) return;

      const items = getProformaItems(session);
      const totals = calculateTotals(items);

      summaryItems.textContent = String(totals.items);
      summaryTotal.textContent = formatMoney(totals.total);
      proformaEmptyEl.classList.toggle("d-none", items.length > 0);

      if (!items.length) {
        proformaItemsEl.innerHTML = "";
        return;
      }

      proformaItemsEl.innerHTML = items.map((item, index) => `
        <article class="proforma-item">
          <div class="d-flex justify-content-between align-items-start gap-2">
            <div>
              <h5>${escapeHtml(item.name)}</h5>
              <p>${formatMoney(item.price)} x ${item.qty}</p>
              ${item.isPromotion ? `
                  <p class="proforma-item-promo">
                    <span class="proforma-item-promo-badge">Promocion -${Math.max(0, Number(item.discountPct || 0))}%</span>
                    ${Number(item.originalPrice || 0) > Number(item.price || 0) ? `<span class="proforma-item-promo-old">Antes ${formatMoney(item.originalPrice)}</span>` : ""}
                  </p>  ` : ""}
            </div>
            <button type="button" class="remove-btn" data-action="remove" data-index="${index}">Quitar</button>
          </div>
          <div class="d-flex justify-content-between align-items-center mt-2">
            <div class="qty-controls">
              <button type="button" class="qty-btn" data-action="dec" data-index="${index}">-</button>
              <span class="qty-val">${item.qty}</span>
              <button type="button" class="qty-btn" data-action="inc" data-index="${index}">+</button>
            </div>
            <strong>${formatMoney(item.qty * item.price)}</strong>
          </div>
        </article>
      `).join("");
    }

    async function renderAccess() {
      const session = getSession();
      resetPreview();

      if (!session || !session.email) {
        customerPanel.classList.add("d-none");
        setAccessAlert("warning", "Puedes crear tu proforma como invitado en esta demostración.");
        releaseProformaPreload();
        return;
      }

      if (isAdminSession(session)) {
        customerPanel.classList.add("d-none");
        setAccessAlert("secondary", "El creador de proforma esta habilitado solo para cuentas cliente.");
        releaseProformaPreload();
        return;
      }

      ensurePreviewProformaSeed(session);
      hideAccessAlert();
      customerPanel.classList.remove("d-none");

      const meta = getProformaMeta(session);
      rucInput.value = String(meta.ruc || "");
      customerNameInput.value = String(meta.customerName || "");
      if (customerDepartmentInput) customerDepartmentInput.value = String(meta.customerDepartment || "");
      if (customerDistrictInput) customerDistrictInput.value = String(meta.customerDistrict || "");
      if (customerAddressInput) customerAddressInput.value = String(meta.customerAddress || "");
      if (customerPhoneInput) customerPhoneInput.value = String(meta.customerPhone || "");
      if (customerEmailInput) customerEmailInput.value = String(meta.customerEmail || (String(session.email || "").endsWith(".local") ? "" : session.email));
      if (window.EUREKA_DEMO_ENABLED && customerNameInput && !customerNameInput.value && session.role !== "guest") {
        customerNameInput.value = String(session.name || "");
      }
      renderProformaItems();
      paintHistory(getProformaHistory(session));
      releaseProformaPreload();
      if (isDesignPreview()) {
        setAccessAlert("info", "Modo de prueba: no es una boleta válida ni un cobro. La proforma y el carrito se guardan solo en este navegador.");
        return;
      }
      renderHistory()
        .then((historyState) => {
          if (!historyState.ok && historyState.error) {
            setAccessAlert("warning", `${historyState.error} Mostrando historial local disponible.`);
          }
        })
        .catch(() => {
          paintHistory(getProformaHistory(session));
        });
    }

    proformaItemsEl.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;

      const session = getSession();
      if (!isCustomerSession(session)) return;

      const index = Number(button.dataset.index);
      const action = button.dataset.action;
      const items = getProformaItems(session);
      if (Number.isNaN(index) || index < 0 || index >= items.length) return;

      if (action === "inc") {
        items[index].qty += 1;
      } else if (action === "dec") {
        items[index].qty -= 1;
        if (items[index].qty <= 0) items.splice(index, 1);
      } else if (action === "remove") {
        items.splice(index, 1);
      }

      saveProformaItems(session, items);
      renderProformaItems();
    });

    rucInput.addEventListener("input", () => {
      const cleanRuc = String(rucInput.value || "").replace(/\D/g, "").slice(0, 11);
      rucInput.value = cleanRuc;
      const session = getSession();
      if (!isCustomerSession(session)) return;
      const currentMeta = getProformaMeta(session);
      const savedRuc = String(currentMeta.ruc || "").trim();
      if (savedRuc && savedRuc !== cleanRuc) {
        customerNameInput.value = "";
      }
    });

    if (customerPhoneInput) {
      customerPhoneInput.addEventListener("input", () => {
        customerPhoneInput.value = sanitizePhone(customerPhoneInput.value);
      });
    }

    lookupRucBtn.addEventListener("click", async () => {
      const session = getSession();
      if (!isCustomerSession(session)) return;

      const ruc = String(rucInput.value || "").trim();
      if (!validateRuc(ruc)) {
        setAccessAlert("warning", "Ingresa un RUC valido de 11 digitos que inicie en 10 o 20.");
        return;
      }

      const originalLabel = lookupRucBtn.textContent;
      lookupRucBtn.disabled = true;
      lookupRucBtn.textContent = "Consultando...";
      try {
        const lookup = await fetchSunatCustomerName(ruc);
        if (!lookup.ok) {
          setAccessAlert("warning", lookup.error || "No se pudo obtener el nombre desde SUNAT.");
          return;
        }

        customerNameInput.value = lookup.name;
        const currentMeta = getProformaMeta(session);
        saveProformaMeta(session, { ...currentMeta, ...getCustomerDeliveryData(), ruc, customerName: lookup.name });
        setAccessAlert("success", "RUC validado en SUNAT y nombre autocompletado.");
      } finally {
        lookupRucBtn.disabled = false;
        lookupRucBtn.textContent = originalLabel;
      }
    });

    saveRucBtn.addEventListener("click", () => {
      const session = getSession();
      if (!isCustomerSession(session)) return;

      const ruc = String(rucInput.value || "").trim();
      if ((!window.EUREKA_DEMO_ENABLED || ruc) && !validateRuc(ruc)) {
        setAccessAlert("warning", "Ingresa un RUC valido de 11 digitos que inicie en 10 o 20.");
        return;
      }

      const customerName = sanitizeLabel(customerNameInput.value || "");
      if (!customerName) {
        setAccessAlert("warning", "Escribe el nombre de la persona interesada.");
        return;
      }

      const deliveryData = getCustomerDeliveryData();
      const deliveryError = validateCustomerDeliveryData(deliveryData);
      if (deliveryError) {
        setAccessAlert("warning", deliveryError);
        return;
      }

      const currentMeta = getProformaMeta(session);
      saveProformaMeta(session, { ...currentMeta, ...deliveryData, ruc, customerName });
      hideAccessAlert();
      setAccessAlert("success", "Datos del cliente guardados correctamente.");
    });

    clearProformaBtn.addEventListener("click", () => {
      const session = getSession();
      if (!isCustomerSession(session)) return;

      saveProformaItems(session, []);
      resetPreview();
      renderProformaItems();
    });

    downloadCurrentBtn.addEventListener("click", () => {
      const session = getSession();
      if (!isCustomerSession(session)) return;
      downloadRecord(currentPreviewRecord);
    });

    if (modalDownloadBtn) {
      modalDownloadBtn.addEventListener("click", () => {
        const session = getSession();
        if (!isCustomerSession(session)) return;
        downloadRecord(currentPreviewRecord);
      });
    }

    if (proformaPreviewModalEl) {
      proformaPreviewModalEl.addEventListener("click", (event) => {
        if (event.target === proformaPreviewModalEl) {
          hidePreviewModal();
        }
      });

      const dismissButtons = proformaPreviewModalEl.querySelectorAll("[data-bs-dismiss='modal']");
      dismissButtons.forEach((button) => {
        button.addEventListener("click", hidePreviewModal);
      });
    }

    if (proformaWhatsappSendBtn) {
      proformaWhatsappSendBtn.addEventListener("click", sendCurrentProformaToWhatsapp);
    }

    if (proformaWhatsappDownloadBtn) {
      proformaWhatsappDownloadBtn.addEventListener("click", () => {
        if (!currentWhatsappRecord) {
          setAccessAlert("warning", "Primero genera una proforma para descargar el PDF.");
          return;
        }
        downloadRecord(currentWhatsappRecord);
      });
    }

    [proformaWhatsappCancelBtn, proformaWhatsappCloseBtn].forEach((button) => {
      if (button) button.addEventListener("click", () => hideWhatsappPrompt({ user: true }));
    });

    if (proformaWhatsappPrompt) {
      proformaWhatsappPrompt.addEventListener("click", (event) => {
        const target = event.target && event.target.nodeType === 1 ? event.target : null;
        const actionButton = target
          ? target.closest("#proformaWhatsappCancelBtn, #proformaWhatsappCloseBtn, #proformaWhatsappDownloadBtn, #proformaWhatsappSendBtn")
          : null;
        if (!actionButton) {
          event.preventDefault();
          event.stopPropagation();
        }
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (proformaWhatsappPrompt && !proformaWhatsappPrompt.classList.contains("d-none")) {
          hideWhatsappPrompt({ user: true });
          return;
        }
        hidePreviewModal();
      }
    });

    previewProformaBtn.addEventListener("click", async () => {
      const session = getSession();
      if (!isCustomerSession(session)) return;

      const items = getProformaItems(session);
      if (!items.length) {
        setAccessAlert("warning", "Agrega al menos un producto para generar la proforma.");
        return;
      }

      const ruc = String(rucInput.value || "").trim();
      if ((!window.EUREKA_DEMO_ENABLED || ruc) && !validateRuc(ruc)) {
        setAccessAlert("warning", "Ingresa un RUC válido o déjalo vacío en esta demostración.");
        return;
      }

      const customerName = sanitizeLabel(customerNameInput.value || "");
      if (!customerName) {
        setAccessAlert("warning", "Escribe el nombre de la persona interesada.");
        return;
      }

      const deliveryData = getCustomerDeliveryData();
      const deliveryError = validateCustomerDeliveryData(deliveryData);
      if (deliveryError) {
        setAccessAlert("warning", deliveryError);
        return;
      }

      const currentMeta = getProformaMeta(session);
      saveProformaMeta(session, { ...currentMeta, ...deliveryData, ruc, customerName });

      const originalLabel = previewProformaBtn.textContent;
      previewProformaBtn.disabled = true;
      previewProformaBtn.textContent = "Generando...";

      try {
        const draftRecord = createProformaRecord(session, items, ruc, customerName, deliveryData);
        const savedRecord = sanitizeProformaRecord(draftRecord);
        if (!savedRecord) {
          setAccessAlert("danger", "La proforma generada es invalida y no se pudo guardar.");
          return;
        }

        saveProformaHistory(session, mergeHistoryRecords([savedRecord], getProformaHistory(session)));
        currentPreviewRecord = savedRecord;
        proformaPreview.classList.add("d-none");
        proformaPreview.innerHTML = "";
        downloadCurrentBtn.disabled = false;
        if (modalDownloadBtn) modalDownloadBtn.disabled = false;
        paintHistory(getProformaHistory(session));
        setAccessAlert("success", `Proforma ${savedRecord.serial} creada y guardada en tu historial.`);

        try {
          const persistResult = await persistProformaRecord(session, savedRecord);
          if (persistResult && persistResult.ok && persistResult.history) {
            paintHistory(persistResult.history);
          } else if (persistResult && persistResult.fallback && persistResult.error) {
            setAccessAlert("warning", `${persistResult.error} La proforma ${savedRecord.serial} queda visible en este navegador.`);
          }
        } catch (persistError) {
          paintHistory(getProformaHistory(session));
        }
        openGeneratedProformaPage(session, savedRecord);
      } catch (error) {
        setAccessAlert("danger", "No se pudo completar la generacion de la proforma. Intenta nuevamente.");
      } finally {
        previewProformaBtn.disabled = false;
        previewProformaBtn.textContent = originalLabel;
      }
    });

    proformaHistoryList.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-history-action]");
      if (!button) return;

      const session = getSession();
      if (!isCustomerSession(session)) return;

      const historyId = String(button.dataset.historyId || "").trim();
      const action = String(button.dataset.historyAction || "").trim();
      if (!historyId || !action) return;

      const history = getProformaHistory(session);
      const record = history.find((item) => item.id === historyId);
      if (!record) return;

      if (action === "view") {
        openGeneratedProformaPage(session, record);
        return;
      }

      if (action === "download") {
        downloadRecord(record);
        return;
      }

      if (action === "delete") {
        const confirmed = window.confirm(`Vas a eliminar la proforma ${record.serial || ""}. Esta accion no se puede deshacer. Continuar?`);
        if (!confirmed) return;

        button.disabled = true;
        const originalLabel = button.textContent;
        button.textContent = "Eliminando...";
        const deleteResult = await deleteProformaRecord(session, record);

        if (!deleteResult.ok) {
          button.disabled = false;
          button.textContent = originalLabel;
          setAccessAlert("danger", deleteResult.error || "No se pudo eliminar la proforma.");
          return;
        }

        if (currentPreviewRecord && currentPreviewRecord.id === record.id) {
          resetPreview();
        }
        if (currentWhatsappRecord && currentWhatsappRecord.id === record.id) {
          hideWhatsappPrompt({ force: true });
        }

        paintHistory(getProformaHistory(session));
        if (deleteResult.warning) {
          setAccessAlert("warning", deleteResult.warning);
        } else if (deleteResult.staleRemote) {
          setAccessAlert("success", `Proforma ${record.serial} eliminada del historial local.`);
        } else {
          setAccessAlert("success", `Proforma ${record.serial} eliminada correctamente.`);
        }
      }
    });

    window.addEventListener("auth:logout", () => {
      window.location.href = "index.html";
    });

    renderAccess()
      .catch(() => {
        if (customerPanel) customerPanel.classList.add("d-none");
        setAccessAlert("danger", "No se pudo cargar el creador de proforma. Recarga la pagina e intenta nuevamente.");
      })
      .finally(releaseProformaPreload);



