from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase

from catalog.models import EggType, Price, Shop
from operations.models import Adjustment, Payment, Sale, SaleItem

User = get_user_model()


class DerivedDebtTests(TestCase):
    """Долг магазина вычисляется из операций (ТЗ п.5.1), аванс = отрицательный долг (п.5.2)."""

    def setUp(self):
        self.deliverer = User.objects.create_user(
            username="jasur", password="x", full_name="Жасур", role=User.Role.DELIVERER
        )
        self.egg = EggType.objects.create(id="c0", name_ru="C0", name_uz="C0")
        Price.objects.create(egg_type=self.egg, price_per_tray=Decimal("45000"))
        self.shop = Shop.objects.create(id="shop-1", name="Оазис", opening_debt=Decimal("100000"))

    def _sale(self, total, received):
        s = Sale.objects.create(shop=self.shop, deliverer=self.deliverer,
                                total=Decimal(total), received=Decimal(received))
        SaleItem.objects.create(sale=s, egg_type=self.egg, unit=SaleItem.Unit.BOX,
                                quantity=1, price_per_tray=Decimal("45000"),
                                trays=12, line_total=Decimal(total))
        return s

    def test_sale_payment_adjustment_and_cancel(self):
        self.assertEqual(self.shop.current_debt, Decimal("100000"))

        sale = self._sale("540000", "200000")  # в долг 340000
        self.assertEqual(self.shop.current_debt, Decimal("440000"))

        Payment.objects.create(shop=self.shop, operator=self.deliverer, amount=Decimal("300000"))
        self.assertEqual(self.shop.current_debt, Decimal("140000"))

        Adjustment.objects.create(shop=self.shop, operator=self.deliverer,
                                  amount=Decimal("-140000"), reason="сверка")
        self.assertEqual(self.shop.current_debt, Decimal("0"))

        # Аннулирование продажи убирает её вклад автоматически (без ручной правки).
        sale.is_cancelled = True
        sale.save()
        self.assertEqual(self.shop.current_debt, Decimal("-340000"))

    def test_overpayment_is_advance(self):
        Payment.objects.create(shop=self.shop, operator=self.deliverer, amount=Decimal("150000"))
        self.assertEqual(self.shop.current_debt, Decimal("-50000"))
        self.assertTrue(self.shop.has_advance)
