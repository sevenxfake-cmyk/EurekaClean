import os


def _env_text(name, default=""):
    return str(os.environ.get(name) or default).strip()


def _env_flag(name, default=True):
    raw = os.environ.get(name)
    if raw is None:
        return bool(default)
    return str(raw).strip().lower() in {"1", "true", "yes", "on"}


def get_seed_catalog():
    # El catalogo inicia vacio y se administra desde el editor.
    return {}


def get_default_users():
    if not _env_flag("APP_SEED_USERS", default=False):
        return []

    users = []

    admin_name = _env_text("APP_SEED_ADMIN_NAME", "Administrador")
    admin_email = _env_text("APP_SEED_ADMIN_EMAIL", "").lower()
    admin_password = _env_text("APP_SEED_ADMIN_PASSWORD", "")
    if admin_email and admin_password:
        users.append({"name": admin_name, "email": admin_email, "password": admin_password, "role": "admin"})

    demo_name = _env_text("APP_SEED_DEMO_NAME", "Cliente Demo")
    demo_email = _env_text("APP_SEED_DEMO_EMAIL", "").lower()
    demo_password = _env_text("APP_SEED_DEMO_PASSWORD", "")
    if demo_email and demo_password:
        users.append({"name": demo_name, "email": demo_email, "password": demo_password, "role": "user"})

    return users
