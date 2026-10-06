// components/ana-sayfa/BmAnaSayfa.tsx
"use client";

import { ROL_ADLARI } from "@/lib/utils/roller";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useHataMesaji } from "@/components/HataMesaji";
import SahaVideoRaflari from "@/components/ana-sayfa/SahaVideoRaflari";
import { SahaAnaSayfaVideo } from "@/lib/video/anaSayfaVideolari";
import { useHbstoreTakvim } from "@/hooks/useHbstoreTakvim";

import type { AuthKullanici } from "@/types/auth";

interface BmVeri {
  istatistikler: {
    bitis_yaklasan_oneriler: number;
    cek_onay_bekleyen: number;
    siparis_onay_bekleyen: number;
    gelen_challenge: number;
  };
  moduller: { eclub: boolean; cclub: boolean };
  videolar?: SahaAnaSayfaVideo[];
}

interface Props {
  user: AuthKullanici;
  adSoyad: string;
}

export default function BmAnaSayfa({ user, adSoyad }: Props) {
  const router = useRouter();
  const [bmVeri, setBmVeri] = useState<BmVeri | null>(null);
  const [loading, setLoading] = useState(true);
  const etkilesimKilidi = useRef(new Set<string>());
  const { hata } = useHataMesaji();
  const { takvim } = useHbstoreTakvim();

  useEffect(() => {
    const veriCek = async () => {
      setLoading(true);
      const res = await fetch("/ana-sayfa/api");
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Veriler yüklenemedi.", data.adim, data.detay); }
      else { setBmVeri(data); }
      setLoading(false);
    };
    veriCek();
  }, [user]);

  const bugunTarih = () =>
    new Date().toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });

  const etkilesimYap = async (tur: "begeni" | "favori", event: MouseEvent, yayinId: string) => {
    event.stopPropagation();
    const kilit = `${tur}:${yayinId}`;
    if (etkilesimKilidi.current.has(kilit)) return;
    etkilesimKilidi.current.add(kilit);
    try {
      const yanit = await fetch(`/izle/api/${tur}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yayin_id: yayinId }),
      });
      const sonuc = await yanit.json();
      if (!yanit.ok) throw new Error(sonuc.hata ?? "İşlem tamamlanamadı.");
      const bayrak = tur === "begeni" ? "begeni_mi" : "favori_mi";
      const sayac = tur === "begeni" ? "begeni_sayisi" : "favori_sayisi";
      if (typeof sonuc[bayrak] !== "boolean") throw new Error("İşlem sonucu alınamadı.");
      setBmVeri((onceki) => onceki ? {
        ...onceki,
        videolar: onceki.videolar?.map((video) => {
          if (video.yayin_id !== yayinId || video[bayrak] === sonuc[bayrak]) return video;
          return {
            ...video,
            [bayrak]: sonuc[bayrak],
            [sayac]: Math.max(0, video[sayac] + (sonuc[bayrak] ? 1 : -1)),
          };
        }),
      } : onceki);
    } catch (err) {
      hata(err instanceof Error ? err.message : "Beğeni veya favori işlemi başarısız.");
    } finally {
      etkilesimKilidi.current.delete(kilit);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <svg className="animate-spin w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  const istat = bmVeri?.istatistikler ?? { bitis_yaklasan_oneriler: 0, cek_onay_bekleyen: 0, siparis_onay_bekleyen: 0, gelen_challenge: 0 };
  const kartlar = [
    { label: "Bitiş Tarihi Yaklaşan Öneriler", value: istat.bitis_yaklasan_oneriler, sub: "48 saat içinde bitecek", renk: "#f59e0b", href: "/oneriler?gorunum=bitis_yaklasan" },
    ...(bmVeri?.moduller.eclub ? [
      { label: "Çek Onay Takibi", value: istat.cek_onay_bekleyen, sub: "BM onayı bekliyor", renk: "#2f7fc7", href: "/eclub/hediye-takip?tur=cek&durum=bm_onayinda" },
      { label: "Sipariş Onay Takibi", value: istat.siparis_onay_bekleyen, sub: "BM onayı bekliyor", renk: "#16a34a", href: "/eclub/hediye-takip?tur=siparis&durum=utt_onayladi" },
    ] : []),
    ...(bmVeri?.moduller.cclub ? [
      { label: "Gelen Challenge", value: istat.gelen_challenge, sub: "Tamamlanmamış challenge", renk: "#8b5cf6", href: "/challenge-club?tab=bekleyen" },
    ] : []),
  ];
  const kartIzgaraClass = kartlar.length === 4 ? "md:grid-cols-4" : kartlar.length === 3 ? "md:grid-cols-3" : kartlar.length === 2 ? "md:grid-cols-2" : "md:grid-cols-1";
  const ad = adSoyad.split(" ")[0] || "BM";

  return (
    <div className="max-w-6xl mx-auto px-3 py-4 pb-20 md:px-6 md:py-5 md:pb-5 lg:px-8 lg:py-7">

      {/* Karşılama */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-lg md:text-xl font-extrabold text-gray-900 m-0">Merhaba {ad}, 👋</h1>
          <p className="text-sm text-gray-500 mt-1">{ROL_ADLARI["bm"]}</p>
        </div>

        <div className="flex items-start md:items-stretch gap-1.5 flex-wrap md:flex-col">
          {takvim && (() => {
            const kalanGun = Math.floor(takvim.kalanMs / (24 * 60 * 60 * 1000));
            const onGunKala = !takvim.acik && kalanGun <= 10;
            return (
              <button
                type="button"
                onClick={() => router.push("/store")}
                className="inline-flex items-center justify-center gap-1.5 text-[10px] font-bold px-3 py-1 rounded-full border transition-all hover:opacity-85 shadow-xs cursor-pointer select-none whitespace-nowrap text-center"
                style={{
                  backgroundColor: takvim.acik ? "#f0fdf4" : onGunKala ? "#1e3a8a" : "#fffbeb",
                  borderColor: takvim.acik ? "#bbf7d0" : onGunKala ? "#1e3a8a" : "#fef3c7",
                  color: takvim.acik ? "#166534" : onGunKala ? "#ffffff" : "#92400e",
                }}
                title={
                  takvim.acik
                    ? `Store Günleri açık · Kapanışa ${takvim.kalanSureMetni} kaldı`
                    : `Sonraki sipariş dönemi: ${takvim.sonrakiDonemEtiketi} (${takvim.kalanSureMetni} kaldı)`
                }
              >
                {!onGunKala && (
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      backgroundColor: takvim.acik ? "#16a34a" : "#f59e0b",
                      boxShadow: takvim.acik ? "0 0 6px #16a34a" : "none",
                    }}
                  />
                )}
                <span>{takvim.navMetni}</span>
              </button>
            );
          })()}

          <span className="hidden md:inline-flex items-center justify-center text-[10px] text-gray-500 bg-white border border-gray-200 rounded-full px-3 py-1 whitespace-nowrap shadow-xs text-center">
            {bugunTarih()}
          </span>
        </div>
      </div>

      {/* Stat kartlar */}
      <div className={`grid grid-cols-2 ${kartIzgaraClass} gap-2 mb-5`}>
        {kartlar.map((k) => (
          <button
            key={k.label}
            type="button"
            onClick={() => router.push(k.href)}
            className="bg-white border border-gray-200 rounded-xl p-3 md:p-5 text-left transition-shadow duration-150 hover:shadow-md"
            style={{ borderLeft: `3px solid ${k.renk}` }}
          >
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{k.label}</div>
            <div className="text-2xl md:text-3xl font-extrabold text-gray-900 leading-none">{k.value}</div>
            <div className="hidden md:block text-xs text-gray-500 mt-1.5">{k.sub}</div>
          </button>
        ))}
      </div>

      {/* Yayın önerme yönlendirmesi */}
      <div className="mb-5 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => router.push("/yayindaki-videolar")}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#2f7fc7] px-4 py-2.5 text-xs font-extrabold text-white shadow-sm transition-colors hover:bg-[#256daf]"
        >
          <Plus size={15} strokeWidth={2.5} aria-hidden="true" /> Yayın Öneriniz
        </button>
      </div>

      {/* Videolar */}
      <div>
        <SahaVideoRaflari
          videolar={bmVeri?.videolar ?? []}
          onVideoSec={(video) => {
            const query = new URLSearchParams({ donus: "ana-sayfa" });
            if (video.gelen_challenge_id) query.set("challenge_id", video.gelen_challenge_id);
            router.push(`/challenge-club/izle/${video.yayin_id}?${query}`);
          }}
          onBegeni={(event, yayinId) => { void etkilesimYap("begeni", event, yayinId); }}
          onFavori={(event, yayinId) => { void etkilesimYap("favori", event, yayinId); }}
          kapsulFiltre
          bosBasliklariGoster
          kisiselIzlemeBasliklari
          favoriRafiGoster
        />
      </div>
    </div>
  );
}
