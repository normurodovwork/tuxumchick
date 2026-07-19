from django.contrib import admin

from .models import AppSettings, EggType, Price, Shop


@admin.register(AppSettings)
class AppSettingsAdmin(admin.ModelAdmin):
    list_display = ("__str__", "trays_per_box", "eggs_per_tray", "old_debt_threshold_days", "updated_at")


class PriceInline(admin.TabularInline):
    model = Price
    extra = 0


@admin.register(EggType)
class EggTypeAdmin(admin.ModelAdmin):
    list_display = ("name_ru", "name_uz", "status", "current_price_per_tray")
    list_filter = ("status",)
    search_fields = ("name_ru", "name_uz")
    inlines = [PriceInline]


@admin.register(Price)
class PriceAdmin(admin.ModelAdmin):
    list_display = ("egg_type", "price_per_tray", "start_date", "created_by", "created_at")
    list_filter = ("egg_type", "start_date")


@admin.register(Shop)
class ShopAdmin(admin.ModelAdmin):
    list_display = ("name", "contact", "phone", "opening_debt", "current_debt", "is_archived")
    list_filter = ("is_archived",)
    search_fields = ("name", "contact", "phone")
    readonly_fields = ("current_debt",)

    @admin.display(description="Текущий долг")
    def current_debt(self, obj):
        return obj.current_debt
