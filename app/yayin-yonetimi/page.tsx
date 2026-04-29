// app/yayin-yonetimi/page.tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";

interface Bekleyen {
  soru_seti_durum_id: string;
  soru_seti_id: string;
  video_durum_id: string;
  sorular: any[];
  video_url: string | null;
  thumbnail_url: string | null;
  video_puan_id: string | null;
  video_puani: number | null;
  soru_puan_map: Record<number, { soru_seti_puan_id: string; soru_puani: number }>;
  urun_adi: string;
  teknik_adi: string;
  onay_tarihi: string;
}

interface Yayin {
  yayin_id: string;
  soru_seti_durum_id: string;
  durum: string;
  yayin_tarihi: string;
  durdurma_tarihi: string | null;
  urun_adi: string;
  teknik_adi: string;
  video_url: string | null;
  thumbnail_url: string | null;
  video_puani: number | null;
  soru_puani: number | null;
  sorular: any[];
  ileri_sarma_acik: boolean;
}

const VIDEO_PUAN_SECENEKLERI = [40, 45, 50, 55, 60, 65, 70];
const SORU_PUAN_SECENEKLERI = [3, 4, 5, 6, 7];

export default function YayinYonetimiPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [rol, setRol] = useState<string>("");
  const [aktifSekme, setAktifSekme] = useState<"bekleyen" | "yayinda" | "durdurulan">("bekleyen");
  const [bekleyenler, setBekleyenler] = useState<Bekleyen[]>([]);
  const [yayinlar, setYayinlar] = useState<Yayin[]>([]);
  const [loading, setLoading] = useState(true);
  const [islemLoading, setIslemLoading] = useState<string | null>(null);
  const [acikAkordiyon, setAcikAkordiyon] = useState<string | null>(null);
  const [acikVideo, setAcikVideo] = useState<string | null>(null);
  const [onayModal, setOnayModal] = useState<Bekleyen | null>(null);
  const [ileriSarmaOnayModal, setIleriSarmaOnayModal] = useState<{ soru_seti_durum_id: string; urun_adi: string } | null>(null);
  const [videoPuanlari, setVideoPuanlari] = useState<Record<string, number>>({});
  const [soruPuanlari, setSoruPuanlari] = useState<Record<string, Record<number, number>>>({});
  const [bekleyenIleriSarma, setBekleyenIleriSarma] = useState<Record<string, boolean>>({});
  const [ileriSarmaAcik, setIleriSarmaAcik] = useState<Record<string, boolean>>({});
  const [extraPuanlar, setExtraPuanlar] = useState<Record<string, number>>({});
  const { mesajlar, hata, basari } = useHataMesaji();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      setUser(data.user);
      setRol(data.user.user_metadata?.rol ?? "");
    });
  }, []);

  const handleCikis = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const veriCek = async () => {
    setLoading(true);
    const supabase = createClient();

    const bRes = await fetch("/yayin-yonetimi/api/bekleyenler");
    const bData = await bRes.json();
    if (!bRes.ok) {
      hata(bData.hata ?? "Bekleyenler yüklenemedi.", bData.adim, bData.detay);
    } else {
      const bekleyenlerData = bData.bekleyenler ?? [];
      setBekleyenler(bekleyenlerData);
      const yeniSoruPuanlari: Record<string, Record<number, number>> = {};
      for (const b of bekleyenlerData) {
        yeniSoruPuanlari[b.soru_seti_durum_id] = {};
        for (const [idx, puan] of Object.entries(b.soru_puan_map ?? {})) {
          yeniSoruPuanlari[b.soru_seti_durum_id][Number(idx)] = (puan as any).soru_puani;
        }
      }
      setSoruPuanlari(yeniSoruPuanlari);
    }

    const { data: yayinlarData, error: yayinError } = await supabase
      .from("v_yayin_detay")
      .select("yayin_id, soru_seti_durum_id, durum, yayin_tarihi, durdurma_tarihi, urun_adi, teknik_adi, video_url, thumbnail_url, video_puani, soru_puani, sorular")
      .order("yayin_tarihi", { ascending: false });

    if (yayinError) { hata("Yayınlar yüklenemedi.", "v_yayin_detay view SELECT", yayinError.message); setLoading(false); return; }

    if ((yayinlarData ?? []).length > 0) {
      const { data: yayinBilgileri } = await supabase
        .from("yayin_yonetimi").select("yayin_id, ileri_sarma_acik")
        .in("yayin_id", yayinlarData!.map(y => y.yayin_id));

      const ileriSarmaMap: Record<string, boolean> = {};
      for (const yb of yayinBilgileri ?? []) { ileriSarmaMap[yb.yayin_id] = yb.ileri_sarma_acik ?? false; }
      setIleriSarmaAcik(ileriSarmaMap);
      setYayinlar((yayinlarData ?? []).map(y => ({ ...y, ileri_sarma_acik: ileriSarmaMap[y.yayin_id] ?? false })));

      const { data: tumSoruPuanlari, error: spError } = await supabase
        .from("soru_seti_puanlari").select("soru_seti_durum_id, soru_index, soru_puani")
        .in("soru_seti_durum_id", yayinlarData!.map(y => y.soru_seti_durum_id));

      if (!spError && tumSoruPuanlari) {
        setSoruPuanlari(prev => {
          const guncellenen = { ...prev };
          for (const sp of tumSoruPuanlari) {
            if (!guncellenen[sp.soru_seti_durum_id]) guncellenen[sp.soru_seti_durum_id] = {};
            guncellenen[sp.soru_seti_durum_id][sp.soru_index] = sp.soru_puani;
          }
          return guncellenen;
        });
      }
    } else {
      setYayinlar([]);
    }

    setLoading(false);
  };

  useEffect(() => { if (user) veriCek(); }, [user]);

  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const getSoruPuani = (soru_seti_durum_id: string, soru_index: number): number | "" =>
    soruPuanlari[soru_seti_durum_id]?.[soru_index] ?? "";

  const setSoruPuani = (soru_seti_durum_id: string, soru_index: number, puan: number) => {
    setSoruPuanlari(prev => ({ ...prev, [soru_seti_durum_id]: { ...(prev[soru_seti_durum_id] ?? {}), [soru_index]: puan } }));
  };

  const hepsineAyniPuanAta = (soru_seti_durum_id: string, sorular: any[], puan: number) => {
    const yeni: Record<number, number> = {};
    sorular.forEach((_, i) => { yeni[i] = puan; });
    setSoruPuanlari(prev => ({ ...prev, [soru_seti_durum_id]: yeni }));
  };

  const tumPuanlarAtandiMi = (b: Bekleyen): boolean => {
    const vp = videoPuanlari[b.soru_seti_durum_id] ?? b.video_puani;
    if (!vp) return false;
    if (!extraPuanlar[b.soru_seti_durum_id]) return false;
    for (let i = 0; i < b.sorular.length; i++) {
      if (!soruPuanlari[b.soru_seti_durum_id]?.[i]) return false;
    }
    return true;
  };

  const handleBekleyenIleriSarmaToggle = (soru_seti_durum_id: string, urun_adi: string) => {
    const mevcutDurum = bekleyenIleriSarma[soru_seti_durum_id] ?? false;
    if (!mevcutDurum) { setIleriSarmaOnayModal({ soru_seti_durum_id, urun_adi }); }
    else { setBekleyenIleriSarma(prev => ({ ...prev, [soru_seti_durum_id]: false })); }
  };

  const handleIleriSarmaOnaylaVeAc = (soru_seti_durum_id: string) => {
    setBekleyenIleriSarma(prev => ({ ...prev, [soru_seti_durum_id]: true }));
    setIleriSarmaOnayModal(null);
  };

  const handleIleriSarmaGuncelle = async (yayin_id: string, ileri_sarma_acik: boolean) => {
    setIleriSarmaOnayModal(null);
    const res = await fetch("/yayin-yonetimi/api/ileri-sarma", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yayin_id, ileri_sarma_acik }),
    });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "İleri sarma ayarı güncellenemedi.", d.adim, d.detay); }
    else {
      setIleriSarmaAcik(prev => ({ ...prev, [yayin_id]: ileri_sarma_acik }));
      setYayinlar(prev => prev.map(y => y.yayin_id === yayin_id ? { ...y, ileri_sarma_acik } : y));
      basari(ileri_sarma_acik ? "İleri sarma açıldı." : "İleri sarma kapatıldı.");
    }
  };

  const handleYayinla = async () => {
    if (!onayModal) return;
    const b = onayModal;
    setOnayModal(null);
    setIslemLoading(b.soru_seti_durum_id);

    const vp = videoPuanlari[b.soru_seti_durum_id] ?? b.video_puani;
    if (vp) {
      const res = await fetch("/yayin-yonetimi/api/puan/video", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_durum_id: b.video_durum_id, video_puani: vp }),
      });
      if (!res.ok) { const d = await res.json(); hata(d.hata ?? "Video puanı kaydedilemedi.", d.adim, d.detay); setIslemLoading(null); return; }
    }

    const puanlar = b.sorular.map((_, i) => ({ soru_index: i, soru_puani: soruPuanlari[b.soru_seti_durum_id]?.[i] })).filter(p => p.soru_puani);
    if (puanlar.length > 0) {
      const res = await fetch("/yayin-yonetimi/api/puan/sorular", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ soru_seti_durum_id: b.soru_seti_durum_id, puanlar }),
      });
      if (!res.ok) { const d = await res.json(); hata(d.hata ?? "Soru puanları kaydedilemedi.", d.adim, d.detay); setIslemLoading(null); return; }
    }

    const res = await fetch("/yayin-yonetimi/api/yayinlar", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soru_seti_durum_id: b.soru_seti_durum_id, ileri_sarma_acik: bekleyenIleriSarma[b.soru_seti_durum_id] ?? false, extra_puan: extraPuanlar[b.soru_seti_durum_id] ?? null }),
    });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "Yayına alınamadı.", d.adim, d.detay); }
    else { basari(`${b.urun_adi} yayına alındı.`); await veriCek(); }
    setIslemLoading(null);
  };

  const handleDurumDegistir = async (yayin_id: string, mevcutDurum: string) => {
    setIslemLoading(yayin_id);
    const res = await fetch(`/yayin-yonetimi/api/yayinlar/${yayin_id}`, { method: "PUT" });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "İşlem gerçekleştirilemedi.", d.adim, d.detay); }
    else { basari(mevcutDurum === "Yayinda" ? "Yayın durduruldu." : "Yayın yeniden başlatıldı."); await veriCek(); }
    setIslemLoading(null);
  };

  const yayindakiler = yayinlar.filter(y => y.durum === "Yayinda");
  const durdurulular = yayinlar.filter(y => y.durum === "Durduruldu");

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <svg className="animate-spin w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  // Toggle component
  const Toggle = ({ acik, onClick }: { acik: boolean; onClick: () => void }) => (
    <div onClick={onClick} className="relative cursor-pointer flex-shrink-0 rounded-full transition-colors duration-200"
      style={{ width: 32, height: 18, background: acik ? "#56aeff" : "#e5e7eb" }}>
      <div className="absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all duration-200"
        style={{ left: acik ? 16 : 2, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
    </div>
  );

  const IleriSarmaBadge = ({ acik }: { acik: boolean }) => acik ? (
    <span className="text-xs rounded-full px-2 py-0.5 inline-block mt-1"
      style={{ color: "#bc2d0d", background: "rgba(188,45,13,0.08)", border: "0.5px solid rgba(188,45,13,0.25)" }}>
      İleri sarma açık
    </span>
  ) : null;

  // Thumbnail bileşeni
  const VideoThumb = ({ video_url, thumbnail_url }: { video_url: string | null; thumbnail_url: string | null }) => (
    <div onClick={() => video_url && setAcikVideo(video_url)}
      className="relative flex items-center justify-center rounded-lg overflow-hidden flex-shrink-0"
      style={{ width: 110, height: 62, border: "0.5px solid #e5e7eb", background: "#e5e7eb", cursor: video_url ? "pointer" : "default" }}>
      {thumbnail_url
        ? <img src={thumbnail_url} alt="thumbnail" className="w-full h-full object-cover" />
        : <div className="w-full h-full" style={{ background: "#b5d4f4" }} />
      }
      {video_url && (
        <div className="absolute w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
          <svg width="10" height="12" viewBox="0 0 10 12" fill="white"><path d="M0 0l10 6-10 6z" /></svg>
        </div>
      )}
    </div>
  );

  // Soru listesi
  const SoruListesi = ({ sorular, soru_seti_durum_id, bekleyen }: { sorular: any[]; soru_seti_durum_id: string; bekleyen?: Bekleyen | false }) => (
    <div className="border-t border-gray-100 px-4 py-3">
      {bekleyen && (
        <div className="flex items-center justify-end gap-2 mb-3 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
          <span className="text-xs text-blue-700 font-semibold">Her soru aynı</span>
          <select value="" onChange={(e) => { if (e.target.value) hepsineAyniPuanAta(soru_seti_durum_id, sorular, Number(e.target.value)); }}
            className="border border-blue-200 rounded-lg px-2 py-1 text-xs text-blue-700 bg-white"
            style={{ fontFamily: "'Nunito', sans-serif", width: 90 }}>
            <option value="">Seçiniz</option>
            {SORU_PUAN_SECENEKLERI.map(p => <option key={p} value={p}>{p} puan</option>)}
          </select>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {sorular.map((soru: any, i: number) => (
          <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50">
            <span className="text-xs text-gray-400 flex-shrink-0 pt-0.5" style={{ minWidth: 20 }}>{i + 1}.</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-700 leading-relaxed mb-1.5">{soru.soru_metni}</div>
              <div className="flex flex-col gap-1">
                {soru.secenekler?.map((s: any, j: number) => (
                  <span key={j} className="text-xs px-2.5 py-0.5 rounded-full w-fit"
                    style={{ border: s.dogru ? "0.5px solid #56aeff" : "0.5px solid #e5e7eb", color: s.dogru ? "#56aeff" : "#737373", background: s.dogru ? "#e6f1fb" : "white" }}>
                    {s.harf}. {s.metin}
                  </span>
                ))}
              </div>
            </div>
            {bekleyen ? (
              <div className="flex-shrink-0 flex flex-col items-end gap-1">
                <span className="text-xs text-gray-400">Puan</span>
                <select value={getSoruPuani(soru_seti_durum_id, i)} onChange={(e) => setSoruPuani(soru_seti_durum_id, i, Number(e.target.value))}
                  className="border border-gray-200 rounded-lg px-1.5 py-1 text-xs text-gray-900 bg-white"
                  style={{ fontFamily: "'Nunito', sans-serif", width: 80 }}>
                  <option value="">-</option>
                  {SORU_PUAN_SECENEKLERI.map(p => <option key={p} value={p}>{p} puan</option>)}
                </select>
              </div>
            ) : (
              <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
                <span className="text-xs text-gray-400">Puan</span>
                <span className="text-xs font-bold" style={{ color: "#56aeff" }}>{getSoruPuani(soru_seti_durum_id, i) || "-"}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // Bekleyen satır
  const BekleyenSatir = ({ b }: { b: Bekleyen }) => {
    const acik = bekleyenIleriSarma[b.soru_seti_durum_id] ?? false;
    const hazir = tumPuanlarAtandiMi(b);
    return (
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-2">
        <div className="flex flex-col md:grid md:items-center md:gap-3 p-4 md:p-3.5"
          style={{ gridTemplateColumns: "1fr 120px 140px auto" }}>
          {/* Ürün bilgisi */}
          <div className="flex flex-col gap-1 mb-3 md:mb-0 min-w-0">
            <span className="text-sm font-semibold text-gray-900 truncate">{b.urun_adi}</span>
            <span className="text-xs text-gray-500 line-clamp-2">{b.teknik_adi}</span>
          </div>
          {/* Thumbnail */}
          <div className="mb-3 md:mb-0 flex justify-start md:justify-center">
            <VideoThumb video_url={b.video_url} thumbnail_url={b.thumbnail_url} />
          </div>
          {/* Puan ayarları */}
          <div className="flex flex-col gap-2 mb-3 md:mb-0">
            <div>
              <span className="text-xs text-gray-400 block mb-1">Video puanı</span>
              <select value={videoPuanlari[b.soru_seti_durum_id] ?? b.video_puani ?? ""}
                onChange={(e) => setVideoPuanlari(prev => ({ ...prev, [b.soru_seti_durum_id]: Number(e.target.value) }))}
                className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-900 bg-white"
                style={{ fontFamily: "'Nunito', sans-serif", width: 90 }}>
                <option value="">Seçiniz</option>
                {VIDEO_PUAN_SECENEKLERI.map(p => <option key={p} value={p}>{p} puan</option>)}
              </select>
            </div>
            <div>
              <span className="text-xs text-gray-400 block mb-1">Extra puan</span>
              <select value={extraPuanlar[b.soru_seti_durum_id] ?? ""}
                onChange={(e) => setExtraPuanlar(prev => ({ ...prev, [b.soru_seti_durum_id]: Number(e.target.value) }))}
                className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-900 bg-white"
                style={{ fontFamily: "'Nunito', sans-serif", width: 90 }}>
                <option value="">Seçiniz</option>
                {[5, 6, 7, 8, 9, 10].map(p => <option key={p} value={p}>{p} puan</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">İleri sarma</span>
              <Toggle acik={acik} onClick={() => handleBekleyenIleriSarmaToggle(b.soru_seti_durum_id, b.urun_adi)} />
            </div>
          </div>
          {/* Butonlar */}
          <div className="flex items-center gap-2 justify-end">
            {b.sorular?.length > 0 && (
              <button onClick={() => setAcikAkordiyon(acikAkordiyon === b.soru_seti_durum_id ? null : b.soru_seti_durum_id)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700 cursor-pointer"
                style={{ fontFamily: "'Nunito', sans-serif" }}>
                Soru Seti
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  style={{ transform: acikAkordiyon === b.soru_seti_durum_id ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            )}
            <button onClick={() => setOnayModal(b)} disabled={!hazir || islemLoading === b.soru_seti_durum_id}
              className="px-2.5 py-1 rounded-lg border-none text-xs font-semibold cursor-pointer"
              style={{ background: hazir ? "#56aeff" : "#f3f4f6", color: hazir ? "white" : "#9ca3af", cursor: hazir ? "pointer" : "not-allowed", fontFamily: "'Nunito', sans-serif" }}>
              {islemLoading === b.soru_seti_durum_id ? "..." : "Yayınla"}
            </button>
          </div>
        </div>
        {acikAkordiyon === b.soru_seti_durum_id && b.sorular?.length > 0 && (
          <SoruListesi sorular={b.sorular} soru_seti_durum_id={b.soru_seti_durum_id} bekleyen={b} />
        )}
      </div>
    );
  };

  // Yayın satırı
  const YayinSatir = ({ y }: { y: Yayin }) => (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-2">
      <div className="flex flex-col md:grid md:items-center md:gap-3 p-4 md:p-3.5"
        style={{ gridTemplateColumns: "1fr 120px 140px auto" }}>
        <div className="flex flex-col gap-1 mb-3 md:mb-0 min-w-0">
          <span className="text-sm font-semibold text-gray-900 truncate">{y.urun_adi}</span>
          <span className="text-xs text-gray-500 line-clamp-2">{y.teknik_adi}</span>
        </div>
        <div className="mb-3 md:mb-0 flex justify-start md:justify-center">
          <VideoThumb video_url={y.video_url} thumbnail_url={y.thumbnail_url} />
        </div>
        <div className="flex flex-col gap-1 mb-3 md:mb-0">
          <span className="text-xs text-gray-400">Video puanı</span>
          <span className="text-sm font-bold" style={{ color: "#56aeff" }}>{y.video_puani} puan</span>
          <IleriSarmaBadge acik={y.ileri_sarma_acik} />
          {y.durdurma_tarihi && <span className="text-xs text-gray-400">Durdurulma: {formatTarih(y.durdurma_tarihi)}</span>}
        </div>
        <div className="flex items-center gap-2 justify-end">
          {y.sorular?.length > 0 && (
            <button onClick={() => setAcikAkordiyon(acikAkordiyon === y.yayin_id ? null : y.yayin_id)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700 cursor-pointer"
              style={{ fontFamily: "'Nunito', sans-serif" }}>
              Soru Seti
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ transform: acikAkordiyon === y.yayin_id ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          )}
          {y.durum === "Yayinda" ? (
            <button onClick={() => handleDurumDegistir(y.yayin_id, y.durum)} disabled={islemLoading === y.yayin_id}
              className="px-2.5 py-1 rounded-lg bg-transparent text-xs font-semibold cursor-pointer"
              style={{ border: "0.5px solid #fecaca", color: "#bc2d0d", fontFamily: "'Nunito', sans-serif" }}>
              {islemLoading === y.yayin_id ? "..." : "Durdur"}
            </button>
          ) : (
            <button onClick={() => handleDurumDegistir(y.yayin_id, y.durum)} disabled={islemLoading === y.yayin_id}
              className="px-2.5 py-1 rounded-lg border-none text-white text-xs font-semibold cursor-pointer"
              style={{ background: "#56aeff", fontFamily: "'Nunito', sans-serif" }}>
              {islemLoading === y.yayin_id ? "..." : "Yayınla"}
            </button>
          )}
        </div>
      </div>
      {acikAkordiyon === y.yayin_id && y.sorular?.length > 0 && (
        <SoruListesi sorular={y.sorular} soru_seti_durum_id={y.soru_seti_durum_id} bekleyen={false} />
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={user?.email ?? ""} rol={rol} onCikis={handleCikis} />

      <div className="max-w-4xl mx-auto px-3 py-4 md:px-6 md:py-6">

        {/* Sekme bar */}
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 w-fit mb-5 overflow-x-auto">
          {(["bekleyen", "yayinda", "durdurulan"] as const).map((sekme) => (
            <button key={sekme} onClick={() => setAktifSekme(sekme)}
              className="px-4 py-1.5 rounded-lg border-none cursor-pointer text-xs font-semibold whitespace-nowrap"
              style={{ background: aktifSekme === sekme ? "#56aeff" : "transparent", color: aktifSekme === sekme ? "white" : "#737373", fontFamily: "'Nunito', sans-serif" }}>
              {sekme === "bekleyen" ? `Bekleyen (${bekleyenler.length})` : sekme === "yayinda" ? `Yayında (${yayindakiler.length})` : `Durdurulan (${durdurulular.length})`}
            </button>
          ))}
        </div>

        {/* Bekleyen */}
        {aktifSekme === "bekleyen" && (
          bekleyenler.length === 0
            ? <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-400">Bekleyen video yok.</div>
            : bekleyenler.map(b => <BekleyenSatir key={b.soru_seti_durum_id} b={b} />)
        )}

        {/* Yayında */}
        {aktifSekme === "yayinda" && (
          yayindakiler.length === 0
            ? <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-400">Yayında video yok.</div>
            : yayindakiler.map(y => <YayinSatir key={y.yayin_id} y={y} />)
        )}

        {/* Durdurulan */}
        {aktifSekme === "durdurulan" && (
          durdurulular.length === 0
            ? <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-400">Durdurulan video yok.</div>
            : durdurulular.map(y => <YayinSatir key={y.yayin_id} y={y} />)
        )}
      </div>

      {/* Video modal */}
      {acikVideo && (
        <div onClick={() => setAcikVideo(null)} className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-xl overflow-hidden w-11/12 md:w-4/5 max-w-3xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-900">Video Önizleme</span>
              <button onClick={() => setAcikVideo(null)} className="bg-transparent border-none cursor-pointer text-gray-500 text-lg">✕</button>
            </div>
            <iframe src={acikVideo} width="100%" height="450" frameBorder="0" allowFullScreen />
          </div>
        </div>
      )}

      {/* Yayın onay modal */}
      {onayModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-11/12 max-w-sm">
            <div className="text-sm font-semibold text-gray-900 mb-2.5">Yayın onayı</div>
            <div className="text-sm text-gray-500 leading-relaxed mb-5">
              <strong>{onayModal.urun_adi}</strong> ürünü yayınlanacaktır. Onaylıyor musunuz?
            </div>
            <div className="flex gap-2.5 justify-end">
              <button onClick={() => setOnayModal(null)}
                className="px-4 py-2 rounded-lg border border-gray-200 bg-transparent text-gray-500 text-xs cursor-pointer"
                style={{ fontFamily: "'Nunito', sans-serif" }}>İptal</button>
              <button onClick={handleYayinla}
                className="px-4 py-2 rounded-lg border-none text-white text-xs font-semibold cursor-pointer"
                style={{ background: "#56aeff", fontFamily: "'Nunito', sans-serif" }}>Yayınla</button>
            </div>
          </div>
        </div>
      )}

      {/* İleri sarma onay modal */}
      {ileriSarmaOnayModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-11/12 max-w-md">
            <div className="text-sm font-semibold text-gray-900 mb-3">İleri sarma açılacak</div>
            <div className="text-sm text-gray-500 leading-relaxed mb-5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-3">
              Bu videonun her saniyesi <strong style={{ color: "#bc2d0d" }}>puan değer taşır</strong>. İleri sarılan süre kadar izleyici puan kaybeder. İleri sarılan videolarda sorular gösterilmez.
            </div>
            <div className="flex gap-2.5 justify-end">
              <button onClick={() => setIleriSarmaOnayModal(null)}
                className="px-4 py-2 rounded-lg border border-gray-200 bg-transparent text-gray-500 text-xs cursor-pointer"
                style={{ fontFamily: "'Nunito', sans-serif" }}>İptal</button>
              <button onClick={() => handleIleriSarmaOnaylaVeAc(ileriSarmaOnayModal.soru_seti_durum_id)}
                className="px-4 py-2 rounded-lg border-none text-white text-xs font-semibold cursor-pointer"
                style={{ background: "#56aeff", fontFamily: "'Nunito', sans-serif" }}>Onayla, Aç</button>
            </div>
          </div>
        </div>
      )}

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}