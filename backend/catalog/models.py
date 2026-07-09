from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone


class AppSettings(models.Model):
    """Системные настройки-синглтон (ТЗ п.8)."""

    trays_per_box = models.PositiveIntegerField("Лотков в коробке", default=12)
    eggs_per_tray = models.PositiveIntegerField("Яиц в лотке", default=30)
    old_debt_threshold_days = models.PositiveIntegerField("Порог «старого» долга (дней)", default=14)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "app_settings"
        verbose_name = "Настройки системы"
        verbose_name_plural = "Настройки системы"

    def __str__(self) -> str:
        return "Системные настройки"

    def save(self, *args, **kwargs):
        self.pk = 1  # синглтон
        super().save(*args, **kwargs)

    @classmethod
    def load(cls) -> "AppSettings":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class EggType(models.Model):
    """Вид яиц — справочник ведёт админ (ТЗ п.4.2, п.8)."""

    class Status(models.TextChoices):
        ACTIVE = "active", "Активен"
        ARCHIVED = "archived", "Архив"

    name_ru = models.CharField("Название (рус)", max_length=100)
    name_uz = models.CharField("Название (узб)", max_length=100)
    status = models.CharField("Статус", max_length=16, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "egg_types"
        verbose_name = "Вид яиц"
        verbose_name_plural = "Виды яиц"
        ordering = ["name_ru"]

    def __str__(self) -> str:
        return self.name_ru

    @property
    def current_price_per_tray(self):
        """Актуальная цена за лоток (последняя запись истории цен)."""
        price = self.prices.order_by("-start_date", "-created_at").first()
        return price.price_per_tray if price else None

    def price_per_box(self, trays_per_box=None):
        """Цена за коробку = лотков в коробке × цена лотка (ТЗ п.4.2)."""
        per_tray = self.current_price_per_tray
        if per_tray is None:
            return None
        if trays_per_box is None:
            trays_per_box = AppSettings.load().trays_per_box
        return per_tray * trays_per_box


class Price(models.Model):
    """История цен: в каждой продаже фиксируется цена на момент продажи (ТЗ п.4.2/5.4)."""

    egg_type = models.ForeignKey(EggType, on_delete=models.CASCADE, related_name="prices", verbose_name="Вид яиц")
    price_per_tray = models.DecimalField("Цена за лоток", max_digits=14, decimal_places=2)
    start_date = models.DateField("Действует с", default=timezone.localdate)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="price_changes", verbose_name="Установил",
    )

    class Meta:
        db_table = "prices"
        verbose_name = "Цена"
        verbose_name_plural = "История цен"
        ordering = ["-start_date", "-created_at"]

    def __str__(self) -> str:
        return f"{self.egg_type.name_ru}: {self.price_per_tray} сум/лоток ({self.start_date})"


class Shop(models.Model):
    """
    Карточка магазина/клиента (ТЗ п.4.3, п.8).

    Текущий долг НЕ хранится как редактируемое поле, а вычисляется из операций
    (ТЗ п.5.1). Хранится только opening_debt — начальный/перенесённый баланс.
    """

    name = models.CharField("Название фирмы/магазина", max_length=200)
    contact = models.CharField("Контактное лицо", max_length=150, blank=True)
    phone = models.CharField("Телефон", max_length=32, blank=True)
    address = models.CharField("Адрес / ориентир", max_length=300, blank=True)
    note = models.TextField("Заметка", blank=True)
    is_archived = models.BooleanField("В архиве", default=False)

    opening_debt = models.DecimalField("Начальный долг", max_digits=14, decimal_places=2, default=Decimal("0"))

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="created_shops", verbose_name="Создал",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "shops"
        verbose_name = "Магазин (клиент)"
        verbose_name_plural = "Магазины (клиенты)"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name

    @property
    def current_debt(self) -> Decimal:
        """
        Долг = opening_debt
             + Σ(продажа.итого − продажа.получено)
             − Σ(приём оплаты)
             + Σ(корректировки ±)     (ТЗ п.5.1)
        Отрицательное значение = переплата/аванс (ТЗ п.5.2).
        """
        debt = self.opening_debt or Decimal("0")
        for sale in self.sales.filter(is_cancelled=False):
            debt += (sale.total - sale.received)
        for payment in self.payments.filter(is_cancelled=False):
            debt -= payment.amount
        for adj in self.adjustments.filter(is_cancelled=False):
            debt += adj.amount
        return debt

    @property
    def has_advance(self) -> bool:
        return self.current_debt < 0
