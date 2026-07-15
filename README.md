# Tuxumchick — учёт оптовых продаж яиц (B2B)

Веб-приложение (PWA) для учёта оптовых продаж яиц: доставщики фиксируют
продажи и оплаты с телефона, у каждого магазина автоматически ведётся долг
и история, администратор видит сводку, должников и выгружает отчёты в Excel.

## Состав репозитория
```
tuxumchick/
├── Frontend/            # PWA на Next.js 15 (React 19, Tailwind)
├── backend/             # REST API на Django 5 + DRF + PostgreSQL
├── docker-compose.yml   # PostgreSQL + backend + frontend одной командой
└── .env.example         # переменные для docker-compose
```

Долг магазина **вычисляется из операций** (продажи, оплаты, корректировки),
а не хранится редактируемым полем (ТЗ п.5.1); переплата отражается как аванс.

## Быстрый старт через Docker
```bash
cp .env.example .env          # при необходимости поменяйте пароли/порты
docker compose up --build
```
- Фронтенд: http://localhost:3000
- API / админка Django: http://localhost:8000/api, http://localhost:8000/admin/
- Первый администратор (демо-данные по умолчанию отключены, `SEED_DEMO=false`):
  ```bash
  docker compose exec backend python manage.py createsuperuser
  ```
  Либо для наполнения тестовыми данными задайте `SEED_DEMO=true` в `.env`
  (создаст демо-аккаунты — только для разработки, не для продакшена).

Остановить: `docker compose down` (данные БД сохраняются в томе `pgdata`;
`docker compose down -v` — удалить и данные).

## Запуск без Docker
См. `backend/README.md` (Django + PostgreSQL) и `Frontend/README.md`.
Кратко:
```bash
# backend
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt && cp .env.example .env
createdb tuxumchick && python manage.py migrate && python manage.py seed_demo
python manage.py runserver

# frontend (другой терминал)
cd Frontend && npm install
echo 'NEXT_PUBLIC_API_URL=http://localhost:8000/api' > .env.local
npm run dev
```

## Переменные окружения (docker-compose)
Все — в `.env.example`: доступы к PostgreSQL, `DJANGO_SECRET_KEY`, `SEED_DEMO`,
CORS, порты на хосте и `NEXT_PUBLIC_API_URL` (адрес API для браузера,
инлайнится в сборку фронтенда).
