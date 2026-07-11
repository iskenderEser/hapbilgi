// app/eclub/eczanem/page.tsx
// Eczacı/teknisyen Eczanem ekranı — U2 kapsamı: davet formu + davet listesi.
// (Gelen videolar, üye listesi ve gönderim U6'da bu sayfaya eklenecek.)
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { useAuth } from "@/app/providers/AuthProvider";

interface DavetSatiri {
  davet_id: string;
  ad_soyad: string;
  telefon: string; // maskeli gelir (son-4-hane)
  durum: string;
  created_at: string;
}

const DURUM_ETIKETLERI: Record<string, { etiket: string; renk: string }> = {
  bekliyor: { etiket: "Bekliyor", renk: "#b45309" },
  tamamlandi: { etiket: "Üye Oldu", renk: "#15803d" },
  suresi_doldu: { etiket: "Süresi Doldu", renk: "#737373" },
  iptal: { etiket: "Yenilendi/İptal", renk: "#737373" },
};

export default function EczanemDavetPage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor } = useAuth();
  const { mesajlar, hata, basari } = useHataMesaji();

  const eclubKisi = !!kullanici && kullanici.kimlik_turu === "eclub_kisi";

  const [adSoyad, setAdSoyad] = useState("");
  const [telefon, setTelefon] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [davetler, setDavetler] = useState<DavetSatiri[]>([]);
  const [loading, setLoading] = useState(true);

  const davetleriCek = useCallback(async () => {
    try {
      const res = await fetch("/eclub/eczanem/api/davetler");
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Davetler yüklenemedi.", "davet listesi"); return; }
      setDavetler(data.davetler ?? []);
    } catch {
      hata("Davetler yüklenemedi.", "davet listesi");
    } finally {
      setLoading(false);
    }
  }, [hata]);

  useEffect(() => {
    if (authYukleniyor) return;
    if (!kullanici) { router.replace("/login"); return; }
    if (!eclubKisi) { router.replace("/ana-sayfa"); return; }
    davetleriCek();
  }, [kullanici, authYukleniyor, eclubKisi, router, davetleriCek]);

  const davetGonder = async (e: React.FormEvent) => {
    e.preventDefault();
    setGonderiliyor(true);
    try {
      const res = await fetch("/eclub/eczanem/api/davetler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ad_soyad: adSoyad, telefon }),
      });
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Davet gönderilemedi.", "davet"); return; }
      basari("Davet gönderildi — müşterinize SMS ile kod iletildi.");
      setAdSoyad("");
      setTelefon("");
      davetleriCek();
    } catch {
      hata("Davet gönderilemedi.", "davet");
    } finally {
      setGonderiliyor(false);
    }
  };

  if (authYukleniyor || !kullanici || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <svg className="animate-spin w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <HataMesajiContainer mesajlar={mesajlar} />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">Eczanem — Müşteri Davetleri</h1>
          <button onClick={() => router.push("/eclub/panel")} className="text-sm text-gray-500 hover:text-gray-700">
            ← Panele Dön
          </button>
        </div>

        <form onSubmit={davetGonder} className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <div className="text-sm font-semibold text-gray-700 mb-3">Yeni Davet</div>
          <div className="text-xs text-gray-500 mb-4">
            Sözlü rızasını aldığınız müşterinizin adını ve cep telefonunu girin; kendisine SMS ile
            tek kullanımlık kod ve üyelik bağlantısı gönderilir.
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={adSoyad}
              onChange={(e) => setAdSoyad(e.target.value)}
              placeholder="Ad Soyad"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              required
            />
            <input
              type="tel"
              value={telefon}
              onChange={(e) => setTelefon(e.target.value)}
              placeholder="05xx xxx xx xx"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              required
            />
            <button
              type="submit"
              disabled={gonderiliyor}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "#b45309" }}
            >
              {gonderiliyor ? "Gönderiliyor…" : "Davet Gönder"}
            </button>
          </div>
        </form>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm font-semibold text-gray-700 mb-3">Davetler</div>
          {davetler.length === 0 ? (
            <div className="text-sm text-gray-400">Henüz davet yok.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {davetler.map((d) => {
                const durum = DURUM_ETIKETLERI[d.durum] ?? { etiket: d.durum, renk: "#737373" };
                return (
                  <div key={d.davet_id} className="py-2.5 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm text-gray-800">{d.ad_soyad}</div>
                      <div className="text-xs text-gray-400">{d.telefon}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold" style={{ color: durum.renk }}>{durum.etiket}</div>
                      <div className="text-[11px] text-gray-400">{new Date(d.created_at).toLocaleString("tr-TR")}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
