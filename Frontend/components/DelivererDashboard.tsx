"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Truck, DollarSign, LogOut, CheckCircle2, 
  MapPin, Clipboard, Plus, Shield, Check, X, ArrowRight, Loader2,
  Calendar, Clock, Edit2, Trash2, History, User, ListFilter, Building2, BookOpen,
  Zap, AlertTriangle, RotateCcw
} from "lucide-react";
import {
  loadShops, saveShop, loadSettings, loadInventory, saveInventory,
  loadActivityLogs, addActivityLog, loadPriceHistory, updateActivityLog,
  loadEggTypes, applyComputedDebts, formatSum
} from "../lib/db-service";
import { translations, Language } from "../lib/translations";
import LocationField, { yandexRouteUrl } from "./LocationField";

interface DelivererDashboardProps {
  username: string;
  userId?: string;
  onLogout: () => void;
  lang: Language;
  setLang: (lang: Language) => void;
}

export default function DelivererDashboard({ username, userId, onLogout, lang, setLang }: DelivererDashboardProps) {
  const t = translations[lang];

  // States
  const [shops, setShops] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [inventory, setInventory] = useState<any>(null);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [eggTypes, setEggTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Tabs
  const [activeTab, setActiveTab] = useState<"route" | "journal">("route");
  const [journalPeriod, setJournalPeriod] = useState<"today" | "yesterday" | "all">("today");

  // Shop Profile state
  const [profileShopId, setProfileShopId] = useState<string | null>(null);
  const [profileStartDate, setProfileStartDate] = useState("");
  const [profileEndDate, setProfileEndDate] = useState("");

  // New shop extra fields for create
  const [newShopAddress, setNewShopAddress] = useState("");
  const [newShopNote, setNewShopNote] = useState("");

  // Inline Quick Add Shop
  const [isInlineCreateShopOpen, setIsInlineCreateShopOpen] = useState(false);
  const [inlineShopName, setInlineShopName] = useState("");
  const [inlineShopPhone, setInlineShopPhone] = useState("");
  const [inlineShopContact, setInlineShopContact] = useState("");

  // Editing state
  const [isEditLogOpen, setIsEditLogOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<any | null>(null);
  const [editingLogAmount, setEditingLogAmount] = useState(0);

  // Search & Creation states
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateShopOpen, setIsCreateShopOpen] = useState(false);
  const [newShopName, setNewShopName] = useState("");
  const [newShopContact, setNewShopContact] = useState("");
  const [newShopPhone, setNewShopPhone] = useState("");
  const [newShopDebt, setNewShopDebt] = useState(0);
  const [newShopLat, setNewShopLat] = useState<number | null>(null);
  const [newShopLng, setNewShopLng] = useState<number | null>(null);
  const [creatingShop, setCreatingShop] = useState(false);

  // Forms
  const [isCollectOpen, setIsCollectOpen] = useState(false);
  const [isSaleOpen, setIsSaleOpen] = useState(false);
  const [isReturnOpen, setIsReturnOpen] = useState(false);

  // Возврат-возмещение (строго по штукам)
  const [returnEggType, setReturnEggType] = useState("c0");
  const [returnQty, setReturnQty] = useState(0);
  const [returnComment, setReturnComment] = useState("");

  // Selection
  const [selectedShopId, setSelectedShopId] = useState("");
  
  // Payment input
  const [collectAmount, setCollectAmount] = useState(0);
  const [collectType, setCollectType] = useState<"cash" | "card" | "transfer">("cash");
  const [collectComment, setCollectComment] = useState("");

  // Sale input (multi-line items per ТЗ п.4.4)
  const todayISO = new Date().toISOString().split("T")[0];
  const [saleItems, setSaleItems] = useState<{ eggType: string; qtyType: "boxes" | "trays"; qty: number }[]>([
    { eggType: "c0", qtyType: "boxes", qty: 0 },
  ]);
  const [saleReceived, setSaleReceived] = useState(0);
  const [salePayMethod, setSalePayMethod] = useState<"cash" | "card" | "transfer">("cash");
  const [saleDate, setSaleDate] = useState<string>(todayISO);

  // Confirmation screen after a saved operation (ТЗ п.4.4 шаг 6 / п.6)
  const [confirmResult, setConfirmResult] = useState<null | {
    title: string;
    lines: { label: string; value: string; strong?: boolean }[];
    newDebt: number;
    shopName: string;
  }>(null);

  // Toasts
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Load Initial Data
  const loadData = async () => {
    try {
      setLoading(true);
      const [shps, sett, inv, prcs, logs, eggTyps] = await Promise.all([
        loadShops(),
        loadSettings(),
        loadInventory(),
        loadPriceHistory(),
        loadActivityLogs(),
        loadEggTypes(),
      ]);
      const logsData = logs || [];
      setShops(applyComputedDebts(shps, logsData));
      setSettings(sett);
      setInventory(inv);
      setPriceHistory(prcs);
      setActivityLogs(logsData);
      setEggTypes(eggTyps || []);
    } catch (e) {
      showToast("Ошибка при загрузке данных", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pricing helpers (ТЗ п.4.2/4.4 — price is taken from the catalog automatically)
  const eggsPerTray = settings?.eggsPerTray || 30;
  const traysPerBox = settings?.traysPerBox || 12;

  const pricePerTrayFor = (eggTypeId: string): number => {
    const e = eggTypes.find(x => x.id === eggTypeId);
    if (e) return e.pricePerTray;
    // Legacy fallback (per-egg default prices → per tray)
    const perEgg = eggTypeId === "c0" ? 1500 : eggTypeId === "c1" ? 1300 : 1800;
    return perEgg * eggsPerTray;
  };

  const traysForItem = (item: { qtyType: "boxes" | "trays"; qty: number }): number =>
    item.qtyType === "boxes" ? item.qty * traysPerBox : item.qty;

  const lineTotal = (item: { eggType: string; qtyType: "boxes" | "trays"; qty: number }): number =>
    traysForItem(item) * pricePerTrayFor(item.eggType);

  const saleTotal = useMemo(
    () => saleItems.reduce((sum, it) => sum + lineTotal(it), 0),
    [saleItems, eggTypes, settings]
  );
  const saleDebtDelta = saleTotal - saleReceived; // >0 = в долг, <0 = аванс

  const resetSaleForm = () => {
    setSaleItems([{ eggType: "c0", qtyType: "boxes", qty: 0 }]);
    setSaleReceived(0);
    setSalePayMethod("cash");
    setSaleDate(todayISO);
    setIsInlineCreateShopOpen(false);
  };

  // Filter shops based on search query
  const filteredShops = useMemo(() => {
    const activeShops = shops.filter(shop => !shop.isArchived);
    if (!searchQuery.trim()) return activeShops;
    const q = searchQuery.toLowerCase().trim();
    return activeShops.filter(shop => 
      shop.name?.toLowerCase().includes(q) ||
      shop.contact?.toLowerCase().includes(q) ||
      shop.phone?.toLowerCase().includes(q)
    );
  }, [shops, searchQuery]);

  // Similarity / duplicate check for shops
  const similarShops = useMemo(() => {
    if (!newShopName || newShopName.trim().length < 2) return [];
    const val = newShopName.toLowerCase().trim();
    return shops.filter(s => s.name?.toLowerCase().includes(val));
  }, [shops, newShopName]);

  // Handle Create Shop Submit
  const handleCreateShopSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShopName.trim()) {
      showToast(lang === "ru" ? "Введите название магазина" : "Do'kon nomini kiriting", "error");
      return;
    }

    try {
      setCreatingShop(true);
      const id = "shop_" + Date.now();
      const newShop = {
        id,
        name: newShopName.trim(),
        contact: newShopContact.trim() || "—",
        phone: newShopPhone.trim() || "—",
        debt: Number(newShopDebt) || 0,
        lastPurchaseDate: null,
        lastPaymentDate: null,
        address: newShopAddress.trim(),
        note: newShopNote.trim(),
        lat: newShopLat,
        lng: newShopLng,
        isArchived: false,
      };

      await saveShop(newShop);
      showToast(lang === "ru" ? "Магазин успешно создан!" : "Do'kon muvaffaqiyatli yaratildi!", "success");

      // Reset form
      setNewShopName("");
      setNewShopContact("");
      setNewShopPhone("");
      setNewShopDebt(0);
      setNewShopAddress("");
      setNewShopNote("");
      setNewShopLat(null);
      setNewShopLng(null);
      setIsCreateShopOpen(false);

      // Log creation
      await addActivityLog({
        timestamp: new Date().toISOString(),
        type: "payment",
        message: lang === "ru" 
          ? `Создан новый магазин: ${newShop.name} (долг: ${newShop.debt.toLocaleString()} сум)` 
          : `Yangi do'kon yaratildi: ${newShop.name} (nasiya: ${newShop.debt.toLocaleString()} so'm)`,
        amount: newShop.debt,
        operator: `${username} (доставщик)`,
      });

      // Reload data
      await loadData();
      setSelectedShopId(id);
    } catch (err) {
      showToast(lang === "ru" ? "Ошибка создания магазина" : "Do'kon yaratishda xatolik", "error");
    } finally {
      setCreatingShop(false);
    }
  };

  // Handle Collection Submit
  const handleCollectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShopId || collectAmount <= 0) {
      showToast(t.errorFillAll, "error");
      return;
    }

    try {
      const shop = shops.find(s => s.id === selectedShopId);
      if (!shop) return;

      // Debt is derived from operations — we only append a payment entry.
      // Overpayment becomes переплата/аванс (negative debt), never lost (ТЗ п.4.5/5.2).
      const newDebt = shop.debt - collectAmount;

      const payLabelRu = collectType === "cash" ? "Наличные" : collectType === "transfer" ? "Перечисление" : "Клик";
      const payLabelUz = collectType === "cash" ? "Naqd" : collectType === "transfer" ? "O'tkazma" : "Klik";
      const paymentMsg = lang === "ru"
        ? `Приём оплаты: ${shop.name} | ${formatSum(collectAmount, "ru")} (${payLabelRu})${collectComment ? ` — ${collectComment}` : ""}`
        : `To'lov qabul qilish: ${shop.name} | ${formatSum(collectAmount, "uz")} (${payLabelUz})${collectComment ? ` — ${collectComment}` : ""}`;

      await addActivityLog({
        timestamp: new Date().toISOString(),
        operationDate: new Date().toISOString(),
        type: "payment",
        message: paymentMsg,
        amount: collectAmount,
        operator: `${username} (доставщик)`,
        operatorUsername: username,
        shopId: shop.id,
        paymentType: collectType,
        comment: collectComment || "",
      });

      setIsCollectOpen(false);
      setConfirmResult({
        title: lang === "ru" ? "Оплата принята" : "To'lov qabul qilindi",
        shopName: shop.name,
        newDebt,
        lines: [
          { label: lang === "ru" ? "Получено" : "Qabul qilindi", value: formatSum(collectAmount, lang), strong: true },
          { label: lang === "ru" ? "Способ" : "Usul", value: collectType === "cash" ? t.cash : collectType === "transfer" ? t.transfer : t.card },
        ],
      });
      setCollectAmount(0);
      setCollectComment("");
      setSelectedShopId("");
      await loadData();
    } catch (err) {
      showToast("Ошибка записи платежа", "error");
    }
  };

  // Similar/duplicate check for inline shop creation
  const inlineSimilarShops = useMemo(() => {
    if (!inlineShopName || inlineShopName.trim().length < 2) return [];
    const val = inlineShopName.toLowerCase().trim();
    return shops.filter(s => s.name?.toLowerCase().includes(val));
  }, [shops, inlineShopName]);

  // Handle Inline Shop Creation from within Sales Form
  const handleInlineCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineShopName.trim()) {
      showToast(lang === "ru" ? "Введите название магазина" : "Do'kon nomini kiriting", "error");
      return;
    }

    try {
      const id = "shop_" + Date.now();
      const newShop = {
        id,
        name: inlineShopName.trim(),
        contact: inlineShopContact.trim() || "",
        phone: inlineShopPhone.trim() || "—",
        debt: 0,
        lastPurchaseDate: null,
        lastPaymentDate: null,
        address: "",
        note: "",
        isArchived: false
      };

      await saveShop(newShop);
      showToast(lang === "ru" ? "Магазин успешно создан!" : "Do'kon muvaffaqiyatli yaratildi!", "success");

      // Log creation
      await addActivityLog({
        timestamp: new Date().toISOString(),
        type: "payment",
        message: lang === "ru" 
          ? `Создан новый магазин (прямо из продажи): ${newShop.name}` 
          : `Yangi do'kon yaratildi (sotuv vaqtida): ${newShop.name}`,
        amount: 0,
        operator: `${username} (доставщик)`,
      });

      // Reset inline form fields
      setInlineShopName("");
      setInlineShopContact("");
      setInlineShopPhone("");
      setIsInlineCreateShopOpen(false);

      // Reload shops list and automatically select this new shop
      await loadData();
      setSelectedShopId(id);
    } catch (err) {
      showToast(lang === "ru" ? "Ошибка создания магазина" : "Do'kon yaratishda xatolik", "error");
    }
  };

  // Handle Sale Submit (multi-line, partial payment, advance, price snapshot)
  const handleSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = saleItems.filter(it => it.qty > 0);
    if (!selectedShopId || validItems.length === 0) {
      showToast(t.errorFillAll, "error");
      return;
    }

    try {
      const shop = shops.find(s => s.id === selectedShopId);
      if (!shop) return;

      // Build item snapshots (price fixed at moment of sale — ТЗ п.4.2/5.4)
      const items = validItems.map(it => {
        const eggObj = eggTypes.find(eg => eg.id === it.eggType);
        const trays = traysForItem(it);
        const pricePerTray = pricePerTrayFor(it.eggType);
        return {
          eggType: it.eggType,
          nameRu: eggObj?.nameRu || it.eggType.toUpperCase(),
          nameUz: eggObj?.nameUz || it.eggType.toUpperCase(),
          qtyType: it.qtyType,
          qty: it.qty,
          trays,
          pricePerTray,
          lineTotal: trays * pricePerTray,
        };
      });

      const total = items.reduce((s, i) => s + i.lineTotal, 0);
      const received = Math.max(0, Number(saleReceived) || 0);
      const debtDelta = total - received;
      const newDebt = shop.debt + debtDelta;

      // Update warehouse stock per item (best-effort, not a ТЗ requirement)
      const newInv = { ...(inventory || {}) };
      for (const i of items) {
        newInv[i.eggType] = Math.max(0, (newInv[i.eggType] || 0) - i.trays);
      }
      await saveInventory(newInv);

      const itemsSummary = items
        .map(i => `${i.qty} ${i.qtyType === "boxes" ? (lang === "ru" ? "кор." : "quti") : (lang === "ru" ? "лотк." : "lagan")} ${lang === "ru" ? i.nameRu : i.nameUz}`)
        .join(", ");

      const logMsg = lang === "ru"
        ? `Продажа: ${shop.name} | ${itemsSummary} | Итого ${formatSum(total, "ru")}, получено ${formatSum(received, "ru")}, в долг ${formatSum(debtDelta, "ru")}`
        : `Sotuv: ${shop.name} | ${itemsSummary} | Jami ${formatSum(total, "uz")}, qabul ${formatSum(received, "uz")}, nasiya ${formatSum(debtDelta, "uz")}`;

      const operationDate = saleDate ? new Date(saleDate + "T12:00:00").toISOString() : new Date().toISOString();

      await addActivityLog({
        timestamp: new Date().toISOString(),
        operationDate,
        type: "sale",
        message: logMsg,
        items,
        total,
        received,
        amount: total,
        debtDelta,
        paymentType: received > 0 ? salePayMethod : "debt",
        operator: `${username} (доставщик)`,
        operatorUsername: username,
        shopId: shop.id,
        manualDate: saleDate !== todayISO,
      });

      setIsSaleOpen(false);
      setConfirmResult({
        title: lang === "ru" ? "Продажа сохранена" : "Sotuv saqlandi",
        shopName: shop.name,
        newDebt,
        lines: [
          { label: lang === "ru" ? "Итого к оплате" : "Jami to'lov", value: formatSum(total, lang), strong: true },
          { label: lang === "ru" ? "Получено" : "Qabul qilindi", value: formatSum(received, lang) },
          {
            label: debtDelta >= 0 ? (lang === "ru" ? "В долг" : "Nasiya") : (lang === "ru" ? "Аванс" : "Avans"),
            value: formatSum(Math.abs(debtDelta), lang),
          },
        ],
      });
      resetSaleForm();
      setSelectedShopId("");
      await loadData();
    } catch (err) {
      showToast("Ошибка при оформлении продажи", "error");
    }
  };

  // Возврат-возмещение: строго по штукам, той же категорией. Долг НЕ меняется.
  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Math.floor(Number(returnQty) || 0);
    if (!selectedShopId || qty <= 0) {
      showToast(t.errorFillAll, "error");
      return;
    }
    try {
      const shop = shops.find(s => s.id === selectedShopId);
      if (!shop) return;
      const eggObj = eggTypes.find(eg => eg.id === returnEggType);
      const eggName = eggObj ? (lang === "ru" ? eggObj.nameRu : eggObj.nameUz) : returnEggType.toUpperCase();

      const logMsg = lang === "ru"
        ? `Возврат (возмещение): ${shop.name} | ${qty} шт ${eggName}${returnComment ? ` — ${returnComment}` : ""}`
        : `Qaytarish (o'rnini bosish): ${shop.name} | ${qty} dona ${eggName}${returnComment ? ` — ${returnComment}` : ""}`;

      await addActivityLog({
        timestamp: new Date().toISOString(),
        operationDate: new Date().toISOString(),
        type: "return",
        message: logMsg,
        eggType: returnEggType,
        qtyPieces: qty,
        amount: 0,
        operator: `${username} (доставщик)`,
        operatorUsername: username,
        shopId: shop.id,
        comment: returnComment || "",
      });

      setIsReturnOpen(false);
      setConfirmResult({
        title: lang === "ru" ? "Возврат оформлен" : "Qaytarish rasmiylashtirildi",
        shopName: shop.name,
        newDebt: shop.debt,
        lines: [
          { label: lang === "ru" ? "Категория" : "Kategoriya", value: eggName, strong: true },
          { label: lang === "ru" ? "Возвращено (шт)" : "Qaytarildi (dona)", value: String(qty) },
          { label: lang === "ru" ? "Возмещение" : "O'rnini bosish", value: lang === "ru" ? "той же категорией" : "shu kategoriya bilan" },
        ],
      });
      setReturnEggType("c0");
      setReturnQty(0);
      setReturnComment("");
      setSelectedShopId("");
      await loadData();
    } catch (err) {
      showToast(lang === "ru" ? "Ошибка при оформлении возврата" : "Qaytarishda xatolik", "error");
    }
  };

  // Cancel Operation (with 24 hours constraint checking)
  const handleCancelLog = async (log: any) => {
    const hoursSinceCreation = (Date.now() - new Date(log.timestamp).getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreation > 24) {
      showToast(
        lang === "ru"
          ? "Прошло более 24 часов. Операцию может отменить только администратор."
          : "24 soatdan ko'p vaqt o'tdi. Amaliyotni faqat admin bekor qilishi mumkin.",
        "error"
      );
      return;
    }

    try {
      const shop = shops.find(s => s.id === log.shopId);

      // Debt is derived — cancelling a ledger entry automatically removes its
      // effect on reload; we only need to return stock and flag the entry.
      if (Array.isArray(log.items) && log.items.length > 0) {
        const newInv = { ...(inventory || {}) };
        for (const i of log.items) {
          if (i.eggType) newInv[i.eggType] = (newInv[i.eggType] || 0) + (i.trays || 0);
        }
        await saveInventory(newInv);
      } else if (log.traysUsed && log.eggType) {
        const newInv = { ...(inventory || {}) };
        newInv[log.eggType] = (newInv[log.eggType] || 0) + log.traysUsed;
        await saveInventory(newInv);
      }

      // Update log
      await updateActivityLog(log.id, {
        isCancelled: true,
        message: lang === "ru" 
          ? `[ОТМЕНЕНО] ${log.message}` 
          : `[BEKOR QILINGAN] ${log.message}`
      });

      // Write audit journal (type "audit" — does not affect derived debt)
      await addActivityLog({
        timestamp: new Date().toISOString(),
        type: "audit",
        message: lang === "ru"
          ? `Доставщик ${username} отменил операцию #${log.id}: ${log.message}`
          : `Yetkazib beruvchi ${username} #${log.id} amaliyotni bekor qildi: ${log.message}`,
        amount: 0,
        operator: `${username} (доставщик)`,
        operatorUsername: username,
        shopId: shop?.id || log.shopId,
      });

      showToast(
        lang === "ru" ? "Операция успешно отменена!" : "Amaliyot muvaffaqiyatli bekor qilindi!",
        "success"
      );
      await loadData();
    } catch (err) {
      showToast("Ошибка при отмене операции", "error");
    }
  };

  // Edit Operation (with 24 hours constraint checking)
  const handleEditLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLog || editingLogAmount <= 0) return;

    const hoursSinceCreation = (Date.now() - new Date(editingLog.timestamp).getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreation > 24) {
      showToast(
        lang === "ru"
          ? "Прошло более 24 часов. Изменение возможно только через администратора."
          : "24 soatdan ko'p vaqt o'tdi. O'zgartirish faqat admin orqali amalga oshiriladi.",
        "error"
      );
      return;
    }

    try {
      const shop = shops.find(s => s.id === editingLog.shopId);
      const oldAmount = editingLog.type === "sale"
        ? (editingLog.total ?? editingLog.amount ?? 0)
        : (editingLog.amount ?? 0);

      // Debt is derived — we just update the ledger entry; recompute on reload.
      const updateFields: any = {
        amount: editingLogAmount,
        isEdited: true,
        originalAmount: oldAmount,
      };
      if (editingLog.type === "sale") {
        // New total; received is preserved, debt portion recomputes automatically.
        updateFields.total = editingLogAmount;
      }
      const cleanMsg = String(editingLog.message).replace(/ \| \d[\d\s,]* сум/g, "").replace(/ \| \d[\d\s,]* so'm/g, "");
      updateFields.message = lang === "ru"
        ? `${cleanMsg} | ${formatSum(editingLogAmount, "ru")} (Изменено)`
        : `${cleanMsg} | ${formatSum(editingLogAmount, "uz")} (O'zgartirildi)`;

      await updateActivityLog(editingLog.id, updateFields);

      // Audit trail (type "audit" — does not affect derived debt)
      await addActivityLog({
        timestamp: new Date().toISOString(),
        type: "audit",
        message: lang === "ru"
          ? `Доставщик ${username} изменил сумму операции #${editingLog.id} с ${formatSum(oldAmount, "ru")} на ${formatSum(editingLogAmount, "ru")}`
          : `Yetkazib beruvchi ${username} #${editingLog.id} summasini ${formatSum(oldAmount, "uz")} dan ${formatSum(editingLogAmount, "uz")} ga o'zgartirdi`,
        amount: 0,
        operator: `${username} (доставщик)`,
        operatorUsername: username,
        shopId: shop?.id || editingLog.shopId,
      });

      showToast(
        lang === "ru" ? "Сумма успешно обновлена!" : "Summa muvaffaqiyatli yangilandi!",
        "success"
      );
      setIsEditLogOpen(false);
      setEditingLog(null);
      await loadData();
    } catch (err) {
      showToast("Ошибка при изменении операции", "error");
    }
  };

  // Filtered My Operations for the Selected Period
  const filteredMyOperations = useMemo(() => {
    // Только свои операции — по стабильному id (имя ненадёжно: пересечения имён
    // давали чужие операции). Fallback по имени — для логов без operatorId.
    const myLogs = activityLogs.filter(log =>
      userId && log.operatorId != null && String(log.operatorId) !== ""
        ? String(log.operatorId) === String(userId)
        : (log.operatorUsername === username)
    );
    if (journalPeriod === "all") return myLogs;

    const now = new Date();
    return myLogs.filter(log => {
      if (!log.timestamp) return false;
      const logDate = new Date(log.timestamp);
      if (journalPeriod === "today") {
        return logDate.toDateString() === now.toDateString();
      } else if (journalPeriod === "yesterday") {
        const yesterday = new Date();
        yesterday.setDate(now.getDate() - 1);
        return logDate.toDateString() === yesterday.toDateString();
      }
      return true;
    });
  }, [activityLogs, journalPeriod, username]);

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 overflow-hidden font-sans text-slate-900">
      
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm flex items-center gap-2.5 transition-all animate-bounce ${
          toast.type === "success" 
            ? "bg-slate-900 text-amber-400 border-slate-800" 
            : "bg-red-900 text-red-100 border-red-800"
        }`}>
          <CheckCircle2 className="w-4 h-4" />
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      {/* Confirmation screen after a saved operation (ТЗ п.4.4 шаг 6 / п.6) */}
      {confirmResult && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in-50">
          <div className="bg-white w-full max-w-sm rounded-2xl border border-slate-200 overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="bg-emerald-600 p-5 text-white flex flex-col items-center gap-2">
              <CheckCircle2 className="w-10 h-10" />
              <span className="font-bold text-base">{confirmResult.title}</span>
              <span className="text-emerald-50 text-xs font-medium">{confirmResult.shopName}</span>
            </div>
            <div className="p-5 flex flex-col gap-2.5">
              {confirmResult.lines.map((l, i) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">{l.label}</span>
                  <span className={`font-mono ${l.strong ? "font-extrabold text-slate-900" : "font-semibold text-slate-700"}`}>{l.value}</span>
                </div>
              ))}
              <div className={`mt-1 flex justify-between items-center rounded-lg px-3.5 py-3 border ${confirmResult.newDebt > 0 ? "bg-red-50 border-red-100" : "bg-emerald-50 border-emerald-100"}`}>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {confirmResult.newDebt >= 0 ? (lang === "ru" ? "Новый долг магазина" : "Do'konning yangi qarzi") : (lang === "ru" ? "Аванс магазина" : "Do'kon avansi")}
                </span>
                <span className={`font-mono font-extrabold text-lg ${confirmResult.newDebt > 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {formatSum(Math.abs(confirmResult.newDebt), lang)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setConfirmResult(null)}
                className="mt-2 w-full py-2.5 bg-slate-900 text-white font-bold text-sm rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {lang === "ru" ? "Готово" : "Tayyor"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <header className="h-16 bg-slate-900 text-white px-4 shrink-0 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-amber-400" />
          <span className="font-bold tracking-tight text-base">EggLogistics <span className="text-amber-400 text-[10px] font-mono">Mobile</span></span>
        </div>

        <div className="flex items-center gap-3">
          {/* Language Toggle */}
          <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700">
            <button 
              onClick={() => setLang("ru")}
              className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                lang === "ru" ? "bg-amber-400 text-slate-900 shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              RU
            </button>
            <button 
              onClick={() => setLang("uz")}
              className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                lang === "uz" ? "bg-amber-400 text-slate-900 shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              UZ
            </button>
          </div>

          <button 
            onClick={onLogout}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors cursor-pointer"
            title={t.backToLogin}
          >
            <LogOut className="w-4 h-4 text-amber-400" />
          </button>
        </div>
      </header>

      {/* User Card */}
      <div className="bg-slate-900 text-white px-4 py-3 shrink-0 flex items-center justify-between border-t border-slate-800/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-amber-400 text-slate-900 rounded-full flex items-center justify-center font-bold text-xs">
            {username[0]}
          </div>
          <div>
            <p className="text-xs font-bold">{username}</p>
            <p className="text-[10px] text-amber-400 font-mono flex items-center gap-1 uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse"></span>
              {t.onRoute}
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-[9px] text-slate-400 uppercase tracking-wider">{t.pointsToDeliver}</p>
          <p className="text-sm font-bold font-mono text-white">
            {shops.length} {t.point}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 gap-3">
          <Loader2 className="w-8 h-8 text-slate-950 animate-spin" />
          <span className="font-mono text-[10px] text-slate-400 tracking-wider uppercase">Syncing local route...</span>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 pb-20">
          
          {/* Tab Selector */}
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab("route")}
              className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === "route" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <MapPin className="w-4 h-4 text-amber-500" />
              <span>{lang === "ru" ? "Маршрут" : "Yo'nalish"}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("journal")}
              className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === "journal" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <BookOpen className="w-4 h-4 text-amber-500" />
              <span>{lang === "ru" ? "Мои операции" : "Mening amaliyotlarim"}</span>
            </button>
          </div>

          {activeTab === "route" ? (
            <>
              {/* Main Quick Action Panels */}
              <div className="grid grid-cols-3 gap-3 shrink-0">
                <button
                  onClick={() => {
                    setIsCollectOpen(true);
                    setIsSaleOpen(false);
                    setIsReturnOpen(false);
                  }}
                  className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 shadow-sm flex flex-col items-center justify-center text-center gap-1.5 hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  <DollarSign className="w-5 h-5 text-amber-400" />
                  <span className="text-[11px] font-bold">{t.collectCash}</span>
                </button>

                <button
                  onClick={() => {
                    setIsSaleOpen(true);
                    setIsCollectOpen(false);
                    setIsReturnOpen(false);
                  }}
                  className="bg-white text-slate-900 p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center gap-1.5 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <Plus className="w-5 h-5 text-slate-900" />
                  <span className="text-[11px] font-bold">{t.recordSale}</span>
                </button>

                <button
                  onClick={() => {
                    setIsReturnOpen(true);
                    setIsSaleOpen(false);
                    setIsCollectOpen(false);
                  }}
                  className="bg-white text-slate-900 p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center gap-1.5 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-5 h-5 text-orange-500" />
                  <span className="text-[11px] font-bold">{lang === "ru" ? "Возврат" : "Qaytarish"}</span>
                </button>
              </div>

              {/* List of Customers on Route */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden min-h-[300px]">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-1.5 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t.route}</h2>
                  </div>
                  <button 
                    onClick={() => {
                      setNewShopName("");
                      setIsCreateShopOpen(true);
                    }}
                    className="flex items-center gap-1 text-[10px] bg-slate-900 text-amber-400 font-bold px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{lang === "ru" ? "Добавить точку" : "Yangi nuqta qo'shish"}</span>
                  </button>
                </div>

                {/* Search Input */}
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 shrink-0">
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={lang === "ru" ? "Поиск по названию или контакту..." : "Nomi yoki kontakti bo'yicha qidirish..."}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-amber-400 bg-white font-medium"
                  />
                </div>

                <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
                  {filteredShops.length === 0 ? (
                    <div className="p-8 text-center flex flex-col items-center justify-center gap-3">
                      <p className="text-xs text-slate-400 font-medium">
                        {lang === "ru" ? "Ничего не найдено" : "Hech narsa topilmadi"}
                      </p>
                      {searchQuery.trim() && (
                        <button
                          onClick={() => {
                            setNewShopName(searchQuery.trim());
                            setIsCreateShopOpen(true);
                          }}
                          className="flex items-center gap-1.5 text-xs bg-amber-400 text-slate-900 font-bold px-3 py-1.5 rounded-lg hover:bg-amber-500 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{lang === "ru" ? `Создать "${searchQuery.trim()}"` : `Yangi "${searchQuery.trim()}" yaratish`}</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    filteredShops.map((shop) => (
                      <div 
                        key={shop.id} 
                        onClick={() => setProfileShopId(shop.id)}
                        className="p-4 flex justify-between items-center hover:bg-slate-50 cursor-pointer transition-all border-b border-slate-100 last:border-0 active:bg-slate-100"
                      >
                        <div className="flex-1">
                          <p className="font-bold text-slate-800 text-sm font-serif italic flex items-center gap-1 hover:text-amber-600 transition-colors">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            {shop.name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">{shop.contact} ({shop.phone})</p>
                        </div>

                        <div className="text-right flex flex-col gap-1.5">
                          <p className={`text-xs font-mono font-bold ${shop.debt > 0 ? "text-red-600" : "text-slate-400"}`}>
                            {shop.debt > 0 ? `${shop.debt.toLocaleString()} сум` : "0 сум"}
                          </p>
                          <div className="flex gap-1.5 justify-end">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedShopId(shop.id);
                                setIsCollectOpen(true);
                                setIsSaleOpen(false);
                              }}
                              className="p-1 px-2 text-[9px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded transition-colors cursor-pointer"
                              title={lang === "ru" ? "Принять оплату" : "To'lov qabul qilish"}
                            >
                              $
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedShopId(shop.id);
                                setIsSaleOpen(true);
                                setIsCollectOpen(false);
                              }}
                              className="p-1 px-2 text-[9px] font-bold bg-amber-400 hover:bg-amber-500 text-slate-900 rounded transition-colors cursor-pointer"
                              title={lang === "ru" ? "Оформить продажу" : "Sotuv rasmiylashtirish"}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Journal / Operations View */
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden min-h-[400px]">
              <div className="px-4 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0 bg-slate-50">
                <div className="flex items-center gap-1.5">
                  <History className="w-4 h-4 text-slate-500" />
                  <h2 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    {lang === "ru" ? "Журнал моих операций" : "Mening amaliyotlarim jurnali"}
                  </h2>
                </div>

                {/* Period Selector */}
                <div className="flex bg-slate-200 rounded-lg p-0.5 border border-slate-300 self-start sm:self-auto shrink-0">
                  <button 
                    onClick={() => setJournalPeriod("today")}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                      journalPeriod === "today" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {lang === "ru" ? "Сегодня" : "Bugun"}
                  </button>
                  <button 
                    onClick={() => setJournalPeriod("yesterday")}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                      journalPeriod === "yesterday" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {lang === "ru" ? "Вчера" : "Kecha"}
                  </button>
                  <button 
                    onClick={() => setJournalPeriod("all")}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                      journalPeriod === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {lang === "ru" ? "Все" : "Hammasi"}
                  </button>
                </div>
              </div>

              {/* Operations List */}
              <div className="divide-y divide-slate-100 overflow-y-auto flex-1 p-2 gap-2 flex flex-col">
                {filteredMyOperations.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs font-medium">
                    {lang === "ru" ? "Операций за этот период не найдено." : "Ushbu davr uchun amaliyotlar topilmadi."}
                  </div>
                ) : (
                  filteredMyOperations.map((log: any) => {
                    const timeStr = log.timestamp ? new Date(log.timestamp).toLocaleTimeString(lang === "ru" ? "ru-RU" : "uz-UZ", { hour: "2-digit", minute: "2-digit" }) : "";
                    const dateStr = log.timestamp ? new Date(log.timestamp).toLocaleDateString(lang === "ru" ? "ru-RU" : "uz-UZ", { month: "short", day: "numeric" }) : "";
                    
                    const hoursSinceCreation = (Date.now() - new Date(log.timestamp).getTime()) / (1000 * 60 * 60);
                    const canModify = hoursSinceCreation <= 24 && !log.isCancelled;

                    return (
                      <div 
                        key={log.id} 
                        className={`p-3.5 rounded-xl border transition-all ${
                          log.isCancelled 
                            ? "bg-slate-50 border-slate-150 opacity-60" 
                            : log.type === "payment" && !log.qty
                              ? "bg-emerald-50/50 border-emerald-100" 
                              : "bg-amber-50/50 border-amber-100"
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`px-2 py-0.5 text-[8px] font-bold uppercase rounded-md tracking-wider ${
                                log.isCancelled
                                  ? "bg-slate-200 text-slate-600"
                                  : log.type === "return"
                                    ? "bg-orange-100 text-orange-800"
                                    : log.type === "payment" && !log.qty
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-amber-100 text-amber-800"
                              }`}>
                                {log.isCancelled
                                  ? (lang === "ru" ? "Отменено" : "Bekor qilingan")
                                  : log.type === "return"
                                    ? (lang === "ru" ? "Возврат" : "Qaytarish")
                                    : log.type === "payment" && !log.qty
                                      ? (lang === "ru" ? "Оплата" : "To'lov")
                                      : (lang === "ru" ? "Продажа" : "Sotuv")}
                              </span>

                              {log.isEdited && (
                                <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 text-[8px] font-bold uppercase rounded-md">
                                  {lang === "ru" ? "Изменено" : "O'zgartirilgan"}
                                </span>
                              )}

                              <span className="text-[10px] text-slate-400 font-mono">
                                {dateStr} {timeStr}
                              </span>
                            </div>
                            
                            <p className={`text-xs font-semibold mt-1.5 ${log.isCancelled ? "line-through text-slate-400" : "text-slate-800"}`}>
                              {log.message}
                            </p>

                            <p className="text-[9px] text-slate-400 font-mono mt-0.5 uppercase tracking-wide">
                              ID: #{log.id}
                            </p>
                          </div>

                          <div className="text-right flex flex-col items-end gap-1 shrink-0">
                            <span className="font-mono font-bold text-xs text-slate-900">
                              {log.type === "return" ? `${log.qtyPieces ?? 0} ${lang === "ru" ? "шт" : "dona"}` : `${log.amount?.toLocaleString()} сум`}
                            </span>

                            {/* Action Buttons: Edit & Cancel (within 24 hrs) */}
                            {canModify ? (
                              <div className="flex gap-1 mt-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingLog(log);
                                    setEditingLogAmount(log.amount);
                                    setIsEditLogOpen(true);
                                  }}
                                  className="p-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-600 hover:text-slate-900 transition-colors cursor-pointer flex items-center justify-center"
                                  title={lang === "ru" ? "Исправить сумму" : "Summani o'zgartirish"}
                                >
                                  <Edit2 className="w-3 h-3 text-blue-600" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm(lang === "ru" ? "Вы уверены, что хотите отменить (откатить) эту операцию?" : "Haqiqatan ham ushbu amaliyotni bekor qilmoqchimisiz?")) {
                                      handleCancelLog(log);
                                    }
                                  }}
                                  className="p-1 bg-white hover:bg-red-50 border border-slate-200 rounded text-slate-600 hover:text-red-600 transition-colors cursor-pointer flex items-center justify-center"
                                  title={lang === "ru" ? "Отменить операцию" : "Amaliyotni bekor qilish"}
                                >
                                  <Trash2 className="w-3 h-3 text-red-600" />
                                </button>
                              </div>
                            ) : (
                              !log.isCancelled && (
                                <span className="text-[9px] text-slate-400 font-bold mt-2 uppercase tracking-wide flex items-center gap-1">
                                  <Shield className="w-3 h-3 text-slate-300" />
                                  {lang === "ru" ? "Через админа" : "Admin orqali"}
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Collapsible Action Modal: Collect Payment */}
          {/* Возврат-возмещение (строго по штукам) */}
          {isReturnOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in-50">
              <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl border-t sm:border border-slate-200 overflow-hidden shadow-2xl animate-in slide-in-from-bottom-24">
                <div className="bg-slate-900 p-4 text-white flex justify-between items-center border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="w-5 h-5 text-orange-400" />
                    <span className="font-bold text-sm">{lang === "ru" ? "Возврат (возмещение)" : "Qaytarish (o'rnini bosish)"}</span>
                  </div>
                  <button onClick={() => setIsReturnOpen(false)} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleReturnSubmit} className="p-5 flex flex-col gap-4">
                  <div className="bg-orange-50 border border-orange-100 text-orange-800 rounded-lg px-3 py-2 text-[11px] leading-snug">
                    {lang === "ru"
                      ? "Возврат = возмещение той же категорией, строго по штукам. Деньги не возвращаются, долг не меняется."
                      : "Qaytarish = shu kategoriya bilan o'rnini bosish, faqat donada. Pul qaytarilmaydi, qarz o'zgarmaydi."}
                  </div>

                  {/* Shop */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t.selectShop}</label>
                    <select
                      value={selectedShopId}
                      onChange={(e) => setSelectedShopId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:border-amber-400 bg-white"
                      required
                    >
                      <option value="">-- {lang === "ru" ? "Выбрать" : "Tanlash"} --</option>
                      {shops.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Egg category */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{lang === "ru" ? "Категория яиц" : "Tuxum kategoriyasi"}</label>
                    <select
                      value={returnEggType}
                      onChange={(e) => setReturnEggType(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:border-amber-400 bg-white"
                      required
                    >
                      {eggTypes.map(eg => (
                        <option key={eg.id} value={eg.id}>{lang === "ru" ? eg.nameRu : eg.nameUz}</option>
                      ))}
                    </select>
                  </div>

                  {/* Quantity in pieces (strictly) */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{lang === "ru" ? "Количество (штук)" : "Miqdori (dona)"}</label>
                    <input
                      type="number" min="1" step="1" inputMode="numeric"
                      placeholder={lang === "ru" ? "Сколько штук возместить" : "Necha dona"}
                      value={returnQty || ""}
                      onChange={(e) => setReturnQty(Math.max(0, Math.floor(Number(e.target.value))))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold focus:outline-none focus:border-amber-400 font-mono"
                      required
                    />
                  </div>

                  {/* Comment */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{lang === "ru" ? "Комментарий (необязательно)" : "Izoh (ixtiyoriy)"}</label>
                    <input
                      type="text"
                      placeholder={lang === "ru" ? "Например: бой при доставке" : "Masalan: yetkazishda siniq"}
                      value={returnComment}
                      onChange={(e) => setReturnComment(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:border-amber-400 bg-white"
                    />
                  </div>

                  <div className="flex gap-3 mt-1">
                    <button type="button" onClick={() => setIsReturnOpen(false)} className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-500 font-bold text-xs hover:bg-slate-50 transition-all cursor-pointer">
                      {lang === "ru" ? "Отмена" : "Bekor"}
                    </button>
                    <button type="submit" className="flex-1 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5">
                      <RotateCcw className="w-4 h-4" />
                      {lang === "ru" ? "Оформить возврат" : "Qaytarishni rasmiylashtirish"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {isCollectOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in-50">
              <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl border-t sm:border border-slate-200 overflow-hidden shadow-2xl animate-in slide-in-from-bottom-24">
                <div className="bg-slate-900 p-4 text-white flex justify-between items-center border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-amber-400" />
                    <span className="font-bold text-sm">{t.collectCash}</span>
                  </div>
                  <button onClick={() => setIsCollectOpen(false)} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCollectSubmit} className="p-5 flex flex-col gap-4">
                  {/* Shop Select */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t.selectShop}</label>
                    <select 
                      value={selectedShopId}
                      onChange={(e) => setSelectedShopId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:border-amber-400 bg-white"
                      required
                    >
                      <option value="">-- Выбрать --</option>
                      {shops.map(s => (
                        <option key={s.id} value={s.id}>{s.name} (долг: {s.debt.toLocaleString()} сум)</option>
                      ))}
                    </select>
                  </div>

                  {/* Amount to collect */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t.amountCollected} (сум)</label>
                    <input 
                      type="number"
                      min="1"
                      placeholder="Сумма оплаты"
                      value={collectAmount}
                      onChange={(e) => setCollectAmount(Math.max(0, Number(e.target.value)))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold focus:outline-none focus:border-amber-400 font-mono"
                      required
                    />
                  </div>

                  {/* Payment Category */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t.paymentType}</label>
                    <div className="grid grid-cols-3 gap-2">
                      {([["cash", t.cash], ["card", t.card], ["transfer", t.transfer]] as const).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setCollectType(id)}
                          className={`py-2 rounded-lg border text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                            collectType === id
                              ? "bg-slate-900 border-slate-800 text-amber-400"
                              : "bg-white border-slate-200 text-slate-600"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Comment (optional — ТЗ п.4.5) */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {lang === "ru" ? "Комментарий (необязательно)" : "Izoh (ixtiyoriy)"}
                    </label>
                    <input
                      type="text"
                      value={collectComment}
                      onChange={(e) => setCollectComment(e.target.value)}
                      placeholder={lang === "ru" ? "Напр.: частичная оплата" : "Masalan: qisman to'lov"}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  {selectedShopId && (() => {
                    const sh = shops.find(s => s.id === selectedShopId);
                    if (!sh) return null;
                    const remaining = sh.debt - collectAmount;
                    return (
                      <div className={`flex justify-between items-center rounded-lg px-3.5 py-2 border ${remaining >= 0 ? "bg-slate-50 border-slate-150" : "bg-emerald-50 border-emerald-100"}`}>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          {remaining >= 0 ? (lang === "ru" ? "Остаток долга" : "Qolgan qarz") : (lang === "ru" ? "Аванс" : "Avans")}
                        </span>
                        <span className={`font-mono font-extrabold ${remaining > 0 ? "text-red-600" : "text-emerald-600"}`}>
                          {formatSum(Math.abs(remaining), lang)}
                        </span>
                      </div>
                    );
                  })()}

                  <div className="flex gap-3 mt-4">
                    <button
                      type="button"
                      onClick={() => setIsCollectOpen(false)}
                      className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-500 font-bold text-xs hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      {t.cancel}
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2 bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-all cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Check className="w-4 h-4 text-amber-400" />
                      <span>{t.register}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Collapsible Action Modal: Record Sale */}
          {isSaleOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in-50">
              <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl border-t sm:border border-slate-200 overflow-hidden shadow-2xl animate-in slide-in-from-bottom-24">
                <div className="bg-slate-900 p-4 text-white flex justify-between items-center border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Clipboard className="w-5 h-5 text-amber-400" />
                    <span className="font-bold text-sm">{t.recordSale}</span>
                  </div>
                  <button onClick={() => setIsSaleOpen(false)} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaleSubmit} className="p-5 flex flex-col gap-3.5 max-h-[80vh] overflow-y-auto">
                  {/* Shop Select */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {t.selectShop}
                      </label>
                      {!isInlineCreateShopOpen && (
                        <button
                          type="button"
                          onClick={() => setIsInlineCreateShopOpen(true)}
                          className="text-[10px] text-amber-500 hover:text-amber-600 font-bold flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>+ {lang === "ru" ? "Создать новую точку" : "Yangi nuqta yaratish"}</span>
                        </button>
                      )}
                    </div>

                    {isInlineCreateShopOpen ? (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col gap-2.5 animate-in slide-in-from-top-2">
                        <p className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-hidden="true" />
                          {lang === "ru" ? "Быстрое добавление новой точки" : "Yangi nuqtani tezkor qo'shish"}
                        </p>
                        
                        <div className="flex flex-col gap-1">
                          <input
                            type="text"
                            placeholder={lang === "ru" ? "Название фирмы/магазина *" : "Firma/do'kon nomi *"}
                            value={inlineShopName}
                            onChange={(e) => setInlineShopName(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded border border-slate-200 text-xs font-semibold focus:outline-none focus:border-amber-400 bg-white"
                          />
                          
                          {inlineSimilarShops.length > 0 && (
                            <div className="bg-amber-50 border border-amber-200 text-slate-800 text-[10px] p-2 rounded flex flex-col gap-1 mt-1">
                              <p className="font-bold text-amber-800 flex items-center gap-1.5">
                                <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />
                                {lang === "ru" ? "Похожая торговая точка уже есть:" : "O'xshash do'kon allaqachon bor:"}
                              </p>
                              <div className="flex flex-col gap-1 max-h-[80px] overflow-y-auto">
                                {inlineSimilarShops.map(s => (
                                  <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedShopId(s.id);
                                      setIsInlineCreateShopOpen(false);
                                      setInlineShopName("");
                                      showToast(
                                        lang === "ru"
                                          ? `Выбран существующий магазин "${s.name}"`
                                          : `Mavjud do'kon "${s.name}" tanlandi`,
                                        "success"
                                      );
                                    }}
                                    className="text-left underline font-semibold text-amber-900 hover:text-amber-950 cursor-pointer block text-[10px]"
                                  >
                                    • {s.name} ({s.phone || "нет телефона"})
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder={lang === "ru" ? "Имя контакта" : "Kontakt ismi"}
                            value={inlineShopContact}
                            onChange={(e) => setInlineShopContact(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded border border-slate-200 text-xs focus:outline-none focus:border-amber-400 bg-white"
                          />
                          <input
                            type="text"
                            placeholder={lang === "ru" ? "Телефон" : "Telefon"}
                            value={inlineShopPhone}
                            onChange={(e) => setInlineShopPhone(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded border border-slate-200 text-xs focus:outline-none focus:border-amber-400 bg-white font-mono"
                          />
                        </div>

                        <div className="flex gap-2 justify-end mt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setIsInlineCreateShopOpen(false);
                              setInlineShopName("");
                              setInlineShopPhone("");
                              setInlineShopContact("");
                            }}
                            className="px-2.5 py-1 text-[11px] text-slate-500 hover:bg-slate-100 rounded border border-slate-200 font-semibold cursor-pointer"
                          >
                            {t.cancel}
                          </button>
                          <button
                            type="button"
                            onClick={handleInlineCreateShop}
                            className="px-2.5 py-1 text-[11px] bg-slate-900 hover:bg-slate-800 text-white rounded font-bold cursor-pointer"
                          >
                            {lang === "ru" ? "Создать и выбрать" : "Yaratish va tanlash"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <select 
                        value={selectedShopId}
                        onChange={(e) => setSelectedShopId(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:border-amber-400 bg-white"
                        required
                      >
                        <option value="">-- Выбрать --</option>
                        {shops.map(s => (
                          <option key={s.id} value={s.id}>{s.name} (долг: {s.debt.toLocaleString()} сум)</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Sale date (ТЗ п.5.6 — дату можно указать вручную) */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {lang === "ru" ? "Дата продажи" : "Sotuv sanasi"}
                    </label>
                    <input
                      type="date"
                      value={saleDate}
                      max={todayISO}
                      onChange={(e) => setSaleDate(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:border-amber-400 font-mono"
                    />
                  </div>

                  {/* Товарные позиции (одна или несколько строк — ТЗ п.4.4) */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {lang === "ru" ? "Товарные позиции" : "Tovar pozitsiyalari"}
                      </label>
                      <button
                        type="button"
                        onClick={() => setSaleItems(prev => [...prev, { eggType: (eggTypes.filter(e => e.status === "active")[0]?.id) || "c0", qtyType: "boxes", qty: 0 }])}
                        className="text-[10px] text-amber-500 hover:text-amber-600 font-bold flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> {lang === "ru" ? "Позиция" : "Pozitsiya"}
                      </button>
                    </div>

                    {saleItems.map((item, idx) => {
                      const activeEggs = eggTypes.length > 0 ? eggTypes.filter(e => e.status === "active") : [
                        { id: "c0", nameRu: "C0", nameUz: "C0" },
                        { id: "c1", nameRu: "C1", nameUz: "C1" },
                        { id: "domestic", nameRu: "Домашние", nameUz: "Uy" },
                      ];
                      const setItem = (patch: Partial<typeof item>) =>
                        setSaleItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
                      const trays = traysForItem(item);
                      const lt = lineTotal(item);
                      return (
                        <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <select
                              value={item.eggType}
                              onChange={(e) => setItem({ eggType: e.target.value })}
                              className="flex-1 px-2 py-1.5 rounded border border-slate-200 text-xs font-semibold bg-white focus:outline-none focus:border-amber-400"
                            >
                              {activeEggs.map(egg => (
                                <option key={egg.id} value={egg.id}>{lang === "ru" ? egg.nameRu : egg.nameUz}</option>
                              ))}
                            </select>
                            {saleItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setSaleItems(prev => prev.filter((_, i) => i !== idx))}
                                className="p-1.5 bg-white border border-slate-200 rounded text-red-500 hover:bg-red-50 cursor-pointer"
                                title={lang === "ru" ? "Удалить позицию" : "Pozitsiyani o'chirish"}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                              <button type="button" onClick={() => setItem({ qtyType: "boxes" })}
                                className={`py-1 rounded-md text-[9px] font-bold transition-all cursor-pointer ${item.qtyType === "boxes" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
                                {lang === "ru" ? "Коробки" : "Qutilar"}
                              </button>
                              <button type="button" onClick={() => setItem({ qtyType: "trays" })}
                                className={`py-1 rounded-md text-[9px] font-bold transition-all cursor-pointer ${item.qtyType === "trays" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
                                {lang === "ru" ? "Лотки" : "Laganlar"}
                              </button>
                            </div>
                            <input
                              type="number" min="0" inputMode="numeric"
                              value={item.qty || ""}
                              onChange={(e) => setItem({ qty: Math.max(0, Number(e.target.value)) })}
                              placeholder={lang === "ru" ? "Кол-во" : "Soni"}
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:border-amber-400 font-mono"
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                            <span>{trays} {lang === "ru" ? "лотк." : "lagan"} · {(trays * eggsPerTray).toLocaleString("ru-RU").replace(/,/g, " ")} {lang === "ru" ? "шт" : "dona"}</span>
                            <span className="font-bold text-slate-700">{formatSum(lt, lang)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Итого к оплате */}
                  <div className="flex justify-between items-center bg-slate-900 text-white rounded-lg px-3.5 py-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">{lang === "ru" ? "Итого к оплате" : "Jami to'lov"}</span>
                    <span className="font-mono font-extrabold text-amber-400">{formatSum(saleTotal, lang)}</span>
                  </div>

                  {/* Получено денег + быстрые кнопки (ТЗ п.4.4) */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {lang === "ru" ? "Получено денег" : "Qabul qilingan pul"}
                    </label>
                    <input
                      type="number" min="0" inputMode="numeric"
                      value={saleReceived || ""}
                      onChange={(e) => setSaleReceived(Math.max(0, Number(e.target.value)))}
                      placeholder="0"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold focus:outline-none focus:border-amber-400 font-mono"
                    />
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <button type="button" onClick={() => setSaleReceived(saleTotal)}
                        className="py-1.5 rounded-md border border-slate-200 bg-white text-[10px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">
                        {lang === "ru" ? "Оплатил всё" : "Hammasini to'ladi"}
                      </button>
                      <button type="button" onClick={() => setSaleReceived(0)}
                        className="py-1.5 rounded-md border border-slate-200 bg-white text-[10px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">
                        {lang === "ru" ? "Ничего не оплатил" : "To'lamadi"}
                      </button>
                    </div>
                  </div>

                  {/* Способ оплаты (если что-то получено) */}
                  {saleReceived > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t.paymentType}</label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[{ id: "cash", label: t.cash }, { id: "card", label: t.card }, { id: "transfer", label: t.transfer }].map(m => (
                          <button key={m.id} type="button" onClick={() => setSalePayMethod(m.id as any)}
                            className={`py-1.5 rounded-md border text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer ${salePayMethod === m.id ? "bg-slate-900 border-slate-800 text-amber-400" : "bg-white border-slate-200 text-slate-600"}`}>
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* В долг / Аванс */}
                  <div className={`flex justify-between items-center rounded-lg px-3.5 py-2 border ${saleDebtDelta >= 0 ? "bg-red-50 border-red-100" : "bg-emerald-50 border-emerald-100"}`}>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      {saleDebtDelta >= 0 ? (lang === "ru" ? "В долг" : "Nasiya") : (lang === "ru" ? "Аванс (переплата)" : "Avans")}
                    </span>
                    <span className={`font-mono font-extrabold ${saleDebtDelta >= 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {formatSum(Math.abs(saleDebtDelta), lang)}
                    </span>
                  </div>

                  <div className="flex gap-3 mt-4">
                    <button 
                      type="button"
                      onClick={() => setIsSaleOpen(false)} 
                      className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-500 font-bold text-xs hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      {t.cancel}
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 py-2 bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-all cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Check className="w-4 h-4 text-amber-400" />
                      <span>{t.register}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Collapsible Action Modal: Create Shop */}
          {isCreateShopOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in-50">
              <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl border-t sm:border border-slate-200 overflow-hidden shadow-2xl animate-in slide-in-from-bottom-24">
                <div className="bg-slate-900 p-4 text-white flex justify-between items-center border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Plus className="w-5 h-5 text-amber-400" />
                    <span className="font-bold text-sm">{lang === "ru" ? "Новый магазин" : "Yangi do'kon qo'shish"}</span>
                  </div>
                  <button onClick={() => setIsCreateShopOpen(false)} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCreateShopSubmit} className="p-5 flex flex-col gap-3.5 max-h-[80vh] overflow-y-auto">
                  {/* Shop Name */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {lang === "ru" ? "Название магазина *" : "Do'kon nomi *"}
                    </label>
                    <input 
                      type="text"
                      placeholder={lang === "ru" ? "Например: Магазин Азиза" : "Masalan: Aziza do'koni"}
                      value={newShopName}
                      onChange={(e) => setNewShopName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:border-amber-400 bg-white"
                      required
                    />

                    {/* Similar points warning */}
                    {similarShops.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 text-slate-800 text-[11px] p-2.5 rounded-lg flex flex-col gap-1.5 mt-1">
                        <p className="font-bold text-amber-800 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          {lang === "ru" ? "Найдена похожая торговая точка:" : "O'xshash do'kon topildi:"}
                        </p>
                        <div className="flex flex-col gap-1 max-h-[90px] overflow-y-auto">
                          {similarShops.map(s => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setSelectedShopId(s.id);
                                setIsCreateShopOpen(false);
                                setNewShopName("");
                                showToast(
                                  lang === "ru"
                                    ? `Выбран существующий магазин "${s.name}"`
                                    : `Mavjud do'kon "${s.name}" tanlandi`,
                                  "success"
                                );
                              }}
                              className="text-left underline font-semibold text-amber-900 hover:text-amber-950 cursor-pointer block text-xs"
                            >
                              • {s.name} ({s.phone || "нет телефона"})
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Contact Person */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {lang === "ru" ? "Имя контакта" : "Kontakt ismi"}
                    </label>
                    <input 
                      type="text"
                      placeholder={lang === "ru" ? "Например: Азиз" : "Masalan: Aziz"}
                      value={newShopContact}
                      onChange={(e) => setNewShopContact(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:border-amber-400 bg-white"
                    />
                  </div>

                  {/* Contact Phone */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {lang === "ru" ? "Номер телефона" : "Telefon raqami"}
                    </label>
                    <input 
                      type="text"
                      placeholder="+998901234567"
                      value={newShopPhone}
                      onChange={(e) => setNewShopPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:border-amber-400 bg-white font-mono"
                    />
                  </div>

                  {/* Address / Landmark */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {lang === "ru" ? "Адрес / ориентир" : "Manzil / mo'ljal"}
                    </label>
                    <input 
                      type="text"
                      placeholder={lang === "ru" ? "Например: Около метро, дом 4" : "Masalan: Metro yaqinida, 4-uy"}
                      value={newShopAddress}
                      onChange={(e) => setNewShopAddress(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:border-amber-400 bg-white"
                    />
                  </div>

                  {/* Локация (карта + маршрут) */}
                  <LocationField lat={newShopLat} lng={newShopLng} onChange={(la, ln) => { setNewShopLat(la); setNewShopLng(ln); }} lang={lang} />

                  {/* Note */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {lang === "ru" ? "Заметка (свободный текст)" : "Eslatma (erkin matn)"}
                    </label>
                    <textarea 
                      placeholder={lang === "ru" ? "Дополнительная информация о магазине" : "Do'kon haqida qo'shimcha ma'lumotlar"}
                      value={newShopNote}
                      onChange={(e) => setNewShopNote(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:border-amber-400 bg-white min-h-[60px]"
                    />
                  </div>

                  {/* Initial Debt */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {lang === "ru" ? "Начальный долг (сум)" : "Boshlang'ich qarzdorlik (so'm)"}
                    </label>
                    <input 
                      type="number"
                      min="0"
                      value={newShopDebt}
                      onChange={(e) => setNewShopDebt(Math.max(0, Number(e.target.value)))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:border-amber-400 bg-white font-mono font-bold"
                    />
                  </div>

                  <div className="flex gap-3 mt-4">
                    <button 
                      type="button"
                      onClick={() => setIsCreateShopOpen(false)} 
                      className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-500 font-bold text-xs hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      {t.cancel}
                    </button>
                    <button 
                      type="submit"
                      disabled={creatingShop}
                      className="flex-1 py-2 bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-all cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      {creatingShop ? (
                        <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                      ) : (
                        <Check className="w-4 h-4 text-amber-400" />
                      )}
                      <span>{lang === "ru" ? "Создать" : "Yaratish"}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Collapsible Action Modal: Shop Profile */}
          {profileShopId && (() => {
            const shop = shops.find(s => s.id === profileShopId);
            if (!shop) return null;

            // Filter history logs for this shop and sort descending
            const shopLogs = activityLogs.filter(log => log.shopId === shop.id);
            const sortedShopLogs = [...shopLogs].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            // Extract last purchase details
            const purchaseLogs = sortedShopLogs.filter(log => !log.isCancelled && (log.type === "sale" || log.paymentType === "debt" || log.message.toLowerCase().includes("продаж") || log.message.toLowerCase().includes("sotuv") || log.qty));
            const lastPurchase = purchaseLogs[0] || null;

            // Extract last payment details — только операции «Приём оплаты»
            // (раньше сюда по paymentType !== "debt" попадали и продажи).
            const paymentLogs = sortedShopLogs.filter(log => !log.isCancelled && log.type === "payment");
            const lastPayment = paymentLogs[0] || null;

            // Filter history list by dates
            const filteredHistory = sortedShopLogs.filter(log => {
              if (profileStartDate) {
                const sDate = new Date(profileStartDate);
                sDate.setHours(0,0,0,0);
                if (new Date(log.timestamp) < sDate) return false;
              }
              if (profileEndDate) {
                const eDate = new Date(profileEndDate);
                eDate.setHours(23,59,59,999);
                if (new Date(log.timestamp) > eDate) return false;
              }
              return true;
            });

            return (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in-50">
                <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl border-t sm:border border-slate-200 overflow-hidden shadow-2xl animate-in slide-in-from-bottom-24 flex flex-col max-h-[90vh]">
                  {/* Modal Header */}
                  <div className="bg-slate-900 p-4 text-white flex justify-between items-center border-b border-slate-800 shrink-0">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-amber-400" />
                      <span className="font-bold text-sm">{lang === "ru" ? "Профиль магазина" : "Do'kon profili"}</span>
                    </div>
                    <button onClick={() => { setProfileShopId(null); setProfileStartDate(""); setProfileEndDate(""); }} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Modal Content */}
                  <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-5">
                    {/* Shop Info Card */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 flex flex-col gap-2 relative">
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-bold text-base text-slate-800 font-serif italic">{shop.name}</h3>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${shop.isArchived ? "bg-slate-200 text-slate-600" : "bg-emerald-100 text-emerald-800"}`}>
                          {shop.isArchived 
                            ? (lang === "ru" ? "Архив" : "Arxiv") 
                            : (lang === "ru" ? "Активен" : "Faol")}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs mt-1">
                        <div>
                          <p className="text-slate-400 font-medium">{lang === "ru" ? "Контакт" : "Kontakt"}</p>
                          <p className="font-semibold text-slate-700">{shop.contact || "—"}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 font-medium">{lang === "ru" ? "Телефон" : "Telefon"}</p>
                          <p className="font-semibold text-slate-700 font-mono">{shop.phone || "—"}</p>
                        </div>
                      </div>

                      <div className="text-xs">
                        <p className="text-slate-400 font-medium">{lang === "ru" ? "Адрес / ориентир" : "Manzil / mo'ljal"}</p>
                        <p className="font-semibold text-slate-700">{shop.address || "—"}</p>
                      </div>

                      {yandexRouteUrl(shop.lat, shop.lng) && (
                        <a
                          href={yandexRouteUrl(shop.lat, shop.lng)!} target="_blank" rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold text-xs transition-all cursor-pointer border border-amber-300"
                        >
                          <MapPin className="w-4 h-4" />
                          {lang === "ru" ? "Построить маршрут (Яндекс.Карты)" : "Marshrut qurish (Yandex)"}
                        </a>
                      )}

                      <div className="text-xs">
                        <p className="text-slate-400 font-medium">{lang === "ru" ? "Заметка" : "Eslatma"}</p>
                        <p className="text-slate-600 italic bg-white p-1.5 rounded border border-slate-100 mt-0.5 text-[11px] whitespace-pre-line">
                          {shop.note || "—"}
                        </p>
                      </div>

                      {/* Calculated Metrics */}
                      <div className="border-t border-slate-200/60 pt-3 mt-1 flex flex-col gap-1.5">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500">{lang === "ru" ? "Последняя покупка:" : "Oxirgi xarid:"}</span>
                          <span className="font-semibold text-slate-850">
                            {lastPurchase 
                              ? `${new Date(lastPurchase.timestamp).toLocaleDateString()} (${lastPurchase.amount?.toLocaleString()} сум)` 
                              : "—"}
                          </span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500">{lang === "ru" ? "Последняя оплата:" : "Oxirgi to'lov:"}</span>
                          <span className="font-semibold text-slate-850">
                            {lastPayment 
                              ? `${new Date(lastPayment.timestamp).toLocaleDateString()} (${lastPayment.amount?.toLocaleString()} сум)` 
                              : "—"}
                          </span>
                        </div>
                        
                        <div className="border-t border-dashed border-slate-200 pt-2 flex justify-between items-center">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            {lang === "ru" ? "Текущий долг:" : "Joriy qarz:"}
                          </span>
                          <span className={`font-mono font-extrabold text-base ${shop.debt > 0 ? "text-red-600" : "text-slate-500"}`}>
                            {shop.debt.toLocaleString()} сум
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Transaction History Section */}
                    <div className="flex-1 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <History className="w-3.5 h-3.5" />
                          {lang === "ru" ? "История операций" : "Amaliyotlar tarixi"}
                        </h4>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                          {filteredHistory.length}
                        </span>
                      </div>

                      {/* Date Filter Panel */}
                      <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50 rounded-lg border border-slate-150 text-[10px]">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-400 uppercase font-bold tracking-wider">{lang === "ru" ? "С:" : "Dan:"}</span>
                          <input
                            type="date"
                            value={profileStartDate}
                            onChange={(e) => setProfileStartDate(e.target.value)}
                            className="w-full px-1.5 py-1 rounded border border-slate-200 bg-white font-mono font-semibold"
                          />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-400 uppercase font-bold tracking-wider">{lang === "ru" ? "По:" : "Gachas:"}</span>
                          <input
                            type="date"
                            value={profileEndDate}
                            onChange={(e) => setProfileEndDate(e.target.value)}
                            className="w-full px-1.5 py-1 rounded border border-slate-200 bg-white font-mono font-semibold"
                          />
                        </div>
                        {(profileStartDate || profileEndDate) && (
                          <button
                            type="button"
                            onClick={() => {
                              setProfileStartDate("");
                              setProfileEndDate("");
                            }}
                            className="col-span-2 text-center text-red-500 hover:text-red-600 font-bold underline mt-1 cursor-pointer"
                          >
                            {lang === "ru" ? "Сбросить фильтр дат" : "Sanalarni tozalash"}
                          </button>
                        )}
                      </div>

                      <div className="divide-y divide-slate-100 border border-slate-150 rounded-xl max-h-[160px] overflow-y-auto bg-white">
                        {filteredHistory.length === 0 ? (
                          <div className="p-6 text-center text-slate-400 text-xs font-medium">
                            {lang === "ru" ? "История пуста." : "Tarix bo'sh."}
                          </div>
                        ) : (
                          filteredHistory.map((log) => {
                            const date = log.timestamp ? new Date(log.timestamp).toLocaleDateString(lang === "ru" ? "ru-RU" : "uz-UZ", { month: "short", day: "numeric" }) : "";
                            const time = log.timestamp ? new Date(log.timestamp).toLocaleTimeString(lang === "ru" ? "ru-RU" : "uz-UZ", { hour: "2-digit", minute: "2-digit" }) : "";

                            return (
                              <div key={log.id} className={`p-3 text-xs flex justify-between items-center ${log.isCancelled ? "opacity-50 bg-slate-50" : ""}`}>
                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`px-1.5 py-0.2 text-[8px] font-extrabold uppercase rounded-md ${
                                      log.isCancelled
                                        ? "bg-slate-200 text-slate-600"
                                        : log.type === "return"
                                          ? "bg-orange-100 text-orange-800"
                                          : log.type === "payment" && !log.qty
                                            ? "bg-emerald-100 text-emerald-800"
                                            : "bg-amber-100 text-amber-800"
                                    }`}>
                                      {log.isCancelled
                                        ? (lang === "ru" ? "Отмена" : "Bekor")
                                        : log.type === "return"
                                          ? (lang === "ru" ? "Возврат" : "Qaytarish")
                                          : log.type === "payment" && !log.qty
                                            ? (lang === "ru" ? "Оплата" : "To'lov")
                                            : (lang === "ru" ? "Продажа" : "Sotuv")}
                                    </span>
                                    <span className="text-[9px] text-slate-400 font-mono">
                                      {date} {time}
                                    </span>
                                  </div>
                                  <p className={`mt-1 font-medium ${log.isCancelled ? "line-through text-slate-400" : "text-slate-700"}`}>
                                    {log.message}
                                  </p>
                                </div>
                                <div className="text-right shrink-0 ml-2">
                                  <span className="font-mono font-bold text-slate-800">
                                    {log.type === "return" ? `${log.qtyPieces ?? 0} ${lang === "ru" ? "шт" : "dona"}` : `${log.amount?.toLocaleString()} сум`}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Modal Footer Quick Actions */}
                  <div className="bg-slate-50 p-4 border-t border-slate-100 shrink-0 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedShopId(shop.id);
                        setProfileShopId(null);
                        setIsCollectOpen(true);
                      }}
                      className="py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                      <span>{lang === "ru" ? "Принять оплату" : "To'lov qabul qilish"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedShopId(shop.id);
                        setProfileShopId(null);
                        setIsSaleOpen(true);
                      }}
                      className="py-2.5 bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{lang === "ru" ? "Продажа" : "Sotuv qilish"}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Collapsible Action Modal: Edit Operations Log (within 24 hrs limit) */}
          {isEditLogOpen && editingLog && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in-50">
              <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl border-t sm:border border-slate-200 overflow-hidden shadow-2xl animate-in slide-in-from-bottom-24">
                <div className="bg-slate-900 p-4 text-white flex justify-between items-center border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Edit2 className="w-5 h-5 text-amber-400" />
                    <span className="font-bold text-sm">{lang === "ru" ? "Исправить сумму операции" : "Amaliyot summasini to'g'rilash"}</span>
                  </div>
                  <button onClick={() => { setIsEditLogOpen(false); setEditingLog(null); }} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleEditLogSubmit} className="p-5 flex flex-col gap-4">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{lang === "ru" ? "Текущая запись" : "Joriy yozuv"}</p>
                    <p className="text-xs font-semibold text-slate-700">{editingLog.message}</p>
                    <p className="text-[10px] font-mono text-slate-400 mt-1 uppercase">ID: #{editingLog.id}</p>
                  </div>

                  {/* Amount to Edit */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{lang === "ru" ? "Новая сумма (сум) *" : "Yangi summa (so'm) *"}</label>
                    <input 
                      type="number"
                      min="1"
                      placeholder={lang === "ru" ? "Введите новую сумму" : "Yangi summani kiriting"}
                      value={editingLogAmount}
                      onChange={(e) => setEditingLogAmount(Math.max(0, Number(e.target.value)))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold focus:outline-none focus:border-amber-400 font-mono"
                      required
                    />
                  </div>

                  <div className="flex gap-3 mt-4">
                    <button 
                      type="button"
                      onClick={() => { setIsEditLogOpen(false); setEditingLog(null); }} 
                      className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-500 font-bold text-xs hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      {t.cancel}
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 py-2 bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-all cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Check className="w-4 h-4 text-amber-400" />
                      <span>{lang === "ru" ? "Сохранить" : "Saqlash"}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
