// app/eclub/store/siparislerim/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { useAuth } from "@/app/providers/AuthProvider";

interface SiparisSatir {
  siparis_id: string;
  urun_id: string;
  adet: number;
  toplam_puan: number;
  durum: string;
  kargo_firmasi: string | null;
  kargo_takip_no: string | null;
  created_at: string;
  eclub_store_urunler: { ad: string; gorsel_url: string | null } | { ad: string; gorsel_url: string | null }[] | null;
}

const DURUM_ETIKET: Record<string, { ad: string; renk: string; bg: string }> = {
  beklemede: { ad: "Beklemede", renk: "#92400e", bg: "#fef3c7" },
  hazirlaniyor: { ad: "Hazırlanıyor", renk: "#1d4ed8", bg: "#dbeafe" },
  kargoda: { ad: "Kargoda", renk: "#7c3aed", bg: "#ede9fe" },
  teslim_edildi: { ad: "Teslim Edildi", renk: "#166534", bg: "#dcfce7" },
  iptal: { ad: "İptal", renk: "#bc2d0d", bg: "#fee2e2" },
};

export default function EclubSiparislerimPage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor, cikisYap } = useAuth();
  const { mesajlar, hata, basari } = useHataMesaji();

  const eclubKisi = !!kullanici && kullanici.kimlik_turu === "eclub_kisi";

  const [siparisler, setSiparisler] = useState<SiparisSatir[]>([]);
  const [loading, setLoading] = useState(true);
  const [islemId, setIslemId] = useState<string | null>(null);

  const siparisCek = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/eclub/store/api/siparis");
      const d = await res.json();
      if (!res.ok) { hata(d.hata ?? "Siparişler yüklenemedi.", d.adim, d.detay); return; }
      setSiparisler(d.siparisler ?? []);
    } catch (err) {
      hata("Siparişler yüklenirken hata oluştu.", "siparisCek", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [hata]);

  useEffect(() => {
    if (authYukleniyor) return;
    if (!kullanici) { router.replace("/login"); return; }
    if (!eclubKisi) { router.replace("/ana-sayfa"); return; }
    siparisCek();
  }, [kullanici, authYukleniyor, eclubKisi, router, siparisCek]);

  const handleCikis = async () => { await cikisYap(); router.push("/login"); };

  const islem = async (siparis_id: string, action: "iptal" | "teslim_aldim") => {
    setIslemId(siparis_id);
    try {
      const res = await fetch("/eclub/store/api/siparis", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siparis_id, action }),
      });
      const d = await res.json();
      if (!res.ok) { hata(d.hata ?? "İşlem başarısız.", d.adim, d.detay); return; }
      basari(d.mesaj ?? "İşlem tamam.");
      await siparisCek();
    } finally {
      setIslemId(null);
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

  const urunAd = (s: SiparisSatir) => {
    const u = Array.isArray(s.eclub_store_urunler) ? s.eclub_store_urunler[0] : s.eclub_store_urunler;
    return u?.ad ?? "-";
  };

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={kullanici.email} rol={kullanici.rol} adSoyad={kullanici.adSoyad} kimlikTuru={kullanici.kimlik_turu} onCikis={handleCikis} />

      <div className="max-w-3xl mx-auto px-3 py-4 md:px-6 md:py-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900 m-0">Siparişlerim</h1>
          <button onClick={() => router.push("/eclub/store")} className="text-xs px-3 py-1.5 rounded-lg bg-transparent cursor-pointer" style={{ border: "0.5px solid #d1d5db", color: "#6b7280" }}>Mağazaya dön</button>
        </div>

        {siparisler.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-10 text-center">
            <p className="text-sm text-gray-400 m-0">Henüz siparişiniz yok.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {siparisler.map((s) => {
              const durum = DURUM_ETIKET[s.durum] ?? { ad: s.durum, renk: "#6b7280", bg: "#f3f4f6" };
              return (
                <div key={s.siparis_id} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-900">{urunAd(s)}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: durum.renk, background: durum.bg }}>{durum.ad}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>Adet: {s.adet}</span>
                    <span>Toplam: {s.toplam_puan} puan</span>
                    <span>{new Date(s.created_at).toLocaleDateString("tr")}</span>
                  </div>
                  {s.kargo_takip_no && (
                    <div className="text-xs text-gray-500">Kargo: {s.kargo_firmasi} · {s.kargo_takip_no}</div>
                  )}
                  <div className="flex gap-2">
                    {s.durum === "beklemede" && (
                      <button onClick={() => islem(s.siparis_id, "iptal")} disabled={islemId === s.siparis_id}
                        className="text-xs px-3 py-1.5 rounded-lg bg-transparent cursor-pointer" style={{ border: "0.5px solid #fecaca", color: "#bc2d0d" }}>
                        İptal Et
                      </button>
                    )}
                    {s.durum === "kargoda" && (
                      <button onClick={() => islem(s.siparis_id, "teslim_aldim")} disabled={islemId === s.siparis_id}
                        className="text-xs px-3 py-1.5 rounded-lg border-none text-white cursor-pointer" style={{ background: "#16a34a" }}>
                        Teslim Aldım
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}