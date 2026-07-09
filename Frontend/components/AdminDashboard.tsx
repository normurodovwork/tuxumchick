"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Users, TrendingUp, DollarSign, Truck, Search, ArrowUpDown, 
  Settings, LogOut, CheckCircle2, AlertTriangle, Layers, Clock, 
  Edit2, Save, X, PlusCircle, Check, Loader2, Trash2, Shield, 
  Eye, EyeOff, FileSpreadsheet, Archive, Ban, BookOpen, UserPlus, 
  FileText, CheckSquare, Plus, RefreshCw, Building2, History, Edit
} from "lucide-react";
import { 
  loadSettings, saveSettings, loadInventory, saveInventory, 
  loadShops, saveShop, loadActivityLogs, addActivityLog, 
  loadPriceHistory, addPriceRecord, loadDeliverers, saveDeliverer,
  updateActivityLog, loadEggTypes, saveEggType
} from "../lib/db-service";
import { translations, Language } from "../lib/translations";

interface AdminDashboardProps {
  username: string;
  onLogout: () => void;
  lang: Language;
  setLang: (lang: Language) => void;
}

type AdminTab = "dashboard" | "deliverers" | "shops" | "operations" | "egg_types" | "audit";

export default function AdminDashboard({ username, onLogout, lang, setLang }: AdminDashboardProps) {
  const t = translations[lang];

  // Primary States
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [settings, setSettings] = useState<any>(null);
  const [inventory, setInventory] = useState<any>(null);
  const [shops, setShops] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [deliverers, setDeliverers] = useState<any[]>([]);
  const [eggTypes, setEggTypes] = useState<any[]>([]);
  
  const [nowTime, setNowTime] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Egg Type Modal State
  const [isEggModalOpen, setIsEggModalOpen] = useState(false);
  const [editingEgg, setEditingEgg] = useState<any | null>(null);
  const [eggNameRu, setEggNameRu] = useState("");
  const [eggNameUz, setEggNameUz] = useState("");
  const [eggPricePerTray, setEggPricePerTray] = useState(0);
  const [eggStatus, setEggStatus] = useState<"active" | "archived">("active");

  // Search & Filters
  const [debtorSearch, setDebtorSearch] = useState("");
  const [debtorSortField, setDebtorSortField] = useState<"debt" | "delay">("debt");
  const [debtorSortDir, setDebtorSortDir] = useState<"asc" | "desc">("desc");

  const [shopFilterQuery, setShopFilterQuery] = useState("");
  const [shopShowArchived, setShopShowArchived] = useState(false);

  const [opFilterPeriod, setOpFilterPeriod] = useState<"all" | "today" | "yesterday">("all");
  const [opFilterType, setOpFilterType] = useState<"all" | "sale" | "payment">("all");
  const [opFilterOperator, setOpFilterOperator] = useState<string>("all");
  const [opSearchQuery, setOpSearchQuery] = useState("");

  // Configuration States (Settings Modal)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [configTrays, setConfigTrays] = useState(12);
  const [configEggs, setConfigEggs] = useState(30);
  const [configThreshold, setConfigThreshold] = useState(10);

  // Price Modal States
  const [isPriceOpen, setIsPriceOpen] = useState(false);
  const [priceC0, setPriceC0] = useState(1500);
  const [priceC1, setPriceC1] = useState(1300);
  const [priceDom, setPriceDom] = useState(1800);

  // Quick New Sale Modal
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);
  const [saleShopId, setSaleShopId] = useState("");
  const [saleEggType, setSaleEggType] = useState<string>("c0");
  const [saleQtyType, setSaleQtyType] = useState<"boxes" | "trays">("boxes");
  const [saleQty, setSaleQty] = useState(0);
  const [salePayment, setSalePayment] = useState<"cash" | "card" | "debt">("debt");

  // Admin Override States (Modals/Overlays)
  // Edit Log Amount Modal
  const [editingLog, setEditingLog] = useState<any | null>(null);
  const [editingLogAmount, setEditingLogAmount] = useState<number>(0);
  const [isEditLogOpen, setIsEditLogOpen] = useState(false);

  // Manage Deliverer Account Modal
  const [isDelivererModalOpen, setIsDelivererModalOpen] = useState(false);
  const [editingDeliverer, setEditingDeliverer] = useState<any | null>(null);
  const [delName, setDelName] = useState("");
  const [delUsername, setDelUsername] = useState("");
  const [delPhone, setDelPhone] = useState("");
  const [delPassword, setDelPassword] = useState("");
  const [delStatus, setDelStatus] = useState<"online" | "offline" | "blocked">("online");

  // Manage Shop Card Modal
  const [isShopModalOpen, setIsShopModalOpen] = useState(false);
  const [editingShop, setEditingShop] = useState<any | null>(null);
  const [shopCardName, setShopCardName] = useState("");
  const [shopCardContact, setShopCardContact] = useState("");
  const [shopCardPhone, setShopCardPhone] = useState("");
  const [shopCardDebt, setShopCardDebt] = useState<number>(0);
  const [shopCardAddress, setShopCardAddress] = useState("");
  const [shopCardNote, setShopCardNote] = useState("");
  const [shopCardStatus, setShopCardStatus] = useState<"active" | "archive">("active");

  // Shop Profile view states
  const [selectedShopProfileId, setSelectedShopProfileId] = useState<string | null>(null);
  const [adminProfileStartDate, setAdminProfileStartDate] = useState("");
  const [adminProfileEndDate, setAdminProfileEndDate] = useState("");

  // Merge Duplicates Dialog
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState("");
  const [mergeTargetId, setMergeTargetId] = useState("");

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Load Initial Data
  const reloadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [sett, inv, shps, logs, prcs, dels, eggTyps] = await Promise.all([
        loadSettings(),
        loadInventory(),
        loadShops(),
        loadActivityLogs(),
        loadPriceHistory(),
        loadDeliverers(),
        loadEggTypes(),
      ]);

      setSettings(sett);
      setInventory(inv);
      setShops(shps);
      setActivityLogs(logs);
      setPriceHistory(prcs);
      setDeliverers(dels);
      setEggTypes(eggTyps);
      setNowTime(Date.now());
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
      showToast("Ошибка соединения с базой данных", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadData();
  }, []);

  // Update Config Form States when Settings load
  useEffect(() => {
    if (settings) {
      setConfigTrays(settings.traysPerBox || 12);
      setConfigEggs(settings.eggsPerTray || 30);
      setConfigThreshold(settings.oldDebtThresholdDays || 10);
    }
  }, [settings]);

  // Update Price Form States when Prices load
  useEffect(() => {
    if (priceHistory.length > 0) {
      const latest = priceHistory[0];
      setPriceC0(latest.c0Price);
      setPriceC1(latest.c1Price);
      setPriceDom(latest.domesticPrice);
    }
  }, [priceHistory]);

  // Save Settings handler
  const handleSaveSettings = async () => {
    try {
      const updated = {
        traysPerBox: Number(configTrays),
        eggsPerTray: Number(configEggs),
        oldDebtThresholdDays: Number(configThreshold),
      };
      await saveSettings(updated);
      setSettings(updated);
      setIsSettingsOpen(false);
      showToast(lang === "ru" ? "Настройки успешно сохранены" : "Sozlamalar muvaffaqiyatli saqlandi");
      
      await addActivityLog({
        timestamp: new Date().toISOString(),
        type: "adjustment",
        message: lang === "ru" ? "Администратор изменил настройки системы" : "Administrator tizim sozlamalarini o'zgartirdi",
        amount: 0,
        operator: username,
      });
      reloadData(true);
    } catch (e) {
      showToast("Ошибка сохранения настроек", "error");
    }
  };

  // Save Prices handler
  const handleSavePrices = async () => {
    try {
      const updated = {
        date: new Date().toISOString().split("T")[0],
        c0Price: Number(priceC0),
        c1Price: Number(priceC1),
        domesticPrice: Number(priceDom),
      };
      const record = await addPriceRecord(updated);
      setPriceHistory(prev => [record, ...prev]);
      setIsPriceOpen(false);
      showToast(lang === "ru" ? "Цены успешно обновлены" : "Narxlar muvaffaqiyatli yangilandi");

      await addActivityLog({
        timestamp: new Date().toISOString(),
        type: "adjustment",
        message: lang === "ru" 
          ? `Обновлены цены яиц: C0=${priceC0}, C1=${priceC1}, Домашние=${priceDom}` 
          : `Tuxum narxlari yangilandi: C0=${priceC0}, C1=${priceC1}, Uy t.=${priceDom}`,
        amount: 0,
        operator: username,
      });
      reloadData(true);
    } catch (e) {
      showToast("Ошибка обновления цен", "error");
    }
  };

  // Dynamic Egg Types handlers
  const handleOpenEggModal = (egg: any = null) => {
    setEditingEgg(egg);
    if (egg) {
      setEggNameRu(egg.nameRu || "");
      setEggNameUz(egg.nameUz || "");
      setEggPricePerTray(egg.pricePerTray || 0);
      setEggStatus(egg.status || "active");
    } else {
      setEggNameRu("");
      setEggNameUz("");
      setEggPricePerTray(0);
      setEggStatus("active");
    }
    setIsEggModalOpen(true);
  };

  const handleSaveEggSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eggNameRu.trim() || !eggNameUz.trim() || eggPricePerTray <= 0) {
      showToast(lang === "ru" ? "Заполните все поля и укажите корректную цену" : "Barcha maydonlarni to'ldiring va to'g'ri narx ko'rsating", "error");
      return;
    }

    try {
      const id = editingEgg ? editingEgg.id : "egg_" + Date.now();
      const updatedEgg = {
        id,
        nameRu: eggNameRu.trim(),
        nameUz: eggNameUz.trim(),
        pricePerTray: Number(eggPricePerTray),
        status: eggStatus
      };

      await saveEggType(updatedEgg);
      
      const oldPrice = editingEgg ? editingEgg.pricePerTray : null;
      if (oldPrice !== updatedEgg.pricePerTray) {
        // Log price change to activity/audit log
        await addActivityLog({
          timestamp: new Date().toISOString(),
          type: "adjustment",
          message: lang === "ru" 
            ? `Изменена цена вида яиц "${updatedEgg.nameRu}": ${oldPrice !== null ? `старая ${oldPrice} сум, ` : ""}новая за лоток: ${updatedEgg.pricePerTray} сум (за кор.: ${(updatedEgg.pricePerTray * (settings?.traysPerBox || 12)).toLocaleString()} сум)`
            : `"${updatedEgg.nameUz}" tuxum narxi o'zgartirildi: ${oldPrice !== null ? `eski ${oldPrice} so'm, ` : ""}yangi lagan narxi: ${updatedEgg.pricePerTray} so'm (quti: ${(updatedEgg.pricePerTray * (settings?.traysPerBox || 12)).toLocaleString()} so'm)`,
          amount: 0,
          operator: username
        });

        // Also add to price history collection so history is logged and preserved!
        await addPriceRecord({
          date: new Date().toISOString().split("T")[0],
          eggTypeId: updatedEgg.id,
          nameRu: updatedEgg.nameRu,
          nameUz: updatedEgg.nameUz,
          pricePerTray: updatedEgg.pricePerTray,
          c0Price: updatedEgg.id === "c0" ? updatedEgg.pricePerTray / (settings?.eggsPerTray || 30) : (eggTypes.find(eg => eg.id === "c0")?.pricePerTray || 45000) / (settings?.eggsPerTray || 30),
          c1Price: updatedEgg.id === "c1" ? updatedEgg.pricePerTray / (settings?.eggsPerTray || 30) : (eggTypes.find(eg => eg.id === "c1")?.pricePerTray || 39000) / (settings?.eggsPerTray || 30),
          domesticPrice: updatedEgg.id === "domestic" ? updatedEgg.pricePerTray / (settings?.eggsPerTray || 30) : (eggTypes.find(eg => eg.id === "domestic")?.pricePerTray || 54000) / (settings?.eggsPerTray || 30),
        });
      }

      showToast(lang === "ru" ? "Вид яиц успешно сохранен!" : "Tuxum turi muvaffaqiyatli saqlandi!", "success");
      setIsEggModalOpen(false);
      reloadData(true);
    } catch (err) {
      showToast(lang === "ru" ? "Ошибка сохранения вида яиц" : "Tuxum turini saqlashda xatolik", "error");
    }
  };

  const handleToggleEggStatus = async (egg: any) => {
    try {
      const nextStatus = egg.status === "archived" ? "active" : "archived";
      const updated = {
        ...egg,
        status: nextStatus
      };
      await saveEggType(updated);
      
      await addActivityLog({
        timestamp: new Date().toISOString(),
        type: "adjustment",
        message: lang === "ru"
          ? `Администратор изменил статус вида яиц "${egg.nameRu}" на: ${nextStatus === "active" ? "Активен" : "Архив"}`
          : `Administrator "${egg.nameUz}" tuxum turi statusini o'zgartirdi: ${nextStatus === "active" ? "Faol" : "Arxiv"}`,
        amount: 0,
        operator: username
      });

      showToast(lang === "ru" ? "Статус вида яиц изменен" : "Tuxum turi holati o'zgartirildi");
      reloadData(true);
    } catch (err) {
      showToast("Ошибка изменения статуса", "error");
    }
  };

  // Record New Sale handler
  const handleNewSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleShopId || saleQty <= 0) {
      showToast(t.errorFillAll, "error");
      return;
    }

    try {
      const shop = shops.find(s => s.id === saleShopId);
      if (!shop) return;

      const eggsPerTray = settings?.eggsPerTray || 30;
      const eggTypeObj = eggTypes.find(eg => eg.id === saleEggType);
      const itemPrice = eggTypeObj 
        ? (eggTypeObj.pricePerTray / eggsPerTray) 
        : (saleEggType === "c0" ? 1500 : saleEggType === "c1" ? 1300 : 1800);
      
      let totalEggs = 0;
      const traysPerBox = settings?.traysPerBox || 12;
      
      if (saleQtyType === "boxes") {
        totalEggs = saleQty * traysPerBox * eggsPerTray;
      } else {
        totalEggs = saleQty * eggsPerTray;
      }

      const totalSum = totalEggs * itemPrice;

      // Update inventory (Subtract)
      const newInv = { ...inventory };
      const traysUsed = saleQtyType === "boxes" ? saleQty * traysPerBox : saleQty;
      if (saleEggType === "c0") newInv.c0 = Math.max(0, (newInv.c0 || 0) - traysUsed);
      else if (saleEggType === "c1") newInv.c1 = Math.max(0, (newInv.c1 || 0) - traysUsed);
      else if (saleEggType === "domestic") newInv.domestic = Math.max(0, (newInv.domestic || 0) - traysUsed);
      else {
        newInv[saleEggType] = Math.max(0, (newInv[saleEggType] || 0) - traysUsed);
      }

      await saveInventory(newInv);
      setInventory(newInv);

      // Save Shop Debt
      const newDebt = salePayment === "debt" ? shop.debt + totalSum : shop.debt;
      const updatedShop = {
        ...shop,
        debt: newDebt,
        lastPurchaseDate: new Date().toISOString(),
        ...(salePayment !== "debt" ? { lastPaymentDate: new Date().toISOString() } : {})
      };
      await saveShop(updatedShop);

      // Add log
      const eggTypeName = eggTypeObj 
        ? (lang === "ru" ? eggTypeObj.nameRu : eggTypeObj.nameUz)
        : saleEggType.toUpperCase();

      const logMsg = lang === "ru" 
        ? `Продажа: ${shop.name} | ${saleQty} ${saleQtyType === "boxes" ? "кор." : "лотк."} ${eggTypeName} | ${salePayment === "debt" ? "В долг" : "Оплачено"}`
        : `Sotuv: ${shop.name} | ${saleQty} ${saleQtyType === "boxes" ? "quti" : "lagan"} ${eggTypeName} | ${salePayment === "debt" ? "Nasiya" : "To'landi"}`;

      await addActivityLog({
        timestamp: new Date().toISOString(),
        shopId: shop.id,
        shopName: shop.name,
        type: "sale",
        message: logMsg,
        amount: totalSum,
        qty: traysUsed,
        eggType: saleEggType,
        operator: username,
      });

      setIsNewSaleOpen(false);
      setSaleQty(0);
      setSaleShopId("");
      showToast(t.successRecorded, "success");
      reloadData(true);
    } catch (err) {
      showToast("Ошибка при оформлении продажи", "error");
    }
  };

  // Deliverer actions (Create / Edit / Block)
  const handleOpenDelivererModal = (deliverer: any = null) => {
    setEditingDeliverer(deliverer);
    if (deliverer) {
      setDelName(deliverer.name || "");
      setDelUsername(deliverer.username || "");
      setDelPhone(deliverer.phone || "");
      setDelPassword(deliverer.password || "");
      setDelStatus(deliverer.status || "online");
    } else {
      setDelName("");
      setDelUsername("");
      setDelPhone("");
      setDelPassword("123");
      setDelStatus("online");
    }
    setIsDelivererModalOpen(true);
  };

  const handleDelivererSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!delName || !delUsername || !delPhone) {
      showToast("Заполните обязательные поля", "error");
      return;
    }

    try {
      const id = editingDeliverer ? editingDeliverer.id : "del-" + Date.now();
      const payload = {
        id,
        name: delName,
        username: delUsername.toLowerCase().trim(),
        phone: delPhone.trim(),
        password: delPassword || "123",
        status: delStatus,
        activePoints: editingDeliverer ? editingDeliverer.activePoints || 0 : 0
      };

      await saveDeliverer(payload);

      // Log action
      await addActivityLog({
        timestamp: new Date().toISOString(),
        type: "adjustment",
        message: lang === "ru"
          ? `Администратор ${editingDeliverer ? "изменил" : "создал"} учетную запись доставщика: ${delName}`
          : `Administrator yetkazib beruvchi hisobini ${editingDeliverer ? "o'zgartirdi" : "yaratdi"}: ${delName}`,
        amount: 0,
        operator: username
      });

      showToast(lang === "ru" ? "Учетная запись сохранена" : "Hisob muvaffaqiyatli saqlandi");
      setIsDelivererModalOpen(false);
      reloadData(true);
    } catch (err) {
      showToast("Ошибка сохранения учетной записи", "error");
    }
  };

  const handleToggleBlockDeliverer = async (del: any) => {
    try {
      const nextStatus = del.status === "blocked" ? "online" : "blocked";
      const payload = {
        ...del,
        status: nextStatus
      };
      await saveDeliverer(payload);

      await addActivityLog({
        timestamp: new Date().toISOString(),
        type: "adjustment",
        message: lang === "ru"
          ? `Администратор изменил статус доставщика ${del.name} на ${nextStatus === "blocked" ? "ЗАБЛОКИРОВАН" : "АКТИВЕН"}`
          : `Administrator yetkazib beruvchi ${del.name} holatini o'zgartirdi: ${nextStatus === "blocked" ? "BLOKLANGAN" : "FAOL"}`,
        amount: 0,
        operator: username
      });

      showToast(lang === "ru" ? "Статус успешно обновлен" : "Holat muvaffaqiyatli yangilandi");
      reloadData(true);
    } catch (err) {
      showToast("Ошибка изменения статуса", "error");
    }
  };

  // Similar shops detection for admin
  const adminSimilarShops = useMemo(() => {
    if (editingShop || !shopCardName || shopCardName.trim().length < 2) return [];
    const val = shopCardName.toLowerCase().trim();
    return shops.filter(s => s.name?.toLowerCase().includes(val));
  }, [shops, shopCardName, editingShop]);

  // Shop Client actions (Create / Edit / Archive)
  const handleOpenShopModal = (shop: any = null) => {
    setEditingShop(shop);
    if (shop) {
      setShopCardName(shop.name || "");
      setShopCardContact(shop.contact || "");
      setShopCardPhone(shop.phone || "");
      setShopCardDebt(shop.debt || 0);
      setShopCardAddress(shop.address || "");
      setShopCardNote(shop.note || "");
      setShopCardStatus(shop.isArchived ? "archive" : "active");
    } else {
      setShopCardName("");
      setShopCardContact("");
      setShopCardPhone("");
      setShopCardDebt(0);
      setShopCardAddress("");
      setShopCardNote("");
      setShopCardStatus("active");
    }
    setIsShopModalOpen(true);
  };

  const handleShopSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopCardName) {
      showToast("Название магазина обязательно", "error");
      return;
    }

    try {
      const id = editingShop ? editingShop.id : "shop-" + Date.now();
      const payload = {
        ...(editingShop || {}),
        id,
        name: shopCardName,
        contact: shopCardContact,
        phone: shopCardPhone,
        debt: Number(shopCardDebt),
        address: shopCardAddress,
        note: shopCardNote,
        isArchived: shopCardStatus === "archive"
      };

      await saveShop(payload);

      await addActivityLog({
        timestamp: new Date().toISOString(),
        type: "adjustment",
        message: lang === "ru"
          ? `Администратор сохранил карту магазина: ${shopCardName}`
          : `Administrator do'kon kartasini saqladi: ${shopCardName}`,
        amount: 0,
        operator: username
      });

      showToast(lang === "ru" ? "Карточка магазина сохранена" : "Do'kon kartasi saqlandi");
      setIsShopModalOpen(false);
      reloadData(true);
    } catch (err) {
      showToast("Ошибка сохранения карточки", "error");
    }
  };

  const handleToggleArchiveShop = async (shop: any) => {
    try {
      const payload = {
        ...shop,
        isArchived: !shop.isArchived
      };
      await saveShop(payload);

      await addActivityLog({
        timestamp: new Date().toISOString(),
        type: "adjustment",
        message: lang === "ru"
          ? `Администратор ${shop.isArchived ? "разархивировал" : "архивировал"} магазин ${shop.name}`
          : `Administrator do'konni ${shop.isArchived ? "arxivdan chiqardi" : "arxivladi"}: ${shop.name}`,
        amount: 0,
        operator: username
      });

      showToast(lang === "ru" ? "Статус архивации изменен" : "Arxiv holati o'zgartirildi");
      reloadData(true);
    } catch (err) {
      showToast("Ошибка переключения архивации", "error");
    }
  };

  // Merge Duplicates Action
  const handleMergeShops = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mergeSourceId || !mergeTargetId || mergeSourceId === mergeTargetId) {
      showToast("Выберите два разных магазина", "error");
      return;
    }

    try {
      const sourceShop = shops.find(s => s.id === mergeSourceId);
      const targetShop = shops.find(s => s.id === mergeTargetId);

      if (!sourceShop || !targetShop) {
        showToast("Выбранные магазины не найдены", "error");
        return;
      }

      // 1. Accumulate debt to Target Shop
      const targetUpdatedDebt = targetShop.debt + sourceShop.debt;
      const targetPayload = {
        ...targetShop,
        debt: targetUpdatedDebt,
        lastPurchaseDate: sourceShop.lastPurchaseDate && (!targetShop.lastPurchaseDate || new Date(sourceShop.lastPurchaseDate) > new Date(targetShop.lastPurchaseDate))
          ? sourceShop.lastPurchaseDate
          : targetShop.lastPurchaseDate,
        lastPaymentDate: sourceShop.lastPaymentDate && (!targetShop.lastPaymentDate || new Date(sourceShop.lastPaymentDate) > new Date(targetShop.lastPaymentDate))
          ? sourceShop.lastPaymentDate
          : targetShop.lastPaymentDate
      };
      await saveShop(targetPayload);

      // 2. Mark source as Archived and Duplicate merged
      const sourcePayload = {
        ...sourceShop,
        debt: 0,
        name: `${sourceShop.name} (Дубликат - объединен)`,
        isArchived: true
      };
      await saveShop(sourcePayload);

      // 3. Update Activity logs shop references
      const shopLogs = activityLogs.filter(log => log.shopId === sourceShop.id);
      for (const log of shopLogs) {
        await updateActivityLog(log.id, {
          shopId: targetShop.id,
          message: log.message.replace(sourceShop.name, targetShop.name)
        });
      }

      // 4. Write audit logs
      await addActivityLog({
        timestamp: new Date().toISOString(),
        type: "adjustment",
        message: lang === "ru"
          ? `Объединение дубликатов: Магазин "${sourceShop.name}" объединен в "${targetShop.name}". Долг ${sourceShop.debt.toLocaleString()} сум перенесен.`
          : `Dublikatlarni birlashtirish: "${sourceShop.name}" do'koni "${targetShop.name}" ga birlashtirildi. ${sourceShop.debt.toLocaleString()} so'm qarz o'tkazildi.`,
        amount: 0,
        operator: username
      });

      showToast(lang === "ru" ? "Магазины успешно объединены" : "Do'konlar muvaffaqiyatli birlashtirildi");
      setIsMergeOpen(false);
      setMergeSourceId("");
      setMergeTargetId("");
      reloadData(true);
    } catch (err) {
      console.error(err);
      showToast("Ошибка объединения дубликатов", "error");
    }
  };

  // Operations Overrides (Edit sum / Annul / Cancel)
  const handleOpenEditLog = (log: any) => {
    setEditingLog(log);
    setEditingLogAmount(log.amount || 0);
    setIsEditLogOpen(true);
  };

  const handleEditLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLog || editingLogAmount < 0) return;

    try {
      const oldAmount = editingLog.amount || 0;
      const diff = editingLogAmount - oldAmount;

      // Find shop matching either directly by shopId or parsing message
      let shop = shops.find(s => s.id === editingLog.shopId);
      if (!shop && editingLog.message) {
        shop = shops.find(s => editingLog.message.includes(s.name));
      }

      if (shop) {
        let updatedDebt = shop.debt;
        if (editingLog.type === "payment" && !editingLog.qty) {
          // If payment decreases: shop's debt increases
          updatedDebt -= diff;
        } else if (editingLog.type === "sale" || editingLog.qty) {
          // If sale increases: shop's debt increases
          updatedDebt += diff;
        }

        await saveShop({
          ...shop,
          debt: Math.max(0, updatedDebt)
        });
      }

      // Update actual log with edit data
      await updateActivityLog(editingLog.id, {
        amount: editingLogAmount,
        isEdited: true,
        editedBy: username,
        editedAt: new Date().toISOString(),
        message: editingLog.message.replace(oldAmount.toLocaleString(), editingLogAmount.toLocaleString())
      });

      // Write System Audit Log
      await addActivityLog({
        timestamp: new Date().toISOString(),
        type: "audit",
        message: `Администратор ${username} изменил сумму операции #${editingLog.id} с ${oldAmount.toLocaleString()} на ${editingLogAmount.toLocaleString()} сум.`,
        amount: 0,
        operator: username
      });

      showToast(lang === "ru" ? "Сумма операции изменена" : "Amaliyot summasi o'zgartirildi");
      setIsEditLogOpen(false);
      setEditingLog(null);
      reloadData(true);
    } catch (err) {
      showToast("Ошибка изменения суммы операции", "error");
    }
  };

  const handleAnnulLog = async (log: any) => {
    if (log.isCancelled) return;

    try {
      // Find matching shop
      let shop = shops.find(s => s.id === log.shopId);
      if (!shop && log.message) {
        shop = shops.find(s => log.message.includes(s.name));
      }

      if (shop) {
        let updatedDebt = shop.debt;
        if (log.type === "payment" && !log.qty) {
          // Annul payment -> debt increases back
          updatedDebt += log.amount;
        } else if (log.type === "sale" || log.qty) {
          // Annul sale -> debt decreases
          updatedDebt = Math.max(0, updatedDebt - log.amount);
        }

        await saveShop({
          ...shop,
          debt: updatedDebt
        });
      }

      // Mark actual log as Cancelled
      await updateActivityLog(log.id, {
        isCancelled: true,
        cancelledBy: username,
        cancelledAt: new Date().toISOString()
      });

      // Write Audit log
      await addActivityLog({
        timestamp: new Date().toISOString(),
        type: "audit",
        message: `Администратор ${username} АННУЛИРОВАЛ операцию #${log.id} (${log.message})`,
        amount: 0,
        operator: username
      });

      showToast(lang === "ru" ? "Операция аннулирована" : "Amaliyot muvaffaqiyatli bekor qilindi");
      reloadData(true);
    } catch (err) {
      showToast("Ошибка аннулирования операции", "error");
    }
  };

  // CSV Exporter for Excel Compatibility
  const handleDownloadCSV = () => {
    try {
      let csvContent = "\uFEFF"; // UTF-8 BOM so Excel decodes Cyrillic and Uzbek correctly
      
      csvContent += "ОТЧЕТ КОМПАНИИ EGG LOGISTICS B2B\n";
      csvContent += `Выгружено администратором: ${username}\n`;
      csvContent += `Дата формирования: ${new Date().toLocaleString()}\n\n`;
      
      // 1. Debtors Section
      csvContent += "РЕЕСТР ДОЛЖНИКОВ И КЛИЕНТОВ\n";
      csvContent += "ID;Название;Контакт;Телефон;Сумма долга (сум);Статус\n";
      shops.forEach(s => {
        const isArch = s.isArchived ? "Архивный" : "Активный";
        csvContent += `${s.id};${s.name};${s.contact || "-"};${s.phone || "-"};${s.debt};${isArch}\n`;
      });
      csvContent += "\n\n";

      // 2. Operations Journal
      csvContent += "ЖУРНАЛ ВСЕХ ОПЕРАЦИЙ (ТРАНЗАКЦИЙ)\n";
      csvContent += "ID;Дата;Тип;Операция;Сумма (сум);Исполнитель;Статус\n";
      activityLogs.forEach(l => {
        const dateStr = l.timestamp ? new Date(l.timestamp).toLocaleString() : "";
        const stat = l.isCancelled ? "АННУЛИРОВАНО" : l.isEdited ? "ИЗМЕНЕНО" : "ПРОВЕДЕНО";
        csvContent += `${l.id};${dateStr};${l.type};${(l.message || "").replace(/;/g, ",")};${l.amount};${l.operator};${stat}\n`;
      });

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `egg_logistics_full_report_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showToast(lang === "ru" ? "Отчет успешно скачан в CSV (Excel)" : "Hisobot Excel (CSV) yuklab olindi");
    } catch (err) {
      showToast("Ошибка выгрузки отчета", "error");
    }
  };

  // Compute stats dynamically
  const stats = useMemo(() => {
    let totalDebtSum = 0;
    let salesTodaySum = 0;
    let cashCollectedSum = 0;

    shops.forEach(shop => {
      if (!shop.isArchived) {
        totalDebtSum += (shop.debt || 0);
      }
    });

    const todayStr = new Date().toISOString().split("T")[0];
    activityLogs.forEach(log => {
      if (log.isCancelled) return; // skip cancelled logs from stats calculations

      const logDate = log.timestamp ? log.timestamp.split("T")[0] : "";
      if (logDate === todayStr) {
        if (log.type === "sale") {
          salesTodaySum += (log.amount || 0);
        } else if (log.type === "payment") {
          cashCollectedSum += (log.amount || 0);
        }
      }
    });

    return {
      totalDebt: totalDebtSum,
      salesToday: salesTodaySum,
      cashCollected: cashCollectedSum,
      activeDeliverersCount: deliverers.filter(d => d.status === "online").length,
      totalDeliverersCount: deliverers.length,
    };
  }, [shops, activityLogs, deliverers]);

  // Computed and Sorted Debtors
  const processedDebtors = useMemo(() => {
    const thresholdDays = settings?.oldDebtThresholdDays || 10;
    
    const calculated = shops
      .filter(s => !s.isArchived)
      .map(shop => {
        let delayDays = 0;
        if (shop.debt > 0) {
          const referenceDate = shop.lastPaymentDate || shop.lastPurchaseDate;
          if (referenceDate && nowTime > 0) {
            const diffMs = nowTime - new Date(referenceDate).getTime();
            delayDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
          } else {
            delayDays = 15;
          }
        }

        let status: "critical" | "pending" | "ontime" | "inspection" = "ontime";
        if (shop.debt > 0) {
          if (delayDays > thresholdDays) {
            status = "critical";
          } else if (delayDays > thresholdDays / 2) {
            status = "inspection";
          } else {
            status = "pending";
          }
        }

        return {
          ...shop,
          delayDays,
          status,
        };
      });

    let filtered = calculated.filter(shop => {
      const matchSearch = shop.name.toLowerCase().includes(debtorSearch.toLowerCase()) || 
                          (shop.contact || "").toLowerCase().includes(debtorSearch.toLowerCase());
      return matchSearch;
    });

    filtered.sort((a, b) => {
      let valA = debtorSortField === "debt" ? a.debt : a.delayDays;
      let valB = debtorSortField === "debt" ? b.debt : b.delayDays;
      return debtorSortDir === "asc" ? valA - valB : valB - valA;
    });

    return filtered;
  }, [shops, debtorSearch, debtorSortField, debtorSortDir, settings, nowTime]);

  // Computed operations with detailed filter
  const filteredOperations = useMemo(() => {
    return activityLogs.filter(log => {
      // 1. Search Query Match
      const msgMatch = (log.message || "").toLowerCase().includes(opSearchQuery.toLowerCase()) ||
                       (log.id || "").toLowerCase().includes(opSearchQuery.toLowerCase());
      if (!msgMatch) return false;

      // 2. Type Match
      if (opFilterType !== "all") {
        if (opFilterType === "sale" && log.type !== "sale") return false;
        if (opFilterType === "payment" && log.type !== "payment") return false;
      }

      // 3. Operator Match
      if (opFilterOperator !== "all" && log.operator !== opFilterOperator) return false;

      // 4. Period Match
      if (opFilterPeriod !== "all") {
        const now = new Date();
        const logDate = log.timestamp ? new Date(log.timestamp) : null;
        if (!logDate) return false;

        if (opFilterPeriod === "today") {
          return logDate.toDateString() === now.toDateString();
        } else if (opFilterPeriod === "yesterday") {
          const yesterday = new Date();
          yesterday.setDate(now.getDate() - 1);
          return logDate.toDateString() === yesterday.toDateString();
        }
      }

      return true;
    });
  }, [activityLogs, opSearchQuery, opFilterType, opFilterOperator, opFilterPeriod]);

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-900 overflow-hidden">
      
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm flex items-center gap-2.5 transition-all animate-bounce ${
          toast.type === "success" 
            ? "bg-slate-900 text-amber-400 border-slate-800" 
            : "bg-red-900 text-red-100 border-red-800"
        }`}>
          {toast.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0 border-r border-slate-800">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center text-slate-900 font-bold italic">E</div>
          <span className="font-bold tracking-tight text-xl">EggLogistics <span className="text-amber-400 text-xs align-top font-mono">B2B</span></span>
        </div>
        
        <nav className="flex-1 py-6 flex flex-col gap-1 overflow-y-auto">
          <button 
            onClick={() => setActiveTab("dashboard")}
            className={`flex items-center px-6 py-3 font-medium text-sm text-left transition-all cursor-pointer ${
              activeTab === "dashboard" ? "bg-slate-800 text-amber-400 border-l-4 border-amber-400" : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span className="mr-3 opacity-80 text-base">📊</span> {t.dashboard}
          </button>

          <button 
            onClick={() => setActiveTab("deliverers")}
            className={`flex items-center px-6 py-3 font-medium text-sm text-left transition-all cursor-pointer ${
              activeTab === "deliverers" ? "bg-slate-800 text-amber-400 border-l-4 border-amber-400" : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span className="mr-3 opacity-80 text-base">🚚</span> 
            <span>{lang === "ru" ? "Доставщики" : "Yetkazib beruvchilar"}</span>
          </button>

          <button 
            onClick={() => setActiveTab("shops")}
            className={`flex items-center px-6 py-3 font-medium text-sm text-left transition-all cursor-pointer ${
              activeTab === "shops" ? "bg-slate-800 text-amber-400 border-l-4 border-amber-400" : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span className="mr-3 opacity-80 text-base">🏪</span> {t.shops}
          </button>

          <button 
            onClick={() => setActiveTab("operations")}
            className={`flex items-center px-6 py-3 font-medium text-sm text-left transition-all cursor-pointer ${
              activeTab === "operations" ? "bg-slate-800 text-amber-400 border-l-4 border-amber-400" : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span className="mr-3 opacity-80 text-base">📖</span> 
            <span>{lang === "ru" ? "Журнал операций" : "Amaliyotlar jurnali"}</span>
          </button>

          <button 
            onClick={() => setActiveTab("egg_types")}
            className={`flex items-center px-6 py-3 font-medium text-sm text-left transition-all cursor-pointer ${
              activeTab === "egg_types" ? "bg-slate-800 text-amber-400 border-l-4 border-amber-400" : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span className="mr-3 opacity-80 text-base">🥚</span> 
            <span>{lang === "ru" ? "Справочник яиц" : "Tuxum turlari"}</span>
          </button>

          <button 
            onClick={() => setActiveTab("audit")}
            className={`flex items-center px-6 py-3 font-medium text-sm text-left transition-all cursor-pointer ${
              activeTab === "audit" ? "bg-slate-800 text-amber-400 border-l-4 border-amber-400" : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span className="mr-3 opacity-80 text-base">🛡️</span> 
            <span>{lang === "ru" ? "Журнал действий" : "Harakatlar jurnali"}</span>
          </button>
        </nav>

        {/* User profile details */}
        <div className="p-6 border-t border-slate-800 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center text-xs font-mono text-amber-400 border border-slate-600 font-bold">
              ADM
            </div>
            <div>
              <p className="text-sm font-medium">{username}</p>
              <p className="text-xs text-slate-500">{t.administrator}</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-slate-800 hover:bg-red-950 hover:text-red-300 text-slate-300 rounded-lg text-xs font-bold transition-all border border-slate-700 hover:border-red-900 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t.backToLogin}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 gap-3">
          <Loader2 className="w-10 h-10 text-slate-950 animate-spin" />
          <span className="font-mono text-xs text-slate-400 tracking-wider uppercase">Loading database...</span>
        </div>
      ) : (
        <main className="flex-1 flex flex-col overflow-hidden">
          
          {/* Header Bar */}
          <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
            <h1 className="text-lg font-semibold text-slate-800 font-sans tracking-tight uppercase">
              {activeTab === "dashboard" ? t.companySummary :
               activeTab === "deliverers" ? (lang === "ru" ? "Управление доставщиками" : "Yetkazib beruvchilarni boshqarish") :
               activeTab === "shops" ? (lang === "ru" ? "Справочник торговых точек" : "Do'konlar va mijozlar") :
               activeTab === "operations" ? (lang === "ru" ? "Корректировка и аннулирование операций" : "Amaliyotlarni tahrirlash va bekor qilish") :
               activeTab === "egg_types" ? (lang === "ru" ? "Справочник видов яиц и цен" : "Tuxum turlari va narxlari") :
               (lang === "ru" ? "Системный журнал действий" : "Tizim harakatlari jurnali")}
            </h1>
            
            <div className="flex items-center gap-4">
              
              {/* Language toggle */}
              <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
                <button 
                  onClick={() => setLang("ru")}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    lang === "ru" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  RU
                </button>
                <button 
                  onClick={() => setLang("uz")}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    lang === "uz" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  UZ
                </button>
              </div>

              {/* Action Buttons */}
              <button 
                onClick={handleDownloadCSV}
                className="p-2 bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Скачать отчет в Excel (CSV)"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span className="hidden sm:inline">{lang === "ru" ? "Выгрузка в Excel" : "Excel hisobot"}</span>
              </button>

              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                title="Настройки"
              >
                <Settings className="w-4 h-4" />
              </button>

              <button 
                onClick={() => setIsNewSaleOpen(true)}
                className="bg-amber-400 hover:bg-amber-500 text-slate-900 px-4 py-2 rounded-lg font-bold text-sm shadow-sm hover:shadow active:scale-95 transition-all flex items-center gap-2 cursor-pointer border border-amber-300"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{t.newSale}</span>
              </button>
            </div>
          </header>

          {/* Core Content Area */}
          <div className="p-8 flex-1 overflow-y-auto flex flex-col gap-8">
            
            {/* 1. TAB: DASHBOARD */}
            {activeTab === "dashboard" && (
              <>
                {/* Top KPI Stats */}
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 shrink-0">
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-colors">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t.totalDebt}</p>
                      <p className="text-2xl font-mono font-bold text-red-600">
                        {stats.totalDebt.toLocaleString()} <span className="text-sm font-medium">{t.sum}</span>
                      </p>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1">
                      <span className="text-red-500 font-bold">↑ 4.2%</span> за неделю
                    </p>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-colors">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t.salesToday}</p>
                      <p className="text-2xl font-mono font-bold text-slate-900">
                        {stats.salesToday.toLocaleString()} <span className="text-sm font-medium">{t.sum}</span>
                      </p>
                    </div>
                    <p className="text-[10px] text-green-600 mt-2 font-medium">
                      Операции за сегодня ({activityLogs.filter(l => l.timestamp?.split("T")[0] === new Date().toISOString().split("T")[0] && !l.isCancelled).length} шт)
                    </p>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-colors">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t.cashCollected}</p>
                      <p className="text-2xl font-mono font-bold text-slate-900">
                        {stats.cashCollected.toLocaleString()} <span className="text-sm font-medium">{t.sum}</span>
                      </p>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2">
                      <span className="text-slate-900 font-bold">71%</span> от плана на сегодня
                    </p>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-colors">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t.activeDeliverers}</p>
                      <p className="text-2xl font-mono font-bold text-slate-900">
                        {stats.activeDeliverersCount} / {stats.totalDeliverersCount}
                      </p>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2">
                      Всего зарегистрировано: <span className="text-slate-900 font-bold">{stats.totalDeliverersCount} курьеров</span>
                    </p>
                  </div>
                </section>

                {/* Grid Split */}
                <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                  
                  {/* Top Debtors List */}
                  <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <h2 className="font-bold text-slate-700">{t.topDebtors}</h2>
                      
                      {/* Sorting & Search */}
                      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                        <div className="relative flex-1 sm:flex-initial">
                          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                          <input
                            type="text"
                            placeholder={t.searchPlaceholder}
                            value={debtorSearch}
                            onChange={(e) => setDebtorSearch(e.target.value)}
                            className="pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium focus:outline-none focus:border-amber-400 w-full sm:w-56"
                          />
                        </div>

                        <button 
                          onClick={() => {
                            if (debtorSortField === "debt") {
                              setDebtorSortDir(prev => prev === "asc" ? "desc" : "asc");
                            } else {
                              setDebtorSortField("debt");
                              setDebtorSortDir("desc");
                            }
                          }}
                          className={`p-2 rounded-lg border text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                            debtorSortField === "debt" ? "bg-slate-900 border-slate-800 text-amber-400" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-600"
                          }`}
                        >
                          <span>{t.debtValue}</span>
                          <ArrowUpDown className="w-3.5 h-3.5" />
                        </button>

                        <button 
                          onClick={() => {
                            if (debtorSortField === "delay") {
                              setDebtorSortDir(prev => prev === "asc" ? "desc" : "asc");
                            } else {
                              setDebtorSortField("delay");
                              setDebtorSortDir("desc");
                            }
                          }}
                          className={`p-2 rounded-lg border text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                            debtorSortField === "delay" ? "bg-slate-900 border-slate-800 text-amber-400" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-600"
                          }`}
                        >
                          <span>{t.delayDays}</span>
                          <ArrowUpDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-500">
                            <th className="px-6 py-3 font-bold">{t.shopClient}</th>
                            <th className="px-6 py-3 font-bold text-center">{t.delayDays}</th>
                            <th className="px-6 py-3 font-bold text-right">{t.debtAmount}</th>
                            <th className="px-6 py-3 font-bold text-center">{t.status}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                          {processedDebtors.map((shop) => (
                            <tr key={shop.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-3.5">
                                <p className="font-bold text-slate-800 italic font-serif text-base">{shop.name}</p>
                                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{shop.contact} ({shop.phone})</p>
                              </td>
                              <td className="px-6 py-3.5 text-center font-mono text-xs font-semibold">
                                {shop.debt > 0 ? `${shop.delayDays} дн.` : "—"}
                              </td>
                              <td className="px-6 py-3.5 text-right font-mono font-bold text-slate-900">
                                {shop.debt.toLocaleString()} {t.sum}
                              </td>
                              <td className="px-6 py-3.5 text-center">
                                {shop.debt > 0 ? (
                                  <span className={`inline-block px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                                    shop.status === "critical" ? "bg-red-100 text-red-700" :
                                    shop.status === "inspection" ? "bg-orange-100 text-orange-700" : "bg-amber-100 text-amber-700"
                                  }`}>
                                    {shop.status === "critical" ? t.critical : 
                                     shop.status === "inspection" ? t.inspection : t.pending}
                                  </span>
                                ) : (
                                  <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase tracking-wider">
                                    {t.onTime}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                          {processedDebtors.length === 0 && (
                            <tr>
                              <td colSpan={4} className="p-8 text-center text-slate-400 text-xs font-medium">
                                Нет должников, соответствующих фильтру.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                      <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">
                        {t.totalDebtorsInBase}: {shops.filter(s => s.debt > 0).length} точек
                      </span>
                    </div>
                  </div>

                  {/* Sidebar stats & stocks */}
                  <div className="flex flex-col gap-6">
                    {/* Warehouse stocks */}
                    <div className="bg-slate-900 text-white p-6 rounded-xl shadow-lg border border-slate-800">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2 flex justify-between items-center">
                        <span>{t.warehouseStocks}</span>
                        <span className="text-[10px] text-amber-400 font-mono">LIVE</span>
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between items-end mb-1.5">
                            <span className="text-sm italic font-serif">Вид C0</span>
                            <span className="font-mono font-bold text-amber-400">{(inventory?.c0 || 0).toLocaleString()} {t.lot}</span>
                          </div>
                          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div className="bg-amber-400 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, ((inventory?.c0 || 1) / 3000) * 100)}%` }}></div>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between items-end mb-1.5">
                            <span className="text-sm italic font-serif">Вид C1</span>
                            <span className="font-mono font-bold text-white">{(inventory?.c1 || 0).toLocaleString()} {t.lot}</span>
                          </div>
                          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div className="bg-slate-400 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, ((inventory?.c1 || 1) / 10000) * 100)}%` }}></div>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between items-end mb-1.5">
                            <span className="text-sm italic font-serif">Домашние</span>
                            <span className="font-mono font-bold text-white">{(inventory?.domestic || 0).toLocaleString()} {t.lot}</span>
                          </div>
                          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div className="bg-amber-600 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, ((inventory?.domestic || 1) / 2000) * 100)}%` }}></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quick prices list */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Текущие цены</h3>
                      <div className="grid grid-cols-3 gap-2 font-mono text-center text-xs">
                        <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                          <p className="text-slate-400 font-bold">C0</p>
                          <p className="font-bold text-slate-800 mt-1">{priceC0} сум</p>
                        </div>
                        <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                          <p className="text-slate-400 font-bold">C1</p>
                          <p className="font-bold text-slate-800 mt-1">{priceC1} сум</p>
                        </div>
                        <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                          <p className="text-slate-400 font-bold">Ут.</p>
                          <p className="font-bold text-slate-800 mt-1">{priceDom} сум</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </>
            )}

            {/* 2. TAB: DELIVERERS MANAGEMENT */}
            {activeTab === "deliverers" && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <div>
                    <h2 className="font-bold text-slate-800 text-base">{lang === "ru" ? "Учётные записи доставщиков" : "Yetkazib beruvchilar hisoblari"}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">{lang === "ru" ? "Создание и блокирование учетных записей логистов" : "Logistlar hisoblarini yaratish va bloklash"}</p>
                  </div>
                  <button 
                    onClick={() => handleOpenDelivererModal()}
                    className="bg-slate-900 hover:bg-slate-800 text-amber-400 text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>{lang === "ru" ? "Добавить доставщика" : "Yangi qo'shish"}</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-150 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                        <th className="px-6 py-3.5">Имя</th>
                        <th className="px-6 py-3.5">Логин для входа</th>
                        <th className="px-6 py-3.5">Телефон</th>
                        <th className="px-6 py-3.5">Пароль</th>
                        <th className="px-6 py-3.5 text-center">Статус</th>
                        <th className="px-6 py-3.5 text-right">Действия</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {deliverers.map(del => (
                        <tr key={del.id} className={`hover:bg-slate-50/50 transition-colors ${del.status === "blocked" ? "opacity-60 bg-red-50/20" : ""}`}>
                          <td className="px-6 py-3.5 font-bold text-slate-800">{del.name}</td>
                          <td className="px-6 py-3.5 font-mono text-xs">{del.username || del.name.toLowerCase()}</td>
                          <td className="px-6 py-3.5 font-mono text-xs text-slate-600">{del.phone || "—"}</td>
                          <td className="px-6 py-3.5 font-mono text-xs text-slate-500">{del.password || "123"}</td>
                          <td className="px-6 py-3.5 text-center">
                            <span className={`inline-block px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                              del.status === "blocked" 
                                ? "bg-red-100 text-red-700" 
                                : del.status === "online" 
                                  ? "bg-green-100 text-green-700" 
                                  : "bg-slate-100 text-slate-600"
                            }`}>
                              {del.status === "blocked" ? (lang === "ru" ? "ЗАБЛОКИРОВАН" : "BLOKLANGAN") :
                               del.status === "online" ? "ONLINE" : "OFFLINE"}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-right">
                            <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => handleToggleBlockDeliverer(del)}
                                className={`p-1.5 rounded border text-xs font-bold transition-all cursor-pointer ${
                                  del.status === "blocked"
                                    ? "bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                                    : "bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                                }`}
                                title={del.status === "blocked" ? "Разблокировать" : "Заблокировать"}
                              >
                                {del.status === "blocked" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                              </button>
                              <button 
                                onClick={() => handleOpenDelivererModal(del)}
                                className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded transition-all cursor-pointer"
                                title="Редактировать данные"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3. TAB: SHOPS CLIENTS DIRECTORY */}
            {activeTab === "shops" && (
              <div className="flex flex-col gap-6">
                
                {/* Shops Controls Card */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <h2 className="font-bold text-slate-800 text-base">{lang === "ru" ? "Справочник торговых точек" : "Do'konlar katalogi"}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">{lang === "ru" ? "Редактирование профилей, архивирование и объединение дубликатов" : "Do'konlarni tahrirlash, arxivlash va birlashtirish"}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input 
                        type="text" 
                        placeholder="Поиск магазина или телефона..." 
                        value={shopFilterQuery}
                        onChange={(e) => setShopFilterQuery(e.target.value)}
                        className="pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium focus:outline-none focus:border-amber-400 w-56 bg-slate-50/50"
                      />
                    </div>

                    <button
                      onClick={() => setShopShowArchived(prev => !prev)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                        shopShowArchived ? "bg-slate-900 border-slate-800 text-amber-400" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-600"
                      }`}
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>{lang === "ru" ? "Показать архивные" : "Arxivdagilarni ko'rsatish"}</span>
                    </button>

                    <button 
                      onClick={() => setIsMergeOpen(true)}
                      className="bg-amber-100 hover:bg-amber-200 border border-amber-200 text-amber-900 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors flex items-center gap-1"
                    >
                      <span>{lang === "ru" ? "Объединить дубликаты" : "Dublikatlarni birlashtirish"}</span>
                    </button>

                    <button 
                      onClick={() => handleOpenShopModal()}
                      className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                    >
                      {lang === "ru" ? "+ Новый магазин" : "+ Yangi do'kon"}
                    </button>
                  </div>
                </div>

                {/* Shops List Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-150 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                          <th className="px-6 py-3.5">Магазин / Название</th>
                          <th className="px-6 py-3.5">Контактное лицо</th>
                          <th className="px-6 py-3.5">Телефон</th>
                          <th className="px-6 py-3.5 text-right">Текущий долг (сум)</th>
                          <th className="px-6 py-3.5 text-center">Статус</th>
                          <th className="px-6 py-3.5 text-right">Действия</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {shops
                          .filter(s => {
                            if (!shopShowArchived && s.isArchived) return false;
                            const term = shopFilterQuery.toLowerCase();
                            return s.name.toLowerCase().includes(term) || (s.contact || "").toLowerCase().includes(term) || (s.phone || "").includes(term);
                          })
                          .map(shop => (
                            <tr key={shop.id} className={`hover:bg-slate-50/50 transition-colors ${shop.isArchived ? "bg-slate-50 opacity-60" : ""}`}>
                              <td className="px-6 py-3.5">
                                <span className="font-serif italic font-bold text-slate-800 text-base">{shop.name}</span>
                                {shop.isArchived && (
                                  <span className="ml-2 bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider">
                                    Архив
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-3.5 font-medium text-slate-600">{shop.contact || "—"}</td>
                              <td className="px-6 py-3.5 font-mono text-xs">{shop.phone || "—"}</td>
                              <td className="px-6 py-3.5 text-right font-mono font-bold text-slate-900">
                                {shop.debt.toLocaleString()} сум
                              </td>
                              <td className="px-6 py-3.5 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                  shop.isArchived ? "bg-slate-100 text-slate-500" :
                                  shop.debt > 0 ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"
                                }`}>
                                  {shop.isArchived ? "Архив" : shop.debt > 0 ? "Долг" : "Оплачено"}
                                </span>
                              </td>
                              <td className="px-6 py-3.5 text-right">
                                <div className="flex justify-end gap-2">
                                  <button 
                                    onClick={() => setSelectedShopProfileId(shop.id)}
                                    className="p-1.5 hover:bg-slate-100 border border-slate-200 rounded text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                                    title="Профиль и история"
                                  >
                                    <Building2 className="w-3.5 h-3.5 text-amber-500" />
                                  </button>
                                  <button 
                                    onClick={() => handleToggleArchiveShop(shop)}
                                    className="p-1.5 hover:bg-slate-100 border border-slate-200 rounded text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                                    title={shop.isArchived ? "Разархивировать" : "Архивировать"}
                                  >
                                    <Archive className="w-3.5 h-3.5" />
                                  </button>
                                  <button 
                                    onClick={() => handleOpenShopModal(shop)}
                                    className="p-1.5 hover:bg-slate-100 border border-slate-200 rounded text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                                    title="Редактировать карточку"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 4. TAB: OPERATIONS JOURNAL WITH CORRECTIONS */}
            {activeTab === "operations" && (
              <div className="flex flex-col gap-6">
                
                {/* Filters Row */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <div>
                      <h2 className="font-bold text-slate-800 text-base">{lang === "ru" ? "Корректировка и аннулирование операций" : "Amaliyotlarni tahrirlash va bekor qilish"}</h2>
                      <p className="text-xs text-slate-400 mt-0.5">{lang === "ru" ? "Административное исправление сумм и отмена любых транзакций" : "Tranzaksiyalarni tahrirlash va hisobdan chiqarish"}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {/* Period Filter */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Период</label>
                      <select 
                        value={opFilterPeriod}
                        onChange={(e) => setOpFilterPeriod(e.target.value as any)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white font-medium"
                      >
                        <option value="all">Все время</option>
                        <option value="today">Сегодня</option>
                        <option value="yesterday">Вчера</option>
                      </select>
                    </div>

                    {/* Type Filter */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Тип операции</label>
                      <select 
                        value={opFilterType}
                        onChange={(e) => setOpFilterType(e.target.value as any)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white font-medium"
                      >
                        <option value="all">Все типы</option>
                        <option value="sale">Продажи (начисление долга)</option>
                        <option value="payment">Прием оплаты (погашение долга)</option>
                      </select>
                    </div>

                    {/* Operator/Deliverer Filter */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Доставщик</label>
                      <select 
                        value={opFilterOperator}
                        onChange={(e) => setOpFilterOperator(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white font-medium"
                      >
                        <option value="all">Все сотрудники</option>
                        {deliverers.map(d => (
                          <option key={d.id} value={d.name}>{d.name}</option>
                        ))}
                        <option value="Алишер К.">Алишер К. (Админ)</option>
                      </select>
                    </div>

                    {/* Search query */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Поиск</label>
                      <input 
                        type="text"
                        placeholder="ID, магазин, примечание..."
                        value={opSearchQuery}
                        onChange={(e) => setOpSearchQuery(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* Operations List Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-150 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                          <th className="px-6 py-3.5">ID / Дата</th>
                          <th className="px-6 py-3.5">Описание операции</th>
                          <th className="px-6 py-3.5 text-right">Сумма (сум)</th>
                          <th className="px-6 py-3.5">Исполнитель</th>
                          <th className="px-6 py-3.5 text-center">Статус</th>
                          <th className="px-6 py-3.5 text-right">Действия</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {filteredOperations.map(log => {
                          const dateStr = log.timestamp ? new Date(log.timestamp).toLocaleString() : "—";
                          return (
                            <tr key={log.id} className={`hover:bg-slate-50/50 transition-colors ${log.isCancelled ? "bg-slate-100 opacity-60" : ""}`}>
                              <td className="px-6 py-3.5">
                                <p className="font-mono text-xs font-bold text-slate-500 uppercase">#{log.id}</p>
                                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{dateStr}</p>
                              </td>
                              <td className="px-6 py-3.5">
                                <p className={`font-semibold ${log.isCancelled ? "line-through text-slate-400" : "text-slate-800"}`}>{log.message}</p>
                                {log.isEdited && (
                                  <p className="text-[9px] text-blue-600 font-bold uppercase tracking-wide mt-1">
                                    [Изменено админом: {log.editedBy || "Админ"}]
                                  </p>
                                )}
                                {log.isCancelled && (
                                  <p className="text-[9px] text-red-600 font-bold uppercase tracking-wide mt-1">
                                    [АННУЛИРОВАНО: {log.cancelledBy || "Админ"}]
                                  </p>
                                )}
                              </td>
                              <td className="px-6 py-3.5 text-right font-mono font-bold text-slate-900">
                                {log.amount?.toLocaleString()} сум
                              </td>
                              <td className="px-6 py-3.5 font-medium text-slate-600">{log.operator}</td>
                              <td className="px-6 py-3.5 text-center">
                                <span className={`inline-block px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  log.isCancelled 
                                    ? "bg-slate-200 text-slate-600" 
                                    : log.type === "payment" && !log.qty
                                      ? "bg-green-100 text-green-800" 
                                      : "bg-amber-100 text-amber-800"
                                }`}>
                                  {log.isCancelled ? "АННУЛИРОВАНО" : log.type === "payment" && !log.qty ? "Оплата" : "Продажа"}
                                </span>
                              </td>
                              <td className="px-6 py-3.5 text-right">
                                {!log.isCancelled ? (
                                  <div className="flex justify-end gap-2">
                                    <button 
                                      onClick={() => {
                                        if (confirm("Вы действительно хотите аннулировать и отменить эту операцию? Баланс долга магазина будет автоматически пересчитан.")) {
                                          handleAnnulLog(log);
                                        }
                                      }}
                                      className="p-1.5 hover:bg-red-50 hover:text-red-600 border border-slate-200 rounded transition-colors cursor-pointer"
                                      title="Аннулировать операцию"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                    </button>
                                    <button 
                                      onClick={() => handleOpenEditLog(log)}
                                      className="p-1.5 hover:bg-slate-100 border border-slate-200 rounded text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                                      title="Исправить сумму"
                                    >
                                      <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-bold uppercase">Исключено</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {filteredOperations.length === 0 && (
                          <tr>
                            <td colSpan={6} className="p-12 text-center text-slate-400 text-xs font-semibold">
                              Записи операций по выбранным фильтрам отсутствуют.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 5. TAB: EGG TYPES DIRECTORY */}
            {activeTab === "egg_types" && (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                
                {/* Left Area: Dynamic Egg Types Table (2/3 width) */}
                <div className="xl:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-6">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                        <span>🥚</span>
                        <span>{lang === "ru" ? "Справочник видов яиц и цен" : "Tuxum turlari va narxlari katalogi"}</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {lang === "ru" ? "Добавление сортов яиц и цен за лоток. Цена за коробку рассчитывается автоматически." : "Tuxum turlarini qo'shish va lagan narxi. Quti narxi avtomatik hisoblanadi."}
                      </p>
                    </div>
                    <button 
                      onClick={() => handleOpenEggModal()}
                      className="bg-slate-900 hover:bg-slate-800 text-white hover:text-amber-400 text-xs font-bold px-3 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4 text-amber-400" />
                      <span>{lang === "ru" ? "Добавить сорт яиц" : "Yangi tur qo'shish"}</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-150 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                          <th className="px-4 py-3">ID / Код</th>
                          <th className="px-4 py-3">Название (RU)</th>
                          <th className="px-4 py-3">Название (UZ)</th>
                          <th className="px-4 py-3 text-right">Цена лотка (сум)</th>
                          <th className="px-4 py-3 text-right">Цена коробки (сум)</th>
                          <th className="px-4 py-3 text-center">Статус</th>
                          <th className="px-4 py-3 text-right">Действия</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {eggTypes.map((egg) => {
                          const traysInBox = settings?.traysPerBox || 12;
                          const calculatedBoxPrice = egg.pricePerTray * traysInBox;
                          return (
                            <tr key={egg.id} className={`hover:bg-slate-50/50 transition-colors ${egg.status === "archived" ? "opacity-60 bg-red-50/10" : ""}`}>
                              <td className="px-4 py-3.5 font-mono text-slate-500 font-bold uppercase">{egg.id}</td>
                              <td className="px-4 py-3.5 font-bold text-slate-800 italic">{egg.nameRu}</td>
                              <td className="px-4 py-3.5 font-bold text-slate-600 italic">{egg.nameUz}</td>
                              <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900">
                                {egg.pricePerTray.toLocaleString()}
                              </td>
                              <td className="px-4 py-3.5 text-right font-mono font-bold text-amber-600">
                                {calculatedBoxPrice.toLocaleString()}
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                                  egg.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                }`}>
                                  {egg.status === "active" ? (lang === "ru" ? "Активен" : "Faol") : "Архив"}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-right">
                                <div className="flex justify-end gap-2">
                                  <button 
                                    onClick={() => handleToggleEggStatus(egg)}
                                    className={`p-1.5 rounded border text-xs font-bold transition-all cursor-pointer ${
                                      egg.status === "archived"
                                        ? "bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                                        : "bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                                    }`}
                                    title={egg.status === "archived" ? "Разархивировать" : "В архив"}
                                  >
                                    <Archive className="w-3.5 h-3.5" />
                                  </button>
                                  <button 
                                    onClick={() => handleOpenEggModal(egg)}
                                    className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded transition-all cursor-pointer"
                                    title="Редактировать цену или название"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {eggTypes.length === 0 && (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">
                              {lang === "ru" ? "Нет зарегистрированных видов яиц" : "Tuxum turlari topilmadi"}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right Area: Price Change History (1/3 width) */}
                <div className="xl:col-span-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4 overflow-hidden">
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <span>{lang === "ru" ? "История изменений цен яиц" : "Narxlar o'zgarishi jurnali"}</span>
                  </h3>

                  <div className="divide-y divide-slate-100 overflow-y-auto max-h-[420px] pr-1">
                    {priceHistory.map((rec, idx) => (
                      <div key={rec.id || idx} className="py-3 flex flex-col gap-1 text-xs">
                        <div className="flex justify-between items-center">
                          <p className="font-bold text-slate-800">
                            {lang === "ru" ? "Дата изменений" : "O'zgarish sanasi"}: <span className="font-mono text-slate-500">{rec.date}</span>
                          </p>
                          <span className="text-[9px] text-slate-400 font-mono font-bold">#{rec.id?.slice(-6) || "SYS"}</span>
                        </div>
                        {rec.nameRu ? (
                          <div className="text-[10px] text-amber-700 font-medium flex items-center gap-1.5 mt-0.5">
                            <span className="font-bold">[{rec.nameRu}]</span> 
                            <span>{lang === "ru" ? "Цена за лоток" : "Lagan narxi"}:</span>
                            <span className="font-mono font-bold">{rec.pricePerTray?.toLocaleString()} сум</span>
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 gap-1 font-mono text-[9px] font-bold text-slate-600 mt-0.5">
                            <span className="text-amber-600">C0: {rec.c0Price?.toLocaleString()}</span>
                            <span className="text-slate-600 font-medium">C1: {rec.c1Price?.toLocaleString()}</span>
                            <span className="text-amber-800">Дом: {rec.domesticPrice?.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    ))}
                    {priceHistory.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-6">
                        {lang === "ru" ? "История изменений пуста" : "Tarix bo'sh"}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 6. TAB: SYSTEM AUDIT ACTION LOGS */}
            {activeTab === "audit" && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  <div>
                    <h2 className="font-bold text-slate-800 text-base">{lang === "ru" ? "Журнал действий системы (Аудит)" : "Tizim amallari jurnali (Audit)"}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">{lang === "ru" ? "Записи всех изменений данных, корректировок и действий администратора" : "Barcha tahrirlashlar va o'zgarishlar tarixi"}</p>
                  </div>
                  <button 
                    onClick={() => reloadData()}
                    className="p-1.5 hover:bg-slate-100 border border-slate-200 rounded text-slate-600 hover:text-slate-900 transition-colors cursor-pointer flex items-center justify-center"
                    title="Обновить журнал"
                  >
                    <RefreshCw className="w-4 h-4 text-slate-500" />
                  </button>
                </div>

                <div className="p-4 bg-amber-50/50 border-b border-slate-100 text-xs font-semibold text-amber-800 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Каждое изменение, отмена транзакции, слияние дубликатов или смена цен фиксируется здесь для полной прозрачности.</span>
                </div>

                <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                  {activityLogs
                    .filter(log => log.type === "audit" || log.type === "adjustment")
                    .map(log => {
                      const date = log.timestamp ? new Date(log.timestamp).toLocaleDateString() : "";
                      const time = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : "";
                      return (
                        <div key={log.id} className="p-4 flex gap-4 items-start hover:bg-slate-50/40 transition-colors">
                          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 font-mono font-bold text-[10px]">
                            SEC
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-bold text-slate-800">{log.message}</p>
                            <div className="flex gap-4 text-[10px] font-mono text-slate-400 mt-1.5 uppercase">
                              <span>Оператор: {log.operator}</span>
                              <span>{date} {time}</span>
                              <span>ID: #{log.id}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  {activityLogs.filter(log => log.type === "audit" || log.type === "adjustment").length === 0 && (
                    <div className="p-12 text-center text-slate-400 text-xs font-medium">
                      Журнал действий пока пуст.
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* Modal: Settings Dialog */}
          {isSettingsOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in-50">
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                <div className="bg-slate-900 p-5 text-white border-b border-slate-800 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-amber-400" />
                    <span className="font-bold tracking-tight text-base">{t.settings}</span>
                  </div>
                  <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-6 flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">{t.traysPerBox}</label>
                    <input 
                      type="number" 
                      value={configTrays} 
                      onChange={(e) => setConfigTrays(Number(e.target.value))}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium focus:outline-none focus:border-amber-400 font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">{t.eggsPerTray}</label>
                    <input 
                      type="number" 
                      value={configEggs} 
                      onChange={(e) => setConfigEggs(Number(e.target.value))}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium focus:outline-none focus:border-amber-400 font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">{t.debtThreshold}</label>
                    <input 
                      type="number" 
                      value={configThreshold} 
                      onChange={(e) => setConfigThreshold(Number(e.target.value))}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium focus:outline-none focus:border-amber-400 font-mono"
                    />
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button onClick={() => setIsSettingsOpen(false)} className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50 active:scale-95 transition-all cursor-pointer text-center">
                      {t.cancel}
                    </button>
                    <button onClick={handleSaveSettings} className="flex-1 py-2 bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 active:scale-95 transition-all cursor-pointer text-center flex items-center justify-center gap-1">
                      <Save className="w-4 h-4 text-amber-400" />
                      <span>{t.save}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal: New Sale Dialog */}
          {isNewSaleOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in-50">
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                <div className="bg-slate-900 p-5 text-white border-b border-slate-800 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <PlusCircle className="w-5 h-5 text-amber-400" />
                    <span className="font-bold tracking-tight text-base">{t.newSale}</span>
                  </div>
                  <button onClick={() => setIsNewSaleOpen(false)} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleNewSaleSubmit} className="p-6 flex flex-col gap-4">
                  
                  {/* Shop Select */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">{t.selectShop}</label>
                    <select 
                      value={saleShopId}
                      onChange={(e) => setSaleShopId(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium focus:outline-none focus:border-amber-400 bg-white"
                      required
                    >
                      <option value="">-- Выбрать магазин --</option>
                      {shops.filter(s => !s.isArchived).map(s => (
                        <option key={s.id} value={s.id}>{s.name} (долг: {s.debt.toLocaleString()} сум)</option>
                      ))}
                    </select>
                  </div>

                  {/* Egg Type */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">{t.eggType}</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {(eggTypes.length > 0 ? eggTypes.filter(e => e.status === "active") : [
                        { id: "c0", nameRu: "C0", nameUz: "C0" },
                        { id: "c1", nameRu: "C1", nameUz: "C1" },
                        { id: "domestic", nameRu: "Домашние", nameUz: "Uy" }
                      ]).map((egg) => (
                        <button
                          key={egg.id}
                          type="button"
                          onClick={() => setSaleEggType(egg.id)}
                          className={`py-2 px-1 rounded-lg border text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer truncate ${
                            saleEggType === egg.id 
                              ? "bg-slate-900 border-slate-800 text-amber-400 shadow-sm" 
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                          title={lang === "ru" ? egg.nameRu : egg.nameUz}
                        >
                          {lang === "ru" ? egg.nameRu : egg.nameUz}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quantity Type & Value */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Тип количества</label>
                      <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setSaleQtyType("boxes")}
                          className={`py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                            saleQtyType === "boxes" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                          }`}
                        >
                          Коробки
                        </button>
                        <button
                          type="button"
                          onClick={() => setSaleQtyType("trays")}
                          className={`py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                            saleQtyType === "trays" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                          }`}
                        >
                          Лотки
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Кол-во ({saleQtyType === "boxes" ? "коробок" : "лотков"})</label>
                      <input 
                        type="number" 
                        min="1"
                        value={saleQty}
                        onChange={(e) => setSaleQty(Math.max(0, Number(e.target.value)))}
                        className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium focus:outline-none focus:border-amber-400 font-mono"
                        required
                      />
                    </div>
                  </div>

                  {/* Payment Type */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">{t.paymentType}</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: "cash", label: t.cash },
                        { id: "card", label: t.card },
                        { id: "debt", label: t.debt }
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSalePayment(item.id as any)}
                          className={`py-2 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                            salePayment === item.id 
                              ? "bg-slate-900 border-slate-800 text-amber-400 shadow-sm" 
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 mt-4">
                    <button 
                      type="button"
                      onClick={() => setIsNewSaleOpen(false)} 
                      className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50 active:scale-95 transition-all cursor-pointer text-center"
                    >
                      {t.cancel}
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 py-2 bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 active:scale-95 transition-all cursor-pointer text-center flex items-center justify-center gap-1"
                    >
                      <Check className="w-4 h-4 text-amber-400" />
                      <span>{t.register}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal: Edit Operations Log overlay */}
          {isEditLogOpen && editingLog && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in-50">
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                <div className="bg-slate-900 p-5 text-white border-b border-slate-800 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Edit2 className="w-5 h-5 text-amber-400" />
                    <span className="font-bold tracking-tight text-base">Корректировать сумму</span>
                  </div>
                  <button onClick={() => { setIsEditLogOpen(false); setEditingLog(null); }} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleEditLogSubmit} className="p-6 flex flex-col gap-4">
                  <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs text-slate-700">
                    <p className="font-bold text-slate-400 mb-1">ТЕКУЩАЯ ОПЕРАЦИЯ</p>
                    <p>{editingLog.message}</p>
                    <p className="font-mono text-[10px] text-slate-400 mt-2">ID: #{editingLog.id}</p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Новая сумма операции (сум)</label>
                    <input 
                      type="number" 
                      min="0"
                      value={editingLogAmount}
                      onChange={(e) => setEditingLogAmount(Math.max(0, Number(e.target.value)))}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-bold focus:outline-none focus:border-amber-400 font-mono"
                      required
                    />
                  </div>

                  <div className="p-3 bg-blue-50 text-blue-800 border border-blue-100 rounded-lg text-[11px]">
                    ⚠️ Внимание: баланс (долг) магазина будет автоматически скорректирован на величину разницы.
                  </div>

                  <div className="flex gap-3 mt-2">
                    <button 
                      type="button" 
                      onClick={() => { setIsEditLogOpen(false); setEditingLog(null); }} 
                      className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      Отмена
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 py-2 bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 transition-all cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Check className="w-4 h-4 text-amber-400" />
                      <span>Сохранить</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal: Create / Edit Deliverer overlay */}
          {isDelivererModalOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in-50">
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                <div className="bg-slate-900 p-5 text-white border-b border-slate-800 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-amber-400" />
                    <span className="font-bold tracking-tight text-base">
                      {editingDeliverer ? "Редактировать доставщика" : "Добавить доставщика"}
                    </span>
                  </div>
                  <button onClick={() => setIsDelivererModalOpen(false)} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleDelivererSubmit} className="p-6 flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">ФИО доставщика *</label>
                    <input 
                      type="text" 
                      placeholder="Например, Алишер Каримов"
                      value={delName}
                      onChange={(e) => setDelName(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium focus:outline-none focus:border-amber-400"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Логин для входа *</label>
                    <input 
                      type="text" 
                      placeholder="Например, alisher"
                      value={delUsername}
                      onChange={(e) => setDelUsername(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium focus:outline-none focus:border-amber-400 font-mono"
                      required
                      disabled={!!editingDeliverer}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Номер телефона *</label>
                    <input 
                      type="text" 
                      placeholder="+998901234567"
                      value={delPhone}
                      onChange={(e) => setDelPhone(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium focus:outline-none focus:border-amber-400 font-mono"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Пароль *</label>
                    <input 
                      type="text" 
                      placeholder="Пароль"
                      value={delPassword}
                      onChange={(e) => setDelPassword(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium focus:outline-none focus:border-amber-400 font-mono"
                      required
                    />
                  </div>

                  {editingDeliverer && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Статус аккаунта</label>
                      <select
                        value={delStatus}
                        onChange={(e) => setDelStatus(e.target.value as any)}
                        className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium focus:outline-none focus:border-amber-400 bg-white"
                      >
                        <option value="online">Активен (Online)</option>
                        <option value="offline">Активен (Offline)</option>
                        <option value="blocked">Заблокирован (Blocked)</option>
                      </select>
                    </div>
                  )}

                  <div className="flex gap-3 mt-4">
                    <button 
                      type="button" 
                      onClick={() => setIsDelivererModalOpen(false)} 
                      className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      {t.cancel}
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 py-2 bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 transition-all cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Check className="w-4 h-4 text-amber-400" />
                      <span>{t.save}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal: Create / Edit Shop card overlay */}
          {isShopModalOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in-50">
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                <div className="bg-slate-900 p-5 text-white border-b border-slate-800 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-amber-400" />
                    <span className="font-bold tracking-tight text-base">
                      {editingShop ? "Редактировать магазин" : "Добавить новый магазин"}
                    </span>
                  </div>
                  <button onClick={() => setIsShopModalOpen(false)} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleShopSubmit} className="p-6 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Название магазина *</label>
                    <input 
                      type="text" 
                      placeholder="Например, Магазин 'Оазис'"
                      value={shopCardName}
                      onChange={(e) => setShopCardName(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-bold focus:outline-none focus:border-amber-400"
                      required
                    />

                    {/* Similar points warning */}
                    {adminSimilarShops.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 text-slate-800 text-[11px] p-2.5 rounded-lg flex flex-col gap-1.5 mt-1">
                        <p className="font-bold text-amber-800">
                          {lang === "ru" ? "⚠️ Найдена похожая торговая точка:" : "⚠️ O'xshash do'kon topildi:"}
                        </p>
                        <div className="flex flex-col gap-1 max-h-[90px] overflow-y-auto">
                          {adminSimilarShops.map(s => (
                            <span key={s.id} className="text-slate-700 font-semibold block text-xs">
                              • {s.name} ({s.phone || "нет телефона"})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Контактное лицо (ФИО)</label>
                    <input 
                      type="text" 
                      placeholder="Например, Сардор"
                      value={shopCardContact}
                      onChange={(e) => setShopCardContact(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Номер телефона</label>
                    <input 
                      type="text" 
                      placeholder="+998 90 123 45 67"
                      value={shopCardPhone}
                      onChange={(e) => setShopCardPhone(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium focus:outline-none focus:border-amber-400 font-mono"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Адрес / ориентир</label>
                    <input 
                      type="text" 
                      placeholder="Например: Улица А. Темура, ориентир ресторан 'Шедевр'"
                      value={shopCardAddress}
                      onChange={(e) => setShopCardAddress(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Заметка (свободный текст)</label>
                    <textarea 
                      placeholder="Специфика торговой точки, график работы или предпочтения по яйцам"
                      value={shopCardNote}
                      onChange={(e) => setShopCardNote(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium focus:outline-none focus:border-amber-400 min-h-[70px]"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Текущий баланс долга (сум)</label>
                    <input 
                      type="number" 
                      placeholder="0"
                      value={shopCardDebt}
                      onChange={(e) => setShopCardDebt(Number(e.target.value))}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium focus:outline-none focus:border-amber-400 font-mono"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Статус магазина</label>
                    <select
                      value={shopCardStatus}
                      onChange={(e) => setShopCardStatus(e.target.value as any)}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium focus:outline-none focus:border-amber-400 bg-white"
                    >
                      <option value="active">Активен (Active)</option>
                      <option value="archive">В архиве (Archive)</option>
                    </select>
                  </div>

                  <div className="flex gap-3 mt-4">
                    <button 
                      type="button" 
                      onClick={() => setIsShopModalOpen(false)} 
                      className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      {t.cancel}
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 py-2 bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 transition-all cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Check className="w-4 h-4 text-amber-400" />
                      <span>{t.save}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal: Merge Duplicates Form Overlay */}
          {isMergeOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in-50">
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                <div className="bg-slate-900 p-5 text-white border-b border-slate-800 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-amber-400" />
                    <span className="font-bold tracking-tight text-base">Объединить дубликаты магазинов</span>
                  </div>
                  <button onClick={() => setIsMergeOpen(false)} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleMergeShops} className="p-6 flex flex-col gap-4">
                  <div className="p-3.5 bg-amber-50 text-amber-800 border border-amber-100 rounded-lg text-xs leading-relaxed">
                    💡 <strong>Как это работает:</strong> Все долги магазина-дубликата суммируются с основным магазином. Все исторические транзакции дубликата переносятся на основной магазин. Магазин-дубликат переименовывается и архивируется.
                  </div>

                  {/* Source Shop */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Магазин-дубликат (будет закрыт) *</label>
                    <select 
                      value={mergeSourceId}
                      onChange={(e) => setMergeSourceId(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium focus:outline-none bg-white"
                      required
                    >
                      <option value="">-- Выбрать дубликат --</option>
                      {shops.filter(s => !s.isArchived).map(s => (
                        <option key={s.id} value={s.id}>{s.name} (долг: {s.debt.toLocaleString()} сум)</option>
                      ))}
                    </select>
                  </div>

                  {/* Target Shop */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Основной магазин (примет долг и историю) *</label>
                    <select 
                      value={mergeTargetId}
                      onChange={(e) => setMergeTargetId(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium focus:outline-none bg-white"
                      required
                    >
                      <option value="">-- Выбрать основной магазин --</option>
                      {shops.filter(s => !s.isArchived && s.id !== mergeSourceId).map(s => (
                        <option key={s.id} value={s.id}>{s.name} (долг: {s.debt.toLocaleString()} сум)</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-3 mt-4">
                    <button 
                      type="button" 
                      onClick={() => setIsMergeOpen(false)} 
                      className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      Отмена
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 py-2 bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 transition-all cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Check className="w-4 h-4 text-amber-400" />
                      <span>Объединить</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal: Admin View Shop Profile */}
          {selectedShopProfileId && (() => {
            const shop = shops.find(s => s.id === selectedShopProfileId);
            if (!shop) return null;

            // Sort logs descending
            const shopLogs = activityLogs.filter(log => log.shopId === shop.id);
            const sortedShopLogs = [...shopLogs].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            // Extract last purchase details
            const purchaseLogs = sortedShopLogs.filter(log => !log.isCancelled && (log.type === "sale" || log.paymentType === "debt" || log.message.toLowerCase().includes("продаж") || log.message.toLowerCase().includes("sotuv") || log.qty));
            const lastPurchase = purchaseLogs[0] || null;

            // Extract last payment details
            const paymentLogs = sortedShopLogs.filter(log => !log.isCancelled && (log.type === "payment" || log.paymentType !== "debt" || log.message.toLowerCase().includes("оплат") || log.message.toLowerCase().includes("to'lov")));
            const lastPayment = paymentLogs[0] || null;

            // Filter history list by dates
            const filteredHistory = sortedShopLogs.filter(log => {
              if (adminProfileStartDate) {
                const sDate = new Date(adminProfileStartDate);
                sDate.setHours(0,0,0,0);
                if (new Date(log.timestamp) < sDate) return false;
              }
              if (adminProfileEndDate) {
                const eDate = new Date(adminProfileEndDate);
                eDate.setHours(23,59,59,999);
                if (new Date(log.timestamp) > eDate) return false;
              }
              return true;
            });

            return (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in-50">
                <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                  {/* Modal Header */}
                  <div className="bg-slate-900 p-4 text-white flex justify-between items-center border-b border-slate-800 shrink-0">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-amber-400" />
                      <span className="font-bold text-sm">Карточка & история магазина</span>
                    </div>
                    <button onClick={() => { setSelectedShopProfileId(null); setAdminProfileStartDate(""); setAdminProfileEndDate(""); }} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
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
                          {shop.isArchived ? "В архиве" : "Активен"}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs mt-1">
                        <div>
                          <p className="text-slate-400 font-medium">Контакт</p>
                          <p className="font-semibold text-slate-700">{shop.contact || "—"}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 font-medium">Телефон</p>
                          <p className="font-semibold text-slate-700 font-mono">{shop.phone || "—"}</p>
                        </div>
                      </div>

                      <div className="text-xs">
                        <p className="text-slate-400 font-medium">Адрес / ориентир</p>
                        <p className="font-semibold text-slate-700">{shop.address || "—"}</p>
                      </div>

                      <div className="text-xs">
                        <p className="text-slate-400 font-medium">Заметка</p>
                        <p className="text-slate-600 italic bg-white p-1.5 rounded border border-slate-100 mt-0.5 text-[11px] whitespace-pre-line">
                          {shop.note || "—"}
                        </p>
                      </div>

                      {/* Calculated Metrics */}
                      <div className="border-t border-slate-200/60 pt-3 mt-1 flex flex-col gap-1.5">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500">Последняя покупка:</span>
                          <span className="font-semibold text-slate-850">
                            {lastPurchase 
                              ? `${new Date(lastPurchase.timestamp).toLocaleDateString()} (${lastPurchase.amount?.toLocaleString()} сум)` 
                              : "—"}
                          </span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500">Последняя оплата:</span>
                          <span className="font-semibold text-slate-850">
                            {lastPayment 
                              ? `${new Date(lastPayment.timestamp).toLocaleDateString()} (${lastPayment.amount?.toLocaleString()} сум)` 
                              : "—"}
                          </span>
                        </div>
                        
                        <div className="border-t border-dashed border-slate-200 pt-2 flex justify-between items-center">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Текущий долг:
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
                          История операций
                        </h4>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                          {filteredHistory.length}
                        </span>
                      </div>

                      {/* Date Filter Panel */}
                      <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50 rounded-lg border border-slate-150 text-[10px]">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-400 uppercase font-bold tracking-wider">С:</span>
                          <input
                            type="date"
                            value={adminProfileStartDate}
                            onChange={(e) => setAdminProfileStartDate(e.target.value)}
                            className="w-full px-1.5 py-1 rounded border border-slate-200 bg-white font-mono font-semibold"
                          />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-400 uppercase font-bold tracking-wider">По:</span>
                          <input
                            type="date"
                            value={adminProfileEndDate}
                            onChange={(e) => setAdminProfileEndDate(e.target.value)}
                            className="w-full px-1.5 py-1 rounded border border-slate-200 bg-white font-mono font-semibold"
                          />
                        </div>
                        {(adminProfileStartDate || adminProfileEndDate) && (
                          <button
                            type="button"
                            onClick={() => {
                              setAdminProfileStartDate("");
                              setAdminProfileEndDate("");
                            }}
                            className="col-span-2 text-center text-red-500 hover:text-red-600 font-bold underline mt-1 cursor-pointer"
                          >
                            Сбросить фильтр дат
                          </button>
                        )}
                      </div>

                      <div className="divide-y divide-slate-100 border border-slate-150 rounded-xl max-h-[180px] overflow-y-auto bg-white">
                        {filteredHistory.length === 0 ? (
                          <div className="p-6 text-center text-slate-400 text-xs font-medium">
                            История пуста.
                          </div>
                        ) : (
                          filteredHistory.map((log) => {
                            const date = log.timestamp ? new Date(log.timestamp).toLocaleDateString("ru-RU", { month: "short", day: "numeric" }) : "";
                            const time = log.timestamp ? new Date(log.timestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "";

                            return (
                              <div key={log.id} className={`p-3 text-xs flex justify-between items-center ${log.isCancelled ? "opacity-50 bg-slate-50" : ""}`}>
                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`px-1.5 py-0.2 text-[8px] font-extrabold uppercase rounded-md ${
                                      log.isCancelled
                                        ? "bg-slate-200 text-slate-600"
                                        : log.type === "payment" && !log.qty
                                          ? "bg-emerald-100 text-emerald-800"
                                          : "bg-amber-100 text-amber-800"
                                    }`}>
                                      {log.isCancelled 
                                        ? "Отмена"
                                        : log.type === "payment" && !log.qty
                                          ? "Оплата"
                                          : "Продажа"}
                                    </span>
                                    <span className="text-[9px] text-slate-400 font-mono">
                                      {date} {time}
                                    </span>
                                    {log.operator && (
                                      <span className="text-[9px] bg-slate-100 text-slate-500 px-1 rounded">
                                        {log.operator}
                                      </span>
                                    )}
                                  </div>
                                  <p className={`mt-1 font-medium ${log.isCancelled ? "line-through text-slate-400" : "text-slate-700"}`}>
                                    {log.message}
                                  </p>
                                </div>
                                <div className="text-right shrink-0 ml-2">
                                  <span className="font-mono font-bold text-slate-800">
                                    {log.amount?.toLocaleString()} сум
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="bg-slate-50 p-4 border-t border-slate-100 shrink-0 flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedShopProfileId(null);
                        handleOpenShopModal(shop);
                      }}
                      className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5 text-amber-400" />
                      <span>Редактировать карточку</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedShopProfileId(null);
                        setAdminProfileStartDate("");
                        setAdminProfileEndDate("");
                      }}
                      className="py-2 px-4 border border-slate-200 text-slate-500 hover:bg-slate-100 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      Закрыть
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Modal: Create / Edit Egg Type overlay */}
          {isEggModalOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in-50">
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                <div className="bg-slate-900 p-5 text-white border-b border-slate-800 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🥚</span>
                    <span className="font-bold tracking-tight text-base">
                      {editingEgg 
                        ? (lang === "ru" ? "Редактировать сорт яиц" : "Tuxum turini tahrirlash") 
                        : (lang === "ru" ? "Добавить сорт яиц" : "Yangi tuxum turi qo'shish")}
                    </span>
                  </div>
                  <button onClick={() => setIsEggModalOpen(false)} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleSaveEggSubmit} className="p-6 flex flex-col gap-4">
                  
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      {lang === "ru" ? "Название (Русский) *" : "Nomi (Ruscha) *"}
                    </label>
                    <input 
                      type="text" 
                      placeholder="Например, Вид C0"
                      value={eggNameRu}
                      onChange={(e) => setEggNameRu(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-bold focus:outline-none focus:border-amber-400"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      {lang === "ru" ? "Название (Узбекский) *" : "Nomi (O'zbekcha) *"}
                    </label>
                    <input 
                      type="text" 
                      placeholder="Masalan, C0 turi"
                      value={eggNameUz}
                      onChange={(e) => setEggNameUz(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-bold focus:outline-none focus:border-amber-400"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        {lang === "ru" ? "Цена за лоток *" : "Lagan narxi *"}
                      </label>
                      <span className="text-[10px] text-amber-600 font-bold font-mono">
                        {lang === "ru" ? "Лоток = 30 шт" : "Lagan = 30 dona"}
                      </span>
                    </div>
                    <input 
                      type="number" 
                      placeholder="Например, 45000"
                      value={eggPricePerTray || ""}
                      onChange={(e) => setEggPricePerTray(Number(e.target.value))}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-bold focus:outline-none focus:border-amber-400 font-mono text-slate-800"
                      required
                    />
                    
                    {/* Auto Calculated Price for Box */}
                    {eggPricePerTray > 0 && (
                      <div className="mt-1 p-2 bg-amber-50 border border-amber-100 rounded-lg text-xs flex justify-between items-center">
                        <span className="text-slate-500 font-medium">
                          {lang === "ru" ? "Авто-цена за коробку:" : "Quti uchun avtomatik narx:"}
                        </span>
                        <span className="font-mono font-bold text-amber-700">
                          {(eggPricePerTray * (settings?.traysPerBox || 12)).toLocaleString()} сум
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      {lang === "ru" ? "Статус" : "Holati"}
                    </label>
                    <select
                      value={eggStatus}
                      onChange={(e) => setEggStatus(e.target.value as any)}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium focus:outline-none focus:border-amber-400 bg-white"
                    >
                      <option value="active">{lang === "ru" ? "Активен" : "Faol"}</option>
                      <option value="archived">{lang === "ru" ? "В архиве" : "Arxivlangan"}</option>
                    </select>
                  </div>

                  <div className="flex gap-3 mt-4">
                    <button 
                      type="button" 
                      onClick={() => setIsEggModalOpen(false)} 
                      className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      {t.cancel}
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 py-2 bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 transition-all cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Check className="w-4 h-4 text-amber-400" />
                      <span>{t.save}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </main>
      )}

    </div>
  );
}
