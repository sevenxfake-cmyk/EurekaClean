"use strict";

// Ecommerce demo: no cobra ni emite boletas fiscales.
// Integraciones reales opcionales, nunca insertar API keys en este archivo.
// En Vercel configurar ORDER_NOTIFICATIONS_ENABLED=true y las credenciales.
const crypto = require("node:crypto");
const catalog = require("../catalogo_exportado.json");

const TARGET_EMAIL = "eurekaverdeweb@gmail.com";
const TARGET_WHATSAPP = "51981292376";
const products = new Map(
  Object.values(catalog).flatMap((group) =>
    (group.items || []).map((p) => [String(p.code || "").trim().toUpperCase(), p])
  )
);
const rateLimit = new Map();

function sendJson(res, status, object) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  return res.status(status).json(object);
}

function hasEmailCredentials() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}
function hasWhatsAppCredentials() {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN &&
    process.env.WHATSAPP_PHONE_NUMBER_ID &&
    process.env.WHATSAPP_TEMPLATE_NAME
  );
}
function enabled() {
  return process.env.ORDER_NOTIFICATIONS_ENABLED === "true";
}
function ready() {
  return enabled() && hasEmailCredentials() && hasWhatsAppCredentials();
}
function safeText(text, max = 180) {
  return String(text || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}
function money(n) {
  return "S/ " + Number(n || 0).toFixed(2);
}
function originAllowed(origin) {
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") return false;
    return url.hostname === "eurekaclean.vercel.app" ||
      url.hostname === "eurekaclean-sevenxfake.vercel.app" ||
      url.hostname === "eurekaclean-git-main-sevenxfake.vercel.app" ||
      /^eurekaclean-[a-z0-9-]+-sevenxfake\.vercel\.app$/.test(url.hostname) ||
      url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch (e) {
    return false;
  }
}
function canSend(ip) {
  const now = Date.now(), windowMs = 30 * 60 * 1000;
  const list = (rateLimit.get(ip) || []).filter((at) => now - at < windowMs);
  if (list.length >= 5) return false;
  list.push(now);
  rateLimit.set(ip, list);
  return true;
}
function validateAndQuote(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Pedido inválido.");
  const customer = payload.customer && typeof payload.customer === "object" ? payload.customer : {};
  const name = safeText(customer.name, 120);
  const email = safeText(customer.email, 180).toLowerCase();
  const phone = safeText(customer.phone, 20).replace(/[\s()-]/g, "");
  if (name.length < 2) throw new Error("Debes indicar un nombre válido.");
  if (!/^\+?\d{7,15}$/.test(phone)) throw new Error("Debes indicar un teléfono válido.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Correo inválido.");
  const requested = payload.items;
  if (!Array.isArray(requested) || requested.length === 0 || requested.length > 40) throw new Error("El pedido debe contener de 1 a 40 productos.");
  const seen = new Set();
  const rows = requested.map((entry) => {
    const code = safeText(entry && entry.code, 40).toUpperCase();
    const qty = Number(entry && entry.qty);
    const product = products.get(code);
    if (!product || product.active === false || seen.has(code)) throw new Error("Producto duplicado o no disponible: " + code);
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) throw new Error("Cantidad inválida: " + code);
    seen.add(code);
    const base = Number(product.price);
    const discount = Math.max(0, Math.min(90, Number(product.discountPct || 0)));
    if (!Number.isFinite(base) || base < 0) throw new Error("Precio inválido del catálogo: " + code);
    const unit = Math.round((Math.round(base * 100) * (100 - discount)) / 100) / 100;
    return { code, name: safeText(product.name, 120), qty, unit, subtotal: Number((unit * qty).toFixed(2)) };
  });
  const total = Number(rows.reduce((n, row) => n + row.subtotal, 0).toFixed(2));
  if (total <= 0 || total > 200000) throw new Error("Importe fuera de rango.");
  const reference = safeText(payload.serial, 40).replace(/[^A-Za-z0-9_-]/g, "") || ("DEMO-" + Date.now());
  return {
    reference,
    name, email, phone,
    ruc: safeText(customer.ruc, 20),
    address: safeText(customer.address, 250),
    rows, total
  };
}
function messageText(order) {
  const lines = [
    "Nueva consulta de proforma de prueba - EUREKACLEAN",
    "No es boleta ni comprobante de pago.",
    "Referencia: " + order.reference,
    "Cliente: " + order.name,
    "Teléfono: " + order.phone,
    "Correo: " + (order.email || "No indicado"),
    "RUC: " + (order.ruc || "No indicado"),
    "Dirección: " + (order.address || "Por coordinar"),
    "",
    "Productos:",
    ...order.rows.map((r) => r.qty + " x " + r.name + " (" + r.code + ") - " + money(r.subtotal)),
    "",
    "MONTO TOTAL REFERENCIAL: " + money(order.total),
    "Cliente solicita confirmar disponibilidad y cómo pagar."
  ];
  return lines.join("\n");
}
async function requestProvider(url, headers, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: controller.signal });
    return response.ok;
  } finally {
    clearTimeout(timeout);
  }
}
async function sendEmail(order) {
  const text = messageText(order);
  const html = '<div style="font-family:Arial,sans-serif;max-width:750px;margin:auto">' +
    '<h2>Proforma de prueba: ' + escapeHtml(order.reference) + '</h2>' +
    '<p><strong>No es una boleta, factura ni comprobante de pago.</strong></p>' +
    '<p>Cliente: ' + escapeHtml(order.name) + '<br>Teléfono: ' + escapeHtml(order.phone) +
    '<br>Correo: ' + escapeHtml(order.email || "-") + '<br>RUC: ' + escapeHtml(order.ruc || "-") +
    '<br>Dirección: ' + escapeHtml(order.address || "-") + '</p>' +
    '<table style="border-collapse:collapse;width:100%"><thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Importe</th></tr></thead><tbody>' +
    order.rows.map((r) => '<tr><td>' + escapeHtml(r.code + " " + r.name) + '</td><td>' + r.qty + '</td><td>' + money(r.unit) + '</td><td>' + money(r.subtotal) + '</td></tr>').join("") +
    '</tbody></table><h3>Total referencial: ' + money(order.total) + '</h3>' +
    '<p>Cliente solicita confirmar disponibilidad y forma de pago.</p></div>';
  const key = crypto.createHash("sha256").update(order.reference + "|" + order.phone + "|" + text).digest("hex").slice(0,60);
  return requestProvider(
    "https://api.resend.com/emails",
    { Authorization: "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json", "Idempotency-Key": "eureka-" + key },
    {
      from: process.env.RESEND_FROM_EMAIL,
      to: [TARGET_EMAIL],
      reply_to: order.email || undefined,
      subject: "[EurekaClean DEMO] Pedido " + order.reference + " - " + money(order.total),
      text, html
    }
  );
}
async function sendWhatsApp(order) {
  const version = /^v\d+\.\d+$/.test(process.env.WHATSAPP_GRAPH_VERSION || "") ? process.env.WHATSAPP_GRAPH_VERSION : "v23.0";
  const url = "https://graph.facebook.com/" + version + "/" + encodeURIComponent(process.env.WHATSAPP_PHONE_NUMBER_ID) + "/messages";
  const itemsText = order.rows.map(r => r.qty + "x " + r.name).join(", ").slice(0, 500);
  const bodyParams = [order.reference, order.name, itemsText, money(order.total)]
    .map((text) => ({ type: "text", text: String(text) }));
  return requestProvider(url,
    { Authorization: "Bearer " + process.env.WHATSAPP_ACCESS_TOKEN, "Content-Type": "application/json" },
    {
      messaging_product: "whatsapp",
      to: TARGET_WHATSAPP,
      type: "template",
      template: {
        name: process.env.WHATSAPP_TEMPLATE_NAME,
        language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "es_PE" },
        components: [{ type: "body", parameters: bodyParams }]
      }
    }
  );
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    return sendJson(res, 200, { ready: ready(), emailConfigured: enabled() && hasEmailCredentials(), whatsappConfigured: enabled() && hasWhatsAppCredentials() });
  }
  if (req.method !== "POST") return sendJson(res, 405, { error: "Método no admitido." });
  if (!ready()) return sendJson(res, 503, { ready: false, email: "not_configured", whatsapp: "not_configured" });
  if (!originAllowed(req.headers.origin || "")) return sendJson(res, 403, { error: "Origen no autorizado." });
  const ip = safeText((req.headers["x-forwarded-for"] || "").split(",")[0], 60) || "unknown";
  if (!canSend(ip)) return sendJson(res, 429, { error: "Demasiados pedidos de prueba. Intenta más tarde." });
  let order;
  try {
    order = validateAndQuote(req.body);
  } catch (e) {
    return sendJson(res, 400, { error: safeText(e.message, 220) });
  }
  let email = "failed", whatsapp = "failed";
  const [a, b] = await Promise.allSettled([sendEmail(order), sendWhatsApp(order)]);
  if (a.status === "fulfilled" && a.value === true) email = "sent";
  if (b.status === "fulfilled" && b.value === true) whatsapp = "sent";
  return sendJson(res, email === "sent" && whatsapp === "sent" ? 200 : 207, {
    ready: true, reference: order.reference, total: order.total, email, whatsapp,
    note: "La respuesta de la API indica aceptación por el proveedor, no garantiza entrega final."
  });
};
