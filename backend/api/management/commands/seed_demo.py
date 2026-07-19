from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from catalog.models import AppSettings, EggType, KVStore, Price, Shop

User = get_user_model()


class Command(BaseCommand):
    help = "Заполняет БД демо-данными (админ, доставщики, виды яиц, цены, магазины)."

    def handle(self, *args, **options):
        # Настройки
        AppSettings.load()

        # Админ
        admin, created = User.objects.get_or_create(
            username="admin",
            defaults={"full_name": "Алишер К.", "role": User.Role.ADMIN, "status": User.Status.ONLINE,
                      "is_staff": True, "is_superuser": True},
        )
        admin.set_password("admin123")
        admin.is_staff = True
        admin.is_superuser = True
        admin.save()

        # Доставщики
        deliverers = [
            ("jasur", "Жасур", "+998901234567", User.Status.ONLINE),
            ("shohruh", "Шохрух", "+998901234568", User.Status.ONLINE),
            ("bobur", "Бобур", "+998901234569", User.Status.OFFLINE),
            ("doston", "Достон", "+998901234570", User.Status.ONLINE),
            ("aziz", "Азиз", "+998901234571", User.Status.ONLINE),
            ("sarvar", "Сарвар", "+998901234572", User.Status.ONLINE),
        ]
        for username, name, phone, st in deliverers:
            u, _ = User.objects.get_or_create(
                username=username,
                defaults={"full_name": name, "phone": phone, "role": User.Role.DELIVERER, "status": st},
            )
            u.full_name = name
            u.phone = phone
            u.role = User.Role.DELIVERER
            u.status = st
            u.set_password("123")
            u.save()

        # Виды яиц + цены за лоток
        eggs = [
            ("c0", "Вид C0", "C0 turi", Decimal("45000")),
            ("c1", "Вид C1", "C1 turi", Decimal("39000")),
            ("domestic", "Домашние", "Uy tuxumlari", Decimal("54000")),
        ]
        for eid, ru, uz, price in eggs:
            e, _ = EggType.objects.get_or_create(id=eid, defaults={"name_ru": ru, "name_uz": uz})
            e.name_ru, e.name_uz, e.status = ru, uz, EggType.Status.ACTIVE
            e.save()
            if not e.prices.exists():
                Price.objects.create(egg_type=e, price_per_tray=price, created_by=admin)

        # Магазины (начальный долг = opening_debt)
        shops = [
            ("shop-1", 'Магазин "Оазис"', "Азизбек", "+998 90 123 45 67", Decimal("8450000")),
            ("shop-2", "Корзинка Центр", "Тимур", "+998 93 987 65 43", Decimal("3200000")),
            ("shop-3", "Havas Market №4", "Сардор", "+998 99 555 44 33", Decimal("1150000")),
            ("shop-4", "Мир Продуктов", "Елена", "+998 97 111 22 33", Decimal("5600000")),
            ("shop-5", 'Магазин "Березка"', "Жасур", "+998 91 222 33 44", Decimal("0")),
        ]
        for sid, name, contact, phone, debt in shops:
            Shop.objects.update_or_create(
                id=sid,
                defaults={"name": name, "contact": contact, "phone": phone, "opening_debt": debt, "created_by": admin},
            )

        # Склад (KV) и снимок цен для фронтенда
        KVStore.objects.update_or_create(key="inventory", defaults={"value": {"c0": 1240, "c1": 4800, "domestic": 650}})
        KVStore.objects.update_or_create(key="price_history", defaults={"value": [
            {"id": "price-1", "date": str(timezone.localdate()), "c0Price": 45000, "c1Price": 39000, "domesticPrice": 54000},
        ]})

        self.stdout.write(self.style.SUCCESS(
            "Демо-данные загружены. Админ: admin / admin123. Доставщики: jasur … / 123."
        ))
