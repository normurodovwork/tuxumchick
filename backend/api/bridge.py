"""
Мост между нормализованными моделями Django и «плоским» форматом операций,
который использует фронтенд (единая лента activityLogs). Позволяет фронтенду
работать без изменения формы данных при переходе с Firestore на этот API.
"""
from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.exceptions import APIException, PermissionDenied

from catalog.models import AppSettings, EggType, Shop
from operations.models import ActivityLog, Adjustment, Expense, Payment, Return, Sale, SaleItem

# Доставщик может исправлять/аннулировать операцию только в течение суток (ТЗ п.5).
EDIT_WINDOW = timedelta(hours=24)

# Допуск при сверке денежных величин: числа приходят через JSON (float),
# поэтому точное равенство Decimal здесь неуместно.
MONEY_EPS = Decimal("0.01")


class BusinessRuleError(APIException):
    """Нарушено бизнес-правило. Отдаёт {"detail": "..."} со статусом 400 —
    фронтенд показывает detail пользователю (db-service.apiSend)."""

    status_code = 400
    default_detail = "Операция не прошла проверку."


def _is_admin(user) -> bool:
    return bool(getattr(user, "is_admin", False) or getattr(user, "is_staff", False))


def _guard_deliverer_edit(obj, owner, user):
    """
    Правило анти-махинаций (ТЗ п.5): доставщик может изменять/аннулировать
    ТОЛЬКО свою операцию и ТОЛЬКО в течение 24 часов после создания.
    Администратор — без ограничений. Проверка на сервере, а не только в UI.
    """
    if _is_admin(user):
        return
    if owner is None or owner.pk != getattr(user, "pk", None):
        raise PermissionDenied("Можно изменять только свои операции.")
    created = getattr(obj, "created_at", None)
    if created is not None and timezone.now() - created > EDIT_WINDOW:
        raise PermissionDenied(
            "Прошло более 24 часов. Изменение возможно только через администратора."
        )


def num(x):
    if x is None:
        return 0
    return float(x)


def iso(dt):
    return dt.isoformat() if dt else None


def parse_dt(value):
    if not value:
        return timezone.now()
    dt = parse_datetime(value)
    if dt is None:
        return timezone.now()
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone.get_current_timezone())
    return dt


def _operator_label(user, admin_word="админ", deliverer_word="доставщик"):
    if not user:
        return ""
    role = admin_word if getattr(user, "is_admin", False) else deliverer_word
    return f"{user.full_name or user.username} ({role})"


def _operator_username(user):
    # Фронтенд фильтрует «мои операции» по отображаемому имени.
    return (user.full_name or user.username) if user else ""


def _operator_id(user):
    # Стабильный идентификатор для фильтрации операций по доставщику
    # (имя ненадёжно: пересечения имён давали дубли и ломали фильтр).
    return str(user.pk) if user else ""


# --------------------------- сериализация в лог ---------------------------

def sale_to_log(s: Sale):
    items = [
        {
            "eggType": it.egg_type_id,
            "nameRu": it.egg_type.name_ru,
            "nameUz": it.egg_type.name_uz,
            "qtyType": "boxes" if it.unit == SaleItem.Unit.BOX else "trays",
            "qty": num(it.quantity),
            "trays": num(it.trays),
            "pricePerTray": num(it.price_per_tray),
            "lineTotal": num(it.line_total),
        }
        for it in s.items.all()
    ]
    return {
        "id": f"sale-{s.pk}",
        "type": "sale",
        "timestamp": iso(s.created_at),
        "operationDate": iso(s.operation_date),
        "shopId": s.shop_id,
        "shopName": s.shop.name,
        "items": items,
        "total": num(s.total),
        "received": num(s.received),
        "amount": num(s.total),
        "debtDelta": num(s.total - s.received),
        "paymentType": s.payment_method if s.received > 0 else "debt",
        "operator": _operator_label(s.deliverer),
        "operatorUsername": _operator_username(s.deliverer),
        "operatorId": _operator_id(s.deliverer),
        "message": s.message,
        "isCancelled": s.is_cancelled,
        "isEdited": s.is_edited,
    }


def payment_to_log(p: Payment):
    return {
        "id": f"pay-{p.pk}",
        "type": "payment",
        "timestamp": iso(p.created_at),
        "operationDate": iso(p.operation_date),
        "shopId": p.shop_id,
        "shopName": p.shop.name,
        "amount": num(p.amount),
        "paymentType": p.payment_method,
        "comment": p.comment,
        "operator": _operator_label(p.operator),
        "operatorUsername": _operator_username(p.operator),
        "operatorId": _operator_id(p.operator),
        "message": p.message,
        "isCancelled": p.is_cancelled,
        "isEdited": p.is_edited,
    }


def return_to_log(r: Return):
    return {
        "id": f"return-{r.pk}",
        "type": "return",
        "timestamp": iso(r.created_at),
        "operationDate": iso(r.operation_date),
        "shopId": r.shop_id,
        "shopName": r.shop.name,
        "eggType": r.egg_type_id,
        "eggNameRu": r.egg_type.name_ru,
        "eggNameUz": r.egg_type.name_uz,
        "qtyPieces": r.quantity,
        "amount": 0,  # не влияет на деньги/долг (возмещение товаром)
        "comment": r.comment,
        "operator": _operator_label(r.deliverer),
        "operatorUsername": _operator_username(r.deliverer),
        "operatorId": _operator_id(r.deliverer),
        "message": r.message,
        "isCancelled": r.is_cancelled,
        "isEdited": r.is_edited,
    }


def expense_to_log(e: Expense):
    return {
        "id": f"expense-{e.pk}",
        "type": "expense",
        "timestamp": iso(e.created_at),
        "operationDate": iso(e.operation_date),
        "shopId": None,  # расход не привязан к магазину и не влияет на долги
        "amount": num(e.amount),
        "expenseCategory": e.category,
        "comment": e.comment,
        "operator": _operator_label(e.deliverer),
        "operatorUsername": _operator_username(e.deliverer),
        "operatorId": _operator_id(e.deliverer),
        "message": e.message,
        "isCancelled": e.is_cancelled,
        "isEdited": e.is_edited,
    }


def adjustment_to_log(a: Adjustment):
    return {
        "id": f"adj-{a.pk}",
        "type": "adjustment",
        "timestamp": iso(a.created_at),
        "operationDate": iso(a.created_at),
        "shopId": a.shop_id,
        "shopName": a.shop.name,
        "adjustmentAmount": num(a.amount),
        "amount": abs(num(a.amount)),
        "reason": a.reason,
        "operator": _operator_label(a.operator),
        "operatorUsername": _operator_username(a.operator),
        "operatorId": _operator_id(a.operator),
        "message": a.message,
        "isCancelled": a.is_cancelled,
    }


def activity_to_log(al: ActivityLog):
    return {
        "id": f"audit-{al.pk}",
        "type": "audit",
        "timestamp": iso(al.created_at),
        "operationDate": iso(al.created_at),
        "shopId": al.shop_id,
        "amount": 0,
        "message": al.message,
        "operator": al.operator_label or _operator_label(al.user),
        "operatorUsername": _operator_username(al.user),
        "operatorId": _operator_id(al.user),
        "action": al.action,
        "isCancelled": False,
    }


def all_logs():
    logs = []
    logs += [sale_to_log(s) for s in Sale.objects.select_related("shop", "deliverer").prefetch_related("items__egg_type")]
    logs += [payment_to_log(p) for p in Payment.objects.select_related("shop", "operator")]
    logs += [return_to_log(r) for r in Return.objects.select_related("shop", "deliverer", "egg_type")]
    logs += [expense_to_log(e) for e in Expense.objects.select_related("deliverer")]
    logs += [adjustment_to_log(a) for a in Adjustment.objects.select_related("shop", "operator")]
    logs += [activity_to_log(al) for al in ActivityLog.objects.select_related("user", "shop")]
    logs.sort(key=lambda x: x["timestamp"] or "", reverse=True)
    return logs


# --------------------------- создание из лога -----------------------------

def _get_shop(data):
    shop_id = data.get("shopId")
    if not shop_id:
        return None
    return Shop.objects.filter(id=shop_id).first()


def _dec(value, field):
    try:
        d = Decimal(str(value if value is not None else 0))
    except (InvalidOperation, ValueError, TypeError):
        raise BusinessRuleError(f"Некорректное числовое значение в поле «{field}».")
    if not d.is_finite():
        raise BusinessRuleError(f"Некорректное числовое значение в поле «{field}».")
    return d


def _validate_sale(data):
    """
    Пересчитывает и сверяет суммы продажи НА СЕРВЕРЕ (ТЗ п.5.4 + анти-махинации п.5).

    Клиенту нельзя доверять ни цену, ни количество лотков, ни итог: без этой
    проверки доставщик мог отправить продажу с отрицательным или нулевым итогом
    и тем самым списать долг магазина, минуя интерфейс.

    Возвращает (total, received, items) — уже серверные значения, готовые для
    Sale/SaleItem. Цена берётся из каталога, лотки — из количества и настроек.
    """
    total = _dec(data.get("total", 0), "total")
    received = _dec(data.get("received", 0), "received")
    if total < 0:
        raise BusinessRuleError("Сумма продажи не может быть отрицательной.")
    if received < 0:
        raise BusinessRuleError("Полученная сумма не может быть отрицательной.")

    raw_items = data.get("items") or []
    if not raw_items:
        # Без позиций итог ничем не подтверждён — такую продажу не принимаем.
        raise BusinessRuleError("В продаже должна быть хотя бы одна позиция.")

    trays_per_box = Decimal(str(AppSettings.load().trays_per_box or 1))
    items, line_sum = [], Decimal("0")

    for raw in raw_items:
        egg = EggType.objects.filter(id=raw.get("eggType")).first()
        if egg is None:
            raise BusinessRuleError(f"Неизвестный вид яиц: {raw.get('eggType')}.")

        qty = _dec(raw.get("qty", 0), "qty")
        if qty <= 0:
            raise BusinessRuleError(f"Количество по позиции «{egg.name_ru}» должно быть больше нуля.")

        is_box = raw.get("qtyType") == "boxes"
        trays = qty * trays_per_box if is_box else qty
        if abs(_dec(raw.get("trays", 0), "trays") - trays) > MONEY_EPS:
            raise BusinessRuleError(f"Количество лотков по позиции «{egg.name_ru}» не сходится с количеством.")

        price = egg.current_price_per_tray
        if price is None:
            raise BusinessRuleError(f"Для «{egg.name_ru}» не задана цена в каталоге.")
        if abs(_dec(raw.get("pricePerTray", 0), "pricePerTray") - price) > MONEY_EPS:
            raise BusinessRuleError(
                f"Цена по позиции «{egg.name_ru}» не совпадает с ценой в каталоге — обновите страницу."
            )

        line = trays * price
        if abs(_dec(raw.get("lineTotal", 0), "lineTotal") - line) > MONEY_EPS:
            raise BusinessRuleError(f"Сумма по позиции «{egg.name_ru}» не равна «лотки × цена».")

        line_sum += line
        items.append({
            "egg_type_id": egg.id,
            "unit": SaleItem.Unit.BOX if is_box else SaleItem.Unit.TRAY,
            "quantity": qty,
            "price_per_tray": price,
            "trays": trays,
            "line_total": line,
        })

    if abs(total - line_sum) > MONEY_EPS:
        raise BusinessRuleError("Итог продажи не сходится с суммой позиций.")

    # Сохраняем именно пересчитанный итог, а не присланный.
    return line_sum, received, items


def _apply_shop_move(obj, data, user):
    """
    Перепривязка операции к другому магазину — нужна для «объединения дубликатов»
    (AdminDashboard: операции исходной точки переезжают на целевую).

    Только администратор: иначе доставщик мог бы перебрасывать чужой долг
    между точками через API.
    """
    if "shopId" not in data:
        return
    if not _is_admin(user):
        raise PermissionDenied("Переносить операцию в другой магазин может только администратор.")
    shop = Shop.objects.filter(id=data.get("shopId")).first()
    if shop is None:
        raise BusinessRuleError("Магазин для переноса операции не найден.")
    obj.shop = shop


def create_operation(user, data):
    op_type = data.get("type")
    shop = _get_shop(data)

    # Продажа
    if op_type == "sale" and shop is not None:
        total, received, items = _validate_sale(data)
        s = Sale.objects.create(
            shop=shop, deliverer=user,
            operation_date=parse_dt(data.get("operationDate")),
            total=total,
            received=received,
            payment_method=data.get("paymentType") if data.get("paymentType") in ("cash", "card", "transfer") else "cash",
            comment=data.get("comment", "") or "",
            message=data.get("message", "") or "",
        )
        for it in items:
            SaleItem.objects.create(sale=s, **it)
        return sale_to_log(s)

    # Приём оплаты
    if op_type == "payment" and shop is not None and float(data.get("amount", 0)) > 0:
        p = Payment.objects.create(
            shop=shop, operator=user,
            operation_date=parse_dt(data.get("operationDate")),
            amount=Decimal(str(data.get("amount", 0))),
            payment_method=data.get("paymentType") if data.get("paymentType") in ("cash", "card", "transfer") else "cash",
            comment=data.get("comment", "") or "",
            message=data.get("message", "") or "",
        )
        return payment_to_log(p)

    # Возврат-возмещение (строго по штукам; не влияет на долг)
    if op_type == "return" and shop is not None and int(data.get("qtyPieces", 0) or 0) > 0 and data.get("eggType"):
        r = Return.objects.create(
            shop=shop, deliverer=user,
            egg_type_id=data.get("eggType"),
            quantity=int(data.get("qtyPieces")),
            operation_date=parse_dt(data.get("operationDate")),
            comment=data.get("comment", "") or "",
            message=data.get("message", "") or "",
        )
        return return_to_log(r)

    # Каждодневный расход доставщика (обед и т.п.) — без магазина, долги не меняет
    if op_type == "expense" and float(data.get("amount", 0) or 0) > 0:
        e = Expense.objects.create(
            deliverer=user,
            amount=Decimal(str(data.get("amount", 0))),
            category=data.get("expenseCategory") if data.get("expenseCategory") in ("lunch", "other") else "other",
            operation_date=parse_dt(data.get("operationDate")),
            comment=data.get("comment", "") or "",
            message=data.get("message", "") or "",
        )
        return expense_to_log(e)

    # Корректировка (± с причиной) — прямое изменение долга, только администратор
    # (ТЗ п.3.2/5.1). Иначе доставщик мог бы менять долг магазина через API.
    if op_type == "adjustment" and shop is not None and isinstance(data.get("adjustmentAmount"), (int, float)):
        if not _is_admin(user):
            raise PermissionDenied("Корректировку долга может делать только администратор.")
        a = Adjustment.objects.create(
            shop=shop, operator=user,
            amount=Decimal(str(data.get("adjustmentAmount"))),
            reason=data.get("reason", "") or "",
            message=data.get("message", "") or "",
        )
        return adjustment_to_log(a)

    # Прочее → запись журнала действий (аудит)
    al = ActivityLog.objects.create(
        user=user,
        shop=shop,
        operator_label=data.get("operator", "") or _operator_label(user),
        action=ActivityLog.Action.CANCEL if op_type == "audit" else ActivityLog.Action.OTHER,
        object_type=str(op_type or ""),
        message=data.get("message", "") or "",
    )
    return activity_to_log(al)


def update_operation(op_id, data, user):
    kind, _, raw_pk = str(op_id).partition("-")
    pk = raw_pk

    def apply_common(obj):
        if "message" in data:
            obj.message = data.get("message") or obj.message
        if data.get("isEdited"):
            obj.is_edited = True

    if kind == "sale":
        obj = Sale.objects.filter(pk=pk).first()
        if not obj:
            return None
        _guard_deliverer_edit(obj, obj.deliverer, user)
        _apply_shop_move(obj, data, user)
        if "total" in data:
            total = _dec(data["total"], "total")
            if total < 0:
                raise BusinessRuleError("Сумма продажи не может быть отрицательной.")
            obj.total = total
        apply_common(obj)
        if data.get("isCancelled"):
            obj.is_cancelled = True
            obj.cancelled_by = user
            obj.cancelled_at = timezone.now()
        obj.save()
        return sale_to_log(obj)

    if kind == "pay":
        obj = Payment.objects.filter(pk=pk).first()
        if not obj:
            return None
        _guard_deliverer_edit(obj, obj.operator, user)
        _apply_shop_move(obj, data, user)
        if "amount" in data:
            amount = _dec(data["amount"], "amount")
            if amount < 0:
                raise BusinessRuleError("Сумма оплаты не может быть отрицательной.")
            obj.amount = amount
        apply_common(obj)
        if data.get("isCancelled"):
            obj.is_cancelled = True
            obj.cancelled_by = user
            obj.cancelled_at = timezone.now()
        obj.save()
        return payment_to_log(obj)

    if kind == "return":
        obj = Return.objects.filter(pk=pk).first()
        if not obj:
            return None
        _guard_deliverer_edit(obj, obj.deliverer, user)
        _apply_shop_move(obj, data, user)
        apply_common(obj)
        if data.get("isCancelled"):
            obj.is_cancelled = True
            obj.cancelled_by = user
            obj.cancelled_at = timezone.now()
        obj.save()
        return return_to_log(obj)

    if kind == "expense":
        obj = Expense.objects.filter(pk=pk).first()
        if not obj:
            return None
        _guard_deliverer_edit(obj, obj.deliverer, user)
        if "amount" in data:
            amount = _dec(data["amount"], "amount")
            if amount < 0:
                raise BusinessRuleError("Сумма расхода не может быть отрицательной.")
            obj.amount = amount
        apply_common(obj)
        if data.get("isCancelled"):
            obj.is_cancelled = True
            obj.cancelled_by = user
            obj.cancelled_at = timezone.now()
        obj.save()
        return expense_to_log(obj)

    if kind == "adj":
        obj = Adjustment.objects.filter(pk=pk).first()
        if not obj:
            return None
        _guard_deliverer_edit(obj, obj.operator, user)
        _apply_shop_move(obj, data, user)
        apply_common(obj)
        if data.get("isCancelled"):
            obj.is_cancelled = True
        obj.save()
        return adjustment_to_log(obj)

    if kind == "audit":
        obj = ActivityLog.objects.filter(pk=pk).first()
        if not obj:
            return None
        # Записи журнала действий правит только администратор (целостность аудита).
        if not _is_admin(user):
            raise PermissionDenied("Журнал действий может изменять только администратор.")
        _apply_shop_move(obj, data, user)
        if "message" in data:
            obj.message = data.get("message") or obj.message
        obj.save()
        return activity_to_log(obj)

    return None
