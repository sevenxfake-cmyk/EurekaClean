# Backend + DB (SQLite)

Este proyecto ahora incluye backend funcional con:

- API REST para autenticacion y catalogo.
- Base de datos SQLite en `app.db`.
- Servidor estatico para tus archivos HTML/CSS/JS del proyecto.

## Ejecutar

Desde PowerShell en la raiz del proyecto:

```powershell
.\run_backend.ps1
```

Si PowerShell bloquea scripts por politica de ejecucion:

```powershell
powershell -ExecutionPolicy Bypass -File .\run_backend.ps1
```

Opcional (abre login al iniciar):

```powershell
.\run_backend.ps1 -OpenBrowser
```

Si configuraste usuarios seed por variables de entorno y quieres re-sincronizarlos:

```powershell
.\run_backend.ps1 -ResetDemoCredentials
```

Tambien puedes usar:

```powershell
python server.py
```

Servidor por defecto:

- `http://127.0.0.1:8000`

Variables opcionales:

- `APP_HOST` (default `127.0.0.1`)
- `APP_PORT` (default `8000`)
- `APP_CORS_ORIGINS` lista separada por comas de origins permitidos. Si no se define, el backend solo acepta los orígenes locales comunes (`127.0.0.1`, `localhost` y `null` para `file://`).
- `APP_TRUST_PROXY` (default `0`) usa `1` solo cuando nginx u otro proxy confiable sea el único acceso al backend.
- `APP_GOOGLE_CLIENT_ID` activa el botón opcional `Continuar con Google` en la página de inicio de sesión.
- `APP_SEED_USERS` (default `0`) usa `1` solo si quieres sembrar usuarios de forma explícita en una DB nueva
- `APP_SEED_ADMIN_NAME`, `APP_SEED_ADMIN_EMAIL`, `APP_SEED_ADMIN_PASSWORD` sin defaults inseguros
- `APP_SEED_DEMO_NAME`, `APP_SEED_DEMO_EMAIL`, `APP_SEED_DEMO_PASSWORD` sin defaults inseguros

Para activar Google, crea un cliente OAuth 2.0 web, autoriza el dominio del sitio y define su Client ID en `APP_GOOGLE_CLIENT_ID`. Si no se configura, el botón muestra un aviso de configuración.

## Usuarios seed opcionales

- El proyecto ya no crea credenciales débiles por defecto.
- Si necesitas usuarios iniciales, define `APP_SEED_USERS=1` junto con los `APP_SEED_*_EMAIL` y `APP_SEED_*_PASSWORD` antes de iniciar el backend.

Si ya definiste esos valores y quieres re-aplicarlos sobre tu `app.db` actual, ejecuta `.\run_backend.ps1 -ResetDemoCredentials`.

## Endpoints principales

### Salud

- `GET /api/health`

### Auth

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me` (Bearer token)

### Catalogo

- `GET /api/catalog`
- `GET /api/catalog/categories`
- `GET /api/catalog/products`
- `GET /api/catalog/products/{code}`
- `POST /api/catalog/products` (admin)
- `PATCH /api/catalog/products/{code}` (admin)
- `DELETE /api/catalog/products/{code}` (admin)
- `POST /api/catalog/import` (admin)

### SUNAT RUC

- `GET /api/sunat/ruc?numero=20123456789`
- Valida solo RUC de 11 digitos que empiecen en `10` o `20`.
- Consulta directa al sitio oficial `e-consultaruc.sunat.gob.pe`.
- Respuesta: `name` (nombre/razon social) y `details` (estado, condicion, domicilio, nombre comercial cuando SUNAT los devuelve).

### Proformas (cliente)

- `GET /api/proformas` (auth)
- `POST /api/proformas` (auth, solo cliente)

## Nota importante

El frontend ya esta conectado al backend para:

- Inicio de sesion y registro (`/api/auth/*`).
- Lectura/escritura del catalogo desde el editor (`/api/catalog/*`).

Para que funcione correctamente, abre el sitio desde este servidor (`.\run_backend.ps1` o `python server.py`).  
Si abres los `.html` directo desde el explorador de archivos, no habra conexion API.

## Despliegue

- El backend ahora acepta `HOST` y `PORT` ademas de `APP_HOST` y `APP_PORT`.
- Para publicar en servidor, revisa `DEPLOY.md`.
- La configuracion publica del frontend se centraliza en `js/runtime-config.js`.
