"use client";

import { useEffect } from "react";
import { SifreBelirlemeFormu } from "@/components/auth/SifreBelirlemeFormu";
import { createClient } from "@/lib/supabase/client";
import { guvenliCikisYap } from "@/lib/auth/guvenliCikis";

export function DavetSifreKarti({ token }: { token: string | null }) {
  useEffect(() => {
    // Link sırlarını tarayıcı geçmişinden ve sonraki Referer başlıklarından çıkar.
    window.history.replaceState(null, "", "/sifre-olustur");
  }, []);
  return <main className="flex min-h-screen items-center justify-center bg-white px-6 py-10" style={{ fontFamily: "'Nunito', sans-serif" }}>
    <div className="w-full max-w-sm">
      <img src="/hapbilgi-dikey-TM-1-logo.png" alt="HapBilgi" className="mx-auto mb-8 h-36 object-contain" />
      {!token ? <p role="alert" className="text-sm text-gray-600">Davet bağlantısı bulunamadı. Temsilcinizden yeni davet isteyin.</p> : <SifreBelirlemeFormu baslik="Şifre oluştur" buton="Kaydet" onKaydet={async (sifre, tekrar) => {
        const r = await fetch("/sifre-olustur/api", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, sifre, tekrar }) });
        const d = await r.json();
        if (!r.ok || !d.tamamlandi) throw new Error(d.hata ?? "Kayıt tamamlanamadı.");
        await guvenliCikisYap(createClient());
        window.location.replace("/login");
      }} />}
    </div>
  </main>;
}
