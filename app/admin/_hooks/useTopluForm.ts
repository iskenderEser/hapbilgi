// app/admin/_hooks/useTopluForm.ts
//
// Toplu giriş sekmesinin state + handler'ları. useAdminPanel shell'den
// seciliFirma, refreshKullanicilar, hata, basari prop'larını alır.
// seciliFirma değişince form ve önizleme otomatik sıfırlanır.

"use client";

import { useState, useEffect } from "react";
import type { Firma, OnizlemeKurulum, OnizlemeSatir } from "../_types";

interface UseTopluFormProps {
  seciliFirma: Firma | null;
  refreshKullanicilar: () => void;
  // K-A8: yükleme takım/bölge oluşturabilir — organizasyon görünümü tazelenir.
  refreshTakimlar: () => void;
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

// Kaydet sonucunun dürüst özeti (B-17): route satır bazında devam eder ve
// upsert kırılımını döner; UI bunu olduğu gibi gösterir.
export interface TopluKaydetSonucu {
  eklenen: number;
  guncellenen: number;
  degismeyen: number;
  eksikli: number; // K-A6: işlenen ama eksik bilgili satır sayısı
  hatali: number;
  // K-A8: bu yüklemeyle açılan takım/bölge sayıları
  olusturulanTakim: number;
  olusturulanBolge: number;
  hatalar: string[];
}

export function useTopluForm({ seciliFirma, refreshKullanicilar, refreshTakimlar, hata, basari }: UseTopluFormProps) {
  const [topluDosya, setTopluDosya] = useState<File | null>(null);
  const [onizlemesatirlari, setOnizlemeSatirlari] = useState<OnizlemeSatir[] | null>(null);
  const [onizlemeKurulum, setOnizlemeKurulum] = useState<OnizlemeKurulum | null>(null);
  const [onizlemeLoading, setOnizlemeLoading] = useState(false);
  const [topluKaydetLoading, setTopluKaydetLoading] = useState(false);
  const [kaydetSonucu, setKaydetSonucu] = useState<TopluKaydetSonucu | null>(null);

  // seciliFirma değişince formu sıfırla
  useEffect(() => {
    setTopluDosya(null);
    setOnizlemeSatirlari(null);
    setOnizlemeKurulum(null);
    setKaydetSonucu(null);
  }, [seciliFirma?.firma_id]);

  const handleDosyaSec = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const dosya = e.target.files?.[0] ?? null;
    // B-32: input değeri sıfırlanır — düzeltilen dosya AYNI adla yeniden
    // seçildiğinde de onChange tetiklenir.
    e.target.value = "";
    setTopluDosya(dosya);
    setOnizlemeSatirlari(null);
    setOnizlemeKurulum(null);
    setKaydetSonucu(null);
    if (!dosya || !seciliFirma) return;
    setOnizlemeLoading(true);
    try {
      const formData = new FormData();
      formData.append("dosya", dosya);
      formData.append("mod", "onizle");
      const res = await fetch(`/admin/api/firmalar/${seciliFirma.firma_id}/toplu-yukle`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Dosya okunamadı.", data.adim, data.detay); }
      else { setOnizlemeSatirlari(data.satirlar ?? []); setOnizlemeKurulum(data.kurulum ?? null); }
    } catch (err) {
      // B-32: ağ hatasında yükleme durumu takılı kalmaz.
      hata("Dosya okunamadı — bağlantı hatası.", "handleDosyaSec", String(err));
    } finally {
      setOnizlemeLoading(false);
    }
  };

  const handleTopluKaydet = async () => {
    if (!topluDosya || !seciliFirma) return;
    setTopluKaydetLoading(true);
    setKaydetSonucu(null);
    try {
      const formData = new FormData();
      formData.append("dosya", topluDosya);
      const res = await fetch(`/admin/api/firmalar/${seciliFirma.firma_id}/toplu-yukle`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Toplu yükleme başarısız.", data.adim, data.detay); }
      else {
        // B-17: sonuç OLDUĞU GİBİ raporlanır — kısmi başarısızlık gizlenmez.
        const sonuc: TopluKaydetSonucu = {
          eklenen: data.eklenen ?? 0,
          guncellenen: data.guncellenen ?? 0,
          degismeyen: data.degismeyen ?? 0,
          eksikli: data.eksikli ?? 0,
          hatali: data.hatali ?? 0,
          olusturulanTakim: data.olusturulanTakim ?? 0,
          olusturulanBolge: data.olusturulanBolge ?? 0,
          hatalar: data.hatalar ?? [],
        };
        setKaydetSonucu(sonuc);
        // K-A8: takım/bölge açıldıysa organizasyon görünümü tazelenir.
        if (sonuc.olusturulanTakim > 0 || sonuc.olusturulanBolge > 0) refreshTakimlar();
        if (sonuc.hatali === 0) {
          basari(data.mesaj ?? "Toplu yükleme tamamlandı.");
          setTopluDosya(null);
          setOnizlemeSatirlari(null);
          setOnizlemeKurulum(null);
        } else {
          // Kısmi başarısızlıkta önizleme ekranda kalır; hatalı satır listesi
          // kaydetSonucu üzerinden görünür biçimde basılır (TopluGirisFormu).
          hata(`${sonuc.eklenen} eklendi, ${sonuc.guncellenen} güncellendi, ${sonuc.hatali} satır işlenemedi.`, "toplu kaydet");
        }
        refreshKullanicilar();
      }
    } catch (err) {
      hata("Toplu yükleme tamamlanamadı — bağlantı hatası.", "handleTopluKaydet", String(err));
    } finally {
      setTopluKaydetLoading(false);
    }
  };

  const yeniSayisi = onizlemesatirlari?.filter(s => s.islem === "yeni").length ?? 0;
  const guncelleSayisi = onizlemesatirlari?.filter(s => s.islem === "guncelle").length ?? 0;
  const degismeyenSayisi = onizlemesatirlari?.filter(s => s.islem === "degisiklik-yok").length ?? 0;
  const eksikSayisi = onizlemesatirlari?.filter(s => s.durum === "eksik").length ?? 0;
  const hataliSayisi = onizlemesatirlari?.filter(s => s.durum === "hatali").length ?? 0;

  return {
    topluDosya,
    onizlemesatirlari,
    onizlemeKurulum,
    onizlemeLoading,
    topluKaydetLoading,
    yeniSayisi,
    guncelleSayisi,
    degismeyenSayisi,
    eksikSayisi,
    hataliSayisi,
    kaydetSonucu,
    handleDosyaSec,
    handleTopluKaydet,
  };
}