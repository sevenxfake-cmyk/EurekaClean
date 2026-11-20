import json
import os
import re
import html
import datetime as dt
import ipaddress
import base64
import binascii
import secrets
import socket
import urllib.parse
import urllib.request
import urllib.error
import http.cookiejar
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path, PurePosixPath

from db import (
    BASE_DIR,
    count_users,
    create_proforma_for_user,
    create_session,
    create_user,
    delete_proforma_for_user,
    delete_product,
    get_catalog_map,
    get_product_by_code,
    get_user_by_email,
    get_user_by_token,
    init_db,
    list_proformas_by_user,
    list_categories,
    list_products,
    product_exists,
    upsert_product,
    update_product_code,
    verify_password,
)


PROJECT_ROOT = Path(__file__).resolve().parent


def _normalize_origin(value):
    return str(value or "").strip().rstrip("/")


def _is_loopback_hostname(hostname):
    host = str(hostname or "").strip().lower()
    return host in {"localhost", "127.0.0.1", "::1"}


def _is_private_hostname(hostname):
    host = str(hostname or "").strip().lower().strip("[]")
    if not host:
        return False
    if _is_loopback_hostname(host):
        return True
    try:
        ip_obj = ipaddress.ip_address(host)
    except ValueError:
        return False
    return bool(ip_obj.is_private or ip_obj.is_loopback)


def _is_allowed_local_origin(origin):
    normalized = _normalize_origin(origin)
    if not normalized or normalized == "null":
        return normalized == "null"
    parsed = urllib.parse.urlparse(normalized)
    if parsed.scheme not in {"http", "https"}:
        return False
    return _is_private_hostname(parsed.hostname)


def _parse_cors_origins():
    raw = str(os.environ.get("APP_CORS_ORIGINS") or "").strip()
    if not raw:
        return {
            "null",
            "http://127.0.0.1:8000",
            "http://localhost:8000",
        }

    parts = [_normalize_origin(item) for item in raw.split(",")]
    return {item for item in parts if item}


CORS_ORIGINS = _parse_cors_origins()
TRUST_PROXY_HEADERS = str(os.environ.get("APP_TRUST_PROXY") or "").strip().lower() in {"1", "true", "yes", "on"}
GOOGLE_CLIENT_ID = str(os.environ.get("APP_GOOGLE_CLIENT_ID") or "").strip()[:300]
CODE_REGEX = re.compile(r"^[A-Z0-9][A-Z0-9-]{2,39}$")
IMAGE_REGEX = re.compile(r"^(https?://|data:image/|img/|/img/|./img/|../img/)", re.IGNORECASE)
DATA_URL_IMAGE_REGEX = re.compile(r"^data:(image/(?:jpeg|jpg|png|webp|gif));base64,([A-Za-z0-9+/=\s]+)$", re.IGNORECASE)
RUC_REGEX = re.compile(r"^(10|20)\d{9}$")
PROFORMA_ID_REGEX = re.compile(r"^[A-Za-z0-9_-]{6,80}$")
PROFORMA_SERIAL_REGEX = re.compile(r"^[A-Za-z0-9-]{4,40}$")
LIMA_DISTRICTS = {
    "Ancon",
    "Ate",
    "Barranco",
    "Brena",
    "Carabayllo",
    "Chaclacayo",
    "Chorrillos",
    "Cieneguilla",
    "Comas",
    "El Agustino",
    "Independencia",
    "Jesus Maria",
    "La Molina",
    "La Victoria",
    "Lima",
    "Lince",
    "Los Olivos",
    "Lurigancho",
    "Lurin",
    "Magdalena del Mar",
    "Miraflores",
    "Pachacamac",
    "Pucusana",
    "Pueblo Libre",
    "Puente Piedra",
    "Punta Hermosa",
    "Punta Negra",
    "Rimac",
    "San Bartolo",
    "San Borja",
    "San Isidro",
    "San Juan de Lurigancho",
    "San Juan de Miraflores",
    "San Luis",
    "San Martin de Porres",
    "San Miguel",
    "Santa Anita",
    "Santa Maria del Mar",
    "Santa Rosa",
    "Santiago de Surco",
    "Surquillo",
    "Villa El Salvador",
    "Villa Maria del Triunfo",
}
SUNAT_FRAME_URL = "https://e-consultaruc.sunat.gob.pe/cl-ti-itmrconsruc/FrameCriterioBusquedaWeb.jsp"
SUNAT_QUERY_URL = "https://e-consultaruc.sunat.gob.pe/cl-ti-itmrconsruc/jcrS00Alias"
IMAGE_UPLOAD_DIR = PROJECT_ROOT / "img" / "Productos"
MAX_IMAGE_BYTES = 5 * 1024 * 1024
IMAGE_MIME_EXT = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
}
IMAGE_KIND_MIME = {
    "jpeg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "webp": "image/webp",
}
REDIRECT_STATUS_CODES = {301, 302, 303, 307, 308}
CONTROL_CHAR_REGEX = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]")
MARKUP_TOKEN_REGEX = re.compile(r"[<>]")
AUTH_WINDOW_SECONDS = 15 * 60
AUTH_MAX_LOGIN_ATTEMPTS_PER_IP = 12
AUTH_MAX_LOGIN_ATTEMPTS_PER_EMAIL = 8
AUTH_MAX_REGISTER_ATTEMPTS_PER_IP = 10
AUTH_MAX_REGISTER_ATTEMPTS_PER_EMAIL = 6
MAX_JSON_BODY_BYTES = 8_500_000
REGISTER_PASSWORD_MIN_LENGTH = 10
AUTH_RATE_LIMIT_LOCK = threading.Lock()
AUTH_RATE_LIMIT_BUCKETS = {
    "login_ip": {},
    "login_email": {},
    "register_ip": {},
    "register_email": {},
}
STATIC_ALLOWED_ROOT_FILES = {
    "index.html",
    "login.html",
    "tienda.html",
    "categoria.html",
    "catalogo.html",
    "acerca.html",
    "contacto.html",
    "proforma.html",
    "proforma-enviar.html",
    "editor.html",
}
STATIC_ALLOWED_DIR_EXTENSIONS = {
    "css": {".css"},
    "js": {".js"},
    "img": {".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".svg", ".ico"},
}


def sanitize_text(value, max_len):
    clean = CONTROL_CHAR_REGEX.sub("", str(value or ""))
    return clean.strip()[:max_len]


def has_markup_tokens(value):
    return bool(MARKUP_TOKEN_REGEX.search(str(value or "")))


def _prune_rate_limit_bucket(bucket, now_ts):
    threshold = float(now_ts) - AUTH_WINDOW_SECONDS
    expired_keys = []
    for key, item in bucket.items():
        attempts = [stamp for stamp in item.get("attempts", []) if float(stamp) >= threshold]
        if attempts:
            item["attempts"] = attempts
            bucket[key] = item
        else:
            expired_keys.append(key)
    for key in expired_keys:
        bucket.pop(key, None)


def _is_rate_limited(bucket_name, key, limit):
    normalized_key = sanitize_text(key, 200).lower()
    if not normalized_key:
        return False

    now_ts = dt.datetime.now(dt.timezone.utc).timestamp()
    with AUTH_RATE_LIMIT_LOCK:
        bucket = AUTH_RATE_LIMIT_BUCKETS[bucket_name]
        _prune_rate_limit_bucket(bucket, now_ts)
        attempts = bucket.get(normalized_key, {}).get("attempts", [])
        return len(attempts) >= int(limit)


def _record_rate_limit_failure(bucket_name, key):
    normalized_key = sanitize_text(key, 200).lower()
    if not normalized_key:
        return

    now_ts = dt.datetime.now(dt.timezone.utc).timestamp()
    with AUTH_RATE_LIMIT_LOCK:
        bucket = AUTH_RATE_LIMIT_BUCKETS[bucket_name]
        _prune_rate_limit_bucket(bucket, now_ts)
        entry = bucket.get(normalized_key, {"attempts": []})
        entry["attempts"] = list(entry.get("attempts", []))
        entry["attempts"].append(now_ts)
        bucket[normalized_key] = entry


def _clear_rate_limit_key(bucket_name, key):
    normalized_key = sanitize_text(key, 200).lower()
    if not normalized_key:
        return
    with AUTH_RATE_LIMIT_LOCK:
        AUTH_RATE_LIMIT_BUCKETS[bucket_name].pop(normalized_key, None)


def validate_new_password(value):
    password = str(value or "")
    if len(password) < REGISTER_PASSWORD_MIN_LENGTH:
        return False, f"La contrasena debe tener al menos {REGISTER_PASSWORD_MIN_LENGTH} caracteres."
    if len(password) > 200:
        return False, "La contrasena es demasiado larga."

    groups = 0
    groups += 1 if re.search(r"[a-z]", password) else 0
    groups += 1 if re.search(r"[A-Z]", password) else 0
    groups += 1 if re.search(r"\d", password) else 0
    groups += 1 if re.search(r"[^\w\s]", password) else 0
    if groups < 3:
        return False, "La contrasena debe incluir al menos tres de estos grupos: minusculas, mayusculas, numeros y simbolos."
    return True, ""


def verify_google_id_token(credential):
    token = str(credential or "").strip()
    if not GOOGLE_CLIENT_ID:
        return {"ok": False, "error": "Inicio con Google no configurado."}
    if not token or len(token) > 5000:
        return {"ok": False, "error": "Credencial de Google invalida."}

    url = "https://oauth2.googleapis.com/tokeninfo?id_token=" + urllib.parse.quote(token, safe="")
    request = urllib.request.Request(url, headers={"Accept": "application/json"}, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception:
        return {"ok": False, "error": "No se pudo verificar la cuenta de Google."}

    audience = str(payload.get("aud") or "").strip()
    issuer = str(payload.get("iss") or "").strip()
    email = sanitize_text(payload.get("email"), 120).lower()
    name = sanitize_text(payload.get("name"), 120)
    email_verified = str(payload.get("email_verified") or "").strip().lower() == "true"
    if audience != GOOGLE_CLIENT_ID or issuer not in {"accounts.google.com", "https://accounts.google.com"}:
        return {"ok": False, "error": "La credencial de Google no pertenece a esta aplicacion."}
    if not email or not email_verified or "@" not in email:
        return {"ok": False, "error": "Google no devolvio un correo verificado."}
    if has_markup_tokens(name):
        name = ""
    return {"ok": True, "email": email, "name": name or email.split("@", 1)[0]}


def _normalize_static_parts(raw_path):
    raw = urllib.parse.unquote(str(raw_path or "")).replace("\\", "/")
    if "\x00" in raw:
        return None

    parts = []
    for part in PurePosixPath(raw).parts:
        if part in {"", "/", "."}:
            continue
        if part == "..":
            return None
        parts.append(str(part))
    return parts


def is_allowed_static_request_path(raw_path):
    parts = _normalize_static_parts(raw_path)
    if parts is None:
        return False
    if not parts:
        return True
    if any(part.startswith(".") for part in parts):
        return False

    if len(parts) == 1:
        return parts[0] in STATIC_ALLOWED_ROOT_FILES

    top = parts[0]
    suffix = PurePosixPath(parts[-1]).suffix.lower()
    allowed_ext = STATIC_ALLOWED_DIR_EXTENSIONS.get(top)
    if not allowed_ext:
        return False
    return suffix in allowed_ext


def sanitize_code(value):
    code = sanitize_text(value, 40).upper()
    if not CODE_REGEX.match(code):
        return ""
    return code


def sanitize_image(value):
    image = str(value or "").strip()
    if image:
        image = image.replace("\\", "/")
        lower = image.lower()
        if re.match(r"^[a-z]:/", image, re.IGNORECASE):
            img_index = lower.find("/img/")
            if img_index >= 0:
                image = image[img_index + 1 :]
        elif lower.startswith("/img/"):
            image = image[1:]
    if not image:
        return ""
    if len(image) > 600:
        return None
    if not IMAGE_REGEX.match(image):
        return None
    return image


def to_price(value):
    try:
        amount = float(value)
    except (TypeError, ValueError):
        return None
    if amount < 0:
        return None
    return round(amount, 2)


def clamp_discount(value):
    try:
        amount = float(value)
    except (TypeError, ValueError):
        return 0.0
    return max(0.0, min(90.0, round(amount, 2)))


def to_flag(value, default=False):
    if value is None:
        return bool(default)
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"1", "true", "yes", "on"}:
            return True
        if normalized in {"0", "false", "no", "off"}:
            return False
    try:
        return bool(int(value))
    except (TypeError, ValueError):
        return bool(value)


def _safe_filename_stem(name):
    stem = Path(str(name or "")).stem
    clean = re.sub(r"[^A-Za-z0-9_-]+", "-", stem).strip("-_")
    if not clean:
        clean = "producto"
    return clean[:60]


def save_data_url_image(filename, data_url):
    raw_data = str(data_url or "").strip()
    if not raw_data:
        return {"ok": False, "error": "Imagen vacia."}
    if len(raw_data) > 8_000_000:
        return {"ok": False, "error": "Imagen demasiado grande para procesar."}

    match = DATA_URL_IMAGE_REGEX.match(raw_data)
    if not match:
        return {"ok": False, "error": "Formato de imagen invalido. Usa JPG, PNG, WEBP o GIF."}

    mime = str(match.group(1) or "").lower()
    b64_payload = re.sub(r"\s+", "", str(match.group(2) or ""))
    ext = IMAGE_MIME_EXT.get(mime)
    if not ext:
        return {"ok": False, "error": "Tipo de imagen no permitido."}

    try:
        blob = base64.b64decode(b64_payload, validate=True)
    except (binascii.Error, ValueError):
        return {"ok": False, "error": "No se pudo decodificar la imagen."}

    if not blob:
        return {"ok": False, "error": "La imagen no contiene datos."}
    if len(blob) > MAX_IMAGE_BYTES:
        return {"ok": False, "error": "La imagen excede el maximo permitido de 5 MB."}

    detected_mime = _detect_image_mime(mime, blob)
    if not detected_mime:
        return {"ok": False, "error": "El contenido del archivo no corresponde a una imagen permitida."}
    ext = IMAGE_MIME_EXT.get(detected_mime)
    if not ext:
        return {"ok": False, "error": "Tipo de imagen no permitido."}

    IMAGE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    stem = _safe_filename_stem(filename)
    timestamp = dt.datetime.now().strftime("%Y%m%d%H%M%S")
    unique = secrets.token_hex(3)
    file_name = f"{stem}-{timestamp}-{unique}.{ext}"
    target = IMAGE_UPLOAD_DIR / file_name
    target.write_bytes(blob)

    relative = target.relative_to(PROJECT_ROOT).as_posix()
    return {"ok": True, "path": relative}


def _detect_image_mime(content_type, blob):
    mime = str(content_type or "").split(";")[0].strip().lower()
    if mime in IMAGE_MIME_EXT:
        return mime

    blob = bytes(blob or b"")
    if blob.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if blob.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if blob.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if len(blob) >= 12 and blob.startswith(b"RIFF") and blob[8:12] == b"WEBP":
        return "image/webp"
    return ""


def _is_public_ip_address(value):
    try:
        ip_obj = ipaddress.ip_address(str(value))
    except ValueError:
        return False
    return not (
        ip_obj.is_private
        or ip_obj.is_loopback
        or ip_obj.is_link_local
        or ip_obj.is_multicast
        or ip_obj.is_reserved
        or ip_obj.is_unspecified
    )


def _validate_remote_image_url(raw_url):
    parsed = urllib.parse.urlparse(str(raw_url or "").strip())
    if parsed.scheme.lower() not in {"http", "https"}:
        return {"ok": False, "error": "Solo se permiten URLs http(s)."}
    if parsed.username or parsed.password:
        return {"ok": False, "error": "La URL de imagen no puede incluir credenciales."}
    if not parsed.hostname:
        return {"ok": False, "error": "La URL de imagen no tiene un host valido."}

    host = str(parsed.hostname or "").strip()
    if host.lower() in {"localhost"}:
        return {"ok": False, "error": "No se permiten hosts locales para imagenes remotas."}

    try:
        addresses = {
            info[4][0]
            for info in socket.getaddrinfo(
                host,
                parsed.port or (443 if parsed.scheme.lower() == "https" else 80),
                type=socket.SOCK_STREAM,
            )
        }
    except socket.gaierror:
        return {"ok": False, "error": "No se pudo resolver el host remoto de la imagen."}

    if not addresses:
        return {"ok": False, "error": "No se pudo validar el host remoto de la imagen."}

    for address in addresses:
        if not _is_public_ip_address(address):
            return {"ok": False, "error": "No se permiten destinos internos o locales para imagenes remotas."}

    return {"ok": True, "parsed": parsed}


class _NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _download_remote_image_blob(raw_url, headers, max_hops=3):
    current_url = str(raw_url or "").strip()
    opener = urllib.request.build_opener(_NoRedirectHandler())

    for _ in range(max_hops + 1):
        validation = _validate_remote_image_url(current_url)
        if not validation.get("ok"):
            return {"ok": False, "error": validation.get("error") or "URL de imagen invalida."}

        request = urllib.request.Request(current_url, headers=headers, method="GET")
        try:
            with opener.open(request, timeout=20) as response:
                content_type = response.headers.get("Content-Type", "")
                blob = response.read(MAX_IMAGE_BYTES + 1)
                return {"ok": True, "content_type": content_type, "blob": blob}
        except urllib.error.HTTPError as error:
            if int(error.code) in REDIRECT_STATUS_CODES:
                location = str(error.headers.get("Location") or "").strip()
                if not location:
                    return {"ok": False, "error": f"No se pudo seguir la redireccion de la imagen (HTTP {error.code})."}
                current_url = urllib.parse.urljoin(current_url, location)
                continue
            return {"ok": False, "error": f"No se pudo descargar la imagen (HTTP {int(error.code)})."}
        except Exception:
            return {"ok": False, "error": "No se pudo descargar la imagen desde la URL indicada."}

    return {"ok": False, "error": "La URL redirigio demasiadas veces."}


def save_remote_image_url(filename, image_url):
    raw_url = str(image_url or "").strip()
    if not raw_url:
        return {"ok": False, "error": "URL de imagen vacia."}
    if len(raw_url) > 1800:
        return {"ok": False, "error": "URL de imagen demasiado larga."}
    validation = _validate_remote_image_url(raw_url)
    if not validation.get("ok"):
        return {"ok": False, "error": validation.get("error") or "URL de imagen invalida."}
    parsed = validation["parsed"]

    header_profiles = [
        {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
            "Referer": f"{parsed.scheme}://{parsed.netloc}/",
        },
        {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Accept": "image/*,*/*;q=0.8",
        },
        {
            "Accept": "*/*",
        },
    ]

    blob = b""
    content_type = ""
    for headers in header_profiles:
        downloaded = _download_remote_image_blob(raw_url, headers)
        if not downloaded.get("ok"):
            blob = b""
            continue
        content_type = str(downloaded.get("content_type") or "")
        blob = downloaded.get("blob") or b""
        if blob:
            break

    if not blob:
        return {"ok": False, "error": "No se pudo descargar la imagen desde la URL indicada."}

    if not blob:
        return {"ok": False, "error": "La URL no devolvio una imagen valida."}
    if len(blob) > MAX_IMAGE_BYTES:
        return {"ok": False, "error": "La imagen remota excede el maximo permitido de 5 MB."}

    mime = _detect_image_mime(content_type, blob)
    if not mime:
        return {"ok": False, "error": "Tipo de imagen remoto no permitido (solo JPG, PNG, WEBP o GIF)."}

    data_url = f"data:{mime};base64,{base64.b64encode(blob).decode('ascii')}"
    resolved_filename = filename or Path(parsed.path).name or "imagen-remota"
    return save_data_url_image(filename=resolved_filename, data_url=data_url)


def validate_customer_ruc(value):
    return bool(RUC_REGEX.match(str(value or "").strip()))


def _clean_html_text(value):
    text = re.sub(r"<[^>]+>", " ", str(value or ""))
    text = html.unescape(text)
    return " ".join(text.split())


def _decode_http_body(raw):
    blob = raw or b""
    for encoding in ("utf-8", "latin-1"):
        try:
            return blob.decode(encoding)
        except UnicodeDecodeError:
            continue
    return blob.decode("utf-8", errors="replace")


def _extract_sunat_field(raw_html, label):
    decoded = html.unescape(raw_html)
    pattern = re.compile(
        rf'<h4 class="list-group-item-heading">\s*{re.escape(label)}\s*</h4>\s*</div>\s*<div class="col-sm-[0-9]+">\s*<(?:p|h4) class="list-group-item-(?:text|heading)">\s*(.*?)\s*</(?:p|h4)>',
        re.IGNORECASE | re.DOTALL,
    )
    match = pattern.search(decoded)
    if not match:
        return ""
    return _clean_html_text(match.group(1))


def _parse_sunat_lookup_response(raw_html):
    decoded = html.unescape(raw_html)
    full_text = _clean_html_text(decoded)

    entry = re.search(
        r'<h4 class="list-group-item-heading">\s*([0-9]{11})\s*-\s*(.*?)\s*</h4>',
        decoded,
        re.IGNORECASE | re.DOTALL,
    )
    if entry:
        found_ruc = sanitize_text(entry.group(1), 11)
        customer_name = sanitize_text(_clean_html_text(entry.group(2)), 180)
        if found_ruc and customer_name:
            return {
                "ok": True,
                "status": 200,
                "payload": {
                    "ruc": found_ruc,
                    "name": customer_name,
                    "details": {
                        "estado": _extract_sunat_field(decoded, "Estado del Contribuyente:"),
                        "condicion": _extract_sunat_field(decoded, "Condición del Contribuyente:"),
                        "domicilio": _extract_sunat_field(decoded, "Domicilio Fiscal:"),
                        "nombre_comercial": _extract_sunat_field(decoded, "Nombre Comercial:"),
                    },
                },
            }

    panel_message = re.search(r'<div class="panel-body[^>]*>\s*<strong>\s*(.*?)\s*</strong>', decoded, re.IGNORECASE | re.DOTALL)
    if panel_message:
        message = _clean_html_text(panel_message.group(1))
        if message:
            return {"ok": False, "status": 404, "error": message}

    if "surgieron problemas al procesar la consulta por numero de ruc." in full_text.lower():
        return {"ok": False, "status": 502, "error": "SUNAT rechazo la consulta por RUC en este momento. Intenta nuevamente."}

    return {"ok": False, "status": 502, "error": "No se pudo interpretar la respuesta de SUNAT."}


def fetch_sunat_ruc_data(ruc):
    cookie_jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie_jar))
    opener.addheaders = [
        ("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"),
        ("Accept-Language", "es-PE,es;q=0.9,en;q=0.8"),
    ]

    try:
        opener.open(SUNAT_FRAME_URL, timeout=15).read()
        form_data = urllib.parse.urlencode(
            {
                "accion": "consPorRuc",
                "nroRuc": str(ruc).strip(),
                "contexto": "ti-it",
                "modo": "1",
                # SUNAT solicita campo token; actualmente acepta valor no vacio.
                "token": "consulta-ruc-local",
            }
        ).encode("utf-8")
        request = urllib.request.Request(
            SUNAT_QUERY_URL,
            data=form_data,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Referer": SUNAT_FRAME_URL,
                "Origin": "https://e-consultaruc.sunat.gob.pe",
            },
            method="POST",
        )
        with opener.open(request, timeout=15) as response:
            raw_html = _decode_http_body(response.read())

        parsed = _parse_sunat_lookup_response(raw_html)
        return parsed
    except urllib.error.HTTPError as error:
        return {"ok": False, "status": int(error.code), "error": f"SUNAT respondio {error.code}."}
    except Exception:
        return {"ok": False, "status": 502, "error": "No se pudo conectar con SUNAT en este momento."}


class AppHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".avif": "image/avif",
        ".webp": "image/webp",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PROJECT_ROOT), **kwargs)

    def log_message(self, fmt, *args):
        print(f"[{self.log_date_time_string()}] {self.address_string()} - {fmt % args}")

    def end_headers(self):
        parsed_request = urllib.parse.urlparse(self.path)
        if not parsed_request.path.startswith("/api/"):
            suffix = Path(parsed_request.path).suffix.lower()
            if suffix in {".css", ".js", ".png", ".jpg", ".jpeg", ".webp", ".avif", ".svg", ".ico"}:
                has_version = bool(urllib.parse.parse_qs(parsed_request.query).get("v"))
                is_image = suffix in {".png", ".jpg", ".jpeg", ".webp", ".avif", ".svg", ".ico"}
                max_age = 31536000 if has_version else (2592000 if is_image else 3600)
                cache_value = f"public, max-age={max_age}"
                if has_version:
                    cache_value += ", immutable"
                self.send_header("Cache-Control", cache_value)
            elif suffix in {"", ".html"}:
                self.send_header("Cache-Control", "no-cache")

        self.send_header("Referrer-Policy", "same-origin")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        self.send_header("X-Permitted-Cross-Domain-Policies", "none")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        self.send_header("Cross-Origin-Opener-Policy", "same-origin-allow-popups")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://accounts.google.com; "
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; "
            "img-src 'self' data: blob: https:; "
            "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net; "
            "connect-src 'self' https://accounts.google.com; "
            "frame-src https://www.google.com https://maps.google.com https://accounts.google.com; "
            "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'"
        )
        super().end_headers()

    def _cors_allow_origin(self):
        if "*" in CORS_ORIGINS:
            return "*"

        origin = _normalize_origin(self.headers.get("Origin"))
        if origin and origin in CORS_ORIGINS:
            return origin
        if not origin and "null" in CORS_ORIGINS:
            return ""
        if _is_allowed_local_origin(origin):
            return origin
        return ""

    def _set_cors_headers(self):
        allow_origin = self._cors_allow_origin()
        if allow_origin:
            self.send_header("Access-Control-Allow-Origin", allow_origin)
            if allow_origin != "*":
                self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")

    def _json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store, private, max-age=0")
        self.send_header("Pragma", "no-cache")
        self._set_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def _parse_json_body(self):
        self._body_parse_failed = False
        raw_length = str(self.headers.get("Content-Length", "0")).strip()
        try:
            length = int(raw_length)
        except ValueError:
            self._body_parse_failed = True
            self._json(400, {"ok": False, "error": "Content-Length invalido."})
            return None
        if length <= 0:
            return {}
        if length > MAX_JSON_BODY_BYTES:
            self._body_parse_failed = True
            self._json(413, {"ok": False, "error": "La solicitud excede el tamano maximo permitido."})
            return None
        raw = self.rfile.read(length)
        if not raw:
            return {}
        try:
            return json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._body_parse_failed = True
            self._json(400, {"ok": False, "error": "JSON invalido."})
            return None

    def list_directory(self, path):
        self.send_error(404, "File not found")
        return None

    def _auth_user(self):
        auth = self.headers.get("Authorization", "")
        if not auth.lower().startswith("bearer "):
            return None
        token = auth[7:].strip()
        if not token:
            return None
        return get_user_by_token(token)

    def _client_ip(self):
        peer_ip = sanitize_text(self.client_address[0] if self.client_address else "", 120)
        if not TRUST_PROXY_HEADERS:
            return peer_ip

        candidates = [
            self.headers.get("X-Real-IP"),
            str(self.headers.get("X-Forwarded-For") or "").split(",", 1)[0],
        ]
        for candidate in candidates:
            value = str(candidate or "").strip()
            try:
                return str(ipaddress.ip_address(value))
            except ValueError:
                continue
        return peer_ip

    def _require_auth(self):
        user = self._auth_user()
        if not user:
            self._json(401, {"ok": False, "error": "No autorizado."})
            return None
        return user

    def _require_admin(self):
        user = self._require_auth()
        if not user:
            return None
        if str(user["role"]).lower() != "admin":
            self._json(403, {"ok": False, "error": "Se requiere rol admin."})
            return None
        return user

    def _extract_product_payload(self, payload):
        category_key = sanitize_text(payload.get("categoryKey"), 60)
        category_label = sanitize_text(payload.get("categoryLabel"), 80)
        code = sanitize_code(payload.get("code"))
        name = sanitize_text(payload.get("name"), 120)
        description = sanitize_text(payload.get("description"), 600)
        image = sanitize_image(payload.get("image"))
        price = to_price(payload.get("price"))
        discount = clamp_discount(payload.get("discountPct"))
        active = to_flag(payload.get("active", True), default=True)
        is_custom = to_flag(payload.get("isCustom", True), default=True)

        if not category_key:
            return None, "Categoria invalida."
        if has_markup_tokens(payload.get("categoryKey")) or has_markup_tokens(payload.get("categoryLabel")):
            return None, "No se permite HTML en categoria o subcategoria."
        if not code:
            return None, "Codigo invalido."
        if not name:
            return None, "Nombre invalido."
        if has_markup_tokens(payload.get("name")) or has_markup_tokens(payload.get("description")):
            return None, "No se permite HTML en nombre o descripcion."
        if price is None:
            return None, "Precio invalido."
        if image is None:
            return None, "Ruta de imagen invalida. Usa URL, data:image o ruta tipo img/productos/archivo.jpg."

        return {
            "categoryKey": category_key,
            "categoryLabel": category_label,
            "code": code,
            "name": name,
            "description": description,
            "image": image,
            "price": price,
            "discountPct": discount,
            "active": active,
            "isCustom": is_custom,
        }, None

    def _sanitize_proforma_item(self, item):
        if not isinstance(item, dict):
            return None

        code = sanitize_code(item.get("code"))
        if not code:
            return None
        product = get_product_by_code(code, active_only=True)
        if not product:
            return None

        name = sanitize_text(product.get("name"), 180)
        original_price = to_price(product.get("price"))
        discount_pct = clamp_discount(product.get("discountPct"))
        price = round(float(original_price) * (1 - float(discount_pct) / 100), 2)

        try:
            qty = int(float(item.get("qty", 1)))
        except (TypeError, ValueError):
            qty = 1
        qty = max(1, min(100000, qty))

        if not name:
            return None
        if original_price is None:
            original_price = 0.0

        is_promotion = discount_pct > 0

        return {
            "name": name,
            "code": code,
            "qty": qty,
            "price": price,
            "originalPrice": round(float(original_price), 2),
            "discountPct": discount_pct,
            "isPromotion": is_promotion,
        }

    def _extract_proforma_payload(self, payload, user):
        if not isinstance(payload, dict):
            return None, "Payload de proforma invalido."

        user_email = sanitize_text(user["email"] if user and "email" in user.keys() else "", 120).lower()
        customer_name = sanitize_text(payload.get("customerName"), 180)
        customer_ruc = sanitize_text(payload.get("customerRuc"), 11)
        customer_department = sanitize_text(payload.get("customerDepartment"), 80)
        customer_district = sanitize_text(payload.get("customerDistrict"), 80)
        customer_address = sanitize_text(payload.get("customerAddress"), 180)
        customer_phone = sanitize_text(payload.get("customerPhone"), 20)
        serial = sanitize_text(payload.get("serial"), 40).upper()
        record_id = sanitize_text(payload.get("id"), 80)

        if not customer_name:
            return None, "Nombre de cliente invalido."
        if has_markup_tokens(payload.get("customerName")):
            return None, "No se permite HTML en el nombre del cliente."
        if not validate_customer_ruc(customer_ruc):
            return None, "RUC de cliente invalido."
        if customer_department != "Lima":
            return None, "Selecciona el departamento Lima."
        if customer_district not in LIMA_DISTRICTS:
            return None, "Selecciona un distrito valido de Lima."
        if not customer_address or len(customer_address) < 6:
            return None, "Direccion de cliente invalida."
        if not re.match(r"^\+?\d{7,15}$", customer_phone):
            return None, "Telefono de cliente invalido."
        if any(
            has_markup_tokens(value)
            for value in (
                payload.get("customerDepartment"),
                payload.get("customerDistrict"),
                payload.get("customerAddress"),
                payload.get("customerPhone"),
            )
        ):
            return None, "No se permite HTML en los datos de entrega."
        if serial and not PROFORMA_SERIAL_REGEX.match(serial):
            return None, "Serie de proforma invalida."
        if record_id and not PROFORMA_ID_REGEX.match(record_id):
            return None, "ID de proforma invalido."

        if not serial:
            serial = f"PF01-{dt.datetime.now().strftime('%Y%m%d%H%M%S')}"
        if not record_id:
            record_id = f"prf_{int(dt.datetime.now().timestamp() * 1000)}_{secrets.token_hex(2)}"

        issued_raw = sanitize_text(payload.get("issuedAt"), 50)
        issued_dt = None
        if issued_raw:
            try:
                issued_dt = dt.datetime.fromisoformat(issued_raw)
            except ValueError:
                issued_dt = None
        if not issued_dt:
            issued_dt = dt.datetime.now(dt.timezone.utc)
        if issued_dt.tzinfo is None:
            issued_dt = issued_dt.replace(tzinfo=dt.timezone.utc)
        issued_at = issued_dt.astimezone(dt.timezone.utc).replace(microsecond=0).isoformat()

        raw_items = payload.get("items")
        if not isinstance(raw_items, list) or not raw_items:
            return None, "La proforma debe incluir al menos un item."

        items = []
        for raw in raw_items:
            clean = self._sanitize_proforma_item(raw)
            if clean:
                items.append(clean)

        if len(items) != len(raw_items):
            return None, "La proforma contiene productos inexistentes o inactivos."

        total_items = sum(int(item["qty"]) for item in items)
        total_amount = round(sum(float(item["qty"]) * float(item["price"]) for item in items), 2)

        return {
            "id": record_id,
            "serial": serial,
            "issuedAt": issued_at,
            "customerName": customer_name,
            "customerEmail": user_email,
            "customerRuc": customer_ruc,
            "customerDepartment": customer_department,
            "customerDistrict": customer_district,
            "customerAddress": customer_address,
            "customerPhone": customer_phone,
            "totalItems": total_items,
            "totalAmount": total_amount,
            "items": items,
        }, None

    def do_OPTIONS(self):
        self._json(204, {"ok": True})

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if not parsed.path.startswith("/api/"):
            if not is_allowed_static_request_path(parsed.path):
                self.send_error(404, "File not found")
                return
            return super().do_GET()

        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path == "/api/health":
            return self._json(200, {"ok": True, "service": "eurekaclean-backend"})

        if path == "/api/auth/providers":
            return self._json(
                200,
                {
                    "ok": True,
                    "google": {
                        "enabled": bool(GOOGLE_CLIENT_ID),
                        "clientId": GOOGLE_CLIENT_ID if GOOGLE_CLIENT_ID else "",
                    },
                },
            )

        if path == "/api/auth/me":
            user = self._require_auth()
            if not user:
                return
            return self._json(
                200,
                {
                    "ok": True,
                    "user": {"name": user["name"], "email": user["email"], "role": user["role"]},
                },
            )

        if path == "/api/proformas":
            user = self._require_auth()
            if not user:
                return
            items = list_proformas_by_user(user["id"])
            return self._json(200, {"ok": True, "items": items})

        if path == "/api/catalog/categories":
            return self._json(200, {"ok": True, "categories": list_categories()})

        if path == "/api/catalog/products":
            category_key = sanitize_text((query.get("categoryKey") or [""])[0], 60)
            search = sanitize_text((query.get("q") or [""])[0], 120)
            active_only = (query.get("activeOnly") or ["0"])[0] in {"1", "true", "yes"}
            items = list_products(
                category_key=category_key or None,
                query=search or None,
                active_only=active_only,
            )
            return self._json(200, {"ok": True, "items": items})

        if path == "/api/catalog":
            active_only = (query.get("activeOnly") or ["0"])[0] in {"1", "true", "yes"}
            return self._json(200, {"ok": True, "catalog": get_catalog_map(active_only=active_only)})

        if path == "/api/sunat/ruc":
            ruc = sanitize_text((query.get("numero") or query.get("ruc") or [""])[0], 11)
            if not validate_customer_ruc(ruc):
                return self._json(400, {"ok": False, "error": "RUC invalido. Debe iniciar en 10 o 20 y tener 11 digitos."})

            sunat_response = fetch_sunat_ruc_data(ruc)
            if not sunat_response["ok"]:
                return self._json(
                    sunat_response.get("status", 502),
                    {"ok": False, "error": sunat_response.get("error", "No se pudo consultar SUNAT.")},
                )

            payload = sunat_response.get("payload") or {}
            name = sanitize_text(payload.get("name"), 180) if isinstance(payload, dict) else ""
            if not name:
                return self._json(404, {"ok": False, "error": "SUNAT no devolvio nombre o razon social para este RUC."})

            details = payload.get("details") if isinstance(payload, dict) and isinstance(payload.get("details"), dict) else {}
            return self._json(
                200,
                {
                    "ok": True,
                    "ruc": sanitize_text(payload.get("ruc"), 11) if isinstance(payload, dict) else ruc,
                    "name": name,
                    "details": details,
                },
            )

        match = re.match(r"^/api/catalog/products/([A-Za-z0-9\-]+)$", path)
        if match:
            code = sanitize_code(match.group(1))
            if not code:
                return self._json(400, {"ok": False, "error": "Codigo invalido."})
            item = next((p for p in list_products() if p["code"] == code), None)
            if not item:
                return self._json(404, {"ok": False, "error": "Producto no encontrado."})
            return self._json(200, {"ok": True, "item": item})

        return self._json(404, {"ok": False, "error": "Ruta no encontrada."})

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if not path.startswith("/api/"):
            return self._json(404, {"ok": False, "error": "Ruta no encontrada."})

        body = self._parse_json_body()
        if body is None:
            return

        if path == "/api/auth/login":
            email = sanitize_text(body.get("email"), 120).lower()
            password = str(body.get("password") or "")
            remote_ip = self._client_ip()
            if not email or not password:
                return self._json(400, {"ok": False, "error": "Correo y contrasena son obligatorios."})
            if _is_rate_limited("login_ip", remote_ip, AUTH_MAX_LOGIN_ATTEMPTS_PER_IP) or _is_rate_limited(
                "login_email", email, AUTH_MAX_LOGIN_ATTEMPTS_PER_EMAIL
            ):
                return self._json(
                    429,
                    {
                        "ok": False,
                        "error": "Demasiados intentos de inicio de sesion. Espera 15 minutos antes de volver a intentar.",
                    },
                )

            user = get_user_by_email(email)
            if not user or not verify_password(password, user["password_salt"], user["password_hash"]):
                _record_rate_limit_failure("login_ip", remote_ip)
                _record_rate_limit_failure("login_email", email)
                return self._json(401, {"ok": False, "error": "Credenciales invalidas."})

            _clear_rate_limit_key("login_ip", remote_ip)
            _clear_rate_limit_key("login_email", email)
            token = create_session(user["id"])
            return self._json(
                200,
                {
                    "ok": True,
                    "token": token,
                    "user": {"name": user["name"], "email": user["email"], "role": user["role"]},
                },
            )

        if path == "/api/auth/google":
            remote_ip = self._client_ip()
            if _is_rate_limited("login_ip", remote_ip, AUTH_MAX_LOGIN_ATTEMPTS_PER_IP):
                return self._json(429, {"ok": False, "error": "Demasiados intentos de inicio de sesion."})

            verified = verify_google_id_token(body.get("credential"))
            if not verified.get("ok"):
                _record_rate_limit_failure("login_ip", remote_ip)
                return self._json(401, {"ok": False, "error": verified.get("error") or "Cuenta de Google invalida."})

            email = verified["email"]
            user = get_user_by_email(email)
            if not user:
                created = create_user(
                    name=verified["name"],
                    email=email,
                    password=secrets.token_urlsafe(48),
                    role="user",
                )
                if not created.get("ok"):
                    return self._json(400, {"ok": False, "error": created.get("error") or "No se pudo crear la cuenta."})
                user = get_user_by_email(email)
            if not user:
                return self._json(500, {"ok": False, "error": "No se pudo iniciar la sesion con Google."})

            _clear_rate_limit_key("login_ip", remote_ip)
            token = create_session(user["id"])
            return self._json(
                200,
                {
                    "ok": True,
                    "token": token,
                    "user": {"name": user["name"], "email": user["email"], "role": user["role"]},
                },
            )

        if path == "/api/auth/register":
            name = sanitize_text(body.get("name"), 120)
            email = sanitize_text(body.get("email"), 120).lower()
            password = str(body.get("password") or "")
            remote_ip = self._client_ip()
            if _is_rate_limited("register_ip", remote_ip, AUTH_MAX_REGISTER_ATTEMPTS_PER_IP) or _is_rate_limited(
                "register_email", email, AUTH_MAX_REGISTER_ATTEMPTS_PER_EMAIL
            ):
                return self._json(
                    429,
                    {
                        "ok": False,
                        "error": "Demasiados intentos de registro. Espera 15 minutos antes de volver a intentar.",
                    },
                )
            if not name or "@" not in email:
                _record_rate_limit_failure("register_ip", remote_ip)
                _record_rate_limit_failure("register_email", email)
                return self._json(400, {"ok": False, "error": "Nombre o correo invalido."})
            if has_markup_tokens(body.get("name")):
                _record_rate_limit_failure("register_ip", remote_ip)
                _record_rate_limit_failure("register_email", email)
                return self._json(400, {"ok": False, "error": "No se permite HTML en el nombre."})
            password_ok, password_error = validate_new_password(password)
            if not password_ok:
                _record_rate_limit_failure("register_ip", remote_ip)
                _record_rate_limit_failure("register_email", email)
                return self._json(400, {"ok": False, "error": password_error})
            result = create_user(name=name, email=email, password=password, role="user")
            if not result["ok"]:
                _record_rate_limit_failure("register_ip", remote_ip)
                _record_rate_limit_failure("register_email", email)
                return self._json(400, result)
            _clear_rate_limit_key("register_ip", remote_ip)
            _clear_rate_limit_key("register_email", email)
            return self._json(201, {"ok": True})

        if path == "/api/proformas":
            user = self._require_auth()
            if not user:
                return
            if str(user["role"]).lower() == "admin":
                return self._json(403, {"ok": False, "error": "Solo clientes pueden guardar proformas."})

            clean, error = self._extract_proforma_payload(body, user)
            if error:
                return self._json(400, {"ok": False, "error": error})

            result = create_proforma_for_user(user["id"], clean)
            if not result.get("ok"):
                message = str(result.get("error") or "No se pudo guardar la proforma.")
                status = 409 if "ya existe" in message.lower() else 400
                return self._json(status, {"ok": False, "error": message})

            response_status = 201 if result.get("created", True) else 200
            return self._json(response_status, {"ok": True, "record": result.get("record")})

        if path == "/api/catalog/products":
            if not self._require_admin():
                return
            clean, error = self._extract_product_payload(body)
            if error:
                return self._json(400, {"ok": False, "error": error})
            result = upsert_product(
                category_key=clean["categoryKey"],
                category_label=clean["categoryLabel"],
                code=clean["code"],
                name=clean["name"],
                description=clean["description"],
                price=clean["price"],
                discount_pct=clean["discountPct"],
                image=clean["image"],
                active=clean["active"],
                is_custom=clean["isCustom"],
                allow_insert=True,
            )
            if not result["ok"]:
                return self._json(400, result)
            return self._json(201, {"ok": True})

        if path == "/api/catalog/import":
            if not self._require_admin():
                return
            rows = body.get("rows")
            if not isinstance(rows, list) or not rows:
                return self._json(400, {"ok": False, "error": "rows debe ser una lista con datos."})

            updated = 0
            errors = []
            for idx, row in enumerate(rows, start=1):
                if not isinstance(row, dict):
                    errors.append(f"Fila {idx}: formato invalido.")
                    continue
                clean, error = self._extract_product_payload(row)
                if error:
                    errors.append(f"Fila {idx}: {error}")
                    continue
                result = upsert_product(
                    category_key=clean["categoryKey"],
                    category_label=clean["categoryLabel"],
                    code=clean["code"],
                    name=clean["name"],
                    description=clean["description"],
                    price=clean["price"],
                    discount_pct=clean["discountPct"],
                    image=clean["image"],
                    active=clean["active"],
                    is_custom=clean["isCustom"],
                    allow_insert=True,
                )
                if not result["ok"]:
                    errors.append(f"Fila {idx}: {result['error']}")
                    continue
                updated += 1

            if errors:
                return self._json(400, {"ok": False, "updated": updated, "errors": errors})
            return self._json(200, {"ok": True, "updated": updated})

        if path == "/api/catalog/images":
            if not self._require_admin():
                return

            filename = sanitize_text(body.get("filename"), 180)
            data_url = body.get("dataUrl")
            image_url = sanitize_text(body.get("imageUrl"), 1800)
            if data_url:
                saved = save_data_url_image(filename=filename, data_url=data_url)
            elif image_url:
                saved = save_remote_image_url(filename=filename, image_url=image_url)
            else:
                saved = {"ok": False, "error": "Falta dataUrl o imageUrl para guardar imagen."}
            if not saved["ok"]:
                return self._json(400, {"ok": False, "error": saved["error"]})
            return self._json(201, {"ok": True, "imagePath": saved["path"]})

        return self._json(404, {"ok": False, "error": "Ruta no encontrada."})

    def do_PATCH(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if not path.startswith("/api/"):
            return self._json(404, {"ok": False, "error": "Ruta no encontrada."})
        if not self._require_admin():
            return

        body = self._parse_json_body()
        if body is None:
            return

        match = re.match(r"^/api/catalog/products/([A-Za-z0-9\-]+)$", path)
        if not match:
            return self._json(404, {"ok": False, "error": "Ruta no encontrada."})

        current_code = sanitize_code(match.group(1))
        if not current_code:
            return self._json(400, {"ok": False, "error": "Codigo invalido."})
        current = next((p for p in list_products() if p["code"] == current_code), None)
        if not current:
            return self._json(404, {"ok": False, "error": "Producto no encontrado."})

        merged = {
            "categoryKey": body.get("categoryKey", current["categoryKey"]),
            "categoryLabel": body.get("categoryLabel", current.get("categoryLabel", "")),
            "code": body.get("code", current["code"]),
            "name": body.get("name", current["name"]),
            "description": body.get("description", current.get("description", "")),
            "price": body.get("price", current["price"]),
            "discountPct": body.get("discountPct", current["discountPct"]),
            "image": body.get("image", current["image"]),
            "active": body.get("active", current["active"]),
            "isCustom": body.get("isCustom", current["isCustom"]),
        }

        clean, error = self._extract_product_payload(merged)
        if error:
            return self._json(400, {"ok": False, "error": error})

        if clean["code"] != current_code and not bool(current["isCustom"]):
            return self._json(400, {"ok": False, "error": "No se permite cambiar el codigo de productos base."})

        if clean["code"] != current_code and product_exists(clean["code"]):
            return self._json(400, {"ok": False, "error": f"El codigo {clean['code']} ya existe."})

        if clean["code"] != current_code:
            update_product_code(current_code=current_code, next_code=clean["code"])
            current_code = clean["code"]

        result = upsert_product(
            category_key=clean["categoryKey"],
            category_label=clean["categoryLabel"],
            code=current_code,
            name=clean["name"],
            description=clean["description"],
            price=clean["price"],
            discount_pct=clean["discountPct"],
            image=clean["image"],
            active=clean["active"],
            is_custom=clean["isCustom"],
            allow_insert=False,
        )
        if not result["ok"]:
            return self._json(400, result)
        return self._json(200, {"ok": True, "code": current_code})

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if not path.startswith("/api/"):
            return self._json(404, {"ok": False, "error": "Ruta no encontrada."})

        proforma_match = re.match(r"^/api/proformas/([^/]+)$", path)
        if proforma_match:
            user = self._require_auth()
            if not user:
                return
            if str(user["role"]).lower() == "admin":
                return self._json(403, {"ok": False, "error": "Solo clientes pueden eliminar proformas."})
            record_id = urllib.parse.unquote(proforma_match.group(1)).strip()
            result = delete_proforma_for_user(user["id"], record_id)
            if not result["ok"]:
                return self._json(404, result)
            return self._json(200, result)

        if not self._require_admin():
            return

        match = re.match(r"^/api/catalog/products/([A-Za-z0-9\-]+)$", path)
        if not match:
            return self._json(404, {"ok": False, "error": "Ruta no encontrada."})
        code = sanitize_code(match.group(1))
        if not code:
            return self._json(400, {"ok": False, "error": "Codigo invalido."})
        result = delete_product(code)
        if not result["ok"]:
            return self._json(404, result)
        return self._json(200, result)

    def do_HEAD(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self.send_error(405, "Method not allowed")
            return
        if not is_allowed_static_request_path(parsed.path):
            self.send_error(404, "File not found")
            return
        return super().do_HEAD()


def run_server():
    init_db()
    host = str(os.environ.get("APP_HOST") or os.environ.get("HOST") or "127.0.0.1").strip()
    port = int(str(os.environ.get("APP_PORT") or os.environ.get("PORT") or "8000").strip())
    server = ThreadingHTTPServer((host, port), AppHandler)
    print(f"[backend] running on http://{host}:{port}")
    print(f"[backend] database: {BASE_DIR / 'app.db'}")
    print(f"[backend] static root: {PROJECT_ROOT}")
    if CORS_ORIGINS:
        print(f"[backend] cors origins: {', '.join(sorted(CORS_ORIGINS))}")
    if count_users() == 0:
        print("[backend] no hay usuarios creados en la base actual")
        print("[backend] define APP_SEED_USERS=1 y APP_SEED_ADMIN_EMAIL/PASSWORD para bootstrapear usuarios iniciales")
    server.serve_forever()


if __name__ == "__main__":
    run_server()
