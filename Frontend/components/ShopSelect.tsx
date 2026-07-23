"use client";

import React, { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

type ShopLike = { id: string; name?: string };

interface ShopSelectProps<T extends ShopLike> {
  shops: T[];
  value: string;
  onChange: (id: string) => void;
  /** Текст первой (пустой) опции, напр. «-- Выбрать магазин --». */
  placeholder: string;
  /** Как подписать опцию; по умолчанию — просто название магазина. */
  optionLabel?: (shop: T) => string;
  lang?: "ru" | "uz";
  /** Классы для самого <select> — чтобы форма выглядела как раньше. */
  className?: string;
  required?: boolean;
  id?: string;
}

// Магазинов в базе несколько десятков, и найти нужный в длинном выпадающем
// списке тяжело. Поэтому над select'ом всегда показываем поле поиска,
// которое фильтрует опции по названию.

export default function ShopSelect<T extends ShopLike>({
  shops,
  value,
  onChange,
  placeholder,
  optionLabel,
  lang = "ru",
  className = "",
  required,
  id,
}: ShopSelectProps<T>) {
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const matched = useMemo(
    () => (q ? shops.filter(s => (s.name || "").toLowerCase().includes(q)) : shops),
    [shops, q]
  );

  // Выбранный магазин всегда остаётся в списке, даже если не подходит под
  // запрос — иначе select потерял бы текущее значение при вводе текста.
  const visible = useMemo(() => {
    if (!q) return matched;
    const selected = shops.find(s => s.id === value && !matched.some(m => m.id === s.id));
    return selected ? [selected, ...matched] : matched;
  }, [matched, shops, value, q]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={lang === "ru" ? "Поиск магазина..." : "Do'kon qidirish..."}
          className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-slate-200 text-xs font-medium bg-white focus:outline-none focus:border-amber-400"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className={className}
      >
        <option value="">{placeholder}</option>
        {visible.map(s => (
          <option key={s.id} value={s.id}>
            {optionLabel ? optionLabel(s) : s.name}
          </option>
        ))}
      </select>
      {q && (
        <p className="text-[10px] text-slate-400">
          {matched.length > 0
            ? (lang === "ru" ? `Найдено: ${matched.length}` : `Topildi: ${matched.length}`)
            : (lang === "ru" ? "Ничего не найдено" : "Hech narsa topilmadi")}
        </p>
      )}
    </div>
  );
}
