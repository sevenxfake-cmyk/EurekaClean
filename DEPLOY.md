# Despliegue a servidor

Este proyecto ya puede servir el frontend y la API desde el mismo proceso Python. Para un despliegue simple, el backend entrega los `.html`, `css`, `js`, `img` y tambien responde `/api/*`.

## 1. Preparar el servidor

Requisitos minimos:

- Python 3.10 o superior
- Acceso al puerto HTTP interno que vayas a usar, por ejemplo `8000`
- Opcional: `nginx` para exponer el sitio por `80/443`

Copia el proyecto al servidor y ubicate en la raiz del repositorio.

## 2. Configuracion base

Usa `.env.server.example` como referencia.

Variables importantes:

- `APP_HOST=0.0.0.0` para aceptar conexiones externas
- `APP_PORT=8000` o el puerto interno que te asigne tu hosting
- `APP_CORS_ORIGINS` solo si el frontend y la API van en dominios distintos
- `APP_TRUST_PROXY=1` si nginx u otro proxy confiable es el unico acceso al backend
- `APP_GOOGLE_CLIENT_ID` para activar el acceso rapido con Google Identity Services
- `APP_SEED_USERS=1` solo en el primer arranque si quieres crear usuarios iniciales

## 3. Configurar el frontend para produccion

El archivo `js/runtime-config.js` centraliza la configuracion publica del frontend.

Casos comunes:

1. Si frontend y backend viven en el mismo dominio, deja `window.EUREKA_RUNTIME_CONFIG = {}` y no necesitas mas cambios.
2. Si la API va en otro dominio o subdominio, edita `js/runtime-config.js` y define `apiBase`, por ejemplo:

```js
window.EUREKA_RUNTIME_CONFIG = {
  apiBase: "https://api.tu-dominio.com",
  adminEmail: "admin@tu-dominio.com"
};
```

### Acceso rapido con Google

1. Crea un cliente OAuth 2.0 de tipo `Aplicacion web` en Google Cloud.
2. Agrega el dominio del sitio en `Origenes autorizados de JavaScript`, por ejemplo `https://tu-dominio.com`.
3. Define el Client ID publico en el entorno del backend:

```bash
export APP_GOOGLE_CLIENT_ID="tu-client-id.apps.googleusercontent.com"
```

Si `APP_GOOGLE_CLIENT_ID` queda vacio, el boton de Google muestra un aviso de configuracion y el acceso por correo sigue funcionando.

## 4. Arranque directo

En Linux:

```bash
chmod +x run_backend.sh
export APP_HOST=0.0.0.0
export APP_PORT=8000
./run_backend.sh
```

En Windows Server:

```powershell
$env:APP_HOST="0.0.0.0"
$env:APP_PORT="8000"
.\run_backend.ps1
```

## 5. Despliegue recomendado con systemd + nginx

Plantillas incluidas:

- `proyectodante.service`
- `proyectodante.conf.sample`

Pasos sugeridos en Ubuntu:

1. Ajusta las rutas dentro del archivo `systemd`.
2. Copia el servicio a `/etc/systemd/system/proyectodante.service`.
3. Ejecuta `sudo systemctl daemon-reload`.
4. Ejecuta `sudo systemctl enable --now proyectodante`.
5. Ajusta el archivo de `nginx` con tu dominio.
6. Copialo a `/etc/nginx/sites-available/proyectodante`.
7. Crea el enlace simbolico en `sites-enabled`.
8. Verifica con `sudo nginx -t` y reinicia `nginx`.

## 6. Verificacion

Prueba estas rutas despues del arranque:

- `http://TU_HOST:8000/api/health`
- `http://TU_HOST:8000/login.html`

Si usas `nginx`:

- `https://tu-dominio.com/api/health`
- `https://tu-dominio.com/login.html`

## 7. Notas operativas

- La base SQLite vive en `app.db`.
- Los uploads de productos se guardan en `img/Productos`.
- Si el servidor ya tiene un proxy que inyecta `PORT`, el backend ahora tambien lo acepta.
- No actives `APP_SEED_USERS=1` de forma permanente en produccion.

## 8. Hostinger

Antes de subir a Hostinger, sube solo el proyecto limpio:

- `*.html`
- `css/`
- `js/`
- `img/`
- `server.py`, `db.py`, `data_seed.py` y `app.db` solo si tu plan ejecutara la app Python
- `run_backend.sh`, `.env.server.example`, `proyectodante.service` y `proyectodante.conf.sample` solo si vas a administrar el backend en VPS

No subas carpetas o archivos temporales como `entregables/`, `.tools/`, `__pycache__/`, `*.log`, backups `.zip` antiguos ni notas locales.

Si Hostinger solo servira archivos estaticos, el catalogo visible cargara desde el frontend, pero login, editor, proformas guardadas y APIs necesitan el backend Python activo. Para tener todo funcionando en produccion, publica el backend en el mismo dominio o en un subdominio y configura `js/runtime-config.js` con `apiBase` si la API queda separada.
