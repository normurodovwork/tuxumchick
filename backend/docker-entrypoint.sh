#!/bin/sh
set -e

# Ждём готовности PostgreSQL.
echo "Ожидание базы данных ${POSTGRES_HOST:-db}:${POSTGRES_PORT:-5432}..."
python - <<'PY'
import os, time, socket
host = os.getenv("POSTGRES_HOST", "db")
port = int(os.getenv("POSTGRES_PORT", "5432"))
for _ in range(60):
    try:
        with socket.create_connection((host, port), timeout=2):
            break
    except OSError:
        time.sleep(1)
else:
    raise SystemExit("PostgreSQL недоступен")
print("База готова.")
PY

python manage.py migrate --noinput
python manage.py collectstatic --noinput

if [ "$SEED_DEMO" = "true" ]; then
  echo "Загрузка демо-данных..."
  python manage.py seed_demo
fi

exec "$@"
