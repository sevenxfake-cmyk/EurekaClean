(() => {
  // Ejemplo:
  // window.EUREKA_RUNTIME_CONFIG = {
  //   apiBase: "https://api.tu-dominio.com",
  //   adminEmail: "admin@tu-dominio.com"
  // };
  const runtime = window.EUREKA_RUNTIME_CONFIG || {};

  if (typeof runtime.apiBase === "string") {
    window.EUREKA_API_BASE = runtime.apiBase;
  } else if (typeof window.EUREKA_API_BASE !== "string") {
    window.EUREKA_API_BASE = "";
  }

  if (typeof runtime.adminEmail === "string") {
    window.EUREKA_ADMIN_EMAIL = runtime.adminEmail;
  } else if (typeof window.EUREKA_ADMIN_EMAIL !== "string") {
    window.EUREKA_ADMIN_EMAIL = "";
  }
})();
