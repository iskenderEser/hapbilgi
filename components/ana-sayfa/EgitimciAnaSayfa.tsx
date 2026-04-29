// components/ana-sayfa/EgitimciAnaSayfa.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useHataMesaji } from "@/components/HataMesaji";

interface TakipSatiri {
  talep_id: string;
  urun_adi: string;
  teknik_adi: string;
  asama: "Senaryo" | "Video" | "Soru Seti" | "Yayın";
  durum: string;
  tarih: string;
  yol: string;
  kategori: "inceleme" | "yayin-bekleyen" | "yayinda" | "durdurulan" | "devam";
}

interface BmSatiri {
  kullanici_id: string;
  bm_adi: string;
  bolge_adi: string;
  hafta_oneri: number;
  bekleyen: number;
  tamamlanan: number;
}

interface EgitimciVeri {
  satirlar: TakipSatiri[];
  istatistikler: { inceleme_bekleyen: number; yayin_bekleyen: number; yayinda: number; toplam: number };
  bm_satirlari: BmSatiri[];
  bm_istatistikler: { bm_sayisi: number; hafta_aktif_bm: number; toplam_bekleyen: number; toplam_tamamlanan: number };
}

interface Props {
  user: any;
  rol: string;
  adSoyad: string;
}

export default function EgitimciAnaSayfa({ user, rol, adSoyad }: Props) {
  const router = useRouter();
  const [veri, setVeri] = useState<EgitimciVeri | null>(null);
  const [loading, setLoading] = useState(true);
  const [aktifFiltre, setAktifFiltre] = useState<string>("tumu");
  const { hata } = useHataMesaji();

  useEffect(() => {
    const veriCek = async () => {
      setLoading(true);
      const res = await fetch("/ana-sayfa/api/egitimci");
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Veriler yüklenemedi.", data.adim, data.detay); }
      else { setVeri(data); }
      setLoading(false);
    };
    veriCek();
  }, [user]);

  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });

  const bugunTarih = () =>
    new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long" });

  const asamaRenk = (asama: string) => {
    switch (asama) {
      case "Senaryo": return { bg: "#f5f3ff", text: "#6d28d9" };
      case "Video": return { bg: "#eff6ff", text: "#1d4ed8" };
      case "Soru Seti": return { bg: "#fff7ed", text: "#c2410c" };
      case "Yayın": return { bg: "#f0fdf4", text: "#166534" };
      default: return { bg: "#f3f4f6", text: "#6b7280" };
    }
  };

  const durumRenk = (durum: string) => {
    if (durum === "İnceleme Bekliyor") return { bg: "#fff1f0", text: "#bc2d0d" };
    if (durum === "Revizyon Gönderildi") return { bg: "#fef3c7", text: "#92400e" };
    if (durum === "Yayında") return { bg: "#eff6ff", text: "#1d4ed8" };
    if (durum === "Yayın Bekliyor") return { bg: "#f3f4f6", text: "#6b7280" };
    if (durum === "Durduruldu") return { bg: "#fef2f2", text: "#bc2d0d" };
    return { bg: "#f3f4f6", text: "#9ca3af" };
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

  const satirlar = veri?.satirlar ?? [];
  const istat = veri?.istatistikler ?? { inceleme_bekleyen: 0, yayin_bekleyen: 0, yayinda: 0, toplam: 0 };
  const bmSatirlari = veri?.bm_satirlari ?? [];
  const bmIstat = veri?.bm_istatistikler ?? { bm_sayisi: 0, hafta_aktif_bm: 0, toplam_bekleyen: 0, toplam_tamamlanan: 0 };
  const filtrelenmis = aktifFiltre === "tumu" ? satirlar : satirlar.filter(s => s.kategori === aktifFiltre);
  const ad = adSoyad.split(" ")[0] || "Eğitimci";

  return (
    <div className="max-w-6xl mx-auto px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7 flex flex-col gap-6">

      {/* Karşılama */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-2">
        <div>
          <h1 className="text-lg md:text-xl font-extrabold text-gray-900 m-0">Merhaba, {ad} 👋</h1>
          <p className="text-sm text-gray-500 mt-1">{rol.toUpperCase()}</p>
        </div>
        <span className="hidden md:inline text-xs text-gray-500 bg-white border border-gray-200 rounded-full px-3 py-1 whitespace-nowrap">
          {bugunTarih()}
        </span>
      </div>

      {/* İçerik Takibi */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: "#56aeff" }}>İçerik Takibi</div>

        {/* Stat kartlar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          {[
            { label: "İnceleme Bekleniyor", value: istat.inceleme_bekleyen, renk: "#bc2d0d", filtre: "inceleme" },
            { label: "Yayın Bekleyenler", value: istat.yayin_bekleyen, renk: "#f59e0b", filtre: "yayin-bekleyen" },
            { label: "Yayında Olanlar", value: istat.yayinda, renk: "#16a34a", filtre: "yayinda" },
            { label: "Toplam Talep", value: istat.toplam, renk: "#56aeff", filtre: "tumu" },
          ].map(k => (
            <div
              key={k.filtre}
              onClick={() => setAktifFiltre(aktifFiltre === k.filtre ? "tumu" : k.filtre)}
              className="bg-white border border-gray-200 rounded-xl p-3 md:p-5 cursor-pointer transition-shadow duration-150"
              style={{
                borderLeft: `3px solid ${k.renk}`,
                boxShadow: aktifFiltre === k.filtre ? `0 0 0 2px ${k.renk}33` : "none",
              }}
            >
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{k.label}</div>
              <div className="text-2xl md:text-3xl font-extrabold text-gray-900 leading-none">{k.value}</div>
            </div>
          ))}
        </div>

        {/* Liste başlık */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-gray-900">İçerik Listesi</span>
          {aktifFiltre !== "tumu" && (
            <button
              onClick={() => setAktifFiltre("tumu")}
              className="text-xs text-gray-500 bg-transparent border border-gray-200 rounded-full px-3 py-1 cursor-pointer"
              style={{ fontFamily: "'Nunito', sans-serif" }}
            >
              Filtreyi Kaldır
            </button>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Mobile */}
          <div className="md:hidden">
            {filtrelenmis.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">Bu kategoride içerik bulunmuyor.</div>
            ) : (
              filtrelenmis.map((s, i) => {
                const asamaR = asamaRenk(s.asama);
                const durumR = durumRenk(s.durum);
                return (
                  <div
                    key={`${s.talep_id}-${i}`}
                    onClick={() => router.push(s.yol)}
                    className="px-4 py-3 cursor-pointer"
                    style={{ borderBottom: i < filtrelenmis.length - 1 ? "1px solid #f3f4f6" : "none" }}
                  >
                    <div className="flex justify-between items-start mb-1.5">
                      <div className="text-sm font-bold text-gray-900">{s.urun_adi}</div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: durumR.bg, color: durumR.text }}>{s.durum}</span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: asamaR.bg, color: asamaR.text }}>{s.asama}</span>
                      <span className="text-xs text-gray-500">{s.teknik_adi}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{formatTarih(s.tarih)}</div>
                  </div>
                );
              })
            )}
          </div>
          {/* Desktop */}
          <div className="hidden md:block">
            <div className="grid gap-3 px-5 py-2.5 bg-gray-50 border-b border-gray-200" style={{ gridTemplateColumns: "1.8fr 1.4fr 1.1fr 1.4fr 1fr 20px" }}>
              {["ÜRÜN", "TEKNİK", "AŞAMA", "DURUM", "TARİH", ""].map((h, i) => (
                <div key={i} className="text-xs font-bold text-gray-400 uppercase tracking-wide">{h}</div>
              ))}
            </div>
            {filtrelenmis.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">Bu kategoride içerik bulunmuyor.</div>
            ) : (
              filtrelenmis.map((s, i) => {
                const asamaR = asamaRenk(s.asama);
                const durumR = durumRenk(s.durum);
                return (
                  <div
                    key={`${s.talep_id}-${i}`}
                    onClick={() => router.push(s.yol)}
                    className="grid gap-3 px-5 py-3 items-center cursor-pointer bg-white hover:bg-gray-50 transition-colors duration-100"
                    style={{
                      gridTemplateColumns: "1.8fr 1.4fr 1.1fr 1.4fr 1fr 20px",
                      borderBottom: i < filtrelenmis.length - 1 ? "1px solid #f3f4f6" : "none",
                    }}
                  >
                    <div className="text-sm font-bold text-gray-900 truncate">{s.urun_adi}</div>
                    <div className="text-xs text-gray-500 truncate">{s.teknik_adi}</div>
                    <div><span className="text-xs font-bold px-2 py-0.5 rounded-full inline-block whitespace-nowrap" style={{ background: asamaR.bg, color: asamaR.text }}>{s.asama}</span></div>
                    <div><span className="text-xs font-bold px-2 py-0.5 rounded-full inline-block whitespace-nowrap" style={{ background: durumR.bg, color: durumR.text }}>{s.durum}</span></div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">{formatTarih(s.tarih)}</span>
                    <span className="text-gray-300 text-base">›</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* BM Aktivite Takibi */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: "#56aeff" }}>BM Aktivite Takibi</div>

        {/* Stat kartlar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          {[
            { label: "Takımdaki BM", value: bmIstat.bm_sayisi, renk: "#56aeff" },
            { label: "Bu Hafta Aktif", value: bmIstat.hafta_aktif_bm, renk: "#16a34a" },
            { label: "Bekleyen Öneriler", value: bmIstat.toplam_bekleyen, renk: "#bc2d0d" },
            { label: "Tamamlanan", value: bmIstat.toplam_tamamlanan, renk: "#f59e0b" },
          ].map((k, idx) => (
            <div
              key={idx}
              className="bg-white border border-gray-200 rounded-xl p-3 md:p-5"
              style={{ borderLeft: `3px solid ${k.renk}` }}
            >
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{k.label}</div>
              <div className="text-2xl md:text-3xl font-extrabold text-gray-900 leading-none">{k.value}</div>
            </div>
          ))}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Mobile */}
          <div className="md:hidden">
            {bmSatirlari.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">Takımda BM bulunmuyor.</div>
            ) : (
              bmSatirlari.map((s, i) => (
                <div
                  key={s.kullanici_id}
                  onClick={() => router.push("/oneriler")}
                  className="px-4 py-3 cursor-pointer"
                  style={{ borderBottom: i < bmSatirlari.length - 1 ? "1px solid #f3f4f6" : "none" }}
                >
                  <div className="flex justify-between items-start mb-1.5">
                    <div className="text-sm font-bold text-gray-900">{s.bm_adi}</div>
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: s.hafta_oneri > 0 ? "#f0fdf4" : "#f3f4f6", color: s.hafta_oneri > 0 ? "#166534" : "#9ca3af" }}
                    >
                      {s.hafta_oneri} öneri
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">{s.bolge_adi}</div>
                  <div className="flex gap-3 mt-1">
                    <span className="text-xs" style={{ color: s.bekleyen > 0 ? "#bc2d0d" : "#9ca3af" }}>Bekleyen: {s.bekleyen}</span>
                    <span className="text-xs text-green-700">Tamamlanan: {s.tamamlanan}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          {/* Desktop */}
          <div className="hidden md:block">
            <div className="grid gap-3 px-5 py-2.5 bg-gray-50 border-b border-gray-200" style={{ gridTemplateColumns: "1.6fr 1.2fr 1fr 1fr 1fr 20px" }}>
              {["BM", "BÖLGE", "BU HAFTA", "BEKLEYEN", "TAMAMLANAN", ""].map((h, i) => (
                <div key={i} className="text-xs font-bold text-gray-400 uppercase tracking-wide">{h}</div>
              ))}
            </div>
            {bmSatirlari.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">Takımda BM bulunmuyor.</div>
            ) : (
              bmSatirlari.map((s, i) => (
                <div
                  key={s.kullanici_id}
                  onClick={() => router.push("/oneriler")}
                  className="grid gap-3 px-5 py-3 items-center cursor-pointer bg-white hover:bg-gray-50 transition-colors duration-100"
                  style={{
                    gridTemplateColumns: "1.6fr 1.2fr 1fr 1fr 1fr 20px",
                    borderBottom: i < bmSatirlari.length - 1 ? "1px solid #f3f4f6" : "none",
                  }}
                >
                  <div className="text-sm font-bold text-gray-900">{s.bm_adi}</div>
                  <div className="text-xs text-gray-500">{s.bolge_adi}</div>
                  <div>
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full inline-block"
                      style={{ background: s.hafta_oneri > 0 ? "#f0fdf4" : "#f3f4f6", color: s.hafta_oneri > 0 ? "#166534" : "#9ca3af" }}
                    >
                      {s.hafta_oneri} öneri
                    </span>
                  </div>
                  <div className="text-sm font-bold" style={{ color: s.bekleyen > 0 ? "#bc2d0d" : "#9ca3af" }}>{s.bekleyen}</div>
                  <div className="text-sm font-bold text-green-700">{s.tamamlanan}</div>
                  <span className="text-gray-300 text-base">›</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

    </div>
  );
}