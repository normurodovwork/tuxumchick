# Backend — EggLogistics B2B (Django + PostgreSQL)

Бэкенд системы учёта оптовых продаж яиц (B2B). Реализует структуру данных
из ТЗ (раздел 8) и учётную логику долга из раздела 5.

## Стек
- Python 3.11+, Django 5, Django REST Framework
- PostgreSQL (psycopg 3)
- CORS для PWA-фронтенда (папка `../Frontend`)

## Структура
```
backend/
├── config/            # настройки проекта (settings, urls, wsgi/asgi)
├── accounts/          # кастомный User: роли доставщик/админ, статус, телефон
├── catalog/           # Shop, EggType, Price (история цен), AppSettings
├── operations/        # Sale + SaleItem, Payment, Adjustment, ActivityLog
├── manage.py
├── requirements.txt
└── .env.example
```

## Модели (соответствие ТЗ п.8)
| Сущность ТЗ | Модель |
|---|---|
| Пользователь | `accounts.User` (роль, статус, телефон, хеш пароля) |
| Магазин | `catalog.Shop` (+ вычисляемый `current_debt`) |
| Вид яиц | `catalog.EggType` |
| Цена (история) | `catalog.Price` |
| Настройки | `catalog.AppSettings` (синглтон) |
| Продажа | `operations.Sale` + `operations.SaleItem` |
| Приём оплаты | `operations.Payment` |
| Корректировка | `operations.Adjustment` |
| Журнал действий | `operations.ActivityLog` |

**Долг не хранится редактируемым полем** — `Shop.current_debt` вычисляется из
операций (ТЗ п.5.1); отрицательное значение = аванс/переплата (п.5.2).
В каждой строке продажи сохраняется цена на момент продажи (п.5.4).

## Запуск
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 1. Поднимите PostgreSQL и создайте БД:
#    createdb tuxumchick
# 2. Скопируйте настройки окружения:
cp .env.example .env      # при необходимости отредактируйте доступы к БД

python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

Админ-панель: http://localhost:8000/admin/ · Health-check: `/health/`

## Переменные окружения
См. `.env.example` — доступы к PostgreSQL, `DJANGO_SECRET_KEY`, CORS.
