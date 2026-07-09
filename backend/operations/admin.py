from django.contrib import admin

from .models import ActivityLog, Adjustment, Payment, Sale, SaleItem


class SaleItemInline(admin.TabularInline):
    model = SaleItem
    extra = 0
    readonly_fields = ("trays", "line_total")


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ("id", "shop", "deliverer", "operation_date", "total", "received", "debt_delta", "is_cancelled")
    list_filter = ("is_cancelled", "payment_method", "operation_date", "deliverer")
    search_fields = ("shop__name", "comment")
    date_hierarchy = "operation_date"
    inlines = [SaleItemInline]

    @admin.display(description="В долг")
    def debt_delta(self, obj):
        return obj.debt_delta


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("id", "shop", "operator", "operation_date", "amount", "payment_method", "is_cancelled")
    list_filter = ("is_cancelled", "payment_method", "operation_date")
    search_fields = ("shop__name", "comment")
    date_hierarchy = "operation_date"


@admin.register(Adjustment)
class AdjustmentAdmin(admin.ModelAdmin):
    list_display = ("id", "shop", "operator", "amount", "reason", "is_cancelled", "created_at")
    list_filter = ("is_cancelled", "created_at")
    search_fields = ("shop__name", "reason")


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "user", "action", "object_type", "object_id", "message")
    list_filter = ("action", "object_type", "created_at")
    search_fields = ("message", "object_id")
    readonly_fields = ("user", "action", "object_type", "object_id", "message", "changes", "created_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False  # журнал не редактируется (ТЗ п.4.10)
