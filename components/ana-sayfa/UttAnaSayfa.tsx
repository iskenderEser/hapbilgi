// components/ana-sayfa/UttAnaSayfa.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import VideoOynatici from "@/components/izle/VideoOynatici";

interface Video {
  yayin_id: string;
  urun_adi: string;
  teknik_adi: string;
  video_url: string | null;
  thumbnail_url: string | null;
  video_puani: number | null;
  yayin_tarihi: string;
  extra_puan: number;
  ileri_sarma_acik: boolean;
  begeni_sayisi: number;
  favori_sayisi: number;
  begeni_mi: boolean;
  favori_mi: boolean;
  daha_once_izledi: boolean;
}

interface UttVeri {
  yeni_videolar: Video[];
  devam_edenler: Video[];
  tamamlananlar: Video[];
  istatistikler: {
    yeni: number;
    devam: number;
    tamamlanan: number;
    hafta_puani: number;
    toplam_puan: number;
  };
}

interface Props {
  user: any;
  rol: string;
  adSoyad: string;
}

const GRADYANLAR = [
  "linear-gradient(135deg, #b5d4f4, #56aeff)",
  "linear-gradient(135deg, #c0dd97, #639922)",
  "linear-gradient(135deg, #f5c4b3, #D85A30)",
  "linear-gradient(135deg, #CECBF6, #534AB7)",
  "linear-gradient(135deg, #9FE1CB, #1D9E75)",
];

export default function UttAnaSayfa({ user, rol, adSoyad }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [uttVeri, setUttVeri] = useState<UttVeri | null>(null);
  const [loading, setLoading] = useState(true);
  const [aktifFiltre, setAktifFiltre] = useState<string>("yeni");
  const [aktifVideo, setAktifVideo] = useState<Video | null>(null);
  const [aktifOneriId, setAktifOneriId] = useState<string | null>(null);
  const { mesajlar, hata, basari, uyari } = useHataMesaji();

  // Tamamla/soru sonrası oynatıcıyı kapatmadan sayaçları/durumu tazelemek için
  // sessiz (loading'siz) yenileme yapabilen tek veri çekme fonksiyonu.
  const veriCek = async (sessiz = false) => {
    if (!sessiz) setLoading(true);
    const res = await fetch("/ana-sayfa/api");
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Veriler yüklenemedi.", data.adim, data.detay); }
    else { setUttVeri(data); }
    if (!sessiz) setLoading(false);
  };

  useEffect(() => {
    veriCek();
  }, [user]);

  // URL'den yayin_id ve oneri_id okuyup ilgili videoyu otomatik aç
  useEffect(() => {
    const yayinId = searchParams.get("yayin_id");
    const oneriId = searchParams.get("oneri_id");
    if (!yayinId || !uttVeri) return;
    const tumVideolar = [
      ...uttVeri.yeni_videolar,
      ...uttVeri.devam_edenler,
      ...uttVeri.tamamlananlar,
    ];
    const hedefVideo = tumVideolar.find(v => v.yayin_id === yayinId);
    if (hedefVideo) {
      setAktifVideo(hedefVideo);
      setAktifOneriId(oneriId);
    }
  }, [uttVeri, searchParams]);

  const handleBegeni = async (e: React.MouseEvent, yayin_id: string) => {
    e.stopPropagation();
    const res = await fetch("/izle/api/begeni", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ yayin_id }) });
    const d = await res.json();
    if (!res.ok) return;
    setUttVeri(prev => {
      if (!prev) return prev;
      const guncelle = (liste: Video[]) => liste.map(v => v.yayin_id === yayin_id
        ? { ...v, begeni_mi: d.begeni_mi, begeni_sayisi: d.begeni_mi ? v.begeni_sayisi + 1 : v.begeni_sayisi - 1 }
        : v);
      return { ...prev, yeni_videolar: guncelle(prev.yeni_videolar), devam_edenler: guncelle(prev.devam_edenler), tamamlananlar: guncelle(prev.tamamlananlar) };
    });
  };

  const handleFavori = async (e: React.MouseEvent, yayin_id: string) => {
    e.stopPropagation();
    const res = await fetch("/izle/api/favori", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ yayin_id }) });
    const d = await res.json();
    if (!res.ok) return;
    setUttVeri(prev => {
      if (!prev) return prev;
      const guncelle = (liste: Video[]) => liste.map(v => v.yayin_id === yayin_id
        ? { ...v, favori_mi: d.favori_mi, favori_sayisi: d.favori_mi ? v.favori_sayisi + 1 : v.favori_sayisi - 1 }
        : v);
      return { ...prev, yeni_videolar: guncelle(prev.yeni_videolar), devam_edenler: guncelle(prev.devam_edenler), tamamlananlar: guncelle(prev.tamamlananlar) };
    });
  };

  const bugunTarih = () =>
    new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long" });

  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });

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

  // Bir video seçiliyse: dashboard yerine sayfayı kaplayan oynatıcı (kart → oynatıcı → geri).
  if (aktifVideo) {
    return (
      <div className="max-w-6xl mx-auto px-3 py-4 pb-20 md:px-6 md:py-5 md:pb-5 lg:px-8 lg:py-7">
        <VideoOynatici
          key={aktifVideo.yayin_id}
          video={aktifVideo}
          tuketici={true}
          oneri_id={aktifOneriId}
          onKapat={() => { setAktifVideo(null); setAktifOneriId(null); }}
          onVeriYenile={() => veriCek(true)}
          hata={hata}
          basari={basari}
          uyari={uyari}
        />
        <HataMesajiContainer mesajlar={mesajlar} />
      </div>
    );
  }

  const istat = uttVeri?.istatistikler ?? { yeni: 0, devam: 0, tamamlanan: 0, hafta_puani: 0, toplam_puan: 0 };
  const ad = adSoyad.split(" ")[0] || "Temsilci";

  const aktifVideolar = aktifFiltre === "yeni"
    ? (uttVeri?.yeni_videolar ?? [])
    : aktifFiltre === "devam"
    ? (uttVeri?.devam_edenler ?? [])
    : (uttVeri?.tamamlananlar ?? []);

  return (
    <div className="max-w-6xl mx-auto px-3 py-4 pb-20 md:px-6 md:py-5 md:pb-5 lg:px-8 lg:py-7">

      {/* Karşılama */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 mb-6">
        <div>
          <h1 className="text-lg md:text-xl font-extrabold text-gray-900 m-0">Merhaba, {ad} 👋</h1>
          <p className="text-sm text-gray-500 mt-1">{rol.toUpperCase()}</p>
        </div>
        <span className="hidden md:inline text-xs text-gray-500 bg-white border border-gray-200 rounded-full px-3 py-1 whitespace-nowrap">
          {bugunTarih()}
        </span>
      </div>

      {/* Stat kartlar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
        {[
          { label: "Yeni Videolar", value: istat.yeni, sub: "Henüz izlenmedi", renk: "#bc2d0d", filtre: "yeni" },
          { label: "Devam Eden", value: istat.devam, sub: "Yarıda bırakılan", renk: "#f59e0b", filtre: "devam" },
          { label: "Tamamlanan", value: istat.tamamlanan, sub: "İzlendi ve tamamlandı", renk: "#16a34a", filtre: "tamamlanan" },
          { label: "Bu Haftaki Puan", value: istat.hafta_puani, sub: `Toplam: ${istat.toplam_puan.toLocaleString("tr-TR")} p`, renk: "#56aeff", filtre: "" },
        ].map((k, idx) => (
          <div
            key={idx}
            onClick={() => k.filtre && setAktifFiltre(aktifFiltre === k.filtre ? "yeni" : k.filtre)}
            className="bg-white border border-gray-200 rounded-xl p-3 md:p-5 transition-shadow duration-150"
            style={{
              borderLeft: `3px solid ${k.renk}`,
              cursor: k.filtre ? "pointer" : "default",
              boxShadow: k.filtre && aktifFiltre === k.filtre ? `0 0 0 2px ${k.renk}33` : "none",
            }}
          >
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{k.label}</div>
            <div className="text-2xl md:text-3xl font-extrabold text-gray-900 leading-none">{k.value.toLocaleString("tr-TR")}</div>
            <div className="hidden md:block text-xs text-gray-500 mt-1.5">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Video grid başlık */}
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-sm font-bold text-gray-900">
          {aktifFiltre === "yeni" ? "Yeni Videolar" : aktifFiltre === "devam" ? "Devam Eden" : "Tamamlanan"}
        </span>
        <span className="text-xs cursor-pointer" style={{ color: "#56aeff" }} onClick={() => router.push("/ana-sayfa")}>
          Tümünü gör
        </span>
      </div>

      {aktifVideolar.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-400">
          Bu kategoride video bulunmuyor.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {aktifVideolar.slice(0, 8).map(v => (
            <div
              key={v.yayin_id}
              onClick={() => setAktifVideo(v)}
              className="bg-white rounded-xl overflow-hidden cursor-pointer transition-shadow duration-150"
              style={{ border: "0.5px solid #e5e7eb" }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = "none"}
            >
              {/* Thumbnail */}
              <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16/9" }}>
                {v.thumbnail_url
                  ? <img src={v.thumbnail_url} alt="thumbnail" className="w-full h-full object-cover" />
                  : <div className="w-full h-full" style={{ background: GRADYANLAR[Math.abs(v.yayin_id.charCodeAt(0)) % GRADYANLAR.length] }} />
                }
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
                    <svg width="9" height="11" viewBox="0 0 10 12" fill="white"><path d="M0 0l10 6-10 6z" /></svg>
                  </div>
                </div>
                <div className="absolute top-2 left-2 flex gap-1">
                  {v.daha_once_izledi ? (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#f0fdf4", color: "#16a34a", border: "0.5px solid #bbf7d0", fontSize: 10 }}>İzlendi</span>
                  ) : (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: "#56aeff", fontSize: 10 }}>Yeni</span>
                  )}
                  {v.ileri_sarma_acik && (
                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-white" style={{ background: "rgba(0,0,0,0.6)", fontSize: 10 }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
                    </span>
                  )}
                </div>
              </div>

              {/* Bilgi */}
              <div className="px-2.5 py-2 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-gray-900 truncate">{v.urun_adi}</div>
                  <div className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">{v.teknik_adi}</div>
                </div>
                <div className="flex items-center justify-between">
                  {v.video_puani !== null ? (
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-0.5 text-xs text-gray-500">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#56aeff" strokeWidth="2">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                        Video <span className="font-semibold text-gray-900 ml-0.5">{v.video_puani}</span>
                      </div>
                      {v.extra_puan > 0 && (
                        <div className="flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs" style={{ background: "#f0fdf4", border: "0.5px solid #bbf7d0", color: "#15803d" }}>
                          +<span className="font-semibold">{v.extra_puan}</span> extra
                        </div>
                      )}
                    </div>
                  ) : <div />}
                  <div className="text-xs text-gray-400 flex-shrink-0">{formatTarih(v.yayin_tarihi)}</div>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <div className="flex items-center gap-1 cursor-pointer" onClick={(e) => handleBegeni(e, v.yayin_id)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={v.begeni_mi ? "#bc2d0d" : "none"} stroke="#bc2d0d" strokeWidth="2">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                    <span className="text-xs" style={{ color: v.begeni_mi ? "#bc2d0d" : "#737373", fontWeight: v.begeni_mi ? 600 : 400 }}>{v.begeni_sayisi}</span>
                  </div>
                  <div className="flex items-center gap-1 cursor-pointer" onClick={(e) => handleFavori(e, v.yayin_id)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={v.favori_mi ? "#56aeff" : "none"} stroke={v.favori_mi ? "#56aeff" : "#737373"} strokeWidth="2">
                      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
                      <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                    </svg>
                    <span className="text-xs" style={{ color: v.favori_mi ? "#56aeff" : "#737373", fontWeight: v.favori_mi ? 600 : 400 }}>{v.favori_sayisi}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}