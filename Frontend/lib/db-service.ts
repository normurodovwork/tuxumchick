import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, getDocs, addDoc, query, orderBy, limit } from "firebase/firestore";
import { getAuth } from "firebase/auth";

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const auth = getAuth();
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Pre-seeded fallback data
const DEFAULT_SETTINGS = {
  traysPerBox: 12,
  eggsPerTray: 30,
  oldDebtThresholdDays: 10,
};

const DEFAULT_INVENTORY = {
  c0: 1240,
  c1: 4800,
  domestic: 650,
};

const DEFAULT_SHOPS = [
  {
    id: "shop-1",
    name: "Магазин \"Оазис\"",
    contact: "Азизбек",
    phone: "+998 90 123 45 67",
    debt: 8450000,
    lastPaymentDate: "2026-06-21T10:00:00.000Z",
    lastPurchaseDate: "2026-07-01T15:00:00.000Z",
  },
  {
    id: "shop-2",
    name: "Корзинка Центр",
    contact: "Тимур",
    phone: "+998 93 987 65 43",
    debt: 3200000,
    lastPaymentDate: "2026-07-05T12:00:00.000Z",
    lastPurchaseDate: "2026-07-07T11:00:00.000Z",
  },
  {
    id: "shop-3",
    name: "Havas Market №4",
    contact: "Сардор",
    phone: "+998 99 555 44 33",
    debt: 1150000,
    lastPaymentDate: "2026-07-08T09:00:00.000Z",
    lastPurchaseDate: "2026-07-08T17:00:00.000Z",
  },
  {
    id: "shop-4",
    name: "Мир Продуктов",
    contact: "Елена",
    phone: "+998 97 111 22 33",
    debt: 5600000,
    lastPaymentDate: "2026-06-27T14:00:00.000Z",
    lastPurchaseDate: "2026-07-02T16:00:00.000Z",
  },
  {
    id: "shop-5",
    name: "Магазин \"Березка\"",
    contact: "Жасур",
    phone: "+998 91 222 33 44",
    debt: 0,
    lastPaymentDate: "2026-07-09T08:00:00.000Z",
    lastPurchaseDate: "2026-07-09T10:00:00.000Z",
  }
];

const DEFAULT_LOGS = [
  {
    id: "log-1",
    timestamp: "2026-07-09T08:00:00.000Z",
    type: "payment",
    message: "Оплата: Магазин \"Березка\"",
    amount: 1200000,
    operator: "Жасур (доставщик)",
  },
  {
    id: "log-2",
    timestamp: "2026-07-09T06:30:00.000Z",
    type: "sale",
    message: "Продажа: Корзинка",
    amount: 450000,
    operator: "Алишер К.",
  },
  {
    id: "log-3",
    timestamp: "2026-07-09T05:15:00.000Z",
    type: "adjustment",
    message: "Корректировка долга: Возврат брака",
    amount: -240000,
    operator: "Алишер К.",
  }
];

const DEFAULT_PRICES = [
  {
    id: "price-1",
    date: "2026-07-09",
    c0Price: 1500,
    c1Price: 1300,
    domesticPrice: 1800,
  }
];

// Seed passwords are stored hashed (sha256 of "123") to honour ТЗ п.7/8.
const SEED_PW = "sha256:a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3";
const DEFAULT_DELIVERERS = [
  { id: "del-1", name: "Жасур", username: "jasur", phone: "+998901234567", password: SEED_PW, status: "online", activePoints: 5 },
  { id: "del-2", name: "Шохрух", username: "shohruh", phone: "+998901234568", password: SEED_PW, status: "online", activePoints: 4 },
  { id: "del-3", name: "Бобур", username: "bobur", phone: "+998901234569", password: SEED_PW, status: "offline", activePoints: 0 },
  { id: "del-4", name: "Достон", username: "doston", phone: "+998901234570", password: SEED_PW, status: "online", activePoints: 6 },
  { id: "del-5", name: "Азиз", username: "aziz", phone: "+998901234571", password: SEED_PW, status: "online", activePoints: 3 },
  { id: "del-6", name: "Сарвар", username: "sarvar", phone: "+998901234572", password: SEED_PW, status: "online", activePoints: 6 }
];

let firestoreInstance: any = null;

function getFirebaseConfig() {
  try {
    // Try to load config dynamically, safely returning null if unavailable
    return require("../firebase-applet-config.json");
  } catch (e) {
    return null;
  }
}

export function getDb() {
  if (firestoreInstance) return firestoreInstance;

  const config = getFirebaseConfig();
  if (config && config.apiKey) {
    try {
      const app = getApps().length === 0 ? initializeApp(config) : getApp();
      firestoreInstance = getFirestore(app, config.firestoreDatabaseId);
      return firestoreInstance;
    } catch (err) {
      console.warn("Failed to initialize Firebase Firestore, falling back to local storage.", err);
    }
  }
  return null;
}

// Memory/localStorage-based fallbacks
function getLocalItem<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  const stored = localStorage.getItem(key);
  if (stored) {
    try {
      return JSON.parse(stored) as T;
    } catch {
      return defaultValue;
    }
  }
  localStorage.setItem(key, JSON.stringify(defaultValue));
  return defaultValue;
}

function setLocalItem<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

// Standardised services for general tables
export async function loadSettings() {
  const db = getDb();
  if (db) {
    try {
      const docRef = doc(db, "config", "settings");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data();
      } else {
        await setDoc(docRef, DEFAULT_SETTINGS);
        return DEFAULT_SETTINGS;
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, "config/settings");
    }
  }
  return getLocalItem("egg_settings", DEFAULT_SETTINGS);
}

export async function saveSettings(settings: any) {
  const db = getDb();
  if (db) {
    try {
      const docRef = doc(db, "config", "settings");
      await setDoc(docRef, settings);
      return;
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, "config/settings");
    }
  }
  setLocalItem("egg_settings", settings);
}

export async function loadInventory() {
  const db = getDb();
  if (db) {
    try {
      const docRef = doc(db, "config", "inventory");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data();
      } else {
        await setDoc(docRef, DEFAULT_INVENTORY);
        return DEFAULT_INVENTORY;
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, "config/inventory");
    }
  }
  return getLocalItem("egg_inventory", DEFAULT_INVENTORY);
}

export async function saveInventory(inventory: any) {
  const db = getDb();
  if (db) {
    try {
      const docRef = doc(db, "config", "inventory");
      await setDoc(docRef, inventory);
      return;
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, "config/inventory");
    }
  }
  setLocalItem("egg_inventory", inventory);
}

export async function loadShops() {
  const db = getDb();
  if (db) {
    try {
      const colRef = collection(db, "shops");
      const snapshot = await getDocs(colRef);
      if (!snapshot.empty) {
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } else {
        // Seed database
        for (const shop of DEFAULT_SHOPS) {
          const { id, ...data } = shop;
          await setDoc(doc(db, "shops", id), data);
        }
        return DEFAULT_SHOPS;
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, "shops");
    }
  }
  return getLocalItem("egg_shops", DEFAULT_SHOPS);
}

export async function saveShop(shop: any) {
  const db = getDb();
  if (db) {
    try {
      const { id, ...data } = shop;
      await setDoc(doc(db, "shops", id), data);
      return;
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `shops/${shop.id}`);
    }
  }
  const shops = getLocalItem("egg_shops", DEFAULT_SHOPS);
  const index = shops.findIndex(s => s.id === shop.id);
  if (index !== -1) {
    shops[index] = shop;
  } else {
    shops.push(shop);
  }
  setLocalItem("egg_shops", shops);
}

export async function loadActivityLogs() {
  const db = getDb();
  if (db) {
    try {
      const colRef = collection(db, "logs");
      const snapshot = await getDocs(colRef);
      if (!snapshot.empty) {
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } else {
        for (const log of DEFAULT_LOGS) {
          const { id, ...data } = log;
          await setDoc(doc(db, "logs", id), data);
        }
        return DEFAULT_LOGS;
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, "logs");
    }
  }
  return getLocalItem("egg_logs", DEFAULT_LOGS);
}

export async function addActivityLog(log: any) {
  const db = getDb();
  const id = "log-" + Date.now();
  const logWithId = { id, ...log };
  if (db) {
    try {
      await setDoc(doc(db, "logs", id), log);
      return logWithId;
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `logs/${id}`);
    }
  }
  const logs = getLocalItem("egg_logs", DEFAULT_LOGS);
  logs.unshift(logWithId);
  setLocalItem("egg_logs", logs);
  return logWithId;
}

export async function updateActivityLog(id: string, updatedFields: any) {
  const db = getDb();
  if (db) {
    try {
      const docRef = doc(db, "logs", id);
      await updateDoc(docRef, updatedFields);
      return;
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `logs/${id}`);
    }
  }
  const logs = getLocalItem("egg_logs", DEFAULT_LOGS);
  const idx = logs.findIndex(l => l.id === id);
  if (idx !== -1) {
    logs[idx] = { ...logs[idx], ...updatedFields };
    setLocalItem("egg_logs", logs);
  }
}

export async function loadPriceHistory() {
  const db = getDb();
  if (db) {
    try {
      const colRef = collection(db, "prices");
      const snapshot = await getDocs(colRef);
      if (!snapshot.empty) {
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } else {
        for (const p of DEFAULT_PRICES) {
          const { id, ...data } = p;
          await setDoc(doc(db, "prices", id), data);
        }
        return DEFAULT_PRICES;
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, "prices");
    }
  }
  return getLocalItem("egg_prices", DEFAULT_PRICES);
}

export async function addPriceRecord(price: any) {
  const db = getDb();
  const id = "price-" + Date.now();
  const priceWithId = { id, ...price };
  if (db) {
    try {
      await setDoc(doc(db, "prices", id), price);
      return priceWithId;
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `prices/${id}`);
    }
  }
  const prices = getLocalItem("egg_prices", DEFAULT_PRICES);
  prices.unshift(priceWithId);
  setLocalItem("egg_prices", prices);
  return priceWithId;
}

export async function loadDeliverers() {
  const db = getDb();
  if (db) {
    try {
      const colRef = collection(db, "deliverers");
      const snapshot = await getDocs(colRef);
      if (!snapshot.empty) {
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } else {
        // Seed default deliverers in Firestore
        for (const d of DEFAULT_DELIVERERS) {
          const { id, ...data } = d;
          await setDoc(doc(db, "deliverers", id), data);
        }
        return DEFAULT_DELIVERERS;
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, "deliverers");
    }
  }
  return getLocalItem("egg_deliverers", DEFAULT_DELIVERERS);
}

export async function saveDeliverer(deliverer: any) {
  const db = getDb();
  if (db) {
    try {
      const { id, ...data } = deliverer;
      await setDoc(doc(db, "deliverers", id), data);
      return;
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `deliverers/${deliverer.id}`);
    }
  }
  const deliverers = getLocalItem("egg_deliverers", DEFAULT_DELIVERERS);
  const index = deliverers.findIndex(d => d.id === deliverer.id);
  if (index !== -1) {
    deliverers[index] = deliverer;
  } else {
    deliverers.push(deliverer);
  }
  setLocalItem("egg_deliverers", deliverers);
}

// ---------------------------------------------------------------------------
// Accounting logic (ТЗ п.5): debt is ALWAYS derived from operations, never a
// stored, editable field. Each shop keeps only an `openingDebt` (initial /
// carried-over balance); the current debt is computed from the ledger.
//   Долг = openingDebt + Σ(продажа.итого − продажа.получено)
//          − Σ(приём оплаты) + Σ(корректировки ±)
// Negative result = переплата (аванс).
// ---------------------------------------------------------------------------

export function ledgerDelta(log: any): number {
  if (!log || log.isCancelled) return 0;
  if (log.type === "sale") {
    const total = typeof log.total === "number" ? log.total : (log.amount || 0);
    const received = typeof log.received === "number" ? log.received : 0;
    return total - received;
  }
  if (log.type === "payment") {
    return -(log.amount || 0);
  }
  if (log.type === "adjustment" && typeof log.adjustmentAmount === "number") {
    return log.adjustmentAmount;
  }
  return 0;
}

export function computeShopDebt(shop: any, logs: any[]): number {
  const opening = typeof shop.openingDebt === "number"
    ? shop.openingDebt
    : (typeof shop.debt === "number" ? shop.debt : 0);
  let debt = opening;
  for (const log of logs) {
    if (log.shopId !== shop.id) continue;
    debt += ledgerDelta(log);
  }
  return debt;
}

// Overlay computed debt + derived last-purchase / last-payment dates onto shops.
export function applyComputedDebts(shops: any[], logs: any[]): any[] {
  return shops.map(shop => {
    const opening = typeof shop.openingDebt === "number"
      ? shop.openingDebt
      : (typeof shop.debt === "number" ? shop.debt : 0);
    const shopLogs = logs.filter(l => l.shopId === shop.id && !l.isCancelled);
    let debt = opening;
    let lastPurchase = shop.lastPurchaseDate || null;
    let lastPayment = shop.lastPaymentDate || null;
    for (const log of shopLogs) {
      debt += ledgerDelta(log);
      const when = log.operationDate || log.timestamp;
      if (log.type === "sale") {
        if (!lastPurchase || new Date(when) > new Date(lastPurchase)) lastPurchase = when;
        if ((log.received || 0) > 0 && (!lastPayment || new Date(when) > new Date(lastPayment))) lastPayment = when;
      } else if (log.type === "payment") {
        if (!lastPayment || new Date(when) > new Date(lastPayment)) lastPayment = when;
      }
    }
    return { ...shop, openingDebt: opening, debt, lastPurchaseDate: lastPurchase, lastPaymentDate: lastPayment };
  });
}

// Currency formatting per ТЗ п.1.4: integer sums, thousands separator.
export function formatSum(amount: number, lang: "ru" | "uz" = "ru"): string {
  const rounded = Math.round(amount || 0);
  const abs = Math.abs(rounded).toLocaleString("ru-RU").replace(/,/g, " ");
  const unit = lang === "uz" ? "so'm" : "сум";
  return `${rounded < 0 ? "-" : ""}${abs} ${unit}`;
}

// Password hashing (ТЗ п.7/8): passwords are stored hashed (SHA-256), never
// in plain text. Legacy plain-text values are still accepted on login.
export async function hashPassword(plain: string): Promise<string> {
  const value = (plain || "").trim();
  try {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const data = new TextEncoder().encode(value);
      const digest = await crypto.subtle.digest("SHA-256", data);
      return "sha256:" + Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
    }
  } catch {
    // fall through to legacy
  }
  return value;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (stored == null) return false;
  if (typeof stored === "string" && stored.startsWith("sha256:")) {
    return (await hashPassword(plain)) === stored;
  }
  // Legacy plain-text comparison
  return (plain || "").trim() === String(stored).trim();
}

// Egg Types Catalog functions
const DEFAULT_EGG_TYPES = [
  { id: "c0", nameRu: "Вид C0", nameUz: "C0 turi", pricePerTray: 45000, status: "active" },
  { id: "c1", nameRu: "Вид C1", nameUz: "C1 turi", pricePerTray: 39000, status: "active" },
  { id: "domestic", nameRu: "Домашние", nameUz: "Uy tuxumlari", pricePerTray: 54000, status: "active" }
];

export async function loadEggTypes() {
  const db = getDb();
  if (db) {
    try {
      const colRef = collection(db, "egg_types");
      const snapshot = await getDocs(colRef);
      if (!snapshot.empty) {
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } else {
        // Seed default egg types
        for (const et of DEFAULT_EGG_TYPES) {
          const { id, ...data } = et;
          await setDoc(doc(db, "egg_types", id), data);
        }
        return DEFAULT_EGG_TYPES;
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, "egg_types");
    }
  }
  return getLocalItem("egg_egg_types", DEFAULT_EGG_TYPES);
}

export async function saveEggType(eggType: any) {
  const db = getDb();
  if (db) {
    try {
      const { id, ...data } = eggType;
      await setDoc(doc(db, "egg_types", id), data);
      return;
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `egg_types/${eggType.id}`);
    }
  }
  const list = getLocalItem("egg_egg_types", DEFAULT_EGG_TYPES);
  const index = list.findIndex(e => e.id === eggType.id);
  if (index !== -1) {
    list[index] = eggType;
  } else {
    list.push(eggType);
  }
  setLocalItem("egg_egg_types", list);
}

