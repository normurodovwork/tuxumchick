"use client";

import React, { useState } from "react";
import { Key, AlertCircle } from "lucide-react";
import { translations, Language } from "../lib/translations";
import { apiLogin } from "../lib/db-service";

interface LoginScreenProps {
  onLogin: (role: "admin" | "deliverer", username: string, details?: { username?: string; id?: string }) => void;
  lang: Language;
  setLang: (lang: Language) => void;
  blockedMessage?: string | null;
  setBlockedMessage?: (msg: string | null) => void;
}

export default function LoginScreen({ onLogin, lang, setLang, blockedMessage, setBlockedMessage }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const t = translations[lang];

  const handleUsernameChange = (val: string) => {
    setUsername(val);
    setError("");
    if (setBlockedMessage) setBlockedMessage(null);
  };

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    setError("");
    if (setBlockedMessage) setBlockedMessage(null);
  };

  const doLogin = async (login: string, pwd: string) => {
    setSubmitting(true);
    try {
      const res = await apiLogin(login, pwd);
      if (!res.ok) {
        setError(res.detail || (lang === "ru" ? "Неверный логин или пароль" : "Noto'g'ri login yoki parol"));
        return;
      }
      const u = res.user;
      onLogin(u.role, u.name, { username: u.username, id: u.id });
    } catch (err) {
      setError(lang === "ru" ? "Нет связи с сервером" : "Server bilan aloqa yo'q");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim();
    const cleanPassword = password.trim();
    if (!cleanPassword) {
      setError(lang === "ru" ? "Пожалуйста, введите пароль" : "Iltimos, parolni kiriting");
      return;
    }
    await doLogin(cleanUsername, cleanPassword);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 text-slate-900 font-sans p-6">
      <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        
        {/* Header decoration */}
        <div className="bg-slate-900 p-6 text-white border-b border-slate-800 relative">
          <div className="absolute top-4 right-4 flex bg-slate-800 rounded-lg p-0.5 border border-slate-700">
            <button
              onClick={() => setLang("ru")}
              className={`px-2.5 py-0.5 text-xs font-bold rounded-md transition-colors ${
                lang === "ru" ? "bg-amber-400 text-slate-900" : "text-slate-400 hover:text-white"
              }`}
            >
              RU
            </button>
            <button
              onClick={() => setLang("uz")}
              className={`px-2.5 py-0.5 text-xs font-bold rounded-md transition-colors ${
                lang === "uz" ? "bg-amber-400 text-slate-900" : "text-slate-400 hover:text-white"
              }`}
            >
              UZ
            </button>
          </div>

          <div className="flex items-center gap-3 mb-2">
            <span className="font-bold tracking-tight text-xl">
              EggLogistics <span className="text-amber-400 text-xs align-top font-mono">B2B</span>
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-1">{t.loginSub}</p>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 flex flex-col gap-6">
          <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
            {(blockedMessage || error) && (
              <div className="bg-red-50 text-red-600 border border-red-100 rounded-lg p-3 flex items-start gap-2 text-xs font-medium animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{blockedMessage || error}</span>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {lang === "ru" ? "Логин или Номер телефона" : "Login yoki Telefon raqami"}
              </label>
              <input
                type="text"
                placeholder={lang === "ru" ? "Логин или номер телефона" : "Login yoki telefon raqami"}
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium focus:outline-none focus:border-amber-400 transition-colors"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {t.password}
              </label>
              <input
                type="password"
                placeholder="••••••"
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium focus:outline-none focus:border-amber-400 transition-colors"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full mt-2 bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.98] transition-all py-2.5 rounded-lg font-bold text-sm shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Key className="w-4 h-4 text-amber-400" />
              <span>{t.loginButton}</span>
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-100 text-center text-[10px] font-mono text-slate-400 uppercase tracking-widest">
          EggLogistics Systems © 2026
        </div>
      </div>
    </div>
  );
}
