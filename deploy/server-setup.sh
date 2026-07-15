#!/usr/bin/env bash
# Развёртывание Tuxumchick на чистом Ubuntu-сервере (Docker Compose).
# Запуск на сервере от root:
#   bash server-setup.sh [ветка]
# По умолчанию ветка — main. Перед запуском положите файл .env в /opt/tuxumchick
# (см. deploy/.env.production.example и инструкцию).
set -euo pipefail

APP_DIR="/opt/tuxumchick"
REPO="https://github.com/normurodovwork/tuxumchick.git"
BRANCH="${1:-main}"

echo "==> 1/4 Установка Docker (если нужно)"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

echo "==> 2/4 Получение кода (ветка: $BRANCH)"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch --all --prune
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" pull --ff-only origin "$BRANCH"
else
  git clone --branch "$BRANCH" "$REPO" "$APP_DIR"
fi
cd "$APP_DIR"

echo "==> 3/4 Проверка .env"
if [ ! -f "$APP_DIR/.env" ]; then
  echo "ОШИБКА: нет $APP_DIR/.env"
  echo "Создайте его (пример: deploy/.env.production.example) и запустите скрипт снова."
  exit 1
fi

echo "==> 4/4 Сборка и запуск контейнеров"
docker compose up -d --build

echo ""
echo "Готово. Проверьте статус:  docker compose ps"
echo "Фронтенд:        http://176.101.56.77:3000"
echo "API / админка:   http://176.101.56.77:8000/api  ·  http://176.101.56.77:8000/admin/"
echo ""
echo "Создайте администратора:"
echo "  docker compose exec backend python manage.py createsuperuser"
