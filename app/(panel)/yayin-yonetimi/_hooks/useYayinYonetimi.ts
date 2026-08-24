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
import { useCallback, useEffect, useState } from "react";
import { ECLUB_ORTAK_YAYIN_GRUBU, hedefRolleriOku, yalnizEclubHedefliMi, type YayinHedefGrubu } from "@/lib/utils/roller";
import type { Bekleyen, BekleyenHedefSayilari, Yayin } from "../_types";
import { gecerliTurBaslangiclari, type HesaplananTur } from "@/lib/tclub/tur/kayit";
import { TALEP_TURU_KURALLARI, type TalepTuru } from "@/lib/uretici/yetenekler";

interface UseYayinYonetimiArgs {
  kullaniciVar: boolean;
  aktifAnaSekme: YayinHedefGrubu;
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

type YayinApiSatiri = Omit<Yayin, "hedef_roller" | "turu_adi"> & {
  hedef_roller: string[] | null;
  egitim_turu: string | null;
};

export function useYayinYonetimi({ kullaniciVar, aktifAnaSekme, hata, basari }: UseYayinYonetimiArgs) {
  const [bekleyenler, setBekleyenler] = useState<Bekleyen[]>([]);
  const [bekleyenHedefSayilari, setBekleyenHedefSayilari] = useState<BekleyenHedefSayilari>({
    utt: 0,
    bm: 0,
    eczaci: 0,
    eczane_teknisyeni: 0,
    [ECLUB_ORTAK_YAYIN_GRUBU]: 0,
    eczanem: 0,
  });
  const [yayinlar, setYayinlar] = useState<Yayin[]>([]);
  const [loading, setLoading] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [islemLoading, setIslemLoading] = useState<string | null>(null);

  const [videoPuanlari, setVideoPuanlari] = useState<Record<string, number>>({});
  const [soruPuanlari, setSoruPuanlari] = useState<Record<string, Record<number, number>>>({});
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

  // Opsiyonel yayın günü (İş 2) — soru_seti_durum_id → "YYYY-AA-GG".
  // Boş = hemen yayın; doluysa yayın o gün 07:00 TR'de cron'la aktive edilir.
  const [yayinGunleri, setYayinGunleri] = useState<Record<string, string>>({});

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
  }, [kullaniciVar, hata]);

  const veriCek = useCallback(async (ilkYukleme = false) => {
    if (ilkYukleme) setLoading(true);
    else setYenileniyor(true);
    try {
      const supabase = createClient();

    // Bekleyenler: ana sekmeye göre filtreli çek
    const bRes = await fetch(`/yayin-yonetimi/api/bekleyenler?hedef=${aktifAnaSekme}`);
    const bData = await bRes.json();
    if (!bRes.ok) {
      hata(bData.hata ?? "Bekleyenler yüklenemedi.", bData.adim, bData.detay);
    } else {
      const bekleyenlerData = (bData.bekleyenler ?? []) as Bekleyen[];
      setBekleyenler(bekleyenlerData);
      setBekleyenHedefSayilari({
        utt: Number(bData.sayilar?.utt ?? 0),
        bm: Number(bData.sayilar?.bm ?? 0),
        eczaci: Number(bData.sayilar?.eczaci ?? 0),
        eczane_teknisyeni: Number(bData.sayilar?.eczane_teknisyeni ?? 0),
        [ECLUB_ORTAK_YAYIN_GRUBU]: Number(bData.sayilar?.[ECLUB_ORTAK_YAYIN_GRUBU] ?? 0),
        eczanem: Number(bData.sayilar?.eczanem ?? 0),
      });
      const yeniSoruPuanlari: Record<string, Record<number, number>> = {};
      for (const b of bekleyenlerData) {
        yeniSoruPuanlari[b.soru_seti_durum_id] = {};
        for (const [idx, puan] of Object.entries(b.soru_puan_map ?? {})) {
          yeniSoruPuanlari[b.soru_seti_durum_id][Number(idx)] = puan.soru_puani;
        }
      }
      setSoruPuanlari(yeniSoruPuanlari);
    }

    // Yayınlar sunucuda oturumdaki üreticiye göre süzülür. Hedef rol ayrımı
    // sayfadaki sekmeler için client-side kalır; sahiplik sınırı client'a bırakılmaz.
    const yayinRes = await fetch("/yayin-yonetimi/api/yayinlar");
    const yayinData = await yayinRes.json();
    if (!yayinRes.ok) {
      hata(yayinData.hata ?? "Yayınlar yüklenemedi.", yayinData.adim, yayinData.detay);
      return;
    }
    const yayinlarData = (yayinData.yayinlar ?? []) as YayinApiSatiri[];

    if ((yayinlarData ?? []).length > 0) {
      setYayinlar((yayinlarData ?? []).map(y => ({
        ...y,
        hedef_roller: hedefRolleriOku(y),
        turu_adi: y.egitim_turu ? (TALEP_TURU_KURALLARI[y.egitim_turu as TalepTuru]?.ad ?? null) : null,
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

    } catch (err) {
      hata("Yayın yönetimi verileri yüklenemedi.", "Yayın Yönetimi", err instanceof Error ? err.message : undefined);
    } finally {
      if (ilkYukleme) setLoading(false);
      else setYenileniyor(false);
    }
  }, [aktifAnaSekme, hata]);

  useEffect(() => { if (kullaniciVar) void veriCek(true); }, [kullaniciVar, veriCek]);

  // ─── Puan yardımcıları ──────────────────────────────────────────────────

  const getSoruPuani = (soru_seti_durum_id: string, soru_index: number): number | "" =>
    soruPuanlari[soru_seti_durum_id]?.[soru_index] ?? "";

  const setSoruPuani = (soru_seti_durum_id: string, soru_index: number, puan: number) => {
    setSoruPuanlari(prev => ({ ...prev, [soru_seti_durum_id]: { ...(prev[soru_seti_durum_id] ?? {}), [soru_index]: puan } }));
  };

  const hepsineAyniPuanAta = (soru_seti_durum_id: string, sorular: Bekleyen["sorular"], puan: number) => {
    const yeni: Record<number, number> = {};
    sorular.forEach((_, i) => { yeni[i] = puan; });
    setSoruPuanlari(prev => ({ ...prev, [soru_seti_durum_id]: yeni }));
  };

  const tumPuanlarAtandiMi = (b: Bekleyen): boolean => {
    const vp = videoPuanlari[b.soru_seti_durum_id] ?? b.video_puani;
    if (!vp) return false;
    const eclub = yalnizEclubHedefliMi(b.hedef_roller);
    if (b.hedef_roller.includes("eczanem")) {
      // Eczanem: extra puan yok; barkod + Karşılık (puan ve TL) zorunlu.
      if (!barkodlar[b.soru_seti_durum_id]?.trim()) return false;
      if (!karsilikPuanlar[b.soru_seti_durum_id] || !karsilikTllar[b.soru_seti_durum_id]) return false;
    } else if (!eclub && !extraPuanlar[b.soru_seti_durum_id]) {
      return false;
    }
    for (let i = 0; i < b.sorular.length; i++) {
      if (!soruPuanlari[b.soru_seti_durum_id]?.[i]) return false;
    }
    return true;
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

    // Hedef dizisi backend'de talebin hedef_roller alanından türetilir.
    // Eczanem yayınında ileri sarma / extra puan / tekrar periyodu yok; barkod + Karşılık var.
    const eczanem = b.hedef_roller.includes("eczanem");
    const eclub = yalnizEclubHedefliMi(b.hedef_roller);
    const res = await fetch("/yayin-yonetimi/api/yayinlar", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        soru_seti_durum_id: b.soru_seti_durum_id,
        // Opsiyonel yayın günü — boşsa gönderilmez (hemen yayın).
        ...(yayinGunleri[b.soru_seti_durum_id] ? { yayin_gunu: yayinGunleri[b.soru_seti_durum_id] } : {}),
        ...(eczanem
          ? {
              barkod: barkodlar[b.soru_seti_durum_id] ?? "",
              karsilik_puan: karsilikPuanlar[b.soru_seti_durum_id] ?? null,
              karsilik_tl: karsilikTllar[b.soru_seti_durum_id] ?? null,
            }
          : eclub
            ? {
                tekrar_periyot_gun: tekrarPeriyotlari[b.soru_seti_durum_id] ?? null,
              }
            : {
              extra_puan: extraPuanlar[b.soru_seti_durum_id] ?? null,
              tekrar_periyot_gun: tekrarPeriyotlari[b.soru_seti_durum_id] ?? null,
            }),
      }),
    });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "Yayına alınamadı.", d.adim, d.detay); }
    else {
      // Planlı yayında API tarihli mesaj döner; hemen yayında bilinen metin.
      basari(d.mesaj ?? `${b.urun_adi} yayına alındı.`);
      setYayinGunleri(prev => { const yeni = { ...prev }; delete yeni[b.soru_seti_durum_id]; return yeni; });
      await veriCek();
    }
    setIslemLoading(null);
  };

  const handleYayinSil = async (b: Bekleyen) => {
    setIslemLoading(b.soru_seti_durum_id);
    try {
      const res = await fetch("/yayin-yonetimi/api/bekleyenler/sil", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          soru_seti_durum_id: b.soru_seti_durum_id,
          islem_anahtari: crypto.randomUUID(),
        }),
      });
      const d = await res.json();
      if (!res.ok) hata(d.hata ?? "Yayın adayı silinemedi.", d.adim, d.detay);
      else basari(d.mesaj ?? "Yayın adayı kalıcı olarak silindi.");
      await veriCek();
    } catch (err) {
      hata("Yayın adayı silinemedi.", "Yayın öncesi silme", err instanceof Error ? err.message : undefined);
      await veriCek();
    } finally {
      setIslemLoading(null);
    }
  };

  // Planlanmış yayın aksiyonları (İş 2): tarih_degistir | hemen_yayinla | plan_iptal.
  const handlePlanIslem = async (yayin_id: string, islem: string, yayin_gunu?: string) => {
    setIslemLoading(yayin_id);
    const res = await fetch(`/yayin-yonetimi/api/yayinlar/${yayin_id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ islem, ...(yayin_gunu ? { yayin_gunu } : {}) }),
    });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "İşlem gerçekleştirilemedi.", d.adim, d.detay); }
    else { basari(d.mesaj ?? "İşlem tamamlandı."); await veriCek(); }
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
    bekleyenler, bekleyenHedefSayilari, yayinlar, loading, yenileniyor, islemLoading,
    videoPuanlari, setVideoPuanlari,
    soruPuanlari,
    extraPuanlar, setExtraPuanlar,
    barkodlar, setBarkodlar,
    karsilikPuanlar, setKarsilikPuanlar,
    karsilikTllar, setKarsilikTllar,
    tekrarPeriyotlari, setTekrarPeriyotlari,
    tekrarSecenekleri,
    tekrarBilgi,
    yayinGunleri, setYayinGunleri,
    // veri
    veriCek,
    // puan yardımcıları
    getSoruPuani, setSoruPuani, hepsineAyniPuanAta, tumPuanlarAtandiMi,
    // handler'lar
    handleYayinla, handleYayinSil, handleDurumDegistir, handlePlanIslem,
  };
}
