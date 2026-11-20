import datetime as dt
import hashlib
import hmac
import json
import math
import secrets
import sqlite3
import threading
from pathlib import Path

from data_seed import get_default_users, get_seed_catalog


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "app.db"
PASSWORD_ITERATIONS = 150_000
TOKEN_TTL_HOURS = 12
DB_LOCK = threading.Lock()


def utc_now():
    return dt.datetime.now(dt.timezone.utc)


def iso_now():
    return utc_now().replace(microsecond=0).isoformat()


def parse_iso(value):
    try:
        return dt.datetime.fromisoformat(str(value))
    except ValueError:
        return None


def get_conn():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 10000")
    return conn


def hash_password(password, salt_hex=None):
    salt = bytes.fromhex(salt_hex) if salt_hex else secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS)
    return salt.hex(), digest.hex()


def verify_password(password, salt_hex, hash_hex):
    try:
        _, digest_hex = hash_password(password, salt_hex=salt_hex)
    except (TypeError, ValueError):
        return False
    return hmac.compare_digest(str(digest_hex), str(hash_hex or ""))


def token_hash(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _text(value, default=""):
    if value is None:
        return default
    return str(value).strip()


def _clean_float(value, default=0.0, minimum=None, maximum=None):
    try:
        number = float(value)
    except (TypeError, ValueError):
        number = float(default)

    if not math.isfinite(number):
        number = float(default)
    if minimum is not None:
        number = max(float(minimum), number)
    if maximum is not None:
        number = min(float(maximum), number)
    return round(number, 2)


def _clean_int(value, default=0, minimum=None, maximum=None):
    try:
        number = int(float(value))
    except (TypeError, ValueError):
        number = int(default)

    if minimum is not None:
        number = max(int(minimum), number)
    if maximum is not None:
        number = min(int(maximum), number)
    return number


def _clean_bool(value, default=False):
    if value is None:
        return bool(default)
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


def repair_db_data():
    statements = [
        ("UPDATE users SET name = 'Usuario' WHERE name IS NULL OR TRIM(name) = ''", "users_name"),
        ("DELETE FROM sessions WHERE token_hash IS NULL OR TRIM(token_hash) = ''", "sessions_token_hash"),
        ("DELETE FROM sessions WHERE expires_at IS NULL OR TRIM(expires_at) = ''", "sessions_expires_at"),
        ("UPDATE categories SET label = 'Sin categoria' WHERE label IS NULL OR TRIM(label) = ''", "categories_label"),
        ("UPDATE products SET description = '' WHERE description IS NULL", "products_description"),
        ("UPDATE products SET image = '' WHERE image IS NULL", "products_image"),
        ("UPDATE products SET discount_pct = 0 WHERE discount_pct IS NULL", "products_discount_pct"),
        ("UPDATE products SET discount_pct = 0 WHERE CAST(discount_pct AS REAL) < 0", "products_discount_negative"),
        ("UPDATE products SET discount_pct = 90 WHERE CAST(discount_pct AS REAL) > 90", "products_discount_limit"),
        ("UPDATE products SET price = 0 WHERE price IS NULL", "products_price"),
        ("UPDATE products SET price = 0 WHERE CAST(price AS REAL) < 0", "products_negative_price"),
        ("UPDATE products SET active = 1 WHERE active IS NULL", "products_active"),
        ("UPDATE products SET is_custom = 0 WHERE is_custom IS NULL", "products_is_custom"),
        ("UPDATE proformas SET customer_email = '' WHERE customer_email IS NULL", "proformas_customer_email"),
        ("UPDATE proformas SET customer_department = '' WHERE customer_department IS NULL", "proformas_customer_department"),
        ("UPDATE proformas SET customer_district = '' WHERE customer_district IS NULL", "proformas_customer_district"),
        ("UPDATE proformas SET customer_address = '' WHERE customer_address IS NULL", "proformas_customer_address"),
        ("UPDATE proformas SET customer_phone = '' WHERE customer_phone IS NULL", "proformas_customer_phone"),
        ("UPDATE proformas SET items_json = '[]' WHERE items_json IS NULL OR TRIM(items_json) = ''", "proformas_items_json"),
        ("UPDATE proformas SET total_items = 0 WHERE total_items IS NULL", "proformas_total_items"),
        ("UPDATE proformas SET total_amount = 0 WHERE total_amount IS NULL", "proformas_total_amount"),
    ]

    summary = {}
    with DB_LOCK:
        conn = get_conn()
        cur = conn.cursor()
        for sql, label in statements:
            cur.execute(sql)
            if cur.rowcount > 0:
                summary[label] = int(cur.rowcount)
        conn.commit()
        conn.close()

    return summary


def init_db():
    BASE_DIR.mkdir(parents=True, exist_ok=True)
    with DB_LOCK:
        conn = get_conn()
        conn.execute("PRAGMA journal_mode = WAL")
        cur = conn.cursor()
        cur.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              email TEXT NOT NULL UNIQUE,
              password_salt TEXT NOT NULL,
              password_hash TEXT NOT NULL,
              role TEXT NOT NULL CHECK(role IN ('admin','user')),
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              token_hash TEXT NOT NULL UNIQUE,
              expires_at TEXT NOT NULL,
              created_at TEXT NOT NULL,
              FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS categories (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              category_key TEXT NOT NULL UNIQUE,
              label TEXT NOT NULL,
              sort_order INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS products (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              category_id INTEGER NOT NULL,
              code TEXT NOT NULL UNIQUE,
              name TEXT NOT NULL,
              description TEXT NOT NULL DEFAULT '',
              price REAL NOT NULL,
              discount_pct REAL NOT NULL DEFAULT 0,
              image TEXT NOT NULL DEFAULT '',
              active INTEGER NOT NULL DEFAULT 1,
              is_custom INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
            CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);

            CREATE TABLE IF NOT EXISTS proformas (
              id TEXT PRIMARY KEY,
              user_id INTEGER NOT NULL,
              serial TEXT NOT NULL,
              issued_at TEXT NOT NULL,
              customer_name TEXT NOT NULL,
              customer_email TEXT NOT NULL,
              customer_ruc TEXT NOT NULL,
              customer_department TEXT NOT NULL DEFAULT '',
              customer_district TEXT NOT NULL DEFAULT '',
              customer_address TEXT NOT NULL DEFAULT '',
              customer_phone TEXT NOT NULL DEFAULT '',
              total_items INTEGER NOT NULL,
              total_amount REAL NOT NULL,
              items_json TEXT NOT NULL,
              created_at TEXT NOT NULL,
              FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_proformas_user ON proformas(user_id);
            CREATE INDEX IF NOT EXISTS idx_proformas_created ON proformas(created_at);
            """
        )

        product_columns = {
            row["name"]
            for row in cur.execute("PRAGMA table_info(products)").fetchall()
        }
        if "description" not in product_columns:
            cur.execute("ALTER TABLE products ADD COLUMN description TEXT NOT NULL DEFAULT ''")
        proforma_columns = {
            row["name"]
            for row in cur.execute("PRAGMA table_info(proformas)").fetchall()
        }
        if "customer_department" not in proforma_columns:
            cur.execute("ALTER TABLE proformas ADD COLUMN customer_department TEXT NOT NULL DEFAULT ''")
        if "customer_district" not in proforma_columns:
            cur.execute("ALTER TABLE proformas ADD COLUMN customer_district TEXT NOT NULL DEFAULT ''")
        if "customer_address" not in proforma_columns:
            cur.execute("ALTER TABLE proformas ADD COLUMN customer_address TEXT NOT NULL DEFAULT ''")
        if "customer_phone" not in proforma_columns:
            cur.execute("ALTER TABLE proformas ADD COLUMN customer_phone TEXT NOT NULL DEFAULT ''")
        conn.commit()
        conn.close()

    repair_db_data()
    seed_users()
    seed_catalog()


def seed_users():
    defaults = get_default_users()
    with DB_LOCK:
        conn = get_conn()
        cur = conn.cursor()
        for user in defaults:
            row = cur.execute("SELECT id FROM users WHERE email = ?", (user["email"],)).fetchone()
            if row:
                continue
            salt_hex, hash_hex = hash_password(user["password"])
            cur.execute(
                """
                INSERT INTO users (name, email, password_salt, password_hash, role, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (user["name"], user["email"], salt_hex, hash_hex, user["role"], iso_now()),
            )
        conn.commit()
        conn.close()


def reset_default_users():
    defaults = get_default_users()
    summary = {"ok": True, "created": 0, "updated": 0}

    with DB_LOCK:
        conn = get_conn()
        cur = conn.cursor()
        for user in defaults:
            salt_hex, hash_hex = hash_password(user["password"])
            row = cur.execute("SELECT id FROM users WHERE email = ?", (user["email"],)).fetchone()
            if row:
                cur.execute(
                    """
                    UPDATE users
                    SET name = ?, password_salt = ?, password_hash = ?, role = ?
                    WHERE email = ?
                    """,
                    (user["name"], salt_hex, hash_hex, user["role"], user["email"]),
                )
                summary["updated"] += 1
                continue

            cur.execute(
                """
                INSERT INTO users (name, email, password_salt, password_hash, role, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (user["name"], user["email"], salt_hex, hash_hex, user["role"], iso_now()),
            )
            summary["created"] += 1

        conn.commit()
        conn.close()

    return summary


def seed_catalog():
    catalog = get_seed_catalog()
    with DB_LOCK:
        conn = get_conn()
        cur = conn.cursor()
        count = cur.execute("SELECT COUNT(1) AS total FROM categories").fetchone()["total"]
        if count > 0:
            conn.close()
            return

        for idx, (category_key, payload) in enumerate(catalog.items(), start=1):
            cur.execute(
                "INSERT INTO categories (category_key, label, sort_order) VALUES (?, ?, ?)",
                (category_key, payload["label"], idx),
            )
            category_id = cur.lastrowid
            for item in payload["items"]:
                cur.execute(
                    """
                    INSERT INTO products (
                        category_id, code, name, description, price, discount_pct, image,
                        active, is_custom, created_at, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)
                    """,
                    (
                        category_id,
                        item["code"],
                        item["name"],
                        item.get("description", ""),
                        float(item["price"]),
                        0.0,
                        item.get("image", ""),
                        iso_now(),
                        iso_now(),
                    ),
                )

        conn.commit()
        conn.close()


def list_categories():
    conn = get_conn()
    rows = conn.execute(
        "SELECT category_key, label FROM categories ORDER BY sort_order, id"
    ).fetchall()
    conn.close()

    items = []
    for row in rows:
        key = _text(row["category_key"]).lower()
        label = _text(row["label"])
        if not key:
            continue
        items.append({"key": key, "label": label or "Sin categoria"})
    return items


def list_products(category_key=None, query=None, active_only=False):
    conn = get_conn()
    sql = """
        SELECT
          c.category_key,
          c.label AS category_label,
          p.code,
          p.name,
          p.description,
          p.price,
          p.discount_pct,
          p.image,
          p.active,
          p.is_custom
        FROM products p
        JOIN categories c ON c.id = p.category_id
        WHERE 1=1
    """
    args = []
    if category_key:
        sql += " AND c.category_key = ?"
        args.append(category_key)
    if query:
        sql += " AND (p.code LIKE ? OR p.name LIKE ? OR c.label LIKE ?)"
        q = f"%{query}%"
        args.extend([q, q, q])
    if active_only:
        sql += " AND p.active = 1"

    sql += " ORDER BY c.sort_order, p.code"
    rows = conn.execute(sql, args).fetchall()
    conn.close()

    items = []
    for row in rows:
        category = _text(row["category_key"]).lower()
        code = _text(row["code"]).upper()
        name = _text(row["name"])
        if not category or not code or not name:
            continue

        items.append(
            {
                "categoryKey": category,
                "categoryLabel": _text(row["category_label"]) or "Sin categoria",
                "code": code,
                "name": name,
                "description": _text(row["description"]),
                "price": _clean_float(row["price"], default=0.0, minimum=0),
                "discountPct": _clean_float(row["discount_pct"], default=0.0, minimum=0, maximum=90),
                "image": _text(row["image"]),
                "active": _clean_bool(row["active"], default=True),
                "isCustom": _clean_bool(row["is_custom"], default=False),
            }
        )
    return items


def get_catalog_map(active_only=False):
    categories = list_categories()
    products = list_products(active_only=active_only)
    by_category = {entry["key"]: {"label": entry["label"], "items": []} for entry in categories}
    for product in products:
        bucket = by_category.get(product["categoryKey"])
        if not bucket:
            continue
        bucket["items"].append(
            {
                "code": product["code"],
                "name": product["name"],
                "description": product["description"],
                "price": f"{product['price']:.2f}",
                "discountPct": product["discountPct"],
                "image": product["image"],
                "active": product["active"],
                "isCustom": product["isCustom"],
            }
        )
    return by_category


def get_user_by_email(email):
    conn = get_conn()
    row = conn.execute("SELECT * FROM users WHERE email = ?", (email.lower(),)).fetchone()
    conn.close()
    return row


def count_users():
    conn = get_conn()
    total = conn.execute("SELECT COUNT(1) AS total FROM users").fetchone()["total"]
    conn.close()
    return int(total or 0)


def create_user(name, email, password, role="user"):
    with DB_LOCK:
        conn = get_conn()
        existing = conn.execute("SELECT id FROM users WHERE email = ?", (email.lower(),)).fetchone()
        if existing:
            conn.close()
            return {"ok": False, "error": "El correo ya existe."}
        salt_hex, hash_hex = hash_password(password)
        conn.execute(
            """
            INSERT INTO users (name, email, password_salt, password_hash, role, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (name, email.lower(), salt_hex, hash_hex, role, iso_now()),
        )
        conn.commit()
        conn.close()
    return {"ok": True}


def create_session(user_id):
    raw_token = secrets.token_urlsafe(36)
    expires = utc_now() + dt.timedelta(hours=TOKEN_TTL_HOURS)
    with DB_LOCK:
        conn = get_conn()
        conn.execute("DELETE FROM sessions WHERE expires_at < ?", (iso_now(),))
        conn.execute(
            "INSERT INTO sessions (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)",
            (user_id, token_hash(raw_token), expires.replace(microsecond=0).isoformat(), iso_now()),
        )
        conn.commit()
        conn.close()
    return raw_token


def get_user_by_token(raw_token):
    hashed = token_hash(raw_token)
    conn = get_conn()
    row = conn.execute(
        """
        SELECT u.*, s.expires_at
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ?
        """,
        (hashed,),
    ).fetchone()
    conn.close()
    if not row:
        return None
    expires_at = parse_iso(row["expires_at"])
    if not expires_at or expires_at < utc_now():
        return None
    return row


def get_category_id(category_key):
    conn = get_conn()
    row = conn.execute(
        "SELECT id FROM categories WHERE category_key = ?",
        (category_key,),
    ).fetchone()
    conn.close()
    return row["id"] if row else None


def product_exists(code):
    conn = get_conn()
    row = conn.execute("SELECT id FROM products WHERE code = ?", (code,)).fetchone()
    conn.close()
    return bool(row)


def get_product_by_code(code, active_only=False):
    conn = get_conn()
    sql = """
        SELECT
          c.category_key,
          c.label AS category_label,
          p.code,
          p.name,
          p.description,
          p.price,
          p.discount_pct,
          p.image,
          p.active,
          p.is_custom
        FROM products p
        JOIN categories c ON c.id = p.category_id
        WHERE p.code = ?
    """
    args = [str(code or "").strip().upper()]
    if active_only:
        sql += " AND p.active = 1"
    row = conn.execute(sql, args).fetchone()
    conn.close()
    if not row:
        return None
    return {
        "categoryKey": _text(row["category_key"]).lower(),
        "categoryLabel": _text(row["category_label"]) or "Sin categoria",
        "code": _text(row["code"]).upper(),
        "name": _text(row["name"]),
        "description": _text(row["description"]),
        "price": _clean_float(row["price"], default=0.0, minimum=0),
        "discountPct": _clean_float(row["discount_pct"], default=0.0, minimum=0, maximum=90),
        "image": _text(row["image"]),
        "active": _clean_bool(row["active"], default=True),
        "isCustom": _clean_bool(row["is_custom"], default=False),
    }


def upsert_product(
    category_key,
    category_label,
    code,
    name,
    description,
    price,
    discount_pct,
    image,
    active=True,
    is_custom=True,
    allow_insert=True,
):
    with DB_LOCK:
        conn = get_conn()
        category_row = conn.execute(
            "SELECT id, label FROM categories WHERE category_key = ?",
            (category_key,),
        ).fetchone()
        if category_row:
            category_id = category_row["id"]
        else:
            resolved_label = str(category_label or "").strip() or str(category_key or "").replace("-", " ").strip().title()
            if not resolved_label:
                conn.close()
                return {"ok": False, "error": "Categoria no existe."}
            next_sort = conn.execute(
                "SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort FROM categories"
            ).fetchone()["next_sort"]
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO categories (category_key, label, sort_order) VALUES (?, ?, ?)",
                (category_key, resolved_label, int(next_sort)),
            )
            category_id = cursor.lastrowid

        existing = conn.execute("SELECT id FROM products WHERE code = ?", (code,)).fetchone()
        if existing:
            conn.execute(
                """
                UPDATE products
                SET category_id = ?, name = ?, description = ?, price = ?, discount_pct = ?, image = ?,
                    active = ?, is_custom = ?, updated_at = ?
                WHERE code = ?
                """,
                (
                    category_id,
                    name,
                    description,
                    price,
                    discount_pct,
                    image,
                    int(active),
                    int(is_custom),
                    iso_now(),
                    code,
                ),
            )
        else:
            if not allow_insert:
                conn.close()
                return {"ok": False, "error": "Producto no existe."}
            conn.execute(
                """
                INSERT INTO products (
                    category_id, code, name, description, price, discount_pct, image, active, is_custom, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    category_id,
                    code,
                    name,
                    description,
                    price,
                    discount_pct,
                    image,
                    int(active),
                    int(is_custom),
                    iso_now(),
                    iso_now(),
                ),
            )
        conn.commit()
        conn.close()
    return {"ok": True}


def update_product_code(current_code, next_code):
    with DB_LOCK:
        conn = get_conn()
        conn.execute(
            "UPDATE products SET code = ?, updated_at = ? WHERE code = ?",
            (next_code, iso_now(), current_code),
        )
        conn.commit()
        conn.close()


def delete_product(code):
    with DB_LOCK:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("DELETE FROM products WHERE code = ?", (code,))
        deleted = cur.rowcount
        conn.commit()
        conn.close()
    if not deleted:
        return {"ok": False, "error": "Producto no encontrado."}
    return {"ok": True}


def list_proformas_by_user(user_id):
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT
          id, serial, issued_at, customer_name, customer_email, customer_ruc,
          customer_department, customer_district, customer_address, customer_phone,
          total_items, total_amount, items_json, created_at
        FROM proformas
        WHERE user_id = ?
        ORDER BY created_at DESC, id DESC
        """,
        (int(user_id),),
    ).fetchall()
    conn.close()

    records = []
    for row in rows:
        try:
            items = json.loads(row["items_json"] or "[]")
            if not isinstance(items, list):
                items = []
        except (TypeError, json.JSONDecodeError):
            items = []

        records.append(
            {
                "id": _text(row["id"]),
                "serial": _text(row["serial"]),
                "issuedAt": _text(row["issued_at"]),
                "customerName": _text(row["customer_name"]),
                "customerEmail": _text(row["customer_email"]),
                "customerRuc": _text(row["customer_ruc"]),
                "customerDepartment": _text(row["customer_department"]),
                "customerDistrict": _text(row["customer_district"]),
                "customerAddress": _text(row["customer_address"]),
                "customerPhone": _text(row["customer_phone"]),
                "totalItems": _clean_int(row["total_items"], default=0, minimum=0),
                "totalAmount": _clean_float(row["total_amount"], default=0.0, minimum=0),
                "items": items,
                "createdAt": _text(row["created_at"]),
            }
        )
    return records


def create_proforma_for_user(user_id, record):
    if not isinstance(record, dict):
        return {"ok": False, "error": "Registro de proforma invalido."}

    record_id = str(record.get("id") or "").strip()
    if not record_id:
        return {"ok": False, "error": "ID de proforma invalido."}

    with DB_LOCK:
        conn = get_conn()
        existing = conn.execute(
            "SELECT user_id FROM proformas WHERE id = ?",
            (record_id,),
        ).fetchone()

        if existing:
            existing_user_id = int(existing["user_id"])
            if existing_user_id != int(user_id):
                conn.close()
                return {"ok": False, "error": "El ID de proforma ya existe para otro usuario."}

            row = conn.execute(
                """
                SELECT
                  id, serial, issued_at, customer_name, customer_email, customer_ruc,
                  customer_department, customer_district, customer_address, customer_phone,
                  total_items, total_amount, items_json, created_at
                FROM proformas
                WHERE id = ? AND user_id = ?
                """,
                (record_id, int(user_id)),
            ).fetchone()
            conn.close()
            if not row:
                return {"ok": False, "error": "No se pudo recuperar la proforma existente."}
            try:
                items = json.loads(row["items_json"] or "[]")
                if not isinstance(items, list):
                    items = []
            except (TypeError, json.JSONDecodeError):
                items = []
            return {
                "ok": True,
                "created": False,
                "record": {
                    "id": row["id"],
                    "serial": row["serial"],
                    "issuedAt": row["issued_at"],
                    "customerName": row["customer_name"],
                    "customerEmail": row["customer_email"],
                    "customerRuc": row["customer_ruc"],
                    "customerDepartment": row["customer_department"],
                    "customerDistrict": row["customer_district"],
                    "customerAddress": row["customer_address"],
                    "customerPhone": row["customer_phone"],
                    "totalItems": int(row["total_items"] or 0),
                    "totalAmount": round(float(row["total_amount"] or 0), 2),
                    "items": items,
                    "createdAt": row["created_at"],
                },
            }

        created_at = iso_now()
        conn.execute(
            """
            INSERT INTO proformas (
              id, user_id, serial, issued_at, customer_name, customer_email,
              customer_ruc, customer_department, customer_district, customer_address,
              customer_phone, total_items, total_amount, items_json, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                record_id,
                int(user_id),
                str(record.get("serial") or "").strip(),
                str(record.get("issuedAt") or "").strip(),
                str(record.get("customerName") or "").strip(),
                str(record.get("customerEmail") or "").strip().lower(),
                str(record.get("customerRuc") or "").strip(),
                str(record.get("customerDepartment") or "").strip(),
                str(record.get("customerDistrict") or "").strip(),
                str(record.get("customerAddress") or "").strip(),
                str(record.get("customerPhone") or "").strip(),
                int(record.get("totalItems") or 0),
                float(record.get("totalAmount") or 0),
                json.dumps(record.get("items") or [], ensure_ascii=False),
                created_at,
            ),
        )
        conn.commit()
        conn.close()

    saved_record = dict(record)
    saved_record["createdAt"] = created_at
    return {"ok": True, "created": True, "record": saved_record}


def delete_proforma_for_user(user_id, record_id):
    safe_id = str(record_id or "").strip()
    if not safe_id:
        return {"ok": False, "error": "ID de proforma invalido."}

    with DB_LOCK:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM proformas WHERE id = ? AND user_id = ?",
            (safe_id, int(user_id)),
        )
        deleted = cur.rowcount
        conn.commit()
        conn.close()

    if not deleted:
        return {"ok": False, "error": "Proforma no encontrada."}
    return {"ok": True}
