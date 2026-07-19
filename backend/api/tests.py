from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from catalog.models import EggType, Price

User = get_user_model()


class ApiFlowTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin", password="admin123", full_name="Алишер", role=User.Role.ADMIN
        )
        egg = EggType.objects.create(id="c0", name_ru="C0", name_uz="C0")
        Price.objects.create(egg_type=egg, price_per_tray=Decimal("45000"))

    def _auth(self):
        r = self.client.post("/api/auth/login/", {"login": "admin", "password": "admin123"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION="Token " + r.data["token"])
        return r.data

    def test_login_returns_token_and_profile(self):
        data = self._auth()
        self.assertEqual(data["user"]["role"], "admin")
        self.assertEqual(data["user"]["name"], "Алишер")

    def test_login_rejects_bad_password(self):
        r = self.client.post("/api/auth/login/", {"login": "admin", "password": "nope"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_shop_sale_updates_derived_debt(self):
        self._auth()
        # создать магазин с начальным долгом
        r = self.client.post("/api/shops/", {"id": "shop-1", "name": "Оазис", "openingDebt": 100000}, format="json")
        self.assertEqual(r.status_code, 200)

        # продажа: итого 540000, получено 200000 → в долг 340000
        payload = {
            "type": "sale", "shopId": "shop-1", "total": 540000, "received": 200000,
            "paymentType": "cash",
            "items": [{"eggType": "c0", "qtyType": "boxes", "qty": 1, "trays": 12,
                       "pricePerTray": 45000, "lineTotal": 540000}],
        }
        r = self.client.post("/api/operations/", payload, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["debtDelta"], 340000)

        shops = self.client.get("/api/shops/").data
        shop = next(s for s in shops if s["id"] == "shop-1")
        self.assertEqual(shop["debt"], 440000)

        # аудит-запись без shopId не должна влиять на долг
        self.client.post("/api/operations/", {"type": "payment", "amount": 999, "message": "нов. магазин"}, format="json")
        shops = self.client.get("/api/shops/").data
        shop = next(s for s in shops if s["id"] == "shop-1")
        self.assertEqual(shop["debt"], 440000)

    def test_requires_auth(self):
        r = self.client.get("/api/shops/")
        self.assertIn(r.status_code, (401, 403))
