// app/(panel)/eczanem/eczane/musterilerim/page.tsx
// Eczacı/teknisyen Eczanem — Müşterilerim: davet formu (U2) + davet/üyelik
// durum listesi. Sidebar kabuğu (panel) layout'undan gelir; başlık ve zemin
// eczacı/teknisyen (E-Club kişi) sayfalarıyla ortak EclubKisiSayfa desenindedir.
"use client";

import { useCallback, useEffect, useState } from "react";
import { Users } from "lucide-react";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { EclubKisiSayfa, EclubKisiBaslik } from "@/components/eclub/EclubKisiSayfa";

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

export default function EczanemMusterilerimPage() {
  const { mesajlar, hata, basari } = useHataMesaji();

  const [adSoyad, setAdSoyad] = useState("");
  const [telefon, setTelefon] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [davetler, setDavetler] = useState<DavetSatiri[]>([]);

  const davetleriCek = useCallback(async () => {
    try {
      const res = await fetch("/eczanem/eczane/api/davetler");
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Davetler yüklenemedi.", "davet listesi"); return; }
      setDavetler(data.davetler ?? []);
    } catch {
      hata("Davetler yüklenemedi.", "davet listesi");
    }
  }, [hata]);

  useEffect(() => { davetleriCek(); }, [davetleriCek]);

  const davetGonder = async (e: React.FormEvent) => {
    e.preventDefault();
    setGonderiliyor(true);
    try {
      const res = await fetch("/eczanem/eczane/api/davetler", {
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

  return (
    <EclubKisiSayfa>
      <HataMesajiContainer mesajlar={mesajlar} />
      <EclubKisiBaslik
        ikon={Users}
        ustEtiket="Eczanem"
        baslik="Müşterilerim"
        aciklama="Sözlü rızasını aldığınız müşterilerinizi davet edin; davet ve üyelik durumlarını izleyin."
      />

      <form onSubmit={davetGonder} className="bg-white rounded-xl border border-gray-200 p-5">
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
    </EclubKisiSayfa>
  );
}
