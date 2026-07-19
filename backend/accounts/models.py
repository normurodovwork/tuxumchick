from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Пользователь системы (ТЗ п.3, п.8).

    Роли: доставщик / администратор. Входа для магазинов нет.
    Пароль хранится хешированным (стандартный механизм Django).
    Вход — по username (логину) или телефону + паролю.
    """

    class Role(models.TextChoices):
        ADMIN = "admin", "Администратор"
        DELIVERER = "deliverer", "Доставщик"

    class Status(models.TextChoices):
        ONLINE = "online", "В сети"
        OFFLINE = "offline", "Не в сети"
        BLOCKED = "blocked", "Заблокирован"

    # username и password (хеш) — унаследованы от AbstractUser.
    full_name = models.CharField("ФИО", max_length=150, blank=True)
    phone = models.CharField("Телефон", max_length=32, unique=True, null=True, blank=True)
    role = models.CharField("Роль", max_length=16, choices=Role.choices, default=Role.DELIVERER)
    status = models.CharField("Статус", max_length=16, choices=Status.choices, default=Status.OFFLINE)

    class Meta:
        db_table = "users"
        verbose_name = "Пользователь"
        verbose_name_plural = "Пользователи"

    def __str__(self) -> str:
        return f"{self.full_name or self.username} ({self.get_role_display()})"

    @property
    def is_admin(self) -> bool:
        return self.role == self.Role.ADMIN

    @property
    def is_deliverer(self) -> bool:
        return self.role == self.Role.DELIVERER

    @property
    def is_blocked(self) -> bool:
        # При блокировке доступ закрывается немедленно (ТЗ п.4.1).
        return self.status == self.Status.BLOCKED
