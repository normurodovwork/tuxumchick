"use client";

import React, { useEffect, useRef, useState } from "react";
import { MapPin, Navigation } from "lucide-react";

// Ключ Яндекс.Карт (JS API). Без ключа интерактивная карта недоступна —
// работает ручной ввод координат и ссылка «открыть в Яндекс.Картах».
const YMAPS_KEY = (typeof process !== "undefined" && process.env.NEXT_PUBLIC_YANDEX_MAPS_KEY) || "";

// Построить URL маршрута до точки через Яндекс.Карты (от текущего местоположения).
export function yandexRouteUrl(lat?: number | null, lng?: number | null): string | null {
  if (lat == null || lng == null) return null;
  return `https://yandex.ru/maps/?rtext=~${lat},${lng}&rtt=auto`;
}

// Ссылка на точку на Яндекс.Картах (для ручного поиска координат).
function yandexPointUrl(lat?: number | null, lng?: number | null): string {
  if (lat == null || lng == null) return "https://yandex.ru/maps/";
  return `https://yandex.ru/maps/?pt=${lng},${lat}&z=17&l=map`;
}

let ymapsPromise: Promise<any> | null = null;
function loadYmaps(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject();
  if ((window as any).ymaps) return Promise.resolve((window as any).ymaps);
  if (ymapsPromise) return ymapsPromise;
  ymapsPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://api-maps.yandex.ru/2.1/?apikey=${YMAPS_KEY}&lang=ru_RU`;
    s.async = true;
    s.onload = () => (window as any).ymaps.ready(() => resolve((window as any).ymaps));
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return ymapsPromise;
}

interface Props {
  lat?: number | null;
  lng?: number | null;
  onChange: (lat: number | null, lng: number | null) => void;
  lang: "ru" | "uz";
}

// Ташкент по умолчанию, если координаты ещё не заданы.
const DEFAULT_CENTER: [number, number] = [41.311081, 69.240562];

export default function LocationField({ lat, lng, onChange, lang }: Props) {
  const [showMap, setShowMap] = useState(false);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObj = useRef<any>(null);
  const placemark = useRef<any>(null);

  useEffect(() => {
    if (!showMap || !YMAPS_KEY || !mapRef.current) return;
    let disposed = false;
    loadYmaps().then((ymaps) => {
      if (disposed || !mapRef.current) return;
      const center: [number, number] = lat != null && lng != null ? [lat, lng] : DEFAULT_CENTER;
      const map = new ymaps.Map(mapRef.current, { center, zoom: lat != null ? 16 : 12, controls: ["zoomControl", "searchControl"] });
      const pm = new ymaps.Placemark(center, {}, { draggable: true, preset: "islands#redDotIcon" });
      map.geoObjects.add(pm);
      map.events.add("click", (e: any) => {
        const c = e.get("coords");
        pm.geometry.setCoordinates(c);
        onChange(+c[0].toFixed(6), +c[1].toFixed(6));
      });
      pm.events.add("dragend", () => {
        const c = pm.geometry.getCoordinates();
        onChange(+c[0].toFixed(6), +c[1].toFixed(6));
      });
      mapObj.current = map;
      placemark.current = pm;
    }).catch(() => {});
    return () => {
      disposed = true;
      try { mapObj.current?.destroy(); } catch { /* ignore */ }
      mapObj.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMap]);

  // Синхронизация маркера при ручном изменении координат.
  useEffect(() => {
    if (placemark.current && lat != null && lng != null) {
      try {
        placemark.current.geometry.setCoordinates([lat, lng]);
        mapObj.current?.setCenter([lat, lng]);
      } catch { /* ignore */ }
    }
  }, [lat, lng]);

  const hasCoords = lat != null && lng != null;

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {lang === "ru" ? "Локация (для маршрута)" : "Lokatsiya (marshrut uchun)"}
      </label>

      <div className="flex gap-2">
        <input
          type="number" step="0.000001" inputMode="decimal"
          placeholder={lang === "ru" ? "Широта" : "Kenglik"}
          value={lat ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : +e.target.value, lng ?? null)}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:border-amber-400"
        />
        <input
          type="number" step="0.000001" inputMode="decimal"
          placeholder={lang === "ru" ? "Долгота" : "Uzunlik"}
          value={lng ?? ""}
          onChange={(e) => onChange(lat ?? null, e.target.value === "" ? null : +e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:border-amber-400"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {YMAPS_KEY ? (
          <button
            type="button"
            onClick={() => setShowMap((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <MapPin className="w-3.5 h-3.5 text-amber-500" />
            {showMap ? (lang === "ru" ? "Скрыть карту" : "Xaritani yashirish") : (lang === "ru" ? "Выбрать на карте" : "Xaritada tanlash")}
          </button>
        ) : (
          <a
            href={yandexPointUrl(lat, lng)} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            title={lang === "ru" ? "Найдите точку и скопируйте координаты" : "Nuqtani toping va koordinatalarni nusxalang"}
          >
            <MapPin className="w-3.5 h-3.5 text-amber-500" />
            {lang === "ru" ? "Открыть Яндекс.Карты" : "Yandex xaritasini ochish"}
          </a>
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

      {showMap && YMAPS_KEY && (
        <div ref={mapRef} className="w-full h-56 rounded-lg border border-slate-200 overflow-hidden mt-1" />
      )}
    </div>
  );
}
