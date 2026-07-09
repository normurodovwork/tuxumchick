from django.urls import path

from . import views

urlpatterns = [
    path("auth/login/", views.login_view),
    path("auth/logout/", views.logout_view),
    path("auth/me/", views.me_view),

    path("shops/", views.shops),
    path("deliverers/", views.deliverers),
    path("egg-types/", views.egg_types),
    path("settings/", views.settings_view),
    path("inventory/", views.inventory_view),
    path("prices/", views.prices_view),

    path("operations/", views.operations),
    path("operations/<str:op_id>/", views.operation_detail),
]
