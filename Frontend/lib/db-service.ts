// Data service — talks to the Django REST API (backend/).
// Function signatures and object shapes are kept identical to the previous
// Firestore/localStorage layer, so the dashboards work without changes.

const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) ||
  "http://localhost:8000/api";

const TOKEN_KEY = "egg_api_token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Token ${token}`;
  return headers;
}

async function apiGet(path: string) {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json();
}

async function apiSend(method: string, path: string, body?: any) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: authHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json())?.detail || ""; } catch { /* ignore */ }
    throw new Error(detail || `${method} ${path} → ${res.status}`);
  }
  return res.json().catch(() => ({}));
}

// ------------------------------- Auth -------------------------------------

export async function apiLogin(login: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, status: res.status, detail: data?.detail || "Ошибка входа" };
  }
  setToken(data.token);
  return { ok: true, user: data.user };
}

export function apiLogout() {
  setToken(null);
}

// -------------------- Accounting helpers (pure, client) -------------------
// Debt is derived from the operations ledger (ТЗ п.5.1); negative = аванс.

export function ledgerDelta(log: any): number {
  if (!log || log.isCancelled) return 0;
  if (log.type === "sale") {
    const total = typeof log.total === "number" ? log.total : (log.amount || 0);
    const received = typeof log.received === "number" ? log.received : 0;
    return total - received;
  }
  if (log.type === "payment") return -(log.amount || 0);
  if (log.type === "adjustment" && typeof log.adjustmentAmount === "number") return log.adjustmentAmount;
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

export function formatSum(amount: number, lang: "ru" | "uz" = "ru"): string {
  const rounded = Math.round(amount || 0);
  const abs = Math.abs(rounded).toLocaleString("ru-RU").replace(/,/g, " ");
  const unit = lang === "uz" ? "so'm" : "сум";
  return `${rounded < 0 ? "-" : ""}${abs} ${unit}`;
}

// Kept for backward-compat with imports; auth now happens on the server.
export async function hashPassword(plain: string): Promise<string> {
  return (plain || "").trim();
}
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  return (plain || "").trim() === String(stored ?? "").trim();
}

// ------------------------------- Settings ---------------------------------

export async function loadSettings() {
  return apiGet("/settings/");
}
export async function saveSettings(settings: any) {
  return apiSend("PUT", "/settings/", settings);
}

// ------------------------------- Inventory --------------------------------

export async function loadInventory() {
  return apiGet("/inventory/");
}
export async function saveInventory(inventory: any) {
  return apiSend("PUT", "/inventory/", inventory);
}

// ------------------------------- Shops ------------------------------------

export async function loadShops() {
  return apiGet("/shops/");
}
export async function saveShop(shop: any) {
  return apiSend("POST", "/shops/", shop);
}

// ------------------------------- Operations feed --------------------------

export async function loadActivityLogs() {
  return apiGet("/operations/");
}
export async function addActivityLog(log: any) {
  return apiSend("POST", "/operations/", log);
}
export async function updateActivityLog(id: string, updatedFields: any) {
  return apiSend("PATCH", `/operations/${id}/`, updatedFields);
}

// ------------------------------- Prices -----------------------------------

export async function loadPriceHistory() {
  return apiGet("/prices/");
}
export async function addPriceRecord(price: any) {
  return apiSend("POST", "/prices/", price);
}

// ------------------------------- Deliverers -------------------------------

export async function loadDeliverers() {
  return apiGet("/deliverers/");
}
export async function saveDeliverer(deliverer: any) {
  return apiSend("POST", "/deliverers/", deliverer);
}

// ------------------------------- Egg types --------------------------------

export async function loadEggTypes() {
  return apiGet("/egg-types/");
}
export async function saveEggType(eggType: any) {
  return apiSend("POST", "/egg-types/", eggType);
}
