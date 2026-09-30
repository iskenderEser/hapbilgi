// app/sifre-yenile/page.tsx
//
// Şifre yenileme sayfası (F-03/A). "Şifremi unuttum" e-postasındaki bağlantı
// buraya düşer: bağlantıdaki kod, tarayıcı istemcisi tarafından otomatik olarak
// kurtarma (recovery) oturumuna çevrilir; kullanıcı yeni şifresini belirler.
// Şifre politikası admin tekli/toplu ile aynıdır (B-36: min 6, Türkçe mesaj).
// Kayıt sonrası oturum kapatılır — kullanıcı yeni şifresiyle login'den girer.

"use client";

import { SifreBelirlemeFormu } from "@/components/auth/SifreBelirlemeFormu";
import { createClient } from "@/lib/supabase/client";
import { guvenliCikisYap } from "@/lib/auth/guvenliCikis";
import { useEffect, useState } from "react";

const BORDO = "#bc2d0d";

export default function SifreYenilePage() {
  const [tamamlandi, setTamamlandi] = useState(false);
  // null: oturum çözülüyor; false: bağlantı geçersiz/süresi dolmuş; true: hazır.
  const [oturumHazir, setOturumHazir] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    // Bağlantıdaki kodun oturuma çevrilmesi anlık olmayabilir — kısa tolerans:
    // önce mevcut oturuma bak, yoksa auth olayını bekle, 5 sn'de pes et.
    let bitti = false;
    const isaretle = (deger: boolean) => {
      if (bitti) return;
      bitti = true;
      setOturumHazir(deger);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) isaretle(true);
      if (event === "SIGNED_OUT") return; // kayıt sonrası bilinçli çıkış
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) isaretle(true);
    });

    const zamanlayici = setTimeout(() => isaretle(false), 5000);
    return () => {
      clearTimeout(zamanlayici);
      subscription.unsubscribe();
    };
  }, []);

  const handleKaydet = async (sifre: string) => {
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: sifre });
    if (error) throw new Error("Şifre güncellenemedi. Giriş sayfasından yeni bağlantı isteyin.");
    setTamamlandi(true);
    await guvenliCikisYap(supabase);
    window.location.replace("/login");
  };

  return (
    <div
      className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-10"
      style={{ fontFamily: "'Nunito', sans-serif" }}
    >
      <div className="w-full max-w-sm">
        <img src="/hapbilgi-dikey-TM-1-logo.png" alt="hapbilgi" className="object-contain mx-auto mb-8" style={{ height: 144 }} />

        {oturumHazir === null && (
          <p className="text-sm text-gray-500 text-center">Bağlantı doğrulanıyor...</p>
        )}

        {oturumHazir === false && (
          <div className="text-center">
            <p className="text-sm text-gray-700 mb-4">
              Bağlantı geçersiz ya da süresi dolmuş. Giriş sayfasındaki &quot;Şifremi unuttum&quot; ile yeni bağlantı isteyebilirsiniz.
            </p>
            <a href="/login" className="text-xs no-underline font-semibold" style={{ color: BORDO }}>← Giriş sayfasına dön</a>
          </div>
        )}

        {oturumHazir === true && tamamlandi && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <p className="text-sm text-green-700 m-0">
              Şifreniz güncellendi. Giriş sayfasına yönlendiriliyorsunuz...
            </p>
          </div>
        )}

        {oturumHazir === true && !tamamlandi && (
          <SifreBelirlemeFormu baslik="Yeni Şifre Belirle" buton="Şifreyi Güncelle" onKaydet={handleKaydet} />
        )}
      </div>
    </div>
  );
}
