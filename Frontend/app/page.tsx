"use client";

import React, { useState, useEffect } from "react";
import LoginScreen from "../components/LoginScreen";
import AdminDashboard from "../components/AdminDashboard";
import DelivererDashboard from "../components/DelivererDashboard";
import { Language } from "../lib/translations";
import { Loader2 } from "lucide-react";

export default function Home() {
  const [user, setUser] = useState<{ role: "admin" | "deliverer"; name: string; username?: string; id?: string } | null>(null);
  const [lang, setLang] = useState<Language>("ru");
  const [hydrated, setHydrated] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

  // Load state from localStorage on mount safely
  useEffect(() => {
    const savedUser = localStorage.getItem("egg_auth_user");
    const savedLang = localStorage.getItem("egg_auth_lang");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        // Safe fallback
      }
    }
    if (savedLang === "ru" || savedLang === "uz") {
      setLang(savedLang as Language);
    }
    setHydrated(true);

    // Register the service worker for PWA install + offline (ТЗ п.1.3 / п.7)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) =>
        console.warn("SW registration failed:", err)
      );
    }
  }, []);

  // Poll deliverer status if user is logged in as deliverer to handle immediate blocking
  useEffect(() => {
    if (!user || user.role !== "deliverer") return;

    let isMounted = true;
    const checkBlocked = async () => {
      try {
        const { loadDeliverers } = await import("../lib/db-service");
        const list = await loadDeliverers();
        const me: any = list.find((d: any) =>
          d.id === user.id || 
          (user.username && d.username?.toLowerCase() === user.username.toLowerCase()) || 
          d.name === user.name
        );
        if (me && me.status === "blocked") {
          if (isMounted) {
            setUser(null);
            localStorage.removeItem("egg_auth_user");
            setBlockedMessage(
              lang === "ru" 
                ? "Доступ закрыт немедленно: ваша учётная запись заблокирована администратором." 
                : "Kirish darhol bekor qilindi: hisobingiz administrator tomonidan bloklangan."
            );
          }
        }
      } catch (err) {
        console.error("Failed to check blocked status:", err);
      }
    };

    // Check immediately and then every 3 seconds
    checkBlocked();
    const interval = setInterval(checkBlocked, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user, lang]);

  const handleLogin = (role: "admin" | "deliverer", name: string, details?: { username?: string; id?: string }) => {
    setBlockedMessage(null);
    const userData = { role, name, ...details };
    setUser(userData);
    localStorage.setItem("egg_auth_user", JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("egg_auth_user");
    setBlockedMessage(null);
  };

  const handleSetLang = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem("egg_auth_lang", newLang);
  };

  if (!hydrated) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 gap-2">
        <Loader2 className="w-8 h-8 text-slate-900 animate-spin" />
        <span className="font-mono text-[10px] text-slate-400 tracking-wider uppercase">Loading Workspace...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <LoginScreen 
        onLogin={handleLogin} 
        lang={lang} 
        setLang={handleSetLang} 
        blockedMessage={blockedMessage}
        setBlockedMessage={setBlockedMessage}
      />
    );
  }

  if (user.role === "admin") {
    return (
      <AdminDashboard 
        username={user.name} 
        onLogout={handleLogout} 
        lang={lang} 
        setLang={handleSetLang} 
      />
    );
  }

  return (
    <DelivererDashboard 
      username={user.name} 
      onLogout={handleLogout} 
      lang={lang} 
      setLang={handleSetLang} 
    />
  );
}
