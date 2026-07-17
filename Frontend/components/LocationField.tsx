"use client";

import React, { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { MapPin, Navigation, LocateFixed, Check } from "lucide-react";

// Построить URL маршрута до точки через Яндекс.Карты (от текущего местоположения).
export function yandexRouteUrl(lat?: number | null, lng?: number | null): string | null {
  if (lat == null || lng == null) return null;
  return `https://yandex.ru/maps/?rtext=~${lat},${lng}&rtt=auto`;
}

interface Props {
  lat?: number | null;
  lng?: number | null;
  onChange: (lat: number | null, lng: number | null) => void;
  lang: "ru" | "uz";
}

// Ташкент по умолчанию, если координаты ещё не заданы.
const DEFAULT_CENTER: [number, number] = [41.311081, 69.240562];

// SVG-маркер (divIcon) — чтобы не зависеть от картинок-иконок Leaflet при сборке.
function pinIcon(L: any) {
  return L.divIcon({
    className: "",
    html: '<div style="transform:translate(-50%,-100%)"><svg width="30" height="40" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.4 0 0 5.4 0 12c0 8.5 12 20 12 20s12-11.5 12-20C24 5.4 18.6 0 12 0z" fill="#f59e0b" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="12" r="4.5" fill="#1e293b"/></svg></div>',
    iconSize: [30, 40],
    iconAnchor: [0, 0],
  });
}

export default function LocationField({ lat, lng, onChange, lang }: Props) {
  const [open, setOpen] = useState(false);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObj = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  // Держим последний onChange, чтобы не пересоздавать карту при ре-рендере.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!open || !mapRef.current) return;
    let disposed = false;
    import("leaflet").then((mod) => {
      const L = (mod as any).default || mod;
      if (disposed || !mapRef.current) return;
      LRef.current = L;
      const start: [number, number] = lat != null && lng != null ? [lat, lng] : DEFAULT_CENTER;
      const map = L.map(mapRef.current).setView(start, lat != null ? 16 : 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(map);

      const place = (la: number, ln: number) => {
        const p: [number, number] = [+la.toFixed(6), +ln.toFixed(6)];
        if (markerRef.current) markerRef.current.setLatLng(p);
        else {
          markerRef.current = L.marker(p, { icon: pinIcon(L), draggable: true }).addTo(map);
          markerRef.current.on("dragend", () => {
            const c = markerRef.current.getLatLng();
            onChangeRef.current(+c.lat.toFixed(6), +c.lng.toFixed(6));
          });
        }
        onChangeRef.current(p[0], p[1]);
      };

      if (lat != null && lng != null) place(lat, lng);
      map.on("click", (e: any) => place(e.latlng.lat, e.latlng.lng));
      mapObj.current = map;
      // Пересчёт размеров после появления контейнера.
      setTimeout(() => map.invalidateSize(), 100);
    });
    return () => {
      disposed = true;
      try { mapObj.current?.remove(); } catch { /* ignore */ }
      mapObj.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const locateMe = () => {
    if (!navigator.geolocation || !mapObj.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        mapObj.current.setView([latitude, longitude], 17);
        const L = LRef.current;
        const p: [number, number] = [+latitude.toFixed(6), +longitude.toFixed(6)];
        if (markerRef.current) markerRef.current.setLatLng(p);
        else if (L) {
          markerRef.current = L.marker(p, { icon: pinIcon(L), draggable: true }).addTo(mapObj.current);
          markerRef.current.on("dragend", () => {
            const c = markerRef.current.getLatLng();
            onChangeRef.current(+c.lat.toFixed(6), +c.lng.toFixed(6));
          });
        }
        onChangeRef.current(p[0], p[1]);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const hasCoords = lat != null && lng != null;

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {lang === "ru" ? "Локация (укажите на карте)" : "Lokatsiya (xaritada belgilang)"}
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
        >
          <MapPin className="w-3.5 h-3.5 text-amber-500" />
          {open ? (lang === "ru" ? "Скрыть карту" : "Xaritani yashirish")
                : hasCoords ? (lang === "ru" ? "Изменить на карте" : "Xaritada o'zgartirish")
                : (lang === "ru" ? "Указать на карте" : "Xaritada belgilash")}
        </button>

        {hasCoords && !open && (
          <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
            <Check className="w-3.5 h-3.5" /> {lang === "ru" ? "Точка выбрана" : "Nuqta tanlangan"}
          </span>
        )}

        {hasCoords && (
          <a
            href={yandexRouteUrl(lat, lng)!} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-xs font-bold text-amber-700 hover:bg-amber-100 cursor-pointer"
          >
            <Navigation className="w-3.5 h-3.5" />
            {lang === "ru" ? "Маршрут" : "Marshrut"}
          </a>
        )}
      </div>

      {open && (
        <div className="relative mt-1">
          <div ref={mapRef} className="w-full h-60 rounded-lg border border-slate-200 overflow-hidden z-0" />
          <button
            type="button"
            onClick={locateMe}
            className="absolute top-2 right-2 z-[400] flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 shadow text-[11px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            title={lang === "ru" ? "Моё местоположение" : "Mening joylashuvim"}
          >
            <LocateFixed className="w-3.5 h-3.5 text-amber-500" />
            {lang === "ru" ? "Я здесь" : "Men shu yerda"}
          </button>
          <p className="text-[10px] text-slate-400 mt-1">{lang === "ru" ? "Нажмите на карту, чтобы поставить точку магазина." : "Do'kon nuqtasini qo'yish uchun xaritani bosing."}</p>
        </div>
      )}
    </div>
  );
}
