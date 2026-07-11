// app/eczanem/giris/page.tsx
// Müşteri girişi (İP-§3.5): telefon → SMS kodu → panel. Girişsiz sayfadır
// (bekçi istisnası); U1'in giriş API'lerini kullanır.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EczanemGirisPage() {
  const router = useRouter();
  const [adim, setAdim] = useState<"telefon" | "kod">("telefon");
  const [telefon, setTelefon] = useState("");
  const [otp, setOtp] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [hataMesaji, setHataMesaji] = useState<string | null>(null);

  const kodIste = async (e: React.FormEvent) => {
    e.preventDefault();
    setHataMesaji(null);
    setGonderiliyor(true);
    try {
      const res = await fetch("/eczanem/api/giris/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefon }),
      });
      const data = await res.json();
      if (!res.ok) { setHataMesaji(data.hata ?? "Kod gönderilemedi."); return; }
      setAdim("kod");
    } catch {
      setHataMesaji("Kod gönderilemedi; yeniden deneyin.");
    } finally {
      setGonderiliyor(false);
    }
  };

  const girisYap = async (e: React.FormEvent) => {
    e.preventDefault();
    setHataMesaji(null);
    setGonderiliyor(true);
    try {
      const res = await fetch("/eczanem/api/giris/dogrula", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefon, otp }),
      });
      const data = await res.json();
      if (!res.ok) { setHataMesaji(data.hata ?? "Giriş yapılamadı."); return; }
      // Tam sayfa geçiş: AuthProvider yeni oturumu temiz durumla yüklesin.
      window.location.href = data.yonlendir ?? "/eczanem";
    } catch {
      setHataMesaji("Giriş yapılamadı; yeniden deneyin.");
    } finally {
      setGonderiliyor(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <form
        onSubmit={adim === "telefon" ? kodIste : girisYap}
        className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm"
      >
        <div className="text-lg font-bold text-gray-900 mb-1">Eczanem Girişi</div>
        <div className="text-xs text-gray-500 mb-5">
          {adim === "telefon"
            ? "Üye olduğunuz cep telefonu numaranızı girin; size SMS ile kod gönderelim."
            : "Telefonunuza gönderilen 6 haneli kodu girin."}
        </div>

        {hataMesaji && (
          <div className="mb-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {hataMesaji}
          </div>
        )}

        {adim === "telefon" ? (
          <>
            <label className="block text-xs text-gray-600 mb-1">Cep Telefonu</label>
            <input
              type="tel"
              value={telefon}
              onChange={(e) => setTelefon(e.target.value)}
              placeholder="05xx xxx xx xx"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-5"
              required
            />
          </>
        ) : (
          <>
            <label className="block text-xs text-gray-600 mb-1">SMS Kodu</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="••••••"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm tracking-widest mb-2"
              required
              autoFocus
            />
            <button
              type="button"
              onClick={() => { setAdim("telefon"); setOtp(""); setHataMesaji(null); }}
              className="text-[11px] text-gray-400 hover:text-gray-600 mb-4"
            >
              ← Numarayı değiştir
            </button>
          </>
        )}

        <button
          type="submit"
          disabled={gonderiliyor}
          className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "#b45309" }}
        >
          {gonderiliyor ? "Bekleyin…" : adim === "telefon" ? "Kod Gönder" : "Giriş Yap"}
        </button>
      </form>
    </div>
  );
}
