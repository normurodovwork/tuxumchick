from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from catalog.models import AppSettings, EggType, KVStore, Price, Shop
from operations.models import ActivityLog, Adjustment, Payment, Sale

from . import bridge

User = get_user_model()


def num(x):
    return float(x) if x is not None else 0


# ------------------------------- Auth -------------------------------------

@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    login = str(request.data.get("login", "")).strip()
    password = str(request.data.get("password", ""))
    if not login or not password:
        return Response({"detail": "Укажите логин и пароль"}, status=400)

    user = User.objects.filter(username__iexact=login).first()
    if user is None:
        norm = login.replace(" ", "").replace("+", "")
        if norm.isdigit() and len(norm) >= 9:
            for u in User.objects.exclude(phone=""):
                dbp = (u.phone or "").replace(" ", "").replace("+", "")
                if dbp.isdigit() and len(dbp) >= 9 and dbp[-9:] == norm[-9:]:
                    user = u
                    break

    if user is None or not user.check_password(password):
        return Response({"detail": "Неверный логин или пароль"}, status=400)
    if user.is_blocked:
        return Response({"detail": "Учётная запись заблокирована администратором"}, status=403)

    token, _ = Token.objects.get_or_create(user=user)
    return Response({
        "token": token.key,
        "user": {
            "id": str(user.pk),
            "role": user.role,
            "name": user.full_name or user.username,
            "username": user.username,
            "status": user.status,
        },
    })


@api_view(["POST"])
def logout_view(request):
    Token.objects.filter(user=request.user).delete()
    return Response({"ok": True})


@api_view(["GET"])
def me_view(request):
    u = request.user
    return Response({"id": str(u.pk), "role": u.role, "name": u.full_name or u.username, "username": u.username, "status": u.status})


# ------------------------------- Shops ------------------------------------

def shop_dict(s: Shop):
    return {
        "id": s.id,
        "name": s.name,
        "contact": s.contact,
        "phone": s.phone,
        "address": s.address,
        "note": s.note,
        "isArchived": s.is_archived,
        "openingDebt": num(s.opening_debt),
        "debt": num(s.current_debt),
    }


@api_view(["GET", "POST"])
def shops(request):
    if request.method == "GET":
        return Response([shop_dict(s) for s in Shop.objects.all()])
    d = request.data
    opening = d.get("openingDebt", d.get("debt", 0)) or 0
    obj, _ = Shop.objects.update_or_create(
        id=d["id"],
        defaults={
            "name": d.get("name", ""),
            "contact": d.get("contact", "") or "",
            "phone": d.get("phone", "") or "",
            "address": d.get("address", "") or "",
            "note": d.get("note", "") or "",
            "is_archived": bool(d.get("isArchived", False)),
            "opening_debt": Decimal(str(opening)),
            "created_by": request.user if request.user.is_authenticated else None,
        },
    )
    return Response(shop_dict(obj))


# ------------------------------ Deliverers --------------------------------

def deliverer_dict(u: User):
    return {"id": str(u.pk), "name": u.full_name or u.username, "username": u.username, "phone": u.phone or "", "status": u.status}


@api_view(["GET", "POST"])
def deliverers(request):
    if request.method == "GET":
        qs = User.objects.filter(role=User.Role.DELIVERER).order_by("full_name")
        return Response([deliverer_dict(u) for u in qs])
    d = request.data
    pk = d.get("id")
    user = User.objects.filter(pk=pk).first() if pk and str(pk).isdigit() else None
    if user is None:
        user = User(role=User.Role.DELIVERER)
    user.username = (d.get("username") or "").lower().strip()
    user.full_name = d.get("name", "") or ""
    user.phone = (d.get("phone") or "").strip()
    user.status = d.get("status", User.Status.OFFLINE)
    user.role = User.Role.DELIVERER
    pw = d.get("password")
    if pw:  # пустой пароль при редактировании = оставить текущий
        user.set_password(str(pw))
    elif not user.pk:
        user.set_password("123")
    user.save()
    return Response(deliverer_dict(user))


# ------------------------------ Egg types ---------------------------------

def egg_dict(e: EggType):
    return {
        "id": e.id,
        "nameRu": e.name_ru,
        "nameUz": e.name_uz,
        "status": e.status,
        "pricePerTray": num(e.current_price_per_tray) if e.current_price_per_tray is not None else 0,
    }


@api_view(["GET", "POST"])
def egg_types(request):
    if request.method == "GET":
        return Response([egg_dict(e) for e in EggType.objects.all()])
    d = request.data
    obj, _ = EggType.objects.update_or_create(
        id=d["id"],
        defaults={"name_ru": d.get("nameRu", ""), "name_uz": d.get("nameUz", ""), "status": d.get("status", "active")},
    )
    price = d.get("pricePerTray")
    if price is not None:
        current = obj.current_price_per_tray
        if current is None or Decimal(str(price)) != current:
            Price.objects.create(
                egg_type=obj, price_per_tray=Decimal(str(price)),
                created_by=request.user if request.user.is_authenticated else None,
            )
    return Response(egg_dict(obj))


# ------------------------------ Settings ----------------------------------

def settings_dict(s: AppSettings):
    return {"traysPerBox": s.trays_per_box, "eggsPerTray": s.eggs_per_tray, "oldDebtThresholdDays": s.old_debt_threshold_days}


@api_view(["GET", "PUT", "POST"])
def settings_view(request):
    s = AppSettings.load()
    if request.method != "GET":
        d = request.data
        s.trays_per_box = int(d.get("traysPerBox", s.trays_per_box))
        s.eggs_per_tray = int(d.get("eggsPerTray", s.eggs_per_tray))
        s.old_debt_threshold_days = int(d.get("oldDebtThresholdDays", s.old_debt_threshold_days))
        s.save()
    return Response(settings_dict(s))


# ------------------------------ KV: inventory / prices --------------------

def _kv_get(key, default):
    obj = KVStore.objects.filter(key=key).first()
    return obj.value if obj else default


def _kv_set(key, value):
    KVStore.objects.update_or_create(key=key, defaults={"value": value})
    return value


@api_view(["GET", "PUT", "POST"])
def inventory_view(request):
    if request.method == "GET":
        return Response(_kv_get("inventory", {}))
    return Response(_kv_set("inventory", request.data))


@api_view(["GET", "POST"])
def prices_view(request):
    history = _kv_get("price_history", [])
    if request.method == "GET":
        return Response(history)
    record = dict(request.data)
    record.setdefault("id", f"price-{len(history) + 1}")
    history = [record] + (history if isinstance(history, list) else [])
    _kv_set("price_history", history)
    return Response(record)


# ------------------------------ Operations feed ---------------------------

@api_view(["GET", "POST"])
def operations(request):
    if request.method == "GET":
        return Response(bridge.all_logs())
    log = bridge.create_operation(request.user, request.data)
    return Response(log, status=status.HTTP_201_CREATED)


@api_view(["PATCH", "PUT"])
def operation_detail(request, op_id):
    log = bridge.update_operation(op_id, request.data, request.user)
    if log is None:
        return Response({"detail": "Операция не найдена"}, status=404)
    return Response(log)
