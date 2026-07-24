"""
Регрессионные тесты бизнес-правил денежного контура.

Закрывают две дыры, найденные при аудите:
  1) перепривязка операции к другому магазину не работала — «объединение
     дубликатов» теряло долг по операциям на архивной точке;
  2) сервер принимал присланные клиентом суммы продажи как есть — доставщик
     мог отправить отрицательный или заниженный итог и списать долг.
"""
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from catalog.models import EggType, Price, Shop

User = get_user_model()


class BusinessRuleTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin", password="admin123", full_name="Админ", role=User.Role.ADMIN
        )
        self.deliverer = User.objects.create_user(
            username="jasur", password="jasur123", full_name="Жасур", role=User.Role.DELIVERER
        )
        egg = EggType.objects.create(id="c0", name_ru="C0", name_uz="C0")
        Price.objects.create(egg_type=egg, price_per_tray=Decimal("45000"))
        self.src = Shop.objects.create(id="src", name="Дубликат", opening_debt=Decimal("100000"))
        self.dst = Shop.objects.create(id="dst", name="Основной", opening_debt=Decimal("0"))

    def _auth(self, login="admin", password="admin123"):
        r = self.client.post("/api/auth/login/", {"login": login, "password": password}, format="json")
        self.assertEqual(r.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION="Token " + r.data["token"])
        return r.data

    def _debt(self, shop_id):
        return next(s["debt"] for s in self.client.get("/api/shops/").data if s["id"] == shop_id)

    # 10 лотков × 45 000 = 450 000
    def _sale_payload(self, shop_id="dst", **over):
        payload = {
            "type": "sale", "shopId": shop_id, "total": 450000, "received": 0, "paymentType": "cash",
            "items": [{"eggType": "c0", "qtyType": "trays", "qty": 10, "trays": 10,
                       "pricePerTray": 45000, "lineTotal": 450000}],
        }
        payload.update(over)
        return payload

    def _sale(self, shop_id="dst", **over):
        r = self.client.post("/api/operations/", self._sale_payload(shop_id, **over), format="json")
        self.assertEqual(r.status_code, 201, r.data)
        return r.data

    # ---------------- 1. Перенос операции между магазинами -----------------

    def test_admin_can_move_operation_to_another_shop(self):
        self._auth("jasur", "jasur123")
        op_id = self._sale("src")["id"]
        self.assertEqual(self._debt("src"), 550000)  # 100 000 начальный + 450 000

        self._auth()
        upd = self.client.patch(f"/api/operations/{op_id}/", {"shopId": "dst"}, format="json")
        self.assertEqual(upd.status_code, 200, upd.data)
        self.assertEqual(upd.data["shopId"], "dst")
        self.assertEqual(self._debt("src"), 100000)  # остался только начальный долг
        self.assertEqual(self._debt("dst"), 450000)

    def test_deliverer_cannot_move_operation_to_another_shop(self):
        """Иначе доставщик перебрасывал бы чужой долг между точками."""
        self._auth("jasur", "jasur123")
        op_id = self._sale("src")["id"]
        r = self.client.patch(f"/api/operations/{op_id}/", {"shopId": "dst"}, format="json")
        self.assertEqual(r.status_code, 403)
        self.assertEqual(self._debt("src"), 550000)
        self.assertEqual(self._debt("dst"), 0)

    def test_move_to_unknown_shop_rejected(self):
        self._auth("jasur", "jasur123")
        op_id = self._sale("src")["id"]
        self._auth()
        r = self.client.patch(f"/api/operations/{op_id}/", {"shopId": "нет-такого"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self._debt("src"), 550000)

    def test_full_merge_flow_keeps_total_debt(self):
        """Полный сценарий «объединения дубликатов» из AdminDashboard:
        суммарный долг сохраняется и целиком переезжает на целевую точку."""
        self._auth("jasur", "jasur123")
        op_id = self._sale("src")["id"]
        before = self._debt("src") + self._debt("dst")

        self._auth()
        self.client.post("/api/shops/", {"id": "dst", "name": "Основной", "openingDebt": 100000}, format="json")
        self.client.post("/api/shops/", {"id": "src", "name": "Дубликат (объединен)",
                                         "openingDebt": 0, "isArchived": True}, format="json")
        self.client.patch(f"/api/operations/{op_id}/", {"shopId": "dst"}, format="json")

        self.assertEqual(self._debt("src"), 0)
        self.assertEqual(self._debt("dst"), 550000)
        self.assertEqual(self._debt("src") + self._debt("dst"), before)

    # ---------------- 2. Проверка сумм продажи на сервере ------------------

    def test_negative_sale_total_rejected(self):
        self._auth("jasur", "jasur123")
        r = self.client.post("/api/operations/", self._sale_payload("src", total=-100000), format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self._debt("src"), 100000)  # долг не тронут

    def test_negative_received_rejected(self):
        self._auth("jasur", "jasur123")
        r = self.client.post("/api/operations/", self._sale_payload("src", received=-50000), format="json")
        self.assertEqual(r.status_code, 400)

    def test_understated_price_rejected(self):
        """Цену диктует каталог, а не клиент."""
        self._auth("jasur", "jasur123")
        r = self.client.post("/api/operations/", self._sale_payload(
            "dst", total=10,
            items=[{"eggType": "c0", "qtyType": "trays", "qty": 10, "trays": 10,
                    "pricePerTray": 1, "lineTotal": 10}],
        ), format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self._debt("dst"), 0)

    def test_total_must_match_items(self):
        self._auth("jasur", "jasur123")
        r = self.client.post("/api/operations/", self._sale_payload("dst", total=1), format="json")
        self.assertEqual(r.status_code, 400)

    def test_trays_must_match_quantity_and_settings(self):
        """1 коробка = 12 лотков по настройкам; 100 лотков в позиции — подлог."""
        self._auth("jasur", "jasur123")
        r = self.client.post("/api/operations/", self._sale_payload(
            "dst", total=4500000,
            items=[{"eggType": "c0", "qtyType": "boxes", "qty": 1, "trays": 100,
                    "pricePerTray": 45000, "lineTotal": 4500000}],
        ), format="json")
        self.assertEqual(r.status_code, 400)

    def test_sale_without_items_rejected(self):
        self._auth("jasur", "jasur123")
        r = self.client.post("/api/operations/", self._sale_payload("src", items=[]), format="json")
        self.assertEqual(r.status_code, 400)

    def test_unknown_egg_type_rejected(self):
        self._auth("jasur", "jasur123")
        r = self.client.post("/api/operations/", self._sale_payload(
            "dst", items=[{"eggType": "нет-такого", "qtyType": "trays", "qty": 10, "trays": 10,
                           "pricePerTray": 45000, "lineTotal": 450000}],
        ), format="json")
        self.assertEqual(r.status_code, 400)

    def test_valid_sale_still_passes_and_uses_catalog_price(self):
        """Честная продажа проходит, суммы считает сервер по каталогу."""
        self._auth("jasur", "jasur123")
        data = self._sale("dst", received=200000)
        self.assertEqual(data["total"], 450000)
        self.assertEqual(data["received"], 200000)
        self.assertEqual(data["debtDelta"], 250000)
        self.assertEqual(data["items"][0]["pricePerTray"], 45000)
        self.assertEqual(self._debt("dst"), 250000)

    def test_sale_in_boxes_passes(self):
        """1 коробка = 12 лотков × 45 000 = 540 000."""
        self._auth("jasur", "jasur123")
        data = self._sale("dst", total=540000,
                          items=[{"eggType": "c0", "qtyType": "boxes", "qty": 1, "trays": 12,
                                  "pricePerTray": 45000, "lineTotal": 540000}])
        self.assertEqual(data["total"], 540000)
        self.assertEqual(self._debt("dst"), 540000)

    def test_advance_payment_still_allowed(self):
        """Переплата (аванс) — легальный сценарий (ТЗ п.5.2), не должна блокироваться."""
        self._auth("jasur", "jasur123")
        self._sale("dst", received=500000)
        self.assertEqual(self._debt("dst"), -50000)

    def test_negative_total_on_edit_rejected(self):
        self._auth("jasur", "jasur123")
        op_id = self._sale("dst")["id"]
        self._auth()
        r = self.client.patch(f"/api/operations/{op_id}/", {"total": -1}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self._debt("dst"), 450000)
