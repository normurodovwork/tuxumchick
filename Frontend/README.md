# Tuxumchick — Frontend (PWA)

Клиент на **Next.js 15 / React 19 / Tailwind CSS 4**. PWA для учёта оптовых
продаж яиц: дашборд администратора и мобильный кабинет доставщика. Общается
с Django-бэкендом (`../backend`) по REST API.

## Требования
- Node.js 20+

## Локальный запуск
```bash
npm install
echo 'NEXT_PUBLIC_API_URL=http://localhost:8000/api' > .env.local
npm run dev            # http://localhost:3000
```
Бэкенд должен быть запущен и доступен по адресу из `NEXT_PUBLIC_API_URL`
(см. `../backend/README.md`).

## Сборка (production)
```bash
npm run build         # standalone-выход (Dockerfile использует /.next/standalone)
npm run start
```

## Переменные окружения
- `NEXT_PUBLIC_API_URL` — адрес REST API бэкенда, **инлайнится при сборке**
  (fetch выполняется в браузере), поэтому должен указывать на публичный адрес
  бэкенда. См. `.env.example`.

## Структура
- `app/` — App Router: `layout.tsx`, `page.tsx` (корневой роутер по роли), `globals.css`.
- `components/` — `LoginScreen`, `AdminDashboard`, `DelivererDashboard`.
- `lib/` — `db-service.ts` (клиент REST API), `translations.ts` (RU/UZ).
- `public/` — `manifest.json`, `sw.js` (service worker), иконка.
