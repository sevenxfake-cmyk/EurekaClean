from db import get_default_users, init_db, reset_default_users


def main():
    init_db()
    defaults = get_default_users()
    if not defaults:
        print("[backend] no hay usuarios seed configurados en variables APP_SEED_*")
        print("[backend] define APP_SEED_USERS=1 junto con APP_SEED_ADMIN_EMAIL/PASSWORD y/o APP_SEED_DEMO_EMAIL/PASSWORD")
        return

    result = reset_default_users()
    print("[backend] usuarios seed re-sincronizados")
    print(f"[backend] usuarios creados: {result['created']}")
    print(f"[backend] usuarios actualizados: {result['updated']}")
    for user in defaults:
        print(f"[backend] {user['role']}: {user['email']}")


if __name__ == "__main__":
    main()
