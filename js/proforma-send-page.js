(() => {
  const authStore = window.EUREKA_AUTH || null;
  const previewStore = window.EUREKA_PREVIEW || null;
  const ADMIN_EMAIL = String(window.EUREKA_ADMIN_EMAIL || "").trim().toLowerCase();
  const PROFORMA_HISTORY_PREFIX = "eurekaclean_proforma_history_";
  const PROFORMA_LAST_KEY_PREFIX = "eurekaclean_proforma_last_";
  const WHATSAPP_NUMBER = String(window.EUREKA_ORDER_WHATSAPP || "51981292376");
  const ORDER_EMAIL = String(window.EUREKA_ORDER_EMAIL || "eurekaverdeweb@gmail.com");
  const LOGO_PATH = "img/logo_proforma.png";
  const COMPANY_INFO = {
    name: "EUREKACLEAN S.A.C.",
    ruc: "20614833140",
    address: "Lima, Peru",
    phone: "+51 981 292 376",
    email: "eurekaverdeweb@gmail.com"
  };

  const sendAlert = document.getElementById("sendAlert");
  const sendPanel = document.getElementById("sendPanel");
  const sendPreview = document.getElementById("sendPreview");
  const sendDownloadBtn = document.getElementById("sendDownloadBtn");
  const sendWhatsappBtn = document.getElementById("sendWhatsappBtn");
  const sendEmailBtn = document.getElementById("sendEmailBtn");
  const sendAutoBtn = document.getElementById("sendAutoBtn");
  const sendAutoInfo = document.getElementById("sendAutoInfo");
  const urlParams = new URLSearchParams(window.location.search || "");
  const isPrintMode = urlParams.get("print") === "1";
  let currentRecord = null;

  function releasePreload() {
    document.documentElement.classList.remove("page-data-pending", "auth-preload");
    if (document.body) document.body.classList.remove("auth-preload");
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function sanitizeLabel(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function sanitizePhone(value) {
    return String(value || "").replace(/[^\d+]/g, "").slice(0, 15);
  }

  function formatMoney(value) {
    return `S/. ${Number(value || 0).toFixed(2)}`;
  }

  function formatDateLabel(isoDate) {
    const date = new Date(isoDate || Date.now());
    return date.toLocaleDateString("es-PE");
  }

  function formatTimeLabel(isoDate) {
    const date = new Date(isoDate || Date.now());
    return date.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  function setAlert(type, message) {
    sendAlert.className = `alert alert-${type}`;
    sendAlert.textContent = message;
    sendAlert.classList.remove("d-none");
  }

  function hideAlert() {
    sendAlert.classList.add("d-none");
    sendAlert.textContent = "";
  }

  function getSession() {
    const session = authStore && typeof authStore.getSession === "function"
      ? authStore.getSession()
      : null;
    if (session) return session;
    if (previewStore && typeof previewStore.getSession === "function") {
      const demoSession = previewStore.getSession();
      if (demoSession) return demoSession;
    }
    return window.EUREKA_DEMO_ENABLED ? window.EUREKA_DEMO_GUEST_SESSION : null;
  }

  function isAdminSession(session) {
    const email = normalizeEmail(session && session.email);
    const role = String(session && session.role ? session.role : "").trim().toLowerCase();
    return role === "admin" || (!!ADMIN_EMAIL && email === ADMIN_EMAIL);
  }

  function isCustomerSession(session) {
    return !!(session && session.email) && !isAdminSession(session);
  }

  function getHistoryKey(email) {
    return `${PROFORMA_HISTORY_PREFIX}${normalizeEmail(email)}`;
  }

  function getLastProformaKey(email) {
    return `${PROFORMA_LAST_KEY_PREFIX}${normalizeEmail(email)}`;
  }

  function calculateTaxBreakdown(totalAmount) {
    const gross = Number(totalAmount || 0);
    const taxable = gross / 1.18;
    const igv = gross - taxable;
    return {
      gross: Number(gross.toFixed(2)),
      taxable: Number(taxable.toFixed(2)),
      igv: Number(igv.toFixed(2))
    };
  }

  function sanitizeProformaRecord(record) {
    if (!record || typeof record !== "object") return null;
    const safeItems = Array.isArray(record.items)
      ? record.items.map((item) => ({
        name: sanitizeLabel(item.name),
        code: sanitizeLabel(item.code),
        qty: Math.max(1, Number(item.qty || 1)),
        price: Number(item.price || 0),
        originalPrice: Number(item.originalPrice || 0),
        discountPct: Math.max(0, Number(item.discountPct || 0)),
        isPromotion: Boolean(item.isPromotion) || Number(item.discountPct || 0) > 0 || Number(item.originalPrice || 0) > Number(item.price || 0)
      })).filter((item) => item.name && Number.isFinite(item.qty) && Number.isFinite(item.price))
      : [];
    if (!safeItems.length) return null;
    const totalItems = safeItems.reduce((acc, item) => acc + item.qty, 0);
    const totalAmount = safeItems.reduce((acc, item) => acc + (item.qty * item.price), 0);
    return {
      id: String(record.id || "").trim(),
      serial: sanitizeLabel(record.serial) || "PROFORMA",
      issuedAt: record.issuedAt || record.createdAt || new Date().toISOString(),
      customerName: sanitizeLabel(record.customerName),
      customerEmail: normalizeEmail(record.customerEmail),
      customerRuc: sanitizeLabel(record.customerRuc),
      customerDepartment: sanitizeLabel(record.customerDepartment),
      customerDistrict: sanitizeLabel(record.customerDistrict),
      customerAddress: sanitizeLabel(record.customerAddress),
      customerPhone: sanitizePhone(record.customerPhone),
      totalItems: Number(record.totalItems || totalItems),
      totalAmount: Number(record.totalAmount || totalAmount),
      items: safeItems,
      createdAt: record.createdAt || record.issuedAt || new Date().toISOString()
    };
  }

  function getHistory(session) {
    try {
      const raw = JSON.parse(localStorage.getItem(getHistoryKey(session.email)));
      if (!Array.isArray(raw)) return [];
      return raw.map(sanitizeProformaRecord).filter(Boolean);
    } catch (error) {
      return [];
    }
  }

  function getRequestedRecordId(session) {
    const fromUrl = new URLSearchParams(window.location.search || "").get("id");
    if (fromUrl) return String(fromUrl).trim();
    try {
      return String(localStorage.getItem(getLastProformaKey(session.email)) || "").trim();
    } catch (error) {
      return "";
    }
  }

  function buildProformaDocumentMarkup(record) {
    const breakdown = calculateTaxBreakdown(record.totalAmount);
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
      <article class="doc-wrap">
        <header class="doc-header">
          <div class="doc-brand">
            <img src="${escapeHtml(LOGO_PATH)}" alt="Logo proforma" class="doc-logo">
            <div class="doc-company">
              <h3 class="doc-company-name">${escapeHtml(COMPANY_INFO.name)}</h3>
              <p>RUC : ${escapeHtml(COMPANY_INFO.ruc)}</p>
              <p>${escapeHtml(COMPANY_INFO.address)}</p>
              <p>Tel : ${escapeHtml(COMPANY_INFO.phone)}</p>
              <p>Email : ${escapeHtml(COMPANY_INFO.email)}</p>
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

  function downloadRecord(record) {
    if (!record) {
      setAlert("warning", "Primero debes abrir una proforma valida.");
      return false;
    }
    const printUrl = new URL("proforma-enviar.html", window.location.href);
    printUrl.searchParams.set("id", record.id);
    printUrl.searchParams.set("print", "1");
    const printWindow = window.open(printUrl.href, "_blank", "noopener,noreferrer");
    if (!printWindow) {
      setAlert("warning", "Tu navegador bloqueo la descarga del PDF. Permite ventanas emergentes e intenta nuevamente.");
      return false;
    }
    hideAlert();
    return true;
  }

  function buildOrderMessage(record) {
    if (!record) return "";
    const items = record.items.map((item) => {
      const qty = Math.max(1, Math.floor(Number(item.qty) || 1));
      const subtotal = Number(item.price || 0) * qty;
      return `- ${qty} x ${item.name} (${item.code || "s/c"}) = ${formatMoney(subtotal)}`;
    }).join("\n");
    const parts = [
      "Hola, equipo EurekaClean. Estoy interesado/a en esta cotización:",
      `Referencia: ${record.serial}`,
      `Cliente: ${record.customerName || "Invitado"}`,
      `Teléfono: ${record.customerPhone || "No indicado"}`,
      `Correo: ${record.customerEmail || "No indicado"}`,
      record.customerRuc ? `RUC: ${record.customerRuc}` : "",
      record.customerAddress ? `Dirección: ${record.customerAddress}` : "",
      "",
      "Productos solicitados:",
      items,
      "",
      `MONTO TOTAL REFERENCIAL: ${formatMoney(record.totalAmount)}`,
      "",
      "¿Pueden confirmar la disponibilidad, el importe final y cómo puedo pagar?",
      "Esta proforma de prueba no es una boleta ni un comprobante de pago."
    ];
    return parts.filter((part) => part !== "").join("\n").slice(0, 9500);
  }

  function openWhatsappWeb() {
    if (!currentRecord) return;
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(buildOrderMessage(currentRecord))}`;
    const popup = window.open(url, "_blank", "noopener,noreferrer");
    if (popup) {
      setAlert("info", "Se abrió WhatsApp con el pedido y el monto. Presiona Enviar allí para entregarlo al comercio.");
      return;
    }
    setAlert("warning", "Tu navegador bloqueó WhatsApp. Abre el enlace y envía el mensaje manualmente.");
    window.location.href = url;
  }

  function openEmailDraft() {
    if (!currentRecord) return;
    const subject = `Consulta de proforma ${currentRecord.serial} - EurekaClean`;
    const body = buildOrderMessage(currentRecord);
    const url = `mailto:${ORDER_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setAlert("info", `Se abrirá tu correo con destino a ${ORDER_EMAIL}. Para que llegue, debes presionar Enviar.`);
    window.location.href = url;
  }

  async function checkAutomaticDelivery() {
    if (!sendAutoBtn || !sendAutoInfo) return;
    sendAutoBtn.disabled = true;
    try {
      const response = await fetch("/api/order-notify", { method: "GET", cache: "no-store" });
      if (!response.ok) throw new Error("Sin servicio configurado");
      const data = await response.json();
      if (data.ready === true) {
        sendAutoBtn.disabled = false;
        sendAutoInfo.textContent = "Notificación automática disponible. Al confirmar se intentará enviar al correo y WhatsApp del comercio.";
      } else {
        sendAutoInfo.textContent = "Envío automático pendiente de configurar (correo y WhatsApp Business API). Usa las opciones manuales.";
      }
    } catch (error) {
      sendAutoInfo.textContent = "Servicio automático no disponible. Puedes enviar tu pedido desde WhatsApp o tu aplicación de correo.";
    }
  }

  async function requestAutomaticDelivery() {
    if (!currentRecord || !sendAutoBtn || sendAutoBtn.disabled) return;
    sendAutoBtn.disabled = true;
    sendAutoBtn.textContent = "Procesando solicitud...";
    try {
      const response = await fetch("/api/order-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serial: currentRecord.serial,
          customer: {
            name: currentRecord.customerName,
            email: currentRecord.customerEmail,
            phone: currentRecord.customerPhone,
            ruc: currentRecord.customerRuc,
            address: currentRecord.customerAddress
          },
          items: currentRecord.items.map((item) => ({
            code: item.code,
            qty: item.qty
          }))
        })
      });
      const result = await response.json();
      const emailSent = result.email === "sent";
      const whatsappSent = result.whatsapp === "sent";
      if (emailSent && whatsappSent) {
        setAlert("success", `Pedido ${result.reference || currentRecord.serial} notificado al correo y WhatsApp del comercio. Importe validado: ${formatMoney(result.total)}.`);
        sendAutoBtn.textContent = "Notificación enviada";
      } else {
        setAlert("warning", `Resultado: correo ${emailSent ? "enviado" : "no enviado"}; WhatsApp ${whatsappSent ? "enviado" : "no enviado"}. No se confirmará ningún canal sin respuesta del proveedor. Puedes utilizar los botones manuales.`);
        sendAutoBtn.textContent = "Reintentar notificación";
        sendAutoBtn.disabled = !(result && result.ready);
      }
    } catch (error) {
      setAlert("danger", "No se pudo contactar el servicio de notificaciones. No se ha confirmado ninguna entrega; utiliza los botones manuales.");
      sendAutoBtn.textContent = "Reintentar notificación";
      sendAutoBtn.disabled = false;
    }
  }

  function init() {
    const session = getSession();
    if (!isCustomerSession(session)) {
      setAlert("warning", "Debes iniciar sesion como cliente para ver esta proforma.");
      releasePreload();
      return;
    }

    const requestedId = getRequestedRecordId(session);
    const history = getHistory(session);
    currentRecord = history.find((record) => record.id === requestedId) || history[0] || null;
    if (!currentRecord) {
      setAlert("warning", "No se encontro la proforma generada. Vuelve al creador e intenta nuevamente.");
      releasePreload();
      return;
    }

    sendPreview.innerHTML = buildProformaDocumentMarkup(currentRecord);
    document.title = `${currentRecord.serial} - Proforma`;
    if (isPrintMode) {
      document.body.classList.add("proforma-print-mode");
      window.setTimeout(() => {
        try {
          window.focus();
          window.print();
        } catch (error) {
          setAlert("warning", "No se pudo abrir el dialogo de impresion. Usa Ctrl+P e intenta guardar como PDF.");
        }
      }, 350);
    }
    sendPanel.classList.remove("d-none");
    hideAlert();
    releasePreload();
    if (!isPrintMode) checkAutomaticDelivery();
  }

  if (sendDownloadBtn) {
    sendDownloadBtn.addEventListener("click", () => downloadRecord(currentRecord));
  }
  if (sendWhatsappBtn) {
    sendWhatsappBtn.addEventListener("click", openWhatsappWeb);
  }
  if (sendEmailBtn) sendEmailBtn.addEventListener("click", openEmailDraft);
  if (sendAutoBtn) sendAutoBtn.addEventListener("click", requestAutomaticDelivery);

  init();
})();
