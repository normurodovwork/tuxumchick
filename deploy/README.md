# Деплой Tuxumchick на сервер (Docker Compose)

Одна команда поднимает PostgreSQL + backend (Django/gunicorn) + frontend (Next.js).
Сервер: `176.101.56.77`. Пока HTTP без домена/TLS (TLS можно добавить позже).

## Предпосылки
- Чистый Ubuntu-сервер, доступ по SSH (root).
- Код запушен на GitHub (`github.com/normurodovwork/tuxumchick`) в ветку, которую деплоим.

## Шаги

### 1. (локально) Запушить код
```bash
git checkout main
git merge claude/tech-spec-review-s6z2dj   # или деплойте саму ветку
git push origin main
```

### 2. (на сервере) Подключиться и скачать скрипт
```bash
ssh root@176.101.56.77
mkdir -p /opt/tuxumchick && cd /opt
# если репозиторий приватный — сначала настройте доступ (deploy key / token)
```

### 3. (на сервере) Создать `.env`
Скопируйте `deploy/.env.production.example` в `/opt/tuxumchick/.env` и подставьте
реальные секреты (сгенерированный `DJANGO_SECRET_KEY`, пароль БД). Значения хостов/CORS
уже настроены под `176.101.56.77`.

### 4. (на сервере) Запустить деплой
```bash
# ветка по умолчанию main; можно передать другую: bash server-setup.sh <branch>
curl -fsSL https://raw.githubusercontent.com/normurodovwork/tuxumchick/main/deploy/server-setup.sh -o server-setup.sh
bash server-setup.sh main
```
Скрипт установит Docker, склонирует код в `/opt/tuxumchick`, соберёт и запустит контейнеры.

### 5. (на сервере) Создать администратора
```bash
cd /opt/tuxumchick
docker compose exec backend python manage.py createsuperuser
```

## Проверка
- Фронтенд: http://176.101.56.77:3000
- API: http://176.101.56.77:8000/api · Админка: http://176.101.56.77:8000/admin/
- Статус: `docker compose ps` · Логи: `docker compose logs -f backend`

## Firewall (если включён ufw)
```bash
ufw allow 22 && ufw allow 3000 && ufw allow 8000
```

## Обновление версии
```bash
cd /opt/tuxumchick && git pull && docker compose up -d --build
```

## Дальше (рекомендуется)
- Сменить root-пароль сервера и перейти на вход по SSH-ключу, отключить парольный вход.
- Поставить домен + Nginx/Caddy с Let's Encrypt перед контейнерами, затем `DJANGO_SECURE_SSL=True`
  и `NEXT_PUBLIC_API_URL=https://<домен>/api` (потребуется пересборка фронта).
