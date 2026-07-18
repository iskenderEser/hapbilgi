// app/sifre-yenile/page.tsx
//
// Şifre yenileme sayfası (F-03/A). "Şifremi unuttum" e-postasındaki bağlantı
// buraya düşer: bağlantıdaki kod, tarayıcı istemcisi tarafından otomatik olarak
// kurtarma (recovery) oturumuna çevrilir; kullanıcı yeni şifresini belirler.
// Şifre politikası admin tekli/toplu ile aynıdır (B-36: min 6, Türkçe mesaj).
// Kayıt sonrası oturum kapatılır — kullanıcı yeni şifresiyle login'den girer.

"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

const BORDO = "#bc2d0d";
const SIFRE_MIN_UZUNLUK = 6; // B-36 politikasıyla aynı (lib/admin/kullaniciDogrulama)

export default function SifreYenilePage() {
  const [sifre1, setSifre1] = useState("");
  const [sifre2, setSifre2] = useState("");
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [hata, setHata] = useState("");
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

  const handleKaydet = async (e: React.FormEvent) => {
    e.preventDefault();
    setHata("");
    if (sifre1.length < SIFRE_MIN_UZUNLUK) {
      setHata(`Şifre en az ${SIFRE_MIN_UZUNLUK} karakter olmalıdır.`);
      return;
    }
    if (sifre1 !== sifre2) {
      setHata("Şifreler eşleşmiyor.");
      return;
    }
    setKaydediliyor(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: sifre1 });
    if (error) {
      setHata("Şifre güncellenemedi. Bağlantının süresi dolmuş olabilir — giriş sayfasından yeni bağlantı isteyin.");
      setKaydediliyor(false);
      return;
    }
    setTamamlandi(true);
    setKaydediliyor(false);
    // Kurtarma oturumu kapatılır; AuthProvider SIGNED_OUT ile /login'e yönlendirir.
    setTimeout(() => supabase.auth.signOut(), 2500);
  };

  return (
    <div
      className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-10"
      style={{ fontFamily: "'Nunito', sans-serif" }}
    >
      <div className="w-full max-w-sm">
        <img src="/logo.png" alt="hapbilgi" className="object-contain mx-auto mb-8" style={{ height: 144 }} />

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
          <form onSubmit={handleKaydet} className="flex flex-col gap-4">
            <div>
              <h2 className="text-base font-bold text-gray-900 m-0 mb-1">Yeni Şifre Belirle</h2>
              <p className="text-xs text-gray-500 m-0 leading-relaxed">
                Hesabınız için yeni bir şifre girin (en az {SIFRE_MIN_UZUNLUK} karakter).
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Yeni şifre</label>
              <input
                type="password"
                value={sifre1}
                onChange={(e) => setSifre1(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm bg-white text-gray-900 outline-none box-border transition-shadow focus:border-[#bc2d0d] focus:ring-2 focus:ring-[#bc2d0d]/15"
                style={{ fontFamily: "'Nunito', sans-serif" }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Yeni şifre (tekrar)</label>
              <input
                type="password"
                value={sifre2}
                onChange={(e) => setSifre2(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm bg-white text-gray-900 outline-none box-border transition-shadow focus:border-[#bc2d0d] focus:ring-2 focus:ring-[#bc2d0d]/15"
                style={{ fontFamily: "'Nunito', sans-serif" }}
              />
            </div>

            {hata && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                <p className="text-xs m-0" style={{ color: BORDO }}>{hata}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={kaydediliyor}
              className="w-full text-white font-bold rounded-xl py-3 text-sm border-none transition-opacity hover:opacity-90"
              style={{
                background: BORDO,
                cursor: kaydediliyor ? "not-allowed" : "pointer",
                opacity: kaydediliyor ? 0.6 : 1,
                fontFamily: "'Nunito', sans-serif",
              }}
            >
              {kaydediliyor ? "Kaydediliyor..." : "Şifreyi Güncelle"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
