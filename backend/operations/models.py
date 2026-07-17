from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone

from catalog.models import EggType, Shop


class PaymentMethod(models.TextChoices):
    CASH = "cash", "Наличные"
    CARD = "card", "Клик / Карта"
    TRANSFER = "transfer", "Перечисление"


class CancellableQuerySet(models.QuerySet):
    def active(self):
        return self.filter(is_cancelled=False)


class Sale(models.Model):
    """
    Операция «Продажа» (ТЗ п.4.4).

    Может содержать несколько товарных позиций (SaleItem). Фиксируется
    фактическое время создания (created_at) и дата продажи (operation_date,
    может быть указана вручную — ТЗ п.5.6). Оплата может быть частичной:
    в долг идёт (total − received); если received > total — образуется аванс.
    Операции не удаляются физически — только аннулирование (ТЗ п.5.3).
    """

    shop = models.ForeignKey(Shop, on_delete=models.PROTECT, related_name="sales", verbose_name="Магазин")
    deliverer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="sales", verbose_name="Доставщик",
    )

    operation_date = models.DateTimeField("Дата продажи", default=timezone.now)
    total = models.DecimalField("Итого к оплате", max_digits=14, decimal_places=2, default=Decimal("0"))
    received = models.DecimalField("Получено денег", max_digits=14, decimal_places=2, default=Decimal("0"))
    payment_method = models.CharField(
        "Способ оплаты", max_length=8, choices=PaymentMethod.choices, default=PaymentMethod.CASH,
    )
    comment = models.CharField("Комментарий", max_length=300, blank=True)
    # Человекочитаемое описание (локализованное на фронтенде), для ленты операций.
    message = models.TextField("Описание", blank=True)
    is_edited = models.BooleanField("Изменена", default=False)

    is_cancelled = models.BooleanField("Аннулирована", default=False)
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="cancelled_sales", verbose_name="Аннулировал",
    )
    cancelled_at = models.DateTimeField("Дата аннулирования", null=True, blank=True)
    cancel_reason = models.CharField("Причина аннулирования", max_length=300, blank=True)

    created_at = models.DateTimeField("Создана", auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = CancellableQuerySet.as_manager()

    class Meta:
        db_table = "sales"
        verbose_name = "Продажа"
        verbose_name_plural = "Продажи"
        ordering = ["-operation_date"]

    def __str__(self) -> str:
        return f"Продажа #{self.pk} — {self.shop.name} ({self.total} сум)"

    @property
    def debt_delta(self) -> Decimal:
        """Вклад в долг магазина: положительный — в долг, отрицательный — аванс."""
        return self.total - self.received

    def recompute_total(self) -> Decimal:
        """Итого = сумма всех строк."""
        total = sum((item.line_total for item in self.items.all()), Decimal("0"))
        return total


class SaleItem(models.Model):
    """Строка продажи с фиксацией цены на момент продажи (ТЗ п.4.4/5.4)."""

    class Unit(models.TextChoices):
        TRAY = "tray", "Лоток"
        BOX = "box", "Коробка"

    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name="items", verbose_name="Продажа")
    egg_type = models.ForeignKey(EggType, on_delete=models.PROTECT, related_name="sale_items", verbose_name="Вид яиц")
    unit = models.CharField("Единица", max_length=8, choices=Unit.choices, default=Unit.BOX)
    quantity = models.DecimalField("Количество", max_digits=12, decimal_places=2)
    price_per_tray = models.DecimalField("Цена за лоток (снимок)", max_digits=14, decimal_places=2)
    trays = models.DecimalField("Лотков всего", max_digits=12, decimal_places=2)
    line_total = models.DecimalField("Сумма строки", max_digits=14, decimal_places=2)

    class Meta:
        db_table = "sale_items"
        verbose_name = "Позиция продажи"
        verbose_name_plural = "Позиции продажи"

    def __str__(self) -> str:
        return f"{self.quantity} {self.get_unit_display()} {self.egg_type.name_ru}"


class Payment(models.Model):
    """
    Операция «Приём оплаты» — погашение долга без поставки товара (ТЗ п.4.5).
    Оплата может быть частичной; переплата учитывается как аванс.
    """

    shop = models.ForeignKey(Shop, on_delete=models.PROTECT, related_name="payments", verbose_name="Магазин")
    operator = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="payments", verbose_name="Оператор",
    )

    operation_date = models.DateTimeField("Дата оплаты", default=timezone.now)
    amount = models.DecimalField("Сумма оплаты", max_digits=14, decimal_places=2)
    payment_method = models.CharField(
        "Способ оплаты", max_length=8, choices=PaymentMethod.choices, default=PaymentMethod.CASH,
    )
    comment = models.CharField("Комментарий", max_length=300, blank=True)
    message = models.TextField("Описание", blank=True)
    is_edited = models.BooleanField("Изменена", default=False)

    is_cancelled = models.BooleanField("Аннулирована", default=False)
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="cancelled_payments", verbose_name="Аннулировал",
    )
    cancelled_at = models.DateTimeField("Дата аннулирования", null=True, blank=True)

    created_at = models.DateTimeField("Создана", auto_now_add=True)

    objects = CancellableQuerySet.as_manager()

    class Meta:
        db_table = "payments"
        verbose_name = "Приём оплаты"
        verbose_name_plural = "Приёмы оплаты"
        ordering = ["-operation_date"]

    def __str__(self) -> str:
        return f"Оплата #{self.pk} — {self.shop.name} ({self.amount} сум)"


class Return(models.Model):
    """
    Возврат-возмещение: доставщик возмещает бой/брак той же категорией яиц,
    строго ПО ШТУКАМ (не пачками). Это НЕ возврат денег — доставщик отдаёт
    другие яйца той же категории, поэтому долг магазина НЕ меняется.
    Учитывается для контроля (админ видит: кто, магазин, категория, сколько штук).
    """

    shop = models.ForeignKey(Shop, on_delete=models.PROTECT, related_name="returns", verbose_name="Магазин")
    deliverer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="returns", verbose_name="Доставщик",
    )
    egg_type = models.ForeignKey(EggType, on_delete=models.PROTECT, related_name="returns", verbose_name="Вид яиц")
    quantity = models.PositiveIntegerField("Количество (штук)")

    operation_date = models.DateTimeField("Дата возврата", default=timezone.now)
    comment = models.CharField("Комментарий", max_length=300, blank=True)
    message = models.TextField("Описание", blank=True)
    is_edited = models.BooleanField("Изменена", default=False)

    is_cancelled = models.BooleanField("Аннулирована", default=False)
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="cancelled_returns", verbose_name="Аннулировал",
    )
    cancelled_at = models.DateTimeField("Дата аннулирования", null=True, blank=True)

    created_at = models.DateTimeField("Создана", auto_now_add=True)

    objects = CancellableQuerySet.as_manager()

    class Meta:
        db_table = "returns"
        verbose_name = "Возврат (возмещение)"
        verbose_name_plural = "Возвраты (возмещения)"
        ordering = ["-operation_date"]

    def __str__(self) -> str:
        return f"Возврат #{self.pk} — {self.shop.name} ({self.quantity} шт {self.egg_type.name_ru})"


class Adjustment(models.Model):
    """Корректировка долга (только админ): сумма ± и причина (ТЗ п.3.2/5.1)."""

    shop = models.ForeignKey(Shop, on_delete=models.PROTECT, related_name="adjustments", verbose_name="Магазин")
    operator = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="adjustments", verbose_name="Администратор",
    )
    amount = models.DecimalField("Сумма (±)", max_digits=14, decimal_places=2, help_text="Плюс увеличивает долг, минус — уменьшает")
    reason = models.CharField("Причина", max_length=300)
    message = models.TextField("Описание", blank=True)

    is_cancelled = models.BooleanField("Аннулирована", default=False)
    created_at = models.DateTimeField("Создана", auto_now_add=True)

    objects = CancellableQuerySet.as_manager()

    class Meta:
        db_table = "adjustments"
        verbose_name = "Корректировка долга"
        verbose_name_plural = "Корректировки долга"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        sign = "+" if self.amount >= 0 else ""
        return f"Корректировка #{self.pk} — {self.shop.name} ({sign}{self.amount} сум)"


class ActivityLog(models.Model):
    """
    Журнал действий (ТЗ п.4.10): кто, что и когда создал/изменил/аннулировал,
    какие поля поменялись. Доступен админу, не редактируется.
    """

    class Action(models.TextChoices):
        CREATE = "create", "Создание"
        UPDATE = "update", "Изменение"
        CANCEL = "cancel", "Аннулирование"
        LOGIN = "login", "Вход"
        OTHER = "other", "Прочее"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="activity_logs", verbose_name="Пользователь",
    )
    shop = models.ForeignKey(
        Shop, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="activity_logs", verbose_name="Магазин",
    )
    operator_label = models.CharField("Оператор (текст)", max_length=150, blank=True)
    action = models.CharField("Действие", max_length=16, choices=Action.choices, default=Action.OTHER)
    object_type = models.CharField("Объект", max_length=64, blank=True)
    object_id = models.CharField("ID объекта", max_length=64, blank=True)
    message = models.TextField("Описание", blank=True)
    changes = models.JSONField("Изменённые поля", default=dict, blank=True)
    created_at = models.DateTimeField("Когда", auto_now_add=True)

    class Meta:
        db_table = "activity_logs"
        verbose_name = "Запись журнала"
        verbose_name_plural = "Журнал действий"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        who = self.user.username if self.user else "system"
        return f"[{self.created_at:%Y-%m-%d %H:%M}] {who}: {self.get_action_display()} {self.object_type}"
