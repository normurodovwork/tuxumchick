from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("username", "full_name", "phone", "role", "status", "is_active")
    list_filter = ("role", "status", "is_active")
    search_fields = ("username", "full_name", "phone")
    fieldsets = BaseUserAdmin.fieldsets + (
        ("Профиль (B2B)", {"fields": ("full_name", "phone", "role", "status")}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ("Профиль (B2B)", {"fields": ("full_name", "phone", "role", "status")}),
    )
