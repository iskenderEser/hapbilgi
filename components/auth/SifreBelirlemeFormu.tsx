"use client";

import { useState } from "react";

export function SifreBelirlemeFormu({ baslik, buton, onKaydet }: {
  baslik: string; buton: string;
  onKaydet: (sifre: string, tekrar: string) => Promise<void>;
}) {
  const [sifre, setSifre] = useState("");
  const [tekrar, setTekrar] = useState("");
  const [islem, setIslem] = useState(false);
  const [hata, setHata] = useState("");
  return <form className="flex flex-col gap-4" onSubmit={async (e) => {
    e.preventDefault(); if (islem) return;
    setHata("");
    if (sifre.length < 6 || sifre.length > 128) { setHata("Şifre 6–128 karakter olmalıdır."); return; }
    if (sifre !== tekrar) { setHata("Şifreler eşleşmiyor."); return; }
    setIslem(true);
    try { await onKaydet(sifre, tekrar); }
    catch (e) { setHata(e instanceof Error ? e.message : "Şifre kaydedilemedi."); }
    finally { setIslem(false); }
  }}>
    <div><h2 className="mb-1 text-base font-bold text-gray-900">{baslik}</h2><p className="text-xs leading-relaxed text-gray-500">Hesabınız için en az 6 karakterlik bir şifre belirleyin.</p></div>
    {[{ label: "Yeni şifre", value: sifre, setter: setSifre }, { label: "Yeni şifre (tekrar)", value: tekrar, setter: setTekrar }].map(({ label, value, setter }) => <label key={label} className="block text-xs font-semibold text-gray-500">{label}<input type="password" autoComplete="new-password" required minLength={6} maxLength={128} disabled={islem} value={value} onChange={(e) => setter(e.target.value)} className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-[#bc2d0d]" /></label>)}
    {hata && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-[#bc2d0d]">{hata}</p>}
    <button type="submit" disabled={islem} className="w-full rounded-xl bg-[#bc2d0d] py-3 text-sm font-bold text-white disabled:opacity-60">{islem ? "Kaydediliyor…" : buton}</button>
  </form>;
}
