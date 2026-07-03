// app/eclub/listem/_hooks/useEclubListem.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import type { Eczane, Kisi, YeniKisiForm, GlnSorguSonuc } from "../_types";

interface UseEclubListemArgs {
  hazir: boolean; // auth doğrulandıktan sonra true
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

export function useEclubListem({ hazir, hata, basari }: UseEclubListemArgs) {
  const [eczaneler, setEczaneler] = useState<Eczane[]>([]);
  const [kisiler, setKisiler] = useState<Kisi[]>([]);
  const [loading, setLoading] = useState(true);
  const [islemLoading, setIslemLoading] = useState(false);

  const veriCek = useCallback(async () => {
    setLoading(true);
    try {
      const [eczaneRes, kisiRes] = await Promise.all([
        fetch("/eclub/listem/api/eczaneler"),
        fetch("/eclub/listem/api/kisiler"),
      ]);
      const eczaneData = await eczaneRes.json();
      const kisiData = await kisiRes.json();

      if (!eczaneRes.ok) hata(eczaneData.hata ?? "Eczaneler yüklenemedi.", eczaneData.adim, eczaneData.detay);
      else setEczaneler(eczaneData.eczaneler ?? []);

      if (!kisiRes.ok) hata(kisiData.hata ?? "Kişiler yüklenemedi.", kisiData.adim, kisiData.detay);
      else setKisiler(kisiData.kisiler ?? []);
    } catch (err) {
      hata("Veri yüklenirken hata oluştu.", "useEclubListem veriCek", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [hata]);

  useEffect(() => {
    if (hazir) veriCek();
  }, [hazir, veriCek]);

  // GLN sorgu (debounce'lu çağrılır). Havuzda var mı, varsa eczane+kişiler döner.
  const glnSorgula = useCallback(async (gln: string): Promise<GlnSorguSonuc | null> => {
    try {
      const res = await fetch(`/eclub/listem/api/eczaneler?gln=${encodeURIComponent(gln.trim())}`);
      const d = await res.json();
      if (!res.ok) {
        hata(d.hata ?? "GLN sorgulanamadı.", d.adim, d.detay);
        return null;
      }
      return d as GlnSorguSonuc;
    } catch (err) {
      hata("GLN sorgulanırken hata oluştu.", "glnSorgula", err instanceof Error ? err.message : undefined);
      return null;
    }
  }, [hata]);

  // Eczane ekle (bul-veya-oluştur). Master onaylı GLN varsa listeye bağlar;
  // master'da yoksa elle ekleme (ad/il/ilçe ile admin onayına gider).
  const eczaneEkle = useCallback(async (
    gln: string,
    ekstra?: { eczane_adi?: string; il?: string; ilce?: string },
  ): Promise<boolean> => {
    setIslemLoading(true);
    try {
      const res = await fetch("/eclub/listem/api/eczaneler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gln: gln.trim(),
          eczane_adi: ekstra?.eczane_adi?.trim(),
          il: ekstra?.il?.trim(),
          ilce: ekstra?.ilce?.trim(),
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        hata(d.hata ?? "Eczane eklenemedi.", d.adim, d.detay);
        return false;
      }
      basari(d.mesaj ?? "Eczane listenize eklendi.");
      await veriCek();
      return true;
    } catch (err) {
      hata("Eczane eklenirken hata oluştu.", "eczaneEkle", err instanceof Error ? err.message : undefined);
      return false;
    } finally {
      setIslemLoading(false);
    }
  }, [hata, basari, veriCek]);

  // Eczaneyi listeden çıkar (soft — ilişki pasife alınır, kimlik havuzda kalır).
  const eczaneListedenCikar = useCallback(async (eczane_id: string): Promise<boolean> => {
    setIslemLoading(true);
    try {
      const res = await fetch("/eclub/listem/api/eczaneler", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eczane_id, islem: "listeden_cikar" }),
      });
      const d = await res.json();
      if (!res.ok) {
        hata(d.hata ?? "Eczane çıkarılamadı.", d.adim, d.detay);
        return false;
      }
      basari(d.mesaj ?? "Eczane listenizden çıkarıldı.");
      await veriCek();
      return true;
    } catch (err) {
      hata("Eczane çıkarılırken hata oluştu.", "eczaneListedenCikar", err instanceof Error ? err.message : undefined);
      return false;
    } finally {
      setIslemLoading(false);
    }
  }, [hata, basari, veriCek]);

  // Yeni kişi ekle (eczane bloğundaki "kişi ekle"). Backend bul-veya-oluştur + tek aktif GLN.
  const kisiEkle = useCallback(async (eczane_id: string, form: YeniKisiForm): Promise<boolean> => {
    setIslemLoading(true);
    try {
      const res = await fetch("/eclub/listem/api/kisiler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eczane_id,
          rol: form.rol,
          ad: form.ad.trim(),
          soyad: form.soyad.trim(),
          eposta: form.eposta.trim(),
          telefon: form.telefon.trim(),
          sifre: form.sifre,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        hata(d.hata ?? "Kişi eklenemedi.", d.adim, d.detay);
        return false;
      }
      basari(d.mesaj ?? "Kişi eklendi.");
      await veriCek();
      return true;
    } catch (err) {
      hata("Kişi eklenirken hata oluştu.", "kisiEkle", err instanceof Error ? err.message : undefined);
      return false;
    } finally {
      setIslemLoading(false);
    }
  }, [hata, basari, veriCek]);

  // Kişi bilgisi güncelle (ad/soyad/eposta/telefon). eczane_id sahiplik için gerekli.
  const kisiGuncelle = useCallback(async (
    kisi_id: string,
    eczane_id: string,
    alanlar: Partial<{ ad: string; soyad: string; eposta: string; telefon: string }>,
  ): Promise<boolean> => {
    setIslemLoading(true);
    try {
      const res = await fetch("/eclub/listem/api/kisiler", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kisi_id, eczane_id, ...alanlar }),
      });
      const d = await res.json();
      if (!res.ok) {
        hata(d.hata ?? "Kişi güncellenemedi.", d.adim, d.detay);
        return false;
      }
      basari(d.mesaj ?? "Kişi güncellendi.");
      await veriCek();
      return true;
    } catch (err) {
      hata("Kişi güncellenirken hata oluştu.", "kisiGuncelle", err instanceof Error ? err.message : undefined);
      return false;
    } finally {
      setIslemLoading(false);
    }
  }, [hata, basari, veriCek]);

  // Kişiyi eczaneden pasife al (soft — bağ aktif_mi=false, kimlik havuzda kalır).
  const kisiPasifeAl = useCallback(async (kisi_id: string, eczane_id: string): Promise<boolean> => {
    setIslemLoading(true);
    try {
      const res = await fetch("/eclub/listem/api/kisiler", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kisi_id, eczane_id, islem: "pasife_al" }),
      });
      const d = await res.json();
      if (!res.ok) {
        hata(d.hata ?? "Kişi pasife alınamadı.", d.adim, d.detay);
        return false;
      }
      basari(d.mesaj ?? "Kişi pasife alındı.");
      await veriCek();
      return true;
    } catch (err) {
      hata("Kişi pasife alınırken hata oluştu.", "kisiPasifeAl", err instanceof Error ? err.message : undefined);
      return false;
    } finally {
      setIslemLoading(false);
    }
  }, [hata, basari, veriCek]);

  return {
    eczaneler,
    kisiler,
    loading,
    islemLoading,
    veriCek,
    glnSorgula,
    eczaneEkle,
    eczaneListedenCikar,
    kisiEkle,
    kisiGuncelle,
    kisiPasifeAl,
  };
}