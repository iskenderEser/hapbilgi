// app/yayin-yonetimi/_hooks/useYayinYonetimi.ts
//
// Yayın yönetimi sayfasının tüm veri ve iş mantığı.
// page.tsx bu hook'u çağırır; state, veri çekme ve handler'lar buradan gelir.
//
// Sorumluluklar:
//   - Bekleyen (puanlama bekleyen) ve yayınlanmış içerikleri çeker (ana sekmeye göre).
//   - Puanlama state'i (video/soru/extra puanları, ileri sarma, tekrar periyodu).
//   - Yayın tur bilgisi (tekrar sayacı — lib/tur salt-okur toplu hesap).
//   - Yayınlama, durdurma/başlatma, ileri sarma güncelleme handler'ları.
//
// Davranış page.tsx'teki orijinaliyle birebir aynıdır — sadece taşındı.

"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import type { HedefRol } from "@/app/talepler/_types";
import type { Bekleyen, Yayin } from "../_types";
import { gecerliTurBaslangiclari, type HesaplananTur } from "@/lib/tur/kayit";

interface UseYayinYonetimiArgs {
  kullaniciVar: boolean;
  aktifAnaSekme: HedefRol;
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

export function useYayinYonetimi({ kullaniciVar, aktifAnaSekme, hata, basari }: UseYayinYonetimiArgs) {
  const [bekleyenler, setBekleyenler] = useState<Bekleyen[]>([]);
  const [yayinlar, setYayinlar] = useState<Yayin[]>([]);
  const [loading, setLoading] = useState(true);
  const [islemLoading, setIslemLoading] = useState<string | null>(null);

  const [videoPuanlari, setVideoPuanlari] = useState<Record<string, number>>({});
  const [soruPuanlari, setSoruPuanlari] = useState<Record<string, Record<number, number>>>({});
  const [bekleyenIleriSarma, setBekleyenIleriSarma] = useState<Record<string, boolean>>({});
  const [ileriSarmaAcik, setIleriSarmaAcik] = useState<Record<string, boolean>>({});
  const [extraPuanlar, setExtraPuanlar] = useState<Record<string, number>>({});

  // Eczanem yayını: barkod + Karşılık (puan ↔ TL) ürün seviyesine yazılır (U5, K-E3).
  // Her eczanem yayınında boş gelir, zorunludur; değer aynıysa server yeni tarife açmaz.
  const [barkodlar, setBarkodlar] = useState<Record<string, string>>({});
  const [karsilikPuanlar, setKarsilikPuanlar] = useState<Record<string, number>>({});
  const [karsilikTllar, setKarsilikTllar] = useState<Record<string, number>>({});

  // Tekrar gönderim periyodu — soru_seti_durum_id → seçilen gün (seçilmediyse tekrar yok).
  // Seçenek listesi sistem_ayarlari'ndan gelir (tek kaynak): api/tekrar-secenekleri.
  const [tekrarPeriyotlari, setTekrarPeriyotlari] = useState<Record<string, number>>({});
  const [tekrarSecenekleri, setTekrarSecenekleri] = useState<number[]>([]);

  // Yayın tur bilgisi — yayin_id → hesaplanmış tur (sayaç rozeti için; salt-okur).
  const [tekrarBilgi, setTekrarBilgi] = useState<Record<string, HesaplananTur>>({});

  useEffect(() => {
    if (!kullaniciVar) return;
    (async () => {
      const res = await fetch("/yayin-yonetimi/api/tekrar-secenekleri");
      const d = await res.json();
      if (!res.ok) {
        hata(d.hata ?? "Tekrar periyodu seçenekleri yüklenemedi.", d.adim, d.detay);
      } else {
        setTekrarSecenekleri(d.secenekler ?? []);
      }
    })();
  }, [kullaniciVar]);

  const veriCek = async () => {
    setLoading(true);
    const supabase = createClient();

    // Bekleyenler: ana sekmeye göre filtreli çek
    const bRes = await fetch(`/yayin-yonetimi/api/bekleyenler?hedef_rol=${aktifAnaSekme}`);
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

    // Yayınlar: tüm yayınları çekip client-side hedef_rol'e göre filtrele
    const { data: yayinlarData, error: yayinError } = await supabase
      .from("v_yayin_detay")
      .select("yayin_id, soru_seti_durum_id, durum, yayin_tarihi, durdurma_tarihi, urun_adi, teknik_adi, video_url, thumbnail_url, video_puani, soru_puani, sorular, hedef_rol")
      .order("yayin_tarihi", { ascending: false });

    if (yayinError) { hata("Yayınlar yüklenemedi.", "v_yayin_detay view SELECT", yayinError.message); setLoading(false); return; }

    if ((yayinlarData ?? []).length > 0) {
      const { data: yayinBilgileri } = await supabase
        .from("yayin_yonetimi").select("yayin_id, ileri_sarma_acik")
        .in("yayin_id", yayinlarData!.map(y => y.yayin_id));

      const ileriSarmaMapLocal: Record<string, boolean> = {};
      for (const yb of yayinBilgileri ?? []) {
        ileriSarmaMapLocal[yb.yayin_id] = yb.ileri_sarma_acik ?? false;
      }
      setIleriSarmaAcik(ileriSarmaMapLocal);
      setYayinlar((yayinlarData ?? []).map(y => ({
        ...y,
        hedef_rol: (y.hedef_rol ?? "utt") as HedefRol,
        ileri_sarma_acik: ileriSarmaMapLocal[y.yayin_id] ?? false,
      })));

      // Tur bilgisi — sayaç rozeti (salt-okur toplu hesap; satır açmaz).
      const turMap = await gecerliTurBaslangiclari(supabase, yayinlarData!.map(y => y.yayin_id));
      setTekrarBilgi(turMap);

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
      setTekrarBilgi({});
    }

    setLoading(false);
  };

  useEffect(() => { if (kullaniciVar) veriCek(); }, [kullaniciVar, aktifAnaSekme]);

  // ─── Puan yardımcıları ──────────────────────────────────────────────────

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
    if (b.hedef_rol === "eczanem") {
      // Eczanem: extra puan yok; barkod + Karşılık (puan ve TL) zorunlu.
      if (!barkodlar[b.soru_seti_durum_id]?.trim()) return false;
      if (!karsilikPuanlar[b.soru_seti_durum_id] || !karsilikTllar[b.soru_seti_durum_id]) return false;
    } else if (!extraPuanlar[b.soru_seti_durum_id]) {
      return false;
    }
    for (let i = 0; i < b.sorular.length; i++) {
      if (!soruPuanlari[b.soru_seti_durum_id]?.[i]) return false;
    }
    return true;
  };

  // ─── İleri sarma ────────────────────────────────────────────────────────

  const handleIleriSarmaGuncelle = async (yayin_id: string, ileri_sarma_acik: boolean) => {
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

  // ─── Yayınlama ──────────────────────────────────────────────────────────

  const handleYayinla = async (b: Bekleyen) => {
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

    // POST'a artık hedef_roller gönderilmiyor — backend talepler.hedef_rol'den türetiyor.
    // Eczanem yayınında ileri sarma / extra puan / tekrar periyodu yok; barkod + Karşılık var.
    const eczanem = b.hedef_rol === "eczanem";
    const res = await fetch("/yayin-yonetimi/api/yayinlar", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        soru_seti_durum_id: b.soru_seti_durum_id,
        ...(eczanem
          ? {
              barkod: barkodlar[b.soru_seti_durum_id] ?? "",
              karsilik_puan: karsilikPuanlar[b.soru_seti_durum_id] ?? null,
              karsilik_tl: karsilikTllar[b.soru_seti_durum_id] ?? null,
            }
          : {
              ileri_sarma_acik: bekleyenIleriSarma[b.soru_seti_durum_id] ?? false,
              extra_puan: extraPuanlar[b.soru_seti_durum_id] ?? null,
              tekrar_periyot_gun: tekrarPeriyotlari[b.soru_seti_durum_id] ?? null,
            }),
      }),
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
    else { basari(mevcutDurum === "yayinda" ? "Yayın durduruldu." : "Yayın yeniden başlatıldı."); await veriCek(); }
    setIslemLoading(null);
  };

  return {
    // state
    bekleyenler, yayinlar, loading, islemLoading,
    videoPuanlari, setVideoPuanlari,
    soruPuanlari,
    bekleyenIleriSarma, setBekleyenIleriSarma,
    ileriSarmaAcik,
    extraPuanlar, setExtraPuanlar,
    barkodlar, setBarkodlar,
    karsilikPuanlar, setKarsilikPuanlar,
    karsilikTllar, setKarsilikTllar,
    tekrarPeriyotlari, setTekrarPeriyotlari,
    tekrarSecenekleri,
    tekrarBilgi,
    // veri
    veriCek,
    // puan yardımcıları
    getSoruPuani, setSoruPuani, hepsineAyniPuanAta, tumPuanlarAtandiMi,
    // handler'lar
    handleIleriSarmaGuncelle, handleYayinla, handleDurumDegistir,
  };
}